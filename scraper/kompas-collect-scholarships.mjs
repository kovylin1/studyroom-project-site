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
  fetchHtml, writeExtract, args, logger, stats,
  KOMPAS_DIR, EXTRACTS_DIR,
} from './lib/kompas-collect.mjs';
import { resolveOfficialSite } from './lib/official-site.mjs';
// Разборщики живут в lib и покрыты тестами (kompas-scholarships-parse.test.mjs):
// из этого файла их было не импортировать — он запускает main() при импорте, а
// ошибка разбора уходит прямо в карточку как «проверенная офсайтом» сумма.
import {
  PAGE_HINT, acceptName, sameSite, links, parseScholarships, detailUrls, parseDetail,
} from './lib/kompas-scholarships-parse.mjs';

const log = logger('scholar');
const WORK = path.join(KOMPAS_DIR, 'catalog-work');
const OUT_DIR = path.join(EXTRACTS_DIR, 'scholarships');
const DRY = args.has('dry-run');
const ONLY = args.get('slug');
const LIMIT = args.num('limit', Infinity);
const MAX_PAGES = args.num('max-pages', 6);
const MAX_DETAILS = args.num('max-details', 25);
const SKIP_DONE = !args.has('refetch');

const readJson = async (f) => JSON.parse(await fs.readFile(f, 'utf8'));

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
    const name = acceptName(s.name);   // отсев заголовков раздела, инструкций и подписей полей
    if (!name) return;
    s.name = name;
    if (!bucket.some((x) => x.name.toLowerCase() === name.toLowerCase())) bucket.push(s);
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
