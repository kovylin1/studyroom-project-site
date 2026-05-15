// Navitas offshore AU-accredited campuses: Curtin Singapore + ECU Sri Lanka + Murdoch Dubai + DLI Indonesia.
import { writeAll, isoIntake, NAVITAS_BURSARY_AUD } from './lib/navitas-seeder.mjs';

const SG_UNIS = [
  {
    slug: 'curtin-singapore',
    name: 'Curtin Singapore',
    city: 'Singapore',
    navitasUrl: 'http://curtin.edu.sg/',
    officialUrl: 'https://curtin.edu.sg/',
    coursesUrl: 'https://curtin.edu.sg/programmes/',
    ielts: 6.0,
    feeBand: {
      foundation: 22500,
      'utp-business': 25500,
      'utp-it': 26500,
      'bachelor-business': 28500,
      'bachelor-marketing': 28500,
      'bachelor-it': 31500,
      'bachelor-engineering': 33500,
      'bachelor-arts': 26500,
      'master-business': 32500,
      'master-it': 35500,
    },
    paragraphs: [
      "Curtin Singapore is the Singapore campus of Curtin University (Perth) — the same TEQSA-registered Australian university delivering the identical Bachelor and Master degrees in Singapore, in English. Curtin Singapore is fully accredited by both TEQSA (Australia) and the Committee for Private Education (Singapore).",
      "International students graduate with the same Curtin Australia degree certificate, recognised globally. Foundation pathway and Diploma programs are delivered on-site through the Navitas-operated Curtin Singapore pathway college. The campus is at 10 Science Park Road, Singapore Science Park II.",
    ],
    paragraphsRu: [
      'Curtin Singapore — сингапурский кампус Curtin University (Перт). Те же TEQSA-аккредитованные австралийские дипломы, преподавание на английском в Сингапуре. Аккредитация: TEQSA (Австралия) + Committee for Private Education (Сингапур).',
      'Международные студенты получают тот же диплом Curtin Australia, признанный глобально. Foundation pathway и Diploma программы — на месте через Navitas Curtin Singapore pathway. Кампус: 10 Science Park Road, Singapore Science Park II.',
    ],
    keyFacts: [
      'Same Curtin Australia degree certificate',
      'TEQSA + Singapore CPE accreditation',
      'Located in Singapore Science Park II',
      'Over 5,000 students',
      'English-medium teaching',
    ],
    keyFactsRu: [
      'Диплом Curtin Australia',
      'Аккредитация TEQSA + Singapore CPE',
      'Singapore Science Park II',
      'Более 5 000 студентов',
      'Преподавание на английском',
    ],
    accommodation: [
      { name: 'Curtin Singapore Partner Residences', price: 'от AU$650/мес', text: 'Партнёрские студенческие резиденции в Сингапуре — комнаты с общей кухней, рядом с кампусом.' },
      { name: 'Private apartments (HDB)', price: 'от AU$700/мес', text: 'Аренда комнаты в HDB или частной квартире — поддержка с поиском от Curtin Singapore.' },
    ],
    campuses: [
      { title: 'Curtin Singapore Campus', sub: '10 Science Park Road, Singapore Science Park II', text: 'Современный кампус в Singapore Science Park. Аудитории, библиотека, computer labs.' },
    ],
    extraScholarships: [
      {
        name: 'Curtin Singapore Merit Scholarship',
        nameRu: 'Curtin Singapore Merit Scholarship',
        amount: 'до AU$3,000',
        description: 'Merit-based scholarship for outstanding international applicants.',
        descriptionRu: 'Стипендия за академические достижения для outstanding международных абитуриентов.',
        url: 'https://curtin.edu.sg/scholarships/',
      },
    ],
    pathwayPrograms: {
      'Foundation Studies': [
        ['Foundation Studies (UniReady)', 'foundation', 1, 'foundation'],
      ],
      'Business and Commerce': [
        ['Diploma of Commerce', 'foundation', 0.67, 'utp-business'],
        ['Diploma of Marketing', 'foundation', 0.67, 'utp-business'],
      ],
      'Computing and IT': [
        ['Diploma of Information Technology', 'foundation', 0.67, 'utp-it'],
      ],
    },
    bachelorPrograms: {
      'Curtin Business School': [
        ['Bachelor of Commerce (Accounting)', 'bachelor', 3, 'bachelor-business'],
        ['Bachelor of Commerce (Finance)', 'bachelor', 3, 'bachelor-business'],
        ['Bachelor of Commerce (Marketing)', 'bachelor', 3, 'bachelor-marketing'],
        ['Bachelor of Commerce (Management)', 'bachelor', 3, 'bachelor-business'],
        ['Bachelor of Commerce (International Business)', 'bachelor', 3, 'bachelor-business'],
      ],
      'Computing and IT': [
        ['Bachelor of Technology (Computer Systems and Networking)', 'bachelor', 3, 'bachelor-it'],
        ['Bachelor of Technology (Software Engineering)', 'bachelor', 3, 'bachelor-it'],
        ['Bachelor of Computing', 'bachelor', 3, 'bachelor-it'],
      ],
      'Engineering': [
        ['Bachelor of Engineering (Honours) (Electrical Power)', 'bachelor', 4, 'bachelor-engineering'],
        ['Bachelor of Engineering (Honours) (Mechanical)', 'bachelor', 4, 'bachelor-engineering'],
      ],
      'Arts and Communication': [
        ['Bachelor of Arts (Mass Communication)', 'bachelor', 3, 'bachelor-arts'],
        ['Bachelor of Arts (Public Relations)', 'bachelor', 3, 'bachelor-arts'],
      ],
    },
    masterPrograms: {
      'Curtin Business School': [
        ['Master of Commerce (Applied Finance)', 'master', 1.5, 'master-business'],
        ['Master of International Business', 'master', 1.5, 'master-business'],
        ['Master of Business Administration', 'master', 2, 'master-business'],
      ],
      'Computing': [
        ['Master of Science (Information Technology)', 'master', 1.5, 'master-it'],
      ],
    },
  },
];

