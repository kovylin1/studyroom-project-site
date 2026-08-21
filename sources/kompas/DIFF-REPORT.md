# КОМПАС — сессия 4: расхождения «каталог vs источник»

**Дата:** 2026-08-21 · сети нет, каталог не тронут (только чтение).

## Сводка

| Показатель | Значение |
|---|---|
| Карточек в рабочей копии | 853 |
| Из них партнёрских | 744 (не партнёры: 109) |
| **Сверено с источником** | **607** |
| Сверить не с чем: источник за логином | 0 (QS, IAPro) |
| Сверить не с чем: источник без программ | 11 (Navitas, CATS) |
| Сверить не с чем: источник готов, выгрузки по вузу нет | 126 |
| Программ в каталоге (сверенные вузы) | 96439 |
| Программ у источников (объединение) | 72374 |
| Совпало названий | 65376 (из них по написанию: 706) |
| Есть в каталоге, нет у источника | 31063 |
| Есть у источника, нет в каталоге | 6998 |
| Цена расходится | 459 |
| **Валюта расходится** | **146** |
| У источника цена есть, в каталоге нет | 17108 |
| Кампусы источника, которых нет в карточке | 61 |

Кейсов в панель: **1573** — kompas_no_extract 126, kompas_programs_missing 239, kompas_programs_extra 470, kompas_fee_absent 288, kompas_fee_mismatch 382, kompas_campus_missing 46, kompas_fee_currency 19, kompas_fee_mismatch_rest 2, kompas_source_empty 1.

Потолок поштучных кейсов на вуз — 20; остаток сведён в кейс `kompas_fee_mismatch_rest`, полный список расхождений — в `diff-report.json` (ничего не срезано молча).

## Худшие 40 вузов

