# Linear A Research Audit

Generated UTC: 2026-05-08T03:18:25Z

## Scope Reviewed
- LinearA public pages: overview, technical analysis, findings, downloads, tablet pages.
- Research scripts and data under `linearA/research/`.
- Latest generated outputs under `linearA/research/output/latest/`.
- External-source options: SigLA, Younger archive, GORILA, DAMOS Linear B.

## Existing 71.36% Score
The current 71.36% is a weighted structural-confidence score, not translation certainty.

| Component | Score | Weight | Contribution |
|---|---:|---:|---:|
| corpus_adequacy_score | 1.000000 | 0.250000 | 25.000000 |
| normalization_stability_score | 0.977971 | 0.200000 | 19.559429 |
| template_predictability_score | 0.226389 | 0.200000 | 4.527772 |
| out_of_sample_performance_score | 0.500000 | 0.200000 | 10.000000 |
| adversarial_robustness_score | 0.818014 | 0.150000 | 12.270207 |

Final confidence from run summary: **71.36%**.
The guardrails correctly prevent an 85% claim because at least one component is far below 0.70.

## Supplemental Confidence Tiers
| Tier | Confidence | Label | Rationale |
|---|---:|---|---|
| corpus_adequacy_confidence | 99.00% | high | Corpus is broad enough for structure tests; metadata depth is still incomplete. |
| normalization_confidence | 95.16% | high | Strict mapping is stable, but unreadable signs and variants still limit certainty. |
| structural_script_confidence | 67.03% | medium | Order-sensitive models show some signal, but not enough for high-confidence decipherment. |
| template_predictability_confidence | 22.64% | very low | Directly inherited from the current Phase 5 template component. |
| out_of_sample_prediction_confidence | 49.35% | low | Supplemental held-out splits compared against a frequency-only null. |
| semantic_anchor_confidence | 50.33% | medium | Anchors are mostly administrative/functional, not lexical proof. |
| phonetic_value_confidence | 18.00% | very low | Linear B comparison remains indirect; AB labels are not phonetic evidence by themselves. |
| word_meaning_confidence | 32.00% | low | A few formulae are plausible, but broad lexical translation is unsupported. |
| language_family_confidence | 8.00% | very low | No implemented comparative language-family test supports a family assignment. |
| overall_structural_confidence | 71.52% | medium-high | Best current estimate for structural regularity, separate from decipherment. |
| overall_decipherment_confidence | 30.77% | low | Conservative combined estimate for actual decipherment/translation confidence. |

## Supplemental Held-Out Model Checks
Leakage prevention: each split withholds complete artifacts, sites, regions, object classes, formula classes, or length buckets rather than isolated rows when the metadata field is available. Current formula/object metadata is heuristic, so these tests are useful diagnostics rather than final archaeological validation.

| Split | Model | Folds | LL/token | Improvement vs unigram | Beats unigram |
|---|---|---:|---:|---:|---:|
| formula_class_held_out | bigram_markov | 6 | -6.570523 | 0.150423 | 1 |
| artifact_held_out | bigram_markov | 244 | -5.519666 | 0.145720 | 1 |
| object_class_held_out | position_by_length_template | 5 | -5.924169 | 0.145697 | 1 |
| artifact_held_out | position_by_length_template | 244 | -5.530681 | 0.134705 | 1 |
| region_held_out | position_by_length_template | 6 | -5.964765 | 0.095302 | 1 |
| formula_class_held_out | position_by_length_template | 6 | -6.639499 | 0.081447 | 1 |

