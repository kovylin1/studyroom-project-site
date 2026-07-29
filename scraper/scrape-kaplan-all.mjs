#!/usr/bin/env node
// scrape-kaplan-all.mjs — Kaplan Pathways collector (ПАУК domain).
// Порт founding TS-коллектора (scraper/src/cli.ts + kaplan-feed.ts) на .mjs
// под merge-пайплайн. Источник: каждая страница degree-finder встраивает всю
// базу Kaplan как JS-литерал `degree_finder_object = {...};` — один fetch = вся
// база (институты + программы с ценой/валютой/интейками). Playwright НЕ нужен.
// Детерминированно, $0.
//
// Output: sources/kaplan-extracts/<catalog-slug>.json (формат как gedu + feePerYear/currency).
// Usage: node scraper/scrape-kaplan-all.mjs [--limit=N]

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// --out=<путь> — куда писать выгрузку. По умолчанию прежнее место (его использует CI).
// КОМПАС (сессия 2) гоняет тот же коллектор в свою песочницу, чтобы не трогать
// committed-выгрузки: --out=../sources/kompas/extracts/kaplan
const outArg = process.argv.find(a => a.startsWith('--out='));
const OUT_DIR = outArg
  ? path.resolve(__dirname, outArg.slice('--out='.length))
  : path.join(__dirname, 'sources', 'kaplan-extracts');
const CATALOG_DIR = path.join(__dirname, '..', 'site', 'src', 'content', 'universities');
const FEED_PAGE = 'https://www.kaplanpathways.com/degree-finder/';
const UA = 'StudyRoom-Scraper/0.3 (+https://studyroom.kz)';

const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;
const log = (...a) => process.stderr.write(`[kaplan] ${new Date().toISOString().slice(11, 19)} ${a.join(' ')}\n`);