const LK_UNIS = [
  {
    slug: 'edith-cowan-sl',
    name: 'Edith Cowan University Sri Lanka',
    city: 'Colombo',
    navitasUrl: 'https://www.ecu.edu.lk/',
    officialUrl: 'https://www.ecu.edu.au/',
    coursesUrl: 'https://www.ecu.edu.lk/courses/',
    ielts: 6.0,
    feeBand: {
      foundation: 8500,
      'utp-business': 9500,
      'utp-it': 10500,
      'bachelor-business': 11500,
      'bachelor-it': 13500,
      'bachelor-comm': 11500,
      'bachelor-engineering': 14500,
      'master-business': 14500,
      'master-it': 16500,
    },
    paragraphs: [
      'Edith Cowan University Sri Lanka (ECU Sri Lanka) is the Colombo campus of Edith Cowan University (Perth) — delivering the same TEQSA-accredited Australian degree, in English, on Sri Lankan soil. Students graduate with the identical ECU Perth degree certificate, but at significantly lower cost than studying in Australia directly.',
      "Foundation, Diploma and Bachelor's programs are offered on the Colombo campus. The pathway is operated through Navitas, with seamless progression from ECU Sri Lanka into a direct-entry second year of an ECU Australia degree if students choose to continue their studies in Perth.",
    ],
    paragraphsRu: [
      'Edith Cowan University Sri Lanka (ECU Sri Lanka) — кампус Edith Cowan University (Перт, Австралия) в Коломбо. Тот же TEQSA-аккредитованный австралийский диплом, преподавание на английском, но в Шри-Ланке. Студенты получают тот же ECU Perth диплом, но по значительно более низкой стоимости.',
      'Foundation, Diploma и Bachelor программы на кампусе в Коломбо. Pathway управляется Navitas. Возможен трансфер в Перт после Diploma для продолжения бакалавриата прямо на 2-м курсе ECU Australia.',
    ],
    keyFacts: [
      'Same ECU Australia degree certificate',
      'TEQSA + UGC Sri Lanka accreditation',
      'Located in Colombo (Bambalapitiya)',
      'Tuition ~60% lower than ECU Perth',
      'Optional transfer to ECU Perth mid-degree',
    ],
    keyFactsRu: [
      'Диплом ECU Australia',
      'Аккредитация TEQSA + UGC Sri Lanka',
      'Кампус в Коломбо (Bambalapitiya)',
      'Стоимость ~60% ниже ECU Perth',
      'Возможен трансфер в Перт в процессе обучения',
    ],
    accommodation: [
      { name: 'ECU Sri Lanka Partner Residences (Colombo)', price: 'от AU$280/мес', text: 'Партнёрские студенческие резиденции в Bambalapitiya, рядом с кампусом.' },
      { name: 'Private apartments (Colombo)', price: 'от AU$250/мес', text: 'Аренда квартиры или комнаты в Коломбо — поддержка с поиском от ECU SL.' },
    ],
    campuses: [
      { title: 'Colombo Campus (Bambalapitiya)', sub: 'Центр Коломбо', text: 'Современный кампус ECU Sri Lanka — аудитории, библиотека, computer labs.' },
    ],
    extraScholarships: [
      {
        name: 'ECU Sri Lanka Academic Excellence Scholarship',
        nameRu: 'ECU Sri Lanka Academic Excellence Scholarship',
        amount: 'до AU$2,500',
        description: 'Merit-based scholarship for high-achieving international applicants.',
        descriptionRu: 'Стипендия за академические достижения для outstanding международных абитуриентов.',
        url: 'https://www.ecu.edu.lk/scholarships/',
      },
    ],
    pathwayPrograms: {
      'Foundation Studies': [
        ['Foundation Programme — Business', 'foundation', 1, 'foundation'],
        ['Foundation Programme — IT', 'foundation', 1, 'foundation'],
      ],
      'Diploma Programs': [
        ['Diploma of Commerce', 'foundation', 1, 'utp-business'],
        ['Diploma of Information Technology', 'foundation', 1, 'utp-it'],
      ],
    },
    bachelorPrograms: {
      'Business': [
        ['Bachelor of Commerce (Accounting)', 'bachelor', 3, 'bachelor-business'],
        ['Bachelor of Commerce (Finance)', 'bachelor', 3, 'bachelor-business'],
        ['Bachelor of Commerce (Management)', 'bachelor', 3, 'bachelor-business'],
        ['Bachelor of Commerce (Marketing)', 'bachelor', 3, 'bachelor-business'],
      ],
      'Computing and IT': [
        ['Bachelor of Science (Computer Science)', 'bachelor', 3, 'bachelor-it'],
        ['Bachelor of Science (Cyber Security)', 'bachelor', 3, 'bachelor-it'],
      ],
      'Communications': [
        ['Bachelor of Communications', 'bachelor', 3, 'bachelor-comm'],
      ],
      'Engineering': [
        ['Bachelor of Engineering (Electrical)', 'bachelor', 4, 'bachelor-engineering'],
      ],
    },
    masterPrograms: {
      'Business': [
        ['Master of Business Administration', 'master', 1.5, 'master-business'],
        ['Master of Professional Accounting', 'master', 1.5, 'master-business'],
      ],
    },
  },
];

