#!/usr/bin/env node
// kompas-collect-navitas-programs.mjs — КОМПАС: программы сети Navitas.
//
// ЗАЧЕМ. Navitas — единственный агрегатор каталога, у которого программ не было
// НИ ОДНОЙ. Причина не в лени: общего портала курсов у сети нет, у колледжей нет
// типа записи «курс» в WP REST, и курсы лежат обычными страницами на 48 разных
// доменах со своей разметкой на каждом. До этого про Navitas в каталоге знали
// только seed-navitas-*.mjs, где цены заданы литеральной таблицей UK_FEE_BAND_BASE —
// выдуманные числа, которые правилом «не фабрикуем» держать нельзя.
//
// НА ЧЁМ ОСНОВАН ОБХОД. Разведка (kompas-navitas-recon.mjs, отчёт
// sources/kompas/navitas-recon.json) прошла все домены сети и показала, за что
// можно зацепиться: карта сайта у 37 доменов (~1103 адреса, похожих на курсы),
// типовой раздел курсов у 7, без зацепки 4 (acap, latrobe, mmu, westernic).
// Этот коллектор идёт ровно по разведанному, а не подбирает пути вслепую.
//
// ЧЕГО ЗДЕСЬ НЕТ И ПОЧЕМУ.
//   * Цена не выводится и не достраивается. Берётся только явная сумма в денежном
//     контексте (tuition/fee/cost/per year) и только если валюта написана на
//     странице символом или кодом. Валюта, не совпавшая с валютой страны колледжа,
//     отбрасывается: у кампусов в Дубае и Сингапуре это чужая сумма.
//   * Программа без распознаваемого уровня не создаётся (правило сбора проекта).
//   * Строка с голой квалификацией вместо названия («Master's», «Courses») не
//     программа, а заголовок раздела — такие отбрасываются.
//   * Живой каталог не трогается ни на шаг: выгрузки уходят в песочницу
//     sources/kompas/extracts/navitas/.
//
// Запуск:
//   node scraper/kompas-collect-navitas-programs.mjs --dry-run       # ничего не пишет
//   node scraper/kompas-collect-navitas-programs.mjs                 # полный сбор
//   node scraper/kompas-collect-navitas-programs.mjs --only=swansea.ac.uk
//   node scraper/kompas-collect-navitas-programs.mjs --refresh       # не брать домены из кэша
//   флаги: --limit-domains=N --limit-pages=N (по умолчанию 400 на домен)

import fs from 'fs/promises';
import path from 'path';
import {
  KOMPAS_DIR, fetchQueued, writeExtract, extract, mapLevel, decodeEntities,
  args, logger, stats,
} from './lib/kompas-collect.mjs';
import { expectedCurrency } from './lib/country-currency.mjs';
import { qualificationFamilies } from './lib/program-level.mjs';

const log = logger('navitas-prog');
const AGG = 'navitas';
const MEMBERSHIP = path.join(KOMPAS_DIR, 'membership', 'navitas.json');
const RECON = path.join(KOMPAS_DIR, 'navitas-recon.json');
const CACHE_DIR = path.join(KOMPAS_DIR, 'navitas', 'domains');

const DRY = args.has('dry-run');
const REFRESH = args.has('refresh');
const ONLY = args.get('only');
const LIMIT_DOMAINS = args.num('limit-domains', 0);
const LIMIT_PAGES = args.num('limit-pages', 400);

// Отрезок пути, а не слово где угодно: «/about/our-courses-are-great» — не курс.
const COURSE_PATH = /\/(courses?|programs?|programmes?|study|degrees?|qualifications?)\//i;
// Голая квалификация вместо названия — заголовок раздела, а не программа.
const BARE_TITLE = /^((under|post)graduate(\s+(study|courses?|programmes?|programs?|degrees?))?|master'?s?|bachelor'?s?|certificates?|diplomas?|foundation|courses?|programmes?|programs?|degrees?|study|our courses|search|home)$/i;
// Служебные страницы раздела «Учёба» проходят проверку уровня («Postgraduate Entry
// Requirements» — это master по правилам), но программой не являются. Первый прогон
// по lancasterleipzig.de принёс пять таких из шестнадцати — ловим по названию.
const NOT_A_PROGRAM_TITLE = /\b(entry requirements?|academic calendar|term dates|how to apply|application process|fees? (and|&) funding|tuition fees?|student life|why choose|our campus|open days?|admissions?|scholarships?|accommodation|visa|english language requirements?|coming soon)\b/i;
// Сводная страница факультета («Law Undergraduate Courses», «School of Psychology
// Undergraduate Courses») — перечень программ, а не программа. Swansea, самый
// крупный сайт сети, принёс таких десятками.
const FACULTY_INDEX_TITLE = /(under|post)graduate\s+(courses?|study|degrees?|programmes?|programs?)$/i;

