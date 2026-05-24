# Catalog gap audit — 2026-05-24

## Overall stats

| Metric | Count | % |
|---|---|---|
| Total universities | 647 | 100% |
| Programs OK (>=30) | 409 | 63% |
| Programs LOW (10-29) | 122 | 19% |
| Programs CRITICAL (<10) | 116 | 18% |
| Campuses MISSING (<3) | 318 | 49% |
| Accommodation MISSING (<3) | 647 | 100% |
| No logo | 86 | 13% |
| No gallery photos | 8 | 1% |
| Gallery thin (<4 photos) | 8 | 1% |
| Campuses without photos | 615 | 95% |
| Accommodation without photos | 0 | 0% |

## Cheap-fix recipes (minimum token cost)

### Programs gap (CRITICAL <10, LOW 10-29)
- Re-run ПАУК v2: `node scraper/expand-programs-v2.mjs --file=<slugs.txt>` (0 LLM tokens, deep crawl)
- For SPA-blocked unis: `node scraper/expand-programs-playwright.mjs --file=<slugs.txt>`
- For QS partners: add subject-specific aggregator scrape
- Cost: $0 LLM, ~30s/uni runtime

### Campuses gap (<3)
- Edvoy merge already ran; for remaining gaps scrape uni `/about/campuses`, `/our-campuses`, `/locations`
- Need new `bobr-campuses.mjs` mirroring accommodation logic (CAMPUS_PATHS array)
- Cost: ~$1 to write + $0 to run

### Accommodation gap (<3)
- БОБЁР already scraped — gaps mean uni site has no `/accommodation` page or non-standard layout
- Manual fallback: add more paths (`/student-life`, `/halls`, `/residential-life`) and re-run
- Cost: $0 (re-run with more paths)

### Photos — university (no logo, no gallery, thin)
- Existing scripts:
  - `node scraper/discover-photos.mjs` (Wikimedia Commons, primary)
  - `node scraper/discover-photos-fallback.mjs` (officialUrl OG / hero, secondary)
  - `node scraper/discover-photos-wikipedia.mjs` (Wikipedia infobox, tertiary)
  - `node scraper/discover-logos.mjs` (apple-touch-icon + og:logo + favicon)
- Cost: $0 LLM, ~1-2h runtime for all 447

### Photos — campuses / accommodation (per-location)
- No existing script targets these. Need new `bobr-photos-locations.mjs`:
  - Per campus / residence: Wikimedia Commons search `<name> + <city>`
  - Fallback: DuckDuckGo image search HTML (no API key)
- Cost: ~$2 to write + $0 to run

## Worst 50 universities (by composite gap score)

| Slug | Country | Progs | Camp | Accom | Gallery | Logo | Score |
|---|---|---|---|---|---|---|---|
| globalu | United Arab Emirates | 3 | 1 | 0 | 0 | N | 165 |
| ifg | United Kingdom | 6 | 1 | 0 | 0 | N | 165 |
| american-collegiate-la | United States | 7 | 1 | 0 | undefined | N | 155 |
| asc-perth | Australia | 8 | 2 | 0 | undefined | N | 155 |
| birmingham-international-collegiate | Canada | 3 | 1 | 0 | undefined | N | 155 |
| bishop-montgomery | United States | 9 | 1 | 0 | undefined | N | 155 |
| bishopstrow | United Kingdom | 9 | 1 | 0 | undefined | N | 155 |
| carmel-catholic | United States | 8 | 1 | 0 | undefined | N | 155 |
| circle-international | United Kingdom | 7 | 1 | 0 | undefined | N | 155 |
| cretin-derham-hall | United States | 7 | 1 | 0 | undefined | N | 155 |
| gilbert-school | United States | 7 | 1 | 0 | undefined | N | 155 |
| imis-paris | France | 3 | 1 | 0 | undefined | N | 155 |
| iqs-barcelona | Spain | 5 | 1 | 0 | undefined | N | 155 |
| justin-siena | United States | 6 | 1 | 0 | undefined | N | 155 |
| language-studies-international | United Kingdom | 1 | 1 | 0 | undefined | N | 155 |
| lci-barcelona | Spain | 5 | 1 | 0 | undefined | N | 155 |
| mater-dei | United States | 8 | 2 | 0 | undefined | N | 155 |
| merrick-prep | Canada | 3 | 1 | 0 | undefined | N | 155 |
| mmu-international-college | United Kingdom | 5 | 1 | 0 | undefined | N | 155 |
| multihexa | Canada | 4 | 1 | 0 | undefined | N | 155 |
| north-broward-prep | United States | 8 | 2 | 0 | undefined | N | 155 |
| padworth | United Kingdom | 6 | 1 | 0 | undefined | N | 155 |
| proed-uk | United Kingdom | 4 | 1 | 0 | undefined | N | 155 |
| red-bank-catholic | United States | 7 | 2 | 0 | undefined | N | 155 |
| rotman-arts-science | Canada | 3 | 1 | 0 | undefined | N | 155 |
| royal-school-surrey | United Kingdom | 3 | 1 | 0 | undefined | N | 155 |
| saint-anthonys | United States | 7 | 1 | 0 | undefined | N | 155 |
| saint-johns-hs | United States | 8 | 1 | 0 | undefined | N | 155 |
| sobey-smu | Canada | 8 | 1 | 0 | undefined | N | 155 |
| swinburne-university-of-technology | Australia | 1 | 1 | 0 | undefined | N | 155 |
| the-university-of-queensland | Australia | 4 | 2 | 0 | undefined | N | 155 |
| village-school | United States | 4 | 1 | 0 | undefined | N | 155 |
| waring-school | United States | 3 | 1 | 0 | undefined | N | 155 |
| wilfrid-laurier-international-college | Canada | 3 | 1 | 0 | undefined | N | 155 |
| windermere-prep | United States | 4 | 1 | 0 | undefined | N | 155 |
| woodside-priory | United States | 3 | 1 | 0 | undefined | N | 155 |
| icn-creactive-business-school | France | 4 | 2 | 0 | 0 | Y | 150 |
| srh-haarlem-university-of-applied-sciences | Netherlands | 4 | 1 | 0 | 0 | Y | 150 |
| abbey-dld-london | United Kingdom | 7 | 2 | 0 | undefined | Y | 140 |
| american-institute-of-applied-sciences-in-switzerland | Switzerland | 7 | 1 | 0 | undefined | Y | 140 |
| atelier-chardon-savard | France | 1 | 1 | 0 | undefined | Y | 140 |
| atilim | Turkey | 4 | 1 | 0 | undefined | Y | 140 |
| australian-institute-of-technical-training | Australia | 8 | 1 | 0 | undefined | Y | 140 |
| australian-performing-arts-conservatory | Australia | 3 | 1 | 0 | undefined | Y | 140 |
| california-institute-of-advanced-management | United States | 1 | 1 | 0 | undefined | Y | 140 |
| canadian-tourism-college | Canada | 5 | 2 | 0 | undefined | Y | 140 |
| cardiff-sixth-form | United Kingdom | 5 | 1 | 0 | undefined | Y | 140 |
| cesar-ritz-colleges | Switzerland | 6 | 2 | 0 | undefined | Y | 140 |
| champittet | Switzerland | 4 | 1 | 0 | undefined | Y | 140 |
| culinary-arts-academy-switzerland | Switzerland | 8 | 1 | 0 | undefined | Y | 140 |

