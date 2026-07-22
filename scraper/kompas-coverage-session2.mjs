#!/usr/bin/env node
// kompas-coverage-session2.mjs — КОМПАС сессия 2: сводка покрытия.
//
// Отвечает на вопрос плана: «Проверить, для скольких размеченных партнёров данные реально
// нашлись». Сеть не трогает — считает по тому, что лежит в sources/kompas/{extracts,membership}
// и по разметке сессии 1 (partner-source-map.json).
//
// Пишет sources/kompas/coverage-session2.json и OWNER-REPORT-session2.md. Живой каталог не трогает.
// Usage: node scraper/kompas-coverage-session2.mjs [--dry-run]

import fs from 'fs/promises';
import path from 'path';
import { KOMPAS_DIR, EXTRACTS_DIR, MEMBERSHIP_DIR, CATALOG_DIR, args, logger } from './lib/kompas-collect.mjs';

const log = logger('coverage');
const DRY = args.has('dry-run');
const OPEN_AGGS = ['kaplan', 'cats', 'qahe', 'oxford-international', 'navitas'];

const readJson = async (p) => JSON.parse(await fs.readFile(p, 'utf8'));
const exists = async (p) => !!(await fs.stat(p).catch(() => null));

// ------------------------------------------------------------- входные ----
const sourceMap = await readJson(path.join(KOMPAS_DIR, 'partner-source-map.json'));
const catalogFiles = (await fs.readdir(CATALOG_DIR)).filter((f) => f.endsWith('.json'));
const catalogSlugs = new Set(catalogFiles.map((f) => f.replace(/\.json$/, '')));

// кого сессия 1 отнесла к каждому агрегатору
const markedBy = {};
for (const [slug, mark] of Object.entries(sourceMap)) {
  for (const via of mark.via || []) {
    (markedBy[via] = markedBy[via] || new Set()).add(slug);
  }
}

// --------------------------------------------------------- по агрегатору ----
const perAgg = [];
for (const agg of OPEN_AGGS) {
  const dir = path.join(EXTRACTS_DIR, agg);
  const files = (await exists(dir)) ? (await fs.readdir(dir)).filter((f) => f.endsWith('.json')) : [];
  const collected = [];
  for (const f of files) {
    const d = await readJson(path.join(dir, f));
    collected.push({
      slug: d.slug,
      name: d.name,
      programs: d.programs?.length || 0,
      withFee: (d.programs || []).filter((p) => p.feePerYear).length,
      internationalFee: (d.programs || []).filter((p) => p.feeAudience === 'international').length,
      inCatalog: catalogSlugs.has(d.slug),
    });
  }

  const memberFile = path.join(MEMBERSHIP_DIR, `${agg}.json`);
  const membership = (await exists(memberFile)) ? await readJson(memberFile) : null;

  const marked = [...(markedBy[agg] || [])].sort();
  const collectedSlugs = new Set(collected.map((c) => c.slug));
  const gotData = marked.filter((s) => collectedSlugs.has(s));
  const noData = marked.filter((s) => !collectedSlugs.has(s));
  const newToUs = collected.filter((c) => !marked.includes(c.slug)).map((c) => c.slug);

  perAgg.push({
    aggregator: agg,
    markedInSession1: marked.length,
    extractsCollected: collected.length,
    markedWithFreshData: gotData.length,
    markedWithoutData: noData,
    collectedButNotMarked: newToUs,
    programs: collected.reduce((s, c) => s + c.programs, 0),
    programsWithFee: collected.reduce((s, c) => s + c.withFee, 0),
    programsWithInternationalFee: collected.reduce((s, c) => s + c.internationalFee, 0),
    membershipLive: membership?._meta?.counts || membership?._meta?.liveCount || null,
    perUniversity: collected.sort((a, b) => b.programs - a.programs),
  });
  log(`${agg}: размечено ${marked.length}, выгрузок ${collected.length}, программ ${collected.reduce((s, c) => s + c.programs, 0)}`);
}

