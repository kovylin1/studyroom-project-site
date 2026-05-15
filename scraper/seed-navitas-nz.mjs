// Navitas-NZ seeder. University of Canterbury + University of Waikato.
import { writeAll, isoIntake, NAVITAS_BURSARY_NZD } from './lib/navitas-seeder.mjs';

const UNIS = [
  {
    slug: 'canterbury-nz',
    name: 'University of Canterbury',
    city: 'Christchurch',
    navitasUrl: 'https://www.ucic.ac.nz/',
    officialUrl: 'https://www.canterbury.ac.nz/',
    coursesUrl: 'https://www.ucic.ac.nz/programmes/',
    ielts: 6.0,
    feeBand: {
      foundation: 28500,
      'utp-business': 31500,
      'utp-engineering': 33500,
      'utp-science': 32500,
      'utp-arts': 30500,
      'bachelor-business': 35500,
      'bachelor-engineering': 42500,
      'bachelor-computing': 38500,
      'bachelor-science': 37500,
      'bachelor-arts': 33500,
      'bachelor-law': 36500,
      'bachelor-fine-arts': 36500,
      'master-business': 38500,
      'master-engineering': 45500,
      'master-arts': 35500,
      'master-science': 40500,
    },
    paragraphs: [
      "University of Canterbury (UC) is one of New Zealand's top universities, located in Christchurch on the South Island. Founded in 1873, it sits in the world's top 250 (QS World University Rankings 2024) and is part of the prestigious U21 international research network. UC is best known for engineering, forestry, business, and earthquake science.",
      "International students enter via UC International College (UCIC) — Navitas's pathway college on the UC Ilam campus. UTP Stage 1 and Stage 2 programs lead into the second year of a UC Bachelor's degree across Engineering, Business, Science, Arts, and Fine Arts.",
    ],
    paragraphsRu: [
      'University of Canterbury (UC) — один из лучших университетов Новой Зеландии, в Крайстчёрче на Южном острове. Основан в 1873. Топ-250 мира (QS World University Rankings 2024), участник престижной U21 research network. Известен инженерией, лесоводством, бизнесом и earthquake science.',
      'Международные студенты заходят через UC International College (UCIC) — pathway-колледж Navitas на кампусе UC Ilam. UTP Stage 1 и Stage 2 ведут на 2-й курс бакалавриата UC: Engineering, Business, Science, Arts, Fine Arts.',
    ],
    keyFacts: [
      'Top 250 universities worldwide (QS 2024)',
      'Member of U21 international research network',
      'Over 21,000 students',
      'Founded in 1873',
      'Strongest engineering school in NZ',
    ],
    keyFactsRu: [
      'Топ-250 университетов мира (QS 2024)',
      'Член U21 international research network',
      'Более 21 000 студентов',
      'Основан в 1873',
      'Сильнейшая инженерная школа Новой Зеландии',
    ],
    accommodation: [
      { name: 'UC Halls of Residence (Ilam campus)', price: 'от NZ$385/нед', text: 'On-campus residences — Sonoda, Rochester, Tupuānuku, Bishop Julius. Catered halls для первокурсников.' },
      { name: 'UCIC Studio Apartments', price: 'от NZ$340/нед', text: 'UCIC-managed студенческие квартиры — рядом с кампусом, для pathway-студентов.' },
      { name: 'Homestay через UCIC', price: 'от NZ$330/нед', text: 'Новозеландская принимающая семья в Крайстчёрче — питание и комната включены.' },
    ],
    campuses: [
      { title: 'Ilam Main Campus', sub: '5 км от центра Крайстчёрча', text: '76 гектар, ботанические сады, новейшие инженерные здания после землетрясения 2011. UCIC на этом же кампусе.' },
      { title: 'Erskine Building (Mathematics, Statistics, CS)', sub: 'На Ilam кампусе', text: 'Современный инженерный центр.' },
    ],
    extraScholarships: [
      {
        name: 'UC International First Year Scholarship',
        nameRu: 'UC International First Year Scholarship',
        amount: 'до NZ$20,000',
        description: 'Merit-based scholarship for outstanding international first-year applicants.',
        descriptionRu: 'Стипендия за академические достижения для outstanding международных первокурсников.',
        url: 'https://www.canterbury.ac.nz/study/scholarships/',
      },
      {
        name: 'UC International Excellence Scholarship',
        nameRu: 'UC International Excellence Scholarship',
        amount: 'до NZ$15,000',
        description: 'Awarded to international students with consistent academic excellence.',
        descriptionRu: 'Награждается международным студентам со стабильной академической успеваемостью.',
        url: 'https://www.canterbury.ac.nz/study/scholarships/',
      },
    ],
    pathwayPrograms: {
      'University Transfer Program (Stage 1)': [
        ['UTP Stage 1 — pathway to UC Year 2', 'foundation', 1, 'foundation'],
      ],
      'Business and Commerce': [
        ['UTP Stage 2 — Commerce', 'foundation', 0.67, 'utp-business'],
      ],
      'Engineering and Product Design': [
        ['UTP Stage 2 — Engineering', 'foundation', 0.67, 'utp-engineering'],
        ['UTP Stage 2 — Product Design', 'foundation', 0.67, 'utp-engineering'],
      ],
      'Science': [
        ['UTP Stage 2 — Science', 'foundation', 0.67, 'utp-science'],
      ],
      'Arts and Communication': [
        ['UTP Stage 2 — Arts', 'foundation', 0.67, 'utp-arts'],
      ],
    },
    bachelorPrograms: {
      'UC Business School': [
        ['Bachelor of Commerce (Accounting)', 'bachelor', 3, 'bachelor-business'],
        ['Bachelor of Commerce (Finance)', 'bachelor', 3, 'bachelor-business'],
        ['Bachelor of Commerce (Marketing)', 'bachelor', 3, 'bachelor-business'],
        ['Bachelor of Commerce (Information Systems)', 'bachelor', 3, 'bachelor-business'],
      ],
      'Engineering and Product Design': [
        ['Bachelor of Engineering with Honours (Civil)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering with Honours (Mechanical)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering with Honours (Electrical and Electronic)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering with Honours (Software)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering with Honours (Chemical and Process)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Product Design', 'bachelor', 3, 'bachelor-engineering'],
      ],
      'Computing': [
        ['Bachelor of Science (Computer Science)', 'bachelor', 3, 'bachelor-computing'],
        ['Bachelor of Science (Data Science)', 'bachelor', 3, 'bachelor-computing'],
      ],
      'Science': [
        ['Bachelor of Science (Biological Sciences)', 'bachelor', 3, 'bachelor-science'],
        ['Bachelor of Science (Mathematics)', 'bachelor', 3, 'bachelor-science'],
        ['Bachelor of Science (Physics)', 'bachelor', 3, 'bachelor-science'],
        ['Bachelor of Forestry Science', 'bachelor', 4, 'bachelor-science'],
      ],
      'Arts and Communication': [
        ['Bachelor of Arts (English)', 'bachelor', 3, 'bachelor-arts'],
        ['Bachelor of Arts (Linguistics)', 'bachelor', 3, 'bachelor-arts'],
        ['Bachelor of Arts (Political Science)', 'bachelor', 3, 'bachelor-arts'],
        ['Bachelor of Communication', 'bachelor', 3, 'bachelor-arts'],
      ],
      'Law': [
        ['Bachelor of Laws (LLB)', 'bachelor', 4, 'bachelor-law'],
      ],
      'Fine Arts': [
        ['Bachelor of Fine Arts', 'bachelor', 4, 'bachelor-fine-arts'],
      ],
    },
    masterPrograms: {
      'Business': [
        ['Master of Business Administration (MBA)', 'master', 1.5, 'master-business'],
        ['Master of Commerce', 'master', 2, 'master-business'],
        ['Master of Applied Finance and Economics', 'master', 1.5, 'master-business'],
      ],
      'Engineering': [
        ['Master of Engineering', 'master', 2, 'master-engineering'],
        ['Master of Engineering Management', 'master', 1.5, 'master-engineering'],
      ],
      'Science': [
        ['Master of Science (Computer Science)', 'master', 2, 'master-science'],
        ['Master of Disaster Risk and Resilience', 'master', 1, 'master-science'],
      ],
      'Arts': [
        ['Master of Linguistics', 'master', 2, 'master-arts'],
      ],
    },
  },
  {
    slug: 'waikato',
    name: 'University of Waikato',
    city: 'Hamilton',
    navitasUrl: 'https://pathways.waikato.ac.nz/',
    officialUrl: 'https://www.waikato.ac.nz/',
    coursesUrl: 'https://pathways.waikato.ac.nz/programmes/',
    ielts: 6.0,
    feeBand: {
      foundation: 26500,
      'utp-business': 29500,
      'utp-it': 30500,
      'utp-engineering': 32500,
      'utp-science': 30500,
      'bachelor-business': 33500,
      'bachelor-engineering': 41500,
      'bachelor-computing': 37500,
      'bachelor-science': 36500,
      'bachelor-arts': 32500,
      'bachelor-law': 35500,
      'bachelor-mgmt': 34500,
      'master-business': 36500,
      'master-engineering': 42500,
      'master-arts': 33500,
    },
    paragraphs: [
      "University of Waikato is a New Zealand public research university based in Hamilton, with a second campus in Tauranga (Bay of Plenty). Founded in 1964, Waikato is in the world's top 250 (QS 2024), top 1.5% globally, and the Waikato Management School holds the rare Triple Crown accreditation (AACSB + AMBA + EQUIS) — joining 1% of business schools worldwide.",
      "International students enter via University of Waikato College — Navitas's pathway college on the Waikato campus. Foundation Studies and Diploma programs lead into Waikato Bachelor's degrees across Management, Computing, Engineering, Science, Arts, Law, and Health.",
    ],
    paragraphsRu: [
      'University of Waikato — государственный исследовательский университет Новой Зеландии в Гамильтоне, второй кампус в Tauranga (Bay of Plenty). Основан в 1964. Топ-250 мира (QS 2024), топ-1.5% глобально. Waikato Management School имеет редкую Triple Crown аккредитацию (AACSB + AMBA + EQUIS) — входит в 1% бизнес-школ мира.',
      'Международные студенты заходят через University of Waikato College — pathway-колледж Navitas на кампусе Waikato. Foundation Studies и Diploma программы ведут в бакалавриат Waikato: Management, Computing, Engineering, Science, Arts, Law, Health.',
    ],
    keyFacts: [
      'Top 250 universities worldwide (QS 2024)',
      'Waikato Management School — Triple Crown accredited (AACSB + AMBA + EQUIS)',
      'Over 14,000 students',
      'Founded in 1964',
      'Hamilton + Tauranga (Bay of Plenty) campuses',
    ],
    keyFactsRu: [
      'Топ-250 университетов мира (QS 2024)',
      'Waikato Management School — Triple Crown accredited (AACSB + AMBA + EQUIS)',
      'Более 14 000 студентов',
      'Основан в 1964',
      'Гамильтон + Tauranga (Bay of Plenty) кампусы',
    ],
    accommodation: [
      { name: 'Waikato Halls of Residence (Bryant + Student Village)', price: 'от NZ$385/нед', text: 'On-campus residences — Bryant Hall, Student Village. Catered halls гарантированы первокурсникам.' },
      { name: 'Pathways Living Hostel', price: 'от NZ$330/нед', text: 'Hostel-style жильё для pathway-студентов.' },
      { name: 'Homestay через Waikato College', price: 'от NZ$330/нед', text: 'Новозеландская принимающая семья в Гамильтоне — питание и комната.' },
    ],
    campuses: [
      { title: 'Hamilton Main Campus', sub: '65 гектар на восточной окраине Гамильтона', text: 'Главный кампус, Waikato College, Triple Crown School of Management.' },
      { title: 'Tauranga Campus (Bay of Plenty)', sub: '120 км от Гамильтона', text: 'Маринная биология, бизнес, сестринское дело, образование. Прибрежный город.' },
    ],
    extraScholarships: [
      {
        name: 'University of Waikato International Excellence Scholarship',
        nameRu: 'Waikato International Excellence Scholarship',
        amount: 'до NZ$20,000',
        description: 'Merit-based scholarship for outstanding international students.',
        descriptionRu: 'Стипендия за академические достижения для outstanding международных студентов.',
        url: 'https://www.waikato.ac.nz/scholarships/',
      },
      {
        name: "Vice-Chancellor's International Excellence Scholarship",
        nameRu: "Vice-Chancellor's International Excellence Scholarship",
        amount: 'до NZ$10,000',
        description: 'For undergraduate international students with strong academic records.',
        descriptionRu: 'Для международных студентов бакалавриата с сильным academic record.',
        url: 'https://www.waikato.ac.nz/scholarships/',
      },
    ],
    pathwayPrograms: {
      'Foundation Studies': [
        ['Certificate of University Preparation (Foundation)', 'foundation', 1, 'foundation'],
      ],
      'Business and Management': [
        ['Diploma in Commerce', 'foundation', 0.67, 'utp-business'],
        ['Diploma in Hospitality and Tourism Management', 'foundation', 0.67, 'utp-business'],
      ],
      'Computing and IT': [
        ['Diploma in Computing', 'foundation', 0.67, 'utp-it'],
      ],
      'Engineering': [
        ['Diploma in Engineering', 'foundation', 0.67, 'utp-engineering'],
      ],
      'Science': [
        ['Diploma in Science', 'foundation', 0.67, 'utp-science'],
      ],
    },
    bachelorPrograms: {
      'Waikato Management School': [
        ['Bachelor of Management Studies with Honours', 'bachelor', 4, 'bachelor-mgmt'],
        ['Bachelor of Business', 'bachelor', 3, 'bachelor-business'],
        ['Bachelor of Tourism', 'bachelor', 3, 'bachelor-business'],
      ],
      'Engineering': [
        ['Bachelor of Engineering with Honours (Software)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering with Honours (Mechanical)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering with Honours (Electronic)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering with Honours (Civil)', 'bachelor', 4, 'bachelor-engineering'],
      ],
      'Computing and Mathematical Sciences': [
        ['Bachelor of Computing and Mathematical Sciences', 'bachelor', 3, 'bachelor-computing'],
        ['Bachelor of Cyber Security', 'bachelor', 3, 'bachelor-computing'],
      ],
      'Science': [
        ['Bachelor of Science (Biological Sciences)', 'bachelor', 3, 'bachelor-science'],
        ['Bachelor of Science (Earth Sciences)', 'bachelor', 3, 'bachelor-science'],
        ['Bachelor of Science (Environmental Sciences)', 'bachelor', 3, 'bachelor-science'],
      ],
      'Arts and Humanities': [
        ['Bachelor of Arts (Māori and Indigenous Studies)', 'bachelor', 3, 'bachelor-arts'],
        ['Bachelor of Arts (Psychology)', 'bachelor', 3, 'bachelor-arts'],
        ['Bachelor of Communication Studies', 'bachelor', 3, 'bachelor-arts'],
      ],
      'Law': [
        ['Bachelor of Laws (LLB)', 'bachelor', 4, 'bachelor-law'],
      ],
      'Health': [
        ['Bachelor of Nursing', 'bachelor', 3, 'bachelor-science'],
      ],
    },
    masterPrograms: {
      'Waikato Management School': [
        ['Master of Business and Management (MBM)', 'master', 1, 'master-business'],
        ['Master of Business Administration (MBA)', 'master', 1.5, 'master-business'],
        ['Master of International Business', 'master', 1.5, 'master-business'],
      ],
      'Engineering and Computing': [
        ['Master of Cyber Security', 'master', 1, 'master-engineering'],
        ['Master of Engineering', 'master', 2, 'master-engineering'],
      ],
      'Arts and Humanities': [
        ['Master of Arts (Māori and Indigenous Studies)', 'master', 1.5, 'master-arts'],
      ],
    },
  },
];

await writeAll(UNIS, {
  country: 'New Zealand',
  currency: 'NZD',
  primaryIntake: isoIntake(2, 15),
  secondaryIntake: isoIntake(7, 1),
  defaultIntakes: ['February', 'July'],
  scholarship: NAVITAS_BURSARY_NZD,
});
