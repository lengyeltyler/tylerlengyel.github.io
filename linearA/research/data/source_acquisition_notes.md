# Linear A Source Acquisition Notes

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
