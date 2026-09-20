#!/usr/bin/env node
// kompas-collect-kaplan.mjs — КОМПАС. Kaplan Pathways.
//
// Источник тот же, что у майского scrape-kaplan-all.mjs: каждая страница degree-finder
// встраивает всю базу Kaplan одним JS-литералом `degree_finder_object = {...}` —
// институты, программы, цена за год, валюта, интейки. Один GET, без браузера, $0.
//
// Зачем переписан, а не переименован:
//   1. Привязка к каталогу. Майский матчер требовал, чтобы все слова названия вуза
//      каталога встречались в имени института фида. «University of Bristol» целиком
//      входит в «University of the West of England, Bristol» — и 120 программ UWE
//      легли на карточку Бристольского университета (сверка 18.09: 118 программ
//      `bristol` ведут на uwe.ac.uk). «Hartford Campus» Коннектикутского университета
//      тем же путём сел на University of Hartford. Здесь привязка идёт через общий
//      резолвер КОМПАСа со сверкой страны, и любой результат, добытый ХВОСТОМ после
//      запятой (у Kaplan это всегда кампус), отвергается.
//   2. Уровень. Майский маппер по умолчанию ставил «master» всему, что не опознал:
//      «BCom, Accounting» в Альберте лежит в песочнице магистратурой. Здесь уровень
//      берётся из общей карты program-level.mjs и только когда название называет
//      его однозначно; иначе строка несёт sourceLevel из кода фида (120 —
//      Undergraduate, 150 — Postgraduate), а добор решает по общему rowLevel.
//   3. Замер. Пишет membership/kaplan.json: сколько институтов заявляет фид, у
//      скольких есть программы, кто привязан, кто нет, кто заявлен без программ.
//
// Формат выгрузки сохранён майский (feePerYear/currency/level/programUrl) —
// его уже читают kompas-fees-apply, kompas-programs-backfill и сверки.
//
// Запуск:
//   node scraper/kompas-collect-kaplan.mjs --dry-run      # только отчёт, ничего не пишет
//   node scraper/kompas-collect-kaplan.mjs                # пишет sources/kompas/{extracts/kaplan,membership}
//   node scraper/kompas-collect-kaplan.mjs --only=essex   # один вуз (по имени института или слагу)

import fs from 'fs/promises';
import path from 'path';
import {
  EXTRACTS_DIR, writeExtract, writeMembership, extract, args, logger, stats,
} from './lib/kompas-collect.mjs';
import { buildCatalogIndex, matchToCatalog } from './lib/kompas-catalog-match.mjs';
import { inferLevel } from './lib/program-level.mjs';

const log = logger('kaplan');
const AGG = 'kaplan';
const FEED_PAGE = 'https://www.kaplanpathways.com/degree-finder/';
const UA = 'StudyRoom-Scraper/0.3 (+https://studyroom.kz)';

const dryRun = args.has('dry-run');
const only = args.get('only');

// Страна института (ISO-3 фида) в терминах каталога. Нужна резолверу против
// однофамильцев: «University of Victoria» в каталоге и канадский, и австралийский.
const COUNTRY = { GBR: 'United Kingdom', USA: 'United States', CAN: 'Canada', AUS: 'Australia', NZL: 'New Zealand', IRL: 'Ireland' };

// Код уровня фида -> разметка источника в терминах SOURCE_LEVEL_MAP (program-match.mjs).
// Замер 20.09.2026: 120 — 1 960 строк, все бакалаврские; 150 — 1 413, магистерские;
// null — 1 414 (американские BA/BS/BBA, у которых Kaplan код не проставил).
const SOURCE_LEVEL = { 120: 'Undergraduate', 150: 'Postgraduate' };

