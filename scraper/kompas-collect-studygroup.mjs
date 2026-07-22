#!/usr/bin/env node
// kompas-collect-studygroup.mjs — КОМПАС, сессия 3. Study Group.
//
// План относил Study Group к ЗАКРЫТЫМ агрегаторам: «логин; есть снимок 59».
// Замер сессии 3 это опроверг. Агентский портал (agent.studygroup.com, Salesforce)
// действительно под логином, но сам поиск курсов ходит в отдельный контент-сервис
//   https://kentico-content-services.studygroup.com/course-search/search/?language=en
// и тот отдаёт весь каталог БЕЗ авторизации: один GET, ~1 МБ, курсы с ценами.
// Эндпоинт найден не угадыванием, а в записи сети прошлой сессии
// (sources/studygroup-extracts/_v5-network.json, 244 запроса) — там он вызывался 183 раза.
//
// Почему пересобираем, а не берём снимок мая: снимок брали со страницы портала после
// логина, и в него попала разметка интерфейса — «Agent Portal» как название курса,
// «University» как название вуза, заголовок новости «Exciting new opportunity: Study Group
// partners with…» как отдельный вуз (см. _all-courses.json и находку (5) сессии 1).
// Здесь источник структурный, интерфейсу взяться неоткуда.
//
// Запуск:
//   node scraper/kompas-collect-studygroup.mjs --dry-run   # ничего не пишет, только отчёт
//   node scraper/kompas-collect-studygroup.mjs             # пишет sources/kompas/{extracts,membership}

import {
  fetchJson, writeExtract, writeMembership, extract, parseMoney, mapLevel,
  args, logger, stats,
} from './lib/kompas-collect.mjs';
import { buildCatalogIndex, matchToCatalog } from './lib/kompas-catalog-match.mjs';

const log = logger('sg');
const AGG = 'studygroup';
const SEARCH_URL = 'https://kentico-content-services.studygroup.com/course-search/search/?language=en';

// countryCode ответа -> страна в терминах каталога. Нужна резолверу против однофамильцев
// (урок Navitas: queensgssp.com = Queens College CUNY в Нью-Йорке, а не Queen's Belfast).
const COUNTRY = {
  GB: 'United Kingdom', US: 'United States', IE: 'Ireland', CN: 'China',
  SG: 'Singapore', KR: 'South Korea', AU: 'Australia', CA: 'Canada', NZ: 'New Zealand',
};

// Ручные решения. Каждая строка — с причиной; автоматике эти случаи не по силам,
// а молча ошибиться здесь дороже, чем оставить непривязанным.
const MANUAL = {
  // Центры сети Bellerbys названы городом и партнёром, а не вузом. Это подготовительные
  // центры Study Group, отдельных карточек вуза в каталоге у них нет и быть не должно.
  'Beijing - NOVO': { slug: null, reason: 'центр Bellerbys в Пекине (партнёр NOVO), не вуз' },
  'Harbin - NOVO': { slug: null, reason: 'центр Bellerbys в Харбине, не вуз' },
  'Nanjing - NOVO': { slug: null, reason: 'центр Bellerbys в Нанкине, не вуз' },
  'Wuhan - NOVO': { slug: null, reason: 'центр Bellerbys в Ухане, не вуз' },
  'Changsha - TSH': { slug: null, reason: 'центр Bellerbys в Чанша, не вуз' },
  'Shanghai - ECUST': { slug: null, reason: 'центр Bellerbys в Шанхае при ECUST, не вуз' },
  'Zhuhai - BNBU': { slug: null, reason: 'центр Bellerbys в Чжухае при BNBU, не вуз' },
  'Xian - Eurasia': { slug: null, reason: 'центр Bellerbys в Сиане при Xian Eurasia, не вуз' },
  'Seoul - GEC': { slug: null, reason: 'центр Bellerbys в Сеуле, не вуз' },
  'Singapore - VWA': { slug: null, reason: 'центр Bellerbys в Сингапуре, не вуз' },
  'Eastbourne - TWIN': { slug: null, reason: 'центр Bellerbys в Истборне, не вуз' },
  'London - TWIN': { slug: null, reason: 'центр Bellerbys в Лондоне, не вуз' },

  // Однофамильцы каталога: у вуза ДВЕ карточки — настоящая и заведённая из маршрутной
  // записи Study Group. Резолвер честно говорит «ambiguous». Берём богатую карточку;
  // судьбу дублей решает владелец в сессии 5, здесь ничего не удаляем (правило 4).
  'Texas A&M Corpus Christi University Direct Entry': {
    slug: 'tamucc',
    reason: 'дубль каталога: tamucc (121 программа) и texas-aandm-corpus-christi-university-direct-entry (2). Берём tamucc',
  },
  'Long Island University Brooklyn Direct Entry': {
    slug: 'liu-brooklyn',
    reason: 'дубль каталога: liu-brooklyn (89 программ) и long-island-university-brooklyn-direct-entry (2). Берём liu-brooklyn',
  },
  // Не однофамилец, а дефект резолвера: universityNameCandidates срезает хвост
  // « - Stout» как название кампуса, и от имени остаётся «University of Wisconsin».
  'University of Wisconsin - Stout': {
    slug: 'university-of-wisconsin-stout',
    reason: 'резолвер срезал « - Stout» как кампус; карточка есть, привязываем вручную',
  },
  // Проверено заходом на сайт 2026-07-22 (вопрос (6) сессии 1): dublinisc.com пишет
  // «University College Dublin ... from our pathway programme» — центр действительно UCD.
  Dublin: { slug: 'university-college-dublin', reason: 'dublinisc.com — подготовительный центр University College Dublin, проверено на сайте' },
};

