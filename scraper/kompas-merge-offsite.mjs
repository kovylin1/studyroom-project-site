#!/usr/bin/env node
// kompas-merge-offsite.mjs — КОМПАС: свести программы QS с курсами офсайта
// и отдать ЧЕРНОВИКИ карточек + кейсы оператору.
//
// Разделение источников (решение владельца 2026-08-03):
//   цена  — от QS (feeBasis: campusLevelStated, цена уровня кампуса, не курса);
//   срок  — с офсайта (durationYears со страницы курса);
//   город — с офсайта, но ЗНАЧЕНИЕ ставит человек: коллектор отдаёт только улику.
//
// В живой каталог НИЧЕГО не пишем: карточки заводит человек (правило владельца 31.07).
// Выход — sources/kompas/newcards/*.draft.json, cases.json и отчёт в чат.
//
// Как ищется пара «программа QS ↔ курс офсайта»:
//
// 1. У QS название несёт вариант курса («… three year degree», «… with Integrated
//    Foundation», «… TOP-UP»), у офсайта вариант сидит в АДРЕСЕ, а не в заголовке:
//    заголовок «Business Management» одинаков у /business-management-ba-hons и
//    /business-management-ba-hons-top-up. Поэтому название QS сравнивается и с
//    заголовком офсайта, и со слагом адреса — берётся лучшее из двух.
// 2. Вариант из названия QS снимается ДО сравнения (иначе «Animation BA (Hons)
//    three year degree» не сойдётся с «Animation BA(Hons)»), но запоминается:
//    если вариант есть, страница с тем же маркером в адресе получает прибавку,
//    а страница-вариант без запроса варианта — штраф.
// 3. Уровень сверяется, только когда известен с обеих сторон: у Worcester офсайт
//    уровень почти нигде не отдаёт (195 из 245 — null), жёсткая сверка вырезала бы всё.
//
// PHBS, MPW, ILAC сводятся ПО СПИСКУ, а не поиском: их адаптеры целились в конкретные
// страницы под конкретные строки QS, и названия там расходятся принципиально
// («Cross-Border MA in Finance» у QS против «Cross-Border Master's in Finance» на сайте —
// Жаккар 0.6, ниже любого разумного порога). Поиск по названию тут дал бы не «нет пары»,
// а тихий брак.
//
// Запуск: node kompas-merge-offsite.mjs [--json]

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { KOMPAS_DIR, args, logger } from './lib/kompas-collect.mjs';
import { normTitle, titleTokens, tokensOfNorm, SIM_THRESHOLD } from './lib/kompas-normalize.mjs';

const log = logger('merge');
const TODAY = new Date().toISOString().slice(0, 10);
const OUT_DIR = path.join(KOMPAS_DIR, 'newcards');