const AE_UNIS = [
  {
    slug: 'murdoch-dubai',
    name: 'Murdoch University Dubai',
    city: 'Dubai',
    navitasUrl: 'https://www.murdochuniversitydubai.com/',
    officialUrl: 'https://www.murdoch.edu.au/',
    coursesUrl: 'https://www.murdochuniversitydubai.com/courses/',
    ielts: 6.0,
    feeBand: {
      foundation: 12500,
      'utp-business': 14500,
      'utp-it': 15500,
      'bachelor-business': 16500,
      'bachelor-marketing': 16500,
      'bachelor-it': 18500,
      'bachelor-arts': 14500,
      'bachelor-media': 16500,
      'master-business': 19500,
      'master-it': 21500,
    },
    paragraphs: [
      'Murdoch University Dubai is the UAE campus of Murdoch University (Perth) — operating in Dubai International Academic City (DIAC) since 2008. Students graduate with the same TEQSA-accredited Murdoch Australia degree, recognised worldwide and in the UAE Knowledge and Human Development Authority (KHDA) register.',
      'Foundation, Diploma, Bachelor and Master programs are delivered on-site in Dubai through the Navitas-operated Murdoch Dubai campus. Strong in IT, business, communications, and media production. Tuition is significantly lower than studying in Perth.',
    ],
    paragraphsRu: [
      'Murdoch University Dubai — кампус Murdoch University (Перт) в ОАЭ, в Dubai International Academic City (DIAC) с 2008. Студенты получают тот же TEQSA-аккредитованный диплом Murdoch Australia, признанный в мире и зарегистрированный в UAE Knowledge and Human Development Authority (KHDA).',
      'Foundation, Diploma, Bachelor и Master программы на кампусе в Дубае через Navitas. Сильные программы: IT, бизнес, коммуникации, медиа-производство. Стоимость намного ниже, чем в Перте.',
    ],
    keyFacts: [
      'Same Murdoch Australia degree certificate',
      'TEQSA + UAE KHDA accreditation',
      'Located in Dubai International Academic City',
      'Operating since 2008',
      'Tuition ~50% lower than Murdoch Perth',
    ],
    keyFactsRu: [
      'Диплом Murdoch Australia',
      'Аккредитация TEQSA + UAE KHDA',
      'В Dubai International Academic City',
      'Работает с 2008',
      'Стоимость ~50% ниже Murdoch Perth',
    ],
    accommodation: [
      { name: 'Murdoch Dubai Partner Residences', price: 'от AU$520/мес', text: 'Партнёрские студенческие резиденции в Dubai International Academic City.' },
      { name: 'Private apartments (DIAC + Dubai Silicon Oasis)', price: 'от AU$580/мес', text: 'Аренда квартиры или комнаты — поддержка с поиском от Murdoch Dubai.' },
    ],
    campuses: [
      { title: 'Dubai International Academic City Campus', sub: 'DIAC, Дубай', text: 'Современный кампус Murdoch Dubai в Dubai International Academic City — крупнейшем образовательном кластере UAE.' },
    ],
    extraScholarships: [
      {
        name: 'Murdoch Dubai Academic Achievement Scholarship',
        nameRu: 'Murdoch Dubai Academic Achievement Scholarship',
        amount: 'до AU$3,500',
        description: 'Merit-based scholarship for international applicants.',
        descriptionRu: 'Стипендия за академические достижения для outstanding международных абитуриентов.',
        url: 'https://www.murdochuniversitydubai.com/scholarships/',
      },
    ],
    pathwayPrograms: {
      'Foundation Studies': [
        ['Foundation — pathway to Murdoch Dubai Year 1', 'foundation', 1, 'foundation'],
      ],
      'Diploma Programs': [
        ['Diploma of Business', 'foundation', 1, 'utp-business'],
        ['Diploma of Information Technology', 'foundation', 1, 'utp-it'],
      ],
    },
    bachelorPrograms: {
      'Business': [
        ['Bachelor of Business (Management)', 'bachelor', 3, 'bachelor-business'],
        ['Bachelor of Business (Marketing)', 'bachelor', 3, 'bachelor-marketing'],
        ['Bachelor of Business (International Business)', 'bachelor', 3, 'bachelor-business'],
        ['Bachelor of Business (Finance)', 'bachelor', 3, 'bachelor-business'],
        ['Bachelor of Business (Accounting)', 'bachelor', 3, 'bachelor-business'],
      ],
      'Information Technology': [
        ['Bachelor of Information Technology (Cyber Security)', 'bachelor', 3, 'bachelor-it'],
        ['Bachelor of Information Technology (Internetworking & Cyber Forensics)', 'bachelor', 3, 'bachelor-it'],
        ['Bachelor of Information Technology (Mobile and Web Application Development)', 'bachelor', 3, 'bachelor-it'],
      ],
      'Communication and Media': [
        ['Bachelor of Communication (Strategic Communication)', 'bachelor', 3, 'bachelor-media'],
        ['Bachelor of Communication (Journalism)', 'bachelor', 3, 'bachelor-media'],
      ],
      'Arts': [
        ['Bachelor of Arts (Media Studies)', 'bachelor', 3, 'bachelor-arts'],
      ],
    },
    masterPrograms: {
      'Business': [
        ['Master of Business Administration', 'master', 1.5, 'master-business'],
        ['Master of International Business', 'master', 1.5, 'master-business'],
        ['Master of Human Resource Management', 'master', 1.5, 'master-business'],
      ],
      'Information Technology': [
        ['Master of Information Technology (Cyber Security)', 'master', 1.5, 'master-it'],
      ],
    },
  },
];

