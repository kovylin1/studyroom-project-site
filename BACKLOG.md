# BACKLOG — studyroom-project-site

> **SSOT for this project's tasks.** Root `BACKLOG.md` is just an aggregator that mirrors this file.
> Read `IN PROGRESS` + `TODO` before starting any new task. On close → move to `DONE` with date and evidence, then sync the root aggregator.
>
> Stage map and approved plan: `C:\Users\molod\.claude\plans\parsed-riding-alpaca.md` (created 2026-05-08).

---

## IN PROGRESS
- _none_

## TODO
- **Stage 0 — Inputs lock-in (BLOCKER for Stage 3).** User to fill `sources/universities.list.md` (table: name | country | official_url | aggregator_url(s) | tier) and `sources/aggregators.md`. Templates seeded.
- **Stage 3 — Scraper MVP.** Separate `scraper/` workspace. Cheerio for partner static HTML, Playwright for aggregator JS-rendered. `normalize.ts` merges sources by ladder partner > official > aggregator and validates via Zod. Claude API + Firecrawl MCP fallbacks. CLI: `npm run scrape -- --slug <x>` and `--all`.
- **Stage 4 — End-to-end on 2–3 universities.** Run scraper on user-supplied MVP set, build catalog + landings, manual QA, Lighthouse ≥ 90 perf / ≥ 95 SEO.
- **Stage 5 — Decap CMS admin.** `/admin` form-editor on top of git, GitHub OAuth.
- **Stage 6 — Cloudflare Pages deploy.** Build cmd `cd site && npm ci && npm run build`. Preview branch first, then `studyroom.kz`.
- **Stage 7 — Monthly cron + diff PR.** `.github/workflows/scrape.yml` `0 3 1 * *`, opens PR with diff body. Optional Telegram changelog.

## DONE
_(format: `YYYY-MM-DD — task — evidence`)_

- 2026-05-08 — Stage 2 — Astro app + catalog hub + landing template + brand CSS + 3 sample JSONs (oxford, mit, ucl) — `site/astro.config.mjs`, `site/src/content/config.ts`, `site/src/styles/brand.css`, `site/src/layouts/Base.astro`, `site/src/components/{UniversityCard,Filters}.astro`, `site/src/scripts/catalog-filters.ts`, `site/src/pages/{index,[slug]}.astro` (`npm run build`: 4 pages, 4.83s)
- 2026-05-08 — Stage 1 — TS workspace scaffolded + Zod `University` schema ported from `data/university-schema.js` + 7 Vitest cases green — `site/package.json`, `site/tsconfig.json`, `site/src/schema/university.ts`, `site/src/schema/university.test.ts` (`npm test`: 7 passed)
- 2026-05-08 — Stage 0 — Input templates seeded — `sources/universities.list.md`, `sources/aggregators.md`
