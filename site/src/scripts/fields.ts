// Curated "field" (направление) taxonomy layered ON TOP of the existing
// programs[].title indexing and search-synonyms.ts. Each field groups many
// program names under one canonical direction, powering both:
//   1. smart text search — broad/synonym terms expand to the field's tokens
//      (fieldSearchTokens → appended to the card's data-search);
//   2. clickable category chips — fieldsFor → the card's data-fields.
//
// `en` keywords are matched as substrings against an already-lowercased
// haystack (program titles + faculties), exactly like ruSynonymsFor().
// `ru` are broad Russian aliases; `alias` are English short-forms / spelling
// variants (CS, MBA, maths, UX). Both `ru` and `alias` are NOT used for
// membership — they are only injected into data-search for matched cards, so
// short ambiguous forms can't cause false-positive membership from titles.
// `id` is a stable slug — DO NOT rename (it is used in shareable ?field= URLs).
export interface Field {
  id: string;
  label: string;
  en: string[];
  ru: string[];
  alias: string[];
}

export const FIELDS: ReadonlyArray<Field> = [
  {
    id: 'business',
    label: 'Бизнес',
    en: ['business', 'management', 'marketing', 'finance', 'accounting',
      'economics', 'entrepreneurship', 'mba', 'human resources',
      'supply chain', 'logistics'],
    ru: ['бизнес', 'менеджмент', 'маркетинг', 'финансы', 'экономика',
      'бухгалтерия', 'предпринимательство', 'логистика'],
    alias: ['biz', 'b-school', 'business school', 'hrm', 'fintech'],
  },
  {
    id: 'cs',
    label: 'IT и Computer Science',
    en: ['computer science', 'computing', 'information technology', 'software',
      'data science', 'data analytics', 'artificial intelligence',
      'machine learning', 'cyber security', 'cybersecurity'],
    ru: ['айти', 'информатика', 'программирование', 'компьютерные науки',
      'информационные технологии', 'искусственный интеллект',
      'кибербезопасность', 'данные'],
    alias: ['cs', 'compsci', 'comp sci', 'infosec', 'cybersec', 'a.i.',
      'data sci', 'it engineering'],
  },
  {
    id: 'engineering',
    label: 'Инженерия',
    en: ['engineering', 'mechanical', 'electrical', 'electronic', 'civil',
      'aerospace', 'aeronautical', 'industrial', 'petroleum', 'mechatronics',
      'robotics'],
    ru: ['инженерия', 'инженерное', 'машиностроение', 'механика',
      'электротехника', 'строительство', 'робототехника'],
    alias: ['eng', 'mech eng', 'elec eng', 'civil eng', 'aero'],
  },
  {
    id: 'medicine',
    label: 'Медицина и здоровье',
    en: ['medicine', 'medical', 'nursing', 'pharmacy', 'dentistry',
      'public health', 'nutrition', 'physiotherapy', 'midwifery',
      'veterinary', 'biomedical'],
    ru: ['медицина', 'сестринское', 'фармация', 'стоматология',
      'здравоохранение', 'ветеринария', 'физиотерапия'],
    alias: ['med', 'pre-med', 'premed', 'healthcare', 'health care', 'mbbs'],
  },
  {
    id: 'law',
    label: 'Право и политика',
    en: ['law', 'legal', 'international relations', 'political science',
      'politics', 'public policy', 'criminology'],
    ru: ['право', 'юриспруденция', 'юридическая', 'международные отношения',
      'политология', 'криминология'],
    alias: ['llb', 'llm', 'poli sci', 'polisci', 'pre-law', 'ir'],
  },
  {
    id: 'arts',
    label: 'Искусство и дизайн',
    en: ['art', 'design', 'fashion', 'architecture', 'graphic',
      'interior design', 'fine art', 'animation', 'music', 'dance', 'film',
      'game'],
    ru: ['искусство', 'дизайн', 'мода', 'архитектура', 'музыка', 'анимация',
      'кино', 'графический'],
    alias: ['ux', 'ui', 'ux/ui', 'fine arts', 'gamedev', 'game design'],
  },
  {
    id: 'sciences',
    label: 'Естественные науки',
    en: ['biology', 'chemistry', 'physics', 'mathematics', 'statistics',
      'biotechnology', 'environmental', 'geography', 'astronomy'],
    ru: ['биология', 'химия', 'физика', 'математика', 'статистика',
      'биотехнология', 'экология', 'география'],
    alias: ['biotech', 'maths', 'stats', 'env science', 'astrophysics'],
  },
  {
    id: 'humanities',
    label: 'Гуманитарные науки',
    en: ['psychology', 'sociology', 'philosophy', 'history', 'anthropology',
      'linguistics', 'theology', 'social work', 'translation'],
    ru: ['психология', 'социология', 'философия', 'история', 'антропология',
      'лингвистика', 'перевод', 'социальная работа'],
    alias: ['psych', 'phil', 'socanthro'],
  },
  {
    id: 'media',
    label: 'Медиа и коммуникации',
    en: ['media', 'journalism', 'communication', 'public relations',
      'advertising'],
    ru: ['медиа', 'журналистика', 'коммуникации', 'реклама', 'пиар'],
    alias: ['comms', 'journo', 'mass comm', 'pr'],
  },
  {
    id: 'education',
    label: 'Образование',
    en: ['education', 'teaching', 'pedagogy', 'early childhood'],
    ru: ['образование', 'педагогика', 'преподавание'],
    alias: ['teacher training', 'teacher education', 'tesol', 'tefl'],
  },
  {
    id: 'hospitality',
    label: 'Туризм и гостеприимство',
    en: ['tourism', 'hospitality', 'hotel', 'culinary', 'event management'],
    ru: ['туризм', 'гостеприимство', 'гостиничное', 'отельный', 'кулинария'],
    alias: ['hotel management', 'travel and tourism', 'hosp'],
  },
  {
    id: 'sport',
    label: 'Спорт',
    en: ['sport', 'sports', 'physical education', 'esports', 'fitness'],
    ru: ['спорт', 'спортивная', 'физкультура', 'киберспорт', 'фитнес'],
    alias: ['sports science', 'kinesiology', 'phys ed'],
  },
];

/** IDs of all fields whose any EN keyword is a substring of the haystack. */
export function fieldsFor(haystackLower: string): string[] {
  const out: string[] = [];
  for (const f of FIELDS) {
    if (f.en.some((en) => haystackLower.includes(en))) out.push(f.id);
  }
  return out;
}

/**
 * Search tokens to append to a card's data-search: for every matching field,
 * its label + all RU aliases + English short-forms + all EN keywords. This is
 * what makes a broad query ("бизнес", "business", "CS", "MBA") match a card
 * whose only relevant programme is e.g. "Marketing".
 */
export function fieldSearchTokens(haystackLower: string): string[] {
  const out: string[] = [];
  for (const f of FIELDS) {
    if (f.en.some((en) => haystackLower.includes(en))) {
      out.push(f.label.toLowerCase(), ...f.ru, ...f.alias, ...f.en);
    }
  }
  return out;
}
