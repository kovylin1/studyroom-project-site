#!/usr/bin/env node
// Direct partners pipeline: parse CSV → discover officialUrl via DuckDuckGo → scrape programs

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const CSV = path.join(PROJECT_ROOT, 'sources/direct-partners.csv');
const OUT_DIR = path.join(PROJECT_ROOT, 'sources/direct-partners-extracts');
await fs.mkdir(OUT_DIR, { recursive: true });

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0';
const log = (...a) => console.error('[direct]', new Date().toISOString().slice(11,19), ...a);

const NORMALIZE = {
  'SRH, Germany': { name: 'SRH University Heidelberg', country: 'Germany' },
  'Gisma Univ, Germany': { name: 'GISMA University of Applied Sciences', country: 'Germany' },
  'BSBI, Germany': { name: 'Berlin School of Business and Innovation', country: 'Germany' },
  'CIU Cyprus': { name: 'Cyprus International University', country: 'Cyprus' },
  'Final Univ, Cyprus': { name: 'Final International University', country: 'Cyprus' },
  'TSI, Latvia': { name: 'Transport and Telecommunication Institute', country: 'Latvia' },
  'UEM, Poland': { name: 'University of European Management', country: 'Poland' },
  'NY, Prague': { name: 'University of New York in Prague', country: 'Czech Republic' },
  'Wollongong Uni, Dubai': { name: 'University of Wollongong in Dubai', country: 'UAE' },
  'Abu Dhabi Uni, Abu Dhabi': { name: 'Abu Dhabi University', country: 'UAE' },
  'Heriot Watt, Dubai': { name: 'Heriot-Watt University Dubai', country: 'UAE' },
  'GEDU, Dubai (HND)': { name: 'GEDU Global Education', country: 'UAE' },
  'Northland Institute, Dubai': { name: 'Northland Institute', country: 'UAE' },
  'Middlesex Uni, Dubai': { name: 'Middlesex University Dubai', country: 'UAE' },
  'California State Uni of Dominguez Hills, Usa': { name: 'California State University Dominguez Hills', country: 'USA' },
  'Curtis Uni, Dubai': { name: 'Curtin University Dubai', country: 'UAE' },
  'SP Jain unit, Dubai': { name: 'SP Jain School of Global Management Dubai', country: 'UAE' },
  'LAne college, Usa': { name: 'Lane College', country: 'USA' },
  'Webster University, USA': { name: 'Webster University', country: 'USA' },
  'Woosong Univ, South Korea': { name: 'Woosong University', country: 'South Korea' },
  "Xi'an Jiaotong-Liverpool University (XJTLU)": { name: "Xi'an Jiaotong-Liverpool University", country: 'China' },
  'APU, Malaysia': { name: 'Asia Pacific University of Technology and Innovation', country: 'Malaysia' },
  'INTI, MAlaysia': { name: 'INTI International University', country: 'Malaysia' },
  'Aurak unit, Cyprus': { name: 'American University of Ras Al Khaimah', country: 'UAE' },
  'Bilim Univ, Turkey': { name: 'Istanbul Bilim University', country: 'Turkey' },
  'Beykent unit, Turkey': { name: 'Beykent University', country: 'Turkey' },
  'BSB Univ, France': { name: 'Burgundy School of Business', country: 'France' },
  'KArelia University, Finland': { name: 'Karelia University of Applied Sciences', country: 'Finland' },
  'METU, Hungary': { name: 'Milton Friedman University', country: 'Hungary' },
  'Amity University, Dubai': { name: 'Amity University Dubai', country: 'UAE' },
  'Domes Academy Italy': { name: 'Domus Academy', country: 'Italy' },
  'IBS, Hungary': { name: 'International Business School Budapest', country: 'Hungary' },
  'Modul University,Vienna': { name: 'MODUL University Vienna', country: 'Austria' },
  'NY University Czeck Republic': { name: 'University of New York in Prague', country: 'Czech Republic' },
  'Anglo-American university, Czeck Republic': { name: 'Anglo-American University', country: 'Czech Republic' },
};

function slugify(s) {
  return (s||'').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70);
}

async function fetchOk(url, timeoutMs=10000) {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    const r = await fetch(url, { headers: {'User-Agent':UA}, signal: ac.signal, redirect: 'follow' });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.text();
  } catch { return null; }
}

async function discoverOfficialUrl(name, country) {
  const q = encodeURIComponent(`${name} ${country} official site`);
  const url = `https://html.duckduckgo.com/html/?q=${q}`;
  const html = await fetchOk(url, 10000);
  if (!html) return null;
  const $ = cheerio.load(html);
  let found = null;
  $('a.result__url, .result__a').each((_, el) => {
    if (found) return;
    let href = $(el).attr('href') || '';
    const m = href.match(/uddg=([^&]+)/);
    if (m) href = decodeURIComponent(m[1]);
    if (!href.startsWith('http')) return;
    try {
      const u = new URL(href);
      const host = u.hostname.toLowerCase();
      if (/\.(edu|ac\.[a-z]+|edu\.[a-z]+)$/.test(host) || /university|college|institute|academy|school/.test(host)) {
        if (!/wikipedia|wikidata|reddit|youtube|facebook|linkedin/.test(host)) found = u.origin;
      }
    } catch {}
  });
  if (!found) {
    $('a.result__url, .result__a').each((_, el) => {
      if (found) return;
      let href = $(el).attr('href') || '';
      const m = href.match(/uddg=([^&]+)/);
      if (m) href = decodeURIComponent(m[1]);
      try {
        const u = new URL(href);
        if (!/wikipedia|reddit|youtube|facebook|linkedin/.test(u.hostname)) found = u.origin;
      } catch {}
    });
  }
  return found;
}

