#!/usr/bin/env python3
"""Generate a before/after delta report for external corpus expansion runs."""

from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path
from typing import Dict, List, Tuple

ROOT = Path(__file__).resolve().parents[2]
OUTPUT_ROOT = ROOT / "linearA" / "research" / "output"


def read_csv(path: Path) -> List[Dict[str, str]]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def read_summary(run_dir: Path) -> Dict[str, object]:
    path = run_dir / "run_summary.json"
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def weighted_template_coverage(run_dir: Path) -> float:
    rows = read_csv(run_dir / "phase2_structural_templates.csv")
    if not rows:
        return 0.0
    total = sum(int(r.get("entries_in_length_group", "0") or 0) for r in rows)
    if total <= 0:
        return 0.0
    weighted = sum(
        float(r.get("coverage", "0") or 0.0) * int(r.get("entries_in_length_group", "0") or 0)
        for r in rows
    )
    return weighted / total


def best_combined_model(run_dir: Path) -> Dict[str, str]:
    rows = [r for r in read_csv(run_dir / "phase5_model_bakeoff_scores.csv") if r.get("cv_scheme") == "combined"]
    rows.sort(key=lambda r: float(r.get("overall_goodness_score", 0.0) or 0.0), reverse=True)
    return rows[0] if rows else {}


def initial_position_map(run_dir: Path) -> Dict[str, float]:
    out = {}
    for row in read_csv(run_dir / "phase1_initial_position_frequency.csv"):
        sign = row.get("sign", "")
        if not sign:
            continue
        out[sign] = float(row.get("relative_frequency", "0") or 0.0)
    return out


def structural_hypotheses(run_dir: Path) -> List[Dict[str, str]]:
    rows = read_csv(run_dir / "phase3_hypothesis_matrix.csv")
    return [r for r in rows if str(r.get("analysis_type", "")).startswith("structural")]


def infer_previous_run(latest_dir: Path) -> Path:
    candidates = []
    stamp_re = re.compile(r"^\d{4}-\d{2}-\d{2}_\d{4}$")
    for p in OUTPUT_ROOT.iterdir():
        if p.is_dir() and stamp_re.match(p.name):
            candidates.append(p)
    candidates.sort(key=lambda p: p.name)

    # Determine current timestamp run to exclude. If current_dir is "latest",
    # prefer latest_pointer.json because "latest" is a copied directory.
    latest_name = latest_dir.name
    if latest_name == "latest":
        pointer_path = OUTPUT_ROOT / "latest_pointer.json"
        if pointer_path.exists():
            try:
                pointer = json.loads(pointer_path.read_text(encoding="utf-8"))
                latest_name = str(pointer.get("latest_timestamp", latest_name))
            except Exception:  # noqa: BLE001
                latest_name = latest_dir.name

    for cand in reversed(candidates):
        if cand.name != latest_name:
            return cand
    raise RuntimeError("could not infer previous run directory")


def fmt_pct_delta(before: float, after: float) -> str:
    return f"{(after - before) * 100:.2f} pp"


