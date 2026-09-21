# КОМПАС — сессия 4: расхождения «каталог vs источник»

**Дата:** 2026-09-21 · сети нет, каталог не тронут (только чтение).

## Сводка

| Показатель | Значение |
|---|---|
| Карточек в рабочей копии | 1076 |
| Из них партнёрских | 962 (не партнёры: 114) |
| **Сверено с источником** | **830** |
| Сверить не с чем: источник за логином | 0 (QS, IAPro) |
| Сверить не с чем: источник без программ | 11 (Navitas, CATS) |
| Сверить не с чем: источник готов, выгрузки по вузу нет | 121 |
| Программ в каталоге (сверенные вузы) | 113442 |
| Программ у источников (объединение) | 79573 |
| Совпало названий | 75871 (из них по написанию: 179) |
| Есть в каталоге, нет у источника | 37571 |
| Есть у источника, нет в каталоге | 3702 |
| Цена расходится | 1541 |
| **Валюта расходится** | **2295** |
| У источника цена есть, в каталоге нет | 191 |
| Кампусы источника, которых нет в карточке | 410 |

Кейсов в панель: **1872** — kompas_no_extract 121, kompas_programs_missing 190, kompas_programs_extra 518, kompas_campus_missing 241, kompas_fee_currency 79, kompas_fee_absent 46, kompas_fee_mismatch 663, kompas_fee_mismatch_rest 13, kompas_source_empty 1.

Потолок поштучных кейсов на вуз — 20; остаток сведён в кейс `kompas_fee_mismatch_rest`, полный список расхождений — в `diff-report.json` (ничего не срезано молча).

## Худшие 40 вузов

| Вуз | Источник | Каталог | Источник, программ | Совпало | Только каталог | Только источник | Цена ≠ | Валюта ≠ |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| INTO Partnerships (`into-partnerships`) | edvoy | 1721 | 832 | 804 | 917 | 28 | 0 | 416 |
| Navitas (`navitas`) | edvoy | 507 | 572 | 291 | 216 | 281 | 0 | 183 |
| University of Roehampton (`roehampton`) | qs+edvoy | 586 | 575 | 496 | 90 | 79 | 10 | 189 |
| Middlesex University Dubai (`middlesex-dubai`) | direct+qs+edvoy | 346 | 201 | 182 | 164 | 19 | 0 | 138 |
| Asia Pacific University of Technology and Innovation (`apu-malaysia`) | direct+qs+edvoy | 233 | 186 | 181 | 52 | 5 | 0 | 142 |
| Arizona State University (`arizona-state`) | kaplan+qs+edvoy | 949 | 768 | 696 | 253 | 72 | 359 | 6 |
| University of Birmingham, Dubai (`birmingham-dubai`) | qs | 236 | 103 | 103 | 133 | 0 | 0 | 103 |
| KAPLAN (`kaplan`) | edvoy | 1237 | 921 | 558 | 679 | 363 | 0 | 8 |
| University College London (UCL) (`ucl`) | qs | 977 | 11 | 11 | 966 | 0 | 0 | 0 |
| VIZJA University (`vizja-university`) | edvoy | 93 | 93 | 93 | 0 | 0 | 0 | 93 |
| University of Nottingham Malaysia (`university-of-nottingham-malaysia`) | edvoy | 82 | 78 | 78 | 4 | 0 | 0 | 78 |
| University of Debrecen (`debrecen`) | qs | 109 | 69 | 68 | 41 | 1 | 0 | 68 |
| University of Chester (`chester`) | kaplan+qs+edvoy | 1274 | 554 | 554 | 720 | 0 | 0 | 0 |
| Murdoch University Dubai (`murdoch-dubai`) | qs | 110 | 59 | 59 | 51 | 0 | 0 | 59 |
| De Montfort University Dubai (`de-montfort-dubai`) | qs+edvoy | 294 | 38 | 38 | 256 | 0 | 0 | 38 |
| Rutgers University Camden (`rutgers-university-camden`) | edvoy | 59 | 61 | 59 | 0 | 2 | 0 | 59 |
| Massey University (`massey`) | qs+edvoy | 903 | 397 | 397 | 506 | 0 | 23 | 0 |
| University of Wollongong Malaysia (`wollongong-malaysia`) | qs | 113 | 51 | 51 | 62 | 0 | 0 | 50 |
| University of Wollongong in Dubai (`wollongong-dubai`) | direct+qs | 78 | 52 | 52 | 26 | 0 | 0 | 52 |
| The University of Western Australia (`the-university-of-western-australia`) | edvoy | 859 | 316 | 316 | 543 | 0 | 0 | 0 |
| Swinburne University of Technology (`swinburne-university-of-technology`) | edvoy | 542 | 1 | 1 | 541 | 0 | 0 | 0 |
| Victoria University of Wellington (`victoria-wellington`) | qs+edvoy | 961 | 483 | 481 | 480 | 2 | 18 | 0 |
| University of Reading Malaysia (`reading-malaysia`) | qs | 400 | 14 | 14 | 386 | 0 | 0 | 14 |
| Royal Holloway, University of London (`royal-holloway`) | studygroup+qs+edvoy | 499 | 11 | 11 | 488 | 0 | 1 | 0 |
| INTO University of East Anglia (`into-uea`) | qs | 493 | 8 | 8 | 485 | 0 | 0 | 0 |
| East Asia Institute of Management (EAIM) (`eaim`) | qs | 112 | 40 | 40 | 72 | 0 | 0 | 40 |
| INSEEC Business School (`inseec-business-school`) | edvoy | 476 | 8 | 8 | 468 | 0 | 0 | 0 |
| California State University East Bay (`california-state-university-east-bay`) | edvoy | 155 | 154 | 154 | 1 | 0 | 154 | 0 |
| University of Central Florida (`ucf`) | qs+edvoy | 577 | 147 | 144 | 433 | 3 | 0 | 0 |
| University of South Wales (`south-wales`) | qs+edvoy | 893 | 514 | 506 | 387 | 8 | 12 | 0 |
| Heriot-Watt University Malaysia (`heriot-watt-malaysia`) | qs+edvoy | 110 | 40 | 36 | 74 | 4 | 0 | 35 |
| Bournemouth University (`bournemouth`) | kaplan+qs+edvoy | 311 | 458 | 245 | 66 | 213 | 45 | 0 |
| University of Glasgow (`glasgow`) | kaplan+oxford-international+qs+edvoy | 928 | 814 | 807 | 121 | 7 | 94 | 0 |
| Fairleigh Dickinson University, Vancouver (`fairleigh-dickinson-university-vancouver`) | edvoy | 231 | 19 | 19 | 212 | 0 | 0 | 19 |
| Seneca Polytechnic (`seneca`) | qs+edvoy | 357 | 218 | 88 | 269 | 130 | 0 | 0 |
| University of Liverpool (`liverpool`) | kaplan+qs+edvoy | 1051 | 775 | 737 | 314 | 38 | 11 | 0 |
| University of Brighton (`brighton`) | kaplan+qs+edvoy | 781 | 398 | 398 | 383 | 0 | 0 | 0 |
| Abu Dhabi University (`abu-dhabi-university`) | direct+qs | 111 | 30 | 30 | 81 | 0 | 0 | 30 |
| Rochester Institute of Technology — Dubai (`rit-dubai`) | qs | 191 | 21 | 20 | 171 | 1 | 0 | 20 |
| Arden University (`arden`) | qs+edvoy | 122 | 27 | 27 | 95 | 0 | 0 | 27 |

