#!/usr/bin/env node
// kompas-collect-scholarships.mjs — КОМПАС P4, пункт 9: сбор стипендий С ОФСАЙТОВ.
//
// Стипендии не отдаёт ни один агрегатор: ни Edvoy, ни StudyGroup, ни Kaplan, ни IAPro.
// Единственный источник — сайт самого вуза. То, что лежит в каталоге сейчас, собрано
// не отсюда: у 1765 записей нет ни source, ни verifiedBySite, у 79% нет ссылки
// (замер: kompas-scholarship-audit.mjs).
//
// Правила, взятые у сбора цен сессии 3.5 (они там оплачены ошибками):
//  * Офсайт резолвим через lib/official-site.mjs, а НЕ по sourceUrl карточки —
//    у 237 вузов там edge.edvoy.com, то есть страница агрегатора.
//  * Ходим ТОЛЬКО по своему домену вуза. Ссылка на chevening.org — внешняя программа,
//    не стипендия вуза; такие в выгрузку не идут.
//  * Сумму берём только явно подписанную. Нет числа с валютой и нет явного «full
//    tuition» — пишем запись БЕЗ суммы. Выдумывать сумму запрещено (правило 4).
//  * У каждой записи остаётся ссылка на страницу, с которой она снята: без неё запись
//    непроверяема, а непроверяемых у нас уже 1234.
//  * Живой каталог НЕ трогаем. Пишем в sources/kompas/extracts/scholarships/.
//
// Запуск:
//   node kompas-collect-scholarships.mjs --slug=abertay          # один вуз
//   node kompas-collect-scholarships.mjs --limit=20              # первые 20 без выгрузки
//   node kompas-collect-scholarships.mjs --limit=20 --dry-run    # ничего не пишет

import fs from 'node:fs/promises';
import path from 'node:path';
import {
  fetchHtml, decodeEntities, parseMoney, writeExtract, args, logger, stats,
  KOMPAS_DIR, EXTRACTS_DIR,
} from './lib/kompas-collect.mjs';
import { resolveOfficialSite } from './lib/official-site.mjs';

const log = logger('scholar');
const WORK = path.join(KOMPAS_DIR, 'catalog-work');
const OUT_DIR = path.join(EXTRACTS_DIR, 'scholarships');
const DRY = args.has('dry-run');
const ONLY = args.get('slug');
const LIMIT = args.num('limit', Infinity);
const MAX_PAGES = args.num('max-pages', 6);
const MAX_DETAILS = args.num('max-details', 25);
const SKIP_DONE = !args.has('refetch');

// Слова, по которым узнаётся страница о финансировании. Держим узко: «award» и «support»
// без этих слов дают полсайта (награды сотрудникам, поддержка ИТ).
const PAGE_HINT = /scholarship|bursar|financial[- ]aid|fees?[- ]and[- ]funding|funding|grants?\b|stipend/i;
// Название стипендии. Обязательное условие — сама стипендия названа: заголовок вроде
// «How to apply» стипендией не является, сколько бы фунтов ни стояло рядом.
const NAME_HINT = /scholarship|bursary|bursaries|award|grant|fellowship|discount|waiver/i;
// Явные формулировки полного покрытия: сумма не названа, но она известна и проверяема.
const FULL_HINT = /\bfull[- ](tuition|fee|funding|scholarship)\b|\b100%\s*(of\s*)?(tuition|fees?)\b|\bfull[- ]ride\b/i;
// Заголовки РАЗДЕЛА, а не стипендии: «Scholarships and Bursaries» — это название страницы
// Abertay, под которым лежат 39 настоящих стипендий. Записать его самой стипендией значит
// завести в каталоге пустышку — ровно то, чем сейчас забиты 1234 записи.
const SECTION_TITLE = /^(our |available |international |student |uk |eu )?(scholarships?|bursaries|bursary|awards?|grants?|funding|financial aid)( (and|&) (scholarships?|bursaries|awards?|grants?|funding|discounts))?( for .*)?$/i;
// Заголовки-инструкции: «How do I apply for the scholarship?», «Advice on Applying for
// Scholarships» — это разделы справки, а не стипендии. Поймано на Bangor: из 19 записей
// пилота четыре были такими.
const NOT_A_NAME = /^(how|what|when|where|who|why|do i|can i|advice|guidance|information|help|faqs?|applying|apply|eligibility|terms|contact|this|these|other|more|all)\b|\?$|\bnot available\b/i;
// Подписи полей на странице раздела: «Scope of scholarship», «Duration of scholarship»,
// «Scholarship decisions», «Statement of Scholarship». Слово «scholarship» в них есть,
// стипендии за ними — нет. Поймано на Aalto и Adelphi в пилоте 25 вузов.
const FIELD_LABEL = /^(scope|duration|decision|statement|value|amount|type|types|criteria|deadline|deadlines|payment|status|number|overview|summary|details?|submit|download|fall|spring|winter|summer)\b|\b(of|for) scholarships?$|^scholarship (decisions?|process|types?|values?|amounts?|conditions?)\b|frequently asked/i;

