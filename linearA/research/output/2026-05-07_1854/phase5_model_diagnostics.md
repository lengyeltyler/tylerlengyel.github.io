# Phase 5 Model Bakeoff Diagnostics

## Measurable Predictions
- Model 1 (Syllabary-like): higher positional entropy, weaker fixed templates.
- Model 2 (Logographic + phonetic mix): stronger first-token concentration and stronger local transitions.
- Model 3 (Accounting template): strongest position-conditioned regularity and template dominance.

## Observed Corpus Structural Metrics
- `positional_entropy_norm`: 0.8914
- `first_token_concentration`: 0.0455
- `template_dominance`: 0.0721
- `bigram_predictability`: 0.0410

## Combined Scores
- Syllabary-like structure hypothesis: overall=87.83, ll/token=-5.6709, perplexity=290.32, alignment=76.18 (winner)
- Accounting/notation template hypothesis: overall=78.19, ll/token=-5.5574, perplexity=259.15, alignment=37.68
- Logographic + phonetic mix hypothesis: overall=19.31, ll/token=-7.4808, perplexity=1773.76, alignment=55.18
