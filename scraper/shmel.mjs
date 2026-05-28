#!/usr/bin/env node
// shmel.mjs — ШМЕЛЬ official-site verifier (ПАУК domain). Supersedes revizor.mjs.
// Reads sources/shmel-worklist.json → fetches each uni's official site →
// checks programUrl liveness + discovers programs via heuristics →
// writes sources/official-extracts/<slug>.json (verifiedBySite=true for confirmed programs).
// Usage: node scraper/shmel.mjs [--limit=N] [--slug=<uni>] [--concurrency=N]

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_DIR = path.join(__dirname, '..', 'site', 'src', 'content', 'universities');
const WORKLIST_FILE = path.join(__dirname, 'sources', 'shmel-worklist.json');
const OUT_DIR = path.join(__dirname, 'sources', 'official-extracts');

const arg = (prefix) => (process.argv.find(a => a.startsWith(prefix)) || '').slice(prefix.length);
const LIMIT = parseInt(arg('--limit=') || 'Infinity', 10);
const SLUG_FILTER = arg('--slug=') || null;
const CONCURRENCY = parseInt(arg('--concurrency=') || '4', 10);

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';
const FETCH_TIMEOUT = 9000;

const PROG_MARKERS = /\b(BSc|BA|BEng|BBA|BCom|BFA|BMus|LLB|MSc|MA|MBA|MEng|MRes|MPhil|MArch|MFA|LLM|PhD|DPhil|Bachelor|Master|Foundation|Diploma|Doctorate|International\s+Year\s+One|International\s+Foundation|Pre-Master|A-Level)\b/gi;
const PROG_LINK_PATTERN = /\b(course|programme|program|study|undergraduate|postgraduate|masters|bachelor|foundation|diploma|degrees?|study-options|what-we-offer)\b/i;

const log = (...a) => process.stderr.write(`[shmel] ${new Date().toISOString().slice(11, 19)} ${a.join(' ')}\n`);

async function fetchPage(url, timeoutMs = FETCH_TIMEOUT) {
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: ac.signal, redirect: 'follow' });
    clearTimeout(timer);
    return { status: r.status, ok: r.ok, finalUrl: r.url, html: r.ok ? await r.text() : '' };
  } catch (e) {
    return { status: 0, ok: false, finalUrl: url, html: '', err: e.message };
  }
}

