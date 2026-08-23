// Сопоставление программы выгрузки агрегатора с программой карточки.
// Один модуль на все скрипты КОМПАСа, чтобы применение цен и сверка считали одинаково.
//
// Три ступени, от строгой к мягкой:
//   1. точная ссылка на программу;
//   2. точное совпадение названия после нормализации;
//   3. совпадение названия БЕЗ приставки степени — «Advertising and Public Relations»
//      против «Bachelor in Advertising and Public Relations». Источник часто отдаёт
//      голое название, а в карточке оно с приставкой: на этом ломалось 5 919 привязок.
//
// Третья ступень намеренно узкая, потому что нечёткое сравнение здесь опасно:
// «Business and Management» и «Business and Management and Computing» оба похожи
// на «BSc Business and Management», а это разные программы. Поэтому:
//   * приставка отрезается только известная (список ниже), а не «первое слово»;
//   * остаток должен совпасть ТОЧНО, никакой похожести;
//   * уровень программы обязан совпасть, если он известен с обеих сторон;
//   * если после отрезания подходит больше одной программы карточки — не привязываем,
//     это кейс оператору.

export const norm = (s) => String(s || '').toLowerCase().replace(/[’'`]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim();

// Приставки степени. Порядок важен: длинные раньше коротких.
const AWARDS = [
  'bachelor of science in', 'bachelor of arts in', 'bachelor of engineering in',
  'bachelor of business administration in', 'bachelor of commerce in',
  'bachelor of science', 'bachelor of arts', 'bachelor of', 'bachelors in', 'bachelor in', 'bachelor',
  'master of science in', 'master of arts in', 'master of engineering in',
  'master of business administration in', 'master of science', 'master of arts',
  'master of', 'masters in', 'master in', 'masters', 'master',
  'doctor of philosophy in', 'doctor of philosophy',
  'graduate diploma in', 'postgraduate diploma in', 'advanced diploma in',
  'graduate certificate in', 'postgraduate certificate in',
  'bsc hons', 'ba hons', 'bba hons', 'beng hons', 'llb hons', 'bcom hons', 'bed hons',
  'msc hons', 'ma hons', 'meng hons',
  'bsc', 'ba', 'bba', 'beng', 'bcom', 'bed', 'bfa', 'barch', 'llb',
  'msc', 'ma', 'mba', 'meng', 'mres', 'mphil', 'llm', 'med', 'mfa', 'march', 'phd',
  'hons',
];

/** Название без приставки степени. Пустая строка — значит от названия ничего не осталось. */
export function stripAward(title) {
  let s = norm(title);
  let changed = true;
  while (changed) {
    changed = false;
    for (const a of AWARDS) {
      if (s === a) return '';
      if (s.startsWith(a + ' ')) { s = s.slice(a.length + 1); changed = true; break; }
    }
    if (s.startsWith('in ') || s.startsWith('of ')) { s = s.slice(3); changed = true; }
  }
  return s.trim();
}

// Уровень по явной приставке степени в названии. Решение владельца 23.08:
// когда источник уровень не проставил, но в названии он написан прямо
// («MSc Data Science», «Bachelor of Arts»), это улика источника, а не догадка.
// Прецедент от 20.08: при противоречии уровень берётся из названия — оно конкретнее.
const LEVEL_BY_AWARD = [
  [['bachelor', 'bachelors', 'bsc', 'ba', 'bba', 'beng', 'bcom', 'bed', 'bfa', 'barch', 'llb'], 'bachelor'],
  [['master', 'masters', 'msc', 'ma', 'mba', 'meng', 'mres', 'mphil', 'llm', 'med', 'mfa', 'march'], 'master'],
  [['phd', 'doctor'], 'phd'],
  [['foundation'], 'foundation'],
];

/** Уровень из названия либо null. Смотрит только на первое слово. */
export function levelFromTitle(title) {
  const words = norm(title).split(' ');
  const first = words[0];
  if (!first) return null;
  // «Doctor of Philosophy» — только в этом сочетании, иначе это медицина
  if (first === 'doctor') return words[1] === 'of' && words[2] === 'philosophy' ? 'phd' : null;
  for (const [list, level] of LEVEL_BY_AWARD) {
    if (list.includes(first)) return level;
  }
  return null;
}

/** Индексы по программам карточки. Строится один раз на карточку. */
export function buildIndex(programs) {
  const list = programs || [];
  // Ссылка годится для сопоставления, только если внутри карточки она ведёт ровно
  // к одной программе. У QS programUrl — общая ссылка на портал: её делят 35 238
  // строк из 35 259. Если такая ссылка окажется у программы карточки, по первому
  // правилу на неё сядет вся выгрузка вуза разом.
  const urlCount = new Map();
  for (const p of list) {
    if (p.programUrl) urlCount.set(p.programUrl, (urlCount.get(p.programUrl) || 0) + 1);
  }
  const byUrl = new Map(), byTitle = new Map(), byStripped = new Map();
  for (const p of list) {
    if (p.programUrl && urlCount.get(p.programUrl) === 1 && !byUrl.has(p.programUrl)) byUrl.set(p.programUrl, p);
    const k = norm(p.title);
    if (k && !byTitle.has(k)) byTitle.set(k, p);
    const st = stripAward(p.title);
    if (st) {
      if (!byStripped.has(st)) byStripped.set(st, []);
      byStripped.get(st).push(p);
    }
  }
  return { byUrl, byTitle, byStripped };
}

/**
 * Ищет программу карточки под строку выгрузки.
 * Возвращает { program, how } либо { program: null, how: 'none' | 'ambiguous' }.
 */
export function matchProgram(idx, row) {
  if (row.programUrl) {
    const hit = idx.byUrl.get(row.programUrl);
    if (hit) return { program: hit, how: 'url' };
  }
  const exact = idx.byTitle.get(norm(row.title));
  if (exact) return { program: exact, how: 'title' };

  const st = stripAward(row.title);
  if (!st) return { program: null, how: 'none' };
  const pool = idx.byStripped.get(st);
  if (!pool || !pool.length) return { program: null, how: 'none' };

  // уровень должен совпасть, если он известен с обеих сторон
  const lvl = row.level || null;
  const fit = lvl ? pool.filter((p) => !p.level || p.level === lvl) : pool;
  if (fit.length === 1) return { program: fit[0], how: 'award-stripped' };
  if (fit.length > 1) return { program: null, how: 'ambiguous' };
  return { program: null, how: 'none' };
}
