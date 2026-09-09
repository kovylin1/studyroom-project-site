# Цены, которые после 3.1 упадут — что смотреть глазами

Скрипт `scraper/kompas-fee-drop-review.mjs`, только чтение. Снято 2026-08-23 15:58 UTC.

Правило владельца — «цена агрегатора важнее каталожной, из нескольких берём минимум» —
применено сплошь. Отчёт отделяет уточнение цены от разнобоя источников.

| Разряд | Цен | Что это |
|---|---:|---|
| `outlier-variant` | 46 | у программы несколько цен, выбранная ниже следующей больше чем вдвое |
| `steep` | 10 | вариантов нет, но цена упала больше чем вдвое |
| `mild` | 3 120 | падение в пределах половины — уточнение |
| **всего** | **3 176** | |

## Откуда взяты подозрительные минимумы

| Источник | outlier-variant | steep |
|---|---:|---:|
| qs | 45 | 0 |
| источник не назван | 0 | 9 |
| edvoy | 1 | 1 |

## Карточки с наибольшим числом спорных цен

| Карточка | Спорных цен |
|---|---:|
| `essex` | 35 |
| `massey` | 2 |
| `metropolitan-budapest` | 2 |
| `sheffield-hallam` | 2 |
| `sydney` | 2 |
| `thompson-rivers` | 2 |
| `victoria-wellington` | 2 |
| `glasgow` | 1 |
| `la-trobe` | 1 |
| `niagara-falls` | 1 |
| `notre-dame-au` | 1 |
| `psb-paris` | 1 |
| `strathclyde` | 1 |
| `uis` | 1 |
| `unbc` | 1 |

## outlier-variant — 46

| Карточка | Программа | Было | Станет | −% | Кто дал | Следующая цена |
|---|---|---:|---:|---:|---|---:|
| `sydney` | Master of Environmental Science and Law | 61 700 | 5 300 | 91 | qs | 61 700 |
| `sydney` | Master of Marine Science and Management | 61 700 | 5 300 | 91 | qs | 61 700 |
| `la-trobe` | Bachelor of Dental Science (Honours) | 83 600 | 35 000 | 58 | qs | 83 600 |
| `university-of-auckland` | English Pathway for Postgraduate Studies (EPPS) | 31 000 | 13 000 | 58 | qs | 31 000 |
| `strathclyde` | PgDip Construction Law | 26 000 | 11 300 | 57 | qs | 26 000 |
| `thompson-rivers` | Master of Science in Data Science | 49 694 | 22 000 | 56 | qs | 49 694 |
| `massey` | Postgraduate Diploma in Science and Technology Without  | 46 590 | 21 150 | 55 | edvoy | 46 590 |
| `essex` | MSc Economics of Business and Management | 25 925 | 12 130 | 53 | qs | 25 925 |
| `thompson-rivers` | Master of Business Administration | 45 908 | 22 000 | 52 | qs | 45 908 |
| `essex` | MSc Advanced Computer Science | 24 675 | 12 130 | 51 | qs | 24 675 |
| `essex` | MSc Artificial Intelligence | 24 675 | 12 130 | 51 | qs | 24 675 |
| `essex` | MSc Computer Engineering | 24 675 | 12 130 | 51 | qs | 24 675 |
| `essex` | MSc Computer Networks and Security | 24 675 | 12 130 | 51 | qs | 24 675 |
| `essex` | MSc Electronic Engineering | 24 675 | 12 130 | 51 | qs | 24 675 |
| `essex` | MSc Intelligent Systems and Robotics | 24 675 | 12 130 | 51 | qs | 24 675 |
| `essex` | MA Economics | 24 675 | 12 130 | 51 | qs | 24 675 |
| `essex` | MSc Financial Economics | 24 675 | 12 130 | 51 | qs | 24 675 |
| `essex` | MSc Economics | 24 675 | 12 130 | 51 | qs | 24 675 |
| `essex` | MSc Management Economics | 24 675 | 12 130 | 51 | qs | 24 675 |
| `essex` | MSc Accounting and Finance | 24 675 | 12 130 | 51 | qs | 24 675 |
| `essex` | MSc Business Analytics | 24 675 | 12 130 | 51 | qs | 24 675 |
| `essex` | MSc Entrepreneurship and Innovation | 24 675 | 12 130 | 51 | qs | 24 675 |
| `essex` | MSc Finance | 24 675 | 12 130 | 51 | qs | 24 675 |
| `essex` | MSc Finance and Management | 24 675 | 12 130 | 51 | qs | 24 675 |
| `essex` | MSc Financial Engineering and Risk Management | 24 675 | 12 130 | 51 | qs | 24 675 |
| `essex` | MSc Global Project Management | 24 675 | 12 130 | 51 | qs | 24 675 |
| `essex` | MSc Human Resource Management | 24 675 | 12 130 | 51 | qs | 24 675 |
| `essex` | MSc International Business and Entrepreneurship | 24 675 | 12 130 | 51 | qs | 24 675 |
| `essex` | MSc International Logistics and Supply Chain Management | 24 675 | 12 130 | 51 | qs | 24 675 |
| `essex` | MSc International Marketing and Business Intelligence | 24 675 | 12 130 | 51 | qs | 24 675 |
| … | ещё 16 | | | | | |

## steep — 10

| Карточка | Программа | Было | Станет | −% | Кто дал | Следующая цена |
|---|---|---:|---:|---:|---|---:|
| `unbc` | Master of Business Administration | 28 000 | 6 466 | 77 | edvoy | 9 697 |
| `psb-paris` | DBA - Doctorate of Business Administration | 34 750 | 10 166 | 71 | — | — |
| `glasgow` | MA  (Hons) Business and Management | 33 210 | 11 370 | 66 | — | — |
| `notre-dame-au` | Doctor of Medicine | 83 997 | 34 078 | 59 | — | — |
| `uis` | MPA Public Administration | 26 000 | 11 000 | 58 | — | — |
| `niagara-falls` | English for Academic Purposes | 8 000 | 3 500 | 56 | — | — |
| `victoria-wellington` | Master of Artificial Intelligence | 74 150 | 35 300 | 52 | — | — |
| `victoria-wellington` | Master of Software Development | 74 150 | 35 300 | 52 | — | — |
| `essex` | MSc Management (International) | 24 675 | 12 130 | 51 | — | — |
| `essex` | MSc Management (Marketing) | 24 675 | 12 130 | 51 | — | — |

Построчно, со всеми вариантами стоимости — `sources/kompas/fee-drops.json`.
