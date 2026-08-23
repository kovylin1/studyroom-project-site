# Валюта карточки против страны — правка перед 3.1

Скрипт `scraper/kompas-fix-card-currency.mjs`. Каталог: `site/src/content/universities`.
Режим: **запись**. Снято 2026-08-23 16:10 UTC.

Суммы не пересчитываются. Каждая цена сперва получает свою валюту явно, и только

потом валюта карточки становится валютой страны.

| Карточка | Страна / город | Валюта карточки | Цен | Проставлено валют | Уже свои |
|---|---|---|---:|---:|---|
| `academic-summer` | United Kingdom / Bath | нет → GBP | 0 | 0 | — |
| `adcote-school-for-girls` | United Kingdom / Birmingham | нет → GBP | 0 | 0 | — |
| `anglo-continental` | United Kingdom / Bournemouth | нет → GBP | 0 | 0 | — |
| `anglolang-academy-of-english` | United Kingdom / 0 | нет → GBP | 0 | 0 | — |
| `atc` | United Kingdom / Manchester | нет → GBP | 0 | 0 | — |
| `atlantic-language` | United Kingdom / Manchester | нет → GBP | 0 | 0 | — |
| `bath-spa-university` | United Kingdom / Bath | нет → GBP | 0 | 0 | — |
| `bede-s-summer-school` | United Kingdom / Brighton | нет → GBP | 0 | 0 | — |
| `beet-english-language-centre` | United Kingdom / Bournemouth | нет → GBP | 0 | 0 | — |
| `bishop-s-stortford-college` | United Kingdom / Bishops Stortford | нет → GBP | 0 | 0 | — |
| `box-hill-school` | United Kingdom / Mickleham | нет → GBP | 0 | 0 | — |
| `bright-school-of-english` | United Kingdom / Bournemouth | нет → GBP | 0 | 0 | — |
| `bromsgrove-school` | United Kingdom / Worcestershire | нет → GBP | 0 | 0 | — |
| `brooke-house-college` | United Kingdom / Market Harborough | нет → GBP | 0 | 0 | — |
| `ccel-christchurch-college-of-english` | New Zealand / Canterbury | нет → NZD | 0 | 0 | — |
| `centre-of-english-studies` | United Kingdom / Manchester | нет → GBP | 0 | 0 | — |
| `chichester-college` | United Kingdom / Chichester | нет → GBP | 0 | 0 | — |
| `colchester-english-study-centre` | United Kingdom / 0 | нет → GBP | 0 | 0 | — |
| `college-of-english-language` | United States / SanDiego | нет → USD | 0 | 0 | — |
| `concord-college` | United Kingdom / Acton Burnell | нет → GBP | 0 | 0 | — |
| `eca-elsis-english` | Australia / Sydney | нет → AUD | 0 | 0 | — |
| `els-language-centers` | United Kingdom / Manchester | нет → GBP | 0 | 0 | — |
| `emirates-aviation-university` | United Arab Emirates / Dubai | нет → AED | 0 | 0 | — |
| `english-in-york` | United Kingdom / 0 | нет → GBP | 0 | 0 | — |
| `english-language-centre-bristol` | United Kingdom / Bristol | нет → GBP | 0 | 0 | — |
| `english-path` | United Kingdom / London | нет → GBP | 0 | 0 | — |
| `eurocentres` | United Kingdom / London | нет → GBP | 0 | 0 | — |
| `eurospeak` | United Kingdom / Reading | нет → GBP | 0 | 0 | — |
| `hotel-and-tourism-management-institute-dubai` | United Arab Emirates / Dubai | нет → AED | 0 | 0 | — |
| `ilac` | Canada / Abbotsford | нет → CAD | 0 | 0 | — |
| `impact-english` | Australia / Brisbane | нет → AUD | 0 | 0 | — |
| `international-house-belfast` | United Kingdom / Belfast | нет → GBP | 0 | 0 | — |
| `international-house` | United Kingdom / Manchester | нет → GBP | 0 | 0 | — |
| `international-language-institute` | United States / Washington | нет → USD | 0 | 0 | — |
| `international-school-of-creative-arts` | United Kingdom / Wexham | нет → GBP | 0 | 0 | — |
| `kaplan-english` | United Kingdom / Manchester | нет → GBP | 0 | 0 | — |
| `kings-education` | United Kingdom / Manchester | нет → GBP | 0 | 0 | — |
| `langports-australia` | Australia / Brisbane | нет → AUD | 0 | 0 | — |
| `language-schools-new-zealand` | New Zealand / Queenstown | нет → NZD | 0 | 0 | — |
| `languages-international` | New Zealand / Auckland | нет → NZD | 0 | 0 | — |
| `leeds-language-college` | United Kingdom / Leeds | нет → GBP | 0 | 0 | — |
| `lexis-education` | Australia / Melbourne | нет → AUD | 0 | 0 | — |
| `limerick-language-centre` | Ireland / 0 | нет → EUR | 0 | 0 | — |
| `london-school-of-english` | United Kingdom / Manchester | нет → GBP | 0 | 0 | — |
| `lsi-ih-portsmouth-language-specialists-international` | United Kingdom / Hampshire | нет → GBP | 0 | 0 | — |
| `mander-portman-woodward` | United Kingdom / London | нет → GBP | 0 | 0 | — |
| `mda-college` | United Kingdom / Leeds | нет → GBP | 0 | 0 | — |
| `mentor-language-institute` | United States / Los Angeles | нет → USD | 0 | 0 | — |
| `myddelton-college` | United Kingdom / Denbigh | нет → GBP | 0 | 0 | — |
| `new-college-group` | United Kingdom / Manchester | нет → GBP | 0 | 0 | — |
| `oxford-international-language-school` | United Kingdom / London | нет → GBP | 0 | 0 | — |
| `oxford-school-of-english` | United Kingdom / 0 | нет → GBP | 0 | 0 | — |
| `queen-s-university-school-of-english` | Canada / Kingston | нет → CAD | 0 | 0 | — |
| `sheffield-college` | United Kingdom / Sheffield | нет → GBP | 0 | 0 | — |
| `skola-english-in-london` | United Kingdom / London | нет → GBP | 0 | 0 | — |
| `southern-ontario-collegiate` | Canada / Ontario | нет → CAD | 0 | 0 | — |
| `st-giles-international` | United Kingdom / Holborn | нет → GBP | 0 | 0 | — |
| `stay-campus-london` | United Kingdom / London | нет → GBP | 0 | 0 | — |
| `the-language-gallery` | United Kingdom / Manchester | нет → GBP | 0 | 0 | — |
| `topup-learning-london` | United Kingdom / London | нет → GBP | 0 | 0 | — |
| `we-bridge-academy` | United Kingdom / Cardiff | нет → GBP | 0 | 0 | — |

## На глаз владельцу

Проставленная валюта — это то, что сказал источник, а не то, что похоже на правду.
Отдельно стоит посмотреть Rutgers Camden: edvoy отдал все 59 цен в GBP при
американском вузе, и суммы (33–46 тысяч) больше похожи на доллары. Пока источник
говорит «фунты» — в каталоге фунты; переписывать за источник без улик мы не будем.
