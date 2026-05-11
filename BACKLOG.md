# BACKLOG — studyroom-project-site

> **SSOT for this project's tasks.** Root `BACKLOG.md` is just an aggregator that mirrors this file.
> Read `IN PROGRESS` + `TODO` before starting any new task. On close → move to `DONE` with date and evidence.

---

## IN PROGRESS
- _none_

## TODO

- **Stage 11 — Scraper extension to fill Oxford-style landing fields.** The new per-uni template (`site/src/pages/[slug].astro`) renders 13 sections ported from `studyroom-oxford-landing/`. Sections that the scraper needs to populate (currently rendered as `[TBD]` placeholders or stubbed with derived content):
  - **`description.paragraphs[]`** — short uni biography (year founded, student count, ranking, notable alumni). Scrape from each Kaplan partner page's "About" copy + the official `officialUrl`.
  - **`hero.bgImage`** + **`hero.cover`** — hero photos. Currently the hero shows the logo on a white card. Pull the partner page's main banner image.
  - **`gallery.items[]`** — 3 building/campus photos (the section is hidden today; un-hide once data lands). Same source: Kaplan partner pages.
  - **`dates.items[]`** — per-uni admission deadlines. Today the timeline is a generic UK UCAS cycle from `STUDYROOM_DATES_TIMELINE`. The scraper already pulls per-program ISO deadlines into `u.deadlines`; collapse those into a 4-step timeline.
  - **`accommodation[]`** — name + price + photo per residence. Currently the section is hidden. Source: Kaplan accommodation page if available.
  - **`campuses[]`** — colleges/buildings with photos. Currently hidden. Source: Kaplan partner page + Wikipedia.
  - **`location.{lat,lng,bbox,address}`** — exact coords for OSM/Google embed. Today we use Google Maps name-search embed which is fuzzy. Geocode once via Nominatim.
  - **`reviews[].{thumbnail,videoUrl,text}`** — real testimonials with consent (StudyRoom-side data, not scraped).
  - **`scholarships[]`** — currently empty for all 16. Scrape Kaplan + each uni's official scholarships page.
  - **`requirements.exams[]`** + accurate per-uni IELTS/TOEFL — currently a hardcoded `STANDARD_REQUIREMENTS` (5.5 / 70). Scrape per-uni pathway entry requirements page.
- **Stage 5.1 — Set up Decap OAuth** (manual, ~10 min). Follow `DECAP_OAUTH.md`: register a GitHub OAuth App, deploy `decap-proxy` Worker on Cloudflare, update `site/public/admin/config.yml` `base_url`.
- **Stage 6.1 — Connect Cloudflare Pages** (manual, ~5 min). Follow `DEPLOYMENT.md`: connect repo, build cmd `cd site && npm ci && npm run build`, output `site/dist`, attach custom domain.
- **Stage 5.1 — Set up Decap OAuth** (manual, ~10 min). Follow `DECAP_OAUTH.md`: register a GitHub OAuth App, deploy `decap-proxy` Worker on Cloudflare, update `site/public/admin/config.yml` `base_url`.
- **Stage 6.1 — Connect Cloudflare Pages** (manual, ~5 min). Follow `DEPLOYMENT.md`: connect repo, build cmd `cd site && npm ci && npm run build`, output `site/dist`, attach custom domain.
- **Stage 8 — English version (`/en/...`).** Currently RU-only. Either a `/en` route variant or a runtime toggle.
- **Stage 9 — Replace text wordmark with real StudyRoom SVG logo.** SVG asset exists at `studyroom-oxford-landing/sources/.../logotype_1.svg` (white-fill — needs a dark variant for the light header).
- **Stage 10 — Fill TBD content.** `site/src/content/studyroom/static.ts` has `[TBD: ...]` markers in reviews, about, and CTA contact info. Replace before launch.

## DONE

- 2026-05-11 — Stage 10 (Oxford-style universal landing) — ported 13 sections from `studyroom-oxford-landing/` (hero / benefits / description / programs-by-faculty / dates / activities / requirements + scholarships / important / about / reviews / location / final CTA / footer + chat widget). Shared StudyRoom content lives in `site/src/content/studyroom/static.ts` (extended with `STUDYROOM_DATES_TIMELINE`, `STUDYROOM_FORM`, `STUDYROOM_FOOTER`, `STUDYROOM_CHAT`). Per-uni rewrite uses `site/src/styles/oxford-landing.css` (1414 lines copied verbatim from oxford project) and 4 client-side TS modules in `site/src/scripts/oxford-{reveal,phone-mask,chat,program-card}.ts`. Hero `cover` slot shows the Kaplan logo on a white card (no per-uni hero photos yet — see Stage 11). Programs section groups all programs by faculty (top 6) with expand-to-list interaction matching oxford's `program-card` UX. Forms (inline + final CTA) wired with KZ phone mask + validation. Chat widget hydrates from `STUDYROOM_CHAT`. — evidence: `site/src/pages/[slug].astro` (rewrite), `site/src/styles/oxford-landing.css` (new), `site/src/scripts/oxford-*.ts` (4 new), `site/src/content/studyroom/static.ts` (extended)
- 2026-05-11 — Logos on catalog + per-uni hero — downloaded all 16 Kaplan partner logos to `site/public/logos/{slug}.png` via one-shot `scraper/download-logos.mjs`; replaced green initials boxes in `UniversityCard.astro` (catalog) and `[slug].astro` hero with `<img>` + onerror→initials fallback; updated `.uni-card__logo` and `.uni-hero__logo` styles in `brand.css`/`[slug].astro` to white box with light border + `object-fit: contain`. Verified live at http://localhost:4321/ — all 16 cards now show real logos. — evidence: `scraper/download-logos.mjs`, `site/public/logos/*.png` (16 files), `site/src/components/UniversityCard.astro`, `site/src/styles/brand.css`
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
