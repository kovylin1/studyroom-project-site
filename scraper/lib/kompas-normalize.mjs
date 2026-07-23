// kompas-normalize.mjs — единая форма источника для замера расхождений (КОМПАС, сессия 4).
//
// Зачем отдельный файл: у шести коллекторов цена лежит в трёх разных полях
// (`tuition` числом, `tuition` объектом, `feePerYear`), и сравнивать их «как есть»
// значит получить ложные «цены нет». Урок сессии 3.5: цена без валюты — недостоверность,
// поэтому сумма без валюты сюда не проходит.

// Названия сравниваем нормализованными: регистр, пунктуация и служебные хвосты
// («(Hons)», «with foundation year») различий по сути не дают, а расхождений плодят много.
const STOP = new Set(['the', 'of', 'and', 'in', 'with', 'for', 'a', 'an', 'hons', 'honours', 'degree']);

// Источники часто ставят перед названием код степени: «PGDipFA Postgraduate Diploma
// in Fine Arts», «BSc(Hons) Bachelor of Science…». Снимаем его, когда остаток
// начинается с полного слова степени, — иначе одна и та же программа расходится
// с каталогом дважды: и как «нет в карточке», и как «нет в источнике».
const DEGREE_WORD = /^(Bachelor|Master|Postgraduate|Graduate|Doctor|Diploma|Certificate|Foundation|PhD)\b/i;

export function stripDegreeCode(raw) {
  const s = String(raw ?? '').trim();
  const m = s.match(/^([A-Za-z][A-Za-z]{0,14}(?:\([A-Za-z]+\))?)\s+(.*)$/);
  if (m && DEGREE_WORD.test(m[2]) && !DEGREE_WORD.test(m[1])) return m[2];
  return s;
}

export function normTitle(s) {
  return String(stripDegreeCode(s) ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9а-яё ]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function titleTokens(s) {
  return new Set(normTitle(s).split(' ').filter((t) => t && !STOP.has(t)));
}

// Жаккар по токенам. Порог подобран так, чтобы «BSc Computer Science» и
// «Computer Science BSc (Hons)» считались одной программой, а «Computer Science»
// и «Computer Engineering» — разными.
export function similarity(a, b) {
  const A = titleTokens(a); const B = titleTokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

export const SIM_THRESHOLD = 0.8;

// Одно название — подмножество другого по словам («Business Studies» внутри
// «Business Studies Accounting»). Это не разное написание, а специализация:
// пара такого рода — брак, оплаченный в сессии 3.5, и в совпадения не идёт.
export function isSubsetPair(a, b) {
  const A = titleTokens(a); const B = titleTokens(b);
  if (!A.size || !B.size || A.size === B.size) return false;
  const [small, big] = A.size < B.size ? [A, B] : [B, A];
  for (const t of small) if (!big.has(t)) return false;
  return true;
}

// --------------------------------------------------------------------- цена --
// Возвращает { amount, currency, basis, audience } либо null.
// Сумма без валюты отбрасывается сознательно (правило «не фабриковать»).
export function normFee(p) {
  let amount = null; let currency = null; let basis = null; let audience = null;

  if (p.tuition && typeof p.tuition === 'object') {
    amount = p.tuition.amount ?? null;
    currency = p.tuition.currency ?? null;
  } else if (typeof p.tuition === 'number') {
    amount = p.tuition;
    currency = p.currency ?? null;
  } else if (typeof p.feePerYear === 'number') {
    amount = p.feePerYear;
    currency = p.currency ?? null;
  }

  basis = p.feeBasis ?? p.feeScope ?? null;
  audience = p.feeAudience ?? null;

  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return null;
  if (!currency) return null;
  return { amount, currency, basis, audience };
}

// Программа источника в единой форме.
export function normProgram(p, src, srcCurrency) {
  const fee = normFee({ ...p, currency: p.currency ?? srcCurrency ?? null });
  return {
    title: String(p.title ?? '').trim(),
    norm: normTitle(p.title),
    level: p.level ?? null,
    duration: p.duration ?? p.durationYears ?? null,
    fee,
    programUrl: p.programUrl ?? null,
    via: src,
  };
}

// Программа каталога в единой форме: цена карточки лежит не в программе,
// а в `tuition.byProgram[slug]` с общей валютой карточки.
export function normCatalogProgram(p, card) {
  const t = card.tuition ?? {};
  const raw = t.byProgram ? t.byProgram[p.slug] : undefined;
  const amount = typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : null;
  return {
    slug: p.slug,
    title: String(p.title ?? '').trim(),
    norm: normTitle(p.title),
    level: p.level ?? null,
    duration: p.durationYears ?? null,
    fee: amount && t.currency ? { amount, currency: t.currency, basis: null, audience: null } : null,
  };
}
