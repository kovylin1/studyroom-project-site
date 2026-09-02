// program-link.ts — задача F: «Просмотр цен» не должен уводить на агрегатор.
//
// У 42 900 программ из 124 592 в programUrl стоит адрес агрегатора, а не вуза:
// edge.edvoy.com, admissions.qs.com, topuniversities.com, intostudy.com,
// collabinternational.com. Посетитель жал «смотреть цену» и уходил к конкуренту.
//
// Отдельно: у QS programUrl — общая ссылка на портал, одна на 35 238 строк из 35 259.
// Как ссылка на программу она бесполезна в принципе.
//
// Правило:
//   1. Ссылка ведёт на домен самого вуза → оставляем как есть.
//   2. Ссылка ведёт на агрегатор → подменяем офсайтом вуза. Страницу конкретной
//      программы на офсайте мы не знаем, поэтому ведём на главную — это честнее,
//      чем вести к посреднику.
//   3. Офсайта у вуза нет (393 карточки из 1070) → ссылки нет вовсе. Название
//      программы остаётся текстом. Выдумывать адрес нельзя.

const AGGREGATOR_HOSTS = [
  'edvoy.com',
  'qs.com',
  'topuniversities.com',
  'intostudy.com',
  'collabinternational.com',
  'studygroup.com',
  'kaplaninternational.com',
  'iapro.net',
  'qahe.org.uk',
];

const host = (url: string | undefined): string | undefined => {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return undefined;
  }
};

/** example.co.uk и sub.example.co.uk считаются одним доменом. */
const sameSite = (a: string | undefined, b: string | undefined): boolean =>
  !!a && !!b && (a === b || a.endsWith('.' + b) || b.endsWith('.' + a));

const isAggregator = (h: string | undefined): boolean =>
  !!h && AGGREGATOR_HOSTS.some((agg) => h === agg || h.endsWith('.' + agg));

/**
 * Офсайт вуза: officialUrl, а если его нет — sourceUrl, но только когда тот
 * не ведёт на агрегатор (у 237 карточек в sourceUrl стоит edge.edvoy.com).
 */
export function officialSiteOf(u: { officialUrl?: string; sourceUrl?: string }): string | undefined {
  if (u.officialUrl && !isAggregator(host(u.officialUrl))) return u.officialUrl;
  if (u.sourceUrl && !isAggregator(host(u.sourceUrl))) return u.sourceUrl;
  return undefined;
}

/** Ссылка, которую можно показать посетителю. undefined — показывать без ссылки. */
export function programLink(programUrl: string | undefined, officialSite: string | undefined): string | undefined {
  const ph = host(programUrl);
  if (!ph) return undefined;
  const oh = host(officialSite);
  if (sameSite(ph, oh)) return programUrl;
  if (isAggregator(ph)) return officialSite;
  return programUrl;
}
