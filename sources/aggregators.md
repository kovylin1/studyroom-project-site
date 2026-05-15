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

## `navitas-pathways`

- **Base URL:** `https://www.navitas.com/`
- **Catalog index:** `https://www.navitas.com/study/colleges-campuses/` (flat list of all pathway colleges grouped by destination country)
- **Per-destination page pattern:** `https://www.navitas.com/study/destinations/{country}/` (curated partner shortlist per country — AU, CA, DE, ID, NL, NZ, SG, LK, AE, UK, USA)
- **University-mapping note:** Navitas runs a *pathway college* per partner university on its own brand domain (e.g. `curtincollege.edu.au`, `deakincollege.edu.au`, `griffithcollege.edu.au`). We list the **parent university** (Curtin, Deakin, …) in `universities.list.md` and use the pathway-college URL as the `aggregator_url`.
- **Rendering:** static HTML for college landing/intro/fees pages. No SPA observed across the AU pathway colleges sampled (2026-05-15).
- **Data spread across sub-pages (typical per pathway college):**
  - `/` → name, hero image, intro paragraph, partner university name + crest
  - `/courses/` or `/programs/` → degree list with Foundation/Diploma/Bachelor pathways
  - `/fees/` → tuition (AUD per year on AU colleges, CAD on CA, EUR on DE, etc.)
  - `/entry-requirements/` → IELTS/PTE/TOEFL minima per pathway
  - `/accommodation/` → 1-2 partnered halls or homestay options
- **Auth required:** no
- **Rate limits / anti-bot:** none observed in initial 10-request sample
- **What it provides reliably:** parent uni name, country/city, hero photo, English-language intro prose, pathway program list with intakes, baseline IELTS, Navitas Loyalty Bursary scholarship
- **What it misses or is hard to scrape:** per-degree tuition for the parent university (Navitas only publishes pathway-college fees), real-time intake deadlines (rolling intakes only)
- **ToS notes:** robots.txt permissive; partner-college sites carry standard "all rights reserved" — same posture as Kaplan
- **Confidence tier in our schema:** `aggregator` (Navitas pathway data trumps third-party, but for parent-uni degrees we should cross-check the official uni site)

## `oxford-international`

- **Base URL:** `https://www.oxfordinternational.com/`
- **Catalog index:** `https://www.oxfordinternationaleducationgroup.com/services/academic-partnerships/`
- **NOT the same as University of Oxford** — Oxford International Education Group (OIEG) is a UK-based pathway aggregator (like Kaplan / Navitas). Their flagship "Oxford International" name is unrelated to the actual University of Oxford. The real University of Oxford takes only direct admissions and is in the catalog as the separate `oxford` entry (tier `partner`).
- **Pathway centres:** Oxford + London (UK) + Halifax (Canada, "University College Pathway")
- **Per-destination page pattern:**
  - UK partners → typically `https://www.oxfordinternational.com/partner/{college-or-uni-slug}/`
  - Canada partners → `https://www.oxfordinternationalenglish.com/courses/halifax-university-college-pathways/`
- **Rendering:** static HTML on partner pages. Main domain `oxfordinternational.com` returns HTTP 403 to WebFetch user-agents — use real browser or `curl` with proper UA when fetching. Sub-domains `oxfordinternationaleducationgroup.com`, `oxfordinternationalenglish.com`, `oicolleges.com` are more permissive.
- **Data spread across sub-pages (per partner):**
  - Partner page → name, hero, pathway entry requirements, English level needed
  - Parent uni's own site → real Bachelor / Master programs, tuition (varies by country)
- **Auth required:** no
- **Rate limits / anti-bot:** Cloudflare 403 on main domain for unknown UAs
- **What it provides reliably:** Foundation / Pre-Master entry routes, English-pathway placement, Halifax UCP for Atlantic Canada
- **What it misses or is hard to scrape:** per-program tuition for partner uni degrees (only pathway fees published)
- **ToS notes:** robots.txt permissive; partner colleges' own sites carry standard "all rights reserved"
- **Confidence tier in our schema:** `aggregator`
- **Known partners (2026-05-15):**
  - UK (8 partners we track): University of Kent · University of Dundee · Ulster University · University of Bradford · Abertay University · Bangor University · De Montfort University · University of Greenwich. Plus dupes already in catalog via Kaplan: University of Birmingham (`birmingham`), University of Glasgow (`glasgow`)
  - Canada Halifax UCP (9 degree-granting partners): Saint Mary's · Dalhousie · NSCAD · Mount Saint Vincent · St. Francis Xavier · Acadia · Mount Allison · University of Prince Edward Island · Memorial University of Newfoundland
  - USA (1 partner): San Francisco State University
  - Australia (1 partner — already in catalog via Navitas): Edith Cowan University (`edith-cowan`)