## Расхождение валюты (недостоверность на сайте)

| Вуз | Программ | Источники |
|---|---:|---|
| INTO Partnerships (`into-partnerships`) | 416 | edvoy |
| University of Roehampton (`roehampton`) | 189 | qs+edvoy |
| Navitas (`navitas`) | 183 | edvoy |
| Asia Pacific University of Technology and Innovation (`apu-malaysia`) | 142 | direct+qs+edvoy |
| Middlesex University Dubai (`middlesex-dubai`) | 138 | direct+qs+edvoy |
| University of Birmingham, Dubai (`birmingham-dubai`) | 103 | qs |
| VIZJA University (`vizja-university`) | 93 | edvoy |
| University of Nottingham Malaysia (`university-of-nottingham-malaysia`) | 78 | edvoy |
| University of Debrecen (`debrecen`) | 68 | qs |
| Murdoch University Dubai (`murdoch-dubai`) | 59 | qs |
| Rutgers University Camden (`rutgers-university-camden`) | 59 | edvoy |
| University of Wollongong in Dubai (`wollongong-dubai`) | 52 | direct+qs |
| University of Wollongong Malaysia (`wollongong-malaysia`) | 50 | qs |
| East Asia Institute of Management (EAIM) (`eaim`) | 40 | qs |
| De Montfort University Dubai (`de-montfort-dubai`) | 38 | qs+edvoy |
| Heriot-Watt University Malaysia (`heriot-watt-malaysia`) | 35 | qs+edvoy |
| Abu Dhabi University (`abu-dhabi-university`) | 30 | direct+qs |
| AMITY University (Dubai) (`amity-university-dubai`) | 28 | direct+edvoy |
| Arden University (`arden`) | 27 | qs+edvoy |
| Middlesex University Mauritius (`middlesex-university-mauritius`) | 26 | edvoy |
| IBS International Business School (`ibs-international-business-school`) | 24 | edvoy |
| Canadian University Dubai (`canadian-university-dubai`) | 21 | qs |
| Rochester Institute of Technology — Dubai (`rit-dubai`) | 20 | qs |
| American University in Dubai (`aud`) | 19 | qs |
| Fairleigh Dickinson University, Vancouver (`fairleigh-dickinson-university-vancouver`) | 19 | edvoy |
| University of Birmingham (`birmingham`) | 18 | kaplan+oxford-international+qs+edvoy |
| Curtin Singapore (`curtin-singapore`) | 17 | qs |
| EU Business School (`eu-business-school`) | 17 | edvoy |
| DeMont Institute of Management & Technology (`demont-institute-of-management-and-technology`) | 16 | edvoy |
| American Institute of Applied Sciences in Switzerland (`american-institute-of-applied-sciences-in-switzerland`) | 15 | edvoy |
| Global Banking School (`global-banking-school`) | 14 | edvoy+gedu |
| Helvetic Business School (`helvetic-business-school`) | 14 | edvoy |
| University of Reading Malaysia (`reading-malaysia`) | 14 | qs |
| UP Education (`up-education`) | 14 | edvoy |
| HTMi - International Hotel and Tourism Institute (Switzerland) (`htmi-international-hotel-and-tourism-institute-switzerland`) | 13 | edvoy |
| International University of Monaco (`international-university-of-monaco`) | 13 | edvoy |
| ILSC (`ilsc`) | 12 | edvoy |
| Schiller International University (`schiller-international-university`) | 11 | edvoy+gedu |
| Budapest University of Economics and Business (`budapest-university-of-economics-and-business`) | 10 | edvoy |
| FAD Institute of Luxury Fashion & Style (`fad-institute-dubai`) | 10 | qs |
| KAPLAN (`kaplan`) | 8 | edvoy |
| Study Group (`study-group`) | 8 | edvoy |
| University of Stirling Ras Al Khaimah (`university-of-stirling-ras-al-khaimah`) | 8 | edvoy |
| University of Waikato (`waikato`) | 8 | qs+edvoy |
| Hult International Business School (`hult`) | 7 | qs+edvoy |
| Swiss Hotel Management School (`swiss-hotel-management-school`) | 7 | edvoy |
| Vibe Education (`vibe-education`) | 7 | edvoy |
| Arizona State University (`arizona-state`) | 6 | kaplan+qs+edvoy |
| Culinary Arts Academy Switzerland (`culinary-arts-academy-switzerland`) | 6 | edvoy |
| Glion Institute of Higher Education (`glion-switzerland`) | 6 | qs |
| Oxford International (`oxford-international`) | 6 | edvoy |
| UE - University of Europe for Applied Sciences (`ue-university-of-europe-for-applied-sciences`) | 5 | edvoy |
| Universidade Europeia (`universidade-europeia`) | 5 | edvoy |
| The University College of Enterprise and Administration (`the-university-college-of-enterprise-and-administration`) | 4 | edvoy |
| Cesar Ritz Colleges (`cesar-ritz-colleges`) | 3 | edvoy |
| GlobalU (`globalu`) | 3 | edvoy |
| Les Roches Crans-Montana (`les-roches-crans-montana`) | 3 | qs |
| Universiti Kuala Lumpur (`universiti-kuala-lumpur`) | 3 | edvoy |
| University of Wollongong (`university-of-wollongong`) | 3 | edvoy |
| EC English (`ec-english`) | 2 | edvoy |
| HIM Business School (`him-business-school`) | 2 | edvoy |
| St George's University (Grenada) (`st-georges-grenada`) | 2 | qs |
| Taylor's University (`taylor-s-university`) | 2 | edvoy |
| Curtin University Dubai (`curtin-university-dubai`) | 1 | direct |
| Dublin Business School (`dublin-business-school`) | 1 | edvoy |
| Dublin City University (`dublin-city-university`) | 1 | edvoy |
| EM Normandie Business School — Dubai (`em-normandie-dubai`) | 1 | qs |
| GISMA University of Applied Sciences (`gisma`) | 1 | direct+edvoy |
| Heriot-Watt University Dubai (`heriot-watt-dubai`) | 1 | direct+qs+edvoy |
| Northeastern University (`northeastern-university`) | 1 | edvoy |
| Queen Mary University of London (`queen-mary-london`) | 1 | kaplan+qs+edvoy |
| Queen's University Belfast (`queens-university-belfast`) | 1 | edvoy |
| Royal College of Surgeons in Ireland (RCSI) (`rcsi`) | 1 | qs |
| Sacred Heart University (`sacred-heart-university`) | 1 | edvoy |
| The University of Queensland (`the-university-of-queensland`) | 1 | edvoy |
| Trinity College Dublin (`trinity-dublin`) | 1 | qs+edvoy |
| University of Niagara Falls (`university-of-niagara-falls`) | 1 | edvoy |
| Washington State University (`washington-state`) | 1 | qs+edvoy |
| York St John University (`york-st-john-university`) | 1 | edvoy |

