#!/usr/bin/env node
// Study Group agent portal — Phase 1 discovery
// Login → screenshot → dump nav → identify partner list structure
// Writes to sources/studygroup-discovery/
//
// Usage: SG_LOGIN=... SG_PASS=... node scraper/discover-studygroup.mjs [--headed]

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(PROJECT_ROOT, 'sources', 'studygroup-discovery');

const PORTAL_URL = 'https://agent.studygroup.com/s/';
const LOGIN = process.env.SG_LOGIN;
const PASS = process.env.SG_PASS;
if (!LOGIN || !PASS) { console.error('need SG_LOGIN + SG_PASS'); process.exit(1); }

const headed = process.argv.includes('--headed');
await fs.mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: !headed });
const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
  viewport: { width: 1440, height: 900 },
});
const page = await ctx.newPage();
const log = (...a) => console.error('[sg]', ...a);

const apiCalls = [];
page.on('response', async resp => {
  const url = resp.url();
  if (/api|graphql|json|xhr/i.test(url) && resp.status() < 400) {
    apiCalls.push({ url, status: resp.status(), method: resp.request().method() });
  }
});

try {
  log('navigating to', PORTAL_URL);
  await page.goto(PORTAL_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(()=>{});
  await page.screenshot({ path: path.join(OUT_DIR, '01-landing.png'), fullPage: true });

  const loginBtn = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('a, button')).find(el => /^(login|sign in|log in)$/i.test((el.innerText||'').trim()));
    if (b) { b.click(); return b.innerText; }
    return null;
  });
  log('login button clicked:', loginBtn);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUT_DIR, '02-login-form.png'), fullPage: true });

  const findSel = (arr) => page.evaluate(sels => { for (const s of sels) if (document.querySelector(s)) return s; return null; }, arr);
  const emailSel = await findSel(['input[type=email]','input[name="username"]','input[name="email"]','input[id*=user i]','input[id*=email i]','input[placeholder*=email i]','input[placeholder*=user i]']);
  const passSel = await findSel(['input[type=password]','input[name="password"]','input[id*=pass i]']);
  log('selectors:', { emailSel, passSel });

  if (!emailSel) {
    await fs.writeFile(path.join(OUT_DIR, '02-login-form.html'), await page.content());
    log('FATAL: no email field'); process.exit(2);
  }

  await page.fill(emailSel, LOGIN);
  await page.waitForTimeout(500);

  let twoStep = false;
  if (!passSel) {
    try { await page.click('button:has-text("Continue"), button:has-text("Next")', { timeout: 3000 }); twoStep = true; }
    catch { await page.press(emailSel, 'Enter'); twoStep = true; }
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(OUT_DIR, '02b-after-email.png'), fullPage: true });
    const passSel2 = await findSel(['input[type=password]','input[name="password"]','input[id*=pass i]']);
    if (!passSel2) { await fs.writeFile(path.join(OUT_DIR, '02b-after-email.html'), await page.content()); log('FATAL: no password field'); process.exit(2); }
    await page.fill(passSel2, PASS);
    try { await page.click('button:has-text("Sign in"), button:has-text("Log in"), button:has-text("Login"), button[type=submit]', { timeout: 3000 }); }
    catch { await page.press(passSel2, 'Enter'); }
  } else {
    await page.fill(passSel, PASS);
    try { await page.click('button[type=submit], button:has-text("Sign in"), button:has-text("Log in"), button:has-text("Login")', { timeout: 3000 }); }
    catch { await page.press(passSel, 'Enter'); }
  }
  log('credentials submitted, twoStep=', twoStep);

  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(()=>{});
  await page.waitForFunction(() => !document.querySelector('input[type=password]'), { timeout: 25000 }).catch(()=>{});
  await page.waitForTimeout(5000);

  await page.screenshot({ path: path.join(OUT_DIR, '03-post-login.png'), fullPage: true });
  await fs.writeFile(path.join(OUT_DIR, '03-post-login.url.txt'), page.url());
  log('post-login URL:', page.url());

  const hasError = await page.evaluate(() => {
    const t = (document.body.innerText||'').toLowerCase();
    return /(invalid|incorrect|wrong password|login failed|access denied|please try again)/i.test(t);
  });
  if (hasError) {
    log('LOGIN FAILED — page reports error');
    await fs.writeFile(path.join(OUT_DIR, '03-post-login.html'), await page.content());
    process.exit(3);
  }

  const nav = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('a, button').forEach(el => {
      const t = (el.innerText||'').trim();
      const h = el.getAttribute('href') || '';
      if (t && t.length < 80) out.push({ text: t, href: h });
    });
    const seen = new Set();
    return out.filter(i => { const k=i.text+i.href; if(seen.has(k))return false; seen.add(k); return true; }).slice(0, 300);
  });
  await fs.writeFile(path.join(OUT_DIR, '04-nav.json'), JSON.stringify(nav, null, 2));
  log('nav items:', nav.length);

  const partnerHits = nav.filter(n => /(partner|institution|university|college|centre|center|find|search|browse|catalog|directory)/i.test(n.text + ' ' + n.href));
  log('partner-related:', partnerHits.length);
  partnerHits.slice(0, 30).forEach(h => log('  ·', h.text.replace(/\n/g,' ').slice(0,60), '→', h.href));

  await fs.writeFile(path.join(OUT_DIR, '05-api-calls.json'), JSON.stringify(apiCalls.slice(-100), null, 2));
  log('API calls captured (phase 1):', apiCalls.length);

  // PHASE 2: navigate to course-search
  log('PHASE 2: navigating to /s/course-search');
  apiCalls.length = 0;
  await page.goto('https://agent.studygroup.com/s/course-search', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(()=>{});
  await page.waitForTimeout(6000);
  await page.screenshot({ path: path.join(OUT_DIR, '06-course-search.png'), fullPage: true });
  await fs.writeFile(path.join(OUT_DIR, '06-course-search.url.txt'), page.url());

  const courseStruct = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input, select')).map(el => ({type: el.type||el.tagName, name: el.name, id: el.id, placeholder: el.placeholder, ariaLabel: el.getAttribute('aria-label')||''})).filter(x => x.type !== 'hidden').slice(0, 30);
    const counts = ['li','article','tr','[class*=card i]','[class*=result i]','[class*=row i]','[class*=course i]','[class*=item i]'].map(s => ({sel:s, count:document.querySelectorAll(s).length})).filter(x=>x.count>0).slice(0,20);
    const text = document.body.innerText.split('\n').map(s=>s.trim()).filter(Boolean).slice(0,80);
    const links = Array.from(document.querySelectorAll('a, button')).filter(el => /search|next|browse|filter|find|view/i.test((el.innerText||el.getAttribute('aria-label')||'').trim())).map(el => ({text: (el.innerText||'').trim().slice(0,60), href: el.getAttribute('href')||''})).slice(0, 40);
    return { inputs, counts, text, links };
  });
  await fs.writeFile(path.join(OUT_DIR, '07-course-search-struct.json'), JSON.stringify(courseStruct, null, 2));
  log('course search struct dumped. inputs:', courseStruct.inputs.length, 'card cands:', courseStruct.counts.length, 'text lines:', courseStruct.text.length);
  log('first 10 text lines:');
  courseStruct.text.slice(0, 10).forEach(t => log('  ·', t.slice(0, 100)));
  log('action links:', courseStruct.links.length);
  courseStruct.links.slice(0,10).forEach(l => log('  ·', l.text, '→', l.href));
  await fs.writeFile(path.join(OUT_DIR, '08-course-search-api-calls.json'), JSON.stringify(apiCalls.slice(-100), null, 2));
  log('API calls on course-search:', apiCalls.length);

  log('PHASE 2 DONE');
} catch (e) {
  log('FATAL:', e.message);
  try { await page.screenshot({ path: path.join(OUT_DIR, 'fatal.png'), fullPage: true }); } catch {}
  process.exit(10);
} finally {
  await browser.close();
}
