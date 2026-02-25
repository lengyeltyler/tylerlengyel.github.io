#!/usr/bin/env python3
"""
Linear A structural analysis pipeline (Phase 1-5).

Principles:
- No invented semantics.
- Structural claims are separated from phonetic/semantic hypotheses.
- Confidence is evidence-weighted and falsification-aware.
- Outputs are reproducible and provenance-preserving.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import random
import re
import shutil
import statistics
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple


RANDOM_SEED = 20260224

ROOT = Path(__file__).resolve().parents[2]
LINEAR_A_DIR = ROOT / "linearA"
RESEARCH_DIR = LINEAR_A_DIR / "research"
DEFAULT_OUTPUT_DIR = RESEARCH_DIR / "outputs"
DEFAULT_EXTERNAL_CORPUS = RESEARCH_DIR / "data" / "external_corpus.csv"
DEFAULT_VARIANT_MAP = RESEARCH_DIR / "signs" / "variant_map.csv"

TABLET_RE = re.compile(r"^(HT\d+|ZA\d+)$", re.IGNORECASE)
RAW_RE = re.compile(r"\(raw:\s*([^)]+?)\)")
HEADING_RE = re.compile(r"^###\s+([A-Z0-9]+)\s*$")
ARTIFACT_PREFIX_RE = re.compile(r"^([A-Z]+)")


@dataclass
class VariantMapEntry:
    variant: str
    canonical: str
    status: str
    confidence: float
    notes: str


@dataclass
class RawObservation:
    observation_id: str
    source_id: str
    source_kind: str
    artifact_id: str
    line_id: str
    line_no: int
    sign_sequence: str
    quantity: Optional[int]
    provenance: str
    notes: str


@dataclass
class CanonicalEntry:
    canonical_line_id: str
    artifact_id: str
    sequence_surface: str
    quantity: Optional[int]
    signs_raw: Tuple[str, ...]
    signs_canonical: Tuple[str, ...]
    groups_raw: Tuple[str, ...]
    source_observation_ids: Tuple[str, ...]
    provenance_tags: Tuple[str, ...]
    source_kinds: Tuple[str, ...]


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def write_csv(path: Path, fieldnames: Sequence[str], rows: Iterable[Dict[str, object]]) -> None:
    ensure_dir(path.parent)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def load_variant_map(path: Path) -> Dict[str, List[VariantMapEntry]]:
    mapping: Dict[str, List[VariantMapEntry]] = defaultdict(list)
    if not path.exists():
        return mapping

    with path.open(encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            variant = (row.get("variant") or "").strip().upper()
            canonical = (row.get("canonical") or "").strip().upper()
            if not variant:
                continue
            if not canonical:
                canonical = variant
            status = (row.get("status") or "exact").strip().lower()
            try:
                confidence = float((row.get("confidence") or "1").strip())
            except ValueError:
                confidence = 1.0
            notes = (row.get("notes") or "").strip()
            mapping[variant].append(
                VariantMapEntry(
                    variant=variant,
                    canonical=canonical,
                    status=status,
                    confidence=max(0.0, min(1.0, confidence)),
                    notes=notes,
                )
            )
    return mapping


def infer_artifact_from_path(path: Path) -> Optional[str]:
    stem = path.stem.upper()
    if TABLET_RE.match(stem):
        return stem
    return None


def split_sequence_and_quantity(text: str) -> Tuple[str, Optional[int]]:
    s = " ".join(text.strip().split())
    if not s:
        return "", None
    parts = s.split()
    if parts and re.fullmatch(r"\d+", parts[-1]):
        return " ".join(parts[:-1]), int(parts[-1])
    return s, None


def split_groups(sequence_surface: str) -> Tuple[str, ...]:
    if not sequence_surface:
        return tuple()
    return tuple(tok.upper() for tok in sequence_surface.split() if tok.strip())


def split_signs(sequence_surface: str) -> Tuple[str, ...]:
    if not sequence_surface:
        return tuple()
    out: List[str] = []
    for group in sequence_surface.split():
        parts = re.split(r"[-+]", group.upper())
        for part in parts:
            part = part.strip()
            if part:
                out.append(part)
    return tuple(out)


def normalize_sign_sequence(
    signs: Tuple[str, ...],
    variant_map: Dict[str, List[VariantMapEntry]],
    mode: str,
) -> Tuple[Tuple[str, ...], List[Dict[str, object]], List[Dict[str, object]]]:
    """
    mode:
    - strict: apply only high-certainty mappings (status exact/high/canonical)
    - permissive: apply all mappings (uncertain mappings flagged)
    - identity: no mappings applied
    """
    normalized: List[str] = []
    logs: List[Dict[str, object]] = []
    flags: List[Dict[str, object]] = []

    for idx, sign in enumerate(signs):
        sign_u = sign.upper()
        canonical = sign_u
        map_status = "identity"
        map_conf = 1.0
        uncertainty = False
        note = ""

        entries = variant_map.get(sign_u, [])
        applicable: List[VariantMapEntry] = []

        if mode == "identity":
            applicable = []
        elif mode == "strict":
            applicable = [
                e
                for e in entries
                if e.status in {"exact", "high", "canonical", "strict"}
            ]
        else:
            applicable = list(entries)

        if applicable:
            unique_targets = sorted({e.canonical for e in applicable})
            if len(unique_targets) > 1:
                canonical = unique_targets[0]
                map_status = "ambiguous_multi_target"
                map_conf = min(e.confidence for e in applicable)
                uncertainty = True
                note = "multiple canonical targets"
                flags.append(
                    {
                        "token_index": idx,
                        "original_sign": sign_u,
                        "reason": "ambiguous_mapping",
                        "details": ";".join(unique_targets),
                    }
                )
            else:
                chosen = sorted(
                    applicable,
                    key=lambda e: (-(e.confidence), e.status, e.canonical),
                )[0]
                canonical = chosen.canonical
                map_status = chosen.status
                map_conf = chosen.confidence
                note = chosen.notes
                if chosen.status not in {"exact", "high", "canonical", "strict"}:
                    uncertainty = True
                    flags.append(
                        {
                            "token_index": idx,
                            "original_sign": sign_u,
                            "reason": "uncertain_mapping_status",
                            "details": chosen.status,
                        }
                    )
                if chosen.confidence < 0.80:
                    uncertainty = True
                    flags.append(
                        {
                            "token_index": idx,
                            "original_sign": sign_u,
                            "reason": "low_mapping_confidence",
                            "details": f"{chosen.confidence:.3f}",
                        }
                    )
        else:
            if mode != "identity" and entries:
                map_status = "suppressed_in_strict"
                map_conf = max(e.confidence for e in entries)
                uncertainty = True
                flags.append(
                    {
                        "token_index": idx,
                        "original_sign": sign_u,
                        "reason": "suppressed_uncertain_mapping",
                        "details": "strict_mode",
                    }
                )
            else:
                map_status = "identity"
                if sign_u == "?":
                    uncertainty = True
                    flags.append(
                        {
                            "token_index": idx,
                            "original_sign": sign_u,
                            "reason": "unknown_sign",
                            "details": "literal_question_mark",
                        }
                    )

        normalized.append(canonical)
        logs.append(
            {
                "token_index": idx,
                "original_sign": sign_u,
                "canonical_sign": canonical,
                "mapping_status": map_status,
                "mapping_confidence": map_conf,
                "uncertainty_flag": 1 if uncertainty else 0,
                "mapping_notes": note,
            }
        )

    return tuple(normalized), logs, flags


def parse_internal_file_observations(path: Path) -> List[RawObservation]:
    observations: List[RawObservation] = []
    rel = str(path.relative_to(ROOT))
    text = path.read_text(encoding="utf-8")
    artifact_from_name = infer_artifact_from_path(path)

    # 1) HTML/MD "Original Tablet Text" blocks
    if path.suffix.lower() == ".html":
        m = re.search(
            r"<h2>\s*Original Tablet Text\s*</h2>\s*<pre>\s*(.*?)\s*</pre>",
            text,
            flags=re.IGNORECASE | re.DOTALL,
        )
        if m and artifact_from_name:
            for idx, line in enumerate(m.group(1).splitlines(), 1):
                line = line.strip()
                if not line:
                    continue
                seq_surface, qty = split_sequence_and_quantity(line)
                if not split_signs(seq_surface):
                    continue
                observations.append(
                    RawObservation(
                        observation_id=f"OBS_{len(observations)+1:06d}",
                        source_id=rel,
                        source_kind="html_original",
                        artifact_id=artifact_from_name,
                        line_id=str(idx),
                        line_no=idx,
                        sign_sequence=seq_surface.upper(),
                        quantity=qty,
                        provenance=f"{rel}:original_pre",
                        notes="",
                    )
                )

    if path.suffix.lower() == ".md" and artifact_from_name:
        lines = text.splitlines()
        in_section = False
        line_counter = 0
        for lineno, line in enumerate(lines, 1):
            stripped = line.strip()
            if stripped.startswith("## Original Tablet Text"):
                in_section = True
                continue
            if in_section and stripped.startswith("## "):
                break
            if not in_section or not stripped:
                continue
            seq_surface, qty = split_sequence_and_quantity(stripped)
            if not split_signs(seq_surface):
                continue
            line_counter += 1
            observations.append(
                RawObservation(
                    observation_id=f"OBS_{len(observations)+1:06d}",
                    source_id=rel,
                    source_kind="md_original",
                    artifact_id=artifact_from_name,
                    line_id=str(line_counter),
                    line_no=lineno,
                    sign_sequence=seq_surface.upper(),
                    quantity=qty,
                    provenance=f"{rel}:original_md_section",
                    notes="",
                )
            )

    # 2) raw annotations with tablet headings
    current_artifact = artifact_from_name
    for lineno, line in enumerate(text.splitlines(), 1):
        hm = HEADING_RE.match(line.strip())
        if hm:
            maybe = hm.group(1).upper()
            if TABLET_RE.match(maybe):
                current_artifact = maybe

        for m in RAW_RE.finditer(line):
            if not current_artifact:
                continue
            raw = m.group(1).strip()
            seq_surface, qty = split_sequence_and_quantity(raw)
            if not split_signs(seq_surface):
                continue
            observations.append(
                RawObservation(
                    observation_id=f"OBS_{len(observations)+1:06d}",
                    source_id=rel,
                    source_kind="raw_annotation",
                    artifact_id=current_artifact,
                    line_id=str(lineno),
                    line_no=lineno,
                    sign_sequence=seq_surface.upper(),
                    quantity=qty,
                    provenance=f"{rel}:raw_annotation",
                    notes="",
                )
            )

    return observations


def collect_internal_observations() -> List[RawObservation]:
    raw: List[RawObservation] = []
    paths = sorted((LINEAR_A_DIR).glob("*.html")) + sorted((LINEAR_A_DIR / "mdFiles").glob("*.md"))
    for path in paths:
        if path.name.lower() == "index.html":
            continue
        rows = parse_internal_file_observations(path)
        base = len(raw)
        for i, obs in enumerate(rows, 1):
            obs.observation_id = f"OBS_{base+i:06d}"
            raw.append(obs)
    return raw


def load_external_observations(path: Path, start_id: int) -> List[RawObservation]:
    out: List[RawObservation] = []
    if not path.exists():
        return out

    with path.open(encoding="utf-8") as f:
        reader = csv.DictReader(f)
        required = ["artifact_id", "line_id", "sign_sequence"]
        if reader.fieldnames is None:
            return out
        missing = [c for c in required if c not in reader.fieldnames]
        if missing:
            raise ValueError(
                f"external corpus missing required columns: {', '.join(missing)}"
            )

        for idx, row in enumerate(reader, 1):
            sign_sequence = (row.get("sign_sequence") or "").strip()
            if not sign_sequence:
                continue
            seq_surface, qty = split_sequence_and_quantity(sign_sequence)
            if not split_signs(seq_surface):
                continue
            artifact = (row.get("artifact_id") or "").strip().upper() or "EXT"
            source_name = (row.get("source_name") or "").strip()
            source_id = (row.get("source_id") or source_name or "external").strip()
            line_id = (row.get("line_id") or str(idx)).strip()
            provenance_url = (row.get("provenance_url") or "").strip()
            provenance = (
                row.get("provenance")
                or provenance_url
                or "external_csv"
            ).strip()
            notes = (row.get("notes") or "").strip()
            ingestion_ts = (row.get("ingestion_timestamp") or "").strip()
            if provenance_url and provenance_url not in provenance:
                provenance = f"{provenance} | {provenance_url}"
            if source_name and f"source={source_name}" not in notes:
                notes = f"{notes} | source={source_name}".strip(" |")
            if ingestion_ts and f"ingested={ingestion_ts}" not in notes:
                notes = f"{notes} | ingested={ingestion_ts}".strip(" |")

            out.append(
                RawObservation(
                    observation_id=f"OBS_{start_id+len(out):06d}",
                    source_id=f"external:{source_id}",
                    source_kind="external_csv",
                    artifact_id=artifact,
                    line_id=line_id,
                    line_no=idx,
                    sign_sequence=seq_surface.upper(),
                    quantity=qty,
                    provenance=provenance,
                    notes=notes,
                )
            )

    return out


def normalize_and_manifest(
    observations: List[RawObservation],
    variant_map: Dict[str, List[VariantMapEntry]],
    normalization_mode: str,
    output_dir: Path,
) -> Tuple[List[CanonicalEntry], Dict[str, object]]:
    """
    Build canonical corpus by de-duplicating within artifact on canonical sequence + quantity,
    while preserving full provenance links.
    """
    mapping_logs: List[Dict[str, object]] = []
    uncertainty_rows: List[Dict[str, object]] = []
    canonical_groups: Dict[Tuple[str, Tuple[str, ...], Optional[int]], Dict[str, object]] = {}

    # Keep track of source rows for manifest/provenance.
    all_rows = []

    for obs in observations:
        groups_raw = split_groups(obs.sign_sequence)
        signs_raw = split_signs(obs.sign_sequence)
        if not signs_raw:
            continue

        signs_canon, sign_logs, sign_flags = normalize_sign_sequence(
            signs=signs_raw,
            variant_map=variant_map,
            mode=normalization_mode,
        )

        manifest_key = (obs.artifact_id, signs_canon, obs.quantity)
        if manifest_key not in canonical_groups:
            canonical_groups[manifest_key] = {
                "artifact_id": obs.artifact_id,
                "sequence_surface": obs.sign_sequence,
                "quantity": obs.quantity,
                "signs_raw": signs_raw,
                "signs_canonical": signs_canon,
                "groups_raw": groups_raw,
                "source_observation_ids": [],
                "provenance_tags": set(),
                "source_kinds": set(),
                "notes": set(),
            }
        entry = canonical_groups[manifest_key]
        entry["source_observation_ids"].append(obs.observation_id)
        entry["provenance_tags"].add(obs.provenance)
        entry["source_kinds"].add(obs.source_kind)
        if obs.notes:
            entry["notes"].add(obs.notes)

        all_rows.append(
            {
                "observation_id": obs.observation_id,
                "source_id": obs.source_id,
                "source_kind": obs.source_kind,
                "artifact_id": obs.artifact_id,
                "line_id": obs.line_id,
                "line_no": obs.line_no,
                "sequence_surface": obs.sign_sequence,
                "quantity": "" if obs.quantity is None else obs.quantity,
                "signs_raw": " ".join(signs_raw),
                "signs_canonical": " ".join(signs_canon),
                "groups_raw": " ".join(groups_raw),
                "provenance": obs.provenance,
                "notes": obs.notes,
            }
        )

        for slog in sign_logs:
            mapping_logs.append(
                {
                    "observation_id": obs.observation_id,
                    "artifact_id": obs.artifact_id,
                    "line_id": obs.line_id,
                    "token_index": slog["token_index"],
                    "original_sign": slog["original_sign"],
                    "canonical_sign": slog["canonical_sign"],
                    "mapping_status": slog["mapping_status"],
                    "mapping_confidence": f"{float(slog['mapping_confidence']):.6f}",
                    "uncertainty_flag": slog["uncertainty_flag"],
                    "mapping_notes": slog["mapping_notes"],
                }
            )

        for flag in sign_flags:
            uncertainty_rows.append(
                {
                    "observation_id": obs.observation_id,
                    "artifact_id": obs.artifact_id,
                    "line_id": obs.line_id,
                    "token_index": flag["token_index"],
                    "original_sign": flag["original_sign"],
                    "reason": flag["reason"],
                    "details": flag["details"],
                }
            )

    canonical_entries: List[CanonicalEntry] = []
    provenance_links: List[Dict[str, object]] = []
    manifest_rows: List[Dict[str, object]] = []

    for idx, (_, group) in enumerate(
        sorted(
            canonical_groups.items(),
            key=lambda kv: (
                kv[1]["artifact_id"],
                kv[1]["quantity"] if kv[1]["quantity"] is not None else -1,
                " ".join(kv[1]["signs_canonical"]),
            ),
        ),
        1,
    ):
        cid = f"CLINE_{idx:04d}"
        src_ids = tuple(sorted(set(group["source_observation_ids"])))
        prov_tags = tuple(sorted(group["provenance_tags"]))
        source_kinds = tuple(sorted(group["source_kinds"]))

        canonical_entries.append(
            CanonicalEntry(
                canonical_line_id=cid,
                artifact_id=group["artifact_id"],
                sequence_surface=group["sequence_surface"],
                quantity=group["quantity"],
                signs_raw=tuple(group["signs_raw"]),
                signs_canonical=tuple(group["signs_canonical"]),
                groups_raw=tuple(group["groups_raw"]),
                source_observation_ids=src_ids,
                provenance_tags=prov_tags,
                source_kinds=source_kinds,
            )
        )

        manifest_rows.append(
            {
                "canonical_line_id": cid,
                "artifact_id": group["artifact_id"],
                "quantity": "" if group["quantity"] is None else group["quantity"],
                "sequence_surface": group["sequence_surface"],
                "canonical_sequence": " ".join(group["signs_canonical"]),
                "sign_count": len(group["signs_canonical"]),
                "group_count": len(group["groups_raw"]),
                "origin_count": len(src_ids),
                "source_kinds": ",".join(source_kinds),
                "provenance_tags": ",".join(prov_tags),
                "notes": " | ".join(sorted(group["notes"])),
            }
        )

        for obs_id in src_ids:
            provenance_links.append(
                {
                    "canonical_line_id": cid,
                    "observation_id": obs_id,
                }
            )

    # Save core manifest outputs.
    write_csv(
        output_dir / "phase1_observations_all_sources.csv",
        [
            "observation_id",
            "source_id",
            "source_kind",
            "artifact_id",
            "line_id",
            "line_no",
            "sequence_surface",
            "quantity",
            "signs_raw",
            "signs_canonical",
            "groups_raw",
            "provenance",
            "notes",
        ],
        all_rows,
    )

    write_csv(
        output_dir / "phase1_corpus_manifest.csv",
        [
            "canonical_line_id",
            "artifact_id",
            "quantity",
            "sequence_surface",
            "canonical_sequence",
            "sign_count",
            "group_count",
            "origin_count",
            "source_kinds",
            "provenance_tags",
            "notes",
        ],
        manifest_rows,
    )

    write_csv(
        output_dir / "phase1_corpus_provenance_links.csv",
        ["canonical_line_id", "observation_id"],
        provenance_links,
    )

    write_csv(
        output_dir / "phase1_normalization_mapping_log.csv",
        [
            "observation_id",
            "artifact_id",
            "line_id",
            "token_index",
            "original_sign",
            "canonical_sign",
            "mapping_status",
            "mapping_confidence",
            "uncertainty_flag",
            "mapping_notes",
        ],
        mapping_logs,
    )

    write_csv(
        output_dir / "phase1_normalization_uncertainty_flags.csv",
        [
            "observation_id",
            "artifact_id",
            "line_id",
            "token_index",
            "original_sign",
            "reason",
            "details",
        ],
        uncertainty_rows,
    )

    # Variant collisions report.
    original_to_canonical: Dict[str, str] = {}
    for row in mapping_logs:
        original_to_canonical[row["original_sign"]] = row["canonical_sign"]

    canonical_to_variants: Dict[str, set] = defaultdict(set)
    canonical_occurrence = Counter()
    for row in mapping_logs:
        canonical_to_variants[row["canonical_sign"]].add(row["original_sign"])
        canonical_occurrence[row["canonical_sign"]] += 1

    collision_rows = []
    for canonical, variants in canonical_to_variants.items():
        if len(variants) <= 1:
            continue
        collision_rows.append(
            {
                "canonical_sign": canonical,
                "variant_count": len(variants),
                "variants": ",".join(sorted(variants)),
                "total_occurrences": canonical_occurrence[canonical],
            }
        )
    collision_rows.sort(
        key=lambda r: (-int(r["total_occurrences"]), -int(r["variant_count"]), r["canonical_sign"])
    )

    write_csv(
        output_dir / "phase1_variant_collisions.csv",
        ["canonical_sign", "variant_count", "variants", "total_occurrences"],
        collision_rows,
    )

    # Backward-compatible canonical corpus output.
    write_csv(
        output_dir / "phase1_canonical_corpus.csv",
        [
            "entry_id",
            "canonical_line_id",
            "artifact_id",
            "sequence_surface",
            "quantity",
            "signs_raw",
            "signs_canonical",
            "groups_raw",
            "sign_count",
            "group_count",
            "source_count",
            "provenance_tags",
        ],
        [
            {
                "entry_id": i + 1,
                "canonical_line_id": e.canonical_line_id,
                "artifact_id": e.artifact_id,
                "sequence_surface": e.sequence_surface,
                "quantity": "" if e.quantity is None else e.quantity,
                "signs_raw": " ".join(e.signs_raw),
                "signs_canonical": " ".join(e.signs_canonical),
                "groups_raw": " ".join(e.groups_raw),
                "sign_count": len(e.signs_canonical),
                "group_count": len(e.groups_raw),
                "source_count": len(e.source_observation_ids),
                "provenance_tags": ",".join(e.provenance_tags),
            }
            for i, e in enumerate(canonical_entries)
        ],
    )

    # Phase1 normalization report markdown.
    uncertain_total = sum(1 for r in mapping_logs if int(r["uncertainty_flag"]) == 1)
    mapping_total = len(mapping_logs)
    report_lines = [
        "# Phase 1 Normalization Report",
        "",
        f"- Normalization mode: `{normalization_mode}`",
        f"- Total canonical lines: **{len(canonical_entries)}**",
        f"- Total sign mapping events: **{mapping_total}**",
        f"- Uncertainty-flagged mapping events: **{uncertain_total}**",
        "",
        "## Most Common Variant Collisions",
    ]
    if collision_rows:
        for row in collision_rows[:15]:
            report_lines.append(
                f"- `{row['canonical_sign']}` <= {row['variants']} (occurrences={row['total_occurrences']})"
            )
    else:
        report_lines.append("- No high-frequency variant collisions observed in current corpus.")

    report_lines.append("")
    report_lines.append("## Normalization Uncertainty Flags")
    if uncertainty_rows:
        reason_counts = Counter(r["reason"] for r in uncertainty_rows)
        for reason, count in reason_counts.most_common():
            report_lines.append(f"- `{reason}`: {count}")
    else:
        report_lines.append("- No uncertainty flags triggered.")

    (output_dir / "phase1_normalization_report.md").write_text(
        "\n".join(report_lines) + "\n", encoding="utf-8"
    )

    return canonical_entries, {
        "mapping_logs": mapping_logs,
        "uncertainty_rows": uncertainty_rows,
        "collision_rows": collision_rows,
    }


def ngrams(tokens: Sequence[str], n: int) -> List[Tuple[str, ...]]:
    if len(tokens) < n:
        return []
    return [tuple(tokens[i : i + n]) for i in range(len(tokens) - n + 1)]


def phase1_frequency_and_positions(entries: List[CanonicalEntry], output_dir: Path) -> Dict[str, object]:
    unigrams = Counter()
    bigrams = Counter()
    trigrams = Counter()
    initial = Counter()
    terminal = Counter()

    for e in entries:
        signs = e.signs_canonical
        unigrams.update(signs)
        bigrams.update(ngrams(signs, 2))
        trigrams.update(ngrams(signs, 3))
        if signs:
            initial[signs[0]] += 1
            terminal[signs[-1]] += 1

    total_signs = sum(unigrams.values()) or 1
    total_bigrams = sum(bigrams.values()) or 1
    total_trigrams = sum(trigrams.values()) or 1
    total_entries = len(entries) or 1

    write_csv(
        output_dir / "phase1_sign_frequency.csv",
        ["sign", "count", "relative_frequency"],
        [
            {
                "sign": sign,
                "count": count,
                "relative_frequency": f"{count / total_signs:.6f}",
            }
            for sign, count in unigrams.most_common()
        ],
    )

    write_csv(
        output_dir / "phase1_bigram_frequency.csv",
        ["bigram", "count", "relative_frequency"],
        [
            {
                "bigram": " ".join(bg),
                "count": count,
                "relative_frequency": f"{count / total_bigrams:.6f}",
            }
            for bg, count in bigrams.most_common()
        ],
    )

    write_csv(
        output_dir / "phase1_trigram_frequency.csv",
        ["trigram", "count", "relative_frequency"],
        [
            {
                "trigram": " ".join(tg),
                "count": count,
                "relative_frequency": f"{count / total_trigrams:.6f}",
            }
            for tg, count in trigrams.most_common()
        ],
    )

    write_csv(
        output_dir / "phase1_initial_position_frequency.csv",
        ["sign", "count", "relative_frequency"],
        [
            {
                "sign": sign,
                "count": count,
                "relative_frequency": f"{count / total_entries:.6f}",
            }
            for sign, count in initial.most_common()
        ],
    )

    write_csv(
        output_dir / "phase1_terminal_position_frequency.csv",
        ["sign", "count", "relative_frequency"],
        [
            {
                "sign": sign,
                "count": count,
                "relative_frequency": f"{count / total_entries:.6f}",
            }
            for sign, count in terminal.most_common()
        ],
    )

    prefix_counter = Counter()
    suffix_counter = Counter()
    prefix_artifacts: Dict[Tuple[str, ...], set] = defaultdict(set)
    suffix_artifacts: Dict[Tuple[str, ...], set] = defaultdict(set)

    for e in entries:
        signs = e.signs_canonical
        L = len(signs)
        for n in range(1, min(3, L) + 1):
            pre = tuple(signs[:n])
            suf = tuple(signs[-n:])
            prefix_counter[pre] += 1
            suffix_counter[suf] += 1
            prefix_artifacts[pre].add(e.artifact_id)
            suffix_artifacts[suf].add(e.artifact_id)

    prefix_rows = [
        {
            "prefix": " ".join(k),
            "length": len(k),
            "count": v,
            "artifact_count": len(prefix_artifacts[k]),
            "artifacts": ",".join(sorted(prefix_artifacts[k])),
        }
        for k, v in prefix_counter.items()
        if v >= 2
    ]
    suffix_rows = [
        {
            "suffix": " ".join(k),
            "length": len(k),
            "count": v,
            "artifact_count": len(suffix_artifacts[k]),
            "artifacts": ",".join(sorted(suffix_artifacts[k])),
        }
        for k, v in suffix_counter.items()
        if v >= 2
    ]

    prefix_rows.sort(key=lambda r: (-int(r["count"]), -int(r["length"]), r["prefix"]))
    suffix_rows.sort(key=lambda r: (-int(r["count"]), -int(r["length"]), r["suffix"]))

    write_csv(
        output_dir / "phase1_prefix_patterns.csv",
        ["prefix", "length", "count", "artifact_count", "artifacts"],
        prefix_rows,
    )
    write_csv(
        output_dir / "phase1_suffix_patterns.csv",
        ["suffix", "length", "count", "artifact_count", "artifacts"],
        suffix_rows,
    )

    return {
        "unigrams": unigrams,
        "bigrams": bigrams,
        "trigrams": trigrams,
        "initial": initial,
        "terminal": terminal,
        "prefix_rows": prefix_rows,
        "suffix_rows": suffix_rows,
    }


def lcs_length(a: Sequence[str], b: Sequence[str]) -> int:
    if not a or not b:
        return 0
    dp = [0] * (len(b) + 1)
    for i in range(1, len(a) + 1):
        prev = 0
        for j in range(1, len(b) + 1):
            cur = dp[j]
            if a[i - 1] == b[j - 1]:
                dp[j] = prev + 1
            else:
                dp[j] = max(dp[j], dp[j - 1])
            prev = cur
    return dp[-1]


def sequence_similarity(a: Sequence[str], b: Sequence[str]) -> float:
    max_len = max(len(a), len(b), 1)
    lcs_ratio = lcs_length(a, b) / max_len

    cp = 0
    for i in range(min(len(a), len(b))):
        if a[i] == b[i]:
            cp += 1
        else:
            break
    cp_ratio = cp / max_len

    cs = 0
    for i in range(1, min(len(a), len(b)) + 1):
        if a[-i] == b[-i]:
            cs += 1
        else:
            break
    cs_ratio = cs / max_len

    sa = set(a)
    sb = set(b)
    jac = (len(sa & sb) / len(sa | sb)) if (sa or sb) else 1.0

    return 0.40 * lcs_ratio + 0.20 * cp_ratio + 0.20 * cs_ratio + 0.20 * jac


def phase2_structural_modeling(entries: List[CanonicalEntry], output_dir: Path) -> Dict[str, object]:
    type_counter = Counter(e.signs_canonical for e in entries)
    type_artifacts: Dict[Tuple[str, ...], set] = defaultdict(set)
    for e in entries:
        type_artifacts[e.signs_canonical].add(e.artifact_id)

    seq_ids = {
        seq: f"SEQ_{i:03d}"
        for i, seq in enumerate(
            sorted(type_counter, key=lambda s: (-type_counter[s], len(s), s)),
            1,
        )
    }

    threshold = 0.50
    edges: List[Dict[str, object]] = []
    adjacency: Dict[str, List[str]] = defaultdict(list)
    seqs = list(type_counter)

    for i in range(len(seqs)):
        for j in range(i + 1, len(seqs)):
            a = seqs[i]
            b = seqs[j]
            sim = sequence_similarity(a, b)
            if sim >= threshold:
                a_id, b_id = seq_ids[a], seq_ids[b]
                adjacency[a_id].append(b_id)
                adjacency[b_id].append(a_id)
                edges.append(
                    {
                        "seq_id_a": a_id,
                        "sequence_a": " ".join(a),
                        "seq_id_b": b_id,
                        "sequence_b": " ".join(b),
                        "similarity": f"{sim:.6f}",
                    }
                )

    seen = set()
    components: List[List[str]] = []
    for node in sorted(seq_ids.values()):
        if node in seen:
            continue
        stack = [node]
        seen.add(node)
        comp = []
        while stack:
            cur = stack.pop()
            comp.append(cur)
            for nxt in adjacency.get(cur, []):
                if nxt not in seen:
                    seen.add(nxt)
                    stack.append(nxt)
        components.append(sorted(comp))
    components.sort(key=lambda c: (-len(c), c[0]))

    seq_to_cluster = {}
    for i, comp in enumerate(components, 1):
        cid = f"CL_{i:03d}"
        for sid in comp:
            seq_to_cluster[sid] = cid

    cluster_rows = []
    for seq in sorted(type_counter, key=lambda s: seq_ids[s]):
        sid = seq_ids[seq]
        cluster_rows.append(
            {
                "cluster_id": seq_to_cluster[sid],
                "sequence_id": sid,
                "sequence": " ".join(seq),
                "line_frequency": type_counter[seq],
                "sequence_length": len(seq),
                "artifacts": ",".join(sorted(type_artifacts[seq])),
                "artifact_count": len(type_artifacts[seq]),
            }
        )

    # Structural templates by sequence length.
    by_len: Dict[int, List[Tuple[str, ...]]] = defaultdict(list)
    for e in entries:
        by_len[len(e.signs_canonical)].append(e.signs_canonical)

    template_rows = []
    for L in sorted(by_len):
        seq_block = by_len[L]
        if len(seq_block) < 2:
            continue
        fixed = []
        for pos in range(L):
            c = Counter(seq[pos] for seq in seq_block)
            sign, count = c.most_common(1)[0]
            share = count / len(seq_block)
            fixed.append(sign if (share >= 0.60 and count >= 2) else "*")
        if all(x == "*" for x in fixed):
            continue

        def match(seq: Tuple[str, ...]) -> bool:
            for i, tok in enumerate(fixed):
                if tok != "*" and seq[i] != tok:
                    return False
            return True

        coverage = sum(1 for seq in seq_block if match(seq)) / len(seq_block)
        template_rows.append(
            {
                "sequence_length": L,
                "template": " ".join(fixed),
                "fixed_positions": sum(1 for tok in fixed if tok != "*"),
                "entries_in_length_group": len(seq_block),
                "coverage": f"{coverage:.6f}",
            }
        )

    write_csv(
        output_dir / "phase2_morphological_clusters.csv",
        [
            "cluster_id",
            "sequence_id",
            "sequence",
            "line_frequency",
            "sequence_length",
            "artifacts",
            "artifact_count",
        ],
        cluster_rows,
    )

    write_csv(
        output_dir / "phase2_similarity_edges.csv",
        ["seq_id_a", "sequence_a", "seq_id_b", "sequence_b", "similarity"],
        sorted(edges, key=lambda r: (-float(r["similarity"]), r["seq_id_a"], r["seq_id_b"])),
    )

    write_csv(
        output_dir / "phase2_structural_templates.csv",
        [
            "sequence_length",
            "template",
            "fixed_positions",
            "entries_in_length_group",
            "coverage",
        ],
        template_rows,
    )

    return {
        "type_counter": type_counter,
        "cluster_rows": cluster_rows,
        "template_rows": template_rows,
    }


def permutation_test_ab22(entries: List[CanonicalEntry], n_iter: int = 5000) -> Dict[str, float]:
    subset = [e.signs_canonical for e in entries if len(e.signs_canonical) == 4 and "AB22" in e.signs_canonical]
    if not subset:
        return {
            "observed_total": 0.0,
            "observed_pos3_count": 0.0,
            "expected_mean_under_null": 0.0,
            "p_value_ge_observed": 1.0,
        }

    observed = sum(1 for seq in subset if seq[2] == "AB22")
    rng = random.Random(RANDOM_SEED + 17)
    ge = 0
    vals = []
    for _ in range(n_iter):
        cur = 0
        for seq in subset:
            arr = list(seq)
            rng.shuffle(arr)
            if arr[2] == "AB22":
                cur += 1
        vals.append(cur)
        if cur >= observed:
            ge += 1

    return {
        "observed_total": float(len(subset)),
        "observed_pos3_count": float(observed),
        "expected_mean_under_null": float(statistics.mean(vals)),
        "p_value_ge_observed": float((ge + 1) / (n_iter + 1)),
    }


def phase3_hypotheses(entries: List[CanonicalEntry], output_dir: Path) -> Dict[str, object]:
    ptest = permutation_test_ab22(entries)

    # KU-RA2 stem support (structural, not semantic).
    seq_counter = Counter(e.signs_canonical for e in entries)
    ku_forms = sorted(
        seq for seq in seq_counter if len(seq) >= 2 and seq[0] == "KU" and seq[1] == "RA2"
    )
    ku_endings = sorted({seq[2] if len(seq) > 2 else "<ZERO>" for seq in ku_forms})
    ku_lines = sum(seq_counter[s] for s in ku_forms)
    ku_artifacts = sorted(
        {e.artifact_id for e in entries if len(e.signs_canonical) >= 2 and e.signs_canonical[0] == "KU" and e.signs_canonical[1] == "RA2"}
    )

    len4 = [e.signs_canonical for e in entries if len(e.signs_canonical) == 4]
    len4_ab22_pos3 = [seq for seq in len4 if seq[2] == "AB22"]
    terminal_after = Counter(seq[3] for seq in len4_ab22_pos3)

    h1 = min(
        84.0,
        100.0
        * (
            0.45 * (ptest["observed_pos3_count"] / max(1.0, ptest["observed_total"]))
            + 0.30 * (1.0 - ptest["p_value_ge_observed"])
            + 0.25 * min(1.0, ptest["observed_total"] / 12.0)
        ),
    )

    h2 = min(
        78.0,
        100.0
        * (
            0.50 * min(1.0, len(ku_endings) / 5.0)
            + 0.30 * (ku_lines / max(1, len(entries)))
            + 0.20 * (len(ku_artifacts) / max(1, len({e.artifact_id for e in entries})))
        ),
    )

    rows = [
        {
            "hypothesis_id": "H-S1",
            "analysis_type": "structural mapping",
            "hypothesis": "AB22 behaves as a positional pivot marker in 4-sign AB-series strings.",
            "statistical_support": (
                f"AB22@position3 observed in {int(ptest['observed_pos3_count'])}/{int(ptest['observed_total'])} lines; "
                f"permutation p={ptest['p_value_ge_observed']:.4f}."
            ),
            "counterarguments": "Small corpus and tablet concentration may inflate positional regularity.",
            "alternative_interpretations": "AB22 may be lexical content rather than a structural divider.",
            "confidence_percent": f"{h1:.2f}",
            "confidence_label": "MEDIUM-HIGH",
        },
        {
            "hypothesis_id": "H-S2",
            "analysis_type": "structural mapping",
            "hypothesis": "KU RA2 forms a recurrent stem with productive terminal alternation.",
            "statistical_support": (
                f"{len(ku_forms)} KU RA2 sequence types; endings={','.join(ku_endings)}; "
                f"{ku_lines} lines across {len(ku_artifacts)} artifacts."
            ),
            "counterarguments": "Could represent independent abbreviations rather than productive morphology.",
            "alternative_interpretations": "Variants may reflect scribal orthography rather than inflection.",
            "confidence_percent": f"{h2:.2f}",
            "confidence_label": "MEDIUM",
        },
        {
            "hypothesis_id": "H-P1",
            "analysis_type": "phonetic mapping",
            "hypothesis": "AB-coded signs may align to Linear B-like phonetic values.",
            "statistical_support": "Only weak indirect support from catalog-style coding and repeat structures.",
            "counterarguments": "AB numbering is an editorial index and not phonetic evidence by itself.",
            "alternative_interpretations": "AB labels can be treated strictly as grapheme IDs.",
            "confidence_percent": "18.00",
            "confidence_label": "LOW",
        },
        {
            "hypothesis_id": "H-M1",
            "analysis_type": "semantic mapping",
            "hypothesis": "Terminal variants after AB22 could encode container/measure classes.",
            "statistical_support": "Terminal diversity after AB22: "
            + ", ".join(f"{k}:{v}" for k, v in terminal_after.most_common()),
            "counterarguments": "No bilingual anchor in corpus; functional role may be non-semantic.",
            "alternative_interpretations": "Could encode grammar, item subtype, or layout convention.",
            "confidence_percent": "29.00",
            "confidence_label": "LOW CONFIDENCE",
        },
    ]

    write_csv(
        output_dir / "phase3_hypothesis_matrix.csv",
        [
            "hypothesis_id",
            "analysis_type",
            "hypothesis",
            "statistical_support",
            "counterarguments",
            "alternative_interpretations",
            "confidence_percent",
            "confidence_label",
        ],
        rows,
    )

    return {"hypothesis_rows": rows, "ab22_test": ptest}


# -------------------- Phase 5 Model Bakeoff --------------------

MODEL_IDS = [
    "model_1_syllabary_like",
    "model_2_logophonetic_mix",
    "model_3_accounting_template",
]

MODEL_LABELS = {
    "model_1_syllabary_like": "Syllabary-like structure hypothesis",
    "model_2_logophonetic_mix": "Logographic + phonetic mix hypothesis",
    "model_3_accounting_template": "Accounting/notation template hypothesis",
}

MODEL_PREDICTION_TARGETS = {
    "model_1_syllabary_like": {
        "positional_entropy_norm": 0.78,
        "first_token_concentration": 0.25,
        "template_dominance": 0.35,
        "bigram_predictability": 0.40,
    },
    "model_2_logophonetic_mix": {
        "positional_entropy_norm": 0.56,
        "first_token_concentration": 0.50,
        "template_dominance": 0.50,
        "bigram_predictability": 0.62,
    },
    "model_3_accounting_template": {
        "positional_entropy_norm": 0.38,
        "first_token_concentration": 0.58,
        "template_dominance": 0.82,
        "bigram_predictability": 0.74,
    },
}


def entropy_from_counter(counter: Counter) -> float:
    total = sum(counter.values())
    if total <= 0:
        return 0.0
    h = 0.0
    for c in counter.values():
        p = c / total
        h -= p * math.log(p + 1e-15)
    return h


def compute_structural_metrics(sequences: List[Tuple[str, ...]]) -> Dict[str, float]:
    if not sequences:
        return {
            "positional_entropy_norm": 0.0,
            "first_token_concentration": 0.0,
            "template_dominance": 0.0,
            "bigram_predictability": 0.0,
        }

    first_counter = Counter(seq[0] for seq in sequences if seq)
    first_token_concentration = max(first_counter.values()) / len(sequences)

    # Position metrics by length.
    by_len: Dict[int, List[Tuple[str, ...]]] = defaultdict(list)
    for seq in sequences:
        by_len[len(seq)].append(seq)

    entropy_weighted = 0.0
    dominance_weighted = 0.0
    denom = 0
    for L, block in by_len.items():
        for pos in range(L):
            c = Counter(seq[pos] for seq in block)
            h = entropy_from_counter(c)
            max_h = math.log(len(c)) if len(c) > 1 else 1e-12
            h_norm = h / max_h if max_h > 0 else 0.0
            dominance = c.most_common(1)[0][1] / len(block)
            entropy_weighted += h_norm * len(block)
            dominance_weighted += dominance * len(block)
            denom += len(block)

    positional_entropy_norm = entropy_weighted / denom if denom else 0.0
    template_dominance = dominance_weighted / denom if denom else 0.0

    bigram_counter = Counter()
    for seq in sequences:
        bigram_counter.update(ngrams(seq, 2))
    if bigram_counter:
        h_bg = entropy_from_counter(bigram_counter)
        max_h_bg = math.log(len(bigram_counter)) if len(bigram_counter) > 1 else 1e-12
        h_bg_norm = h_bg / max_h_bg if max_h_bg > 0 else 0.0
        bigram_predictability = 1.0 - h_bg_norm
    else:
        bigram_predictability = 0.0

    return {
        "positional_entropy_norm": max(0.0, min(1.0, positional_entropy_norm)),
        "first_token_concentration": max(0.0, min(1.0, first_token_concentration)),
        "template_dominance": max(0.0, min(1.0, template_dominance)),
        "bigram_predictability": max(0.0, min(1.0, bigram_predictability)),
    }


def alignment_score(model_id: str, metrics: Dict[str, float]) -> float:
    target = MODEL_PREDICTION_TARGETS[model_id]
    diffs = [abs(metrics[k] - target[k]) for k in target]
    return 100.0 * (1.0 - statistics.mean(diffs))


def fit_model(model_id: str, sequences: List[Tuple[str, ...]], alpha: float = 0.35) -> Dict[str, object]:
    vocab = sorted({tok for seq in sequences for tok in seq})
    V = max(1, len(vocab))
    length_counts = Counter(len(seq) for seq in sequences)

    params: Dict[str, object] = {
        "alpha": alpha,
        "vocab": vocab,
        "vocab_size": V,
        "length_counts": length_counts,
        "n_sequences": len(sequences),
    }

    if model_id == "model_1_syllabary_like":
        params["unigram_counts"] = Counter(tok for seq in sequences for tok in seq)

    elif model_id == "model_2_logophonetic_mix":
        first_counts = Counter(seq[0] for seq in sequences if seq)
        bigram_prev_counts = Counter()
        bigram_counts: Dict[str, Counter] = defaultdict(Counter)
        for seq in sequences:
            if not seq:
                continue
            prev = "<BOS>"
            for tok in seq:
                bigram_counts[prev][tok] += 1
                bigram_prev_counts[prev] += 1
                prev = tok
        params["first_counts"] = first_counts
        params["bigram_counts"] = bigram_counts
        params["bigram_prev_counts"] = bigram_prev_counts

    elif model_id == "model_3_accounting_template":
        pos_counts: Dict[int, Dict[int, Counter]] = defaultdict(lambda: defaultdict(Counter))
        len_totals = Counter()
        for seq in sequences:
            L = len(seq)
            len_totals[L] += 1
            for i, tok in enumerate(seq):
                pos_counts[L][i][tok] += 1
        params["pos_counts"] = pos_counts
        params["len_totals"] = len_totals
        params["fallback_unigram"] = Counter(tok for seq in sequences for tok in seq)

    else:
        raise ValueError(f"unknown model_id: {model_id}")

    return params


def score_length(length: int, params: Dict[str, object]) -> float:
    alpha = float(params["alpha"])
    counts: Counter = params["length_counts"]
    n = int(params["n_sequences"])
    k = len(counts) + 1
    return math.log((counts.get(length, 0) + alpha) / (n + alpha * k))


def score_sequence(model_id: str, params: Dict[str, object], seq: Tuple[str, ...]) -> float:
    alpha = float(params["alpha"])
    V = int(params["vocab_size"])

    ll = score_length(len(seq), params)

    if model_id == "model_1_syllabary_like":
        c_uni: Counter = params["unigram_counts"]
        total = sum(c_uni.values())
        for tok in seq:
            ll += math.log((c_uni.get(tok, 0) + alpha) / (total + alpha * (V + 1)))
        return ll

    if model_id == "model_2_logophonetic_mix":
        first_counts: Counter = params["first_counts"]
        n_first = sum(first_counts.values())
        if seq:
            ll += math.log((first_counts.get(seq[0], 0) + alpha) / (n_first + alpha * (V + 1)))

        bg_counts: Dict[str, Counter] = params["bigram_counts"]
        bg_prev_counts: Counter = params["bigram_prev_counts"]
        prev = "<BOS>"
        for tok in seq:
            c_prev = bg_prev_counts.get(prev, 0)
            c_tok = bg_counts.get(prev, Counter()).get(tok, 0)
            ll += math.log((c_tok + alpha) / (c_prev + alpha * (V + 1)))
            prev = tok
        return ll

    if model_id == "model_3_accounting_template":
        pos_counts: Dict[int, Dict[int, Counter]] = params["pos_counts"]
        len_totals: Counter = params["len_totals"]
        fallback: Counter = params["fallback_unigram"]
        fallback_total = sum(fallback.values())

        L = len(seq)
        for i, tok in enumerate(seq):
            if L in pos_counts and i in pos_counts[L]:
                c = pos_counts[L][i]
                denom = len_totals[L]
                ll += math.log((c.get(tok, 0) + alpha) / (denom + alpha * (V + 1)))
            else:
                ll += math.log((fallback.get(tok, 0) + alpha) / (fallback_total + alpha * (V + 1)))
        return ll

    raise ValueError(f"unknown model_id: {model_id}")


def build_loto_folds(entries: List[CanonicalEntry]) -> List[Tuple[str, List[CanonicalEntry], List[CanonicalEntry]]]:
    artifacts = sorted({e.artifact_id for e in entries})
    folds = []
    for artifact in artifacts:
        test = [e for e in entries if e.artifact_id == artifact]
        train = [e for e in entries if e.artifact_id != artifact]
        if train and test:
            folds.append((f"loto:{artifact}", train, test))
    return folds


def build_kfold_folds(entries: List[CanonicalEntry], k: int, seed: int) -> List[Tuple[str, List[CanonicalEntry], List[CanonicalEntry]]]:
    if k <= 1 or len(entries) < k:
        return []
    rng = random.Random(seed)
    idxs = list(range(len(entries)))
    rng.shuffle(idxs)
    buckets = [idxs[i::k] for i in range(k)]

    folds = []
    for i in range(k):
        test_idx = set(buckets[i])
        test = [entries[j] for j in range(len(entries)) if j in test_idx]
        train = [entries[j] for j in range(len(entries)) if j not in test_idx]
        if train and test:
            folds.append((f"kfold:{i+1}", train, test))
    return folds


def evaluate_model_cv(
    model_id: str,
    entries: List[CanonicalEntry],
    scheme: str,
    seed: int,
) -> Dict[str, object]:
    if scheme == "leave_one_artifact_out":
        folds = build_loto_folds(entries)
    elif scheme == "kfold":
        # 5-fold when corpus is large enough; otherwise 3-fold fallback.
        k = 5 if len(entries) >= 35 else 3
        folds = build_kfold_folds(entries, k=k, seed=seed)
    else:
        raise ValueError(f"unknown cv scheme: {scheme}")

    if not folds:
        return {
            "folds": 0,
            "test_lines": 0,
            "test_tokens": 0,
            "mean_log_likelihood_per_token": float("nan"),
            "perplexity": float("inf"),
        }

    total_ll = 0.0
    total_tokens = 0
    total_lines = 0

    for _, train, test in folds:
        train_seq = [e.signs_canonical for e in train]
        model = fit_model(model_id, train_seq)
        for e in test:
            ll = score_sequence(model_id, model, e.signs_canonical)
            total_ll += ll
            total_tokens += max(1, len(e.signs_canonical))
            total_lines += 1

    mean_ll_tok = total_ll / total_tokens if total_tokens else float("nan")
    ppl = math.exp(-mean_ll_tok) if math.isfinite(mean_ll_tok) else float("inf")
    return {
        "folds": len(folds),
        "test_lines": total_lines,
        "test_tokens": total_tokens,
        "mean_log_likelihood_per_token": mean_ll_tok,
        "perplexity": ppl,
    }


def run_model_bakeoff(entries: List[CanonicalEntry], output_dir: Path) -> Dict[str, object]:
    sequences = [e.signs_canonical for e in entries]
    observed_metrics = compute_structural_metrics(sequences)

    schemes = ["leave_one_artifact_out"]
    if len(entries) >= 18:
        schemes.append("kfold")

    rows: List[Dict[str, object]] = []

    for scheme in schemes:
        scheme_rows = []
        for model_id in MODEL_IDS:
            cv = evaluate_model_cv(model_id, entries, scheme=scheme, seed=RANDOM_SEED)
            align = alignment_score(model_id, observed_metrics)
            scheme_rows.append(
                {
                    "model_id": model_id,
                    "model_label": MODEL_LABELS[model_id],
                    "cv_scheme": scheme,
                    "folds": cv["folds"],
                    "test_lines": cv["test_lines"],
                    "test_tokens": cv["test_tokens"],
                    "mean_log_likelihood_per_token": cv["mean_log_likelihood_per_token"],
                    "perplexity": cv["perplexity"],
                    "prediction_alignment_score": align,
                }
            )

        # Normalize CV performance per scheme for comparability.
        ll_values = [r["mean_log_likelihood_per_token"] for r in scheme_rows]
        ll_min = min(ll_values)
        ll_max = max(ll_values)
        for r in scheme_rows:
            if ll_max > ll_min:
                cv_rank = 100.0 * (r["mean_log_likelihood_per_token"] - ll_min) / (ll_max - ll_min)
            else:
                cv_rank = 50.0
            overall = 0.65 * cv_rank + 0.35 * r["prediction_alignment_score"]
            r["cv_rank_score"] = cv_rank
            r["overall_goodness_score"] = overall
            rows.append(r)

    # Combined model ranking across available schemes.
    combined_rows = []
    for model_id in MODEL_IDS:
        subset = [r for r in rows if r["model_id"] == model_id]
        if not subset:
            continue
        mean_ll = statistics.mean(r["mean_log_likelihood_per_token"] for r in subset)
        mean_ppl = statistics.mean(r["perplexity"] for r in subset)
        mean_align = statistics.mean(r["prediction_alignment_score"] for r in subset)
        mean_cv_rank = statistics.mean(r["cv_rank_score"] for r in subset)
        mean_good = statistics.mean(r["overall_goodness_score"] for r in subset)
        combined_rows.append(
            {
                "model_id": model_id,
                "model_label": MODEL_LABELS[model_id],
                "cv_scheme": "combined",
                "folds": sum(int(r["folds"]) for r in subset),
                "test_lines": sum(int(r["test_lines"]) for r in subset),
                "test_tokens": sum(int(r["test_tokens"]) for r in subset),
                "mean_log_likelihood_per_token": mean_ll,
                "perplexity": mean_ppl,
                "prediction_alignment_score": mean_align,
                "cv_rank_score": mean_cv_rank,
                "overall_goodness_score": mean_good,
            }
        )

    winner = max(combined_rows, key=lambda r: r["overall_goodness_score"]) if combined_rows else None
    winner_id = winner["model_id"] if winner else ""

    final_rows = rows + combined_rows
    for row in final_rows:
        row["is_best_model"] = "1" if row["model_id"] == winner_id and row["cv_scheme"] == "combined" else "0"

    write_csv(
        output_dir / "phase5_model_bakeoff_scores.csv",
        [
            "model_id",
            "model_label",
            "cv_scheme",
            "folds",
            "test_lines",
            "test_tokens",
            "mean_log_likelihood_per_token",
            "perplexity",
            "prediction_alignment_score",
            "cv_rank_score",
            "overall_goodness_score",
            "is_best_model",
        ],
        [
            {
                "model_id": r["model_id"],
                "model_label": r["model_label"],
                "cv_scheme": r["cv_scheme"],
                "folds": r["folds"],
                "test_lines": r["test_lines"],
                "test_tokens": r["test_tokens"],
                "mean_log_likelihood_per_token": f"{float(r['mean_log_likelihood_per_token']):.6f}",
                "perplexity": f"{float(r['perplexity']):.6f}",
                "prediction_alignment_score": f"{float(r['prediction_alignment_score']):.6f}",
                "cv_rank_score": f"{float(r['cv_rank_score']):.6f}",
                "overall_goodness_score": f"{float(r['overall_goodness_score']):.6f}",
                "is_best_model": r["is_best_model"],
            }
            for r in sorted(final_rows, key=lambda x: (x["cv_scheme"], -x["overall_goodness_score"]))
        ],
    )

    # Model diagnostics markdown.
    lines = [
        "# Phase 5 Model Bakeoff Diagnostics",
        "",
        "## Measurable Predictions",
        "- Model 1 (Syllabary-like): higher positional entropy, weaker fixed templates.",
        "- Model 2 (Logographic + phonetic mix): stronger first-token concentration and stronger local transitions.",
        "- Model 3 (Accounting template): strongest position-conditioned regularity and template dominance.",
        "",
        "## Observed Corpus Structural Metrics",
    ]
    for k, v in observed_metrics.items():
        lines.append(f"- `{k}`: {v:.4f}")

    lines.append("")
    lines.append("## Combined Scores")
    for r in sorted(combined_rows, key=lambda x: -x["overall_goodness_score"]):
        marker = " (winner)" if r["model_id"] == winner_id else ""
        lines.append(
            f"- {r['model_label']}: overall={r['overall_goodness_score']:.2f}, "
            f"ll/token={r['mean_log_likelihood_per_token']:.4f}, perplexity={r['perplexity']:.2f}, "
            f"alignment={r['prediction_alignment_score']:.2f}{marker}"
        )

    (output_dir / "phase5_model_diagnostics.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    return {
        "winner_model_id": winner_id,
        "winner_row": winner,
        "combined_rows": combined_rows,
        "observed_metrics": observed_metrics,
    }


def copy_entries(entries: List[CanonicalEntry], new_sequences: List[Tuple[str, ...]]) -> List[CanonicalEntry]:
    out = []
    for e, seq in zip(entries, new_sequences):
        out.append(
            CanonicalEntry(
                canonical_line_id=e.canonical_line_id,
                artifact_id=e.artifact_id,
                sequence_surface=e.sequence_surface,
                quantity=e.quantity,
                signs_raw=e.signs_raw,
                signs_canonical=tuple(seq),
                groups_raw=e.groups_raw,
                source_observation_ids=e.source_observation_ids,
                provenance_tags=e.provenance_tags,
                source_kinds=e.source_kinds,
            )
        )
    return out


def phase5_adversarial_suite(
    base_entries: List[CanonicalEntry],
    winner_model_id: str,
    baseline_loto_ll: float,
    observations: List[RawObservation],
    variant_map: Dict[str, List[VariantMapEntry]],
    output_dir: Path,
) -> Dict[str, object]:
    rng = random.Random(RANDOM_SEED + 101)

    def eval_loto(entries: List[CanonicalEntry]) -> Tuple[float, float]:
        cv = evaluate_model_cv(winner_model_id, entries, scheme="leave_one_artifact_out", seed=RANDOM_SEED)
        return float(cv["mean_log_likelihood_per_token"]), float(cv["perplexity"])

    baseline_ll = baseline_loto_ll
    baseline_ppl = math.exp(-baseline_ll)

    suite_rows: List[Dict[str, object]] = []

    # Test 1: Global sign relabel permutation.
    vocab = sorted({tok for e in base_entries for tok in e.signs_canonical})
    perm = vocab[:]
    rng.shuffle(perm)
    mapping = {a: b for a, b in zip(vocab, perm)}
    relabeled = [tuple(mapping[t] for t in e.signs_canonical) for e in base_entries]
    relabeled_entries = copy_entries(base_entries, relabeled)
    relabel_ll, relabel_ppl = eval_loto(relabeled_entries)

    suite_rows.append(
        {
            "test_name": "randomized_sign_relabel_global",
            "test_type": "adversarial_control",
            "model_id": winner_model_id,
            "baseline_log_likelihood": baseline_ll,
            "perturbed_log_likelihood": relabel_ll,
            "delta_log_likelihood": relabel_ll - baseline_ll,
            "baseline_perplexity": baseline_ppl,
            "perturbed_perplexity": relabel_ppl,
            "delta_perplexity": relabel_ppl - baseline_ppl,
            "expected_behavior": "small_change_allowed",
            "notes": "Global relabel preserves structural shape but destroys sign identity semantics.",
        }
    )

    # Test 2: Shuffle signs within each sequence.
    shuffled = []
    for e in base_entries:
        arr = list(e.signs_canonical)
        rng.shuffle(arr)
        shuffled.append(tuple(arr))
    shuffled_entries = copy_entries(base_entries, shuffled)
    shuffled_ll, shuffled_ppl = eval_loto(shuffled_entries)

    suite_rows.append(
        {
            "test_name": "shuffled_sequence_control",
            "test_type": "falsification",
            "model_id": winner_model_id,
            "baseline_log_likelihood": baseline_ll,
            "perturbed_log_likelihood": shuffled_ll,
            "delta_log_likelihood": shuffled_ll - baseline_ll,
            "baseline_perplexity": baseline_ppl,
            "perturbed_perplexity": shuffled_ppl,
            "delta_perplexity": shuffled_ppl - baseline_ppl,
            "expected_behavior": "substantial_degradation",
            "notes": "Intra-line shuffling should break positional templates.",
        }
    )

    # Test 3: Per-line randomized relabeling.
    relabeled_linewise = []
    for e in base_entries:
        local_map = vocab[:]
        rng.shuffle(local_map)
        m = {a: b for a, b in zip(vocab, local_map)}
        relabeled_linewise.append(tuple(m[t] for t in e.signs_canonical))
    relabeled_linewise_entries = copy_entries(base_entries, relabeled_linewise)
    linewise_ll, linewise_ppl = eval_loto(relabeled_linewise_entries)

    suite_rows.append(
        {
            "test_name": "randomized_sign_relabel_per_line",
            "test_type": "falsification",
            "model_id": winner_model_id,
            "baseline_log_likelihood": baseline_ll,
            "perturbed_log_likelihood": linewise_ll,
            "delta_log_likelihood": linewise_ll - baseline_ll,
            "baseline_perplexity": baseline_ppl,
            "perturbed_perplexity": linewise_ppl,
            "delta_perplexity": linewise_ppl - baseline_ppl,
            "expected_behavior": "substantial_degradation",
            "notes": "Destroys cross-line recurrence patterns.",
        }
    )

    # Test 4: Genre split if possible.
    genres = defaultdict(list)
    for e in base_entries:
        m = ARTIFACT_PREFIX_RE.match(e.artifact_id)
        genre = m.group(1) if m else "UNK"
        genres[genre].append(e)

    genre_result_ll = float("nan")
    if len(genres) >= 2:
        genre_pairs = []
        for g_train, train_entries in genres.items():
            test_entries = [e for g, block in genres.items() if g != g_train for e in block]
            if not train_entries or not test_entries:
                continue
            model = fit_model(winner_model_id, [e.signs_canonical for e in train_entries])
            total_ll = 0.0
            tokens = 0
            for e in test_entries:
                total_ll += score_sequence(winner_model_id, model, e.signs_canonical)
                tokens += max(1, len(e.signs_canonical))
            genre_pairs.append(total_ll / tokens if tokens else float("nan"))
        if genre_pairs:
            genre_result_ll = float(statistics.mean(genre_pairs))
            genre_result_ppl = math.exp(-genre_result_ll)
            suite_rows.append(
                {
                    "test_name": "genre_split_cross_prediction",
                    "test_type": "generalization",
                    "model_id": winner_model_id,
                    "baseline_log_likelihood": baseline_ll,
                    "perturbed_log_likelihood": genre_result_ll,
                    "delta_log_likelihood": genre_result_ll - baseline_ll,
                    "baseline_perplexity": baseline_ppl,
                    "perturbed_perplexity": genre_result_ppl,
                    "delta_perplexity": genre_result_ppl - baseline_ppl,
                    "expected_behavior": "moderate_degradation",
                    "notes": "Train on one artifact-prefix genre, test on others.",
                }
            )

    # Test 5: Cross-corpus segmentation (internal vs imported external corpus).
    internal_entries = [e for e in base_entries if "external_csv" not in set(e.source_kinds)]
    external_entries = [e for e in base_entries if "external_csv" in set(e.source_kinds)]
    if internal_entries and external_entries:
        directional_ll = []
        directional_labels = []

        # Train internal -> test external
        model_i = fit_model(winner_model_id, [e.signs_canonical for e in internal_entries])
        ll_i = 0.0
        tok_i = 0
        for e in external_entries:
            ll_i += score_sequence(winner_model_id, model_i, e.signs_canonical)
            tok_i += max(1, len(e.signs_canonical))
        if tok_i:
            directional_ll.append(ll_i / tok_i)
            directional_labels.append("internal_to_external")

        # Train external -> test internal
        model_e = fit_model(winner_model_id, [e.signs_canonical for e in external_entries])
        ll_e = 0.0
        tok_e = 0
        for e in internal_entries:
            ll_e += score_sequence(winner_model_id, model_e, e.signs_canonical)
            tok_e += max(1, len(e.signs_canonical))
        if tok_e:
            directional_ll.append(ll_e / tok_e)
            directional_labels.append("external_to_internal")

        if directional_ll:
            cross_ll = float(statistics.mean(directional_ll))
            cross_ppl = math.exp(-cross_ll)
            suite_rows.append(
                {
                    "test_name": "cross_corpus_segmentation",
                    "test_type": "generalization",
                    "model_id": winner_model_id,
                    "baseline_log_likelihood": baseline_ll,
                    "perturbed_log_likelihood": cross_ll,
                    "delta_log_likelihood": cross_ll - baseline_ll,
                    "baseline_perplexity": baseline_ppl,
                    "perturbed_perplexity": cross_ppl,
                    "delta_perplexity": cross_ppl - baseline_ppl,
                    "expected_behavior": "moderate_degradation",
                    "notes": "Cross-corpus prediction: " + ",".join(directional_labels),
                }
            )

    # Test 6: Remove 20% of external corpus lines and re-evaluate stability.
    if len(external_entries) >= 5:
        remove_n = max(1, int(round(0.20 * len(external_entries))))
        remove_ids = {e.canonical_line_id for e in rng.sample(external_entries, remove_n)}
        reduced_entries = [e for e in base_entries if e.canonical_line_id not in remove_ids]
        reduced_ll, reduced_ppl = eval_loto(reduced_entries)
        suite_rows.append(
            {
                "test_name": "remove_20pct_external_random",
                "test_type": "stability",
                "model_id": winner_model_id,
                "baseline_log_likelihood": baseline_ll,
                "perturbed_log_likelihood": reduced_ll,
                "delta_log_likelihood": reduced_ll - baseline_ll,
                "baseline_perplexity": baseline_ppl,
                "perturbed_perplexity": reduced_ppl,
                "delta_perplexity": reduced_ppl - baseline_ppl,
                "expected_behavior": "small_to_moderate_change",
                "notes": f"Removed {remove_n}/{len(external_entries)} external-derived canonical lines.",
            }
        )

    # Test 7/8: Normalization setting stability.
    mode_results = {}
    for mode in ["identity", "permissive"]:
        mode_entries, _ = normalize_and_manifest(
            observations=observations,
            variant_map=variant_map,
            normalization_mode=mode,
            output_dir=output_dir / "_tmp" / mode,
        )
        mode_ll, mode_ppl = eval_loto(mode_entries)
        mode_results[mode] = {
            "ll": mode_ll,
            "ppl": mode_ppl,
            "n_lines": len(mode_entries),
        }

        suite_rows.append(
            {
                "test_name": f"normalization_mode_{mode}",
                "test_type": "stability",
                "model_id": winner_model_id,
                "baseline_log_likelihood": baseline_ll,
                "perturbed_log_likelihood": mode_ll,
                "delta_log_likelihood": mode_ll - baseline_ll,
                "baseline_perplexity": baseline_ppl,
                "perturbed_perplexity": mode_ppl,
                "delta_perplexity": mode_ppl - baseline_ppl,
                "expected_behavior": "small_to_moderate_change",
                "notes": f"Compare strict baseline to {mode} normalization.",
            }
        )

    # Cleanup temp folders used for stability tests.
    tmp_dir = output_dir / "_tmp"
    if tmp_dir.exists():
        shutil.rmtree(tmp_dir)

    write_csv(
        output_dir / "phase5_adversarial_suite.csv",
        [
            "test_name",
            "test_type",
            "model_id",
            "baseline_log_likelihood",
            "perturbed_log_likelihood",
            "delta_log_likelihood",
            "baseline_perplexity",
            "perturbed_perplexity",
            "delta_perplexity",
            "expected_behavior",
            "notes",
        ],
        [
            {
                "test_name": r["test_name"],
                "test_type": r["test_type"],
                "model_id": r["model_id"],
                "baseline_log_likelihood": f"{float(r['baseline_log_likelihood']):.6f}",
                "perturbed_log_likelihood": f"{float(r['perturbed_log_likelihood']):.6f}",
                "delta_log_likelihood": f"{float(r['delta_log_likelihood']):.6f}",
                "baseline_perplexity": f"{float(r['baseline_perplexity']):.6f}",
                "perturbed_perplexity": f"{float(r['perturbed_perplexity']):.6f}",
                "delta_perplexity": f"{float(r['delta_perplexity']):.6f}",
                "expected_behavior": r["expected_behavior"],
                "notes": r["notes"],
            }
            for r in suite_rows
        ],
    )

    # Failure mode notes.
    biggest_drop = min(suite_rows, key=lambda r: r["delta_log_likelihood"]) if suite_rows else None
    lines = [
        "# Phase 5 Failure Modes",
        "",
        "## Stress Test Summary",
    ]
    for row in sorted(suite_rows, key=lambda r: r["delta_log_likelihood"]):
        lines.append(
            f"- {row['test_name']}: delta log-likelihood = {row['delta_log_likelihood']:.4f} "
            f"({row['expected_behavior']})"
        )

    lines.append("")
    lines.append("## Weak Points")
    if biggest_drop:
        lines.append(
            f"- Largest degradation appears under `{biggest_drop['test_name']}`; "
            "this indicates positional/sequence order is central to current structural fit."
        )
    else:
        lines.append("- No adversarial tests were available.")

    lines.append(
        "- Current corpus remains limited in artifact diversity; out-of-sample claims should remain provisional."
    )

    (output_dir / "phase5_failure_modes.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    return {
        "suite_rows": suite_rows,
        "mode_results": mode_results,
    }


def compute_confidence_components(
    entries: List[CanonicalEntry],
    normalization_info: Dict[str, object],
    phase2: Dict[str, object],
    phase3: Dict[str, object],
    bakeoff: Dict[str, object],
    adversarial: Dict[str, object],
    output_dir: Path,
) -> Dict[str, object]:
    n_lines = len(entries)
    n_artifacts = len({e.artifact_id for e in entries})
    n_sources = len({sid for e in entries for sid in e.source_observation_ids})

    # Component 1: corpus adequacy.
    corpus_adequacy = (
        0.55 * min(1.0, n_lines / 150.0)
        + 0.25 * min(1.0, n_artifacts / 20.0)
        + 0.20 * min(1.0, n_sources / 200.0)
    )

    # Component 2: normalization stability.
    uncertainty_rows = normalization_info["uncertainty_rows"]
    mapping_logs = normalization_info["mapping_logs"]
    uncertainty_rate = len(uncertainty_rows) / max(1, len(mapping_logs))

    mode_results = adversarial.get("mode_results", {})
    strict_ll = bakeoff["winner_row"]["mean_log_likelihood_per_token"] if bakeoff.get("winner_row") else -10.0
    delta_identity = abs(mode_results.get("identity", {}).get("ll", strict_ll) - strict_ll)
    delta_permissive = abs(mode_results.get("permissive", {}).get("ll", strict_ll) - strict_ll)
    avg_delta_norm = min(1.0, (delta_identity + delta_permissive) / 2.0)
    normalization_stability = max(0.0, (1.0 - avg_delta_norm)) * (1.0 - min(0.5, uncertainty_rate))

    # Component 3: template predictability.
    template_rows = phase2["template_rows"]
    if template_rows:
        weighted_cov = sum(
            float(r["coverage"]) * int(r["entries_in_length_group"]) for r in template_rows
        ) / max(1, n_lines)
    else:
        weighted_cov = 0.0
    model3 = next((r for r in bakeoff["combined_rows"] if r["model_id"] == "model_3_accounting_template"), None)
    model3_align = (model3["prediction_alignment_score"] / 100.0) if model3 else 0.0
    template_predictability = 0.6 * model3_align + 0.4 * weighted_cov

    # Component 4: out-of-sample performance.
    winner = bakeoff.get("winner_row")
    winner_ll = winner["mean_log_likelihood_per_token"] if winner else -10.0
    baseline_model1 = next((r for r in bakeoff["combined_rows"] if r["model_id"] == "model_1_syllabary_like"), None)
    baseline_ll = baseline_model1["mean_log_likelihood_per_token"] if baseline_model1 else winner_ll
    gain = winner_ll - baseline_ll
    out_of_sample = 1.0 / (1.0 + math.exp(-6.0 * gain))

    # Component 5: adversarial robustness.
    suite_rows = adversarial["suite_rows"]
    by_name = {r["test_name"]: r for r in suite_rows}

    benign = []
    for name in ["randomized_sign_relabel_global", "normalization_mode_identity", "normalization_mode_permissive"]:
        if name in by_name:
            benign.append(abs(by_name[name]["delta_log_likelihood"]))
    benign_retention = math.exp(-statistics.mean(benign)) if benign else 0.0

    destructive = []
    for name in ["shuffled_sequence_control", "randomized_sign_relabel_per_line"]:
        if name in by_name:
            destructive.append(abs(by_name[name]["delta_log_likelihood"]))
    destructive_sep = min(1.0, statistics.mean(destructive) / 0.8) if destructive else 0.0

    adversarial_robustness = 0.5 * benign_retention + 0.5 * destructive_sep

    components = {
        "corpus_adequacy_score": corpus_adequacy,
        "normalization_stability_score": normalization_stability,
        "template_predictability_score": template_predictability,
        "out_of_sample_performance_score": out_of_sample,
        "adversarial_robustness_score": adversarial_robustness,
    }

    weights = {
        "corpus_adequacy_score": 0.25,
        "normalization_stability_score": 0.20,
        "template_predictability_score": 0.20,
        "out_of_sample_performance_score": 0.20,
        "adversarial_robustness_score": 0.15,
    }

    raw_conf = 100.0 * sum(components[k] * weights[k] for k in weights)

    strict_gate = (
        n_lines >= 80
        and n_artifacts >= 12
        and min(components.values()) >= 0.70
        and out_of_sample >= 0.70
    )
    final_conf = raw_conf if strict_gate else min(raw_conf, 84.99)

    # Safety guard: if semantic confidence appears stronger than structural confidence
    # or if confidence crosses 85%, require extra stress-test stability.
    hypothesis_rows = phase3.get("hypothesis_rows", [])
    structural_conf = max(
        (
            float(r.get("confidence_percent", 0.0))
            for r in hypothesis_rows
            if str(r.get("analysis_type", "")).startswith("structural")
        ),
        default=0.0,
    )
    semantic_conf = max(
        (
            float(r.get("confidence_percent", 0.0))
            for r in hypothesis_rows
            if str(r.get("analysis_type", "")).startswith("semantic")
        ),
        default=0.0,
    )
    semantic_stronger_than_structural = semantic_conf > structural_conf

    stress_guard_triggered = final_conf >= 85.0 or semantic_stronger_than_structural
    stress_guard_collapse = False
    guard_test_min_delta = float("nan")
    if stress_guard_triggered:
        guard_test_names = [
            "cross_corpus_segmentation",
            "remove_20pct_external_random",
            "shuffled_sequence_control",
            "randomized_sign_relabel_per_line",
        ]
        guard_deltas = [
            float(by_name[name]["delta_log_likelihood"])
            for name in guard_test_names
            if name in by_name
        ]
        if guard_deltas:
            guard_test_min_delta = min(guard_deltas)
            if guard_test_min_delta <= -0.45:
                stress_guard_collapse = True
                final_conf = min(final_conf, 84.99)

    rows = []
    for k in weights:
        rows.append(
            {
                "component": k,
                "score": f"{components[k]:.6f}",
                "weight": f"{weights[k]:.6f}",
                "contribution": f"{components[k] * weights[k] * 100.0:.6f}",
            }
        )
    rows.append({"component": "RAW_CONFIDENCE_SCORE", "score": f"{raw_conf:.6f}", "weight": "n/a", "contribution": "n/a"})
    rows.append({"component": "FINAL_CONFIDENCE_SCORE", "score": f"{final_conf:.6f}", "weight": "n/a", "contribution": "n/a"})

    write_csv(
        output_dir / "phase5_confidence_components.csv",
        ["component", "score", "weight", "contribution"],
        rows,
    )

    # Backward-compatible alias.
    write_csv(
        output_dir / "confidence_scoring_matrix.csv",
        ["component", "signal_value", "weight", "weighted_contribution"],
        [
            {
                "component": r["component"],
                "signal_value": r["score"],
                "weight": r["weight"],
                "weighted_contribution": r["contribution"],
            }
            for r in rows
        ],
    )

    # Sensitivity analysis.
    rng = random.Random(RANDOM_SEED + 303)
    keys = list(weights.keys())

    def compute_with_w(w: Dict[str, float]) -> Tuple[float, float]:
        raw = 100.0 * sum(components[k] * w[k] for k in keys)
        capped = raw if strict_gate else min(raw, 84.99)
        return raw, capped

    sens_rows = []

    raw0, cap0 = compute_with_w(weights)
    sens_rows.append(
        {
            "scenario_id": "base",
            "scenario_type": "base_weights",
            **{f"w_{k}": f"{weights[k]:.6f}" for k in keys},
            "raw_confidence": f"{raw0:.6f}",
            "capped_confidence": f"{cap0:.6f}",
        }
    )

    # One-at-a-time shifts.
    for k in keys:
        for delta in (-0.08, 0.08):
            w = dict(weights)
            w[k] = max(0.01, w[k] + delta)
            s = sum(w.values())
            for kk in w:
                w[kk] /= s
            raw, cap = compute_with_w(w)
            sens_rows.append(
                {
                    "scenario_id": f"oat_{k}_{'plus' if delta>0 else 'minus'}",
                    "scenario_type": "one_at_a_time",
                    **{f"w_{kk}": f"{w[kk]:.6f}" for kk in keys},
                    "raw_confidence": f"{raw:.6f}",
                    "capped_confidence": f"{cap:.6f}",
                }
            )

    # Random weight draws.
    for i in range(400):
        vals = [rng.random() + 0.01 for _ in keys]
        s = sum(vals)
        w = {k: vals[j] / s for j, k in enumerate(keys)}
        raw, cap = compute_with_w(w)
        sens_rows.append(
            {
                "scenario_id": f"rand_{i+1:03d}",
                "scenario_type": "random_weights",
                **{f"w_{kk}": f"{w[kk]:.6f}" for kk in keys},
                "raw_confidence": f"{raw:.6f}",
                "capped_confidence": f"{cap:.6f}",
            }
        )

    write_csv(
        output_dir / "phase5_confidence_sensitivity.csv",
        [
            "scenario_id",
            "scenario_type",
            *[f"w_{k}" for k in keys],
            "raw_confidence",
            "capped_confidence",
        ],
        sens_rows,
    )

    # Final confidence statement.
    limiting = []
    if n_lines < 80:
        limiting.append("corpus_size")
    if n_artifacts < 12:
        limiting.append("artifact_diversity")
    if min(components.values()) < 0.70:
        limiting.append("component_convergence")
    if stress_guard_collapse:
        limiting.append("stress_guard_collapse")

    final_statement_lines = [
        f"RUN_UTC={datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}",
        f"FINAL_CONFIDENCE={final_conf:.2f}%",
        f"RAW_CONFIDENCE={raw_conf:.2f}%",
        f"THRESHOLD_85_REACHED={'YES' if final_conf >= 85.0 else 'NO'}",
        "INTERPRETATION=STRUCTURAL_PROVISIONAL",
        "DECIPHERMENT_CLAIM=NOT_SUPPORTED",
        f"SEMANTIC_STRONGER_THAN_STRUCTURAL={'YES' if semantic_stronger_than_structural else 'NO'}",
        f"STRESS_GUARD_TRIGGERED={'YES' if stress_guard_triggered else 'NO'}",
        f"STRESS_GUARD_COLLAPSE={'YES' if stress_guard_collapse else 'NO'}",
        f"STRESS_GUARD_MIN_DELTA_LL={guard_test_min_delta:.6f}" if math.isfinite(guard_test_min_delta) else "STRESS_GUARD_MIN_DELTA_LL=n/a",
        f"LIMITING_FACTORS={','.join(limiting) if limiting else 'none'}",
    ]
    (output_dir / "final_confidence_statement.txt").write_text(
        "\n".join(final_statement_lines) + "\n",
        encoding="utf-8",
    )

    return {
        "components": components,
        "weights": weights,
        "raw_confidence": raw_conf,
        "final_confidence": final_conf,
        "strict_gate": strict_gate,
        "limiting_factors": limiting,
        "semantic_stronger_than_structural": semantic_stronger_than_structural,
        "stress_guard_triggered": stress_guard_triggered,
        "stress_guard_collapse": stress_guard_collapse,
        "stress_guard_min_delta_ll": guard_test_min_delta,
    }


def render_research_log(
    output_dir: Path,
    observations: List[RawObservation],
    canonical_entries: List[CanonicalEntry],
    phase1: Dict[str, object],
    phase2: Dict[str, object],
    phase3: Dict[str, object],
    bakeoff: Dict[str, object],
    confidence: Dict[str, object],
    normalization_mode: str,
    external_loaded: int,
) -> None:
    by_artifact = Counter(e.artifact_id for e in canonical_entries)
    source_kind_counts = Counter(o.source_kind for o in observations)

    winner = bakeoff.get("winner_row")
    winner_label = MODEL_LABELS.get(winner["model_id"], "n/a") if winner else "n/a"

    lines = [
        "# Linear A Structured Decipherment Log",
        "",
        "## Corpus and Provenance",
        f"- Random seed: `{RANDOM_SEED}`",
        f"- Normalization mode: `{normalization_mode}`",
        f"- Total observations (all sources): **{len(observations)}**",
        f"- External corpus rows loaded: **{external_loaded}**",
        f"- Canonical corpus lines: **{len(canonical_entries)}**",
        f"- Artifacts covered: **{len(by_artifact)}** ({', '.join(sorted(by_artifact))})",
        "- Source-kind counts: " + ", ".join(f"`{k}`={v}" for k, v in sorted(source_kind_counts.items())),
        "",
        "## Phase 1",
        "- Frequency tables, positional distributions, prefix/suffix patterns, and normalization logs written.",
        "",
        "## Phase 2",
        f"- Morphological clusters: {len(phase2['cluster_rows'])} sequence types grouped.",
        f"- Structural templates detected: {len(phase2['template_rows'])}.",
        "",
        "## Phase 3",
        f"- Hypotheses generated: {len(phase3['hypothesis_rows'])}",
        f"- AB22 positional permutation p-value: {phase3['ab22_test']['p_value_ge_observed']:.6f}",
        "",
        "## Phase 5 Model Bakeoff",
        f"- Winning model: **{winner_label}**",
        f"- Winner overall score: {winner['overall_goodness_score']:.2f}" if winner else "- Winner overall score: n/a",
        "",
        "## Confidence",
        f"- Raw confidence: {confidence['raw_confidence']:.2f}%",
        f"- Final confidence: **{confidence['final_confidence']:.2f}%**",
        (
            "- 85% threshold was not reached under strict guardrails."
            if confidence["final_confidence"] < 85.0
            else "- 85% threshold reached with convergent evidence."
        ),
        f"- Limiting factors: {', '.join(confidence['limiting_factors']) if confidence['limiting_factors'] else 'none'}",
        (
            f"- Stress guard triggered: yes (min delta ll={confidence.get('stress_guard_min_delta_ll', float('nan')):.4f})."
            if confidence.get("stress_guard_triggered")
            else "- Stress guard triggered: no."
        ),
        "",
        "## Caveat",
        "- Structural confidence does not imply semantic decipherment.",
    ]

    (output_dir / "research_log.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def run_pipeline(
    output_dir: Path,
    external_corpus_path: Path,
    variant_map_path: Path,
    normalization_mode: str = "strict",
) -> Dict[str, object]:
    ensure_dir(output_dir)

    variant_map = load_variant_map(variant_map_path)
    internal_obs = collect_internal_observations()
    external_obs = load_external_observations(external_corpus_path, start_id=len(internal_obs) + 1)
    observations = internal_obs + external_obs

    canonical_entries, normalization_info = normalize_and_manifest(
        observations=observations,
        variant_map=variant_map,
        normalization_mode=normalization_mode,
        output_dir=output_dir,
    )

    phase1 = phase1_frequency_and_positions(canonical_entries, output_dir)
    phase2 = phase2_structural_modeling(canonical_entries, output_dir)
    phase3 = phase3_hypotheses(canonical_entries, output_dir)

    bakeoff = run_model_bakeoff(canonical_entries, output_dir)

    winner_row = bakeoff.get("winner_row")
    winner_model_id = winner_row["model_id"] if winner_row else "model_3_accounting_template"
    baseline_loto = evaluate_model_cv(
        winner_model_id,
        canonical_entries,
        scheme="leave_one_artifact_out",
        seed=RANDOM_SEED,
    )

    adversarial = phase5_adversarial_suite(
        base_entries=canonical_entries,
        winner_model_id=winner_model_id,
        baseline_loto_ll=float(baseline_loto["mean_log_likelihood_per_token"]),
        observations=observations,
        variant_map=variant_map,
        output_dir=output_dir,
    )

    confidence = compute_confidence_components(
        entries=canonical_entries,
        normalization_info=normalization_info,
        phase2=phase2,
        phase3=phase3,
        bakeoff=bakeoff,
        adversarial=adversarial,
        output_dir=output_dir,
    )

    render_research_log(
        output_dir=output_dir,
        observations=observations,
        canonical_entries=canonical_entries,
        phase1=phase1,
        phase2=phase2,
        phase3=phase3,
        bakeoff=bakeoff,
        confidence=confidence,
        normalization_mode=normalization_mode,
        external_loaded=len(external_obs),
    )

    summary = {
        "run_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "random_seed": RANDOM_SEED,
        "normalization_mode": normalization_mode,
        "observations_all_sources": len(observations),
        "external_rows_loaded": len(external_obs),
        "canonical_entries": len(canonical_entries),
        "artifact_count": len({e.artifact_id for e in canonical_entries}),
        "winner_model_id": winner_model_id,
        "final_confidence": round(confidence["final_confidence"], 2),
        "raw_confidence": round(confidence["raw_confidence"], 2),
        "threshold_85_reached": bool(confidence["final_confidence"] >= 85.0),
        "semantic_stronger_than_structural": bool(confidence.get("semantic_stronger_than_structural", False)),
        "stress_guard_triggered": bool(confidence.get("stress_guard_triggered", False)),
        "stress_guard_collapse": bool(confidence.get("stress_guard_collapse", False)),
        "limiting_factors": confidence["limiting_factors"],
    }
    (output_dir / "run_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")

    return summary


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run Linear A structural analysis pipeline.")
    parser.add_argument(
        "--output-dir",
        default=str(DEFAULT_OUTPUT_DIR),
        help="Directory for run outputs.",
    )
    parser.add_argument(
        "--external-corpus",
        default=str(DEFAULT_EXTERNAL_CORPUS),
        help="Path to external corpus CSV.",
    )
    parser.add_argument(
        "--variant-map",
        default=str(DEFAULT_VARIANT_MAP),
        help="Path to sign variant map CSV.",
    )
    parser.add_argument(
        "--normalization-mode",
        choices=["strict", "permissive", "identity"],
        default="strict",
        help="Normalization mode for canonical corpus generation.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    summary = run_pipeline(
        output_dir=Path(args.output_dir),
        external_corpus_path=Path(args.external_corpus),
        variant_map_path=Path(args.variant_map),
        normalization_mode=args.normalization_mode,
    )
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
