# Aggregators — input notes (Stage 0)

> **Fill this before scraper run.** Stage 3 reads this for per-aggregator scraping strategy.
> One section per aggregator site. Aggregators are lowest-confidence sources (used only when partner / official is missing).

## Template — copy per aggregator

### `<aggregator-slug>`

- **Base URL:** `https://example.com/`
- **University page pattern:** e.g. `https://example.com/universities/{slug}` or `?id=N`
- **Rendering:** `static` (Cheerio) | `js` (Playwright) | `blocked` (Firecrawl fallback)
- **Auth required:** yes / no — if yes, how (login, API key, IP region)
- **Rate limits / anti-bot:** (Cloudflare, hCaptcha, simple UA check, none)
- **What it provides reliably:** programs list, tuition, deadlines, requirements, scholarships, photos
- **What it misses or lies about:** (e.g. tuition outdated, no scholarships, no deadlines)
- **ToS notes:** scraping allowed / unclear / forbidden — link to ToS

## Example (replace with real)

### `studyabroad-example-org`

- **Base URL:** `https://www.studyabroad-example.org/`
- **University page pattern:** `https://www.studyabroad-example.org/uni/{slug}`
- **Rendering:** `js` (uses React; needs Playwright)
- **Auth required:** no
- **Rate limits / anti-bot:** simple UA check; rotate UA, 1 req/sec is fine
- **What it provides reliably:** programs, tuition, deadlines
- **What it misses:** scholarships are stubs; requirements only have IELTS/TOEFL
- **ToS notes:** scraping for personal use OK per ToS §4 (link)
