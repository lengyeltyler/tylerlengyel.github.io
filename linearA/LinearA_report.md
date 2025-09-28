---
layout: page
title: Linear A — Proto-decipherment Report
permalink: /linearA/LinearA_report
---

# Linear A — Proto-decipherment Report

**Generated:** 2025-09-28

This document aggregates:
- Proto-translations per tablet
- Economy totals
- Commodity ratios and cluster plots
- Brief method and caveats

---

## Method (in brief)

This report is generated from a reproducible pipeline:

1. **Input**: cleaned Linear A sign bigrams per line in `data/clean/*.txt`.
2. **Structure detection**: extract frequent stems (likely commodities) and endings (likely units/measures).
3. **Anchors**: map high-confidence pairs to provisional labels.
4. **Substitution**: produce `outputs/tablets_substituted.csv`.
5. **Volumes & ratios**: convert counts to liters, compute per-tablet shares.
6. **Proto-translations**: render per-tablet readable summaries.

**Caveats**:
- This is a **proto-decipherment**: not phonetic values or full grammar.
- Unknowns appear as `commodity?` and `unit?`.
- Results are strongest where anchors recur consistently.

---

## Tablet-by-tablet proto-translations

### HT10
commodity? in large measure ×32   [low]   (raw: KU-RA2-TA 32)
commodity? in unit? ×2            [low]   (raw: DA-NE 2)
commodity? in large measure ×2    [low]   (raw: KU-RA2-TE 2)
commodity? in large measure ×10   [low]   (raw: KU-RA2-SI 10)
commodity? in large measure ×15   [low]   (raw: KU-RA2-NE 15)
commodity? in large measure ×70   [low]   (raw: KU-RA2 70)

### HT12
oil in small jar ×5               [low]   (raw: OLIV 5)
commodity? in unit? ×8            [low]   (raw: QA+TU 8)
commodity? in large measure ×30   [low]   (raw: QE-TU-NE 30)
commodity? in unit? ×50           [low]   (raw: DA-I 50)
commodity? in unit? ×10           [low]   (raw: MA+RU 10)
commodity? in large measure ×28   [low]   (raw: KU-RA2 28)

### HT13
wineA in amphoraA ×7              [high]  (raw: AB51 AB24 AB22 AB09 7)
grain in big jar ×12              [high]  (raw: AB81 AB02 AB22 AB67 12)
AB04 in amphoraB ×2               [low]   (raw: AB04 AB40 AB22 AB59 2)
oil in small jar ×5               [high]  (raw: AB54 AB67 AB22 AB03 5)

### HT31
oil in small jar ×2               [high]  (raw: AB54 AB67 AB22 AB03 2)
grain in big jar ×10              [high]  (raw: AB81 AB02 AB22 AB67 10)
grain in large measure ×7         [medium](raw: AB81 AB02 AB22 AB28 7)
commodity? in amphoraA ×5         [medium](raw: AB54 AB28 AB22 AB09 5)
wineB in amphoraB ×8              [high]  (raw: AB51 AB45 AB22 AB59 8)
commodity? in unit? ×4            [medium](raw: AB28 AB67 AB22 AB54 4)

### HT7
commodity? in unit? ×2            [low]   (raw: QE-TU-RA 2)
commodity? in unit? ×1            [low]   (raw: KI-RA 1)
commodity? in unit? ×1            [low]   (raw: DA-NA-TU 1)
commodity? in unit? ×1            [low]   (raw: TU-RU-SI 1)
commodity? in unit? ×2            [low]   (raw: TI-RU-SI 2)

### HT8
oil in small jar ×10              [low]   (raw: OLIV+KI 10)
commodity? in unit? ×3            [low]   (raw: PA3 3)
commodity? in unit? ×1            [low]   (raw: SUP+? 1)
commodity? in amphoraA ×5         [low]   (raw: QA-KI 5)
commodity? in unit? ×2            [low]   (raw: KU-RA 2)

### HT95
oil in small jar ×2               [high]  (raw: AB54 AB67 AB22 AB03 2)
grain in big jar ×10              [high]  (raw: AB81 AB02 AB22 AB67 10)

### HT9
wine in amphoraB ×51              [low]   (raw: VIN+TE 51)
wine in amphoraB ×25              [low]   (raw: VIN+TE 25)
wine in amphoraB ×87              [low]   (raw: VIN+TE 87)
wine in amphoraB ×19              [low]   (raw: VIN+TE 19)
wine in amphoraB ×18              [low]   (raw: VIN+TE 18)
wine in amphoraB ×130             [low]   (raw: VIN+TE 130)

### ZA10
prestige? in measure tag ×3       [medium](raw: AB27 AB17 AB22 AB40 3)
prestige? in big jar ×1           [medium](raw: AB04 AB69 AB22 AB67 1)
grain in big jar ×9               [high]  (raw: AB81 AB02 AB22 AB67 9)

---

## Economy totals

| commodity   |   liters |   percent |
|-------------|----------|-----------|
| wine        |     9900 | 66.56%    |
| commodity?  |     2170 | 14.59%    |
| grain       |     2120 | 14.25%    |
| wineB       |      240 | 1.61%     |
| wineA       |      210 | 1.41%     |
| oil         |      120 | 0.81%     |
| link?       |       60 | 0.40%     |
| prestige?   |       53 | 0.36%     |

**Total economy:** 14,873 L

---

## Commodity ratios & clusters

| file     | grain | oil  | wine | cluster | cluster_label     |
|----------|-------|------|------|---------|-------------------|
| HT12     | 0     | 1    | 0    | 0       | grain/oil cluster |
| HT13.txt | 0.719 | 0.03 | 0.25 | 0       | grain/oil cluster |
| HT31.txt | 0.695 | 0.012| 0.293| 0       | grain/oil cluster |
| HT8      | 0     | 1    | 0    | 0       | grain/oil cluster |
| HT9      | 0     | 0    | 1    | 1       | wine cluster      |
| HT95.txt | 0.98  | 0.02 | 0    | 0       | grain/oil cluster |
| ZA10.txt | 1     | 0    | 0    | 0       | grain/oil cluster |

![Commodity share scatter](/assets/linearA/volume_clusters_scatter.png)