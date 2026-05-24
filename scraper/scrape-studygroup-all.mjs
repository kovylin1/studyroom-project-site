#!/usr/bin/env node
// МУХА — Study Group Agent Portal full course scrape
// Login → /s/course-search → dismiss modal → harvest all 183+ courses (paginate)
// Output per uni: sources/studygroup-extracts/{slug}.json
//
// Usage: SG_LOGIN=... SG_PASS=... node scraper/scrape-studygroup-all.mjs

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(PROJECT_ROOT, 'sources/studygroup-extracts');

const PORTAL = 'https://agent.studygroup.com';
const LOGIN_URL = PORTAL + '/s/';
const SEARCH_URL = PORTAL + '/s/course-search';
const LOGIN = process.env.SG_LOGIN;
const PASS = process.env.SG_PASS;
if (!LOGIN || !PASS) { console.error('need SG_LOGIN + SG_PASS'); process.exit(1); }

await fs.mkdir(OUT_DIR, { recursive: true });
const log = (...a) => console.error('[sg]', new Date().toISOString().slice(11,19), ...a);

function makeSlug(s){return (s||'').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/['‘’]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70);}

async function doLogin(page) {
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(()=>{});
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('a, button')).find(el => /^(login|sign in|log in)$/i.test((el.innerText||'').trim()));
    if (b) b.click();
  });
  await page.waitForTimeout(3000);
  await page.waitForSelector('input[type=email]', { timeout: 15000 });
  await page.fill('input[type=email]', LOGIN);
  await page.fill('input[type=password]', PASS);
  await page.click('button[type=submit], button:has-text("Sign in"), button:has-text("Log in"), button:has-text("Login")').catch(()=>page.press('input[type=password]','Enter'));
  await page.waitForFunction(() => !document.querySelector('input[type=password]'), { timeout: 30000 }).catch(()=>{});
  await page.waitForTimeout(5000);
  if (await page.$('input[type=password]')) throw new Error('login failed');
  log('login OK');
}

async function dismissModal(page) {
  await page.waitForTimeout(10000);
  await page.screenshot({ path: path.join(OUT_DIR, '_diag-before-modal-close.png'), fullPage: true });
  let ok = false;
  // Strategy 1: try clicking links via Playwright locator with force
  for (const txt of ['proceed with all courses', 'UK and Europe', 'North America']) {
    try {
      const loc = page.getByText(txt, { exact: false }).first();
      await loc.click({ force: true, timeout: 4000 });
      ok = true; log('modal closed via getByText:', txt); break;
    } catch {}
  }
  if (!ok) {
    // Strategy 2: ESC key
    await page.keyboard.press('Escape');
    log('tried ESC');
    await page.waitForTimeout(2000);
  }
  if (!ok) {
    // Strategy 3: click on overlay/backdrop
    try { await page.locator('.modal-backdrop, [class*="overlay" i], [class*="backdrop" i]').first().click({ timeout: 3000 }); ok = true; log('clicked backdrop'); }
    catch {}
  }
  await page.waitForTimeout(7000);
  await page.screenshot({ path: path.join(OUT_DIR, '_diag-after-modal-close.png'), fullPage: true });
}