const readJson = async (f) => JSON.parse(await fs.readFile(f, 'utf8'));
const clean = (s) => decodeEntities(String(s ?? '')).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const MONEY_RE = /(?:£|€|A\$|C\$|NZ\$|\$|\b(?:GBP|USD|EUR|AUD|CAD|NZD|SGD|AED|CHF)\b)\s?[\d][\d,.\s]{2,}/g;
// Сумма рядом с этими словами — НЕ размер стипендии. Поймано на Bangor: страница
// «Bangor Bursaries» начинается таблицей «Taxable Household Income | Award», где первое
// число — £25,000 порога дохода, а сама стипендия £1,000. Правило «первая сумма на
// странице» записало бы в каталог порог как размер выплаты.
const MONEY_TRAP = /household income|taxable|income of|earnings|salary|threshold|or less|or below|less than|income below|tuition fees? (are|of|from)|cost of living|deposit/i;
// …а рядом с этими — да. Требуем явную подпись: «нет подписи — нет цены» (правило сбора
// цен сессии 3.5, здесь оно ровно так же уместно).
const MONEY_LABEL = /award|worth|value|bursary of|scholarship of|receive|discount|reduction|up to|covers?|payment|towards|per year|per annum|a year/i;

/**
 * Сумма стипендии вместе с оговорками, а не голое число.
 *
 * На странице Abertay IB30+ стоят и «up to £28,000» (за четыре года), и «£7,000 per year».
 * Обе цифры верные, но «GBP 28,000» без «до» и без срока читается как годовая выплата —
 * это враньё на карточке. Поэтому «up to» слева и «per year» справа переносим в строку.
 */
function amountFrom(text) {
  const fallback = () => (FULL_HINT.test(text.slice(0, 2000)) ? 'full tuition' : null);
  for (const m of text.matchAll(MONEY_RE)) {
    const p = parseMoney(m[0]);
    if (!p || !p.currency) continue;
    const before = text.slice(Math.max(0, m.index - 70), m.index);
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 70);
    if (MONEY_TRAP.test(before) || MONEY_TRAP.test(after)) continue;
    if (!MONEY_LABEL.test(before) && !MONEY_LABEL.test(after)) continue;
    const upTo = /\b(up to|maximum of|as much as)\b[^.]*$/i.test(before);
    const perYear = /^\s*(per|a|each|\/)\s*(year|annum|session)|^\s*(annually|per annum)/i.test(after);
    return `${upTo ? 'до ' : ''}${p.currency} ${p.amount.toLocaleString('en-US')}${perYear ? '/год' : ''}`;
  }
  return fallback();
}

/** Хост без www — чтобы «сам сайт вуза» не разъезжался на www/не-www. */
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return null; } };
const sameSite = (u, base) => {
  const a = host(u); const b = host(base);
  if (!a || !b) return false;
  return a === b || a.endsWith('.' + b) || b.endsWith('.' + a);
};

