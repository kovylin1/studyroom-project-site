# Universities — Kaplan partners (Stage 0)

> **Sources:**
> - UK (16): https://www.kaplanpathways.com/where-to-study/uk-universities/ (as of 2026-05-10)
> - Canada (2): https://www.kaplanpathways.com/where-to-study/canadian-universities/ (as of 2026-05-11)
> - USA (5): https://www.kaplanpathways.com/where-to-study/us-universities/ (as of 2026-05-12)
> - Australia (3): https://www.kaplanpathways.com/where-to-study/australian-universities/ (as of 2026-05-12)
> - New Zealand (1): https://www.kaplanpathways.com/where-to-study/new-zealand-universities/ (as of 2026-05-12)
>
> Stage 3 scraper reads this file via `--all`. Slug must be URL-friendly (lowercase, hyphens, ASCII).
>
> Tier semantics (becomes `confidence` on each University record):
> - `aggregator` — data scraped via Kaplan's degree-finder feed / fees-and-dates page.
> - `official` — data scraped directly from the university's own site (Adelaide, Murdoch, Newcastle-AU, Massey).
> - `partner` — reserved for StudyRoom direct-contract data (none yet).

| slug | name | country | city | tier | official_url | aggregator_url(s) | notes |
|---|---|---|---|---|---|---|---|
| asu-london | ASU London | United Kingdom | London | aggregator | https://asulondon.ac.uk/ | https://www.kaplanpathways.com/where-to-study/uk-universities/asu-london/ | Arizona State University satellite campus |
| bournemouth | Bournemouth University | United Kingdom | Bournemouth | aggregator | https://www.bournemouth.ac.uk/ | https://www.kaplanpathways.com/where-to-study/uk-universities/bournemouth-university/ | |
| city-london | City St George's, University of London | United Kingdom | London | aggregator | https://www.city.ac.uk/ | https://www.kaplanpathways.com/where-to-study/uk-universities/city-university-of-london/ | Merger 2024 |
| cranfield | Cranfield University | United Kingdom | Cranfield | aggregator | https://www.cranfield.ac.uk/ | https://www.kaplanpathways.com/where-to-study/uk-universities/cranfield-university/ | Postgraduate-only |
| nottingham-trent | Nottingham Trent University | United Kingdom | Nottingham | aggregator | https://www.ntu.ac.uk/ | https://www.kaplanpathways.com/where-to-study/uk-universities/nottingham-trent-university/ | |
| queen-mary-london | Queen Mary University of London | United Kingdom | London | aggregator | https://www.qmul.ac.uk/ | https://www.kaplanpathways.com/where-to-study/uk-universities/queen-mary-university-of-london/ | Russell Group |
| birmingham | University of Birmingham | United Kingdom | Birmingham | aggregator | https://www.birmingham.ac.uk/ | https://www.kaplanpathways.com/where-to-study/uk-universities/university-of-birmingham/ | Russell Group |
| brighton | University of Brighton | United Kingdom | Brighton | aggregator | https://www.brighton.ac.uk/ | https://www.kaplanpathways.com/where-to-study/uk-universities/university-of-brighton/ | |
| bristol | University of Bristol | United Kingdom | Bristol | aggregator | https://www.bristol.ac.uk/ | https://www.kaplanpathways.com/where-to-study/uk-universities/university-of-bristol/ | Russell Group |
| essex | University of Essex | United Kingdom | Colchester | aggregator | https://www.essex.ac.uk/ | https://www.kaplanpathways.com/where-to-study/uk-universities/university-of-essex/ | |
| glasgow | University of Glasgow | United Kingdom | Glasgow | aggregator | https://www.gla.ac.uk/ | https://www.kaplanpathways.com/where-to-study/uk-universities/university-of-glasgow/ | Russell Group |
| liverpool | University of Liverpool | United Kingdom | Liverpool | aggregator | https://www.liverpool.ac.uk/ | https://www.kaplanpathways.com/where-to-study/uk-universities/university-of-liverpool/ | Russell Group |
| nottingham | University of Nottingham | United Kingdom | Nottingham | aggregator | https://www.nottingham.ac.uk/ | https://www.kaplanpathways.com/where-to-study/uk-universities/university-of-nottingham/ | Russell Group |
| westminster | University of Westminster | United Kingdom | London | aggregator | https://www.westminster.ac.uk/ | https://www.kaplanpathways.com/where-to-study/uk-universities/university-of-westminster/ | |
| york | University of York | United Kingdom | York | aggregator | https://www.york.ac.uk/ | https://www.kaplanpathways.com/where-to-study/uk-universities/university-of-york/ | Russell Group |
| uwe-bristol | UWE Bristol | United Kingdom | Bristol | aggregator | https://www.uwe.ac.uk/ | https://www.kaplanpathways.com/where-to-study/uk-universities/uwe-bristol/ | Univ. of West of England |
| alberta | University of Alberta | Canada | Edmonton | aggregator | https://www.ualberta.ca/ | https://www.kaplanpathways.com/where-to-study/canadian-universities/university-of-alberta/ | Top 5 Canadian university, U15 group |
| victoria | University of Victoria | Canada | Victoria | aggregator | https://www.uvic.ca/ | https://www.kaplanpathways.com/where-to-study/canadian-universities/university-of-victoria/ | British Columbia, on Vancouver Island |
| arizona-state | Arizona State University | United States | Phoenix | aggregator | https://www.asu.edu/ | https://www.kaplanpathways.com/where-to-study/us-universities/arizona-state-university/ | #1 in USA for innovation (US News). Main Tempe/Phoenix campus, separate from asu-london satellite |
| pace | Pace University | United States | New York | aggregator | https://www.pace.edu/ | https://www.kaplanpathways.com/where-to-study/us-universities/pace-university/ | Lower Manhattan + Westchester campuses |
| simmons | Simmons University | United States | Boston | aggregator | https://www.simmons.edu/ | https://www.kaplanpathways.com/where-to-study/us-universities/simmons-university/ | Women's undergrad focus; co-ed graduate programs |
| uconn | University of Connecticut | United States | Storrs | aggregator | https://uconn.edu/ | https://www.kaplanpathways.com/where-to-study/us-universities/university-of-connecticut/ | Public R1, AAU member |
| oregon | University of Oregon | United States | Eugene | aggregator | https://www.uoregon.edu/ | https://www.kaplanpathways.com/where-to-study/us-universities/university-of-oregon/ | Pacific Northwest flagship |
| adelaide | Adelaide University | Australia | Adelaide | official | https://www.adelaide.edu.au/ | https://www.kaplanpathways.com/where-to-study/australian-universities/adelaide-university/ | Post-2026 merger of Univ. of Adelaide + UniSA |
| murdoch | Murdoch University | Australia | Perth | official | https://www.murdoch.edu.au/ | https://www.kaplanpathways.com/where-to-study/australian-universities/murdoch-university/ | Western Australia, veterinary + media schools |
| newcastle-au | University of Newcastle, Australia | Australia | Newcastle | official | https://www.newcastle.edu.au/ | https://www.kaplanpathways.com/where-to-study/australian-universities/university-of-newcastle/ | New South Wales; -au suffix to disambiguate future UK Newcastle |
| massey | Massey University | New Zealand | Auckland | official | https://www.massey.ac.nz/ | https://www.kaplanpathways.com/where-to-study/new-zealand-universities/massey-university/ | Auckland + Manawatu + Wellington campuses |
| curtin | Curtin University | Australia | Perth | aggregator | https://www.curtin.edu.au/ | https://www.navitas.com/study/destinations/australia/, https://www.curtincollege.edu.au/ | Navitas-AU; WA, ATN group, mining + engineering |
| deakin | Deakin University | Australia | Melbourne | aggregator | https://www.deakin.edu.au/ | https://www.navitas.com/study/destinations/australia/, https://www.deakincollege.edu.au/ | Navitas-AU; VIC, Melbourne + Geelong + Warrnambool campuses |
| edith-cowan | Edith Cowan University | Australia | Perth | aggregator | https://www.ecu.edu.au/ | https://www.navitas.com/study/destinations/australia/, https://www.edithcowancollege.edu.au/ | Navitas-AU; WA, performing arts + nursing focus |
| griffith | Griffith University | Australia | Brisbane | aggregator | https://www.griffith.edu.au/ | https://www.navitas.com/study/destinations/australia/, https://www.griffithcollege.edu.au/ | Navitas-AU; QLD, Brisbane + Gold Coast |
| la-trobe | La Trobe University | Australia | Melbourne | aggregator | https://www.latrobe.edu.au/ | https://www.navitas.com/study/destinations/australia/, https://www.latrobecollegeaustralia.edu.au/ | Navitas-AU; VIC, top-10 Australia; Melbourne + Sydney campuses |
| western-sydney | Western Sydney University | Australia | Sydney | aggregator | https://www.westernsydney.edu.au/ | https://www.navitas.com/study/destinations/australia/, https://internationalcollege.westernsydney.edu.au/ | Navitas-AU; NSW, Parramatta + Sydney City Campus + SIBT |
| sydney | The University of Sydney | Australia | Sydney | aggregator | https://www.sydney.edu.au/ | https://www.navitas.com/study/destinations/australia/, https://www.taylorssydney.edu.au/ | Navitas-AU; NSW, Go8, sandstone uni — Taylors College pathway |
| canberra | University of Canberra | Australia | Canberra | aggregator | https://www.canberra.edu.au/ | https://www.navitas.com/study/destinations/australia/, https://www.canberra.edu.au/uc-college | Navitas-AU; ACT, capital — UC College pathway |
| charles-sturt | Charles Sturt University | Australia | Bathurst | aggregator | https://www.csu.edu.au/ | https://www.navitas.com/study/destinations/australia/, https://sydneymelbourne.csu.edu.au/ | Navitas-AU; NSW, regional + Sydney/Melbourne campuses |
| acap | ACAP University College | Australia | Sydney | aggregator | https://www.acap.edu.au/ | https://www.navitas.com/study/destinations/australia/, https://www.acap.edu.au/ | Navitas-AU; psychology + counselling specialist; Adelaide/Melbourne/Perth/Sydney |
| sae | SAE University College | Australia | Sydney | aggregator | https://sae.edu.au/ | https://www.navitas.com/study/destinations/australia/, https://sae.edu.au/ | Navitas-AU; creative media — film, audio, animation, games; 6 AU campuses |
| simon-fraser | Simon Fraser University | Canada | Burnaby | aggregator | https://www.sfu.ca/ | https://www.navitas.com/study/destinations/canada/, https://www.fraseric.ca/ | Navitas-CA; BC, often #1 Maclean's comprehensive — FIC pathway |
| manitoba | University of Manitoba | Canada | Winnipeg | aggregator | https://umanitoba.ca/ | https://www.navitas.com/study/destinations/canada/, https://www.icmanitoba.ca/ | Navitas-CA; MB, U15 research, oldest in Western Canada (1877) — ICM pathway |
| toronto-met | Toronto Metropolitan University | Canada | Toronto | aggregator | https://www.torontomu.ca/ | https://www.navitas.com/study/destinations/canada/, https://www.torontomuic.ca/ | Navitas-CA; ON, ex-Ryerson (renamed 2022), downtown Toronto — TMUIC pathway |
| lethbridge | University of Lethbridge | Canada | Calgary | aggregator | https://www.ulethbridge.ca/ | https://www.navitas.com/study/destinations/canada/, https://www.uicc.ca/ | Navitas-CA; AB, liberal arts + sciences, neuroscience strong — ULIC Calgary pathway |
| western-ontario | Western University | Canada | London | aggregator | https://www.uwo.ca/ | https://www.navitas.com/study/destinations/canada/, https://www.westernic.ca/ | Navitas-CA; ON, U15, Ivey Business School — WIC pathway. `western-ontario` to disambiguate from `western-sydney` |
| wilfrid-laurier | Wilfrid Laurier University | Canada | Waterloo | aggregator | https://www.wlu.ca/ | https://www.navitas.com/study/destinations/canada/, https://www.laurieric.ca/ | Navitas-CA; ON, Lazaridis School of Business — WLIC pathway |

## Stage status

- **In catalog (stub data, MVP):** glasgow, liverpool, bristol, westminster, york, nottingham
- **In list, awaiting scraper:** the remaining 10
- **Scraper to fill:** programs, tuition, deadlines, requirements, scholarships, description, hero image
