// program-level.mjs — какую квалификацию называет САМО название программы.
//
// ЗАЧЕМ ОТДЕЛЬНЫМ МОДУЛЕМ. Эвристика «по названию видно уровень» жила тремя копиями
// (audit-catalog.mjs, fix-catalog.mjs, kompas-newcards-build.mjs) с припиской
// «держать в синхроне». Синхронизировать копии руками не выходит: одна карта уровней,
// размноженная по скриптам, — это два разных ответа на один вопрос (та же беда, что
// чинили в матчере 23.08). Ответ должен быть один, и он здесь.
//
// ЧТО ИЗМЕНИЛОСЬ ПО СУЩЕСТВУ. Прежняя карта была списком «первое совпадение выигрывает»
// в порядке master → bachelor → phd. На таком порядке ломались два разряда:
//
//   1. «M.B.A.Business Administration» — внутри аббревиатуры MBA сидит «B.A.»,
//      и проверка бакалавриата срабатывала на куске магистерской аббревиатуры.
//   2. «PhD/MA by Research», «BEng … MEng …» — название честно называет ДВЕ
//      квалификации, а карта возвращала ту, что стояла в списке выше. Для гейта
//      это выглядело как ошибка данных, хотя ошибки нет.
//
// Здесь название разбирается на квалификации целиком: длинные аббревиатуры
// разбираются раньше коротких, поэтому MBA не распадается на BA. Если названа ровно
// одна квалификация — уровень известен. Если названы две и больше или ни одной —
// модуль молчит: выдумывать уровень нельзя (правило владельца).

// Порядок важен: сначала длинные и составные, иначе «M.B.A.» распадётся на «B.A.».
// abbr: аббревиатура — не считается, если сразу за ней идёт СТРОЧНАЯ буква.
// Это отсекает «MSci…» от «MSc», «Bed Management» от «BEd» и вообще любое слово,
// внутри которого аббревиатура оказалась случайно. Слитную запись выгрузок
// («M.B.A.Big Data», «M.Sc.Applied Neuropsychology») правило пропускает: там
// следующая буква заглавная.
// Слова идут ПЕРЕД аббревиатурами: иначе «Bachelor» съедается коротким «Ba»
// (альтернатива, стоящая в списке выше, выигрывает на той же позиции).
const TOKENS = [
  [String.raw`juris\s+doctorate?`, 'phd', false],
  [String.raw`doctorates?`, 'phd', false],
  [String.raw`doctoral`, 'phd', false],
  [String.raw`bachelors?`, 'bachelor', false],
  [String.raw`masters?`, 'master', false],
  [String.raw`postgraduate`, 'master', false],
  [String.raw`undergraduate`, 'bachelor', false],
  [String.raw`e\.?m\.?b\.?a\.?`, 'master', true],
  [String.raw`m\.?b\.?a\.?`, 'master', true],
  [String.raw`d\.?b\.?a\.?`, 'phd', true],
  [String.raw`ed\.?d\.?`, 'phd', true],
  [String.raw`d\.?phil\.?`, 'phd', true],
  [String.raw`ph\.?\s?d\.?`, 'phd', true],
  [String.raw`ll\.?m\.?`, 'master', true],
  [String.raw`ll\.?b\.?`, 'bachelor', true],
  [String.raw`m\.?sc\.?`, 'master', true],
  [String.raw`m\.?res\.?`, 'master', true],
  [String.raw`m\.?phil\.?`, 'master', true],
  [String.raw`m\.?a\.?`, 'master', true],
  [String.raw`b\.?sc\.?`, 'bachelor', true],
  [String.raw`b\.?eng\.?`, 'bachelor', true],
  [String.raw`b\.?com\.?`, 'bachelor', true],
  [String.raw`b\.?const\.?`, 'bachelor', true],
  [String.raw`b\.?a\.?`, 'bachelor', true],
];

// Чего здесь намеренно НЕТ:
//   • MEd, BEd, MArch, BArch — неотличимы от обычных слов («Med School»,
//     «Bed Management», «March intake»), когда регистр в выгрузке не гарантирован.
// Пропущенный уровень безопаснее выдуманного.

// Интегрированные степени: MEng и MSci — первое высшее с бакалаврским входом,
// а не магистратура. Источник зовёт их undergraduate, и это не ошибка. О таких
// названиях модуль не имеет мнения вовсе — ни как о бакалавриате, ни как о
// магистратуре, — иначе «BEng … MEng …» уехало бы в бакалавриат, а «MEngPetroleum
// Engineering» в магистратуру, и оба раза мы бы спорили с источником без улик.
const INTEGRATED = /\b(?:m\.?eng\.?|m\.?sci\.?)/gi;

const SCAN = new RegExp('\\b(?:' + TOKENS.map(([src]) => src).join('|') + ')', 'gi');
const ANCHORED = TOKENS.map(([src, family, abbr]) => [new RegExp('^(?:' + src + ')$', 'i'), family, abbr]);

/**
 * Какие квалификации названы в заголовке программы.
 * @returns {string[]} подмножество ['bachelor','master','phd'] без повторов
 */
// «MSci» — это не «MSc»: аббревиатуру продолжает строчная буква, значит перед нами
// другое слово. Регистр проверяем по исходной строке, а не флагом регулярки.
const abbrEnds = (s, end) => { const c = s[end]; return !(c && c >= 'a' && c <= 'z'); };

export function qualificationFamilies(title) {
  const s = String(title ?? '');
  const integ = new RegExp(INTEGRATED.source, 'gi');
  let g;
  while ((g = integ.exec(s)) !== null) {
    if (g[0] === '') { integ.lastIndex++; continue; }
    if (abbrEnds(s, g.index + g[0].length)) return [];   // интегрированная степень — мнения нет
  }
  const found = new Set();
  const re = new RegExp(SCAN.source, 'gi');
  let m;
  while ((m = re.exec(s)) !== null) {
    if (m[0] === '') { re.lastIndex++; continue; }
    for (const [anchored, family, abbr] of ANCHORED) {
      if (!anchored.test(m[0])) continue;
      if (abbr && !abbrEnds(s, m.index + m[0].length)) break;
      found.add(family);
      break;
    }
  }
  return [...found];
}

/**
 * Уровень, который название называет ОДНОЗНАЧНО. Иначе null — «модуль не знает».
 * Молчание здесь не дыра, а отказ гадать: «PhD/MA by Research» — законное название
 * совместной программы, а не кривые данные.
 */
export function inferLevel(title) {
  const fams = qualificationFamilies(title);
  return fams.length === 1 ? fams[0] : null;
}

/** Уровни каталога, к которым эвристика вообще применима. */
export const DEGREE_LEVELS = new Set(['bachelor', 'master', 'phd']);
