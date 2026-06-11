// RU→EN synonym layer for the catalog search index.
// Program titles in the data are English ("Bachelor of Science in Mechanical
// Engineering"), but clients type Russian ("механическая инженерия"). For each
// pair below, if the English keyword appears in a university's indexed text we
// inject the Russian aliases, so a Russian query matches the same cards.
//
// Keep keys lowercase. `en` is matched as a substring against the already
// lowercased haystack; `ru` is the space-joined list of Russian aliases to add.
export const RU_EN_SYNONYMS: ReadonlyArray<{ en: string; ru: string }> = [
  // — Engineering family —
  { en: 'mechanical engineering', ru: 'механическая инженерия машиностроение механика' },
  { en: 'chemical engineering', ru: 'химическая инженерия химтехнология' },
  { en: 'electrical engineering', ru: 'электроинженерия электротехника электрическая' },
  { en: 'electronic engineering', ru: 'электронная инженерия электроника' },
  { en: 'civil engineering', ru: 'гражданское строительство строительная инженерия' },
  { en: 'aerospace engineering', ru: 'аэрокосмическая инженерия авиастроение' },
  { en: 'aeronautical engineering', ru: 'авиационная инженерия авиация' },
  { en: 'biomedical engineering', ru: 'биомедицинская инженерия биоинженерия' },
  { en: 'bioengineering', ru: 'биоинженерия биоинженерная' },
  { en: 'software engineering', ru: 'программная инженерия разработка по' },
  { en: 'industrial engineering', ru: 'промышленная инженерия' },
  { en: 'petroleum engineering', ru: 'нефтегазовая инженерия нефтегаз' },
  { en: 'engineering', ru: 'инженерия инженерное' },
  // — Computing —
  { en: 'computer science', ru: 'информатика компьютерные науки программирование' },
  { en: 'computing', ru: 'вычислительная техника компьютерная' },
  { en: 'data science', ru: 'наука о данных дата-сайенс анализ данных' },
  { en: 'artificial intelligence', ru: 'искусственный интеллект ии машинное обучение' },
  { en: 'cyber security', ru: 'кибербезопасность информационная безопасность' },
  { en: 'cybersecurity', ru: 'кибербезопасность информационная безопасность' },
  { en: 'information technology', ru: 'информационные технологии ит' },
  // — Law / politics / social —
  { en: 'law', ru: 'юриспруденция право юридическая закон' },
  { en: 'international relations', ru: 'международные отношения международка' },
  { en: 'political science', ru: 'политология политические науки политика' },
  { en: 'politics', ru: 'политика политология' },
  { en: 'sociology', ru: 'социология' },
  { en: 'psychology', ru: 'психология' },
  { en: 'philosophy', ru: 'философия' },
  { en: 'public policy', ru: 'государственная политика госуправление' },
  // — Business / economics —
  { en: 'business', ru: 'бизнес' },
  { en: 'business administration', ru: 'управление бизнесом деловое администрирование mba' },
  { en: 'management', ru: 'менеджмент управление' },
  { en: 'economics', ru: 'экономика' },
  { en: 'finance', ru: 'финансы' },
  { en: 'accounting', ru: 'бухгалтерия учёт бухучёт' },
  { en: 'marketing', ru: 'маркетинг' },
  { en: 'entrepreneurship', ru: 'предпринимательство' },
  // — Health / sciences —
  { en: 'medicine', ru: 'медицина лечебное дело' },
  { en: 'nursing', ru: 'медсестринское сестринское уход' },
  { en: 'pharmacy', ru: 'фармация фармацевтика' },
  { en: 'dentistry', ru: 'стоматология' },
  { en: 'biology', ru: 'биология' },
  { en: 'biotechnology', ru: 'биотехнология' },
  { en: 'chemistry', ru: 'химия' },
  { en: 'physics', ru: 'физика' },
  { en: 'mathematics', ru: 'математика мат' },
  { en: 'statistics', ru: 'статистика' },
  { en: 'environmental', ru: 'экология окружающая среда' },
  // — Arts / humanities / media —
  { en: 'architecture', ru: 'архитектура' },
  { en: 'design', ru: 'дизайн' },
  { en: 'graphic design', ru: 'графический дизайн' },
  { en: 'fashion', ru: 'мода фэшн' },
  { en: 'art', ru: 'искусство арт' },
  { en: 'music', ru: 'музыка' },
  { en: 'dance', ru: 'танцы хореография' },
  { en: 'film', ru: 'кино кинематограф' },
  { en: 'media', ru: 'медиа' },
  { en: 'journalism', ru: 'журналистика' },
  { en: 'communication', ru: 'коммуникации' },
  { en: 'education', ru: 'образование педагогика' },
  { en: 'linguistics', ru: 'лингвистика языкознание' },
  { en: 'tourism', ru: 'туризм' },
  { en: 'hospitality', ru: 'гостиничное дело индустрия гостеприимства' },
  { en: 'history', ru: 'история' },
  { en: 'geography', ru: 'география' },
  { en: 'anthropology', ru: 'антропология' },
  { en: 'criminology', ru: 'криминология' },
  { en: 'social work', ru: 'социальная работа' },
  { en: 'theology', ru: 'теология богословие' },
  { en: 'translation', ru: 'перевод переводоведение' },
  // — Business / logistics extras —
  { en: 'international business', ru: 'международный бизнес' },
  { en: 'digital marketing', ru: 'цифровой маркетинг диджитал-маркетинг' },
  { en: 'human resources', ru: 'управление персоналом hr кадры' },
  { en: 'supply chain', ru: 'цепочки поставок логистика снабжение' },
  { en: 'logistics', ru: 'логистика' },
  { en: 'real estate', ru: 'недвижимость' },
  { en: 'actuarial', ru: 'актуарная актуарий' },
  { en: 'economics and finance', ru: 'экономика и финансы' },
  // — Health extras —
  { en: 'public health', ru: 'общественное здравоохранение здоровье населения' },
  { en: 'nutrition', ru: 'нутрициология питание диетология' },
  { en: 'physiotherapy', ru: 'физиотерапия' },
  { en: 'occupational therapy', ru: 'трудотерапия эрготерапия' },
  { en: 'midwifery', ru: 'акушерство' },
  { en: 'optometry', ru: 'оптометрия' },
  { en: 'radiography', ru: 'рентгенология лучевая диагностика' },
  { en: 'veterinary', ru: 'ветеринария' },
  // — Tech / engineering extras —
  { en: 'machine learning', ru: 'машинное обучение' },
  { en: 'data analytics', ru: 'аналитика данных' },
  { en: 'robotics', ru: 'робототехника' },
  { en: 'mechatronics', ru: 'мехатроника' },
  { en: 'renewable energy', ru: 'возобновляемая энергетика зелёная энергия' },
  { en: 'aviation', ru: 'авиация авиационное' },
  { en: 'agriculture', ru: 'сельское хозяйство агрономия' },
  { en: 'sustainability', ru: 'устойчивое развитие экоустойчивость' },
  // — Creative / sport extras —
  { en: 'fine art', ru: 'изобразительное искусство' },
  { en: 'interior design', ru: 'дизайн интерьера' },
  { en: 'animation', ru: 'анимация мультипликация' },
  { en: 'game', ru: 'геймдизайн игры игровая разработка' },
  { en: 'esports', ru: 'киберспорт' },
  { en: 'sports', ru: 'спорт спортивная' },
];

/**
 * Given an already-lowercased search haystack (program titles + faculties + …),
 * return the Russian alias strings whose English keyword is present, so callers
 * can append them to the card's search index.
 */
export function ruSynonymsFor(haystackLower: string): string[] {
  const out: string[] = [];
  for (const { en, ru } of RU_EN_SYNONYMS) {
    if (haystackLower.includes(en)) out.push(ru);
  }
  return out;
}
