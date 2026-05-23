#!/usr/bin/env node
// Playwright-based program expansion for SPA university sites.
// Same verified-write logic as expand-programs-verified.mjs but uses
// a real headless browser so JS-rendered course catalogs become visible.
//
// Usage: node scraper/expand-programs-playwright.mjs <slug> [<slug>...]
//        node scraper/expand-programs-playwright.mjs --file=sources/audit-targets.txt

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const UNI_DIR = path.join(PROJECT_ROOT, 'site/src/content/universities');

const INDEX_PATHS = [
  '/courses', '/courses/undergraduate', '/courses/postgraduate',
  '/programs', '/programmes', '/study', '/study/courses',
  '/study/undergraduate', '/study/postgraduate', '/study/course-search',
  '/academics', '/academics/programs', '/degrees',
  '/en/study', '/en/courses', '/en/programmes',
];

const PROG_MARKERS = /\b(BSc|BA|BEng|BBA|BS|BCom|BFA|BMus|LLB|MSc|MA|MBA|MEng|MRes|MPhil|MArch|MFA|MComm|EMBA|LLM|MD|BDS|BVSc|PhD|DPhil|Bachelor|Master|Foundation|Diploma|Certificate)\b/i;
const COURSE_URL_PATTERN = /\/(course|program(?:me)?|degree|undergraduate|postgraduate|bachelor|master)s?(\/|$|-)/i;
const AGGREGATOR_DOMAINS = ['kaplanpathways.com','navitas.com','topuniversities.com','oxfordinternational.com','catsglobalschools.com','catsadmissions.com'];
const GENERIC_REJECT = /^(Course|Programmes?|Courses|Master('?s)?|Bachelor('?s)?|PhD( Projects?( \d{4})?)?|Diploma|Undergraduate|Postgraduate|Study|Apply|Search|Find|Home)\b\s*$/i;
const INFO_PAGE_REJECT = /\b(Qu['’]?est-?ce que|What is|Why study|Why choose|Why a|Pourquoi|Les débouchés|Career prospects|definition|FAQ)\b/i;

const TARGET_TOTAL = 35;

function cleanTitle(raw, uniName){
  if (!raw) return null;
  let t = raw.split('|')[0].split(' — University')[0].split(' - University')[0].split(' at ')[0].trim();
  if (uniName) {
    const esc = uniName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    t = t.replace(new RegExp('\\s*[-|—]\\s*' + esc + '\\s*$','i'),'').trim();
  }
  t = t.replace(/\s*[-–—]\s*$/,'').replace(/\s+/g,' ').replace(/^Course[:\s]+/i,'').trim();
  if (t.length < 8 || t.length > 200) return null;
  if (GENERIC_REJECT.test(t)) return null;
  if (INFO_PAGE_REJECT.test(t)) return null;
  if (!PROG_MARKERS.test(t)) return null;
  return t;
}

function extractTitle(html, uniName){
  if (!html) return null;
  const $ = cheerio.load(html);
  const cands = [
    $('meta[property="og:title"]').attr('content'),
    $('h1').first().text().trim(),
    $('title').first().text().trim(),
  ].filter(Boolean);
  for (const c of cands) { const t = cleanTitle(c, uniName); if (t) return t; }
  return null;
}

function inferLevel(title){
  const t = title.toLowerCase();
  if (/\b(phd|dphil)\b/.test(t)) return 'phd';
  if (/\b(msc|mba|emba|meng|mres|mphil|llm|march|mfa|mcomm)\b/.test(t) || /\bmaster\b/.test(t) || /^ma\s/.test(t) || /\sma\s/.test(t)) return 'master';
  if (/\b(foundation|pathway|access)\b/.test(t)) return 'foundation';
  if (/\b(diploma|certificate)\b/.test(t)) return 'short-course';
  return 'bachelor';
}
function inferDuration(level, title){
  if (level === 'master') return /\bpart.time\b/i.test(title) ? 2 : 1;
  if (level === 'phd') return 3;
  if (level === 'foundation' || level === 'short-course') return 1;
  return 3;
}
function inferType(title){
  if (/\b(foundation|pathway|access)\b/i.test(title)) return 'pathway';
  return 'degree';
}
function makeSlug(uniSlug, title){
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,70).replace(/^-+|-+$/g,'');
  return `${uniSlug}-${base}`;
}

async function findRealSiteRoot(uni){
  const candidateUrls = [uni.officialUrl, uni.sourceUrl, ...(uni.programs||[]).map(p=>p.programUrl).filter(Boolean)];
  for (const u of candidateUrls) {
    if (!u) continue;
    try {
      const origin = new URL(u).origin;
      if (AGGREGATOR_DOMAINS.some(d => origin.includes(d))) continue;
      return origin;
    } catch { continue; }
  }
  return null;
}

async function pageGet(page, url, timeoutMs=20000){
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    if (!resp || !resp.ok()) return null;
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(()=>{});
    return await page.content();
  } catch { return null; }
}

