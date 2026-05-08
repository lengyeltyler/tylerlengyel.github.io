#!/usr/bin/env python3
"""Supplemental Linear A validation and confidence-tier analysis.

This script intentionally does not replace the main Phase 1-5 pipeline. It reads
the current `output/latest` artifacts and adds stricter model checks, adversarial
controls, confidence tiers, semantic-anchor notes, and a research audit.
"""

from __future__ import annotations

import csv
import json
import math
import random
import re
import statistics
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Dict, Iterable, List, Sequence, Tuple

ROOT = Path(__file__).resolve().parents[2]
RESEARCH_DIR = ROOT / "linearA" / "research"
OUTPUT_DIR = RESEARCH_DIR / "output" / "latest"
DATA_DIR = RESEARCH_DIR / "data"
METADATA_DIR = DATA_DIR / "metadata"
AUDIT_PATH = RESEARCH_DIR / "LINEAR_A_RESEARCH_AUDIT.md"
RANDOM_SEED = 20260507
ALPHA = 0.35


def read_csv(path: Path) -> List[Dict[str, str]]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def write_csv(path: Path, fieldnames: Sequence[str], rows: Iterable[Dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def write_json(path: Path, payload: Dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def split_sequence(value: str) -> Tuple[str, ...]:
    return tuple(tok for tok in value.split() if tok)


def site_from_artifact(artifact: str) -> str:
    match = re.match(r"^([A-Z]+)", artifact.strip())
    return match.group(1) if match else "UNKNOWN"


def object_class_from_artifact(artifact: str) -> str:
    text = artifact.upper()
    if " WC " in f" {text} " or "WC" in text:
        return "sealed_document_or_roundel"
    if " WA " in f" {text} " or "WA" in text:
        return "nodule_or_sealing"
    if " Z" in f" {text} " or re.search(r"\b[A-Z]+ Z[A-Z]?\b", text):
        return "inscription_or_vessel"
    if re.search(r"\bHT\b|\bKH\b|\bZA\b|\bARKH\b|\bPH\b|\bKN\b", text):
        return "administrative_tablet_like"
    return "unclassified"


def region_from_site(site: str) -> str:
    central = {"HT", "KN", "ARKH", "PH", "PK"}
    east = {"ZA", "PE", "PS", "SY"}
    west = {"KH"}
    islands = {"KE", "MI", "MA", "TH", "KY"}
    mainland = {"MY", "PYR", "TY"}
    if site in central:
        return "crete_central"
    if site in east:
        return "crete_east"
    if site in west:
        return "crete_west"
    if site in islands:
        return "aegean_islands"
    if site in mainland:
        return "mainland_or_external"
    return "unknown"


def formula_class_for_sequence(seq: Tuple[str, ...]) -> str:
    seq_text = " ".join(seq)
    if any(tok in seq for tok in {"GRA", "OLE", "OLIV", "VINA", "VIN", "FIC"}):
        return "commodity_accounting"
    if "KU RO" in seq_text:
        return "total_formula_candidate"
    if len(seq) == 4 and len(seq) > 2 and seq[2] == "AB22":
        return "ab22_positional_formula"
    if len(seq) <= 2:
        return "short_mark_or_label"
    if any(tok.startswith("A") and tok[1:].isdigit() for tok in seq):
        return "a_series_sequence"
    return "unclassified"


def classification_from_row(seq: Tuple[str, ...], object_class: str, formula_class: str) -> str:
    if formula_class in {"commodity_accounting", "total_formula_candidate", "ab22_positional_formula"}:
        return "administrative"
    if object_class == "inscription_or_vessel":
        return "ritual_or_display_possible"
    return "unknown"


def safe_mean(values: Sequence[float], default: float = 0.0) -> float:
    return statistics.mean(values) if values else default


class NgramModel:
    def __init__(self, order: int, sequences: Sequence[Tuple[str, ...]]):
        self.order = order
        self.vocab = sorted({tok for seq in sequences for tok in seq})
        self.vocab_size = max(1, len(self.vocab))
        self.length_counts = Counter(len(seq) for seq in sequences)
        self.n_sequences = max(1, len(sequences))
        self.context_counts: Dict[Tuple[str, ...], Counter] = defaultdict(Counter)
        for seq in sequences:
            padded = ("<BOS>",) * max(0, order - 1) + seq
            if order <= 1:
                for tok in seq:
                    self.context_counts[()].update([tok])
            else:
                for i in range(order - 1, len(padded)):
                    ctx = padded[i - order + 1 : i]
                    self.context_counts[ctx].update([padded[i]])

    def score_length(self, length: int) -> float:
        k = len(self.length_counts) + 1
        return math.log((self.length_counts.get(length, 0) + ALPHA) / (self.n_sequences + ALPHA * k))

    def score(self, seq: Tuple[str, ...]) -> float:
        ll = self.score_length(len(seq))
        if self.order <= 1:
            counts = self.context_counts[()]
            total = sum(counts.values())
            for tok in seq:
                ll += math.log((counts.get(tok, 0) + ALPHA) / (total + ALPHA * (self.vocab_size + 1)))
            return ll

        padded = ("<BOS>",) * (self.order - 1) + seq
        fallback = self.context_counts.get((), Counter())
        fallback_total = sum(fallback.values())
        for i in range(self.order - 1, len(padded)):
            ctx = padded[i - self.order + 1 : i]
            counts = self.context_counts.get(ctx)
            if not counts:
                counts = fallback
            total = sum(counts.values())
            denom = total + ALPHA * (self.vocab_size + 1)
            ll += math.log((counts.get(padded[i], 0) + ALPHA) / denom)
            if not counts and fallback_total:
                ll += math.log(1 / (self.vocab_size + 1))
        return ll


class PositionalModel:
    def __init__(self, sequences: Sequence[Tuple[str, ...]]):
        self.vocab = sorted({tok for seq in sequences for tok in seq})
        self.vocab_size = max(1, len(self.vocab))
        self.length_counts = Counter(len(seq) for seq in sequences)
        self.n_sequences = max(1, len(sequences))
        self.pos_counts: Dict[int, Dict[int, Counter]] = defaultdict(lambda: defaultdict(Counter))
        self.unigram = Counter(tok for seq in sequences for tok in seq)
        for seq in sequences:
            for i, tok in enumerate(seq):
                self.pos_counts[len(seq)][i].update([tok])

    def score(self, seq: Tuple[str, ...]) -> float:
        k = len(self.length_counts) + 1
        ll = math.log((self.length_counts.get(len(seq), 0) + ALPHA) / (self.n_sequences + ALPHA * k))
        fallback_total = sum(self.unigram.values())
        for i, tok in enumerate(seq):
            counts = self.pos_counts.get(len(seq), {}).get(i)
            if counts:
                total = sum(counts.values())
                ll += math.log((counts.get(tok, 0) + ALPHA) / (total + ALPHA * (self.vocab_size + 1)))
            else:
                ll += math.log((self.unigram.get(tok, 0) + ALPHA) / (fallback_total + ALPHA * (self.vocab_size + 1)))
        return ll


def score_model(model_factory: Callable[[Sequence[Tuple[str, ...]]], object], train: Sequence[Tuple[str, ...]], test: Sequence[Tuple[str, ...]]) -> Dict[str, float]:
    model = model_factory(train)
    ll = 0.0
    tokens = 0
    for seq in test:
        ll += float(model.score(seq))
        tokens += max(1, len(seq))
    mean_ll = ll / max(1, tokens)
    return {
        "mean_log_likelihood_per_token": mean_ll,
        "perplexity": math.exp(-mean_ll),
        "test_lines": float(len(test)),
        "test_tokens": float(tokens),
    }


def build_folds(entries: List[Dict[str, object]], key: str, min_test_lines: int = 8) -> List[Tuple[str, List[Tuple[str, ...]], List[Tuple[str, ...]]]]:
    buckets: Dict[str, List[Dict[str, object]]] = defaultdict(list)
    for entry in entries:
        buckets[str(entry[key])].append(entry)
    folds = []
    for value, bucket in sorted(buckets.items()):
        if len(bucket) < min_test_lines:
            continue
        test_ids = {id(row) for row in bucket}
        train = [row["sequence"] for row in entries if id(row) not in test_ids]
        test = [row["sequence"] for row in bucket]
        if train and test:
            folds.append((value, train, test))
    return folds


def evaluate_splits(entries: List[Dict[str, object]]) -> List[Dict[str, object]]:
    model_factories: Dict[str, Callable[[Sequence[Tuple[str, ...]]], object]] = {
        "null_unigram_frequency": lambda seqs: NgramModel(1, seqs),
        "bigram_markov": lambda seqs: NgramModel(2, seqs),
        "trigram_markov": lambda seqs: NgramModel(3, seqs),
        "position_by_length_template": lambda seqs: PositionalModel(seqs),
    }
    split_specs = [
        ("artifact_held_out", "artifact_id", 4),
        ("site_held_out", "site", 10),
        ("region_held_out", "region", 10),
        ("object_class_held_out", "object_class", 10),
        ("formula_class_held_out", "formula_class", 10),
        ("inscription_length_held_out", "length_bucket", 10),
    ]
    rows: List[Dict[str, object]] = []
    for split_name, key, min_test in split_specs:
        folds = build_folds(entries, key, min_test_lines=min_test)
        for model_name, factory in model_factories.items():
            ll_values = []
            ppl_values = []
            test_lines = 0
            test_tokens = 0
            for _, train, test in folds:
                scored = score_model(factory, train, test)
                ll_values.append(scored["mean_log_likelihood_per_token"])
                ppl_values.append(scored["perplexity"])
                test_lines += int(scored["test_lines"])
                test_tokens += int(scored["test_tokens"])
            mean_ll = safe_mean(ll_values, float("nan"))
            mean_ppl = safe_mean(ppl_values, float("inf"))
            rows.append(
                {
                    "split": split_name,
                    "model": model_name,
                    "folds": len(folds),
                    "test_lines": test_lines,
                    "test_tokens": test_tokens,
                    "mean_log_likelihood_per_token": f"{mean_ll:.6f}",
                    "perplexity": f"{mean_ppl:.6f}",
                }
            )
    by_split: Dict[str, Dict[str, float]] = defaultdict(dict)
    for row in rows:
        by_split[str(row["split"])][str(row["model"])] = float(row["mean_log_likelihood_per_token"])
    for row in rows:
        baseline = by_split[str(row["split"])].get("null_unigram_frequency")
        ll = float(row["mean_log_likelihood_per_token"])
        improvement = ll - baseline if baseline is not None else 0.0
        row["ll_improvement_over_unigram"] = f"{improvement:.6f}"
        row["beats_unigram"] = "1" if improvement > 0.01 else "0"
    return rows


def run_adversarial_tests(entries: List[Dict[str, object]]) -> List[Dict[str, object]]:
    rng = random.Random(RANDOM_SEED)
    sequences = [row["sequence"] for row in entries]
    vocab = sorted({tok for seq in sequences for tok in seq})
    unigram_counts = Counter(tok for seq in sequences for tok in seq)
    weighted_vocab = list(unigram_counts.keys())
    weights = [unigram_counts[tok] for tok in weighted_vocab]

    def shuffle_inside(seq: Tuple[str, ...]) -> Tuple[str, ...]:
        out = list(seq)
        rng.shuffle(out)
        return tuple(out)

    def corrupt_20(seq: Tuple[str, ...]) -> Tuple[str, ...]:
        out = list(seq)
        for i in range(len(out)):
            if rng.random() < 0.20:
                out[i] = rng.choices(weighted_vocab, weights=weights, k=1)[0]
        return tuple(out)

    def length_random(seq: Tuple[str, ...]) -> Tuple[str, ...]:
        return tuple(rng.choices(weighted_vocab, weights=weights, k=len(seq)))

    permuted_vocab = vocab[:]
    rng.shuffle(permuted_vocab)
    permutation = dict(zip(vocab, permuted_vocab))

    def global_label_permutation(seq: Tuple[str, ...]) -> Tuple[str, ...]:
        return tuple(permutation.get(tok, tok) for tok in seq)

    perturbations = {
        "within_line_shuffle": shuffle_inside,
        "random_20pct_token_corruption": corrupt_20,
        "length_preserving_frequency_sample": length_random,
        "global_label_permutation_scored_against_original": global_label_permutation,
    }
    models: Dict[str, Callable[[Sequence[Tuple[str, ...]]], object]] = {
        "null_unigram_frequency": lambda seqs: NgramModel(1, seqs),
        "bigram_markov": lambda seqs: NgramModel(2, seqs),
        "trigram_markov": lambda seqs: NgramModel(3, seqs),
        "position_by_length_template": lambda seqs: PositionalModel(seqs),
    }
    rows: List[Dict[str, object]] = []
    for model_name, factory in models.items():
        model = factory(sequences)
        base_ll = sum(float(model.score(seq)) for seq in sequences) / sum(max(1, len(seq)) for seq in sequences)
        base_ppl = math.exp(-base_ll)
        for test_name, fn in perturbations.items():
            perturbed = [fn(seq) for seq in sequences]
            pert_ll = sum(float(model.score(seq)) for seq in perturbed) / sum(max(1, len(seq)) for seq in perturbed)
            delta = pert_ll - base_ll
            if model_name == "null_unigram_frequency" and test_name in {
                "within_line_shuffle",
                "random_20pct_token_corruption",
                "length_preserving_frequency_sample",
            }:
                expected = "small_change_expected_for_frequency_only_null"
                passed = abs(delta) < 0.05
            else:
                expected = {
                    "within_line_shuffle": "should_degrade_for_order_sensitive_models",
                    "random_20pct_token_corruption": "should_degrade_moderately",
                    "length_preserving_frequency_sample": "should_degrade_strongly",
                    "global_label_permutation_scored_against_original": "should_degrade_if_sign_identity_matters",
                }[test_name]
                passed = delta < -0.05
            rows.append(
                {
                    "test_name": test_name,
                    "model": model_name,
                    "baseline_ll_per_token": f"{base_ll:.6f}",
                    "perturbed_ll_per_token": f"{pert_ll:.6f}",
                    "delta_ll_per_token": f"{delta:.6f}",
                    "baseline_perplexity": f"{base_ppl:.6f}",
                    "perturbed_perplexity": f"{math.exp(-pert_ll):.6f}",
                    "expected_behavior": expected,
                    "passed": "1" if passed else "0",
                }
            )
    return rows


def build_semantic_anchor_inventory(canonical_rows: List[Dict[str, str]]) -> List[Dict[str, object]]:
    sequences = [row.get("signs_canonical", "") for row in canonical_rows]
    joined = " ".join(sequences)
    anchors = [
        ("numerals_and_quantities", "Numeric fields and tallies", "administrative context", 0.72, "Quantity columns recur, but numeric interpretation is structural rather than lexical."),
        ("commodity_logograms", "GRA/OLE/VINA/FIC/OLIV and related logograms", "comparative administrative convention", 0.62, "Commodity labels are plausible where logograms are explicit; they do not identify surrounding word meanings."),
        ("ku_ro_total_formula", "KU RO as possible total formula", "repeated terminal/admin placement", 0.58, "Traditionally discussed as 'total'; still treated here as a functional anchor, not full translation."),
        ("ab22_positional_pivot", "AB22 in 4-sign sequences", "permutation test and recurrence", 0.54, "Strong positional behavior, but the sign could be lexical rather than a divider."),
        ("offering_formulae", "Libation/offering table formulae", "external scholarship target", 0.34, "Requires object/formula metadata not fully represented in current normalized corpus."),
        ("place_or_person_names", "Potential proper names", "repeated sign groups", 0.22, "No controlled onomastic test is implemented yet."),
    ]
    rows = []
    for anchor_id, label, evidence, confidence, caveat in anchors:
        count = sum(1 for seq in sequences if any(part in seq for part in label.split("/") if len(part) >= 3))
        if anchor_id == "commodity_logograms":
            count = sum(joined.count(tok) for tok in ["GRA", "OLE", "VINA", "FIC", "OLIV"])
        if anchor_id == "ku_ro_total_formula":
            count = joined.count("KU RO")
        if anchor_id == "ab22_positional_pivot":
            count = joined.count("AB22")
        rows.append(
            {
                "anchor_id": anchor_id,
                "anchor": label,
                "evidence_type": evidence,
                "observed_support_count": count,
                "confidence_percent": f"{confidence * 100:.1f}",
                "tier": "moderate" if confidence >= 0.55 else "low",
                "caveat": caveat,
            }
        )
    return rows


def build_formula_inventory(metadata_rows: List[Dict[str, object]]) -> List[Dict[str, object]]:
    by_formula: Dict[str, List[Dict[str, object]]] = defaultdict(list)
    for row in metadata_rows:
        by_formula[str(row["formula_class"])].append(row)

    rows = []
    for formula, group in sorted(by_formula.items(), key=lambda item: (-len(item[1]), item[0])):
        sites = sorted({str(row["site_find_place"]) for row in group})
        object_types = Counter(str(row["object_type"]) for row in group)
        admin_count = sum(1 for row in group if row["accounting_candidate"] == "1")
        libation_count = sum(1 for row in group if row["libation_formula_candidate"] == "1")
        confidence = 0.22
        reasons = ["classification is currently metadata/sequence assisted"]
        if formula == "commodity_accounting":
            confidence = 0.68
            reasons.append("explicit commodity/logogram tokens are present")
        elif formula == "ab22_positional_formula":
            confidence = 0.58
            reasons.append("AB22 positional recurrence is measurable")
        elif formula == "total_formula_candidate":
            confidence = 0.58
            reasons.append("KU RO candidate is traditionally treated as functional")
        elif formula == "short_mark_or_label":
            confidence = 0.42
            reasons.append("short labels recur but are not semantically classified")
        elif formula == "a_series_sequence":
            confidence = 0.36
            reasons.append("A-series sign patterns need external sign-function review")
        rows.append(
            {
                "formula_class": formula,
                "supporting_inscriptions": len(group),
                "sites": "; ".join(sites[:20]),
                "dominant_object_type": object_types.most_common(1)[0][0] if object_types else "unknown",
                "accounting_candidates": admin_count,
                "libation_candidates": libation_count,
                "confidence_percent": f"{confidence * 100:.1f}",
                "classification_basis": "; ".join(reasons),
                "counterexamples_or_limits": "Requires source-verified object/support metadata before final formula claims.",
            }
        )
    return rows


def write_metadata_provenance_report(metadata_summary: Dict[str, object]) -> None:
    quality = metadata_summary.get("metadata_quality", {})
    lines = [
        "# Metadata Provenance Report",
        "",
        f"Generated UTC: {metadata_summary.get('generated_utc')}",
        "",
        "## Coverage",
        f"- Inscriptions/artifacts represented: **{metadata_summary.get('inscriptions')}**",
        f"- Inferred site groups: **{metadata_summary.get('sites')}**",
        "",
        "## Region Coverage",
    ]
    for region, count in dict(metadata_summary.get("regions", {})).items():
        lines.append(f"- {region}: {count}")
    lines += ["", "## Object-Type Coverage"]
    for obj, count in dict(metadata_summary.get("object_types", {})).items():
        lines.append(f"- {obj}: {count}")
    lines += ["", "## Formula-Class Coverage"]
    for formula, count in dict(metadata_summary.get("formula_classes", {})).items():
        lines.append(f"- {formula}: {count}")
    lines += [
        "",
        "## Verified vs Inferred",
        "- Site/find-place: inferred from artifact prefix; source-backed provenance URL exists for most rows, but site fields still need source-page confirmation.",
        "- Region: heuristic from site prefix.",
        "- Object type: heuristic from artifact ID conventions and needs SigLA/GORILA verification.",
        "- Formula class: derived from sequence features and metadata heuristics; not authoritative.",
        "- Chronology/period: unresolved beyond broad Linear A Bronze Age context.",
        "- Find context: unresolved.",
        "",
        "## Metadata Quality Flags",
    ]
    for key, value in dict(quality).items():
        lines.append(f"- {key}: {value}")
    lines += [
        "",
        "## Hard Limit",
        "The current local corpus contains strong sign-sequence provenance, but not enough source-exported document metadata to make expert-grade object, date, support, and context claims. Further improvement requires a curated SigLA/GORILA metadata pass.",
    ]
    (METADATA_DIR / "metadata_provenance_report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_phonetic_claim_audit() -> None:
    lines = [
        "# Phonetic Claim Audit",
        "",
        "## Scope",
        "This audit separates editorial AB/A sign labels from actual phonetic evidence.",
        "",
        "## Findings",
        "| Claim | Source basis | Evidence | Counterargument | Confidence | Linear B dependency |",
        "|---|---|---|---|---:|---|",
        "| AB/A sign labels are phonetic values | Modern sign catalog labels | Useful standard identifiers | Catalog numbering is not phonetic evidence | 5% | no |",
        "| Some Linear A signs may share Linear B phonetic values | Homomorphic sign comparison | Linear A is graphically ancestral/related to Linear B | Homomorphy does not guarantee homophony; language differs | 18% | yes |",
        "| Approximate readings can be attempted for homomorphic signs | Linear B comparison and scholarly convention | Some signs are argued to be homophones | Applies only to subset and remains disputed | 22% | yes |",
        "| Linear A language family can be inferred from current corpus | None in current pipeline | No implemented comparative test | No bilingual, lexicon, or grammar proof | 8% | no |",
        "",
        "## Operational Rule",
        "The pipeline must treat phonetic values as comparison hypotheses, never as confirmed Linear A readings. AB labels remain grapheme identifiers unless independently justified.",
    ]
    (RESEARCH_DIR / "phonetic_claim_audit.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def derive_confidence_tiers(
    canonical_rows: List[Dict[str, str]],
    split_rows: List[Dict[str, object]],
    adversarial_rows: List[Dict[str, object]],
    anchor_rows: List[Dict[str, object]],
) -> List[Dict[str, object]]:
    components = {r["component"]: float(r["score"]) for r in read_csv(OUTPUT_DIR / "phase5_confidence_components.csv") if r.get("score", "").replace(".", "", 1).isdigit()}
    manifest = read_csv(OUTPUT_DIR / "phase1_corpus_manifest.csv")
    n_lines = len(canonical_rows)
    artifacts = {row.get("artifact_id", "") for row in canonical_rows if row.get("artifact_id")}
    sites = {site_from_artifact(a) for a in artifacts}
    provenance_covered = sum(1 for row in manifest if row.get("provenance_tags")) / max(1, len(manifest))
    unknown_tokens = sum(seq.count("[?]") for seq in (row.get("signs_canonical", "") for row in canonical_rows))
    total_tokens = sum(len(split_sequence(row.get("signs_canonical", ""))) for row in canonical_rows)
    unknown_rate = unknown_tokens / max(1, total_tokens)

    split_improvements = [
        float(row["ll_improvement_over_unigram"])
        for row in split_rows
        if row["model"] != "null_unigram_frequency" and int(row.get("folds", 0)) > 0
    ]
    avg_improvement = safe_mean([v for v in split_improvements if math.isfinite(v)])
    oos_score = max(0.0, min(1.0, 0.50 + avg_improvement / 1.20))

    order_tests = [
        float(row["delta_ll_per_token"])
        for row in adversarial_rows
        if row["test_name"] == "within_line_shuffle" and row["model"] in {"bigram_markov", "trigram_markov", "position_by_length_template"}
    ]
    order_degradation = abs(min(order_tests)) if order_tests else 0.0
    order_score = max(0.0, min(1.0, order_degradation / 0.65))

    anchor_conf = safe_mean([float(row["confidence_percent"]) / 100 for row in anchor_rows])
    corpus_score = (
        0.30 * min(1.0, n_lines / 2500)
        + 0.25 * min(1.0, len(artifacts) / 600)
        + 0.20 * provenance_covered
        + 0.15 * min(1.0, len(sites) / 20)
        + 0.10 * (1.0 - min(0.5, unknown_rate))
    )
    normalization_score = max(0.0, min(1.0, components.get("normalization_stability_score", 0.0) - unknown_rate))
    template_score = components.get("template_predictability_score", 0.0)
    structural_score = 0.35 * oos_score + 0.30 * order_score + 0.20 * components.get("adversarial_robustness_score", 0.0) + 0.15 * template_score
    semantic_score = anchor_conf
    phonetic_score = 0.18
    word_meaning_score = min(0.32, semantic_score * 0.72)
    language_family_score = 0.08
    decipherment_score = (
        0.20 * semantic_score
        + 0.20 * phonetic_score
        + 0.25 * word_meaning_score
        + 0.20 * language_family_score
        + 0.15 * min(structural_score, 0.50)
    )
    structural_overall = (
        0.25 * corpus_score
        + 0.20 * normalization_score
        + 0.25 * structural_score
        + 0.15 * template_score
        + 0.15 * oos_score
    )

    tier_specs = [
        ("corpus_adequacy_confidence", corpus_score, "Corpus is broad enough for structure tests; metadata depth is still incomplete."),
        ("normalization_confidence", normalization_score, "Strict mapping is stable, but unreadable signs and variants still limit certainty."),
        ("structural_script_confidence", structural_score, "Order-sensitive models show some signal, but not enough for high-confidence decipherment."),
        ("template_predictability_confidence", template_score, "Directly inherited from the current Phase 5 template component."),
        ("out_of_sample_prediction_confidence", oos_score, "Supplemental held-out splits compared against a frequency-only null."),
        ("semantic_anchor_confidence", semantic_score, "Anchors are mostly administrative/functional, not lexical proof."),
        ("phonetic_value_confidence", phonetic_score, "Linear B comparison remains indirect; AB labels are not phonetic evidence by themselves."),
        ("word_meaning_confidence", word_meaning_score, "A few formulae are plausible, but broad lexical translation is unsupported."),
        ("language_family_confidence", language_family_score, "No implemented comparative language-family test supports a family assignment."),
        ("overall_structural_confidence", structural_overall, "Best current estimate for structural regularity, separate from decipherment."),
        ("overall_decipherment_confidence", decipherment_score, "Conservative combined estimate for actual decipherment/translation confidence."),
    ]
    rows = []
    for tier, score, rationale in tier_specs:
        pct = max(0.0, min(99.0, score * 100.0))
        if pct >= 85:
            label = "high"
        elif pct >= 70:
            label = "medium-high"
        elif pct >= 50:
            label = "medium"
        elif pct >= 25:
            label = "low"
        else:
            label = "very low"
        rows.append(
            {
                "tier": tier,
                "confidence_percent": f"{pct:.2f}",
                "label": label,
                "rationale": rationale,
            }
        )
    return rows


def create_source_notes() -> None:
    text = """# Linear A Source Acquisition Notes

Access date: 2026-05-07

## Sources already represented locally
- SigLA / The Signs of Linear A (`https://sigla.phis.me/`): open-access browser database. The site describes document metadata including find-place and typology, sign/word search, and CC BY-NC-SA dataset/drawings. Current local ingestion uses SigLA-derived rows where fetchable.
- John G. Younger Linear A archive via Wayback snapshots: current local ingestion uses archived HT and miscellaneous text pages with explicit provenance URLs.

## Sources evaluated but not fully ingested in this pass
- GORILA / Recueil des inscriptions en lineaire A: the standard corpus remains primarily a print/scanned corpus. It is essential for expert verification, but this repo should not bulk-republish scans or transcriptions without a clear rights decision.
- DAMOS / Database of Mycenaean at Oslo (`https://damos.hf.uio.no/about/content/`): useful Linear B administrative comparison corpus, licensed CC BY-NC-SA for content. It should be used as a comparative baseline only, not as direct evidence that Linear A is Greek or that Linear A signs share Linear B phonetic values.

## Required next acquisition steps
1. Export or manually compile SigLA metadata fields not currently represented: site, document type, support/material, word boundaries, sign function, and uncertain-reading flags.
2. Add a separate Linear B comparison dataset with license metadata and a clear “comparison only” warning.
3. Add object-type labels for offering tables, vessels, tablets, roundels, nodules, sealings, and potmarks before claiming formula-held-out validation.
4. Preserve raw source rows separately from normalized rows and keep all provenance URLs.
"""
    (DATA_DIR / "source_acquisition_notes.md").write_text(text, encoding="utf-8")


def write_source_registry() -> None:
    registry = {
        "generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "sources": [
            {
                "source": "SigLA - The Signs of Linear A",
                "url": "https://sigla.phis.me/",
                "license_notes": "Dataset and drawings are indicated as CC BY-NC-SA 4.0 on SigLA.",
                "provenance_confidence": "high",
                "ingestion_status": "partially_ingested",
                "normalization_status": "used for structural sign-sequence rows where locally available",
                "legal_manual_review_notes": "Use metadata and sign-sequence data with attribution and noncommercial/share-alike awareness; avoid copying drawings unless needed and license-compliant.",
            },
            {
                "source": "INSCRIBE / Linear A SigLA documentation",
                "url": "https://site.unibo.it/inscribe/en/linear-a-sigla",
                "license_notes": "Project documentation; use as source description, not bulk data extraction.",
                "provenance_confidence": "medium",
                "ingestion_status": "documented_not_bulk_ingested",
                "normalization_status": "metadata target fields derived from described SigLA capabilities",
                "legal_manual_review_notes": "Manual review needed for any downloadable data beyond descriptive documentation.",
            },
            {
                "source": "John G. Younger Linear A archive via Wayback",
                "url": "https://web.archive.org/web/20190416193018/http://www.people.ku.edu/~jyounger/LinearA/HTtexts.html",
                "license_notes": "Archived academic web pages; use with provenance URLs and conservative structural extraction.",
                "provenance_confidence": "medium",
                "ingestion_status": "partially_ingested",
                "normalization_status": "structural sequences normalized through variant map",
                "legal_manual_review_notes": "Verify against primary editions before treating as authoritative.",
            },
            {
                "source": "GORILA / Recueil des inscriptions en lineaire A",
                "url": "print_reference",
                "license_notes": "Standard print corpus; not bulk-ingested here.",
                "provenance_confidence": "high_as_reference",
                "ingestion_status": "manual_review_required",
                "normalization_status": "not_ingested",
                "legal_manual_review_notes": "Do not republish copyrighted print corpus; use for expert verification/citation planning.",
            },
            {
                "source": "DAMOS Linear B corpus",
                "url": "https://damos.hf.uio.no/about/online/",
                "license_notes": "Content: CC BY-NC-SA 4.0 according to DAMOS.",
                "provenance_confidence": "high",
                "ingestion_status": "comparison_only_not_ingested",
                "normalization_status": "not used in Linear A scoring",
                "legal_manual_review_notes": "Use only as Linear B administrative comparison baseline; never as proof Linear A is Greek.",
            },
        ],
    }
    write_json(DATA_DIR / "source_registry.json", registry)


def build_metadata(canonical_rows: List[Dict[str, str]]) -> Tuple[List[Dict[str, object]], Dict[str, object]]:
    grouped: Dict[str, List[Dict[str, str]]] = defaultdict(list)
    for row in canonical_rows:
        grouped[row.get("artifact_id", "UNKNOWN")].append(row)

    rows: List[Dict[str, object]] = []
    for artifact, group in sorted(grouped.items()):
        site = site_from_artifact(artifact)
        region = region_from_site(site)
        object_class = object_class_from_artifact(artifact)
        sequences = [split_sequence(row.get("signs_canonical", "")) for row in group]
        signs = [tok for seq in sequences for tok in seq]
        formula_counts = Counter(formula_class_for_sequence(seq) for seq in sequences)
        formula_class = formula_counts.most_common(1)[0][0] if formula_counts else "unclassified"
        classification = classification_from_row(sequences[0] if sequences else tuple(), object_class, formula_class)
        provenance = sorted({row.get("provenance_tags", "") for row in group if row.get("provenance_tags")})
        source_kinds = sorted({row.get("source_count", "") for row in group if row.get("source_count")})
        unknown_count = signs.count("[?]") + signs.count("?")
        damage = unknown_count / max(1, len(signs))
        has_ideogram = any(tok in {"GRA", "OLE", "OLIV", "VINA", "VIN", "FIC", "OVIS", "CAP"} for tok in signs)
        has_numeral = any((row.get("quantity") or "").strip() for row in group)
        rows.append(
            {
                "inscription_id": artifact,
                "source_corpus": "local_merged_sigla_younger_internal",
                "provenance_source_url": "; ".join(provenance[:4]),
                "site_find_place": site,
                "region": region,
                "object_type": object_class,
                "support_material": "clay_or_object_unknown",
                "classification": classification,
                "formula_class": formula_class,
                "inscription_length": len(signs),
                "line_count": len(group),
                "sign_count": len(signs),
                "word_count": len(signs),
                "sign_inventory_used": " ".join(sorted(set(signs))[:80]),
                "estimated_date_period": "Bronze_Age_Linear_A_period_unverified",
                "find_context": "requires_source_metadata_review",
                "libation_formula_candidate": "1" if object_class == "inscription_or_vessel" and formula_class != "commodity_accounting" else "0",
                "accounting_candidate": "1" if classification == "administrative" else "0",
                "ideogram_presence": "1" if has_ideogram else "0",
                "numeral_presence": "1" if has_numeral else "0",
                "damage_unreadability_level": f"{damage:.4f}",
                "confidence_provenance_notes": "Inferred from artifact ID and normalized sequence; needs expert metadata enrichment.",
            }
        )

    summary = {
        "generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "inscriptions": len(rows),
        "sites": len({row["site_find_place"] for row in rows}),
        "regions": Counter(str(row["region"]) for row in rows),
        "object_types": Counter(str(row["object_type"]) for row in rows),
        "formula_classes": Counter(str(row["formula_class"]) for row in rows),
        "metadata_quality": {
            "site_find_place": "inferred_from_artifact_prefix",
            "region": "heuristic_from_site_prefix",
            "object_type": "heuristic_from_artifact_id",
            "date_period": "not_source_verified",
            "find_context": "missing",
        },
    }
    return rows, summary


def build_audit(
    split_rows: List[Dict[str, object]],
    adversarial_rows: List[Dict[str, object]],
    tier_rows: List[Dict[str, object]],
    anchor_rows: List[Dict[str, object]],
) -> None:
    run_summary = json.loads((OUTPUT_DIR / "run_summary.json").read_text(encoding="utf-8"))
    components = read_csv(OUTPUT_DIR / "phase5_confidence_components.csv")
    best_oos = sorted(
        [r for r in split_rows if r["model"] != "null_unigram_frequency"],
        key=lambda r: float(r["ll_improvement_over_unigram"]),
        reverse=True,
    )[:6]
    failed_adv = [r for r in adversarial_rows if r.get("passed") == "0"]

    lines = [
        "# Linear A Research Audit",
        "",
        f"Generated UTC: {datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}",
        "",
        "## Scope Reviewed",
        "- LinearA public pages: overview, technical analysis, findings, downloads, tablet pages.",
        "- Research scripts and data under `linearA/research/`.",
        "- Latest generated outputs under `linearA/research/output/latest/`.",
        "- External-source options: SigLA, Younger archive, GORILA, DAMOS Linear B.",
        "",
        "## Existing 71.36% Score",
        "The current 71.36% is a weighted structural-confidence score, not translation certainty.",
        "",
        "| Component | Score | Weight | Contribution |",
        "|---|---:|---:|---:|",
    ]
    for row in components:
        if row["component"].endswith("SCORE"):
            continue
        lines.append(f"| {row['component']} | {row['score']} | {row['weight']} | {row['contribution']} |")
    lines += [
        "",
        f"Final confidence from run summary: **{run_summary.get('final_confidence')}%**.",
        "The guardrails correctly prevent an 85% claim because at least one component is far below 0.70.",
        "",
        "## Supplemental Confidence Tiers",
        "| Tier | Confidence | Label | Rationale |",
        "|---|---:|---|---|",
    ]
    for row in tier_rows:
        lines.append(f"| {row['tier']} | {row['confidence_percent']}% | {row['label']} | {row['rationale']} |")
    lines += [
        "",
        "## Supplemental Held-Out Model Checks",
        "Leakage prevention: each split withholds complete artifacts, sites, regions, object classes, formula classes, or length buckets rather than isolated rows when the metadata field is available. Current formula/object metadata is heuristic, so these tests are useful diagnostics rather than final archaeological validation.",
        "",
        "| Split | Model | Folds | LL/token | Improvement vs unigram | Beats unigram |",
        "|---|---|---:|---:|---:|---:|",
    ]
    for row in best_oos:
        lines.append(
            f"| {row['split']} | {row['model']} | {row['folds']} | {row['mean_log_likelihood_per_token']} | "
            f"{row['ll_improvement_over_unigram']} | {row['beats_unigram']} |"
        )
    lines += [
        "",
        "## Adversarial and Falsification Results",
        "| Test | Model | Delta LL/token | Expected | Passed |",
        "|---|---|---:|---|---:|",
    ]
    for row in adversarial_rows:
        lines.append(
            f"| {row['test_name']} | {row['model']} | {row['delta_ll_per_token']} | "
            f"{row['expected_behavior']} | {row['passed']} |"
        )
    lines += [
        "",
        "The previous shuffled-sequence control failed because the winning Phase 5 model is effectively close to a frequency/length model: "
        "if a model does not condition strongly on order, shuffling tokens inside each line does not materially change likelihood. "
        "The supplemental tests therefore score shuffled and corrupted sequences under order-sensitive bigram, trigram, and position models as well.",
        "",
        "## Semantic Anchors",
        "| Anchor | Confidence | Tier | Caveat |",
        "|---|---:|---|---|",
    ]
    for row in anchor_rows:
        lines.append(f"| {row['anchor']} | {row['confidence_percent']}% | {row['tier']} | {row['caveat']} |")
    lines += [
        "",
        "## Is 85% Defensible?",
        "No, not for decipherment and not yet for structural confidence under strict guardrails. The corpus and normalization are strong, "
        "but predictive structure, object/site metadata, semantic anchors, phonetic values, and language-family evidence remain insufficient.",
        "",
        "## Strongest Current Claims",
        "- The corpus is broad enough to test structural hypotheses.",
        "- Strict normalization is relatively stable.",
        "- Some positional/recurrent patterns, especially AB22-like behavior, are worth continued testing.",
        "- Administrative/logogram anchors support functional categories more than lexical readings.",
        "",
        "## Weakest Current Claims",
        "- Broad semantic translation.",
        "- Phonetic values derived from Linear B without independent Linear A confirmation.",
        "- Language-family assignments.",
        "- Any claim that a single 71.36% score represents decipherment certainty.",
        "",
        "## Required Next Phase",
        "1. Add reliable document metadata: site, support, object type, inscription type, and date/period where available.",
        "2. Run true site/object/formula-held-out tests after metadata enrichment.",
        "3. Add a licensed Linear B comparison corpus as a baseline, with Greek/phonetic claims explicitly quarantined.",
        "4. Build expert-reviewed semantic-anchor tables for numerals, commodities, measures, and formulae.",
        "5. Require adversarial tests to degrade for order-sensitive models before considering an 85% structural claim.",
        "",
        "## Files Generated",
        "- `deep_validation_summary.json`",
        "- `strict_model_comparison.csv`",
        "- `adversarial_deep_tests.csv`",
        "- `confidence_tiers.csv`",
        "- `semantic_anchor_inventory.csv`",
        "- `linearA/research/data/source_acquisition_notes.md`",
    ]
    if failed_adv:
        lines += [
            "",
            "## Failed / Ambiguous Falsification Checks",
        ]
        for row in failed_adv[:10]:
            lines.append(f"- {row['test_name']} / {row['model']}: delta {row['delta_ll_per_token']}")
    AUDIT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    canonical_rows = read_csv(OUTPUT_DIR / "phase1_canonical_corpus.csv")
    metadata_rows, metadata_summary = build_metadata(canonical_rows)
    metadata_by_artifact = {str(row["inscription_id"]): row for row in metadata_rows}
    entries: List[Dict[str, object]] = []
    for row in canonical_rows:
        seq = split_sequence(row.get("signs_canonical", ""))
        if not seq:
            continue
        artifact = row.get("artifact_id", "UNKNOWN")
        meta = metadata_by_artifact.get(artifact, {})
        length = len(seq)
        entries.append(
            {
                "artifact_id": artifact,
                "site": meta.get("site_find_place", site_from_artifact(artifact)),
                "region": meta.get("region", region_from_site(site_from_artifact(artifact))),
                "object_class": meta.get("object_type", object_class_from_artifact(artifact)),
                "formula_class": formula_class_for_sequence(seq),
                "length_bucket": "short_1_2" if length <= 2 else "medium_3_4" if length <= 4 else "long_5_plus",
                "sequence": seq,
            }
        )

    split_rows = evaluate_splits(entries)
    adversarial_rows = run_adversarial_tests(entries)
    anchor_rows = build_semantic_anchor_inventory(canonical_rows)
    formula_rows = build_formula_inventory(metadata_rows)
    tier_rows = derive_confidence_tiers(canonical_rows, split_rows, adversarial_rows, anchor_rows)

    write_csv(
        METADATA_DIR / "normalized_inscription_metadata.csv",
        [
            "inscription_id",
            "source_corpus",
            "provenance_source_url",
            "site_find_place",
            "region",
            "object_type",
            "support_material",
            "classification",
            "formula_class",
            "inscription_length",
            "line_count",
            "sign_count",
            "word_count",
            "sign_inventory_used",
            "estimated_date_period",
            "find_context",
            "libation_formula_candidate",
            "accounting_candidate",
            "ideogram_presence",
            "numeral_presence",
            "damage_unreadability_level",
            "confidence_provenance_notes",
        ],
        metadata_rows,
    )
    write_json(METADATA_DIR / "metadata_coverage_summary.json", metadata_summary)
    write_source_registry()

    write_csv(
        OUTPUT_DIR / "strict_model_comparison.csv",
        [
            "split",
            "model",
            "folds",
            "test_lines",
            "test_tokens",
            "mean_log_likelihood_per_token",
            "perplexity",
            "ll_improvement_over_unigram",
            "beats_unigram",
        ],
        split_rows,
    )
    write_csv(
        OUTPUT_DIR / "adversarial_deep_tests.csv",
        [
            "test_name",
            "model",
            "baseline_ll_per_token",
            "perturbed_ll_per_token",
            "delta_ll_per_token",
            "baseline_perplexity",
            "perturbed_perplexity",
            "expected_behavior",
            "passed",
        ],
        adversarial_rows,
    )
    write_csv(
        OUTPUT_DIR / "semantic_anchor_inventory.csv",
        ["anchor_id", "anchor", "evidence_type", "observed_support_count", "confidence_percent", "tier", "caveat"],
        anchor_rows,
    )
    write_json(OUTPUT_DIR / "semantic_anchor_inventory.json", {"anchors": anchor_rows})
    write_csv(
        OUTPUT_DIR / "formula_inventory.csv",
        [
            "formula_class",
            "supporting_inscriptions",
            "sites",
            "dominant_object_type",
            "accounting_candidates",
            "libation_candidates",
            "confidence_percent",
            "classification_basis",
            "counterexamples_or_limits",
        ],
        formula_rows,
    )
    write_csv(
        OUTPUT_DIR / "confidence_tiers.csv",
        ["tier", "confidence_percent", "label", "rationale"],
        tier_rows,
    )
    create_source_notes()
    write_metadata_provenance_report(metadata_summary)
    write_phonetic_claim_audit()
    build_audit(split_rows, adversarial_rows, tier_rows, anchor_rows)

    summary = {
        "generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "entries": len(entries),
        "artifacts": len({row["artifact_id"] for row in entries}),
        "sites": len({row["site"] for row in entries}),
        "object_classes": sorted({row["object_class"] for row in entries}),
        "metadata_summary": metadata_summary,
        "tier_summary": tier_rows,
        "best_strict_models": sorted(
            split_rows,
            key=lambda row: float(row["ll_improvement_over_unigram"]),
            reverse=True,
        )[:8],
        "adversarial_failures": [row for row in adversarial_rows if row["passed"] == "0"],
        "defensible_85": False,
        "defensible_85_reason": "Template predictability, OOS prediction, semantic anchors, phonetic values, and language-family evidence are below high-confidence thresholds.",
    }
    write_json(OUTPUT_DIR / "deep_validation_summary.json", summary)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
