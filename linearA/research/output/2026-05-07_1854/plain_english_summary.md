# Linear A — What We've Found (Plain English)

## What is Linear A?
Linear A is an ancient script from Bronze Age Crete. It is still undeciphered.

## What this project does
This repository runs a statistical pipeline to measure sign frequencies, positions, sequence templates, and model stability.
It estimates **structural confidence**, not translation certainty.

## Snapshot
- Corpus lines analyzed: **2593**
- Artifacts covered: **619**
- Final structural confidence: **71.36%**
- 85% threshold reached: **NO**
- Main limiting factors: **component_convergence**
- Best-fitting structural model: **model_1_syllabary_like**

## Corpus Expansion (What Changed)
- No baseline delta file was available in this run folder, so only current-run statistics are shown.

## Strongest Structural Signals
- Positional concentration signals (for example AB22 in specific 4-sign positions) are reproducible in this corpus.
- Recurrent stems and patterned endings appear in multiple artifacts.

## What we can say confidently
- There are repeatable structural regularities in sign order and slot usage.
- Competing models can be ranked with cross-validation and adversarial tests.

## What we cannot claim yet
- We cannot claim deciphered meanings from this dataset alone.
- Any semantic mapping remains **LOW CONFIDENCE** unless independently corroborated.

## Adversarial checks (examples)
- randomized_sign_relabel_global: delta LL 0.000000
- shuffled_sequence_control: delta LL 0.000000
- randomized_sign_relabel_per_line: delta LL -1.023523
- genre_split_cross_prediction: delta LL 1.006517

## How to reproduce
Run: `python3 linearA/research/run_all.py`
Outputs: `linearA/research/output/YYYY-MM-DD_HHMM/` and `linearA/research/output/latest/`