## All universities (compact list, by score)

| Slug | Progs | Camp | Accom | Photos | Score |
|---|---|---|---|---|---|
| globalu | 3 | 1 | 0 | 0 | 165 |
| ifg | 6 | 1 | 0 | 0 | 165 |
| american-collegiate-la | 7 | 1 | 0 | undefined | 155 |
| asc-perth | 8 | 2 | 0 | undefined | 155 |
| birmingham-international-collegiate | 3 | 1 | 0 | undefined | 155 |
| bishop-montgomery | 9 | 1 | 0 | undefined | 155 |
| bishopstrow | 9 | 1 | 0 | undefined | 155 |
| carmel-catholic | 8 | 1 | 0 | undefined | 155 |
| circle-international | 7 | 1 | 0 | undefined | 155 |
| cretin-derham-hall | 7 | 1 | 0 | undefined | 155 |
| gilbert-school | 7 | 1 | 0 | undefined | 155 |
| imis-paris | 3 | 1 | 0 | undefined | 155 |
| iqs-barcelona | 5 | 1 | 0 | undefined | 155 |
| justin-siena | 6 | 1 | 0 | undefined | 155 |
| language-studies-international | 1 | 1 | 0 | undefined | 155 |
| lci-barcelona | 5 | 1 | 0 | undefined | 155 |
| mater-dei | 8 | 2 | 0 | undefined | 155 |
| merrick-prep | 3 | 1 | 0 | undefined | 155 |
| mmu-international-college | 5 | 1 | 0 | undefined | 155 |
| multihexa | 4 | 1 | 0 | undefined | 155 |
| north-broward-prep | 8 | 2 | 0 | undefined | 155 |
| padworth | 6 | 1 | 0 | undefined | 155 |
| proed-uk | 4 | 1 | 0 | undefined | 155 |
| red-bank-catholic | 7 | 2 | 0 | undefined | 155 |
| rotman-arts-science | 3 | 1 | 0 | undefined | 155 |
| royal-school-surrey | 3 | 1 | 0 | undefined | 155 |
| saint-anthonys | 7 | 1 | 0 | undefined | 155 |
| saint-johns-hs | 8 | 1 | 0 | undefined | 155 |
| sobey-smu | 8 | 1 | 0 | undefined | 155 |
| swinburne-university-of-technology | 1 | 1 | 0 | undefined | 155 |
| the-university-of-queensland | 4 | 2 | 0 | undefined | 155 |
| village-school | 4 | 1 | 0 | undefined | 155 |
| waring-school | 3 | 1 | 0 | undefined | 155 |
| wilfrid-laurier-international-college | 3 | 1 | 0 | undefined | 155 |
| windermere-prep | 4 | 1 | 0 | undefined | 155 |
| woodside-priory | 3 | 1 | 0 | undefined | 155 |
| icn-creactive-business-school | 4 | 2 | 0 | 0+L | 150 |
| srh-haarlem-university-of-applied-sciences | 4 | 1 | 0 | 0+L | 150 |
| abbey-dld-london | 7 | 2 | 0 | undefined+L | 140 |
| american-institute-of-applied-sciences-in-switzerland | 7 | 1 | 0 | undefined+L | 140 |
| atelier-chardon-savard | 1 | 1 | 0 | undefined+L | 140 |
| atilim | 4 | 1 | 0 | undefined+L | 140 |
| australian-institute-of-technical-training | 8 | 1 | 0 | undefined+L | 140 |
| australian-performing-arts-conservatory | 3 | 1 | 0 | undefined+L | 140 |
| california-institute-of-advanced-management | 1 | 1 | 0 | undefined+L | 140 |
| canadian-tourism-college | 5 | 2 | 0 | undefined+L | 140 |
| cardiff-sixth-form | 5 | 1 | 0 | undefined+L | 140 |
| cesar-ritz-colleges | 6 | 2 | 0 | undefined+L | 140 |
| champittet | 4 | 1 | 0 | undefined+L | 140 |
| culinary-arts-academy-switzerland | 8 | 1 | 0 | undefined+L | 140 |
| cy-tech-cergy-paris-university | 4 | 1 | 0 | undefined+L | 140 |
| david-game | 7 | 1 | 0 | undefined+L | 140 |
| dea-canadian-college | 8 | 1 | 0 | undefined+L | 140 |
| difc-dublin | 9 | 1 | 0 | undefined+L | 140 |
| doverbroecks | 4 | 1 | 0 | undefined+L | 140 |
| ece-engineering-school | 1 | 1 | 0 | undefined+L | 140 |
| essca-school-of-management | 1 | 1 | 0 | undefined+L | 140 |
| health-sciences-university | 1 | 1 | 0 | undefined+L | 140 |
| him-business-school | 4 | 1 | 0 | undefined+L | 140 |
| humber-polytechnic | 2 | 1 | 0 | undefined+L | 140 |
| iesa-arts-and-culture | 5 | 1 | 0 | undefined+L | 140 |
| institut-francais-de-lhotellerie | 3 | 1 | 0 | undefined+L | 140 |
| istec-business-school | 8 | 1 | 0 | undefined+L | 140 |
| jibc | 9 | 2 | 0 | undefined+L | 140 |
| junia | 9 | 1 | 0 | undefined+L | 140 |
| kaplan-international-college | 6 | 1 | 0 | undefined+L | 140 |
| kennesaw-state-university | 3 | 2 | 0 | undefined+L | 140 |
| koc-turkey | 7 | 1 | 0 | undefined+L | 140 |
| lincoln-bishop-university | 7 | 1 | 0 | undefined+L | 140 |
| marangoni-london | 6 | 1 | 0 | undefined+L | 140 |
| melbourne-city-institute-of-education | 4 | 1 | 0 | undefined+L | 140 |
| new-england-college | 3 | 1 | 0 | undefined+L | 140 |
| oxford-sixth-form | 4 | 1 | 0 | undefined+L | 140 |
| rajiv-gandhi-university-school-of-science-and-technology | 2 | 1 | 0 | undefined+L | 140 |
| rcsi | 7 | 1 | 0 | undefined+L | 140 |
| saba-university-school-of-medicine | 2 | 2 | 0 | undefined+L | 140 |
| sabanci | 6 | 1 | 0 | undefined+L | 140 |
| salem-university | 3 | 1 | 0 | undefined+L | 140 |
| san-pablo-ceu-madrid | 6 | 2 | 0 | undefined+L | 140 |
| sofia-university | 3 | 2 | 0 | undefined+L | 140 |
| southern-illinois-university-edwardsville | 2 | 1 | 0 | undefined+L | 140 |
| st-andrews-cambridge | 6 | 1 | 0 | undefined+L | 140 |
| st-bees | 5 | 1 | 0 | undefined+L | 140 |
| st-matthews-university-school-of-medicine | 3 | 2 | 0 | undefined+L | 140 |
| stover-school | 5 | 1 | 0 | undefined+L | 140 |
| sup-de-pub | 4 | 1 | 0 | undefined+L | 140 |
| the-university-college-of-enterprise-and-administration | 4 | 1 | 0 | undefined+L | 140 |
| thomas-jefferson-university | 1 | 1 | 0 | undefined+L | 140 |
| universidade-europeia | 5 | 2 | 0 | undefined+L | 140 |
| university-of-edinburgh | 2 | 1 | 0 | undefined+L | 140 |
| university-of-massachusetts-amherst | 3 | 1 | 0 | undefined+L | 140 |
| university-of-north-carolina-at-greensboro | 3 | 1 | 0 | undefined+L | 140 |
| university-of-sheffield | 1 | 1 | 0 | undefined+L | 140 |
| university-of-tulsa | 1 | 1 | 0 | undefined+L | 140 |
| vibe-education | 7 | 1 | 0 | undefined+L | 140 |
| washington-university-school-of-law | 6 | 1 | 0 | undefined+L | 140 |
| western-atlantic-university-school-of-medicine | 1 | 1 | 0 | undefined+L | 140 |
| xenion | 7 | 1 | 0 | undefined+L | 140 |
| basis-mclean | 8 | 3 | 0 | undefined | 135 |
| fairmont-prep | 8 | 3 | 0 | undefined | 135 |
| abbey-cambridge | 9 | 5 | 0 | undefined+L | 120 |
| es-dubai | 8 | 4 | 0 | undefined+L | 120 |
| heip-hautes-etudes-internationales-and-politiques | 8 | 5 | 0 | undefined+L | 120 |
| ichm | 8 | 3 | 0 | undefined+L | 120 |
| kings-bournemouth | 7 | 3 | 0 | undefined+L | 120 |
| kings-brighton | 6 | 3 | 0 | undefined+L | 120 |
| kings-london | 9 | 3 | 0 | undefined+L | 120 |
| kings-oxford | 7 | 3 | 0 | undefined+L | 120 |
| lsc-malta | 5 | 5 | 0 | undefined+L | 120 |
| northern-college-ca | 8 | 5 | 0 | undefined+L | 120 |
| queen-ethelburgas | 5 | 3 | 0 | undefined+L | 120 |
| regent-college-london | 9 | 5 | 0 | undefined+L | 120 |
| repton-dubai | 8 | 3 | 0 | undefined+L | 120 |
| srh-international-college | 9 | 3 | 0 | undefined+L | 120 |
| trine-university | 4 | 4 | 0 | undefined+L | 120 |
| windsor | 9 | 4 | 0 | undefined+L | 120 |
| brock | 10 | 1 | 0 | undefined | 85 |
| cctb | 19 | 1 | 0 | undefined | 85 |
| fad-institute-dubai | 15 | 1 | 0 | undefined | 85 |
| icae | 25 | 1 | 0 | undefined | 85 |
| iesa | 12 | 1 | 0 | undefined | 85 |
| jcu-singapore | 26 | 1 | 0 | undefined | 85 |
| kings-hall-college | 16 | 1 | 0 | undefined | 85 |
| queen-mary-malta | 12 | 1 | 0 | undefined | 85 |
| saint-marys | 20 | 1 | 0 | undefined | 85 |
| stirling-rak | 20 | 1 | 0 | undefined | 85 |
| university-of-huddersfield-london | 14 | 1 | 0 | undefined | 85 |
| northtec-tai-tokerau-wananga | 13 | 2 | 0 | 0+L | 80 |
| abat-oliba-barcelona | 28 | 2 | 0 | undefined+L | 70 |
| abbey-manchester | 10 | 1 | 0 | undefined+L | 70 |
| aberystwyth | 12 | 2 | 0 | undefined+L | 70 |
| academy-of-learning-career-college-scarborough | 24 | 1 | 0 | undefined+L | 70 |
| acadia | 20 | 2 | 0 | undefined+L | 70 |
| amity-university-dubai | 28 | 1 | 0 | undefined+L | 70 |
| amsterdam-tech | 11 | 1 | 0 | undefined+L | 70 |
| asu-london | 25 | 1 | 0 | undefined+L | 70 |
| atelier-de-sevres | 12 | 2 | 0 | undefined+L | 70 |
| auckland-institute-of-studies | 29 | 1 | 0 | undefined+L | 70 |
| australian-vocational-training-academy | 16 | 1 | 0 | undefined+L | 70 |
| birkbeck | 29 | 1 | 0 | undefined+L | 70 |
| budapest-university-of-economics-and-business | 10 | 1 | 0 | undefined+L | 70 |
| c3s-business-school | 18 | 1 | 0 | undefined+L | 70 |
| cape-breton-university | 11 | 1 | 0 | undefined+L | 70 |
| cardenal-herrera-valencia | 29 | 2 | 0 | undefined+L | 70 |
| cats-college-china | 14 | 1 | 0 | undefined+L | 70 |
| cct-college-dublin | 13 | 1 | 0 | undefined+L | 70 |
| columbia-college | 17 | 1 | 0 | undefined+L | 70 |
| courtauld | 21 | 1 | 0 | undefined+L | 70 |
| csvpa-china | 10 | 1 | 0 | undefined+L | 70 |
| dave-school | 12 | 1 | 0 | undefined+L | 70 |
| demont-institute-of-management-and-technology | 16 | 1 | 0 | undefined+L | 70 |
| dli-bandung | 28 | 2 | 0 | undefined+L | 70 |
| ecole-management-appliquee | 18 | 2 | 0 | undefined+L | 70 |
| enae | 27 | 1 | 0 | undefined+L | 70 |
| esc-clermont | 10 | 1 | 0 | undefined+L | 70 |
| esce-international-business-school | 10 | 1 | 0 | undefined+L | 70 |
| eurasia-institute | 11 | 1 | 0 | undefined+L | 70 |
| euroinnova | 10 | 2 | 0 | undefined+L | 70 |
| fairleigh-dickinson-university-vancouver | 19 | 1 | 0 | undefined+L | 70 |
| gbs-malta | 26 | 2 | 0 | undefined+L | 70 |
| glion-switzerland | 22 | 2 | 0 | undefined+L | 70 |
| goldey-beacom-college | 14 | 1 | 0 | undefined+L | 70 |
| helvetic-business-school | 14 | 1 | 0 | undefined+L | 70 |
| htmi-international-hotel-and-tourism-institute-switzerland | 14 | 1 | 0 | undefined+L | 70 |
| ibs-international-business-school | 24 | 2 | 0 | undefined+L | 70 |
| ibu-canada | 17 | 1 | 0 | undefined+L | 70 |
| institut-culinaire-france | 10 | 1 | 0 | undefined+L | 70 |
| international-university-of-monaco | 13 | 1 | 0 | undefined+L | 70 |
| iqs-institut-quimic-de-sarria | 11 | 1 | 0 | undefined+L | 70 |
| learn-key-institute | 14 | 2 | 0 | undefined+L | 70 |
| manchester-architecture | 25 | 1 | 0 | undefined+L | 70 |
| marangoni-milan | 24 | 2 | 0 | undefined+L | 70 |
| middlesex-university-mauritius | 22 | 1 | 0 | undefined+L | 70 |
| munich-university-of-digital-technologies-and-applied-scienc | 27 | 1 | 0 | undefined+L | 70 |
| nci-ireland | 16 | 1 | 0 | undefined+L | 70 |
| new-european-college | 11 | 1 | 0 | undefined+L | 70 |
| north-seattle-college | 21 | 1 | 0 | undefined+L | 70 |
| nuova-accademia-di-belle-arti-naba | 13 | 2 | 0 | undefined+L | 70 |
| pihms | 13 | 1 | 0 | undefined+L | 70 |
| porto-business-school | 22 | 1 | 0 | undefined+L | 70 |
| reading | 24 | 2 | 0 | undefined+L | 70 |
| selkirk-college | 10 | 1 | 0 | undefined+L | 70 |
| sf-state | 22 | 2 | 0 | undefined+L | 70 |
| st-georges-grenada | 10 | 2 | 0 | undefined+L | 70 |
| st-michaels-school | 19 | 1 | 0 | undefined+L | 70 |
| suffolk | 29 | 2 | 0 | undefined+L | 70 |
| swiss-hotel-management-school | 12 | 2 | 0 | undefined+L | 70 |
| the-university-of-western-australia | 29 | 1 | 0 | undefined+L | 70 |
| ucam-catholic-university-of-murcia | 22 | 2 | 0 | undefined+L | 70 |
| ucam-murcia | 13 | 2 | 0 | undefined+L | 70 |
| ue-amsterdam | 14 | 2 | 0 | undefined+L | 70 |
| university-of-california-irvine-division-of-continuing-educa | 18 | 1 | 0 | undefined+L | 70 |
| warsaw-business | 20 | 2 | 0 | undefined+L | 70 |
| kcl-online | 16 | 4 | 0 | undefined | 65 |
| new-zealand-management-academies-nzma | 11 | 7 | 0 | undefined | 65 |
| newcastle-college-au | 11 | 3 | 0 | undefined | 65 |
| trebas | 14 | 3 | 0 | undefined | 65 |
| yoobee-college-of-creative-innovation | 17 | 3 | 0 | undefined | 65 |
| cal-state-fullerton | 36 | 1 | 0 | undefined | 55 |
| gonzaga | 46 | 1 | 0 | undefined | 55 |
| into-newton-a-levels | 112 | 1 | 0 | undefined | 55 |
| james-madison | 67 | 2 | 0 | undefined | 55 |
| lincoln-nz | 54 | 1 | 0 | undefined | 55 |
| lynn | 36 | 1 | 0 | undefined | 55 |
| saint-louis-university-madrid | 72 | 1 | 0 | undefined | 55 |
| university-of-nevada-las-vegas | 50 | 1 | 0 | undefined | 55 |
| university-of-north-florida | 155 | 1 | 0 | undefined | 55 |
| westcliff-university | 100 | 1 | 0 | undefined | 55 |
| wollongong-dubai | 41 | 2 | 0 | undefined | 55 |
| 3a-france | 24 | 4 | 0 | undefined+L | 50 |
| aivancity | 23 | 3 | 0 | undefined+L | 50 |
| bath-academy | 20 | 3 | 0 | undefined+L | 50 |
| bpp-university | 29 | 5 | 0 | undefined+L | 50 |
| california-miramar-university | 14 | 3 | 0 | undefined+L | 50 |
| capilano | 13 | 5 | 0 | undefined+L | 50 |
| conestoga-college | 12 | 10 | 0 | undefined+L | 50 |
| cours-florent | 13 | 5 | 0 | undefined+L | 50 |
| curtin-college | 28 | 5 | 0 | undefined+L | 50 |
| durham | 15 | 3 | 0 | undefined+L | 50 |
| esam | 21 | 3 | 0 | undefined+L | 50 |
| eynesbury | 20 | 5 | 0 | undefined+L | 50 |
| fachhochschule-des-mittelstands-fhm-university | 18 | 4 | 0 | undefined+L | 50 |
| fraser-international-college | 11 | 3 | 0 | undefined+L | 50 |
| fresenius-university-of-applied-sciences | 27 | 8 | 0 | undefined+L | 50 |
| goldsmiths | 18 | 3 | 0 | undefined+L | 50 |
| herzing-college | 14 | 5 | 0 | undefined+L | 50 |
| icd-paris | 17 | 3 | 0 | undefined+L | 50 |
| inseec-business-school | 12 | 7 | 0 | undefined+L | 50 |
| into-oklahoma | 24 | 3 | 0 | undefined+L | 50 |
| ism-germany | 20 | 6 | 0 | undefined+L | 50 |
| leeds-isc | 12 | 5 | 0 | undefined+L | 50 |
| les-roches-crans-montana | 23 | 5 | 0 | undefined+L | 50 |
| les-roches-marbella | 23 | 5 | 0 | undefined+L | 50 |
| lisaa | 26 | 9 | 0 | undefined+L | 50 |
| luiss | 25 | 4 | 0 | undefined+L | 50 |
| memorial-nl | 24 | 3 | 0 | undefined+L | 50 |
| mount-allison | 24 | 5 | 0 | undefined+L | 50 |
| ncuk-isc | 16 | 3 | 0 | undefined+L | 50 |
| nebrija | 25 | 5 | 0 | undefined+L | 50 |
| nscad | 26 | 3 | 0 | undefined+L | 50 |
| pascal-cyprus | 10 | 4 | 0 | undefined+L | 50 |
| reach-community-college | 28 | 3 | 0 | undefined+L | 50 |
| schiller-international-university | 13 | 4 | 0 | undefined+L | 50 |
| staffordshire | 26 | 5 | 0 | undefined+L | 50 |
| strate-design | 14 | 4 | 0 | undefined+L | 50 |
| trent | 15 | 5 | 0 | undefined+L | 50 |
| trinity-western | 17 | 5 | 0 | undefined+L | 50 |
| ue-university-of-europe-for-applied-sciences | 29 | 5 | 0 | undefined+L | 50 |
| yamanashi-gakuin | 12 | 3 | 0 | undefined+L | 50 |
| qa-higher-education | 58 | 9 | 0 | 0 | 45 |
| adler | 33 | 1 | 0 | undefined+L | 40 |
| amsterdam | 271 | 2 | 0 | undefined+L | 40 |
| aud | 49 | 1 | 0 | undefined+L | 40 |
| baylor-university | 118 | 1 | 0 | undefined+L | 40 |
| bcit | 134 | 2 | 0 | undefined+L | 40 |
| bologna-business-school | 154 | 1 | 0 | undefined+L | 40 |
| bosworth-independent-school | 57 | 2 | 0 | undefined+L | 40 |
| bournemouth-collegiate-school | 62 | 2 | 0 | undefined+L | 40 |
| brunel | 171 | 2 | 0 | undefined+L | 40 |
| california-baptist-university | 355 | 1 | 0 | undefined+L | 40 |
| canadian-university-dubai | 51 | 1 | 0 | undefined+L | 40 |
| canberra-sydney | 43 | 2 | 0 | undefined+L | 40 |
| cardiff-met | 125 | 2 | 0 | undefined+L | 40 |
| carolina-university | 34 | 1 | 0 | undefined+L | 40 |
| college-of-marin | 67 | 1 | 0 | undefined+L | 40 |
| colorado-state-university | 126 | 1 | 0 | undefined+L | 40 |
| concordia-university-st-paul | 102 | 1 | 0 | undefined+L | 40 |
| constructor | 50 | 1 | 0 | undefined+L | 40 |
| contra-costa-college | 43 | 1 | 0 | undefined+L | 40 |
| crandall-university | 38 | 1 | 0 | undefined+L | 40 |
| curtin-singapore | 67 | 2 | 0 | undefined+L | 40 |
| dallas-baptist-university | 198 | 1 | 0 | undefined+L | 40 |
| depaul | 300 | 2 | 0 | undefined+L | 40 |
| diablo-valley-college | 89 | 2 | 0 | undefined+L | 40 |
| domus-academy | 68 | 2 | 0 | undefined+L | 40 |
| dublin-city-university | 114 | 1 | 0 | undefined+L | 40 |
| east-tennessee-state-university | 298 | 1 | 0 | undefined+L | 40 |
| elmhurst-university | 92 | 1 | 0 | undefined+L | 40 |
| em-normandie-dubai | 58 | 1 | 0 | undefined+L | 40 |
| esic | 94 | 2 | 0 | undefined+L | 40 |
| eu-business-school-switzerland | 71 | 2 | 0 | undefined+L | 40 |
| forest-city-international-school | 32 | 1 | 0 | undefined+L | 40 |
| franklin-college | 54 | 1 | 0 | undefined+L | 40 |
| harrisburg-university-of-science-and-technology | 36 | 2 | 0 | undefined+L | 40 |
| hartwick-college | 41 | 1 | 0 | undefined+L | 40 |
| idea-college | 77 | 1 | 0 | undefined+L | 40 |
| into-city-london | 117 | 1 | 0 | undefined+L | 40 |
| into-exeter | 117 | 1 | 0 | undefined+L | 40 |
| into-lancaster | 152 | 2 | 0 | undefined+L | 40 |
| into-london | 115 | 1 | 0 | undefined+L | 40 |
| into-manchester | 118 | 1 | 0 | undefined+L | 40 |
| into-newcastle | 259 | 2 | 0 | undefined+L | 40 |
| into-queens-belfast | 351 | 2 | 0 | undefined+L | 40 |
| into-stirling | 114 | 1 | 0 | undefined+L | 40 |
| into-stony-brook | 127 | 2 | 0 | undefined+L | 40 |
| into-uea | 486 | 2 | 0 | undefined+L | 40 |
| irvine-valley-college | 116 | 1 | 0 | undefined+L | 40 |
| keck-grad | 59 | 2 | 0 | undefined+L | 40 |
| lasalle-college | 70 | 2 | 0 | undefined+L | 40 |
| leeds-trinity-university | 100 | 2 | 0 | undefined+L | 40 |
| lehigh-university | 99 | 1 | 0 | undefined+L | 40 |
| leicester | 506 | 2 | 0 | undefined+L | 40 |
| limerick | 107 | 2 | 0 | undefined+L | 40 |
| lincoln-uk | 207 | 1 | 0 | undefined+L | 40 |
| liverpool-hope | 184 | 2 | 0 | undefined+L | 40 |
| ljmu-isc | 203 | 1 | 0 | undefined+L | 40 |
| los-medanos-college | 65 | 1 | 0 | undefined+L | 40 |
| loughborough-university | 319 | 2 | 0 | undefined+L | 40 |
| manchester-met | 66 | 2 | 0 | undefined+L | 40 |
| missouri-state-university | 120 | 1 | 0 | undefined+L | 40 |
| mount-saint-vincent-ny | 60 | 2 | 0 | undefined+L | 40 |
| mt-san-antonio-college | 34 | 1 | 0 | undefined+L | 40 |
| munich-business-school | 31 | 2 | 0 | undefined+L | 40 |
| murdoch | 31 | 2 | 0 | undefined+L | 40 |
| new-york-film-academy | 40 | 2 | 0 | undefined+L | 40 |
| niagara-falls | 39 | 2 | 0 | undefined+L | 40 |
| nipissing-university | 61 | 1 | 0 | undefined+L | 40 |
| northeastern-university | 160 | 2 | 0 | undefined+L | 40 |
| nova-southeastern-university | 31 | 2 | 0 | undefined+L | 40 |
| ohio-university | 199 | 1 | 0 | undefined+L | 40 |
| piedmont-virginia-community-college | 32 | 1 | 0 | undefined+L | 40 |
| polimi-gsom | 97 | 2 | 0 | undefined+L | 40 |
| queens-college-cuny | 97 | 1 | 0 | undefined+L | 40 |
| ravensbourne | 103 | 2 | 0 | undefined+L | 40 |
| regents-university-london | 59 | 1 | 0 | undefined+L | 40 |
| rensselaer-polytechnic-institute | 47 | 1 | 0 | undefined+L | 40 |
| rit-dubai | 167 | 2 | 0 | undefined+L | 40 |
| robert-gordon | 227 | 2 | 0 | undefined+L | 40 |
| sacred-heart-university | 58 | 1 | 0 | undefined+L | 40 |
| sae-dubai | 34 | 1 | 0 | undefined+L | 40 |
| san-mateo | 81 | 2 | 0 | undefined+L | 40 |
| san-raffaele | 74 | 1 | 0 | undefined+L | 40 |
| santa-monica-college | 94 | 0 | 0 | undefined+L | 40 |
| simmons | 138 | 2 | 0 | undefined+L | 40 |
| south-seattle-college | 49 | 1 | 0 | undefined+L | 40 |
| southern-cross-university | 35 | 2 | 0 | undefined+L | 40 |
| southern-utah-university | 114 | 2 | 0 | undefined+L | 40 |
| southwest-minnesota-state-university | 97 | 1 | 0 | undefined+L | 40 |
| sprott-carleton | 40 | 1 | 0 | undefined+L | 40 |
| st-francis-xavier | 186 | 2 | 0 | undefined+L | 40 |
| st-josephs-university | 45 | 1 | 0 | undefined+L | 40 |
| st-thomas-university | 31 | 1 | 0 | undefined+L | 40 |
| strathclyde | 615 | 2 | 0 | undefined+L | 40 |
| suny-geneseo | 109 | 2 | 0 | undefined+L | 40 |
| syracuse-university | 55 | 1 | 0 | undefined+L | 40 |
| texas-state-university | 259 | 2 | 0 | undefined+L | 40 |
| the-university-of-akron | 168 | 2 | 0 | undefined+L | 40 |
| the-university-of-scranton | 60 | 1 | 0 | undefined+L | 40 |
| toronto-met | 101 | 2 | 0 | undefined+L | 40 |
| trinity-dublin | 241 | 2 | 0 | undefined+L | 40 |
| troy-university | 101 | 1 | 0 | undefined+L | 40 |
| twente | 74 | 2 | 0 | undefined+L | 40 |
| ua92 | 40 | 1 | 0 | undefined+L | 40 |
| ubi-brussels | 35 | 2 | 0 | undefined+L | 40 |
| ucl | 962 | 2 | 0 | undefined+L | 40 |
| uclan-cyprus | 43 | 1 | 0 | undefined+L | 40 |
| uea | 125 | 2 | 0 | undefined+L | 40 |
| umass-boston | 103 | 2 | 0 | undefined+L | 40 |
| university-at-albany | 106 | 1 | 0 | undefined+L | 40 |
| university-college-dublin | 343 | 1 | 0 | undefined+L | 40 |
| university-of-bridgeport | 43 | 1 | 0 | undefined+L | 40 |
| university-of-cincinnati | 265 | 2 | 0 | undefined+L | 40 |
| university-of-colorado-denver | 181 | 2 | 0 | undefined+L | 40 |
| university-of-huddersfield | 315 | 1 | 0 | undefined+L | 40 |
| university-of-la-verne | 98 | 1 | 0 | undefined+L | 40 |
| university-of-louisville | 58 | 1 | 0 | undefined+L | 40 |
| university-of-massachusetts-lowell | 150 | 2 | 0 | undefined+L | 40 |
| university-of-michigan-flint | 123 | 1 | 0 | undefined+L | 40 |
| university-of-north-carolina-at-wilmington | 186 | 1 | 0 | undefined+L | 40 |
| university-of-northampton | 177 | 1 | 0 | undefined+L | 40 |
| university-of-redlands | 64 | 1 | 0 | undefined+L | 40 |
| university-of-regina | 266 | 1 | 0 | undefined+L | 40 |
| university-of-salford | 60 | 1 | 0 | undefined+L | 40 |
| university-of-west-alabama | 63 | 1 | 0 | undefined+L | 40 |
| upei | 157 | 2 | 0 | undefined+L | 40 |
| utah-tech-university | 81 | 1 | 0 | undefined+L | 40 |
| uvic | 96 | 2 | 0 | undefined+L | 40 |
| vaasa | 37 | 1 | 0 | undefined+L | 40 |
| victoria | 92 | 2 | 0 | undefined+L | 40 |
| vizja-university | 92 | 1 | 0 | undefined+L | 40 |
| weber-state-university | 139 | 2 | 0 | undefined+L | 40 |
| william-paterson-university | 153 | 1 | 0 | undefined+L | 40 |
| abu-dhabi-university | 75 | 3 | 0 | undefined | 35 |
| aut | 31 | 3 | 0 | undefined | 35 |
| avila | 84 | 4 | 0 | undefined | 35 |
| de-montfort | 157 | 5 | 0 | undefined | 35 |
| edith-cowan | 74 | 4 | 0 | undefined | 35 |
| into-partnerships | 598 | 37 | 0 | undefined | 35 |
| james-cook | 34 | 4 | 0 | undefined | 35 |
| kaplan-anz | 36 | 6 | 0 | undefined | 35 |
| lancaster-leipzig | 67 | 5 | 0 | undefined | 35 |
| lim-college | 37 | 5 | 0 | undefined | 35 |
| malvern-international | 37 | 16 | 0 | undefined | 35 |
| new-england-au | 37 | 3 | 0 | undefined | 35 |
| newcastle-uk | 35 | 3 | 0 | undefined | 35 |
| oxford | 212 | 4 | 0 | undefined | 35 |
| rvc | 30 | 4 | 0 | undefined | 35 |
| study-group | 89 | 31 | 0 | undefined | 35 |
| tasmania | 41 | 4 | 0 | undefined | 35 |
| ue-germany | 148 | 6 | 0 | undefined | 35 |
| western-ontario | 108 | 4 | 0 | undefined | 35 |
| wyoming | 33 | 5 | 0 | undefined | 35 |
| srh-hochschule-berlin | 78 | 5 | 0 | 0+L | 30 |
| toi-ohomai-institute-of-technology | 51 | 6 | 0 | 0+L | 30 |
| aberdeen | 105 | 4 | 0 | undefined+L | 20 |
| abertay | 73 | 5 | 0 | undefined+L | 20 |
| acap | 74 | 5 | 0 | undefined+L | 20 |
| adelaide | 541 | 3 | 0 | undefined+L | 20 |
| adelphi | 95 | 6 | 0 | undefined+L | 20 |
| alberta | 168 | 5 | 0 | undefined+L | 20 |
| alexander-college | 31 | 3 | 0 | undefined+L | 20 |
| algoma-university | 45 | 3 | 0 | undefined+L | 20 |
| american-kogod | 128 | 3 | 0 | undefined+L | 20 |
| american-university | 55 | 4 | 0 | undefined+L | 20 |
| anglia-ruskin | 68 | 4 | 0 | undefined+L | 20 |
| apu-malaysia | 158 | 5 | 0 | undefined+L | 20 |
| arden | 119 | 18 | 0 | undefined+L | 20 |
| arizona-state | 395 | 8 | 0 | undefined+L | 20 |
| arizona | 32 | 4 | 0 | undefined+L | 20 |
| ashland | 239 | 3 | 0 | undefined+L | 20 |
| aston | 212 | 3 | 0 | undefined+L | 20 |
| auburn | 440 | 4 | 0 | undefined+L | 20 |
| australia-institute-of-business-and-technology | 37 | 8 | 0 | undefined+L | 20 |
| bangor | 309 | 4 | 0 | undefined+L | 20 |
| bath | 497 | 3 | 0 | undefined+L | 20 |
| bhms | 52 | 3 | 0 | undefined+L | 20 |
| birmingham-city | 326 | 9 | 0 | undefined+L | 20 |
| birmingham-dubai | 155 | 3 | 0 | undefined+L | 20 |
| birmingham | 449 | 4 | 0 | undefined+L | 20 |
| bournemouth | 223 | 4 | 0 | undefined+L | 20 |
| bow-valley | 109 | 5 | 0 | undefined+L | 20 |
| bradford | 184 | 5 | 0 | undefined+L | 20 |
| brighton | 631 | 5 | 0 | undefined+L | 20 |
| bristol | 124 | 3 | 0 | undefined+L | 20 |
| bsbi | 137 | 10 | 0 | undefined+L | 20 |
| buckinghamshire-new-university | 140 | 3 | 0 | undefined+L | 20 |
| cal-lutheran | 73 | 5 | 0 | undefined+L | 20 |
| california-state-university-east-bay | 154 | 4 | 0 | undefined+L | 20 |
| cambridge-education-group | 82 | 13 | 0 | undefined+L | 20 |
| canberra | 79 | 4 | 0 | undefined+L | 20 |
| canterbury-christ-church | 322 | 5 | 0 | undefined+L | 20 |
| canterbury-nz | 101 | 4 | 0 | undefined+L | 20 |
| cardiff | 361 | 4 | 0 | undefined+L | 20 |
| cats-academy-boston | 53 | 5 | 0 | undefined+L | 20 |
| cats-cambridge | 43 | 5 | 0 | undefined+L | 20 |
| ceg-digital | 37 | 4 | 0 | undefined+L | 20 |
| cesi | 57 | 8 | 0 | undefined+L | 20 |
| charles-sturt | 83 | 12 | 0 | undefined+L | 20 |
| chester | 817 | 9 | 0 | undefined+L | 20 |
| city-london | 301 | 7 | 0 | undefined+L | 20 |
| claremont-grad | 71 | 3 | 0 | undefined+L | 20 |
| clark | 95 | 5 | 0 | undefined+L | 20 |
| cleveland-state | 156 | 3 | 0 | undefined+L | 20 |
| college-de-paris | 40 | 5 | 0 | undefined+L | 20 |
| concordia-chicago | 166 | 6 | 0 | undefined+L | 20 |
| coventry | 248 | 9 | 0 | undefined+L | 20 |
| cranfield | 175 | 5 | 0 | undefined+L | 20 |
| csvpa-cambridge | 47 | 3 | 0 | undefined+L | 20 |
| cumbria | 170 | 3 | 0 | undefined+L | 20 |
| curtin | 124 | 6 | 0 | undefined+L | 20 |
| dalhousie | 44 | 3 | 0 | undefined+L | 20 |
| dayton | 150 | 5 | 0 | undefined+L | 20 |
| de-montfort-dubai | 283 | 3 | 0 | undefined+L | 20 |
| deakin | 199 | 8 | 0 | undefined+L | 20 |
| debrecen | 43 | 4 | 0 | undefined+L | 20 |
| derby | 160 | 3 | 0 | undefined+L | 20 |
| drew | 95 | 5 | 0 | undefined+L | 20 |
| drexel | 58 | 4 | 0 | undefined+L | 20 |
| dundee | 337 | 5 | 0 | undefined+L | 20 |
| eaim | 67 | 3 | 0 | undefined+L | 20 |
| edinburgh-napier | 166 | 4 | 0 | undefined+L | 20 |
| edith-cowan-sl | 331 | 5 | 0 | undefined+L | 20 |
| essex | 841 | 4 | 0 | undefined+L | 20 |
| eu-business-school-germany | 82 | 4 | 0 | undefined+L | 20 |
| exeter | 946 | 6 | 0 | undefined+L | 20 |
| fanshawe-college | 133 | 6 | 0 | undefined+L | 20 |
| federation-university | 42 | 4 | 0 | undefined+L | 20 |
| fisher-college | 74 | 5 | 0 | undefined+L | 20 |
| fiu-business | 123 | 4 | 0 | undefined+L | 20 |
| florida-international | 39 | 4 | 0 | undefined+L | 20 |
| fox-temple | 62 | 4 | 0 | undefined+L | 20 |
| galway | 336 | 3 | 0 | undefined+L | 20 |
| gannon | 137 | 4 | 0 | undefined+L | 20 |
| gbs-dubai | 35 | 3 | 0 | undefined+L | 20 |
| gbsb-global | 142 | 5 | 0 | undefined+L | 20 |
| george-mason | 153 | 4 | 0 | undefined+L | 20 |
| georgian-college-of-applied-arts-and-technology | 69 | 7 | 0 | undefined+L | 20 |
| gisma | 94 | 5 | 0 | undefined+L | 20 |
| glasgow | 641 | 6 | 0 | undefined+L | 20 |
| greenwich | 568 | 3 | 0 | undefined+L | 20 |
| griffith-ireland | 193 | 3 | 0 | undefined+L | 20 |
| griffith | 858 | 8 | 0 | undefined+L | 20 |
| guildhouse-school-london | 40 | 5 | 0 | undefined+L | 20 |
| hague | 54 | 5 | 0 | undefined+L | 20 |
| hartford | 205 | 5 | 0 | undefined+L | 20 |
| heriot-watt-dubai | 243 | 5 | 0 | undefined+L | 20 |
| heriot-watt-malaysia | 106 | 4 | 0 | undefined+L | 20 |
| heriot-watt | 105 | 3 | 0 | undefined+L | 20 |
| hertfordshire | 650 | 4 | 0 | undefined+L | 20 |
| hofstra | 233 | 3 | 0 | undefined+L | 20 |
| hull | 71 | 3 | 0 | undefined+L | 20 |
| hult | 52 | 7 | 0 | undefined+L | 20 |
| ibs-budapest | 43 | 3 | 0 | undefined+L | 20 |
| illinois-state | 314 | 3 | 0 | undefined+L | 20 |
| into-slu | 31 | 3 | 0 | undefined+L | 20 |
| into-stirling-uni | 334 | 3 | 0 | undefined+L | 20 |
| ipag | 81 | 4 | 0 | undefined+L | 20 |
| iu-germany | 52 | 5 | 0 | undefined+L | 20 |
| john-cabot | 30 | 4 | 0 | undefined+L | 20 |
| johns-hopkins | 38 | 4 | 0 | undefined+L | 20 |
| kansas | 148 | 4 | 0 | undefined+L | 20 |
| kaplan-business-school | 319 | 20 | 0 | undefined+L | 20 |
| kedge-paris | 32 | 4 | 0 | undefined+L | 20 |
| keele | 233 | 4 | 0 | undefined+L | 20 |
| kent-state-university | 398 | 10 | 0 | undefined+L | 20 |
| kent | 266 | 3 | 0 | undefined+L | 20 |
| kingston-university | 87 | 5 | 0 | undefined+L | 20 |
| la-trobe | 605 | 8 | 0 | undefined+L | 20 |
| lancashire | 437 | 6 | 0 | undefined+L | 20 |
| lancaster-univ | 42 | 5 | 0 | undefined+L | 20 |
| lancaster | 40 | 5 | 0 | undefined+L | 20 |
| leeds-beckett | 220 | 3 | 0 | undefined+L | 20 |
| lethbridge | 75 | 3 | 0 | undefined+L | 20 |
| lipscomb | 74 | 5 | 0 | undefined+L | 20 |
| liu-brooklyn | 89 | 5 | 0 | undefined+L | 20 |
| liu-post | 144 | 5 | 0 | undefined+L | 20 |
| liu | 48 | 4 | 0 | undefined+L | 20 |
| liverpool | 805 | 6 | 0 | undefined+L | 20 |
| london-met | 299 | 4 | 0 | undefined+L | 20 |
| london-south-bank | 196 | 3 | 0 | undefined+L | 20 |
| lsu | 231 | 4 | 0 | undefined+L | 20 |
| macewan | 35 | 5 | 0 | undefined+L | 20 |
| manitoba | 91 | 3 | 0 | undefined+L | 20 |
| marist | 41 | 3 | 0 | undefined+L | 20 |
| massey | 525 | 5 | 0 | undefined+L | 20 |
| media-design-germany | 44 | 3 | 0 | undefined+L | 20 |
| mercer | 30 | 4 | 0 | undefined+L | 20 |
| metropolitan-budapest | 51 | 4 | 0 | undefined+L | 20 |
| miami-oh | 215 | 6 | 0 | undefined+L | 20 |
| middlesex-dubai | 245 | 5 | 0 | undefined+L | 20 |
| monash-university | 182 | 6 | 0 | undefined+L | 20 |
| montclair-state | 141 | 3 | 0 | undefined+L | 20 |
| mount-saint-vincent | 73 | 4 | 0 | undefined+L | 20 |
| murdoch-dubai | 47 | 5 | 0 | undefined+L | 20 |
| murray-state-university | 148 | 6 | 0 | undefined+L | 20 |
| navitas | 488 | 62 | 0 | undefined+L | 20 |
| new-haven | 34 | 4 | 0 | undefined+L | 20 |
| newcastle-au | 315 | 4 | 0 | undefined+L | 20 |
| nicosia-medical | 76 | 4 | 0 | undefined+L | 20 |
| nicosia | 33 | 3 | 0 | undefined+L | 20 |
| nmit-nz | 42 | 3 | 0 | undefined+L | 20 |
| northumbria | 385 | 6 | 0 | undefined+L | 20 |
| notre-dame-au | 70 | 5 | 0 | undefined+L | 20 |
| nottingham-ningbo | 291 | 6 | 0 | undefined+L | 20 |
| nottingham-trent | 334 | 7 | 0 | undefined+L | 20 |
| nottingham | 281 | 5 | 0 | undefined+L | 20 |
| nyit | 79 | 4 | 0 | undefined+L | 20 |
| ontario-tech | 62 | 5 | 0 | undefined+L | 20 |
| oregon-state | 365 | 5 | 0 | undefined+L | 20 |
| oregon | 72 | 4 | 0 | undefined+L | 20 |
| otago | 609 | 8 | 0 | undefined+L | 20 |
| oxford-brookes | 213 | 5 | 0 | undefined+L | 20 |
| oxford-international-college | 95 | 16 | 0 | undefined+L | 20 |
| pace | 164 | 3 | 0 | undefined+L | 20 |
| pacific | 128 | 4 | 0 | undefined+L | 20 |
| palm-beach-atlantic | 57 | 5 | 0 | undefined+L | 20 |
| plymouth | 454 | 3 | 0 | undefined+L | 20 |
| portsmouth | 356 | 5 | 0 | undefined+L | 20 |
| psb-paris | 176 | 3 | 0 | undefined+L | 20 |
| queen-mary-london | 390 | 8 | 0 | undefined+L | 20 |
| reading-malaysia | 388 | 4 | 0 | undefined+L | 20 |
| rmit-university | 238 | 3 | 0 | undefined+L | 20 |
| roehampton | 345 | 5 | 0 | undefined+L | 20 |
| royal-holloway | 484 | 3 | 0 | undefined+L | 20 |
| sae | 67 | 5 | 0 | undefined+L | 20 |
| sask-polytechnic | 32 | 4 | 0 | undefined+L | 20 |
| seneca | 216 | 6 | 0 | undefined+L | 20 |
| sheffield-hallam | 341 | 4 | 0 | undefined+L | 20 |
| sheridan | 77 | 3 | 0 | undefined+L | 20 |
| simon-fraser | 104 | 3 | 0 | undefined+L | 20 |
| soas | 533 | 4 | 0 | undefined+L | 20 |
| solent | 42 | 3 | 0 | undefined+L | 20 |
| south-carolina | 46 | 3 | 0 | undefined+L | 20 |
| south-east-technological-university | 177 | 3 | 0 | undefined+L | 20 |
| south-wales | 576 | 10 | 0 | undefined+L | 20 |
| southeast-missouri-state-university | 157 | 3 | 0 | undefined+L | 20 |
| srh-germany | 74 | 3 | 0 | undefined+L | 20 |
| sruc | 55 | 5 | 0 | undefined+L | 20 |
| st-lawrence-college | 67 | 3 | 0 | undefined+L | 20 |
| st-marys-ca | 55 | 3 | 0 | undefined+L | 20 |
| stafford-house | 38 | 4 | 0 | undefined+L | 20 |
| state-university-of-new-york-at-oswego | 109 | 3 | 0 | undefined+L | 20 |
| stirling | 192 | 5 | 0 | undefined+L | 20 |
| sunderland | 316 | 5 | 0 | undefined+L | 20 |
| surrey | 172 | 5 | 0 | undefined+L | 20 |
| sussex | 521 | 5 | 0 | undefined+L | 20 |
| swansea | 603 | 3 | 0 | undefined+L | 20 |
| sydney | 541 | 18 | 0 | undefined+L | 20 |
| tamucc | 121 | 3 | 0 | undefined+L | 20 |
| teesside | 452 | 4 | 0 | undefined+L | 20 |
| temple | 179 | 5 | 0 | undefined+L | 20 |
| the-university-of-melbourne | 285 | 4 | 0 | undefined+L | 20 |
| thompson-rivers | 185 | 5 | 0 | undefined+L | 20 |
| toronto-film-school | 32 | 5 | 0 | undefined+L | 20 |
| toulouse-business-school | 43 | 3 | 0 | undefined+L | 20 |
| towson | 38 | 3 | 0 | undefined+L | 20 |
| tulane | 48 | 6 | 0 | undefined+L | 20 |
| tus-shannon | 229 | 3 | 0 | undefined+L | 20 |
| uab | 189 | 5 | 0 | undefined+L | 20 |
| uca | 281 | 7 | 0 | undefined+L | 20 |
| ucb | 88 | 5 | 0 | undefined+L | 20 |
| ucc | 207 | 5 | 0 | undefined+L | 20 |
| ucf | 535 | 6 | 0 | undefined+L | 20 |
| uconn | 112 | 5 | 0 | undefined+L | 20 |
| uic | 34 | 3 | 0 | undefined+L | 20 |
| uis | 47 | 3 | 0 | undefined+L | 20 |
| ulster | 284 | 4 | 0 | undefined+L | 20 |
| unbc | 79 | 5 | 0 | undefined+L | 20 |
| university-canada-west | 46 | 3 | 0 | undefined+L | 20 |
| university-of-bedfordshire | 270 | 4 | 0 | undefined+L | 20 |
| university-of-east-london | 294 | 3 | 0 | undefined+L | 20 |
| university-of-law | 193 | 20 | 0 | undefined+L | 20 |
| university-of-southampton | 349 | 7 | 0 | undefined+L | 20 |
| university-of-southern-queensland | 152 | 3 | 0 | undefined+L | 20 |
| university-of-the-west-of-england | 265 | 3 | 0 | undefined+L | 20 |
| university-of-the-west-of-scotland | 124 | 5 | 0 | undefined+L | 20 |
| university-of-wolverhampton | 58 | 4 | 0 | undefined+L | 20 |
| utah | 33 | 3 | 0 | undefined+L | 20 |
| utsa | 33 | 4 | 0 | undefined+L | 20 |
| uwe-bristol | 126 | 4 | 0 | undefined+L | 20 |
| victoria-gold-coast | 121 | 5 | 0 | undefined+L | 20 |
| victoria-wellington | 495 | 5 | 0 | undefined+L | 20 |
| waikato | 236 | 4 | 0 | undefined+L | 20 |
| washington-state | 80 | 9 | 0 | undefined+L | 20 |
| webster-vienna | 132 | 3 | 0 | undefined+L | 20 |
| western-new-england | 145 | 4 | 0 | undefined+L | 20 |
| western-sydney | 88 | 5 | 0 | undefined+L | 20 |
| western-washington | 166 | 4 | 0 | undefined+L | 20 |
| westminster | 324 | 5 | 0 | undefined+L | 20 |
| wilfrid-laurier | 87 | 3 | 0 | undefined+L | 20 |
| winnipeg | 32 | 4 | 0 | undefined+L | 20 |
| wittenborg | 116 | 4 | 0 | undefined+L | 20 |
| wollongong-malaysia | 73 | 3 | 0 | undefined+L | 20 |
| worthgate-school | 76 | 5 | 0 | undefined+L | 20 |
| wrexham-university | 80 | 3 | 0 | undefined+L | 20 |
| york | 396 | 5 | 0 | undefined+L | 20 |
| yorkville | 50 | 3 | 0 | undefined+L | 20 |