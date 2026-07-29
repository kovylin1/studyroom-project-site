# КОМПАС, сессия 1 — разметка и инвентаризация

**Дата:** 2026-07-22  •  **Каталог:** 807 вузов  •  **Сеть не использовалась**

Живой каталог не изменён. Разметка лежит в рабочей копии `sources/kompas/catalog-work/`.

## Итог разметки

| Тип источника | Вузов | Что значит |
|---|---:|---|
| `direct` | 32 | прямой партнёр — данные берём с офсайта вуза |
| `aggregator` | 682 | партнёр через агрегатор — данные берём с сайта агрегатора |
| `none` | 93 | вне партнёрского списка — нужно ваше решение |

У **180** вузов источник не один — они есть сразу у нескольких агрегаторов. По вашему правилу это одна карточка, программы объединяются. Распределение: 138 вузов у 2, 38 вузов у 3, 4 вузов у 4.

## Покрытие по источникам

| Агрегатор | Правило | Записей в источнике | Сошлось с каталогом | Доступ |
|---|---|---:|---:|---|
| IAPro | явный список | 0 | 0 | login-owner |
| Kaplan Pathways | все вузы | 25 | 25 | open |
| CATS Global Schools | все вузы | 12 | 12 | open |
| QA Higher Education | явный список | 4 | 4 | open |
| Oxford International Education Group | все вузы | 21 | 21 | open |
| Study Group | все вузы | 51 | 44 | login |
| Navitas | все вузы | 10 | 10 | open |
| QS (admissions.qs.com) | явный список | 393 | 393 | login-owner |
| Edvoy (Genie) | все вузы | 411 | 411 | login |
| GEDU Global Education | все вузы | 8 | 8 | login |
| **Прямые партнёры** | список | 35 | 33 | офсайты |

## Список А — вузы каталога вне партнёрского списка

Всего 93. Разбиваются на две очень разные пачки.

### А1. Не вузы вообще — 27 карточек

Это страницы меню и блога Collab International, попавшие в каталог как университеты. Программы у них тоже фиктивные. Ни одна из них не размечена партнёрской — весь мусор сидит именно здесь.

- `academic-coaching` — Academic Coaching
- `admission-consultancy` — Admission Consultancy
- `advanced-placement-ap-exams` — Advanced Placement (AP) Exams
- `berk-alyeni` — Berk Alyeni
- `canadian-universities-to-elevate-your-career` — Canadian Universities to Elevate Your Career
- `data-protection-information` — Data Protection Information
- `dcu-successfull-career-services` — DCU Successfull Career Services
- `exam-prep` — Exam Prep
- `gre-gmat-exams` — GRE - GMAT Exams
- `make-a-comment` — Make a comment
- `master-s-degree-in-dublin-business-school-ireland-the-story-of-our-stu` — Master’s Degree in Dublin Business School, Ireland– The Story of our Student Ceren
- `maximizing-your-educational-pursuits-a-comprehensive-look-at-spring-in` — Maximizing Your Educational Pursuits: A Comprehensive Look at Spring Intake Programs Worldwide
- `medical-degrees-in-europe` — Medical Degrees in Europe
- `mphii-master-of-philosophy` — MPhiI - Master Of Philosophy
- `open-consent-form` — Open Consent Form
- `partner-request-thank-you` — Partner Request. Thank you.
- `partner-with-us` — Partner With Us
- `pte-scores-for-canada` — PTE Scores For Canada
- `sat-exams` — SAT Exams
- `scholarships` — Scholarships
- `services` — Services
- `toefl-exam` — TOEFL Exam
- `toefl-vs-ielts` — TOEFL vs. IELTS
- `trends-shaping-brazilian-students-international-education-preferences-` — Trends Shaping Brazilian Students’ International Education Preferences in 2025
- `types-of-mba` — Types of MBA
- `ucat-exam` — UCAT Exam
- `visa-application` — Visa Application

**Предлагаю:** это кандидаты на удаление, но правило «ничего не удаляем» ваше — решение за вами.

### А2. Настоящие вузы вне списка — 66

