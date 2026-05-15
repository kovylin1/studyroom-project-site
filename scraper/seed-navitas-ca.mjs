// One-shot seeder for Navitas-CA partner universities.
// Writes site/src/content/universities/{slug}.json for 6 Canadian
// parent universities listed in sources/universities.list.md under
// `navitas-pathways`. Each uni ships 60-100 programs across pathway
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
      'utp-environment': 26500,
      'utp-education': 25500,
      'bachelor-business': 35500,
      'bachelor-engineering': 38500,
      'bachelor-computing': 37500,
      'bachelor-comm': 33500,
      'bachelor-arts': 33500,
      'bachelor-health': 35500,
      'bachelor-science': 36500,
      'bachelor-environment': 34500,
      'bachelor-education': 32500,
      'master-business': 30500,
      'master-computing': 32500,
      'master-engineering': 32500,
      'master-arts': 28500,
      'master-health': 30500,
      'master-science': 30500,
      'master-education': 28500,
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
      'Beedie School of Business — AACSB accredited',
    ],
    keyFactsRu: [
      "№1 в Maclean's Comprehensive University ranking (несколько лет)",
      'Топ-1% университетов мира (THE 2024)',
      'Более 37 000 студентов',
      'Основан в 1965',
      '3 кампуса в Greater Vancouver',
      'Beedie School of Business — аккредитация AACSB',
    ],
    accommodation: [
      { name: 'SFU Residence — Hamilton Hall (Burnaby)', price: 'от CA$1,150/мес', text: 'Традиционная резиденция на Burnaby Mountain — single и double-комнаты, общие кухни и lounge. Meal plan включён для первокурсников.' },
      { name: 'SFU Residence — Shadbolt House (Burnaby)', price: 'от CA$1,250/мес', text: 'Suite-style residence на Burnaby Mountain — 4-местные апартаменты с общей кухней. Для студентов второго курса и выше.' },
      { name: 'SFU Residence — Townhouses (Burnaby)', price: 'от CA$1,400/мес', text: '3-4-местные таунхаусы с собственной кухней и гостиной. Для семейных и upper-year студентов.' },
      { name: 'SFU McTaggart-Cowan Hall (Burnaby)', price: 'от CA$1,150/мес', text: 'Резиденция для первокурсников, рядом с библиотекой и FIC. Single и double-комнаты с meal plan.' },
      { name: 'Homestay через FIC', price: 'от CA$1,150/мес', text: 'Канадская принимающая семья в Burnaby/Vancouver — питание и комната включены, поддержка адаптации.' },
      { name: 'Private rental — Burnaby / Vancouver', price: 'от CA$1,200/мес', text: 'Off-campus аренда квартир/комнат в Burnaby и Vancouver — поддержка через FIC accommodation team.' },
    ],
    campuses: [
      { title: 'Burnaby Mountain Campus', sub: 'Главный кампус — 20 км от центра Vancouver', text: 'Архитектурный комплекс Arthur Erickson, 170 гектар на вершине горы. FIC — на этом же кампусе. Большинство факультетов.' },
      { title: 'SFU Vancouver (Harbour Centre)', sub: 'В центре Vancouver', text: 'Beedie School of Business, executive-программы, downtown-кампус с видом на залив. Школа Communication, графический дизайн.' },
      { title: 'SFU Surrey', sub: 'Метрополитан-Surrey', text: 'School of Interactive Arts and Technology, Computing Science. Технологический кампус, рядом с SkyTrain.' },
    ],
    extraScholarships: [
      {
        name: "SFU President's International Entrance Scholarship",
        nameRu: 'SFU President\'s International Entrance Scholarship',
        amount: 'до CA$30,000',
        description: 'Renewable scholarship for top international undergraduate entrants at Simon Fraser University.',
        descriptionRu: 'Возобновляемая стипендия для топ-абитуриентов международного бакалавриата SFU.',
        url: 'https://www.sfu.ca/students/financialaid.html',
      },
      {
        name: 'SFU International Major Entrance Scholarship',
        nameRu: 'SFU International Major Entrance Scholarship',
        amount: 'до CA$24,000',
        description: 'Awarded to international students with strong academic profile entering SFU undergraduate programs.',
        descriptionRu: 'Награда международным студентам с сильным академическим профилем при поступлении в бакалавриат SFU.',
        url: 'https://www.sfu.ca/students/financialaid.html',
      },
      {
        name: 'FIC Academic Excellence Award',
        nameRu: 'FIC Academic Excellence Award',
        amount: 'до CA$4,000',
        description: 'Merit-based award for high-performing FIC pathway students transitioning to SFU.',
        descriptionRu: 'Стипендия за академические заслуги для студентов FIC, переходящих в SFU.',
        url: 'https://www.fraseric.ca/scholarships/',
      },
      {
        name: 'Beedie School of Business International Award',
        nameRu: 'Beedie International Award',
        amount: 'до CA$10,000',
        description: 'Faculty award for international students entering the BBA program at Beedie School of Business.',
        descriptionRu: 'Факультетская награда для международных студентов программы BBA в Beedie.',
        url: 'https://beedie.sfu.ca/programs/undergraduate/scholarships',
      },
      {
        name: 'SFU Open Scholarship',
        nameRu: 'SFU Open Scholarship',
        amount: 'до CA$3,500',
        description: 'In-course scholarship for continuing students based on GPA across all SFU faculties.',
        descriptionRu: 'Стипендия для продолжающих студентов SFU на основе GPA по всем факультетам.',
        url: 'https://www.sfu.ca/students/financialaid/scholarships.html',
      },
    ],
    pathwayPrograms: {
      'University Transfer Program (Stage 1)': [
        ['UTP Stage 1 — pathway to Year 2', 'foundation', 1, 'foundation'],
        ['UTP Stage 1 — Extended (3-term)', 'foundation', 1.5, 'foundation'],
      ],
      'Business and Commerce': [
        ['UTP Stage 2 — Business Administration', 'foundation', 0.67, 'utp-business'],
        ['UTP Stage 2 — Economics', 'foundation', 0.67, 'utp-business'],
      ],
      'Computing Science and Engineering': [
        ['UTP Stage 2 — Computing Science', 'foundation', 0.67, 'utp-computing'],
        ['UTP Stage 2 — Engineering Science', 'foundation', 0.67, 'utp-engineering'],
        ['UTP Stage 2 — Sustainable Energy Engineering', 'foundation', 0.67, 'utp-engineering'],
        ['UTP Stage 2 — Mechatronic Systems Engineering', 'foundation', 0.67, 'utp-engineering'],
      ],
      'Communication, Art and Technology (FCAT)': [
        ['UTP Stage 2 — Communication', 'foundation', 0.67, 'utp-comm'],
        ['UTP Stage 2 — Interactive Arts and Technology', 'foundation', 0.67, 'utp-comm'],
        ['UTP Stage 2 — Publishing', 'foundation', 0.67, 'utp-comm'],
      ],
      'Arts and Social Sciences': [
        ['UTP Stage 2 — Arts and Social Sciences', 'foundation', 0.67, 'utp-arts'],
        ['UTP Stage 2 — Psychology', 'foundation', 0.67, 'utp-arts'],
        ['UTP Stage 2 — Criminology', 'foundation', 0.67, 'utp-arts'],
      ],
      'Education': [
        ['UTP Stage 2 — Education', 'foundation', 0.67, 'utp-education'],
      ],
      'Environment': [
        ['UTP Stage 2 — Environment', 'foundation', 0.67, 'utp-environment'],
        ['UTP Stage 2 — Geography', 'foundation', 0.67, 'utp-environment'],
      ],
      'Health and Science': [
        ['UTP Stage 2 — Health Sciences', 'foundation', 0.67, 'utp-health'],
        ['UTP Stage 2 — Science', 'foundation', 0.67, 'utp-science'],
        ['UTP Stage 2 — Biomedical Physiology and Kinesiology', 'foundation', 0.67, 'utp-health'],
      ],
    },
    bachelorPrograms: {
      'Beedie School of Business': [
        ['Bachelor of Business Administration', 'bachelor', 4, 'bachelor-business'],
        ['BBA — Finance', 'bachelor', 4, 'bachelor-business'],
        ['BBA — Marketing', 'bachelor', 4, 'bachelor-business'],
        ['BBA — Management Information Systems', 'bachelor', 4, 'bachelor-business'],
        ['BBA — Accounting', 'bachelor', 4, 'bachelor-business'],
        ['BBA — International Business', 'bachelor', 4, 'bachelor-business'],
        ['BBA — Human Resource Management', 'bachelor', 4, 'bachelor-business'],
        ['BBA — Operations Management', 'bachelor', 4, 'bachelor-business'],
        ['BBA — Entrepreneurship and Innovation', 'bachelor', 4, 'bachelor-business'],
        ['Bachelor of Arts (Economics)', 'bachelor', 4, 'bachelor-business'],
      ],
      'Engineering and Applied Sciences': [
        ['Bachelor of Applied Science (Engineering Science)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Applied Science (Mechatronic Systems Engineering)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Applied Science (Sustainable Energy Engineering)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Applied Science (Computer Engineering)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Applied Science (Electronics Engineering)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Applied Science (Biomedical Engineering)', 'bachelor', 4, 'bachelor-engineering'],
      ],
      'Computing Science': [
        ['Bachelor of Science (Computing Science)', 'bachelor', 4, 'bachelor-computing'],
        ['Bachelor of Science (Software Systems)', 'bachelor', 4, 'bachelor-computing'],
        ['Bachelor of Arts (Cognitive Science)', 'bachelor', 4, 'bachelor-computing'],
        ['BSc (Computing Science) — Artificial Intelligence', 'bachelor', 4, 'bachelor-computing'],
        ['BSc (Computing Science) — Data Science', 'bachelor', 4, 'bachelor-computing'],
        ['BSc (Computing Science) — Computer Graphics and Multimedia', 'bachelor', 4, 'bachelor-computing'],
        ['BSc (Computing Science) — Information Systems', 'bachelor', 4, 'bachelor-computing'],
      ],
      'Communication, Art and Technology (FCAT)': [
        ['Bachelor of Arts (Communication)', 'bachelor', 4, 'bachelor-comm'],
        ['Bachelor of Arts (Interactive Arts and Technology)', 'bachelor', 4, 'bachelor-comm'],
        ['Bachelor of Arts (Publishing)', 'bachelor', 4, 'bachelor-comm'],
        ['Bachelor of Arts (Contemporary Arts)', 'bachelor', 4, 'bachelor-comm'],
        ['Bachelor of Fine Arts (Visual Art)', 'bachelor', 4, 'bachelor-comm'],
        ['Bachelor of Arts (Film)', 'bachelor', 4, 'bachelor-comm'],
      ],
      'Arts and Social Sciences': [
        ['Bachelor of Arts (Psychology)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Criminology)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Political Science)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Sociology and Anthropology)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (History)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (English)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Philosophy)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Linguistics)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (International Studies)', 'bachelor', 4, 'bachelor-arts'],
      ],
      'Education': [
        ['Bachelor of Education', 'bachelor', 4, 'bachelor-education'],
        ['Bachelor of General Studies (Education)', 'bachelor', 4, 'bachelor-education'],
      ],
      'Environment': [
        ['Bachelor of Environment (Geography)', 'bachelor', 4, 'bachelor-environment'],
        ['Bachelor of Environment (Global Environmental Systems)', 'bachelor', 4, 'bachelor-environment'],
        ['Bachelor of Environment (Resource and Environmental Management)', 'bachelor', 4, 'bachelor-environment'],
        ['Bachelor of Arts (Archaeology)', 'bachelor', 4, 'bachelor-environment'],
      ],
      'Health Sciences': [
        ['Bachelor of Science (Health Sciences)', 'bachelor', 4, 'bachelor-health'],
        ['Bachelor of Arts (Health Sciences)', 'bachelor', 4, 'bachelor-health'],
        ['Bachelor of Science (Biomedical Physiology and Kinesiology)', 'bachelor', 4, 'bachelor-health'],
      ],
      'Science': [
        ['Bachelor of Science (Biological Sciences)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Mathematics)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Statistics)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Chemistry)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Physics)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Molecular Biology and Biochemistry)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Earth Sciences)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Actuarial Science)', 'bachelor', 4, 'bachelor-science'],
      ],
    },
    masterPrograms: {
      'Beedie School of Business': [
        ['Master of Business Administration', 'master', 1.5, 'master-business'],
        ['Master of Financial Risk Management', 'master', 1, 'master-business'],
        ['Master of Science in Finance', 'master', 1, 'master-business'],
        ['Management of Technology MBA', 'master', 2, 'master-business'],
        ['Graduate Diploma in Business Administration', 'master', 1, 'master-business'],
      ],
      'Computing Science and Engineering': [
        ['Master of Science (Computing Science)', 'master', 2, 'master-computing'],
        ['Master of Science in Big Data (Professional)', 'master', 1, 'master-computing'],
        ['Master of Engineering (Applied Sciences)', 'master', 2, 'master-engineering'],
        ['Master of Engineering Leadership', 'master', 1, 'master-engineering'],
        ['Master of Science (Mechatronic Systems Engineering)', 'master', 2, 'master-engineering'],
      ],
      'Communication, Art and Technology': [
        ['Master of Arts (Communication)', 'master', 2, 'master-arts'],
        ['Master of Publishing', 'master', 1.5, 'master-arts'],
        ['Master of Digital Media', 'master', 1, 'master-arts'],
      ],
      'Arts and Social Sciences': [
        ['Master of Public Policy', 'master', 1.5, 'master-arts'],
        ['Master of Arts (Criminology)', 'master', 2, 'master-arts'],
        ['Master of Arts (Psychology)', 'master', 2, 'master-arts'],
        ['Master of Arts (Economics)', 'master', 2, 'master-arts'],
      ],
      'Education': [
        ['Master of Education (Curriculum and Instruction)', 'master', 2, 'master-education'],
        ['Master of Arts (Educational Leadership)', 'master', 2, 'master-education'],
      ],
      'Health Sciences': [
        ['Master of Public Health', 'master', 2, 'master-health'],
        ['Master of Science (Health Sciences)', 'master', 2, 'master-health'],
      ],
      'Science': [
        ['Master of Science (Mathematics)', 'master', 2, 'master-science'],
        ['Master of Science (Statistics)', 'master', 2, 'master-science'],
        ['Master of Science (Molecular Biology and Biochemistry)', 'master', 2, 'master-science'],
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
      'utp-agriculture': 21500,
      'utp-environment': 21500,
      'utp-health': 23500,
      'bachelor-business': 25500,
      'bachelor-engineering': 30500,
      'bachelor-architecture': 28500,
      'bachelor-arts': 22500,
      'bachelor-science': 24500,
      'bachelor-nursing': 28500,
      'bachelor-pharmacy': 35000,
      'bachelor-medicine': 28500,
      'bachelor-music': 23500,
      'bachelor-agriculture': 23500,
      'bachelor-environment': 24500,
      'bachelor-education': 22500,
      'bachelor-social-work': 22500,
      'bachelor-law': 27500,
      'master-business': 24500,
      'master-engineering': 22500,
      'master-arts': 17500,
      'master-health': 20500,
      'master-science': 18500,
      'master-education': 17500,
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
      'Rady Faculty of Health Sciences — медицина, фармация, стоматология',
    ],
    keyFactsRu: [
      'Старейший университет Западной Канады (основан 1877)',
      'U15 research-intensive университет',
      'Более 30 000 студентов',
      'Топ-5 в Канаде по Indigenous studies',
      'Asper School of Business — аккредитация AACSB',
      'Rady Faculty of Health Sciences — медицина, фармация, стоматология',
    ],
    accommodation: [
      { name: 'UM Pembina Hall Residence (Fort Garry)', price: 'от CA$900/мес', text: 'Современная резиденция апартаментного типа, single и double-комнаты с общей кухней. Meal plan по выбору.' },
      { name: 'UM Mary Speechly Hall (Fort Garry)', price: 'от CA$750/мес', text: 'Традиционная резиденция первокурсников. Meal plan включён, общие lounge и study-rooms.' },
      { name: 'UM University College Residence (Fort Garry)', price: 'от CA$800/мес', text: 'Историческое здание University College — small-community living, single-комнаты, common rooms.' },
      { name: 'UM Arthur V. Mauro Residence (Fort Garry)', price: 'от CA$950/мес', text: 'Suite-style для upper-year students — 4-местные апартаменты с общей кухней и гостиной.' },
      { name: 'Homestay через ICM', price: 'от CA$1,050/мес', text: 'Канадская принимающая семья в Winnipeg — питание и комната включены.' },
      { name: 'Off-campus rental — Winnipeg', price: 'от CA$700/мес', text: 'Аренда квартир в районах Osborne Village, Corydon, Fort Richmond — ICM accommodation team помогает с поиском.' },
    ],
    campuses: [
      { title: 'Fort Garry Campus', sub: 'Главный кампус — 6 км от центра Winnipeg', text: '274 гектара, ICM, большинство факультетов. Историческое здание Tier Building, библиотека Elizabeth Dafoe.' },
      { title: 'Bannatyne Campus', sub: 'В центре Winnipeg', text: 'Rady Faculty of Health Sciences — медицинская школа, стоматология, фармация. Связан с Health Sciences Centre.' },
      { title: 'William Norrie Centre', sub: 'North End Winnipeg', text: 'Inner-city campus — Social Work и community-based программы. Indigenous studies focus.' },
    ],
    extraScholarships: [
      {
        name: 'UM International Undergraduate Student Entrance Scholarship',
        nameRu: 'UM International Undergraduate Entrance Scholarship',
        amount: 'до CA$3,000',
        description: 'Automatic merit-based entrance award for international students entering UM undergraduate programs.',
        descriptionRu: 'Автоматическая стипендия за академические заслуги для международных студентов бакалавриата UM.',
        url: 'https://umanitoba.ca/financial-aid-and-awards/',
      },
      {
        name: "President's Scholarship for World Leaders",
        nameRu: "President's Scholarship for World Leaders",
        amount: 'до CA$25,000',
        description: 'Top entrance award at University of Manitoba for outstanding international students.',
        descriptionRu: 'Главная entrance-награда UM для выдающихся международных студентов.',
        url: 'https://umanitoba.ca/financial-aid-and-awards/',
      },
      {
        name: 'ICM Academic Excellence Scholarship',
        nameRu: 'ICM Academic Excellence Scholarship',
        amount: 'до CA$4,000',
        description: 'Merit award for ICM pathway students with strong grades transitioning to UM.',
        descriptionRu: 'Стипендия за академические заслуги студентам ICM, переходящим в UM.',
        url: 'https://www.icmanitoba.ca/scholarships/',
      },
      {
        name: 'Asper School of Business International MBA Scholarship',
        nameRu: 'Asper International MBA Scholarship',
        amount: 'до CA$10,000',
        description: 'Faculty scholarship for top international applicants to the Asper MBA.',
        descriptionRu: 'Стипендия для топовых международных кандидатов на программу Asper MBA.',
        url: 'https://umanitoba.ca/asper/',
      },
      {
        name: 'UM Indigenous Student Bursary',
        nameRu: 'UM Indigenous Student Bursary',
        amount: 'до CA$5,000',
        description: 'Bursary for Indigenous and First Nations students at the University of Manitoba.',
        descriptionRu: 'Стипендия для коренных студентов и First Nations в UM.',
        url: 'https://umanitoba.ca/indigenous/',
      },
    ],
    pathwayPrograms: {
      'University Transfer Program (Stage 1)': [
        ['UTP Stage 1 — pathway to UM Year 2', 'foundation', 1, 'foundation'],
        ['UTP Stage 1 — Extended', 'foundation', 1.5, 'foundation'],
      ],
      'Business and Commerce': [
        ['UTP Stage 2 — Business (Asper)', 'foundation', 0.83, 'utp-business'],
        ['UTP Stage 2 — Economics', 'foundation', 0.83, 'utp-business'],
      ],
      'Engineering and Applied Sciences': [
        ['UTP Stage 2 — Engineering', 'foundation', 0.83, 'utp-engineering'],
        ['UTP Stage 2 — Computer Science', 'foundation', 0.83, 'utp-engineering'],
      ],
      'Arts and Humanities': [
        ['UTP Stage 2 — Arts', 'foundation', 0.83, 'utp-arts'],
        ['UTP Stage 2 — Psychology', 'foundation', 0.83, 'utp-arts'],
        ['UTP Stage 2 — Sociology', 'foundation', 0.83, 'utp-arts'],
      ],
      'Science': [
        ['UTP Stage 2 — Science (General)', 'foundation', 0.83, 'utp-science'],
        ['UTP Stage 2 — Biological Sciences', 'foundation', 0.83, 'utp-science'],
        ['UTP Stage 2 — Mathematics', 'foundation', 0.83, 'utp-science'],
      ],
      'Music': [
        ['UTP Stage 2 — Music', 'foundation', 0.83, 'utp-music'],
      ],
      'Agricultural and Food Sciences': [
        ['UTP Stage 2 — Agriculture', 'foundation', 0.83, 'utp-agriculture'],
        ['UTP Stage 2 — Food Science', 'foundation', 0.83, 'utp-agriculture'],
      ],
      'Environment, Earth and Resources': [
        ['UTP Stage 2 — Environmental Science', 'foundation', 0.83, 'utp-environment'],
      ],
      'Health Sciences (Pre-program)': [
        ['UTP Stage 2 — Pre-Nursing', 'foundation', 0.83, 'utp-health'],
        ['UTP Stage 2 — Pre-Pharmacy', 'foundation', 0.83, 'utp-health'],
      ],
    },
    bachelorPrograms: {
      'Asper School of Business': [
        ['Bachelor of Commerce (Honours)', 'bachelor', 4, 'bachelor-business'],
        ['B.Comm — Accounting', 'bachelor', 4, 'bachelor-business'],
        ['B.Comm — Finance', 'bachelor', 4, 'bachelor-business'],
        ['B.Comm — Marketing', 'bachelor', 4, 'bachelor-business'],
        ['B.Comm — Management Information Systems', 'bachelor', 4, 'bachelor-business'],
        ['B.Comm — Human Resource Management', 'bachelor', 4, 'bachelor-business'],
        ['B.Comm — International Business', 'bachelor', 4, 'bachelor-business'],
        ['B.Comm — Supply Chain Management', 'bachelor', 4, 'bachelor-business'],
        ['B.Comm — Entrepreneurship/Small Business', 'bachelor', 4, 'bachelor-business'],
      ],
      'Price Faculty of Engineering': [
        ['Bachelor of Engineering (Civil)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering (Mechanical)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering (Electrical and Computer)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering (Biosystems)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering (Manufacturing)', 'bachelor', 4, 'bachelor-engineering'],
      ],
      'Faculty of Architecture': [
        ['Bachelor of Environmental Design', 'bachelor', 4, 'bachelor-architecture'],
        ['Bachelor of Interior Design', 'bachelor', 4, 'bachelor-architecture'],
      ],
      'Computing and IT': [
        ['Bachelor of Science (Computer Science)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Computer Science (Honours)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Science (Data Science)', 'bachelor', 4, 'bachelor-engineering'],
      ],
      'Rady Faculty of Health Sciences': [
        ['Bachelor of Nursing', 'bachelor', 4, 'bachelor-nursing'],
        ['Bachelor of Science (Pharmacy)', 'bachelor', 4, 'bachelor-pharmacy'],
        ['Doctor of Pharmacy (PharmD)', 'bachelor', 4, 'bachelor-pharmacy'],
        ['Bachelor of Medical Rehabilitation (Occupational Therapy)', 'bachelor', 4, 'bachelor-nursing'],
        ['Bachelor of Medical Rehabilitation (Physical Therapy)', 'bachelor', 4, 'bachelor-nursing'],
        ['Bachelor of Dental Hygiene', 'bachelor', 4, 'bachelor-medicine'],
      ],
      'Faculty of Arts': [
        ['Bachelor of Arts (Psychology)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Economics)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Political Studies)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Sociology)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (English)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (History)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Philosophy)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Native Studies)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Linguistics)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (International Development Studies)', 'bachelor', 4, 'bachelor-arts'],
      ],
      'Faculty of Science': [
        ['Bachelor of Science (General)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Biological Sciences)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Mathematics)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Chemistry)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Physics and Astronomy)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Statistics)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Microbiology)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Genetics)', 'bachelor', 4, 'bachelor-science'],
      ],
      'Faculty of Agricultural and Food Sciences': [
        ['Bachelor of Science in Agriculture', 'bachelor', 4, 'bachelor-agriculture'],
        ['Bachelor of Science in Agribusiness', 'bachelor', 4, 'bachelor-agriculture'],
        ['Bachelor of Science in Food Science', 'bachelor', 4, 'bachelor-agriculture'],
        ['Bachelor of Science in Human Nutritional Sciences', 'bachelor', 4, 'bachelor-agriculture'],
      ],
      'Faculty of Environment, Earth and Resources': [
        ['Bachelor of Environmental Science', 'bachelor', 4, 'bachelor-environment'],
        ['Bachelor of Science (Geological Sciences)', 'bachelor', 4, 'bachelor-environment'],
        ['Bachelor of Arts (Geography)', 'bachelor', 4, 'bachelor-environment'],
      ],
      'Desautels Faculty of Music': [
        ['Bachelor of Music (Performance)', 'bachelor', 4, 'bachelor-music'],
        ['Bachelor of Music (Composition)', 'bachelor', 4, 'bachelor-music'],
        ['Bachelor of Music (Music Education)', 'bachelor', 4, 'bachelor-music'],
      ],
      'Faculty of Education': [
        ['Bachelor of Education (After-Degree)', 'bachelor', 2, 'bachelor-education'],
      ],
      'Faculty of Social Work': [
        ['Bachelor of Social Work', 'bachelor', 4, 'bachelor-social-work'],
      ],
    },
    masterPrograms: {
      'Asper School of Business': [
        ['Master of Business Administration', 'master', 1.5, 'master-business'],
        ['Master of Finance', 'master', 1, 'master-business'],
        ['Master of Supply Chain Management and Logistics', 'master', 1, 'master-business'],
        ['Master of Science in Management', 'master', 2, 'master-business'],
      ],
      'Price Faculty of Engineering': [
        ['Master of Engineering', 'master', 2, 'master-engineering'],
        ['Master of Science (Mechanical Engineering)', 'master', 2, 'master-engineering'],
        ['Master of Science (Electrical and Computer Engineering)', 'master', 2, 'master-engineering'],
        ['Master of Science (Computer Science)', 'master', 2, 'master-engineering'],
      ],
      'Faculty of Arts': [
        ['Master of Arts (Public Administration)', 'master', 2, 'master-arts'],
        ['Master of Arts (Economics)', 'master', 2, 'master-arts'],
        ['Master of Arts (Psychology)', 'master', 2, 'master-arts'],
      ],
      'Rady Faculty of Health Sciences': [
        ['Master of Public Health', 'master', 2, 'master-health'],
        ['Master of Nursing', 'master', 2, 'master-health'],
        ['Master of Occupational Therapy', 'master', 2, 'master-health'],
      ],
      'Faculty of Education': [
        ['Master of Education', 'master', 2, 'master-education'],
      ],
      'Faculty of Science': [
        ['Master of Science (Biological Sciences)', 'master', 2, 'master-science'],
        ['Master of Science (Statistics)', 'master', 2, 'master-science'],
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
      'utp-media': 30500,
      'utp-health': 32500,
      'bachelor-business': 38500,
      'bachelor-engineering': 44500,
      'bachelor-computing': 41500,
      'bachelor-arts': 33500,
      'bachelor-media': 36500,
      'bachelor-science': 38500,
      'bachelor-health': 39500,
      'bachelor-architecture': 42500,
      'bachelor-law': 38500,
      'master-business': 36500,
      'master-engineering': 38500,
      'master-arts': 30500,
      'master-computing': 38500,
      'master-media': 32500,
      'master-health': 32500,
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
      'Lincoln Alexander School of Law — основана в 2020',
    ],
    keyFactsRu: [
      'Downtown-Toronto, urban-кампус',
      'Более 50 000 студентов',
      'Основан в 1948 (переименован из Ryerson в 2022)',
      'Ted Rogers School of Management — аккредитация AACSB',
      'Топ-5 в Канаде по журналистике + media studies',
      'Lincoln Alexander School of Law — основана в 2020',
    ],
    accommodation: [
      { name: 'TMU Pitman Hall Residence', price: 'от CA$1,250/мес', text: 'Традиционная резиденция в центре кампуса — single и double-комнаты, общие кухни. Meal plan включён для первокурсников.' },
      { name: 'TMU International Living/Learning Centre (ILC)', price: 'от CA$1,350/мес', text: 'Apartment-style для upper-year students — 4-местные апартаменты с собственной кухней. Downtown-локация.' },
      { name: 'TMU Daphne Cockwell Complex (DCC) Residence', price: 'от CA$1,450/мес', text: 'Новейшее здание DCC, suite-style апартаменты, gym и study lounges. Walking distance ко всем faculty.' },
      { name: 'CampusOne (партнёрская резиденция)', price: 'от CA$1,400/мес', text: 'Партнёрская резиденция в downtown Toronto, рядом с TMU campus. Studio и shared апартаменты.' },
      { name: 'Homestay через TMUIC', price: 'от CA$1,250/мес', text: 'Канадская принимающая семья в Greater Toronto — питание и комната, метро до downtown 15-30 минут.' },
      { name: 'Off-campus rental — Greater Toronto', price: 'от CA$1,300/мес', text: 'Аренда квартир и комнат в Toronto, поддержка через TMUIC accommodation team.' },
    ],
    campuses: [
      { title: 'Downtown Toronto Campus', sub: 'В центре Toronto, рядом с Yonge–Dundas Square', text: 'Urban-кампус, все факультеты в пешей доступности. Современные здания, Daphne Cockwell Complex, Mattamy Athletic Centre.' },
      { title: 'TMU Brampton (Lincoln Alexander School of Law)', sub: 'Brampton, ON', text: 'Будущий правовой кампус Lincoln Alexander School of Law (anticipated 2026). Сейчас Law школа базируется в downtown.' },
    ],
    extraScholarships: [
      {
        name: 'TMU International Student Scholarship',
        nameRu: 'TMU International Student Scholarship',
        amount: 'до CA$5,000',
        description: 'Renewable award for incoming international undergraduate students with strong academic records.',
        descriptionRu: 'Возобновляемая стипендия для международных абитуриентов бакалавриата TMU с сильной академической базой.',
        url: 'https://www.torontomu.ca/admissions/undergraduate/financial-aid/',
      },
      {
        name: "President's Scholarship of Distinction",
        nameRu: "President's Scholarship of Distinction",
        amount: 'до CA$10,000',
        description: 'Top entrance scholarship at TMU for students with 95%+ admission average.',
        descriptionRu: 'Топовая entrance-стипендия TMU для студентов с admission average 95%+.',
        url: 'https://www.torontomu.ca/admissions/undergraduate/financial-aid/scholarships/',
      },
      {
        name: 'TMUIC Academic Excellence Award',
        nameRu: 'TMUIC Academic Excellence Award',
        amount: 'до CA$4,000',
        description: 'Merit-based award for TMUIC pathway students transitioning to TMU.',
        descriptionRu: 'Стипендия за академические заслуги для студентов TMUIC, переходящих в TMU.',
        url: 'https://www.torontomuic.ca/scholarships/',
      },
      {
        name: 'Ted Rogers School of Management Scholarship',
        nameRu: 'Ted Rogers School of Management Scholarship',
        amount: 'до CA$8,000',
        description: 'Faculty scholarship for international students entering Ted Rogers School undergraduate programs.',
        descriptionRu: 'Факультетская стипендия для международных студентов программ Ted Rogers School.',
        url: 'https://www.torontomu.ca/tedrogersschool/',
      },
      {
        name: 'TMU Faculty of Engineering International Award',
        nameRu: 'TMU Engineering International Award',
        amount: 'до CA$6,000',
        description: 'Faculty award for international students entering Engineering and Architectural Science programs.',
        descriptionRu: 'Стипендия факультета Engineering and Architectural Science для международных студентов.',
        url: 'https://www.torontomu.ca/engineering-architectural-science/',
      },
    ],
    pathwayPrograms: {
      'University Transfer Program (Stage 1)': [
        ['UTP Stage 1 — pathway to TMU Year 2', 'foundation', 1, 'foundation'],
        ['UTP Stage 1 — Extended', 'foundation', 1.5, 'foundation'],
      ],
      'Business and Management (Ted Rogers)': [
        ['UTP Stage 2 — Business Management', 'foundation', 0.67, 'utp-business'],
        ['UTP Stage 2 — Accounting and Finance', 'foundation', 0.67, 'utp-business'],
        ['UTP Stage 2 — Hospitality and Tourism Management', 'foundation', 0.67, 'utp-business'],
        ['UTP Stage 2 — Retail Management', 'foundation', 0.67, 'utp-business'],
      ],
      'Engineering and Architectural Science': [
        ['UTP Stage 2 — Engineering', 'foundation', 0.67, 'utp-engineering'],
        ['UTP Stage 2 — Architectural Science', 'foundation', 0.67, 'utp-engineering'],
      ],
      'Computing and IT': [
        ['UTP Stage 2 — Computer Science', 'foundation', 0.67, 'utp-computing'],
      ],
      'Media and Creative Industries (FCAD)': [
        ['UTP Stage 2 — Media Production', 'foundation', 0.67, 'utp-media'],
        ['UTP Stage 2 — Creative Industries', 'foundation', 0.67, 'utp-media'],
      ],
      'Arts and Humanities': [
        ['UTP Stage 2 — Arts (Sociology / Psychology / Politics)', 'foundation', 0.67, 'utp-arts'],
        ['UTP Stage 2 — Criminology', 'foundation', 0.67, 'utp-arts'],
      ],
      'Community Services': [
        ['UTP Stage 2 — Pre-Nursing', 'foundation', 0.67, 'utp-health'],
        ['UTP Stage 2 — Social Work', 'foundation', 0.67, 'utp-health'],
      ],
    },
    bachelorPrograms: {
      'Ted Rogers School of Management': [
        ['Bachelor of Commerce (Accounting & Finance)', 'bachelor', 4, 'bachelor-business'],
        ['Bachelor of Commerce (Business Management)', 'bachelor', 4, 'bachelor-business'],
        ['Bachelor of Commerce (Information Technology Management)', 'bachelor', 4, 'bachelor-business'],
        ['Bachelor of Commerce (Marketing Management)', 'bachelor', 4, 'bachelor-business'],
        ['Bachelor of Commerce (Human Resources Management)', 'bachelor', 4, 'bachelor-business'],
        ['Bachelor of Commerce (Hospitality and Tourism Management)', 'bachelor', 4, 'bachelor-business'],
        ['Bachelor of Commerce (Retail Management)', 'bachelor', 4, 'bachelor-business'],
        ['Bachelor of Commerce (Real Estate Management)', 'bachelor', 4, 'bachelor-business'],
        ['Bachelor of Commerce (Health Services Management)', 'bachelor', 4, 'bachelor-business'],
        ['Bachelor of Commerce (Global Management Studies)', 'bachelor', 4, 'bachelor-business'],
        ['Bachelor of Commerce (Law and Business)', 'bachelor', 4, 'bachelor-business'],
      ],
      'Engineering and Architectural Science': [
        ['Bachelor of Engineering (Civil)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering (Mechanical)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering (Electrical)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering (Aerospace)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering (Biomedical)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering (Chemical)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering (Industrial)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Architectural Science', 'bachelor', 4, 'bachelor-architecture'],
        ['Bachelor of Science (Architectural Science — Project Management)', 'bachelor', 4, 'bachelor-architecture'],
      ],
      'Computing and IT': [
        ['Bachelor of Science (Computer Science)', 'bachelor', 4, 'bachelor-computing'],
        ['Bachelor of Engineering (Computer)', 'bachelor', 4, 'bachelor-computing'],
        ['Bachelor of Engineering (Software)', 'bachelor', 4, 'bachelor-computing'],
        ['Bachelor of Science (Data Science and Analytics)', 'bachelor', 4, 'bachelor-computing'],
      ],
      'The Creative School (FCAD)': [
        ['Bachelor of Journalism', 'bachelor', 4, 'bachelor-media'],
        ['Bachelor of Fine Arts (Image Arts — Film)', 'bachelor', 4, 'bachelor-media'],
        ['Bachelor of Fine Arts (Image Arts — Photography Studies)', 'bachelor', 4, 'bachelor-media'],
        ['Bachelor of Arts (Media Production)', 'bachelor', 4, 'bachelor-media'],
        ['Bachelor of Arts (RTA School of Media — Sport Media)', 'bachelor', 4, 'bachelor-media'],
        ['Bachelor of Arts (RTA School of Media — Media Industries)', 'bachelor', 4, 'bachelor-media'],
        ['Bachelor of Arts (Creative Industries)', 'bachelor', 4, 'bachelor-media'],
        ['Bachelor of Design (Fashion Communication)', 'bachelor', 4, 'bachelor-media'],
        ['Bachelor of Design (Fashion Design)', 'bachelor', 4, 'bachelor-media'],
        ['Bachelor of Arts (Performance — Acting)', 'bachelor', 4, 'bachelor-media'],
        ['Bachelor of Fine Arts (New Media)', 'bachelor', 4, 'bachelor-media'],
        ['Bachelor of Design (Graphic Communications Management)', 'bachelor', 4, 'bachelor-media'],
      ],
      'Faculty of Arts': [
        ['Bachelor of Arts (Sociology)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Psychology)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Politics and Governance)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Criminology)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (English)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (History)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Philosophy)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Geographic Analysis)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Economics)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (International Economics and Finance)', 'bachelor', 4, 'bachelor-arts'],
      ],
      'Faculty of Science': [
        ['Bachelor of Science (Biology)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Mathematics and its Applications)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Chemistry)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Medical Physics)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Biomedical Sciences)', 'bachelor', 4, 'bachelor-science'],
      ],
      'Faculty of Community Services': [
        ['Bachelor of Science (Nursing)', 'bachelor', 4, 'bachelor-health'],
        ['Bachelor of Social Work', 'bachelor', 4, 'bachelor-health'],
        ['Bachelor of Arts (Child and Youth Care)', 'bachelor', 4, 'bachelor-health'],
        ['Bachelor of Arts (Early Childhood Studies)', 'bachelor', 4, 'bachelor-health'],
        ['Bachelor of Science (Nutrition and Food)', 'bachelor', 4, 'bachelor-health'],
        ['Bachelor of Arts (Disability Studies)', 'bachelor', 4, 'bachelor-health'],
        ['Bachelor of Health Administration', 'bachelor', 4, 'bachelor-health'],
        ['Bachelor of Health Science (Midwifery)', 'bachelor', 4, 'bachelor-health'],
        ['Bachelor of Arts (Urban and Regional Planning)', 'bachelor', 4, 'bachelor-arts'],
      ],
      'Lincoln Alexander School of Law': [
        ['Juris Doctor (JD)', 'bachelor', 3, 'bachelor-law'],
      ],
    },
    masterPrograms: {
      'Ted Rogers School of Management': [
        ['Master of Business Administration', 'master', 1, 'master-business'],
        ['Master of Science in Management', 'master', 1, 'master-business'],
        ['MBA — Tech Management and Innovation', 'master', 1.5, 'master-business'],
      ],
      'Engineering': [
        ['Master of Engineering (Civil)', 'master', 2, 'master-engineering'],
        ['Master of Engineering (Mechanical)', 'master', 2, 'master-engineering'],
        ['Master of Engineering (Electrical and Computer)', 'master', 2, 'master-engineering'],
        ['Master of Engineering (Aerospace)', 'master', 2, 'master-engineering'],
        ['Master of Architecture', 'master', 2, 'master-engineering'],
        ['Master of Building Science', 'master', 2, 'master-engineering'],
      ],
      'Computing and IT': [
        ['Master of Science (Computer Science)', 'master', 2, 'master-computing'],
        ['Master of Engineering (Software)', 'master', 2, 'master-computing'],
        ['Master of Science in Data Science and Analytics', 'master', 1, 'master-computing'],
      ],
      'The Creative School': [
        ['Master of Journalism', 'master', 2, 'master-media'],
        ['Master of Digital Media', 'master', 1, 'master-media'],
        ['Master of Arts (Communication and Culture)', 'master', 2, 'master-media'],
        ['Master of Arts (Film and Photography Preservation)', 'master', 2, 'master-media'],
      ],
      'Faculty of Community Services': [
        ['Master of Nursing', 'master', 2, 'master-health'],
        ['Master of Social Work', 'master', 2, 'master-health'],
        ['Master of Health Administration', 'master', 2, 'master-health'],
        ['Master of Planning in Urban Development', 'master', 2, 'master-arts'],
      ],
      'Faculty of Arts': [
        ['Master of Arts (Psychology)', 'master', 2, 'master-arts'],
        ['Master of Arts (Public Policy and Administration)', 'master', 2, 'master-arts'],
        ['Master of Arts (Economics)', 'master', 2, 'master-arts'],
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
      'utp-fine-arts': 19500,
      'utp-education': 19500,
      'bachelor-management': 23500,
      'bachelor-arts': 21500,
      'bachelor-science': 23500,
      'bachelor-health': 24500,
      'bachelor-nursing': 25500,
      'bachelor-fine-arts': 22500,
      'bachelor-education': 21500,
      'master-business': 22500,
      'master-arts': 16500,
      'master-science': 18500,
      'master-education': 17500,
      'master-health': 19500,
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
      'Dhillon School of Business — accredited',
    ],
    keyFactsRu: [
      'Топ-50 research-университетов Канады',
      'Сильные программы neuroscience + fine arts',
      'Более 9 000 студентов',
      'Основан в 1967',
      'Главный кампус Lethbridge + pathway Calgary',
      'Dhillon School of Business — аккредитованная школа бизнеса',
    ],
    accommodation: [
      { name: 'ULethbridge Mount Blakiston House', price: 'от CA$800/мес', text: 'On-campus резиденция в Lethbridge — single и double-комнаты, общая кухня. Meal plan по выбору.' },
      { name: 'ULethbridge Kainai House', price: 'от CA$850/мес', text: 'Suite-style апартаменты для upper-year students — 4-местные с кухней и гостиной.' },
      { name: 'ULethbridge Piikani House', price: 'от CA$800/мес', text: 'Резиденция первокурсников — single комнаты, common rooms, рядом с University Hall.' },
      { name: 'ULIC Calgary partner residences', price: 'от CA$950/мес', text: 'Партнёрские студенческие резиденции в downtown Calgary — комнаты с общей кухней.' },
      { name: 'Homestay через ULIC', price: 'от CA$1,050/мес', text: 'Канадская принимающая семья в Calgary — питание и комната.' },
      { name: 'Off-campus rental — Calgary / Lethbridge', price: 'от CA$700/мес', text: 'Аренда квартир в Calgary (downtown, Beltline) и Lethbridge — ULIC accommodation team помогает.' },
    ],
    campuses: [
      { title: 'Lethbridge Main Campus', sub: 'Lethbridge, AB — 220 км от Calgary', text: 'Главный кампус на coulees реки Oldman, архитектурный комплекс Arthur Erickson. University Hall, Science Commons.' },
      { title: 'Calgary Campus (ULIC pathway)', sub: 'В центре Calgary', text: 'Pathway-кампус, downtown Calgary. После UTP Stage 2 студенты переезжают в Lethbridge или продолжают на Calgary campus.' },
      { title: 'Edmonton Campus', sub: 'Edmonton, AB', text: 'Школа Education (Bachelor of Education after-degree). Партнёрство с другими альбертскими PSE.' },
    ],
    extraScholarships: [
      {
        name: 'ULethbridge International Entrance Scholarship',
        nameRu: 'ULethbridge International Entrance Scholarship',
        amount: 'до CA$5,000',
        description: 'Renewable entrance scholarship for international students with 80%+ admission average.',
        descriptionRu: 'Возобновляемая entrance-стипендия для международных студентов с admission average 80%+.',
        url: 'https://www.ulethbridge.ca/scholarships',
      },
      {
        name: "Board of Governors' Admission Scholarship",
        nameRu: "Board of Governors' Admission Scholarship",
        amount: 'до CA$8,000',
        description: 'Top entrance award at ULethbridge for outstanding incoming students.',
        descriptionRu: 'Главная entrance-стипендия ULethbridge для выдающихся абитуриентов.',
        url: 'https://www.ulethbridge.ca/scholarships',
      },
      {
        name: 'ULIC Academic Excellence Award',
        nameRu: 'ULIC Academic Excellence Award',
        amount: 'до CA$3,500',
        description: 'Merit-based award for ULIC pathway students with strong GPA transitioning to ULethbridge.',
        descriptionRu: 'Стипендия за академические заслуги студентам ULIC, переходящим в ULethbridge.',
        url: 'https://www.uicc.ca/scholarships/',
      },
      {
        name: 'Dhillon School of Business International Scholarship',
        nameRu: 'Dhillon School International Scholarship',
        amount: 'до CA$5,000',
        description: 'Faculty scholarship for international Bachelor of Management students at Dhillon School.',
        descriptionRu: 'Факультетская стипендия для международных студентов Bachelor of Management в Dhillon School.',
        url: 'https://www.ulethbridge.ca/management/',
      },
      {
        name: 'ULethbridge Indigenous Student Award',
        nameRu: 'ULethbridge Indigenous Student Award',
        amount: 'до CA$4,000',
        description: 'Award for Indigenous students entering or continuing at the University of Lethbridge.',
        descriptionRu: 'Стипендия для коренных студентов ULethbridge.',
        url: 'https://www.ulethbridge.ca/indigenous-students',
      },
    ],
    pathwayPrograms: {
      'University Transfer Program (Stage 1)': [
        ['UTP Stage 1 (Pre-Bachelor)', 'foundation', 1, 'foundation'],
        ['UTP Stage 1 — Extended', 'foundation', 1.5, 'foundation'],
      ],
      'Management': [
        ['UTP Stage 2 — Management', 'foundation', 0.67, 'utp-management'],
        ['UTP Stage 2 — Accounting', 'foundation', 0.67, 'utp-management'],
        ['UTP Stage 2 — Finance', 'foundation', 0.67, 'utp-management'],
      ],
      'Arts and Humanities': [
        ['UTP Stage 2 — Arts (General)', 'foundation', 0.67, 'utp-arts'],
        ['UTP Stage 2 — Psychology', 'foundation', 0.67, 'utp-arts'],
        ['UTP Stage 2 — Sociology', 'foundation', 0.67, 'utp-arts'],
      ],
      'Science': [
        ['UTP Stage 2 — Science (General)', 'foundation', 0.67, 'utp-science'],
        ['UTP Stage 2 — Computer Science', 'foundation', 0.67, 'utp-science'],
        ['UTP Stage 2 — Biological Sciences', 'foundation', 0.67, 'utp-science'],
        ['UTP Stage 2 — Neuroscience', 'foundation', 0.67, 'utp-science'],
      ],
      'Health Sciences': [
        ['UTP Stage 2 — Health Sciences', 'foundation', 0.67, 'utp-health'],
        ['UTP Stage 2 — Public Health', 'foundation', 0.67, 'utp-health'],
        ['UTP Stage 2 — Pre-Nursing', 'foundation', 0.67, 'utp-health'],
      ],
      'Fine Arts': [
        ['UTP Stage 2 — Fine Arts', 'foundation', 0.67, 'utp-fine-arts'],
        ['UTP Stage 2 — New Media', 'foundation', 0.67, 'utp-fine-arts'],
      ],
      'Education': [
        ['UTP Stage 2 — Education (Pre-Bachelor)', 'foundation', 0.67, 'utp-education'],
      ],
    },
    bachelorPrograms: {
      'Dhillon School of Business': [
        ['Bachelor of Management (Accounting)', 'bachelor', 4, 'bachelor-management'],
        ['Bachelor of Management (Finance)', 'bachelor', 4, 'bachelor-management'],
        ['Bachelor of Management (Marketing)', 'bachelor', 4, 'bachelor-management'],
        ['Bachelor of Management (Human Resource Management)', 'bachelor', 4, 'bachelor-management'],
        ['Bachelor of Management (General Management)', 'bachelor', 4, 'bachelor-management'],
        ['Bachelor of Management (International Management)', 'bachelor', 4, 'bachelor-management'],
        ['Bachelor of Management (Economics)', 'bachelor', 4, 'bachelor-management'],
        ['Bachelor of Management (Information Systems)', 'bachelor', 4, 'bachelor-management'],
        ['Bachelor of Management (Indigenous Governance and Business Management)', 'bachelor', 4, 'bachelor-management'],
      ],
      'Faculty of Arts and Science (Humanities)': [
        ['Bachelor of Arts (Psychology)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Economics)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Sociology)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Political Science)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (English)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (History)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Philosophy)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Geography)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Anthropology)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Indigenous Studies)', 'bachelor', 4, 'bachelor-arts'],
      ],
      'Faculty of Arts and Science (Science)': [
        ['Bachelor of Science (Computer Science)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Biological Sciences)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Mathematics)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Neuroscience)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Chemistry)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Physics)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Environmental Science)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Biochemistry)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Geography)', 'bachelor', 4, 'bachelor-science'],
      ],
      'Faculty of Health Sciences': [
        ['Bachelor of Health Sciences (Addictions Counselling)', 'bachelor', 4, 'bachelor-health'],
        ['Bachelor of Health Sciences (Public Health)', 'bachelor', 4, 'bachelor-health'],
        ['Bachelor of Nursing', 'bachelor', 4, 'bachelor-nursing'],
        ['Bachelor of Therapeutic Recreation', 'bachelor', 4, 'bachelor-health'],
        ['Bachelor of Science (Kinesiology)', 'bachelor', 4, 'bachelor-health'],
      ],
      'Faculty of Fine Arts': [
        ['Bachelor of Fine Arts (New Media)', 'bachelor', 4, 'bachelor-fine-arts'],
        ['Bachelor of Fine Arts (Art Studio)', 'bachelor', 4, 'bachelor-fine-arts'],
        ['Bachelor of Fine Arts (Dramatic Arts)', 'bachelor', 4, 'bachelor-fine-arts'],
        ['Bachelor of Music', 'bachelor', 4, 'bachelor-fine-arts'],
        ['Bachelor of Music (Performance)', 'bachelor', 4, 'bachelor-fine-arts'],
      ],
      'Faculty of Education': [
        ['Bachelor of Education (After-Degree)', 'bachelor', 2, 'bachelor-education'],
        ['Combined Bachelor of Arts / Bachelor of Education', 'bachelor', 5, 'bachelor-education'],
        ['Combined Bachelor of Science / Bachelor of Education', 'bachelor', 5, 'bachelor-education'],
      ],
    },
    masterPrograms: {
      'Dhillon School of Business': [
        ['Master of Science in Management', 'master', 1.5, 'master-business'],
        ['Master of Science in Management — Accounting', 'master', 1.5, 'master-business'],
        ['Master of Science in Management — Finance', 'master', 1.5, 'master-business'],
      ],
      'Faculty of Arts and Science': [
        ['Master of Arts (English)', 'master', 2, 'master-arts'],
        ['Master of Arts (Psychology)', 'master', 2, 'master-arts'],
        ['Master of Arts (Sociology)', 'master', 2, 'master-arts'],
        ['Master of Arts (Political Science)', 'master', 2, 'master-arts'],
      ],
      'Science': [
        ['Master of Science (Neuroscience)', 'master', 2, 'master-science'],
        ['Master of Science (Biological Sciences)', 'master', 2, 'master-science'],
        ['Master of Science (Computer Science)', 'master', 2, 'master-science'],
      ],
      'Education': [
        ['Master of Education (Counselling Psychology)', 'master', 2, 'master-education'],
        ['Master of Education (Curriculum and Assessment)', 'master', 2, 'master-education'],
        ['Master of Education (Educational Leadership)', 'master', 2, 'master-education'],
      ],
      'Health Sciences': [
        ['Master of Nursing', 'master', 2, 'master-health'],
        ['Master of Science (Health Sciences)', 'master', 2, 'master-health'],
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
      'utp-music': 32500,
      'bachelor-business': 42500,
      'bachelor-engineering': 50500,
      'bachelor-science': 47500,
      'bachelor-fims': 41500,
      'bachelor-health': 46500,
      'bachelor-arts': 39500,
      'bachelor-mos': 42500,
      'bachelor-medsci': 47500,
      'bachelor-music': 41500,
      'bachelor-social-work': 38500,
      'bachelor-law': 50500,
      'master-business': 50500,
      'master-engineering': 45500,
      'master-arts': 32500,
      'master-health': 35500,
      'master-science': 38500,
      'master-fims': 35500,
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
      'Schulich School of Medicine & Dentistry',
    ],
    keyFactsRu: [
      'U15 research-intensive университет',
      'Ivey Business School — топовая MBA в Канаде',
      'Более 37 000 студентов',
      'Основан в 1878',
      'Топ-200 университетов мира (THE 2024)',
      'Schulich School of Medicine & Dentistry',
    ],
    accommodation: [
      { name: 'Western Residence — Saugeen-Maitland Hall', price: 'от CA$1,100/мес', text: 'Самая большая резиденция Western, традиционная — single и double-комнаты, meal plan включён.' },
      { name: 'Western Residence — Ontario Hall', price: 'от CA$1,200/мес', text: 'Suite-style для первокурсников — 2-местные комнаты с общей ванной, meal plan включён.' },
      { name: 'Western Residence — Elgin Hall', price: 'от CA$1,100/мес', text: 'Традиционная резиденция первокурсников, single и double — близко к Faculty of Health Sciences.' },
      { name: 'Western Residence — Medway-Sydenham Hall (Med-Syd)', price: 'от CA$1,150/мес', text: 'Историческое здание (1934), традиционные комнаты, рядом с University College.' },
      { name: 'Western Residence — Essex Hall', price: 'от CA$1,200/мес', text: 'Apartment-style для upper-year students — 2-bedroom апартаменты с кухней и гостиной.' },
      { name: 'Homestay через WIC', price: 'от CA$1,150/мес', text: 'Канадская принимающая семья в London — питание и комната, поддержка адаптации.' },
      { name: 'Off-campus rental — London, ON', price: 'от CA$900/мес', text: 'Аренда квартир и комнат в London (Old North, Masonville) — WIC accommodation team помогает.' },
    ],
    campuses: [
      { title: 'Main Campus (London, Ontario)', sub: '485 гектар вдоль реки Thames River', text: 'Главный кампус, все факультеты + WIC. Историческое здание University College, библиотека D.B. Weldon.' },
      { title: 'Brescia University College (affiliated)', sub: 'West London — affiliated с Western', text: 'Liberal arts college, в основном программы Arts and Humanities, ранее women\'s college.' },
      { title: 'Huron University College (affiliated)', sub: 'West London — affiliated с Western', text: 'Liberal arts + theology, business программы, маленький кампус.' },
      { title: "King's University College (affiliated)", sub: 'East of main campus — affiliated с Western', text: 'Liberal arts, social work, social justice and peace studies, business.' },
    ],
    extraScholarships: [
      {
        name: "Western International President's Entrance Scholarship",
        nameRu: "Western International President's Entrance Scholarship",
        amount: 'до CA$70,000',
        description: 'Flagship four-year award for top international undergraduate entrants at Western University.',
        descriptionRu: 'Флагманская 4-летняя стипендия Western для топовых международных абитуриентов бакалавриата.',
        url: 'https://welcome.uwo.ca/admissions/scholarships-and-financial-aid/',
      },
      {
        name: 'Western International Admission Scholarship',
        nameRu: 'Western International Admission Scholarship',
        amount: 'до CA$10,000',
        description: 'Automatic entrance award for international students with strong admission averages.',
        descriptionRu: 'Автоматическая entrance-стипендия для международных студентов с высокими оценками.',
        url: 'https://welcome.uwo.ca/admissions/scholarships-and-financial-aid/',
      },
      {
        name: 'WIC Academic Excellence Award',
        nameRu: 'WIC Academic Excellence Award',
        amount: 'до CA$5,000',
        description: 'Merit-based award for WIC pathway students transitioning to Western.',
        descriptionRu: 'Стипендия за академические заслуги студентам WIC, переходящим в Western.',
        url: 'https://www.westernic.ca/scholarships/',
      },
      {
        name: 'Ivey Business School HBA International Award',
        nameRu: 'Ivey HBA International Award',
        amount: 'до CA$25,000',
        description: 'Faculty scholarship for international students entering the Ivey HBA program.',
        descriptionRu: 'Стипендия Ivey HBA для международных студентов.',
        url: 'https://www.ivey.uwo.ca/hba/',
      },
      {
        name: 'Schulich Leader Scholarship',
        nameRu: 'Schulich Leader Scholarship',
        amount: 'до CA$120,000',
        description: 'Prestigious STEM entrance scholarship at Western for outstanding undergraduate students.',
        descriptionRu: 'Престижная STEM entrance-стипендия Western для выдающихся студентов бакалавриата.',
        url: 'https://www.schulichleaders.com/',
      },
      {
        name: 'Western Continuing Admission Scholarship',
        nameRu: 'Western Continuing Admission Scholarship',
        amount: 'до CA$2,000',
        description: 'Renewable in-course scholarship at Western based on academic standing.',
        descriptionRu: 'Возобновляемая in-course стипендия Western на основе академических заслуг.',
        url: 'https://welcome.uwo.ca/admissions/scholarships-and-financial-aid/',
      },
    ],
    pathwayPrograms: {
      'University Transfer Program (Stage 1)': [
        ['UTP Stage 1 — pathway to Western Year 2', 'foundation', 1, 'foundation'],
        ['UTP Stage 1 — Extended (3-term)', 'foundation', 1.5, 'foundation'],
      ],
      'Engineering': [
        ['UTP Stage 2 — Engineering (Common First Year)', 'foundation', 0.67, 'utp-engineering'],
        ['UTP Stage 2 — Software Engineering', 'foundation', 0.67, 'utp-engineering'],
      ],
      'Business (Management and Organizational Studies)': [
        ['UTP Stage 2 — Management and Organizational Studies', 'foundation', 0.67, 'utp-business'],
        ['UTP Stage 2 — BMOS Finance', 'foundation', 0.67, 'utp-business'],
      ],
      'Science': [
        ['UTP Stage 2 — Science (General)', 'foundation', 0.67, 'utp-science'],
        ['UTP Stage 2 — Computer Science', 'foundation', 0.67, 'utp-science'],
        ['UTP Stage 2 — Medical Sciences (BMSc pathway)', 'foundation', 0.67, 'utp-science'],
      ],
      'Information and Media Studies (FIMS)': [
        ['UTP Stage 2 — FIMS', 'foundation', 0.67, 'utp-fims'],
        ['UTP Stage 2 — Media, Information and Technoculture', 'foundation', 0.67, 'utp-fims'],
      ],
      'Health Sciences': [
        ['UTP Stage 2 — Health Sciences (BHSc pathway)', 'foundation', 0.67, 'utp-health'],
        ['UTP Stage 2 — Kinesiology', 'foundation', 0.67, 'utp-health'],
      ],
      'Social Sciences and Arts': [
        ['UTP Stage 2 — Social Sciences', 'foundation', 0.67, 'utp-arts'],
        ['UTP Stage 2 — Arts and Humanities', 'foundation', 0.67, 'utp-arts'],
        ['UTP Stage 2 — Psychology', 'foundation', 0.67, 'utp-arts'],
        ['UTP Stage 2 — Economics', 'foundation', 0.67, 'utp-arts'],
      ],
      'Music': [
        ['UTP Stage 2 — Music', 'foundation', 0.67, 'utp-music'],
      ],
    },
    bachelorPrograms: {
      'Ivey Business School + Management and Organizational Studies (DAN MOS)': [
        ['Honours Business Administration (HBA — Ivey)', 'bachelor', 2, 'bachelor-business'],
        ['Bachelor of Management and Organizational Studies (BMOS) — Finance', 'bachelor', 4, 'bachelor-mos'],
        ['BMOS — Accounting', 'bachelor', 4, 'bachelor-mos'],
        ['BMOS — Consumer Behaviour', 'bachelor', 4, 'bachelor-mos'],
        ['BMOS — Organizational and Human Resources', 'bachelor', 4, 'bachelor-mos'],
        ['BMOS — Policy, Ethics and Social Responsibility', 'bachelor', 4, 'bachelor-mos'],
        ['BMOS — Global Commerce', 'bachelor', 4, 'bachelor-mos'],
      ],
      'Faculty of Engineering': [
        ['Bachelor of Engineering Science (Civil)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering Science (Mechanical)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering Science (Electrical)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering Science (Software)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering Science (Chemical and Biochemical)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering Science (Mechatronic Systems)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering Science (Integrated Engineering)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering Science (Computer)', 'bachelor', 4, 'bachelor-engineering'],
      ],
      'Faculty of Science': [
        ['Bachelor of Science (Computer Science)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Mathematics)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Statistical and Actuarial Sciences)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Biology)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Chemistry)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Physics and Astronomy)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Earth Sciences)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Environmental Science)', 'bachelor', 4, 'bachelor-science'],
      ],
      'Schulich School of Medicine & Dentistry (Pre-clinical)': [
        ['Bachelor of Medical Sciences (BMSc) — Honours Specialization', 'bachelor', 4, 'bachelor-medsci'],
        ['Bachelor of Medical Sciences (BMSc) — Biochemistry', 'bachelor', 4, 'bachelor-medsci'],
        ['Bachelor of Medical Sciences (BMSc) — Microbiology and Immunology', 'bachelor', 4, 'bachelor-medsci'],
        ['Bachelor of Medical Sciences (BMSc) — Pharmacology', 'bachelor', 4, 'bachelor-medsci'],
        ['Bachelor of Medical Sciences (BMSc) — Pathology and Toxicology', 'bachelor', 4, 'bachelor-medsci'],
        ['Bachelor of Medical Sciences (BMSc) — Medical Cell Biology', 'bachelor', 4, 'bachelor-medsci'],
        ['Bachelor of Medical Sciences (BMSc) — Medical Biophysics', 'bachelor', 4, 'bachelor-medsci'],
      ],
      'Faculty of Health Sciences': [
        ['Bachelor of Health Sciences (BHSc)', 'bachelor', 4, 'bachelor-health'],
        ['Bachelor of Science in Nursing (BScN)', 'bachelor', 4, 'bachelor-health'],
        ['Bachelor of Arts (Kinesiology)', 'bachelor', 4, 'bachelor-health'],
        ['Bachelor of Science (Kinesiology)', 'bachelor', 4, 'bachelor-health'],
        ['Bachelor of Health Sciences (Communication Sciences and Disorders)', 'bachelor', 4, 'bachelor-health'],
      ],
      'Faculty of Information and Media Studies (FIMS)': [
        ['Bachelor of Arts (Media, Information and Technoculture — MIT)', 'bachelor', 4, 'bachelor-fims'],
        ['Bachelor of Arts (Media and the Public Interest)', 'bachelor', 4, 'bachelor-fims'],
        ['Bachelor of Arts (Game Development)', 'bachelor', 4, 'bachelor-fims'],
      ],
      'Faculty of Arts and Humanities': [
        ['Bachelor of Arts (English Language and Literature)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Philosophy)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (History)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Modern Languages and Literatures)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Visual Arts)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Film Studies)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Classical Studies)', 'bachelor', 4, 'bachelor-arts'],
      ],
      'Faculty of Social Science': [
        ['Bachelor of Arts (Economics)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Psychology)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Political Science)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Sociology)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Anthropology)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Geography)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (International Relations)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Criminology)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Management and Organizational Studies (MOS) — Social Science stream', 'bachelor', 4, 'bachelor-mos'],
      ],
      'Don Wright Faculty of Music': [
        ['Bachelor of Music (Performance)', 'bachelor', 4, 'bachelor-music'],
        ['Bachelor of Music (Composition)', 'bachelor', 4, 'bachelor-music'],
        ['Bachelor of Music (Music Education)', 'bachelor', 4, 'bachelor-music'],
        ['Bachelor of Musical Arts', 'bachelor', 4, 'bachelor-music'],
      ],
      "King's University College — Social Work": [
        ['Bachelor of Social Work (BSW)', 'bachelor', 4, 'bachelor-social-work'],
      ],
      'Faculty of Law (Western Law)': [
        ['Juris Doctor (JD)', 'bachelor', 3, 'bachelor-law'],
      ],
    },
    masterPrograms: {
      'Ivey Business School': [
        ['MBA (Ivey)', 'master', 1, 'master-business'],
        ['Master of Science in Management (Ivey)', 'master', 1, 'master-business'],
        ['Executive MBA (Ivey)', 'master', 1.5, 'master-business'],
        ['Master of Financial Economics', 'master', 1, 'master-business'],
      ],
      'Faculty of Engineering': [
        ['Master of Engineering Science (Civil and Environmental)', 'master', 2, 'master-engineering'],
        ['Master of Engineering (Mechanical and Materials)', 'master', 2, 'master-engineering'],
        ['Master of Engineering (Electrical and Computer)', 'master', 2, 'master-engineering'],
        ['Master of Engineering (Chemical and Biochemical)', 'master', 2, 'master-engineering'],
        ['Master of Engineering Leadership and Innovation', 'master', 1, 'master-engineering'],
      ],
      'Faculty of Science': [
        ['Master of Science (Computer Science)', 'master', 2, 'master-science'],
        ['Master of Data Analytics', 'master', 1, 'master-science'],
        ['Master of Science (Mathematics)', 'master', 2, 'master-science'],
        ['Master of Science (Biology)', 'master', 2, 'master-science'],
        ['Master of Science (Chemistry)', 'master', 2, 'master-science'],
      ],
      'Faculty of Information and Media Studies': [
        ['Master of Arts (Journalism and Communication)', 'master', 1, 'master-fims'],
        ['Master of Media in Journalism and Communication', 'master', 1, 'master-fims'],
        ['Master of Library and Information Science', 'master', 2, 'master-fims'],
        ['Master of Health Information Science', 'master', 1, 'master-fims'],
      ],
      'Faculty of Arts and Humanities': [
        ['Master of Arts (English)', 'master', 2, 'master-arts'],
        ['Master of Arts (Philosophy)', 'master', 2, 'master-arts'],
        ['Master of Arts (History)', 'master', 2, 'master-arts'],
      ],
      'Faculty of Social Science': [
        ['Master of Arts (Economics)', 'master', 2, 'master-arts'],
        ['Master of Arts (Psychology)', 'master', 2, 'master-arts'],
        ['Master of Arts (Sociology)', 'master', 2, 'master-arts'],
        ['Master of Public Administration', 'master', 1.5, 'master-arts'],
      ],
      'Schulich School of Medicine & Dentistry': [
        ['Master of Public Health', 'master', 1, 'master-health'],
        ['Master of Clinical Anatomy', 'master', 1, 'master-health'],
        ['Master of Science (Epidemiology and Biostatistics)', 'master', 2, 'master-health'],
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
      'utp-science': 30500,
      'utp-music': 28500,
      'utp-social-work': 27500,
      'bachelor-business': 38500,
      'bachelor-business-coop': 42500,
      'bachelor-computing': 37500,
      'bachelor-arts': 33500,
      'bachelor-comm': 35500,
      'bachelor-science': 36500,
      'bachelor-music': 35500,
      'bachelor-social-work': 32500,
      'bachelor-education': 32500,
      'master-business': 36500,
      'master-arts': 28500,
      'master-computing': 32500,
      'master-science': 30500,
      'master-social-work': 28500,
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
      'Faculty of Music — старейший на территории Ontario',
    ],
    keyFactsRu: [
      'Lazaridis School — топ-3 в Канаде по undergrad-бизнесу',
      'Более 20 000 студентов',
      'Основан в 1911',
      '2 кампуса — Waterloo + Brantford',
      "№1 в Канаде по удовлетворённости студентов (Maclean's University Rankings 2024)",
      'Faculty of Music — старейший на территории Ontario',
    ],
    accommodation: [
      { name: 'Laurier Residence — Bricker Residence (Waterloo)', price: 'от CA$1,100/мес', text: 'Традиционная резиденция первокурсников, single и double-комнаты, meal plan включён.' },
      { name: 'Laurier Residence — MacDonald House (Waterloo)', price: 'от CA$1,100/мес', text: 'Историческое здание (1953), small-community living, single-комнаты, рядом с Lazaridis.' },
      { name: 'Laurier Residence — Conrad Hall (Waterloo)', price: 'от CA$1,150/мес', text: 'Suite-style residence — 2-местные с общей ванной, meal plan включён.' },
      { name: 'Laurier Residence — Willison Hall (Waterloo)', price: 'от CA$1,150/мес', text: 'Традиционная резиденция первокурсников — single и double-комнаты, центральная локация на кампусе.' },
      { name: 'Laurier Residence — Brantford (Wilkes / Grand River)', price: 'от CA$1,050/мес', text: 'Резиденции на Brantford campus — single и shared-комнаты, downtown Brantford.' },
      { name: 'Homestay через WLIC', price: 'от CA$1,150/мес', text: 'Канадская принимающая семья в Waterloo — питание и комната, поддержка адаптации.' },
      { name: 'Off-campus rental — Waterloo / Kitchener', price: 'от CA$900/мес', text: 'Аренда комнат и квартир в Waterloo и Kitchener (Northdale, Uptown) — WLIC accommodation team помогает.' },
    ],
    campuses: [
      { title: 'Waterloo Campus', sub: 'Главный кампус — в технологическом коридоре Waterloo-Kitchener', text: 'Lazaridis School, факультет музыки, WLIC. Рядом с Google + BlackBerry, сильная co-op сеть.' },
      { title: 'Brantford Campus', sub: '60 км от Waterloo', text: 'Liberal arts, human + social sciences, criminology, social work. Маленький downtown-кампус.' },
      { title: 'Milton Campus', sub: 'Milton, ON — anticipated', text: 'Planned future campus в Greater Toronto Area — STEM and health focus.' },
    ],
    extraScholarships: [
      {
        name: 'Laurier International Entrance Scholarship',
        nameRu: 'Laurier International Entrance Scholarship',
        amount: 'до CA$8,000',
        description: 'Renewable entrance award for international undergraduate students with strong admission averages.',
        descriptionRu: 'Возобновляемая entrance-стипендия для международных студентов бакалавриата с высокими оценками.',
        url: 'https://students.wlu.ca/student-finance/scholarships-and-bursaries/',
      },
      {
        name: 'Laurier Centennial Scholarship',
        nameRu: 'Laurier Centennial Scholarship',
        amount: 'до CA$16,000',
        description: 'Prestigious 4-year renewable scholarship for top entrance applicants at Laurier.',
        descriptionRu: 'Престижная 4-летняя возобновляемая стипендия Laurier для топовых абитуриентов.',
        url: 'https://students.wlu.ca/student-finance/scholarships-and-bursaries/',
      },
      {
        name: 'WLIC Academic Excellence Award',
        nameRu: 'WLIC Academic Excellence Award',
        amount: 'до CA$4,000',
        description: 'Merit-based award for WLIC pathway students with strong GPA transitioning to Laurier.',
        descriptionRu: 'Стипендия за академические заслуги студентам WLIC, переходящим в Laurier.',
        url: 'https://www.laurieric.ca/scholarships/',
      },
      {
        name: 'Lazaridis School BBA Entrance Scholarship',
        nameRu: 'Lazaridis BBA Entrance Scholarship',
        amount: 'до CA$10,000',
        description: 'Faculty scholarship for top international students entering the BBA at Lazaridis School.',
        descriptionRu: 'Факультетская стипендия Lazaridis для топовых международных студентов BBA.',
        url: 'https://www.wlu.ca/programs/business-and-economics/',
      },
      {
        name: 'Laurier Global Citizenship Award',
        nameRu: 'Laurier Global Citizenship Award',
        amount: 'до CA$5,000',
        description: 'Award for international students demonstrating leadership and community service.',
        descriptionRu: 'Стипендия для международных студентов с лидерскими и общественными достижениями.',
        url: 'https://students.wlu.ca/student-finance/',
      },
    ],
    pathwayPrograms: {
      'University Transfer Program (Stage 1)': [
        ['UTP Stage 1 — pathway to Laurier Year 2', 'foundation', 1, 'foundation'],
        ['UTP Stage 1 — Extended', 'foundation', 1.5, 'foundation'],
      ],
      'Lazaridis School of Business and Economics': [
        ['UTP Stage 2 — Business Administration (BBA)', 'foundation', 0.67, 'utp-business'],
        ['UTP Stage 2 — Economics', 'foundation', 0.67, 'utp-business'],
        ['UTP Stage 2 — Financial Mathematics', 'foundation', 0.67, 'utp-business'],
      ],
      'Computing and IT': [
        ['UTP Stage 2 — Computer Science', 'foundation', 0.67, 'utp-computing'],
        ['UTP Stage 2 — Data Science', 'foundation', 0.67, 'utp-computing'],
      ],
      'Communication and Media': [
        ['UTP Stage 2 — Communication Studies', 'foundation', 0.67, 'utp-comm'],
        ['UTP Stage 2 — Digital Media and Journalism', 'foundation', 0.67, 'utp-comm'],
      ],
      'Arts and Humanities': [
        ['UTP Stage 2 — Psychology', 'foundation', 0.67, 'utp-arts'],
        ['UTP Stage 2 — Criminology', 'foundation', 0.67, 'utp-arts'],
        ['UTP Stage 2 — Political Science', 'foundation', 0.67, 'utp-arts'],
        ['UTP Stage 2 — History', 'foundation', 0.67, 'utp-arts'],
      ],
      'Science and Mathematics': [
        ['UTP Stage 2 — Science (General)', 'foundation', 0.67, 'utp-science'],
        ['UTP Stage 2 — Mathematics', 'foundation', 0.67, 'utp-science'],
        ['UTP Stage 2 — Kinesiology', 'foundation', 0.67, 'utp-science'],
      ],
      'Music': [
        ['UTP Stage 2 — Music', 'foundation', 0.67, 'utp-music'],
      ],
      'Social Work (Brantford)': [
        ['UTP Stage 2 — Social Work', 'foundation', 0.67, 'utp-social-work'],
      ],
    },
    bachelorPrograms: {
      'Lazaridis School of Business and Economics': [
        ['Bachelor of Business Administration (BBA)', 'bachelor', 4, 'bachelor-business'],
        ['BBA Co-op', 'bachelor', 5, 'bachelor-business-coop'],
        ['Bachelor of Arts (Economics)', 'bachelor', 4, 'bachelor-business'],
        ['Bachelor of Arts (Financial Mathematics)', 'bachelor', 4, 'bachelor-business'],
        ['Bachelor of Business Technology Management (BBTM)', 'bachelor', 4, 'bachelor-business'],
        ['Double Degree (BBA + Bachelor of Computer Science)', 'bachelor', 5, 'bachelor-business-coop'],
        ['Double Degree (BBA + Bachelor of Mathematics, with University of Waterloo)', 'bachelor', 5, 'bachelor-business-coop'],
        ['Bachelor of Arts (Business Administration and Economics) Combined', 'bachelor', 4, 'bachelor-business'],
      ],
      'Faculty of Science (Computing and IT)': [
        ['Bachelor of Computer Science', 'bachelor', 4, 'bachelor-computing'],
        ['Bachelor of Science (Data Science)', 'bachelor', 4, 'bachelor-computing'],
        ['Bachelor of Computer Science Co-op', 'bachelor', 5, 'bachelor-computing'],
        ['Bachelor of Computing and Computer Electronics', 'bachelor', 4, 'bachelor-computing'],
      ],
      'Faculty of Liberal Arts (Communication and Media)': [
        ['Bachelor of Arts (Communication Studies)', 'bachelor', 4, 'bachelor-comm'],
        ['Bachelor of Arts (Digital Media and Journalism)', 'bachelor', 4, 'bachelor-comm'],
        ['Bachelor of Arts (User Experience Design)', 'bachelor', 4, 'bachelor-comm'],
        ['Bachelor of Arts (Game Design and Development)', 'bachelor', 4, 'bachelor-comm'],
      ],
      'Faculty of Arts (Humanities and Social Sciences)': [
        ['Bachelor of Arts (Psychology)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Criminology)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Political Science)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Sociology)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (English)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (History)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Religion and Culture)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Languages)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Philosophy)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Anthropology)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Global Studies)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Indigenous Studies)', 'bachelor', 4, 'bachelor-arts'],
      ],
      'Faculty of Science (Sciences and Kinesiology)': [
        ['Bachelor of Science (Mathematics)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Biology)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Chemistry)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Physics)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Biochemistry and Biotechnology)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Health Sciences)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Kinesiology)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Arts (Kinesiology)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Science (Environmental Science)', 'bachelor', 4, 'bachelor-science'],
      ],
      'Faculty of Music': [
        ['Bachelor of Music (Performance)', 'bachelor', 4, 'bachelor-music'],
        ['Bachelor of Music (Composition)', 'bachelor', 4, 'bachelor-music'],
        ['Bachelor of Music (Community Music)', 'bachelor', 4, 'bachelor-music'],
        ['Bachelor of Music Therapy', 'bachelor', 4, 'bachelor-music'],
        ['Bachelor of Arts (Music)', 'bachelor', 4, 'bachelor-music'],
      ],
      'Faculty of Social Work': [
        ['Bachelor of Social Work (BSW)', 'bachelor', 4, 'bachelor-social-work'],
      ],
      'Faculty of Education': [
        ['Bachelor of Education (After-Degree)', 'bachelor', 2, 'bachelor-education'],
        ["Bachelor of Arts (Youth and Children's Studies)", 'bachelor', 4, 'bachelor-education'],
      ],
    },
    masterPrograms: {
      'Lazaridis School of Business and Economics': [
        ['Master of Business Administration (Lazaridis MBA)', 'master', 1, 'master-business'],
        ['Master of Finance', 'master', 1, 'master-business'],
        ['Master of Business Economics', 'master', 1.5, 'master-business'],
        ['Master of Applied Business Analytics', 'master', 1, 'master-business'],
        ['Master of Science in Management (MSc)', 'master', 1, 'master-business'],
      ],
      'Faculty of Science (Computing and IT)': [
        ['Master of Applied Computing', 'master', 1, 'master-computing'],
        ['Master of Science (Computer Science)', 'master', 2, 'master-computing'],
        ['Master of Science (Data Science)', 'master', 1.5, 'master-computing'],
      ],
      'Faculty of Liberal Arts (Communication)': [
        ['Master of Arts (Communication Studies)', 'master', 2, 'master-arts'],
        ['Master of Arts (Cultural Analysis and Social Theory)', 'master', 2, 'master-arts'],
      ],
      'Faculty of Arts': [
        ['Master of Arts (Psychology)', 'master', 2, 'master-arts'],
        ['Master of Arts (English)', 'master', 2, 'master-arts'],
        ['Master of Arts (History)', 'master', 2, 'master-arts'],
        ['Master of Arts (Religion and Culture)', 'master', 2, 'master-arts'],
        ['Master of Arts (Political Science)', 'master', 2, 'master-arts'],
        ['Master of Public Policy', 'master', 1.5, 'master-arts'],
      ],
      'Faculty of Science': [
        ['Master of Science (Mathematics)', 'master', 2, 'master-science'],
        ['Master of Science (Biology)', 'master', 2, 'master-science'],
        ['Master of Science (Kinesiology)', 'master', 2, 'master-science'],
      ],
      'Faculty of Social Work': [
        ['Master of Social Work (MSW)', 'master', 2, 'master-social-work'],
      ],
      'Faculty of Music': [
        ['Master of Arts (Community Music)', 'master', 2, 'master-arts'],
        ['Master of Music Therapy', 'master', 2, 'master-arts'],
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
  const scholarships = [NAVITAS_BURSARY, ...(uni.extraScholarships ?? [])];
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
    scholarships,
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
