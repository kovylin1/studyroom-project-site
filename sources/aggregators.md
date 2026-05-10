# Aggregators — input notes (Stage 0)

> Stage 3 scraper reads this for per-source scraping strategy.
> Aggregator-shaped sources (one site lists many universities) — described per site.

## `kaplan-pathways`

- **Base URL:** `https://www.kaplanpathways.com/`
- **University page pattern:** `https://www.kaplanpathways.com/where-to-study/uk-universities/{slug}/` (UK section)
- **Rendering:** `static` HTML for landing/intro pages (Cheerio works). `js` (Playwright) for `degree-finder/#/...` SPA programs listing.
- **Data spread across sub-pages:**
  - Main uni page → name, hero image, description, key facts (e.g. "Top 10 in the UK"), accommodation link
  - `/where-to-study/{college-slug}/fees-and-dates/` → tuition + intake dates
  - `/how-to-apply/entry-requirements/uk/` → IELTS / requirements (cross-uni page; not per-uni)
  - `/degree-finder/#/search-result?university={id}` → programs (JS-rendered)
  - `/where-to-study/{college-slug}/accommodation/` → accommodation options
- **Auth required:** no
- **Rate limits / anti-bot:** none observed; robots.txt fully permissive (`Disallow:` empty)
- **What it provides reliably:** description prose, accommodation, partner positioning
- **What it misses or is hard to scrape:** structured per-program tuition (only ranges shown), real-time deadlines (intake dates only)
- **ToS notes:** robots.txt permissive; data is partner-shared per StudyRoom × Kaplan agreement
- **Confidence tier in our schema:** `partner` (StudyRoom has contract — Kaplan data trumps third-party sources)
