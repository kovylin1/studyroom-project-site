#!/usr/bin/env node
// Accommodation gap-fill v2: expanded paths + Playwright fallback for SPA sites

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';
import { chromium } from 'playwright';
import { scoreFact, qualityOfResidence, passes, MIN_CONFIDENCE } from './lib/confidence.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const UNI_DIR = path.join(PROJECT_ROOT, 'site/src/content/universities');
const AUDIT_DIR = path.join(PROJECT_ROOT, 'sources/audit');
const TODAY = new Date().toISOString().slice(0, 10);
const auditRejected = []; // резиденции < MIN_CONFIDENCE — в аудит, не в каталог

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0';
const ACCOM_PATHS = [
  '/accommodation','/accommodation/halls','/accommodation/options','/accommodation/uk',
  '/housing','/housing/halls-of-residence','/housing/residences',
  '/halls','/halls-of-residence','/residences','/residence-halls',
  '/student-life/accommodation','/student-life/housing','/student-life/living',
  '/student/accommodation','/student/housing','/student-housing',
  '/living','/living-on-campus','/residential-life','/campus-living',
  '/on-campus-accommodation','/student-residences','/halls-residences',
  '/about/accommodation','/study/accommodation',
];
const AGG = ['kaplanpathways.com','navitas.com','topuniversities.com','oxfordinternational.com','catsglobalschools.com'];
const RES_PATTERN = /(hall|residence|house|tower|court|village|college|apartment|lodge|dorm)/i;
const log = (...a) => console.error('[accom-v2]', new Date().toISOString().slice(11,19), ...a);
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

function harvest(html) {
  if (!html) return [];
  const $ = cheerio.load(html);
  const res = [];
  $('h1, h2, h3, h4').each((_, el) => {
    const t = $(el).text().trim();
    if (!t || t.length < 5 || t.length > 120) return;
    if (!RES_PATTERN.test(t)) return;
    if (/^(accommodation|housing|halls|residences|living)$/i.test(t.trim())) return;
    const next = $(el).nextAll().slice(0, 2).text().trim().slice(0, 250);
    res.push({ name: t, description: next });
  });
  return res;
}

async function scrapeAccomCurl(siteRoot) {
  const out = [];
  const seen = new Set();
  for (const p of ACCOM_PATHS) {
    const html = await fetchOk(siteRoot + p);
    if (!html) continue;
    const items = harvest(html);
    for (const r of items) { const k = r.name.toLowerCase(); if (seen.has(k)) continue; seen.add(k); out.push(r); }
    if (out.length >= 4) break;
  }
  return out;
}

async function scrapeAccomPlaywright(browser, siteRoot) {
  const ctx = await browser.newContext({ userAgent: UA, viewport: {width: 1366, height: 768} });
  const page = await ctx.newPage();
  const out = [];
  const seen = new Set();
  try {
    for (const p of ACCOM_PATHS.slice(0, 8)) {
      try {
        const r = await page.goto(siteRoot + p, { waitUntil: 'domcontentloaded', timeout: 15000 });
        if (!r || !r.ok()) continue;
        await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(()=>{});
        const html = await page.content();
        const items = harvest(html);
        for (const r2 of items) { const k = r2.name.toLowerCase(); if (seen.has(k)) continue; seen.add(k); out.push(r2); }
        if (out.length >= 3) break;
      } catch {}
    }
  } finally {
    await page.close().catch(()=>{});
    await ctx.close().catch(()=>{});
  }
  return out;
}

const browser = await chromium.launch({ headless: true });
let files = (await fs.readdir(UNI_DIR)).filter(f => f.endsWith('.json'));
if (SLUG_FILTER) files = files.filter(f => f === `${SLUG_FILTER}.json`);
else if (isFinite(LIMIT)) files = files.slice(0, LIMIT);
log(`scanning ${files.length} unis`);
let processed = 0, added = 0;
const CONCURRENCY = 4;
let idx = 0;
async function worker() {
  while (idx < files.length) {
    const i = idx++;
    const f = files[i];
    try {
      const p = path.join(UNI_DIR, f);
      const u = JSON.parse(await fs.readFile(p, 'utf8'));
      // схема и сайт ждут accommodation как МАССИВ; поддерживаем и легаси-форму {residences}
      const existing = Array.isArray(u.accommodation) ? u.accommodation : (u.accommodation?.residences || []);
      if (existing.length >= 3) { processed++; continue; }
      const siteRoot = findRealSite(u);
      if (!siteRoot) { processed++; continue; }
      let residences = await scrapeAccomCurl(siteRoot);
      if (residences.length < 2) {
        const fromPw = await scrapeAccomPlaywright(browser, siteRoot);
        const seen = new Set(residences.map(r => r.name.toLowerCase()));
        for (const r of fromPw) if (!seen.has(r.name.toLowerCase())) residences.push(r);
      }
      if (residences.length > 0) {
        const existNames = new Set(existing.map(r => (r.name||'').toLowerCase()));
        const accepted = [];
        for (const r of residences) {
          const k = r.name.toLowerCase();
          if (existNames.has(k)) continue; existNames.add(k);
          // confidence: официальный сайт вуза + живая страница + качество имени
          const confidence = Math.round(scoreFact({
            sourceTier: 'official', quality: qualityOfResidence(r.name), corroborated: false, linkLive: true,
          }) * 100) / 100;
          if (!passes(confidence)) { auditRejected.push({ slug: u.slug, kind: 'accommodation', name: r.name, confidence }); continue; }
          accepted.push({ name: r.name, text: r.description || '', source: 'official-site', verifiedBySite: true, confidence, checkedAt: TODAY });
        }
        if (accepted.length) {
          u.accommodation = [...existing, ...accepted].slice(0, 10); // МАССИВ
          await fs.writeFile(p, JSON.stringify(u, null, 2) + '\n');
          added += accepted.length;
          process.stderr.write(`[accom-v2] ${u.slug}: +${accepted.length}\n`);
        }
      }
      processed++;
    } catch (e) { process.stderr.write(`[accom-v2] ${f}: err ${e.message}\n`); }
  }
}
await Promise.all(Array.from({length: CONCURRENCY}, () => worker()));
await browser.close();
if (auditRejected.length) {
  await fs.mkdir(AUDIT_DIR, { recursive: true });
  await fs.writeFile(path.join(AUDIT_DIR, 'accommodation-lowconf.json'),
    JSON.stringify({ minConfidence: MIN_CONFIDENCE, generatedAt: TODAY, rejected: auditRejected }, null, 2) + '\n');
}
log(`DONE: processed=${processed} accom-added-total=${added} rejected(<${MIN_CONFIDENCE})=${auditRejected.length}`);
console.log(JSON.stringify({ processed, added, rejected: auditRejected.length }));
