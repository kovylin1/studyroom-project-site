# Живой каталог против агрегаторов

Сверка без сети: выгрузки в sources/kompas/extracts против site/src/content/universities.
Совпадением цены считается расхождение до 2 %. Обходы офсайтов (direct) агрегатором не считаются.

## Покрытие каталога

| Показатель | Значение | Доля |
|---|---:|---:|
| Карточек в живом каталоге | 1070 | |
| Из них с выгрузкой агрегатора | 848 | 79.3 % |
| Программ всего | 124592 | |
| Подтверждено агрегатором | 81617 | 65.5 % |
| Не подтверждено | 42975 | 34.5 % |
| Из них помечено catalog-only | 29971 | |
| Цен всего | 90150 | 72.4 % от программ |
| Цена совпадает с агрегатором | 77187 | 85.6 % |
| Цену источник не подтверждает | 12963 | 14.4 % |
| Программ без цены | 34442 | 27.6 % |

## По источникам

| Источник | Выгрузок | Привязано | Нет карточки | Строк | Доехало | Нет в карточке | Цен | Совпало | Разошлось | Нет цены в каталоге |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| qs | 512 | 507 | 0 | 35259 | 35022 | 237 | 34628 | 33208 | 96 | 1324 |
| edvoy | 636 | 636 | 0 | 49223 | 49195 | 28 | 47300 | 47287 | 11 | 2 |
| kaplan | 24 | 24 | 0 | 4725 | 4725 | 0 | 4725 | 4725 | 0 | 0 |
| studygroup | 31 | 31 | 0 | 165 | 165 | 0 | 161 | 161 | 0 | 0 |
| oxford-international | 26 | 19 | 7 | 1390 | 1369 | 21 | 1343 | 1291 | 43 | 9 |
| iapro | 34 | 33 | 0 | 1436 | 1433 | 3 | 0 | 0 | 0 | 0 |
| qahe | 4 | 4 | 0 | 102 | 100 | 2 | 100 | 100 | 0 | 0 |
| direct | 273 | 273 | 0 | 16017 | 4463 | 11554 | 0 | 0 | 0 | 0 |

### Совпадение цен по источникам

| Источник | Цен сверено | Совпало | Каталог дороже | Каталог дешевле |
|---|---:|---:|---:|---:|
| qs | 33304 | 33208 (99.7 %) | 12 | 84 |
| edvoy | 47298 | 47287 (100.0 %) | 1 | 10 |
| kaplan | 4725 | 4725 (100.0 %) | 0 | 0 |
| studygroup | 161 | 161 (100.0 %) | 0 | 0 |
| oxford-international | 1334 | 1291 (96.8 %) | 41 | 2 |
| iapro | 0 | 0 (—) | 0 | 0 |
| qahe | 100 | 100 (100.0 %) | 0 | 0 |
| direct | 0 | 0 (—) | 0 | 0 |

## Расхождения

### Карточки нет в каталоге, а выгрузка есть — 7

| Источник | Слаг | Название | Программ в выгрузке |
|---|---|---|---:|
| oxford-international | coquitlam-college | Coquitlam College | 3 |
| oxford-international | oxford-international-london-centre | Oxford International London Centre | 1 |
| oxford-international | oxford-international-oxford-centre | Oxford International Oxford Centre | 1 |
| oxford-international | universal-higher-education-australia | Universal Higher Education, Australia | 3 |
| oxford-international | universal-higher-education-uk | Universal Higher Education, UK | 5 |
| oxford-international | university-of-southampton-delhi | University of Southampton Delhi | 0 |
| oxford-international | whitecliffe-university-of-applied-sciences | Whitecliffe University of Applied Sciences | 9 |

### Выгрузок без привязки к карточке — 1

### Строк источника, не нашедших программу в карточке — 291

| Источник | Строк |
|---|---:|
| qs | 237 |
| edvoy | 28 |
| oxford-international | 21 |
| iapro | 3 |
| qahe | 2 |

Топ карточек по числу непривязанных строк:

| Карточка | Строк |
|---|---:|
| ara-institute-of-canterbury | 39 |
| aberystwyth | 27 |
| american-university | 24 |
| anglia-ruskin | 12 |
| brighton | 11 |
| the-university-of-western-australia | 11 |
| ism-germany | 11 |
| abat-oliba-barcelona | 10 |
| heriot-watt | 9 |
| suny-geneseo | 9 |
| suffolk-university | 9 |
| sussex | 9 |
| victoria-wellington | 9 |
| edinburgh-napier | 9 |
| liverpool | 8 |
| roehampton | 8 |
| lasalle-college | 6 |
| bangor | 5 |
| sheffield-hallam | 5 |
| essex | 4 |
| greenwich | 4 |
| aut | 3 |
| bristol | 3 |
| university-of-sheffield | 3 |
| arizona-state | 2 |

### Цены разошлись больше чем на 2 % — 150

| Источник | Расхождений |
|---|---:|
| qs | 96 |
| oxford-international | 43 |
| edvoy | 11 |

Самые крупные расхождения:

