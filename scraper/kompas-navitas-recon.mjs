#!/usr/bin/env node
// kompas-navitas-recon.mjs — разведка перед коллектором программ Navitas.
//
// ЗАЧЕМ. Замер состава (kompas-collect-navitas) знает 71 колледж сети, но программ
// у Navitas в каталоге НЕТ НИ ОДНОЙ: у колледжей нет общего портала курсов, каждый
// сайт свой. Прежде чем писать обход на сорок доменов, надо знать, за что там
// вообще цепляться — иначе коллектор пишется вслепую и половина доменов отвалится.
//
// ЧТО ДЕЛАЕТ. По каждому уникальному домену колледжа пробует, в порядке дешевизны:
//   1) WP REST /wp-json/wp/v2/types — есть ли тип записи под курсы (course/program/…);
//   2) sitemap.xml / sitemap_index.xml — сколько адресов похожи на страницы курсов;
//   3) типовые разделы (/courses/, /programs/, /study/…) — отвечает ли хоть один.
// Сеть только на чтение, ничего никуда не пишется кроме отчёта.
//
// Запуск: node scraper/kompas-navitas-recon.mjs [--limit=N]
// Отчёт:  sources/kompas/navitas-recon.json + таблица в stderr.

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const MEMBERSHIP = path.join(ROOT, 'sources', 'kompas', 'membership', 'navitas.json');
const OUT = path.join(ROOT, 'sources', 'kompas', 'navitas-recon.json');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const TIMEOUT = 15000;
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? Number(limitArg.split('=')[1]) : Infinity;
const log = (...a) => process.stderr.write(`[navitas-recon] ${new Date().toISOString().slice(11, 19)} ${a.join(' ')}\n`);

// Адрес курса узнаётся по отрезку пути, а не по слову где угодно в строке:
// «/about/our-courses-are-great» — не курс, «/courses/nursing» — курс.
const COURSE_PATH = /\/(courses?|programs?|programmes?|study|degrees?|qualifications?)\//i;
const COURSE_CPT = /^(course|courses|program|programs|programme|programmes|degree|degrees|qualification|study)$/i;

async function get(url) {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), TIMEOUT);
    const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: ac.signal });
    clearTimeout(t);
    return r.ok ? { status: r.status, text: await r.text(), url: r.url } : { status: r.status, text: null, url };
  } catch (e) {
    return { status: 0, text: null, url, error: e.message.slice(0, 60) };
  }
}

async function probeRest(origin) {
  const r = await get(`${origin}/wp-json/wp/v2/types`);
  if (!r.text) return { ok: false, status: r.status };
  try {
    const types = Object.keys(JSON.parse(r.text));
    return { ok: true, status: r.status, courseTypes: types.filter((t) => COURSE_CPT.test(t)), allTypes: types.length };
  } catch { return { ok: false, status: r.status }; }
}

// Карта сайта бывает индексом карт: тогда спускаемся на уровень ниже, но не глубже —
// нам нужен порядок величины, а не полный перечень.
async function probeSitemap(origin) {
  for (const name of ['/sitemap.xml', '/sitemap_index.xml', '/sitemap-index.xml']) {
    const r = await get(origin + name);
    if (!r.text || !r.text.includes('<loc>')) continue;
    let locs = [...r.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    if (r.text.includes('<sitemapindex')) {
      const inner = locs.filter((u) => COURSE_PATH.test(u) || /course|program|study/i.test(u)).slice(0, 3);
      const nested = [];
      for (const u of inner.length ? inner : locs.slice(0, 3)) {
        const rr = await get(u);
        if (rr.text) nested.push(...[...rr.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
      }
      locs = nested.length ? nested : locs;
    }
    const courses = locs.filter((u) => COURSE_PATH.test(u));
    return { found: name, total: locs.length, courseLike: courses.length, sample: courses.slice(0, 2) };
  }
  return { found: null };
}

async function probeSections(origin) {
  const hits = [];
  for (const p of ['/courses/', '/courses', '/programs/', '/programmes/', '/study/', '/our-courses/']) {
    const r = await get(origin + p);
    if (r.text && r.text.length > 800) { hits.push(p); if (hits.length >= 2) break; }
  }
  return hits;
}

const membership = JSON.parse(await fs.readFile(MEMBERSHIP, 'utf8'));
const byDomain = new Map();
for (const c of membership.colleges) {
  if (!c.collegeUrl) continue;
  let origin;
  try { origin = new URL(c.collegeUrl).origin; } catch { continue; }
  if (!byDomain.has(origin)) byDomain.set(origin, { origin, colleges: [], catalogSlugs: new Set() });
  byDomain.get(origin).colleges.push(c.college);
  if (c.catalogSlug) byDomain.get(origin).catalogSlugs.add(c.catalogSlug);
}
const domains = [...byDomain.values()].slice(0, LIMIT);
log(`колледжей ${membership.colleges.length}, уникальных доменов ${byDomain.size}, проверяю ${domains.length}`);

const results = [];
let done = 0;
for (const d of domains) {
  const rest = await probeRest(d.origin);
  const sitemap = await probeSitemap(d.origin);
  const sections = (rest.courseTypes?.length || sitemap.courseLike) ? [] : await probeSections(d.origin);
  const method = rest.courseTypes?.length ? 'wp-rest'
    : sitemap.courseLike ? 'sitemap'
      : sections.length ? 'sections'
        : 'нет зацепки';
  results.push({
    origin: d.origin,
    colleges: d.colleges.length,
    catalogSlugs: [...d.catalogSlugs],
    method,
    restCpt: rest.courseTypes || [],
    sitemap: sitemap.found ? { file: sitemap.found, total: sitemap.total, courseLike: sitemap.courseLike, sample: sitemap.sample } : null,
    sections,
  });
  if (++done % 10 === 0) log(`… ${done}/${domains.length}`);
}

const byMethod = results.reduce((a, r) => { a[r.method] = (a[r.method] || 0) + 1; return a; }, {});
await fs.writeFile(OUT, JSON.stringify({
  _meta: {
    aggregator: 'navitas', generatedAt: new Date().toISOString(),
    colleges: membership.colleges.length, domains: byDomain.size, probed: results.length,
    byMethod,
    note: 'Разведка перед коллектором программ: чем можно взять курсы у каждого домена сети.',
  },
  domains: results,
}, null, 2) + '\n');

log('--- итог ---');
for (const [m, n] of Object.entries(byMethod).sort((a, b) => b[1] - a[1])) log(`  ${m}: ${n} доменов`);
const catch_ = results.filter((r) => r.method === 'sitemap').reduce((s, r) => s + (r.sitemap?.courseLike || 0), 0);
log(`  адресов, похожих на курсы, в картах сайтов: ~${catch_}`);
log(`отчёт: ${path.relative(ROOT, OUT)}`);
for (const r of results.filter((x) => x.method === 'нет зацепки')) log(`  БЕЗ ЗАЦЕПКИ: ${r.origin} (${r.catalogSlugs.join(',') || 'нет карточки'})`);