/**
 * Адреса страницы. Берём АТРИБУТ href, а не пару <a>…</a>: разбор парой терял две трети
 * ссылок (на главной Abertay — 65 из 192), потому что во вложенной разметке меню текст
 * ссылки длиннее любого разумного предела, и нужная
 * `/study-apply/money-fees-and-funding/scholarships/` просто не находилась.
 */
function links(html, baseUrl) {
  const out = []; const seen = new Set();
  for (const m of html.matchAll(/\bhref=["']([^"'#\s]+)["']/gi)) {
    let href;
    try { href = new URL(decodeEntities(m[1]), baseUrl).toString(); } catch { continue; }
    if (!/^https?:/i.test(href)) continue;
    if (/\.(png|jpe?g|gif|svg|ico|css|js|woff2?|ttf|pdf|zip|xml)(\?|$)/i.test(href)) continue;
    href = href.split('#')[0];
    if (seen.has(href)) continue;
    seen.add(href);
    out.push({ href, text: '' });
  }
  return out;
}

/**
 * Кандидаты в стипендии со страницы.
 *
 * Разбираем по ЗАГОЛОВКАМ (h2–h4, а также ячейки-ссылки списков): у страниц о
 * финансировании это единственная общая структура. Сумму ищем в тексте ДО следующего
 * заголовка — так «£4,000» из соседней стипендии не приклеится к предыдущей.
 */
function parseScholarships(html, pageUrl) {
  const blocks = [];
  const re = /<(h2|h3|h4|dt|strong)\b[^>]*>([\s\S]{0,300}?)<\/\1>/gi;
  let prev = null;
  for (const m of html.matchAll(re)) {
    const title = clean(m[2]);
    if (prev) prev.body = html.slice(prev.end, m.index);
    if (title.length >= 6 && title.length <= 140 && NAME_HINT.test(title)) {
      prev = { title, end: m.index + m[0].length, body: '' };
      blocks.push(prev);
    } else {
      prev = null;
    }
  }
  if (prev) prev.body = html.slice(prev.end, prev.end + 4000);

  const seen = new Set();
  const out = [];
  for (const b of blocks) {
    const key = b.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const text = clean(b.body).slice(0, 600);
    // Сумма — только явная. parseMoney без валюты вернёт {currency:null}: такое не
    // берём, «5,000» без знака валюты может быть числом студентов.
    const amount = amountFrom(text);
    out.push({
      name: b.title,
      ...(amount ? { amount } : {}),
      ...(text ? { description: text.slice(0, 300) } : {}),
      url: pageUrl,
      source: 'official-site',
      verifiedBySite: true,
    });
  }
  return out;
}

/**
 * Адреса ОТДЕЛЬНЫХ страниц стипендий, найденные на странице-разделе.
 *
 * У Abertay раздел «Scholarships and Bursaries» не перечисляет стипендии текстом: это
 * поисковая выдача (39 штук), где каждая ссылка ведёт через редирект search.abertay.ac.uk
 * с настоящим адресом в параметре `url=`. Заголовков стипендий на самой странице нет
 * вовсе — разбор по h2/h3 честно возвращал одну запись «Scholarships and Bursaries».
 * Поэтому: разворачиваем редиректы с `url=` и берём ссылки, которые ведут ВГЛУБЬ раздела.
 */
function detailUrls(html, base, hubUrl) {
  const hubDepth = (() => { try { return new URL(hubUrl).pathname.split('/').filter(Boolean).length; } catch { return 0; } })();
  const out = new Set();
  for (const l of links(html, base)) {
    let u = l.href;
    try {
      const inner = new URL(u).searchParams.get('url');
      if (inner && sameSite(inner, base)) u = inner.split('#')[0];
    } catch { /* адрес не разобрался — берём как есть */ }
    if (!sameSite(u, base)) continue;
    let p;
    try { p = new URL(u); } catch { continue; }
    if (p.search) continue;                       // ?pageNumber=2 — та же страница-раздел
    const segs = p.pathname.split('/').filter(Boolean);
    if (segs.length <= hubDepth) continue;        // не глубже раздела — это не карточка стипендии
    if (!NAME_HINT.test(segs[segs.length - 1])) continue;
    out.add(p.toString());
  }
  return [...out];
}

