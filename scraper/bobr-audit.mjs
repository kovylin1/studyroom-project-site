#!/usr/bin/env node
// bobr-audit.mjs — БОБР-аудитор достоверности жилья и кампусов.
// Заменяет bobr-verifier.mjs: тот брал за офсайт u.sourceUrl (у 237 вузов там
// edge.edvoy.com) и сверял подстрокой из 15 символов.
//
// Контур скопирован с СОРОКИ: подтверждённое → провенанс в каталог,
// всё спорное → кейсы в site/public/api/bobr-review.json (формат РЕВИЗОРА),
// решения оператора применяет bobr-apply.mjs. Из каталога НИЧЕГО не удаляется,
// содержимое карточек (name/text/price/img) не переписывается.
//
// Usage: node scraper/bobr-audit.mjs [--limit=N] [--slug=<uni>] [--dry-run] [--concurrency=N]

import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveOfficialSite } from './lib/official-site.mjs';
import { matchCard } from './lib/accommodation-match.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const CATALOG_DIR = path.join(PROJECT_ROOT, 'site/src/content/universities');
const SOURCES_DIR = path.join(__dirname, 'sources');
const REVIEW_OUT = path.join(PROJECT_ROOT, 'site/public/api/bobr-review.json');

const arg = (p) => (process.argv.find(a => a.startsWith(p)) || '').slice(p.length);
const LIMIT = parseInt(arg('--limit=') || 'Infinity', 10);
const SLUG_FILTER = arg('--slug=') || null;
const CONCURRENCY = parseInt(arg('--concurrency=') || '4', 10);
const DRY_RUN = process.argv.includes('--dry-run');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';
const NOW = new Date().toISOString();
const TODAY = NOW.slice(0, 10);
const log = (...a) => process.stderr.write(`[БОБР-аудит] ${NOW.slice(11, 19)} ${a.join(' ')}\n`);

const ACCOM_PATHS = ['/accommodation', '/housing', '/halls', '/student-life/accommodation', '/living', '/residences'];
const CAMPUS_PATHS = ['/about/campuses', '/our-campuses', '/campuses', '/locations', '/about/locations', '/campus'];

async function fetchText(url, ms = 9000) {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms);
    const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: ac.signal });
    clearTimeout(t);
    return r.ok ? await r.text() : null;
  } catch { return null; }
}

async function tryPaths(base, paths) {
  for (const p of paths) {
    const html = await fetchText(base + p);
    if (html && html.length > 500) return { html, url: base + p };
  }
  return null;
}

// Выгрузки источников нужны только ради edvoy.website в резолвере офсайта.
const EXTRACT_DIRS = ['edvoy-extracts', 'official-extracts', 'gedu-extracts', 'qahe-extracts', 'kaplan-extracts'];
async function loadExtracts(slug) {
  const out = [];
  for (const dir of EXTRACT_DIRS) {
    const f = path.join(SOURCES_DIR, dir, `${slug}.json`);
    try { out.push({ source: dir.replace('-extracts', ''), data: JSON.parse(await fs.readFile(f, 'utf8')) }); }
    catch { /* нет такого файла — нормально */ }
  }
  return out;
}

const SEVERITY = { 'price-mismatch': 'critical', 'not-found': 'warning', 'price-unconfirmed': 'warning', 'no-official-site': 'warning', 'no-page': 'warning' };

function makeCase({ slug, name, domain, card, verdict, detail, foundPrice, catalogPrice }) {
  return {
    id: `${slug}||bobr_${verdict.replace(/-/g, '_')}||${domain}||${(card && (card.name || card.title) || '').slice(0, 60)}`,
    slug,
    name,
    issue: `bobr_${verdict.replace(/-/g, '_')}`,
    severity: SEVERITY[verdict] || 'warning',
    detail,
    catalog: catalogPrice ?? null,
    official: foundPrice ?? null,
    domain,                       // 'accommodation' | 'campuses'
    card: (card && (card.name || card.title)) || null,
    checkedAt: NOW,
    decision: null,
    decidedAt: null,
    applied: false,
  };
}