// ------------------------------------------------------------- находки ----
const findings = [
  {
    key: 'fabricated-navitas-oi',
    severity: 'высокая',
    title: 'Цены Navitas и Oxford International в каталоге были придуманы, а не собраны',
    detail: 'seed-navitas-uk.mjs и seed-oxfordintl-uk.mjs задают стоимость литеральной таблицей '
      + 'UK_FEE_BAND_BASE (foundation 14500, utp-business 15500, utp-engineering 16500, utp-arts 14800, '
      + 'utp-health 15800) и раздают её всем вузам одинаково. Это нарушение правила 4 «не фабрикуем». '
      + 'По Oxford International теперь есть настоящие цены с источника; по Navitas — пока нет.',
  },
  {
    key: 'fabricated-qahe-fallback',
    severity: 'высокая',
    title: 'Коллектор QA подставлял выдуманные программы и сроки',
    detail: 'scrape-qahe-all.mjs при пустом парсинге вызывал fallbackPrograms() — захардкоженный список '
      + 'из трёх программ, а duration/intake во всех случаях брались из таблицы LEVEL_PATTERNS по уровню '
      + '(«1 Year», September+January), а не со страницы источника.',
  },
  {
    key: 'oi-partner-drift',
    severity: 'высокая',
    title: 'Список партнёров Oxford International разошёлся с нашими заметками почти полностью',
    detail: 'Живой REST отдаёт 26 партнёров. Из 21 в заметках от 2026-05-15 совпало 7 (Kent, Dundee, '
      + 'Bradford, Bangor, De Montfort, Greenwich, San Francisco State). Нет больше: Ulster, Abertay, '
      + 'Birmingham, Glasgow и канадской группы (Acadia, Dalhousie, NSCAD, Mount Saint Vincent, '
      + 'St Francis Xavier, Mount Allison, UPEI, Memorial), а также Edith Cowan. Появились 19 новых. '
      + 'Нужно решение владельца: заметки устарели или часть партнёрств живёт под другим брендом OIEG.',
  },
  {
    key: 'oi-partners-without-courses',
    severity: 'низкая',
    title: 'У трёх партнёров Oxford International нет ни одного курса на источнике',
    detail: 'De Montfort University, Syracuse University и University of Southampton Delhi числятся '
      + 'партнёрами в REST, но курсов у них не опубликовано. Проверено отдельным поиском по API '
      + '(search=de-montfort / syracuse / southampton даёт 0) — это пустота на источнике, а не дыра в привязке.',
  },
  {
    key: 'qahe-list-drift',
    severity: 'средняя',
    title: 'У QA на сайте шесть партнёров вместо четырёх из документа',
    detail: 'Добавились London Metropolitan University и Swansea University. По правилу 2 состав '
      + 'определяет документ владельца, поэтому в каталог они не заводятся — но расхождение зафиксировано.',
  },
  {
    key: 'qahe-brookes-empty',
    severity: 'средняя',
    title: 'У Oxford Brookes — партнёра из списка владельца — на живом сайте QA нет ни одного курса',
    detail: 'В индексе qahighereducation.com/courses/ 112 курсов: Northumbria 60, Ulster 28, Solent 13, '
      + 'London Met 5, собственные QA 6. Курсов Oxford Brookes нет вовсе.',
  },
  {
    key: 'qahe-fee-audience',
    severity: 'средняя',
    title: 'Часть цен QA — для британцев, а не для международных студентов',
    detail: 'На страницах Solent цена подписана просто «Tuition fees: £9,790 per annum» без аудитории, '
      + 'а на собственных страницах QA прямо сказано «We are not currently able to sponsor international '
      + 'students». Каждая цена в выгрузке несёт feeAudience — применять вслепую нельзя.',
  },
  {
    key: 'qahe-ifp-moved',
    severity: 'низкая',
    title: 'Программы International Foundation у QA переехали в University of South Wales',
    detail: 'Страницы /courses/international-foundation-programme-* на qahighereducation.com редиректят '
      + 'на southwales.ac.uk.',
  },
  {
    key: 'kaplan-uwe-gone',
    severity: 'средняя',
    title: 'Из фида Kaplan выпал University of the West of England',
    detail: 'В снимке от 2026-07-01 было 25 вузов, в свежем фиде 24. Программ стало 4725 против 4723.',
  },
  {
    key: 'navitas-scale',
    severity: 'высокая',
    title: 'Сеть Navitas в 3,5 раза больше, чем мы знали',
    detail: 'Живая страница колледжей даёт 72 записи по AU/CA/DE/ID/LK/NL/NZ/SG/AE/UK/USA; локально были '
      + 'известны только 10 британских вузов из сид-скрипта. Программ с ценами по Navitas пока нет: '
      + 'у сайтов колледжей нет типа записи «курс», разметка у каждого домена своя.',
  },
  {
    key: 'griffith-namesake',
    severity: 'средняя',
    title: 'Однофамильцы: Griffith College Brisbane едва не сел на ирландскую карточку',
    detail: 'Сопоставление по имени поставило австралийский колледж Navitas на карточку «Griffith College» '
      + '(Дублин, Ирландия). Добавлена сверка по стране из домена колледжа (griffithcollege.edu.au -> '
      + 'Австралия). Поймано просмотром списка глазами, а не цифрой «сопоставлено N».',
  },
  {
    key: 'mmu-double-card',
    severity: 'низкая',
    title: 'В каталоге две карточки под Manchester Metropolitan',
    detail: 'manchester-met («Manchester Metropolitan University») и mmu-international-college. '
      + 'Колледж Navitas сопоставляется со второй. Нужно решение: одна карточка или две.',
  },
  {
    key: 'cats-not-university-level',
    severity: 'низкая',
    title: 'CATS — это школы, а не вузы',
    detail: 'На сайте 13 школ; коллектор покрывает 9. Уровни — high_school / sixth_form / foundation, '
      + 'то есть в вузовский каталог они ложатся плохо. Нужно решение владельца, что с ними делать.',
  },
];

