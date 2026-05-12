// Hand-curated scholarship list per uni. Same pattern as
// `uni-accommodation-facts.ts` and `campus-facts.ts` — keyed by registry slug,
// merged into the University record by `buildScholarships` in cli.ts.
//
// Conventions:
// - `name` is the English brand name (kept as displayed by the university).
// - `nameRu` is the Russian-language equivalent shown on the StudyRoom landing.
// - `amount` is a free-form string with the local currency / percentage
//   (e.g. "£3,000", "до £5,000", "20% от стоимости обучения").
// - `description` / `descriptionRu` describe eligibility briefly (level, country,
//   requirements) in one sentence.
// - `url` is the most authoritative source (the uni's own scholarship page when
//   available, else the Kaplan partner scholarship reference).
//
// **Every uni gets the baseline Kaplan Early Bird** (auto-added in
// `buildScholarships`), so this dictionary only carries the *additional*
// uni-specific scholarships. Returning an empty array here means the uni shows
// only the baseline.

export interface ScholarshipFact {
  name: string;
  nameRu?: string;
  amount?: string;
  description?: string;
  descriptionRu?: string;
  url?: string;
}

// Universal Kaplan / StudyRoom offer that applies to all 18 Kaplan partners.
// Source: kaplanpathways.com/how-to-apply/fees-and-costs/scholarships-for-international-students/
// Verified 2026-05-12.
export const BASELINE_KAPLAN_SCHOLARSHIPS: ScholarshipFact[] = [
  {
    name: 'Kaplan Early Bird Scholarship',
    nameRu: 'Стипендия Kaplan за раннюю подачу',
    amount: 'до £2,000',
    description: 'Early-bird discount applied automatically when you pay the deposit at least 90 days before the start of your Kaplan pathway course (Foundation or Pre-Master\'s).',
    descriptionRu: 'Автоматическая скидка при оплате депозита не менее чем за 90 дней до начала программы Kaplan (Foundation или Pre-Master\'s). Доступна на каждом из партнёрских университетов.',
    url: 'https://www.kaplanpathways.com/how-to-apply/fees-and-costs/scholarships-for-international-students/',
  },
  {
    name: 'Kaplan Academic Achievement Scholarship',
    nameRu: 'Стипендия Kaplan за академические достижения',
    amount: 'до £4,000',
    description: 'Merit-based scholarship for top-performing applicants on Kaplan pathway programmes. Awarded after academic review of transcripts.',
    descriptionRu: 'Стипендия за академические заслуги для лучших абитуриентов программ Kaplan. Присуждается после проверки академических документов.',
    url: 'https://www.kaplanpathways.com/how-to-apply/fees-and-costs/scholarships-for-international-students/',
  },
];

