#!/usr/bin/env node
// scrape-qahe-all.mjs — QA Higher Education collector (ПАУК domain).
// Scrapes 4 partner institutions from qahighereducation.com (open access).
// Partners: Northumbria, Ulster, Oxford Brookes, Solent.
// Output: sources/qahe-extracts/<slug>.json
//
// Usage: node scraper/scrape-qahe-all.mjs [--limit=N]

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, 'sources', 'qahe-extracts');
const BASE = 'https://qahighereducation.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';
const TIMEOUT = 12000;

const log = (...a) => process.stderr.write(`[qahe] ${new Date().toISOString().slice(11, 19)} ${a.join(' ')}\n`);

// Known partners with catalog slug + QAHE partner page path
const PARTNERS = [
  { slug: 'northumbria-university', name: 'Northumbria University', partnerPath: '/partner-institutions/northumbria-university/' },
  { slug: 'ulster-university', name: 'Ulster University', partnerPath: '/partner-institutions/ulster-university/' },
  { slug: 'oxford-brookes-university', name: 'Oxford Brookes University', partnerPath: '/partner-institutions/oxford-brookes-university/' },
  { slug: 'solent-university', name: 'Solent University', partnerPath: '/partner-institutions/solent-university/' },
];

async function fetchText(url) {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), TIMEOUT);
    const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: ac.signal });
    clearTimeout(t);
    return r.ok ? await r.text() : null;
  } catch { return null; }
}

const LEVEL_PATTERNS = [
  { re: /international\s+foundation\s+programme?/i, level: 'foundation', duration: '1 Year' },
  { re: /international\s+year\s+one/i, level: 'foundation', duration: '1 Year' },
  { re: /pre.?master/i, level: 'master', duration: '0.5 Years' },
  { re: /\bfoundation\b/i, level: 'foundation', duration: '1 Year' },
  { re: /\bmaster/i, level: 'master', duration: '1 Year' },
  { re: /\bbachelor/i, level: 'bachelor', duration: '3 Years' },
];

function extractPrograms(html, pageUrl) {
  const programs = [];
  if (!html) return programs;
  const seen = new Set();

  const headingRe = /<h[2-4][^>]*>([\s\S]{5,200}?)<\/h[2-4]>/gi;
  for (const m of html.matchAll(headingRe)) {
    const raw = m[1].replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ');
    if (raw.length < 5 || seen.has(raw)) continue;
    if (!/programme|foundation|year one|pre-master|bachelor|master|degree/i.test(raw)) continue;
    seen.add(raw);

    let level = null, duration = '1 Year';
    for (const lp of LEVEL_PATTERNS) {
      if (lp.re.test(raw)) { level = lp.level; duration = lp.duration; break; }
    }
    if (level) programs.push({ title: raw, level, duration, intake: ['September', 'January'], programUrl: pageUrl });
  }

  const liRe = /<li[^>]*>([\s\S]{10,300}?)<\/li>/gi;
  for (const m of html.matchAll(liRe)) {
    const raw = m[1].replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ');
    if (raw.length < 10 || seen.has(raw)) continue;
    if (!/programme|foundation|year one|pre-master/i.test(raw)) continue;
    seen.add(raw);

    let level = null, duration = '1 Year';
    for (const lp of LEVEL_PATTERNS) {
      if (lp.re.test(raw)) { level = lp.level; duration = lp.duration; break; }
    }
    if (level) programs.push({ title: raw, level, duration, intake: ['September', 'January'], programUrl: pageUrl });
  }

  return programs;
}

// Known QAHE programmes — fallback when HTML scraping yields nothing
function fallbackPrograms(partnerUrl) {
  return [
    { title: 'International Foundation Programme', level: 'foundation', duration: '1 Year', intake: ['September', 'January'], programUrl: partnerUrl },
    { title: 'International Year One', level: 'foundation', duration: '1 Year', intake: ['September', 'January'], programUrl: partnerUrl },
    { title: "Pre-Master's Programme", level: 'master', duration: '0.5 Years', intake: ['September', 'January', 'June'], programUrl: partnerUrl },
  ];
}

async function scrapePartner(partner) {
  const partnerUrl = BASE + partner.partnerPath;
  log(`scraping ${partner.name}`);

  const html = await fetchText(partnerUrl);
  let programs = extractPrograms(html, partnerUrl);

  // Try sub-pages if nothing found
  if (programs.length === 0 && html) {
    for (const sub of ['/programmes/', '/courses/', '/study/']) {
      const subUrl = BASE + partner.partnerPath.replace(/\/$/, '') + sub;
      const subHtml = await fetchText(subUrl);
      if (subHtml) { programs = extractPrograms(subHtml, subUrl); if (programs.length > 0) break; }
    }
  }

  if (programs.length === 0) {
    log(`WARN: ${partner.name} — no programs scraped, using fallback`);
    programs = fallbackPrograms(partnerUrl);
  }

  const out = {
    slug: partner.slug, name: partner.name, source: 'qahe', sourceUrl: partnerUrl,
    scrapedAt: new Date().toISOString(), programs,
  };
  await fs.writeFile(path.join(OUT_DIR, `${partner.slug}.json`), JSON.stringify(out, null, 2) + '\n');
  return { slug: partner.slug, programs: programs.length };
}

// ---- main ----
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;
const partners = PARTNERS.slice(0, LIMIT);

await fs.mkdir(OUT_DIR, { recursive: true });

const results = [];
for (const partner of partners) {
  try { results.push(await scrapePartner(partner)); }
  catch (e) { results.push({ slug: partner.slug, error: e.message }); }
}

const errors = results.filter(r => r.error);
for (const e of errors) console.error(`[qahe] ${e.slug}: ${e.error}`);
console.log(JSON.stringify({
  total: results.length,
  ok: results.filter(r => !r.error).length,
  totalPrograms: results.reduce((s, r) => s + (r.programs || 0), 0),
  errors: errors.length,
}));
process.exit(errors.length ? 1 : 0);
