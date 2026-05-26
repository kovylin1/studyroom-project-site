#!/usr/bin/env node
// Deterministic program expansion. No LLM. Only writes verified programs
// (URLs that actually return 200 with a title matching a degree marker).
//
// Usage: node scraper/expand-programs-verified.mjs <slug> [<slug>...]
//        node scraper/expand-programs-verified.mjs --batch=J

import fs from 'fs/promises';
import path from 'path';
import * as cheerio from 'cheerio';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const UNI_DIR = path.join(PROJECT_ROOT, 'site/src/content/universities');
const SOURCES_DIR = path.join(PROJECT_ROOT, 'sources');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const INDEX_PATHS = [
  '/courses', '/courses/undergraduate', '/courses/postgraduate',
  '/programs', '/programmes', '/study', '/study/courses',
  '/study/undergraduate', '/study/postgraduate', '/study/course-search',
  '/academics', '/academics/programs', '/degrees',
  '/en/study', '/en/courses', '/en/programmes', '/en/programs',
];

const PROG_MARKERS = /\b(BSc|BA|BEng|BBA|BS|BCom|BFA|BMus|LLB|MSc|MA|MBA|MEng|MRes|MPhil|MArch|MFA|MComm|EMBA|LLM|MD|BDS|BVSc|PhD|DPhil|Bachelor|Master|Foundation|Diploma|Certificate)\b/i;
const COURSE_URL_PATTERN = /\/(course|program(?:me)?|degree|undergraduate|postgraduate|bachelor|master)s?(\/|$|-)/i;
const AGGREGATOR_DOMAINS = ['kaplanpathways.com','navitas.com','topuniversities.com','oxfordinternational.com','catsglobalschools.com','catsadmissions.com','edvoy.com','collabinternational.com','studygroup.com','wikipedia.org','kingseducation.com','globalbanking.ac.uk'];

// Default 35 preserves prior behavior; set EXPAND_TARGET=1000 to "take everything".
const TARGET_TOTAL = Number(process.env.EXPAND_TARGET) || 35;
// When chasing a high target, allow many more candidate fetches per uni.
const CAND_CAP = TARGET_TOTAL >= 100 ? 800 : 120;
// slug -> official site URL, injected from --worklist=<file> ([{slug, officialUrl}]).
let OFFICIAL_OVERRIDE = {};

async function fetchOk(url, timeoutMs=12000){
  try {
    const ac = new AbortController();
    const t = setTimeout(()=>ac.abort(), timeoutMs);
    const r = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.9' },
      signal: ac.signal, redirect: 'follow',
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const ct = r.headers.get('content-type')||'';
    if (!/text\/html|xml/i.test(ct)) return null;
    return await r.text();
  } catch { return null; }
}

async function getSitemapUrls(siteRoot){
  const tries = ['/sitemap.xml','/sitemap_index.xml','/sitemap-index.xml','/sitemap/sitemap.xml'];
  let urls = [];
  for (const p of tries) {
    const xml = await fetchOk(siteRoot + p);
    if (!xml) continue;
    const sub = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1].trim());
    if (sub.length) {
      const childSitemaps = sub.filter(u => /sitemap.*\.xml/i.test(u) && /(course|program|study|academic)/i.test(u));
      if (childSitemaps.length) {
        for (const cs of childSitemaps.slice(0,3)) {
          const cxml = await fetchOk(cs);
          if (cxml) urls.push(...[...cxml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1].trim()));
        }
      } else {
        urls.push(...sub);
      }
      break;
    }
  }
  if (!urls.length) {
    const robots = await fetchOk(siteRoot + '/robots.txt');
    if (robots) {
      const sm = [...robots.matchAll(/sitemap:\s*(\S+)/gi)].map(m=>m[1].trim());
      for (const url of sm.slice(0,3)) {
        const xml = await fetchOk(url);
        if (xml) urls.push(...[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1].trim()));
      }
    }
  }
  return urls;
}

async function getCandidateUrlsFromIndex(siteRoot){
  const found = new Set();
  for (const ipath of INDEX_PATHS) {
    const html = await fetchOk(siteRoot + ipath);
    if (!html) continue;
    const $ = cheerio.load(html);
    $('a[href]').each((_,el)=>{
      const href = $(el).attr('href');
      if (!href) return;
      let abs;
      try { abs = new URL(href, siteRoot + ipath).toString(); } catch { return; }
      const origin = new URL(abs).origin;
      if (origin !== siteRoot) return;
      if (COURSE_URL_PATTERN.test(abs)) found.add(abs.split('#')[0]);
    });
    if (found.size >= 100) break;
  }
  return [...found];
}

