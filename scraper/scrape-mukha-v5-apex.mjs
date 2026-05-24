#!/usr/bin/env node
// МУХА v5 — Apex/API reverse-engineering: record EVERY network on search.studygroup.com iframe

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(PROJECT_ROOT, 'sources/studygroup-extracts');
const NET_LOG = path.join(OUT_DIR, '_v5-network.json');
await fs.mkdir(OUT_DIR, { recursive: true });

const PORTAL = 'https://agent.studygroup.com';
const LOGIN = process.env.SG_LOGIN;
const PASS = process.env.SG_PASS;
if (!LOGIN || !PASS) { console.error('need SG_LOGIN + SG_PASS'); process.exit(1); }

const log = (...a) => console.error('[mukha5]', new Date().toISOString().slice(11,19), ...a);

function slugify(s) {
  return (s||'').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70);
}

async function doLogin(page) {
  await page.goto(PORTAL + '/s/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(()=>{});
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('a,button')).find(el => /^login$/i.test((el.innerText||'').trim()));
    if (b) b.click();
  });
  await page.waitForTimeout(3000);
  await page.waitForSelector('input[type=email]', { timeout: 15000 });
  await page.fill('input[type=email]', LOGIN);
  await page.fill('input[type=password]', PASS);
  await page.click('button[type=submit]').catch(()=>page.press('input[type=password]','Enter'));
  await page.waitForFunction(()=>!document.querySelector('input[type=password]'), { timeout: 30000 }).catch(()=>{});
  await page.waitForTimeout(5000);
  if (await page.$('input[type=password]')) throw new Error('login failed');
  log('login OK');
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 Chrome/120', viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const network = [];
page.on('response', async resp => {
  try {
    const url = resp.url();
    const ct = (resp.headers()['content-type'] || '').toLowerCase();
    if (!/json|javascript|text|xml/i.test(ct)) return;
    if (resp.status() >= 400) return;
    if (/google-analytics|googletagmanager|gtm|osano|sentry|hotjar|recaptcha|fonts\.googleapis/i.test(url)) return;
    let body = '';
    try { body = await resp.text(); } catch { return; }
    if (!body || body.length > 2_000_000) return;
    network.push({
      url, status: resp.status(), ct, method: resp.request().method(),
      bodyLen: body.length, bodyHead: body.slice(0, 600),
      fullBody: /json/i.test(ct) && body.length > 1000 ? body : null,
    });
  } catch {}
});

