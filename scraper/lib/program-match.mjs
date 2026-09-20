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
//   * уровень программы обязан совпасть, если он известен с обеих сторон
//     (уровень строки — через rowLevel: у QS он в поле `sourceLevel`);
//   * строке, чья приставка называет квалификацию вне схемы каталога
//     («Graduate Certificate in ...»), третья ступень не положена вовсе;
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
// Американские аббревиатуры добавлены 20.09.2026 по замеру Kaplan: 646 строк из 4 784
// (ASU, UConn, Pace, Simmons, Oregon) шли без уровня и без sourceLevel только потому,
// что название начинается с «BS …», «MS …», «BSE …», «MPA …». Список — только
// первое слово, поэтому «MS» здесь не спутать ни с чем внутри названия.
const LEVEL_BY_AWARD = [
  [['bachelor', 'bachelors', 'bsc', 'ba', 'bba', 'beng', 'bcom', 'bed', 'bfa', 'barch', 'llb',
    'bs', 'bse', 'bsba', 'bsn', 'bsw', 'bsd', 'bsla', 'bmus', 'bmgt', 'bgm', 'bis', 'bae', 'bsed'], 'bachelor'],
  [['master', 'masters', 'msc', 'ma', 'mba', 'meng', 'mres', 'mphil', 'llm', 'med', 'mfa', 'march',
    'ms', 'mse', 'mpa', 'msw', 'mpp', 'mla', 'mph', 'mpm', 'mm', 'mgm', 'mns', 'mc', 'mas', 'mps', 'mhi', 'mls'], 'master'],
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

// Уровни источников → уровни схемы каталога (site/src/schema/university.ts).
// Карта жила в kompas-programs-backfill.mjs; вынесена сюда, чтобы добор и
// сопоставление читали уровень строки ОДИНАКОВО. Пока карта была только в доборе,
// матчер уровень строки QS вовсе не видел: он читает `level`, а QS кладёт уровень
// в `sourceLevel` — из-за этого 187 строк уходили в «спорные» на ровном месте
// («History» при кандидатах «BA History» и «MA History»), а 123 садились на
// программу чужого уровня (строка магистратуры на бакалаврскую программу).
export const LEVEL_MAP = {
  bachelor: 'bachelor', master: 'master', phd: 'phd', foundation: 'foundation',
  pathway: 'foundation', language: 'english-language', 'english-language': 'english-language',
  'high-school': 'high-school', 'sixth-form': 'sixth-form', 'short-course': 'short-course',
};

// Разметка уровня самого источника (поле sourceLevel у QS).
// null — уровень назван, но схема каталога его не принимает: такую строку нельзя
// ни привязать по уровню, ни подогнать под соседний, она уходит кейсом.
export const SOURCE_LEVEL_MAP = {
  // QS
  Bachelors: 'bachelor', Masters: 'master', PhD: 'phd',
  'High School': 'high-school', Pathway: 'foundation', 'English Course': 'english-language',
  Undergraduate: 'bachelor', Postgraduate: 'master', Foundation: 'foundation',
  // edvoy: своя разметка. Добавлена 23.08 (3.5-g) — без неё 390 строк с пустым
  // `level` считались безуровневыми, хотя источник уровень называет.
  Doctorate: 'phd', PreMasters: 'foundation',
  Language: 'english-language', PresessionalEnglish: 'english-language',
  ALevel: 'sixth-form', ASLevel: 'sixth-form',
  GCSEgradesAC: 'high-school', GCSEgradesDG: 'high-school',
  ProfessionalShortCourse: 'short-course',
  // studygroup, iapro
  'Undergraduate Degree': 'bachelor', 'Postgraduate Degree': 'master',
  'Graduate Degree': 'master', 'Preparatory Programme': 'foundation',
  // квалификации вне схемы каталога (8 уровней): под чужой уровень не подгоняем
  Diploma: null, 'Graduate Diploma': null, 'Advanced Diploma': null,
  Certificate: null, 'Graduate Certificate': null, 'Certificate of Higher Education': null,
  // намеренно не размечены: 'Undergraduate + Foundation' (два уровня разом, у строки
  // и так заполнен level), 'Continuing Education', 'Apprenticeships' — улик нет.
};

// Приставки, которые называют квалификацию, которой в схеме каталога нет
// (8 уровней, `certificate` и `diploma` среди них отсутствуют). Такую строку
// нельзя привязывать по названию без приставки: «Graduate Certificate in Commerce»
// и «Master of Commerce» после снятия приставки оба дают «commerce», а это
// разные квалификации. Замер 23.08: так склеилось 10 строк.
const UNSUPPORTED_AWARDS = [
  'graduate diploma in', 'postgraduate diploma in', 'advanced diploma in',
  'graduate diploma', 'postgraduate diploma', 'advanced diploma',
  'graduate certificate in', 'postgraduate certificate in',
  'graduate certificate', 'postgraduate certificate',
  'diploma in', 'certificate in', 'diploma of', 'certificate of',
  'pgdip', 'pgcert', 'pgce', 'hnd', 'hnc', 'foundation diploma in',
];

/** Называет ли само название квалификацию, которой нет в схеме каталога. */
export function unsupportedAwardInTitle(title) {
  const t = norm(title);
  return UNSUPPORTED_AWARDS.some((a) => t === a || t.startsWith(a + ' '));
}

/**
 * Уровень строки выгрузки: { level, from }.
 * `from`: 'source' — поле level источника, 'sourceLevel' — его собственная разметка,
 * 'title' — явная приставка степени в названии, 'unsupported' — уровень назван,
 * но схема каталога его не принимает, null — уровня нет нигде.
 * Порядок тот же, что был в доборе: поле источника важнее его разметки, название — последнее.
 */
export function rowLevel(row) {
  const raw = row.level ? String(row.level).toLowerCase() : null;
  const key = row.sourceLevel ? String(row.sourceLevel).trim() : null;
  const mapped = key ? SOURCE_LEVEL_MAP[key] : undefined;
  if (raw && LEVEL_MAP[raw]) return { level: LEVEL_MAP[raw], from: 'source' };
  if (mapped) return { level: mapped, from: 'sourceLevel' };
  // Порядок важен: годная разметка источника проверяется РАНЬШЕ непринимаемого
  // поля level. Строка с level: 'diploma' и sourceLevel: 'Masters' — магистратура,
  // а не кейс. Так считал добор до выноса карты сюда, поведение сохранено.
  if (raw && !LEVEL_MAP[raw]) return { level: null, from: 'unsupported', raw };
  if (mapped === null) return { level: null, from: 'unsupported', raw: key };
  const guess = levelFromTitle(row.title);
  if (guess) return { level: guess, from: 'title' };
  // Явная приставка степени важнее: «Master of ...» выше уже вернулось.
  if (unsupportedAwardInTitle(row.title)) {
    return { level: null, from: 'unsupported', raw: norm(row.title).split(' ').slice(0, 2).join(' ') };
  }
  return { level: null, from: null };
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

  // Уровень строки берём через rowLevel: у QS он лежит в `sourceLevel`, а не в `level`,
  // и без этого «History» при кандидатах «BA History» и «MA History» считалось спорным.
  const lv = rowLevel(row);
  // Квалификации, которой нет в схеме каталога, третья ступень не положена:
  // без приставки «Graduate Certificate in Commerce» неотличим от «Master of Commerce».
  // Точное совпадение названия (вторая ступень) для таких строк работает как прежде.
  if (lv.from === 'unsupported') return { program: null, how: 'none' };

  const st = stripAward(row.title);
  if (!st) return { program: null, how: 'none' };
  const pool = idx.byStripped.get(st);
  if (!pool || !pool.length) return { program: null, how: 'none' };

  // уровень должен совпасть, если он известен с обеих сторон
  const lvl = lv.level;
  const fit = lvl ? pool.filter((p) => !p.level || p.level === lvl) : pool;
  if (fit.length === 1) return { program: fit[0], how: 'award-stripped' };
  if (fit.length > 1) return { program: null, how: 'ambiguous' };
  return { program: null, how: 'none' };
}