// Ручные решения. Каждая строка — с причиной; автоматике эти случаи не по силам,
// а молча ошибиться здесь дороже, чем оставить непривязанным.
const MANUAL = {
  // Хвост после запятой — «Bristol» — резолвер принимает за имя вуза и находит
  // University of Bristol. Это другой вуз; майский коллектор так и ошибся.
  'University of the West of England, Bristol': { slug: 'uwe-bristol', reason: 'хвост «Bristol» ловит Бристольский университет; это UWE' },
  // В каталоге ДВЕ карточки «University of Victoria» (uvic и victoria) — резолвер
  // честно говорит ambiguous. Берём ту, у которой уже есть kaplan-программы;
  // судьбу дубля решает владелец (15 карточек-родственников на слияние).
  'University of Victoria': { slug: 'uvic', reason: 'две карточки одного вуза, uvic — основная' },
  // Лондонская площадка Nottingham Trent. Отдельной карточки нет, программы —
  // NTU. Кампус остаётся в поле campus у каждой строки.
  'NTU London': { slug: 'nottingham-trent', reason: 'лондонский кампус Nottingham Trent University' },
};

// ---- фид ----
async function fetchFeed() {
  stats.requests++;
  const r = await fetch(FEED_PAGE, { headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' } });
  if (!r.ok) { stats.failed++; throw new Error(`GET ${FEED_PAGE} -> HTTP ${r.status}`); }
  const html = await r.text();
  stats.bytes += html.length;
  const m = html.match(/degree_finder_object\s*=\s*(\{[\s\S]+?\});/);
  if (!m) throw new Error('degree_finder_object не найден на странице degree-finder');
  const obj = JSON.parse(m[1].split('\\/').join('/'));
  const data = obj.degrees?.data;
  if (!data) throw new Error('degree_finder_object.degrees.data отсутствует');
  return { institutions: data.institutions ?? [], degrees: data.degrees ?? [] };
}

// «Arizona State University, Tempe Campus» -> { head: 'Arizona State University', campus: 'Tempe Campus' }
function splitCampus(instName) {
  const m = String(instName || '').match(/^(.*?),\s*(.+)$/);
  return m ? { head: m[1].trim(), campus: m[2].trim() } : { head: String(instName || '').trim(), campus: null };
}

// Привязка института к карточке. Порядок: ручное решение -> полное имя -> имя без
// кампуса. Любой результат, найденный хвостом после запятой, отвергается: у Kaplan
// после запятой всегда кампус, а не вуз.
function resolveInstitution(inst, catalog) {
  const name = inst.institution_name;
  const manual = MANUAL[name];
  if (manual) return { slug: manual.slug, method: 'manual', reason: manual.reason, tried: [] };
  const country = COUNTRY[inst.country_code] || null;
  const tried = [];
  for (const cand of [name, splitCampus(name).head]) {
    const r = matchToCatalog(cand, catalog, { country });
    tried.push(...r.tried);
    if (!r.catalogSlug) continue;
    if (r.matchMethod.startsWith('after-comma')) { tried.push(`rejected-after-comma:${r.catalogSlug}`); continue; }
    return { slug: r.catalogSlug, method: r.matchMethod, tried };
  }
  return { slug: null, method: 'no-match', tried };
}

function parseIntakes(s) {
  if (!s) return [];
  return [...new Set(String(s).split(/[,;]/).map((x) => x.trim()).filter(Boolean))];
}

function toProgram(d, campus) {
  const title = String(d.program_name || '').trim();
  const fee = Number.parseFloat(d.current_fees_per_year);
  const url = d.program_url && /^https?:\/\//.test(d.program_url) ? d.program_url : null;
  const p = {
    title,
    // Уровень пишем только когда название называет его однозначно. «MSci», «MEng»,
    // «Juris Doctor», «PharmD» остаются без level — их решает добор по sourceLevel.
    level: inferLevel(title),
    ...(SOURCE_LEVEL[d.program_level] ? { sourceLevel: SOURCE_LEVEL[d.program_level] } : {}),
    duration: d.degree_duration || null,
    intake: parseIntakes(d.degree_intake_dates),
    programUrl: url,
    ...(campus ? { campus } : {}),
    ...(d.direct_entry_point === 1 ? { directEntry: true } : {}),
  };
  if (Number.isFinite(fee) && fee > 0) {
    p.feePerYear = fee;
    if (d.currency_code) p.currency = d.currency_code;
  }
  return p;
}

async function main() {
  log('качаю фид degree-finder…');
  const feed = await fetchFeed();
  log(`фид: институтов ${feed.institutions.length}, программ ${feed.degrees.length}`);
  if (!feed.degrees.length) throw new Error('фид вернул 0 программ — не пишем ничего, чтобы не затереть прошлое');

  const catalog = await buildCatalogIndex();

  const degreesByInst = new Map();
  for (const d of feed.degrees) {
    const id = d.university_block?.institution_id;
    if (id == null) continue;
    if (!degreesByInst.has(id)) degreesByInst.set(id, []);
    degreesByInst.get(id).push(d);
  }

  const matched = [];
  const unmatched = [];
  const declaredWithoutPrograms = [];
  const bySlug = new Map();
  let programsTotal = 0;
  let withPrice = 0;
  let dupDropped = 0;

  for (const inst of feed.institutions) {
    const degrees = degreesByInst.get(inst.id) || [];
    if (!degrees.length) {
      // Партнёр заявлен, программ в фиде нет (подготовительные колледжи и вузы,
      // чьи степени Kaplan в finder не выкладывает). Карточек не заводим.
      declaredWithoutPrograms.push({ name: inst.institution_name, type: inst.institution_type_code, country: inst.country_code });
      continue;
    }
    const { head, campus } = splitCampus(inst.institution_name);
    const r = resolveInstitution(inst, catalog);
    if (only && !inst.institution_name.toLowerCase().includes(only.toLowerCase()) && r.slug !== only) continue;
    const programs = degrees.map((d) => toProgram(d, campus));
    programsTotal += programs.length;

    if (!r.slug) {
      unmatched.push({ from: inst.institution_name, country: inst.country_code, programs: programs.length, tried: r.tried });
      continue;
    }
    matched.push({ from: inst.institution_name, to: r.slug, method: r.method, ...(r.reason ? { reason: r.reason } : {}), programs: programs.length });

    // Несколько кампусов одного вуза (ASU — 7, UConn — 5, Pace — 2) — ОДНА карточка,
    // программы объединяются; кампус остаётся в строке.
    if (!bySlug.has(r.slug)) bySlug.set(r.slug, { slug: r.slug, head, names: [], countryCode: inst.country_code, methods: [], programs: [] });
    const b = bySlug.get(r.slug);
    b.names.push(inst.institution_name);
    b.methods.push(r.method);
    b.programs.push(...programs);
  }

  let written = 0;
  const mergedSlugs = [];
  for (const b of bySlug.values()) {
    // Дедуп: фид повторяет одну программу на несколько интейков (13 пар на 20.09).
    // Ключ — название + ссылка + кампус; интейки объединяем.
    const byKey = new Map();
    for (const p of b.programs) {
      const key = `${p.title.toLowerCase()}|${p.programUrl || ''}|${p.campus || ''}`;
      const prev = byKey.get(key);
      if (!prev) { byKey.set(key, p); continue; }
      dupDropped++;
      prev.intake = [...new Set([...prev.intake, ...p.intake])];
      if (prev.feePerYear == null && p.feePerYear != null) { prev.feePerYear = p.feePerYear; prev.currency = p.currency; }
    }
    const programs = [...byKey.values()];
    withPrice += programs.filter((p) => p.feePerYear != null).length;
    if (b.names.length > 1) mergedSlugs.push({ slug: b.slug, from: b.names, programs: programs.length });

    const currencies = [...new Set(programs.map((p) => p.currency).filter(Boolean))];
    const payload = extract({
      slug: b.slug,
      name: b.head,
      source: AGG,
      sourceUrl: FEED_PAGE,
      currency: currencies.length === 1 ? currencies[0] : null,
      programs,
      extra: {
        aggregator: 'Kaplan Pathways',
        access: 'public',
        countryCode: b.countryCode,
        sourceNames: b.names,
        matchMethod: [...new Set(b.methods)].join(' + '),
        feeNote: 'current_fees_per_year — цена за год из degree-finder Kaplan; аудитория — международные студенты (finder для них)',
      },
    });
    const res = await writeExtract(AGG, b.slug, payload, { dryRun });
    if (res.written) written++;
  }

  // Выгрузки вузов, которых в фиде больше нет, — не наши: их снимает только человек.
  // Но перечислим, чтобы было видно.
  const stale = [];
  try {
    for (const f of await fs.readdir(path.join(EXTRACTS_DIR, AGG))) {
      const slug = f.replace(/\.json$/, '');
      if (f.endsWith('.json') && !bySlug.has(slug)) stale.push(slug);
    }
  } catch { /* папки ещё нет */ }

  const universities = feed.institutions.filter((i) => i.institution_type_code === 'university').length;
  const membership = {
    _meta: {
      aggregator: AGG,
      label: 'Kaplan Pathways',
      source: FEED_PAGE,
      collectedAt: new Date().toISOString(),
      rule: 'all',
      access: 'public',
      notes: [
        'Вся база Kaplan лежит в странице degree-finder одним JS-литералом; браузер не нужен.',
        'Цена — current_fees_per_year, за год, в валюте строки (GBP/USD/CAD).',
        'Уровень: level только по однозначному названию (program-level.mjs); иначе sourceLevel по коду фида 120/150.',
        'Привязка через общий резолвер со сверкой страны; результат по хвосту после запятой отвергается (там кампус).',
        'Заявленные без программ — подготовительные колледжи и вузы без степеней в finder; карточек не заводим.',
      ],
      counts: {
        institutions: feed.institutions.length, universities, colleges: feed.institutions.length - universities,
        withPrograms: degreesByInst.size, declaredWithoutPrograms: declaredWithoutPrograms.length,
        sourcePrograms: feed.degrees.length, matched: matched.length, unmatched: unmatched.length,
        catalogCards: bySlug.size, programs: programsTotal - dupDropped, withPrice, duplicatesDropped: dupDropped,
        staleExtracts: stale.length,
      },
    },
    mergedSlugs,
    matched,
    unmatched,
    declaredWithoutPrograms,
    staleExtracts: stale,
  };
  await writeMembership(AGG, membership, { dryRun });

  log(`институтов с программами ${degreesByInst.size}: привязано ${matched.length}, не привязано ${unmatched.length}; заявлено без программ ${declaredWithoutPrograms.length}`);
  log(`карточек каталога ${bySlug.size} (объединено кампусов: ${mergedSlugs.length}), программ ${programsTotal - dupDropped}, с ценой ${withPrice}, дублей снято ${dupDropped}`);
  log(`файлов записано ${written}${dryRun ? ' (сухой прогон)' : ''}; устаревших выгрузок в папке ${stale.length}${stale.length ? ': ' + stale.join(', ') : ''}`);
  log('ПРИВЯЗКИ (проверять глазами):');
  const cat = new Map(catalog.map((c) => [c.slug, c.name]));
  for (const m of matched.sort((a, b) => a.from.localeCompare(b.from))) {
    log(`   ${m.from.padEnd(52)} -> ${m.to.padEnd(18)} «${(cat.get(m.to) || '?').slice(0, 36)}» [${m.method}]`);
  }
  if (unmatched.length) {
    log('НЕ ПРИВЯЗАНЫ (разбирать глазами):');
    for (const u of unmatched) log(`   ${u.from} [${u.country}] программ ${u.programs}`);
  }
  if (!matched.length) throw new Error('ни один институт не привязан к каталогу — что-то сломалось в фиде или резолвере');
}

main().catch((e) => { log('ОШИБКА: ' + e.message); process.exit(1); });
