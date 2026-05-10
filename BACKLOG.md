# BACKLOG — studyroom-project-site

> **SSOT for this project's tasks.** Root `BACKLOG.md` is just an aggregator that mirrors this file.
> Read `IN PROGRESS` + `TODO` before starting any new task. On close → move to `DONE` with date and evidence.

---

## IN PROGRESS
- _none_

## TODO

- **Stage 4 — Real data on remaining 10 Kaplan unis.** Run `npm run scrape -- --all` once Stage 3.1 below extends the scraper, then hand-curate any TBD fields per uni. Currently 6 of 16 partners have catalog entries.
- **Stage 3.1 — Extend scraper to fetch sub-pages.** Kaplan splits programs into the JS-rendered `/degree-finder/` SPA (needs Playwright) and tuition into `/where-to-study/{college}/fees-and-dates/` (separate fetch). Without these, scraper only refreshes `sourceHash`/`lastChecked`; programs/tuition stay hand-curated.
- **Stage 5.1 — Set up Decap OAuth** (manual, ~10 min). Follow `DECAP_OAUTH.md`: register a GitHub OAuth App, deploy `decap-proxy` Worker on Cloudflare, update `site/public/admin/config.yml` `base_url`.
- **Stage 6.1 — Connect Cloudflare Pages** (manual, ~5 min). Follow `DEPLOYMENT.md`: connect repo, build cmd `cd site && npm ci && npm run build`, output `site/dist`, attach custom domain.
- **Stage 8 — English version (`/en/...`).** Currently RU-only. Either a `/en` route variant or a runtime toggle.
- **Stage 9 — Replace text wordmark with real StudyRoom SVG logo.** SVG asset exists at `studyroom-oxford-landing/sources/.../logotype_1.svg` (white-fill — needs a dark variant for the light header).
- **Stage 10 — Fill TBD content.** `site/src/content/studyroom/static.ts` has `[TBD: ...]` markers in reviews, about, and CTA contact info. Replace before launch.

## DONE

- 2026-05-10 — Stage 7 (cron) — Monthly scraper cron `0 3 1 * *` opens diff PR via `peter-evans/create-pull-request` — `.github/workflows/scrape-monthly.yml`
- 2026-05-10 — Stage 6 (deploy guide) — Cloudflare Pages connection + custom domain step-by-step — `DEPLOYMENT.md`
- 2026-05-10 — Stage 5 (Decap scaffold) — Decap admin at `/admin`, GitHub backend with editorial workflow, full schema fields — `site/public/admin/{index.html,config.yml}` + `DECAP_OAUTH.md`
- 2026-05-10 — Stage 3 (scraper MVP) — `scraper/` workspace with TS + Cheerio + Zod + CLI (`--slug`/`--all`/`--dry-run`), reads `sources/universities.list.md`, writes validated JSONs, preserves hand-curated fields. Verified live on Glasgow + Liverpool — `scraper/{package.json,tsconfig.json,src/{schema.ts,registry.ts,cli.ts,sources/kaplan.ts}}` + `scraper/README.md`
- 2026-05-10 — Stage 2 (per-uni landing redesign) — 9-section Oxford-style landing (hero with logo + facts panel, benefits, programs table, requirements, scholarships, services, FAQ, reviews, about, CTA). Static StudyRoom content extracted to `site/src/content/studyroom/static.ts` — `site/src/pages/[slug].astro` + `site/src/content/studyroom/static.ts`
- 2026-05-10 — Stage 2 (catalog redesign) — Kaplan-finder-style catalog: search-prominent hero, horizontal filter bar with chip-toggle levels + tuition slider + IELTS cap + scholarship-only, branded UniversityCard with green initials-circle "logo" — `site/src/pages/index.astro`, `site/src/components/{Filters,UniversityCard}.astro`, `site/src/styles/brand.css`, `site/src/layouts/Base.astro`, `site/src/scripts/catalog-filters.ts`
- 2026-05-10 — Stage 0 (UK partners locked) — Replaced MIT/Oxford/UCL with 6 Kaplan UK partners (glasgow, liverpool, bristol, westminster, york, nottingham) + filled `sources/universities.list.md` with all 16 Kaplan UK partners + Kaplan profile in `sources/aggregators.md` — `site/src/content/universities/*.json`, `sources/{universities.list.md,aggregators.md}`
- 2026-05-08 — Stage 2 — Astro app + catalog hub + landing template + brand CSS + 3 sample JSONs (oxford, mit, ucl) — `site/astro.config.mjs`, `site/src/content/config.ts`, `site/src/styles/brand.css`, `site/src/layouts/Base.astro`, `site/src/components/{UniversityCard,Filters}.astro`, `site/src/scripts/catalog-filters.ts`, `site/src/pages/{index,[slug]}.astro` (`npm run build`: 4 pages, 4.83s)
- 2026-05-08 — Stage 1 — TS workspace scaffolded + Zod `University` schema ported from `data/university-schema.js` + 7 Vitest cases green — `site/package.json`, `site/tsconfig.json`, `site/src/schema/university.ts`, `site/src/schema/university.test.ts` (`npm test`: 7 passed)
- 2026-05-08 — Stage 0 — Input templates seeded — `sources/universities.list.md`, `sources/aggregators.md`