const readJson = async (f) => JSON.parse(await fs.readFile(f, 'utf8'));
const hashOf = (o) => crypto.createHash('sha1').update(JSON.stringify(o)).digest('hex').slice(0, 16);
const slugify = (s) => (s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').slice(0, 80).replace(/^-+|-+$/g, '');

// --------------------------------------------------------------------- вузы --

// Город берётся из описания вуза у QS (решение владельца 2026-08-03); где кампусов
// несколько — перечисляются все, потому что учатся и там, и там. Значение и точная
// цитата-источник лежат рядом, чтобы человек мог проверить не выходя из файла.
const UNIS = [
  {
    slug: 'falmouth-university',
    name: 'Falmouth University',
    country: 'United Kingdom',
    offsite: 'falmouth',
    qs: ['falmouth-university'],
    mode: 'fuzzy',
    city: 'Falmouth, Penryn',
    citySource: 'QS, описание вуза: «across two campuses (Falmouth and Penryn)»',
  },
  {
    // У QS вуз приходит ДВУМЯ выгрузками (бейдж-дубль портала, урок QS-5):
    // undergraduate 113 строк по 14 700 GBP и postgraduate 99 строк по 14 700/17 400.
    // Пересечение названий — ноль, значит объединение без дедупликации безопасно.
    slug: 'university-of-worcester',
    name: 'University of Worcester',
    country: 'United Kingdom',
    offsite: 'worcester',
    qs: ['university-of-worcester-undergraduate', 'university-of-worcester-postgraduate'],
    mode: 'fuzzy',
    // Единственный из пяти, у кого города нет в описании QS. Берётся с офсайта;
    // json-ld того же сайта отдаёт «Worcestershire» — это графство, не город.
    city: 'Worcester',
    citySource: 'офсайт (у QS в описании города нет); json-ld отдаёт графство «Worcestershire» — не брать',
  },
  {
    slug: 'peking-university-hsbc-business-school',
    name: 'Peking University HSBC Business School',
    country: 'China',
    offsite: 'phbs',
    qs: ['peking-university-hsbc-business-school'],
    mode: 'manual',
    // Обе строки QS — программы британского кампуса, их страницы на pku.org.uk.
    // Адреса на офсайте набраны с опечаткой и вразнобой: у финансов
    // `Cross_Border_Master_s_i_Finance`, у менеджмента `..._s_in_Management`.
    // Поэтому пары ведутся по подстроке адреса, а не по шаблону.
    pairs: [
      ['Cross-Border MA in Finance', 'Cross_Border_Master_s_i_Finance'],
      ['Cross-Border MA Management', 'Cross_Border_Master_s_in_Management'],
    ],
    city: 'Shenzhen, Oxfordshire',
    citySource: 'офсайт: «Year 1 in Oxfordshire, UK; Year 2 in Shenzhen, China» — учатся в обоих',
    // У QS цена пришла без валюты (272 895), поэтому берётся с офсайта, где она
    // расписана прямо. Сумма сходится с шапкой QS «£29,500», а 272 895 — та же
    // сумма в юанях по курсу ~9.25. ВНИМАНИЕ: это цена за ВСЮ программу (два года),
    // а не за год, — см. кейс.
    feeOverride: {
      amount: 29500,
      currency: 'GBP',
      note: 'за всю программу (2 года): год 1 Оксфордшир £23 000 + год 2 Шэньчжэнь £6 500',
      source: 'https://www.pku.org.uk/Study/Cross_Border_Master_s_i_Finance.htm — «Tuition fee (2026/27) Year 1 Oxfordshire, UK £23,000; Year 2 Shenzhen, China £6,500»',
    },
  },
  {
    slug: 'mpw',
    name: 'MPW',
    country: 'United Kingdom',
    offsite: 'mpw',
    qs: ['mpw'],
    mode: 'manual',
    // У QS одна запись на три колледжа; страницы офсайта — по колледжу на курс.
    // Пара ведётся к лондонской странице как к представителю: срок на всех трёх
    // страницах один и тот же текст, а город — отдельное решение владельца.
    pairs: [
      ['1 year A Level', '/locations/london/courses/a-level/'],
      ['2 year A Level', '/locations/london/courses/a-level/'],
      ['GCSE Subjects', '/locations/london/courses/gcse/'],
    ],
    city: 'London, Birmingham, Cambridge',
    citySource: 'QS, описание вуза: «three fifth- and sixth-form colleges in London, Birmingham and Cambridge»',
  },
  {
    slug: 'ilac-international-language-academy-of-canada',
    name: 'ILAC — International Language Academy of Canada',
    country: 'Canada',
    offsite: 'ilac',
    qs: ['ilac-international-language-academy-of-canada'],
    mode: 'manual',
    // У ILAC две страницы с одинаковым заголовком «University Pathway Program»:
    // для подростков и для взрослых. Строка QS — подростковая («Young Adults 15 - 18»).
    pairs: [
      ['Young Adults 15 - 18 University Pathway Program', 'university-pathway-program-young-adults'],
    ],
    city: 'Toronto, Vancouver',
    citySource: 'QS, описание вуза: «with campuses in Toronto and Vancouver»',
  },
];

// ----------------------------------------------------------------- варианты --
// Вариант курса — не другая программа, а та же с добавкой: нулевой год, практика,
// top-up, заочная форма. У QS он висит в названии строки, у офсайта — в адресе
// страницы. Словарь ОДИН на обе стороны: иначе «Integrated Foundation Year BA/BSc»
// (самостоятельная программа Falmouth) снимается как вариант только у офсайта,
// и своя же страница получает штраф за «лишний вариант».

const VARIANTS = [
  { key: 'foundation', re: /\b(?:with[ -](?:an?[ -])?)?(?:integrated[ -])?foundation(?:[ -]year)?\b/i },
  { key: 'top-up', re: /\btop[ -]?up\b/i },
  { key: 'placement', re: /\b(?:with[ -](?:a[ -])?)?(?:professional[ -])?placement(?:[ -]year)?\b|\bsandwich\b/i },
  { key: 'part-time', re: /\bpart[ -]?time\b/i },
  { key: 'study-abroad', re: /\b(?:with[ -])?study[ -]abroad\b/i },
];

/**
 * Снять маркеры варианта с текста.
 *
 * Если после снятия не остаётся ничего — маркер НЕ снимаем: значит текст и есть
 * название программы, а не хвост к чужому названию. Ровно этот случай — адрес
 * Falmouth `/study/undergraduate/integrated-foundation-year`.
 */
function stripVariants(text) {
  let base = String(text ?? '');
  const variants = new Set();
  for (const v of VARIANTS) {
    if (!v.re.test(base)) continue;
    const cut = base.replace(v.re, ' ').replace(/\s+/g, ' ').trim();
    if (!cut) continue;
    variants.add(v.key);
    base = cut;
  }
  return { base: base.replace(/\s+/g, ' ').trim(), variants };
}

// «three year degree», «1 year A Level» — срок стоит в самом названии строки QS.
// Это единственный источник срока для A Level у MPW (на странице колледжа их два сразу).
const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 };
const YEARS_IN_TITLE = /\b(one|two|three|four|five|six|seven|\d{1})[\s-]?year(?:s)?\b(?:\s+degree)?/i;

