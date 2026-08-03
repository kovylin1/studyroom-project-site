# QS — почему 133 карточки не легли на каталог

**Дата:** 2026-08-02 · только чтение, каталог не тронут, карточки не заводились.

## Сводка

| Показатель | Значение |
|---|---:|
| Записей QS без привязки | 133 |
| Программ в них | 3964 |
| **Привязались строгим разбором** (баг привязки, не пробел) | **5** |
| …из них только в рабочей копии, в живом каталоге карточки нет | 0 |
| Имя совпало, страна разошлась | 9 |
| Несколько кандидатов, однофамильцы | 3 |
| Есть похожая карточка | 82 |
| …из них карточка САМА жалуется «выгрузки нет» | **39** |
| …разряд «надёжно» (0.75+, страна та же) | 24 |
| …разряд «нужен глаз» (0.5–0.74) | 45 |
| …разряд «другая страна» (скорее другой кампус) | 13 |
| Ничего похожего: карточки нет вовсе | 46 (программ 1318) |

Каталогов сверено два: живой (823 карточек) и рабочая копия КОМПАСа (823).

## Двойная улика: и QS не привязался, и карточка жалуется «выгрузки нет»

Самое надёжное, что даёт этот замер. С одной стороны запись QS не села на карточку,
с другой — сверка по этой самой карточке отдала кейс `kompas_no_extract`. Совпадение
двух независимых признаков; привязку всё равно не делаю сам — решает владелец.

### надёжно — 13 шт., 313 программ

Имя совпадает на 0.75+ и страна та же. Проверить стоит всё равно, но брака тут не нашлось.

| Имя у QS | Программ | Страна | Кандидат | Схожесть |
|---|---:|---|---|---:|
| University of Illinois at Chicago | 74 | United States | `uic` — University of Illinois Chicago | 1.00 |
| East Asia Institute of Management (EAIM) | 59 | Singapore | `eaim` — East Asia Institute of Management (EAIM) | 1.00 |
| Cardenal Herrera CEU | 46 | Spain | `cardenal-herrera-valencia` — Universidad CEU Cardenal Herrera | 0.75 |
| EU Business School (Munich) | 34 | Germany | `eu-business-school-germany` — EU Business School (Munich) | 1.00 |
| American University of Dubai | 27 | United Arab Emirates | `aud` — American University in Dubai | 1.00 |
| Cambridge School of Visual & Performing Arts - CSVPA | 20 | United Kingdom | `csvpa-cambridge` — Cambridge School of Visual & Performing Arts (CSVPA) | 1.00 |
| Rochester Institute of Technology (RIT) Dubai (Undergraduate) | 18 | United Arab Emirates | `rit-dubai` — Rochester Institute of Technology — Dubai | 0.75 |
| Cretin-Derham Hall High School | 12 | United States | `cretin-derham-hall` — Cretin-Derham Hall | 0.75 |
| Scotland's Rural College (SRUC) | 11 | United Kingdom | `sruc` — Scotland's Rural College (SRUC) | 1.00 |
| Rochester Institute of Technology (RIT) Dubai (Postgraduate) | 8 | United Arab Emirates | `rit-dubai` — Rochester Institute of Technology — Dubai | 0.75 |
| EM Normandie Business School (Dubai) | 2 | United Arab Emirates | `em-normandie-dubai` — EM Normandie Business School — Dubai | 1.00 |
| Queen Mary University in Malta | 1 | Malta | `queen-mary-malta` — Queen Mary University of London in Malta | 0.75 |
| Royal College of Surgeons, Ireland (RCSI) - Foundation | 1 | Ireland | `rcsi` — Royal College of Surgeons in Ireland (RCSI) | 0.80 |

### нужен глаз — 21 шт., 788 программ

Страна та же, схожесть 0.5–0.74. Здесь брак и живёт: «University of Auckland» → `auckland-institute-of-studies` — разные заведения.

