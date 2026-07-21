#!/usr/bin/env node
// discover-official-sites.mjs — ищет официальный сайт вуза и записывает его в officialUrl.
//
// Зачем: у 263 вузов каталога resolveOfficialSite() возвращает null — в sourceUrl стоит
// агрегатор (edge.edvoy.com и т.п.), а officialUrl пуст. Без адреса офсайта нечем
// проверять жильё/кампусы (БОБР-аудит) и неоткуда брать фото (ОРЁЛ).
//
// Источник: Wikidata, свойство P856 «official website». Бесплатно, без ключей.
//
// ГЛАВНОЕ ПРАВИЛО — не выдумывать. Найденный адрес попадает в каталог ТОЛЬКО если:
//   1) страница реально отвечает (HTTP 200, непустой HTML), И
//   2) на ней встречается отличительная часть названия вуза.
// Не прошло проверку → в worklist на ручной разбор, каталог не трогаем.
//
// Usage:
//   node scraper/discover-official-sites.mjs --dry-run --limit=15
//   node scraper/discover-official-sites.mjs --slug=abertay
//   node scraper/discover-official-sites.mjs --concurrency=4

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveOfficialSite, AGG_DOMAINS } from './lib/official-site.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const CATALOG_DIR = path.join(PROJECT_ROOT, 'site/src/content/universities');
const WORKLIST_OUT = path.join(__dirname, 'sources', 'official-sites-worklist.json');

const arg = (p) => (process.argv.find(a => a.startsWith(p)) || '').slice(p.length);
const LIMIT = parseInt(arg('--limit=') || 'Infinity', 10);
const SLUG_FILTER = arg('--slug=') || null;
const CONCURRENCY = parseInt(arg('--concurrency=') || '3', 10);
const DRY_RUN = process.argv.includes('--dry-run');

const UA = 'studyroom-official-site-discovery/1.0 (https://studyroom-project-site.pages.dev)';
const TODAY = new Date().toISOString().slice(0, 10);
const log = (...a) => process.stderr.write(`[офсайты] ${new Date().toISOString().slice(11, 19)} ${a.join(' ')}\n`);

// Слова, которые есть у половины вузов мира — по ним нельзя опознать конкретный вуз.
const STOP = new Set(['university', 'college', 'institute', 'school', 'academy', 'centre', 'center',
  'international', 'global', 'studies', 'education', 'campus', 'the', 'and', 'for', 'of', 'in', 'at',
  'higher', 'business', 'management', 'technology', 'science', 'sciences', 'arts', 'faculty',
  'universidad', 'universite', 'universität', 'hochschule', 'escuela', 'group', 'ltd', 'inc']);

function tokens(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter(t => t.length > 3 && !STOP.has(t));
}

async function jsonFetch(url, ms = 10000) {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms);
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: ac.signal });
    clearTimeout(t);
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

async function textFetch(url, ms = 10000) {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms);
    const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: ac.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const html = await r.text();
    return html.length > 300 ? html : null;
  } catch { return null; }
}

// Wikidata: имя → до 5 сущностей-кандидатов
async function searchEntities(name) {
  const u = 'https://www.wikidata.org/w/api.php?' + new URLSearchParams({
    action: 'wbsearchentities', search: name, language: 'en', uselang: 'en',
    type: 'item', format: 'json', origin: '*', limit: '5',
  });
  const j = await jsonFetch(u);
  return (j?.search || []).map(s => ({ id: s.id, label: s.label, description: s.description || '' }));
}

// Q-id'ы «это учебное заведение». Без этой проверки поиск отдаёт спортклубы,
// студсоюзы и библиотеки: auburn-university-at-montgomery → aumathletics.com.
const EDU_QIDS = new Set([
  'Q3918',     // university
  'Q38723',    // higher education institution
  'Q189004',   // college
  'Q9826',     // high school
  'Q2385804',  // educational institution
  'Q4671277',  // academic institution
  'Q875538',   // public university
  'Q902104',   // private university
  'Q1371037',  // technical university
  'Q1244442',  // school building → встречается у кампусов
  'Q3354859',  // collegiate university
  'Q1321960',  // liberal arts college
  'Q4820452',  // business school
  'Q1663017',  // grande école
  'Q7894738',  // university system
  'Q15936437', // research university
  'Q23002054', // private not-for-profit educational institution
]);