function readTitle(raw) {
  let text = normTitle(raw);
  let statedYears = null;
  const m = text.match(YEARS_IN_TITLE);
  if (m) {
    const n = WORDS[m[1].toLowerCase()] ?? Number(m[1]);
    if (Number.isFinite(n) && n > 0 && n <= 8) statedYears = n;
    text = text.replace(YEARS_IN_TITLE, ' ');
  }
  const { base, variants } = stripVariants(text);
  return { core: base, variants, statedYears };
}

// ------------------------------------------------------------- сопоставление --

// Из адреса берём ТОЛЬКО последний сегмент: он и есть опознаватель курса.
// Путь целиком тянет за собой служебные слова («courses», «study», «undergraduate»),
// они разбавляют пересечение и сбивают счёт: «BA BUSINESS MANAGEMENT (HONS)» против
// /courses/business-management-ba-hons давало 0.75 вместо 1.0 из-за одного «courses».
// Год приёма в адресе — не часть названия курса. У Worcester он стоит у части
// страниц («law-llb-hons-2024», «law-with-politics-llb-hons-2022-entry») и ровно
// на один лишний токен разводил строку QS с её же страницей: 0.67 вместо 1.0.
const urlSlugText = (u) => {
  try {
    const seg = new URL(u).pathname.replace(/\/+$/, '').split('/').filter(Boolean).pop() ?? '';
    return seg.replace(/\.(html?|htm|php|aspx)$/i, '')
      .replace(/-(?:19|20)\d{2}(?:-entry)?$/i, '')
      .replace(/-entry$/i, '')
      .replace(/[_-]+/g, ' ').trim();
  } catch { return ''; }
};

/**
 * Одна правка Дамерау — вставка, удаление, замена или перестановка соседей.
 *
 * Перестановка нужна отдельно: у QS в выгрузке лежит «Television & Flim Production»,
 * и до Film отсюда две замены, а перестановка одна. Первая буква обязана совпадать,
 * иначе на коротких словах начинают липнуть чужие пары.
 */
