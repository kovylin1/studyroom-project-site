#!/usr/bin/env node
// kompas-collect-oxford-international.mjs — КОМПАС сессия 2, агрегатор Oxford International.
//
// ЗАЧЕМ. До сессии 2 данные OI в каталоге приходили из `seed-oxfordintl-uk.mjs` — сид-скрипта,
// где цены заданы литеральной таблицей UK_FEE_BAND_BASE (foundation 14500, utp-business 15500…).
// Это нарушение правила «не фабриковать»: числа не взяты с источника, а придуманы.
// Здесь берётся настоящее: у oxfordinternational.com открытый WP REST (partner/course) плюс
// на странице курса таблица Details с реальной строкой «Tuition fee | From | £17,000 GBP».
//
// ЧТО ДЕЛАЕТ
//   1) /wp-json/wp/v2/partner  -> живой список партнёров (на 2026-07-22 их 26);
//   2) /wp-json/wp/v2/course   -> все курсы (на 2026-07-22 их 1420), связь с партнёром — по слагу
//      вида `pathway-<partner-slug>-…` / `degree-<partner-slug>-…`;
//   3) страница каждого курса  -> Study Level, Routes, Study type, Study mode, Tuition fee,
//      Start Dates, Campus, Pathway.
//   4) складывает по партнёрам в sources/kompas/extracts/oxford-international/<slug>.json
//      и живой состав в sources/kompas/membership/oxford-international.json.
//
// ВАЖНО. Поле content у REST-объекта OI ненадёжно: в карточке курса Sheffield Hallam
// в HTML сидит заголовок «Industrial Engineering and Renewables» и текст «at the University
// of Bradford». Поэтому content НЕ парсим — только title из REST и таблицу Details со страницы.
// ACF публично не отдаётся (acf: []), поэтому связь курс->партнёр берётся из слага.
//
// Живой каталог не трогается. Usage:
//   node scraper/kompas-collect-oxford-international.mjs [--limit=N] [--partner=slug] [--dry-run]

import {
  fetchJson, fetchHtml, htmlToCells, cellAfter, cellsAfterAll, parseMoney, mapLevel, decodeEntities,
  writeExtract, writeMembership, extract, args, logger, stats, HttpError,
} from './lib/kompas-collect.mjs';

const log = logger('oi');
const AGG = 'oxford-international';
const BASE = 'https://www.oxfordinternational.com';
const API = `${BASE}/wp-json/wp/v2`;

const DRY = args.has('dry-run');
const LIMIT = args.num('limit', Infinity);
const ONLY = args.get('partner');

