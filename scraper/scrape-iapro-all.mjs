#!/usr/bin/env node
// scrape-iapro-all.mjs — iapro agent portal collector (ПАУК domain).
// Salesforce Experience Cloud; logs in via Playwright, navigates Marketing Hub tab,
// extracts ~11 partner institutions + their programmes.
// Credentials: IAPRO_LOGIN / IAPRO_PASS from .env
// Output: sources/iapro-extracts/<slug>.json
//
// Usage: IAPRO_LOGIN=... IAPRO_PASS=... node scraper/scrape-iapro-all.mjs [--headed] [--limit=N]

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { config } from 'dotenv';

config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '.env') });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, 'sources', 'iapro-extracts');
const LOGIN_URL = 'https://iapro.my.site.com/agentportals/login';
const LOGIN = process.env.IAPRO_LOGIN;
const PASS = process.env.IAPRO_PASS;

if (!LOGIN || !PASS) { console.error('ERROR: set IAPRO_LOGIN and IAPRO_PASS'); process.exit(1); }

const headed = process.argv.includes('--headed');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;

const log = (...a) => process.stderr.write(`[iapro] ${new Date().toISOString().slice(11, 19)} ${a.join(' ')}\n`);

function slugify(s) {
  return (s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function guessLevel(title) {
  const t = title.toLowerCase();
  if (/\b(phd|doctorate)\b/.test(t)) return 'phd';
  if (/\b(msc|mba|meng|master|pre.?master|llm)\b/.test(t)) return 'master';
  if (/\b(bsc|ba\b|beng|bachelor)\b/.test(t)) return 'bachelor';
  if (/\b(foundation|year one|international year|pathway)\b/.test(t)) return 'foundation';
  if (/\b(english language|esol)\b/.test(t)) return 'english-language';
  if (/\b(diploma|certificate)\b/.test(t)) return 'short-course';
  return 'bachelor';
}

async function doLogin(page) {
  log('logging in');
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});

  const emailInput = page.locator('input[type=email], input[name="username"], input[id*="email" i]').first();
  await emailInput.fill(LOGIN);
  await page.waitForTimeout(400);

  const continueBtn = page.locator('button:has-text("Continue"), button:has-text("Next"), button[type=submit]').first();
  if (await continueBtn.count() > 0) await continueBtn.click().catch(() => {});
  await page.waitForTimeout(2000);

  const passInput = page.locator('input[type=password]').first();
  if (await passInput.count() === 0) throw new Error('no password field — 2FA or SSO may be required');
  await passInput.fill(PASS);
  await page.waitForTimeout(400);

  await page.locator('button[type=submit], button:has-text("Sign In"), button:has-text("Log In"), button:has-text("Login")').first().click();
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);

  if (/verification|otp|two.factor|enter code/i.test(await page.content())) {
    throw new Error('2FA triggered — cannot auto-proceed');
  }
  log('logged in:', page.url());
}

async function navigateToMarketingHub(page) {
  const candidates = ['Marketing Hub', 'Marketing', 'Partners', 'Institutions', 'Universities', 'Programmes'];
  for (const text of candidates) {
    const link = page.locator(`a:has-text("${text}"), nav a:has-text("${text}"), [title="${text}"]`).first();
    if (await link.count() > 0) {
      await link.click();
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(2000);
      log(`found tab: ${text}`);
      return true;
    }
  }
  log('WARN: Marketing Hub tab not found — proceeding from current page');
  return false;
}

async function extractPartners(page) {
  const seen = new Set();
  const partners = [];

  // Salesforce LWC renders partner cards — look for institution-like headings with links
  const cards = await page.locator('[class*="card"], [class*="tile"], [class*="institution"], article').all();
  for (const card of cards.slice(0, 50)) {
    const text = (await card.innerText().catch(() => '')).split('\n')[0].trim().replace(/\s+/g, ' ');
    if (!text || text.length < 3 || text.length > 100 || seen.has(text)) continue;
    if (!/university|college|school|institute|pathways|academy|campus/i.test(text)) continue;
    seen.add(text);
    const href = await card.locator('a').first().getAttribute('href').catch(() => null);
    partners.push({ name: text, href });
  }

  // Fallback: scan all links
  if (partners.length === 0) {
    const links = await page.locator('a').all();
    for (const link of links.slice(0, 300)) {
      const text = (await link.innerText().catch(() => '')).trim().replace(/\s+/g, ' ');
      if (!text || text.length < 3 || text.length > 80 || seen.has(text)) continue;
      if (!/university|college|school|institute|pathways|academy/i.test(text)) continue;
      seen.add(text);
      const href = await link.getAttribute('href').catch(() => null);
      partners.push({ name: text, href });
    }
  }

  return partners;
}

async function extractPrograms(page) {
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1500);

  const programs = [];
  const seen = new Set();
  const pageUrl = page.url();

  const elements = await page.locator('h1, h2, h3, h4, [class*="title"], [class*="programme"], [class*="course"], [class*="program"]').all();
  for (const el of elements.slice(0, 300)) {
    const text = (await el.innerText().catch(() => '')).trim().replace(/\s+/g, ' ');
    if (text.length < 5 || text.length > 150 || seen.has(text)) continue;
    if (!/programme|course|bachelor|master|foundation|phd|diploma|degree|year one/i.test(text)) continue;
    seen.add(text);
    programs.push({
      title: text,
      level: guessLevel(text),
      duration: /foundation|year one/i.test(text) ? '1 Year' : null,
      intake: [],
      programUrl: pageUrl,
    });
  }

  return programs;
}

async function processPartner(page, partner, idx) {
  const slug = slugify(partner.name);
  log(`[${idx}] ${partner.name}`);

  let programs = [];
  if (partner.href) {
    try {
      const url = partner.href.startsWith('http') ? partner.href : `https://iapro.my.site.com${partner.href}`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      programs = await extractPrograms(page);
    } catch (e) { log(`WARN: ${partner.name}: ${e.message}`); }
  }

  const out = {
    slug, name: partner.name, source: 'iapro',
    sourceUrl: partner.href || LOGIN_URL,
    scrapedAt: new Date().toISOString(), programs,
  };
  await fs.writeFile(path.join(OUT_DIR, `${slug}.json`), JSON.stringify(out, null, 2) + '\n');
  return { slug, name: partner.name, programs: programs.length };
}

// ---- main ----
await fs.mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: !headed });
const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
  viewport: { width: 1440, height: 900 },
});
const page = await ctx.newPage();

const results = [];
try {
  await doLogin(page);
  await navigateToMarketingHub(page);

  const partners = await extractPartners(page);
  log(`found ${partners.length} partner(s)`);

  const queue = partners.slice(0, isFinite(LIMIT) ? LIMIT : partners.length);
  for (let i = 0; i < queue.length; i++) {
    try {
      results.push(await processPartner(page, queue[i], i + 1));
    } catch (e) {
      log(`ERROR: ${queue[i].name}: ${e.message}`);
      results.push({ slug: slugify(queue[i].name), name: queue[i].name, error: e.message });
    }
  }
} finally {
  await browser.close();
}

const errors = results.filter(r => r.error);
for (const e of errors) console.error(`[iapro] ${e.slug}: ${e.error}`);
console.log(JSON.stringify({
  total: results.length,
  ok: results.filter(r => !r.error).length,
  totalPrograms: results.reduce((s, r) => s + (r.programs || 0), 0),
  errors: errors.length,
}));
process.exit(errors.length && results.filter(r => !r.error).length === 0 ? 1 : 0);
