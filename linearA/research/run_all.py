#!/usr/bin/env python3
"""Run Linear A research pipeline end-to-end (Phase 1-5) into timestamped output."""

from __future__ import annotations

import argparse
import json
import re
import shutil
from datetime import datetime
from pathlib import Path

from run_linear_a_structural_analysis import (
    DEFAULT_EXTERNAL_CORPUS,
    DEFAULT_VARIANT_MAP,
    run_pipeline,
)
from generate_external_expansion_delta_report import generate_delta_report
from generate_plain_english_report import generate

RESEARCH_DIR = Path(__file__).resolve().parent
OUTPUT_ROOT = RESEARCH_DIR / "output"
STAMP_RE = re.compile(r"^\d{4}-\d{2}-\d{2}_\d{4}$")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run full Linear A pipeline and publish latest outputs.")
    parser.add_argument(
        "--normalization-mode",
        choices=["strict", "permissive", "identity"],
        default="strict",
        help="Normalization mode for primary run.",
    )
    parser.add_argument(
        "--external-corpus",
        default=str(DEFAULT_EXTERNAL_CORPUS),
        help="Path to external corpus CSV.",
    )
    parser.add_argument(
        "--variant-map",
        default=str(DEFAULT_VARIANT_MAP),
        help="Path to variant map CSV.",
    )
    parser.add_argument(
        "--timestamp",
        default="",
        help="Optional fixed timestamp folder name (YYYY-MM-DD_HHMM).",
    )
    return parser.parse_args()


def list_timestamp_run_dirs(current_stamp: str) -> list[Path]:
    candidates = [
        p
        for p in OUTPUT_ROOT.iterdir()
        if p.is_dir() and STAMP_RE.match(p.name) and p.name != current_stamp
    ]
    candidates.sort(key=lambda p: p.name)
    return candidates


def read_external_rows_loaded(run_dir: Path) -> int | None:
    summary_path = run_dir / "run_summary.json"
    if not summary_path.exists():
        return None
    try:
        data = json.loads(summary_path.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return None
    value = data.get("external_rows_loaded")
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def choose_baseline_run_dir(current_stamp: str, current_external_rows: int | None) -> Path | None:
    candidates = list_timestamp_run_dirs(current_stamp)
    if not candidates:
        return None

    if current_external_rows is not None and current_external_rows > 0:
        pre_expansion = [p for p in candidates if read_external_rows_loaded(p) == 0]
        if pre_expansion:
            return pre_expansion[-1]

        reduced_external = []
        for p in candidates:
            ext = read_external_rows_loaded(p)
            if ext is not None and ext < int(current_external_rows * 0.5):
                reduced_external.append(p)
        if reduced_external:
            return reduced_external[-1]

    return candidates[-1]


def main() -> None:
    args = parse_args()

    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    stamp = args.timestamp or datetime.now().strftime("%Y-%m-%d_%H%M")
    run_dir = OUTPUT_ROOT / stamp

    if run_dir.exists():
        shutil.rmtree(run_dir)
    run_dir.mkdir(parents=True, exist_ok=True)

    summary = run_pipeline(
        output_dir=run_dir,
        external_corpus_path=Path(args.external_corpus),
        variant_map_path=Path(args.variant_map),
        normalization_mode=args.normalization_mode,
    )

    baseline_dir = choose_baseline_run_dir(stamp, summary.get("external_rows_loaded"))
    delta_report_status: dict[str, object] = {"baseline_dir": None, "generated": False}
    if baseline_dir is not None:
        try:
            delta_report_status = generate_delta_report(
                baseline_dir=baseline_dir,
                current_dir=run_dir,
                output_name="external_expansion_delta_report.md",
            )
            delta_report_status["generated"] = True
        except Exception as exc:  # noqa: BLE001
            delta_report_status = {
                "baseline_dir": str(baseline_dir),
                "generated": False,
                "error": str(exc),
            }

    generate(run_dir)

    latest_dir = OUTPUT_ROOT / "latest"
    if latest_dir.exists() or latest_dir.is_symlink():
        if latest_dir.is_symlink() or latest_dir.is_file():
            latest_dir.unlink()
        else:
            shutil.rmtree(latest_dir)
    shutil.copytree(run_dir, latest_dir)

    pointer = {
        "latest_timestamp": stamp,
        "latest_path": str(latest_dir),
        "normalization_mode": args.normalization_mode,
        "final_confidence": summary.get("final_confidence"),
        "threshold_85_reached": summary.get("threshold_85_reached"),
        "delta_report_generated": bool(delta_report_status.get("generated")),
        "baseline_dir": delta_report_status.get("baseline_dir"),
    }
    (OUTPUT_ROOT / "latest_pointer.json").write_text(json.dumps(pointer, indent=2), encoding="utf-8")

    out = {
        "run_dir": str(run_dir),
        "latest_dir": str(latest_dir),
        "summary": summary,
        "delta_report": delta_report_status,
    }
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
