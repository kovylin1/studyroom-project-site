// One-shot seeder for Navitas-CA partner universities.
// Writes site/src/content/universities/{slug}.json for 6 Canadian
// parent universities listed in sources/universities.list.md under
// `navitas-pathways`. Each uni ships ~20-40 programs across pathway
// streams (UTP Stage 1 / Stage 2) plus parent uni Bachelor/Master
// catalogue. Tuition in CAD/year, per-uni per-faculty fee bands from
// each Navitas pathway college's published 2024-25 fees + parent uni
// international fee schedules.
//
// Run: node scraper/seed-navitas-ca.mjs
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
const INTAKE_JAN = `${NEXT_YEAR}-01-15T00:00:00.000Z`;
const INTAKE_MAY = `${NEXT_YEAR}-05-01T00:00:00.000Z`;
const INTAKE_SEP = `${NEXT_YEAR}-09-01T00:00:00.000Z`;

const DEFAULT_INTAKES = ['January', 'May', 'September'];

function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['‘’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const UNIS = [
  {
    slug: 'simon-fraser',
    name: 'Simon Fraser University',
    city: 'Burnaby',
    navitasUrl: 'https://www.fraseric.ca/',
    officialUrl: 'https://www.sfu.ca/',
    coursesUrl: 'https://www.fraseric.ca/programs/',
    ielts: 6.0,
    feeBand: {
      foundation: 22500,
      'utp-business': 27500,
      'utp-engineering': 28500,
      'utp-computing': 28500,
      'utp-comm': 26500,
      'utp-arts': 26500,
      'utp-health': 27500,
      'utp-science': 27500,
      'bachelor-business': 35500,
      'bachelor-engineering': 38500,
      'bachelor-computing': 37500,
      'bachelor-comm': 33500,
      'bachelor-arts': 33500,
      'bachelor-health': 35500,
      'bachelor-science': 36500,
      'master-business': 30500,
      'master-computing': 32500,
      'master-arts': 28500,
      'master-health': 30500,
    },
    paragraphs: [
      'Simon Fraser University (SFU) is a public research university with three campuses in Greater Vancouver, British Columbia — Burnaby (main), Surrey, and Vancouver (downtown). Founded in 1965, SFU has been #1 in Maclean\'s Comprehensive University ranking multiple times and ranks in the top 1% of universities worldwide (THE 2024).',
      "International students enter SFU through Fraser International College (FIC) — Navitas's pathway college on the SFU Burnaby campus. UTP Stage 1 leads into the 2nd year of an SFU Bachelor's; UTP Stage 2 (direct entry to year 2) is the more common route. Students share the SFU library, sports facilities, and residences from day one.",
    ],
    paragraphsRu: [
      "Simon Fraser University (SFU) — государственный исследовательский университет в Greater Vancouver, Британская Колумбия. Три кампуса: Burnaby (главный), Surrey и Vancouver (downtown). Основан в 1965. №1 в рейтинге Maclean's Comprehensive несколько лет, топ-1% университетов мира (THE 2024).",
      'Международные студенты заходят через Fraser International College (FIC) — pathway-колледж Navitas на кампусе SFU Burnaby. UTP Stage 1 даёт переход на 2-й курс бакалавриата SFU. UTP Stage 2 (прямой вход на 2-й курс) — более популярный маршрут. Студенты пользуются библиотекой, спорт-центром и общежитиями SFU с первого дня.',
    ],
    keyFacts: [
      "#1 in Maclean's Comprehensive University ranking (multiple years)",
      'Top 1% universities worldwide (THE 2024)',
      'Over 37,000 students',
      'Founded in 1965',
      '3 campuses across Greater Vancouver',
    ],
    keyFactsRu: [
      "№1 в Maclean's Comprehensive University ranking (несколько лет)",
      'Топ-1% университетов мира (THE 2024)',
      'Более 37 000 студентов',
      'Основан в 1965',
      '3 кампуса в Greater Vancouver',
    ],
    accommodation: [
      { name: 'SFU Residence and Housing (Burnaby)', price: 'от CA$1,150/мес', text: 'On-campus резиденции на горе Burnaby Mountain — Townhouses, Hamilton Hall, Shadbolt House. Включают meal plan для первокурсников.' },
      { name: 'Homestay через FIC', price: 'от CA$1,150/мес', text: 'Канадская принимающая семья в Burnaby/Vancouver — питание и комната включены, поддержка адаптации.' },
    ],
    campuses: [
      { title: 'Burnaby Mountain Campus', sub: 'Главный кампус — 20 км от центра Vancouver', text: 'Архитектурный комплекс Arthur Erickson, 170 гектар на вершине горы. FIC — на этом же кампусе.' },
      { title: 'SFU Vancouver (Harbour Centre)', sub: 'В центре Vancouver', text: 'Beedie School of Business, executive-программы, downtown-кампус с видом на залив.' },
      { title: 'SFU Surrey', sub: 'Метрополитан-Surrey', text: 'Computing science + interactive arts. Технологический кампус.' },
    ],
    pathwayPrograms: {
      'University Transfer Program (Stage 1)': [
        ['UTP Stage 1 — pathway to Year 2', 'foundation', 1, 'foundation'],
      ],
      'Business and Commerce': [
        ['UTP Stage 2 — Business Administration', 'foundation', 0.67, 'utp-business'],
      ],
      'Computing Science and Engineering': [
        ['UTP Stage 2 — Computing Science', 'foundation', 0.67, 'utp-computing'],
        ['UTP Stage 2 — Engineering Science', 'foundation', 0.67, 'utp-engineering'],
      ],
      'Communication and Arts': [
        ['UTP Stage 2 — Communication', 'foundation', 0.67, 'utp-comm'],
        ['UTP Stage 2 — Arts and Social Sciences', 'foundation', 0.67, 'utp-arts'],
      ],
      'Health and Science': [
        ['UTP Stage 2 — Health Sciences', 'foundation', 0.67, 'utp-health'],
        ['UTP Stage 2 — Science', 'foundation', 0.67, 'utp-science'],
      ],
    },
    bachelorPrograms: {
      'Beedie School of Business': [
        ['Bachelor of Business Administration', 'bachelor', 4, 'bachelor-business'],
        ['BBA — Finance', 'bachelor', 4, 'bachelor-business'],
        ['BBA — Marketing', 'bachelor', 4, 'bachelor-business'],
        ['BBA — Management Information Systems', 'bachelor', 4, 'bachelor-business'],
      ],
      'Engineering and Applied Sciences': [
        ['Bachelor of Applied Science (Engineering Science)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Applied Science (Mechatronic Systems)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Applied Science (Sustainable Energy Engineering)', 'bachelor', 4, 'bachelor-engineering'],
      ],
      'Computing Science': [
        ['Bachelor of Science (Computing Science)', 'bachelor', 4, 'bachelor-computing'],
        ['Bachelor of Science (Software Systems)', 'bachelor', 4, 'bachelor-computing'],
        ['Bachelor of Arts (Cognitive Science)', 'bachelor', 4, 'bachelor-computing'],
      ],
      'Communication and Media': [
        ['Bachelor of Arts (Communication)', 'bachelor', 4, 'bachelor-comm'],
        ['Bachelor of Arts (Interactive Arts and Technology)', 'bachelor', 4, 'bachelor-comm'],
      ],
      'Arts and Social Sciences': [
        ['Bachelor of Arts (Psychology)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Criminology)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Economics)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Political Science)', 'bachelor', 4, 'bachelor-arts'],
      ],
      'Health Sciences': [
        ['Bachelor of Science (Health Sciences)', 'bachelor', 4, 'bachelor-health'],
      ],
      'Science': [
        ['Bachelor of Science (Biological Sciences)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Mathematics)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Statistics)', 'bachelor', 4, 'bachelor-science'],
      ],
    },
    masterPrograms: {
      'Beedie School of Business': [
        ['Master of Business Administration', 'master', 1.5, 'master-business'],
        ['Master of Financial Risk Management', 'master', 1, 'master-business'],
      ],
      'Computing Science and Engineering': [
        ['Master of Science (Computing Science)', 'master', 2, 'master-computing'],
        ['Master of Engineering (Applied Sciences)', 'master', 2, 'master-computing'],
      ],
      'Arts and Social Sciences': [
        ['Master of Public Policy', 'master', 1.5, 'master-arts'],
        ['Master of Arts (Communication)', 'master', 2, 'master-arts'],
      ],
      'Health Sciences': [
        ['Master of Public Health', 'master', 2, 'master-health'],
      ],
    },
  },
  {
    slug: 'manitoba',
    name: 'University of Manitoba',
    city: 'Winnipeg',
    navitasUrl: 'https://www.icmanitoba.ca/',
    officialUrl: 'https://umanitoba.ca/',
    coursesUrl: 'https://www.icmanitoba.ca/programs/',
    ielts: 6.0,
    feeBand: {
      foundation: 18500,
      'utp-business': 21500,
      'utp-engineering': 23500,
      'utp-arts': 19500,
      'utp-science': 22500,
      'utp-music': 20500,
      'bachelor-business': 25500,
      'bachelor-engineering': 30500,
      'bachelor-arts': 22500,
      'bachelor-science': 24500,
      'bachelor-nursing': 28500,
      'bachelor-pharmacy': 35000,
      'bachelor-music': 23500,
      'master-business': 24500,
      'master-engineering': 22500,
      'master-arts': 17500,
      'master-health': 20500,
    },
    paragraphs: [
      'University of Manitoba (UM) is the oldest university in Western Canada, founded in 1877. Located in Winnipeg, Manitoba, with two main campuses (Fort Garry and Bannatyne), UM is a U15 research-intensive university with strengths in agriculture, engineering, health sciences, and Indigenous studies.',
      "International students enter via the International College of Manitoba (ICM) — Navitas's pathway college on the UM Fort Garry campus. UTP Stage 1 + Stage 2 programs lead into the second year of a UM Bachelor's degree across Arts, Science, Business (Asper School), Engineering, and Music.",
    ],
    paragraphsRu: [
      'University of Manitoba (UM) — старейший университет Западной Канады, основан в 1877. Расположен в Winnipeg, Манитоба, с двумя главными кампусами (Fort Garry и Bannatyne). U15 research-intensive университет с сильными школами агрокультуры, инженерии, health sciences и Indigenous studies.',
      'Международные студенты заходят через International College of Manitoba (ICM) — pathway-колледж Navitas на кампусе UM Fort Garry. UTP Stage 1 + Stage 2 программы ведут на второй курс бакалавриата UM: Arts, Science, Business (Asper School), Engineering и Music.',
    ],
    keyFacts: [
      'Oldest university in Western Canada (founded 1877)',
      'U15 research-intensive university',
      'Over 30,000 students',
      'Top 5 in Canada for Indigenous studies',
      'Asper School of Business — AACSB accredited',
    ],
    keyFactsRu: [
      'Старейший университет Западной Канады (основан 1877)',
      'U15 research-intensive университет',
      'Более 30 000 студентов',
      'Топ-5 в Канаде по Indigenous studies',
      'Asper School of Business — аккредитация AACSB',
    ],
    accommodation: [
      { name: 'UM Residence (Fort Garry)', price: 'от CA$700/мес', text: 'On-campus резиденции — Mary Speechly Hall, University College, Pembina Hall. Meal plan включён для первокурсников.' },
      { name: 'Homestay через ICM', price: 'от CA$1,050/мес', text: 'Канадская принимающая семья в Winnipeg — питание и комната включены.' },
    ],
    campuses: [
      { title: 'Fort Garry Campus', sub: 'Главный кампус — 6 км от центра Winnipeg', text: '274 гектара, ICM, большинство факультетов. Историческое здание Tier Building.' },
      { title: 'Bannatyne Campus', sub: 'В центре Winnipeg', text: 'Медицинская школа, стоматология, фармация. Связан с Health Sciences Centre.' },
    ],
    pathwayPrograms: {
      'University Transfer Program (Stage 1)': [
        ['UTP Stage 1 — pathway to UM Year 2', 'foundation', 1, 'foundation'],
      ],
      'Business and Commerce': [
        ['UTP Stage 2 — Business (Asper)', 'foundation', 0.83, 'utp-business'],
      ],
      'Engineering and Applied Sciences': [
        ['UTP Stage 2 — Engineering', 'foundation', 0.83, 'utp-engineering'],
      ],
      'Arts and Humanities': [
        ['UTP Stage 2 — Arts', 'foundation', 0.83, 'utp-arts'],
      ],
      'Science': [
        ['UTP Stage 2 — Science', 'foundation', 0.83, 'utp-science'],
      ],
      'Music': [
        ['UTP Stage 2 — Music', 'foundation', 0.83, 'utp-music'],
      ],
    },
    bachelorPrograms: {
      'Asper School of Business': [
        ['Bachelor of Commerce (Honours)', 'bachelor', 4, 'bachelor-business'],
        ['B.Comm — Accounting', 'bachelor', 4, 'bachelor-business'],
        ['B.Comm — Finance', 'bachelor', 4, 'bachelor-business'],
        ['B.Comm — Marketing', 'bachelor', 4, 'bachelor-business'],
      ],
      'Engineering and Applied Sciences': [
        ['Bachelor of Engineering (Civil)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering (Mechanical)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering (Electrical and Computer)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering (Biosystems)', 'bachelor', 4, 'bachelor-engineering'],
      ],
      'Computing and IT': [
        ['Bachelor of Science (Computer Science)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Science (Data Science)', 'bachelor', 4, 'bachelor-engineering'],
      ],
      'Health Sciences': [
        ['Bachelor of Nursing', 'bachelor', 4, 'bachelor-nursing'],
        ['Bachelor of Science (Pharmacy)', 'bachelor', 4, 'bachelor-pharmacy'],
      ],
      'Arts and Humanities': [
        ['Bachelor of Arts (Psychology)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Economics)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Political Studies)', 'bachelor', 4, 'bachelor-arts'],
      ],
      'Science': [
        ['Bachelor of Science (General)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Biological Sciences)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Mathematics)', 'bachelor', 4, 'bachelor-science'],
      ],
      'Music': [
        ['Bachelor of Music (Performance)', 'bachelor', 4, 'bachelor-music'],
      ],
    },
    masterPrograms: {
      'Asper School of Business': [
        ['Master of Business Administration', 'master', 1.5, 'master-business'],
        ['Master of Finance', 'master', 1, 'master-business'],
      ],
      'Engineering': [
        ['Master of Engineering', 'master', 2, 'master-engineering'],
        ['Master of Science (Computer Science)', 'master', 2, 'master-engineering'],
      ],
      'Arts and Humanities': [
        ['Master of Arts (Public Administration)', 'master', 2, 'master-arts'],
      ],
      'Health Sciences': [
        ['Master of Public Health', 'master', 2, 'master-health'],
      ],
    },
  },
  {
    slug: 'toronto-met',
    name: 'Toronto Metropolitan University',
    city: 'Toronto',
    navitasUrl: 'https://www.torontomuic.ca/',
    officialUrl: 'https://www.torontomu.ca/',
    coursesUrl: 'https://www.torontomuic.ca/programs/',
    ielts: 6.5,
    feeBand: {
      foundation: 26500,
      'utp-business': 31500,
      'utp-engineering': 34500,
      'utp-computing': 33500,
      'utp-arts': 28500,
      'bachelor-business': 38500,
      'bachelor-engineering': 44500,
      'bachelor-computing': 41500,
      'bachelor-arts': 33500,
      'bachelor-media': 36500,
      'bachelor-science': 38500,
      'bachelor-health': 39500,
      'master-business': 36500,
      'master-engineering': 38500,
      'master-arts': 30500,
      'master-computing': 38500,
    },
    paragraphs: [
      'Toronto Metropolitan University (TMU) — formerly Ryerson University, renamed in 2022 — is a downtown Toronto public university with a strong applied-research and career-focused mission. Founded in 1948, TMU now has over 50,000 students and is best known for the Ted Rogers School of Management, Faculty of Engineering and Architectural Science, and the School of Journalism.',
      "International students enter via Toronto Metropolitan University International College (TMUIC) — Navitas's pathway college on the TMU downtown campus. UTP Stage 1 + Stage 2 programs in Arts, Business Management, Engineering, and Computer Science lead into the second year of a TMU Bachelor's degree.",
    ],
    paragraphsRu: [
      'Toronto Metropolitan University (TMU) — раньше Ryerson University, переименован в 2022. Государственный университет в центре Toronto с прикладным research-фокусом. Основан в 1948, сейчас более 50 000 студентов. Известен Ted Rogers School of Management, инженерным факультетом, School of Journalism.',
      'Международные студенты заходят через Toronto Metropolitan University International College (TMUIC) — pathway-колледж Navitas на downtown-кампусе TMU. UTP Stage 1 + Stage 2 в Arts, Business Management, Engineering, Computer Science ведут на 2-й курс бакалавриата TMU.',
    ],
    keyFacts: [
      'Downtown Toronto urban campus',
      'Over 50,000 students',
      'Founded in 1948 (renamed from Ryerson in 2022)',
      'Ted Rogers School of Management — AACSB accredited',
      'Top 5 in Canada for journalism + media studies',
    ],
    keyFactsRu: [
      'Downtown-Toronto, urban-кампус',
      'Более 50 000 студентов',
      'Основан в 1948 (переименован из Ryerson в 2022)',
      'Ted Rogers School of Management — аккредитация AACSB',
      'Топ-5 в Канаде по журналистике + media studies',
    ],
    accommodation: [
      { name: 'TMU Daphne Cockwell Complex residence', price: 'от CA$1,250/мес', text: 'Downtown residence — Pitman Hall, ILC Residence. Walking distance to all faculty buildings.' },
      { name: 'Homestay через TMUIC', price: 'от CA$1,250/мес', text: 'Канадская принимающая семья в Greater Toronto — питание и комната, метро до downtown 15-30 минут.' },
    ],
    campuses: [
      { title: 'Downtown Toronto Campus', sub: 'В центре Toronto, рядом с Yonge–Dundas Square', text: 'Urban-кампус, все факультеты в пешей доступности. Современные здания, новый Daphne Cockwell Complex.' },
    ],
    pathwayPrograms: {
      'University Transfer Program (Stage 1)': [
        ['UTP Stage 1 — pathway to TMU Year 2', 'foundation', 1, 'foundation'],
      ],
      'Business and Management': [
        ['UTP Stage 2 — Business Management (Ted Rogers)', 'foundation', 0.67, 'utp-business'],
      ],
      'Engineering and Architectural Science': [
        ['UTP Stage 2 — Engineering', 'foundation', 0.67, 'utp-engineering'],
      ],
      'Computing and IT': [
        ['UTP Stage 2 — Computer Science', 'foundation', 0.67, 'utp-computing'],
      ],
      'Arts and Humanities': [
        ['UTP Stage 2 — Arts', 'foundation', 0.67, 'utp-arts'],
      ],
    },
    bachelorPrograms: {
      'Ted Rogers School of Management': [
        ['Bachelor of Commerce (Accounting & Finance)', 'bachelor', 4, 'bachelor-business'],
        ['Bachelor of Commerce (Business Management)', 'bachelor', 4, 'bachelor-business'],
        ['Bachelor of Commerce (Information Technology Management)', 'bachelor', 4, 'bachelor-business'],
        ['Bachelor of Commerce (Marketing Management)', 'bachelor', 4, 'bachelor-business'],
      ],
      'Engineering and Architectural Science': [
        ['Bachelor of Engineering (Civil)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering (Mechanical)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering (Electrical)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering (Aerospace)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering (Biomedical)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Architectural Science', 'bachelor', 4, 'bachelor-engineering'],
      ],
      'Computing and IT': [
        ['Bachelor of Science (Computer Science)', 'bachelor', 4, 'bachelor-computing'],
        ['Bachelor of Engineering (Computer)', 'bachelor', 4, 'bachelor-computing'],
        ['Bachelor of Engineering (Software)', 'bachelor', 4, 'bachelor-computing'],
      ],
      'Media and Creative Industries': [
        ['Bachelor of Journalism', 'bachelor', 4, 'bachelor-media'],
        ['Bachelor of Fine Arts (Image Arts — Film)', 'bachelor', 4, 'bachelor-media'],
        ['Bachelor of Arts (Media Production)', 'bachelor', 4, 'bachelor-media'],
      ],
      'Arts and Humanities': [
        ['Bachelor of Arts (Sociology)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Psychology)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Politics and Governance)', 'bachelor', 4, 'bachelor-arts'],
      ],
      'Science': [
        ['Bachelor of Science (Biology)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Mathematics)', 'bachelor', 4, 'bachelor-science'],
      ],
      'Community Services': [
        ['Bachelor of Science (Nursing)', 'bachelor', 4, 'bachelor-health'],
        ['Bachelor of Social Work', 'bachelor', 4, 'bachelor-health'],
      ],
    },
    masterPrograms: {
      'Ted Rogers School of Management': [
        ['Master of Business Administration', 'master', 1, 'master-business'],
        ['Master of Science in Management', 'master', 1, 'master-business'],
      ],
      'Engineering': [
        ['Master of Engineering (Civil)', 'master', 2, 'master-engineering'],
        ['Master of Engineering (Mechanical)', 'master', 2, 'master-engineering'],
      ],
      'Computing and IT': [
        ['Master of Science (Computer Science)', 'master', 2, 'master-computing'],
        ['Master of Engineering (Software)', 'master', 2, 'master-computing'],
      ],
      'Media and Creative Industries': [
        ['Master of Journalism', 'master', 2, 'master-arts'],
        ['Master of Digital Media', 'master', 1, 'master-arts'],
      ],
    },
  },
  {
    slug: 'lethbridge',
    name: 'University of Lethbridge',
    city: 'Calgary',
    navitasUrl: 'https://www.uicc.ca/',
    officialUrl: 'https://www.ulethbridge.ca/',
    coursesUrl: 'https://www.uicc.ca/programs/',
    ielts: 6.0,
    feeBand: {
      foundation: 17500,
      'utp-management': 20500,
      'utp-arts': 19500,
      'utp-science': 20500,
      'utp-health': 21500,
      'bachelor-management': 23500,
      'bachelor-arts': 21500,
      'bachelor-science': 23500,
      'bachelor-health': 24500,
      'bachelor-fine-arts': 22500,
      'master-business': 22500,
      'master-arts': 16500,
      'master-science': 18500,
      'master-education': 17500,
    },
    paragraphs: [
      'University of Lethbridge is an Alberta public university known for its liberal arts foundation and strengths in neuroscience, fine arts, and management. The main campus sits on the coulees overlooking the Oldman River in Lethbridge; the ULethbridge International College (ULIC) pathway is on the Calgary campus, in the city centre.',
      "International students enter via ULIC — Navitas's pathway college in downtown Calgary — with UTP Stage 1 and Stage 2 programs leading into the second year of a ULethbridge Bachelor's degree across Management, Arts and Science, and Health Sciences.",
    ],
    paragraphsRu: [
      'University of Lethbridge — государственный университет Альберты с сильной либерально-арт основой и фокусом на neuroscience, fine arts и менеджменте. Главный кампус — в Lethbridge с видом на реку Oldman River. ULIC pathway-кампус — в Calgary, в центре города.',
      'Международные студенты заходят через ULIC — pathway-колледж Navitas в downtown Calgary. UTP Stage 1 и Stage 2 ведут на 2-й курс бакалавриата ULethbridge: Management, Arts and Science, Health Sciences.',
    ],
    keyFacts: [
      'Top 50 research universities in Canada',
      'Strong neuroscience + fine arts programs',
      'Over 9,000 students',
      'Founded in 1967',
      'Lethbridge main + Calgary pathway campuses',
    ],
    keyFactsRu: [
      'Топ-50 research-университетов Канады',
      'Сильные программы neuroscience + fine arts',
      'Более 9 000 студентов',
      'Основан в 1967',
      'Главный кампус Lethbridge + pathway Calgary',
    ],
    accommodation: [
      { name: 'ULIC Calgary partner residences', price: 'от CA$950/мес', text: 'Партнёрские студенческие резиденции в downtown Calgary — комнаты с общей кухней.' },
      { name: 'Homestay через ULIC', price: 'от CA$1,050/мес', text: 'Канадская принимающая семья в Calgary — питание и комната.' },
    ],
    campuses: [
      { title: 'Lethbridge Main Campus', sub: 'Lethbridge, AB — 220 км от Calgary', text: 'Главный кампус на coulees реки Oldman, архитектурный комплекс Arthur Erickson.' },
      { title: 'Calgary Campus (ULIC pathway)', sub: 'В центре Calgary', text: 'Pathway-кампус, downtown Calgary. После UTP Stage 2 студенты переезжают в Lethbridge.' },
    ],
    pathwayPrograms: {
      'University Transfer Program (Stage 1)': [
        ['UTP Stage 1 (Pre-Bachelor)', 'foundation', 1, 'foundation'],
      ],
      'Management': [
        ['UTP Stage 2 — Management', 'foundation', 0.67, 'utp-management'],
      ],
      'Arts and Humanities': [
        ['UTP Stage 2 — Arts', 'foundation', 0.67, 'utp-arts'],
      ],
      'Science': [
        ['UTP Stage 2 — Science', 'foundation', 0.67, 'utp-science'],
      ],
      'Health Sciences': [
        ['UTP Stage 2 — Health Sciences', 'foundation', 0.67, 'utp-health'],
      ],
    },
    bachelorPrograms: {
      'Dhillon School of Business': [
        ['Bachelor of Management (Accounting)', 'bachelor', 4, 'bachelor-management'],
        ['Bachelor of Management (Finance)', 'bachelor', 4, 'bachelor-management'],
        ['Bachelor of Management (Marketing)', 'bachelor', 4, 'bachelor-management'],
        ['Bachelor of Management (Human Resource Management)', 'bachelor', 4, 'bachelor-management'],
      ],
      'Arts and Humanities': [
        ['Bachelor of Arts (Psychology)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Economics)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Sociology)', 'bachelor', 4, 'bachelor-arts'],
      ],
      'Science': [
        ['Bachelor of Science (Computer Science)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Biological Sciences)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Mathematics)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Neuroscience)', 'bachelor', 4, 'bachelor-science'],
      ],
      'Health Sciences': [
        ['Bachelor of Health Sciences', 'bachelor', 4, 'bachelor-health'],
        ['Bachelor of Nursing', 'bachelor', 4, 'bachelor-health'],
      ],
      'Fine Arts': [
        ['Bachelor of Fine Arts (New Media)', 'bachelor', 4, 'bachelor-fine-arts'],
        ['Bachelor of Music', 'bachelor', 4, 'bachelor-fine-arts'],
      ],
    },
    masterPrograms: {
      'Dhillon School of Business': [
        ['Master of Science in Management', 'master', 1.5, 'master-business'],
      ],
      'Arts and Humanities': [
        ['Master of Arts (English)', 'master', 2, 'master-arts'],
      ],
      'Science': [
        ['Master of Science (Neuroscience)', 'master', 2, 'master-science'],
      ],
      'Education': [
        ['Master of Education', 'master', 2, 'master-education'],
      ],
    },
  },
  {
    slug: 'western-ontario',
    name: 'Western University',
    city: 'London',
    navitasUrl: 'https://www.westernic.ca/',
    officialUrl: 'https://www.uwo.ca/',
    coursesUrl: 'https://www.westernic.ca/programs/',
    ielts: 6.5,
    feeBand: {
      foundation: 28500,
      'utp-business': 32500,
      'utp-engineering': 36500,
      'utp-science': 33500,
      'utp-fims': 31500,
      'utp-health': 33500,
      'utp-arts': 31500,
      'bachelor-business': 42500,
      'bachelor-engineering': 50500,
      'bachelor-science': 47500,
      'bachelor-fims': 41500,
      'bachelor-health': 46500,
      'bachelor-arts': 39500,
      'bachelor-mos': 42500,
      'bachelor-medsci': 47500,
      'master-business': 50500,
      'master-engineering': 45500,
      'master-arts': 32500,
      'master-health': 35500,
    },
    paragraphs: [
      'Western University (officially University of Western Ontario) is a U15 research-intensive public university in London, Ontario. Founded in 1878, Western has a campus of over 1,200 acres along the Thames River and is best known for the Ivey Business School, the Schulich School of Medicine & Dentistry, and the Faculty of Engineering.',
      "International students enter via Western International College (WIC) — Navitas's pathway college on the Western campus. UTP Stage 1 + Stage 2 programs lead into the second year of a Western Bachelor's degree across Engineering, Science, Business (via MOS), FIMS, Health Sciences, Social Sciences, and Arts.",
    ],
    paragraphsRu: [
      'Western University (официально University of Western Ontario) — U15 research-intensive государственный университет в London, Ontario. Основан в 1878. Кампус более 485 гектар вдоль реки Thames. Известен Ivey Business School, Schulich School of Medicine & Dentistry, инженерным факультетом.',
      'Международные студенты заходят через Western International College (WIC) — pathway-колледж Navitas на кампусе Western. UTP Stage 1 + Stage 2 ведут на 2-й курс бакалавриата Western: Engineering, Science, Business (через MOS), FIMS, Health Sciences, Social Sciences, Arts.',
    ],
    keyFacts: [
      'U15 research-intensive university',
      'Ivey Business School — top MBA in Canada',
      'Over 37,000 students',
      'Founded in 1878',
      'Top 200 universities worldwide (THE 2024)',
    ],
    keyFactsRu: [
      'U15 research-intensive университет',
      'Ivey Business School — топовая MBA в Канаде',
      'Более 37 000 студентов',
      'Основан в 1878',
      'Топ-200 университетов мира (THE 2024)',
    ],
    accommodation: [
      { name: 'Western Residence (Saugeen-Maitland Hall, Ontario Hall)', price: 'от CA$1,100/мес', text: 'On-campus residences — гарантированы первокурсникам. Meal plan включён.' },
      { name: 'Homestay через WIC', price: 'от CA$1,150/мес', text: 'Канадская принимающая семья в London — питание и комната, поддержка адаптации.' },
    ],
    campuses: [
      { title: 'Main Campus (London, Ontario)', sub: '485 гектар вдоль реки Thames River', text: 'Главный кампус, все факультеты + WIC. Историческое здание University College.' },
    ],
    pathwayPrograms: {
      'University Transfer Program (Stage 1)': [
        ['UTP Stage 1 — pathway to Western Year 2', 'foundation', 1, 'foundation'],
      ],
      'Engineering': [
        ['UTP Stage 2 — Engineering', 'foundation', 0.67, 'utp-engineering'],
      ],
      'Business (Management and Organizational Studies)': [
        ['UTP Stage 2 — Management and Organizational Studies', 'foundation', 0.67, 'utp-business'],
      ],
      'Science': [
        ['UTP Stage 2 — Science', 'foundation', 0.67, 'utp-science'],
      ],
      'Information and Media Studies (FIMS)': [
        ['UTP Stage 2 — FIMS', 'foundation', 0.67, 'utp-fims'],
      ],
      'Health Sciences': [
        ['UTP Stage 2 — Health Sciences', 'foundation', 0.67, 'utp-health'],
      ],
      'Social Sciences and Arts': [
        ['UTP Stage 2 — Social Sciences', 'foundation', 0.67, 'utp-arts'],
        ['UTP Stage 2 — Arts and Humanities', 'foundation', 0.67, 'utp-arts'],
      ],
    },
    bachelorPrograms: {
      'Ivey Business School + Management and Organizational Studies': [
        ['Honours Business Administration (HBA)', 'bachelor', 2, 'bachelor-business'],
        ['Bachelor of Management and Organizational Studies (BMOS) — Finance', 'bachelor', 4, 'bachelor-mos'],
        ['BMOS — Accounting', 'bachelor', 4, 'bachelor-mos'],
        ['BMOS — Consumer Behavior', 'bachelor', 4, 'bachelor-mos'],
      ],
      'Engineering': [
        ['Bachelor of Engineering Science (Civil)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering Science (Mechanical)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering Science (Electrical)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering Science (Software)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering Science (Chemical)', 'bachelor', 4, 'bachelor-engineering'],
      ],
      'Science': [
        ['Bachelor of Science (Computer Science)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Mathematics)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Biology)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Medical Sciences (BMSc)', 'bachelor', 4, 'bachelor-medsci'],
      ],
      'Health Sciences': [
        ['Bachelor of Health Sciences (BHSc)', 'bachelor', 4, 'bachelor-health'],
        ['Bachelor of Science in Nursing (BScN)', 'bachelor', 4, 'bachelor-health'],
      ],
      'Information and Media Studies (FIMS)': [
        ['Bachelor of Arts (Media, Information and Technoculture)', 'bachelor', 4, 'bachelor-fims'],
        ['Bachelor of Arts (Media and the Public Interest)', 'bachelor', 4, 'bachelor-fims'],
      ],
      'Arts and Social Sciences': [
        ['Bachelor of Arts (Economics)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Psychology)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Political Science)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Social Work', 'bachelor', 4, 'bachelor-arts'],
      ],
    },
    masterPrograms: {
      'Ivey Business School': [
        ['MBA (Ivey)', 'master', 1, 'master-business'],
        ['Master of Science in Management', 'master', 1, 'master-business'],
      ],
      'Engineering': [
        ['Master of Engineering Science (Civil)', 'master', 2, 'master-engineering'],
        ['Master of Engineering (Mechanical and Materials)', 'master', 2, 'master-engineering'],
      ],
      'Arts and Humanities': [
        ['Master of Arts (Journalism and Communication)', 'master', 1, 'master-arts'],
      ],
      'Health Sciences': [
        ['Master of Public Health', 'master', 1, 'master-health'],
      ],
    },
  },
  {
    slug: 'wilfrid-laurier',
    name: 'Wilfrid Laurier University',
    city: 'Waterloo',
    navitasUrl: 'https://www.laurieric.ca/',
    officialUrl: 'https://www.wlu.ca/',
    coursesUrl: 'https://www.laurieric.ca/programs/',
    ielts: 6.5,
    feeBand: {
      foundation: 25500,
      'utp-business': 30500,
      'utp-computing': 31500,
      'utp-arts': 28500,
      'utp-comm': 28500,
      'bachelor-business': 38500,
      'bachelor-business-coop': 42500,
      'bachelor-computing': 37500,
      'bachelor-arts': 33500,
      'bachelor-comm': 35500,
      'bachelor-science': 36500,
      'bachelor-music': 35500,
      'master-business': 36500,
      'master-arts': 28500,
      'master-computing': 32500,
    },
    paragraphs: [
      'Wilfrid Laurier University (Laurier) is a mid-sized Ontario public university based in Waterloo, with a second campus in Brantford. Founded in 1911, Laurier is best known for the Lazaridis School of Business and Economics (top-3 in Canada for undergraduate business), the Faculty of Music, and its experiential-learning focus.',
      "International students enter via Wilfrid Laurier International College (WLIC) — Navitas's pathway college on the Waterloo campus. UTP Stage 1 + Stage 2 programs in Business and Economics, Computer Science, Communication Studies, and Psychology lead into the second year of a Laurier Bachelor's degree.",
    ],
    paragraphsRu: [
      'Wilfrid Laurier University (Laurier) — государственный университет среднего размера в Ontario, кампусы в Waterloo (главный) и Brantford. Основан в 1911. Известен Lazaridis School of Business and Economics (топ-3 в Канаде по undergrad-бизнесу), факультетом Music и experiential-learning подходом.',
      'Международные студенты заходят через Wilfrid Laurier International College (WLIC) — pathway-колледж Navitas на кампусе Waterloo. UTP Stage 1 + Stage 2 в Business and Economics, Computer Science, Communication Studies, Psychology ведут на 2-й курс бакалавриата Laurier.',
    ],
    keyFacts: [
      'Lazaridis School — top-3 Canadian undergrad business',
      'Over 20,000 students',
      'Founded in 1911',
      '2 campuses — Waterloo + Brantford',
      "#1 in Canada for student satisfaction (Maclean's University Rankings 2024)",
    ],
    keyFactsRu: [
      'Lazaridis School — топ-3 в Канаде по undergrad-бизнесу',
      'Более 20 000 студентов',
      'Основан в 1911',
      '2 кампуса — Waterloo + Brantford',
      "№1 в Канаде по удовлетворённости студентов (Maclean's University Rankings 2024)",
    ],
    accommodation: [
      { name: 'Laurier Residence (Waterloo)', price: 'от CA$1,100/мес', text: 'On-campus residences — Bricker, Conrad, MacDonald House. Гарантированы первокурсникам.' },
      { name: 'Homestay через WLIC', price: 'от CA$1,150/мес', text: 'Канадская принимающая семья в Waterloo — питание и комната, поддержка адаптации.' },
    ],
    campuses: [
      { title: 'Waterloo Campus', sub: 'Главный кампус — в технологическом коридоре Waterloo-Kitchener', text: 'Lazaridis School, факультет музыки, WLIC. Рядом с Google + BlackBerry, сильная co-op сеть.' },
      { title: 'Brantford Campus', sub: '60 км от Waterloo', text: 'Liberal arts, human + social sciences. Маленький downtown-кампус.' },
    ],
    pathwayPrograms: {
      'University Transfer Program (Stage 1)': [
        ['UTP Stage 1 — pathway to Laurier Year 2', 'foundation', 1, 'foundation'],
      ],
      'Lazaridis School of Business and Economics': [
        ['UTP Stage 2 — Business and Economics', 'foundation', 0.67, 'utp-business'],
      ],
      'Computing and IT': [
        ['UTP Stage 2 — Computer Science', 'foundation', 0.67, 'utp-computing'],
      ],
      'Communication and Media': [
        ['UTP Stage 2 — Communication Studies', 'foundation', 0.67, 'utp-comm'],
      ],
      'Arts and Humanities': [
        ['UTP Stage 2 — Psychology / Arts', 'foundation', 0.67, 'utp-arts'],
      ],
    },
    bachelorPrograms: {
      'Lazaridis School of Business and Economics': [
        ['Bachelor of Business Administration (BBA)', 'bachelor', 4, 'bachelor-business'],
        ['BBA Co-op', 'bachelor', 5, 'bachelor-business-coop'],
        ['Bachelor of Arts (Economics)', 'bachelor', 4, 'bachelor-business'],
        ['Double Degree (BBA + Bachelor of Computer Science)', 'bachelor', 5, 'bachelor-business-coop'],
      ],
      'Computing and IT': [
        ['Bachelor of Computer Science', 'bachelor', 4, 'bachelor-computing'],
        ['Bachelor of Science (Data Science)', 'bachelor', 4, 'bachelor-computing'],
      ],
      'Communication and Media': [
        ['Bachelor of Arts (Communication Studies)', 'bachelor', 4, 'bachelor-comm'],
        ['Bachelor of Arts (Digital Media and Journalism)', 'bachelor', 4, 'bachelor-comm'],
      ],
      'Arts and Humanities': [
        ['Bachelor of Arts (Psychology)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Criminology)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Political Science)', 'bachelor', 4, 'bachelor-arts'],
      ],
      'Science and Mathematics': [
        ['Bachelor of Science (Mathematics)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Biology)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Kinesiology)', 'bachelor', 4, 'bachelor-science'],
      ],
      'Faculty of Music': [
        ['Bachelor of Music (Performance)', 'bachelor', 4, 'bachelor-music'],
        ['Bachelor of Arts (Music)', 'bachelor', 4, 'bachelor-music'],
      ],
      'Social Work': [
        ['Bachelor of Social Work', 'bachelor', 4, 'bachelor-arts'],
      ],
    },
    masterPrograms: {
      'Lazaridis School of Business and Economics': [
        ['Master of Business Administration (Lazaridis)', 'master', 1, 'master-business'],
        ['Master of Finance', 'master', 1, 'master-business'],
        ['Master of Business Economics', 'master', 1.5, 'master-business'],
      ],
      'Computing and IT': [
        ['Master of Applied Computing', 'master', 1, 'master-computing'],
      ],
      'Arts and Humanities': [
        ['Master of Arts (Communication Studies)', 'master', 2, 'master-arts'],
      ],
      'Social Work': [
        ['Master of Social Work', 'master', 2, 'master-arts'],
      ],
    },
  },
];

const NAVITAS_BURSARY = {
  name: 'Navitas Loyalty Bursary',
  nameRu: 'Navitas Loyalty Bursary',
  amount: 'до CA$2,000',
  description: 'Discount on first-term fees for students progressing from a Navitas pathway college to the partner university.',
  descriptionRu: 'Скидка на оплату первого семестра для студентов, переходящих из pathway-колледжа Navitas в партнёрский университет.',
  url: 'https://www.navitas.com/study/scholarships/',
};

function buildProgramsForFacultyGroup(uni, group, programType) {
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
    deadlines[p.slug] = p.level === 'master' ? INTAKE_MAY : INTAKE_SEP;
  }
  const sourceHash = `sha256:${createHash('sha256').update(`navitas-${uni.slug}-${TODAY.slice(0, 10)}`).digest('hex').slice(0, 16)}`;
  return {
    slug: uni.slug,
    name: uni.name,
    country: 'Canada',
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
    tuition: { currency: 'CAD', byProgram: tuitionByProgram },
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