// Wikidata: сущность → { site, isEdu }. P31 = «instance of», P856 = «official website».
async function entityFacts(entityId) {
  const u = 'https://www.wikidata.org/w/api.php?' + new URLSearchParams({
    action: 'wbgetclaims', entity: entityId, format: 'json', origin: '*',
  });
  const j = await jsonFetch(u);
  if (!j?.claims) return { site: null, isEdu: false };

  const types = (j.claims.P31 || [])
    .map(c => c?.mainsnak?.datavalue?.value?.id)
    .filter(Boolean);
  const isEdu = types.some(t => EDU_QIDS.has(t));

  let site = null;
  for (const c of j.claims.P856 || []) {
    const v = c?.mainsnak?.datavalue?.value;
    if (typeof v === 'string' && /^https?:\/\//i.test(v)) { site = v; break; }
  }
  return { site, isEdu, types };
}

// Адрес вуза — это корень сайта, а не внутренняя страница.
// library.ualberta.ca/aboutus/health/index.cfm → https://library.ualberta.ca
function toOrigin(url) {
  try { return new URL(url).origin; } catch { return null; }
}

// Проверка: сайт живой И это действительно сайт ЭТОГО вуза.
async function verifySite(url, uniName) {
  let host;
  try { host = new URL(url).hostname; } catch { return { ok: false, reason: 'bad-url' }; }
  if (AGG_DOMAINS.test(host)) return { ok: false, reason: 'aggregator-domain' };

  const html = await textFetch(url);
  if (!html) return { ok: false, reason: 'no-response' };

  const text = html.toLowerCase().replace(/<[^>]+>/g, ' ');
  const need = tokens(uniName);
  if (!need.length) return { ok: false, reason: 'name-not-distinctive' };
  const hits = need.filter(t => text.includes(t) || host.includes(t));
  // Достаточно одного отличительного токена: «adelaide» для University of Adelaide.
  return hits.length >= 1
    ? { ok: true, matched: hits }
    : { ok: false, reason: 'name-not-on-page' };
}

async function processUni(slug) {
  const p = path.join(CATALOG_DIR, `${slug}.json`);
  const u = JSON.parse(await fs.readFile(p, 'utf8'));
  if (resolveOfficialSite(u, [])) return { slug, status: 'already-known' };

  const candidates = await searchEntities(u.name);
  if (!candidates.length) return { slug, name: u.name, status: 'no-wikidata-entity' };

  const nameTokens = tokens(u.name);
  for (const c of candidates) {
    // Сущность должна быть учебным заведением...
    const { site: rawSite, isEdu } = await entityFacts(c.id);
    if (!isEdu || !rawSite) continue;
    // ...и её название — совпадать с нашим хотя бы одним отличительным словом,
    // иначе поиск подсовывает однофамильцев («Auburn Tigers» на запрос Auburn).
    const labelTokens = tokens(c.label);
    if (nameTokens.length && !nameTokens.some(t => labelTokens.includes(t))) continue;

    const site = toOrigin(rawSite);
    if (!site) continue;
    const v = await verifySite(site, u.name);
    if (!v.ok) continue;

    if (!DRY_RUN) {
      u.officialUrl = site;
      u.officialUrlSource = `wikidata:${c.id}`;
      u.officialUrlCheckedAt = TODAY;
      await fs.writeFile(p, JSON.stringify(u, null, 2) + '\n');
    }
    return { slug, name: u.name, status: 'found', site, entity: c.id, matched: v.matched };
  }
  return { slug, name: u.name, status: 'no-verified-site' };
}

// ── main ────────────────────────────────────────────────────────────────────
let files = (await fs.readdir(CATALOG_DIR)).filter(f => f.endsWith('.json'));
if (SLUG_FILTER) files = files.filter(f => f === `${SLUG_FILTER}.json`);

// Работаем только по тем, у кого адреса нет.
const queue = [];
for (const f of files) {
  const u = JSON.parse(await fs.readFile(path.join(CATALOG_DIR, f), 'utf8'));
  if (!resolveOfficialSite(u, [])) queue.push(f.replace('.json', ''));
  if (queue.length >= LIMIT) break;
}
log(`вузов без офсайта в очереди: ${queue.length}${DRY_RUN ? ' (DRY-RUN)' : ''}`);

let idx = 0;
const results = [];
async function worker() {
  while (idx < queue.length) {
    const slug = queue[idx++];
    try { results.push(await processUni(slug)); }
    catch (e) { results.push({ slug, status: 'error', err: e.message }); }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

const found = results.filter(r => r.status === 'found');
const unresolved = results.filter(r => r.status !== 'found' && r.status !== 'already-known');

if (!DRY_RUN) {
  await fs.mkdir(path.dirname(WORKLIST_OUT), { recursive: true });
  await fs.writeFile(WORKLIST_OUT, JSON.stringify({
    generatedAt: new Date().toISOString(),
    note: 'Вузы, для которых официальный сайт не найден или не прошёл проверку. Разбирать вручную.',
    items: unresolved.map(r => ({ slug: r.slug, name: r.name, reason: r.status })),
  }, null, 2) + '\n');
}

console.log(JSON.stringify({
  queued: queue.length,
  found: found.length,
  unresolved: unresolved.length,
  byReason: unresolved.reduce((a, r) => (a[r.status] = (a[r.status] || 0) + 1, a), {}),
  dryRun: DRY_RUN,
}));
if (DRY_RUN) for (const f of found.slice(0, 25)) log(`  ${f.slug} → ${f.site}  [${f.matched.join(',')}]`);