// ------------------------------------------------------------------ REST ----
async function fetchAll(type, fields) {
  const out = [];
  for (let page = 1; page <= 40; page++) {
    let batch;
    try {
      batch = await fetchJson(`${API}/${type}?per_page=100&page=${page}&_fields=${fields}`);
    } catch (e) {
      if (e instanceof HttpError && e.status === 400) break; // страница за концом списка
      throw e;
    }
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

// -------------------------------------------------------- страница курса ----
// Таблица Details на странице курса, проверено глазами на двух карточках:
//   Details | Course | <название> | Study Level | Undergraduate | Routes | 4 years: … |
//   Pathway | <название> | Study type | Degree | Study mode | Full Time |
//   Tuition fee | From | £17,000 GBP | Scholarships | … | Start Dates | September | Campus | …
// Метки таблицы Details — служат границами при сборе многозначных полей.
const DETAIL_LABELS = [
  'Details', 'Course', 'Study Level', 'Routes', 'Pathway', 'Study type', 'Study mode',
  'Tuition fee', 'Scholarships', 'Start Dates', 'Campus', 'Entry Requirements',
  'English Requirements', 'Modules', 'Overview',
];

function parseCoursePage(html, { title, link }) {
  const cells = htmlToCells(html);
  const at = (label) => cellAfter(cells, label);

  const feeRaw = at('Tuition fee');
  const money = parseMoney(feeRaw);
  const studyLevel = at('Study Level');   // Undergraduate / Postgraduate
  const studyType = at('Study type');     // Degree / Study Preparation
  const routes = at('Routes');
  const mode = at('Study mode');
  const pathway = at('Pathway');
  // У Start Dates и Campus значений бывает несколько подряд — берём все до следующей метки.
  const startCells = cellsAfterAll(cells, 'Start Dates', DETAIL_LABELS);
  const campusCells = cellsAfterAll(cells, 'Campus', DETAIL_LABELS);
  const campus = campusCells.length ? campusCells.join('; ') : null;

  // «Reach out to our admissions team for details» — это не стипендия, а отписка. Не берём.
  const scholarshipRaw = at('Scholarships');
  const scholarship = scholarshipRaw && !/reach out|contact|admissions team/i.test(scholarshipRaw)
    ? scholarshipRaw : null;

  const intake = [...new Set(
    (startCells.join(' ').match(/January|February|March|April|May|June|July|August|September|October|November|December/gi) || [])
      .map((m) => m[0].toUpperCase() + m.slice(1).toLowerCase()),
  )];

  // Уровень: сперва явный Study type/Study Level, затем название.
  const level = /study preparation|pathway/i.test(studyType || '')
    ? mapLevel(title, pathway) || 'foundation'
    : mapLevel(title, studyLevel, studyType);

  // Длительность вытаскиваем из Routes только если она там явно записана («4 years: …»).
  const durMatch = routes && routes.match(/(\d+(?:\.\d+)?)\s*(year|month)s?/i);
  const duration = durMatch ? `${durMatch[1]} ${durMatch[2].toLowerCase()}${Number(durMatch[1]) === 1 ? '' : 's'}` : null;

  return {
    title: decodeEntities(title),
    level,
    ...(duration ? { duration } : {}),
    ...(intake.length ? { intake } : {}),
    programUrl: link,
    ...(money?.amount ? { feePerYear: money.amount } : {}),
    ...(money?.currency ? { currency: money.currency } : {}),
    ...(routes ? { routes } : {}),
    ...(campus ? { campus } : {}),
    ...(mode ? { studyMode: mode } : {}),
    ...(pathway ? { pathwayVia: pathway } : {}),
    ...(scholarship ? { scholarshipNote: scholarship } : {}),
    _feeRaw: feeRaw || null,
  };
}

// ------------------------------------------------------------------ main ----
const partners = await fetchAll('partner', 'id,slug,title,link');
log(`партнёров в REST: ${partners.length}`);

const courses = await fetchAll('course', 'id,slug,title,link');
log(`курсов в REST: ${courses.length}`);

// связь курс -> партнёр по самому длинному совпадающему слагу партнёра
const bySlugLen = [...partners].sort((a, b) => b.slug.length - a.slug.length);
const owned = new Map(partners.map((p) => [p.slug, []]));
const orphan = [];
for (const c of courses) {
  const body = c.slug.replace(/^(pathway|degree|course|english)-/, '');
  const hit = bySlugLen.find((p) => body === p.slug || body.startsWith(`${p.slug}-`));
  if (hit) owned.get(hit.slug).push(c);
  else orphan.push(c.slug);
}
log(`курсы разложены: привязано ${courses.length - orphan.length}, без партнёра ${orphan.length}`);
if (orphan.length) log(`  примеры без партнёра: ${orphan.slice(0, 8).join(', ')}`);

const membership = {
  _meta: {
    aggregator: AGG,
    label: 'Oxford International Education Group',
    source: `${API}/partner`,
    collectedAt: new Date().toISOString(),
    rule: 'all',
    note: 'Живой состав с сайта. Наши заметки от 2026-05-15 знали 21 партнёра, из них совпало лишь 7 — список сильно разошёлся, нужен просмотр владельцем.',
  },
  partners: partners.map((p) => ({
    slug: p.slug,
    name: decodeEntities(p.title?.rendered || '').trim(),
    url: p.link,
    courses: owned.get(p.slug).length,
  })).sort((a, b) => b.courses - a.courses),
  orphanCourseSlugs: orphan,
};

let done = 0;
const report = [];
for (const p of membership.partners) {
  if (ONLY && p.slug !== ONLY) continue;
  if (done >= LIMIT) break;
  done++;
  const list = owned.get(p.slug);
  const programs = [];
  let feeFound = 0;
  for (const c of list) {
    try {
      const html = await fetchHtml(c.link);
      const prog = parseCoursePage(html, { title: c.title?.rendered || c.slug, link: c.link });
      if (prog.feePerYear) feeFound++;
      programs.push(prog);
    } catch (e) {
      log(`  ! ${c.slug}: ${e.message}`);
    }
  }
  const currencies = [...new Set(programs.map((x) => x.currency).filter(Boolean))];
  const payload = extract({
    slug: p.slug,
    name: p.name,
    source: AGG,
    sourceUrl: p.url,
    currency: currencies.length === 1 ? currencies[0] : null,
    extra: { aggregatorPartnerSlug: p.slug, coursesInSource: list.length, programsWithFee: feeFound },
    programs,
  });
  const res = await writeExtract(AGG, p.slug, payload, { dryRun: DRY });
  report.push({ slug: p.slug, name: p.name, courses: list.length, parsed: programs.length, withFee: feeFound });
  log(`${p.slug}: курсов ${list.length}, разобрано ${programs.length}, с ценой ${feeFound}${res.written ? '' : ' (dry-run)'}`);
}

await writeMembership(AGG, membership, { dryRun: DRY });

log('--- итог ---');
log(`партнёров обработано: ${report.length} / ${partners.length}`);
log(`программ собрано: ${report.reduce((s, r) => s + r.parsed, 0)}, из них с реальной ценой: ${report.reduce((s, r) => s + r.withFee, 0)}`);
log(`запросов ${stats.requests}, торможений ${stats.throttled}, неудач ${stats.failed}, ${(stats.bytes / 1e6).toFixed(1)} МБ`);
if (DRY) log('DRY-RUN: на диск не писали');
