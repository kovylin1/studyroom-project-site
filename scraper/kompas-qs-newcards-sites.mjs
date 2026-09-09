#!/usr/bin/env node
// Ищет официальный сайт для записей QS, у которых карточки в каталоге нет.
// Тот же порядок, что в discover-official-sites.mjs (Wikidata P856 + проверка
// живой страницы на имя вуза), но по имени записи, а не по слагу каталога:
// карточек ещё нет, привязываться не к чему.
//
// Город из Wikidata (P131/P159) кладётся ТОЛЬКО как подсказка для сверки
// с офсайтом. В каталог он отсюда не попадает.
//
// Usage: node scraper/kompas-qs-newcards-sites.mjs
// Выход: sources/kompas/qs-newcards-sites.json

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'sources/kompas/qs-newcards-sites.json');
const UA = 'studyroom-official-site-discovery/1.0 (https://studyroom-project-site.pages.dev)';

// Записи QS, по которым просмотр показал: карточки в каталоге действительно нет.
const TARGETS = [
  { qsName: 'Falmouth University', search: 'Falmouth University', country: 'United Kingdom', programs: 124 },
  { qsName: 'University of Worcester (Undergraduate) + (Postgraduate)', search: 'University of Worcester', country: 'United Kingdom', programs: 212 },
  { qsName: 'Kwantlen Polytechnic University', search: 'Kwantlen Polytechnic University', country: 'Canada', programs: 107 },
  { qsName: 'Marshall University', search: 'Marshall University', country: 'United States', programs: 85 },
  { qsName: 'Mercy University', search: 'Mercy University', country: 'United States', programs: 68 },
  { qsName: 'Westminster International University in Tashkent', search: 'Westminster International University in Tashkent', country: 'Uzbekistan', programs: 14 },
  // У этих двух в Wikidata нет пары «сущность + P856»: у TEDI-London нет самой
  // сущности, у PHBS есть сущность Q7161059, но без официального сайта.
  // Адрес-кандидат проверяется тем же правилом: живая страница + имя вуза на ней.
  { qsName: 'TEDI - London', search: 'TEDI-London', country: 'United Kingdom', programs: 1, fallbackSite: 'https://tedi-london.ac.uk' },
  { qsName: 'Peking University HSBC Business School', search: 'Peking University HSBC Business School', country: 'China', programs: 2, fallbackSite: 'https://english.phbs.pku.edu.cn' },
];

const AGG = /edvoy|studygroup|kaplan|navitas|catseducation|catsglobalschools|oxfordinternational|intostudy|qs\.com|topuniversities|wikipedia/i;
const STOP = new Set(['university', 'college', 'institute', 'school', 'academy', 'centre', 'center',
  'international', 'global', 'studies', 'education', 'campus', 'the', 'and', 'for', 'of', 'in', 'at', 'higher', 'business']);

const tokens = (name) => String(name || '').toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ').split(' ').filter((t) => t.length > 3 && !STOP.has(t));

async function jsonFetch(url, ms = 12000) {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms);
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: ac.signal });
    clearTimeout(t);
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

async function textFetch(url, ms = 15000) {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms);
    const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: ac.signal });
    clearTimeout(t);
    const html = await r.text();
    return { status: r.status, finalUrl: r.url, html: html.length > 300 ? html : null };
  } catch (e) { return { status: 0, finalUrl: null, html: null, error: e.message }; }
}

const EDU_QIDS = new Set(['Q3918', 'Q38723', 'Q189004', 'Q2385804', 'Q4671277', 'Q875538', 'Q902104',
  'Q1371037', 'Q3354859', 'Q1321960', 'Q4820452', 'Q1663017', 'Q15936437', 'Q23002054', 'Q1244442',
  'Q108402759']); // «university in British Columbia» — под ним лежит Kwantlen

async function entityFacts(id) {
  const j = await jsonFetch('https://www.wikidata.org/w/api.php?' + new URLSearchParams({
    action: 'wbgetclaims', entity: id, format: 'json', origin: '*',
  }));
  if (!j?.claims) return null;
  const types = (j.claims.P31 || []).map((c) => c?.mainsnak?.datavalue?.value?.id).filter(Boolean);
  let site = null;
  for (const c of j.claims.P856 || []) {
    const v = c?.mainsnak?.datavalue?.value;
    if (typeof v === 'string' && /^https?:\/\//i.test(v)) { site = v; break; }
  }
  const placeId = (j.claims.P131 || j.claims.P159 || [])[0]?.mainsnak?.datavalue?.value?.id || null;
  return { site, types, isEdu: types.some((t) => EDU_QIDS.has(t)), placeId };
}

async function labelOf(id) {
  if (!id) return null;
  const j = await jsonFetch('https://www.wikidata.org/w/api.php?' + new URLSearchParams({
    action: 'wbgetentities', ids: id, props: 'labels', languages: 'en', format: 'json', origin: '*',
  }));
  return j?.entities?.[id]?.labels?.en?.value || null;
}

const rows = [];
for (const t of TARGETS) {
  const search = await jsonFetch('https://www.wikidata.org/w/api.php?' + new URLSearchParams({
    action: 'wbsearchentities', search: t.search, language: 'en', uselang: 'en',
    type: 'item', format: 'json', origin: '*', limit: '5',
  }));
  const cands = (search?.search || []).map((s) => ({ id: s.id, label: s.label, description: s.description || '' }));

  let picked = null;
  for (const c of cands) {
    const facts = await entityFacts(c.id);
    if (!facts?.site || !facts.isEdu) continue;
    if (AGG.test(new URL(facts.site).hostname)) continue;
    picked = { ...c, ...facts };
    break;
  }

  const row = {
    qsName: t.qsName, country: t.country, programs: t.programs,
    wikidata: picked ? { id: picked.id, label: picked.label, description: picked.description } : null,
    site: null, siteStatus: null, nameOnPage: null, cityHint: null, note: null,
  };

  if (!picked && !t.fallbackSite) {
    row.note = 'Wikidata не дала пары «учебное заведение + официальный сайт»';
    rows.push(row);
    console.log(`${t.qsName} → НЕ НАЙДЕН (кандидаты: ${cands.map((c) => c.id + ' ' + c.label).join(' ; ') || 'нет'})`);
    continue;
  }
  if (!picked) {
    picked = { id: null, label: null, description: null, site: t.fallbackSite, placeId: null };
    row.wikidata = null;
    row.source = 'адрес-кандидат, Wikidata молчит';
  } else {
    row.source = 'Wikidata P856';
  }

  const origin = new URL(picked.site).origin;
  const res = await textFetch(origin);
  const need = tokens(t.search);
  const hay = (res.html || '').toLowerCase();
  const hits = need.filter((n) => hay.includes(n));
  row.site = origin;
  row.siteStatus = res.status;
  row.nameOnPage = res.html ? `${hits.length}/${need.length}: ${hits.join(',')}` : null;
  row.cityHint = await labelOf(picked.placeId);
  if (!res.html) row.note = 'страница не отдалась — проверить руками';
  else if (!hits.length) row.note = 'имя вуза на странице не найдено — проверить руками';
  rows.push(row);
  console.log(`${t.qsName} → ${origin} [${res.status}] имя: ${row.nameOnPage} | город(Wikidata): ${row.cityHint || '—'}`);
}

fs.writeFileSync(OUT, JSON.stringify(rows, null, 2));
console.log(`\nразбор: ${path.relative(ROOT, OUT)}`);
