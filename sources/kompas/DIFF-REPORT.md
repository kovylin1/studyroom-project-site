# КОМПАС — сессия 4: расхождения «каталог vs источник»

**Дата:** 2026-08-01 · сети нет, каталог не тронут (только чтение).

## Сводка

| Показатель | Значение |
|---|---|
| Карточек в рабочей копии | 823 |
| Из них партнёрских | 703 (не партнёры: 120) |
| **Сверено с источником** | **569** |
| Сверить не с чем: источник за логином | 0 (QS, IAPro) |
| Сверить не с чем: источник без программ | 11 (Navitas, CATS) |
| Сверить не с чем: источник готов, выгрузки по вузу нет | 123 |
| Программ в каталоге (сверенные вузы) | 78387 |
| Программ у источников (объединение) | 71605 |
| Совпало названий | 50818 (из них по написанию: 625) |
| Есть в каталоге, нет у источника | 27569 |
| Есть у источника, нет в каталоге | 20787 |
| Цена расходится | 332 |
| **Валюта расходится** | **129** |
| У источника цена есть, в каталоге нет | 2359 |
| Кампусы источника, которых нет в карточке | 99 |

Кейсов в панель: **1361** — kompas_no_extract 123, kompas_programs_missing 274, kompas_programs_extra 431, kompas_fee_absent 130, kompas_fee_mismatch 326, kompas_campus_missing 57, kompas_fee_currency 18, kompas_fee_mismatch_rest 1, kompas_source_empty 1.

Потолок поштучных кейсов на вуз — 20; остаток сведён в кейс `kompas_fee_mismatch_rest`, полный список расхождений — в `diff-report.json` (ничего не срезано молча).

## Худшие 40 вузов