const PROG_MARKER = /(BSc|BA|BEng|BBA|BS|BCom|BFA|LLB|MSc|MA|MBA|MEng|MRes|MPhil|MArch|MFA|EMBA|LLM|PhD|DPhil|Bachelor|Master|Foundation|Diploma|Certificate|Doctorate|Pathway)/i;
const COURSE_PATH = /\/(course|program(?:me)?|degree|undergraduate|postgraduate|bachelor|master|study|academic)s?(\/|$|-)/i;

async function scrapeUni(siteRoot, uniName) {
  const candidates = new Set();
  const sitemap = await fetchOk(siteRoot + '/sitemap.xml', 8000);
  if (sitemap) {
    [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].forEach(m => {
      if (COURSE_PATH.test(m[1])) candidates.add(m[1]);
    });
  }
  for (const p of ['/courses','/programs','/programmes','/study','/academics','/degrees','/study/courses','/en/programs','/en/courses']) {
    const html = await fetchOk(siteRoot + p, 6000);
    if (!html) continue;
    const $ = cheerio.load(html);
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      try {
        const abs = new URL(href, siteRoot + p).toString();
        if (new URL(abs).origin === siteRoot && COURSE_PATH.test(abs)) candidates.add(abs.split('#')[0]);
      } catch {}
    });
    if (candidates.size > 50) break;
  }
  const programs = [];
  const seenTitles = new Set();
  const list = [...candidates].slice(0, 80);
  for (const url of list) {
    const html = await fetchOk(url, 6000);
    if (!html) continue;
    const $ = cheerio.load(html);
    let title = $('meta[property="og:title"]').attr('content') || $('h1').first().text().trim() || $('title').first().text().trim();
    if (!title) continue;
    title = title.split('|')[0].split(' - ' + uniName)[0].trim().replace(/\s+/g,' ');
    if (title.length < 8 || title.length > 200) continue;
    if (!PROG_MARKER.test(title)) continue;
    const k = title.toLowerCase();
    if (seenTitles.has(k)) continue;
    seenTitles.add(k);
    programs.push({ title, programUrl: url, verified: true });
  }
  return programs;
}

const csv = await fs.readFile(CSV, 'utf8');
const lines = csv.split(/\r?\n/).map(l => l.trim().replace(/^"|"$/g,'').replace(/""/g,'"')).filter(Boolean);
log(`partners to process: ${lines.length}`);

const results = [];
const CONCURRENCY = 3;
let idx = 0;
async function worker() {
  while (idx < lines.length) {
    const i = idx++;
    const raw = lines[i];
    const norm = NORMALIZE[raw] || { name: raw.split(',')[0].trim(), country: (raw.split(',')[1]||'').trim() };
    const slug = slugify(norm.name);
    process.stderr.write(`[direct] ${i+1}/${lines.length} ${slug}\n`);
    try {
      const officialUrl = await discoverOfficialUrl(norm.name, norm.country);
      if (!officialUrl) {
        results.push({ slug, raw, ...norm, officialUrl: null, programs: [], status: 'no-url' });
        await fs.writeFile(path.join(OUT_DIR, slug + '.json'), JSON.stringify({ slug, ...norm, raw, status: 'no-url' }, null, 2));
        continue;
      }
      const programs = await scrapeUni(officialUrl, norm.name);
      const data = {
        slug, name: norm.name, country: norm.country, city: '',
        officialUrl, sourceUrl: officialUrl,
        programs, partnerTier: 'direct',
        scrapedAt: new Date().toISOString(),
      };
      results.push({ ...data, status: programs.length ? 'ok' : 'no-progs' });
      await fs.writeFile(path.join(OUT_DIR, slug + '.json'), JSON.stringify(data, null, 2));
      process.stderr.write(`  → ${officialUrl} | ${programs.length} progs\n`);
    } catch (e) {
      results.push({ slug, raw, ...norm, error: e.message, status: 'error' });
    }
  }
}
await Promise.all(Array.from({length: CONCURRENCY}, () => worker()));

const okCount = results.filter(r => r.status === 'ok').length;
const totalProgs = results.reduce((a,b) => a + (b.programs?.length||0), 0);
log(`DONE: ok=${okCount}/${results.length}, totalPrograms=${totalProgs}`);
console.log(JSON.stringify({ total: results.length, ok: okCount, totalProgs }, null, 2));
