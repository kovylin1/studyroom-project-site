// One-shot seeder for Navitas-AU partner universities (thin first pass).
// Writes site/src/content/universities/{slug}.json for 11 Australian
// parent universities listed in sources/universities.list.md under
// `navitas-pathways`. Researched data is hardcoded here so the first deploy
// doesn't require live scraping; richer pipeline (programs scrape, fees
// scrape, RU translations from Kaplan-style modules) follows per-uni.
//
// Run: node scraper/seed-navitas-au.mjs
//
// Idempotent: overwrites the JSON file every run. Safe to re-run after
// edits to the data block below.

import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = resolve(__dirname, '../site/src/content/universities');

const TODAY = new Date().toISOString();
const INTAKE_FEB = `${new Date().getUTCFullYear() + 1}-02-15T00:00:00.000Z`;
const INTAKE_JUL = `${new Date().getUTCFullYear() + 1}-07-01T00:00:00.000Z`;

const UNIS = [
  {
    slug: 'curtin',
    name: 'Curtin University',
    city: 'Perth',
    navitasUrl: 'https://www.curtincollege.edu.au/',
    officialUrl: 'https://www.curtin.edu.au/',
    tuition: { foundation: 28800, bachelor: 36500, master: 42500 },
    ielts: 6.0,
    paragraphs: [
      "Curtin University is Western Australia's largest and most diverse university, with its main campus in Bentley, Perth. Founded in 1966, Curtin sits in the top 1% of universities worldwide (ARWU 2024) and ranks #1 in Australia for Mineral & Mining Engineering (QS 2024).",
      "International students enter through Curtin College — Navitas's pathway college on the Bentley campus — which offers Diploma and Foundation programs that lead directly into the second year of a Curtin Bachelor's degree. Students experience the same campus, library, and student services as direct-entry students from day one.",
    ],
    paragraphsRu: [
      'Curtin University — самый большой и многопрофильный университет Западной Австралии, основной кампус — в Бентли (Перт). Основан в 1966, входит в топ-1% университетов мира (ARWU 2024). №1 в Австралии по Mineral & Mining Engineering (QS 2024).',
      'Международные студенты заходят через Curtin College — pathway-колледж Navitas на кампусе Бентли. Диплом или Foundation в Curtin College даёт переход сразу на второй курс бакалавриата Curtin University. Все ресурсы кампуса доступны с первого дня.',
    ],
    keyFacts: [
      'Top 1% of universities worldwide (ARWU 2024)',
      '#1 in Australia for Mineral & Mining Engineering (QS 2024)',
      'Over 58,000 students',
      'Founded in 1966',
      'ATN group member (Australian Technology Network)',
    ],
    keyFactsRu: [
      'Топ-1% университетов мира (ARWU 2024)',
      '№1 в Австралии по Mineral & Mining Engineering (QS 2024)',
      'Более 58 000 студентов',
      'Основан в 1966',
      'Член группы ATN (Australian Technology Network)',
    ],
    accommodation: [
      { name: 'Curtin University Campus Accommodation', price: 'от AU$285/нед', text: "St Catherine's, Vickery House, Erica Underwood House — на территории кампуса Бентли, в 5 минутах ходьбы от Curtin College." },
      { name: 'Homestay через Curtin College', price: 'от AU$355/нед', text: 'Проживание в принимающей семье — питание и комната включены, поддержка перехода в первые месяцы в Перте.' },
    ],
    campuses: [
      { title: 'Bentley Main Campus (Perth)', sub: '116 гектар, 9 km от центра Перта', text: 'Основной кампус, где находится Curtin College и большинство факультетов. Современная библиотека, ResLife студенческое сообщество, спортивный центр.' },
      { title: 'Curtin Singapore + Dubai + Malaysia', sub: 'Международные кампусы', text: 'Curtin — один из немногих австралийских университетов с полноценными зарубежными кампусами.' },
    ],
  },
  {
    slug: 'deakin',
    name: 'Deakin University',
    city: 'Melbourne',
    navitasUrl: 'https://www.deakincollege.edu.au/',
    officialUrl: 'https://www.deakin.edu.au/',
    tuition: { foundation: 30400, bachelor: 38500, master: 44500 },
    ielts: 6.0,
    paragraphs: [
      "Deakin University is one of Australia's top young universities, with campuses in Melbourne (Burwood), Geelong Waurn Ponds, Geelong Waterfront, and Warrnambool. Founded in 1974, Deakin is ranked in the top 1% globally (ARWU 2024) and #1 in Victoria for student experience (QILT 2024).",
      "International students start at Deakin College — the Navitas pathway college on Deakin's campuses — with Diploma programs in business, engineering, IT, health sciences, communication, and design. Completing the Diploma guarantees entry into the second year of the equivalent Deakin Bachelor's degree.",
    ],
    paragraphsRu: [
      'Deakin University — один из ведущих молодых университетов Австралии, кампусы в Мельбурне (Burwood), Geelong Waurn Ponds, Geelong Waterfront и Warrnambool. Основан в 1974, входит в топ-1% мира (ARWU 2024), №1 в штате Виктория по студенческому опыту (QILT 2024).',
      'Международные студенты начинают в Deakin College — pathway-колледже Navitas на кампусах Deakin. Дипломы по бизнесу, инженерии, IT, health sciences, коммуникациям и дизайну. Завершение даёт гарантированный переход на второй курс соответствующего бакалавриата Deakin.',
    ],
    keyFacts: [
      'Top 1% universities worldwide (ARWU 2024)',
      '#1 in Victoria for student experience (QILT)',
      'Over 62,000 students',
      'Founded in 1974',
      '5-star rating for teaching (QS Stars 2024)',
    ],
    keyFactsRu: [
      'Топ-1% университетов мира (ARWU 2024)',
      '№1 в штате Виктория по студенческому опыту (QILT)',
      'Более 62 000 студентов',
      'Основан в 1974',
      '5 звёзд QS Stars 2024 за преподавание',
    ],
    accommodation: [
      { name: 'Deakin Residential Services (Burwood)', price: 'от AU$310/нед', text: 'Студенческие общежития на кампусе Burwood в 14 км от центра Мельбурна — одно- и двухместные комнаты, общая кухня, 24/7 поддержка.' },
      { name: 'Homestay через Deakin College', price: 'от AU$345/нед', text: 'Австралийская принимающая семья, питание и комната включены. Идеально для первых месяцев в Мельбурне.' },
    ],
    campuses: [
      { title: 'Melbourne Burwood Campus', sub: 'Главный кампус — 14 км от центра Мельбурна', text: 'Здесь учится большинство международных студентов. Deakin College — на этом же кампусе.' },
      { title: 'Geelong Waurn Ponds + Waterfront', sub: '70 км от Мельбурна', text: 'Инженерия, медицина, морские науки, исследовательские центры.' },
    ],
  },
  {
    slug: 'edith-cowan',
    name: 'Edith Cowan University',
    city: 'Perth',
    navitasUrl: 'https://www.edithcowancollege.edu.au/',
    officialUrl: 'https://www.ecu.edu.au/',
    tuition: { foundation: 27200, bachelor: 33500, master: 38000 },
    ielts: 6.0,
    paragraphs: [
      'Edith Cowan University (ECU) is a Perth-based public university known for the Western Australian Academy of Performing Arts (WAAPA) — one of the top performing-arts schools in the southern hemisphere — and for nursing, cyber security, and education programs. ECU is rated 5 stars overall by QS (2024).',
      "International students enter via Edith Cowan College (ECC) — Navitas's pathway college on the Joondalup campus — with Diploma and Foundation programs leading into the second year of an ECU Bachelor's degree. Direct-entry English programs are also available through the ECU English Centre.",
    ],
    paragraphsRu: [
      'Edith Cowan University (ECU) — государственный университет в Перте. Известен Western Australian Academy of Performing Arts (WAAPA) — одной из лучших performing-arts школ Южного полушария — а также программами по сестринскому делу, кибербезопасности и образованию. Общая оценка 5 звёзд QS (2024).',
      'Международные студенты заходят через Edith Cowan College (ECC) — pathway-колледж Navitas на кампусе Joondalup. Diploma и Foundation ведут на второй курс бакалавриата ECU. Доступны программы английского через ECU English Centre.',
    ],
    keyFacts: [
      '5-star overall rating (QS 2024)',
      'WAAPA — top performing arts academy in Australia',
      'Over 31,000 students',
      'Founded in 1991',
      'Top 100 in the world for under 50 years (QS Young University 2024)',
    ],
    keyFactsRu: [
      'Общая оценка 5 звёзд QS 2024',
      'WAAPA — топовая academy of performing arts Австралии',
      'Более 31 000 студентов',
      'Основан в 1991',
      'Топ-100 в мире среди молодых вузов (QS Young University 2024)',
    ],
    accommodation: [
      { name: 'ECU Village (Joondalup)', price: 'от AU$235/нед', text: 'On-campus квартиры — на территории кампуса Joondalup, рядом с ECC.' },
      { name: 'Homestay через ECC', price: 'от AU$330/нед', text: 'Принимающая семья — питание + комната, идеально для адаптации в Перте.' },
    ],
    campuses: [
      { title: 'Joondalup Campus (Perth)', sub: 'Главный кампус — 25 км от центра Перта', text: 'Основной кампус, ECC и большинство международных программ. Современная библиотека, спортивные сооружения.' },
      { title: 'Mount Lawley Campus', sub: '7 км от центра Перта', text: 'WAAPA, education, arts and humanities. Студии, концертные залы.' },
    ],
  },
  {
    slug: 'griffith',
    name: 'Griffith University',
    city: 'Brisbane',
    navitasUrl: 'https://www.griffithcollege.edu.au/',
    officialUrl: 'https://www.griffith.edu.au/',
    tuition: { foundation: 28000, bachelor: 35500, master: 41000 },
    ielts: 6.0,
    paragraphs: [
      'Griffith University spans 5 campuses across Queensland — Nathan, Mount Gravatt, Logan, Gold Coast, and South Bank (Queensland Conservatorium). Founded in 1971, Griffith is in the top 2% of universities worldwide (Times Higher Education 2024) and #1 in Queensland for graduate employment.',
      "International students start at Griffith College — Navitas's pathway provider on the Mount Gravatt (Brisbane) and Gold Coast campuses — with Diploma programs in business, IT, engineering, design, hotel management, and health sciences. Diploma graduates progress into the second year of the corresponding Griffith Bachelor's degree.",
    ],
    paragraphsRu: [
      'Griffith University — 5 кампусов в Квинсленде: Nathan, Mount Gravatt, Logan, Gold Coast и South Bank (Queensland Conservatorium). Основан в 1971, входит в топ-2% университетов мира (Times Higher Education 2024), №1 в Квинсленде по трудоустройству выпускников.',
      'Международные студенты начинают в Griffith College — pathway-провайдере Navitas на кампусах Mount Gravatt (Брисбен) и Gold Coast. Диплом по бизнесу, IT, инженерии, дизайну, hotel management и health sciences даёт переход на второй курс бакалавриата Griffith.',
    ],
    keyFacts: [
      'Top 2% universities worldwide (Times Higher Education 2024)',
      '#1 in Queensland for graduate employment',
      'Over 50,000 students',
      'Founded in 1971',
      '5-star rating in 8 subject areas (QS 2024)',
    ],
    keyFactsRu: [
      'Топ-2% университетов мира (Times Higher Education 2024)',
      '№1 в Квинсленде по трудоустройству выпускников',
      'Более 50 000 студентов',
      'Основан в 1971',
      '5 звёзд QS 2024 в 8 предметных областях',
    ],
    accommodation: [
      { name: 'Griffith Residential Services', price: 'от AU$220/нед', text: 'On-campus общежития на Nathan, Gold Coast и Mount Gravatt — комнаты с общей кухней, поддержка resident advisors.' },
      { name: 'Homestay через Griffith College', price: 'от AU$340/нед', text: 'Австралийская семья — питание и комната включены, поддержка с адаптацией в Брисбене или на Gold Coast.' },
    ],
    campuses: [
      { title: 'Nathan Campus (Brisbane)', sub: 'Главный кампус — 12 км от центра Брисбена', text: 'Эукалиптовый лес на территории — единственный в Австралии. Бизнес, инженерия, IT.' },
      { title: 'Gold Coast Campus', sub: 'Southport — 1 km от пляжа', text: 'Hotel management, health sciences, медицина. Griffith College также есть здесь.' },
    ],
  },
  {
    slug: 'la-trobe',
    name: 'La Trobe University',
    city: 'Melbourne',
    navitasUrl: 'https://www.latrobecollegeaustralia.edu.au/',
    officialUrl: 'https://www.latrobe.edu.au/',
    tuition: { foundation: 29500, bachelor: 37500, master: 43500 },
    ielts: 6.0,
    paragraphs: [
      'La Trobe University is a Melbourne-based university with its main campus in Bundoora and additional campuses in Sydney, Bendigo, Albury-Wodonga, Mildura, and Shepparton. Founded in 1967, La Trobe is in the top 1.6% of universities worldwide (Times Higher Education 2024) and #1 in Victoria for graduate satisfaction (QILT 2024).',
      "International students enter through La Trobe College Australia — the Navitas pathway college on the Bundoora and Sydney campuses — with Diploma programs leading into the second year of a La Trobe Bachelor's degree, plus Foundation Studies for school-leavers.",
    ],
    paragraphsRu: [
      'La Trobe University — университет в Мельбурне с главным кампусом в Bundoora и кампусами в Сиднее, Bendigo, Albury-Wodonga, Mildura и Shepparton. Основан в 1967, входит в топ-1.6% университетов мира (Times Higher Education 2024), №1 в штате Виктория по удовлетворённости выпускников (QILT 2024).',
      'Международные студенты заходят через La Trobe College Australia — pathway-колледж Navitas на кампусах Bundoora и Sydney. Дипломы дают переход на второй курс бакалавриата La Trobe, отдельная программа Foundation Studies для выпускников школ.',
    ],
    keyFacts: [
      'Top 1.6% universities worldwide (Times Higher Education 2024)',
      '#1 in Victoria for graduate satisfaction (QILT 2024)',
      'Over 38,000 students',
      'Founded in 1967',
      '5-star teaching rating (QS Stars 2024)',
    ],
    keyFactsRu: [
      'Топ-1.6% университетов мира (Times Higher Education 2024)',
      '№1 в штате Виктория по удовлетворённости выпускников (QILT 2024)',
      'Более 38 000 студентов',
      'Основан в 1967',
      '5 звёзд QS Stars 2024 за преподавание',
    ],
    accommodation: [
      { name: 'La Trobe Glenn College / Menzies College', price: 'от AU$245/нед', text: 'On-campus резиденции в Bundoora — комнаты с общей кухней, активная студенческая жизнь.' },
      { name: 'Homestay через La Trobe College', price: 'от AU$345/нед', text: 'Австралийская семья — питание и комната, поддержка адаптации.' },
    ],
    campuses: [
      { title: 'Melbourne Bundoora Campus', sub: 'Главный кампус — 14 км от центра Мельбурна', text: '235 гектар, 25 000 студентов. La Trobe College — на этом же кампусе.' },
      { title: 'Sydney Campus (CBD)', sub: 'В центре Сиднея', text: 'Современный кампус в деловом центре Сиднея — для тех, кто хочет жить и учиться в Сиднее.' },
    ],
  },
  {
    slug: 'western-sydney',
    name: 'Western Sydney University',
    city: 'Sydney',
    navitasUrl: 'https://internationalcollege.westernsydney.edu.au/',
    officialUrl: 'https://www.westernsydney.edu.au/',
    tuition: { foundation: 26500, bachelor: 32500, master: 40000 },
    ielts: 6.0,
    paragraphs: [
      'Western Sydney University (WSU) operates 10 campuses across Greater Sydney — Parramatta, Bankstown, Campbelltown, Hawkesbury, Penrith, Sydney City and others. Founded in 1989, WSU is #1 in the world for social, economic and environmental impact (Times Higher Education Impact Rankings 2022 and 2023).',
      'International students enter via Western Sydney University International College (WSUIC) — the Navitas pathway college on the Parramatta and Sydney City campuses — or via Sydney Institute of Business and Technology (SIBT). Diploma graduates progress to the second year of a WSU Bachelor\'s degree.',
    ],
    paragraphsRu: [
      'Western Sydney University (WSU) — 10 кампусов по Большому Сиднею: Parramatta, Bankstown, Campbelltown, Hawkesbury, Penrith, Sydney City и др. Основан в 1989. №1 в мире по социальному, экономическому и экологическому импакту (Times Higher Education Impact Rankings 2022 и 2023).',
      'Международные студенты заходят через Western Sydney University International College (WSUIC) — pathway-колледж Navitas на кампусах Parramatta и Sydney City — или через Sydney Institute of Business and Technology (SIBT). Diploma даёт переход на второй курс бакалавриата WSU.',
    ],
    keyFacts: [
      '#1 in the world for impact (Times Higher Education Impact Rankings 2022 + 2023)',
      'Top 2% universities worldwide (THE 2024)',
      'Over 47,000 students',
      'Founded in 1989',
      '10 campuses across Greater Sydney',
    ],
    keyFactsRu: [
      '№1 в мире по импакту (Times Higher Education Impact Rankings 2022 + 2023)',
      'Топ-2% университетов мира (THE 2024)',
      'Более 47 000 студентов',
      'Основан в 1989',
      '10 кампусов по Большому Сиднею',
    ],
    accommodation: [
      { name: 'Western Sydney University Village', price: 'от AU$235/нед', text: 'On-campus резиденции на Parramatta, Hawkesbury, Campbelltown — комнаты с общей кухней, 24/7 поддержка.' },
      { name: 'Homestay через WSUIC', price: 'от AU$330/нед', text: 'Австралийская семья — питание и комната, идеально для первых месяцев в Сиднее.' },
    ],
    campuses: [
      { title: 'Parramatta Campus', sub: 'Главный кампус — 23 км от центра Сиднея', text: 'WSUIC, бизнес, инженерия, IT. Современный кампус с прямым поездом до Central Station.' },
      { title: 'Sydney City Campus', sub: 'В центре Сиднея (CBD)', text: 'Для тех, кто хочет жить и учиться в центре Сиднея. Бизнес-программы.' },
    ],
  },
  {
    slug: 'sydney',
    name: 'The University of Sydney',
    city: 'Sydney',
    navitasUrl: 'https://www.taylorssydney.edu.au/',
    officialUrl: 'https://www.sydney.edu.au/',
    tuition: { foundation: 36800, bachelor: 51500, master: 56500 },
    ielts: 6.5,
    paragraphs: [
      "The University of Sydney is Australia's first university, founded in 1850. A Group of Eight (Go8) sandstone university, Sydney sits at #18 globally (QS World University Rankings 2025) and #1 in Australia for graduate employability (QS Graduate Employability Rankings 2024).",
      "International school-leavers enter via Taylors College Sydney — the Navitas Foundation Studies provider on a dedicated campus in Waterloo (5 minutes from the main USYD Camperdown campus). Taylors' Foundation Program guarantees admission into a Sydney Bachelor's degree on completion.",
    ],
    paragraphsRu: [
      'The University of Sydney — первый университет Австралии, основан в 1850. Член Group of Eight (Go8), sandstone-уни. №18 в мире (QS World University Rankings 2025), №1 в Австралии по трудоустройству выпускников (QS Graduate Employability Rankings 2024).',
      'Международные выпускники школ заходят через Taylors College Sydney — Foundation-провайдер Navitas с отдельным кампусом в Waterloo (5 минут от главного кампуса Camperdown). Foundation Program в Taylors даёт гарантированный приём на бакалавриат Sydney.',
    ],
    keyFacts: [
      '#18 in the world (QS World University Rankings 2025)',
      '#1 in Australia for graduate employability (QS 2024)',
      "Australia's first university — founded in 1850",
      'Over 75,000 students',
      'Group of Eight (Go8) sandstone university',
    ],
    keyFactsRu: [
      '№18 в мире (QS World University Rankings 2025)',
      '№1 в Австралии по трудоустройству выпускников (QS 2024)',
      'Первый университет Австралии — основан в 1850',
      'Более 75 000 студентов',
      'Член Group of Eight (Go8), sandstone-уни',
    ],
    accommodation: [
      { name: 'University of Sydney Student Accommodation', price: 'от AU$385/нед', text: 'Queen Mary Building, Regiment Building, Abercrombie — на кампусе Camperdown. Современные студии и комнаты.' },
      { name: 'Taylors College Sydney Homestay', price: 'от AU$355/нед', text: 'Австралийская семья в Waterloo / Sydney CBD — питание и комната, идеально для Foundation студентов.' },
    ],
    campuses: [
      { title: 'Camperdown / Darlington Campus', sub: 'Главный кампус — 3 км от центра Сиднея', text: '72 гектара, sandstone-архитектура, Quadrangle, главная библиотека Fisher.' },
      { title: 'Waterloo (Taylors College)', sub: '5 минут от Camperdown', text: 'Отдельный кампус Foundation-программы — современное здание, академический и pastoral support.' },
    ],
  },
  {
    slug: 'canberra',
    name: 'University of Canberra',
    city: 'Canberra',
    navitasUrl: 'https://www.canberra.edu.au/uc-college',
    officialUrl: 'https://www.canberra.edu.au/',
    tuition: { foundation: 24000, bachelor: 33500, master: 39500 },
    ielts: 6.0,
    paragraphs: [
      "University of Canberra (UC) is the capital city's public university, with its main campus in Bruce, Canberra (ACT). UC is rated 5 stars overall (QS Stars 2024) and ranks #1 in Australia for full-time graduate employment in the public sector — a natural advantage given Canberra's government-employer base.",
      "International students enter via UC College — the Navitas pathway college on the UC Bruce campus — with Diploma and Foundation programs leading into the second year of a UC Bachelor's degree across IT, business, health, design and communication.",
    ],
    paragraphsRu: [
      'University of Canberra (UC) — государственный университет столицы, главный кампус в Bruce (Канберра, ACT). 5 звёзд QS Stars 2024. №1 в Австралии по трудоустройству выпускников в государственном секторе — естественное преимущество столицы Австралии.',
      'Международные студенты заходят через UC College — pathway-колледж Navitas на кампусе UC Bruce. Diploma и Foundation ведут на второй курс бакалавриата UC: IT, бизнес, health, дизайн, коммуникации.',
    ],
    keyFacts: [
      '5-star overall rating (QS Stars 2024)',
      '#1 in Australia for graduate employment in public sector',
      'Over 18,000 students',
      'Founded in 1990',
      'Capital city — government-employer base',
    ],
    keyFactsRu: [
      'Общая оценка 5 звёзд QS Stars 2024',
      '№1 в Австралии по трудоустройству в госсекторе',
      'Более 18 000 студентов',
      'Основан в 1990',
      'Столица Австралии — государственные работодатели',
    ],
    accommodation: [
      { name: 'UC Lodge / UniLodge Canberra', price: 'от AU$285/нед', text: 'On-campus резиденции в Bruce — комнаты с общей кухней, рядом с UC College.' },
      { name: 'Homestay через UC College', price: 'от AU$330/нед', text: 'Австралийская семья в Канберре — питание и комната, идеально для адаптации в столице.' },
    ],
    campuses: [
      { title: 'UC Bruce Campus (Canberra)', sub: 'Главный кампус — 8 км от центра Канберры', text: '120 гектар, UC College, главная библиотека, спортивный центр. Кампус-сообщество.' },
    ],
  },
  {
    slug: 'charles-sturt',
    name: 'Charles Sturt University',
    city: 'Bathurst',
    navitasUrl: 'https://sydneymelbourne.csu.edu.au/',
    officialUrl: 'https://www.csu.edu.au/',
    tuition: { foundation: 24000, bachelor: 31500, master: 36000 },
    ielts: 6.0,
    paragraphs: [
      "Charles Sturt University (CSU) is Australia's largest regional university with campuses in Albury-Wodonga, Bathurst, Canberra, Dubbo, Goulburn, Orange, Port Macquarie, Wagga Wagga — plus dedicated international campuses in Sydney and Melbourne run as Charles Sturt University Study Centres (Navitas).",
      "International students typically join at the Sydney or Melbourne Study Centre — modern city-centre campuses operated by Navitas — with the same accredited CSU degrees as the regional campuses. Most popular programs: business, IT, accounting, project management.",
    ],
    paragraphsRu: [
      'Charles Sturt University (CSU) — крупнейший региональный университет Австралии: кампусы в Albury-Wodonga, Bathurst, Canberra, Dubbo, Goulburn, Orange, Port Macquarie, Wagga Wagga + отдельные международные кампусы в Сиднее и Мельбурне (Charles Sturt University Study Centres — управляются Navitas).',
      'Международные студенты обычно идут в Sydney или Melbourne Study Centre — современные кампусы в центре городов, под управлением Navitas. Дипломы аккредитованы CSU. Самые популярные программы: бизнес, IT, бухучёт, project management.',
    ],
    keyFacts: [
      "Australia's largest regional university",
      'Top 100 in the world under 50 years (THE Young University Rankings)',
      'Over 37,000 students',
      'Founded in 1989',
      'Sydney + Melbourne international Study Centres',
    ],
    keyFactsRu: [
      'Крупнейший региональный университет Австралии',
      'Топ-100 в мире среди молодых вузов (THE Young University Rankings)',
      'Более 37 000 студентов',
      'Основан в 1989',
      'Sydney + Melbourne международные Study Centres',
    ],
    accommodation: [
      { name: 'Sydney Study Centre — partner residences', price: 'от AU$310/нед', text: 'Студенческие резиденции в Sydney CBD — партнёрские здания в 10-15 минутах ходьбы от Study Centre.' },
      { name: 'Homestay через Study Centre', price: 'от AU$335/нед', text: 'Австралийская семья в Сиднее или Мельбурне — питание и комната, идеально для адаптации.' },
    ],
    campuses: [
      { title: 'Sydney Study Centre', sub: 'В центре Сиднея (CBD)', text: 'Современный кампус для международных студентов под управлением Navitas. Бизнес, IT, бухучёт.' },
      { title: 'Melbourne Study Centre', sub: 'В центре Мельбурна (CBD)', text: 'Аналогичный кампус в центре Мельбурна. Те же программы, что и в Сиднее.' },
    ],
  },
  {
    slug: 'acap',
    name: 'ACAP University College',
    city: 'Sydney',
    navitasUrl: 'https://www.acap.edu.au/',
    officialUrl: 'https://www.acap.edu.au/',
    tuition: { foundation: 22400, bachelor: 28800, master: 33500 },
    ielts: 6.5,
    paragraphs: [
      "ACAP University College (Australian College of Applied Professions) is Australia's leading specialist provider of psychology, counselling, social work, and criminology programs. ACAP operates four campuses — Adelaide, Melbourne, Perth, and Sydney — plus a strong online learning portfolio.",
      'ACAP became a fully-fledged University College in 2024, recognised by TEQSA. Its applied focus, small class sizes and industry-experienced lecturers make it a strong choice for students aiming at registered psychology, counselling, or social-work careers.',
    ],
    paragraphsRu: [
      'ACAP University College (Australian College of Applied Professions) — ведущий специализированный провайдер программ по психологии, counselling, social work и криминологии в Австралии. Четыре кампуса: Аделаида, Мельбурн, Перт, Сидней + сильная онлайн-программа.',
      'В 2024 году ACAP получил статус University College от TEQSA. Прикладной фокус, маленькие классы, преподаватели с индустриальным опытом — отличный выбор для тех, кто целится в registered psychology, counselling или social work карьеру.',
    ],
    keyFacts: [
      "Australia's leading psychology + counselling specialist",
      'University College status — TEQSA recognised (2024)',
      '4 campuses + strong online offer',
      'Founded in 1983',
      'Small class sizes, applied focus',
    ],
    keyFactsRu: [
      'Ведущий специалист Австралии по психологии и counselling',
      'Статус University College — признан TEQSA (2024)',
      '4 кампуса + сильная онлайн-программа',
      'Основан в 1983',
      'Маленькие классы, прикладной фокус',
    ],
    accommodation: [
      { name: 'Partner student residences (Sydney CBD)', price: 'от AU$300/нед', text: 'ACAP не имеет собственных общежитий; партнёрские студенческие резиденции в Sydney CBD рядом с кампусом.' },
      { name: 'Homestay через ACAP', price: 'от AU$335/нед', text: 'Австралийская семья — питание и комната, доступна во всех 4 городах.' },
    ],
    campuses: [
      { title: 'Sydney Campus', sub: '255 Elizabeth Street, Sydney CBD', text: 'Главный кампус ACAP в центре Сиднея — основные программы по психологии и counselling.' },
      { title: 'Melbourne / Perth / Adelaide Campuses', sub: 'Региональные кампусы', text: 'Те же программы доступны в Мельбурне, Перте и Аделаиде — выбирай ближайший к месту проживания.' },
    ],
  },
  {
    slug: 'sae',
    name: 'SAE University College',
    city: 'Sydney',
    navitasUrl: 'https://sae.edu.au/',
    officialUrl: 'https://sae.edu.au/',
    tuition: { foundation: 18500, bachelor: 26500, master: 30000 },
    ielts: 6.0,
    paragraphs: [
      "SAE University College is one of the world's most established creative-media institutions, with 50+ campuses across 23 countries. SAE specialises in film, audio, animation, games, design, and music — taught in industry-spec studios using the same software and hardware used by professional production houses.",
      'In Australia, SAE operates campuses in Sydney, Melbourne, Brisbane, Perth, Adelaide, and Byron Bay — plus an online offer. SAE was granted University College status by TEQSA in 2023 and offers Diploma, Bachelor and Master degrees in creative media.',
    ],
    paragraphsRu: [
      'SAE University College — одно из самых известных в мире учреждений креативных медиа: 50+ кампусов в 23 странах. Специализация: фильм, аудио, анимация, игры, дизайн, музыка. Преподавание в индустриальных студиях с тем же ПО и оборудованием, что используют профессиональные продакшен-хаусы.',
      'В Австралии — 6 кампусов: Сидней, Мельбурн, Брисбен, Перт, Аделаида, Byron Bay + онлайн. В 2023 TEQSA присвоил SAE статус University College. Diploma, Bachelor и Master в области creative media.',
    ],
    keyFacts: [
      "One of the world's most established creative-media institutions",
      'University College status — TEQSA recognised (2023)',
      '50+ campuses across 23 countries',
      'Founded in 1976 (in Sydney)',
      'Industry-spec studios — film, audio, animation, games',
    ],
    keyFactsRu: [
      'Одно из самых известных в мире учреждений креативных медиа',
      'Статус University College — признан TEQSA (2023)',
      '50+ кампусов в 23 странах',
      'Основан в 1976 (в Сиднее)',
      'Индустриальные студии — фильм, аудио, анимация, игры',
    ],
    accommodation: [
      { name: 'Partner student residences (Sydney CBD)', price: 'от AU$290/нед', text: 'SAE не имеет собственных общежитий; партнёрские резиденции в Sydney / Melbourne / Brisbane.' },
      { name: 'Homestay через SAE', price: 'от AU$320/нед', text: 'Австралийская семья — питание и комната, доступна во всех 6 городах.' },
    ],
    campuses: [
      { title: 'Sydney Campus', sub: '39 Regent Street, Chippendale', text: 'Главный кампус в Сиднее — рядом с Central Station. Студии аудио, фильма, игр.' },
      { title: 'Byron Bay Campus', sub: 'NSW северное побережье', text: 'Уникальный кампус в Byron Bay — фильм, анимация, музыка в creative-friendly среде.' },
    ],
  },
];

