#!/usr/bin/env node
// kompas-collect-navitas.mjs — КОМПАС сессия 2, агрегатор Navitas: живой состав сети.
//
// ЗАЧЕМ. До сессии 2 про Navitas локально было известно ДЕСЯТЬ британских вузов — и те из
// `seed-navitas-uk.mjs`, сид-скрипта, где цены заданы литеральной таблицей UK_FEE_BAND_BASE
// (foundation 14500, utp-business 15500, utp-engineering 16500…). Это не данные источника,
// а придуманные числа — нарушение правила 4 «не фабрикуем». Живая сеть Navitas на 2026-07-22
// насчитывает 72 записи колледжей и кампусов по AU/CA/DE/ID/LK/NL/NZ/SG/AE/UK/USA.
//
// ЧТО ЗДЕСЬ ЕСТЬ. Полный живой состав: колледж -> вуз -> слаг каталога, с методом сопоставления
// у каждой записи, чтобы результат можно было проверить глазами, а не верить цифре «найдено N».
//
// ЧЕГО ЗДЕСЬ НЕТ И ПОЧЕМУ. Программ с ценами тут нет. Замер: у сайтов колледжей Navitas нет
// типа записи «курс» в WP REST (проверены bcuic/icp/icrgu/curtincollege/deakincollege/kuic/
// arucollege — только soliloquy/news/blog/events), курсы лежат обычными страницами, у каждого
// из ~40 доменов своя разметка. Это отдельный коллектор на каждый домен — работа не одной
// сессии. Пока программ нет, старые сид-цены НЕ считаются подтверждёнными.
//
// Usage: node scraper/kompas-collect-navitas.mjs [--dry-run]

import fs from 'fs/promises';
import path from 'path';
import {
  fetchHtml, decodeEntities, writeMembership, CATALOG_DIR, args, logger, stats,
} from './lib/kompas-collect.mjs';

const log = logger('navitas');
const AGG = 'navitas';
const INDEX = 'https://www.navitas.com/study/colleges-campuses/';
const DRY = args.has('dry-run');

// ------------------------------------------------- колледж -> имя вуза ----
// Имена колледжей Navitas почти всегда содержат имя вуза: «Anglia Ruskin University College»,
// «Keele University International College», «Curtin College». Снимаем сетевые суффиксы
// и хвост кампуса, остальное — кандидат в имя вуза.
const COLLEGE_SUFFIXES = [
  /\s+Global Student Success Program$/i,
  /\s+International Study Centre$/i,
  /\s+Pathway College$/i,
  /\s+International College$/i,
  /\s+University College$/i,
  /\s+English Centre$/i,
  /\s+College Australia$/i,
  /\s+College$/i,
];

// Города и слова-кампусы, которыми Navitas различает площадки ОДНОГО вуза.
// Снимаются только с ХВОСТА и только если после снятия что-то осталось.
const CAMPUS_TAIL = new RegExp(
  '\\s+(?:' + [
    'City Campus', 'Campus', 'Online', 'Sydney', 'Melbourne', 'Perth', 'Brisbane', 'Adelaide',
    'Gold Coast', 'Byron Bay', 'Geelong', 'Canberra', 'Auckland', 'Calgary', 'Vancouver',
    'Toronto', 'Chicago', 'Atlanta', 'Nashville', 'Miami', 'NYC', 'New York',
    'Berlin', 'Heidelberg', 'Munich', 'Leipzig', 'Singapore', 'Dubai', 'Bandung', 'London',
  ].join('|') + ')+$', 'i',
);

/**
 * Кандидаты в имя вуза, от самого точного к самому смелому.
 * Каждый кандидат подписан — в отчёте видно, какой сработал, и брак ловится глазами.
 * Формы взяты из живой страницы: «Anglia Ruskin University College», «International College
 * of Manitoba», «International College Portsmouth», «Charles Sturt University Melbourne»,
 * «ULethbridge International College Calgary», «The College, Swansea University».
 */
