# КОМПАС, сессия 1 — разметка и инвентаризация

**Дата:** 2026-09-21  •  **Каталог:** 1076 вузов  •  **Сеть не использовалась**

Живой каталог не изменён. Разметка лежит в рабочей копии `sources/kompas/catalog-work/`.

## Итог разметки

| Тип источника | Вузов | Что значит |
|---|---:|---|
| `direct` | 32 | прямой партнёр — данные берём с офсайта вуза |
| `aggregator` | 688 | партнёр через агрегатор — данные берём с сайта агрегатора |
| `none` | 356 | вне партнёрского списка — нужно ваше решение |

У **200** вузов источник не один — они есть сразу у нескольких агрегаторов. По вашему правилу это одна карточка, программы объединяются. Распределение: 154 вузов у 2, 42 вузов у 3, 4 вузов у 4.

## Покрытие по источникам

| Агрегатор | Правило | Записей в источнике | Сошлось с каталогом | Доступ |
|---|---|---:|---:|---|
| IAPro | явный список | 0 | 0 | login-owner |
| Kaplan Pathways | все вузы | 23 | 23 | open |
| CATS Global Schools | все вузы | 9 | 9 | open |
| QA Higher Education | явный список | 6 | 6 | open |
| Oxford International Education Group | все вузы | 21 | 21 | open |
| Study Group | все вузы | 51 | 46 | login |
| Navitas | все вузы | 40 | 40 | open |
| QS (admissions.qs.com) | явный список | 393 | 393 | login-owner |
| Edvoy (Genie) | все вузы | 411 | 411 | login |
| GEDU Global Education | все вузы | 13 | 10 | login |
| **Прямые партнёры** | список | 35 | 33 | офсайты |

## Список А — вузы каталога вне партнёрского списка

Всего 356. Разбиваются на две очень разные пачки.

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

### А2. Настоящие вузы вне списка — 329