const NAVITAS_BURSARY = {
  name: 'Navitas Loyalty Bursary',
  nameRu: 'Navitas Loyalty Bursary',
  amount: 'до AU$2,000',
  description: 'Discount on first-trimester fees for students progressing from a Navitas pathway college to the partner university.',
  descriptionRu: 'Скидка на оплату первого триместра для студентов, переходящих из pathway-колледжа Navitas в партнёрский университет.',
  url: 'https://www.navitas.com/study/scholarships/',
};

function buildPrograms(uni) {
  return [
    {
      slug: `${uni.slug}-foundation-pathway`,
      title: "Foundation Studies / Diploma — pathway to Bachelor's",
      durationYears: 1,
      level: 'foundation',
      language: 'en',
      faculty: 'Foundation',
      intakes: ['February', 'July'],
      programUrl: uni.navitasUrl,
      programType: 'pathway',
    },
    {
      slug: `${uni.slug}-bachelor-overview`,
      title: `Bachelor's degrees at ${uni.name}`,
      durationYears: 3,
      level: 'bachelor',
      language: 'en',
      faculty: 'Programs across all faculties',
      intakes: ['February', 'July'],
      programUrl: uni.officialUrl,
      programType: 'degree',
    },
    {
      slug: `${uni.slug}-master-overview`,
      title: `Master's and Postgraduate degrees at ${uni.name}`,
      durationYears: 1.5,
      level: 'master',
      language: 'en',
      faculty: 'Programs across all faculties',
      intakes: ['February', 'July'],
      programUrl: uni.officialUrl,
      programType: 'degree',
    },
  ];
}