const GENERIC_REJECT = /^(Course|Programmes?|Courses|Master('?s)?|Bachelor('?s)?|PhD( Projects?( \d{4})?)?|Diploma|Undergraduate|Postgraduate|Study|Apply|Search|Find|Home)\b\s*$/i;
const INFO_PAGE_REJECT = /\b(Qu['’]?est-?ce que|What is|Why study|Why choose|Why a|Pourquoi|Les débouchés|Career prospects|definition|FAQ)\b/i;

function cleanTitle(raw, uniName){
  if (!raw) return null;
  let t = raw.split('|')[0].split(' — University')[0].split(' - University')[0].split(' at ')[0].trim();
  // Strip uni-name suffix variants: " - {name}", " | {name}", " — {name}"
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
  for (const c of cands) {
    const t = cleanTitle(c, uniName);
    if (t) return t;
  }
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
  if (level === 'foundation' || level === 'short') return 1;
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

async function processUni(slug){
  const filePath = path.join(UNI_DIR, slug + '.json');
  let raw;
  try { raw = await fs.readFile(filePath, 'utf8'); } catch { return { slug, status: 'fail-no-file' }; }
  const uni = JSON.parse(raw);
  if (OFFICIAL_OVERRIDE[slug]) uni.officialUrl = OFFICIAL_OVERRIDE[slug];
  if ((uni.programs?.length||0) >= TARGET_TOTAL) return { slug, status: 'skip-already-target', count: uni.programs.length };

  const siteRoot = await findRealSiteRoot(uni);
  if (!siteRoot) return { slug, status: 'fail-no-real-site' };

  const candidates = new Set();
  const sitemapUrls = await getSitemapUrls(siteRoot);
  for (const u of sitemapUrls) if (COURSE_URL_PATTERN.test(u)) candidates.add(u.split('#')[0]);
  if (candidates.size < 30) {
    const indexUrls = await getCandidateUrlsFromIndex(siteRoot);
    for (const u of indexUrls) candidates.add(u);
  }
  if (candidates.size === 0) return { slug, status: 'fail-no-candidates', siteRoot };

  const existingSlugs = new Set((uni.programs||[]).map(p=>p.slug));
  const existingTitles = new Set((uni.programs||[]).map(p=>(p.title||'').toLowerCase()));
  const verified = [];
  const need = TARGET_TOTAL - (uni.programs?.length||0);
  const cand = [...candidates].slice(0, Math.min(CAND_CAP, Math.max(need*4, CAND_CAP)));

  for (const url of cand) {
    if (verified.length >= need) break;
    const html = await fetchOk(url, 8000);
    const title = extractTitle(html, uni.name);
    if (!title) continue;
    if (existingTitles.has(title.toLowerCase())) continue;
    const slugCand = makeSlug(slug, title);
    if (existingSlugs.has(slugCand)) continue;
    existingSlugs.add(slugCand);
    existingTitles.add(title.toLowerCase());
    const level = inferLevel(title);
    verified.push({
      slug: slugCand,
      title,
      durationYears: inferDuration(level, title),
      level,
      programType: inferType(title),
      intakes: ['September'],
      programUrl: url,
      language: uni.language || 'en',
      verified: true,
    });
  }

  if (verified.length === 0) return { slug, status: 'fail-no-titles', candidates: candidates.size, siteRoot };

  uni.programs.push(...verified);
  await fs.writeFile(filePath, JSON.stringify(uni, null, 2) + '\n');
  return { slug, status: 'expanded', added: verified.length, total: uni.programs.length, siteRoot };
}

const args = process.argv.slice(2);
let slugs = [];
const batchArg = args.find(a => a.startsWith('--batch='));
const worklistArg = args.find(a => a.startsWith('--worklist='));
if (worklistArg) {
  const wlPath = path.resolve(worklistArg.split('=')[1]);
  const wl = JSON.parse((await fs.readFile(wlPath,'utf8')).replace(/^﻿/,''));
  slugs = wl.map(b => b.slug);
  for (const b of wl) if (b.officialUrl) OFFICIAL_OVERRIDE[b.slug] = b.officialUrl;
} else if (batchArg) {
  const letter = batchArg.split('=')[1];
  const batchPath = path.join(SOURCES_DIR, `expand-batch-${letter}.json`);
  const batch = JSON.parse((await fs.readFile(batchPath,'utf8')).replace(/^﻿/,''));
  slugs = batch.map(b => b.slug);
} else {
  slugs = args;
}
if (!slugs.length) { console.error('usage: <slug> [<slug>...] OR --batch=J OR --worklist=<file.json>'); process.exit(1); }

const CONCURRENCY = 4;
const results = [];
let idx = 0;
async function worker(){
  while (idx < slugs.length) {
    const i = idx++;
    const slug = slugs[i];
    process.stderr.write(`[${i+1}/${slugs.length}] ${slug}... `);
    try {
      const r = await processUni(slug);
      results.push(r);
      process.stderr.write(r.status + (r.added ? ` +${r.added}=${r.total}` : '') + (r.candidates? ` (cands=${r.candidates})`:'') + '\n');
    } catch (e) {
      results.push({ slug, status: 'error', error: e.message });
      process.stderr.write('error: ' + e.message + '\n');
    }
  }
}
await Promise.all(Array.from({length: CONCURRENCY}, () => worker()));
const summary = {
  expanded: results.filter(r=>r.status==='expanded').length,
  skipped30: results.filter(r=>r.status==='skip-already-30').length,
  failNoSite: results.filter(r=>r.status==='fail-no-real-site').length,
  failNoCandidates: results.filter(r=>r.status==='fail-no-candidates').length,
  failNoTitles: results.filter(r=>r.status==='fail-no-titles').length,
  errors: results.filter(r=>r.status==='error').length,
  total: results.length,
};
console.error('---SUMMARY---', JSON.stringify(summary));
console.log(JSON.stringify(results, null, 2));
