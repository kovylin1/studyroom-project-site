// numbers.mjs — парсинг и санити-проверка числовых фактов каталога (СОРОКА).
//
// Деньги парсим из строк вида "19950 GBP", "£250/week", "Starts from 18,950 GBP",
// "$12,000 per year". Диапазоны — грубые «волчьи флажки» по валюте: цель ловить
// мусор (опечатки, месячную цену в годовом поле), а не спорить о реальных ценах.

const SYMBOL_TO_CODE = { '£': 'GBP', '€': 'EUR', '$': 'USD', '₸': 'KZT', '₽': 'RUB' };
const CODES = ['USD', 'EUR', 'GBP', 'KZT', 'RUB', 'CAD', 'AUD', 'NZD'];

const PER_RE = /(?:\/|\bper\s+|\bp\/?)(week|wk|w\b|month|mo\b|year|yr|annum|semester|term|night)/i;

function normalizePer(raw) {
  if (!raw) return null;
  const p = raw.toLowerCase();
  if (p.startsWith('w')) return 'week';
  if (p.startsWith('mo')) return 'month';
  if (p.startsWith('y') || p === 'annum') return 'year';
  if (p === 'semester' || p === 'term') return 'term';
  if (p === 'night') return 'night';
  return null;
}

// Все денежные токены строки → [{ amount, currency, per }]. currency/per могут быть null.
export function parseMoney(str) {
  const s = String(str || '');
  const out = [];
  // число: «18,950» / «18 950» / «18300» / «9250.50» (и с разделителями, и сплошное)
  const NUM = String.raw`(\d{1,3}(?:[,. ]\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)`;
  // Хвост с per-периодом — lookahead, чтобы не съедать следующий денежный токен
  // («from £95 to £280 per week» — иначе « to £» первого матча глотает «£280»).
  const TAIL = String.raw`(?=([^\d]{0,12}))`;
  // символ перед числом: £9,250.50 …/week
  const symRe = new RegExp(String.raw`([£€$₸₽])\s?${NUM}${TAIL}`, 'g');
  // число + код валюты: 19950 GBP, 18,950 gbp (lookbehind — не начинать с середины числа)
  const codeRe = new RegExp(String.raw`(?<![\d.,])${NUM}\s?(USD|EUR|GBP|KZT|RUB|CAD|AUD|NZD)\b${TAIL}`, 'gi');
  // код валюты перед числом: GBP 150 per week, EUR 12.500
  const codeFirstRe = new RegExp(String.raw`\b(USD|EUR|GBP|KZT|RUB|CAD|AUD|NZD)\s?${NUM}${TAIL}`, 'gi');
  for (const m of s.matchAll(symRe)) {
    const amount = parseAmount(m[2]);
    if (amount === null) continue;
    out.push({ amount, currency: SYMBOL_TO_CODE[m[1]] || null, per: perOf(m[3]) });
  }
  for (const m of s.matchAll(codeRe)) {
    const amount = parseAmount(m[1]);
    if (amount === null) continue;
    out.push({ amount, currency: m[2].toUpperCase(), per: perOf(m[3]) });
  }
  for (const m of s.matchAll(codeFirstRe)) {
    const amount = parseAmount(m[2]);
    if (amount === null) continue;
    out.push({ amount, currency: m[1].toUpperCase(), per: perOf(m[3]) });
  }
  return out;
}

function perOf(tail) {
  const m = PER_RE.exec(tail || '');
  return m ? normalizePer(m[1]) : null;
}