// -------------------------------------------------------------- вывод ----
const summary = {
  _meta: {
    plan: 'КОМПАС сессия 2',
    generatedAt: new Date().toISOString(),
    scope: '5 открытых агрегаторов: Kaplan, CATS, QA HE, Oxford International, Navitas',
    catalogSize: catalogSlugs.size,
    catalogTouched: false,
  },
  totals: {
    extracts: perAgg.reduce((s, a) => s + a.extractsCollected, 0),
    programs: perAgg.reduce((s, a) => s + a.programs, 0),
    programsWithFee: perAgg.reduce((s, a) => s + a.programsWithFee, 0),
    programsWithInternationalFee: perAgg.reduce((s, a) => s + a.programsWithInternationalFee, 0),
  },
  perAggregator: perAgg,
  findings,
};

if (!DRY) {
  await fs.writeFile(path.join(KOMPAS_DIR, 'coverage-session2.json'), JSON.stringify(summary, null, 2) + '\n', 'utf8');
}

// ------------------------------------------------------ отчёт владельцу ----
const md = [];
md.push('# КОМПАС, сессия 2 — свежий сбор с пяти открытых агрегаторов', '');
md.push(`Дата: ${new Date().toISOString().slice(0, 10)}. Живой каталог не изменён: всё лежит в \`sources/kompas/\`.`, '');
md.push('## Что собрано', '');
md.push('| Агрегатор | Размечено в сессии 1 | Выгрузок | Программ | С ценой | Международных цен |');
md.push('|---|---:|---:|---:|---:|---:|');
for (const a of perAgg) {
  md.push(`| ${a.aggregator} | ${a.markedInSession1} | ${a.extractsCollected} | ${a.programs} | ${a.programsWithFee} | ${a.programsWithInternationalFee} |`);
}
md.push('', `**Итого: ${summary.totals.programs} программ, из них ${summary.totals.programsWithFee} с ценой.**`, '');

md.push('## Находки', '');
for (const f of findings) {
  md.push(`### ${f.title}`, '', `*Важность: ${f.severity}.* ${f.detail}`, '');
}

md.push('## Что требует решения владельца', '');
md.push('1. **Oxford International:** список партнёров разошёлся с нашими заметками — подтвердить живые 26 или прислать актуальный список.');
md.push('2. **QA:** London Metropolitan и Swansea есть на сайте, но не в документе — включать или нет.');
md.push('3. **QA / Oxford Brookes:** партнёр в документе есть, курсов на сайте нет — что делать с карточкой.');
md.push('4. **Kaplan:** University of the West of England выпал из фида — снимать ли метку партнёра.');
md.push('5. **Navitas:** сеть 72 колледжа; подтвердить, что партнёрами считаются все, и тогда планировать сбор программ по доменам.');
md.push('6. **CATS:** это школы (high school / sixth form), а не вузы — нужны ли они в каталоге.');
md.push('7. **Manchester Metropolitan:** две карточки в каталоге — оставить обе или слить.', '');

md.push('## Чего в этой сессии НЕТ', '');
md.push('- Программ и цен Navitas: у сайтов колледжей нет общего API курсов, каждому из ~40 доменов нужен свой коллектор. Старые сид-цены подтверждения не получили и остаются недостоверными.');
md.push('- Программ CATS в единой форме: уровни школ не ложатся в схему вузовского каталога.');
md.push('- Применения чего-либо к живому каталогу — по правилу 5 это сессия 5.', '');

if (!DRY) {
  await fs.writeFile(path.join(KOMPAS_DIR, 'OWNER-REPORT-session2.md'), md.join('\n'), 'utf8');
}

log('--- итог ---');
log(`выгрузок ${summary.totals.extracts}, программ ${summary.totals.programs}, с ценой ${summary.totals.programsWithFee}`);
log(DRY ? 'DRY-RUN: на диск не писали' : 'записаны coverage-session2.json и OWNER-REPORT-session2.md');
