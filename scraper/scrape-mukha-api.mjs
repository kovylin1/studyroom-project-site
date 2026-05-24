#!/usr/bin/env node
// МУХА v2 — API capture + scrape Study Group course catalog
// Login → /s/course-search → monitor XHR/fetch on search.studygroup.com iframe
// → identify JSON endpoint → replay with auth cookies → group by uni

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(PROJECT_ROOT, 'sources/studygroup-extracts');
await fs.mkdir(OUT_DIR, { recursive: true });

const PORTAL = 'https://agent.studygroup.com';
const LOGIN = process.env.SG_LOGIN;
const PASS = process.env.SG_PASS;
if (!LOGIN || !PASS) { console.error('need SG_LOGIN + SG_PASS'); process.exit(1); }

const log = (...a) => console.error('[mukha-api]', new Date().toISOString().slice(11,19), ...a);

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
const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 Chrome/120',
  viewport: { width: 1440, height: 900 },
});
const page = await ctx.newPage();

const apiResponses = [];
page.on('response', async resp => {
  const url = resp.url();
  const ct = resp.headers()['content-type'] || '';
  if (!/json/i.test(ct)) return;
  if (resp.status() >= 400) return;
  try {
    const body = await resp.json().catch(()=>null);
    if (!body) return;
    apiResponses.push({ url, status: resp.status(), bodyStr: JSON.stringify(body).slice(0, 100), body });
  } catch {}
});

try {
  await doLogin(page);
  log('navigating to course-search');
  await page.goto(PORTAL + '/s/course-search', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(()=>{});
  await page.waitForTimeout(8000);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(8000);

  log(`captured ${apiResponses.length} JSON responses so far`);
  const frames = page.frames();
  for (const f of frames) {
    if (!f.url().includes('search.studygroup.com')) continue;
    log('triggering pagination in', f.url().slice(0,60));
    for (let i = 0; i < 8; i++) {
      try {
        await f.evaluate(() => {
          const next = Array.from(document.querySelectorAll('button,a')).find(el => /^next$/i.test((el.innerText||'').trim().toLowerCase()) || (el.getAttribute('aria-label')||'').toLowerCase().includes('next'));
          if (next) next.click();
        });
        await page.waitForTimeout(3000);
      } catch {}
    }
  }
  log(`final API responses: ${apiResponses.length}`);

  const courseEndpoints = apiResponses.filter(r => {
    const u = r.url.toLowerCase();
    return u.includes('search.studygroup.com') && (u.includes('course') || u.includes('search') || u.includes('result'));
  });
  log(`course endpoints: ${courseEndpoints.length}`);

  await fs.writeFile(path.join(OUT_DIR, '_api-endpoints.json'), JSON.stringify(apiResponses.map(r => ({url:r.url, status:r.status, sample:r.bodyStr})), null, 2));

  if (courseEndpoints.length === 0) {
    log('NO course endpoints captured — diagnostics saved');
    process.exit(0);
  }

  const best = courseEndpoints.sort((a,b) => JSON.stringify(b.body).length - JSON.stringify(a.body).length)[0];
  log('best endpoint:', best.url);
  await fs.writeFile(path.join(OUT_DIR, '_api-best-sample.json'), JSON.stringify(best.body, null, 2));

  function findCourseArray(obj, depth=0) {
    if (depth > 5 || !obj) return null;
    if (Array.isArray(obj) && obj.length && typeof obj[0] === 'object') {
      const sample = obj[0];
      const keys = Object.keys(sample).join(' ').toLowerCase();
      if (/(name|title|course|programme|university)/i.test(keys)) return obj;
    }
    if (typeof obj === 'object') {
      for (const v of Object.values(obj)) {
        const r = findCourseArray(v, depth+1);
        if (r) return r;
      }
    }
    return null;
  }

  const allCourses = [];
  for (const ep of courseEndpoints) {
    const arr = findCourseArray(ep.body);
    if (arr) allCourses.push(...arr);
  }
  const seen = new Set();
  const unique = [];
  for (const c of allCourses) {
    const k = JSON.stringify(c).slice(0,200);
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(c);
  }
  log(`extracted ${unique.length} unique course objects`);
  await fs.writeFile(path.join(OUT_DIR, '_all-courses-api.json'), JSON.stringify(unique, null, 2));

  const byUni = new Map();
  for (const c of unique) {
    const uniName = c.universityName || c.university || c.institutionName || c.institution || c.partnerName || (typeof c.university === 'object' ? c.university?.name : '') || '';
    if (!uniName || typeof uniName !== 'string') continue;
    const slug = slugify(uniName);
    if (!slug) continue;
    if (!byUni.has(slug)) byUni.set(slug, { slug, name: uniName, sourceUrl: PORTAL, programs: [], scrapedAt: new Date().toISOString() });
    byUni.get(slug).programs.push({
      title: c.courseName || c.name || c.title || '',
      level: c.level || c.programmeType || c.qualification || '',
      duration: c.duration || '',
      intake: c.intake || c.startDate || c.intakes || '',
      tuition: c.fee || c.tuition || c.cost || '',
      location: c.location || c.campus || c.city || '',
    });
  }
  log(`unique unis: ${byUni.size}`);
  for (const u of byUni.values()) {
    await fs.writeFile(path.join(OUT_DIR, u.slug + '.json'), JSON.stringify(u, null, 2));
  }
  log(`SUMMARY: courses=${unique.length}, unis=${byUni.size}`);
  console.log(JSON.stringify({ courses: unique.length, unis: byUni.size, endpoints: courseEndpoints.length }));
} catch (e) {
  log('FATAL:', e.message);
  try { await page.screenshot({ path: path.join(OUT_DIR, '_fatal.png'), fullPage: true }); } catch {}
  process.exit(2);
} finally {
  await browser.close();
}
