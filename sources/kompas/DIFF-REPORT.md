# КОМПАС — сессия 4: расхождения «каталог vs источник»

**Дата:** 2026-07-24 · сети нет, каталог не тронут (только чтение).

## Сводка

| Показатель | Значение |
|---|---|
| Карточек в рабочей копии | 823 |
| Из них партнёрских | 708 (не партнёры: 115) |
| **Сверено с источником** | **462** |
| Сверить не с чем: источник за логином | 227 (QS, IAPro) |
| Сверить не с чем: источник без программ | 11 (Navitas, CATS) |
| Сверить не с чем: источник готов, выгрузки по вузу нет | 8 |
| Программ в каталоге (сверенные вузы) | 71558 |
| Программ у источников (объединение) | 51731 |
| Совпало названий | 49937 (из них по написанию: 356) |
| Есть в каталоге, нет у источника | 21621 |
| Есть у источника, нет в каталоге | 1794 |
| Цена расходится | 1831 |
| **Валюта расходится** | **92** |
| У источника цена есть, в каталоге нет | 1720 |
| Кампусы источника, которых нет в карточке | 96 |

Кейсов в панель: **1321** — kompas_programs_extra 333, kompas_campus_missing 56, kompas_fee_mismatch 785, kompas_fee_absent 48, kompas_programs_missing 57, kompas_fee_currency 11, kompas_fee_mismatch_rest 21, kompas_no_extract 8, kompas_source_blocked 1, kompas_source_empty 1.

Потолок поштучных кейсов на вуз — 20; остаток сведён в кейс `kompas_fee_mismatch_rest`, полный список расхождений — в `diff-report.json` (ничего не срезано молча).

## Худшие 40 вузов

