#!/usr/bin/env node
// QS partner auto-discovery via Appian B2B portal.
// Phase 1 — exploration: login, screenshot, dump nav structure, identify partners table.
// Phase 2 (TODO once selectors known) — scrape full partner list, diff against qs-targets.json.
//
// Usage: QS_LOGIN=... QS_PASS=... node scraper/discover-qs-partners.mjs [--headed]

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(PROJECT_ROOT, 'sources', 'edvoy-discovery');

const PORTAL_URL = 'https://edge.edvoy.com/';
const LOGIN = process.env.EDVOY_LOGIN;
const PASS = process.env.EDVOY_PASS;

if (!LOGIN || !PASS) {
  console.error('ERROR: set EDVOY_LOGIN and EDVOY_PASS env vars');
  process.exit(1);
}

const headed = process.argv.includes('--headed');
await fs.mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: !headed });
const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
  viewport: { width: 1440, height: 900 },
});
const page = await ctx.newPage();

const log = (...a) => console.error('[qs]', ...a);

try {
  log('navigating to', PORTAL_URL);
  await page.goto(PORTAL_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(()=>{});
  await page.screenshot({ path: path.join(OUT_DIR, '00-landing.png'), fullPage: true });

  // Click Login button if it's a landing page (Edvoy pattern)
  const loginClicked = await page.evaluate(() => {
    const cands = Array.from(document.querySelectorAll('a, button')).filter(el => {
      const t = (el.innerText||'').trim().toLowerCase();
      return t === 'login' || t === 'log in' || t === 'sign in';
    });
    if (cands.length) { cands[0].click(); return cands[0].innerText; }
    return null;
  });
  log('login button clicked:', loginClicked);
  if (loginClicked) {
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(()=>{});
    await page.waitForTimeout(2000);
  }
  await page.screenshot({ path: path.join(OUT_DIR, '01-login-page.png'), fullPage: true });
  log('screenshot saved: 01-login-page.png at URL', page.url());

  const findSel = (selectors) => page.evaluate(arr => { for (const s of arr) if (document.querySelector(s)) return s; return null; }, selectors);
  const emailSel = await findSel(['input[type=email]','input[name="username"]','input[name="email"]','input[id*=email i]','input[placeholder*=email i]','input[placeholder*=user i]']);
  if (!emailSel) {
    await fs.writeFile(path.join(OUT_DIR, '01-login-page.html'), await page.content());
    log('FATAL: no email field'); process.exit(2);
  }
  log('step 1: fill email, click Continue');
  await page.fill(emailSel, LOGIN);
  await page.waitForTimeout(500);
  // Click Continue button (Edvoy 2-step flow)
  try { await page.click('button:has-text("Continue")', { timeout: 5000 }); }
  catch { await page.press(emailSel, 'Enter'); }
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUT_DIR, '01b-after-email.png'), fullPage: true });

  const passSel = await findSel(['input[type=password]','input[name="password"]','input[name="pass"]','input[id*=pass i]']);
  if (!passSel) {
    await fs.writeFile(path.join(OUT_DIR, '01b-after-email.html'), await page.content());
    log('FATAL: no password field after Continue'); process.exit(2);
  }
  log('step 2: fill password, click Sign in');
  await page.fill(passSel, PASS);
  await page.waitForTimeout(500);
  try { await page.click('button:has-text("Sign in"), button:has-text("Log in"), button:has-text("Login"), button[type=submit]', { timeout: 5000 }); }
  catch { await page.press(passSel, 'Enter'); }
  const submitClicked = true;

  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(()=>log('networkidle timeout'));
  // Wait for either URL change OR modal dismiss (login flow done)
  try {
    await page.waitForFunction(() => {
      const m = document.querySelector('input[type=password]');
      return !m || m.offsetParent === null;
    }, { timeout: 25000 });
  } catch { log('still on login modal after 25s'); }
  await page.waitForTimeout(5000);
  await page.screenshot({ path: path.join(OUT_DIR, '02-post-login.png'), fullPage: true });
  log('screenshot saved: 02-post-login.png');
  await fs.writeFile(path.join(OUT_DIR, '02-post-login.url.txt'), page.url());
  log('post-login URL:', page.url());

  const has2fa = await page.evaluate(() => {
    const t = document.body.innerText.toLowerCase();
    return /(two.factor|verification code|otp|enter code|sent.*code)/i.test(t);
  });
  const hasError = await page.evaluate(() => {
    const t = document.body.innerText.toLowerCase();
    return /(invalid|incorrect|wrong password|failed|error)/i.test(t);
  });
  log('2FA detected:', has2fa, '| login error:', hasError);

  if (has2fa) {
    log('2FA required — cannot proceed unattended. See screenshot 02-post-login.png');
    await fs.writeFile(path.join(OUT_DIR, '02-post-login.html'), await page.content());
    process.exit(3);
  }
  if (hasError) {
    log('login failed (credential rejected?)');
    await fs.writeFile(path.join(OUT_DIR, '02-post-login.html'), await page.content());
    process.exit(4);
  }

  const nav = await page.evaluate(() => {
    const items = [];
    document.querySelectorAll('a, button').forEach(el => {
      const t = (el.innerText||'').trim();
      const h = el.getAttribute('href') || el.getAttribute('data-href') || '';
      if (t && t.length < 80) items.push({ text: t, href: h, tag: el.tagName });
    });
    const seen = new Set();
    return items.filter(i => { const k=i.text+i.href; if(seen.has(k))return false; seen.add(k); return true; }).slice(0, 200);
  });
  await fs.writeFile(path.join(OUT_DIR, '02-nav-dump.json'), JSON.stringify(nav, null, 2));
  log('nav dumped:', nav.length, 'items → 02-nav-dump.json');

  const partnerHits = nav.filter(n => /(partner|institution|university|college|catalog|directory|list)/i.test(n.text + ' ' + n.href));
  log('partner-related nav items:', partnerHits.length);
  partnerHits.slice(0,15).forEach(h => log('  ·', h.text, '→', h.href));

  // PHASE 2: navigate to /search (Courses catalog) and dump structure
  log('PHASE 2: navigating to courses catalog');
  await page.goto('https://edge.edvoy.com/search', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(()=>{});
  await page.waitForTimeout(5000);
  await page.screenshot({ path: path.join(OUT_DIR, '03-search.png'), fullPage: true });
  await fs.writeFile(path.join(OUT_DIR, '03-search.url.txt'), page.url());
  log('search page URL:', page.url());

  // Find university-related elements: filter dropdowns, facets, sidebar, name list
  const searchPageStruct = await page.evaluate(() => {
    // Distinct text on page that looks like uni names (capitalized phrases)
    const allText = document.body.innerText.split('\n').map(s=>s.trim()).filter(Boolean);
    const uniHints = allText.filter(t => /university|college|institute|school/i.test(t) && t.length < 100 && t.length > 5);
    // count of result items if they have data-* attributes
    const cardCands = ['[class*=card i]','[class*=result i]','[class*=item i]','[class*=university i]','[class*=institut i]','[class*=college i]','article','li'].map(s => ({sel: s, count: document.querySelectorAll(s).length})).filter(x=>x.count>0).slice(0,30);
    // form controls
    const inputs = Array.from(document.querySelectorAll('input,select')).map(el => ({type: el.type||el.tagName, name: el.name, id: el.id, placeholder: el.placeholder})).filter(x => x.type !== 'hidden').slice(0, 20);
    return { uniHints: uniHints.slice(0,40), cardCands, inputs };
  });
  await fs.writeFile(path.join(OUT_DIR, '03-search-struct.json'), JSON.stringify(searchPageStruct, null, 2));
  log('search struct dumped. uniHints:', searchPageStruct.uniHints.length, 'card candidates:', searchPageStruct.cardCands.length);
  searchPageStruct.uniHints.slice(0,10).forEach(h => log('  hint:', h));
  log('PHASE 2 COMPLETE — review 03-search.png + 03-search-struct.json');

  // PHASE 3: switch to Institutions tab and paginate
  log('PHASE 3: switching to Institutions tab');
  try { await page.click('text=/Institutions/', { timeout: 10000 }); }
  catch { log('could not click Institutions tab'); }
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(OUT_DIR, '04-institutions.png'), fullPage: true });

  const allInstitutions = new Set();
  let pageNum = 1;
  const MAX_PAGES = 50;
  while (pageNum <= MAX_PAGES) {
    await page.waitForTimeout(2000);
    const onPage = await page.evaluate(() => {
      const out = new Set();
      document.querySelectorAll('*').forEach(el => {
        const t = (el.innerText||'').trim();
        if (!t || t.length > 120) return;
        // Match common uni name patterns
        if (/^(University of [A-Z][\w &'-]+|[A-Z][\w &'-]+ University|[A-Z][\w &'-]+ College|[A-Z][\w &'-]+ Institute)$/i.test(t)) {
          if (el.children.length === 0) out.add(t);
        }
      });
      return [...out];
    });
    onPage.forEach(n => allInstitutions.add(n));
    log(`  page ${pageNum}: collected ${onPage.length} (total unique: ${allInstitutions.size})`);
    // Try next page button
    const advanced = await page.evaluate(() => {
      const cands = Array.from(document.querySelectorAll('button, a')).filter(el => {
        const t = (el.innerText||'').trim().toLowerCase();
        const al = (el.getAttribute('aria-label')||'').toLowerCase();
        return t === 'next' || al.includes('next') || /[›→]/.test(t);
      });
      const nb = cands.find(el => !el.disabled && el.getAttribute('aria-disabled') !== 'true');
      if (nb) { nb.click(); return true; }
      return false;
    });
    if (!advanced) { log('  no next button — pagination end'); break; }
    pageNum++;
  }
  await fs.writeFile(path.join(OUT_DIR, '05-institutions-list.json'), JSON.stringify([...allInstitutions].sort(), null, 2));
  log('PHASE 3 COMPLETE — total institutions scraped:', allInstitutions.size);
} catch (e) {
  log('FATAL exception:', e.message);
  try { await page.screenshot({ path: path.join(OUT_DIR, 'fatal.png'), fullPage: true }); } catch {}
  process.exit(10);
} finally {
  await browser.close();
}
