// Oxford seeder. The real University of Oxford (Russell Group flagship).
// Direct admission only — no Navitas/Kaplan pathway. Confidence overridden to 'partner'.

import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildUniversity, CONTENT_DIR, isoIntake } from './lib/navitas-seeder.mjs';

const OXFORD = {
  slug: 'oxford',
  name: 'University of Oxford',
  city: 'Oxford',
  navitasUrl: 'https://www.ox.ac.uk/',
  officialUrl: 'https://www.ox.ac.uk/',
  coursesUrl: 'https://www.ox.ac.uk/admissions/undergraduate/courses-listing',
  ielts: 7.0,
  feeBand: {
    foundation: 28500,
    'bachelor-arts': 33510,
    'bachelor-humanities': 33510,
    'bachelor-social': 33510,
    'bachelor-law': 39010,
    'bachelor-economics': 41680,
    'bachelor-business': 41680,
    'bachelor-math': 41680,
    'bachelor-cs': 48620,
    'bachelor-sciences': 41680,
    'bachelor-engineering': 48620,
    'bachelor-medicine': 49770,
    'bachelor-medicine-clinical': 55530,
    'bachelor-veterinary': 49770,
    'master-arts': 27840,
    'master-humanities': 29170,
    'master-social': 29170,
    'master-law': 34340,
    'master-mba': 81250,
    'master-business': 50790,
    'master-cs': 36900,
    'master-engineering': 36900,
    'master-sciences': 34340,
    'master-medicine': 41540,
    'master-public-policy': 50790,
    'phd-arts': 27840,
    'phd-sciences': 36900,
  },
  paragraphs: [
    "The University of Oxford is the oldest university in the English-speaking world (founded c. 1096), and consistently ranked #1 in the world (Times Higher Education World University Rankings, 6 years running through 2024). Oxford is a collegiate university — students belong to one of 39 constituent colleges and 6 Permanent Private Halls that house, dine, and tutor them. Tutorials (one-to-one teaching) are Oxford's defining academic format, found nowhere else at this scale.",
    "International applicants apply through UCAS (undergraduate) or direct (graduate) — typically requiring IELTS 7.0+ overall (7.5 for arts and humanities), strong A-level / IB / equivalent grades (typically AAA / 38-40 IB / NIS attestat with state exam scores above 90%), an admissions test (TSA, MAT, LNAT, BMAT or equivalent depending on course), and an interview in December. Oxford does NOT use a Navitas/Kaplan-style pathway college — Foundation-route entry exists only for UK-based widening-participation students. International students enter directly into Year 1 from age 17-19.",
  ],
  paragraphsRu: [
    'Оксфордский университет — самый старый университет англоязычного мира (основан около 1096 г.), на протяжении 6 лет подряд (до 2024 включительно) занимает первое место в мире по версии Times Higher Education World University Rankings. Оксфорд — collegiate university: каждый студент принадлежит к одной из 39 коллегий или 6 Permanent Private Halls, которые обеспечивают проживание, питание и тьюториалы. Тьюториалы (индивидуальные занятия один-на-один с преподавателем) — фирменный академический формат Оксфорда, нигде в мире не реализованный в таком масштабе.',
    'Иностранные абитуриенты подают заявку через UCAS (бакалавриат) или напрямую (магистратура и PhD). Стандартные требования: IELTS 7.0+ overall (7.5 для гуманитарных направлений), сильные баллы A-level / IB / эквивалент (обычно AAA / 38-40 IB / НИШ-аттестат с топовыми баллами по госэкзамену), вступительный экзамен (TSA, MAT, LNAT, BMAT или другой в зависимости от программы) и interview в декабре. Оксфорд НЕ работает через pathway-колледжи типа Navitas или Kaplan — Foundation Year существует только для британских студентов из программы widening participation. Международные студенты поступают напрямую на 1-й курс в возрасте 17-19 лет.',
  ],
  keyFacts: [
    '#1 in the world (Times Higher Education 2024) — 6 years running',
    'Oldest university in the English-speaking world (founded c. 1096)',
    'Over 25,000 students (12,510 undergrad + 12,200 grad)',
    '39 colleges + 6 Permanent Private Halls (collegiate system)',
    'Direct admission only — no Navitas/Kaplan pathway available',
  ],
  keyFactsRu: [
    '№1 в мире (Times Higher Education 2024) — 6 лет подряд',
    'Самый старый университет англоязычного мира (основан около 1096 г.)',
    'Более 25 000 студентов (12 510 бакалавриат + 12 200 магистратура/PhD)',
    '39 коллегий + 6 Permanent Private Halls (collegiate system)',
    'Только прямой приём — pathway-колледжи Navitas/Kaplan недоступны',
  ],
  accommodation: [
    {
      name: 'College accommodation (39 колледжей — Christ Church, Magdalen, New College, Balliol, Merton, Trinity, Worcester, St Catherine\'s, Lady Margaret Hall и др.)',
      price: 'от £180/нед',
      text: 'Каждый студент гарантированно получает комнату в своей коллегии минимум на первый год (большинство коллегий — на все 3 года бакалавриата). En-suite или shared, традиционные quad-постройки XV-XX вв.',
    },
    {
      name: 'Oxford University Graduate Accommodation Office',
      price: 'от £550/мес',
      text: 'Аспирантское жильё для PhD/MPhil/MSc студентов — управляется университетом. Студии и shared flats в центре Оксфорда и Headington.',
    },
    {
      name: 'Castle Mill / Iffley Road / Lincoln House (университетские резиденции для grads)',
      price: 'от £180/нед',
      text: 'University-managed graduate housing — современные комплексы для магистров и докторантов рядом с центром.',
    },
    {
      name: 'Private rental — Cowley Road / East Oxford / Headington / Jericho',
      price: 'от £700/мес',
      text: 'Аренда комнаты или квартиры в Оксфорде для финалистов и аспирантов; часто берут на 2-3-й год бакалавриата при отсутствии college accommodation.',
    },
    {
      name: 'Homestay через OISC и аккредитованных провайдеров',
      price: 'от £180/нед',
      text: 'Английская принимающая семья — питание включено. Подходит для подготовки к interview в декабре и в межсеместриях.',
    },
    {
      name: 'Saïd Business School Egrove Park (для MBA)',
      price: 'от £900/мес',
      text: 'Резиденция Saïd Business School для участников MBA-программы — современные квартиры в Кеннингтоне.',
    },
  ],
  campuses: [
    {
      title: 'Central Oxford — Bodleian Library и University Sciences Area',
      sub: 'Broad Street, South Parks Road',
      text: 'Главный академический precinct: Bodleian Library (одна из старейших библиотек Европы), Radcliffe Camera, Sheldonian Theatre, факультеты Humanities и Social Sciences, Math Institute, Department of Statistics.',
    },
    {
      title: '39 коллегий — Christ Church, Magdalen, New College, Balliol, Merton, Trinity, Worcester, St Catherine\'s, Lady Margaret Hall, Pembroke и др.',
      sub: 'Разбросаны по центральному Оксфорду',
      text: 'Collegiate system: каждый студент принадлежит к одной коллегии, которая обеспечивает жильё, dining hall, тьюториалы, библиотеку и общественную жизнь. Преподавание (lectures) — на университетском уровне, тьюториалы — на уровне коллегии.',
    },
    {
      title: 'Saïd Business School',
      sub: 'Park End Street, рядом с Oxford station',
      text: 'Бизнес-школа для MBA, Executive MBA, MSc Financial Economics, MSc Major Programme Management. Современный корпус 2001 года + Egrove Park executive education centre.',
    },
    {
      title: 'Headington Medical Campus + John Radcliffe Hospital',
      sub: 'Headington, восточный Оксфорд',
      text: 'Клинический кампус для студентов Medicine: преклинический этап в центре, клинические 4-6 курсы — в John Radcliffe Hospital, Churchill Hospital и Nuffield Department of Medicine.',
    },
  ],
  extraScholarships: [
    {
      name: 'Clarendon Scholarship',
      nameRu: 'Clarendon Scholarship',
      amount: 'full tuition + £18,180 stipend',
      description: 'Full tuition + £18,180/year stipend for outstanding graduate students of any nationality. Around 200+ scholarships awarded per year — Oxford\'s largest graduate funding programme. Open to applicants from Kazakhstan.',
      descriptionRu: 'Полное покрытие обучения + стипендия £18 180/год для outstanding магистров и докторантов любой национальности. Ежегодно выдаётся 200+ стипендий — крупнейшая graduate funding программа Оксфорда. Открыта для абитуриентов из Казахстана.',
      url: 'https://www.ox.ac.uk/clarendon',
    },
    {
      name: 'Rhodes Scholarship',
      nameRu: 'Rhodes Scholarship',
      amount: 'full funding',
      description: 'Oxford\'s most famous scholarship (since 1903) — full funding for graduate study including tuition, college fees, monthly stipend and travel. Open to outstanding international students; there is a specific Rhodes Scholarship for Global category which Kazakhstan applicants can target.',
      descriptionRu: 'Самая известная стипендия Оксфорда (с 1903 г.) — полное финансирование graduate-обучения: tuition, college fees, ежемесячная стипендия, перелёт. Открыта для outstanding иностранных студентов; есть категория Rhodes Scholarship for Global, на которую могут подавать кандидаты из Казахстана.',
      url: 'https://www.rhodeshouse.ox.ac.uk/scholarships/',
    },
    {
      name: 'Oxford-Weidenfeld and Hoffmann Scholarships',
      nameRu: 'Oxford-Weidenfeld and Hoffmann Scholarships',
      amount: '100% fees + stipend',
      description: '100% course fees + £18,180 living stipend for graduate students from developing and transition economies who demonstrate leadership potential. Kazakhstan is on the eligible countries list.',
      descriptionRu: '100% оплата обучения + стипендия £18 180 для магистров и докторантов из развивающихся и transition-экономик с лидерским потенциалом. Казахстан входит в список eligible-стран.',
      url: 'https://www.weidenfeldhoffmann.org/',
    },
    {
      name: 'Saïd Business School scholarships (MBA & MSc)',
      nameRu: 'Saïd Business School scholarships (MBA & MSc)',
      amount: '£10,000 — full MBA',
      description: 'Named awards for Oxford MBA and Saïd MSc students: Skoll Scholarship (full MBA for social entrepreneurs), Oxford-Pershing Square Graduate Scholarship, Saïd Foundation Scholarship, Forté Foundation Fellowship (women in business), and several country-specific awards.',
      descriptionRu: 'Именные стипендии для Oxford MBA и Saïd MSc: Skoll Scholarship (полный MBA для social entrepreneurs), Oxford-Pershing Square Graduate Scholarship, Saïd Foundation Scholarship, Forté Foundation Fellowship (для женщин в бизнесе) и серия страновых наград.',
      url: 'https://www.sbs.ox.ac.uk/programmes/scholarships',
    },
    {
      name: 'Crankstart Scholarship',
      nameRu: 'Crankstart Scholarship',
      amount: 'up to £6,150/year',
      description: 'Means-tested bursary for UK undergraduate students from low-income households (under £32,500/year) — mentioned for reference. International students are not eligible but this is Oxford\'s largest undergraduate support programme.',
      descriptionRu: 'Means-tested bursary для британских undergrad-студентов из малоимущих семей (доход меньше £32 500/год) — упоминается для справки. Иностранные студенты не eligible, но это крупнейшая undergraduate support программа Оксфорда.',
      url: 'https://www.ox.ac.uk/admissions/undergraduate/fees-and-funding/oxford-support/crankstart',
    },
  ],
  // Oxford has no real pathway college. Single placeholder entry documents this.
  pathwayPrograms: {
    'Direct admission only': [
      ['No Navitas/Kaplan pathway — direct UCAS entry required', 'foundation', 1, 'foundation'],
    ],
  },
  bachelorPrograms: {
    // 1. HUMANITIES DIVISION
    'Humanities — Classics, English & Literature': [
      ['Bachelor of Arts (BA) in Classics (Literae Humaniores)', 'bachelor', 4, 'bachelor-humanities'],
      ['Bachelor of Arts (BA) in Classics and English', 'bachelor', 3, 'bachelor-humanities'],
      ['Bachelor of Arts (BA) in Classics and Modern Languages', 'bachelor', 4, 'bachelor-humanities'],
      ['Bachelor of Arts (BA) in Classics and Oriental Studies', 'bachelor', 3, 'bachelor-humanities'],
      ['Bachelor of Arts (BA) in Classical Archaeology and Ancient History', 'bachelor', 3, 'bachelor-humanities'],
      ['Bachelor of Arts (BA) in English Language and Literature', 'bachelor', 3, 'bachelor-humanities'],
      ['Bachelor of Arts (BA) in English and Modern Languages', 'bachelor', 4, 'bachelor-humanities'],
    ],
    'Humanities — History, Archaeology & Anthropology': [
      ['Bachelor of Arts (BA) in History', 'bachelor', 3, 'bachelor-humanities'],
      ['Bachelor of Arts (BA) in History (Ancient and Modern)', 'bachelor', 3, 'bachelor-humanities'],
      ['Bachelor of Arts (BA) in History and Economics', 'bachelor', 3, 'bachelor-humanities'],
      ['Bachelor of Arts (BA) in History and English', 'bachelor', 3, 'bachelor-humanities'],
      ['Bachelor of Arts (BA) in History and Modern Languages', 'bachelor', 4, 'bachelor-humanities'],
      ['Bachelor of Arts (BA) in History and Politics', 'bachelor', 3, 'bachelor-humanities'],
      ['Bachelor of Arts (BA) in Archaeology and Anthropology', 'bachelor', 3, 'bachelor-humanities'],
      ['Bachelor of Arts (BA) in History of Art', 'bachelor', 3, 'bachelor-humanities'],
    ],
    'Humanities — Modern Languages': [
      ['Bachelor of Arts (BA) in Modern Languages (French)', 'bachelor', 4, 'bachelor-humanities'],
      ['Bachelor of Arts (BA) in Modern Languages (German)', 'bachelor', 4, 'bachelor-humanities'],
      ['Bachelor of Arts (BA) in Modern Languages (Spanish)', 'bachelor', 4, 'bachelor-humanities'],
      ['Bachelor of Arts (BA) in Modern Languages (Italian)', 'bachelor', 4, 'bachelor-humanities'],
      ['Bachelor of Arts (BA) in Modern Languages (Russian)', 'bachelor', 4, 'bachelor-humanities'],
      ['Bachelor of Arts (BA) in Modern Languages (Portuguese)', 'bachelor', 4, 'bachelor-humanities'],
      ['Bachelor of Arts (BA) in Modern Languages (Czech with Slovak)', 'bachelor', 4, 'bachelor-humanities'],
      ['Bachelor of Arts (BA) in Modern Languages (Polish)', 'bachelor', 4, 'bachelor-humanities'],
      ['Bachelor of Arts (BA) in Modern Languages and Linguistics', 'bachelor', 4, 'bachelor-humanities'],
      ['Bachelor of Arts (BA) in European and Middle Eastern Languages', 'bachelor', 4, 'bachelor-humanities'],
    ],
    'Humanities — Asian and Middle Eastern Studies': [
      ['Bachelor of Arts (BA) in Asian and Middle Eastern Studies (Arabic)', 'bachelor', 4, 'bachelor-humanities'],
      ['Bachelor of Arts (BA) in Asian and Middle Eastern Studies (Hebrew)', 'bachelor', 4, 'bachelor-humanities'],
      ['Bachelor of Arts (BA) in Asian and Middle Eastern Studies (Persian)', 'bachelor', 4, 'bachelor-humanities'],
      ['Bachelor of Arts (BA) in Asian and Middle Eastern Studies (Turkish)', 'bachelor', 4, 'bachelor-humanities'],
      ['Bachelor of Arts (BA) in Asian and Middle Eastern Studies (Chinese)', 'bachelor', 4, 'bachelor-humanities'],
      ['Bachelor of Arts (BA) in Asian and Middle Eastern Studies (Japanese)', 'bachelor', 4, 'bachelor-humanities'],
      ['Bachelor of Arts (BA) in Asian and Middle Eastern Studies (Korean)', 'bachelor', 4, 'bachelor-humanities'],
      ['Bachelor of Arts (BA) in Asian and Middle Eastern Studies (Sanskrit)', 'bachelor', 4, 'bachelor-humanities'],
      ['Bachelor of Arts (BA) in Egyptology and Ancient Near Eastern Studies', 'bachelor', 3, 'bachelor-humanities'],
    ],
    'Humanities — Philosophy, Theology & Linguistics': [
      ['Bachelor of Arts (BA) in Philosophy and Theology', 'bachelor', 3, 'bachelor-humanities'],
      ['Bachelor of Arts (BA) in Philosophy and Modern Languages', 'bachelor', 4, 'bachelor-humanities'],
      ['Bachelor of Arts (BA) in Theology and Religion', 'bachelor', 3, 'bachelor-humanities'],
      ['Bachelor of Arts (BA) in Religion and Asian and Middle Eastern Studies', 'bachelor', 3, 'bachelor-humanities'],
      ['Bachelor of Arts (BA) in Linguistics, Philology and Phonetics', 'bachelor', 4, 'bachelor-humanities'],
      ['Bachelor of Arts (BA) in Psychology, Philosophy and Linguistics (PPL)', 'bachelor', 3, 'bachelor-humanities'],
    ],
    'Humanities — Music & Fine Art': [
      ['Bachelor of Arts (BA) in Music', 'bachelor', 3, 'bachelor-humanities'],
      ['Bachelor of Fine Art (BFA) — Ruskin School of Art', 'bachelor', 3, 'bachelor-arts'],
    ],
    // 2. MATHEMATICAL, PHYSICAL AND LIFE SCIENCES DIVISION
    'MPLS — Mathematics': [
      ['Bachelor of Arts (BA) in Mathematics', 'bachelor', 3, 'bachelor-math'],
      ['Master of Mathematics (MMath) — 4-year integrated', 'bachelor', 4, 'bachelor-math'],
      ['Bachelor of Arts (BA) in Mathematics and Statistics', 'bachelor', 3, 'bachelor-math'],
      ['Master of Mathematics and Statistics (MMath) — 4-year integrated', 'bachelor', 4, 'bachelor-math'],
      ['Bachelor of Arts (BA) in Mathematics and Philosophy', 'bachelor', 3, 'bachelor-math'],
      ['Master of Mathematics and Philosophy (MMathPhil)', 'bachelor', 4, 'bachelor-math'],
      ['Bachelor of Arts (BA) in Mathematics and Computer Science', 'bachelor', 3, 'bachelor-cs'],
      ['Master of Mathematics and Computer Science (MMathCompSci)', 'bachelor', 4, 'bachelor-cs'],
    ],
    'MPLS — Computer Science': [
      ['Bachelor of Arts (BA) in Computer Science', 'bachelor', 3, 'bachelor-cs'],
      ['Master of Computer Science (MCompSci) — 4-year integrated', 'bachelor', 4, 'bachelor-cs'],
      ['Bachelor of Arts (BA) in Computer Science and Philosophy', 'bachelor', 3, 'bachelor-cs'],
      ['Master of Computer Science and Philosophy (MCompPhil)', 'bachelor', 4, 'bachelor-cs'],
    ],
    'MPLS — Physics': [
      ['Bachelor of Arts (BA) in Physics', 'bachelor', 3, 'bachelor-sciences'],
      ['Master of Physics (MPhys) — 4-year integrated', 'bachelor', 4, 'bachelor-sciences'],
      ['Bachelor of Arts (BA) in Physics and Philosophy', 'bachelor', 3, 'bachelor-sciences'],
      ['Master of Physics and Philosophy (MPhysPhil)', 'bachelor', 4, 'bachelor-sciences'],
    ],
    'MPLS — Chemistry': [
      ['Master of Chemistry (MChem) — 4-year integrated', 'bachelor', 4, 'bachelor-sciences'],
    ],
    'MPLS — Earth Sciences & Materials': [
      ['Master of Earth Sciences (MEarthSci) — 4-year integrated', 'bachelor', 4, 'bachelor-sciences'],
      ['Master of Engineering in Materials Science (MEng)', 'bachelor', 4, 'bachelor-engineering'],
      ['Master of Engineering in Materials, Economics and Management (MEng)', 'bachelor', 4, 'bachelor-engineering'],
    ],
    'MPLS — Biological Sciences': [
      ['Bachelor of Arts (BA) in Biology', 'bachelor', 3, 'bachelor-sciences'],
      ['Master of Biochemistry (MBiochem) — Molecular and Cellular', 'bachelor', 4, 'bachelor-sciences'],
      ['Bachelor of Arts (BA) in Human Sciences', 'bachelor', 3, 'bachelor-sciences'],
    ],
    'MPLS — Engineering Science': [
      ['Master of Engineering (MEng) in Engineering Science', 'bachelor', 4, 'bachelor-engineering'],
      ['Bachelor of Engineering (BEng) in Engineering Science (3-year exit)', 'bachelor', 3, 'bachelor-engineering'],
    ],
    // 3. MEDICAL SCIENCES DIVISION
    'Medical Sciences — Medicine': [
      ['Bachelor of Medicine, Bachelor of Surgery (BMBCh) — 6-year programme', 'bachelor', 6, 'bachelor-medicine-clinical'],
      ['Bachelor of Arts (BA) in Medical Sciences (Pre-clinical, 3-year)', 'bachelor', 3, 'bachelor-medicine'],
      ['Graduate Entry Medicine (Accelerated 4-year BMBCh)', 'bachelor', 4, 'bachelor-medicine-clinical'],
    ],
    'Medical Sciences — Biomedical & Psychology': [
      ['Bachelor of Arts (BA) in Biomedical Sciences', 'bachelor', 3, 'bachelor-medicine'],
      ['Bachelor of Arts (BA) in Experimental Psychology', 'bachelor', 3, 'bachelor-sciences'],
    ],
    // 4. SOCIAL SCIENCES DIVISION
    'Social Sciences — PPE & Joint Honours': [
      ['Bachelor of Arts (BA) in Philosophy, Politics and Economics (PPE)', 'bachelor', 3, 'bachelor-economics'],
      ['Bachelor of Arts (BA) in Economics and Management', 'bachelor', 3, 'bachelor-economics'],
    ],
    'Social Sciences — Law (Jurisprudence)': [
      ['Bachelor of Arts (BA) in Jurisprudence (Law)', 'bachelor', 3, 'bachelor-law'],
      ['Bachelor of Arts (BA) in Jurisprudence with Law Studies in Europe (4-year)', 'bachelor', 4, 'bachelor-law'],
      ['Bachelor of Arts (BA) in Law (Senior Status) — accelerated 2-year', 'bachelor', 2, 'bachelor-law'],
    ],
    'Social Sciences — Geography': [
      ['Bachelor of Arts (BA) in Geography', 'bachelor', 3, 'bachelor-social'],
    ],
  },
  masterPrograms: {
    // 1. HUMANITIES — Masters
    'Humanities — Masters in Literature, History & Languages': [
      ['Master of Studies (MSt) in English (1550-1700)', 'master', 1, 'master-humanities'],
      ['Master of Studies (MSt) in English (1700-1830)', 'master', 1, 'master-humanities'],
      ['Master of Studies (MSt) in English (1830-1914)', 'master', 1, 'master-humanities'],
      ['Master of Studies (MSt) in English (1900 to the Present)', 'master', 1, 'master-humanities'],
      ['Master of Studies (MSt) in Medieval Studies', 'master', 1, 'master-humanities'],
      ['Master of Studies (MSt) in History', 'master', 1, 'master-humanities'],
      ['Master of Studies (MSt) in Modern Languages', 'master', 1, 'master-humanities'],
      ['Master of Studies (MSt) in Classical Archaeology', 'master', 1, 'master-humanities'],
      ['Master of Studies (MSt) in Classical Languages and Literature', 'master', 1, 'master-humanities'],
      ['Master of Studies (MSt) in History of Art and Visual Culture', 'master', 1, 'master-humanities'],
      ['Master of Studies (MSt) in Music (Musicology)', 'master', 1, 'master-humanities'],
      ['Master of Studies (MSt) in Music (Performance)', 'master', 1, 'master-humanities'],
      ['Master of Studies (MSt) in Creative Writing', 'master', 2, 'master-humanities'],
      ['Master of Studies (MSt) in Film Aesthetics', 'master', 1, 'master-humanities'],
      ['Master of Studies (MSt) in Greek and Roman History', 'master', 1, 'master-humanities'],
      ['Master of Studies (MSt) in Slavonic Studies', 'master', 1, 'master-humanities'],
      ['Master of Studies (MSt) in Yiddish Studies', 'master', 1, 'master-humanities'],
    ],
    'Humanities — Masters in Philosophy & Theology': [
      ['Master of Studies (MSt) in Philosophy of Physics', 'master', 1, 'master-humanities'],
      ['Master of Studies (MSt) in Theology', 'master', 1, 'master-humanities'],
      ['Master of Studies (MSt) in Jewish Studies', 'master', 1, 'master-humanities'],
      ['Master of Studies (MSt) in Islamic Studies and History', 'master', 1, 'master-humanities'],
      ['Master of Philosophy (MPhil) in Philosophical Theology', 'master', 2, 'master-humanities'],
      ['Master of Philosophy (MPhil) in Philosophy', 'master', 2, 'master-humanities'],
    ],
    'Humanities — Masters in Asian and Middle Eastern Studies': [
      ['Master of Philosophy (MPhil) in Modern Middle Eastern Studies', 'master', 2, 'master-humanities'],
      ['Master of Philosophy (MPhil) in Modern South Asian Studies', 'master', 2, 'master-humanities'],
      ['Master of Philosophy (MPhil) in Chinese Studies', 'master', 2, 'master-humanities'],
      ['Master of Philosophy (MPhil) in Japanese Studies', 'master', 2, 'master-humanities'],
      ['Master of Philosophy (MPhil) in Korean Studies', 'master', 2, 'master-humanities'],
      ['Master of Philosophy (MPhil) in Tibetan and Himalayan Studies', 'master', 2, 'master-humanities'],
      ['Master of Studies (MSt) in Egyptology', 'master', 1, 'master-humanities'],
    ],
    // 2. MPLS — Masters
    'MPLS — Masters in Mathematics & Statistics': [
      ['Master of Science (MSc) in Mathematical Sciences (OMMS)', 'master', 1, 'master-sciences'],
      ['Master of Science (MSc) in Mathematical and Computational Finance', 'master', 1, 'master-sciences'],
      ['Master of Science (MSc) in Mathematical and Theoretical Physics', 'master', 1, 'master-sciences'],
      ['Master of Science (MSc) in Statistical Science', 'master', 1, 'master-sciences'],
      ['Master of Science (MSc) in Mathematical Modelling and Scientific Computing', 'master', 1, 'master-sciences'],
    ],
    'MPLS — Masters in Computer Science & AI': [
      ['Master of Science (MSc) in Computer Science', 'master', 1, 'master-cs'],
      ['Master of Science (MSc) in Advanced Computer Science', 'master', 1, 'master-cs'],
      ['Master of Science (MSc) in Artificial Intelligence for Sustainable Development', 'master', 1, 'master-cs'],
      ['Master of Science (MSc) in Software and Systems Security (part-time)', 'master', 2, 'master-cs'],
      ['Master of Science (MSc) in Software Engineering (part-time)', 'master', 2, 'master-cs'],
    ],
    'MPLS — Masters in Physical Sciences': [
      ['Master of Science (MSc) in Theoretical Chemistry (by Research)', 'master', 2, 'master-sciences'],
      ['Master of Science (MSc) in Pharmacology (by Research)', 'master', 2, 'master-sciences'],
      ['Master of Science (MSc) in Environmental Change and Management', 'master', 1, 'master-sciences'],
      ['Master of Science (MSc) in Biodiversity, Conservation and Management', 'master', 1, 'master-sciences'],
      ['Master of Science (MSc) in Water Science, Policy and Management', 'master', 1, 'master-sciences'],
    ],
    'MPLS — Masters in Engineering': [
      ['Master of Science (MSc) in Energy Systems', 'master', 1, 'master-engineering'],
      ['Master of Science (MSc) in Sustainability, Enterprise and the Environment', 'master', 1, 'master-engineering'],
    ],
    // 3. MEDICAL SCIENCES — Masters
    'Medical Sciences — Masters': [
      ['Master of Science (MSc) in Global Health Science and Epidemiology', 'master', 1, 'master-medicine'],
      ['Master of Science (MSc) in Clinical Embryology', 'master', 1, 'master-medicine'],
      ['Master of Science (MSc) in International Health and Tropical Medicine', 'master', 1, 'master-medicine'],
      ['Master of Science (MSc) in Integrated Immunology', 'master', 1, 'master-medicine'],
      ['Master of Science (MSc) in Neuroscience', 'master', 1, 'master-medicine'],
      ['Master of Science (MSc) in Pharmacology', 'master', 1, 'master-medicine'],
      ['Master of Science (MSc) in Radiation Biology', 'master', 1, 'master-medicine'],
      ['Master of Science (MSc) in Translational Health Sciences (part-time)', 'master', 2, 'master-medicine'],
      ['Master of Science (MSc) in Evidence-Based Health Care (part-time)', 'master', 2, 'master-medicine'],
      ['Master of Science (MSc) in Experimental and Translational Therapeutics', 'master', 1, 'master-medicine'],
      ['Master of Science (MSc) in Psychological Research', 'master', 1, 'master-medicine'],
      ['Master of Science (MSc) in Musculoskeletal Sciences', 'master', 1, 'master-medicine'],
    ],
    // 4. SOCIAL SCIENCES — Masters
    'Social Sciences — Masters in Economics & Finance': [
      ['Master of Philosophy (MPhil) in Economics', 'master', 2, 'master-social'],
      ['Master of Science (MSc) in Economics for Development', 'master', 1, 'master-social'],
      ['Master of Science (MSc) in Financial Economics (Saïd)', 'master', 1, 'master-business'],
      ['Master of Philosophy (MPhil) in Economic and Social History', 'master', 2, 'master-social'],
    ],
    'Social Sciences — Masters in Politics & International Relations': [
      ['Master of Philosophy (MPhil) in Politics (Comparative Government)', 'master', 2, 'master-social'],
      ['Master of Philosophy (MPhil) in Politics (Political Theory)', 'master', 2, 'master-social'],
      ['Master of Philosophy (MPhil) in International Relations', 'master', 2, 'master-social'],
      ['Master of Philosophy (MPhil) in Russian and East European Studies', 'master', 2, 'master-social'],
      ['Master of Philosophy (MPhil) in Latin American Studies', 'master', 2, 'master-social'],
      ['Master of Public Policy (MPP) — Blavatnik School of Government', 'master', 1, 'master-public-policy'],
    ],
    'Social Sciences — Masters in Law (BCL & MJur)': [
      ['Bachelor of Civil Law (BCL) — flagship taught Masters in Law', 'master', 1, 'master-law'],
      ['Magister Juris (MJur) — for civil law graduates', 'master', 1, 'master-law'],
      ['Master of Science (MSc) in Law and Finance', 'master', 1, 'master-law'],
      ['Master of Science (MSc) in Taxation (part-time)', 'master', 2, 'master-law'],
      ['Master of Studies (MSt) in International Human Rights Law (part-time)', 'master', 2, 'master-law'],
    ],
    'Social Sciences — Masters in Education, Sociology & Geography': [
      ['Master of Science (MSc) in Education (Higher Education)', 'master', 1, 'master-social'],
      ['Master of Science (MSc) in Education (Child Development and Education)', 'master', 1, 'master-social'],
      ['Master of Science (MSc) in Education (Learning and New Technologies)', 'master', 1, 'master-social'],
      ['Master of Philosophy (MPhil) in Sociology', 'master', 2, 'master-social'],
      ['Master of Philosophy (MPhil) in Social Anthropology', 'master', 2, 'master-social'],
      ['Master of Philosophy (MPhil) in Development Studies', 'master', 2, 'master-social'],
      ['Master of Philosophy (MPhil) in Migration Studies', 'master', 2, 'master-social'],
      ['Master of Philosophy (MPhil) in Geography and the Environment', 'master', 2, 'master-social'],
    ],
    // SAÏD BUSINESS SCHOOL
    'Saïd Business School — MBA & MSc': [
      ['Master of Business Administration (Oxford MBA) — 1-year', 'master', 1, 'master-mba'],
      ['Executive MBA (Oxford EMBA) — 21-month part-time', 'master', 2, 'master-mba'],
      ['Master of Science (MSc) in Major Programme Management (part-time)', 'master', 2, 'master-business'],
      ['Master of Science (MSc) in Global Healthcare Leadership (part-time)', 'master', 2, 'master-business'],
      ['Master of Science (MSc) in Sustainability, Enterprise and the Environment (Saïd)', 'master', 1, 'master-business'],
      ['Diploma in Strategy and Innovation (part-time)', 'master', 1, 'master-business'],
      ['Diploma in Financial Strategy (part-time)', 'master', 1, 'master-business'],
      ['Diploma in Global Business (part-time)', 'master', 1, 'master-business'],
    ],
    // DOCTORAL — DPhil (PhD)
    'Doctoral — DPhil (PhD) Humanities': [
      ['Doctor of Philosophy (DPhil) in English', 'phd', 4, 'phd-arts'],
      ['Doctor of Philosophy (DPhil) in History', 'phd', 4, 'phd-arts'],
      ['Doctor of Philosophy (DPhil) in Classics', 'phd', 4, 'phd-arts'],
      ['Doctor of Philosophy (DPhil) in Modern Languages', 'phd', 4, 'phd-arts'],
      ['Doctor of Philosophy (DPhil) in Philosophy', 'phd', 4, 'phd-arts'],
      ['Doctor of Philosophy (DPhil) in Theology and Religion', 'phd', 4, 'phd-arts'],
      ['Doctor of Philosophy (DPhil) in Music', 'phd', 4, 'phd-arts'],
      ['Doctor of Philosophy (DPhil) in History of Art', 'phd', 4, 'phd-arts'],
      ['Doctor of Philosophy (DPhil) in Linguistics, Philology and Phonetics', 'phd', 4, 'phd-arts'],
      ['Doctor of Philosophy (DPhil) in Oriental Studies', 'phd', 4, 'phd-arts'],
    ],
    'Doctoral — DPhil (PhD) MPLS': [
      ['Doctor of Philosophy (DPhil) in Mathematics', 'phd', 4, 'phd-sciences'],
      ['Doctor of Philosophy (DPhil) in Statistics', 'phd', 4, 'phd-sciences'],
      ['Doctor of Philosophy (DPhil) in Computer Science', 'phd', 4, 'phd-sciences'],
      ['Doctor of Philosophy (DPhil) in Atomic and Laser Physics', 'phd', 4, 'phd-sciences'],
      ['Doctor of Philosophy (DPhil) in Astrophysics', 'phd', 4, 'phd-sciences'],
      ['Doctor of Philosophy (DPhil) in Theoretical Physics', 'phd', 4, 'phd-sciences'],
      ['Doctor of Philosophy (DPhil) in Inorganic Chemistry', 'phd', 4, 'phd-sciences'],
      ['Doctor of Philosophy (DPhil) in Organic Chemistry', 'phd', 4, 'phd-sciences'],
      ['Doctor of Philosophy (DPhil) in Earth Sciences', 'phd', 4, 'phd-sciences'],
      ['Doctor of Philosophy (DPhil) in Materials', 'phd', 4, 'phd-sciences'],
      ['Doctor of Philosophy (DPhil) in Engineering Science', 'phd', 4, 'phd-sciences'],
      ['Doctor of Philosophy (DPhil) in Biology', 'phd', 4, 'phd-sciences'],
      ['Doctor of Philosophy (DPhil) in Biochemistry', 'phd', 4, 'phd-sciences'],
      ['Doctor of Philosophy (DPhil) in Plant Sciences', 'phd', 4, 'phd-sciences'],
    ],
    'Doctoral — DPhil (PhD) Medical Sciences': [
      ['Doctor of Philosophy (DPhil) in Clinical Medicine', 'phd', 4, 'phd-sciences'],
      ['Doctor of Philosophy (DPhil) in Cardiovascular Medicine', 'phd', 4, 'phd-sciences'],
      ['Doctor of Philosophy (DPhil) in Oncology', 'phd', 4, 'phd-sciences'],
      ['Doctor of Philosophy (DPhil) in Neuroscience', 'phd', 4, 'phd-sciences'],
      ['Doctor of Philosophy (DPhil) in Experimental Psychology', 'phd', 4, 'phd-sciences'],
      ['Doctor of Philosophy (DPhil) in Population Health', 'phd', 4, 'phd-sciences'],
      ['Doctor of Philosophy (DPhil) in Psychiatry', 'phd', 4, 'phd-sciences'],
      ['Doctor of Philosophy (DPhil) in Pharmacology', 'phd', 4, 'phd-sciences'],
    ],
    'Doctoral — DPhil (PhD) Social Sciences': [
      ['Doctor of Philosophy (DPhil) in Economics', 'phd', 4, 'phd-arts'],
      ['Doctor of Philosophy (DPhil) in Politics', 'phd', 4, 'phd-arts'],
      ['Doctor of Philosophy (DPhil) in International Relations', 'phd', 4, 'phd-arts'],
      ['Doctor of Philosophy (DPhil) in Law', 'phd', 4, 'phd-arts'],
      ['Doctor of Philosophy (DPhil) in Socio-Legal Studies', 'phd', 4, 'phd-arts'],
      ['Doctor of Philosophy (DPhil) in Sociology', 'phd', 4, 'phd-arts'],
      ['Doctor of Philosophy (DPhil) in Anthropology', 'phd', 4, 'phd-arts'],
      ['Doctor of Philosophy (DPhil) in Geography and the Environment', 'phd', 4, 'phd-arts'],
      ['Doctor of Philosophy (DPhil) in Education', 'phd', 4, 'phd-arts'],
      ['Doctor of Philosophy (DPhil) in Public Policy', 'phd', 4, 'phd-arts'],
      ['Doctor of Philosophy (DPhil) in Management Studies (Saïd)', 'phd', 4, 'phd-arts'],
      ['Doctor of Philosophy (DPhil) in Development Studies', 'phd', 4, 'phd-arts'],
    ],
  },
};