function parseAmount(raw) {
  // "18,950" / "18 950" / "9250.50" → число; "18.950" (евро-тысячи) → 18950.
  let s = String(raw).replace(/[ ,]/g, '');
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Первый токен с известной валютой (для полей, где ожидается одна цена).
export function parseMoneyFirst(str) {
  const all = parseMoney(str);
  return all.find(t => t.currency) || all[0] || null;
}

// ---- санити-диапазоны ----

// Годовой tuition по валюте. Цель — выбросы на порядок, не точность.
export const TUITION_YEAR_RANGE = {
  GBP: [3000, 60000],
  USD: [2000, 85000],
  EUR: [1000, 45000],
  CAD: [5000, 70000],
  AUD: [8000, 60000],
  NZD: [8000, 55000],
  KZT: [300000, 15000000],
  RUB: [100000, 2000000],
};

// Жильё: недельная цена по валюте. month = week*4.33, year = week*52.
export const ACCOM_WEEK_RANGE = {
  GBP: [60, 600],
  USD: [80, 900],
  EUR: [50, 700],
  CAD: [100, 800],
  AUD: [100, 800],
  NZD: [100, 700],
  KZT: [15000, 300000],
  RUB: [3000, 80000],
};

// Короткие программы (языковые курсы, short-course, foundation) легитимно дешевле
// годового degree-диапазона — для них нижняя граница ослаблена до 5%.
const SHORT_LEVELS = new Set(['english-language', 'short-course', 'foundation']);

export function tuitionPlausible(amount, currency, level) {
  const r = TUITION_YEAR_RANGE[currency];
  if (!r) return null; // неизвестная валюта — не судим
  const lo = SHORT_LEVELS.has(level) ? r[0] * 0.05 : r[0];
  return amount >= lo && amount <= r[1];
}

// per: 'week'|'month'|'year'|'term'|'night'|null. null трактуем максимально мягко:
// верим, если попадает хоть в один из пересчитанных диапазонов.
export function accommodationPlausible(amount, currency, per) {
  const r = ACCOM_WEEK_RANGE[currency];
  if (!r) return null;
  const ranges = {
    week: [r[0], r[1]],
    month: [r[0] * 4.33, r[1] * 4.33],
    year: [r[0] * 52, r[1] * 52],
    term: [r[0] * 10, r[1] * 17],   // семестр ~10–17 недель
    night: [r[0] / 7, r[1] / 7],
  };
  if (per && ranges[per]) return amount >= ranges[per][0] && amount <= ranges[per][1];
  return Object.values(ranges).some(([lo, hi]) => amount >= lo && amount <= hi);
}

// ---- прочие числовые факты ----

export function ieltsPlausible(v) {
  return typeof v === 'number' && v >= 4 && v <= 9 && Math.round(v * 2) === v * 2;
}

export function toeflPlausible(v) {
  return typeof v === 'number' && v >= 30 && v <= 120;
}

export function gpaPlausible(v) {
  return typeof v === 'number' && v > 0 && v <= 4;
}

export function foundedYearPlausible(y) {
  return Number.isInteger(y) && y >= 800 && y <= 2026;
}

export function studentsPlausible(n) {
  return Number.isFinite(n) && n >= 50 && n <= 500000;
}

// keyFacts — свободный текст; вытаскиваем проверяемые паттерны.
// Возвращает [{ kind, value, raw }] только для распознанных фактов.
export function extractKeyFactNumbers(fact) {
  const s = String(fact || '');
  const out = [];
  let m;
  if ((m = /\b(?:founded|established|est\.?)\s*(?:in\s*)?(\d{3,4})\b/i.exec(s))) {
    out.push({ kind: 'foundedYear', value: Number(m[1]), raw: s });
  }
  // «students» считаем общим контингентом только без контекста размера класса/комнаты
  // («class size: 8 students», «apartment for 4 students» — не контингент вуза).
  if ((m = /\b(\d[\d,. ]{0,11})\+?\s*(?:students|undergraduates|postgraduates)\b/i.exec(s))
      && !/class|cohort|apartment|room|flat|ratio|each|per\b/i.test(s)) {
    const n = parseAmount(m[1]);
    if (n !== null) out.push({ kind: 'students', value: n, raw: s });
  }
  if ((m = /\b(\d{1,3}(?:\.\d+)?)\s*%/.exec(s))) {
    out.push({ kind: 'percent', value: Number(m[1]), raw: s });
  }
  if ((m = /\b(?:ranked|top)\s*#?\s*(\d{1,4})\b/i.exec(s))) {
    out.push({ kind: 'ranking', value: Number(m[1]), raw: s });
  }
  return out;
}

export function keyFactPlausible({ kind, value }) {
  if (kind === 'foundedYear') return foundedYearPlausible(value);
  if (kind === 'students') return studentsPlausible(value);
  if (kind === 'percent') return value >= 0 && value <= 100;
  if (kind === 'ranking') return value >= 1 && value <= 2000;
  return null;
}

// Относительная разница двух сумм (0 = равны).
export function relDiff(a, b) {
  if (!a || !b) return Infinity;
  return Math.abs(a - b) / Math.max(a, b);
}

export const CORROBORATE_TOL = 0.05; // ≤5% — источники согласны
export const MISMATCH_TOL = 0.15;    // >15% — расхождение, кейс на ревью
