# КОМПАС — сессия 4: расхождения «каталог vs источник»

**Дата:** 2026-07-23 · сети нет, каталог не тронут (только чтение).

## Сводка

| Показатель | Значение |
|---|---|
| Карточек в рабочей копии | 807 |
| Из них партнёрских | 714 (не партнёры: 93) |
| **Сверено с источником** | **433** |
| Сверить не с чем: источник за логином | 225 (QS, IAPro) |
| Сверить не с чем: источник без программ | 11 (Navitas, CATS) |
| Сверить не с чем: источник готов, выгрузки по вузу нет | 45 |
| Программ в каталоге (сверенные вузы) | 56181 |
| Программ у источников (объединение) | 50307 |
| Совпало названий | 35097 (из них по написанию: 310) |
| Есть в каталоге, нет у источника | 21084 |
| Есть у источника, нет в каталоге | 15210 |
| Цена расходится | 2215 |
| **Валюта расходится** | **79** |
| У источника цена есть, в каталоге нет | 25371 |
| Кампусы источника, которых нет в карточке | 96 |

Кейсов в панель: **2103** — kompas_programs_missing 242, kompas_programs_extra 324, kompas_fee_mismatch 1059, kompas_campus_missing 56, kompas_fee_absent 332, kompas_no_extract 45, kompas_fee_currency 11, kompas_fee_mismatch_rest 32, kompas_source_blocked 1, kompas_source_empty 1.

Потолок поштучных кейсов на вуз — 20; остаток сведён в кейс `kompas_fee_mismatch_rest`, полный список расхождений — в `diff-report.json` (ничего не срезано молча).

## Худшие 40 вузов