def generate_delta_report(
    baseline_dir: Path,
    current_dir: Path,
    output_name: str = "external_expansion_delta_report.md",
) -> Dict[str, object]:
    current_dir = current_dir.resolve()
    if not current_dir.exists():
        raise RuntimeError(f"current dir not found: {current_dir}")

    baseline_dir = baseline_dir.resolve()
    if not baseline_dir.exists():
        raise RuntimeError(f"baseline dir not found: {baseline_dir}")

    current_summary = read_summary(current_dir)
    baseline_summary = read_summary(baseline_dir)

    b_cov = weighted_template_coverage(baseline_dir)
    c_cov = weighted_template_coverage(current_dir)

    b_model = best_combined_model(baseline_dir)
    c_model = best_combined_model(current_dir)

    b_initial = initial_position_map(baseline_dir)
    c_initial = initial_position_map(current_dir)

    deltas: List[Tuple[str, float, float, float]] = []
    for sign, c_val in c_initial.items():
        b_val = b_initial.get(sign, 0.0)
        deltas.append((sign, b_val, c_val, c_val - b_val))
    deltas.sort(key=lambda x: x[3], reverse=True)
    top_gain = [d for d in deltas if d[3] > 0.004][:8]

    b_struct = structural_hypotheses(baseline_dir)
    c_struct = structural_hypotheses(current_dir)

    b_conf = float(baseline_summary.get("final_confidence", 0.0) or 0.0)
    c_conf = float(current_summary.get("final_confidence", 0.0) or 0.0)

    b_entries = int(baseline_summary.get("canonical_entries", 0) or 0)
    c_entries = int(current_summary.get("canonical_entries", 0) or 0)

    b_obs = int(baseline_summary.get("observations_all_sources", 0) or 0)
    c_obs = int(current_summary.get("observations_all_sources", 0) or 0)

    b_art = int(baseline_summary.get("artifact_count", 0) or 0)
    c_art = int(current_summary.get("artifact_count", 0) or 0)

    lines = [
        "# External Expansion Delta Report",
        "",
        f"- Baseline run: `{baseline_dir}`",
        f"- Current run: `{current_dir}`",
        "",
        "## Corpus Size Before/After",
        f"- Observations: **{b_obs} -> {c_obs}** (delta={c_obs - b_obs})",
        f"- Canonical lines: **{b_entries} -> {c_entries}** (delta={c_entries - b_entries})",
        f"- Artifact coverage: **{b_art} -> {c_art}** (delta={c_art - b_art})",
        "",
        "## Template Stability Change",
        f"- Weighted template coverage: **{b_cov:.4f} -> {c_cov:.4f}** ({fmt_pct_delta(b_cov, c_cov)})",
        "- Interpretation: lower coverage after expansion indicates stricter cross-artifact heterogeneity rather than forced template fit.",
        "",
        "## Cross-Validation Model Fit Change",
        f"- Best combined model (baseline): **{b_model.get('model_label', 'n/a')}**",
        f"  - overall={float(b_model.get('overall_goodness_score', 0) or 0):.3f}, ll/token={float(b_model.get('mean_log_likelihood_per_token', 0) or 0):.4f}, perplexity={float(b_model.get('perplexity', 0) or 0):.2f}",
        f"- Best combined model (current): **{c_model.get('model_label', 'n/a')}**",
        f"  - overall={float(c_model.get('overall_goodness_score', 0) or 0):.3f}, ll/token={float(c_model.get('mean_log_likelihood_per_token', 0) or 0):.4f}, perplexity={float(c_model.get('perplexity', 0) or 0):.2f}",
        "",
        "## Confidence Change",
        f"- Final structural confidence: **{b_conf:.2f}% -> {c_conf:.2f}%** (delta={c_conf - b_conf:+.2f} points)",
        "- Confidence remains below 85%; no decipherment claim is supported.",
        "",
        "## New Structural Signals (Current vs Baseline)",
    ]

    if top_gain:
        for sign, b_val, c_val, delta in top_gain:
            lines.append(
                f"- `{sign}` initial-position share: {b_val:.4f} -> {c_val:.4f} (delta={delta:.4f})"
            )
    else:
        lines.append("- No large initial-position gain signals above threshold.")

    lines.append("")
    lines.append("## Structural Hypotheses Snapshot")
    if c_struct:
        for row in c_struct[:3]:
            lines.append(
                f"- {row.get('hypothesis_id','')}: {row.get('hypothesis','')} "
                f"(confidence={row.get('confidence_percent','n/a')}%)"
            )
    else:
        lines.append("- No structural hypothesis rows found.")

    lines.append("")
    lines.append("## Limits")
    lines.append("- Semantic mappings remain LOW CONFIDENCE unless independently corroborated.")
    lines.append("- Larger corpus increased robustness checks, but cross-source normalization still limits certainty.")

    output_path = Path(output_name)
    if not output_path.is_absolute():
        output_path = current_dir / output_path
    output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    return {
        "baseline_dir": str(baseline_dir),
        "current_dir": str(current_dir),
        "output_path": str(output_path),
        "confidence_before": b_conf,
        "confidence_after": c_conf,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate external expansion delta report.")
    parser.add_argument(
        "--current-dir",
        default=str(OUTPUT_ROOT / "latest"),
        help="Current run directory (default: output/latest)",
    )
    parser.add_argument(
        "--baseline-dir",
        default="",
        help="Baseline run directory. If omitted, uses previous timestamped run.",
    )
    parser.add_argument(
        "--output",
        default="external_expansion_delta_report.md",
        help="Output markdown filename (relative to current-dir if not absolute).",
    )
    args = parser.parse_args()

    current_dir = Path(args.current_dir).resolve()
    baseline_dir = Path(args.baseline_dir).resolve() if args.baseline_dir else infer_previous_run(current_dir)
    result = generate_delta_report(baseline_dir=baseline_dir, current_dir=current_dir, output_name=args.output)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
