#!/usr/bin/env python3
"""Generate a plain-English Linear A findings summary from latest pipeline outputs."""

from __future__ import annotations

import argparse
import csv
import json
import re
from html import escape
from pathlib import Path
from typing import Dict, List

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_INPUT_DIR = ROOT / "linearA" / "research" / "output" / "latest"


def read_csv(path: Path) -> List[Dict[str, str]]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def parse_statement(path: Path) -> Dict[str, str]:
    out: Dict[str, str] = {}
    if not path.exists():
        return out
    for line in path.read_text(encoding="utf-8").splitlines():
        if "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k.strip()] = v.strip()
    return out


def parse_delta_report(path: Path) -> Dict[str, str]:
    if not path.exists():
        return {}
    text = path.read_text(encoding="utf-8")
    out: Dict[str, str] = {}

    patterns = {
        "observations": r"Observations:\s+\*\*(\d+)\s*->\s*(\d+)\*\* \(delta=([+\-]?\d+)\)",
        "canonical": r"Canonical lines:\s+\*\*(\d+)\s*->\s*(\d+)\*\* \(delta=([+\-]?\d+)\)",
        "artifacts": r"Artifact coverage:\s+\*\*(\d+)\s*->\s*(\d+)\*\* \(delta=([+\-]?\d+)\)",
        "template_coverage": r"Weighted template coverage:\s+\*\*([0-9.]+)\s*->\s*([0-9.]+)\*\* \(([+\-]?[0-9.]+) pp\)",
        "confidence": r"Final structural confidence:\s+\*\*([0-9.]+)%\s*->\s*([0-9.]+)%\*\* \(delta=([+\-]?[0-9.]+) points\)",
    }

    for key, pattern in patterns.items():
        m = re.search(pattern, text)
        if not m:
            continue
        out[f"{key}_before"] = m.group(1)
        out[f"{key}_after"] = m.group(2)
        out[f"{key}_delta"] = m.group(3)

    best_baseline = re.search(r"Best combined model \(baseline\): \*\*(.+?)\*\*", text)
    best_current = re.search(r"Best combined model \(current\): \*\*(.+?)\*\*", text)
    if best_baseline:
        out["best_model_baseline"] = best_baseline.group(1)
    if best_current:
        out["best_model_current"] = best_current.group(1)

    return out


def fmt_table_html(rows: List[Dict[str, str]], columns: List[str]) -> str:
    if not rows:
        return "<p>No data available.</p>"
    thead = "".join(f"<th>{escape(col)}</th>" for col in columns)
    body_rows = []
    for row in rows:
        tds = "".join(f"<td>{escape(str(row.get(col, '')))}</td>" for col in columns)
        body_rows.append(f"<tr>{tds}</tr>")
    return (
        "<div class='table-wrap'><table><thead><tr>"
        + thead
        + "</tr></thead><tbody>"
        + "".join(body_rows)
        + "</tbody></table></div>"
    )


