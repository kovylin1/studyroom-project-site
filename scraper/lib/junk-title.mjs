// junk-title.mjs — одно правило «это не программа» на весь проект.
//
// Живёт в lib, а не копией по скриптам, по уроку смены 23.08: карта уровней
// была размножена по двум файлам, копии разъехались, и матчер оказался слепее
// добора. Замер (kompas-junk-titles-diag.mjs) и чистилка
// (kompas-drop-nonprograms.mjs) обязаны отвечать на вопрос одинаково.
//
// Штатный гейт audit-catalog.mjs держит СВОЁ, более узкое правило JUNK_TITLE —
// только приёмная лексика («Admissions», «How to apply»). Его не трогаем:
// на нём висит блокировка деплоя, и расширять её задним числом нельзя.

export const RULES = [
  {
    kind: 'html-entity',
    re: /&#\d+;|&#x[0-9a-f]+;|&(amp|nbsp|quot|lt|gt);/i,
    why: 'в названии остались HTML-сущности — брак разбора, а не название',
  },
  {
    kind: 'person-name',
    re: /\b(prof|doç|doc|dr|öğr|ogr|assoc|asst|assist)\b\.?\s*(dr|öğr|ogr|üyesi|uyesi)?\b\.?\s*[A-ZÇĞİÖŞÜ]/,
    why: 'звание и фамилия — это карточка преподавателя',
  },
  {
    kind: 'navigation',
    re: /^\s*(mainpage|main page|home ?page|homepage|anasayfa|thank you|te[sş]ekk[uü]rler|contact( us)?|about( us)?|news|haberler|login|sitemap|search|read more|devam[ıi]|duyurular)\s*$/i,
    why: 'пункт меню или служебная страница',
  },
  {
    kind: 'studyroom-stub',
    re: /contact\s+studyroom|уточня|— contact/i,
    why: 'заглушка «спросите менеджера», а не программа',
  },
  {
    kind: 'marketing',
    // Проверено глазами на выборке 02.09.2026: FAQ-заголовки, зазывалки,
    // дни открытых дверей с датами 2014 года, кнопки «Download Brochure».
    re: /^(why|how|what|meet|discover|download|join|welcome|introducing|explore|a message|our |your )|(message from the|all about|meet the (faculty|team|dean)|alumni network|brochures?|open day|virtual tour|curriculum & academics)/i,
    why: 'рекламная или навигационная страница сайта, а не программа',
  },
  {
    kind: 'sentence',
    re: /^.{95,}$/,
    why: 'длиннее 95 знаков — обычно заголовок новости, а не название программы',
  },
];

// Настоящая степень в длинном названии означает, что это длинное НАЗВАНИЕ,
// а не новость: у Kaplan источник слепил в строку требования и партнёрский вуз.
const DEGREE = /\b(bsc|ba|bs|beng|bba|bcom|llb|llm|msc|ma|ms|meng|mba|mphil|phd|doctor|bachelor|master|diploma|certificate|foundation|lisans|tıp|hem[sş]irelik)\b/i;

/** Разряд названия или null, если строка выглядит настоящей программой. */
export function classifyTitle(title) {
  const s = String(title || '');
  for (const rule of RULES) {
    if (!rule.re.test(s)) continue;
    if (rule.kind === 'sentence' && DEGREE.test(s)) return null;
    return rule;
  }
  return null;
}