// ---- feed fetch + parse (порт kaplan-feed.ts fetchKaplanFeed) ----
async function fetchKaplanFeed() {
  const r = await fetch(FEED_PAGE, { headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' } });
  if (!r.ok) throw new Error(`Fetch ${FEED_PAGE} returned HTTP ${r.status}`);
  const html = await r.text();
  const m = html.match(/degree_finder_object\s*=\s*(\{[\s\S]+?\});/);
  if (!m) throw new Error('degree_finder_object not found in ' + FEED_PAGE);
  const decoded = m[1].split('\\/').join('/');
  const obj = JSON.parse(decoded);
  const data = obj.degrees?.data;
  if (!data) throw new Error('degree_finder_object.degrees.data missing');
  return {
    institutions: data.institutions ?? [],
    degrees: data.degrees ?? [],
  };
}

// ---- порт мапперов kaplan-feed.ts ----
function mapDegreeLevel(degree) {
  const name = (degree.program_name ?? '').toLowerCase();
  if (/\bphd\b|doctoral/.test(name)) return 'phd';
  if (/\bmsc\b|\bms\b|\bma\b|\bmba\b|\bmeng\b|\bmfa\b|\bmph\b|\bllm\b|master/.test(name)) return 'master';
  if (/\bbsc\b|\bbs\b|\bbse\b|\bba\b|\bbfa\b|\bbsn\b|\bbis\b|\bbeng\b|\bllb\b|bachelor|undergraduate/.test(name)) return 'bachelor';
  if (/foundation|pathway/.test(name)) return 'foundation';
  const lvl = degree.program_level;
  if (lvl === 150) return 'master';
  if (lvl === 30) return 'phd';
  if (lvl === 20) return 'bachelor';
  return 'master';
}

function parseIntakes(intakeStr) {
  if (!intakeStr) return [];
  return String(intakeStr).split(/[,;]/).map(s => s.trim()).filter(Boolean);
}

// ---- матчинг института фида → слаг каталога (порт matchUniversity, реверс) ----
function normalizeForMatch(s) {
  return (s || '').toLowerCase().replace(/[‘’'`]/g, '').replace(/[,.]/g, ' ').replace(/\s+/g, ' ').trim();
}

function nameTokens(name) {
  return normalizeForMatch(name)
    .replace(/\buniversity of\b/g, '').replace(/\buniversity\b/g, '')
    .split(/\s+/).map(t => t.trim()).filter(t => t.length >= 3);
}

function slugify(s) {
  return (s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Читаем каталог: индекс normName → slug для матчинга.
async function buildCatalogIndex() {
  const files = await fs.readdir(CATALOG_DIR);
  const entries = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    try {
      const c = JSON.parse(await fs.readFile(path.join(CATALOG_DIR, f), 'utf8'));
      entries.push({ slug: c.slug || f.replace(/\.json$/, ''), normName: normalizeForMatch(c.name || '') });
    } catch { /* пропускаем битый файл */ }
  }
  return entries;
}

// Институт фида → слаг каталога. Degree-granting институты Kaplan названы как
// колледжи («University of Glasgow International College»), поэтому матчим как
// оригинальный cli.ts: все токены ИМЕНИ ВУЗА КАТАЛОГА должны содержаться в имени
// института фида. Из кандидатов выбираем самого специфичного (макс. токенов) —
// «glasgow» матчит, «glasgow caledonian» нет (нет «caledonian» в имени института).
// Возвращаем null, если совпадения нет (вуза нет в каталоге — extract не нужен;
// несколько кампусов одного вуза, напр. ASU, схлопываются в один слаг выше).
function matchCatalogSlug(instName, catalog) {
  const instNorm = normalizeForMatch(instName);
  let best = null, bestTokens = 0;
  for (const c of catalog) {
    const tokens = nameTokens(c.normName);
    if (!tokens.length) continue;
    if (tokens.every(t => instNorm.includes(t)) && tokens.length > bestTokens) {
      best = c.slug; bestTokens = tokens.length;
    }
  }
  return best;
}

// ---- main ----
await fs.mkdir(OUT_DIR, { recursive: true });
log('fetching Kaplan global degree-finder feed...');
const feed = await fetchKaplanFeed();
log(`feed: ${feed.institutions.length} institutions, ${feed.degrees.length} degrees`);

const catalog = await buildCatalogIndex();
log(`catalog index: ${catalog.length} unis`);

// degrees по institution_id
const degreesByInst = new Map();
for (const d of feed.degrees) {
  const id = d.university_block?.institution_id;
  if (id == null) continue;
  if (!degreesByInst.has(id)) degreesByInst.set(id, []);
  degreesByInst.get(id).push(d);
}

// Группируем degrees по слагу каталога (несколько институтов/кампусов фида —
// напр. 6 кампусов ASU — схлопываются в один вуз каталога).
const bySlug = new Map(); // slug → { name, degrees[] }
for (const inst of feed.institutions) {
  const degrees = degreesByInst.get(inst.id) || [];
  if (degrees.length === 0) continue; // нет программ в фиде (напр. AU/NZ — отдельные скрейперы)
  const slug = matchCatalogSlug(inst.institution_name, catalog);
  if (!slug) continue; // вуза нет в каталоге — extract не нужен
  if (!bySlug.has(slug)) bySlug.set(slug, { name: inst.institution_name, degrees: [] });
  bySlug.get(slug).degrees.push(...degrees);
}

const slugs = [...bySlug.keys()].slice(0, isFinite(LIMIT) ? LIMIT : bySlug.size);
const results = [];

for (const slug of slugs) {
  const { name, degrees } = bySlug.get(slug);
  const programs = [];
  let currency = null;

  for (const d of degrees) {
    const level = mapDegreeLevel(d);
    const intake = parseIntakes(d.degree_intake_dates);
    const fee = Number.parseFloat(d.current_fees_per_year);
    const prog = {
      title: d.program_name,
      level,
      duration: d.degree_duration || null,
      intake,
      programUrl: (d.program_url && /^https?:\/\//.test(d.program_url)) ? d.program_url : null,
    };
    if (Number.isFinite(fee) && fee > 0) {
      prog.feePerYear = fee;
      if (d.currency_code) {
        prog.currency = d.currency_code;
        if (!currency) currency = d.currency_code;
      }
    }
    programs.push(prog);
  }

  const out = {
    slug,
    name,
    source: 'kaplan',
    sourceUrl: FEED_PAGE,
    scrapedAt: new Date().toISOString(),
    ...(currency ? { currency } : {}),
    programs,
  };
  await fs.writeFile(path.join(OUT_DIR, `${slug}.json`), JSON.stringify(out, null, 2) + '\n');
  results.push({ slug, name, programs: programs.length, withFee: programs.filter(p => p.feePerYear).length });
}

for (const r of results) log(`  ${r.slug} · ${r.programs} programs (${r.withFee} with fee)`);
console.log(JSON.stringify({
  total: results.length,
  totalPrograms: results.reduce((s, r) => s + r.programs, 0),
  totalWithFee: results.reduce((s, r) => s + r.withFee, 0),
}));
process.exit(results.length === 0 ? 1 : 0);
