#!/usr/bin/env node
// kompas-collect-fleming.mjs — КОМПАС 4.5: точечный сбор Fleming College.
//
// Общий офсайт-коллектор дал по Fleming 0: на страницах программ <h1> — рекламная
// заглушка «Apply Yourself Here», одинаковая на всех, а имя программы лежит в <title>
// («Aquaculture : Fleming College»). Универсальный сборщик берёт h1 и потому отверг всё.
//
// Здесь имя берётся из <title>, список программ — из sitemap (/programs/<name>),
// служебные индексы (a-z, apprenticeships-родитель, co-op-programs, post-graduate…)
// исключены поимённо. Пишет выгрузку в extracts/direct/fleming-college-toronto.json
// в общем формате; заполнение карточки делает kompas-fold-offsite.mjs.
//
// Запуск: node kompas-collect-fleming.mjs [--apply]

import fs from 'node:fs/promises';
import path from 'node:path';
import { KOMPAS_DIR, args, logger, fetchHtml } from './lib/kompas-collect.mjs';

const log = logger('fleming');
const APPLY = args.has('apply');
const ORIGIN = 'https://flemingcollege.ca';
// Через общую очередь с ретраями и паузой: плейн-fetch ловит рейт-лимит Fleming.
const get = (u) => fetchHtml(u, { headers: { 'Accept-Language': 'en-CA,en;q=0.9' } });

// Пути под /programs/, которые НЕ программы, а индексы/справка. Выверено глазами.
const EXCLUDE = new Set([
  '/programs/a-z', '/programs/advanced-standing', '/programs/apprenticeships',
  '/programs/apprenticeships/apprenticeship-exemption-exams',
  '/programs/apprenticeships/in-school-training',
  '/programs/apprenticeships/ontario-youth-apprenticeship-program',
  '/programs/apprenticeships/post-secondary-apprenticeship-pathways',
  '/programs/apprenticeships/preapprenticeship-training',
  '/programs/co-op-programs', '/programs/general-education-electives',
  '/programs/indigenous-perspectives-designation', '/programs/post-graduate',
  '/programs/programs-for-workplace-graduates',
]);

async function sitemapUrls() {
  const seen = new Set(); const urls = new Set();
  let queue = [`${ORIGIN}/sitemap.xml`];
  while (queue.length && seen.size < 40) {
    const sm = queue.shift(); if (seen.has(sm)) continue; seen.add(sm);
    let xml; try { xml = await get(sm); } catch { continue; }
    for (const m of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
      const u = m[1]; if (/\.xml(\.gz)?$/i.test(u)) queue.push(u); else urls.add(u);
    }
  }
  return [...urls];
}

const titleOf = (html) => {
  const m = html.match(/<title[^>]*>([\s\S]{0,200}?)<\/title>/i);
  if (!m) return null;
  let t = m[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#0?39;|&rsquo;/g, '’').trim();
  // «Aquaculture : Fleming College» -> «Aquaculture»
  t = t.split(/\s*[:|]\s*Fleming College/i)[0].split(/\s*[:|]\s*$/)[0].trim();
  return t || null;
};

async function main() {
  if (!APPLY) log('СУХОЙ ПРОГОН: не пишу. Для записи добавь --apply');
  const all = await sitemapUrls();
  log(`адресов из sitemap: ${all.length}`);
  const paths = [...new Set(all.map((u) => { try { return new URL(u).pathname.replace(/\/$/, ''); } catch { return null; } }))]
    .filter((p) => p && /^\/programs\/[^/]+/.test(p) && !EXCLUDE.has(p));
  log(`страниц программ к обходу: ${paths.length}`);

  const programs = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (const p of paths) {
    let html; try { html = await get(ORIGIN + p); } catch { continue; }
    const title = titleOf(html);
    await sleep(500);
    if (!title || title.length < 3 || /apply yourself/i.test(title)) continue;
    programs.push({ title, level: null, programUrl: ORIGIN + p, source: 'official', verifiedBySite: true, checkedAt: new Date().toISOString().slice(0, 10) });
  }
  log(`имён программ снято: ${programs.length}`);

  const payload = {
    slug: 'fleming-college-toronto', name: 'Fleming College', source: 'official-direct', sourceUrl: ORIGIN,
    scrapedAt: new Date().toISOString(), discovery: 'sitemap-title',
    note: 'Имя программы взято из <title>: у Fleming <h1> — рекламная заглушка на всех страницах.',
    urlsSeen: all.length, courseUrlsFound: paths.length, programsKept: programs.length,
    programs,
  };
  if (APPLY) {
    await fs.writeFile(path.join(KOMPAS_DIR, 'extracts', 'direct', 'fleming-college-toronto.json'),
      JSON.stringify(payload, null, 2) + '\n', 'utf8');
  }
  console.log(JSON.stringify({ applied: APPLY, programs: programs.length, sample: programs.slice(0, 8).map((p) => p.title) }, null, 2));
  console.log('FLEMING DONE');
}

main().catch((e) => { console.error(e); process.exit(1); });