| Вуз | Источник | Каталог | Источник, программ | Совпало | Только каталог | Только источник | Цена ≠ | Валюта ≠ |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| University College London (UCL) (`ucl`) | qs | 965 | 11 | 0 | 965 | 11 | 0 | 0 |
| University of Chester (`chester`) | kaplan+qs+edvoy | 1257 | 590 | 589 | 668 | 1 | 3 | 23 |
| Swinburne University of Technology (`swinburne-university-of-technology`) | edvoy | 542 | 1 | 1 | 541 | 0 | 0 | 0 |
| UWE Bristol (`uwe-bristol`) | kaplan+qs+edvoy | 130 | 311 | 92 | 38 | 219 | 91 | 0 |
| Royal Holloway, University of London (`royal-holloway`) | studygroup+qs+edvoy | 499 | 11 | 11 | 488 | 0 | 0 | 0 |
| INTO University of East Anglia (`into-uea`) | qs | 493 | 8 | 8 | 485 | 0 | 0 | 0 |
| INSEEC Business School (`inseec-business-school`) | edvoy | 476 | 7 | 7 | 469 | 0 | 0 | 0 |
| University of Reading Malaysia (`reading-malaysia`) | qs | 396 | 14 | 14 | 382 | 0 | 0 | 8 |
| University of Central Florida (`ucf`) | qs+edvoy | 548 | 147 | 119 | 429 | 28 | 0 | 0 |
| Victoria University of Wellington (`victoria-wellington`) | qs+edvoy | 913 | 481 | 480 | 433 | 1 | 2 | 0 |
| University of Brighton (`brighton`) | kaplan+qs+edvoy | 736 | 398 | 354 | 382 | 44 | 0 | 0 |
| University of Liverpool (`liverpool`) | kaplan+qs+edvoy | 1061 | 773 | 709 | 352 | 64 | 1 | 0 |
| Massey University (`massey`) | qs+edvoy | 765 | 396 | 394 | 371 | 2 | 13 | 0 |
| University of Texas at San Antonio (`utsa`) | qs | 384 | 106 | 50 | 334 | 56 | 6 | 0 |
| University of Sussex (`sussex`) | studygroup+qs+edvoy | 703 | 597 | 458 | 245 | 139 | 0 | 0 |
| University of Nottingham (`nottingham`) | kaplan+qs+edvoy | 964 | 791 | 698 | 266 | 93 | 5 | 0 |
| INTO Queen's University Belfast (`into-queens-belfast`) | qs | 361 | 12 | 12 | 349 | 0 | 1 | 0 |
| University of South Wales (`south-wales`) | qs+edvoy | 813 | 481 | 473 | 340 | 8 | 0 | 0 |
| Kennesaw State University (`kennesaw-state-university`) | edvoy | 339 | 1 | 1 | 338 | 0 | 0 | 0 |
| Arizona State University (`arizona-state`) | kaplan+qs+edvoy | 891 | 743 | 650 | 241 | 93 | 0 | 0 |
| INTO University of Stirling (`into-stirling-uni`) | qs | 378 | 45 | 45 | 333 | 0 | 0 | 0 |
| Kaplan Business School (`kaplan-business-school`) | qs | 328 | 25 | 25 | 303 | 0 | 10 | 0 |
| De Montfort University Dubai (`de-montfort-dubai`) | qs+edvoy | 291 | 38 | 38 | 253 | 0 | 0 | 7 |
| University of Huddersfield London (`university-of-huddersfield-london`) | studygroup+edvoy | 331 | 28 | 28 | 303 | 0 | 0 | 0 |
| Kaplan ANZ (`kaplan-anz`) | edvoy | 318 | 28 | 28 | 290 | 0 | 0 | 0 |
| Arden University (`arden`) | qs+edvoy | 126 | 27 | 27 | 99 | 0 | 0 | 19 |
| Canterbury Christ Church University (`canterbury-christ-church`) | qs+edvoy | 382 | 100 | 100 | 282 | 0 | 0 | 0 |
| University of Nottingham Ningbo China (`nottingham-ningbo`) | qs | 335 | 60 | 60 | 275 | 0 | 1 | 0 |
| Heriot-Watt University Dubai (`heriot-watt-dubai`) | direct+qs+edvoy | 249 | 228 | 100 | 149 | 128 | 0 | 0 |
| SP Jain School of Global Management Dubai (`sp-jain-school-of-global-management-dubai`) | direct | 203 | 152 | 43 | 160 | 109 | 0 | 0 |
| University of Derby (`derby`) | qs+edvoy | 347 | 400 | 240 | 107 | 160 | 0 | 0 |
| Middlesex University Dubai (`middlesex-dubai`) | direct+qs+edvoy | 345 | 201 | 185 | 160 | 16 | 0 | 8 |
| INTO Newcastle University (`into-newcastle`) | qs | 264 | 15 | 15 | 249 | 0 | 1 | 0 |
| University of Roehampton (`roehampton`) | qs+edvoy | 422 | 563 | 372 | 50 | 191 | 0 | 1 |
| Illinois State University (`illinois-state`) | qs+edvoy | 453 | 509 | 358 | 95 | 151 | 1 | 0 |
| University of Strathclyde (`strathclyde`) | studygroup+qs+edvoy | 1068 | 900 | 862 | 206 | 38 | 1 | 0 |
| University of Amsterdam (`amsterdam`) | qs | 250 | 6 | 6 | 244 | 0 | 0 | 0 |
| University of Bath (`bath`) | studygroup+qs+edvoy | 733 | 538 | 520 | 213 | 18 | 2 | 0 |
| Technological University of the Shannon (`tus-shannon`) | qs | 361 | 137 | 133 | 228 | 4 | 1 | 0 |
| University of Wollongong in Dubai (`wollongong-dubai`) | direct+qs | 75 | 52 | 52 | 23 | 0 | 0 | 20 |

## Расхождение валюты (недостоверность на сайте)

| Вуз | Программ | Источники |
|---|---:|---|
| University of Chester (`chester`) | 23 | kaplan+qs+edvoy |
| University of Wollongong in Dubai (`wollongong-dubai`) | 20 | direct+qs |
| Arden University (`arden`) | 19 | qs+edvoy |
| University of Wollongong Malaysia (`wollongong-malaysia`) | 14 | qs |
| Schiller International University (`schiller-international-university`) | 10 | edvoy+gedu |
| Middlesex University Dubai (`middlesex-dubai`) | 8 | direct+qs+edvoy |
| University of Reading Malaysia (`reading-malaysia`) | 8 | qs |
| De Montfort University Dubai (`de-montfort-dubai`) | 7 | qs+edvoy |
| University of Birmingham, Dubai (`birmingham-dubai`) | 6 | qs |
| Curtin Singapore (`curtin-singapore`) | 5 | qs |
| Heriot-Watt University Malaysia (`heriot-watt-malaysia`) | 5 | qs+edvoy |
| Canadian University Dubai (`canadian-university-dubai`) | 4 | qs |
| University of Debrecen (`debrecen`) | 4 | qs |
| Global Banking School (`global-banking-school`) | 3 | edvoy+gedu |
| Hult International Business School (`hult`) | 3 | qs+edvoy |
| Murdoch University Dubai (`murdoch-dubai`) | 3 | qs |
| Asia Pacific University of Technology and Innovation (`apu-malaysia`) | 2 | direct+qs+edvoy |
| EM Normandie Business School — Dubai (`em-normandie-dubai`) | 1 | qs |
| University of Roehampton (`roehampton`) | 1 | qs+edvoy |