| Имя у QS | Программ | Страна | Кандидат | Схожесть |
|---|---:|---|---|---:|
| University of Oklahoma | 239 | United States | `into-oklahoma` — University of Oklahoma (INTO) | 0.50 |
| Stony Brook University (Undergraduate) | 110 | United States | `into-stony-brook` — Stony Brook University (INTO) | 0.67 |
| UCAM Universidad Católica San Antonio de Murcia | 101 | Spain | `ucam-murcia` — UCAM Universidad Católica de Murcia | 0.67 |
| University of Wollongong Malaysia KDU | 78 | Malaysia | `wollongong-malaysia` — University of Wollongong Malaysia | 0.67 |
| Istituto Marangoni Milan | 71 | Italy | `marangoni-milan` — Istituto Marangoni Milano | 0.50 |
| San Pablo CEU | 57 | Spain | `san-pablo-ceu-madrid` — Universidad San Pablo CEU Madrid | 0.60 |
| Abat Oliba CEU | 44 | Spain | `abat-oliba-barcelona` — Universitat Abat Oliba CEU Barcelona | 0.60 |
| Queens College | 38 | United States | `queens-college-cuny` — Queens College, CUNY | 0.50 |
| Fox School of Business - Temple University | 14 | United States | `fox-temple` — Fox School of Business and Management — Temple University | 0.60 |
| Webster University in Vienna, Austria | 13 | Austria | `webster-vienna` — Webster University in Vienna | 0.67 |
| Glasgow International College- Foundation | 6 | United Kingdom | `ifg` — International Foundation Group | 0.50 |
| Les Roches (Postgraduate) | 3 | Switzerland | `les-roches-crans-montana` — Les Roches Crans-Montana | 0.50 |
| University of Bristol International Foundation | 3 | United Kingdom | `ifg` — International Foundation Group | 0.50 |
| Istituto Marangoni - Foundation | 2 | Italy | `marangoni-milan` — Istituto Marangoni Milano | 0.50 |
| Les Roches (Undegraduate) | 2 | Spain | `les-roches-marbella` — Les Roches Marbella | 0.50 |
| Queen Ethelburga's Collegiate | 2 | United Kingdom | `queen-ethelburgas` — Queen Ethelburga's College | 0.67 |
| University of Canberra Sydney Hills | 2 | Australia | `canberra-sydney` — University of Canberra (Sydney campus) | 0.50 |
| American Collegiate, Los Angeles | 1 | United States | `american-collegiate-la` — American Collegiate LA | 0.50 |
| Les Roches (Postgraduate) | 1 | Spain | `les-roches-marbella` — Les Roches Marbella | 0.67 |
| Royal Veterinary College, University of London - Foundation | 1 | United Kingdom | `rvc` — Royal Veterinary College | 0.50 |
| American Collegiate, Washington DC | 0 | United States | `american-collegiate-la` — American Collegiate LA | 0.67 |

### другая страна — 5 шт., 44 программ

Кандидат в ДРУГОЙ стране — почти всегда другой кампус той же сети, а не та же карточка (все Marangoni садятся на миланскую). Привязывать без проверки нельзя.

| Имя у QS | Программ | Страна | Кандидат | Схожесть |
|---|---:|---|---|---:|
| Istituto Marangoni Paris | 19 | France → Italy | `marangoni-milan` — Istituto Marangoni Milano | 0.50 |
| The American Business School of Paris | 10 | France → United States | `american-kogod` — American University — Kogod School of Business | 0.50 |
| Istituto Marangoni Dubai | 10 | United Arab Emirates → Italy | `marangoni-milan` — Istituto Marangoni Milano | 0.50 |
| Oxford International Education Group (North America Pathway Programs) | 4 | Canada → United Kingdom | `oxford-international-college` — Oxford International College | 0.50 |
| Les Roches (Undegraduate) | 1 | Switzerland → Spain | `les-roches-marbella` — Les Roches Marbella | 0.50 |

## Похожая карточка есть, но второй улики нет

### надёжно — 11 шт., 369 программ

Имя совпадает на 0.75+ и страна та же. Проверить стоит всё равно, но брака тут не нашлось.

