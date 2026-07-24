#!/usr/bin/env node
// kompas-session45.mjs — КОМПАС, сессия 4.5: решения владельца от 2026-07-23/24.
//
// Делает три вещи и ничего больше:
//   2) UEG — слить две карточки в одну (решение владельца «смешай, пусть взаимодополняют»);
//   3+4) завести карточки: 10 брендов IAPro с программами + 6 учреждений Contract Hub;
//   5) снять устаревшие метки partnerSource у 20 stale-mark и 10 not-a-uni.
//
// Живой каталог НЕ трогается (правило 5) — всё пишется в sources/kompas/catalog-work.
// Сети нет: программы IAPro берутся из дампа extracts/iapro/_all-programmes.json,
// снятого прогоном коллектора. Второй заход в портал не нужен.
//
// Запуск: node kompas-session45.mjs [--apply]   (без --apply только считает и показывает)

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { KOMPAS_DIR, args, logger } from './lib/kompas-collect.mjs';

const log = logger('s4.5');
const APPLY = args.has('apply');
const WORK = path.join(KOMPAS_DIR, 'catalog-work');
const MAP_FILE = path.join(KOMPAS_DIR, 'partner-source-map.json');
const DUMP = path.join(KOMPAS_DIR, 'extracts', 'iapro', '_all-programmes.json');
const TODAY = new Date().toISOString().slice(0, 10);
const FINDER_URL = 'https://iapro.my.site.com/agentportals/s/create-application';

const readJson = async (f) => JSON.parse(await fs.readFile(f, 'utf8'));
const writeJson = async (f, o) => { if (APPLY) await fs.writeFile(f, JSON.stringify(o, null, 2) + '\n', 'utf8'); };