function universityNameCandidates(collegeName) {
  const out = [];
  const push = (name, how) => {
    const v = (name || '').replace(/\s+/g, ' ').trim();
    if (v.length >= 3 && !out.some((o) => o.name.toLowerCase() === v.toLowerCase())) out.push({ name: v, how });
  };

  // «The College, Swansea University» -> берём часть после запятой
  const commaTail = collegeName.match(/,\s*(.+)$/);
  if (commaTail) push(commaTail[1], 'after-comma');

  let base = collegeName.split(/\s+[|]\s+/)[0]
    .replace(/\s+[-–—]\s+[A-Za-z .'()]+$/, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim();
  push(base, 'as-is');

  // приставочная форма: «International College of X» / «International College X»
  const prefixed = base.replace(/^International College(?:\s+of)?\s+/i, '');
  if (prefixed !== base) push(prefixed, 'strip-prefix-international-college');

  // сетевые суффиксы
  for (const src of [base, prefixed]) {
    for (const re of COLLEGE_SUFFIXES) {
      if (re.test(src)) { push(src.replace(re, ''), 'strip-suffix'); break; }
    }
  }

  // хвост кампуса — применяем к уже полученным кандидатам
  for (const c of [...out]) {
    const cut = c.name.replace(CAMPUS_TAIL, '');
    if (cut !== c.name) push(cut, `${c.how}+strip-campus`);
  }

  // «ULethbridge» -> «Lethbridge» (Navitas так сокращает University of X)
  for (const c of [...out]) {
    const m = c.name.match(/^U([A-Z][a-z]{3,})\b(.*)$/);
    if (m) push(`${m[1]}${m[2]}`, `${c.how}+expand-U-prefix`);
  }

  return out;
}

// ------------------------------------------------------- индекс каталога ----
const norm = (s) => (s || '').toLowerCase()
  .normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/&/g, ' and ').replace(/[’'`]/g, '')
  .replace(/\bthe\b/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

const stripGeneric = (s) => norm(s)
  .replace(/\b(university|universities|college|institute|school)\b/g, ' ')
  .replace(/\s+/g, ' ').trim();

async function buildCatalogIndex() {
  const files = await fs.readdir(CATALOG_DIR);
  const rows = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    try {
      const c = JSON.parse(await fs.readFile(path.join(CATALOG_DIR, f), 'utf8'));
      const slug = c.slug || f.replace(/\.json$/, '');
      rows.push({ slug, name: c.name || '', country: c.country || null, exact: norm(c.name), core: stripGeneric(c.name) });
    } catch { /* битый файл пропускаем */ }
  }
  return rows;
}

// Порядок как в сессии 1: точный слаг -> точное имя -> имя без родовых слов.
// Родовое имя проверяем только при непустом и достаточно длинном ядре, иначе
// «... College» схлопывает разные вузы.
// Страна по домену колледжа. Нужна, чтобы имя не село на однофамильца из другой страны:
// «Griffith College - Brisbane» (griffithcollege.edu.au) по имени совпадал с карточкой
// «Griffith College» — а это ИРЛАНДСКИЙ вуз в Дублине. Поймано глазами, не цифрой.
const TLD_COUNTRY = [
  [/\.edu\.au$|\.com\.au$|\.au$/i, 'Australia'],
  [/\.ac\.uk$|\.co\.uk$|\.uk$/i, 'United Kingdom'],
  [/\.ca$/i, 'Canada'],
  [/\.ac\.nz$|\.co\.nz$|\.nz$/i, 'New Zealand'],
  [/\.de$/i, 'Germany'],
  [/\.nl$/i, 'Netherlands'],
  [/\.ac\.lk$|\.lk$/i, 'Sri Lanka'],
  [/\.ac\.id$|\.id$/i, 'Indonesia'],
  [/\.edu\.sg$|\.sg$/i, 'Singapore'],
];

function countryFromUrl(url) {
  let host;
  try { host = new URL(url).host; } catch { return null; }
  for (const [re, country] of TLD_COUNTRY) if (re.test(host)) return country;
  return null; // .com и поддомены navitas.com страну не выдают — тогда не проверяем
}

function pick(list, expectedCountry, method) {
  if (!list.length) return null;
  if (expectedCountry) {
    const same = list.filter((c) => c.country === expectedCountry);
    if (same.length === 1) return { slug: same[0].slug, catalogName: same[0].name, method };
    if (same.length > 1) return { slug: null, method: `ambiguous-${method}`, candidates: same.map((c) => c.slug) };
    // единственный кандидат, но страна другая — это однофамилец, отвергаем
    if (list.length === 1) return { slug: null, method: `country-mismatch-${method}`, rejected: list[0].slug };
    return { slug: null, method: `ambiguous-${method}`, candidates: list.map((c) => c.slug) };
  }
  if (list.length === 1) return { slug: list[0].slug, catalogName: list[0].name, method };
  return { slug: null, method: `ambiguous-${method}`, candidates: list.map((c) => c.slug) };
}

function resolve(uniName, catalog, expectedCountry) {
  const wantSlug = norm(uniName).replace(/\s+/g, '-');
  const bySlug = catalog.filter((c) => c.slug === wantSlug);
  const r1 = pick(bySlug, expectedCountry, 'exact-slug');
  if (r1?.slug) return r1;

  const wantExact = norm(uniName);
  const r2 = pick(catalog.filter((c) => c.exact === wantExact), expectedCountry, 'exact-name');
  if (r2?.slug) return r2;

  const wantCore = stripGeneric(uniName);
  if (wantCore.length >= 5) {
    const r3 = pick(catalog.filter((c) => c.core === wantCore), expectedCountry, 'core-name');
    if (r3?.slug) return r3;
    if (r3) return r3;
  }
  return r2 || r1 || { slug: null, method: 'no-match' };
}

// ------------------------------------------------------------------ main ----
const html = await fetchHtml(INDEX);
const raw = [...html.matchAll(/<a[^>]+href="(https?:\/\/(?!www\.navitas\.com)[^"]+)"[^>]*>([\s\S]{0,220}?)<\/a>/gi)]
  .map((m) => ({
    url: m[1],
    college: decodeEntities(m[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim(),
  }))
  .filter((x) => x.college.length > 3
    && !/facebook|twitter|linkedin|instagram|youtube|privacy|cookie|tiktok|weibo/i.test(x.url)
    && !/^(read more|find out|apply|learn more|visit)/i.test(x.college));

// одна запись на колледж (кампусы одного колледжа дают одинаковое имя вуза)
const seen = new Set();
const colleges = [];
for (const r of raw) {
  const key = r.college.toLowerCase();
  if (seen.has(key)) continue;
  seen.add(key);
  colleges.push(r);
}
log(`записей колледжей на странице: ${colleges.length}`);

const catalog = await buildCatalogIndex();
log(`каталог: ${catalog.length} вузов`);

const rows = colleges.map((c) => {
  const cands = universityNameCandidates(c.college);
  const country = countryFromUrl(c.url);
  let hit = null;
  const tried = [];
  for (const cand of cands) {
    const res = resolve(cand.name, catalog, country);
    tried.push(`${cand.how}:${cand.name}=${res.method}`);
    if (res.slug) { hit = { ...res, cand }; break; }
  }
  return {
    college: c.college,
    collegeUrl: c.url,
    collegeCountry: country,
    derivedUniversityName: hit ? hit.cand.name : (cands[0]?.name || c.college),
    catalogSlug: hit?.slug || null,
    catalogName: hit?.catalogName || null,
    matchMethod: hit ? `${hit.cand.how}/${hit.method}` : 'no-match',
    triedCandidates: tried,
  };
});

const matched = rows.filter((r) => r.catalogSlug);
const unmatched = rows.filter((r) => !r.catalogSlug);
const uniqueUnis = [...new Set(matched.map((r) => r.catalogSlug))];

await writeMembership(AGG, {
  _meta: {
    aggregator: AGG,
    label: 'Navitas',
    source: INDEX,
    collectedAt: new Date().toISOString(),
    rule: 'all',
    notes: [
      'Живой состав сети на 2026-07-22. До этой сессии локально было известно только 10 британских вузов из seed-navitas-uk.mjs.',
      'Цены в seed-navitas-uk.mjs заданы литеральной таблицей UK_FEE_BAND_BASE — это не данные источника. Подтверждения им здесь НЕТ.',
      'Программы Navitas в этой выгрузке отсутствуют: у сайтов колледжей нет типа записи «курс» в WP REST, курсы лежат обычными страницами со своей разметкой на каждом из ~40 доменов. Нужен отдельный коллектор на домен.',
      'Имя вуза выведено из имени колледжа снятием сетевых суффиксов — каждую строку видно вместе с methodом, проверять глазами.',
    ],
    counts: { colleges: rows.length, matchedToCatalog: matched.length, uniqueUniversities: uniqueUnis.length, unmatched: unmatched.length },
  },
  colleges: rows,
  matchedSlugs: uniqueUnis.sort(),
  unmatched: unmatched.map((r) => ({ college: r.college, derived: r.derivedUniversityName, method: r.matchMethod, url: r.collegeUrl })),
}, { dryRun: DRY });

log('--- итог ---');
log(`колледжей ${rows.length}; сопоставлено с каталогом ${matched.length} записей -> ${uniqueUnis.length} вузов; не сопоставлено ${unmatched.length}`);
const byMethod = rows.reduce((a, r) => (a[r.matchMethod] = (a[r.matchMethod] || 0) + 1, a), {});
log(`методы: ${JSON.stringify(byMethod)}`);
log(`запросов ${stats.requests}, неудач ${stats.failed}`);
if (DRY) log('DRY-RUN: на диск не писали');
