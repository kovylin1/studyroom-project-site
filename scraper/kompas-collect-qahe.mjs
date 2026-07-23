#!/usr/bin/env node
// kompas-collect-qahe.mjs — КОМПАС сессия 2, агрегатор QA Higher Education.
//
// ГДЕ ЛЕЖАТ ДАННЫЕ (найдено замером 2026-07-22). Страницы /partner-institutions/<вуз>/ программ
// БОЛЬШЕ НЕ содержат — там только ссылки «Courses / Dates and Fees» и адреса кампусов.
// Настоящий каталог курсов перечислен на https://qahighereducation.com/courses/ и ведёт
// на ПОДДОМЕНЫ ПАРТНЁРОВ: london.northumbria.ac.uk, qa.ulster.ac.uk, qa.solent.ac.uk,
// qa.londonmet.ac.uk. Отсюда привязка курса к вузу берётся ПО ДОМЕНУ — однозначно.
//
// ПОЧЕМУ НЕ ПО ТЕКСТУ. Первая версия привязывала по упоминанию названия вуза на странице
// и дала ложные 9 курсов Northumbria: в подвале сайта перечислены все шесть партнёров,
// и побеждал первый по списку. Замер: настоящий партнёр упоминается 11–16 раз, подвальный —
// ровно один. По домену такой ошибки нет вовсе.
//
// НАХОДКИ ДЛЯ ВЛАДЕЛЬЦА:
//  - Состав: документ называет 4 партнёров, сайт показывает 6 (+London Metropolitan, +Swansea).
//    По правилу 2 состав определяет документ; лишние помечены notInOwnerList.
//  - У Oxford Brookes, который В СПИСКЕ ВЛАДЕЛЬЦА, на живом сайте QA НЕТ НИ ОДНОГО курса.
//  - Страницы «International Foundation Programme» на самом qahighereducation.com теперь
//    редиректят на southwales.ac.uk — эти программы ушли к University of South Wales.
//  - Прежний scrape-qahe-all.mjs при пустом парсинге подставлял fallbackPrograms() и брал
//    duration/intake из таблицы по уровню, а не со страницы. Здесь только то, что на источнике.
//
// Usage: node scraper/kompas-collect-qahe.mjs [--dry-run] [--limit=N]

import {
  fetchHtml, htmlToCells, parseMoney, mapLevel, decodeEntities,
  writeExtract, writeMembership, extract, args, logger, stats,
} from './lib/kompas-collect.mjs';

const log = logger('qahe');
const AGG = 'qahe';
const BASE = 'https://qahighereducation.com';
const INDEX = `${BASE}/courses/`;

const DRY = args.has('dry-run');
const LIMIT = args.num('limit', Infinity);

// Партнёры QA. Документ владельца называл четверых; РЕШЕНИЕМ ВЛАДЕЛЬЦА от 2026-07-22
// список расширен до шести — London Metropolitan и Swansea включены, Oxford Brookes
// оставлен партнёром, хотя курсов у него на живом сайте QA нет.
const OWNER_LIST = [
  { key: 'northumbria', name: 'Northumbria University', catalogSlug: 'northumbria' },
  { key: 'ulster', name: 'Ulster University', catalogSlug: 'ulster' },
  { key: 'oxford-brookes', name: 'Oxford Brookes University', catalogSlug: 'oxford-brookes', note: 'Курсов на живом сайте QA нет; карточка сохраняется решением владельца.' },
  { key: 'solent', name: 'Solent University', catalogSlug: 'solent' },
  { key: 'london-met', name: 'London Metropolitan University', catalogSlug: 'london-met', addedBy: 'owner-2026-07-22' },
  { key: 'swansea', name: 'Swansea University', catalogSlug: 'swansea', addedBy: 'owner-2026-07-22' },
];