const ID_UNIS = [
  {
    slug: 'dli-bandung',
    name: 'Deakin Lancaster Indonesia',
    city: 'Bandung',
    navitasUrl: 'https://www.dli.ac.id/',
    officialUrl: 'https://www.dli.ac.id/',
    coursesUrl: 'https://www.dli.ac.id/programmes/',
    ielts: 6.0,
    feeBand: {
      foundation: 9500,
      'utp-business': 11500,
      'utp-it': 11500,
      'bachelor-business': 13500,
      'bachelor-it': 14500,
      'bachelor-engineering': 15500,
      'master-business': 16500,
    },
    paragraphs: [
      'Deakin Lancaster Indonesia (DLI) is a joint-venture campus in Bandung, Indonesia, established by Deakin University (Australia) + Lancaster University (UK) in 2021. Students complete a dual-accredited Bachelor degree — recognised by TEQSA (Australia), Office for Students (UK), and Indonesian Ministry of Education. Teaching is in English.',
      "DLI graduates receive a Deakin Australia AND Lancaster UK degree certificate (dual qualification), without leaving Indonesia. Tuition is significantly lower than studying in Melbourne or Lancaster directly. The Navitas pathway provides Foundation and Diploma routes onto the Bachelor's degree.",
    ],
    paragraphsRu: [
      'Deakin Lancaster Indonesia (DLI) — совместный кампус в Бандунге, основан Deakin University (Австралия) + Lancaster University (UK) в 2021. Студенты получают dual-аккредитованный диплом — признан TEQSA (Австралия), Office for Students (UK) и Министерством образования Индонезии. Преподавание на английском.',
      'Выпускники DLI получают ДВА диплома — Deakin Australia + Lancaster UK — без выезда из Индонезии. Стоимость значительно ниже, чем учиться в Мельбурне или Ланкастере напрямую. Pathway Navitas даёт Foundation и Diploma маршруты в бакалавриат.',
    ],
    keyFacts: [
      'Dual degree — Deakin Australia + Lancaster UK',
      'TEQSA + UK Office for Students + Indonesian Min. of Education accreditation',
      'Established 2021',
      'Campus in Bandung, West Java',
      'Tuition ~70% lower than home campuses',
    ],
    keyFactsRu: [
      'Двойной диплом — Deakin Australia + Lancaster UK',
      'Аккредитация TEQSA + UK Office for Students + Минобр Индонезии',
      'Открыт в 2021',
      'Кампус в Бандунге, Западная Ява',
      'Стоимость ~70% ниже home-кампусов',
    ],
    accommodation: [
      { name: 'DLI Bandung Partner Residences', price: 'от AU$220/мес', text: 'Партнёрские студенческие резиденции в Бандунге, рядом с кампусом.' },
      { name: 'Private apartments (Bandung)', price: 'от AU$200/мес', text: 'Аренда квартиры или комнаты — поддержка с поиском от DLI.' },
    ],
    campuses: [
      { title: 'Bandung Main Campus', sub: 'Бандунг, Западная Ява', text: 'Современный кампус Deakin Lancaster Indonesia — аудитории, библиотека, лабы.' },
    ],
    pathwayPrograms: {
      'Foundation Studies': [
        ['Foundation Programme (UK + AU pathway)', 'foundation', 1, 'foundation'],
      ],
      'Diploma Programs': [
        ['Diploma of Business', 'foundation', 1, 'utp-business'],
        ['Diploma of Information Technology', 'foundation', 1, 'utp-it'],
      ],
    },
    bachelorPrograms: {
      'Business and Management': [
        ['BSc (Hons) International Business — Deakin + Lancaster dual', 'bachelor', 3, 'bachelor-business'],
        ['BSc (Hons) Management — Deakin + Lancaster dual', 'bachelor', 3, 'bachelor-business'],
        ['BSc (Hons) Accounting and Finance — dual', 'bachelor', 3, 'bachelor-business'],
      ],
      'Computing and IT': [
        ['BSc (Hons) Computer Science — Deakin + Lancaster dual', 'bachelor', 3, 'bachelor-it'],
        ['BSc (Hons) Data Science — dual', 'bachelor', 3, 'bachelor-it'],
      ],
      'Engineering': [
        ['BEng (Hons) Mechatronic Engineering — dual', 'bachelor', 4, 'bachelor-engineering'],
      ],
    },
    masterPrograms: {
      'Business': [
        ['Master of Business Administration', 'master', 1.5, 'master-business'],
      ],
    },
  },
];