async function processUni(slug) {
  const fpath = path.join(CATALOG_DIR, `${slug}.json`);
  const u = JSON.parse(await fs.readFile(fpath, 'utf8'));
  const acc = u.accommodation || [];
  const camp = u.campuses || [];
  if (!acc.length && !camp.length) return { slug, status: 'skip-empty', cases: [] };

  const extracts = await loadExtracts(slug);
  const base = resolveOfficialSite(u, extracts);
  if (!base) {
    return {
      slug, status: 'no-official-site',
      cases: [makeCase({
        slug, name: u.name, domain: 'uni', card: null, verdict: 'no-official-site',
        detail: `Офсайт неизвестен (sourceUrl = ${u.sourceUrl || '—'}), проверить жильё/кампусы не по чему`,
      })],
    };
  }

  const cases = [];
  let confirmed = 0;

  for (const [domain, items, paths] of [['accommodation', acc, ACCOM_PATHS], ['campuses', camp, CAMPUS_PATHS]]) {
    if (!items.length) continue;
    const page = await tryPaths(base, paths);
    if (!page) {
      cases.push(makeCase({
        slug, name: u.name, domain, card: null, verdict: 'no-page',
        detail: `На ${base} не найдена страница ${domain} (пробовали: ${paths.join(', ')})`,
      }));
      continue;
    }
    for (const card of items) {
      // Идемпотентность: уже подтверждённое офсайтом не перепроверяем.
      if (card.verifiedBySite === true) continue;
      const r = matchCard(card, page.html);
      const label = card.name || card.title;
      if (r.verdict === 'confirmed') {
        card.source = page.url;
        card.verifiedBySite = true;
        card.checkedAt = TODAY;
        confirmed++;
      } else {
        const detail = {
          'not-found': `«${label}» не найдено на ${page.url}`,
          'price-unconfirmed': `«${label}» найдено, но цена ${card.price} на странице не подтверждена`,
          'price-mismatch': `«${label}»: в каталоге ${card.price}, на сайте ${r.foundPrice}`,
        }[r.verdict];
        cases.push(makeCase({
          slug, name: u.name, domain, card, verdict: r.verdict, detail,
          foundPrice: r.foundPrice, catalogPrice: r.catalogPrice,
        }));
      }
    }
  }

  if (confirmed > 0 && !DRY_RUN) {
    await fs.writeFile(fpath, JSON.stringify(u, null, 2) + '\n');
  }
  return { slug, status: 'ok', confirmed, cases };
}

// ── main ────────────────────────────────────────────────────────────────────
const files = (await fs.readdir(CATALOG_DIR))
  .filter(f => f.endsWith('.json') && (!SLUG_FILTER || f === `${SLUG_FILTER}.json`));
const queue = isFinite(LIMIT) ? files.slice(0, LIMIT) : files;
log(`обрабатываю ${queue.length} вузов, офсайт-база: ${DRY_RUN ? 'DRY-RUN' : 'запись'}`);

let idx = 0;
const results = [];
async function worker() {
  while (idx < queue.length) {
    const f = queue[idx++];
    try { results.push(await processUni(f.replace('.json', ''))); }
    catch (e) { results.push({ slug: f, status: 'error', err: e.message, cases: [] }); }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

const allCases = results.flatMap(r => r.cases || []);

// Слияние с прошлым review: решения оператора сохраняются, кейсы вне скоупа
// точечного прогона не стираются (тот же приём, что в soroka.mjs).
let existing = { items: [] };
try { if (existsSync(REVIEW_OUT)) existing = JSON.parse(await fs.readFile(REVIEW_OUT, 'utf8')); } catch { /* ignore */ }
const prevById = new Map((existing.items || []).map(it => [it.id, it]));
const pending = allCases.map(c => {
  const prev = prevById.get(c.id);
  return prev && prev.decision !== null
    ? { ...c, decision: prev.decision, decidedAt: prev.decidedAt, applied: prev.applied }
    : c;
});
const scopeSlugs = new Set(queue.map(f => f.replace(/\.json$/, '')));
const kept = (existing.items || []).filter(it => !scopeSlugs.has(it.slug));
const items = [...kept, ...pending];

const stats = {
  unis: results.length,
  confirmed: results.reduce((s, r) => s + (r.confirmed || 0), 0),
  noOfficialSite: results.filter(r => r.status === 'no-official-site').length,
  errors: results.filter(r => r.status === 'error').length,
  cases: items.length,
};

if (!DRY_RUN) {
  await fs.mkdir(path.dirname(REVIEW_OUT), { recursive: true });
  await fs.writeFile(REVIEW_OUT, JSON.stringify({
    generatedAt: NOW,
    scope: SLUG_FILTER || 'all',
    summary: { total: items.length, pending: items.filter(c => c.decision === null).length, autoResolved: 0 },
    items,
  }, null, 2) + '\n');
}

console.log(JSON.stringify(stats));
