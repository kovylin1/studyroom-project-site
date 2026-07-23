// kompas-collect-direct.mjs — КОМПАС, сессия 3.5: сбор прямых партнёров с ОФСАЙТОВ.
//
// Зачем: замер (kompas-direct-audit.mjs) показал, что official-extracts негодны как
// источник КОМПАСа — цен там нет НИ ОДНОЙ на 757 файлов, десять файлов пусты,
// четыре сняты не с офсайта, а с агрегатора или википедии.
//
// Правила, оплаченные прошлыми сессиями:
//  * Офсайт резолвим через lib/official-site.mjs, НЕ через sourceUrl карточки
//    (у 237 вузов там edge.edvoy.com).
//  * Цену берём ТОЛЬКО явно подписанную и ТОЛЬКО с валютой. Нет подписи — нет цены;
//    фабриковать запрещено правилом 4 плана.
//  * У каждой цены пишем feeAudience: рядом с международной ценой у британских вузов
//    лежит home-цена, которая казахстанскому студенту не подходит.
//  * Считаем недобор: сколько страниц курсов найдено против скольких разобрано.
//    Без этого счётчика прогон Edvoy отчитался бы об успехе на 1% данных (урок сессии 3).
//  * Живой каталог НЕ трогаем — пишем только в sources/kompas/extracts/direct/.
//
// Запуск: node kompas-collect-direct.mjs [--slug=X] [--limit=N] [--max-pages=N] [--dry-run]

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  fetchHtml, htmlToCells, decodeEntities, parseMoney, mapLevel,
  writeExtract, extract, args, logger, stats, CATALOG_DIR, KOMPAS_DIR, UA,
} from './lib/kompas-collect.mjs';
import { resolveOfficialSite, AGG_DOMAINS } from './lib/official-site.mjs';

const log = logger('direct');
const DRY = args.has('dry-run');
const ONLY = args.get('slug');
const LIMIT = args.num('limit', Infinity);
const MAX_PAGES = args.num('max-pages', 160);
const SKIP_FRESH = args.has('skip-fresh');
const FRESH_HOURS = args.num('fresh-hours', 6);

/** Выгрузка, снятая недавно: прогон продолжается пачками и не переснимает то же самое. */
async function readIfFresh(file) {
  try {
    const j = JSON.parse(await fs.readFile(file, 'utf8'));
    const age = (Date.now() - new Date(j.scrapedAt).getTime()) / 36e5;
    return age <= FRESH_HOURS ? j : null;
  } catch { return null; }
}
const OFFICIAL_EXTRACTS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'sources', 'official-extracts');

// ---------------------------------------------------------------- эвристики ----

// Ссылка похожа на страницу программы. Национальные пути добавлены после первого
// прогона: турецкие и арабские сайты (beykent, ciu, final, adu) дали 0 страниц,
// потому что курсы у них лежат под /bolum, /lisans, /akademik, /majors.
const COURSE_PATH = /\/(course|courses|programme|programmes|program|programs|study|studies|degree|degrees|bachelor|bachelors|master|masters|undergraduate|postgraduate|graduate|academics|academic-programs|majors|faculties|faculty|school-of|akademik|bolum|bolumler|program-?lar|lisans|yuksek-lisans|onlisans|ders|kepzes|kepzesek|szak|szakok|hakgwa|jeongong|corsi|cursos)\b/i;

// Заголовки настоящего браузера. Без них final.edu.tr и uowdubai.ac.ae отвечали
// HTTP 403 — и это выглядело как «сайт не отдаёт курсы», хотя дело было в запросе.
const BROWSER_HEADERS = {
  'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8,tr;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Upgrade-Insecure-Requests': '1',
};
// Часть сайтов (final.edu.tr, uowdubai.ac.ae) отбивает любой прямой запрос HTTP 403 —
// это защита WAF, заголовками не лечится. Для них поднимается настоящий браузер.
// Включается флагом --browser, потому что он на порядок медленнее обычного запроса.
const USE_BROWSER = args.has('browser');
let browserPage = null;

async function browserGet(url) {
  if (!browserPage) {
    const { chromium } = await import('playwright');
    const b = await chromium.launch({ headless: true });
    const ctx = await b.newContext({ userAgent: UA, locale: 'en-US' });
    browserPage = await ctx.newPage();
  }
  const r = await browserPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  if (!r || !r.ok()) throw new Error(`browser HTTP ${r ? r.status() : '?'} :: ${url}`);
  return await browserPage.content();
}