// Uni-specific scholarships in addition to the baseline. Sources cited inline.
const UNI_SPECIFIC: Record<string, ScholarshipFact[]> = {
  glasgow: [
    {
      name: 'University of Glasgow International Leadership Scholarship',
      nameRu: 'International Leadership Scholarship Университета Глазго',
      amount: '£10,000 (одноразово)',
      description: 'Awarded to international students entering undergraduate or postgraduate study at the University of Glasgow. Selection based on academic merit + personal statement.',
      descriptionRu: 'Для иностранных студентов, поступающих на бакалавриат или магистратуру в University of Glasgow. Отбор по академическим заслугам и мотивационному письму.',
      url: 'https://www.gla.ac.uk/international/scholarships/',
    },
    {
      name: 'Chevening Scholarship',
      nameRu: 'Стипендия Chevening',
      amount: 'Полное покрытие',
      description: 'UK government-funded scholarship for outstanding international leaders. Covers tuition, living allowance, travel.',
      descriptionRu: 'Стипендия правительства Великобритании для выдающихся международных лидеров. Покрывает обучение, проживание и проезд.',
      url: 'https://www.chevening.org/',
    },
  ],

  bristol: [
    {
      name: 'Think Big Undergraduate Scholarship',
      nameRu: 'Think Big — стипендия для бакалавров',
      amount: '£6,500–£20,000 в год',
      description: 'University of Bristol award for international students entering an undergraduate degree. Selection competitive — academic merit + 500-word statement.',
      descriptionRu: 'Стипендия University of Bristol для иностранных студентов бакалавриата. Конкурсный отбор по академическим заслугам + мотивационное эссе 500 слов.',
      url: 'https://www.bristol.ac.uk/study/undergraduate/fees-funding/scholarships/',
    },
    {
      name: 'Think Big Postgraduate Scholarship',
      nameRu: 'Think Big — стипендия для магистров',
      amount: '£10,000–£25,000 в год',
      description: 'Award for international students entering a postgraduate taught programme at the University of Bristol. Apply via the dedicated scholarships portal after receiving an offer.',
      descriptionRu: 'Стипендия для иностранных студентов магистратуры University of Bristol. Подавать через специальный портал после получения оффера.',
      url: 'https://www.bristol.ac.uk/study/postgraduate/scholarships-bursaries/',
    },
  ],

  liverpool: [
    {
      name: 'University of Liverpool Vice-Chancellor\'s International Scholarship',
      nameRu: 'Стипендия проректора University of Liverpool для иностранных студентов',
      amount: '£2,500–£5,000 в год',
      description: 'Awarded to high-achieving international students entering undergraduate or postgraduate study at the University of Liverpool. Automatic consideration after firm acceptance.',
      descriptionRu: 'Для иностранных студентов с высокой успеваемостью, поступающих на бакалавриат или магистратуру в University of Liverpool. Автоматически рассматривается после подтверждения места.',
      url: 'https://www.liverpool.ac.uk/study/international/fees-and-finance/scholarships-and-funding/',
    },
  ],

  westminster: [
    {
      name: 'Westminster International Scholarships',
      nameRu: 'Westminster International Scholarships',
      amount: 'Полное покрытие обучения + £4,575/год',
      description: 'Full-tuition + living-allowance scholarships for international students from developing countries entering an undergraduate degree at Westminster.',
      descriptionRu: 'Полное покрытие обучения + £4,575 в год на проживание. Для иностранных студентов из развивающихся стран, поступающих на бакалавриат Westminster.',
      url: 'https://www.westminster.ac.uk/study/fees-and-funding/scholarships',
    },
    {
      name: 'Westminster Vice-Chancellor\'s Scholarship',
      nameRu: 'Стипендия проректора Westminster',
      amount: '50% от стоимости обучения',
      description: 'Postgraduate scholarship offering 50% tuition reduction for outstanding international applicants.',
      descriptionRu: 'Магистерская стипендия — скидка 50% на обучение для выдающихся иностранных абитуриентов.',
      url: 'https://www.westminster.ac.uk/study/fees-and-funding/scholarships',
    },
  ],

  york: [
    {
      name: 'University of York International Scholarship',
      nameRu: 'International Scholarship Университета Йорка',
      amount: 'до £6,000 в год',
      description: 'Merit-based award for international undergraduate and postgraduate students. Automatic consideration on application.',
      descriptionRu: 'Стипендия за академические заслуги для иностранных студентов бакалавриата и магистратуры. Автоматически учитывается при подаче документов.',
      url: 'https://www.york.ac.uk/study/international/fees-funding/scholarships/',
    },
  ],

  nottingham: [
    {
      name: 'Developing Solutions Scholarship',
      nameRu: 'Developing Solutions Scholarship',
      amount: '50–100% от стоимости обучения',
      description: 'University of Nottingham postgraduate scholarship for students from Africa, India, and selected Commonwealth countries. Tuition-only.',
      descriptionRu: 'Магистерская стипендия University of Nottingham для студентов из Африки, Индии и стран Содружества. Покрывает 50–100% обучения.',
      url: 'https://www.nottingham.ac.uk/studywithus/international-applicants/scholarships-fees-and-finance/scholarships/index.aspx',
    },
  ],

  birmingham: [
    {
      name: 'Birmingham International Scholarship',
      nameRu: 'Стипендия University of Birmingham для иностранных студентов',
      amount: 'до £6,000 в год',
      description: 'Awarded to outstanding international students entering an undergraduate programme at the University of Birmingham. Application required.',
      descriptionRu: 'Для выдающихся иностранных абитуриентов бакалавриата University of Birmingham. Требует подачи отдельной заявки.',
      url: 'https://www.birmingham.ac.uk/study/funding-and-fees/scholarships',
    },
  ],

  essex: [
    {
      name: 'Academic Excellence International Scholarship',
      nameRu: 'Стипендия Essex за академическое превосходство',
      amount: '£2,000–£5,000 в год',
      description: 'Automatic merit-based scholarship for high-achieving international undergraduate students at the University of Essex.',
      descriptionRu: 'Автоматическая стипендия за академические заслуги для иностранных студентов бакалавриата в University of Essex.',
      url: 'https://www.essex.ac.uk/scholarships',
    },
  ],

  brighton: [
    {
      name: 'University of Brighton International Scholarships',
      nameRu: 'International Scholarships University of Brighton',
      amount: 'до £5,000 в год',
      description: 'Awarded to international students entering full-time undergraduate or postgraduate study at the University of Brighton.',
      descriptionRu: 'Для иностранных студентов очной формы бакалавриата или магистратуры University of Brighton.',
      url: 'https://www.brighton.ac.uk/studying-here/applying-to-brighton/fees-and-finance/scholarships-and-bursaries/index.aspx',
    },
  ],

  bournemouth: [
    {
      name: 'BU International Scholarship',
      nameRu: 'Международная стипендия Bournemouth University',
      amount: 'до £3,000 за первый год обучения',
      description: 'Available to non-EU international students entering full-time undergraduate or taught postgraduate degrees at BU.',
      descriptionRu: 'Для иностранных студентов (не из ЕС) очной формы бакалавриата или магистратуры в BU.',
      url: 'https://www.bournemouth.ac.uk/study/fees-funding/scholarships-bursaries-financial-support',
    },
  ],

  'queen-mary-london': [
    {
      name: 'Queen Mary Principal\'s Postgraduate Research Studentship',
      nameRu: 'Стипендия для аспирантов Queen Mary',
      amount: 'Полное покрытие обучения + £20,622 в год',
      description: 'Highly competitive PhD studentship for outstanding international research students at Queen Mary University of London.',
      descriptionRu: 'Конкурсная аспирантская стипендия для выдающихся иностранных исследователей Queen Mary University of London.',
      url: 'https://www.qmul.ac.uk/scholarships/',
    },
  ],

  'uwe-bristol': [
    {
      name: 'Chancellor\'s Scholarship',
      nameRu: 'Стипендия канцлера UWE Bristol',
      amount: 'до £4,000 в год',
      description: 'Awarded to international students with strong academic records joining an undergraduate or postgraduate programme at UWE Bristol.',
      descriptionRu: 'Для иностранных студентов с сильной академической успеваемостью, поступающих на бакалавриат или магистратуру UWE Bristol.',
      url: 'https://www.uwe.ac.uk/study/fees-and-funding/scholarships-and-bursaries',
    },
  ],

  cranfield: [
    {
      name: 'Cranfield Postgraduate Loan Scheme',
      nameRu: 'Cranfield Postgraduate Loan Scheme',
      amount: 'до £10,000',
      description: 'Postgraduate loan available to international students enrolling at Cranfield University. Repayable after graduation.',
      descriptionRu: 'Кредитная программа для иностранных студентов магистратуры Cranfield University. Возврат после выпуска.',
      url: 'https://www.cranfield.ac.uk/study/fees-and-funding/scholarships-and-bursaries',
    },
  ],

  'asu-london': [
    {
      name: 'ASU London Scholarship',
      nameRu: 'Стипендия ASU London',
      amount: 'до £4,000 в год',
      description: 'Awarded to international students entering an undergraduate programme at ASU London. Automatic merit-based consideration.',
      descriptionRu: 'Для иностранных студентов бакалавриата ASU London. Автоматическая стипендия за академические заслуги.',
      url: 'https://www.asu.edu/admission/international/london',
    },
  ],

  'city-london': [
    {
      name: 'City St George\'s Academic Excellence Scholarship',
      nameRu: 'Стипендия City St George\'s за академическое превосходство',
      amount: 'до £5,000 в год',
      description: 'Merit-based award for international students starting undergraduate study at City St George\'s, University of London.',
      descriptionRu: 'Стипендия за академические заслуги для иностранных студентов бакалавриата City St George\'s, University of London.',
      url: 'https://www.city.ac.uk/study/fees-and-funding/scholarships',
    },
  ],

  'nottingham-trent': [
    {
      name: 'NTU International Scholarship',
      nameRu: 'Международная стипендия Nottingham Trent University',
      amount: '£2,000–£3,000 в год',
      description: 'Available to international students enrolling on a full-time undergraduate or postgraduate degree at NTU.',
      descriptionRu: 'Для иностранных студентов очной формы бакалавриата или магистратуры NTU.',
      url: 'https://www.ntu.ac.uk/study-and-courses/fees-and-funding/international-fees-and-funding/scholarships',
    },
  ],

  alberta: [
    {
      name: 'University of Alberta International Admission Scholarship',
      nameRu: 'Стипендия Университета Альберты для иностранных абитуриентов',
      amount: 'CA$5,000 (одноразово)',
      description: 'Awarded to outstanding international students entering an undergraduate degree at the University of Alberta. Automatic consideration on application.',
      descriptionRu: 'Для выдающихся иностранных абитуриентов бакалавриата University of Alberta. Автоматически учитывается при подаче.',
      url: 'https://www.ualberta.ca/registrar/scholarships-awards-financial-support/',
    },
  ],

  victoria: [
    {
      name: 'UVic International Student Scholarship',
      nameRu: 'Стипендия UVic для иностранных студентов',
      amount: 'до CA$10,000 в год',
      description: 'Awarded to international students entering an undergraduate programme at the University of Victoria. Merit + financial-need based.',
      descriptionRu: 'Для иностранных студентов бакалавриата UVic. Отбор по академическим заслугам и финансовой необходимости.',
      url: 'https://www.uvic.ca/registrar/safa/entrance-scholarships/',
    },
  ],
};

export function getUniScholarships(slug: string): ScholarshipFact[] {
  return UNI_SPECIFIC[slug] ?? [];
}