const slugify = (s) => (s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  // Обрезка ПЕРЕД зачисткой дефисов: иначе slice может оставить хвостовой дефис,
  // и слаг перестаёт проходить схему. Поймано валидацией рабочей копии на
  // «Catholic University of America» — два слага из 191 обрывались на дефисе.
  .replace(/[^a-z0-9]+/g, '-').slice(0, 90).replace(/^-+|-+$/g, '');
// Ключ дедупликации программ. Урок 7 сессии 4: сравнение «по схожести слов» женит
// специализацию с базовой программой, поэтому здесь только ТОЧНОЕ совпадение
// нормализованного названия вместе с уровнем.
const normTitle = (s) => (s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
const dedupKey = (title, level) => `${normTitle(title)}|${level || ''}`;

// Уровень каталога знает только этот список (site/src/schema/university.ts).
// «Diploma», «Certificate», «Continuing Education», «Apprenticeships» в нём места
// не имеют — сажаем в short-course, а исходную подпись портала сохраняем в выгрузке
// extracts/iapro/<slug>.json (поле sourceLevel), чтобы её можно было поднять.
const LEVEL_MAP = {
  'Undergraduate': 'bachelor',
  'Undergraduate + Foundation': 'foundation',
  'Postgraduate': 'master',
  'Graduate Degree': 'master',
  'Doctorate': 'phd',
  'Foundation': 'foundation',
  'Preparatory Programme': 'foundation',
  'Diploma': 'short-course',
  'Certificate': 'short-course',
  'Certificate of Higher Education': 'short-course',
  'Continuing Education': 'short-course',
  'Apprenticeships': 'short-course',
};
// Длительности источник не отдаёт. Берём ту же таблицу по уровню, что уже работает
// в merge-programs.mjs (defaultDurationYears) — это соглашение репозитория, а не
// новая выдумка. Каждая такая программа помечена confidence 0.4 и source 'iapro'.
const DURATION = {
  bachelor: 3, master: 1, phd: 3, foundation: 1,
  'english-language': 1, 'sixth-form': 2, 'high-school': 2, 'short-course': 0.5,
};
const CURRENCY_BY_COUNTRY = {
  'United States': 'USD', 'United Kingdom': 'GBP', Canada: 'CAD', Germany: 'EUR',
  'Saint Kitts and Nevis': 'USD',
};

// ---------------------------------------------------------------- группа А ----
// 11 брендов IAPro с программами, у которых карточки в каталоге нет.
// city/country: где портал отдаёт location — берём оттуда; где location пуст
// (пять брендов), проставляем известное расположение вуза и заводим кейс в панель,
// чтобы поле не выглядело подтверждённым источником.
const GROUP_A = [
  { brand: 'CUA', slug: 'catholic-university-of-america', name: 'The Catholic University of America', country: 'United States', city: 'Washington, D.C.', cityFrom: 'known' },
  { brand: 'HPU', slug: 'hartpury', name: 'Hartpury University', country: 'United Kingdom', city: 'Gloucester', cityFrom: 'source' },
  { brand: 'GBC', slug: 'george-brown', name: 'George Brown Polytechnic', country: 'Canada', city: 'Toronto', cityFrom: 'source' },
  { brand: 'BenU', slug: 'bentley-university', name: 'Bentley University', country: 'United States', city: 'Waltham, MA', cityFrom: 'known' },
  { brand: 'FMU', slug: 'florida-memorial-university', name: 'Florida Memorial University', country: 'United States', city: 'Miami Gardens, FL', cityFrom: 'known' },
  { brand: 'MCNY', slug: 'metropolitan-college-of-new-york', name: 'Metropolitan College of New York', country: 'United States', city: 'New York', cityFrom: 'source' },
  { brand: 'PU', slug: 'pepperdine-university', name: 'Pepperdine University', country: 'United States', city: 'Malibu, CA', cityFrom: 'known' },
  { brand: 'AUA', slug: 'avila-arizona', name: 'Avila University Arizona', country: 'United States', city: 'Goodyear, AZ', cityFrom: 'source' },
  { brand: 'MUA', slug: 'medical-university-of-the-americas', name: 'Medical University of the Americas', country: 'Saint Kitts and Nevis', city: 'Charlestown', cityFrom: 'source+known-country' },
  { brand: 'PSDLS', slug: 'penn-state-dickinson-law', name: 'Penn State Dickinson Law', country: 'United States', city: 'Carlisle, PA', cityFrom: 'known' },
];
// St. Matthew's University карточку НЕ заводим: она уже есть под слагом
// st-matthews-university-school-of-medicine (8 программ — ровно столько же, сколько
// отдаёт портал). Резолвер её не нашёл из-за приписки «School of Medicine».
// UEG сюда же: после слияния его программы должны лечь на ue-germany, иначе замер
// сессии 5 скажет «сверить не с чем» по 92 программам, которые у нас на руках.
const GROUP_A_LINK = [
  { brand: 'SMU', slug: 'st-matthews-university-school-of-medicine' },
  { brand: 'UEG', slug: 'ue-germany' },
];

// ---------------------------------------------------------------- группа Б ----
// 6 учреждений Contract Hub, у которых у источника НЕТ ни одной программы.
// Карточка заводится честно пустой: ни одной выдуманной программы и ни одной цены.
const GROUP_B = [
  { slug: 'london-school-of-business-and-finance', name: 'London School of Business and Finance', country: 'United Kingdom', city: 'London' },
  { slug: 'elmira-college', name: 'Elmira College', country: 'United States', city: 'Elmira, NY' },
  { slug: 'niagara-college-toronto', name: 'Niagara College - Toronto', country: 'Canada', city: 'Toronto' },
  { slug: 'university-of-gloucestershire', name: 'University of Gloucestershire', country: 'United Kingdom', city: 'Cheltenham' },
  { slug: 'toronto-school-of-management', name: 'Toronto School of Management', country: 'Canada', city: 'Toronto' },
  { slug: 'fleming-college-toronto', name: 'Fleming College Toronto', country: 'Canada', city: 'Toronto' },
];

const UEG_KEEP = 'ue-germany';
const UEG_DROP = 'ue-university-of-europe-for-applied-sciences';

const cases = [];
const addCase = (slug, name, issue, severity, detail) => cases.push({
  id: `${slug}||${issue}||session4.5`,
  slug, name, issue, severity, detail,
  catalog: null, official: null, program: null, sourceUrl: null,
  checkedAt: new Date().toISOString(), decision: null, decidedAt: null, applied: false,
});

const hashOf = (o) => crypto.createHash('sha1').update(JSON.stringify(o)).digest('hex').slice(0, 16);

// Карта разметки partner-source-map.json — единственный экземпляр на прогон.
// Читаем один раз и пишем один раз: три шага правят её по очереди, и если каждый
// будет читать файл заново, последний затрёт предыдущих.
let MAP = null;
const setMark = (slug, type, via) => { MAP[slug] = { type, via }; };

function buildPrograms(cardSlug, list) {
  const seen = new Set();
  const out = [];
  const skipped = [];
  for (const p of list) {
    const level = LEVEL_MAP[p.levelName];
    if (!level) { skipped.push(p); continue; } // уровень не опознан — программу не выдумываем
    let slug = slugify(`${cardSlug}-${p.name}`);
    if (!slug) slug = `${cardSlug}-program-${out.length}`;
    let n = 1; let final = slug;
    while (seen.has(final)) final = `${slug}-${++n}`;
    seen.add(final);
    out.push({
      slug: final,
      title: p.name,
      durationYears: DURATION[level] ?? 1,
      level,
      language: 'en',
      programType: level === 'foundation' ? 'pathway' : 'degree',
      source: 'iapro',
      confidence: 0.4, // длительность выведена из уровня, а не снята с источника
      checkedAt: new Date().toISOString(),
    });
  }
  return { programs: out, skipped };
}

function campusesFrom(list) {
  const titles = new Set();
  for (const p of list) {
    for (const part of String(p.location || '').split('|')) {
      const t = part.trim();
      if (t) titles.add(t);
    }
  }
  return [...titles].map((t) => ({ title: t, source: 'iapro', confidence: 0.6, checkedAt: new Date().toISOString() }));
}

// ------------------------------------------------------------------ слияние ----
async function mergeUeg() {
  const keep = await readJson(path.join(WORK, `${UEG_KEEP}.json`));
  const drop = await readJson(path.join(WORK, `${UEG_DROP}.json`));

  const byKey = new Map();
  for (const p of keep.programs ?? []) byKey.set(dedupKey(p.title, p.level), p);
  const usedSlugs = new Set((keep.programs ?? []).map((p) => p.slug));

  let added = 0;
  const slugRemap = new Map();
  for (const p of drop.programs ?? []) {
    const key = dedupKey(p.title, p.level);
    if (byKey.has(key)) continue;
    let slug = p.slug;
    if (usedSlugs.has(slug)) { let n = 1; while (usedSlugs.has(`${slug}-${++n}`)); slug = `${slug}-${n}`; }
    if (slug !== p.slug) slugRemap.set(p.slug, slug);
    usedSlugs.add(slug);
    const np = { ...p, slug };
    byKey.set(key, np);
    keep.programs.push(np);
    added++;
  }

  // Цены и дедлайны второй карточки переносим только на те программы, которые
  // реально доехали. Сирота в byProgram роняет сборку (superRefine схемы).
  let feesMoved = 0; let dlMoved = 0;
  const liveSlugs = new Set(keep.programs.map((p) => p.slug));
  for (const [k, v] of Object.entries(drop.tuition?.byProgram ?? {})) {
    const target = slugRemap.get(k) ?? k;
    if (!liveSlugs.has(target) || keep.tuition.byProgram[target] !== undefined) continue;
    keep.tuition.byProgram[target] = v; feesMoved++;
  }
  for (const [k, v] of Object.entries(drop.deadlines ?? {})) {
    const target = slugRemap.get(k) ?? k;
    if (!liveSlugs.has(target) || keep.deadlines[target] !== undefined) continue;
    keep.deadlines[target] = v; dlMoved++;
  }

  // Кампусы второй карточки — это города UE, которых у первой может не быть.
  let campusesAdded = 0;
  if (Array.isArray(drop.campuses) && drop.campuses.length) {
    if (!Array.isArray(keep.campuses)) keep.campuses = [];
    const have = new Set(keep.campuses.map((c) => normTitle(c.title || c.name || '')));
    for (const c of drop.campuses) {
      const t = normTitle(c.title || c.name || '');
      if (!t || have.has(t)) continue;
      have.add(t); keep.campuses.push(c); campusesAdded++;
    }
  }
  if (drop.officialUrl && !keep.officialUrl) keep.officialUrl = drop.officialUrl;

  keep.lastChecked = TODAY;
  keep.mergedFrom = [...new Set([...(keep.mergedFrom ?? []), UEG_DROP])];
  await writeJson(path.join(WORK, `${UEG_KEEP}.json`), keep);

  // Вторую карточку НЕ удаляем: помечаем слитой и оставляем содержимое на месте,
  // чтобы сессия 5 сняла её осознанно, а не по факту пропажи файла.
  drop.mergedInto = UEG_KEEP;
  drop.mergedAt = TODAY;
  await writeJson(path.join(WORK, `${UEG_DROP}.json`), drop);
  await writeJson(path.join(KOMPAS_DIR, 'merges-session4.5.json'), {
    generatedAt: new Date().toISOString(),
    note: 'Слияния сессии 4.5. Файл слитой карточки оставлен на месте с полем mergedInto — удаление делает сессия 5 при подмене живого каталога.',
    merges: [{ keep: UEG_KEEP, drop: UEG_DROP, programsAdded: added, feesMoved, deadlinesMoved: dlMoved, campusesAdded, reason: 'решение владельца 2026-07-24: одна школа, две карточки' }],
  });

  // Реестр IAPro: UEG был «ambiguous» ровно из-за этого дубля. Слияние сняло причину —
  // записываем разрешение, иначе kompas-mark-iapro и дальше будет считать его неразмеченным.
  const memFile = path.join(KOMPAS_DIR, 'membership', 'iapro.json');
  const mem = await readJson(memFile);
  const ueg = mem.marketingHub.partners.find((p) => p.source === 'UEG');
  if (ueg) {
    ueg.catalog = { slug: UEG_KEEP, name: keep.name, how: 'session4.5/merge', wasAmbiguous: ueg.catalog?.candidates ?? [] };
    await writeJson(memFile, mem);
  }

  addCase(UEG_DROP, drop.name, 'kompas_card_merged', 'warning',
    `Карточка слита в «${UEG_KEEP}» (решение владельца 2026-07-24). Программы перенесены объединением: добавлено ${added}, цен ${feesMoved}, дедлайнов ${dlMoved}, кампусов ${campusesAdded}. Файл оставлен с пометкой mergedInto — снять при подмене живого каталога в сессии 5.`);

  log(`UEG: ${UEG_DROP} → ${UEG_KEEP}: программ +${added} (стало ${keep.programs.length}), цен +${feesMoved}, дедлайнов +${dlMoved}, кампусов +${campusesAdded}`);
  return { added, feesMoved, dlMoved, campusesAdded, total: keep.programs.length };
}

// -------------------------------------------------------------------- карточки ----
async function makeCards(dump) {
  const byBrand = new Map();
  for (const p of dump.programmes) {
    if (!byBrand.has(p.brand)) byBrand.set(p.brand, []);
    byBrand.get(p.brand).push(p);
  }

  const madeA = []; const madeB = []; const problems = [];

  for (const t of GROUP_A) {
    const list = byBrand.get(t.brand) ?? [];
    if (!list.length) { problems.push(`${t.slug}: у бренда ${t.brand} в дампе нет программ — карточку не завожу`); continue; }
    const { programs, skipped } = buildPrograms(t.slug, list);
    if (!programs.length) { problems.push(`${t.slug}: ни одна программа не легла в уровни схемы — карточку не завожу`); continue; }

    const campuses = campusesFrom(list);
    const card = {
      slug: t.slug,
      name: t.name,
      country: t.country,
      city: t.city,
      programs,
      tuition: { currency: CURRENCY_BY_COUNTRY[t.country] ?? 'USD', byProgram: {} },
      deadlines: {},
      requirements: { exams: [] },
      scholarships: [],
      ...(campuses.length ? { campuses } : {}),
      lastChecked: TODAY,
      sourceUrl: FINDER_URL,
      sourceHash: hashOf(programs.map((p) => p.title)),
      confidence: 'aggregator',
      language: 'en',
      partnerSource: { type: 'aggregator', via: ['iapro'] },
    };
    await writeJson(path.join(WORK, `${t.slug}.json`), card);

    // Выгрузка источника рядом с карточкой: без неё замер сессии 5 скажет
    // «сверить не с чем», хотя данные есть.
    await writeJson(path.join(KOMPAS_DIR, 'extracts', 'iapro', `${t.slug}.json`), {
      slug: t.slug, name: t.brand, source: 'iapro', sourceUrl: FINDER_URL,
      scrapedAt: new Date().toISOString(),
      aggregator: 'IAPro (GUS Gateway)', access: 'login', matchMethod: 'session4.5/manual-brand-map',
      feeNote: 'ProgrammeFinder цены не отдаёт — в выдаче только название, уровень и город',
      programs: list.map((p) => ({
        title: p.name, level: LEVEL_MAP[p.levelName] ?? null, sourceLevel: p.levelName ?? null,
        campus: p.location || null, programUrl: null,
      })),
    });

    setMark(t.slug, 'aggregator', ['iapro']);
    madeA.push({ slug: t.slug, brand: t.brand, programs: programs.length, skipped: skipped.length, cityFrom: t.cityFrom });

    addCase(t.slug, t.name, 'kompas_card_new_iapro', 'warning',
      `Карточка заведена в сессии 4.5 по решению владельца из источника IAPro ProgrammeFinder: ${programs.length} программ. ЦЕН НЕТ — портал их на этом экране не отдаёт. Длительность программ выведена из уровня по таблице репозитория, а не снята с источника (поэтому confidence 0.4). Валюта ${card.tuition.currency} проставлена по стране, цен под ней нет.`);
    if (t.cityFrom !== 'source') {
      addCase(t.slug, t.name, 'kompas_card_city_not_from_source', 'warning',
        `Город/страна («${t.city}, ${t.country}») проставлены НЕ источником: в выдаче IAPro поле location у этого бренда ${t.cityFrom === 'known' ? 'пустое' : 'без страны'}. Проверить перед выпуском на живой сайт.`);
    }
    if (skipped.length) {
      addCase(t.slug, t.name, 'kompas_card_level_unmapped', 'info',
        `${skipped.length} программ не попали в карточку: уровень «${[...new Set(skipped.map((p) => p.levelName))].join(', ')}» в схеме каталога отсутствует. Выдумывать уровень нельзя — программы лежат в выгрузке extracts/iapro/${t.slug}.json.`);
    }
  }

  for (const t of GROUP_B) {
    const card = {
      slug: t.slug,
      name: t.name,
      country: t.country,
      city: t.city,
      programs: [],
      tuition: { currency: CURRENCY_BY_COUNTRY[t.country] ?? 'USD', byProgram: {} },
      deadlines: {},
      requirements: { exams: [] },
      scholarships: [],
      lastChecked: TODAY,
      sourceUrl: 'https://iapro.my.site.com/agentportals/',
      sourceHash: hashOf(t.slug),
      confidence: 'partner',
      language: 'en',
      partnerSource: { type: 'aggregator', via: ['iapro'] },
      kompasStatus: 'programs-not-collected',
    };
    await writeJson(path.join(WORK, `${t.slug}.json`), card);
    setMark(t.slug, 'aggregator', ['iapro']);
    madeB.push({ slug: t.slug, programs: 0 });
    addCase(t.slug, t.name, 'kompas_card_empty_contract_hub', 'critical',
      'Карточка заведена по прямой просьбе владельца из Contract Hub IAPro: договор есть, программ у источника НЕТ ВОВСЕ. Ни одной программы и ни одной цены не придумано. Схема каталога требует минимум одну программу (programs.min(1)) — в живой каталог эта карточка в текущем виде не поедет, нужен сбор с офсайта вуза.');
  }

  for (const l of GROUP_A_LINK) {
    const list = byBrand.get(l.brand) ?? [];
    await writeJson(path.join(KOMPAS_DIR, 'extracts', 'iapro', `${l.slug}.json`), {
      slug: l.slug, name: l.brand, source: 'iapro', sourceUrl: FINDER_URL,
      scrapedAt: new Date().toISOString(),
      aggregator: 'IAPro (GUS Gateway)', access: 'login', matchMethod: 'session4.5/manual-brand-map',
      feeNote: 'ProgrammeFinder цены не отдаёт — в выдаче только название, уровень и город',
      programs: list.map((p) => ({
        title: p.name, level: LEVEL_MAP[p.levelName] ?? null, sourceLevel: p.levelName ?? null,
        campus: p.location || null, programUrl: null,
      })),
    });
    // Карточка уже есть — новую не плодим, но метку источника ставим:
    // без неё замер увидит выгрузку и не поймёт, чья она.
    try {
      const card = await readJson(path.join(WORK, `${l.slug}.json`));
      const via = new Set(card.partnerSource?.via ?? []);
      if (!via.has('iapro')) {
        via.add('iapro');
        card.partnerSource = { type: card.partnerSource?.type === 'direct' ? 'direct' : 'aggregator', via: [...via] };
        await writeJson(path.join(WORK, `${l.slug}.json`), card);
        setMark(l.slug, card.partnerSource.type, card.partnerSource.via);
      }
    } catch { log(`  нет карточки в рабочей копии: ${l.slug}`); }
    log(`${l.brand}: карточка уже есть (${l.slug}) — новую не завожу, привязал выгрузку (${list.length} программ)`);
  }

  // Реестр Contract Hub: у шести учреждений карточки теперь есть. Без этой записи
  // разбор пробелов (kompas-gaps) не найдёт их в списке источника и объявит метку
  // устаревшей — то есть ровно тем, чем она не является.
  const memFile = path.join(KOMPAS_DIR, 'membership', 'iapro.json');
  const mem = await readJson(memFile);
  const bySlug = new Map(GROUP_B.map((t) => [t.name, t.slug]));
  bySlug.set('Avila University Arizona', 'avila-arizona');
  let linked = 0;
  for (const inst of mem.contractHubOnly.institutions) {
    const slug = bySlug.get(inst.name);
    if (!slug || inst.catalog?.slug) continue;
    inst.catalog = { slug, name: inst.name, how: 'session4.5/new-card' };
    linked++;
  }
  if (linked) { await writeJson(memFile, mem); log(`реестр Contract Hub: привязано карточек ${linked}`); }

  for (const p of problems) log('  ПРОБЛЕМА: ' + p);
  return { madeA, madeB, problems };
}

// ---------------------------------------------------------------------- метки ----
async function stripStaleMarks() {
  // Цели берутся из ЗАМОРОЖЕННОГО списка session45-marks.json, а не из свежего
  // gap-report.json. Почему: gap-report пересчитывается после каждого прогона, и на
  // втором заходе в нём оказались карточки, заведённые ЭТОЙ ЖЕ сессией, — прогон
  // послушно снял с них метку «iapro», только что поставленную. Поймано глазами по
  // строке «меток снято: 7» вместо 30.
  const frozen = await readJson(path.join(KOMPAS_DIR, 'session45-marks.json'));
  const targets = frozen.targets;

  const done = [];
  for (const u of targets) {
    const file = path.join(WORK, `${u.slug}.json`);
    let card;
    try { card = await readJson(file); } catch { log(`  нет карточки в рабочей копии: ${u.slug}`); continue; }

    const before = [...(card.partnerSource?.via ?? [])];
    // Снимаем ровно те источники, из-за которых вуз попал в разбор: в живом
    // списке этих агрегаторов его нет. Остальные метки не трогаем.
    const after = before.filter((v) => !u.ready.includes(v));
    const type = after.length ? (card.partnerSource?.type === 'direct' ? 'direct' : 'aggregator') : 'none';
    card.partnerSource = { type, via: after };
    await writeJson(file, card);
    setMark(u.slug, type, after);

    done.push({ slug: u.slug, name: u.name, kind: u.kind, removed: before.filter((v) => !after.includes(v)), left: after, type });
    addCase(u.slug, u.name, `kompas_mark_removed_${u.kind.replace(/-/g, '_')}`, 'info',
      `Метка партнёрства снята по решению владельца 2026-07-24: ${before.length ? `убрано «${before.filter((v) => !after.includes(v)).join(', ')}»` : 'меток и не было'}, осталось «${after.join(', ') || '—'}», тип «${type}». Карточка сохранена: владелец просил не-вузы оставить.`);
  }
  log(`меток снято: ${done.length} (stale-mark ${done.filter((d) => d.kind === 'stale-mark').length}, not-a-uni ${done.filter((d) => d.kind === 'not-a-uni').length})`);
  return done;
}

// ----------------------------------------------------------------------- main ----
async function main() {
  if (!APPLY) log('СУХОЙ ПРОГОН: ничего не пишу, только считаю. Для записи добавь --apply');
  const dump = await readJson(DUMP);
  log(`дамп IAPro: ${dump.programmes.length} программ, ${dump.brands.length} брендов`);
  MAP = await readJson(MAP_FILE);

  const ueg = await mergeUeg();
  const cards = await makeCards(dump);
  const marks = await stripStaleMarks();
  await writeJson(MAP_FILE, MAP);

  await writeJson(path.join(KOMPAS_DIR, 'cards-review.json'), {
    generatedAt: new Date().toISOString(),
    scope: 'kompas-session4.5',
    summary: { total: cases.length },
    items: cases,
  });

  const out = {
    applied: APPLY,
    ueg,
    groupA: cards.madeA,
    groupB: cards.madeB,
    problems: cards.problems,
    marksRemoved: marks.length,
    cases: cases.length,
  };
  console.log(JSON.stringify(out, null, 2));
  console.log('SESSION45 DONE');
}

main().catch((e) => { console.error(e); process.exit(1); });