const get = async (url) => {
  try { return await fetchHtml(url, { headers: BROWSER_HEADERS }); }
  catch (e) {
    if (!USE_BROWSER || !/HTTP 40[3169]|network/.test(String(e.message))) throw e;
    return browserGet(url);
  }
};

/** Запасные написания адреса: без www, с www, http. Домен не выдумываем — только формы данного. */
function originCandidates(origin) {
  const u = new URL(origin);
  const bare = u.hostname.replace(/^www\./, '');
  return [...new Set([
    `${u.protocol}//${u.hostname}`,
    `https://${bare}`,
    `https://www.${bare}`,
    `http://${bare}`,
  ])];
}

/** Первый адрес, который вообще отвечает. null — сайт недоступен, это факт для отчёта. */
async function reachableOrigin(origin) {
  for (const cand of originCandidates(origin)) {
    try { await get(cand); return cand; } catch { /* пробуем следующее написание */ }
  }
  return null;
}

// Страница со сводной таблицей стоимости — цены у большинства вузов лежат НЕ на
// странице программы, а отдельно. Поймано первым прогоном: у anglo-american 151
// программа и НОЛЬ цен, у apu 121 и ноль.
const FEE_PAGE = /\/(fees?|tuition|tuition-fees?|cost|costs|ucret|ücret|harclar|rasoom|study-costs|fees-and-funding|fees-and-scholarships)\b/i;
// ...но не на служебную.
const SKIP_PATH = /\.(pdf|jpe?g|png|gif|svg|zip|docx?|xlsx?)$|\/(news|blog|event|events|tag|category|author|feed|search|login|apply-now|privacy|cookie|sitemap)\b/i;

// Метка цены. Только явные — «Fees» в одиночку слишком часто это пункт меню,
// поэтому требуем слово стоимости рядом с обучением.
const FEE_LABEL = /(tuition\s*fees?|tuition\s*cost|course\s*fees?|programme?\s*fees?|annual\s*fees?|fees?\s*per\s*year|study\s*fees?|öğrenim\s*ücreti|studiengebühr)/i;
// Аудитория цены.
const AUD_INTL = /(international|overseas|non-?eu|non-?uk|foreign)/i;
const AUD_HOME = /\b(home|domestic|uk\s*\/?\s*eu|eu\s*students?|resident)\b/i;

// Цена рядом с этими словами — НЕ стоимость обучения. Поймано глазами на пилоте Gisma:
// «Study in Berlin — 6000 EUR» вытащилось из абзаца про общежитие Edge Student Hub.
const NOT_TUITION_CONTEXT = /(accommodation|residence|student hall|housing|living cost|deposit|insurance|visa fee|application fee|registration fee)/i;

const DUR_LABEL = /^(duration|course\s*length|length|study\s*duration|süre)$/i;

// Название-самозванец: пункт меню, заголовок статьи, кнопка.
const NOT_A_PROGRAM = [
  /^(our|the)\s+(courses|programmes|programs)\b/i,
  /^(top|best|popular|why|how)\b/i,
  /\b(how to|what is|guide|deadlines?|application periods?|study hub|portal)\b/i,
  /^(about|contact|news|blog|admissions?|apply|fees?|accommodation|student life|campus life|visa|faq|home)\b/i,
  /^(read|learn|find out|view|see)\s+(more|all)\b/i,
  /^.{0,4}$/,
  /^.{90,}$/, // предложение, а не название (у TSI такое было)
  // родовые заголовки разделов — поймано глазами на пилоте Gisma
  /^(programmes?|programs?|master|bachelor|undergraduate|postgraduate|degrees?|courses?)\b.{0,14}$/i,
  /^(study|studieren|studying|studiere)\s+(in|at)\b/i,
];
const looksLikeProgram = (t) => !!t && !NOT_A_PROGRAM.some((re) => re.test(t.trim()));