| Имя у QS | Программ | Страна | Кандидат | Схожесть |
|---|---:|---|---|---:|
| University of Victoria | 73 | Canada | `uvic` — University of Victoria | 1.00 |
| Heriot-Watt University - Dubai | 65 | United Arab Emirates | `heriot-watt-dubai` — Heriot-Watt University Dubai | 1.00 |
| Texas A&M University - Corpus Christi (Postgraduate) | 51 | United States | `tamucc` — Texas A&M University-Corpus Christi | 1.00 |
| Texas A&M University - Corpus Christi (Undergraduate) | 51 | United States | `tamucc` — Texas A&M University-Corpus Christi | 1.00 |
| The University of Europe for Applied Sciences | 35 | Germany | `ue-university-of-europe-for-applied-sciences` — UE - University of Europe for Applied Sciences | 1.00 |
| Universidad Europea Madrid | 31 | Spain | `universidad-europea-de-madrid` — Universidad Europea de Madrid | 1.00 |
| NABA - Nuova Accademia di Belle Arti Milano | 29 | Italy | `naba-milano` — NABA — Nuova Accademia di Belle Arti | 0.83 |
| Arts University of Bournemouth | 14 | United Kingdom | `arts-university-bournemouth` — Arts University Bournemouth | 1.00 |
| NABA - Nuova Accademia Di Belle Arti Foundation | 9 | Italy | `naba-milano` — NABA — Nuova Accademia di Belle Arti | 0.83 |
| University of Victoria | 6 | Canada | `uvic` — University of Victoria | 1.00 |
| Solent University, Southampton | 5 | United Kingdom | `solent` — Southampton Solent University | 1.00 |

### нужен глаз — 23 шт., 806 программ

Страна та же, схожесть 0.5–0.74. Здесь брак и живёт: «University of Auckland» → `auckland-institute-of-studies` — разные заведения.