// Проверка названия живёт одной функцией и применяется дважды: при обходе и при
// сборке выгрузок из кэша доменов. Иначе уточнённое правило требовало бы заново
// выкачать тысячу страниц ради переотбора уже собранного.
function isProgramTitle(t) {
  const title = String(t || '').trim();
  if (title.length < 4) return false;
  return !BARE_TITLE.test(title) && !NOT_A_PROGRAM_TITLE.test(title) && !FACULTY_INDEX_TITLE.test(title);
}
// Разделы, которые выглядят как курс по адресу, но курсом не являются.
const NOT_A_COURSE = /\/(news|blog|events?|staff|about|contact|apply|fees|scholarships?|accommodation|search|tag|category|author|page|entry-requirements?|requirements|academic-calendar|term-dates|how-to-apply)\//i;
const FEE_CTX = /(tuition|fee|fees|cost|price|per\s*year|per\s*annum|annual|yearly|indicative)/i;
// Британский сайт печатает рядом два тарифа: внутренний и международный. Наш студент —
// международный, а внутренний меньше вдвое, и по правилу минимума он бы выиграл.
// Тот же капкан уже ловил каталог на QAHE: 9 790 GBP — это потолок платы для британцев,
// а не цена для иностранца.
const HOME_CTX = /\b(home|uk|domestic|eu|welsh|scottish|english)\b[^.]{0,30}\b(students?|fees?|tuition|rate)\b|\bfees?\b[^.]{0,20}\b(home|uk|domestic)\b/i;
const INTL_CTX = /\b(international|overseas|non-?uk|non-?eu)\b/i;
const UK_HOME_CAP = /^(92|93|94|95|96|97|98|99)\d\d$/;   // 9 000–9 999 GBP — полоса внутреннего тарифа
const MONEY = /(A\$|C\$|NZ\$|S\$|[£€$])\s?([\d][\d,]{2,8})|([\d][\d,]{3,8})\s?\b(GBP|EUR|USD|AUD|CAD|NZD|SGD|AED|MYR)\b/gi;