// Валюты стран прямых партнёров, которых нет в общем parseMoney (он знает только
// GBP/USD/EUR/AUD/CAD/NZD/SGD/AED/CHF/SEK/MYR). Поймано глазами на Anglo-American:
// 125 489 CZK было помечено как USD — цена в чужой валюте это недостоверность,
// а не мелочь. Код в САМОЙ ячейке всегда сильнее символа из соседнего текста.
const EXTRA_CUR = [
  [/\b(czk|kč|kc)\b/i, 'CZK'], [/\b(pln|zł|zl)\b/i, 'PLN'], [/\b(huf|ft)\b/i, 'HUF'],
  [/\b(try|tl)\b|₺/i, 'TRY'], [/\b(krw)\b|₩/i, 'KRW'], [/\b(inr)\b|₹/i, 'INR'],
  [/\b(cny|rmb)\b/i, 'CNY'], [/\b(rm)\b/i, 'MYR'], [/\b(aed|dhs?)\b/i, 'AED'],
  [/\b(eur)\b/i, 'EUR'], [/\b(nok)\b/i, 'NOK'], [/\b(dkk)\b/i, 'DKK'],
];

/** parseMoney + валюты, которых общая библиотека не знает. */
function money(cell) {
  const m = parseMoney(cell);
  if (!m) return null;
  const t = decodeEntities(String(cell));
  for (const [re, cur] of EXTRA_CUR) if (re.test(t)) return { ...m, currency: cur };
  return m;
}

// Цена правдоподобна: не год, не телефон, и валюта названа явно.
function plausibleMoney(m) {
  if (!m || !m.currency) return null;
  if (m.amount < 300 || m.amount > 500000) return null;
  if (m.amount >= 1900 && m.amount <= 2100 && !/[.,]/.test(String(m.amount))) {
    // 2026 без валютного символа рядом почти всегда год; валюта уже проверена выше,
    // но «Start 2026 GBP» встречается в мусорных ячейках — оставляем только с десятичной частью.
    return null;
  }
  return m;
}

/** Ищет ЯВНО подписанную стоимость обучения в плоских ячейках страницы. */
function findTuition(cells) {
  for (let i = 0; i < cells.length; i++) {
    // метка — это подпись поля, а не абзац текста: длинная ячейка ловит цену жилья
    if (!FEE_LABEL.test(cells[i]) || cells[i].length > 48) continue;
    const context = cells.slice(Math.max(0, i - 2), i + 6).join(' ');
    if (NOT_TUITION_CONTEXT.test(context)) continue;
    // цена может стоять в той же ячейке («Tuition fee: £17,000 GBP») или в соседних
    for (let j = i; j < Math.min(i + 5, cells.length); j++) {
      const m = plausibleMoney(money(cells[j]));
      if (!m) continue;
      const feeAudience = AUD_INTL.test(context) ? 'international'
        : AUD_HOME.test(context) ? 'home' : null;
      return { ...m, feeAudience, feeLabel: cells[i].slice(0, 80) };
    }
  }
  return null;
}

function findDuration(cells) {
  for (let i = 0; i < cells.length; i++) {
    if (!DUR_LABEL.test(cells[i])) continue;
    const v = cells[i + 1];
    if (v && /\d/.test(v) && v.length < 40) return v;
  }
  return null;
}

function pageTitle(html) {
  const h1 = html.match(/<h1[^>]*>([\s\S]{0,200}?)<\/h1>/i);
  const raw = h1 ? h1[1] : (html.match(/<title[^>]*>([\s\S]{0,200}?)<\/title>/i)?.[1] ?? '');
  return decodeEntities(raw.replace(/<[^>]+>/g, ''))
    .replace(/\s+/g, ' ')
    .replace(/\s*[|–—-]\s*[^|–—-]{0,40}$/, '') // хвост «| Название вуза»
    .trim();
}

function absolute(href, base) {
  try { return new URL(href, base).toString().split('#')[0]; } catch { return null; }
}

// ------------------------------------------------------------------ обход ----

// Вложенные карты, которые почти наверняка блог, а не курсы. Поймано на
// uni-milton.hu: индекс из 176 карт, первые 12 — помесячные архивы постов,
// обходчик упирался в лимит и уходил с нулём.
const BLOG_SITEMAP = /(post|news|blog|event|author|tag|category)/i;
const MAX_SITEMAPS = 40;