async function harvestCourses(page) {
  const allCourses = new Map();
  let pageNum = 1;
  const MAX = 60;
  while (pageNum <= MAX) {
    await page.waitForTimeout(5000);
    // Find the right frame (Salesforce uses Aura iframe → search.studygroup.com iframe)
    const frames = page.frames();
    let targetFrame = page.mainFrame();
    const frameInfo = [];
    for (const f of frames) {
      try {
        const ctx = await f.evaluate(() => {
          // Walk shadow roots to find any text
          const collect = (root, depth=0) => {
            if (depth > 6) return '';
            let s = (root.body ? root.body.innerText : (root.innerText||'')) || '';
            (root.querySelectorAll ? root.querySelectorAll('*') : []).forEach(el => {
              if (el.shadowRoot) s += '\n' + collect(el.shadowRoot, depth+1);
            });
            return s;
          };
          const full = collect(document);
          return { len: full.length, hasProg: /programme\s*type|next\s*intake/i.test(full) };
        }).catch(()=>({len:0,hasProg:false}));
        frameInfo.push({ url: f.url(), bodyLen: ctx.len, hasProg: ctx.hasProg });
        if (ctx.hasProg) { targetFrame = f; }
      } catch {}
    }
    if (pageNum === 1) log('FRAMES:', JSON.stringify(frameInfo));
    const items = await targetFrame.evaluate(() => {
      // Collect full shadow-walked text
      const allTextBlocks = [];
      const collect = (root, depth=0) => {
        if (!root || depth > 8) return;
        const elements = root.querySelectorAll ? root.querySelectorAll('*') : [];
        elements.forEach(el => {
          const text = (el.innerText||'').trim();
          if (text && text.length >= 30 && text.length <= 2500 && /programme\s*type/i.test(text)) {
            const links = Array.from(el.querySelectorAll('a[href]')).map(a => ({ href: a.href, text: (a.innerText||'').trim() }));
            allTextBlocks.push({ rawText: text, links, depth });
          }
          if (el.shadowRoot) collect(el.shadowRoot, depth+1);
        });
      };
      collect(document, 0);
      // Pick the DEEPEST occurrences (most likely individual cards), then dedupe by text
      allTextBlocks.sort((a,b)=>b.depth-a.depth);
      const seen = new Set();
      const out = [];
      for (const block of allTextBlocks) {
        if (seen.has(block.rawText)) continue;
        // If this rawText CONTAINS another already-added block, skip it (we want smaller leaves)
        if (out.some(o => block.rawText.includes(o.rawText) && o.rawText !== block.rawText)) continue;
        seen.add(block.rawText);
        out.push(block);
      }
      return out;
    });
    let added = 0;
    for (const it of items) {
      const lines = it.rawText.split('\n').map(s=>s.trim()).filter(Boolean);
      if (!lines.length) continue;
      const title = lines[0];
      const uniLine = lines.find(l => /university|college|institute|school/i.test(l)) || '';
      const uniMatch = uniLine.match(/([A-Z][A-Za-z &',-]+ (?:University|College|Institute|School)[A-Za-z &',-]*)/);
      const uni = (uniMatch && uniMatch[1]) || uniLine;
      const programmeType = lines.find(l => /(foundation|undergrad|postgrad|premaster|english|pathway|degree|preparation|access)/i.test(l)) || '';
      const location = lines.find(l => /\b(uk|usa|united kingdom|canada|australia|sydney|london|manchester|sheffield|leeds|holloway|new york|boston)\b/i.test(l)) || '';
      const intake = lines.find(l => /january|february|march|april|may|june|july|august|september|october|november|december|\b20\d{2}\b/i.test(l)) || '';
      const link = it.links[0]?.href || '';
      const key = (title + '|' + uni).toLowerCase();
      if (allCourses.has(key)) continue;
      allCourses.set(key, { title, uniName: uni, programmeType, location, intake, courseUrl: link });
      added++;
    }
    log(`  page ${pageNum}: ${items.length} raw, ${added} new (total ${allCourses.size})`);
    const advanced = await targetFrame.evaluate(() => {
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
    if (!advanced && added === 0) { log('  no advance + no new → end'); break; }
    pageNum++;
  }
  return [...allCourses.values()];
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
  viewport: { width: 1440, height: 900 },
});
const page = await ctx.newPage();

try {
  await doLogin(page);
  log('goto course-search');
  await page.goto(SEARCH_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(()=>{});
  await dismissModal(page);
  await page.screenshot({ path: path.join(OUT_DIR, '_diag-after-modal.png'), fullPage: true });

  // Deep diagnostic
  const diag = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    return {
      bodyLen: (document.body.innerText||'').length,
      hasProgrammeType: /programme type/i.test(document.body.innerText||''),
      hasAccounting: /accounting/i.test(document.body.innerText||''),
      iframeCount: document.querySelectorAll('iframe').length,
      iframeSrcs: [...document.querySelectorAll('iframe')].map(f => f.src),
      shadowOpenCount: [...allEls].filter(e => e.shadowRoot).length,
      lwcCount: [...allEls].filter(e => e.tagName.startsWith('LWC-') || e.tagName.startsWith('C-')).length,
      lightningCount: document.querySelectorAll('[class*="lightning-"], [class*="slds-"]').length,
    };
  });
  await fs.writeFile(path.join(OUT_DIR, '_diag-dom.json'), JSON.stringify(diag, null, 2));
  await fs.writeFile(path.join(OUT_DIR, '_diag-html.html'), await page.content());
  log('DOM diag:', JSON.stringify(diag));

  const courses = await harvestCourses(page);
  log('harvested courses:', courses.length);
  await fs.writeFile(path.join(OUT_DIR, '_all-courses.json'), JSON.stringify(courses, null, 2));

  const byUni = new Map();
  for (const c of courses) {
    const slug = makeSlug(c.uniName);
    if (!slug) continue;
    if (!byUni.has(slug)) byUni.set(slug, { slug, name: c.uniName, sourceUrl: PORTAL, programs: [] });
    byUni.get(slug).programs.push({
      title: c.title,
      programmeType: c.programmeType,
      location: c.location,
      intake: c.intake,
      programUrl: c.courseUrl,
    });
  }
  log('unique unis:', byUni.size);
  for (const u of byUni.values()) {
    u.scrapedAt = new Date().toISOString();
    await fs.writeFile(path.join(OUT_DIR, u.slug + '.json'), JSON.stringify(u, null, 2));
  }
  log('SUMMARY: courses=' + courses.length + ' unis=' + byUni.size);
} catch (e) {
  log('FATAL:', e.message);
  try { await page.screenshot({ path: path.join(OUT_DIR, '_fatal.png'), fullPage: true }); } catch {}
  process.exit(2);
} finally {
  await browser.close();
}