| Слаг | Название | Страна | Программ |
|---|---|---|---:|
| `university-of-new-mexico` | University of New Mexico | United States | 440 |
| `kaplan-english` | KAPLAN English | United Kingdom | 317 |
| `university-of-auckland` | University of Auckland | New Zealand | 282 |
| `university-of-oklahoma` | University of Oklahoma | United States | 239 |
| `oxford` | University of Oxford | United Kingdom | 215 |
| `catholic-university-of-america` | The Catholic University of America | United States | 191 |
| `university-of-worcester` | University of Worcester | United Kingdom | 179 |
| `international-house` | International House | United Kingdom | 142 |
| `ec-english` | EC English | United Kingdom | 139 |
| `mercy-university` | Mercy University | United States | 133 |
| `the-university-of-texas-at-arlington` | The University of Texas at Arlington | United States | 131 |
| `centennial-college` | Centennial College | Canada | 127 |
| `simon-fraser` | Simon Fraser University | Canada | 112 |
| `stony-brook-university` | Stony Brook University | United States | 110 |
| `kwantlen-polytechnic-university` | Kwantlen Polytechnic University | Canada | 108 |
| `wilfrid-laurier` | Wilfrid Laurier University | Canada | 108 |
| `iowa-state-university` | IOWA State University | United States | 100 |
| `stafford-house` | Stafford House | United Kingdom | 100 |
| `victoria` | University of Victoria | Canada | 99 |
| `falmouth-university` | Falmouth University | United Kingdom | 98 |
| `anglo-continental` | Anglo-Continental | United Kingdom | 86 |
| `marshall-university` | Marshall University | United States | 85 |
| `university-of-essex-online` | University of Essex (Online) | United Kingdom | 85 |
| `centre-of-english-studies` | Centre of English Studies | United Kingdom | 78 |
| `seattle-university` | Seattle University | United States | 75 |
| `hartpury` | Hartpury University | United Kingdom | 74 |
| `fleming-college-toronto` | Fleming College Toronto | Canada | 73 |
| `kings-education` | Kings Education | United Kingdom | 72 |
| `manipal-academy-of-higher-education-dubai` | Manipal Academy of Higher Education Dubai | United Arab Emirates | 72 |
| `naba-milano` | NABA — Nuova Accademia di Belle Arti | Italy | 72 |
| `johnson-and-wales-university` | Johnson & Wales University | United States | 70 |
| `british-school-of-marketing-international` | British School of Marketing International | United Kingdom | 65 |
| `oxford-international-language-school` | Oxford International Language School | United Kingdom | 62 |
| `rutgers-university-camden` | Rutgers University Camden | United States | 59 |
| `elmira-college` | Elmira College | United States | 57 |
| `ted-university` | TED University | Turkey | 56 |
| `george-brown` | George Brown Polytechnic | Canada | 55 |
| `northumbria-university-london-campus-qahe` | Northumbria University London campus (QAHE) | United Kingdom | 50 |
| `universidad-europea-de-madrid` | Universidad Europea de Madrid | Spain | 50 |
| `ara-institute-of-canterbury` | Ara Institute of Canterbury | New Zealand | 47 |
| `fontys-university` | Fontys University of Applied Sciences | Netherlands | 45 |
| `ilsc` | ILSC | United Kingdom | 45 |
| `lappeenranta-university-of-technology-lut` | LUT University (Lappeenranta-Lahti University of Technology) | Finland | 44 |
| `new-college-group` | New College Group | United Kingdom | 44 |
| `masaryk-university-czech` | Masaryk University | Czech Republic | 43 |
| `warsaw-university-of-technology` | Warsaw University of Technology | Poland | 43 |
| `istinye-university` | İstinye University | Turkey | 42 |
| `corvinus-university-of-budapest` | Corvinus University of Budapest | Hungary | 41 |
| `university-of-warsaw` | University of Warsaw | Poland | 41 |
| `oxford-school-of-english` | Oxford School of English | United Kingdom | 40 |
| `czech-technical-university` | Czech Technical University in Prague | Czech Republic | 38 |
| `trebas` | Trebas Institute | Canada | 38 |
| `trinity-laban-conservatoire-of-music-and-dance` | Trinity Laban Conservatoire of Music and Dance | United Kingdom | 38 |
| `eastern-mediterranean-university` | Eastern Mediterranean University | Northern Cyprus | 37 |
| `london-school-of-business-and-finance` | London School of Business and Finance | United Kingdom | 37 |
| `murdoch` | Murdoch University | Australia | 37 |
| `istanbul-altinbas-university` | Altınbaş University | Turkey | 36 |
| `english-in-york` | English in York | United Kingdom | 35 |
| `istanbul-isik-university` | Işık University | Turkey | 35 |
| `the-language-gallery` | The Language Gallery | United Kingdom | 35 |
| `bayswater-college` | Bayswater College | United Kingdom | 34 |
| `ozyegin-university` | Özyeğin University | Turkey | 33 |
| `semmelweis-university` | Semmelweis University | Hungary | 32 |
| `university-of-manchester` | University of Manchester | United Kingdom | 32 |
| `eu-business-school-spain` | EU Business School (Spain) | Spain | 31 |
| `lsi-ih-portsmouth-language-specialists-international` | LSI/IH Portsmouth (Language Specialists International) | United Kingdom | 31 |
| `beet-english-language-centre` | Beet English Language Centre | United Kingdom | 30 |
| `humber-college` | Humber Polytechnic | Canada | 30 |
| `istanbul-kultur-university` | İstanbul Kültür University | Turkey | 30 |
| `the-campus-bio-medico-university-of-rome-ucbm` | Università Campus Bio-Medico di Roma | Italy | 30 |
| `czech-university-of-life-sciences` | Czech University of Life Sciences Prague | Czech Republic | 29 |
| `istanbul-gelisim-university` | Istanbul Gelişim University | Turkey | 29 |
| `lazarski-university` | Lazarski University | Poland | 29 |
| `southern-denmark-university` | University of Southern Denmark | Denmark | 29 |
| `eurocentres` | Eurocentres | United Kingdom | 28 |
| `rome-university-of-fine-arts` | Rome University of Fine Arts (RUFA) | Italy | 28 |
| `topup-learning-london` | TopUp Learning London | United Kingdom | 28 |
| `bau-global` | Bahçeşehir University (BAU) | Turkey | 27 |
| `london-school-of-english` | London School of English | United Kingdom | 27 |
| `universitat-politecnica-de-valencia-upv` | Universitat Politècnica de València (UPV) | Spain | 27 |
| `bentley-university` | Bentley University | United States | 26 |
| `university-of-wisconsin-milwaukee` | University of Wisconsin-Milwaukee | United States | 26 |
| `anglolang-academy-of-english` | Anglolang Academy of English | United Kingdom | 25 |
| `arden-university-hybrid` | Arden University (Hybrid) | Germany | 25 |
| `florida-memorial-university` | Florida Memorial University | United States | 25 |
| `istanbul-aydin-university` | Istanbul Aydın University | Turkey | 25 |
| `medipol-university` | Istanbul Medipol University | Turkey | 25 |
| `north-island-college` | North Island College | Canada | 25 |
| `college-of-english-language` | College of English Language | United States | 24 |
| `university-of-warwick` | University of Warwick | United Kingdom | 24 |
| `american-university-of-ras-al-khaimah-aurak` | American University of Ras Al Khaimah (AURAK) | United Arab Emirates | 23 |
| `prague-university-of-economics` | Prague University of Economics and Business | Czech Republic | 23 |
| `up-education` | UP Education | New Zealand | 23 |
| `montpellier-business-school` | Montpellier Business School | France | 22 |
| `technological-university-of-dublin-tu-dublin` | Technological University Dublin | Ireland | 22 |
| `university-of-pecs` | University of Pécs | Hungary | 22 |
| `bilgi-university` | İstanbul Bilgi University | Turkey | 21 |
| `dld-college-london` | DLD College London | United Kingdom | 21 |
| `aalto-university` | Aalto University | Finland | 20 |
| `kaunas-university-of-technology` | Kaunas University of Technology | Lithuania | 20 |
| `ac-badem-university` | Acıbadem Mehmet Ali Aydınlar University | Turkey | 19 |
| `cctb` | Canadian College of Technology and Business | Canada | 19 |
| `istituto-marangoni-paris` | Istituto Marangoni Paris | France | 19 |
| `izmir-economics-university` | Izmir University of Economics | Turkey | 19 |
| `mcdaniel-college-budapest` | McDaniel College Budapest | Hungary | 19 |
| `university-of-southampton-malaysia` | University of Southampton Malaysia | Malaysia | 19 |
| `epita-school-of-engineering-and-computer-science` | EPITA - School of Engineering and Computer Science | France | 18 |
| `kaplan-international-college-adelaide` | Kaplan International College Adelaide | Australia | 18 |
| `mediadesign-university-of-applied-sciences` | Mediadesign University of Applied Sciences | Germany | 18 |
| `university-of-gloucestershire` | University of Gloucestershire | United Kingdom | 18 |
| `jagiellonian-university` | Jagiellonian University | Poland | 17 |
| `metropolitan-college-of-new-york` | Metropolitan College of New York | United States | 17 |
| `northbrook-college` | Northbrook College | United Kingdom | 17 |
| `aarhus-university` | Aarhus University | Denmark | 16 |
| `charles-university` | Charles University | Czech Republic | 16 |
| `we-bridge-academy` | WE Bridge Academy | United Kingdom | 16 |
| `university-of-canada-west` | University Canada West | Canada | 15 |
| `university-of-stirling-uae` | University of Stirling (UAE) | United Arab Emirates | 15 |
| `istanbul` | Istanbul University | Turkey | 14 |
| `oncampus-aston-foundation` | OnCampus Aston – Foundation | United Kingdom | 14 |
| `swps-university` | SWPS University | Poland | 14 |
| `victoria-university` | Victoria University | Australia | 14 |
| `westminster-international-university-in-tashkent` | Westminster International University in Tashkent | Uzbekistan | 14 |
| `toronto-school-of-management` | Toronto School of Management | Canada | 13 |
| `university-of-ghent` | Ghent University | Belgium | 13 |
| `abbey-dld-colleges` | Abbey DLD Colleges | United Kingdom | 12 |
| `neoma-business-school` | NEOMA Business School | France | 12 |
| `stay-campus-london` | Stay Campus London | United Kingdom | 12 |
| `swinburne-university-foundation` | Swinburne University - Foundation | Australia | 12 |
| `university-of-delaware-lerner-college-of-business-and-economics` | University of Delaware - Lerner College of Business & Economics | United States | 12 |
| `academic-summer` | Academic Summer | United Kingdom | 11 |
| `adcote-school-for-girls` | Adcote School for Girls | United Kingdom | 11 |
| `bede-s-summer-school` | Bede's Summer School | United Kingdom | 11 |
| `bishop-s-stortford-college` | Bishop's Stortford College | United Kingdom | 11 |
| `box-hill-school` | Box Hill School | United Kingdom | 11 |
| `bromsgrove-school` | Bromsgrove School | United Kingdom | 11 |
| `brooke-house-college` | Brooke House College | United Kingdom | 11 |
| `colchester-english-study-centre` | Colchester English Study Centre | United Kingdom | 11 |
| `demiroglu-bilim-university` | Demiroğlu Bilim University | Turkey | 11 |
| `dublin-business-school` | Dublin Business School | Ireland | 11 |
| `international-school-of-creative-arts` | International School of Creative Arts | United Kingdom | 11 |
| `mander-portman-woodward` | Mander Portman Woodward | United Kingdom | 11 |
| `myddelton-college` | Myddelton College | United Kingdom | 11 |
| `university-of-helsinki` | University of Helsinki | Finland | 11 |
| `atc` | ATC | United Kingdom | 10 |
| `atlantic-language` | Atlantic Language | United Kingdom | 10 |
| `concord-college` | Concord College | United Kingdom | 10 |
| `csvpa-china` | Cambridge School of Visual & Performing Arts, China | China | 10 |
| `hanson-college` | Hanson College | Canada | 10 |
| `istituto-marangoni-dubai` | Istituto Marangoni Dubai | United Arab Emirates | 10 |
| `langara-college` | Langara College | Canada | 10 |
| `royal-holloway-university-of-london-international-study-centre` | Royal Holloway University of London International Study Centre | United Kingdom | 10 |
| `the-american-business-school-of-paris` | The American Business School of Paris | France | 10 |
| `international-house-sydney` | International House - Sydney | Australia | 9 |
| `ku-leuven` | KU Leuven | Belgium | 9 |
| `langports-australia` | Langports Australia | Australia | 9 |
| `languages-international` | Languages International | New Zealand | 9 |
| `matrix-college-of-management-technology-and-healthcare` | Matrix College of Management, Technology and Healthcare | Canada | 9 |
| `maynooth-university` | Maynooth University | Ireland | 9 |
| `mentor-language-institute` | Mentor Language Institute | United States | 9 |
| `skema-business-school` | Skema Business School | France | 9 |
| `szeged-university` | University of Szeged | Hungary | 9 |
| `english-path` | English Path | United Kingdom | 8 |
| `international-house-belfast` | International House Belfast | United Kingdom | 8 |
| `into-manchester-in-partnership-with-the-university-of-manchester` | INTO Manchester in partnership with The University of Manchester | United Kingdom | 8 |
| `niagara-college-toronto` | Niagara College - Toronto | Canada | 8 |
| `university-of-padua` | University of Padua | Italy | 8 |
| `academia-international` | Academia International | Australia | 7 |
| `de-vinci-higher-education` | De Vinci Higher Education | France | 7 |
| `leeds-language-college` | Leeds Language College | United Kingdom | 7 |
| `on-campus-paris` | On Campus Paris | France | 7 |
| `queen-s-university-school-of-english` | Queen's University - School of English | Canada | 7 |
| `south-australian-institute-of-business-and-technology-saibt-university-of-south` | South Australian Institute of Business and Technology (SAIBT) - University of South Australia | Australia | 7 |
| `university-of-tasmania-international-pathway-college` | University of Tasmania International Pathway College | Australia | 7 |
| `university-of-the-west-of-england-bristol-international-college-uwe-bristol-foun` | University of the West of England, Bristol International College (UWE Bristol) - Foundation | United Kingdom | 7 |
| `university-of-york-international-pathway-college-foundation` | University of York International Pathway College - Foundation | United Kingdom | 7 |
| `vancouver-island-university` | Vancouver Island University | Canada | 7 |
| `ccel-christchurch-college-of-english` | CCEL - Christchurch College of English | New Zealand | 6 |
| `english-language-centre-bristol` | English Language Centre - Bristol | United Kingdom | 6 |
| `glasgow-international-college` | Glasgow International College | United Kingdom | 6 |
| `ilac` | ILAC | Canada | 6 |
| `impact-english` | Impact English | Australia | 6 |
| `oncampus-hull-foundation` | OnCampus Hull - Foundation | United Kingdom | 6 |
| `oncampus-london-south-bank` | OnCampus London South Bank | United Kingdom | 6 |
| `oncampus-loughborough` | OnCampus Loughborough | United Kingdom | 6 |
| `oncampus-southampton-pathway` | OnCampus Southampton - Pathway | United Kingdom | 6 |
| `pepperdine-university` | Pepperdine University | United States | 6 |
| `radboud-university` | Radboud University | Netherlands | 6 |
| `southern-ontario-collegiate` | Southern Ontario Collegiate | Canada | 6 |
| `university-of-strathclyde-bahrain` | University of Strathclyde, Bahrain | Bahrain | 6 |
| `york-st-john-university` | York St John University | United Kingdom | 6 |
| `avila-arizona` | Avila University Arizona | United States | 5 |
| `concordia-university-texas` | Concordia University Texas | United States | 5 |
| `flinders-university` | Flinders University | Australia | 5 |
| `istituto-marangoni` | Istituto Marangoni | Italy | 5 |
| `lci-melbourne` | LCI Melbourne | Australia | 5 |
| `limerick-language-centre` | Limerick Language Centre | Ireland | 5 |
| `mda-college` | MDA College | United Kingdom | 5 |
| `medical-university-of-the-americas` | Medical University of the Americas | Saint Kitts and Nevis | 5 |
| `universal-higher-education-uk` | Universal Higher Education, UK | United Kingdom | 5 |
| `university-bridge` | University Bridge | United States | 5 |
| `university-of-technology-sydney` | University of Technology Sydney | Australia | 5 |
| `university-of-wollongong` | University of Wollongong | Australia | 5 |
| `atlantic-technological-university` | Atlantic Technological University | Ireland | 4 |
| `australian-national-university` | Australian National University | Australia | 4 |
| `bay-atlantic-university` | Bay Atlantic University | United States | 4 |
| `dublin-international-study-centre` | Dublin International Study Centre | Ireland | 4 |
| `eca-elsis-english` | ECA - Elsis English | Australia | 4 |
| `international-language-institute` | International Language Institute | United States | 4 |
| `into-manchester-in-partnership-with-manchester-metropolitan-university` | INTO Manchester in partnership with Manchester Metropolitan University | United Kingdom | 4 |
| `lambton-college-canada` | Lambton College Canada | Canada | 4 |
| `lexis-education` | Lexis Education | Australia | 4 |
| `macquarie-university` | Macquarie University | Australia | 4 |
| `on-campus-ireland` | On Campus Ireland | Ireland | 4 |
| `oncampus-sunderland-foundation` | OnCampus Sunderland - Foundation | United Kingdom | 4 |
| `rennes-school-of-business` | Rennes School of Business | France | 4 |
| `skola-english-in-london` | Skola English in London | United Kingdom | 4 |
| `the-university-of-winnipeg-collegiate` | The University of Winnipeg Collegiate | Canada | 4 |
| `universiti-kuala-lumpur` | Universiti Kuala Lumpur | Malaysia | 4 |
| `university-of-eastern-finland` | University of Eastern Finland | Finland | 4 |
| `university-of-tasmania-melbourne-campus` | University of Tasmania, Melbourne Campus | Australia | 4 |
| `vilnius-university` | Vilnius University | Lithuania | 4 |
| `american-english-college` | American English College | United States | 3 |
| `anglican-schools-commission-asc-western-australia-victoria-and-new-south-wales` | Anglican Schools Commission (ASC)- Western Australia, Victoria and New South Wales | Australia | 3 |
| `els-language-centers` | ELS Language Centers | United Kingdom | 3 |
| `emlyon-business-school` | Emlyon Business School | France | 3 |
| `eurospeak` | Eurospeak | United Kingdom | 3 |
| `icn-international-college-paris` | ICN International College Paris | France | 3 |
| `lakehead-university` | Lakehead University | Canada | 3 |
| `language-schools-new-zealand` | Language Schools New Zealand | New Zealand | 3 |
| `mpw` | MPW | United Kingdom | 3 |
| `northern-lights-college` | Northern Lights College | Canada | 3 |
| `sheffield-college` | Sheffield College | United Kingdom | 3 |
| `sunway-university` | Sunway University | Malaysia | 3 |
| `taylor-s-university` | Taylor's University | Malaysia | 3 |
| `the-hague-university-of-applied-science-foundation` | The Hague University of Applied Science - Foundation | Netherlands | 3 |
| `universal-higher-education-australia` | Universal Higher Education, Australia | Australia | 3 |
| `university-of-bristol-international-foundation` | University of Bristol International Foundation | United Kingdom | 3 |
| `wycombe-abbey-international-school-bangkok` | Wycombe Abbey International School, Bangkok | Thailand | 3 |
| `baltic-international-academy` | Baltic International Academy | Latvia | 2 |
| `birla-institute-of-technology-and-science-pilani-dubai` | Birla Institute of Technology and Science, Pilani- Dubai | United Arab Emirates | 2 |
| `britts-imperial-university-college` | Britts Imperial University College | United Arab Emirates | 2 |
| `carlos-v-education` | Carlos V Education | Spain | 2 |
| `charles-darwin-university` | Charles Darwin University | Australia | 2 |
| `charles-darwin-university-international-college` | Charles Darwin University International College | Australia | 2 |
| `chichester-college` | Chichester College | United Kingdom | 2 |
| `coquitlam-college` | Coquitlam College | Canada | 2 |
| `dsti-school-of-engineering` | DSTI School of Engineering | France | 2 |
| `edc-paris-business-school` | EDC Paris Business School | France | 2 |
| `em-normandie-business-school` | EM Normandie Business School | France | 2 |
| `fleming-college` | Fleming College | Canada | 2 |
| `global-college-malta` | Global College Malta | Malta | 2 |
| `istituto-europeo-di-design-ied` | Istituto Europeo di Design (IED) | Italy | 2 |
| `kaplan-international-languages` | Kaplan International Languages | United Kingdom | 2 |
| `munster-technological-university` | Munster Technological University | Ireland | 2 |
| `oxford-international-education-group-english-schools` | Oxford International Education Group (English Schools) | United Kingdom | 2 |
| `oxford-international-education-group-ielts-and-tesol` | Oxford International Education Group (IELTS & TESOL) | United Kingdom | 2 |
| `peking-university-hsbc-business-school` | Peking University HSBC Business School | China | 2 |
| `sim-global-education` | SIM Global Education | Singapore | 2 |
| `steinbeis-university` | Steinbeis University | Germany | 2 |
| `universidad-europea` | Universidad Europea | Spain | 2 |
| `university-of-antwerp` | University of Antwerp | Belgium | 2 |
| `university-of-information-technology-and-management-in-rzeszow` | University of Information Technology and Management in Rzeszow | Poland | 2 |
| `university-of-lethbridge-international-college-calgary-foundation` | University of Lethbridge International College Calgary (Foundation) | Canada | 2 |
| `university-of-new-brunswick` | University of New Brunswick | Canada | 2 |
| `university-of-wollongong-dubai` | University of Wollongong  Dubai | United Arab Emirates | 2 |
| `wycombe-abbey-international-school` | Wycombe Abbey International School | China | 2 |
| `wycombe-abbey-international-school-hong-kong` | Wycombe Abbey International School, Hong kong | Hong Kong | 2 |
| `adema-university-school` | Adema University School | Spain | 1 |
| `alte-university` | Alte University | Georgia | 1 |
| `amber-international-aviation-academy` | Amber International Aviation Academy | Australia | 1 |
| `american-business-college` | American Business College | France | 1 |
| `barcelona-technology-school` | Barcelona Technology School | Spain | 1 |
| `bath-spa-university` | Bath Spa University | United Kingdom | 1 |
| `bath-spa-university-academic-centre-rak` | Bath Spa University Academic Centre, RAK | United Arab Emirates | 1 |
| `bright-school-of-english` | Bright School of English | United Kingdom | 1 |
| `cambrian-college` | Cambrian College | Canada | 1 |
| `canadore-college` | Canadore College | Canada | 1 |
| `cbs-international-business-school` | CBS International Business School | Germany | 1 |
| `eastern-institute-of-technology` | Eastern Institute Of Technology | New Zealand | 1 |
| `emirates-aviation-university` | Emirates Aviation University | United Arab Emirates | 1 |
| `epitech` | EPITECH | France | 1 |
| `erasmus-university-rotterdam` | Erasmus University Rotterdam | Netherlands | 1 |
| `fom-university-of-applied-sciences-for-economics-and-management` | FOM University of Applied Sciences for Economics and Management | Germany | 1 |
| `hotel-and-tourism-management-institute-dubai` | Hotel and Tourism Management Institute Dubai | United Arab Emirates | 1 |
| `ibat-college-dublin` | IBAT College Dublin | Ireland | 1 |
| `ilac-international-language-academy-of-canada` | ILAC International Language Academy of Canada | Canada | 1 |
| `isc-paris-business-school` | ISC Paris - Business School | France | 1 |
| `isep-paris-institute-of-digital-technology` | ISEP - Paris Institute of Digital Technology | France | 1 |
| `kazimiero-simonaviciaus-universitetas` | Kazimiero Simonaviciaus Universitetas | Lithuania | 1 |
| `maastricht-university` | Maastricht University | Netherlands | 1 |
| `missouri-university-of-science-and-technology` | Missouri University of Science and Technology | United States | 1 |
| `monash-university-malaysia` | Monash University Malaysia | Malaysia | 1 |
| `national-louis-university` | National Louis University | United States | 1 |
| `national-research-nuclear-university-mephi` | National Research Nuclear University(MEPhI) | Russia | 1 |
| `new-zealand-airline-academy` | New Zealand Airline Academy | New Zealand | 1 |
| `new-zealand-skills-and-education` | New Zealand Skills and Education | New Zealand | 1 |
| `niagara-university` | Niagara University | Canada | 1 |
| `northern-arizona-university` | Northern Arizona University | United States | 1 |
| `northern-college` | Northern College | Canada | 1 |
| `oxford-international-education-group-junior` | Oxford International Education Group (Junior) | United Kingdom | 1 |
| `oxford-international-london-centre` | Oxford International London Centre | United Kingdom | 1 |
| `oxford-international-oxford-centre` | Oxford International Oxford Centre | United Kingdom | 1 |
| `penn-state-dickinson-law` | Penn State Dickinson Law | United States | 1 |
| `queensland-university-of-technology` | Queensland University of Technology | Australia | 1 |
| `san-jose-state-university` | San Jose State University | United States | 1 |
| `seu-georgian-national-university` | SEU Georgian National University | Georgia | 1 |
| `southern-institute-of-technology` | Southern Institute of Technology | New Zealand | 1 |
| `st-giles-international` | St Giles International | United Kingdom | 1 |
| `st-james-catholic-middle-school` | St. James Catholic Middle School | United States | 1 |
| `stevens-institute-of-technology` | Stevens Institute of Technology | United States | 1 |
| `success-point-college` | Success Point College | United Arab Emirates | 1 |
| `swinburne-university-of-technology-malaysia` | swinburne university of technology Malaysia | Malaysia | 1 |
| `tampere-university` | Tampere University | Finland | 1 |
| `tedi-london` | TEDI - London | United Kingdom | 1 |
| `the-university-of-adelaide` | The University of Adelaide | Australia | 1 |
| `ucsi-university` | UCSI University | Malaysia | 1 |
| `unitec-institute-of-technology` | Unitec Institute of Technology | New Zealand | 1 |
| `universiti-sains-malaysia` | Universiti Sains Malaysia | Malaysia | 1 |
| `university-of-jyv-skyl` | University of Jyväskylä | Finland | 1 |
| `university-of-limassol` | University of Limassol | Cyprus | 1 |
| `university-of-miskolc` | University of Miskolc | Hungary | 1 |
| `university-of-newcastle` | University of Newcastle | Australia | 1 |
| `university-of-otago-pathway-and-language-centre` | University of Otago Pathway and Language Centre | New Zealand | 1 |
| `university-of-south-dakota` | University of South Dakota | United States | 1 |
| `university-of-the-arts-london` | University of the Arts London | United Kingdom | 1 |
| `university-of-turku` | University of Turku | Finland | 1 |
| `university-of-wales-trinity-saint-david` | University of Wales Trinity Saint David | United Kingdom | 1 |
| `university-of-west-london` | University of West London | United Kingdom | 1 |

## Список Б — партнёры без карточки в каталоге

| Источник | Название в источнике | Почему не сошлось |
|---|---|---|
| studygroup | Direct Entry University of Chichester Undergraduate | unresolved |
| gedu | Global Banking Training | unresolved |
| gedu | Lokmani Memorial Degree College | unresolved |
| gedu | Meta Gedu | unresolved |
| direct | Aurak unit, Cyprus | unresolved |
| direct | Bilim Univ, Turkey | unresolved |

## Что блокирует

- **iapro** — Документ говорит «11 партнёров, вкладка Marketing Hub», но сами названия нигде локально не записаны. Нужен владелец (логин ранее падал по таймауту) либо выгрузка. Блокирует разметку этих 11 вузов.
