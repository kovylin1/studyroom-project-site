# Состав вузов: агрегаторы против рабочей копии

Сверка без сети. Состав агрегатора берётся из описи членства `sources/kompas/membership/`,
привязка пересчитывается на ТЕКУЩУЮ рабочую копию, а не берётся из описи.

| Агрегатор | Снимок описи | Перечислено | Карточка есть | Карточек несколько | Нет карточки | Не вуз (решено) |
|---|---|---:|---:|---:|---:|---:|
| qs | 2026-08-01 | 512 | 508 (99.2 %) | 1 | 3 | 0 |
| edvoy | 2026-08-23 | 591 | 578 (97.8 %) | 4 | 9 | 0 |
| kaplan | — | опись не снималась | | | | |
| studygroup | 2026-07-22 | 46 | 34 (100.0 %) | 0 | 0 | 12 |
| oxford-international | 2026-07-22 | 26 | 19 (73.1 %) | 0 | 7 | 0 |
| iapro | 2026-07-23 | 24 | 24 (100.0 %) | 0 | 0 | 0 |
| qahe | 2026-07-23 | 6 | 6 (100.0 %) | 0 | 0 | 0 |
| navitas | 2026-07-22 | 75 | 69 (95.8 %) | 0 | 3 | 3 |
| cats | 2026-07-22 | 12 | 12 (100.0 %) | 0 | 0 | 0 |

## Кого нет в рабочей копии


### qs — 3

| Вуз | Страна | Программ у источника |
|---|---|---:|
| Indian Internal Applications | India | 38 |
| Testing December - Testing purpose | Ukraine | 2 |
| American Collegiate, Washington DC | United States | 0 |

### edvoy — 9

| Вуз | Страна | Программ у источника |
|---|---|---:|
| Ecole de Management Applique | France | 9 |
| CBS University of Applied Sciences | Germany | 2 |
| ALFA University College (AUC) | Malaysia | 1 |
| MJM Graphic Design | France | 1 |
| Rome Business School | Italy | 1 |
| The International University of Logistics and Transport | Poland | 1 |
| The University of waterloo | Canada | 1 |
| Widener University | United States | 1 |
| European Global Institute of Innovation and Technology | Malta | 1 |

### oxford-international — 7

| Вуз | Страна | Программ у источника |
|---|---|---:|
| Whitecliffe University of Applied Sciences | — | 9 |
| Universal Higher Education, UK | — | 5 |
| Universal Higher Education, Australia | — | 3 |
| Coquitlam College | — | 3 |
| Oxford International London Centre | — | 1 |
| Oxford International Oxford Centre | — | 1 |
| University of Southampton Delhi | — | 0 |

### navitas — 3

| Вуз | Страна | Программ у источника |
|---|---|---:|
| Christchurch College of English | New Zealand | — |
| Hawthorn-Melbourne | Australia | — |
| Taylors College Sydney | Australia | — |

## Где карточек несколько на один вуз источника


### qs — 1

| Вуз у источника | Карточки | Программ у источника |
|---|---|---:|
| Oxford International Education Group (North America Pathway Programs) | `oxford-international-education-group-english-schools`, `oxford-international-education-group-ielts-and-tesol`, `oxford-international-education-group-junior` | 4 |

### edvoy — 4

| Вуз у источника | Карточки | Программ у источника |
|---|---|---:|
| Royal Holloway University of London | `royal-holloway-direct-entry`, `royal-holloway` | 321 |
| University of Victoria | `uvic`, `victoria` | 88 |
| Long Island University Brooklyn | `liu-brooklyn`, `long-island-university-brooklyn-direct-entry` | 66 |
| Texas A and M University Corpus Christi | `tamucc`, `texas-aandm-corpus-christi-university-direct-entry` | 0 |

Построчно: `uni-coverage.json`.
