#!/usr/bin/env node
// МУХА v4 — completeness: harvest ALL cards across all 4 regions of search.studygroup.com

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

const log = (...a) => console.error('[mukha4]', new Date().toISOString().slice(11,19), ...a);

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

try {
  await doLogin(page);
  const regions = ['UK and Europe', 'North America', 'Bellerbys Global', 'South East Asia', null];
  const allCourses = new Map();

  for (let r = 0; r < regions.length; r++) {
    const region = regions[r];
    log(`=== Region: ${region || 'ALL via Escape'} ===`);
    await page.goto(PORTAL + '/s/course-search', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(()=>{});
    await page.waitForTimeout(10000);
    try {
      if (region) await page.getByText(region, { exact: false }).first().click({ force: true, timeout: 5000 });
      else await page.keyboard.press('Escape');
    } catch { await page.keyboard.press('Escape'); }
    await page.waitForTimeout(7000);

    let courseFrame = page.frames().find(f => f.url().includes('search.studygroup.com'));
    if (!courseFrame) { log('no iframe for region '+region); continue; }

    let pageNum = 1;
    const MAX_PAGES = 30;
    let saturated = 0;
    while (pageNum <= MAX_PAGES) {
      await page.waitForTimeout(4500);
      const items = await courseFrame.evaluate(() => {
        const collected = [];
        const seen = new WeakSet();
        const walk = (root, depth=0) => {
          if (!root || depth > 8) return;
          const els = root.querySelectorAll ? root.querySelectorAll('*') : [];
          els.forEach(el => {
            if (seen.has(el)) return;
            const innerText = (el.innerText||'').trim();
            if (innerText.length < 30 || innerText.length > 2000) { if (el.shadowRoot) walk(el.shadowRoot, depth+1); return; }
            if (!/Programme type/i.test(innerText)) { if (el.shadowRoot) walk(el.shadowRoot, depth+1); return; }
            const childMatches = Array.from(el.children||[]).filter(c => /Programme type/i.test((c.innerText||'').trim()));
            if (childMatches.length > 1) { if (el.shadowRoot) walk(el.shadowRoot, depth+1); return; }
            seen.add(el);
            collected.push({ rawText: innerText, depth });
          });
        };
        walk(document, 0);
        return collected;
      });
      let added = 0;
      for (const it of items) {
        const lines = it.rawText.split('\n').map(s=>s.trim()).filter(Boolean);
        const title = lines[0] || '';
        const uniLine = lines.find(l => /university|college|institute|school/i.test(l) && l.length < 120 && !/programme type|location|next intake/i.test(l)) || '';
        const ptLine = lines.find(l => /^Programme type/i.test(l)) || '';
        const locLine = lines.find(l => /^Location/i.test(l)) || '';
        const intLine = lines.find(l => /^Next intake/i.test(l) || /^Start date/i.test(l)) || '';
        const programmeType = ptLine.replace(/^Programme type:?\s*/i, '').trim();
        const location = locLine.replace(/^Location:?\s*/i, '').trim();
        const intake = intLine.replace(/^(Next intake|Start date):?\s*/i, '').trim();
        if (!title || title.length < 5 || /^course results/i.test(title)) continue;
        if (!uniLine) continue;
        const key = (title + '|' + uniLine).toLowerCase();
        if (allCourses.has(key)) continue;
        allCourses.set(key, { title, uniName: uniLine, programmeType, location, intake });
        added++;
      }
      log(`  page ${pageNum}: ${items.length} cards, ${added} new (total ${allCourses.size})`);
      if (added === 0) { saturated++; if (saturated >= 2) break; } else saturated = 0;
      const advanced = await courseFrame.evaluate(() => {
        const cands = Array.from(document.querySelectorAll('button, a, lightning-button')).filter(el => {
          const t = (el.innerText||'').trim().toLowerCase();
          const al = (el.getAttribute('aria-label')||'').toLowerCase();
          return /^next$/i.test(t) || al.includes('next page') || /^\s*[›→]\s*$/.test(t);
        });
        const nb = cands.find(el => !el.disabled && el.getAttribute('aria-disabled') !== 'true');
        if (nb) { nb.click(); return true; }
        window.scrollTo(0, document.body.scrollHeight);
        return false;
      });
      if (!advanced && saturated >= 2) break;
      pageNum++;
    }
  }
  log(`harvested ${allCourses.size} unique courses`);

  const byUni = new Map();
  for (const c of allCourses.values()) {
    const slug = slugify(c.uniName);
    if (!slug) continue;
    if (!byUni.has(slug)) byUni.set(slug, { slug, name: c.uniName, sourceUrl: PORTAL, programs: [], scrapedAt: new Date().toISOString() });
    byUni.get(slug).programs.push({
      title: c.title,
      programmeType: c.programmeType,
      location: c.location,
      intake: c.intake,
    });
  }
  log(`unique unis: ${byUni.size}`);
  for (const u of byUni.values()) {
    await fs.writeFile(path.join(OUT_DIR, u.slug + '.json'), JSON.stringify(u, null, 2));
  }
  log(`SUMMARY: courses=${allCourses.size}, unis=${byUni.size}`);
  console.log(JSON.stringify({ courses: allCourses.size, unis: byUni.size }));
} catch (e) {
  log('FATAL:', e.message);
  try { await page.screenshot({ path: path.join(OUT_DIR, '_fatal-v4.png'), fullPage: true }); } catch {}
  process.exit(2);
} finally {
  await browser.close();
}