function buildUniversity(uni) {
  const programs = buildPrograms(uni);
  const tuitionByProgram = {
    [`${uni.slug}-foundation-pathway`]: uni.tuition.foundation,
    [`${uni.slug}-bachelor-overview`]: uni.tuition.bachelor,
    [`${uni.slug}-master-overview`]: uni.tuition.master,
  };
  const deadlines = {
    [`${uni.slug}-foundation-pathway`]: INTAKE_FEB,
    [`${uni.slug}-bachelor-overview`]: INTAKE_FEB,
    [`${uni.slug}-master-overview`]: INTAKE_JUL,
  };
  const sourceHash = `sha256:${createHash('sha256').update(`navitas-${uni.slug}-2026-05-15`).digest('hex').slice(0, 16)}`;
  return {
    slug: uni.slug,
    name: uni.name,
    country: 'Australia',
    city: uni.city,
    programs,
    tuition: { currency: 'AUD', byProgram: tuitionByProgram },
    deadlines,
    requirements: {
      language: { ielts: uni.ielts },
      exams: ['IELTS Academic'],
    },
    scholarships: [NAVITAS_BURSARY],
    accommodation: uni.accommodation,
    campuses: uni.campuses,
    description: {
      paragraphs: uni.paragraphs,
      paragraphsRu: uni.paragraphsRu,
      keyFacts: uni.keyFacts,
      keyFactsRu: uni.keyFactsRu,
    },
    lastChecked: TODAY,
    sourceUrl: uni.navitasUrl,
    sourceHash,
    confidence: 'aggregator',
    language: 'ru',
  };
}

async function main() {
  await mkdir(CONTENT_DIR, { recursive: true });
  for (const uni of UNIS) {
    const university = buildUniversity(uni);
    const filePath = resolve(CONTENT_DIR, `${uni.slug}.json`);
    await writeFile(filePath, JSON.stringify(university, null, 2) + '\n', 'utf8');
    console.log(`[seed] wrote ${uni.slug}.json (${university.programs.length} programs)`);
  }
  console.log(`[seed] done · ${UNIS.length} universities`);
}

main().catch((err) => {
  console.error('[seed] FAILED:', err);
  process.exit(1);
});
