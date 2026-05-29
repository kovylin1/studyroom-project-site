#!/usr/bin/env node
// scrape-gedu-all.mjs — GEDU Global collector (ПАУК domain).
// Open-access scraper for gedu.global partner universities.
// NOTE: GEDU site structure not confirmed — heuristic extraction.
//       Review sources/gedu-extracts/ after first run and adjust if needed.
//       If site requires JS rendering, re-run with Playwright (TODO).
// Output: sources/gedu-extracts/<slug>.json
//
// Usage: node scraper/scrape-gedu-all.mjs [--limit=N]

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, 'sources', 'gedu-extracts');
const BASE = 'https://gedu.global';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';
const TIMEOUT = 12000;

const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;
const log = (...a) => process.stderr.write(`[gedu] ${new Date().toISOString().slice(11, 19)} ${a.join(' ')}\n`);

function slugify(s) {
  return (s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function fetchText(url) {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), TIMEOUT);
    const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: ac.signal });
    clearTimeout(t);
    return r.ok ? { html: await r.text(), finalUrl: r.url } : null;
  } catch { return null; }
}

function extractInstitutionLinks(html, baseStr) {
  const base = new URL(baseStr);
  const links = new Map();
  for (const m of html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]{2,80}?)<\/a>/gi)) {
    const name = m[2].replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ');
    if (!name || name.length < 3 || !/university|college|school|institute/i.test(name)) continue;
    try {
      const u = new URL(m[1], base);
      if (u.hostname.includes('gedu')) links.set(u.href, name);
    } catch { /* skip */ }
  }
  return [...links.entries()].map(([href, name]) => ({ href, name }));
}

const PROG_MARKERS = /\b(BSc|BA|BEng|MSc|MA|MBA|MEng|PhD|Bachelor|Master|Foundation|Diploma|International\s+Foundation|Pre-Master)\b/gi;

function guessLevel(title) {
  const t = title.toLowerCase();
  if (/\b(phd|doctorate)\b/.test(t)) return 'phd';
  if (/\b(msc|mba|meng|master|pre.?master)\b/.test(t)) return 'master';
  if (/\b(bsc|ba\b|beng|bachelor)\b/.test(t)) return 'bachelor';
  if (/\b(foundation|year one)\b/.test(t)) return 'foundation';
  if (/\b(english language|esol)\b/.test(t)) return 'english-language';
  if (/\b(diploma|certificate)\b/.test(t)) return 'short-course';
  return null;
}

function extractPrograms(html, pageUrl) {
  const programs = [];
  const seen = new Set();
  PROG_MARKERS.lastIndex = 0;
  for (const m of [...html.matchAll(/<h[1-4][^>]*>([\s\S]{5,200}?)<\/h[1-4]>/gi), ...html.matchAll(/<li[^>]*>([\s\S]{8,200}?)<\/li>/gi)]) {
    const raw = m[1].replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ');
    if (raw.length < 5 || seen.has(raw) || !PROG_MARKERS.test(raw)) continue;
    PROG_MARKERS.lastIndex = 0;
    seen.add(raw);
    const level = guessLevel(raw);
    if (level) programs.push({ title: raw, level, duration: level === 'foundation' ? '1 Year' : null, intake: [], programUrl: pageUrl });
  }
  return programs.slice(0, 50);
}

async function scrapeInstitution(name, url, idx) {
  const slug = slugify(name);
  log(`[${idx}] ${name}`);
  const page = await fetchText(url);
  const programs = page ? extractPrograms(page.html, page.finalUrl || url) : [];
  const out = { slug, name, source: 'gedu', sourceUrl: url, scrapedAt: new Date().toISOString(), programs };
  await fs.writeFile(path.join(OUT_DIR, `${slug}.json`), JSON.stringify(out, null, 2) + '\n');
  return { slug, name, programs: programs.length };
}

async function discoverWithPlaywright() {
  log('fetch failed — trying Playwright');
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  const found = [];
  try {
    for (const sub of ['/', '/universities/', '/partners/', '/institutions/']) {
      try {
        await page.goto(BASE + sub, { waitUntil: 'networkidle', timeout: 20000 });
        const html = await page.content();
        const links = extractInstitutionLinks(html, BASE + sub);
        if (links.length > 0) { found.push(...links); log(`Playwright: ${links.length} links at ${sub}`); break; }
      } catch {}
    }
    // fallback: grab all internal links with education keywords
    if (!found.length) {
      const links = await page.$$eval('a[href]', els =>
        els.map(a => ({ href: a.href, name: a.innerText.trim() }))
          .filter(l => /university|college|institute|school/i.test(l.name) && l.href.includes('gedu'))
      );
      found.push(...links);
      log(`Playwright fallback: ${found.length} keyword links`);
    }
  } finally {
    await browser.close();
  }
  return [...new Map(found.map(l => [l.href, l])).values()];
}

// ---- main ----
await fs.mkdir(OUT_DIR, { recursive: true });
log('discovering GEDU partner institutions');

let institutions = [];
for (const sub of ['/', '/universities/', '/partners/', '/institutions/', '/programmes/']) {
  const page = await fetchText(BASE + sub);
  if (page) {
    const found = extractInstitutionLinks(page.html, BASE + sub);
    if (found.length > 0) { institutions = found; log(`found ${found.length} links at ${sub}`); break; }
  }
}

if (institutions.length === 0) {
  institutions = await discoverWithPlaywright();
}

if (institutions.length === 0) {
  log('WARN: no institutions found even with Playwright');
  console.log(JSON.stringify({ status: 'no-institutions', note: 'gedu.global returned no institution links' }));
  process.exit(0);
}

const queue = institutions.slice(0, isFinite(LIMIT) ? LIMIT : institutions.length);
const results = [];
for (let i = 0; i < queue.length; i++) {
  try { results.push(await scrapeInstitution(queue[i].name, queue[i].href, i + 1)); }
  catch (e) { results.push({ slug: slugify(queue[i].name), error: e.message }); }
}

const errors = results.filter(r => r.error);
for (const e of errors) console.error(`[gedu] ${e.slug}: ${e.error}`);
console.log(JSON.stringify({
  total: results.length, ok: results.filter(r => !r.error).length,
  totalPrograms: results.reduce((s, r) => s + (r.programs || 0), 0), errors: errors.length,
}));
process.exit(errors.length && results.filter(r => !r.error).length === 0 ? 1 : 0);