/** «Direct Entry»/«International College» — маршрутные хвосты, а не часть имени вуза. */
function cleanUniName(raw) {
  return String(raw)
    .replace(/\s*[-–]\s*(London|Brooklyn|Post)\s*$/i, ' $1')
    .replace(/\s+Direct Entry\s*$/i, '')
    .replace(/\s+International College\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toProgram(it) {
  const money = parseMoney(it.tuitionFeeFrom);
  const level = mapLevel(it.degreeLevel, it.programmeType, it.courseTitle);
  const intake = (it.intakeDates || [])
    .map((d) => d.intakeName || [d.startMonth, d.startYear].filter(Boolean).join(' '))
    .filter(Boolean);
  return {
    title: String(it.courseTitle || '').replace(/\s+/g, ' ').trim(),
    level,
    // Уровень агрегатора сохраняем как есть: наш mapLevel может ошибиться, и тогда
    // в сессии 4 будет с чем сверяться, а не только с нашей догадкой.
    sourceLevel: it.degreeLevel || null,
    programmeType: it.programmeType || null,
    duration: it.duration || null,
    tuition: money ? money.amount : null,
    currency: money ? money.currency : null,
    // Цена в этом источнике — «от». Записываем признак, а не выдаём её за точную.
    feeBasis: money ? 'from' : null,
    feeRaw: it.tuitionFeeFrom || null,
    intake: [...new Set(intake)],
    subjects: (it.subjects || []).map((s) => s.subject).filter(Boolean),
    programUrl: it.siteUrl ? `https://${String(it.siteUrl).replace(/^https?:\/\//, '')}` : null,
    studyGlobalCourseId: it.studyGlobalCourseId || null,
  };
}

async function main() {
  const dryRun = args.has('dry-run');
  const only = args.get('slug');
  log(`старт${dryRun ? ' (сухой прогон — в дерево не пишем)' : ''}`);

  const data = await fetchJson(SEARCH_URL);
  const items = data.courseSearchItems || [];
  log(`эндпоинт отдал курсов: ${items.length}`);
  if (!items.length) throw new Error('поиск вернул пусто — не пишем ничего, чтобы не затереть прошлое');

  const catalog = await buildCatalogIndex();

  // группируем по вузу/центру
  const groups = new Map();
  for (const it of items) {
    const raw = String(it.university || '').trim() || '(без вуза)';
    if (!groups.has(raw)) groups.set(raw, { raw, countryCode: it.countryCode || null, siteUrl: it.siteUrl || null, items: [] });
    groups.get(raw).items.push(it);
  }
  log(`вузов/центров: ${groups.size}`);

  const matched = [];
  const unmatched = [];
  const skipped = [];
  const bySlug = new Map();
  let written = 0;
  let programsTotal = 0;
  let withPrice = 0;

  for (const g of groups.values()) {
    if (only && !g.raw.toLowerCase().includes(only.toLowerCase())) continue;

    const manual = MANUAL[g.raw];
    let catalogSlug = null;
    let method = null;
    if (manual) {
      catalogSlug = manual.slug;
      method = 'manual';
      if (!catalogSlug) skipped.push({ from: g.raw, reason: manual.reason, courses: g.items.length });
    } else {
      const country = COUNTRY[g.countryCode] || null;
      const res = matchToCatalog(cleanUniName(g.raw), catalog, { country });
      catalogSlug = res.catalogSlug;
      method = res.matchMethod;
      if (!catalogSlug) unmatched.push({ from: g.raw, country, tried: res.tried, courses: g.items.length });
    }

    const programs = g.items.map(toProgram);
    programsTotal += programs.length;
    withPrice += programs.filter((p) => p.tuition != null).length;

    if (!catalogSlug) continue;
    matched.push({ from: g.raw, to: catalogSlug, method, courses: programs.length });

    // Правило 3 плана: вуз, встречающийся у источника несколько раз, — ОДНА карточка,
    // программы объединяются. Здесь это не теория: «James Madison University» и
    // «James Madison University Direct Entry» — две группы одного вуза, и запись файла
    // на слаг без объединения молча затирала бы первую вторым проходом.
    // Та же пара у Hartford и Royal Holloway.
    if (!bySlug.has(catalogSlug)) {
      bySlug.set(catalogSlug, {
        slug: catalogSlug, names: [], siteUrls: new Set(), countryCode: g.countryCode,
        methods: [], programs: [],
      });
    }
    const bucket = bySlug.get(catalogSlug);
    bucket.names.push(g.raw);
    bucket.methods.push(method);
    if (g.siteUrl) bucket.siteUrls.add(`https://${String(g.siteUrl).replace(/^https?:\/\//, '')}`);
    bucket.programs.push(...programs);
  }

  const mergedSlugs = [];
  for (const b of bySlug.values()) {
    // Дедуп внутри объединения: один курс может прийти обеими группами.
    const seen = new Set();
    const programs = [];
    let dropped = 0;
    for (const p of b.programs) {
      const key = `${p.studyGlobalCourseId || ''}|${p.title.toLowerCase()}`;
      if (seen.has(key)) { dropped++; continue; }
      seen.add(key);
      programs.push(p);
    }
    if (b.names.length > 1) {
      mergedSlugs.push({ slug: b.slug, from: b.names, programs: programs.length, duplicatesDropped: dropped });
    }

    const payload = extract({
      slug: b.slug,
      name: b.names[0],
      source: 'studygroup',
      sourceUrl: [...b.siteUrls][0] || SEARCH_URL,
      programs,
      extra: {
        aggregator: 'Study Group',
        aggregatorEndpoint: SEARCH_URL,
        access: 'public',
        countryCode: b.countryCode,
        sourceNames: b.names,
        matchMethod: b.methods.join(' + '),
        ...(b.siteUrls.size > 1 ? { centreUrls: [...b.siteUrls] } : {}),
        feeNote: 'tuitionFeeFrom — цена «от» из поиска Study Group; аудитория цены источником не указана',
      },
    });
    const res = await writeExtract(AGG, b.slug, payload, { dryRun });
    if (res.written) written++;
  }

  const membership = {
    _meta: {
      aggregator: AGG,
      label: 'Study Group',
      source: SEARCH_URL,
      collectedAt: new Date().toISOString(),
      rule: 'all',
      access: 'public',
      notes: [
        'План числил Study Group закрытым (логин). Замер сессии 3: поиск курсов открыт без авторизации.',
        'Эндпоинт взят из записи сети прошлой сессии (_v5-network.json), а не подобран.',
        'Цены — «от» (tuitionFeeFrom). Аудитория цены источником не указана, feeAudience не выдумываем.',
        'Центры сети Bellerbys названы «Город - Партнёр» — это подготовительные центры, не вузы; в MANUAL с причиной.',
      ],
      counts: {
        groups: groups.size, matched: matched.length, unmatched: unmatched.length,
        skipped: skipped.length, catalogCards: bySlug.size, programs: programsTotal, withPrice,
      },
    },
    mergedSlugs,
    matched,
    unmatched,
    skippedNotUniversity: skipped,
  };
  await writeMembership(AGG, membership, { dryRun });

  log(`групп источника ${groups.size}: привязано ${matched.length}, не привязано ${unmatched.length}, не вузы ${skipped.length}`);
  log(`карточек каталога ${bySlug.size} (объединено групп: ${mergedSlugs.length})`);
  for (const m of mergedSlugs) log(`   объединено -> ${m.slug}: ${m.from.join(' + ')} = ${m.programs} программ, дублей снято ${m.duplicatesDropped}`);
  log(`программ ${programsTotal}, с ценой ${withPrice}`);
  log(`файлов записано ${written}${dryRun ? ' (сухой прогон)' : ''}`);
  log(`запросов ${stats.requests}, торможений ${stats.throttled}, неудач ${stats.failed}, байт ${stats.bytes}`);

  // Пары печатаем ВСЕГДА, не только неудачи: в сессии 2 брак ловился просмотром
  // совпавших, а не непривязанных («Griffith College - Brisbane» сел на ирландский вуз).
  log('ПРИВЯЗКИ (проверять глазами):');
  const cat = new Map(catalog.map((c) => [c.slug, c.name]));
  for (const m of matched.sort((a, b) => a.from.localeCompare(b.from))) {
    log(`   ${m.from.padEnd(50)} -> ${m.to.padEnd(38)} «${(cat.get(m.to) || '?').slice(0, 40)}» [${m.method}]`);
  }
  if (unmatched.length) {
    log('НЕ ПРИВЯЗАНЫ (разбирать глазами):');
    for (const u of unmatched) log(`   ${u.from} [${u.country || '?'}] курсов ${u.courses}`);
  }
}

main().catch((e) => { log('ОШИБКА: ' + e.message); process.exit(1); });
