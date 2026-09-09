# КОМПАС, сессия 1 — разметка и инвентаризация

**Дата:** 2026-08-21  •  **Каталог:** 853 вузов  •  **Сеть не использовалась**

Живой каталог не изменён. Разметка лежит в рабочей копии `sources/kompas/catalog-work/`.

## Итог разметки

| Тип источника | Вузов | Что значит |
|---|---:|---|
| `direct` | 32 | прямой партнёр — данные берём с офсайта вуза |
| `aggregator` | 682 | партнёр через агрегатор — данные берём с сайта агрегатора |
| `none` | 139 | вне партнёрского списка — нужно ваше решение |

У **180** вузов источник не один — они есть сразу у нескольких агрегаторов. По вашему правилу это одна карточка, программы объединяются. Распределение: 137 вузов у 2, 38 вузов у 3, 5 вузов у 4.

## Покрытие по источникам

| Агрегатор | Правило | Записей в источнике | Сошлось с каталогом | Доступ |
|---|---|---:|---:|---|
| IAPro | явный список | 0 | 0 | login-owner |
| Kaplan Pathways | все вузы | 25 | 25 | open |
| CATS Global Schools | все вузы | 12 | 12 | open |
| QA Higher Education | явный список | 6 | 6 | open |
| Oxford International Education Group | все вузы | 21 | 21 | open |
| Study Group | все вузы | 51 | 44 | login |
| Navitas | все вузы | 10 | 10 | open |
| QS (admissions.qs.com) | явный список | 393 | 393 | login-owner |
| Edvoy (Genie) | все вузы | 411 | 411 | login |
| GEDU Global Education | все вузы | 8 | 8 | login |
| **Прямые партнёры** | список | 35 | 33 | офсайты |

## Список А — вузы каталога вне партнёрского списка

Всего 139. Разбиваются на две очень разные пачки.

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

### А2. Настоящие вузы вне списка — 112

