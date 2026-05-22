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

## `qs-topuniversities`

- **Base URL:** `https://www.topuniversities.com/`
- **B2B portal (auth-only):** `https://admissions.qs.com/suite/sites/qs-apply` — Appian-hosted agent CRM. No public data. PDF partner list (Dec 25 2025) was the source of truth for our import.
- **Public catalog:** `https://www.topuniversities.com/universities` — 650+ global partners. **Cloudflare-blocked for plain WebFetch (HTTP 403)** — needs Playwright or browser-realistic UA headers.
- **Rendering:** `js` — SPA-style profile pages. Use Playwright for any per-uni enrichment.
- **Data spread across sub-pages (per uni profile on topuniversities.com):**
  - `/universities/{slug}` → name, country, hero image, "About" prose, rankings strip
  - `/universities/{slug}/programs` → per-program list with level + duration + tuition + intake (when QS has the partner agreement)
  - `/universities/{slug}/scholarships` → scholarships
  - `/find-your-university` → matcher (auth-gated for filters)
  - **Important:** primary data should be pulled from each uni's OWN official site (.edu / .ac.uk / .edu.au / .ac.nz / .ca / etc.) — topuniversities.com is enrichment only.
- **Partner network shape:** mix of Russell Group / Go8 / U15 research unis (Sydney, Adelaide, Drexel, UCL, Trinity College Dublin), mid-tier teaching universities, pathway centres (INTO X, NCUK, Kaplan IC, Fraser IC, Wilfrid Laurier IC, MMU IC, Leeds ISC, LJMU ISC, Manchester IC), high schools / sixth forms (Bath Academy, Bishopstrow, Padworth, Queen Ethelburga's, Cardiff Sixth Form, Kings Bournemouth/Brighton/London/Oxford, etc.), language schools (Stafford House, ES Dubai), and specialised institutes (Hult, Bologna BS, LISAA, Atelier de Sevres, Strate, KEDGE Paris).
- **Auth required:** PDF list — no. Public profile pages — no (but 403-blocked anonymously). Internal CRM — yes.
- **Rate limits / anti-bot:** Cloudflare bot-block on `topuniversities.com` for headless WebFetch user-agents; resolves with real Playwright/Chromium UA. PDF source has none.
- **What it provides reliably:** broad partner list with consistent qsLevel (`university` / `college` / `high-school`) per the PDF's column legend. Profile pages have curated description + rankings + hero shot.
- **What it misses or is hard to scrape:** per-program tuition (highly variable; many show "contact admissions"), real-time deadlines (terms only), pathway-vs-degree fees split. Best filled from the uni's own admissions site.
- **ToS notes:** PDF is partner-distributed by QS. topuniversities.com `robots.txt` permits `/universities/*` crawl with delay.
- **Confidence tier in our schema:** `aggregator` — QS is broad but not a contract partner of StudyRoom. Uni's own .edu site trumps QS data when both available.

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


