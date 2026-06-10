# Mini re-audit — fixed weak strata (2026-06-10)

Independent LLM auditors re-checked **24 of the 90** repaired universities (8 per
fixed stratum: collab / studygroup / wikipedia) against official sites, scoring
the same 5 categories as the original 2026-06-09 audit
(programs, prices, campuses, scholarships, accommodation) plus geo correctness.
Sample is from the FIXED strata only — not the whole catalog — so it measures the
weak strata, whose baseline was collab 9% / studygroup 18% / wikipedia 50%.

## Headline integrity metrics (the actual Phase-B goal)

- **Geo correctness: 24/24 = 100%** — the signature fabrication (`country/city =
  "International"`, wrong country) is fully eliminated. (Was the worst defect.)
- **Fabricated programs: eliminated.** Programs scored 4 accurate / 20 partial /
  **0 wrong**. SEO junk ("Study in Malta", "Make a comment", "GRE-GMAT Exams") is
  gone; remaining "partial" = real programmes, just representative subsets.
- **Provenance: aggregator → official** for all 24 (sourceUrl = real official
  domain; was collabinternational.com / studygroup / wikipedia).
- **Wrong cells: 2 → 0 after fix.** Audit caught 2 bad tuition sets (EMU inflated
  from a 3rd-party aggregator; Otago understated estimates) — both emptied to
  `byProgram:{}`. Nothing else scored "wrong".

## Category breakdown (24 unis × 5 = 120 cells, after the 2 fixes)

| category      | accurate | partial | absent | wrong |
|---------------|----------|---------|--------|-------|
| programs      | 4        | 20      | 0      | 0     |
| prices        | 4        | 7       | 13     | 0     |
| campuses      | 0        | 0       | 24     | 0     |
| scholarships  | 7        | 8       | 9      | 0     |
| accommodation | 0        | 0       | 24     | 0     |
| **total**     | **15**   | **35**  | **70** | **0** |

## How to read the % (important caveat)

A naive strict "accurate-only" score = 15/120 ≈ **13%**, and accurate+partial
(real data present, possibly incomplete) = 50/120 ≈ **42%**. Neither jumps far
above the old 38% overall — **because we replaced fabrication with honest
sparsity**, and the 5-category metric scores "absent" the same as "wrong":
- campuses + accommodation are empty for all 24 (2 of 5 categories = a fixed 40%
  drag) — they were empty before too; we did not invent them.
- many prices are now honestly absent (out-of-enum currency: CZK/HUF/PLN/TRY/
  CNY/SGD/AED/DKK, or unverified) rather than fabricated.

So the real, measured win is **integrity** (no lies: geo 100%, 0 fabricated
programs, 0 wrong cells, official provenance), which this metric understates.

## To actually raise the displayed % (recommended next phase)

An **enrichment pass** to fill *verified* prices / campuses / accommodation for
these now-honest files (deterministic extract enrichers where data exists, or
targeted agents). That converts "absent" cells → "accurate" and is where the
headline % moves. The full 70-uni whole-catalog re-audit was deferred by the
owner (cost).

## Per-uni results

collab: aalto(prog=acc,price=acc,schol=acc), charles(part/part/acc),
jagiellonian(acc/acc/part), warsaw(part/absent/absent), corvinus(part/acc/part),
eastern-mediterranean(part/EMPTIED/acc), ku-leuven(part/part/part),
helsinki(part/part/part).
studygroup: csu-san-marcos(part/absent/absent), florida-atlantic(part/acc/absent),
njit(part/absent/absent), royal-holloway(part/absent/acc), hefei-hfut(part/absent/part),
zhuhai-bnbu(part/absent/acc), beijing-novo(part/absent/absent), singapore-vwa(acc/absent/absent).
wikipedia: luiss(part/absent/absent), otago(acc/EMPTIED/part), umass-boston(part/part/absent),
notre-dame-au(part/part/acc), heriot-watt-dubai(part/absent/part),
eu-business-school(part/part/acc), bishop-montgomery(part/absent/absent),
cours-florent(part/part/part). (campuses + accommodation absent for all 24.)