| Слаг | Название | Страна | Программ |
|---|---|---|---:|
| `edith-cowan-sl` | Edith Cowan University Sri Lanka | Sri Lanka | 336 |
| `oxford` | University of Oxford | United Kingdom | 212 |
| `western-ontario` | Western University | Canada | 116 |
| `simon-fraser` | Simon Fraser University | Canada | 112 |
| `toronto-met` | Toronto Metropolitan University | Canada | 107 |
| `wilfrid-laurier` | Wilfrid Laurier University | Canada | 107 |
| `victoria` | University of Victoria | Canada | 99 |
| `manitoba` | University of Manitoba | Canada | 98 |
| `srh-germany` | SRH International College | Germany | 82 |
| `canberra` | University of Canberra | Australia | 80 |
| `ted-university` | TED University | Turkey | 56 |
| `fontys-university` | Fontys University of Applied Sciences | Netherlands | 45 |
| `lappeenranta-university-of-technology-lut` | LUT University (Lappeenranta-Lahti University of Technology) | Finland | 44 |
| `acap` | ACAP University College | Australia | 43 |
| `masaryk-university-czech` | Masaryk University | Czech Republic | 43 |
| `warsaw-university-of-technology` | Warsaw University of Technology | Poland | 43 |
| `istinye-university` | İstinye University | Turkey | 42 |
| `naba-milano` | NABA — Nuova Accademia di Belle Arti | Italy | 42 |
| `corvinus-university-of-budapest` | Corvinus University of Budapest | Hungary | 41 |
| `university-of-warsaw` | University of Warsaw | Poland | 41 |
| `czech-technical-university` | Czech Technical University in Prague | Czech Republic | 38 |
| `eastern-mediterranean-university` | Eastern Mediterranean University | Northern Cyprus | 37 |
| `istanbul-altinbas-university` | Altınbaş University | Turkey | 36 |
| `istanbul-isik-university` | Işık University | Turkey | 35 |
| `ozyegin-university` | Özyeğin University | Turkey | 33 |
| `semmelweis-university` | Semmelweis University | Hungary | 32 |
| `universidad-europea-de-madrid` | Universidad Europea de Madrid | Spain | 32 |
| `istanbul-kultur-university` | İstanbul Kültür University | Turkey | 30 |
| `the-campus-bio-medico-university-of-rome-ucbm` | Università Campus Bio-Medico di Roma | Italy | 30 |
| `czech-university-of-life-sciences` | Czech University of Life Sciences Prague | Czech Republic | 29 |
| `istanbul-gelisim-university` | Istanbul Gelişim University | Turkey | 29 |
| `lazarski-university` | Lazarski University | Poland | 29 |
| `southern-denmark-university` | University of Southern Denmark | Denmark | 29 |
| `rome-university-of-fine-arts` | Rome University of Fine Arts (RUFA) | Italy | 28 |
| `bau-global` | Bahçeşehir University (BAU) | Turkey | 27 |
| `universitat-politecnica-de-valencia-upv` | Universitat Politècnica de València (UPV) | Spain | 27 |
| `dli-bandung` | Deakin Lancaster Indonesia | Indonesia | 26 |
| `murdoch` | Murdoch University | Australia | 26 |
| `istanbul-aydin-university` | Istanbul Aydın University | Turkey | 25 |
| `medipol-university` | Istanbul Medipol University | Turkey | 25 |
| `humber-college` | Humber Polytechnic | Canada | 23 |
| `prague-university-of-economics` | Prague University of Economics and Business | Czech Republic | 23 |
| `bilgi-university` | İstanbul Bilgi University | Turkey | 21 |
| `university-of-pecs` | University of Pécs | Hungary | 21 |
| `kaunas-university-of-technology` | Kaunas University of Technology | Lithuania | 20 |
| `montpellier-business-school` | Montpellier Business School | France | 20 |
| `ac-badem-university` | Acıbadem Mehmet Ali Aydınlar University | Turkey | 19 |
| `cctb` | Canadian College of Technology and Business | Canada | 19 |
| `izmir-economics-university` | Izmir University of Economics | Turkey | 19 |
| `mcdaniel-college-budapest` | McDaniel College Budapest | Hungary | 19 |
| `aalto-university` | Aalto University | Finland | 18 |
| `epita-school-of-engineering-and-computer-science` | EPITA - School of Engineering and Computer Science | France | 18 |
| `jagiellonian-university` | Jagiellonian University | Poland | 17 |
| `charles-university` | Charles University | Czech Republic | 16 |
| `aarhus-university` | Aarhus University | Denmark | 15 |
| `university-of-canada-west` | University Canada West | Canada | 15 |
| `istanbul` | Istanbul University | Turkey | 14 |
| `swps-university` | SWPS University | Poland | 14 |
| `trebas` | Trebas Institute | Canada | 14 |
| `centennial-college` | Centennial College | Canada | 13 |
| `university-of-ghent` | Ghent University | Belgium | 13 |
| `technological-university-of-dublin-tu-dublin` | Technological University Dublin | Ireland | 11 |
| `university-of-helsinki` | University of Helsinki | Finland | 11 |
| `langara-college` | Langara College | Canada | 10 |
| `ku-leuven` | KU Leuven | Belgium | 9 |
| `szeged-university` | University of Szeged | Hungary | 9 |

## Список Б — партнёры без карточки в каталоге

| Источник | Название в источнике | Почему не сошлось |
|---|---|---|
| studygroup | Direct Entry University of Chichester Undergraduate | unresolved |
| studygroup | University of Chichester Graduate | unresolved |
| studygroup | University of Chichester Undergraduate | unresolved |
| direct | Aurak unit, Cyprus | unresolved |
| direct | Bilim Univ, Turkey | unresolved |

## Что блокирует

- **iapro** — Документ говорит «11 партнёров, вкладка Marketing Hub», но сами названия нигде локально не записаны. Нужен владелец (логин ранее падал по таймауту) либо выгрузка. Блокирует разметку этих 11 вузов.
