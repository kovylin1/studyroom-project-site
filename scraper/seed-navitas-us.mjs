// Navitas-US seeder. Queens College, CUNY (NYC).
import { writeAll, isoIntake, NAVITAS_BURSARY_USD } from './lib/navitas-seeder.mjs';

const UNIS = [
  {
    slug: 'queens-college-cuny',
    name: 'Queens College, CUNY',
    city: 'New York',
    navitasUrl: 'https://www.queensgssp.com/',
    officialUrl: 'https://www.qc.cuny.edu/',
    coursesUrl: 'https://www.queensgssp.com/programs/',
    ielts: 6.0,
    feeBand: {
      foundation: 19500,
      'gssp-business': 22500,
      'gssp-cs': 23500,
      'gssp-arts': 21500,
      'bachelor-business': 27500,
      'bachelor-cs': 29500,
      'bachelor-arts': 24500,
      'bachelor-science': 27500,
      'bachelor-music': 25500,
      'bachelor-education': 24500,
      'master-business': 28500,
      'master-cs': 30500,
      'master-arts': 26500,
      'master-music': 26500,
    },
    paragraphs: [
      'Queens College is one of the founding senior colleges of the City University of New York (CUNY) — a public research university in Flushing, Queens, New York City. Founded in 1937, Queens College is known for affordability (one of the lowest tuition rates in the New York metro area), the Aaron Copland School of Music, and a strong tradition in education, business, and the sciences.',
      "Navitas operates the Queens College Global Student Success Program (GSSP) — a 2-semester pathway program for international students who need an extra year of preparation before entering a Queens College Bachelor's degree as a second-year student. GSSP students get full Queens College student status — same campus, library, dining, residences.",
    ],
    paragraphsRu: [
      'Queens College — один из основных senior colleges City University of New York (CUNY) — государственного исследовательского университета в Flushing, Queens, Нью-Йорк. Основан в 1937. Известен доступной стоимостью (одни из самых низких ставок в Нью-Йорке), Aaron Copland School of Music и сильной школой образования, бизнеса и наук.',
      'Navitas управляет Queens College Global Student Success Program (GSSP) — 2-семестровой pathway программой для международных студентов, которым нужен дополнительный год подготовки перед поступлением на 2-й курс бакалавриата Queens College. GSSP-студенты получают полный статус Queens College — тот же кампус, библиотека, общепит, общежития.',
    ],
    keyFacts: [
      'Founding senior college of CUNY (1937)',
      'Located in Flushing, Queens, NYC',
      'Among the lowest tuition in NYC metro',
      'Over 16,000 students',
      'Aaron Copland School of Music',
    ],
    keyFactsRu: [
      'Один из основных senior colleges CUNY (1937)',
      'Flushing, Queens, NYC',
      'Одни из самых низких ставок в Нью-Йорке',
      'Более 16 000 студентов',
      'Aaron Copland School of Music',
    ],
    accommodation: [
      { name: 'The Summit (Queens College Residence)', price: 'от US$1,200/мес', text: 'On-campus residence — 506 студенческих квартир в новом 12-этажном здании на территории кампуса.' },
      { name: 'GSSP Partner Housing', price: 'от US$1,150/мес', text: 'Partnership с EHS (Educational Housing Services) — резиденции в Манхэттене и Куинсе.' },
      { name: 'Homestay через GSSP', price: 'от US$1,100/мес', text: 'Американская принимающая семья в Queens или Long Island — питание и комната.' },
    ],
    campuses: [
      { title: 'Queens College Main Campus (Flushing)', sub: '80 гектар, 11 км от Манхэттена', text: 'Зелёный suburban-кампус в Flushing, Queens — рядом с Long Island Expressway, метро 7 line до Манхэттена.' },
    ],
    extraScholarships: [
      {
        name: 'Queens College International Merit Scholarship',
        nameRu: 'Queens College International Merit Scholarship',
        amount: 'до US$5,000',
        description: 'Merit-based scholarship for outstanding GSSP students progressing to Queens College.',
        descriptionRu: 'Стипендия за академические достижения для outstanding GSSP-студентов, переходящих в Queens College.',
        url: 'https://www.queensgssp.com/scholarships/',
      },
      {
        name: 'CUNY Tuition Reduction Award',
        nameRu: 'CUNY Tuition Reduction Award',
        amount: 'до US$3,000',
        description: 'Need-based award for international students at CUNY senior colleges.',
        descriptionRu: 'Need-based награда для международных студентов CUNY senior colleges.',
        url: 'https://www.cuny.edu/financial-aid/',
      },
    ],
    pathwayPrograms: {
      'Global Student Success Program (GSSP)': [
        ['GSSP Business and Liberal Arts (2-semester pathway)', 'foundation', 1, 'foundation'],
        ['GSSP Computer Science (2-semester pathway)', 'foundation', 1, 'foundation'],
      ],
      'Year 1 Entry — Business': [
        ['Year 1 Entry — Business Administration', 'foundation', 1, 'gssp-business'],
        ['Year 1 Entry — Accounting', 'foundation', 1, 'gssp-business'],
      ],
      'Year 1 Entry — Computer Science': [
        ['Year 1 Entry — Computer Science', 'foundation', 1, 'gssp-cs'],
      ],
      'Year 1 Entry — Arts and Sciences': [
        ['Year 1 Entry — Liberal Arts', 'foundation', 1, 'gssp-arts'],
        ['Year 1 Entry — Psychology', 'foundation', 1, 'gssp-arts'],
      ],
    },
    bachelorPrograms: {
      'Business and Liberal Studies (BALS)': [
        ['Bachelor of Business Administration (BBA) — Accounting', 'bachelor', 4, 'bachelor-business'],
        ['Bachelor of Business Administration (BBA) — Finance', 'bachelor', 4, 'bachelor-business'],
        ['Bachelor of Business Administration (BBA) — Marketing', 'bachelor', 4, 'bachelor-business'],
        ['Bachelor of Business Administration (BBA) — International Business', 'bachelor', 4, 'bachelor-business'],
        ['Bachelor of Arts (Economics)', 'bachelor', 4, 'bachelor-business'],
      ],
      'Computer Science and Math': [
        ['Bachelor of Arts (Computer Science)', 'bachelor', 4, 'bachelor-cs'],
        ['Bachelor of Science (Computer Science)', 'bachelor', 4, 'bachelor-cs'],
        ['Bachelor of Arts (Mathematics)', 'bachelor', 4, 'bachelor-science'],
      ],
      'Sciences': [
        ['Bachelor of Arts (Biology)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Arts (Chemistry)', 'bachelor', 4, 'bachelor-science'],
        ['Bachelor of Arts (Psychology)', 'bachelor', 4, 'bachelor-science'],
      ],
      'Humanities and Arts': [
        ['Bachelor of Arts (English)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Sociology)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Political Science)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Arts (Media Studies)', 'bachelor', 4, 'bachelor-arts'],
        ['Bachelor of Fine Arts (Studio Art)', 'bachelor', 4, 'bachelor-arts'],
      ],
      'Aaron Copland School of Music': [
        ['Bachelor of Music (Performance)', 'bachelor', 4, 'bachelor-music'],
        ['Bachelor of Music (Composition)', 'bachelor', 4, 'bachelor-music'],
        ['Bachelor of Arts (Music)', 'bachelor', 4, 'bachelor-music'],
      ],
      'Education': [
        ['Bachelor of Arts (Early Childhood Education)', 'bachelor', 4, 'bachelor-education'],
        ['Bachelor of Arts (Secondary Education)', 'bachelor', 4, 'bachelor-education'],
      ],
    },
    masterPrograms: {
      'Business': [
        ['MBA', 'master', 2, 'master-business'],
        ['MS in Accounting', 'master', 1.5, 'master-business'],
      ],
      'Computer Science': [
        ['MA in Computer Science', 'master', 2, 'master-cs'],
        ['MA in Data Analytics and Applied Social Research', 'master', 2, 'master-cs'],
      ],
      'Humanities and Arts': [
        ['MA in English (Creative Writing)', 'master', 2, 'master-arts'],
        ['MA in Linguistics', 'master', 2, 'master-arts'],
      ],
      'Music': [
        ['MA in Music (Performance)', 'master', 2, 'master-music'],
      ],
    },
  },
];

await writeAll(UNIS, {
  country: 'United States',
  currency: 'USD',
  primaryIntake: isoIntake(9, 1),
  secondaryIntake: isoIntake(1, 25),
  defaultIntakes: ['September', 'January'],
  scholarship: NAVITAS_BURSARY_USD,
});
