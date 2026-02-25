#!/usr/bin/env python3
"""Fetch, validate, and merge authoritative external Linear A corpora.

Sources implemented:
- SigLA (Signs of Linear A database)
- John G. Younger archive (Wayback snapshots of people.ku.edu pages)

Rules:
- Structural transcription ingestion only.
- Every imported row carries explicit provenance URL.
- Validation aborts merge when hard-error rate exceeds threshold.
"""

from __future__ import annotations

import argparse
import csv
import html
import json
import math
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

from run_linear_a_structural_analysis import (
    DEFAULT_VARIANT_MAP,
    collect_internal_observations,
    load_variant_map,
    split_signs,
)

ROOT = Path(__file__).resolve().parents[2]
RESEARCH_DIR = ROOT / "linearA" / "research"
DATA_DIR = RESEARCH_DIR / "data"

DEFAULT_RAW_IMPORT = DATA_DIR / "external_corpus_import_raw.csv"
DEFAULT_EXTERNAL_CORPUS = DATA_DIR / "external_corpus.csv"
DEFAULT_VALIDATION_REPORT = DATA_DIR / "external_corpus_validation_report.md"

SIGLA_BROWSE_URL = "http://sigla.phis.me/browse.html"
SIGLA_BASE_URL = "http://sigla.phis.me"

YOUNGER_WAYBACK_URLS = [
    "https://web.archive.org/web/20190416193018/http://www.people.ku.edu/~jyounger/LinearA/HTtexts.html",
    "https://web.archive.org/web/20190416192926/http://www.people.ku.edu/~jyounger/LinearA/misctexts.html",
]

RAW_FIELDNAMES = [
    "source_name",
    "artifact_id",
    "line_id",
    "sign_sequence",
    "provenance_url",
    "notes",
]

EXTERNAL_FIELDNAMES = [
    "source_id",
    "artifact_id",
    "line_id",
    "sign_sequence",
    "provenance",
    "notes",
    "ingestion_timestamp",
    "source_name",
    "provenance_url",
]

STOPWORD_TOKENS = {
    "VACAT",
    "VACANT",
    "DEEST",
    "SUPRA",
    "INFRA",
    "MUTILA",
    "LINE",
    "STATEMENT",
    "LOGOGRAM",
    "NUMBER",
    "FRACTION",
    "SIDE",
    "NOTES",
    "TOTAL",
    "REST",
    "VEST",
    "BIS",
    "TER",
}

SIGLA_STOPWORD_TOKENS = {
    "NO",
    "OF",
    "IMPRESSIONS",
    "FRACTION",
    "SIGN",
    "SIGNS",
}

SIGLA_TOKEN_RE = re.compile(r"^(?:AB|A)\d+[A-Z0-9?]*$")


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def write_csv(path: Path, fieldnames: Sequence[str], rows: Iterable[Dict[str, object]]) -> None:
    ensure_dir(path.parent)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def read_csv(path: Path) -> List[Dict[str, str]]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames is None:
            return []
        return list(reader)


def fetch_text(url: str, timeout: float = 30.0, retries: int = 2) -> str:
    last_err: Optional[Exception] = None
    req = urllib.request.Request(url, headers={"User-Agent": "LinearAResearchBot/1.0"})
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read().decode("utf-8", "replace")
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            if attempt < retries:
                time.sleep(1.2 * (attempt + 1))
    if last_err is None:
        raise RuntimeError(f"failed to fetch {url}")
    raise RuntimeError(f"failed to fetch {url}: {last_err}")