| Имя у QS | Программ | Страна | Кандидат | Схожесть |
|---|---:|---|---|---:|
| University of Auckland | 274 | New Zealand | `auckland-institute-of-studies` — Auckland Institute Of Studies | 0.50 |
| Ara Institute of Canterbury | 109 | New Zealand | `canterbury-nz` — University of Canterbury | 0.50 |
| SRH Universities | 84 | Germany | `srh-germany` — SRH International College | 0.50 |
| Seattle University | 75 | United States | `north-seattle-college` — North Seattle College | 0.50 |
| Thompson Rivers University in British Columbia | 64 | Canada | `thompson-rivers` — Thompson Rivers University | 0.50 |
| Florida International University FIU | 46 | United States | `florida-international` — Florida International University | 0.67 |
| DLD College London | 21 | United Kingdom | `abbey-dld-london` — Abbey DLD College London | 0.67 |
| Mediadesign University of Applied Sciences | 18 | Germany | `fresenius-university-of-applied-sciences` — Fresenius University of Applied Sciences | 0.50 |
| Brunel University London - Foundation | 16 | United Kingdom | `brunel` — Brunel University of London | 0.67 |
| Trinity Western University (Postgraduate | 13 | Canada | `trinity-western` — Trinity Western University | 0.67 |
| Global Banking School | 12 | Malta | `gbs-malta` — Global Banking School Malta | 0.67 |
| Royal Holloway University of London International Study Centre | 10 | United Kingdom | `royal-holloway-direct-entry` — Royal Holloway, University of London | 0.50 |
| INTO Manchester in partnership with The University of Manchester | 8 | United Kingdom | `into-manchester` — INTO Manchester | 0.50 |
| University of Auckland (Foundation) | 8 | New Zealand | `auckland-institute-of-studies` — Auckland Institute Of Studies | 0.50 |
| Business Hotel Management School | 7 | Switzerland | `bhms` — BHMS — Business and Hotel Management School | 0.60 |
| On Campus Paris | 7 | France | `college-de-paris` — College de Paris | 0.50 |
| South Australian Institute of Business and Technology (SAIBT) - University of South Australia | 7 | Australia | `australia-institute-of-business-and-technology` — Australia Institute of Business and Technology | 0.57 |
| OnCampus London South Bank – Foundation | 6 | United Kingdom | `london-south-bank` — London South Bank University | 0.60 |
| OnCampus Loughborough (Foundation) | 6 | United Kingdom | `loughborough-university` — Loughborough University | 0.50 |
| LCI Melbourne (Undergraduate) | 5 | Australia | `the-university-of-melbourne` — The University of Melbourne | 0.50 |
| Dublin International Study Centre | 4 | United Kingdom | `leeds-isc` — University of Leeds International Study Centre | 0.60 |
| The University of Winnipeg Collegiate | 4 | Canada | `winnipeg` — University of Winnipeg | 0.50 |
| Kaplan International Languages | 2 | United Kingdom | `kaplan-international-college` — Kaplan International College | 0.67 |

### другая страна — 9 шт., 185 программ

Кандидат в ДРУГОЙ стране — почти всегда другой кампус той же сети, а не та же карточка (все Marangoni садятся на миланскую). Привязывать без проверки нельзя.

| Имя у QS | Программ | Страна | Кандидат | Схожесть |
|---|---:|---|---|---:|
| Asia Pacific University | 64 | Malaysia → United States | `pacific` — University of the Pacific | 0.50 |
| EU Business School (Spain) | 31 | Spain → Switzerland | `eu-business-school` — EU Business School | 0.50 |
| Arden University (Hybrid) | 25 | Germany → United Kingdom | `arden` — Arden University | 0.50 |
| Kaplan International College Adelaide | 18 | Australia → United Kingdom | `kaplan-international-college` — Kaplan International College | 0.67 |
| University of Stirling (UAE) | 15 | United Arab Emirates → United Kingdom | `stirling` — University of Stirling | 0.50 |
| Victoria University | 14 | Australia → Canada | `uvic` — University of Victoria | 1.00 |
| University of Delaware - Lerner College of Business & Economics | 12 | United States → Hungary | `budapest-university-of-economics-and-business` — Budapest University of Economics and Business | 0.50 |
| University of Strathclyde, Bahrain | 6 | Bahrain → United Kingdom | `strathclyde` — University of Strathclyde | 0.50 |
| Durham College | 0 | Canada → United Kingdom | `durham` — Durham University | 1.00 |

## Имя совпало, страна разошлась

Однофамильцы — главный источник тихого брака (Griffith College в Брисбене и в Дублине).
Либо страна в карточке неверна, либо это разные учреждения.

- **Arden University (Hybrid)** (Germany, 25 программ) — as-is:Arden University=country-mismatch-core-name
- **Dublin International Study Centre** (United Kingdom, 4 программ) — strip-suffix:Dublin=country-mismatch-core-name
- **Durham College** (Canada, 0 программ) — strip-suffix:Durham=country-mismatch-core-name
- **EU Business School (Munich)** (Germany, 34 программ) — as-is:EU Business School=country-mismatch-core-name
- **EU Business School (Spain)** (Spain, 31 программ) — as-is:EU Business School=country-mismatch-core-name
- **Global Banking School** (Malta, 12 программ) — as-is:Global Banking School=country-mismatch-core-name
- **Heriot-Watt University - Dubai** (United Arab Emirates, 65 программ) — as-is:Heriot-Watt University=country-mismatch-core-name
- **Kaplan International College Adelaide** (Australia, 18 программ) — as-is+strip-campus:Kaplan International College=country-mismatch-core-name
- **University of Stirling (UAE)** (United Arab Emirates, 15 программ) — as-is:University of Stirling=country-mismatch-core-name

## Бейджи QS схлопываются в одно имя

У QS партнёрство разнесено по уровням, и бейдж приклеен прямо к имени. Две записи —
одно учреждение: привязывать надо ОБЪЕДИНЕНИЕМ программ, иначе вторая затрёт первую.

- «Les Roches (Postgraduate)» + «Les Roches (Postgraduate)»
- «Les Roches (Undegraduate)» + «Les Roches (Undegraduate)»
- «New York Institute of Technology (NYIT) (Postgraduate)» + «New York Institute of Technology (NYIT) (Undergraduate)»
- «Northumbria University London campus (QAHE)» + «Northumbria University London campus (QAHE)»
- «Rochester Institute of Technology (RIT) Dubai (Postgraduate)» + «Rochester Institute of Technology (RIT) Dubai (Undergraduate)»
- «Texas A&M University - Corpus Christi (Postgraduate)» + «Texas A&M University - Corpus Christi (Undergraduate)»
- «University of Auckland» + «University of Auckland (Foundation)»
- «University of Essex (Online) (CertHE & Postgraduate)» + «University of Essex (Online) (Postgraduate)» + «University of Essex (Online) (Undergraduate)»
- «University of Victoria» + «University of Victoria»
- «University of Worcester (Postgraduate)» + «University of Worcester (Undergraduate)»

## Карточки нет вовсе

46 записей, 1318 программ. Заводить карточки скрипт не имеет права
(правило владельца 2026-07-31: «Новые вузы заводит человек»), поэтому это список на решение.

| Имя у QS | Программ | Страна | Провайдер |
|---|---:|---|---|
| University of the West of England (UWE) | 352 | United Kingdom | Direct QS |
| Falmouth University | 124 | United Kingdom | Direct QS |
| University of Worcester (Undergraduate) | 113 | United Kingdom | Direct QS |
| Kwantlen Polytechnic University | 107 | Canada | Direct QS |
| University of Worcester (Postgraduate) | 99 | United Kingdom | Direct QS |
| Marshall University | 85 | United States | INTO |
| Mercy University | 68 | United States | OIEG (Oxford International Education Group) |
| SRH Universities (India) | 67 | Germany | Direct QS |
| Northumbria University London campus (QAHE) | 44 | United Kingdom | QA Higher Education (QAHE) |
| Indian Internal Applications | 38 | India | Direct QS |
| Luiss University - Libera Università Internazionale degli Studi Sociali Guido Carli | 32 | Italy | Direct QS |
| American University of Ras Al Khaimah (AURAK) | 23 | United Arab Emirates | Direct QS |
| Glion | 15 | Switzerland | Direct QS |
| OnCampus Aston – Foundation | 14 | United Kingdom | On Campus |
| Westminster International University in Tashkent | 14 | Uzbekistan | Direct QS |
| Swinburne University - Foundation | 12 | Australia | UP Education |
| UCL Centre for Languages & International Education | 11 | United Kingdom | Direct QS |
| University of Tasmania International Pathway College | 7 | Australia | UP Education |
| University of the West of England, Bristol International College (UWE Bristol) - Foundation | 7 | United Kingdom | Kaplan |
| University of York International Pathway College - Foundation | 7 | United Kingdom | Kaplan |
| Northumbria University London campus (QAHE) | 6 | United Kingdom | QA Higher Education (QAHE) |
| OnCampus Hull - Foundation | 6 | United Kingdom | On Campus |
| OnCampus Southampton - Pathway | 6 | United Kingdom | On Campus |
| University Bridge | 5 | United States | Direct QS |
| CESI School of Engineering | 4 | France | Direct QS |
| INTO Manchester in partnership with Manchester Metropolitan University | 4 | United Kingdom | INTO |
| MPW | 4 | United Kingdom | Direct QS |
| On Campus Ireland | 4 | Ireland | On Campus |
| OnCampus Sunderland - Foundation | 4 | United Kingdom | On Campus |
| University of Tasmania, Melbourne Campus | 4 | Australia | Education Centre of Australia (ECA) |
| Anglican Schools Commission (ASC)- Western Australia, Victoria and New South Wales | 3 | Australia | Direct QS |
| The Hague University of Applied Science - Foundation | 3 | Netherlands | NAVITAS |
| ICN International College Paris | 3 | France | NAVITAS |
| Wycombe Abbey International School, Bangkok | 3 | Thailand | BE Education |
| Charles Darwin University International College | 2 | Australia | UP Education |
| Oxford International Education Group (English Schools) | 2 | United Kingdom | OIEG (Oxford International Education Group) |
| Oxford International Education Group (IELTS & TESOL) | 2 | United Kingdom | OIEG (Oxford International Education Group) |
| Peking University HSBC Business School | 2 | China | Direct QS |
| Testing December - Testing purpose | 2 | Ukraine | INTO |
| University of Lethbridge International College Calgary (Foundation) | 2 | Canada | NAVITAS |
| Wycombe Abbey International School | 2 | China | BE Education |
| Wycombe Abbey International School, Hong kong | 2 | Hong Kong | BE Education |
| ILAC International Language Academy of Canada | 1 | Canada | Direct QS |
| Oxford International Education Group (Junior) | 1 | United Kingdom | OIEG (Oxford International Education Group) |
| St. James Catholic Middle School | 1 | United States | Direct QS |
| TEDI - London | 1 | United Kingdom | Kaplan |

Полный разбор с следом попыток — `sources/kompas/qs-unlinked.json`.