| Слаг | Название | Страна | Программ |
|---|---|---|---:|
| `edith-cowan-sl` | Edith Cowan University Sri Lanka | Sri Lanka | 336 |
| `oxford` | University of Oxford | United Kingdom | 212 |
| `catholic-university-of-america` | The Catholic University of America | United States | 191 |
| `western-ontario` | Western University | Canada | 116 |
| `simon-fraser` | Simon Fraser University | Canada | 112 |
| `university-of-worcester` | University of Worcester | United Kingdom | 108 |
| `kwantlen-polytechnic-university` | Kwantlen Polytechnic University | Canada | 107 |
| `toronto-met` | Toronto Metropolitan University | Canada | 107 |
| `wilfrid-laurier` | Wilfrid Laurier University | Canada | 107 |
| `victoria` | University of Victoria | Canada | 99 |
| `manitoba` | University of Manitoba | Canada | 98 |
| `falmouth-university` | Falmouth University | United Kingdom | 93 |
| `marshall-university` | Marshall University | United States | 85 |
| `srh-germany` | SRH International College | Germany | 82 |
| `canberra` | University of Canberra | Australia | 80 |
| `hartpury` | Hartpury University | United Kingdom | 74 |
| `fleming-college-toronto` | Fleming College Toronto | Canada | 73 |
| `mercy-university` | Mercy University | United States | 68 |
| `elmira-college` | Elmira College | United States | 57 |
| `ted-university` | TED University | Turkey | 56 |
| `george-brown` | George Brown Polytechnic | Canada | 53 |
| `northumbria-university-london-campus-qahe` | Northumbria University London campus (QAHE) | United Kingdom | 50 |
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
| `london-school-of-business-and-finance` | London School of Business and Finance | United Kingdom | 37 |
| `istanbul-altinbas-university` | Altınbaş University | Turkey | 36 |
| `istanbul-isik-university` | Işık University | Turkey | 35 |
| `ozyegin-university` | Özyeğin University | Turkey | 33 |
| `semmelweis-university` | Semmelweis University | Hungary | 32 |
| `universidad-europea-de-madrid` | Universidad Europea de Madrid | Spain | 32 |
| `humber-college` | Humber Polytechnic | Canada | 30 |
| `istanbul-kultur-university` | İstanbul Kültür University | Turkey | 30 |
| `the-campus-bio-medico-university-of-rome-ucbm` | Università Campus Bio-Medico di Roma | Italy | 30 |
| `czech-university-of-life-sciences` | Czech University of Life Sciences Prague | Czech Republic | 29 |
| `istanbul-gelisim-university` | Istanbul Gelişim University | Turkey | 29 |
| `lazarski-university` | Lazarski University | Poland | 29 |
| `southern-denmark-university` | University of Southern Denmark | Denmark | 29 |
| `rome-university-of-fine-arts` | Rome University of Fine Arts (RUFA) | Italy | 28 |
| `bau-global` | Bahçeşehir University (BAU) | Turkey | 27 |
| `universitat-politecnica-de-valencia-upv` | Universitat Politècnica de València (UPV) | Spain | 27 |
| `bentley-university` | Bentley University | United States | 26 |
| `dli-bandung` | Deakin Lancaster Indonesia | Indonesia | 26 |
| `murdoch` | Murdoch University | Australia | 26 |
| `florida-memorial-university` | Florida Memorial University | United States | 25 |
| `istanbul-aydin-university` | Istanbul Aydın University | Turkey | 25 |
| `medipol-university` | Istanbul Medipol University | Turkey | 25 |
| `trebas` | Trebas Institute | Canada | 24 |
| `american-university-of-ras-al-khaimah-aurak` | American University of Ras Al Khaimah (AURAK) | United Arab Emirates | 23 |
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
| `university-of-gloucestershire` | University of Gloucestershire | United Kingdom | 18 |
| `jagiellonian-university` | Jagiellonian University | Poland | 17 |
| `metropolitan-college-of-new-york` | Metropolitan College of New York | United States | 17 |
| `charles-university` | Charles University | Czech Republic | 16 |
| `aarhus-university` | Aarhus University | Denmark | 15 |
| `university-of-canada-west` | University Canada West | Canada | 15 |
| `istanbul` | Istanbul University | Turkey | 14 |
| `oncampus-aston-foundation` | OnCampus Aston – Foundation | United Kingdom | 14 |
| `swps-university` | SWPS University | Poland | 14 |
| `westminster-international-university-in-tashkent` | Westminster International University in Tashkent | Uzbekistan | 14 |
| `centennial-college` | Centennial College | Canada | 13 |
| `toronto-school-of-management` | Toronto School of Management | Canada | 13 |
| `university-of-ghent` | Ghent University | Belgium | 13 |
| `swinburne-university-foundation` | Swinburne University - Foundation | Australia | 12 |
| `technological-university-of-dublin-tu-dublin` | Technological University Dublin | Ireland | 11 |
| `university-of-helsinki` | University of Helsinki | Finland | 11 |
| `langara-college` | Langara College | Canada | 10 |
| `ku-leuven` | KU Leuven | Belgium | 9 |
| `szeged-university` | University of Szeged | Hungary | 9 |
| `niagara-college-toronto` | Niagara College - Toronto | Canada | 8 |
| `university-of-the-west-of-england-bristol-international-college-uwe-bristol-foun` | University of the West of England, Bristol International College (UWE Bristol) - Foundation | United Kingdom | 7 |
| `university-of-york-international-pathway-college-foundation` | University of York International Pathway College - Foundation | United Kingdom | 7 |
| `oncampus-hull-foundation` | OnCampus Hull - Foundation | United Kingdom | 6 |
| `oncampus-southampton-pathway` | OnCampus Southampton - Pathway | United Kingdom | 6 |
| `pepperdine-university` | Pepperdine University | United States | 6 |
| `avila-arizona` | Avila University Arizona | United States | 5 |
| `medical-university-of-the-americas` | Medical University of the Americas | Saint Kitts and Nevis | 5 |
| `into-manchester-in-partnership-with-manchester-metropolitan-university` | INTO Manchester in partnership with Manchester Metropolitan University | United Kingdom | 4 |
| `oncampus-sunderland-foundation` | OnCampus Sunderland - Foundation | United Kingdom | 4 |
| `university-of-tasmania-melbourne-campus` | University of Tasmania, Melbourne Campus | Australia | 4 |
| `anglican-schools-commission-asc-western-australia-victoria-and-new-south-wales` | Anglican Schools Commission (ASC)- Western Australia, Victoria and New South Wales | Australia | 3 |
| `icn-international-college-paris` | ICN International College Paris | France | 3 |
| `the-hague-university-of-applied-science-foundation` | The Hague University of Applied Science - Foundation | Netherlands | 3 |
| `wycombe-abbey-international-school-bangkok` | Wycombe Abbey International School, Bangkok | Thailand | 3 |
| `charles-darwin-university-international-college` | Charles Darwin University International College | Australia | 2 |
| `mpw` | MPW | United Kingdom | 2 |
| `peking-university-hsbc-business-school` | Peking University HSBC Business School | China | 2 |
| `university-of-lethbridge-international-college-calgary-foundation` | University of Lethbridge International College Calgary (Foundation) | Canada | 2 |
| `wycombe-abbey-international-school` | Wycombe Abbey International School | China | 2 |
| `wycombe-abbey-international-school-hong-kong` | Wycombe Abbey International School, Hong kong | Hong Kong | 2 |
| `ilac-international-language-academy-of-canada` | ILAC International Language Academy of Canada | Canada | 1 |
| `penn-state-dickinson-law` | Penn State Dickinson Law | United States | 1 |
| `st-james-catholic-middle-school` | St. James Catholic Middle School | United States | 1 |
| `tedi-london` | TEDI - London | United Kingdom | 1 |

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
