# Universities — input list (Stage 0)

> **Fill this before scraper run.** Stage 3 (`scraper/`) reads this file via `--all`. One row per university.
> Slug must be URL-friendly (lowercase, hyphens, ASCII). It becomes `studyroom.kz/{slug}` and `data/universities/{slug}.json`.
>
> Tier:
> - `partner` — StudyRoom has a contract with this university; data here trumps everything else.
> - `official` — official `.ac.uk` / `.edu` site, no contract.
> - `aggregator` — only third-party listing available (lowest confidence).

| slug | name | country | city | tier | official_url | aggregator_url(s) | notes |
|---|---|---|---|---|---|---|---|
| oxford | University of Oxford | United Kingdom | Oxford | official | https://www.ox.ac.uk/admissions | (fill) | sample row — replace |
| (slug) | (name) | (country) | (city) | partner / official / aggregator | (url) | (url, url) | (anything the scraper should know) |

## How to add a row

1. Pick a slug. Keep it short and stable — it ends up in URLs.
2. Set the **tier** honestly. Partner > official > aggregator is the source-of-truth ladder used by `scraper/src/normalize.ts`.
3. `aggregator_url(s)` may be a comma-separated list if the same university appears on multiple aggregator sites.
4. Use `notes` for anything weird (anti-bot, login wall, requires Russian visa info, etc.).