async function processUni(browser, slug){
  const filePath = path.join(UNI_DIR, slug + '.json');
  let raw;
  try { raw = await fs.readFile(filePath, 'utf8'); } catch { return { slug, status: 'fail-no-file' }; }
  const uni = JSON.parse(raw);
  if ((uni.programs?.length||0) >= 30) return { slug, status: 'skip-already-30', count: uni.programs.length };

  const siteRoot = await findRealSiteRoot(uni);
  if (!siteRoot) return { slug, status: 'fail-no-real-site' };

  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0', javaScriptEnabled: true });
  const page = await ctx.newPage();

  try {
    const candidates = new Set();
    for (const ipath of INDEX_PATHS) {
      const html = await pageGet(page, siteRoot + ipath);
      if (!html) continue;
      const $ = cheerio.load(html);
      $('a[href]').each((_,el)=>{
        const href = $(el).attr('href');
        if (!href) return;
        let abs; try { abs = new URL(href, siteRoot + ipath).toString(); } catch { return; }
        if (new URL(abs).origin !== siteRoot) return;
        if (COURSE_URL_PATTERN.test(abs)) candidates.add(abs.split('#')[0]);
      });
      if (candidates.size >= 80) break;
    }
    if (candidates.size === 0) return { slug, status: 'fail-no-candidates', siteRoot };

    const existingSlugs = new Set((uni.programs||[]).map(p=>p.slug));
    const existingTitles = new Set((uni.programs||[]).map(p=>(p.title||'').toLowerCase()));
    const verified = [];
    const need = TARGET_TOTAL - (uni.programs?.length||0);
    const cand = [...candidates].slice(0, Math.min(80, need*3));

    for (const url of cand) {
      if (verified.length >= need) break;
      const html = await pageGet(page, url, 12000);
      const title = extractTitle(html, uni.name);
      if (!title) continue;
      if (existingTitles.has(title.toLowerCase())) continue;
      const slugCand = makeSlug(slug, title);
      if (existingSlugs.has(slugCand)) continue;
      existingSlugs.add(slugCand); existingTitles.add(title.toLowerCase());
      const level = inferLevel(title);
      verified.push({
        slug: slugCand, title,
        durationYears: inferDuration(level, title),
        level, programType: inferType(title),
        intakes: ['September'], programUrl: url,
        language: uni.language || 'en', verified: true,
      });
    }

    if (verified.length === 0) return { slug, status: 'fail-no-titles', candidates: candidates.size, siteRoot };
    uni.programs.push(...verified);
    await fs.writeFile(filePath, JSON.stringify(uni, null, 2) + '\n');
    return { slug, status: 'expanded', added: verified.length, total: uni.programs.length, siteRoot };
  } finally {
    await page.close().catch(()=>{});
    await ctx.close().catch(()=>{});
  }
}

const args = process.argv.slice(2);
let slugs = [];
const fileArg = args.find(a => a.startsWith('--file='));
if (fileArg) {
  const f = fileArg.split('=')[1];
  slugs = (await fs.readFile(path.resolve(PROJECT_ROOT, f), 'utf8')).split(/\r?\n/).filter(Boolean);
} else {
  slugs = args;
}
if (!slugs.length) { console.error('usage: <slug> [<slug>...] OR --file=path'); process.exit(1); }

const browser = await chromium.launch({ headless: true });
const CONCURRENCY = 3;
const results = [];
let idx = 0;
async function worker(){
  while (idx < slugs.length) {
    const i = idx++;
    const slug = slugs[i];
    process.stderr.write(`[${i+1}/${slugs.length}] ${slug}\n`);
    try {
      const r = await processUni(browser, slug);
      results.push(r);
      process.stderr.write(`  → ${r.status}${r.added?` +${r.added}=${r.total}`:''}${r.candidates?` (cands=${r.candidates})`:''}\n`);
    } catch (e) {
      results.push({ slug, status: 'error', error: e.message });
      process.stderr.write('  → error: '+e.message+'\n');
    }
  }
}
await Promise.all(Array.from({length: CONCURRENCY}, () => worker()));
await browser.close();
const summary = {
  expanded: results.filter(r=>r.status==='expanded').length,
  skipped30: results.filter(r=>r.status==='skip-already-30').length,
  failNoSite: results.filter(r=>r.status==='fail-no-real-site').length,
  failNoCandidates: results.filter(r=>r.status==='fail-no-candidates').length,
  failNoTitles: results.filter(r=>r.status==='fail-no-titles').length,
  errors: results.filter(r=>r.status==='error').length,
  total: results.length,
};
console.error('---SUMMARY--- '+JSON.stringify(summary));
console.log(JSON.stringify(results, null, 2));