| Вуз | Источник | Каталог | Источник, программ | Совпало | Только каталог | Только источник | Цена ≠ | Валюта ≠ |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| University of Chester (`chester`) | kaplan+edvoy | 1123 | 399 | 399 | 724 | 0 | 0 | 23 |
| University of Lancashire (`university-of-lancashire`) | edvoy | 452 | 330 | 330 | 122 | 0 | 251 | 0 |
| University of Glasgow (`glasgow`) | kaplan+oxford-international+edvoy | 648 | 531 | 531 | 117 | 0 | 242 | 0 |
| University of Essex (`essex`) | kaplan+edvoy | 872 | 825 | 825 | 47 | 0 | 185 | 0 |
| Swinburne University of Technology (`swinburne-university-of-technology`) | edvoy | 542 | 1 | 1 | 541 | 0 | 0 | 0 |
| Arizona State University (`arizona-state`) | kaplan+edvoy | 875 | 639 | 632 | 243 | 7 | 91 | 0 |
| Victoria University of Wellington (`victoria-wellington`) | edvoy | 883 | 445 | 444 | 439 | 1 | 25 | 0 |
| Royal Holloway, University of London (`royal-holloway`) | studygroup+edvoy | 496 | 11 | 11 | 485 | 0 | 0 | 0 |
| Heriot-Watt University Dubai (`heriot-watt-dubai`) | direct+edvoy | 239 | 689 | 224 | 15 | 465 | 0 | 0 |
| University of Central Florida (`ucf`) | edvoy | 542 | 81 | 81 | 461 | 0 | 4 | 0 |
| INSEEC Business School (`inseec-business-school`) | edvoy | 476 | 7 | 7 | 469 | 0 | 0 | 0 |
| Edinburgh Napier University (`edinburgh-napier`) | edvoy | 221 | 148 | 148 | 73 | 0 | 125 | 0 |
| University of Liverpool (`liverpool`) | kaplan+edvoy | 967 | 540 | 540 | 427 | 0 | 0 | 0 |
| University of Brighton (`brighton`) | kaplan+edvoy | 565 | 173 | 162 | 403 | 11 | 0 | 0 |
| Massey University (`massey`) | edvoy | 670 | 284 | 284 | 386 | 0 | 1 | 0 |
| Anglo-American University (`anglo-american-university`) | direct | 66 | 422 | 54 | 12 | 368 | 0 | 0 |
| University of South Wales (`south-wales`) | edvoy | 577 | 237 | 237 | 340 | 0 | 0 | 0 |
| Kennesaw State University (`kennesaw-state-university`) | edvoy | 339 | 1 | 1 | 338 | 0 | 0 | 0 |
| De Montfort University Dubai (`de-montfort-dubai`) | edvoy | 290 | 24 | 24 | 266 | 0 | 0 | 7 |
| SP Jain School of Global Management Dubai (`sp-jain-school-of-global-management-dubai`) | direct | 203 | 317 | 106 | 97 | 211 | 0 | 0 |
| University of Huddersfield London (`university-of-huddersfield-london`) | studygroup+edvoy | 331 | 28 | 28 | 303 | 0 | 0 | 0 |
| University of Westminster (`westminster`) | kaplan+edvoy | 331 | 312 | 312 | 19 | 0 | 93 | 0 |
| Kaplan ANZ (`kaplan-anz`) | edvoy | 318 | 28 | 28 | 290 | 0 | 0 | 0 |
| Arden University (`arden`) | edvoy+iapro | 126 | 28 | 28 | 98 | 0 | 0 | 19 |
| University of Nottingham (`nottingham`) | kaplan+edvoy | 671 | 399 | 397 | 274 | 2 | 4 | 0 |
| Aston University (`aston`) | edvoy | 269 | 194 | 194 | 75 | 0 | 61 | 0 |
| University of Sussex (`sussex`) | studygroup+edvoy | 556 | 310 | 310 | 246 | 0 | 0 | 0 |
| Middlesex University Dubai (`middlesex-dubai`) | direct+edvoy | 288 | 144 | 125 | 163 | 19 | 0 | 6 |
| University of Strathclyde (`strathclyde`) | studygroup+edvoy | 636 | 408 | 408 | 228 | 0 | 3 | 0 |
| Pace University (`pace`) | kaplan+edvoy | 285 | 102 | 102 | 183 | 0 | 17 | 0 |
| The University of Sydney (`sydney`) | edvoy | 460 | 435 | 421 | 39 | 14 | 58 | 0 |
| University of Bath (`bath`) | studygroup+edvoy | 514 | 298 | 298 | 216 | 0 | 1 | 0 |
| Southern Cross University (`southern-cross-university`) | edvoy | 271 | 56 | 56 | 215 | 0 | 0 | 0 |
| Fairleigh Dickinson University, Vancouver (`fairleigh-dickinson-university-vancouver`) | edvoy | 231 | 19 | 19 | 212 | 0 | 0 | 0 |
| Canterbury Christ Church University (`canterbury-christ-church`) | edvoy+iapro | 382 | 186 | 186 | 196 | 0 | 3 | 0 |
| BHMS — Business and Hotel Management School (`bhms`) | edvoy | 66 | 15 | 15 | 51 | 0 | 0 | 15 |
| KAPLAN (`kaplan`) | edvoy | 681 | 496 | 496 | 185 | 0 | 5 | 0 |
| Griffith College (`griffith-ireland`) | edvoy | 195 | 9 | 9 | 186 | 0 | 4 | 0 |
| University of Galway (`galway`) | edvoy | 382 | 186 | 186 | 196 | 0 | 0 | 0 |
| Griffith University (`griffith`) | edvoy | 963 | 915 | 913 | 50 | 2 | 46 | 0 |

## Расхождение валюты (недостоверность на сайте)

| Вуз | Программ | Источники |
|---|---:|---|
| University of Chester (`chester`) | 23 | kaplan+edvoy |
| Arden University (`arden`) | 19 | edvoy+iapro |
| BHMS — Business and Hotel Management School (`bhms`) | 15 | edvoy |
| Schiller International University (`schiller-international-university`) | 10 | edvoy+gedu |
| De Montfort University Dubai (`de-montfort-dubai`) | 7 | edvoy |
| Middlesex University Dubai (`middlesex-dubai`) | 6 | direct+edvoy |
| Heriot-Watt University Malaysia (`heriot-watt-malaysia`) | 4 | edvoy |
| Global Banking School (`global-banking-school`) | 3 | edvoy+gedu |
| Asia Pacific University of Technology and Innovation (`apu-malaysia`) | 2 | direct+edvoy |
| Hult International Business School (`hult`) | 2 | edvoy |
| University of Niagara Falls Canada (`niagara-falls`) | 1 | edvoy |