async function fromSitemap(origin) {
  const urls = new Set();
  let queue = [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`, `${origin}/sitemap-index.xml`];
  const seen = new Set();
  while (queue.length && urls.size < 8000 && seen.size < MAX_SITEMAPS) {
    // карты страниц разбираем раньше архивов блога
    queue.sort((a, b) => Number(BLOG_SITEMAP.test(a)) - Number(BLOG_SITEMAP.test(b)));
    const sm = queue.shift();
    if (seen.has(sm)) continue;
    seen.add(sm);
    let xml;
    try { xml = await get(sm); } catch { continue; }
    for (const m of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
      const u = m[1];
      if (/\.xml(\.gz)?$/i.test(u)) { queue.push(u); continue; }
      urls.add(u);
    }
  }
  return [...urls];
}

async function fromCrawl(origin) {
  const found = new Set();
  const indexPages = ['', '/courses', '/programmes', '/programs', '/study', '/academics', '/study-with-us'];
  for (const p of indexPages) {
    let html;
    try { html = await get(origin + p); } catch { continue; }
    for (const m of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
      const u = absolute(m[1], origin + p);
      if (u && u.startsWith(origin)) found.add(u);
    }
  }
  return [...found];
}

const isCourseUrl = (u) => COURSE_PATH.test(u) && !SKIP_PATH.test(u);
const isFeeUrl = (u) => FEE_PAGE.test(u) && !SKIP_PATH.test(u);

/**
 * Сводная таблица стоимости: берём ЯВНО подписанные суммы и метку слева от суммы.
 * Ничего не сопоставляем силой — если метка не сойдётся с программой, строка
 * останется в feeTable как есть, для глаз владельца. Фабриковать нельзя.
 */
function parseFeeTable(cells, url) {
  const rows = [];
  for (let i = 0; i < cells.length; i++) {
    const m = plausibleMoney(money(cells[i]));
    if (!m) continue;
    // метка — ближайшая осмысленная ячейка слева
    let label = null;
    for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
      const c = cells[j];
      if (c && c.length > 3 && c.length < 90 && !money(c)) { label = c; break; }
    }
    if (!label) continue;
    const context = cells.slice(Math.max(0, i - 3), i + 3).join(' ');
    if (NOT_TUITION_CONTEXT.test(context)) continue;
    rows.push({
      label,
      amount: m.amount,
      currency: m.currency,
      feeAudience: AUD_INTL.test(context) ? 'international' : AUD_HOME.test(context) ? 'home' : null,
      feeUrl: url,
      rawCell: cells[i].slice(0, 60),
    });
    if (rows.length >= 120) break;
  }
  return rows;
}

const normTitle = (s) => (s || '').toLowerCase()
  .replace(/\b(bsc|ba|beng|llb|bba|msc|ma|mba|meng|llm|hons|programme|program|degree|course)\b/g, ' ')
  .replace(/[^a-zа-я0-9 ]/gi, ' ').replace(/\s+/g, ' ').trim();

// ------------------------------------------------------------------ вуз ----

async function collectUni({ slug, name, official }) {
  const origin = await reachableOrigin(new URL(official).origin);
  if (!origin) return { unreachable: true };
  let all = await fromSitemap(origin);
  let viaSitemap = all.length > 0;
  // Sitemap может существовать и при этом не содержать курсов (так было у ciu и gedu) —
  // тогда всё равно идём обходом, иначе вуз молча уходит с нулём.
  if (!all.some(isCourseUrl)) {
    const crawled = await fromCrawl(origin);
    if (crawled.some(isCourseUrl) || !viaSitemap) { all = [...new Set([...all, ...crawled])]; viaSitemap = false; }
  }

  const candidates = [...new Set(all.filter(isCourseUrl))];
  const pages = candidates.slice(0, MAX_PAGES);
  const feePages = [...new Set(all.filter(isFeeUrl))].slice(0, 12);

  const programs = [];
  const noPrice = [];
  let parsed = 0, rejected = 0;

  for (const url of pages) {
    let html;
    try { html = await get(url); } catch { continue; }
    parsed++;
    const title = pageTitle(html);
    if (!looksLikeProgram(title)) { rejected++; continue; }
    const cells = htmlToCells(html);
    const money = findTuition(cells);
    const level = mapLevel(title, url);
    const p = {
      title,
      level,
      programUrl: url,
      source: 'official',
      sourceKind: 'kompas-direct',
      verifiedBySite: true,
      checkedAt: new Date().toISOString().slice(0, 10),
    };
    const dur = findDuration(cells);
    if (dur) p.duration = dur;
    if (money) {
      p.tuition = { amount: money.amount, currency: money.currency };
      p.feeAudience = money.feeAudience;
      p.feeLabel = money.feeLabel;
    } else {
      noPrice.push(url);
    }
    programs.push(p);
  }

  // Дедуп по названию: у части сайтов одна программа лежит под несколькими адресами.
  const byTitle = new Map();
  for (const p of programs) {
    const k = p.title.toLowerCase();
    const prev = byTitle.get(k);
    if (!prev || (!prev.tuition && p.tuition)) byTitle.set(k, p);
  }
  const deduped = [...byTitle.values()];

  // Сводные страницы стоимости: цену к программе привязываем только при ТОЧНОМ
  // совпадении нормализованного названия. Несопоставленные строки остаются в
  // feeTable — это материал для владельца, а не повод угадывать.
  const feeTable = [];
  for (const url of feePages) {
    let html;
    try { html = await get(url); } catch { continue; }
    feeTable.push(...parseFeeTable(htmlToCells(html), url));
  }
  const feeByTitle = new Map();
  for (const r of feeTable) {
    const k = normTitle(r.label);
    if (k.length > 6 && !feeByTitle.has(k)) feeByTitle.set(k, r);
  }
  let matchedFromTable = 0;
  for (const p of deduped) {
    if (p.tuition) continue;
    const hit = feeByTitle.get(normTitle(p.title));
    if (!hit) continue;
    p.tuition = { amount: hit.amount, currency: hit.currency };
    p.feeAudience = hit.feeAudience;
    p.feeLabel = hit.label.slice(0, 80);
    p.feeSourceUrl = hit.feeUrl;
    matchedFromTable++;
  }

  return {
    payload: extract({
      slug, name, source: 'official-direct', sourceUrl: origin,
      programs: deduped,
      extra: {
        discovery: viaSitemap ? 'sitemap' : 'crawl',
        feePagesFetched: feePages.length,
        feeRowsFound: feeTable.length,
        feeRowsMatched: matchedFromTable,
        // несопоставленные строки прайса — владельцу глазами, не выдумывать привязку
        feeTable: feeTable.slice(0, 60),
        // счётчик недобора: без него «успех» может стоять на одном проценте данных
        urlsSeen: all.length,
        courseUrlsFound: candidates.length,
        pagesFetched: parsed,
        pageCap: MAX_PAGES,
        capped: candidates.length > MAX_PAGES,
        titlesRejected: rejected,
        programsKept: deduped.length,
        withPrice: deduped.filter((p) => p.tuition).length,
        withFeeAudience: deduped.filter((p) => p.feeAudience).length,
      },
    }),
    noPrice,
  };
}

// ------------------------------------------------------------------ main ----

const MANUAL_SITES = JSON.parse(await fs.readFile(path.join(path.dirname(fileURLToPath(import.meta.url)), 'sources', 'official-sites-manual.json'), 'utf8'));

async function main() {
  const map = JSON.parse(await fs.readFile(path.join(KOMPAS_DIR, 'partner-source-map.json'), 'utf8'));
  const targets = Object.entries(map).filter(([, v]) => v?.type === 'direct');
  // прямые партнёры без карточки в каталоге: в карте сессии 1 их нет, потому что
  // карта строилась по каталогу. Адрес задан владельцем — собираем под новую карточку.
  for (const slug of Object.keys(MANUAL_SITES)) {
    if (slug.startsWith('_') || map[slug]) continue;
    targets.push([slug, { type: 'direct', via: [], directRaw: slug, newCard: true }]);
  }

  const report = [];
  let done = 0;

  for (const [slug, meta] of targets) {
    if (ONLY && slug !== ONLY) continue;
    if (done >= LIMIT) break;

    // Среда убивает долгий фоновый процесс примерно через 45 минут, поэтому прогон
    // должен продолжаться пачками: уже собранное сегодня пропускаем.
    if (SKIP_FRESH) {
      const prev = await readIfFresh(path.join(KOMPAS_DIR, 'extracts', 'direct', `${slug}.json`));
      if (prev) {
        // в сводку кладём цифры прежней пачки, иначе отчёт покажет только добранное
        const { programs: _p, feeTable: _f, ...e } = prev;
        log(`${slug}: свежая выгрузка есть — пропуск`);
        report.push({ slug, name: prev.name, status: 'ok', official: prev.sourceUrl, ...e,
          programs: prev.programs?.length ?? 0, fromPreviousBatch: true });
        continue;
      }
    }

    let uni;
    try { uni = JSON.parse(await fs.readFile(path.join(CATALOG_DIR, `${slug}.json`), 'utf8')); }
    catch {
      // карточки может не быть намеренно: два прямых партнёра из «списка Б» сессии 1
      // заводятся с нуля, и данные для карточки берутся как раз этим сбором
      if (!MANUAL_SITES[slug]) { log(`${slug}: карточки нет — пропуск`); report.push({ slug, status: 'no-card' }); continue; }
      uni = { name: meta?.directRaw ?? slug, slug };
      log(`${slug}: карточки нет, но адрес задан владельцем — собираю под новую карточку`);
    }

    // Адрес, данный владельцем, сильнее любой автоматики: у amity и webster в карточке
    // стоит агрегатор, у adu/woosong/final прежний адрес не отвечал или отбивался.
    let official = MANUAL_SITES[slug] ?? resolveOfficialSite(uni, []);
    // запасной путь: адрес из старой выгрузки, если он не агрегаторский
    if (!official) {
      try {
        const old = JSON.parse(await fs.readFile(path.join(OFFICIAL_EXTRACTS, `${slug}.json`), 'utf8'));
        const h = old?.sourceUrl ? new URL(old.sourceUrl).hostname : null;
        if (h && !AGG_DOMAINS.test(h)) official = new URL(old.sourceUrl).origin;
      } catch { /* нет файла — не угадываем */ }
    }
    if (!official) {
      log(`${slug}: офсайт неизвестен — в отчёт владельцу`);
      report.push({ slug, name: uni.name, status: 'no-official-site', directRaw: meta.directRaw });
      continue;
    }

    done++;
    try {
      const res = await collectUni({ slug, name: uni.name, official });
      if (res.unreachable) {
        // сайт не ответил ни на одном написании адреса — это факт про сайт, а не про сбор
        log(`${slug}: сайт не отвечает (${official})`);
        report.push({ slug, name: uni.name, status: 'unreachable', official });
        continue;
      }
      const { payload, noPrice } = res;
      const w = await writeExtract('direct', slug, payload, { dryRun: DRY });
      // extract() спредит extra в КОРЕНЬ payload, отдельного поля .extra нет —
      // поэтому счётчики берём из корня, а массив programs из отчёта исключаем.
      const { programs: _drop, feeTable: _drop2, ...e } = payload;
      log(`${slug}: ${payload.programs.length} прогр, ${e.withPrice ?? '?'} с ценой, ` +
          `${e.courseUrlsFound} страниц найдено (${e.discovery})${e.capped ? ' [ОБРЕЗАНО]' : ''}${w.written ? '' : ' [dry]'}`);
      report.push({
        slug, name: uni.name, status: 'ok', official,
        ...e, programs: payload.programs.length, noPriceSample: noPrice.slice(0, 5),
      });
    } catch (err) {
      log(`${slug}: ОШИБКА ${err.message}`);
      report.push({ slug, name: uni.name, status: 'error', official, error: String(err.message) });
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    universities: report.length,
    ok: report.filter((r) => r.status === 'ok').length,
    noOfficialSite: report.filter((r) => r.status === 'no-official-site').length,
    errors: report.filter((r) => r.status === 'error').length,
    totalPrograms: report.reduce((a, r) => a + (r.programs || 0), 0),
    totalWithPrice: report.reduce((a, r) => a + (r.withPrice || 0), 0),
    cappedUnis: report.filter((r) => r.capped).length,
    requests: stats.requests,
    throttled: stats.throttled,
    failed: stats.failed,
  };

  if (!DRY) {
    await fs.writeFile(
      path.join(KOMPAS_DIR, 'direct-collect-report.json'),
      JSON.stringify({ summary, report }, null, 2) + '\n',
      'utf8',
    );
  }
  console.log(JSON.stringify(summary, null, 2));
  console.log('DIRECT-COLLECT DONE');
}

main().catch((e) => { console.error(e); process.exit(1); });
