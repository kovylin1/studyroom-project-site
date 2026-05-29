#!/usr/bin/env node
// QS partner auto-discovery via Appian B2B portal.
// Phase 1 — exploration: login, screenshot, dump nav structure, identify partners table.
// Phase 2 (TODO once selectors known) — scrape full partner list, diff against qs-targets.json.
//
// Usage: QS_LOGIN=... QS_PASS=... node scraper/discover-qs-partners.mjs [--headed]

import { config } from 'dotenv'; config();
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(PROJECT_ROOT, 'sources', 'qs-discovery');

const QS_LOGIN_URL = 'https://admissions.qs.com/suite/sites/qs-apply';
const LOGIN = process.env.QS_LOGIN;
const PASS = process.env.QS_PASS;

if (!LOGIN || !PASS) {
  console.error('ERROR: set QS_LOGIN and QS_PASS env vars');
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
  log('navigating to', QS_LOGIN_URL);
  await page.goto(QS_LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(()=>{});
  await page.screenshot({ path: path.join(OUT_DIR, '01-login-page.png'), fullPage: true });
  log('screenshot saved: 01-login-page.png');

  const emailSel = await page.evaluate(() => {
    const cands = ['input[type=email]','input[name="username"]','input[name="email"]','input[name="user"]','input[id*=user i]','input[id*=email i]','input[placeholder*=email i]','input[placeholder*=user i]'];
    for (const s of cands) if (document.querySelector(s)) return s;
    return null;
  });
  const passSel = await page.evaluate(() => {
    const cands = ['input[type=password]','input[name="password"]','input[name="pass"]','input[id*=pass i]'];
    for (const s of cands) if (document.querySelector(s)) return s;
    return null;
  });
  log('login field selectors:', { emailSel, passSel });

  if (!emailSel || !passSel) {
    log('FATAL: no login form fields detected — saving page HTML for inspection');
    await fs.writeFile(path.join(OUT_DIR, '01-login-page.html'), await page.content());
    process.exit(2);
  }

  await page.fill(emailSel, LOGIN);
  await page.fill(passSel, PASS);
  log('credentials entered, looking for submit');

  const submitClicked = await page.evaluate(() => {
    const cands = ['button[type=submit]','input[type=submit]','button:has-text("Sign in")','button:has-text("Log in")','button:has-text("Login")'];
    for (const s of cands) {
      const btn = document.querySelector(s);
      if (btn) { btn.click(); return s; }
    }
    return null;
  });
  log('submit clicked:', submitClicked);

  if (!submitClicked) {
    await page.press(passSel, 'Enter');
    log('pressed Enter on password field as fallback');
  }

  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(()=>log('networkidle timeout (may be ok for Appian)'));
  await page.waitForTimeout(3000);
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

  log('PHASE 1 COMPLETE — review sources/qs-discovery/ artifacts to plan phase 2 selectors');
} catch (e) {
  log('FATAL exception:', e.message);
  try { await page.screenshot({ path: path.join(OUT_DIR, 'fatal.png'), fullPage: true }); } catch {}
  process.exit(10);
} finally {
  await browser.close();
}