## Adversarial and Falsification Results
| Test | Model | Delta LL/token | Expected | Passed |
|---|---|---:|---|---:|
| within_line_shuffle | null_unigram_frequency | 0.000000 | small_change_expected_for_frequency_only_null | 1 |
| random_20pct_token_corruption | null_unigram_frequency | 0.002658 | small_change_expected_for_frequency_only_null | 1 |
| length_preserving_frequency_sample | null_unigram_frequency | 0.014017 | small_change_expected_for_frequency_only_null | 1 |
| global_label_permutation_scored_against_original | null_unigram_frequency | -2.420747 | should_degrade_if_sign_identity_matters | 1 |
| within_line_shuffle | bigram_markov | -0.758149 | should_degrade_for_order_sensitive_models | 1 |
| random_20pct_token_corruption | bigram_markov | -0.438590 | should_degrade_moderately | 1 |
| length_preserving_frequency_sample | bigram_markov | -1.266329 | should_degrade_strongly | 1 |
| global_label_permutation_scored_against_original | bigram_markov | -2.227654 | should_degrade_if_sign_identity_matters | 1 |
| within_line_shuffle | trigram_markov | -0.919638 | should_degrade_for_order_sensitive_models | 1 |
| random_20pct_token_corruption | trigram_markov | -0.455845 | should_degrade_moderately | 1 |
| length_preserving_frequency_sample | trigram_markov | -1.207819 | should_degrade_strongly | 1 |
| global_label_permutation_scored_against_original | trigram_markov | -2.128498 | should_degrade_if_sign_identity_matters | 1 |
| within_line_shuffle | position_by_length_template | -0.566711 | should_degrade_for_order_sensitive_models | 1 |
| random_20pct_token_corruption | position_by_length_template | -0.192187 | should_degrade_moderately | 1 |
| length_preserving_frequency_sample | position_by_length_template | -0.882623 | should_degrade_strongly | 1 |
| global_label_permutation_scored_against_original | position_by_length_template | -2.419678 | should_degrade_if_sign_identity_matters | 1 |

The previous shuffled-sequence control failed because the winning Phase 5 model is effectively close to a frequency/length model: if a model does not condition strongly on order, shuffling tokens inside each line does not materially change likelihood. The supplemental tests therefore score shuffled and corrupted sequences under order-sensitive bigram, trigram, and position models as well.

## Semantic Anchors
| Anchor | Confidence | Tier | Caveat |
|---|---:|---|---|
| Numeric fields and tallies | 72.0% | moderate | Quantity columns recur, but numeric interpretation is structural rather than lexical. |
| GRA/OLE/VINA/FIC/OLIV and related logograms | 62.0% | moderate | Commodity labels are plausible where logograms are explicit; they do not identify surrounding word meanings. |
| KU RO as possible total formula | 58.0% | moderate | Traditionally discussed as 'total'; still treated here as a functional anchor, not full translation. |
| AB22 in 4-sign sequences | 54.0% | low | Strong positional behavior, but the sign could be lexical rather than a divider. |
| Libation/offering table formulae | 34.0% | low | Requires object/formula metadata not fully represented in current normalized corpus. |
| Potential proper names | 22.0% | low | No controlled onomastic test is implemented yet. |

## Is 85% Defensible?
No, not for decipherment and not yet for structural confidence under strict guardrails. The corpus and normalization are strong, but predictive structure, object/site metadata, semantic anchors, phonetic values, and language-family evidence remain insufficient.

## Strongest Current Claims
- The corpus is broad enough to test structural hypotheses.
- Strict normalization is relatively stable.
- Some positional/recurrent patterns, especially AB22-like behavior, are worth continued testing.
- Administrative/logogram anchors support functional categories more than lexical readings.

## Weakest Current Claims
- Broad semantic translation.
- Phonetic values derived from Linear B without independent Linear A confirmation.
- Language-family assignments.
- Any claim that a single 71.36% score represents decipherment certainty.

## Required Next Phase
1. Add reliable document metadata: site, support, object type, inscription type, and date/period where available.
2. Run true site/object/formula-held-out tests after metadata enrichment.
3. Add a licensed Linear B comparison corpus as a baseline, with Greek/phonetic claims explicitly quarantined.
4. Build expert-reviewed semantic-anchor tables for numerals, commodities, measures, and formulae.
5. Require adversarial tests to degrade for order-sensitive models before considering an 85% structural claim.

## Files Generated
- `deep_validation_summary.json`
- `strict_model_comparison.csv`
- `adversarial_deep_tests.csv`
- `confidence_tiers.csv`
- `semantic_anchor_inventory.csv`
- `linearA/research/data/source_acquisition_notes.md`
