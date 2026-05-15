// One-shot seeder for Navitas-AU partner universities (v2: full program catalog).
// Writes site/src/content/universities/{slug}.json for 11 Australian
// parent universities listed in sources/universities.list.md under
// `navitas-pathways`. Each uni now ships ~25-35 programs across all
// major faculties: Foundation Studies + 5-10 Diplomas (pathway college,
// real published Navitas streams) + 10-20 Bachelor's degrees from the
// parent uni catalog + 3-8 Master's degrees. Tuition is set by per-uni
// per-faculty fee bands (AUD/year, from published 2024-25 fee schedules).
//
// Run: node scraper/seed-navitas-au.mjs
//
// Idempotent: overwrites the JSON file every run.

import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = resolve(__dirname, '../site/src/content/universities');

const TODAY = new Date().toISOString();
const NEXT_YEAR = new Date().getUTCFullYear() + 1;
const INTAKE_FEB = `${NEXT_YEAR}-02-15T00:00:00.000Z`;
const INTAKE_JUL = `${NEXT_YEAR}-07-01T00:00:00.000Z`;
const INTAKE_NOV = `${NEXT_YEAR}-11-01T00:00:00.000Z`;

const STANDARD_INTAKES = ['February', 'July', 'November'];
const DEFAULT_INTAKES = ['February', 'July'];

