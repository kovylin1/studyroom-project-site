# StudyRoom — Universities Scraper

Fetches partner-university data from Kaplan Pathways (and future sources) and writes per-uni JSONs validated by the shared `University` Zod schema. Output lands in `../site/src/content/universities/{slug}.json` and feeds the Astro catalog.

## Run

```bash
cd scraper
npm install
npm run scrape -- --slug glasgow            # one university
npm run scrape -- --all                     # all rows in sources/universities.list.md
npm run scrape -- --slug glasgow --dry-run  # parse but don't write
```

## What v0 does

- Fetches Kaplan main university page (e.g. `/where-to-study/uk-universities/university-of-glasgow/`).
- Extracts `sourceHash` (SHA-256 of HTML, first 16 hex), `lastChecked`, attempts description prose + hero image.
- **Preserves** existing programs / tuition / deadlines / requirements / scholarships in the JSON — only refreshes scrape-verifiable fields.
- Validates the merged record against `schema.ts` (mirror of `site/src/schema/university.ts`) before writing.

## What v0 does NOT do

| Field | Why missing | Path forward |
|---|---|---|
| Programs list | Lives in JS-rendered `/degree-finder/#/...` SPA | Add Playwright in v1 |
| Tuition + intakes | On separate `/where-to-study/{college}/fees-and-dates/` page | Add second fetch + parser in v1 |
| Entry requirements | On global `/how-to-apply/entry-requirements/uk/` page | Fetch once, apply across UK unis |
| Scholarships | Mixed across uni page + Kaplan college page | Selector tuning in v1 |

For now: hand-curate the missing fields in `site/src/content/universities/{slug}.json`; scraper preserves them.

## Scheduled run

`.github/workflows/scrape-monthly.yml` runs `npm run scrape -- --all` on the 1st of each month at 03:00 UTC and opens a PR with the diff. Manager reviews via Decap CMS at `/admin`.
