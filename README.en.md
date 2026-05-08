# StudyRoom — University Parser & Auto-Generated Landings

The «brain» project for StudyRoom: it scrapes data about foreign universities from partner and aggregator sites, normalises everything into a single schema and auto-publishes landings at `studyroom.kz/{slug}`. The whole picture refreshes itself once a month.

Source of the idea and architecture review: `inbox/Site.md` (May 2026).

## Description

For now, this folder is a launchpad: a dashboard that tracks the seven steps from Site.md, the unified `University` schema and a snapshot of the chosen stack. It is not yet the Astro site itself or the scraper — it is the project map that keeps the big picture in view.

## Stack (plan from Site.md)

- **Scraping:** Playwright (TS), Cheerio / got-scraping, Claude API (vision + HTML → JSON via a Zod schema), Firecrawl MCP as a fallback
- **Normalisation:** a single `University` Zod schema, one file per university — `data/universities/{slug}.json`
- **Landings:** Astro, one `[slug].astro` template → N static pages
- **Hosting:** Cloudflare Pages (free, CDN closer to CIS, unlimited traffic)
- **Admin:** Decap CMS, commits edits straight to git
- **Cron:** GitHub Actions monthly → diff → PR → review in Decap → merge → auto-deploy
- **Optional:** Claude writes a «what changed» changelog into the StudyRoom Telegram bot

## Features (stages)

1. Project dashboard (current index.html) — status of the 7 steps from Site.md
2. Unified `University` Zod schema (see `data/university-schema.js`)
3. MVP Playwright scraper — one partner university + one aggregator
4. Astro landing template
5. Decap admin wiring
6. Run on 2–3 universities and scale up
7. GitHub Actions cron for monthly updates

## Layout

```
studyroom-project-site/
├── index.html              # dashboard: stages, stack, risks, open questions
├── styles.css
├── script.js
├── OVERVIEW.md             # project breakdown (session 2026-05-07)
├── sources/
│   └── Site.md             # mirror of inbox/Site.md — architecture source of truth
├── data/
│   ├── architecture.js     # stack and pipeline snapshot from Site.md
│   ├── roadmap.js          # 7 project stages
│   ├── university-schema.js# unified university schema (data shape)
│   ├── risks.js            # 6 risk points
│   └── open-questions.js   # 6 questions to settle before coding
└── README.md / README.en.md
```

## Where to look for what

- **Start reading here** → `OVERVIEW.md`
- **Architecture rationale** → `sources/Site.md`
- **Current status and next steps** → the `index.html` dashboard

## Main trade-off

Astro + Decap is faster, cheaper, better for SEO and easier to automate than Tilda / WordPress. If a marketing person later needs to edit copy without PR plumbing, we will bolt on Payload/Directus (+1 server). While the AI does everything and humans only approve, that is overkill.
