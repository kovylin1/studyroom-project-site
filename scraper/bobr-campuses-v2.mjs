#!/usr/bin/env node
// Campuses gap-fill: for unis with <3 campuses, scrape uni sites for campus/location pages

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const UNI_DIR = path.join(PROJECT_ROOT, 'site/src/content/universities');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0';
const CAMPUS_PATHS = [
  '/about/campuses','/about/our-campuses','/about/locations','/about/campus',
  '/our-campuses','/campuses','/locations','/our-locations','/facilities',
  '/student-life/campus','/campus-life','/campus','/visit',
  '/about-us/locations','/about-us/campuses','/our-college/locations',
];
const AGG = ['kaplanpathways.com','navitas.com','topuniversities.com','oxfordinternational.com','catsglobalschools.com'];
const log = (...a) => console.error('[campuses]', new Date().toISOString().slice(11,19), ...a);
const arg = (p) => (process.argv.find(a => a.startsWith(p)) || '').slice(p.length);
const LIMIT = parseInt(arg('--limit=') || 'Infinity', 10);
const SLUG_FILTER = arg('--slug=') || null;

async function fetchOk(url, timeoutMs=8000) {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: ac.signal, redirect: 'follow' });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.text();
  } catch { return null; }
}

function findRealSite(uni) {
  const cands = [uni.officialUrl, uni.sourceUrl, ...(uni.programs||[]).map(p=>p.programUrl).filter(Boolean)];
  for (const u of cands) {
    if (!u) continue;
    try { const o = new URL(u).origin; if (AGG.some(d => o.includes(d))) continue; return o; } catch {}
  }
  return null;
}

async function scrapeCampuses(uni) {
  const have = (uni.campuses||[]).length;
  if (have >= 3) return 0;
  const siteRoot = findRealSite(uni);
  if (!siteRoot) return 0;
  const found = [];
  const seen = new Set((uni.campuses||[]).map(c => (c.title||'').toLowerCase()));
  for (const p of CAMPUS_PATHS) {
    const html = await fetchOk(siteRoot + p);
    if (!html) continue;
    const $ = cheerio.load(html);
    $('h2, h3, h4').each((_, el) => {
      const t = $(el).text().trim();
      if (!t || t.length < 5 || t.length > 100) return;
      if (!/(campus|college|location|building|centre|center|library|park|complex)/i.test(t)) return;
      const k = t.toLowerCase();
      if (seen.has(k)) return; seen.add(k);
      const next = $(el).nextAll().slice(0,2).text().trim().slice(0,300);
      found.push({ title: t, text: next || '', sub: '' });
    });
    if ((have + found.length) >= 5) break;
  }
  if (!found.length) return 0;
  uni.campuses = [...(uni.campuses||[]), ...found.slice(0, 5 - have)];
  return found.length;
}

let files = (await fs.readdir(UNI_DIR)).filter(f => f.endsWith('.json'));
if (SLUG_FILTER) files = files.filter(f => f === `${SLUG_FILTER}.json`);
else if (isFinite(LIMIT)) files = files.slice(0, LIMIT);
log(`scanning ${files.length} unis`);
let processed = 0, added = 0;
const CONCURRENCY = 6;
let idx = 0;
async function worker() {
  while (idx < files.length) {
    const i = idx++;
    const f = files[i];
    try {
      const p = path.join(UNI_DIR, f);
      const u = JSON.parse(await fs.readFile(p, 'utf8'));
      const n = await scrapeCampuses(u);
      if (n > 0) {
        await fs.writeFile(p, JSON.stringify(u, null, 2) + '\n');
        added += n;
        process.stderr.write(`[campuses] ${u.slug}: +${n}\n`);
      }
      processed++;
    } catch (e) { process.stderr.write(`[campuses] ${f}: err ${e.message}\n`); }
  }
}
await Promise.all(Array.from({length: CONCURRENCY}, () => worker()));
log(`DONE: processed=${processed} campuses-added-total=${added}`);
console.log(JSON.stringify({ processed, added }));