// Oxford-specific primary scholarship — Reach Oxford (flagship undergrad).
const REACH_OXFORD = {
  name: 'Reach Oxford Scholarship',
  nameRu: 'Reach Oxford Scholarship',
  amount: 'full fees + stipend',
  description: 'Flagship Oxford undergraduate scholarship — full tuition, college fees and maintenance stipend for outstanding students from low-income backgrounds in eligible developing countries.',
  descriptionRu: 'Флагманская undergraduate-стипендия Оксфорда — полная оплата tuition, college fees и стипендия для outstanding студентов из развивающихся стран с низким доходом.',
  url: 'https://www.ox.ac.uk/admissions/undergraduate/fees-and-funding/oxford-support/reach-oxford-scholarship',
};

const university = buildUniversity(OXFORD, {
  country: 'United Kingdom',
  currency: 'GBP',
  primaryIntake: isoIntake(10, 1),
  secondaryIntake: isoIntake(1, 10),
  defaultIntakes: ['October'],
  scholarship: REACH_OXFORD,
});

// Override aggregator default — Oxford is a direct-admission partner.
university.confidence = 'partner';

// Override sourceUrl to point to ox.ac.uk root (lib defaults to navitasUrl).
university.sourceUrl = 'https://www.ox.ac.uk/';

await mkdir(CONTENT_DIR, { recursive: true });
const filePath = resolve(CONTENT_DIR, 'oxford.json');
await writeFile(filePath, JSON.stringify(university, null, 2) + '\n', 'utf8');

console.log(`[seed-oxford] wrote oxford.json (${university.programs.length} programs)`);
console.log(`[seed-oxford] confidence=${university.confidence} · sourceUrl=${university.sourceUrl}`);