function normalize(s) {
  return (s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractSameHostLinks(html, baseUrl) {
  const base = (() => { try { return new URL(baseUrl); } catch { return null; } })();
  if (!base) return [];
  const links = new Set();
  for (const m of html.matchAll(/href=["']([^"'#?][^"']*?)["']/gi)) {
    try {
      const u = new URL(m[1], base);
      if (u.hostname === base.hostname && u.pathname.length > 2) links.add(u.href);
    } catch { /* skip */ }
  }
  return [...links];
}

function filterProgramLinks(links) {
  return links.filter(l => {
    try { return PROG_LINK_PATTERN.test(new URL(l).pathname); } catch { return false; }
  }).slice(0, 6);
}

function extractProgramTitles(html) {
  const titles = new Set();
  for (const m of html.matchAll(/<h[1-4][^>]*>([\s\S]{8,150}?)<\/h[1-4]>/gi)) {
    const t = m[1].replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ');
    if (t.length >= 8 && PROG_MARKERS.test(t)) titles.add(t);
  }
  for (const m of html.matchAll(/<li[^>]*>([\s\S]{8,150}?)<\/li>/gi)) {
    const t = m[1].replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ');
    if (t.length >= 8 && !t.includes('<') && PROG_MARKERS.test(t)) titles.add(t);
  }
  PROG_MARKERS.lastIndex = 0;
  return [...titles].slice(0, 40);
}

function guessLevel(title) {
  const t = title.toLowerCase();
  if (/\b(phd|doctorate|dphil|doctor of philosophy)\b/.test(t)) return 'phd';
  if (/\b(msc|mba|meng|mres|mphil|march|mfa|llm|pre-master|pre master|master)\b/.test(t)) return 'master';
  if (/\b(bsc|ba\b|beng|bba|bcom|bfa|bmus|llb|bachelor)\b/.test(t)) return 'bachelor';
  if (/\b(international foundation|international year one|foundation|year one|pre-degree)\b/.test(t)) return 'foundation';
  if (/\b(sixth form|a-level|a level)\b/.test(t)) return 'sixth-form';
  if (/\b(high school)\b/.test(t)) return 'high-school';
  if (/\b(english language|esol|ielts prep)\b/.test(t)) return 'english-language';
  if (/\b(diploma|certificate|short course)\b/.test(t)) return 'short-course';
  return null;
}

async function processUni(slug) {
  const catalogPath = path.join(CATALOG_DIR, `${slug}.json`);
  let catalog;
  try { catalog = JSON.parse(await fs.readFile(catalogPath, 'utf8')); }
  catch { return { slug, status: 'no-catalog' }; }

  const sourceUrl = catalog.sourceUrl;
  if (!sourceUrl) return { slug, status: 'no-sourceUrl' };
  log(`verifying ${slug}`);

  const mainPage = await fetchPage(sourceUrl);
  if (!mainPage.ok) return { slug, status: 'dead', httpStatus: mainPage.status };

  // Link liveness: sample up to 5 programUrls
  const withUrl = (catalog.programs || []).filter(p => p.programUrl).slice(0, 5);
  const linkResults = await Promise.all(withUrl.map(async p => {
    const r = await fetchPage(p.programUrl, 6000);
    return { title: p.title, url: p.programUrl, live: r.ok, status: r.status };
  }));
  const liveCt = linkResults.filter(c => c.live).length;
  const deadCt = linkResults.filter(c => !c.live).length;

  // Discover programs from main page + sub-pages
  const allLinks = extractSameHostLinks(mainPage.html, mainPage.finalUrl || sourceUrl);
  const progLinks = filterProgramLinks(allLinks);
  const rawTitles = new Set(extractProgramTitles(mainPage.html));
  for (const link of progLinks) {
    const sub = await fetchPage(link, 7000);
    if (sub.ok) extractProgramTitles(sub.html).forEach(t => rawTitles.add(t));
  }

  // Match against catalog programs by dedup key
  const catalogByKey = new Map(
    (catalog.programs || []).map(p => [`${normalize(p.title)}|${(p.level || '').toLowerCase()}`, p]),
  );

  const today = new Date().toISOString().slice(0, 10);
  const verifiedPrograms = [];
  const newPrograms = [];

  for (const title of rawTitles) {
    const level = guessLevel(title);
    if (!level) continue;
    const key = `${normalize(title)}|${level}`;
    if (catalogByKey.has(key)) {
      const p = catalogByKey.get(key);
      verifiedPrograms.push({
        slug: p.slug, title, level, verifiedBySite: true, source: 'official', checkedAt: today,
        ...(p.programUrl ? { programUrl: p.programUrl } : {}),
      });
    } else {
      newPrograms.push({ title, level, verifiedBySite: true, source: 'official', checkedAt: today });
    }
  }

  const extract = {
    slug, name: catalog.name, source: 'official', sourceUrl,
    scrapedAt: new Date().toISOString(),
    linkCheck: { checked: linkResults.length, live: liveCt, dead: deadCt, details: linkResults.filter(c => !c.live) },
    programs: [...verifiedPrograms, ...newPrograms],
  };

  await fs.writeFile(path.join(OUT_DIR, `${slug}.json`), JSON.stringify(extract, null, 2) + '\n');
  return { slug, status: 'ok', progPagesChecked: progLinks.length + 1, titlesFound: rawTitles.size, verified: verifiedPrograms.length, newFound: newPrograms.length, linkCheck: { live: liveCt, dead: deadCt } };
}

// ---- main ----
await fs.mkdir(OUT_DIR, { recursive: true });

let worklist;
if (SLUG_FILTER) {
  worklist = [{ slug: SLUG_FILTER }];
} else {
  try {
    const wl = JSON.parse(await fs.readFile(WORKLIST_FILE, 'utf8'));
    worklist = wl.items || [];
  } catch {
    const files = (await fs.readdir(CATALOG_DIR)).filter(f => f.endsWith('.json'));
    worklist = files.map(f => ({ slug: f.replace('.json', '') }));
    log('no worklist — running on full catalog');
  }
}

if (isFinite(LIMIT)) worklist = worklist.slice(0, LIMIT);
log(`processing ${worklist.length} unis (concurrency=${CONCURRENCY})`);

let idx = 0;
const results = [];
async function worker() {
  while (idx < worklist.length) {
    const item = worklist[idx++];
    try { results.push(await processUni(item.slug)); }
    catch (e) { results.push({ slug: item.slug, status: 'error', err: e.message }); }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

const stats = {
  total: results.length,
  ok: results.filter(r => r.status === 'ok').length,
  dead: results.filter(r => r.status === 'dead').length,
  errors: results.filter(r => r.status === 'error').length,
  totalVerified: results.reduce((s, r) => s + (r.verified || 0), 0),
  totalNewFound: results.reduce((s, r) => s + (r.newFound || 0), 0),
  totalDeadLinks: results.reduce((s, r) => s + (r.linkCheck?.dead || 0), 0),
};
console.log(JSON.stringify(stats));