/** Название и сумма с ОТДЕЛЬНОЙ страницы стипендии: имя — из h1, сумма — из текста. */
function parseDetail(html, url) {
  const h1 = html.match(/<h1\b[^>]*>([\s\S]{0,300}?)<\/h1>/i);
  const name = clean(h1?.[1] ?? '');
  if (!name || name.length < 6 || name.length > 140) return null;
  if (!NAME_HINT.test(name)) return null;
  const body = clean(html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' '));
  const amount = amountFrom(body);
  return {
    name,
    ...(amount ? { amount } : {}),
    url,
    source: 'official-site',
    verifiedBySite: true,
  };
}

async function collectOne(uni, slug) {
  const base = resolveOfficialSite(uni, []);
  if (!base) return { slug, status: 'no-site', found: 0 };

  let homeHtml;
  try { homeHtml = await fetchHtml(base); }
  catch (e) { return { slug, status: 'unreachable', reason: e.message, found: 0 }; }

  // Страницы-кандидаты: ссылки главной, ведущие на свой же домен и пахнущие деньгами.
  const cand = [];
  const seenUrl = new Set();
  for (const l of links(homeHtml, base)) {
    if (!sameSite(l.href, base)) continue;
    if (!PAGE_HINT.test(l.href) && !PAGE_HINT.test(l.text)) continue;
    if (seenUrl.has(l.href)) continue;
    seenUrl.add(l.href);
    cand.push(l.href);
  }
  // Ходовые адреса — ТОЛЬКО когда на главной не нашлось ничего: иначе на каждый вуз
  // уходит пять заведомых 404 (в пилоте 25 вузов это дало 53 неудачи на 163 запроса).
  if (!cand.length) {
    for (const p of ['/scholarships', '/scholarships/', '/international/scholarships', '/study/scholarships', '/fees-and-funding/scholarships']) {
      try {
        const u = new URL(p, base).toString();
        if (!seenUrl.has(u)) { seenUrl.add(u); cand.push(u); }
      } catch { /* адрес не собрался — пропускаем */ }
    }
  }

  const pagesRead = [];
  // Два ведра, а не одно. Отдельная страница стипендии подписана заголовком h1 и суммой
  // в тексте — там ошибиться трудно. Заголовки страницы-раздела куда грязнее: на Bangor
  // в них попали «This scholarship is not available for 2026/27» и заголовок новости про
  // грант Leverhulme. Поэтому заголовки раздела идут в дело ТОЛЬКО когда отдельных
  // страниц не нашлось вовсе, и с пониженной уверенностью.
  const fromDetail = []; const fromHub = [];
  const mkAdd = (bucket) => (s) => {
    if (!s) return;
    s.name = s.name.replace(/[:\s]+$/, '').trim();
    if (s.name.length > 100) return;      // заголовок новости, а не название стипендии
    if (SECTION_TITLE.test(s.name) || NOT_A_NAME.test(s.name) || FIELD_LABEL.test(s.name)) return;
    if (!bucket.some((x) => x.name.toLowerCase() === s.name.toLowerCase())) bucket.push(s);
  };
  const addDetail = mkAdd(fromDetail); const addHub = mkAdd(fromHub);

  const details = new Set();
  for (const url of cand.slice(0, MAX_PAGES)) {
    let html;
    try { html = await fetchHtml(url); } catch { continue; }
    pagesRead.push(url);
    for (const s of parseScholarships(html, url)) addHub(s);
    for (const d of detailUrls(html, base, url)) details.add(d);
  }

  // Отдельные страницы стипендий: имя и сумма там подписаны, а на странице-разделе
  // их может не быть вовсе. Потолок — чтобы один вуз не съел прогон целиком.
  let n = 0;
  for (const url of details) {
    if (n++ >= MAX_DETAILS) break;
    if (pagesRead.includes(url)) continue;
    let html;
    try { html = await fetchHtml(url); } catch { continue; }
    pagesRead.push(url);
    addDetail(parseDetail(html, url));
  }
  const detailsSkipped = Math.max(0, details.size - MAX_DETAILS);

  const items = fromDetail.length
    ? fromDetail
    : fromHub.map((s) => ({ ...s, verifiedBySite: false, confidence: 0.5 }));
  const origin = fromDetail.length ? 'detail-pages' : (fromHub.length ? 'hub-headings' : 'none');

  return {
    slug, status: items.length ? 'ok' : 'nothing-found', found: items.length,
    base, pagesRead, items, detailsSkipped, origin,
  };
}