def clean_html_fragment(fragment: str) -> str:
    s = fragment
    s = re.sub(r"<br\s*/?>", " ", s, flags=re.IGNORECASE)
    s = re.sub(r"</?(?:sub|sup)[^>]*>", "", s, flags=re.IGNORECASE)
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s)
    s = s.replace("\u00a0", " ")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def normalize_artifact_id(text: str) -> str:
    s = clean_html_fragment(text).upper()
    s = s.replace("<", " ").replace(">", " ")
    s = re.sub(r"[^A-Z0-9 ]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def normalize_line_id(text: str, fallback: str) -> str:
    s = clean_html_fragment(text)
    s = s.replace("\u2022", " ")
    s = s.strip()
    if not s:
        return fallback
    s = re.sub(r"\s+", " ", s)
    return s


def normalize_sequence_text(text: str) -> str:
    s = clean_html_fragment(text)
    s = s.upper()
    s = re.sub(r"\{[^{}]*\}", " ", s)
    s = s.replace("\u2022", " ")
    s = s.replace("\u00b7", " ")
    s = s.replace("|", " ")
    s = s.replace("/", " ")
    s = s.replace("•", " ")
    s = s.replace("·", " ")
    s = s.replace("…", " ")
    s = re.sub(r"\b\d+\b", " ", s)
    s = re.sub(r"[^A-Z0-9*?+\-\[\] ]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def validate_token_shape(token: str) -> bool:
    tok = token.strip()
    if not tok:
        return False
    if tok == "[?]":
        return True
    core = tok.strip("[]")
    if not core:
        return False
    return re.fullmatch(r"\*?[A-Z0-9?]+", core) is not None


def looks_like_sequence(seq: str) -> bool:
    if not seq:
        return False
    tokens = split_signs(seq)
    if not tokens:
        return False

    if any(tok in STOPWORD_TOKENS for tok in tokens):
        return False
    if "IMPRESSIONS" in tokens:
        return False
    if "NO" in tokens and "OF" in tokens and len(tokens) >= 3:
        return False

    valid = [tok for tok in tokens if validate_token_shape(tok)]
    if len(valid) < max(1, math.ceil(0.6 * len(tokens))):
        return False

    if len(tokens) == 1:
        core = tokens[0].strip("[]")
        if not core:
            return False
        if not (core.startswith("*") or any(ch.isdigit() for ch in core) or len(core) >= 3):
            return False

    return True


def canonical_sequence(seq: str) -> str:
    s = normalize_sequence_text(seq)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def slug_source(source_name: str) -> str:
    s = source_name.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    s = re.sub(r"_+", "_", s).strip("_")
    return s or "external"


# ------------------------------- SigLA -------------------------------

def extract_sigla_document_paths(browse_html: str) -> List[str]:
    paths = re.findall(r'href="(document/[^"]+/)"', browse_html)
    return sorted(set(paths))


def looks_like_sigla_sequence(seq: str) -> bool:
    tokens = split_signs(seq)
    if not tokens:
        return False
    if any(tok in SIGLA_STOPWORD_TOKENS for tok in tokens):
        return False

    has_sign_id = False
    for tok in tokens:
        core = tok.strip("[]")
        if tok == "[?]" or core == "?":
            has_sign_id = True
            continue
        if SIGLA_TOKEN_RE.fullmatch(core):
            has_sign_id = True
            continue
        # Allow starred numeric catalog references used as sign IDs in some rows.
        if re.fullmatch(r"\*\d+[A-Z0-9?]*", core):
            has_sign_id = True
            continue
        return False
    return has_sign_id


def parse_sigla_word_sequences(page_html: str) -> List[str]:
    # Word view embeds normalized sign IDs in search hash links.
    seqs = re.findall(r"seq-pattern:([^/\"<]+)//", page_html)
    out = []
    for raw in seqs:
        s = canonical_sequence(raw)
        if not s:
            continue
        if not looks_like_sigla_sequence(s):
            continue
        out.append(s)
    return out


def fetch_sigla_document(path: str) -> Tuple[List[Dict[str, str]], Optional[str]]:
    decoded_path = html.unescape(path)
    encoded_path = urllib.parse.quote(decoded_path, safe="/")
    url = f"{SIGLA_BASE_URL}/{encoded_path}index-word.html"
    try:
        html_txt = fetch_text(url)
    except Exception as exc:  # noqa: BLE001
        return [], f"{path}: {exc}"

    m = re.search(r'<div class="title">([^<]+)</div>', html_txt, flags=re.IGNORECASE)
    artifact_id = normalize_artifact_id(m.group(1) if m else Path(path.rstrip("/")).name)
    if not artifact_id:
        artifact_id = normalize_artifact_id(Path(path.rstrip("/")).name)

    rows: List[Dict[str, str]] = []
    for idx, seq in enumerate(parse_sigla_word_sequences(html_txt), 1):
        if not looks_like_sequence(seq):
            continue
        rows.append(
            {
                "source_name": "SigLA",
                "artifact_id": artifact_id,
                "line_id": f"word_{idx}",
                "sign_sequence": seq,
                "provenance_url": url,
                "notes": "sigla_word_seq_pattern",
            }
        )
    return rows, None


def fetch_sigla_rows(max_docs: Optional[int], workers: int) -> Tuple[List[Dict[str, str]], List[str], Dict[str, int]]:
    browse_html = fetch_text(SIGLA_BROWSE_URL)
    paths = extract_sigla_document_paths(browse_html)
    if max_docs is not None:
        paths = paths[: max(0, max_docs)]

    rows: List[Dict[str, str]] = []
    errors: List[str] = []

    if workers <= 1:
        for i, path in enumerate(paths, 1):
            out_rows, err = fetch_sigla_document(path)
            if err:
                errors.append(err)
            rows.extend(out_rows)
            if i % 80 == 0:
                print(f"[sigla] processed {i}/{len(paths)} documents", file=sys.stderr)
        return rows, errors, {"document_count": len(paths)}

    with ThreadPoolExecutor(max_workers=max(1, workers)) as executor:
        futures = {executor.submit(fetch_sigla_document, path): path for path in paths}
        for i, future in enumerate(as_completed(futures), 1):
            out_rows, err = future.result()
            if err:
                errors.append(err)
            rows.extend(out_rows)
            if i % 80 == 0:
                print(f"[sigla] processed {i}/{len(paths)} documents", file=sys.stderr)

    return rows, errors, {"document_count": len(paths)}


# ------------------------------ Younger ------------------------------

def parse_younger_artifact_sections(page_html: str) -> List[Tuple[str, str]]:
    headings = list(re.finditer(r"<dt><b>(.*?)</b>", page_html, flags=re.IGNORECASE | re.DOTALL))
    sections: List[Tuple[str, str]] = []

    for idx, match in enumerate(headings):
        heading = normalize_artifact_id(match.group(1))
        if not heading:
            continue
        # Keep inscription/tablet-like headers only (must contain at least one digit).
        if not re.search(r"\d", heading):
            continue

        start = match.end()
        end = headings[idx + 1].start() if idx + 1 < len(headings) else len(page_html)
        section = page_html[start:end]
        sections.append((heading, section))

    return sections


def parse_younger_table_rows(artifact_id: str, section_html: str, source_url: str) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []
    tables = re.findall(r"<table[^>]*>(.*?)</table>", section_html, flags=re.IGNORECASE | re.DOTALL)

    for t_idx, table in enumerate(tables, 1):
        trs = re.findall(r"<tr[^>]*>(.*?)</tr>", table, flags=re.IGNORECASE | re.DOTALL)
        for r_idx, tr in enumerate(trs, 1):
            tds = re.findall(r"<td[^>]*>(.*?)</td>", tr, flags=re.IGNORECASE | re.DOTALL)
            if len(tds) < 2:
                continue

            line_raw = clean_html_fragment(tds[0])
            line_upper = line_raw.upper()
            if r_idx == 1 and any(marker in line_upper for marker in {"LINE", "STATEMENT", "LOGOGRAM"}):
                continue
            if line_upper in {"LINE", "STATEMENT", "LOGOGRAM", "NUMBER", "FRACTION", "SIDE", "SIDE.LINE"}:
                continue

            base_line = normalize_line_id(line_raw, fallback=f"table{t_idx}_row{r_idx}")

            statement = canonical_sequence(tds[1])
            if looks_like_sequence(statement):
                rows.append(
                    {
                        "source_name": "YoungerArchive",
                        "artifact_id": artifact_id,
                        "line_id": f"{base_line}_stmt",
                        "sign_sequence": statement,
                        "provenance_url": source_url,
                        "notes": "younger_table_statement",
                    }
                )

            if len(tds) >= 3:
                logogram = canonical_sequence(tds[2])
                if looks_like_sequence(logogram):
                    rows.append(
                        {
                            "source_name": "YoungerArchive",
                            "artifact_id": artifact_id,
                            "line_id": f"{base_line}_log",
                            "sign_sequence": logogram,
                            "provenance_url": source_url,
                            "notes": "younger_table_logogram",
                        }
                    )

    return rows


def parse_younger_dd_rows(artifact_id: str, section_html: str, source_url: str) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []
    dd_blocks = re.findall(
        r"<dd>(.*?)(?=<dd|<dt|</dl>|<table|<center|<h[1-6]|<p><br>|$)",
        section_html,
        flags=re.IGNORECASE | re.DOTALL,
    )
    for i, block in enumerate(dd_blocks, 1):
        seq = canonical_sequence(block)
        if not looks_like_sequence(seq):
            continue
        rows.append(
            {
                "source_name": "YoungerArchive",
                "artifact_id": artifact_id,
                "line_id": f"dd_{i}",
                "sign_sequence": seq,
                "provenance_url": source_url,
                "notes": "younger_dd_line",
            }
        )
    return rows


def fetch_younger_rows(urls: Sequence[str]) -> Tuple[List[Dict[str, str]], List[str], Dict[str, int]]:
    all_rows: List[Dict[str, str]] = []
    errors: List[str] = []
    page_count = 0
    section_count = 0

    for url in urls:
        try:
            html_txt = fetch_text(url)
            page_count += 1
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{url}: {exc}")
            continue

        for artifact_id, section_html in parse_younger_artifact_sections(html_txt):
            section_count += 1
            all_rows.extend(parse_younger_table_rows(artifact_id, section_html, url))

    return all_rows, errors, {"page_count": page_count, "artifact_sections": section_count}


# ----------------------------- Validation ----------------------------

def build_sign_inventory(variant_map_path: Path, external_corpus_path: Path) -> set:
    inventory = set()

    # Internal repository corpus signs.
    for obs in collect_internal_observations():
        inventory.update(split_signs(obs.sign_sequence))

    # Existing external signs.
    for row in read_csv(external_corpus_path):
        inventory.update(split_signs((row.get("sign_sequence") or "").strip().upper()))

    # Variant inventory.
    var_map = load_variant_map(variant_map_path)
    for variant, entries in var_map.items():
        inventory.add(variant)
        for entry in entries:
            inventory.add(entry.canonical)

    return {tok for tok in inventory if tok}


def validate_rows(rows: List[Dict[str, str]], sign_inventory: set) -> Dict[str, object]:
    required = ["source_name", "artifact_id", "line_id", "sign_sequence", "provenance_url"]

    hard_issues: List[Dict[str, str]] = []
    warn_issues: List[Dict[str, str]] = []
    normalized_rows: List[Dict[str, str]] = []

    seen = set()
    duplicate_counter = Counter()

    for idx, row in enumerate(rows, 1):
        issue_prefix = {
            "row_number": str(idx),
            "source_name": row.get("source_name", ""),
            "artifact_id": row.get("artifact_id", ""),
            "line_id": row.get("line_id", ""),
            "sign_sequence": row.get("sign_sequence", ""),
        }

        missing = [col for col in required if not (row.get(col) or "").strip()]
        if missing:
            hard_issues.append({**issue_prefix, "issue": "missing_required_fields", "details": ",".join(missing)})
            continue

        seq = canonical_sequence(row["sign_sequence"])
        if not looks_like_sequence(seq):
            hard_issues.append({**issue_prefix, "issue": "malformed_sequence", "details": seq})
            continue

        tokens = split_signs(seq)
        valid_tokens = [tok for tok in tokens if validate_token_shape(tok)]
        bad_tokens = [tok for tok in tokens if not validate_token_shape(tok)]

        # Reject only if no recognizable sign token survives sanitation.
        if not valid_tokens:
            hard_issues.append(
                {
                    **issue_prefix,
                    "issue": "malformed_sequence_after_sanitation",
                    "details": seq,
                }
            )
            continue

        if bad_tokens:
            warn_issues.append(
                {
                    **issue_prefix,
                    "issue": "inconsistent_sign_ids",
                    "details": ",".join(sorted(set(bad_tokens)))[:300],
                }
            )

        sanitized_seq = " ".join(valid_tokens)
        if not looks_like_sequence(sanitized_seq):
            hard_issues.append(
                {
                    **issue_prefix,
                    "issue": "malformed_sequence_after_sanitation",
                    "details": sanitized_seq,
                }
            )
            continue

        unknown = sorted({tok for tok in valid_tokens if tok not in sign_inventory})
        if unknown:
            warn_issues.append(
                {
                    **issue_prefix,
                    "issue": "unknown_sign_not_in_inventory",
                    "details": ",".join(unknown[:20]),
                }
            )

        dup_key = (
            (row.get("source_name") or "").strip(),
            (row.get("artifact_id") or "").strip().upper(),
            (row.get("line_id") or "").strip(),
            sanitized_seq,
        )
        if dup_key in seen:
            duplicate_counter[dup_key] += 1
            warn_issues.append({**issue_prefix, "issue": "duplicate_line", "details": "exact_duplicate_key"})
            continue
        seen.add(dup_key)

        normalized_rows.append(
            {
                "source_name": (row.get("source_name") or "").strip(),
                "artifact_id": normalize_artifact_id(row.get("artifact_id") or ""),
                "line_id": (row.get("line_id") or "").strip(),
                "sign_sequence": sanitized_seq,
                "provenance_url": (row.get("provenance_url") or "").strip(),
                "notes": (row.get("notes") or "").strip(),
            }
        )

    total = len(rows)
    hard_rate = (len(hard_issues) / total) if total else 0.0

    return {
        "total_rows": total,
        "valid_rows": len(normalized_rows),
        "hard_issue_count": len(hard_issues),
        "warning_count": len(warn_issues),
        "hard_issue_rate": hard_rate,
        "hard_issues": hard_issues,
        "warnings": warn_issues,
        "rows": normalized_rows,
    }


def write_validation_report(path: Path, report: Dict[str, object], source_stats: Dict[str, object], source_errors: List[str]) -> None:
    lines = [
        "# External Corpus Validation Report",
        "",
        "## Summary",
        f"- Total imported rows (raw): **{report['total_rows']}**",
        f"- Valid rows after validation: **{report['valid_rows']}**",
        f"- Hard validation issues: **{report['hard_issue_count']}**",
        f"- Warning issues: **{report['warning_count']}**",
        f"- Hard issue rate: **{report['hard_issue_rate'] * 100:.2f}%**",
        "",
        "## Source Stats",
    ]

    for key, value in source_stats.items():
        lines.append(f"- {key}: {value}")

    lines.append("")
    lines.append("## Source Access Errors")
    if source_errors:
        for err in source_errors[:80]:
            lines.append(f"- {err}")
    else:
        lines.append("- none")

    lines.append("")
    lines.append("## Hard Validation Issues (sample)")
    hard_issues = report["hard_issues"]
    if hard_issues:
        for issue in hard_issues[:120]:
            lines.append(
                f"- row {issue['row_number']} | {issue['issue']} | artifact={issue['artifact_id']} | "
                f"line={issue['line_id']} | details={issue['details']}"
            )
    else:
        lines.append("- none")

    lines.append("")
    lines.append("## Warning Issues (sample)")
    warns = report["warnings"]
    if warns:
        for issue in warns[:120]:
            lines.append(
                f"- row {issue['row_number']} | {issue['issue']} | artifact={issue['artifact_id']} | "
                f"line={issue['line_id']} | details={issue['details']}"
            )
    else:
        lines.append("- none")

    lines.append("")
    lines.append("## Merge Gate")
    if float(report["hard_issue_rate"]) > 0.05:
        lines.append("- **ABORTED**: hard validation error rate exceeded 5% threshold.")
    else:
        lines.append("- Passed: hard validation error rate <= 5%.")

    ensure_dir(path.parent)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


# ------------------------------- Merge -------------------------------

def normalize_existing_external_row(row: Dict[str, str]) -> Optional[Dict[str, str]]:
    seq = canonical_sequence((row.get("sign_sequence") or "").strip())
    artifact = normalize_artifact_id((row.get("artifact_id") or "").strip())
    line_id = (row.get("line_id") or "").strip()
    if not seq or not artifact:
        return None
    if not line_id:
        line_id = "line_unknown"

    source_name = (row.get("source_name") or row.get("source_id") or "external").strip()
    provenance_url = (row.get("provenance_url") or "").strip()
    provenance = (row.get("provenance") or provenance_url or "external_import").strip()
    notes = (row.get("notes") or "").strip()

    return {
        "source_name": source_name,
        "source_id": (row.get("source_id") or slug_source(source_name)).strip(),
        "artifact_id": artifact,
        "line_id": line_id,
        "sign_sequence": seq,
        "provenance": provenance,
        "notes": notes,
        "ingestion_timestamp": (row.get("ingestion_timestamp") or "").strip(),
        "provenance_url": provenance_url,
    }


def merge_rows(existing_rows: List[Dict[str, str]], new_rows: List[Dict[str, str]], ingestion_timestamp: str) -> List[Dict[str, str]]:
    grouped: Dict[Tuple[str, str, str], Dict[str, object]] = {}

    def add_row(source_row: Dict[str, str], from_new_import: bool) -> None:
        key = (
            source_row["artifact_id"],
            source_row["line_id"],
            source_row["sign_sequence"],
        )
        entry = grouped.setdefault(
            key,
            {
                "artifact_id": source_row["artifact_id"],
                "line_id": source_row["line_id"],
                "sign_sequence": source_row["sign_sequence"],
                "source_names": set(),
                "source_ids": set(),
                "provenance_urls": set(),
                "provenance_values": set(),
                "notes": set(),
                "ingestion_timestamp": source_row.get("ingestion_timestamp") or "",
                "touched_by_new": False,
            },
        )

        source_name = (source_row.get("source_name") or source_row.get("source_id") or "external").strip()
        source_id = (source_row.get("source_id") or slug_source(source_name)).strip()

        entry["source_names"].add(source_name)
        entry["source_ids"].add(source_id)

        prov_url = (source_row.get("provenance_url") or "").strip()
        if prov_url:
            entry["provenance_urls"].add(prov_url)

        prov = (source_row.get("provenance") or "").strip()
        if prov:
            entry["provenance_values"].add(prov)

        note = (source_row.get("notes") or "").strip()
        if note:
            entry["notes"].add(note)

        if from_new_import:
            entry["touched_by_new"] = True

    for row in existing_rows:
        add_row(row, from_new_import=False)

    for row in new_rows:
        add_row(
            {
                "source_name": row["source_name"],
                "source_id": slug_source(row["source_name"]),
                "artifact_id": row["artifact_id"],
                "line_id": row["line_id"],
                "sign_sequence": row["sign_sequence"],
                "provenance": row["provenance_url"],
                "notes": row.get("notes", ""),
                "provenance_url": row["provenance_url"],
                "ingestion_timestamp": ingestion_timestamp,
            },
            from_new_import=True,
        )

    merged_rows: List[Dict[str, str]] = []
    for _, entry in sorted(grouped.items(), key=lambda kv: (kv[0][0], kv[0][1], kv[0][2])):
        source_names = sorted(x for x in entry["source_names"] if x)
        source_ids = sorted(x for x in entry["source_ids"] if x)
        prov_urls = sorted(x for x in entry["provenance_urls"] if x)
        prov_values = sorted(x for x in entry["provenance_values"] if x)
        notes = sorted(x for x in entry["notes"] if x)

        source_name_join = " | ".join(source_names)
        source_id_join = "|".join(source_ids) if source_ids else slug_source(source_name_join or "external")

        provenance_url_join = " | ".join(prov_urls)
        if prov_values:
            provenance_join = " | ".join(sorted(set(prov_values + prov_urls)))
        else:
            provenance_join = provenance_url_join

        ts = ingestion_timestamp if entry["touched_by_new"] else (entry["ingestion_timestamp"] or "")

        merged_rows.append(
            {
                "source_id": source_id_join,
                "artifact_id": entry["artifact_id"],
                "line_id": entry["line_id"],
                "sign_sequence": entry["sign_sequence"],
                "provenance": provenance_join,
                "notes": " | ".join(notes),
                "ingestion_timestamp": ts,
                "source_name": source_name_join,
                "provenance_url": provenance_url_join,
            }
        )

    return merged_rows


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch and merge authoritative external Linear A corpora.")
    parser.add_argument("--raw-output", default=str(DEFAULT_RAW_IMPORT), help="Path for raw imported rows CSV.")
    parser.add_argument(
        "--external-corpus",
        default=str(DEFAULT_EXTERNAL_CORPUS),
        help="Path for merged external corpus CSV.",
    )
    parser.add_argument(
        "--validation-report",
        default=str(DEFAULT_VALIDATION_REPORT),
        help="Path for validation markdown report.",
    )
    parser.add_argument(
        "--variant-map",
        default=str(DEFAULT_VARIANT_MAP),
        help="Path to variant map CSV for inventory checks.",
    )
    parser.add_argument("--workers", type=int, default=10, help="Worker count for SigLA document fetches.")
    parser.add_argument(
        "--max-sigla-docs",
        type=int,
        default=None,
        help="Optional cap on number of SigLA documents (for debugging).",
    )
    parser.add_argument("--skip-sigla", action="store_true", help="Skip SigLA ingestion.")
    parser.add_argument("--skip-younger", action="store_true", help="Skip Younger ingestion.")
    parser.add_argument("--no-merge", action="store_true", help="Run fetch+validate only, do not merge.")
    parser.add_argument(
        "--ignore-existing",
        action="store_true",
        help="Build merged external corpus from current import only (ignore existing rows).",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    raw_output_path = Path(args.raw_output)
    external_corpus_path = Path(args.external_corpus)
    validation_report_path = Path(args.validation_report)
    variant_map_path = Path(args.variant_map)

    all_rows: List[Dict[str, str]] = []
    source_errors: List[str] = []
    source_stats: Dict[str, object] = {}

    if not args.skip_sigla:
        sigla_rows, sigla_errors, sigla_stats = fetch_sigla_rows(max_docs=args.max_sigla_docs, workers=args.workers)
        all_rows.extend(sigla_rows)
        source_errors.extend(sigla_errors)
        source_stats.update({f"sigla_{k}": v for k, v in sigla_stats.items()})
        source_stats["sigla_rows"] = len(sigla_rows)

    if not args.skip_younger:
        younger_rows, younger_errors, younger_stats = fetch_younger_rows(YOUNGER_WAYBACK_URLS)
        all_rows.extend(younger_rows)
        source_errors.extend(younger_errors)
        source_stats.update({f"younger_{k}": v for k, v in younger_stats.items()})
        source_stats["younger_rows"] = len(younger_rows)

    # Write raw imported data exactly as harvested.
    write_csv(raw_output_path, RAW_FIELDNAMES, all_rows)

    inventory = build_sign_inventory(variant_map_path=variant_map_path, external_corpus_path=external_corpus_path)
    report = validate_rows(all_rows, sign_inventory=inventory)

    write_validation_report(
        path=validation_report_path,
        report=report,
        source_stats=source_stats,
        source_errors=source_errors,
    )

    merge_aborted = float(report["hard_issue_rate"]) > 0.05
    merged_count = None

    if not args.no_merge and not merge_aborted:
        existing = []
        if not args.ignore_existing:
            existing = [
                row
                for row in (
                    normalize_existing_external_row(r) for r in read_csv(external_corpus_path)
                )
                if row is not None
            ]
        now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        merged = merge_rows(existing_rows=existing, new_rows=report["rows"], ingestion_timestamp=now_iso)
        write_csv(external_corpus_path, EXTERNAL_FIELDNAMES, merged)
        merged_count = len(merged)

    summary = {
        "raw_import_path": str(raw_output_path),
        "validation_report_path": str(validation_report_path),
        "external_corpus_path": str(external_corpus_path),
        "rows_fetched_raw": len(all_rows),
        "rows_validated": int(report["valid_rows"]),
        "hard_issue_count": int(report["hard_issue_count"]),
        "warning_count": int(report["warning_count"]),
        "hard_issue_rate": round(float(report["hard_issue_rate"]), 6),
        "merge_aborted": merge_aborted,
        "merged_row_count": merged_count,
        "source_stats": source_stats,
        "source_errors": source_errors,
    }
    print(json.dumps(summary, indent=2))

    if merge_aborted:
        print("Hard validation errors exceeded 5%; merge aborted.", file=sys.stderr)
        raise SystemExit(2)


if __name__ == "__main__":
    main()
