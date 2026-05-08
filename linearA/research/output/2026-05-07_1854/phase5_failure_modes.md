# Phase 5 Failure Modes

## Stress Test Summary
- randomized_sign_relabel_per_line: delta log-likelihood = -1.0235 (substantial_degradation)
- cross_corpus_segmentation: delta log-likelihood = -0.3055 (moderate_degradation)
- remove_20pct_external_random: delta log-likelihood = -0.0153 (small_to_moderate_change)
- randomized_sign_relabel_global: delta log-likelihood = 0.0000 (small_change_allowed)
- shuffled_sequence_control: delta log-likelihood = 0.0000 (substantial_degradation)
- normalization_mode_identity: delta log-likelihood = 0.0000 (small_to_moderate_change)
- normalization_mode_permissive: delta log-likelihood = 0.0110 (small_to_moderate_change)
- genre_split_cross_prediction: delta log-likelihood = 1.0065 (moderate_degradation)

## Weak Points
- Largest degradation appears under `randomized_sign_relabel_per_line`; this indicates positional/sequence order is central to current structural fit.
- Current corpus remains limited in artifact diversity; out-of-sample claims should remain provisional.