def build_report(input_dir: Path) -> Dict[str, str]:
    run_summary_path = input_dir / "run_summary.json"
    run_summary = json.loads(run_summary_path.read_text(encoding="utf-8")) if run_summary_path.exists() else {}

    statement = parse_statement(input_dir / "final_confidence_statement.txt")
    delta = parse_delta_report(input_dir / "external_expansion_delta_report.md")
    manifest = read_csv(input_dir / "phase1_corpus_manifest.csv")
    sign_freq = read_csv(input_dir / "phase1_sign_frequency.csv")
    model_rows = [r for r in read_csv(input_dir / "phase5_model_bakeoff_scores.csv") if r.get("cv_scheme") == "combined"]
    model_rows.sort(key=lambda r: float(r.get("overall_goodness_score", 0)), reverse=True)
    conf_rows = read_csv(input_dir / "phase5_confidence_components.csv")
    hypo_rows = read_csv(input_dir / "phase3_hypothesis_matrix.csv")
    adv_rows = read_csv(input_dir / "phase5_adversarial_suite.csv")

    corpus_lines = int(run_summary.get("canonical_entries", 0) or len(manifest))
    artifacts = int(run_summary.get("artifact_count", 0) or len({r.get("artifact_id", "") for r in manifest if r.get("artifact_id")}))
    final_conf = statement.get("FINAL_CONFIDENCE", "n/a")
    threshold = statement.get("THRESHOLD_85_REACHED", "NO")
    limiting = statement.get("LIMITING_FACTORS", "unknown")
    winner_model = run_summary.get("winner_model_id", "n/a")

    structural_signals = []
    for h in hypo_rows:
        if h.get("analysis_type", "").startswith("structural"):
            structural_signals.append(
                {
                    "Signal": h.get("hypothesis", ""),
                    "Support": h.get("statistical_support", ""),
                    "Confidence": f"{h.get('confidence_percent', '')}%",
                }
            )

    top_signs = [f"{r.get('sign', '')} ({r.get('relative_frequency', '')})" for r in sign_freq[:6] if r.get("sign")]

    model_table = [
        {
            "Model": r.get("model_label", ""),
            "Overall": f"{float(r.get('overall_goodness_score', 0)):.2f}",
            "LL/token": f"{float(r.get('mean_log_likelihood_per_token', 0)):.4f}",
            "Perplexity": f"{float(r.get('perplexity', 0)):.2f}",
        }
        for r in model_rows[:3]
    ]

    conf_table = []
    for r in conf_rows:
        comp = r.get("component", "")
        if comp.endswith("SCORE"):
            continue
        try:
            score = float(r.get("score", 0))
            weight = float(r.get("weight", 0))
        except ValueError:
            continue
        conf_table.append(
            {
                "Component": comp.replace("_", " "),
                "Score": f"{score:.3f}",
                "Weight": f"{weight:.2f}",
                "Contribution": f"{(score * weight * 100):.1f}",
            }
        )

    adv_brief = []
    for row in adv_rows:
        test_name = row.get("test_name", "")
        delta_ll = row.get("delta_log_likelihood", "")
        if not test_name:
            continue
        adv_brief.append(f"{test_name}: delta LL {delta_ll}")
        if len(adv_brief) >= 4:
            break

    delta_table: List[Dict[str, str]] = []
    if delta:
        delta_table = [
            {
                "Metric": "Observations",
                "Before": delta.get("observations_before", "n/a"),
                "After": delta.get("observations_after", "n/a"),
                "Change": delta.get("observations_delta", "n/a"),
            },
            {
                "Metric": "Canonical lines",
                "Before": delta.get("canonical_before", "n/a"),
                "After": delta.get("canonical_after", "n/a"),
                "Change": delta.get("canonical_delta", "n/a"),
            },
            {
                "Metric": "Artifact coverage",
                "Before": delta.get("artifacts_before", "n/a"),
                "After": delta.get("artifacts_after", "n/a"),
                "Change": delta.get("artifacts_delta", "n/a"),
            },
            {
                "Metric": "Template coverage",
                "Before": delta.get("template_coverage_before", "n/a"),
                "After": delta.get("template_coverage_after", "n/a"),
                "Change": f"{delta.get('template_coverage_delta', 'n/a')} pp",
            },
            {
                "Metric": "Structural confidence",
                "Before": f"{delta.get('confidence_before', 'n/a')}%",
                "After": f"{delta.get('confidence_after', 'n/a')}%",
                "Change": f"{delta.get('confidence_delta', 'n/a')} points",
            },
        ]

    confidence_direction = "changed"
    if delta.get("confidence_delta"):
        try:
            conf_delta_num = float(delta["confidence_delta"])
            if conf_delta_num > 0:
                confidence_direction = "increased"
            elif conf_delta_num < 0:
                confidence_direction = "decreased"
            else:
                confidence_direction = "stayed flat"
        except ValueError:
            confidence_direction = "changed"

    reproduction_command = "python3 linearA/research/run_all.py"

    md_lines = [
        "# Linear A — What We've Found (Plain English)",
        "",
        "## What is Linear A?",
        "Linear A is an ancient script from Bronze Age Crete. It is still undeciphered.",
        "",
        "## What this project does",
        "This repository runs a statistical pipeline to measure sign frequencies, positions, sequence templates, and model stability.",
        "It estimates **structural confidence**, not translation certainty.",
        "",
        "## Snapshot",
        f"- Corpus lines analyzed: **{corpus_lines}**",
        f"- Artifacts covered: **{artifacts}**",
        f"- Final structural confidence: **{final_conf}**",
        f"- 85% threshold reached: **{threshold}**",
        f"- Main limiting factors: **{limiting}**",
        f"- Best-fitting structural model: **{winner_model}**",
    ]

    if delta:
        md_lines.extend(
            [
                "",
                "## Corpus Expansion (What Changed)",
                f"- Observations: **{delta.get('observations_before', 'n/a')} -> {delta.get('observations_after', 'n/a')}**",
                f"- Canonical lines: **{delta.get('canonical_before', 'n/a')} -> {delta.get('canonical_after', 'n/a')}**",
                f"- Artifact coverage: **{delta.get('artifacts_before', 'n/a')} -> {delta.get('artifacts_after', 'n/a')}**",
                f"- Template coverage: **{delta.get('template_coverage_before', 'n/a')} -> {delta.get('template_coverage_after', 'n/a')}**",
                f"- Structural confidence: **{delta.get('confidence_before', 'n/a')}% -> {delta.get('confidence_after', 'n/a')}%**",
                "",
                "## Why This Matters",
                "- More data helps us test whether patterns are real or just small-sample noise.",
                "- Confidence can go down when methods become stricter; that often means the analysis is more honest, not weaker.",
                f"- In this run, confidence {confidence_direction} after adding cross-source evidence and stronger stress tests.",
            ]
        )
    else:
        md_lines.extend(
            [
                "",
                "## Corpus Expansion (What Changed)",
                "- No baseline delta file was available in this run folder, so only current-run statistics are shown.",
            ]
        )

    md_lines.extend(
        [
            "",
            "## Strongest Structural Signals",
            "- Positional concentration signals (for example AB22 in specific 4-sign positions) are reproducible in this corpus.",
            "- Recurrent stems and patterned endings appear in multiple artifacts.",
            "",
            "## What we can say confidently",
            "- There are repeatable structural regularities in sign order and slot usage.",
            "- Competing models can be ranked with cross-validation and adversarial tests.",
            "",
            "## What we cannot claim yet",
            "- We cannot claim deciphered meanings from this dataset alone.",
            "- Any semantic mapping remains **LOW CONFIDENCE** unless independently corroborated.",
            "",
            "## Adversarial checks (examples)",
        ]
    )
    md_lines.extend([f"- {line}" for line in adv_brief] if adv_brief else ["- No adversarial summary rows found."])
    md_lines.extend(
        [
            "",
            "## How to reproduce",
            f"Run: `{reproduction_command}`",
            "Outputs: `linearA/research/output/YYYY-MM-DD_HHMM/` and `linearA/research/output/latest/`",
        ]
    )

    html = [
        "<section class='pe-report'>",
        "<h1>Linear A - What We've Found (Plain English)</h1>",
        "<p class='lead'>This summary is about structure only. It does not claim semantic decipherment.</p>",
        "<h2>Snapshot</h2>",
        fmt_table_html(
            [
                {"Metric": "Corpus lines analyzed", "Value": str(corpus_lines)},
                {"Metric": "Artifacts covered", "Value": str(artifacts)},
                {"Metric": "Final structural confidence", "Value": final_conf},
                {"Metric": "85% threshold reached", "Value": threshold},
                {"Metric": "Limiting factors", "Value": limiting},
                {"Metric": "Best-fitting model", "Value": winner_model},
            ],
            ["Metric", "Value"],
        ),
    ]

    if delta_table:
        html.extend(
            [
                "<h2>Corpus Expansion (Before vs After)</h2>",
                fmt_table_html(delta_table, ["Metric", "Before", "After", "Change"]),
            ]
        )

    html.extend(
        [
            "<h2>Strongest Structural Signals</h2>",
            fmt_table_html(structural_signals[:5], ["Signal", "Support", "Confidence"]),
            "<h2>Top Signs by Share</h2>",
            "<p>" + ", ".join(escape(x) for x in top_signs) + "</p>" if top_signs else "<p>n/a</p>",
            "<h2>Model Comparison (Top 3)</h2>",
            fmt_table_html(model_table, ["Model", "Overall", "LL/token", "Perplexity"]),
            "<h2>Confidence Components</h2>",
            fmt_table_html(conf_table, ["Component", "Score", "Weight", "Contribution"]),
            "<h2>Why More Data Can Lower Confidence</h2>",
            "<p>More rows improve power, but they also expose mismatches across sources. "
            "When that happens, confidence can decrease because weak assumptions are penalized.</p>",
            "<h2>What We Can and Cannot Claim</h2>",
            "<div class='two-col'>",
            "<div><h3>Can Say</h3><ul><li>Structural templates exist and are testable.</li>"
            "<li>Model rankings can be checked out-of-sample.</li></ul></div>",
            "<div><h3>Cannot Say Yet</h3><ul><li>No confirmed decipherment.</li>"
            "<li>Semantic mappings remain LOW CONFIDENCE.</li></ul></div>",
            "</div>",
            "<h2>How to Reproduce</h2>",
            f"<p><code>{escape(reproduction_command)}</code></p>",
            "<p>Outputs are written to <code>linearA/research/output/YYYY-MM-DD_HHMM/</code> and mirrored to "
            "<code>linearA/research/output/latest/</code>.</p>",
            "</section>",
        ]
    )

    html_full = (
        "<!doctype html><html lang='en'><head><meta charset='utf-8'/>"
        "<meta name='viewport' content='width=device-width, initial-scale=1'/>"
        "<title>Linear A Plain English Summary</title>"
        "<style>"
        "body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f7f4ec;color:#1b1a16;}"
        ".pe-report{max-width:980px;margin:0 auto;padding:24px 20px 48px;line-height:1.6;}"
        ".lead{font-size:1.05rem;color:#50493d;}"
        "h1,h2,h3{line-height:1.25;color:#10100d;}"
        ".table-wrap{overflow:auto;border:1px solid #d8d1c2;border-radius:10px;background:#fff;}"
        "table{width:100%;border-collapse:collapse;min-width:680px;}"
        "th,td{padding:10px 12px;text-align:left;border-bottom:1px solid #ece5d9;vertical-align:top;}"
        "thead th{position:sticky;top:0;background:#f1ebde;font-weight:700;}"
        "tbody tr:nth-child(even){background:#faf7f1;}"
        ".two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px;}"
        "@media (max-width:760px){table{min-width:560px;}.two-col{grid-template-columns:1fr;}}"
        "</style></head><body>"
        + "".join(html)
        + "</body></html>"
    )

    return {
        "markdown": "\n".join(md_lines) + "\n",
        "html": html_full,
    }


def generate(input_dir: Path) -> Dict[str, str]:
    report = build_report(input_dir)
    (input_dir / "plain_english_summary.md").write_text(report["markdown"], encoding="utf-8")
    (input_dir / "plain_english_summary.html").write_text(report["html"], encoding="utf-8")
    return report


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate plain-English summary from latest outputs.")
    parser.add_argument("--input-dir", default=str(DEFAULT_INPUT_DIR), help="Path to output directory to summarize.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    out = generate(Path(args.input_dir))
    print(
        json.dumps(
            {
                "input_dir": str(Path(args.input_dir)),
                "markdown_bytes": len(out["markdown"]),
                "html_bytes": len(out["html"]),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
