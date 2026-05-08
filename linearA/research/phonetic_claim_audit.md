# Phonetic Claim Audit

## Scope
This audit separates editorial AB/A sign labels from actual phonetic evidence.

## Findings
| Claim | Source basis | Evidence | Counterargument | Confidence | Linear B dependency |
|---|---|---|---|---:|---|
| AB/A sign labels are phonetic values | Modern sign catalog labels | Useful standard identifiers | Catalog numbering is not phonetic evidence | 5% | no |
| Some Linear A signs may share Linear B phonetic values | Homomorphic sign comparison | Linear A is graphically ancestral/related to Linear B | Homomorphy does not guarantee homophony; language differs | 18% | yes |
| Approximate readings can be attempted for homomorphic signs | Linear B comparison and scholarly convention | Some signs are argued to be homophones | Applies only to subset and remains disputed | 22% | yes |
| Linear A language family can be inferred from current corpus | None in current pipeline | No implemented comparative test | No bilingual, lexicon, or grammar proof | 8% | no |

## Operational Rule
The pipeline must treat phonetic values as comparison hypotheses, never as confirmed Linear A readings. AB labels remain grapheme identifiers unless independently justified.