// Run each country separately (different intakes / source profiles per region).
await writeAll(SG_UNIS, {
  country: 'Singapore',
  currency: 'AUD',
  primaryIntake: isoIntake(2, 15),
  secondaryIntake: isoIntake(7, 1),
  defaultIntakes: ['February', 'July'],
  scholarship: NAVITAS_BURSARY_AUD,
});

await writeAll(LK_UNIS, {
  country: 'Sri Lanka',
  currency: 'AUD',
  primaryIntake: isoIntake(2, 15),
  secondaryIntake: isoIntake(7, 1),
  defaultIntakes: ['February', 'July'],
  scholarship: NAVITAS_BURSARY_AUD,
});

await writeAll(AE_UNIS, {
  country: 'United Arab Emirates',
  currency: 'AUD',
  primaryIntake: isoIntake(9, 1),
  secondaryIntake: isoIntake(1, 15),
  defaultIntakes: ['September', 'January'],
  scholarship: NAVITAS_BURSARY_AUD,
});

await writeAll(ID_UNIS, {
  country: 'Indonesia',
  currency: 'AUD',
  primaryIntake: isoIntake(2, 15),
  secondaryIntake: isoIntake(7, 1),
  defaultIntakes: ['February', 'July'],
  scholarship: NAVITAS_BURSARY_AUD,
});
