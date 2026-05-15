// Navitas-DE seeder. Lancaster Leipzig + SRH International College.
import { writeAll, isoIntake, NAVITAS_BURSARY_EUR } from './lib/navitas-seeder.mjs';

const UNIS = [
  {
    slug: 'lancaster-leipzig',
    name: 'Lancaster University Leipzig',
    city: 'Leipzig',
    navitasUrl: 'https://www.lancasterleipzig.de/',
    officialUrl: 'https://www.lancaster.ac.uk/leipzig/',
    coursesUrl: 'https://www.lancasterleipzig.de/programmes/',
    ielts: 6.5,
    feeBand: {
      foundation: 14500,
      'utp-business': 16500,
      'utp-computing': 16500,
      'bachelor-business': 17800,
      'bachelor-computing': 17800,
      'bachelor-software-eng': 17800,
      'bachelor-marketing': 17800,
      'bachelor-economics': 17800,
      'master-business': 18500,
      'master-computing': 18500,
      'master-data': 18500,
    },
    paragraphs: [
      'Lancaster University Leipzig is the German campus of Lancaster University (UK), one of the top 10 universities in the United Kingdom (Complete University Guide 2024). The Leipzig campus, opened in 2020, delivers the same UK-validated Bachelor and Master degrees in English, in the heart of Leipzig — the fastest-growing city in eastern Germany.',
      "Students graduate with the same UK Lancaster degree certificate, transferable between Leipzig and the UK campus mid-degree. Foundation pathway (International Foundation Year) is delivered on-site through Navitas's Lancaster Leipzig pathway.",
    ],
    paragraphsRu: [
      'Lancaster University Leipzig — немецкий кампус Lancaster University (UK), одного из топ-10 университетов Великобритании (Complete University Guide 2024). Кампус в Лейпциге открыт в 2020. Те же UK-аккредитованные Bachelor и Master, но в Германии, в самом быстрорастущем городе восточной Германии. Преподавание на английском.',
      'Студенты получают тот же UK-диплом Lancaster, можно переводиться между Leipzig и UK-кампусом в процессе обучения. International Foundation Year проводится на месте через Navitas pathway.',
    ],
    keyFacts: [
      'Same Lancaster UK degree certificate',
      'Top 10 UK university (Complete University Guide 2024)',
      'Opened in 2020 in central Leipzig',
      'English-medium teaching',
      'Tuition ~50% lower than Lancaster UK campus',
    ],
    keyFactsRu: [
      'Диплом такой же, как у Lancaster UK',
      'Топ-10 университет Великобритании (Complete University Guide 2024)',
      'Открыт в 2020 в центре Лейпцига',
      'Преподавание на английском',
      'Стоимость ~50% ниже UK-кампуса Lancaster',
    ],
    accommodation: [
      { name: 'Lancaster Leipzig Student Residences', price: 'от €380/мес', text: 'Партнёрские студенческие резиденции в центре Лейпцига — комнаты с общей кухней, рядом с кампусом.' },
      { name: 'Private apartments (Leipzig WG)', price: 'от €350/мес', text: 'Аренда комнаты в WG (Wohngemeinschaft) — стандартный немецкий вариант. Поддержка с поиском от Lancaster Leipzig.' },
      { name: 'Homestay через Lancaster Leipzig', price: 'от €620/мес', text: 'Немецкая принимающая семья — питание и комната, отлично для адаптации.' },
    ],
    campuses: [
      { title: 'Leipzig Campus (Nikolaistraße)', sub: 'В центре Лейпцига', text: 'Современный учебный комплекс — аудитории, библиотека, computer labs, студенческие пространства.' },
    ],
    extraScholarships: [
      {
        name: 'Lancaster Leipzig Academic Excellence Award',
        nameRu: 'Lancaster Leipzig Academic Excellence Award',
        amount: 'до €5,000',
        description: 'Merit-based scholarship for outstanding international applicants.',
        descriptionRu: 'Стипендия за академические достижения для outstanding международных абитуриентов.',
        url: 'https://www.lancasterleipzig.de/scholarships/',
      },
    ],
    pathwayPrograms: {
      'International Foundation Year': [
        ['International Foundation Year — Business', 'foundation', 1, 'foundation'],
        ['International Foundation Year — Computing', 'foundation', 1, 'foundation'],
      ],
    },
    bachelorPrograms: {
      'Business and Management': [
        ['BSc (Hons) Business Administration', 'bachelor', 3, 'bachelor-business'],
        ['BSc (Hons) International Business Management', 'bachelor', 3, 'bachelor-business'],
        ['BSc (Hons) Marketing', 'bachelor', 3, 'bachelor-marketing'],
        ['BSc (Hons) Management with Entrepreneurship', 'bachelor', 3, 'bachelor-business'],
      ],
      'Economics and Finance': [
        ['BSc (Hons) Economics', 'bachelor', 3, 'bachelor-economics'],
        ['BSc (Hons) Accounting and Finance', 'bachelor', 3, 'bachelor-business'],
      ],
      'Computing and Software': [
        ['BSc (Hons) Computer Science', 'bachelor', 3, 'bachelor-computing'],
        ['BSc (Hons) Software Engineering', 'bachelor', 3, 'bachelor-software-eng'],
        ['BSc (Hons) Data Science', 'bachelor', 3, 'bachelor-computing'],
      ],
    },
    masterPrograms: {
      'Business and Management': [
        ['MSc Management', 'master', 1, 'master-business'],
        ['MSc International Business', 'master', 1, 'master-business'],
        ['MSc Marketing', 'master', 1, 'master-business'],
      ],
      'Computing and Data': [
        ['MSc Computer Science', 'master', 1, 'master-computing'],
        ['MSc Data Science', 'master', 1, 'master-data'],
      ],
    },
  },
  {
    slug: 'srh-germany',
    name: 'SRH International College',
    city: 'Berlin',
    navitasUrl: 'https://www.srh-international-college.de/',
    officialUrl: 'https://www.srh-hochschulen.de/',
    coursesUrl: 'https://www.srh-international-college.de/programmes/',
    ielts: 5.5,
    feeBand: {
      foundation: 11500,
      'utp-business': 12500,
      'utp-computing': 12800,
      'utp-design': 12200,
      'bachelor-business': 13500,
      'bachelor-computing': 14500,
      'bachelor-design': 13800,
      'bachelor-engineering': 14800,
      'bachelor-health': 14500,
      'bachelor-music': 13500,
      'master-business': 15500,
      'master-computing': 16500,
      'master-design': 15800,
    },
    paragraphs: [
      'SRH International College is the pathway provider for the SRH Hochschulen — a federation of private universities of applied sciences across Germany with campuses in Berlin, Heidelberg, and Munich. SRH degrees are state-accredited, English-medium, and follow the EU Bologna framework.',
      "Navitas operates the SRH International College pathway on each of the three campuses, with Foundation and Year-1 entry programs that lead into SRH Bachelor's degrees in business, computer science, design, engineering, music, and health. Tuition is significantly lower than UK/AU alternatives, and SRH actively places graduates in German employers.",
    ],
    paragraphsRu: [
      'SRH International College — pathway-провайдер сети SRH Hochschulen — частных университетов прикладных наук Германии. Кампусы в Берлине, Гейдельберге и Мюнхене. Дипломы SRH аккредитованы немецким государством, преподавание на английском, соответствуют EU Bologna framework.',
      'Navitas управляет SRH International College pathway на всех трёх кампусах. Foundation и Year-1 entry программы ведут в бакалавриат SRH: бизнес, computer science, дизайн, инженерия, музыка, health. Стоимость намного ниже UK/AU альтернатив, SRH активно помогает с трудоустройством в немецких компаниях.',
    ],
    keyFacts: [
      '3 campuses — Berlin, Heidelberg, Munich',
      'State-accredited German private university federation',
      'English-medium teaching',
      'Bologna framework (EU-wide credit recognition)',
      'Strong placement record with German employers',
    ],
    keyFactsRu: [
      '3 кампуса — Берлин, Гейдельберг, Мюнхен',
      'Аккредитованная немецким государством частная сеть вузов',
      'Преподавание на английском',
      'Bologna framework — кредиты признаются по всей EU',
      'Сильная статистика трудоустройства в немецких компаниях',
    ],
    accommodation: [
      { name: 'SRH Student Residences (Berlin/Heidelberg/Munich)', price: 'от €400/мес', text: 'Партнёрские студенческие резиденции на каждом кампусе SRH — комнаты с общей кухней.' },
      { name: 'Private apartments (WG)', price: 'от €350/мес', text: 'Аренда комнаты в WG (Wohngemeinschaft) — стандартный немецкий вариант. Поддержка с поиском от SRH.' },
      { name: 'Homestay через SRH', price: 'от €580/мес', text: 'Немецкая принимающая семья в Берлине / Гейдельберге / Мюнхене — питание и комната.' },
    ],
    campuses: [
      { title: 'SRH Berlin University of Applied Sciences', sub: 'Главный кампус — в Berlin-Mitte', text: 'Бизнес, IT, дизайн, music. Современный кампус в центре Берлина.' },
      { title: 'SRH University Heidelberg', sub: 'Кампус в Гейдельберге', text: 'Бизнес, инженерия, health sciences, applied psychology. Исторический университетский город.' },
      { title: 'SRH Berlin Munich Campus', sub: 'Кампус в Мюнхене', text: 'Бизнес, дизайн, communication, hospitality. В одном из самых дорогих, но и самых трудоустраиваемых городов Германии.' },
    ],
    extraScholarships: [
      {
        name: 'SRH Excellence Scholarship',
        nameRu: 'SRH Excellence Scholarship',
        amount: 'до €4,000',
        description: 'Merit-based scholarship for international applicants with strong academic records.',
        descriptionRu: 'Стипендия за академические достижения для международных студентов с сильным academic record.',
        url: 'https://www.srh-hochschulen.de/scholarships/',
      },
      {
        name: 'Deutschlandstipendium',
        nameRu: 'Deutschlandstipendium',
        amount: '€3,600/год',
        description: 'German federal merit scholarship — €300/month — eligible to SRH students.',
        descriptionRu: 'Федеральная немецкая стипендия — €300/мес — доступна студентам SRH.',
        url: 'https://www.deutschlandstipendium.de/',
      },
    ],
    pathwayPrograms: {
      'Foundation Studies': [
        ['Foundation Year — Business', 'foundation', 1, 'foundation'],
        ['Foundation Year — Computing & IT', 'foundation', 1, 'foundation'],
        ['Foundation Year — Design & Media', 'foundation', 1, 'foundation'],
      ],
      'Pre-Master Year 1 Entry': [
        ['Pre-Master Programme — Business', 'foundation', 0.5, 'utp-business'],
        ['Pre-Master Programme — Computer Science', 'foundation', 0.5, 'utp-computing'],
        ['Pre-Master Programme — Design', 'foundation', 0.5, 'utp-design'],
      ],
    },
    bachelorPrograms: {
      'Business and Management': [
        ['B.A. International Business Administration', 'bachelor', 3, 'bachelor-business'],
        ['B.A. Business Administration & Digital Innovation', 'bachelor', 3, 'bachelor-business'],
        ['B.A. International Hospitality Management', 'bachelor', 3, 'bachelor-business'],
        ['B.A. International Tourism Management', 'bachelor', 3, 'bachelor-business'],
        ['B.A. International Management', 'bachelor', 3, 'bachelor-business'],
      ],
      'Computer Science and IT': [
        ['B.Sc. Computer Science', 'bachelor', 3, 'bachelor-computing'],
        ['B.Sc. Software Engineering', 'bachelor', 3, 'bachelor-computing'],
        ['B.Sc. Big Data and Business Analytics', 'bachelor', 3, 'bachelor-computing'],
      ],
      'Design and Media': [
        ['B.A. Communication Design', 'bachelor', 3, 'bachelor-design'],
        ['B.A. Visual Communication', 'bachelor', 3, 'bachelor-design'],
        ['B.A. Film and Motion Design', 'bachelor', 3, 'bachelor-design'],
        ['B.A. Game Design', 'bachelor', 3, 'bachelor-design'],
      ],
      'Engineering': [
        ['B.Eng. Industrial Engineering', 'bachelor', 3.5, 'bachelor-engineering'],
        ['B.Eng. Mechatronics', 'bachelor', 3.5, 'bachelor-engineering'],
      ],
      'Health and Psychology': [
        ['B.Sc. Applied Psychology', 'bachelor', 3, 'bachelor-health'],
        ['B.Sc. Physiotherapy', 'bachelor', 3.5, 'bachelor-health'],
      ],
      'Music and Performing Arts': [
        ['B.A. Music', 'bachelor', 3, 'bachelor-music'],
        ['B.A. Modern Music', 'bachelor', 3, 'bachelor-music'],
      ],
    },
    masterPrograms: {
      'Business and Management': [
        ['M.A. International Management', 'master', 1.5, 'master-business'],
        ['M.A. International Business', 'master', 1.5, 'master-business'],
        ['MBA', 'master', 1.5, 'master-business'],
        ['M.A. International Hospitality Management', 'master', 1, 'master-business'],
      ],
      'Computer Science and Data': [
        ['M.Sc. Computer Science', 'master', 2, 'master-computing'],
        ['M.Sc. Big Data and Business Analytics', 'master', 2, 'master-computing'],
      ],
      'Design and Communication': [
        ['M.A. Communication Design', 'master', 2, 'master-design'],
        ['M.A. Visual & Experience Design', 'master', 2, 'master-design'],
      ],
    },
  },
];

await writeAll(UNIS, {
  country: 'Germany',
  currency: 'EUR',
  primaryIntake: isoIntake(10, 1),
  secondaryIntake: isoIntake(4, 1),
  defaultIntakes: ['October', 'April'],
  scholarship: NAVITAS_BURSARY_EUR,
});