async function main() {
  const now = new Date().toISOString();
  await fs.mkdir(OUT_DIR, { recursive: true });
  const done = new Set(SKIP_DONE ? (await fs.readdir(OUT_DIR).catch(() => [])).map((f) => f.replace(/\.json$/, '')) : []);

  let files = (await fs.readdir(WORK)).filter((f) => f.endsWith('.json'));
  if (ONLY) files = files.filter((f) => f === `${ONLY}.json`);
  files = files.filter((f) => !done.has(f.replace(/\.json$/, ''))).slice(0, LIMIT === Infinity ? undefined : LIMIT);
  log(`к обходу ${files.length} вузов${done.size ? `, пропущено уже собранных ${done.size}` : ''}`);

  const report = [];
  let n = 0;
  for (const f of files) {
    const slug = f.replace(/\.json$/, '');
    const uni = await readJson(path.join(WORK, f));
    const r = await collectOne(uni, slug);
    // detailsSkipped пишем поимённо: молча обрезать сбор потолком — это отчитаться
    // об успехе на части данных (урок Edvoy, сессия 3).
    report.push({
      slug, status: r.status, found: r.found, pages: (r.pagesRead ?? []).length,
      origin: r.origin ?? null, detailsSkipped: r.detailsSkipped ?? 0,
    });
    if (r.items?.length) {
      await writeExtract('scholarships', slug, {
        slug, name: uni.name, source: 'official-site', sourceUrl: r.base,
        scrapedAt: now, access: 'public', pagesRead: r.pagesRead,
        // Откуда взяты записи. detail-pages — с отдельных страниц стипендий (имя из h1,
        // сумма подписана); hub-headings — с заголовков страницы-раздела, там мусор ловится
        // регулярками и остаётся риск: такие записи идут с verifiedBySite:false.
        origin: r.origin,
        scholarships: r.items,
      }, { dryRun: DRY });
    }
    if (++n % 10 === 0) log(`… ${n}/${files.length}, найдено записей ${report.reduce((a, b) => a + b.found, 0)}`);
  }

  const byStatus = {};
  for (const r of report) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  const total = report.reduce((a, b) => a + b.found, 0);
  if (!DRY) {
    await fs.writeFile(path.join(KOMPAS_DIR, 'scholarship-collect-report.json'),
      JSON.stringify({ generatedAt: now, summary: { universities: report.length, byStatus, records: total }, universitiesDetail: report }, null, 2) + '\n', 'utf8');
  }
  log(`вузов ${report.length}: ${Object.entries(byStatus).map(([k, v]) => `${k} ${v}`).join(', ')}; записей ${total}`);
  log(`запросов ${stats.requests}, неудач ${stats.failed}`);
  console.log('SCHOLARSHIP COLLECT DONE', JSON.stringify({ universities: report.length, records: total, byStatus }));
}

main().catch((e) => { console.error(e); process.exit(1); });