function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['‘’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Per-uni data — fee bands in AUD/year, descriptions, faculties.
 *
 * Each faculty maps to a list of programs. Each program is a tuple:
 *   [title, level, durationYears, feeBandKey?, intakes?]
 * - title: display name
 * - level: 'foundation' | 'bachelor' | 'master' | 'phd'
 * - durationYears: number
 * - feeBandKey: optional override; defaults to faculty key
 * - intakes: optional array; defaults to ['February', 'July']
 */
const UNIS = [
  {
    slug: 'curtin',
    name: 'Curtin University',
    city: 'Perth',
    navitasUrl: 'https://www.curtincollege.edu.au/',
    officialUrl: 'https://www.curtin.edu.au/',
    coursesUrl: 'https://www.curtincollege.edu.au/courses/',
    ielts: 6.0,
    feeBand: {
      foundation: 28800,
      'diploma-business': 30900,
      'diploma-engineering': 32800,
      'diploma-health': 32100,
      'diploma-it': 31500,
      'diploma-arts': 29700,
      'diploma-science': 32100,
      'diploma-built-env': 32100,
      'bachelor-business': 35200,
      'bachelor-engineering': 41800,
      'bachelor-health': 39200,
      'bachelor-nursing': 36800,
      'bachelor-it': 38600,
      'bachelor-arts': 33500,
      'bachelor-science': 38900,
      'bachelor-mining': 47900,
      'master-business': 36300,
      'master-engineering': 43500,
      'master-health': 40900,
      'master-it': 40700,
    },
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
      { name: 'Homestay через Curtin College', price: 'от AU$355/нед', text: 'Проживание в принимающей семье — питание и комната включены.' },
    ],
    campuses: [
      { title: 'Bentley Main Campus (Perth)', sub: '116 гектар, 9 km от центра Перта', text: 'Основной кампус, где находится Curtin College и большинство факультетов.' },
      { title: 'Curtin Singapore + Dubai + Malaysia', sub: 'Международные кампусы', text: 'Curtin — один из немногих австралийских университетов с полноценными зарубежными кампусами.' },
    ],
    pathwayPrograms: {
      'Foundation Studies': [
        ['Foundation Studies — pathway to Curtin Bachelor', 'foundation', 1, 'foundation'],
      ],
      'Business and Commerce': [
        ['Diploma of Commerce — Stage 2', 'foundation', 0.75, 'diploma-business'],
        ['Diploma of Commerce (Extended)', 'foundation', 1, 'diploma-business'],
      ],
      'Built Environment': [
        ['Diploma of Built Environment — Stage 2', 'foundation', 0.75, 'diploma-built-env'],
      ],
      'Computing and IT': [
        ['Diploma of Computing and Networking — Stage 2', 'foundation', 0.75, 'diploma-it'],
      ],
      'Engineering': [
        ['Diploma of Engineering — Stage 2', 'foundation', 0.75, 'diploma-engineering'],
        ['Diploma of Engineering (Extended)', 'foundation', 1, 'diploma-engineering'],
      ],
      'Health Sciences': [
        ['Diploma of Health Sciences — Stage 2', 'foundation', 0.75, 'diploma-health'],
      ],
      'Arts and Communication': [
        ['Diploma of Mass Communication — Stage 2', 'foundation', 0.75, 'diploma-arts'],
        ['Diploma of Arts — Stage 2', 'foundation', 0.75, 'diploma-arts'],
      ],
      'Science': [
        ['Diploma of Science — Stage 2', 'foundation', 0.75, 'diploma-science'],
        ['Diploma of Mathematical Sciences — Stage 2', 'foundation', 0.75, 'diploma-science'],
      ],
    },
    bachelorPrograms: {
      'Business and Commerce': [
        ['Bachelor of Commerce', 'bachelor', 3, 'bachelor-business'],
        ['Bachelor of Business Administration', 'bachelor', 3, 'bachelor-business'],
        ['Bachelor of Marketing', 'bachelor', 3, 'bachelor-business'],
        ['Bachelor of Accounting', 'bachelor', 3, 'bachelor-business'],
      ],
      'Engineering': [
        ['Bachelor of Engineering (Civil and Construction)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering (Mechanical)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering (Mining)', 'bachelor', 4, 'bachelor-mining'],
        ['Bachelor of Engineering (Electrical and Electronic)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering (Chemical)', 'bachelor', 4, 'bachelor-engineering'],
      ],
      'Computing and IT': [
        ['Bachelor of Information Technology', 'bachelor', 3, 'bachelor-it'],
        ['Bachelor of Computer Science', 'bachelor', 3, 'bachelor-it'],
        ['Bachelor of Cyber Security', 'bachelor', 3, 'bachelor-it'],
      ],
      'Health Sciences': [
        ['Bachelor of Nursing', 'bachelor', 3, 'bachelor-nursing'],
        ['Bachelor of Health Sciences', 'bachelor', 3, 'bachelor-health'],
        ['Bachelor of Pharmacy', 'bachelor', 4, 'bachelor-health'],
        ['Bachelor of Physiotherapy', 'bachelor', 4, 'bachelor-health'],
      ],
      'Arts and Communication': [
        ['Bachelor of Arts (Mass Communication)', 'bachelor', 3, 'bachelor-arts'],
        ['Bachelor of Design (Interior Architecture)', 'bachelor', 3, 'bachelor-arts'],
      ],
      'Science': [
        ['Bachelor of Science (Computer Science)', 'bachelor', 3, 'bachelor-science'],
        ['Bachelor of Science (Geology)', 'bachelor', 3, 'bachelor-science'],
        ['Bachelor of Science (Actuarial Science)', 'bachelor', 3, 'bachelor-science'],
      ],
    },
    masterPrograms: {
      'Business and Commerce': [
        ['Master of Business Administration', 'master', 1.5, 'master-business'],
        ['Master of Commerce', 'master', 2, 'master-business'],
        ['Master of Finance', 'master', 2, 'master-business'],
      ],
      'Engineering': [
        ['Master of Engineering (Civil)', 'master', 2, 'master-engineering'],
        ['Master of Project Management', 'master', 2, 'master-engineering'],
      ],
      'Computing and IT': [
        ['Master of Information Technology', 'master', 2, 'master-it'],
        ['Master of Cyber Security', 'master', 2, 'master-it'],
      ],
      'Health Sciences': [
        ['Master of Public Health', 'master', 2, 'master-health'],
      ],
    },
  },
  {
    slug: 'deakin',
    name: 'Deakin University',
    city: 'Melbourne',
    navitasUrl: 'https://www.deakincollege.edu.au/',
    officialUrl: 'https://www.deakin.edu.au/',
    coursesUrl: 'https://www.deakincollege.edu.au/courses/',
    ielts: 6.0,
    feeBand: {
      foundation: 30400,
      'diploma-business': 32400,
      'diploma-engineering': 34400,
      'diploma-health': 33800,
      'diploma-it': 33000,
      'diploma-arts': 31400,
      'diploma-science': 33800,
      'diploma-design': 32600,
      'bachelor-business': 36500,
      'bachelor-engineering': 42800,
      'bachelor-health': 41200,
      'bachelor-nursing': 38500,
      'bachelor-it': 40400,
      'bachelor-arts': 34500,
      'bachelor-science': 40400,
      'bachelor-design': 38500,
      'master-business': 38500,
      'master-engineering': 44500,
      'master-health': 42200,
      'master-it': 42500,
    },
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
      { name: 'Homestay через Deakin College', price: 'от AU$345/нед', text: 'Австралийская принимающая семья, питание и комната включены.' },
    ],
    campuses: [
      { title: 'Melbourne Burwood Campus', sub: 'Главный кампус — 14 км от центра Мельбурна', text: 'Здесь учится большинство международных студентов. Deakin College — на этом же кампусе.' },
      { title: 'Geelong Waurn Ponds + Waterfront', sub: '70 км от Мельбурна', text: 'Инженерия, медицина, морские науки, исследовательские центры.' },
    ],
    pathwayPrograms: {
      'Foundation Studies': [
        ['Foundation Program — pathway to Deakin Bachelor', 'foundation', 1, 'foundation'],
      ],
      'Business and Commerce': [
        ['Diploma of Business', 'foundation', 0.67, 'diploma-business'],
        ['Diploma of Commerce', 'foundation', 0.67, 'diploma-business'],
      ],
      'Engineering': [
        ['Diploma of Engineering', 'foundation', 1, 'diploma-engineering'],
      ],
      'Computing and IT': [
        ['Diploma of Information Technology', 'foundation', 1, 'diploma-it'],
      ],
      'Health Sciences': [
        ['Diploma of Health Sciences', 'foundation', 1, 'diploma-health'],
      ],
      'Communication and Media': [
        ['Diploma of Communication', 'foundation', 0.67, 'diploma-arts'],
        ['Diploma of Film, Television & Animation', 'foundation', 0.67, 'diploma-arts'],
      ],
      'Design and Architecture': [
        ['Diploma of Design', 'foundation', 0.67, 'diploma-design'],
      ],
      'Science': [
        ['Diploma of Science', 'foundation', 1, 'diploma-science'],
      ],
    },
    bachelorPrograms: {
      'Business and Commerce': [
        ['Bachelor of Commerce', 'bachelor', 3, 'bachelor-business'],
        ['Bachelor of Business', 'bachelor', 3, 'bachelor-business'],
        ['Bachelor of Marketing', 'bachelor', 3, 'bachelor-business'],
        ['Bachelor of International Business', 'bachelor', 3, 'bachelor-business'],
      ],
      'Engineering': [
        ['Bachelor of Engineering (Civil)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering (Mechanical)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering (Mechatronics)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering (Software)', 'bachelor', 4, 'bachelor-engineering'],
      ],
      'Computing and IT': [
        ['Bachelor of Information Technology', 'bachelor', 3, 'bachelor-it'],
        ['Bachelor of Computer Science', 'bachelor', 3, 'bachelor-it'],
        ['Bachelor of Cyber Security', 'bachelor', 3, 'bachelor-it'],
        ['Bachelor of Data Science', 'bachelor', 3, 'bachelor-it'],
      ],
      'Health Sciences': [
        ['Bachelor of Nursing', 'bachelor', 3, 'bachelor-nursing'],
        ['Bachelor of Health Sciences', 'bachelor', 3, 'bachelor-health'],
        ['Bachelor of Public Health and Health Promotion', 'bachelor', 3, 'bachelor-health'],
        ['Bachelor of Exercise and Sport Science', 'bachelor', 3, 'bachelor-health'],
      ],
      'Communication and Media': [
        ['Bachelor of Communication (Public Relations)', 'bachelor', 3, 'bachelor-arts'],
        ['Bachelor of Film, Television and Animation', 'bachelor', 3, 'bachelor-arts'],
      ],
      'Design and Architecture': [
        ['Bachelor of Design (Visual Communication)', 'bachelor', 3, 'bachelor-design'],
        ['Bachelor of Architectural Studies', 'bachelor', 3, 'bachelor-design'],
      ],
      'Science': [
        ['Bachelor of Science', 'bachelor', 3, 'bachelor-science'],
        ['Bachelor of Biomedical Science', 'bachelor', 3, 'bachelor-science'],
        ['Bachelor of Environmental Science', 'bachelor', 3, 'bachelor-science'],
      ],
    },
    masterPrograms: {
      'Business and Commerce': [
        ['Master of Business Administration (MBA)', 'master', 1.5, 'master-business'],
        ['Master of Commerce', 'master', 2, 'master-business'],
        ['Master of International Business', 'master', 1.5, 'master-business'],
      ],
      'Engineering': [
        ['Master of Engineering', 'master', 2, 'master-engineering'],
        ['Master of Construction Management', 'master', 2, 'master-engineering'],
      ],
      'Computing and IT': [
        ['Master of Information Technology', 'master', 2, 'master-it'],
        ['Master of Data Science', 'master', 2, 'master-it'],
      ],
      'Health Sciences': [
        ['Master of Public Health', 'master', 2, 'master-health'],
        ['Master of Nursing Practice', 'master', 2, 'master-health'],
      ],
    },
  },
  {
    slug: 'edith-cowan',
    name: 'Edith Cowan University',
    city: 'Perth',
    navitasUrl: 'https://www.edithcowancollege.edu.au/',
    officialUrl: 'https://www.ecu.edu.au/',
    coursesUrl: 'https://www.edithcowancollege.edu.au/courses/',
    ielts: 6.0,
    feeBand: {
      foundation: 27200,
      'diploma-business': 28800,
      'diploma-engineering': 31200,
      'diploma-health': 30500,
      'diploma-it': 30100,
      'diploma-arts': 28800,
      'diploma-science': 30500,
      'diploma-hotel': 28800,
      'bachelor-business': 32100,
      'bachelor-engineering': 36500,
      'bachelor-health': 34800,
      'bachelor-nursing': 33500,
      'bachelor-it': 34500,
      'bachelor-arts': 31500,
      'bachelor-science': 34500,
      'bachelor-performing-arts': 35200,
      'master-business': 34800,
      'master-engineering': 38000,
      'master-health': 35500,
      'master-it': 35500,
    },
    paragraphs: [
      'Edith Cowan University (ECU) is a Perth-based public university known for the Western Australian Academy of Performing Arts (WAAPA) — one of the top performing-arts schools in the southern hemisphere — and for nursing, cyber security, and education programs. ECU is rated 5 stars overall by QS (2024).',
      "International students enter via Edith Cowan College (ECC) — Navitas's pathway college on the Joondalup campus — with Diploma and Foundation programs leading into the second year of an ECU Bachelor's degree. Direct-entry English programs are also available through the ECU English Centre.",
    ],
    paragraphsRu: [
      'Edith Cowan University (ECU) — государственный университет в Перте. Известен Western Australian Academy of Performing Arts (WAAPA) — одной из лучших performing-arts школ Южного полушария — а также программами по сестринскому делу, кибербезопасности и образованию. Общая оценка 5 звёзд QS (2024).',
      'Международные студенты заходят через Edith Cowan College (ECC) — pathway-колледж Navitas на кампусе Joondalup. Diploma и Foundation ведут на второй курс бакалавриата ECU.',
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
      { title: 'Joondalup Campus (Perth)', sub: 'Главный кампус — 25 км от центра Перта', text: 'Основной кампус, ECC и большинство международных программ.' },
      { title: 'Mount Lawley Campus', sub: '7 км от центра Перта', text: 'WAAPA, education, arts and humanities. Студии, концертные залы.' },
    ],
    pathwayPrograms: {
      'Foundation Studies': [
        ['Foundation Program — pathway to ECU Bachelor', 'foundation', 1, 'foundation'],
      ],
      'Business and Commerce': [
        ['Diploma of Commerce', 'foundation', 0.67, 'diploma-business'],
      ],
      'Hospitality and Tourism': [
        ['Diploma of Hotel Management', 'foundation', 0.67, 'diploma-hotel'],
      ],
      'Computing and IT': [
        ['Diploma of Science (Computing/IT)', 'foundation', 0.67, 'diploma-it'],
      ],
      'Engineering': [
        ['Diploma of Science (Engineering)', 'foundation', 0.67, 'diploma-engineering'],
      ],
      'Health Sciences': [
        ['Diploma of Health Science', 'foundation', 0.67, 'diploma-health'],
      ],
      'Communication and Media': [
        ['Diploma of Communications & Creative Industries', 'foundation', 0.67, 'diploma-arts'],
      ],
    },
    bachelorPrograms: {
      'Business and Commerce': [
        ['Bachelor of Commerce', 'bachelor', 3, 'bachelor-business'],
        ['Bachelor of Business', 'bachelor', 3, 'bachelor-business'],
        ['Bachelor of Marketing', 'bachelor', 3, 'bachelor-business'],
      ],
      'Hospitality and Tourism': [
        ['Bachelor of Hospitality and Tourism Management', 'bachelor', 3, 'bachelor-business'],
      ],
      'Engineering': [
        ['Bachelor of Engineering (Civil)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering (Electrical)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering (Mechanical)', 'bachelor', 4, 'bachelor-engineering'],
      ],
      'Computing and IT': [
        ['Bachelor of Cyber Security', 'bachelor', 3, 'bachelor-it'],
        ['Bachelor of Computer Science', 'bachelor', 3, 'bachelor-it'],
        ['Bachelor of Information Technology', 'bachelor', 3, 'bachelor-it'],
      ],
      'Health Sciences': [
        ['Bachelor of Nursing', 'bachelor', 3, 'bachelor-nursing'],
        ['Bachelor of Health Science', 'bachelor', 3, 'bachelor-health'],
        ['Bachelor of Paramedical Science', 'bachelor', 3, 'bachelor-health'],
      ],
      'Communication and Media': [
        ['Bachelor of Communications', 'bachelor', 3, 'bachelor-arts'],
        ['Bachelor of Creative Industries', 'bachelor', 3, 'bachelor-arts'],
      ],
      'Performing Arts (WAAPA)': [
        ['Bachelor of Music (WAAPA)', 'bachelor', 3, 'bachelor-performing-arts'],
        ['Bachelor of Performing Arts (Music Theatre)', 'bachelor', 3, 'bachelor-performing-arts'],
      ],
      'Science': [
        ['Bachelor of Science', 'bachelor', 3, 'bachelor-science'],
      ],
    },
    masterPrograms: {
      'Business and Commerce': [
        ['Master of Business Administration (MBA)', 'master', 1.5, 'master-business'],
        ['Master of Professional Accounting', 'master', 2, 'master-business'],
      ],
      'Computing and IT': [
        ['Master of Cyber Security', 'master', 2, 'master-it'],
        ['Master of Information Technology', 'master', 2, 'master-it'],
      ],
      'Health Sciences': [
        ['Master of Nursing', 'master', 2, 'master-health'],
        ['Master of Public Health', 'master', 2, 'master-health'],
      ],
    },
  },
  {
    slug: 'griffith',
    name: 'Griffith University',
    city: 'Brisbane',
    navitasUrl: 'https://www.griffithcollege.edu.au/',
    officialUrl: 'https://www.griffith.edu.au/',
    coursesUrl: 'https://www.griffithcollege.edu.au/courses/',
    ielts: 6.0,
    feeBand: {
      foundation: 28000,
      'diploma-business': 30200,
      'diploma-engineering': 32100,
      'diploma-health': 31500,
      'diploma-it': 31200,
      'diploma-arts': 29500,
      'diploma-hotel': 30200,
      'diploma-design': 30500,
      'bachelor-business': 34000,
      'bachelor-engineering': 41500,
      'bachelor-health': 38500,
      'bachelor-nursing': 35500,
      'bachelor-it': 37500,
      'bachelor-arts': 32500,
      'bachelor-design': 36500,
      'bachelor-music': 38500,
      'master-business': 36000,
      'master-engineering': 43500,
      'master-health': 39500,
      'master-it': 39500,
    },
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
    pathwayPrograms: {
      'Foundation Studies': [
        ['Foundation Program — pathway to Griffith Bachelor', 'foundation', 1, 'foundation'],
      ],
      'Business and Commerce': [
        ['Diploma of Commerce', 'foundation', 0.67, 'diploma-business'],
        ['Diploma of Business', 'foundation', 0.67, 'diploma-business'],
      ],
      'Hospitality and Tourism': [
        ['Diploma of Hotel Management', 'foundation', 0.67, 'diploma-hotel'],
      ],
      'Engineering': [
        ['Diploma of Engineering', 'foundation', 0.83, 'diploma-engineering'],
      ],
      'Computing and IT': [
        ['Diploma of Information Technology', 'foundation', 0.67, 'diploma-it'],
      ],
      'Health Sciences': [
        ['Diploma of Health Sciences', 'foundation', 0.67, 'diploma-health'],
      ],
      'Design and Architecture': [
        ['Diploma of Design', 'foundation', 0.67, 'diploma-design'],
      ],
      'Arts and Communication': [
        ['Diploma of Arts and Communication', 'foundation', 0.67, 'diploma-arts'],
      ],
    },
    bachelorPrograms: {
      'Business and Commerce': [
        ['Bachelor of Commerce', 'bachelor', 3, 'bachelor-business'],
        ['Bachelor of Business', 'bachelor', 3, 'bachelor-business'],
        ['Bachelor of International Business', 'bachelor', 3, 'bachelor-business'],
      ],
      'Hospitality and Tourism': [
        ['Bachelor of International Tourism and Hotel Management', 'bachelor', 3, 'bachelor-business'],
      ],
      'Engineering': [
        ['Bachelor of Engineering (Civil) Honours', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering (Mechanical) Honours', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering (Electrical and Electronic) Honours', 'bachelor', 4, 'bachelor-engineering'],
      ],
      'Computing and IT': [
        ['Bachelor of Information Technology', 'bachelor', 3, 'bachelor-it'],
        ['Bachelor of Computer Science', 'bachelor', 3, 'bachelor-it'],
        ['Bachelor of Cyber Security', 'bachelor', 3, 'bachelor-it'],
      ],
      'Health Sciences': [
        ['Bachelor of Nursing', 'bachelor', 3, 'bachelor-nursing'],
        ['Bachelor of Health Sciences', 'bachelor', 3, 'bachelor-health'],
        ['Bachelor of Public Health', 'bachelor', 3, 'bachelor-health'],
        ['Bachelor of Pharmacy Honours', 'bachelor', 4, 'bachelor-health'],
      ],
      'Design and Architecture': [
        ['Bachelor of Architectural Design', 'bachelor', 3, 'bachelor-design'],
        ['Bachelor of Industrial Design', 'bachelor', 3, 'bachelor-design'],
      ],
      'Performing Arts': [
        ['Bachelor of Music (Queensland Conservatorium)', 'bachelor', 3, 'bachelor-music'],
      ],
      'Arts and Communication': [
        ['Bachelor of Communication and Journalism', 'bachelor', 3, 'bachelor-arts'],
        ['Bachelor of Criminology and Criminal Justice', 'bachelor', 3, 'bachelor-arts'],
      ],
    },
    masterPrograms: {
      'Business and Commerce': [
        ['Master of Business Administration (MBA)', 'master', 1.5, 'master-business'],
        ['Master of International Business', 'master', 2, 'master-business'],
      ],
      'Engineering': [
        ['Master of Engineering Project Management', 'master', 1.5, 'master-engineering'],
      ],
      'Computing and IT': [
        ['Master of Information Technology', 'master', 2, 'master-it'],
        ['Master of Cyber Security', 'master', 2, 'master-it'],
      ],
      'Health Sciences': [
        ['Master of Public Health', 'master', 2, 'master-health'],
      ],
    },
  },
  {
    slug: 'la-trobe',
    name: 'La Trobe University',
    city: 'Melbourne',
    navitasUrl: 'https://www.latrobecollegeaustralia.edu.au/',
    officialUrl: 'https://www.latrobe.edu.au/',
    coursesUrl: 'https://www.latrobecollegeaustralia.edu.au/study-options/',
    ielts: 6.0,
    feeBand: {
      foundation: 29500,
      'diploma-business': 32000,
      'diploma-engineering': 33800,
      'diploma-health': 33200,
      'diploma-it': 32500,
      'diploma-arts': 30200,
      'diploma-science': 33200,
      'diploma-biomed': 33800,
      'bachelor-business': 36000,
      'bachelor-engineering': 42500,
      'bachelor-health': 40000,
      'bachelor-nursing': 37500,
      'bachelor-it': 39500,
      'bachelor-arts': 33500,
      'bachelor-science': 39500,
      'bachelor-biomed': 41500,
      'master-business': 37500,
      'master-engineering': 43500,
      'master-health': 40500,
      'master-it': 41500,
    },
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
      { title: 'Sydney Campus (CBD)', sub: 'В центре Сиднея', text: 'Современный кампус в деловом центре Сиднея.' },
    ],
    pathwayPrograms: {
      'Foundation Studies': [
        ['Foundation Studies — pathway to La Trobe Bachelor', 'foundation', 1, 'foundation'],
      ],
      'Business and Commerce': [
        ['Diploma of Business', 'foundation', 0.67, 'diploma-business'],
        ['Diploma of Commerce', 'foundation', 0.67, 'diploma-business'],
      ],
      'Engineering': [
        ['Diploma of Engineering', 'foundation', 0.83, 'diploma-engineering'],
      ],
      'Computing and IT': [
        ['Diploma of Information Technology', 'foundation', 0.67, 'diploma-it'],
      ],
      'Health Sciences': [
        ['Diploma of Health Sciences', 'foundation', 0.67, 'diploma-health'],
      ],
      'Biomedical Science': [
        ['Diploma of Biomedical Science', 'foundation', 0.67, 'diploma-biomed'],
      ],
      'Communication and Media': [
        ['Diploma of Media and Communication', 'foundation', 0.67, 'diploma-arts'],
      ],
      'Science': [
        ['Diploma of Science', 'foundation', 0.67, 'diploma-science'],
      ],
    },
    bachelorPrograms: {
      'Business and Commerce': [
        ['Bachelor of Business', 'bachelor', 3, 'bachelor-business'],
        ['Bachelor of Commerce', 'bachelor', 3, 'bachelor-business'],
        ['Bachelor of International Business', 'bachelor', 3, 'bachelor-business'],
      ],
      'Engineering': [
        ['Bachelor of Engineering (Civil) Honours', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering (Electronic) Honours', 'bachelor', 4, 'bachelor-engineering'],
      ],
      'Computing and IT': [
        ['Bachelor of Information Technology', 'bachelor', 3, 'bachelor-it'],
        ['Bachelor of Computer Science', 'bachelor', 3, 'bachelor-it'],
        ['Bachelor of Cybersecurity', 'bachelor', 3, 'bachelor-it'],
      ],
      'Health Sciences': [
        ['Bachelor of Nursing', 'bachelor', 3, 'bachelor-nursing'],
        ['Bachelor of Health Sciences', 'bachelor', 3, 'bachelor-health'],
        ['Bachelor of Public Health', 'bachelor', 3, 'bachelor-health'],
      ],
      'Biomedical Science': [
        ['Bachelor of Biomedical Science', 'bachelor', 3, 'bachelor-biomed'],
        ['Bachelor of Pharmacy Honours', 'bachelor', 4, 'bachelor-biomed'],
      ],
      'Communication and Media': [
        ['Bachelor of Media and Communication', 'bachelor', 3, 'bachelor-arts'],
        ['Bachelor of Journalism', 'bachelor', 3, 'bachelor-arts'],
      ],
      'Science': [
        ['Bachelor of Science', 'bachelor', 3, 'bachelor-science'],
        ['Bachelor of Agriculture (Honours)', 'bachelor', 4, 'bachelor-science'],
      ],
      'Arts and Humanities': [
        ['Bachelor of Arts', 'bachelor', 3, 'bachelor-arts'],
        ['Bachelor of Politics, Philosophy and Economics', 'bachelor', 3, 'bachelor-arts'],
      ],
    },
    masterPrograms: {
      'Business and Commerce': [
        ['Master of Business Administration (MBA)', 'master', 1.5, 'master-business'],
        ['Master of Commerce', 'master', 2, 'master-business'],
      ],
      'Engineering': [
        ['Master of Engineering', 'master', 2, 'master-engineering'],
      ],
      'Computing and IT': [
        ['Master of Information Technology', 'master', 2, 'master-it'],
        ['Master of Cybersecurity', 'master', 2, 'master-it'],
      ],
      'Health Sciences': [
        ['Master of Public Health', 'master', 2, 'master-health'],
        ['Master of Nursing', 'master', 2, 'master-health'],
      ],
    },
  },
  {
    slug: 'western-sydney',
    name: 'Western Sydney University',
    city: 'Sydney',
    navitasUrl: 'https://internationalcollege.westernsydney.edu.au/',
    officialUrl: 'https://www.westernsydney.edu.au/',
    coursesUrl: 'https://internationalcollege.westernsydney.edu.au/courses/',
    ielts: 6.0,
    feeBand: {
      foundation: 26500,
      'diploma-business': 28800,
      'diploma-engineering': 31200,
      'diploma-health': 30500,
      'diploma-it': 30200,
      'diploma-arts': 28500,
      'diploma-science': 30500,
      'diploma-design': 29800,
      'bachelor-business': 32500,
      'bachelor-engineering': 40000,
      'bachelor-health': 36500,
      'bachelor-nursing': 34500,
      'bachelor-it': 36500,
      'bachelor-arts': 31500,
      'bachelor-science': 37500,
      'bachelor-design': 35500,
      'master-business': 34500,
      'master-engineering': 41500,
      'master-health': 37500,
      'master-it': 38500,
    },
    paragraphs: [
      'Western Sydney University (WSU) operates 10 campuses across Greater Sydney — Parramatta, Bankstown, Campbelltown, Hawkesbury, Penrith, Sydney City and others. Founded in 1989, WSU is #1 in the world for social, economic and environmental impact (Times Higher Education Impact Rankings 2022 and 2023).',
      "International students enter via Western Sydney University International College (WSUIC) — the Navitas pathway college on the Parramatta and Sydney City campuses — or via Sydney Institute of Business and Technology (SIBT). Diploma graduates progress to the second year of a WSU Bachelor's degree.",
    ],
    paragraphsRu: [
      'Western Sydney University (WSU) — 10 кампусов по Большому Сиднею: Parramatta, Bankstown, Campbelltown, Hawkesbury, Penrith, Sydney City и др. Основан в 1989. №1 в мире по социальному, экономическому и экологическому импакту (Times Higher Education Impact Rankings 2022 и 2023).',
      'Международные студенты заходят через Western Sydney University International College (WSUIC) — pathway-колледж Navitas на кампусах Parramatta и Sydney City — или через Sydney Institute of Business and Technology (SIBT).',
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
      { title: 'Sydney City Campus', sub: 'В центре Сиднея (CBD)', text: 'Для тех, кто хочет жить и учиться в центре Сиднея.' },
    ],
    pathwayPrograms: {
      'Foundation Studies': [
        ['Foundation Studies (Standard / Extended)', 'foundation', 1, 'foundation'],
      ],
      'Business and Commerce': [
        ['Diploma of Business', 'foundation', 0.67, 'diploma-business'],
        ['Diploma of Commerce', 'foundation', 0.67, 'diploma-business'],
      ],
      'Engineering': [
        ['Diploma of Engineering', 'foundation', 0.83, 'diploma-engineering'],
        ['Diploma of Construction Management', 'foundation', 0.83, 'diploma-engineering'],
      ],
      'Computing and IT': [
        ['Diploma of Information and Communications Technology', 'foundation', 0.67, 'diploma-it'],
      ],
      'Health Sciences': [
        ['Diploma of Health Science', 'foundation', 0.67, 'diploma-health'],
      ],
      'Communication and Media': [
        ['Diploma of Communication', 'foundation', 0.67, 'diploma-arts'],
      ],
      'Design and Architecture': [
        ['Diploma of Design', 'foundation', 0.67, 'diploma-design'],
      ],
      'Science': [
        ['Diploma of Science', 'foundation', 0.67, 'diploma-science'],
      ],
    },
    bachelorPrograms: {
      'Business and Commerce': [
        ['Bachelor of Business', 'bachelor', 3, 'bachelor-business'],
        ['Bachelor of International Business', 'bachelor', 3, 'bachelor-business'],
        ['Bachelor of Accounting', 'bachelor', 3, 'bachelor-business'],
      ],
      'Engineering': [
        ['Bachelor of Engineering (Honours) (Civil)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering (Honours) (Mechanical)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Construction Management', 'bachelor', 3, 'bachelor-engineering'],
      ],
      'Computing and IT': [
        ['Bachelor of Information and Communications Technology', 'bachelor', 3, 'bachelor-it'],
        ['Bachelor of Computer Science', 'bachelor', 3, 'bachelor-it'],
        ['Bachelor of Cybersecurity and Behaviour', 'bachelor', 3, 'bachelor-it'],
        ['Bachelor of Data Science', 'bachelor', 3, 'bachelor-it'],
      ],
      'Health Sciences': [
        ['Bachelor of Nursing', 'bachelor', 3, 'bachelor-nursing'],
        ['Bachelor of Health Science', 'bachelor', 3, 'bachelor-health'],
        ['Bachelor of Psychology', 'bachelor', 3, 'bachelor-health'],
      ],
      'Communication and Media': [
        ['Bachelor of Communication', 'bachelor', 3, 'bachelor-arts'],
        ['Bachelor of Social Science', 'bachelor', 3, 'bachelor-arts'],
      ],
      'Design and Architecture': [
        ['Bachelor of Industrial Design', 'bachelor', 3, 'bachelor-design'],
      ],
      'Science': [
        ['Bachelor of Science', 'bachelor', 3, 'bachelor-science'],
        ['Bachelor of Environmental Science', 'bachelor', 3, 'bachelor-science'],
      ],
    },
    masterPrograms: {
      'Business and Commerce': [
        ['Master of Business Administration (MBA)', 'master', 1.5, 'master-business'],
        ['Master of Professional Accounting', 'master', 2, 'master-business'],
      ],
      'Engineering': [
        ['Master of Engineering Management', 'master', 2, 'master-engineering'],
      ],
      'Computing and IT': [
        ['Master of Information and Communications Technology', 'master', 2, 'master-it'],
        ['Master of Data Science', 'master', 2, 'master-it'],
      ],
      'Health Sciences': [
        ['Master of Public Health', 'master', 2, 'master-health'],
      ],
    },
  },
  {
    slug: 'sydney',
    name: 'The University of Sydney',
    city: 'Sydney',
    navitasUrl: 'https://www.taylorssydney.edu.au/',
    officialUrl: 'https://www.sydney.edu.au/',
    coursesUrl: 'https://www.taylorssydney.edu.au/',
    ielts: 6.5,
    feeBand: {
      foundation: 36800,
      'bachelor-business': 53500,
      'bachelor-engineering': 56500,
      'bachelor-health': 56500,
      'bachelor-nursing': 49500,
      'bachelor-it': 55500,
      'bachelor-arts': 49500,
      'bachelor-law': 53500,
      'bachelor-science': 56500,
      'bachelor-medicine': 92500,
      'master-business': 58500,
      'master-engineering': 60500,
      'master-health': 56500,
      'master-it': 59500,
      'master-arts': 52500,
      'master-law': 56500,
    },
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
      { title: 'Waterloo (Taylors College)', sub: '5 минут от Camperdown', text: 'Отдельный кампус Foundation-программы — современное здание.' },
    ],
    pathwayPrograms: {
      'Foundation Studies': [
        ['Taylors Foundation — Standard (40 weeks)', 'foundation', 1, 'foundation'],
        ['Taylors Foundation — Extended (60 weeks)', 'foundation', 1.5, 'foundation'],
        ['Taylors Foundation — Intensive (30 weeks)', 'foundation', 0.75, 'foundation'],
      ],
    },
    bachelorPrograms: {
      'Business and Commerce': [
        ['Bachelor of Commerce', 'bachelor', 3, 'bachelor-business'],
        ['Bachelor of Economics', 'bachelor', 3, 'bachelor-business'],
        ['Bachelor of Project Management', 'bachelor', 3, 'bachelor-business'],
      ],
      'Engineering': [
        ['Bachelor of Engineering Honours (Civil)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering Honours (Mechanical)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering Honours (Aeronautical)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering Honours (Electrical)', 'bachelor', 4, 'bachelor-engineering'],
      ],
      'Computing and IT': [
        ['Bachelor of Advanced Computing', 'bachelor', 4, 'bachelor-it'],
        ['Bachelor of Information Technology', 'bachelor', 3, 'bachelor-it'],
      ],
      'Health Sciences': [
        ['Bachelor of Nursing', 'bachelor', 3, 'bachelor-nursing'],
        ['Bachelor of Health Sciences', 'bachelor', 3, 'bachelor-health'],
        ['Bachelor of Pharmacy Honours', 'bachelor', 4, 'bachelor-health'],
      ],
      'Medicine and Dentistry': [
        ['Doctor of Medicine (postgraduate)', 'master', 4, 'bachelor-medicine'],
        ['Bachelor of Oral Health', 'bachelor', 3, 'bachelor-medicine'],
      ],
      'Arts and Humanities': [
        ['Bachelor of Arts', 'bachelor', 3, 'bachelor-arts'],
        ['Bachelor of International and Global Studies', 'bachelor', 3, 'bachelor-arts'],
        ['Bachelor of Political, Economic and Social Sciences', 'bachelor', 3, 'bachelor-arts'],
      ],
      'Law': [
        ['Bachelor of Laws (LLB)', 'bachelor', 4, 'bachelor-law'],
      ],
      'Science': [
        ['Bachelor of Science', 'bachelor', 3, 'bachelor-science'],
        ['Bachelor of Science (Advanced)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Veterinary Biology / Doctor of Veterinary Medicine', 'bachelor', 6, 'bachelor-science'],
      ],
      'Architecture and Design': [
        ['Bachelor of Design in Architecture', 'bachelor', 3, 'bachelor-arts'],
        ['Bachelor of Design Computing', 'bachelor', 3, 'bachelor-arts'],
      ],
    },
    masterPrograms: {
      'Business and Commerce': [
        ['Master of Business Administration (MBA)', 'master', 1.5, 'master-business'],
        ['Master of Commerce', 'master', 1.5, 'master-business'],
        ['Master of International Business', 'master', 1.5, 'master-business'],
      ],
      'Engineering': [
        ['Master of Engineering', 'master', 2, 'master-engineering'],
        ['Master of Project Management', 'master', 1.5, 'master-engineering'],
      ],
      'Computing and IT': [
        ['Master of Information Technology', 'master', 1.5, 'master-it'],
        ['Master of Data Science', 'master', 1.5, 'master-it'],
      ],
      'Health Sciences': [
        ['Master of Public Health', 'master', 1.5, 'master-health'],
        ['Master of Nursing', 'master', 2, 'master-health'],
      ],
      'Law': [
        ['Master of Laws (LLM)', 'master', 1, 'master-law'],
      ],
      'Arts and Humanities': [
        ['Master of International Relations', 'master', 1.5, 'master-arts'],
        ['Master of Education', 'master', 1.5, 'master-arts'],
      ],
    },
  },
  {
    slug: 'canberra',
    name: 'University of Canberra',
    city: 'Canberra',
    navitasUrl: 'https://www.canberra.edu.au/uc-college',
    officialUrl: 'https://www.canberra.edu.au/',
    coursesUrl: 'https://www.canberra.edu.au/uc-college/uc-college-courses',
    ielts: 6.0,
    feeBand: {
      foundation: 24000,
      'diploma-business': 28500,
      'diploma-it': 28800,
      'diploma-design': 28200,
      'diploma-health': 29800,
      'diploma-arts': 27500,
      'bachelor-business': 33500,
      'bachelor-engineering': 38500,
      'bachelor-health': 37500,
      'bachelor-nursing': 35500,
      'bachelor-it': 36500,
      'bachelor-arts': 31500,
      'bachelor-science': 36500,
      'bachelor-design': 35000,
      'master-business': 35500,
      'master-engineering': 40000,
      'master-health': 38000,
      'master-it': 38500,
    },
    paragraphs: [
      "University of Canberra (UC) is the capital city's public university, with its main campus in Bruce, Canberra (ACT). UC is rated 5 stars overall (QS Stars 2024) and ranks #1 in Australia for full-time graduate employment in the public sector — a natural advantage given Canberra's government-employer base.",
      "International students enter via UC College — the Navitas pathway college on the UC Bruce campus — with Diploma and Foundation programs leading into the second year of a UC Bachelor's degree across IT, business, health, design and communication.",
    ],
    paragraphsRu: [
      'University of Canberra (UC) — государственный университет столицы, главный кампус в Bruce (Канберра, ACT). 5 звёзд QS Stars 2024. №1 в Австралии по трудоустройству выпускников в государственном секторе.',
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
      { name: 'Homestay через UC College', price: 'от AU$330/нед', text: 'Австралийская семья в Канберре — питание и комната.' },
    ],
    campuses: [
      { title: 'UC Bruce Campus (Canberra)', sub: 'Главный кампус — 8 км от центра Канберры', text: '120 гектар, UC College, главная библиотека, спортивный центр.' },
    ],
    pathwayPrograms: {
      'Foundation Studies': [
        ['UC College Foundation Studies', 'foundation', 1, 'foundation'],
      ],
      'Business and Commerce': [
        ['Diploma of Business', 'foundation', 0.67, 'diploma-business'],
        ['Diploma of Commerce', 'foundation', 0.67, 'diploma-business'],
      ],
      'Computing and IT': [
        ['Diploma of Information Technology', 'foundation', 0.67, 'diploma-it'],
      ],
      'Health Sciences': [
        ['Diploma of Health Sciences', 'foundation', 0.67, 'diploma-health'],
      ],
      'Communication and Media': [
        ['Diploma of Communication', 'foundation', 0.67, 'diploma-arts'],
      ],
      'Design and Architecture': [
        ['Diploma of Design', 'foundation', 0.67, 'diploma-design'],
      ],
    },
    bachelorPrograms: {
      'Business and Commerce': [
        ['Bachelor of Business Administration', 'bachelor', 3, 'bachelor-business'],
        ['Bachelor of Commerce', 'bachelor', 3, 'bachelor-business'],
        ['Bachelor of Marketing Management', 'bachelor', 3, 'bachelor-business'],
      ],
      'Computing and IT': [
        ['Bachelor of Information Technology', 'bachelor', 3, 'bachelor-it'],
        ['Bachelor of Software Engineering', 'bachelor', 3, 'bachelor-it'],
        ['Bachelor of Cyber Security', 'bachelor', 3, 'bachelor-it'],
      ],
      'Health Sciences': [
        ['Bachelor of Nursing', 'bachelor', 3, 'bachelor-nursing'],
        ['Bachelor of Physiotherapy', 'bachelor', 4, 'bachelor-health'],
        ['Bachelor of Public Health', 'bachelor', 3, 'bachelor-health'],
      ],
      'Communication and Media': [
        ['Bachelor of Communication and Media', 'bachelor', 3, 'bachelor-arts'],
        ['Bachelor of Journalism', 'bachelor', 3, 'bachelor-arts'],
      ],
      'Design and Architecture': [
        ['Bachelor of Design', 'bachelor', 3, 'bachelor-design'],
      ],
      'Science': [
        ['Bachelor of Science', 'bachelor', 3, 'bachelor-science'],
      ],
      'Engineering': [
        ['Bachelor of Engineering (Civil and Environmental) Honours', 'bachelor', 4, 'bachelor-engineering'],
      ],
    },
    masterPrograms: {
      'Business and Commerce': [
        ['Master of Business Administration (MBA)', 'master', 1.5, 'master-business'],
        ['Master of Professional Accounting', 'master', 2, 'master-business'],
      ],
      'Computing and IT': [
        ['Master of Information Technology and Systems', 'master', 2, 'master-it'],
      ],
      'Health Sciences': [
        ['Master of Public Health', 'master', 2, 'master-health'],
      ],
    },
  },
  {
    slug: 'charles-sturt',
    name: 'Charles Sturt University',
    city: 'Bathurst',
    navitasUrl: 'https://sydneymelbourne.csu.edu.au/',
    officialUrl: 'https://www.csu.edu.au/',
    coursesUrl: 'https://sydneymelbourne.csu.edu.au/courses/',
    ielts: 6.0,
    feeBand: {
      foundation: 24000,
      'diploma-business': 26500,
      'diploma-it': 27500,
      'bachelor-business': 31500,
      'bachelor-it': 33500,
      'bachelor-arts': 29500,
      'bachelor-science': 33500,
      'bachelor-health': 35500,
      'master-business': 33500,
      'master-it': 34500,
    },
    paragraphs: [
      "Charles Sturt University (CSU) is Australia's largest regional university with campuses in Albury-Wodonga, Bathurst, Canberra, Dubbo, Goulburn, Orange, Port Macquarie, Wagga Wagga — plus dedicated international campuses in Sydney and Melbourne run as Charles Sturt University Study Centres (Navitas).",
      'International students typically join at the Sydney or Melbourne Study Centre — modern city-centre campuses operated by Navitas — with the same accredited CSU degrees as the regional campuses. Most popular programs: business, IT, accounting, project management.',
    ],
    paragraphsRu: [
      'Charles Sturt University (CSU) — крупнейший региональный университет Австралии: кампусы в Albury-Wodonga, Bathurst, Canberra, Dubbo, Goulburn, Orange, Port Macquarie, Wagga Wagga + отдельные международные кампусы в Сиднее и Мельбурне (Charles Sturt University Study Centres — управляются Navitas).',
      'Международные студенты обычно идут в Sydney или Melbourne Study Centre — современные кампусы в центре городов, под управлением Navitas. Дипломы аккредитованы CSU.',
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
      { name: 'Homestay через Study Centre', price: 'от AU$335/нед', text: 'Австралийская семья в Сиднее или Мельбурне — питание и комната.' },
    ],
    campuses: [
      { title: 'Sydney Study Centre', sub: 'В центре Сиднея (CBD)', text: 'Современный кампус для международных студентов под управлением Navitas. Бизнес, IT, бухучёт.' },
      { title: 'Melbourne Study Centre', sub: 'В центре Мельбурна (CBD)', text: 'Аналогичный кампус в центре Мельбурна.' },
    ],
    pathwayPrograms: {
      'Foundation Studies': [
        ['CSU Study Centres Foundation Studies', 'foundation', 1, 'foundation'],
      ],
      'Business and Commerce': [
        ['Diploma of Business', 'foundation', 0.67, 'diploma-business'],
        ['Diploma of Commerce', 'foundation', 0.67, 'diploma-business'],
      ],
      'Computing and IT': [
        ['Diploma of Information Technology', 'foundation', 0.67, 'diploma-it'],
      ],
    },
    bachelorPrograms: {
      'Business and Commerce': [
        ['Bachelor of Business (Accounting)', 'bachelor', 3, 'bachelor-business'],
        ['Bachelor of Business (Management)', 'bachelor', 3, 'bachelor-business'],
        ['Bachelor of Business (Marketing)', 'bachelor', 3, 'bachelor-business'],
        ['Bachelor of Accounting', 'bachelor', 3, 'bachelor-business'],
      ],
      'Computing and IT': [
        ['Bachelor of Information Technology', 'bachelor', 3, 'bachelor-it'],
        ['Bachelor of Computer Science', 'bachelor', 3, 'bachelor-it'],
        ['Bachelor of Cybersecurity', 'bachelor', 3, 'bachelor-it'],
      ],
      'Arts and Humanities': [
        ['Bachelor of Communication (Public Relations)', 'bachelor', 3, 'bachelor-arts'],
        ['Bachelor of Social Work', 'bachelor', 4, 'bachelor-arts'],
      ],
      'Health Sciences': [
        ['Bachelor of Nursing', 'bachelor', 3, 'bachelor-health'],
      ],
    },
    masterPrograms: {
      'Business and Commerce': [
        ['Master of Business Administration (MBA)', 'master', 1.5, 'master-business'],
        ['Master of Professional Accounting', 'master', 2, 'master-business'],
        ['Master of Information Technology', 'master', 2, 'master-it'],
        ['Master of Project Management', 'master', 1.5, 'master-business'],
      ],
    },
  },
  {
    slug: 'acap',
    name: 'ACAP University College',
    city: 'Sydney',
    navitasUrl: 'https://www.acap.edu.au/',
    officialUrl: 'https://www.acap.edu.au/',
    coursesUrl: 'https://www.acap.edu.au/courses/',
    ielts: 6.5,
    feeBand: {
      foundation: 22400,
      'diploma-psychology': 25500,
      'diploma-counselling': 25500,
      'diploma-social-work': 25500,
      'bachelor-psychology': 30800,
      'bachelor-counselling': 30800,
      'bachelor-social-work': 30800,
      'bachelor-criminology': 28800,
      'bachelor-coaching': 28800,
      'master-psychology': 33500,
      'master-counselling': 33500,
      'master-social-work': 33500,
      'master-coaching': 31500,
    },
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
      { name: 'Partner student residences (Sydney CBD)', price: 'от AU$300/нед', text: 'ACAP не имеет собственных общежитий; партнёрские студенческие резиденции в Sydney CBD.' },
      { name: 'Homestay через ACAP', price: 'от AU$335/нед', text: 'Австралийская семья — питание и комната, доступна во всех 4 городах.' },
    ],
    campuses: [
      { title: 'Sydney Campus', sub: '255 Elizabeth Street, Sydney CBD', text: 'Главный кампус ACAP в центре Сиднея.' },
      { title: 'Melbourne / Perth / Adelaide Campuses', sub: 'Региональные кампусы', text: 'Те же программы доступны в Мельбурне, Перте и Аделаиде.' },
    ],
    pathwayPrograms: {
      'Psychology and Counselling': [
        ['Diploma of Counselling', 'foundation', 1, 'diploma-counselling'],
        ['Diploma of Psychological Science', 'foundation', 1, 'diploma-psychology'],
      ],
      'Social Work': [
        ['Diploma of Community Services', 'foundation', 1, 'diploma-social-work'],
      ],
    },
    bachelorPrograms: {
      'Psychology and Counselling': [
        ['Bachelor of Psychological Science', 'bachelor', 3, 'bachelor-psychology'],
        ['Bachelor of Applied Social Science (Counselling)', 'bachelor', 3, 'bachelor-counselling'],
      ],
      'Social Work': [
        ['Bachelor of Social Work', 'bachelor', 4, 'bachelor-social-work'],
        ['Bachelor of Applied Social Science', 'bachelor', 3, 'bachelor-social-work'],
      ],
      'Criminology and Justice': [
        ['Bachelor of Criminology and Justice', 'bachelor', 3, 'bachelor-criminology'],
      ],
      'Coaching and Leadership': [
        ['Bachelor of Applied Social Science (Coaching)', 'bachelor', 3, 'bachelor-coaching'],
      ],
    },
    masterPrograms: {
      'Psychology and Counselling': [
        ['Master of Counselling and Psychotherapy', 'master', 2, 'master-counselling'],
        ['Master of Professional Psychology (5th year)', 'master', 1, 'master-psychology'],
      ],
      'Social Work': [
        ['Master of Social Work (Qualifying)', 'master', 2, 'master-social-work'],
      ],
      'Coaching and Leadership': [
        ['Master of Coaching Psychology', 'master', 1.5, 'master-coaching'],
      ],
    },
  },
  {
    slug: 'sae',
    name: 'SAE University College',
    city: 'Sydney',
    navitasUrl: 'https://sae.edu.au/',
    officialUrl: 'https://sae.edu.au/',
    coursesUrl: 'https://sae.edu.au/courses/',
    ielts: 6.0,
    feeBand: {
      foundation: 18500,
      'diploma-audio': 24500,
      'diploma-film': 24500,
      'diploma-animation': 24500,
      'diploma-games': 24500,
      'diploma-design': 24500,
      'diploma-music': 24500,
      'bachelor-audio': 27500,
      'bachelor-film': 27500,
      'bachelor-animation': 27500,
      'bachelor-games': 27500,
      'bachelor-design': 27500,
      'bachelor-music': 27500,
      'master-creative': 30000,
    },
    paragraphs: [
      "SAE University College is one of the world's most established creative-media institutions, with 50+ campuses across 23 countries. SAE specialises in film, audio, animation, games, design, and music — taught in industry-spec studios using the same software and hardware used by professional production houses.",
      'In Australia, SAE operates campuses in Sydney, Melbourne, Brisbane, Perth, Adelaide, and Byron Bay — plus an online offer. SAE was granted University College status by TEQSA in 2023 and offers Diploma, Bachelor and Master degrees in creative media.',
    ],
    paragraphsRu: [
      'SAE University College — одно из самых известных в мире учреждений креативных медиа: 50+ кампусов в 23 странах. Специализация: фильм, аудио, анимация, игры, дизайн, музыка. Преподавание в индустриальных студиях с тем же ПО и оборудованием, что используют профессиональные продакшен-хаусы.',
      'В Австралии — 6 кампусов: Сидней, Мельбурн, Брисбен, Перт, Аделаида, Byron Bay + онлайн. В 2023 TEQSA присвоил SAE статус University College.',
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
    pathwayPrograms: {
      'Audio': [
        ['Diploma of Audio', 'foundation', 1, 'diploma-audio'],
      ],
      'Film and Animation': [
        ['Diploma of Film', 'foundation', 1, 'diploma-film'],
        ['Diploma of Animation', 'foundation', 1, 'diploma-animation'],
      ],
      'Games and Design': [
        ['Diploma of Games (Programming / Art)', 'foundation', 1, 'diploma-games'],
        ['Diploma of Design', 'foundation', 1, 'diploma-design'],
      ],
      'Music': [
        ['Diploma of Music (Production)', 'foundation', 1, 'diploma-music'],
      ],
    },
    bachelorPrograms: {
      'Audio': [
        ['Bachelor of Audio Production', 'bachelor', 3, 'bachelor-audio'],
      ],
      'Film and Animation': [
        ['Bachelor of Film Production', 'bachelor', 3, 'bachelor-film'],
        ['Bachelor of Animation', 'bachelor', 3, 'bachelor-animation'],
        ['Bachelor of Animation (Visual Effects)', 'bachelor', 3, 'bachelor-animation'],
      ],
      'Games and Design': [
        ['Bachelor of Games Development (Programming)', 'bachelor', 3, 'bachelor-games'],
        ['Bachelor of Games Development (Art)', 'bachelor', 3, 'bachelor-games'],
        ['Bachelor of Design', 'bachelor', 3, 'bachelor-design'],
      ],
      'Music': [
        ['Bachelor of Music (Production)', 'bachelor', 3, 'bachelor-music'],
        ['Bachelor of Creative Industries', 'bachelor', 3, 'bachelor-music'],
      ],
    },
    masterPrograms: {
      'Creative Industries': [
        ['Master of Creative Industries', 'master', 1.5, 'master-creative'],
      ],
    },
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

function buildProgramsForFacultyGroup(uni, group, programType) {
  /** @type {Array<{ slug: string; title: string; level: string; durationYears: number; faculty: string; feeBandKey: string; intakes: string[] }>} */
  const out = [];
  for (const [faculty, programs] of Object.entries(group)) {
    for (const [title, level, durationYears, feeBandKey, intakes] of programs) {
      const slug = `${uni.slug}-${slugify(title).slice(0, 70)}`;
      out.push({
        slug,
        title,
        level,
        durationYears,
        faculty,
        feeBandKey: feeBandKey || level,
        intakes: intakes || DEFAULT_INTAKES,
        programType,
      });
    }
  }
  return out;
}

function buildPrograms(uni) {
  const all = [
    ...buildProgramsForFacultyGroup(uni, uni.pathwayPrograms, 'pathway'),
    ...buildProgramsForFacultyGroup(uni, uni.bachelorPrograms, 'degree'),
    ...buildProgramsForFacultyGroup(uni, uni.masterPrograms, 'degree'),
  ];
  // Deduplicate slugs (in case of collisions).
  const seen = new Set();
  return all.filter((p) => {
    if (seen.has(p.slug)) return false;
    seen.add(p.slug);
    return true;
  });
}

function buildUniversity(uni) {
  const programs = buildPrograms(uni);
  const tuitionByProgram = {};
  const deadlines = {};
  for (const p of programs) {
    const fee = uni.feeBand[p.feeBandKey] ?? uni.feeBand[p.level] ?? 0;
    tuitionByProgram[p.slug] = fee;
    deadlines[p.slug] = p.level === 'master' ? INTAKE_JUL : INTAKE_FEB;
  }
  const sourceHash = `sha256:${createHash('sha256').update(`navitas-${uni.slug}-${TODAY.slice(0, 10)}`).digest('hex').slice(0, 16)}`;
  return {
    slug: uni.slug,
    name: uni.name,
    country: 'Australia',
    city: uni.city,
    programs: programs.map((p) => ({
      slug: p.slug,
      title: p.title,
      durationYears: p.durationYears,
      level: p.level,
      language: 'en',
      faculty: p.faculty,
      intakes: p.intakes,
      programUrl: p.programType === 'pathway' ? uni.coursesUrl : uni.officialUrl,
      programType: p.programType,
    })),
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
  let totalPrograms = 0;
  for (const uni of UNIS) {
    const university = buildUniversity(uni);
    const filePath = resolve(CONTENT_DIR, `${uni.slug}.json`);
    await writeFile(filePath, JSON.stringify(university, null, 2) + '\n', 'utf8');
    totalPrograms += university.programs.length;
    console.log(`[seed] wrote ${uni.slug}.json (${university.programs.length} programs)`);
  }
  console.log(`[seed] done · ${UNIS.length} universities · ${totalPrograms} programs total`);
}

main().catch((err) => {
  console.error('[seed] FAILED:', err);
  process.exit(1);
});