| Карточка | Программа | Каталог | Источник | Δ | Откуда |
|---|---|---:|---:|---:|---|
| roehampton | MBA Healthcare Management | 20020 GBP | 4000 GBP | +400.5 % | oxford-international |
| roehampton | MBA | 19250 GBP | 4000 GBP | +381.3 % | oxford-international |
| roehampton | MSc Global Marketing | 18980 GBP | 4000 GBP | +374.5 % | oxford-international |
| roehampton | MSc Cyber Security | 18980 GBP | 4000 GBP | +374.5 % | oxford-international |
| roehampton | MSc Data Science | 18980 GBP | 4000 GBP | +374.5 % | oxford-international |
| roehampton | MSc Digital Marketing | 18980 GBP | 4000 GBP | +374.5 % | oxford-international |
| roehampton | MSc Global Financial Management | 18980 GBP | 4000 GBP | +374.5 % | oxford-international |
| roehampton | MSc Computing | 18980 GBP | 4000 GBP | +374.5 % | oxford-international |
| roehampton | MSc Project Management | 18980 GBP | 4000 GBP | +374.5 % | oxford-international |
| roehampton | MSc Banking, Finance and Risk Management | 18980 GBP | 4000 GBP | +374.5 % | oxford-international |
| roehampton | MSc Global Business Management | 18980 GBP | 4000 GBP | +374.5 % | oxford-international |
| roehampton | MSc Global Logistics and Supply Chain Management | 18250 GBP | 4000 GBP | +356.3 % | oxford-international |
| roehampton | MSc Global Human Resource Management | 18250 GBP | 4000 GBP | +356.3 % | oxford-international |
| roehampton | MSc Web Development | 18250 GBP | 4000 GBP | +356.3 % | oxford-international |
| roehampton | MSc Occupational and Business Psychology | 18250 GBP | 4000 GBP | +356.3 % | oxford-international |
| sheffield-hallam | MSc Project Management | 18600 GBP | 4500 GBP | +313.3 % | oxford-international |
| sheffield-hallam | MSc International Business Management | 17725 GBP | 4500 GBP | +293.9 % | oxford-international |
| sheffield-hallam | MSc International Business and Marketing | 17725 GBP | 4500 GBP | +293.9 % | oxford-international |
| sheffield-hallam | MSc Logistics and Supply Chain Management | 17725 GBP | 4500 GBP | +293.9 % | oxford-international |
| hult | Bachelor's in Entrepreneurship | 141800 AED | 37100 GBP | +282.2 % | qs |
| kent | Global Healthcare Management | 24700 GBP | 10395 GBP | +137.6 % | oxford-international |
| edinburgh-napier | MA Journalism | 21430 GBP | 9445 GBP | +126.9 % | oxford-international |
| edinburgh-napier | MSc Computing | 21430 GBP | 9445 GBP | +126.9 % | oxford-international |
| greenwich | MBA Global with Placement | 22875 GBP | 10390 GBP | +120.2 % | oxford-international |
| edinburgh-napier | MSc Intercultural Business Communication | 19750 GBP | 9445 GBP | +109.1 % | oxford-international |
| edinburgh-napier | MSc International Tourism Destination Management | 19750 GBP | 9445 GBP | +109.1 % | oxford-international |
| edinburgh-napier | MSc Accounting | 19750 GBP | 9445 GBP | +109.1 % | oxford-international |
| edinburgh-napier | MSc International Business Management | 19750 GBP | 9445 GBP | +109.1 % | oxford-international |
| edinburgh-napier | MSc Healthcare Management | 19750 GBP | 9445 GBP | +109.1 % | oxford-international |
| edinburgh-napier | MSc Publishing | 19750 GBP | 9445 GBP | +109.1 % | oxford-international |

### У источника цена есть, в каталоге нет — 1335

| Источник | Строк |
|---|---:|
| qs | 1324 |
| oxford-international | 9 |
| edvoy | 2 |

### Валюта каталога расходится с валютой источника — 256

| Каталог → источник | Программ |
|---|---:|
| GBP → USD | 249 |
| AUD → SGD | 2 |
| GBP → AED | 1 |
| AED → GBP | 1 |
| USD → AED | 1 |
| NZD → USD | 1 |
| USD → GBP | 1 |

### Карточки без единой выгрузки агрегатора

Всего 222 из 1070. Программ в них: 7734.

| Карточка | Страна | Программ |
|---|---|---:|
| lancashire | United Kingdom | 447 |
| edith-cowan-sl | Sri Lanka | 336 |
| newcastle-au | Australia | 302 |
| sp-jain-school-of-global-management-dubai | UAE | 203 |
| st-francis-xavier | Canada | 189 |
| university-of-north-carolina-at-wilmington | United States | 186 |
| trine-university | United States | 148 |
| inti-international-university | Malaysia | 141 |
| american-kogod | United States | 134 |
| into-stony-brook | United States | 127 |
| fiu-business | United States | 123 |
| victoria-gold-coast | Australia | 121 |
| ipag | France | 120 |
| burgundy-school-of-business | France | 119 |
| esic | Spain | 117 |
| into-newton-a-levels | United Kingdom | 112 |
| simon-fraser | Canada | 112 |
| eu-business-school-switzerland | Switzerland | 99 |
| victoria | Canada | 99 |
| oxford-international-college | United Kingdom | 95 |
| sheridan | Canada | 84 |
| nicosia-medical | Cyprus | 82 |
| lipscomb | United States | 79 |
| worthgate-school | United Kingdom | 75 |
| fleming-college-toronto | Canada | 73 |
| claremont-grad | United States | 71 |
| anglo-american-university | Czech Republic | 66 |
| iesa | France | 66 |
| mount-saint-vincent-ny | United States | 65 |
| hague | Netherlands | 64 |

## Живой каталог против рабочей копии

| Показатель | Живой | Рабочая копия | Δ |
|---|---:|---:|---:|
| cards | 1070 | 1070 | 0 |
| programs | 124592 | 124592 | 0 |
| prices | 90150 | 90150 | 0 |

Только в рабочей копии: 0. Только в живом: 0.