function clean(s) {
  return decodeEntities(String(s || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

// Символ валюты однозначен не всегда: «$» в Австралии и Сингапуре значит разное.
// Поэтому символ разрешается только в валюту страны колледжа, а код — как написан.
function symbolToCurrency(tok, countryCurrency) {
  const t = (tok || '').trim().toUpperCase();
  if (t === 'A$') return 'AUD';
  if (t === 'C$') return 'CAD';
  if (t === 'NZ$') return 'NZD';
  if (t === 'S$') return 'SGD';
  if (t === '£') return 'GBP';
  if (t === '€') return 'EUR';
  if (t === '$') return ['USD', 'AUD', 'CAD', 'NZD', 'SGD'].includes(countryCurrency) ? countryCurrency : null;
  return null;
}

function extractFee(html, countryCurrency) {
  if (!countryCurrency) return null;
  const text = clean(html);
  for (const m of text.matchAll(MONEY)) {
    const ctx = text.slice(Math.max(0, m.index - 70), m.index + 70);
    if (!FEE_CTX.test(ctx)) continue;              // сумма обязана стоять в денежном контексте
    const cur = m[1] ? symbolToCurrency(m[1], countryCurrency) : (m[4] || '').toUpperCase();
    if (!cur || cur !== countryCurrency) continue; // чужая валюта — не наша сумма
    const n = parseInt(String(m[2] || m[3]).replace(/,/g, ''), 10);
    if (!Number.isFinite(n) || n < 1000 || n > 200000) continue;
    const intl = INTL_CTX.test(ctx);
    if (!intl && HOME_CTX.test(ctx)) continue;                       // рядом написано «для британцев»
    if (!intl && cur === 'GBP' && UK_HOME_CAP.test(String(n))) continue;
    return { amount: n, currency: cur, raw: m[0].trim(), audience: intl ? 'international' : null };
  }
  return null;
}

// Уровень берём общей картой правил проекта, а не своей. Две квалификации в названии
// («BEng (Hons) / MEng (Hons)») — законное совместное название, и модуль молчит:
// первый прогон без этого записал такие строки магистратурой.
function levelOf(title) {
  const fams = qualificationFamilies(title);
  if (fams.length === 1) return fams[0];
  if (fams.length > 1) return null;
  return mapLevel(title);    // квалификация не названа — общие правила (foundation, pathway, diploma)
}

function extractTitle(html) {
  const h1 = (html.match(/<h1[^>]*>([\s\S]{3,300}?)<\/h1>/i) || [])[1];
  const og = (html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']{3,300})["']/i) || [])[1];
  const ti = (html.match(/<title[^>]*>([^<]{3,300})<\/title>/i) || [])[1];
  const raw = clean(h1 || og || ti || '');
  // «Nursing BSc | Swansea University» -> «Nursing BSc»
  return raw.replace(/\s*[|–—]\s*[^|–—]{3,60}$/, '').trim() || raw;
}

function extractDuration(html) {
  const t = clean(html);
  const m = t.match(/\b(\d+(?:\.\d+)?)\s*(years?|yrs?|months?|weeks?)\b/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const u = m[2].toLowerCase();
  if (u.startsWith('year') || u.startsWith('yr')) return n <= 10 ? n : null;
  if (u.startsWith('month')) return +(n / 12).toFixed(2);
  if (u.startsWith('week')) return +(n / 52).toFixed(2);
  return null;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function extractIntakes(html) {
  const t = clean(html);
  const hit = new Set();
  const window_ = t.match(/(intake|start dates?|commencement|starts? in)[^.]{0,200}/gi) || [];
  for (const w of window_) for (const mo of MONTHS) if (new RegExp(`\\b${mo}\\b`, 'i').test(w)) hit.add(mo);
  return [...hit];
}

async function getHtml(url) {
  try {
    const { text, url: finalUrl } = await fetchQueued(url, { accept: 'text/html,application/xhtml+xml' });
    return { html: text, finalUrl };
  } catch { return null; }
}

// Карта сайта бывает индексом карт — спускаемся, но держим счётчик, чтобы не уйти
// в дерево из сотен файлов на крупных университетских сайтах.
async function urlsFromSitemap(origin) {
  const found = new Set();
  const queue = ['/sitemap.xml', '/sitemap_index.xml', '/sitemap-index.xml', '/wp-sitemap.xml'].map((s) => origin + s);
  const seen = new Set();
  let maps = 0;
  while (queue.length && found.size < LIMIT_PAGES && maps < 40) {
    const u = queue.shift();
    if (seen.has(u)) continue;
    seen.add(u);
    const r = await getHtml(u);
    if (!r?.html || !r.html.includes('<loc>')) continue;
    maps++;
    for (const m of r.html.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const loc = m[1].trim();
      if (/sitemap[^/]*\.xml(\.gz)?$/i.test(loc)) {
        // в индексе карт идём сперва в те, что похожи на курсы
        if (COURSE_PATH.test(loc) || /course|program|study|degree/i.test(loc)) queue.unshift(loc);
        else queue.push(loc);
        continue;
      }
      if (COURSE_PATH.test(loc) && !NOT_A_COURSE.test(loc)) found.add(loc.split('#')[0]);
    }
  }
  return [...found];
}

async function urlsFromSections(origin) {
  const found = new Set();
  for (const sub of ['/courses/', '/courses', '/programs/', '/programmes/', '/study/', '/our-courses/']) {
    const r = await getHtml(origin + sub);
    if (!r?.html) continue;
    for (const m of r.html.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)) {
      let u;
      try { u = new URL(m[1], origin); } catch { continue; }
      if (u.origin !== origin) continue;
      if (!COURSE_PATH.test(u.pathname) || NOT_A_COURSE.test(u.pathname)) continue;
      if (u.pathname.split('/').filter(Boolean).length < 2) continue;   // сам раздел, не карточка
      found.add(u.origin + u.pathname);
    }
    if (found.size) break;
  }
  return [...found];
}

async function collectDomain(dom, countryCurrency) {
  const cacheFile = path.join(CACHE_DIR, `${dom.origin.replace(/^https?:\/\//, '').replace(/[^\w.-]/g, '_')}.json`);
  if (!REFRESH) {
    try { return JSON.parse(await fs.readFile(cacheFile, 'utf8')); } catch { /* кэша нет — собираем */ }
  }

  let urls = dom.method === 'sections' ? await urlsFromSections(dom.origin) : await urlsFromSitemap(dom.origin);
  if (!urls.length && dom.method !== 'sections') urls = await urlsFromSections(dom.origin);
  urls = urls.slice(0, LIMIT_PAGES);
  log(`  ${dom.origin}: адресов курсов ${urls.length}`);

  const programs = [];
  const seen = new Set();
  let skippedNoLevel = 0; let skippedBare = 0;
  for (const u of urls) {
    const r = await getHtml(u);
    if (!r?.html) continue;
    const title = extractTitle(r.html);
    if (!title || title.length < 4) continue;
    if (!isProgramTitle(title)) { skippedBare++; continue; }
    const level = levelOf(title);
    if (!level) { skippedNoLevel++; continue; }          // уровень не выдумываем
    const key = `${level}::${title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const fee = extractFee(r.html, countryCurrency);
    const duration = extractDuration(r.html);
    const intake = extractIntakes(r.html);
    programs.push({
      title,
      level,
      ...(duration ? { duration: `${duration} years` } : {}),
      ...(intake.length ? { intake } : {}),
      programUrl: r.finalUrl || u,
      ...(fee ? { feePerYear: fee.amount, currency: fee.currency, _feeRaw: fee.raw } : {}),
      ...(fee?.audience ? { feeAudience: fee.audience } : {}),
    });
  }
  const result = { origin: dom.origin, urls: urls.length, programs, skippedNoLevel, skippedBare, collectedAt: new Date().toISOString() };
  if (!DRY) {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(cacheFile, JSON.stringify(result, null, 2) + '\n', 'utf8');
  }
  log(`  ${dom.origin}: программ ${programs.length} (без уровня ${skippedNoLevel}, общих названий ${skippedBare})`);
  return result;
}

// ------------------------------------------------------------------ прогон ----
const membership = JSON.parse(await fs.readFile(MEMBERSHIP, 'utf8'));
const recon = JSON.parse(await fs.readFile(RECON, 'utf8'));

// домен -> какие карточки каталога он кормит и в какой стране колледж
const domainInfo = new Map();
for (const c of membership.colleges) {
  if (!c.collegeUrl) continue;
  let origin;
  try { origin = new URL(c.collegeUrl).origin; } catch { continue; }
  if (!domainInfo.has(origin)) domainInfo.set(origin, { origin, slugs: new Set(), names: new Set(), countries: new Set() });
  const d = domainInfo.get(origin);
  if (c.catalogSlug) d.slugs.add(c.catalogSlug);
  if (c.catalogName || c.derivedUniversityName) d.names.add(c.catalogName || c.derivedUniversityName);
  if (c.collegeCountry) d.countries.add(c.collegeCountry);
}

let domains = recon.domains
  .filter((r) => r.method !== 'нет зацепки')
  .map((r) => ({ ...r, info: domainInfo.get(r.origin) }))
  .filter((r) => r.info);
if (ONLY) domains = domains.filter((r) => r.origin.includes(ONLY) || [...r.info.slugs].some((s) => s === ONLY));
if (LIMIT_DOMAINS) domains = domains.slice(0, LIMIT_DOMAINS);

log(`старт${DRY ? ' (сухой прогон)' : ''}: доменов к обходу ${domains.length} из ${recon.domains.length}`);

const bySlug = new Map();
let done = 0;
for (const dom of domains) {
  const country = [...dom.info.countries][0] || null;
  const cur = expectedCurrency(country);
  const res = await collectDomain(dom, cur);
  for (const slug of dom.info.slugs) {
    if (!bySlug.has(slug)) bySlug.set(slug, { slug, name: [...dom.info.names][0] || slug, programs: [], origins: [], currency: cur });
    const b = bySlug.get(slug);
    b.origins.push(dom.origin);
    b.programs.push(...res.programs);
  }
  if (++done % 5 === 0) log(`… доменов пройдено ${done}/${domains.length}`);
}

// Один слаг кормится несколькими площадками (SAE — три страны): чистим повторы.
let written = 0; let totalPrograms = 0; let withFee = 0;
for (const b of bySlug.values()) {
  const seen = new Set();
  const programs = b.programs.filter((p) => {
    if (!isProgramTitle(p.title)) return false;   // переотбор уже собранного из кэша
    const k = `${p.level}::${p.title.toLowerCase()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (!programs.length) continue;
  totalPrograms += programs.length;
  withFee += programs.filter((p) => p.feePerYear).length;
  await writeExtract(AGG, b.slug, extract({
    slug: b.slug,
    name: b.name,
    source: 'navitas',
    sourceUrl: b.origins[0],
    currency: b.currency,
    programs,
    extra: { collegeOrigins: b.origins, programsWithFee: programs.filter((p) => p.feePerYear).length },
  }), { dryRun: DRY });
  written++;
}

// Замер состава уже лежит в membership/navitas.json — он про сеть, а не про программы.
// Дописываем к нему итог сбора, не затирая ничего из прежнего.
if (!DRY) {
  membership.programsRun = {
    collectedAt: new Date().toISOString(),
    domainsProbed: recon.domains.length,
    domainsWalked: domains.length,
    domainsWithoutHook: recon.domains.filter((r) => r.method === 'нет зацепки').map((r) => r.origin),
    cardsWritten: written,
    programs: totalPrograms,
    programsWithFee: withFee,
    note: 'Цена берётся только явная и только в валюте страны колледжа; уровень не выдумывается.',
  };
  await fs.writeFile(MEMBERSHIP, JSON.stringify(membership, null, 2) + '\n', 'utf8');
}

log('--- итог ---');
log(`карточек с программами ${written}, программ ${totalPrograms}, с ценой ${withFee}`);
log(`запросов ${stats.requests}, торможений ${stats.throttled}, неудач ${stats.failed}`);
if (DRY) log('DRY-RUN: на диск не писали');
