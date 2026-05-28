# StudyRoom Catalog Enrichment — Task Hierarchy (Design Spec)

- **Date:** 2026-05-28
- **Status:** Architecture approved. Phase 1 (ПАУК) to implement first.
- **Hard rule:** NEVER delete catalog entries (`site/src/content/universities/*.json`). Enrich only.

## Goal
Reorganize enrichment of the 804 existing university pages into a hierarchical, scriptable task system, eventually driven from the manager UI (`/manager`).

## Principle
The org-chart ("bosses/subordinates") is a metaphor for orchestration + UX. Implementation = **deterministic Node orchestrator scripts, $0 LLM at run time**. Collectors write to *extracts*; directors *merge* extracts into the catalog. (Decision: orchestrator scripts, not LLM agents.)

## Roles (3-level hierarchy)
`Director > Verifier > Collectors`
- **Director** (one per domain): orchestrates collectors → verifier → merge.
- **Verifier** (ШМЕЛЬ-role, one PER domain): official-site ground truth; runs on gap/conflict unis first.
- **Collector** (one per aggregator): scrapes one aggregator once → a shared extract consumed by every director whose domain it feeds.

## Domains / Directors
- **ПАУК** → programs: `programs[]`, `tuition.byProgram`, `deadlines`, `scholarships`, `requirements`.
- **БОБР** → `campuses[]` + `accommodation[]`.
- **ОРЁЛ** → photos: `hero`/`gallery`/`photoSets`/`campuses[].img`/`accommodation[].img`. **Runs AFTER ПАУК/БОБР** (photos hang on finished structure). Programs have NO photos.

## Verifiers (one per domain)
- **ШМЕЛЬ** (ПАУК): crawls OFFICIAL sites for programs, reconciles/corrects collector data. Gap/conflict-first. Extends the old РЕВИЗОР (link liveness). Output: `sources/official-extracts/<slug>.json`.
- **БОБР verifier**: official campus/accommodation pages vs aggregators.
- **ОРЁЛ verifier**: photo relevance + quality + dedup (old `orel-photo-quality.mjs`).

## Program merge policy (heart of "near-perfect programs")
- **Dedup key** = normalized `(title + level)` → canonical **program slug** = the schema `slug` AND the join key for `tuition.byProgram` + `deadlines`.
- **Precedence:** official (ШМЕЛЬ) overrides fields; aggregators fill nulls.
- **Provenance** per program: `source`, `verifiedBySite`, `checkedAt`.
- **Currency:** one per uni; normalize if sources differ.
- **Scholarships:** separate dedup by `name`; official overrides.
- **Zod constraint (superRefine):** every key in `tuition.byProgram` and `deadlines` MUST be an existing program slug — the merge engine keeps all three in sync or the build fails.

## Schema changes
Add to `programSchema` (all optional): `source: string`, `verifiedBySite: boolean`, `checkedAt: ISO date`. Mirror in: `scraper/src/schema.ts`, `site/src/content/config.ts`, `scraper/src/validate-unis.ts`.

## Data flow
```
collectors → sources/<src>-extracts/<slug>.json
  → detect-gaps → shmel-worklist (low program count / source conflict)
  → ШМЕЛЬ → sources/official-extracts/<slug>.json
  → merge-programs → catalog programs[] (+ tuition/deadlines/scholarships + provenance)
  → npm run build (Zod-validates) → wrangler deploy (ONLY on explicit "деплой")
```

## Aggregators / collectors (one per aggregator, monthly cadence by day-of-month)
| Day | Aggregator | Codeword | Domains fed | Access | Env vars | Status |
|---|---|---|---|---|---|---|
| 1 | Edvoy | ПЧЕЛА | programs, campus, photos | login | EDVOY_LOGIN/PASS | done |
| 2 | Study Group | МУХА | programs | login (URN D32332) | SG_LOGIN/PASS/URN | paused → resume=API |
| 3 | Kaplan Pathways | kaplan | programs, accom, photos | open | — | scripts exist |
| 4 | CATS Global | cats | programs, photos(Drive) | open | — | exists |
| 5 | Navitas | navitas | programs | open | — | exists |
| 6 | Oxford International | oxfordintl | programs | open | — | exists |
| 7 | QS Apply | qs | programs | login | QS_LOGIN/PASS | exists |
| 8 | iapro portal | iapro | programs (+marketing) | login | IAPRO_LOGIN/PASS | NEW |
| 9 | QA Higher Ed | qahe | programs (+photos) | open + login(materials) | QAHE_LOGIN/PASS | NEW |
| 10 | GEDU | gedu | programs | open? | — | NEW |
| (11) | collabinternational | ВОЛК | programs | open | — | exists |

Credentials live in gitignored `scraper/.env`. Open-access aggregators need none.

## Phasing
- **Phase 1 — ПАУК (programs), start here.** registry + extracts convention + provenance schema + `detect-gaps` + ШМЕЛЬ + `merge-programs`. **First slice:** provenance schema + `merge-programs` over the EXISTING Edvoy extracts → `npm run build` to prove Zod passes, before building the 3 new collectors.
- **Phase 2 — БОБР** (campuses + accommodation), same model.
- **Phase 3 — ОРЁЛ** (photos as own domain with photo-source subordinates).
- **Phase 4 — Manager UI** reads `registry.json` + `detect-gaps`, shows per-domain/per-uni status, triggers tasks.

## Open items (non-blocking)
- **SPEED** codeword → which aggregator (or a 12th)?
- collab/ВОЛК in or out (10 vs 11 aggregators)?
- QA Higher Ed login (assumed elmira email — confirm).

## Cost note
Implementation on **Sonnet** (cheap); script runs are **$0 LLM** (background, quiet mode). Opus only for architecture.