| Вуз | Источник | Каталог | Источник, программ | Совпало | Только каталог | Только источник | Цена ≠ | Валюта ≠ |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| University of Chester (`chester`) | kaplan+qs+edvoy | 1123 | 590 | 455 | 668 | 135 | 3 | 23 |
| University of Strathclyde (`strathclyde`) | studygroup+qs+edvoy | 636 | 900 | 430 | 206 | 470 | 1 | 0 |
| University of Nottingham (`nottingham`) | kaplan+qs+edvoy | 671 | 791 | 405 | 266 | 386 | 5 | 0 |
| University of Birmingham (`birmingham`) | kaplan+oxford-international+qs+edvoy | 532 | 933 | 420 | 112 | 513 | 2 | 0 |
| University of Brighton (`brighton`) | kaplan+qs+edvoy | 565 | 398 | 183 | 382 | 215 | 0 | 0 |
| University of South Wales (`south-wales`) | qs+edvoy | 577 | 481 | 237 | 340 | 244 | 0 | 0 |
| Swinburne University of Technology (`swinburne-university-of-technology`) | edvoy | 542 | 1 | 1 | 541 | 0 | 0 | 0 |
| University of Sussex (`sussex`) | studygroup+qs+edvoy | 556 | 597 | 311 | 245 | 286 | 0 | 0 |
| University of Liverpool (`liverpool`) | kaplan+qs+edvoy | 967 | 773 | 615 | 352 | 158 | 1 | 0 |
| Massey University (`massey`) | qs+edvoy | 670 | 396 | 299 | 371 | 97 | 13 | 0 |
| University of Kent (`kent`) | oxford-international+qs+edvoy | 272 | 641 | 205 | 67 | 436 | 0 | 0 |
| Lancaster University (`lancaster`) | qs+edvoy | 92 | 482 | 39 | 53 | 443 | 0 | 0 |
| University of Bristol (`bristol`) | kaplan+qs+edvoy | 374 | 854 | 367 | 7 | 487 | 0 | 0 |
| INTO University of East Anglia (`into-uea`) | qs | 486 | 8 | 1 | 485 | 7 | 0 | 0 |
| Royal Holloway, University of London (`royal-holloway`) | studygroup+qs+edvoy | 499 | 11 | 11 | 488 | 0 | 0 | 0 |
| Victoria University of Wellington (`victoria-wellington`) | qs+edvoy | 883 | 481 | 450 | 433 | 31 | 2 | 0 |
| INSEEC Business School (`inseec-business-school`) | edvoy | 476 | 7 | 7 | 469 | 0 | 0 | 0 |
| University of Reading Malaysia (`reading-malaysia`) | qs | 390 | 14 | 8 | 382 | 6 | 0 | 8 |
| University of Central Florida (`ucf`) | qs+edvoy | 542 | 147 | 113 | 429 | 34 | 0 | 0 |
| University of Bath (`bath`) | studygroup+qs+edvoy | 514 | 538 | 301 | 213 | 237 | 2 | 0 |
| University of Texas at San Antonio (`utsa`) | qs | 341 | 106 | 7 | 334 | 99 | 6 | 0 |
| University of Portsmouth (`portsmouth`) | qs+edvoy | 470 | 816 | 431 | 39 | 385 | 0 | 0 |
| Nottingham Trent University (`nottingham-trent`) | kaplan+qs+edvoy | 339 | 520 | 220 | 119 | 300 | 0 | 0 |
| University of Hertfordshire (`hertfordshire`) | qs+edvoy | 418 | 770 | 387 | 31 | 383 | 0 | 0 |
| University of Derby (`derby`) | qs+edvoy | 208 | 400 | 101 | 107 | 299 | 0 | 0 |
| University of Glasgow (`glasgow`) | kaplan+oxford-international+qs+edvoy | 648 | 807 | 541 | 107 | 266 | 10 | 0 |
| Illinois State University (`illinois-state`) | qs+edvoy | 315 | 509 | 220 | 95 | 289 | 1 | 0 |
| INTO University of Stirling (`into-stirling-uni`) | qs | 334 | 45 | 1 | 333 | 44 | 0 | 0 |
| Technological University of the Shannon (`tus-shannon`) | qs | 229 | 137 | 1 | 228 | 136 | 1 | 0 |
| Queen Mary University of London (`queen-mary-london`) | kaplan+qs+edvoy | 407 | 700 | 371 | 36 | 329 | 0 | 0 |
| INTO Queen's University Belfast (`into-queens-belfast`) | qs | 351 | 12 | 2 | 349 | 10 | 1 | 0 |
| University of Aberdeen (`aberdeen`) | studygroup+qs | 116 | 252 | 9 | 107 | 243 | 0 | 0 |
| Arizona State University (`arizona-state`) | kaplan+qs+edvoy | 875 | 743 | 634 | 241 | 109 | 0 | 0 |
| Newcastle University (`newcastle-uk`) | qs+edvoy | 184 | 469 | 152 | 32 | 317 | 0 | 0 |
| University of Galway (`galway`) | qs+edvoy | 382 | 342 | 192 | 190 | 150 | 1 | 0 |
| University of Lincoln (`lincoln-uk`) | qs | 206 | 164 | 15 | 191 | 149 | 0 | 0 |
| Kennesaw State University (`kennesaw-state-university`) | edvoy | 339 | 1 | 1 | 338 | 0 | 0 | 0 |
| Kaplan Business School (`kaplan-business-school`) | qs | 324 | 25 | 21 | 303 | 4 | 10 | 0 |
| University of Dundee (`dundee`) | oxford-international+qs+edvoy | 557 | 815 | 520 | 37 | 295 | 0 | 0 |
| De Montfort University Dubai (`de-montfort-dubai`) | qs+edvoy | 290 | 38 | 37 | 253 | 1 | 0 | 7 |

## Расхождение валюты (недостоверность на сайте)

| Вуз | Программ | Источники |
|---|---:|---|
| University of Chester (`chester`) | 23 | kaplan+qs+edvoy |
| University of Wollongong in Dubai (`wollongong-dubai`) | 20 | direct+qs |
| Arden University (`arden`) | 19 | qs+edvoy+iapro |
| Schiller International University (`schiller-international-university`) | 10 | edvoy+gedu |
| University of Reading Malaysia (`reading-malaysia`) | 8 | qs |
| De Montfort University Dubai (`de-montfort-dubai`) | 7 | qs+edvoy |
| University of Birmingham, Dubai (`birmingham-dubai`) | 6 | qs |
| Middlesex University Dubai (`middlesex-dubai`) | 6 | direct+qs+edvoy |
| Curtin Singapore (`curtin-singapore`) | 5 | qs |
| Heriot-Watt University Malaysia (`heriot-watt-malaysia`) | 5 | qs+edvoy |
| Canadian University Dubai (`canadian-university-dubai`) | 4 | qs |
| University of Debrecen (`debrecen`) | 4 | qs |
| Global Banking School (`global-banking-school`) | 3 | edvoy+gedu |
| Murdoch University Dubai (`murdoch-dubai`) | 3 | qs |
| Asia Pacific University of Technology and Innovation (`apu-malaysia`) | 2 | direct+qs+edvoy |
| Hult International Business School (`hult`) | 2 | qs+edvoy |
| University of Niagara Falls Canada (`niagara-falls`) | 1 | qs+edvoy |
| University of Roehampton (`roehampton`) | 1 | qs+edvoy |