function within1(a, b) {
  if (a === b) return true;
  if (a[0] !== b[0]) return false;
  const d = a.length - b.length;
  if (Math.abs(d) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  let ea = a.length - 1; let eb = b.length - 1;
  while (ea >= i && eb >= i && a[ea] === b[eb]) { ea--; eb--; }
  const ra = ea - i + 1; const rb = eb - i + 1; // что осталось несовпавшим
  if (d === 0) {
    if (ra <= 1) return true; // одна замена
    return ra === 2 && a[i] === b[i + 1] && a[i + 1] === b[i]; // перестановка соседей
  }
  return d > 0 ? rb <= 0 : ra <= 0; // одна вставка или удаление
}

/**
 * Жаккар по токенам, где токены длиной от четырёх символов считаются равными
 * при расхождении в один символ.
 *
 * Зачем: у QS в выгрузке живут опечатки и разнобой числа — «Television & Flim
 * Production» вместо Film, «Fine Arts BA (Hons)» против «Fine Art BA(Hons)» на сайте.
 * По строгому равенству это «нет пары» у шести программ Falmouth подряд, хотя
 * страница очевидна. Порог в один символ и требование общей первой буквы держат
 * «Computer»/«Computing» и «Game»/«Games» врозь настолько, насколько нужно.
 */
// Слова короче трёх букв сравниваем только точно; на равной длине нужно четыре
// буквы и больше, иначе «art»/«are» и подобное начнёт считаться одним словом.
const nearWord = (x, y) => Math.min(x.length, y.length) >= 3
  && (x.length !== y.length || Math.max(x.length, y.length) >= 4)
  && within1(x, y);

function jaccard(aTokens, bTokens) {
  if (!aTokens.size || !bTokens.size) return 0;
  const b = [...bTokens];
  const taken = new Set();
  let inter = 0;
  for (const t of aTokens) {
    if (bTokens.has(t) && !taken.has(t)) { taken.add(t); inter++; continue; }
    const near = b.find((x) => !taken.has(x) && nearWord(t, x));
    if (near) { taken.add(near); inter++; }
  }
  return inter / (aTokens.size + bTokens.size - inter);
}

const LEVEL_ALIAS = {
  language: 'english-language',
  certificate: 'short-course',
  diploma: 'short-course',
  'sixth-form': 'sixth-form',
};
const lvl = (v) => (v ? (LEVEL_ALIAS[v] ?? v) : null);

/**
 * Уровень, когда его не дали ни QS, ни страница курса (решение владельца 2026-08-03).
 *
 * Читается ТОЛЬКО однозначная разметка — код степени в адресе страницы или название
 * квалификации. Ни кредиты, ни срок в уровень не пересчитываются: это был бы вывод.
 * Что осталось без ответа — уходит кейсом, а не догадкой.
 */
const LEVEL_BY_MARK = [
  [/\bpgce\b/i, 'master'],          // postgraduate certificate in education
  [/\ba[ -]level\b/i, 'sixth-form'],
  [/\bgcse\b/i, 'high-school'],
  [/\b(ba|bsc|beng|llb|bmus|joint[ -]honours|hons)\b/i, 'bachelor'],
  [/\b(ma|msc|meng|mba|mres|mphil)\b/i, 'master'],
  [/\bphd\b/i, 'phd'],
];

export function levelFromMarks(title, url) {
  const hay = `${title || ''} ${urlSlugText(url || '')}`;
  for (const [re, level] of LEVEL_BY_MARK) if (re.test(hay)) return level;
  return null;
}

// Уровни сходятся, если хоть один неизвестен или они равны. Отдельно разрешена
// пара foundation↔bachelor: строка QS «… with Integrated Foundation» — это тот же
// бакалавриат с добавленным нулевым годом, и ведёт она на ту же страницу офсайта.
function levelsFit(qsLevel, offLevel, hasFoundationVariant) {
  const a = lvl(qsLevel); const b = lvl(offLevel);
  if (!a || !b) return true;
  if (a === b) return true;
  if (hasFoundationVariant && ((a === 'foundation' && b === 'bachelor') || (a === 'bachelor' && b === 'foundation'))) return true;
  return false;
}

/**
 * Счёт пары. Вариант курса снимается С ОБЕИХ сторон, дальше сравниваются основы,
 * а расхождение вариантов идёт отдельной поправкой.
 *
 * Прежний порядок (снять вариант только у QS, а странице-варианту дать прибавку)
 * ломался на «BA BUSINESS MANAGEMENT (HONS) TOP-UP»: основа сходилась с адресом
 * `business-management-ba-hons-top-up` лишь на 0.6, потому что «top up» оставалось
 * в токенах адреса, и прибавка 0.15 до порога не дотягивала.
 */
function scorePair(read, course) {
  // `read.core` и `titleCut.base` УЖЕ нормализованы — второй прогон normTitle
  // по ним терял токены (см. tokensOfNorm). Слаг адреса нормализуется впервые.
  const coreTokens = tokensOfNorm(read.core);
  const urlCut = stripVariants(urlSlugText(course.url));
  const titleCut = stripVariants(normTitle(course.title));

  const byTitle = jaccard(coreTokens, tokensOfNorm(titleCut.base));
  const byUrl = jaccard(coreTokens, titleTokens(urlCut.base));
  const base = Math.max(byTitle, byUrl);

  const want = read.variants;
  const have = new Set([...urlCut.variants, ...titleCut.variants]);
  const missing = [...want].filter((v) => !have.has(v));
  const extra = [...have].filter((v) => !want.has(v));

  let score = base;
  let variantNote = null;
  if (extra.length) {
    // У страницы вариант, которого строка QS не просит: это другая программа.
    score -= 0.35;
    variantNote = `у страницы лишний вариант: ${extra.join(',')}`;
  } else if (missing.length) {
    // Строка QS просит вариант, отдельной страницы под него нет — берём базовую,
    // но срок с неё уже нельзя считать сроком варианта.
    score -= 0.05;
    variantNote = `страницы под вариант ${missing.join(',')} нет, пара к базовой`;
  }
  return {
    score: Math.max(0, Math.min(1, score)),
    base, byTitle, byUrl, variantNote,
    variantExact: !missing.length && !extra.length,
    variantPageMissing: Boolean(missing.length),
  };
}

function matchFuzzy(qsProg, courses) {
  const read = readTitle(qsProg.title);
  const wantsFoundation = read.variants.has('foundation');
  const scored = courses
    .map((c) => ({ course: c, ...scorePair(read, c) }))
    .filter((r) => levelsFit(qsProg.level, r.course.level, wantsFoundation))
    .sort((a, b) => b.score - a.score || Number(b.variantExact) - Number(a.variantExact));

  const best = scored[0] ?? null;
  const runnerUp = scored[1] ?? null;
  if (!best || best.score < SIM_THRESHOLD) {
    return { read, hit: null, best, reason: best ? `лучший счёт ${best.score.toFixed(2)} < ${SIM_THRESHOLD}` : 'кандидатов нет' };
  }
  const ambiguous = Boolean(runnerUp && best.score - runnerUp.score < 0.02);
  return { read, hit: best, runnerUp, ambiguous, reason: null };
}

// --------------------------------------------------------------------- срок --

function pickDuration(read, hit) {
  const course = hit?.course ?? null;
  // Срок из названия QS сильнее: он относится к конкретной строке, а страница
  // офсайта часто общая на несколько сроков сразу («one year and two year courses»).
  if (read.statedYears) {
    return { years: read.statedYears, basis: 'qs-title', needsCheck: false, evidence: null };
  }
  if (course && typeof course.durationYears === 'number' && course.durationYears > 0) {
    // Срок со страницы — срок БАЗОВОГО курса. Если строка QS просит вариант
    // («с интегрированным нулевым годом», «с производственной практикой»), а
    // отдельной страницы под него нет, то её срок варианту не равен: у Falmouth
    // в сыром тексте прямо стоит «3 years / 4 years», и какое из двух — знает
    // только человек. Домысливать «база плюс год» нельзя, это вывод, а не факт.
    const rawHasTwo = /\d\s*(?:years?|yrs?)\s*[/,]|\bor\b\s*\d\s*year/i.test(String(course.durationRaw ?? ''));
    const needsCheck = Boolean(hit?.variantPageMissing || (read.variants.size && rawHasTwo));
    return {
      years: course.durationYears,
      basis: 'offsite-page',
      needsCheck,
      evidence: needsCheck ? String(course.durationRaw ?? '').slice(0, 160) : null,
    };
  }
  return {
    years: null,
    basis: null,
    needsCheck: true,
    evidence: course ? String(course.durationEvidence ?? course.durationRaw ?? '').slice(0, 200) || null : null,
  };
}

// ------------------------------------------------------------------ карточка --

function programSlug(title, used) {
  let base = slugify(title) || 'program';
  let s = base; let i = 2;
  while (used.has(s)) s = `${base}-${i++}`;
  used.add(s);
  return s;
}

function buildCard(uni, qsHead, rows, cityProposal) {
  const used = new Set();
  const programs = [];
  const byProgram = {};
  const currencies = new Set();

  for (const r of rows) {
    if (!r.duration.years) continue; // без срока схема карточку не соберёт
    if (r.duplicateOf) continue; // тот же курс другой строкой QS, см. кейс
    const slug = programSlug(r.qs.title, used);
    const marked = levelFromMarks(r.qs.title, r.hit?.course?.url);
    const p = {
      slug,
      title: r.qs.title,
      durationYears: r.duration.years,
      level: lvl(r.qs.level) ?? lvl(r.hit?.course?.level) ?? marked,
      source: 'qs-apply+offsite',
      verifiedBySite: r.duration.basis === 'offsite-page',
      confidence: r.confidence,
      kompasStatus: 'source-added',
      kompasCheckedAt: TODAY,
    };
    if (r.hit?.course?.url) p.programUrl = r.hit.course.url;
    if (!p.level) delete p.level;
    programs.push(p);
    // Сумма без валюты — не цена (правило «не фабриковать», урок сессии 3.5).
    // У PHBS QS отдаёт 272 895 без валюты; цена для него взята с офсайта (feeOverride),
    // где она расписана по годам и сходится с шапкой QS «£29,500».
    const fee = uni.feeOverride
      ?? (typeof r.qs.tuition === 'number' && r.qs.tuition > 0 && r.qs.currency
        ? { amount: r.qs.tuition, currency: r.qs.currency }
        : null);
    if (fee) {
      byProgram[slug] = fee.amount;
      currencies.add(fee.currency);
    }
  }

  const currency = currencies.size === 1 ? [...currencies][0] : null;
  const noLevel = programs.filter((p) => !p.level).map((p) => p.title);

  return {
    slug: uni.slug,
    name: uni.name,
    country: uni.country,
    city: uni.city ?? null,
    programs,
    tuition: { currency, byProgram },
    deadlines: {},
    requirements: { exams: [] },
    scholarships: [],
    lastChecked: TODAY,
    sourceUrl: qsHead.sourceUrl,
    sourceHash: hashOf({ qs: qsHead.slug, programs: programs.map((p) => p.slug) }),
    confidence: 'aggregator',
    language: 'en',
    _kompas: {
      draft: true,
      note: 'ЧЕРНОВИК. В живой каталог не класть: карточки заводит человек (правило 31.07).',
      builtAt: TODAY,
      priceFrom: 'qs-apply / campusLevelStated (цена уровня кампуса, не курса)',
      durationFrom: 'офсайт (страница курса) либо название строки QS',
      city: { value: uni.city ?? null, source: uni.citySource ?? null, ...cityProposal },
      feeNote: uni.feeOverride ? `${uni.feeOverride.note} — ${uni.feeOverride.source}` : null,
      // Чего карточке не хватает до схемы. Список не «на всякий случай»: каждый
      // пункт — поле, без которого zod карточку не пропустит.
      missing: [
        ...(uni.city ? [] : ['city — значение ставит человек по улике']),
        ...(currency ? [] : ['tuition.currency — цена у QS без валюты либо валюты разные']),
        ...(noLevel.length ? [`level у ${noLevel.length} программ: ${noLevel.slice(0, 5).join(', ')}${noLevel.length > 5 ? ' …' : ''}`] : []),
        ...(programs.length ? [] : ['programs — ни одной программы со сроком']),
      ],
    },
  };
}

// ---------------------------------------------------------------------- ход --

async function run() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const report = [];
  const allCases = [];

  for (const uni of UNIS) {
    const offsite = await readJson(path.join(KOMPAS_DIR, 'offsite', `${uni.offsite}.json`));
    const courses = offsite.courses.filter((c) => c.kind !== 'hub');
    const hubs = offsite.courses.length - courses.length;

    const heads = [];
    let qsPrograms = [];
    for (const f of uni.qs) {
      const j = await readJson(path.join(KOMPAS_DIR, 'extracts', 'qs', `${f}.json`));
      heads.push(j);
      qsPrograms.push(...j.programs.map((p) => ({ ...p, _qsFile: f })));
    }

    // Дубли строк у QS (портал повторяет запись) — по названию+уровню+цене.
    const seen = new Set();
    const dupes = [];
    qsPrograms = qsPrograms.filter((p) => {
      const k = `${normTitle(p.title)}|${p.level ?? ''}|${p.tuition ?? ''}`;
      if (seen.has(k)) { dupes.push(p.title); return false; }
      seen.add(k);
      return true;
    });

    const rows = [];
    const cases = [];
    const usedCourses = new Set();

    for (const qs of qsPrograms) {
      let read; let hit = null; let ambiguous = false; let reason = null; let best = null;

      if (uni.mode === 'manual') {
        read = readTitle(qs.title);
        const pair = uni.pairs.find(([t]) => normTitle(t) === normTitle(qs.title));
        const course = pair ? courses.find((c) => c.url.includes(pair[1])) : null;
        hit = course ? { course, score: 1, byTitle: null, byUrl: null } : null;
        reason = hit ? null : 'в списке пар нет строки (или страница не собрана)';
      } else {
        const m = matchFuzzy(qs, courses);
        read = m.read; hit = m.hit; ambiguous = Boolean(m.ambiguous); reason = m.reason; best = m.best;
      }

      const duration = pickDuration(read, hit);
      if (hit) usedCourses.add(hit.course.url);

      // Уверенность: пара найдена и срок снят со страницы — 0.9; срок из названия
      // QS — 0.8; пара найдена, а срока нет — 0.5; пары нет — 0.3.
      const confidence = !hit ? 0.3
        : duration.basis === 'offsite-page' ? (duration.needsCheck ? 0.7 : 0.9)
          : duration.basis === 'qs-title' ? 0.8 : 0.5;

      const row = {
        qs: {
          title: qs.title, level: qs.level, tuition: qs.tuition, currency: qs.currency,
          feeBasis: qs.feeBasis, file: qs._qsFile,
        },
        core: read.core,
        variants: [...read.variants],
        hit: hit ? { course: hit.course, score: Number(hit.score.toFixed(3)) } : null,
        ambiguous,
        duration,
        confidence,
      };
      rows.push(row);

      if (!hit) {
        cases.push({
          kind: 'нет пары на офсайте',
          program: qs.title,
          level: qs.level,
          why: reason,
          nearest: best ? `${best.course.title} (${best.score.toFixed(2)}) ${best.course.url}` : null,
        });
      } else if (!duration.years) {
        cases.push({
          kind: 'нет срока',
          program: qs.title,
          page: hit.course.url,
          why: 'срока нет ни на странице, ни в названии строки QS',
          evidence: duration.evidence,
        });
      } else if (duration.needsCheck) {
        cases.push({
          kind: 'срок под вопросом (вариант курса)',
          program: qs.title,
          page: hit.course.url,
          taken: duration.years,
          variants: row.variants,
          evidence: duration.evidence,
        });
      }
      if (ambiguous) {
        cases.push({ kind: 'две страницы с одинаковым счётом', program: qs.title, page: hit?.course.url ?? null });
      }
    }

    // Цена без валюты — не цена (правило «не фабриковать»).
    for (const r of rows) {
      if (typeof r.qs.tuition === 'number' && r.qs.tuition > 0 && !r.qs.currency) {
        cases.push({
          kind: uni.feeOverride ? 'цена взята с офсайта, проверить единицу' : 'цена без валюты',
          program: r.qs.title,
          value: r.qs.tuition,
          hint: uni.feeOverride
            ? `${uni.feeOverride.amount} ${uni.feeOverride.currency} — ${uni.feeOverride.note}. `
              + `У QS в шапке: ${heads[0].yearlyFeesStated}. Число 272 895 — та же сумма в юанях (курс ~9.25). `
              + 'Если поле хранит цену ЗА ГОД, ставить 14 750.'
            : (heads[0].yearlyFeesStated ? `у QS в шапке вуза: ${heads[0].yearlyFeesStated}` : null),
        });
      }
    }

    // Две строки QS на одну и ту же страницу, с тем же вариантом, уровнем и сроком —
    // это одна программа, показанная порталом дважды. Такие пары остаются после
    // отсева точных дублей, потому что расходятся в мелочи: опечатка в названии
    // («Games Animation» против «Game Animation») или ДРУГАЯ ЦЕНА у той же строки.
    // В черновик идёт первая, остальные — в кейс: выбор цены за человеком.
    const groups = new Map();
    for (const r of rows) {
      if (!r.hit) continue;
      const key = [r.hit.course.url, [...r.variants].sort().join('+'), r.qs.level ?? '', r.duration.years ?? ''].join('|');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }
    for (const [, group] of groups) {
      if (group.length < 2) continue;
      for (const r of group.slice(1)) r.duplicateOf = group[0].qs.title;
      const prices = [...new Set(group.map((r) => `${r.qs.tuition ?? '—'} ${r.qs.currency ?? ''}`.trim()))];
      cases.push({
        kind: 'одна страница у нескольких строк QS',
        page: group[0].hit.course.url,
        programs: group.map((r) => r.qs.title),
        prices,
        why: prices.length > 1
          ? 'у строк РАЗНАЯ цена — какая верна, решает человек'
          : 'строки различаются только написанием названия',
        kept: group[0].qs.title,
      });
    }

    const cityProposal = {
      evidenceUrl: offsite.cityEvidence?.url ?? null,
      campusValues: [...new Set(courses.map((c) => c.campus).filter(Boolean))].slice(0, 8),
      note: 'значение города ставит человек; у Worcester json-ld отдаёт графство «Worcestershire», а не город',
    };

    const card = buildCard(uni, heads[0], rows, cityProposal);
    for (const p of card.programs.filter((x) => !x.level)) {
      cases.push({
        kind: 'нет уровня',
        program: p.title,
        page: p.programUrl ?? null,
        why: 'уровень не отдали ни QS, ни страница курса; схема его требует',
      });
    }
    await fs.writeFile(path.join(OUT_DIR, `${uni.slug}.draft.json`), JSON.stringify(card, null, 2) + '\n', 'utf8');

    const matched = rows.filter((r) => r.hit).length;
    const withDuration = rows.filter((r) => r.duration.years).length;
    const unusedCourses = courses.filter((c) => !usedCourses.has(c.url));

    report.push({
      uni: uni.slug,
      name: uni.name,
      qsPrograms: qsPrograms.length,
      qsRaw: qsPrograms.length + dupes.length,
      qsDupesDropped: dupes.length,
      offsiteCourses: courses.length,
      hubsSkipped: hubs,
      matched,
      withDuration,
      inDraft: card.programs.length,
      cases: cases.length,
      offsiteUnused: unusedCourses.length,
      currency: card.tuition.currency,
      rows,
      casesList: cases,
      unusedSample: unusedCourses.slice(0, 12).map((c) => c.title),
    });
    allCases.push({ uni: uni.slug, cases });
  }

  await fs.writeFile(path.join(OUT_DIR, 'cases.json'), JSON.stringify(allCases, null, 2) + '\n', 'utf8');
  if (args.has('json')) {
    await fs.writeFile(path.join(OUT_DIR, 'merge-report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  }
  await fs.writeFile(path.join(KOMPAS_DIR, 'QS-NEW-CARDS-MERGE.md'), renderReport(report, allCases), 'utf8');

  log('вуз | QS | офсайт | пар | со сроком | в черновике | кейсов | офсайт без пары');
  for (const r of report) {
    log(`${r.uni} | ${r.qsPrograms} | ${r.offsiteCourses} | ${r.matched} | ${r.withDuration} | ${r.inDraft} | ${r.cases} | ${r.offsiteUnused}`);
  }
  const byKind = {};
  for (const u of allCases) for (const c of u.cases) byKind[c.kind] = (byKind[c.kind] || 0) + 1;
  log('кейсы по видам: ' + JSON.stringify(byKind, null, 0));
  return report;
}

// ------------------------------------------------------------------- отчёт --

function renderReport(report, allCases) {
  const L = [];
  L.push(`# Сведение офсайта с QS — ${TODAY}`, '');
  L.push('Собрано `scraper/kompas-merge-offsite.mjs`. Цена — от QS (`campusLevelStated`),');
  L.push('срок — со страницы курса офсайта либо из названия строки QS, город — за человеком.');
  L.push('Черновики: `sources/kompas/newcards/*.draft.json`. **В живой каталог ничего не записано.**', '');

  L.push('## Числа', '');
  L.push('| Вуз | QS строк (после отсева дублей) | Страниц офсайта | Пар | Со сроком | В черновике | Кейсов | Страниц офсайта без пары |');
  L.push('|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const r of report) {
    L.push(`| ${r.name} | ${r.qsRaw} → ${r.qsPrograms} | ${r.offsiteCourses} | ${r.matched} | ${r.withDuration} | ${r.inDraft} | ${r.cases} | ${r.offsiteUnused} |`);
  }
  L.push('');
  L.push('Разделы (`kind: "hub"`) в сведение не брались: ' + report.map((r) => `${r.uni} ${r.hubsSkipped}`).join(', ') + '.', '');

  const byKind = {};
  for (const u of allCases) for (const c of u.cases) byKind[c.kind] = (byKind[c.kind] || 0) + 1;
  L.push('## Кейсы оператору', '');
  L.push('| Вид | Сколько |');
  L.push('|---|---:|');
  for (const [k, v] of Object.entries(byKind).sort((a, b) => b[1] - a[1])) L.push(`| ${k} | ${v} |`);
  L.push('', 'Полный список — `sources/kompas/newcards/cases.json`.', '');

  for (const u of allCases) {
    const r = report.find((x) => x.uni === u.uni);
    L.push(`## ${r.name}`, '');
    const kinds = {};
    for (const c of u.cases) (kinds[c.kind] ||= []).push(c);
    for (const [kind, list] of Object.entries(kinds)) {
      L.push(`**${kind} — ${list.length}**`, '');
      for (const c of list.slice(0, 12)) {
        const bits = [c.program ?? (c.programs ?? []).join(' / ')];
        if (c.why) bits.push(c.why);
        if (c.nearest) bits.push(`ближайшая страница: ${c.nearest}`);
        if (c.taken) bits.push(`взят срок ${c.taken}, варианты: ${(c.variants ?? []).join(',')}`);
        if (c.evidence) bits.push(`улика: «${String(c.evidence).trim().slice(0, 120)}»`);
        if (c.prices) bits.push(`цены: ${c.prices.join(' / ')}`);
        if (c.hint) bits.push(c.hint);
        L.push(`- ${bits.filter(Boolean).join(' — ')}`);
      }
      if (list.length > 12) L.push(`- …ещё ${list.length - 12}, см. cases.json`);
      L.push('');
    }
    if (r.offsiteUnused) {
      L.push(`**Страницы офсайта без пары — ${r.offsiteUnused}** (примеры): ` + r.unusedSample.join(', '), '');
    }
  }
  return L.join('\n') + '\n';
}

// Разбор названий проверяется тестами (kompas-merge-offsite.test.mjs),
// поэтому запуск — только при прямом вызове файла.
export { readTitle, stripVariants, within1, jaccard, scorePair, matchFuzzy, levelsFit, pickDuration, urlSlugText };

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  run().catch((e) => { log(e.stack || String(e)); process.exit(1); });
}