try {
  await doLogin(page);
  await page.goto(PORTAL + '/s/course-search', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(()=>{});
  await page.waitForTimeout(10000);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(8000);
  log(`captured ${network.length} responses after initial load`);

  for (const region of ['UK and Europe', 'North America', 'Bellerbys Global']) {
    try {
      log(`triggering region: ${region}`);
      await page.goto(PORTAL + '/s/course-search', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(()=>{});
      await page.waitForTimeout(8000);
      await page.getByText(region, { exact: false }).first().click({ force: true, timeout: 5000 });
      await page.waitForTimeout(8000);
      const fr = page.frames().find(f => f.url().includes('search.studygroup.com'));
      if (fr) {
        for (let i = 0; i < 3; i++) {
          await fr.evaluate(() => {
            const next = Array.from(document.querySelectorAll('button,a')).find(el => /^next$/i.test((el.innerText||'').trim().toLowerCase()));
            if (next) next.click();
          });
          await page.waitForTimeout(4000);
        }
      }
    } catch (e) { log(`region ${region} err: ${e.message}`); }
  }
  log(`total captured: ${network.length}`);

  const candidates = network.filter(r => {
    if (!r.fullBody) return false;
    try {
      const parsed = JSON.parse(r.fullBody);
      const findArr = (o, d=0) => {
        if (d > 4 || !o) return null;
        if (Array.isArray(o) && o.length >= 3 && typeof o[0] === 'object' && o[0]) {
          const k = Object.keys(o[0]).join(' ').toLowerCase();
          if (/title|name|course|programme|university|institution/i.test(k)) return o;
        }
        if (typeof o === 'object') for (const v of Object.values(o)) { const r=findArr(v,d+1); if(r)return r; }
        return null;
      };
      const arr = findArr(parsed);
      if (arr) { r.parsedSample = arr.slice(0, 2); r.parsedCount = arr.length; return true; }
    } catch {}
    return false;
  });

  log(`course-array candidates: ${candidates.length}`);
  candidates.forEach(c => log(`  ${c.method} ${c.url.slice(0,100)} → ${c.parsedCount} items`));

  await fs.writeFile(NET_LOG, JSON.stringify(network.map(r => ({
    url: r.url, status: r.status, method: r.method, ct: r.ct, bodyLen: r.bodyLen, bodyHead: r.bodyHead,
  })), null, 2));
  await fs.writeFile(path.join(OUT_DIR, '_v5-candidates.json'), JSON.stringify(candidates.map(c => ({
    url: c.url, method: c.method, count: c.parsedCount, sample: c.parsedSample,
  })), null, 2));

  if (candidates.length === 0) {
    log('NO course endpoints found — see _v5-network.json');
    console.log(JSON.stringify({ totalResponses: network.length, candidates: 0 }));
    process.exit(0);
  }

  const allCourses = [];
  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c.fullBody);
      const findArr = (o, d=0) => {
        if (d > 4 || !o) return null;
        if (Array.isArray(o) && o.length >= 3 && typeof o[0] === 'object' && o[0]) {
          const k = Object.keys(o[0]).join(' ').toLowerCase();
          if (/title|name|course|programme|university|institution/i.test(k)) return o;
        }
        if (typeof o === 'object') for (const v of Object.values(o)) { const r=findArr(v,d+1); if(r)return r; }
        return null;
      };
      const arr = findArr(parsed);
      if (arr) allCourses.push(...arr);
    } catch {}
  }
  const seen = new Set();
  const unique = [];
  for (const c of allCourses) {
    const k = JSON.stringify(c).slice(0,200);
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(c);
  }
  log(`unique course objects from API: ${unique.length}`);
  await fs.writeFile(path.join(OUT_DIR, '_v5-all-courses-api.json'), JSON.stringify(unique, null, 2));

  const byUni = new Map();
  for (const c of unique) {
    const uniName =
      c.universityName || c.university || c.institutionName || c.institution || c.partnerName ||
      c.partner || c.providerName || c.provider || c.brandName || c.school ||
      (typeof c.university === 'object' ? c.university?.name : '') || '';
    if (!uniName || typeof uniName !== 'string') continue;
    const slug = slugify(uniName);
    if (!slug) continue;
    if (!byUni.has(slug)) byUni.set(slug, { slug, name: uniName, sourceUrl: PORTAL, programs: [], scrapedAt: new Date().toISOString() });
    byUni.get(slug).programs.push({
      title: c.courseName || c.name || c.title || c.programmeName || c.program || '',
      level: c.level || c.qualification || c.programmeType || c.type || '',
      duration: c.duration || c.lengthOfStudy || '',
      intake: c.intake || c.startDate || c.intakeMonth || '',
      tuition: c.fee || c.tuition || c.totalFee || c.feePerYear || '',
      location: c.location || c.campus || c.city || '',
    });
  }
  log(`unique unis from API: ${byUni.size}`);
  for (const u of byUni.values()) {
    await fs.writeFile(path.join(OUT_DIR, u.slug + '.json'), JSON.stringify(u, null, 2));
  }
  log(`SUMMARY: courses=${unique.length}, unis=${byUni.size}, candidates=${candidates.length}`);
  console.log(JSON.stringify({ courses: unique.length, unis: byUni.size, candidates: candidates.length }));
} catch (e) {
  log('FATAL:', e.message);
  try { await page.screenshot({ path: path.join(OUT_DIR, '_fatal-v5.png'), fullPage: true }); } catch {}
  process.exit(2);
} finally {
  await browser.close();
}
