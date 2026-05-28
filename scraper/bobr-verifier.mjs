#!/usr/bin/env node
// bobr-verifier.mjs — БОБР verifier. Fetches official campus/accommodation pages,
// marks matching catalog entries with source='official', verifiedBySite=true.
// Usage: node scraper/bobr-verifier.mjs [--limit=N] [--slug=<uni>] [--dry-run]

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_DIR = path.join(__dirname, '..', 'site', 'src', 'content', 'universities');

const arg = (p) => (process.argv.find(a => a.startsWith(p)) || '').slice(p.length);
const LIMIT = parseInt(arg('--limit=') || 'Infinity', 10);
const SLUG_FILTER = arg('--slug=') || null;
const DRY_RUN = process.argv.includes('--dry-run');
const CONCURRENCY = 4;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';
const TODAY = new Date().toISOString().slice(0, 10);
const log = (...a) => process.stderr.write(`[bobr-v] ${new Date().toISOString().slice(11,19)} ${a.join(' ')}\n`);

const ACCOM_PATHS = ['/accommodation','/housing','/halls','/student-life/accommodation','/living','/residences'];
const CAMPUS_PATHS = ['/about/campuses','/our-campuses','/campuses','/locations','/about/locations','/campus'];

async function fetchText(url, ms = 8000) {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms);
    const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: ac.signal });
    clearTimeout(t);
    return r.ok ? await r.text() : null;
  } catch { return null; }
}

function textContains(html, name) {
  const key = (name || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15);
  return key.length > 3 && html ? html.toLowerCase().includes(key) : false;
}

async function tryPaths(base, paths) {
  for (const p of paths) {
    const html = await fetchText(base + p);
    if (html && html.length > 500) return html;
  }
  return null;
}

async function processUni(slug) {
  const fpath = path.join(CATALOG_DIR, `${slug}.json`);
  const u = JSON.parse(await fs.readFile(fpath, 'utf8'));
  const base = (u.sourceUrl || '').replace(/\/$/, '');
  if (!base) return { slug, status: 'no-sourceUrl' };

  const hasAccom = (u.accommodation || []).length > 0;
  const hasCampus = (u.campuses || []).length > 0;
  if (!hasAccom && !hasCampus) return { slug, status: 'skip-empty' };

  let enriched = 0;

  if (hasAccom) {
    const html = await tryPaths(base, ACCOM_PATHS);
    if (html) {
      for (const a of u.accommodation) {
        if (a.verifiedBySite != null) continue;
        a.source = textContains(html, a.name) ? 'official' : 'scraped';
        a.verifiedBySite = a.source === 'official';
        a.checkedAt = TODAY;
        enriched++;
      }
    }
  }

  if (hasCampus) {
    const html = await tryPaths(base, CAMPUS_PATHS);
    if (html) {
      for (const c of u.campuses) {
        if (c.verifiedBySite != null) continue;
        c.source = textContains(html, c.title) ? 'official' : 'scraped';
        c.verifiedBySite = c.source === 'official';
        c.checkedAt = TODAY;
        enriched++;
      }
    }
  }

  if (enriched > 0 && !DRY_RUN) {
    await fs.writeFile(fpath, JSON.stringify(u, null, 2) + '\n');
  }
  return { slug, status: 'ok', enriched };
}

const files = (await fs.readdir(CATALOG_DIR))
  .filter(f => f.endsWith('.json') && (!SLUG_FILTER || f === `${SLUG_FILTER}.json`));
const queue = isFinite(LIMIT) ? files.slice(0, LIMIT) : files;
log(`processing ${queue.length} unis`);

let idx = 0;
const results = [];
async function worker() {
  while (idx < queue.length) {
    const f = queue[idx++];
    try { results.push(await processUni(f.replace('.json', ''))); }
    catch (e) { results.push({ slug: f, status: 'error', err: e.message }); }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

const stats = {
  total: results.length,
  ok: results.filter(r => r.status === 'ok').length,
  totalEnriched: results.reduce((s, r) => s + (r.enriched || 0), 0),
  errors: results.filter(r => r.status === 'error').length,
};
console.log(JSON.stringify(stats));