// Домен курса -> вуз. Единственный надёжный признак принадлежности.
const HOST_TO_PARTNER = {
  'london.northumbria.ac.uk': 'northumbria',
  'pathway.northumbria.ac.uk': 'northumbria',
  'online.northumbria.ac.uk': 'northumbria',
  'qa.ulster.ac.uk': 'ulster',
  'qa.solent.ac.uk': 'solent',
  'qa.londonmet.ac.uk': 'london-met',
  'qa.brookes.ac.uk': 'oxford-brookes',
  'pathway.brookes.ac.uk': 'oxford-brookes',
  'qa.swansea.ac.uk': 'swansea',
};

const PARTNER_META = {
  northumbria: { name: 'Northumbria University', catalogSlug: 'northumbria' },
  ulster: { name: 'Ulster University', catalogSlug: 'ulster' },
  solent: { name: 'Solent University', catalogSlug: 'solent' },
  'oxford-brookes': { name: 'Oxford Brookes University', catalogSlug: 'oxford-brookes' },
  'london-met': { name: 'London Metropolitan University', catalogSlug: 'london-met' },
  swansea: { name: 'Swansea University', catalogSlug: 'swansea' },
  'qa-own': { name: 'QA Higher Education (собственные программы)', catalogSlug: null },
};

// --------------------------------------------------------- живой состав ----
const partnersHtml = await fetchHtml(`${BASE}/partner-institutions/`);
const livePartnerSlugs = [...new Set(
  [...partnersHtml.matchAll(/href="([^"]*\/partner-institutions\/([^"#?/]+)\/)"/g)].map((m) => m[2]),
)];
log(`партнёров на странице /partner-institutions/: ${livePartnerSlugs.length}`);

// ------------------------------------------------------- список курсов ----
const indexHtml = await fetchHtml(INDEX);
const courseUrls = [...new Set(
  [...indexHtml.matchAll(/href="(https?:\/\/[^"]+\/(?:courses?|centres\/courses|pathway\/courses)\/[^"#?]+\/)"/g)]
    .map((m) => m[1].replace(/^http:/, 'https:')),
)];
log(`ссылок на курсы в индексе: ${courseUrls.length}`);

const grouped = new Map();
for (const url of courseUrls) {
  const host = new URL(url).host;
  const key = HOST_TO_PARTNER[host] || (host === 'qahighereducation.com' ? 'qa-own' : null);
  if (!key) { log(`? неизвестный домен курса: ${host}`); continue; }
  if (!grouped.has(key)) grouped.set(key, []);
  grouped.get(key).push(url);
}
for (const [k, v] of [...grouped].sort((a, b) => b[1].length - a[1].length)) log(`  ${k}: ${v.length} курсов`);

// ------------------------------------------------------------- цена ----
// Три формата, все три встречены замером 2026-07-22:
//   Ulster    «Tuition fees for 2026/27» | «UK/Home students:» | «£8,500» | «International students:» | «£16,200»
//             — подпись аудитории лежит В ОТДЕЛЬНОЙ ячейке, не вместе с числом;
//   Northumbria «International Fee: £17,250 (26/27)» — подпись и число в одной ячейке;
//   Solent    «Tuition fees:» | «£9,790 per annum*» — аудитории нет вовсе (это цена для британцев,
//             но на странице так не написано, поэтому ставим 'unknown' и не решаем за источник).
// Международную цену предпочитаем британской: каталог рассчитан на казахстанских студентов.
const AUDIENCE_RE = /\b(international|overseas|non[- ]?uk|uk\s*\/\s*home|uk|home)\b/i;
const FEE_HINT_RE = /\b(tuition|fee)s?\b/i;

function classifyAudience(s) {
  const m = s.match(AUDIENCE_RE);
  if (!m) return null;
  return /^(international|overseas|non)/i.test(m[1]) ? 'international' : 'UK';
}

// Сумма без валюты и «сумма», которая на самом деле год, — это не цена.
// Замер сессии 4: из 102 цен QAHE 20 попадали в 1990–2035, а 28 шли вовсе без
// валюты. Источник виноват не был: подпись «Tuition fees for 2026/27» отдаёт
// число 2026, и порог «больше 1000» его пропускал. У Ulster так родилась
// «цена 2023 USD».
const YEAR_MIN = 1990;
const YEAR_MAX = 2035;

function isPlausibleFee(money, cell) {
  if (!money || typeof money.amount !== 'number') return false;
  if (!money.currency) return false;               // цена без валюты недостоверна
  if (money.amount < 1000) return false;
  // Год отбрасываем, если рядом с числом не стоял знак валюты: «£2,026» теоретически
  // возможен как цена, «Tuition fees for 2026/27» — нет.
  // Ячейка-простыня — это текст страницы, а не строка прайса. Настоящая подпись
  // цены короткая: «£16,200», «International Fee: £17,250 (26/27)».
  if ((cell || '').length > 200) return false;

  if (money.amount >= YEAR_MIN && money.amount <= YEAR_MAX) {
    // Мало того, что знак валюты есть в ячейке, — он должен стоять вплотную
    // к ЭТОМУ числу. У Ulster «global trade projected to reach US$86.6 trillion
    // by 2023» знак валюты относится к 86.6, а ценой уезжал 2023.
    if (!currencyAdjacent(cell || '', money.amount)) return false;
  }
  return true;
}

/** Стоит ли знак валюты вплотную перед самим числом (а не где-то в той же ячейке). */
function currencyAdjacent(cell, amount) {
  const digits = String(amount);
  const withCommas = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  for (const form of new Set([digits, withCommas])) {
    const re = new RegExp(`(?:[£$€]|\\b(?:GBP|USD|EUR)\\b)\\s*${form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(cell)) return true;
  }
  return false;
}

function findFee(cells) {
  const found = [];
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    const hasHint = FEE_HINT_RE.test(c);
    const aud = classifyAudience(c);
    if (!hasHint && !aud) continue;

    // число в этой же ячейке
    const inline = parseMoney(c);
    if (isPlausibleFee(inline, c) && (hasHint || aud)) {
      found.push({ ...inline, feeAudience: aud || 'unknown', feeLabel: c.slice(0, 90) });
      continue;
    }
    // число в ближайших ячейках; подпись аудитории могла быть отдельной ячейкой
    for (let j = i + 1; j <= i + 2 && j < cells.length; j++) {
      const money = parseMoney(cells[j]);
      if (!isPlausibleFee(money, cells[j])) continue;
      found.push({ ...money, feeAudience: aud || 'unknown', feeLabel: `${c} ${cells[j]}`.slice(0, 90) });
      break;
    }
  }
  if (!found.length) return null;
  const rank = { international: 0, unknown: 1, UK: 2 };
  found.sort((a, b) => rank[a.feeAudience] - rank[b.feeAudience]);
  return found[0];
}

// ------------------------------------------------------ страница курса ----
function parseCoursePage(html, url) {
  const cells = htmlToCells(html);
  const text = cells.join(' ');
  const title = decodeEntities(
    (html.match(/<h1[^>]*>([\s\S]{3,200}?)<\/h1>/i)?.[1] || html.match(/<title>([^<]+)<\/title>/i)?.[1] || '')
      .replace(/<[^>]+>/g, ''),
  ).split(/\s+[|–—]\s+/)[0].replace(/\s+/g, ' ').replace(/[\s\-–—:]+$/, '').trim();

  const fee = findFee(cells);

  // Длительность берём ТОЛЬКО из явно подписанного места. Свободный поиск «N месяцев»
  // по всему тексту дал MSc длительностью «1 month» — лучше пусто, чем неверно.
  const durM = text.match(/\b(?:duration|course\s+length|length\s+of\s+(?:course|study))\b[^\d]{0,24}(\d(?:\.\d)?)\s*(year|month)s?/i);
  const durNum = durM ? Number(durM[1]) : null;
  const durUnit = durM ? durM[2].toLowerCase() : null;
  const plausible = durM && (durUnit === 'year' ? durNum >= 0.5 && durNum <= 7 : durNum >= 6 && durNum <= 60);
  const duration = plausible ? `${durM[1]} ${durUnit}${durNum === 1 ? '' : 's'}` : null;

  const intake = [...new Set(
    (text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b(?=[^.]{0,24}\b(?:20\d\d|intake|start|entry)\b)/gi) || [])
      .map((s) => s[0].toUpperCase() + s.slice(1).toLowerCase()),
  )];

  return {
    title,
    level: mapLevel(title),
    ...(duration ? { duration } : {}),
    ...(intake.length ? { intake } : {}),
    programUrl: url,
    ...(fee ? { feePerYear: fee.amount, currency: fee.currency, feeAudience: fee.feeAudience, feeLabel: fee.feeLabel } : {}),
  };
}

// ------------------------------------------------------------------ main ----
const report = [];
let processed = 0;
for (const [key, urls] of grouped) {
  const meta = PARTNER_META[key];
  const programs = [];
  for (const url of urls) {
    if (processed >= LIMIT) break;
    processed++;
    try {
      const html = await fetchHtml(url);
      const prog = parseCoursePage(html, url);
      if (prog.title) programs.push(prog);
    } catch (e) { log(`  ! ${url}: ${e.message}`); }
  }
  const owner = OWNER_LIST.find((o) => o.key === key);
  const withFee = programs.filter((p) => p.feePerYear).length;
  const intl = programs.filter((p) => p.feeAudience === 'international').length;
  report.push({ key, name: meta.name, courses: urls.length, parsed: programs.length, withFee, intl, inOwnerList: !!owner });

  if (programs.length && meta.catalogSlug) {
    await writeExtract(AGG, meta.catalogSlug, extract({
      slug: meta.catalogSlug,
      name: meta.name,
      source: AGG,
      sourceUrl: INDEX,
      extra: { aggregatorPartnerKey: key, inOwnerList: !!owner, coursesInSource: urls.length, programsWithFee: withFee },
      programs,
    }), { dryRun: DRY });
  }
  log(`${key}: курсов ${urls.length}, разобрано ${programs.length}, с ценой ${withFee} (международных ${intl})${owner ? '' : '  [НЕ В СПИСКЕ ВЛАДЕЛЬЦА]'}`);
}

const ownerWithoutCourses = OWNER_LIST.filter((o) => !(grouped.get(o.key) || []).length);

await writeMembership(AGG, {
  _meta: {
    aggregator: AGG,
    label: 'QA Higher Education',
    source: INDEX,
    collectedAt: new Date().toISOString(),
    rule: 'list',
    ownerListCount: OWNER_LIST.length,
    livePartnerPages: livePartnerSlugs.length,
    notes: [
      'Курсы QA физически лежат на поддоменах партнёров; привязка сделана по домену, не по тексту.',
      'Страницы /partner-institutions/ программ больше не содержат — прежний коллектор скрёб именно их и добирал fallbackPrograms().',
      'Страницы International Foundation Programme на qahighereducation.com редиректят на southwales.ac.uk.',
    ],
  },
  ownerList: OWNER_LIST,
  livePartnerPages: livePartnerSlugs,
  perPartner: report,
  ownerPartnersWithoutCourses: ownerWithoutCourses.map((o) => o.name),
  extraOnSite: report.filter((r) => !r.inOwnerList && r.key !== 'qa-own').map((r) => r.name),
}, { dryRun: DRY });

log('--- итог ---');
log(`курсов разобрано ${report.reduce((s, r) => s + r.parsed, 0)} из ${courseUrls.length}`);
log(`с ценой ${report.reduce((s, r) => s + r.withFee, 0)}, из них международных ${report.reduce((s, r) => s + r.intl, 0)}`);
if (ownerWithoutCourses.length) log(`ВНИМАНИЕ: партнёры из списка владельца без единого курса: ${ownerWithoutCourses.map((o) => o.name).join(', ')}`);
log(`запросов ${stats.requests}, торможений ${stats.throttled}, неудач ${stats.failed}`);
if (DRY) log('DRY-RUN: на диск не писали');