| Вуз | Источник | Каталог | Источник, программ | Совпало | Только каталог | Только источник | Цена ≠ | Валюта ≠ |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| University of Chester (`chester`) | kaplan+edvoy | 892 | 399 | 168 | 724 | 231 | 0 | 23 |
| Griffith University (`griffith`) | edvoy | 99 | 915 | 49 | 50 | 866 | 46 | 0 |
| University of Lancashire (`university-of-lancashire`) | edvoy | 400 | 330 | 278 | 122 | 52 | 251 | 0 |
| Victoria University of Wellington (`victoria-wellington`) | edvoy | 496 | 445 | 57 | 439 | 388 | 25 | 0 |
| University of Glasgow (`glasgow`) | kaplan+oxford-international+edvoy | 641 | 531 | 524 | 117 | 7 | 242 | 0 |
| Heriot-Watt University Dubai (`heriot-watt-dubai`) | direct+edvoy | 28 | 689 | 13 | 15 | 676 | 0 | 0 |
| La Trobe University (`la-trobe`) | edvoy | 83 | 564 | 30 | 53 | 534 | 23 | 0 |
| University of Essex (`essex`) | kaplan+edvoy | 841 | 825 | 794 | 47 | 31 | 185 | 0 |
| University of Dundee (`dundee`) | oxford-international+edvoy | 84 | 514 | 41 | 43 | 473 | 37 | 0 |
| Swansea University (`swansea`) | edvoy | 69 | 507 | 38 | 31 | 469 | 32 | 0 |
| The University of Sydney (`sydney`) | edvoy | 103 | 435 | 64 | 39 | 371 | 58 | 0 |
| Swinburne University of Technology (`swinburne-university-of-technology`) | edvoy | 541 | 1 | 0 | 541 | 1 | 0 | 0 |
| Massey University (`massey`) | edvoy | 528 | 284 | 142 | 386 | 142 | 1 | 0 |
| University of Liverpool (`liverpool`) | kaplan+edvoy | 867 | 540 | 440 | 427 | 100 | 0 | 0 |
| University of Otago (`otago`) | edvoy | 15 | 515 | 3 | 12 | 512 | 0 | 0 |
| Arizona State University (`arizona-state`) | kaplan+edvoy | 875 | 639 | 632 | 243 | 7 | 91 | 0 |
| University of Greenwich (`greenwich`) | oxford-international+edvoy | 83 | 396 | 40 | 43 | 356 | 36 | 0 |
| University of Portsmouth (`portsmouth`) | edvoy | 67 | 430 | 27 | 40 | 403 | 20 | 0 |
| University of Waikato (`waikato`) | edvoy | 88 | 411 | 3 | 85 | 408 | 2 | 0 |
| Royal Holloway, University of London (`royal-holloway`) | studygroup+edvoy | 485 | 11 | 0 | 485 | 11 | 0 | 0 |
| University of Plymouth (`plymouth`) | edvoy | 64 | 397 | 28 | 36 | 369 | 24 | 0 |
| University of Central Florida (`ucf`) | edvoy | 542 | 81 | 81 | 461 | 0 | 4 | 0 |
| INSEEC Business School (`inseec-business-school`) | edvoy | 475 | 7 | 6 | 469 | 1 | 0 | 0 |
| University of Hertfordshire (`hertfordshire`) | edvoy | 63 | 391 | 31 | 32 | 360 | 23 | 0 |
| Edinburgh Napier University (`edinburgh-napier`) | edvoy | 211 | 148 | 138 | 73 | 10 | 125 | 0 |
| Anglo-American University (`anglo-american-university`) | direct | 14 | 422 | 2 | 12 | 420 | 0 | 0 |
| University of Brighton (`brighton`) | kaplan+edvoy | 565 | 173 | 162 | 403 | 11 | 0 | 0 |
| Bangor University (`bangor`) | oxford-international+edvoy | 71 | 308 | 37 | 34 | 271 | 34 | 0 |
| Keele University (`keele`) | edvoy | 64 | 323 | 30 | 34 | 293 | 25 | 0 |
| SP Jain School of Global Management Dubai (`sp-jain-school-of-global-management-dubai`) | direct | 109 | 317 | 12 | 97 | 305 | 0 | 0 |
| Manchester Metropolitan University (`manchester-met`) | edvoy | 66 | 288 | 31 | 35 | 257 | 31 | 0 |
| University of Nottingham (`nottingham`) | kaplan+edvoy | 574 | 399 | 300 | 274 | 99 | 4 | 0 |
| Ulster University (`ulster`) | qahe+oxford-international+edvoy | 88 | 260 | 37 | 51 | 223 | 32 | 1 |
| Birmingham City University (`birmingham-city`) | edvoy | 72 | 273 | 32 | 40 | 241 | 32 | 0 |
| University of Reading (`reading`) | edvoy | 21 | 356 | 3 | 18 | 353 | 2 | 0 |
| INTO Partnerships (`into-partnerships`) | edvoy | 598 | 940 | 592 | 6 | 348 | 0 | 0 |
| University of South Wales (`south-wales`) | edvoy | 576 | 237 | 236 | 340 | 1 | 0 | 0 |
| University of Bradford (`bradford`) | oxford-international+edvoy | 73 | 248 | 27 | 46 | 221 | 24 | 0 |
| Kennesaw State University (`kennesaw-state-university`) | edvoy | 339 | 1 | 1 | 338 | 0 | 0 | 0 |
| De Montfort University Dubai (`de-montfort-dubai`) | edvoy | 290 | 24 | 24 | 266 | 0 | 0 | 7 |

## Расхождение валюты (недостоверность на сайте)

| Вуз | Программ | Источники |
|---|---:|---|
| University of Chester (`chester`) | 23 | kaplan+edvoy |
| Arden University (`arden`) | 19 | edvoy |
| Schiller International University (`schiller-international-university`) | 10 | edvoy+gedu |
| De Montfort University Dubai (`de-montfort-dubai`) | 7 | edvoy |
| Middlesex University Dubai (`middlesex-dubai`) | 6 | direct+edvoy |
| Heriot-Watt University Malaysia (`heriot-watt-malaysia`) | 4 | edvoy |
| Global Banking School (`global-banking-school`) | 3 | edvoy+gedu |
| Asia Pacific University of Technology and Innovation (`apu-malaysia`) | 2 | direct+edvoy |
| BHMS — Business and Hotel Management School (`bhms`) | 2 | edvoy |
| Hult International Business School (`hult`) | 2 | edvoy |
| Ulster University (`ulster`) | 1 | qahe+oxford-international+edvoy |

