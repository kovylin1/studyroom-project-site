// Navitas-NL seeder. The Hague UAS + University of Twente.
import { writeAll, isoIntake, NAVITAS_BURSARY_EUR } from './lib/navitas-seeder.mjs';

const UNIS = [
  {
    slug: 'hague',
    name: 'The Hague University of Applied Sciences',
    city: 'The Hague',
    navitasUrl: 'https://www.thehaguepathway.nl/',
    officialUrl: 'https://www.thehagueuniversity.com/',
    coursesUrl: 'https://www.thehaguepathway.nl/programmes/',
    ielts: 5.5,
    feeBand: {
      foundation: 11500,
      'utp-business': 12500,
      'utp-it': 12500,
      'utp-comm': 11800,
      'bachelor-business': 12800,
      'bachelor-it': 12800,
      'bachelor-comm': 12200,
      'bachelor-engineering': 13500,
      'bachelor-arts': 12200,
      'master-business': 14500,
      'master-comm': 13500,
    },
    paragraphs: [
      'The Hague University of Applied Sciences (THUAS) is a Dutch UAS — a hogeschool — based in Den Haag, the seat of the Dutch government and home to the International Court of Justice. THUAS specialises in business, IT, communication, international law, and engineering — all delivered in English on its Den Haag and Delft campuses.',
      "International students enter via The Hague Pathway College — Navitas's pathway provider on the THUAS campus. Foundation and Year-1 entry programs lead into THUAS Bachelor's degrees, which are fully accredited by NVAO (Dutch-Flemish Accreditation Organisation) and Bologna-aligned.",
    ],
    paragraphsRu: [
      'The Hague University of Applied Sciences (THUAS) — голландский UAS (hogeschool), расположен в Гааге — столице правительства Нидерландов и месте International Court of Justice. Специализация: бизнес, IT, коммуникации, международное право, инженерия. Преподавание на английском, кампусы в Гааге и Делфте.',
      'Международные студенты заходят через The Hague Pathway College — pathway-провайдера Navitas на кампусе THUAS. Foundation и Year-1 entry программы ведут в бакалавриат THUAS. Дипломы аккредитованы NVAO (голландско-фламандская аккредитация), соответствуют Bologna.',
    ],
    keyFacts: [
      'NVAO-accredited Dutch UAS',
      'English-medium teaching across most programs',
      'Over 26,000 students',
      'Located in The Hague — international political capital',
      'Strong placement with international organisations',
    ],
    keyFactsRu: [
      'Голландский UAS, аккредитован NVAO',
      'Преподавание на английском в большинстве программ',
      'Более 26 000 студентов',
      'Гаага — международная политическая столица',
      'Сильная статистика трудоустройства в международных организациях',
    ],
    accommodation: [
      { name: 'THUAS Partner Student Residences', price: 'от €450/мес', text: 'Партнёрские студенческие резиденции в Гааге — комнаты с общей кухней, рядом с кампусом.' },
      { name: 'Private apartment / student room', price: 'от €400/мес', text: 'Аренда комнаты в студенческом доме — стандартный голландский вариант. Поддержка с поиском.' },
      { name: 'Homestay через The Hague Pathway', price: 'от €650/мес', text: 'Голландская принимающая семья — питание и комната, идеально для адаптации.' },
    ],
    campuses: [
      { title: 'The Hague Main Campus', sub: 'В районе Laakhaven, Гаага', text: 'Главный кампус THUAS — современное здание, библиотека, computer labs.' },
      { title: 'Delft Campus', sub: '15 км от Гааги', text: 'Инженерные программы, рядом с TU Delft.' },
    ],
    extraScholarships: [
      {
        name: 'Holland Scholarship',
        nameRu: 'Holland Scholarship',
        amount: '€5,000',
        description: 'One-time Dutch government scholarship for non-EU/EEA international students.',
        descriptionRu: 'Единоразовая стипендия правительства Нидерландов для не-EU/EEA международных студентов.',
        url: 'https://www.studyinholland.nl/finances/holland-scholarship/',
      },
    ],
    pathwayPrograms: {
      'Foundation Studies': [
        ['Foundation Programme — Business', 'foundation', 1, 'foundation'],
        ['Foundation Programme — IT', 'foundation', 1, 'foundation'],
      ],
      'Year 1 Entry Pathways': [
        ['Year 1 Entry — International Business', 'foundation', 1, 'utp-business'],
        ['Year 1 Entry — IT & Computer Science', 'foundation', 1, 'utp-it'],
        ['Year 1 Entry — Communication', 'foundation', 1, 'utp-comm'],
      ],
    },
    bachelorPrograms: {
      'International Business': [
        ['International Business and Management Studies', 'bachelor', 4, 'bachelor-business'],
        ['International Financial Management', 'bachelor', 4, 'bachelor-business'],
        ['International Business Innovation Studies', 'bachelor', 4, 'bachelor-business'],
      ],
      'Communication and Media': [
        ['International Communication Management', 'bachelor', 4, 'bachelor-comm'],
        ['Communication and Multimedia Design', 'bachelor', 4, 'bachelor-comm'],
      ],
      'Computing and IT': [
        ['Computer Science', 'bachelor', 4, 'bachelor-it'],
        ['Software Engineering', 'bachelor', 4, 'bachelor-it'],
      ],
      'Engineering and Technology': [
        ['Industrial Design Engineering', 'bachelor', 4, 'bachelor-engineering'],
        ['Process and Food Technology', 'bachelor', 4, 'bachelor-engineering'],
        ['Mechatronics', 'bachelor', 4, 'bachelor-engineering'],
      ],
      'Public Administration and Law': [
        ['Public Administration', 'bachelor', 4, 'bachelor-arts'],
        ['International and European Law', 'bachelor', 4, 'bachelor-arts'],
      ],
    },
    masterPrograms: {
      'Business': [
        ['Master International Communication Management', 'master', 1, 'master-comm'],
        ['Master Network and Systems Engineering', 'master', 1, 'master-business'],
      ],
    },
  },
  {
    slug: 'twente',
    name: 'University of Twente',
    city: 'Enschede',
    navitasUrl: 'https://www.twentepathway.nl/',
    officialUrl: 'https://www.utwente.nl/',
    coursesUrl: 'https://www.twentepathway.nl/programmes/',
    ielts: 6.0,
    feeBand: {
      foundation: 13500,
      'utp-tech': 14500,
      'utp-business': 14500,
      'bachelor-engineering': 14800,
      'bachelor-business': 14800,
      'bachelor-computing': 14800,
      'bachelor-science': 14800,
      'bachelor-social': 13800,
      'master-engineering': 19000,
      'master-business': 17500,
      'master-computing': 19000,
      'master-science': 17500,
    },
    paragraphs: [
      "University of Twente (UT) is one of the four 4TU technical universities in the Netherlands — alongside TU Delft, TU Eindhoven, and Wageningen. Based on a 140-hectare green campus in Enschede, UT specialises in engineering, technology, computer science, applied physics, and business administration — all taught in English.",
      "International students enter via Twente Pathway College — Navitas's pathway provider on the UT campus. Foundation Programme and Year-1 entry programs lead into UT Bachelor's degrees. UT is consistently ranked in the world's top 200 (THE 2024) and is famous for its entrepreneurial culture — over 1,000 student-spin-off companies.",
    ],
    paragraphsRu: [
      'University of Twente (UT) — один из четырёх технических университетов 4TU в Нидерландах (вместе с TU Delft, TU Eindhoven, Wageningen). Зелёный кампус 140 гектар в Энсхеде. Специализация: инженерия, технологии, computer science, applied physics, business administration. Преподавание на английском.',
      'Международные студенты заходят через Twente Pathway College — pathway-провайдер Navitas на кампусе UT. Foundation Programme и Year-1 entry программы ведут в бакалавриат UT. UT стабильно в топ-200 мира (THE 2024), известен entrepreneurial-культурой — более 1 000 студенческих стартапов.',
    ],
    keyFacts: [
      'Top 200 universities worldwide (THE 2024)',
      'One of 4TU technical universities in the Netherlands',
      'Over 12,000 students',
      'Founded in 1961',
      '140-hectare green campus in Enschede',
    ],
    keyFactsRu: [
      'Топ-200 университетов мира (THE 2024)',
      'Один из 4TU технических университетов Нидерландов',
      'Более 12 000 студентов',
      'Основан в 1961',
      'Зелёный кампус 140 гектар в Энсхеде',
    ],
    accommodation: [
      { name: 'UT Campus Housing (Drienerlolaan)', price: 'от €420/мес', text: 'On-campus резиденции — единственный полноценный кампус-уни в Нидерландах. Комнаты, квартиры-студии.' },
      { name: 'Private apartments in Enschede', price: 'от €380/мес', text: 'Аренда в городе — Enschede небольшой, всё в 15-20 минут велосипеда от кампуса.' },
      { name: 'Homestay через Twente Pathway', price: 'от €600/мес', text: 'Голландская принимающая семья в Enschede — питание и комната.' },
    ],
    campuses: [
      { title: 'Drienerlo Campus (Enschede)', sub: '140 гектар на востоке Нидерландов', text: 'Единственный американо-стиля campus-university в Нидерландах. Аудитории, лаборатории, спорт, общежития, кафе — всё на территории.' },
    ],
    extraScholarships: [
      {
        name: 'University of Twente Scholarship',
        nameRu: 'University of Twente Scholarship',
        amount: '€3,000–€25,000',
        description: 'Merit-based scholarship for outstanding international Master applicants.',
        descriptionRu: 'Стипендия за академические достижения для outstanding международных абитуриентов магистратуры.',
        url: 'https://www.utwente.nl/en/scholarships/',
      },
      {
        name: 'Holland Scholarship',
        nameRu: 'Holland Scholarship',
        amount: '€5,000',
        description: 'One-time Dutch government scholarship for non-EU/EEA international students.',
        descriptionRu: 'Единоразовая стипендия правительства Нидерландов для не-EU/EEA международных студентов.',
        url: 'https://www.studyinholland.nl/finances/holland-scholarship/',
      },
    ],
    pathwayPrograms: {
      'Foundation Studies': [
        ['Foundation Programme — Technical', 'foundation', 1, 'foundation'],
        ['Foundation Programme — Business & Social Sciences', 'foundation', 1, 'foundation'],
      ],
      'Year 1 Entry Pathways': [
        ['Year 1 Entry — Engineering & Technology', 'foundation', 1, 'utp-tech'],
        ['Year 1 Entry — Business & Management', 'foundation', 1, 'utp-business'],
      ],
    },
    bachelorPrograms: {
      'Engineering and Technology': [
        ['BSc Mechanical Engineering', 'bachelor', 3, 'bachelor-engineering'],
        ['BSc Civil Engineering', 'bachelor', 3, 'bachelor-engineering'],
        ['BSc Electrical Engineering', 'bachelor', 3, 'bachelor-engineering'],
        ['BSc Chemical Science and Engineering', 'bachelor', 3, 'bachelor-engineering'],
        ['BSc Industrial Design Engineering', 'bachelor', 3, 'bachelor-engineering'],
        ['BSc Advanced Technology', 'bachelor', 3, 'bachelor-engineering'],
      ],
      'Computing and Data Science': [
        ['BSc Computer Science (Technical CS / Business IT)', 'bachelor', 3, 'bachelor-computing'],
        ['BSc Creative Technology', 'bachelor', 3, 'bachelor-computing'],
      ],
      'Applied Sciences': [
        ['BSc Applied Mathematics', 'bachelor', 3, 'bachelor-science'],
        ['BSc Applied Physics', 'bachelor', 3, 'bachelor-science'],
        ['BSc Biomedical Technology', 'bachelor', 3, 'bachelor-science'],
      ],
      'Business and Social Sciences': [
        ['BSc International Business Administration', 'bachelor', 3, 'bachelor-business'],
        ['BSc Industrial Engineering and Management', 'bachelor', 3, 'bachelor-business'],
        ['BSc Psychology', 'bachelor', 3, 'bachelor-social'],
        ['BSc Communication Science', 'bachelor', 3, 'bachelor-social'],
      ],
    },
    masterPrograms: {
      'Engineering': [
        ['MSc Mechanical Engineering', 'master', 2, 'master-engineering'],
        ['MSc Civil Engineering and Management', 'master', 2, 'master-engineering'],
        ['MSc Electrical Engineering', 'master', 2, 'master-engineering'],
        ['MSc Sustainable Energy Technology', 'master', 2, 'master-engineering'],
      ],
      'Computing': [
        ['MSc Computer Science', 'master', 2, 'master-computing'],
        ['MSc Embedded Systems', 'master', 2, 'master-computing'],
        ['MSc Data Science and Technology', 'master', 2, 'master-computing'],
      ],
      'Applied Sciences': [
        ['MSc Applied Mathematics', 'master', 2, 'master-science'],
        ['MSc Applied Physics', 'master', 2, 'master-science'],
        ['MSc Nanotechnology', 'master', 2, 'master-science'],
      ],
      'Business and Management': [
        ['MSc Business Administration', 'master', 1, 'master-business'],
        ['MSc Industrial Engineering and Management', 'master', 2, 'master-business'],
      ],
    },
  },
];

await writeAll(UNIS, {
  country: 'Netherlands',
  currency: 'EUR',
  primaryIntake: isoIntake(9, 1),
  secondaryIntake: isoIntake(2, 1),
  defaultIntakes: ['September', 'February'],
  scholarship: NAVITAS_BURSARY_EUR,
});
