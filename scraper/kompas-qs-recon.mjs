#!/usr/bin/env node
// kompas-qs-recon.mjs — разведка QS Apply (Appian) под будущий коллектор.
// Логинится, ходит по порталу (HOMEPAGE → APPLICATIONS → создание заявки),
// и пишет на диск ВСЕ JSON-ответы портала + описания экранов + скриншоты.
// Данные каталога не трогает. Выход: sources/kompas/qs-recon/
//
// Запуск: node scraper/kompas-qs-recon.mjs

import fs from 'fs/promises';
import path from 'path';
import { ROOT, logger } from './lib/kompas-collect.mjs';

const log = logger('qs-recon');
const OUT = path.join(ROOT, 'sources', 'kompas', 'qs-recon');
const NET = path.join(OUT, 'net');

async function loadEnv() {
  const raw = await fs.readFile(path.join(ROOT, 'scraper', '.env'), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

async function describe(page) {
  return page.evaluate(() => {
    const vis = (el) => !!(el.offsetParent || el.getClientRects().length);
    return {
      url: location.href,
      title: document.title,
      inputs: [...document.querySelectorAll('input,textarea,select')].filter(vis)
        .map((i) => `${i.tagName.toLowerCase()}:${i.type || ''}|name=${i.name}|id=${i.id}|ph=${i.placeholder || ''}`),
      buttons: [...document.querySelectorAll('button,a[role=button],input[type=submit]')].filter(vis)
        .map((x) => (x.innerText || x.value || '').trim()).filter(Boolean).slice(0, 40),
      links: [...document.querySelectorAll('a[href]')].filter(vis)
        .map((a) => `${(a.innerText || '').trim().slice(0, 40)} -> ${a.getAttribute('href')}`)
        .filter((s) => s.length > 6).slice(0, 40),
      textHead: document.body.innerText.replace(/\s+/g, ' ').slice(0, 600),
    };
  });
}

async function main() {
  await loadEnv();
  await fs.mkdir(NET, { recursive: true });
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Дамп каждого JSON-ответа портала. Имя — порядковый номер; мета внутри файла.
  let n = 0;
  const index = [];
  page.on('response', async (r) => {
    const u = r.url();
    if (!/admissions\.qs\.com\/suite/.test(u)) return;
    const ct = r.headers()['content-type'] || '';
    if (!/json|sail/i.test(ct)) return;
    const id = ++n;
    try {
      const body = await r.text();
      if (!body || body.length < 3) return;
      const f = String(id).padStart(3, '0') + '.json';
      await fs.writeFile(path.join(NET, f), JSON.stringify({ url: u, status: r.status(), method: r.request().method(), postData: r.request().postData()?.slice(0, 4000) || null, body: body.slice(0, 800000) }, null, 1));
      index.push({ f, status: r.status(), method: r.request().method(), url: u.slice(0, 200), size: body.length });
    } catch {}
  });

  const steps = [];
  const snap = async (name) => {
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2500);
    steps.push({ step: name, ...(await describe(page)) });
    await page.screenshot({ path: path.join(OUT, name + '.png') }).catch(() => {});
    log(name);
  };

  try {
    // Вход — тот же флоу, что в kompas-probe-portals (селекторы локатором).
    await page.goto('https://admissions.qs.com/suite/sites/qs-apply', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await snap('01-login');
    const findSel = async (list) => { for (const s of list) { if (await page.locator(s).count().catch(() => 0)) return s; } return null; };
    const userSel = await findSel(['input[type=email]', 'input[id*=user i]', 'input[placeholder*="user" i]', 'input[type=text]']);
    const passSel = await findSel(['input[type=password]']);
    if (!userSel || !passSel) throw new Error('форма входа не опознана');
    await page.locator(userSel).first().fill(process.env.QS_LOGIN);
    await page.locator(passSel).first().fill(process.env.QS_PASS);
    try { await page.locator('button[type=submit], input[type=submit], button:has-text("Sign In")').first().click({ timeout: 6000 }); }
    catch { await page.locator(passSel).first().press('Enter'); }
    await page.waitForTimeout(6000);
    await snap('02-home');

    const body = (await page.evaluate(() => document.body.innerText)).toLowerCase();
    if (/invalid|incorrect/.test(body)) throw new Error('портал отклонил учётные данные');

    // Смотрим, что внутри выпадашки APPLICATIONS.
    await page.locator('button:has-text("APPLICATIONS")').first().click().catch(() => {});
    await page.waitForTimeout(2000);
    await snap('03-menu-open');

    // Деп-линк в новом формате Appian: /page/g.<group>.p.<page>
    for (const [i, stub] of [['04', 'g.students-and-applications.p.institutions'], ['05', 'g.students-and-applications.p.dashboard-B2B-partners']]) {
      await page.goto('https://admissions.qs.com/suite/sites/qs-apply/page/' + stub, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
      await snap(i + '-' + stub);
      const search = page.locator('input[type=text]:visible, input[type=search]:visible').first();
      if (await search.count()) {
        await search.fill('University').catch(() => {});
        await page.waitForTimeout(4000);
        await snap(i + '-search');
      }
    }
  } catch (e) {
    log('ОШИБКА: ' + e.message);
    steps.push({ error: e.message });
    await page.screenshot({ path: path.join(OUT, '99-error.png') }).catch(() => {});
  } finally {
    await fs.writeFile(path.join(OUT, 'steps.json'), JSON.stringify(steps, null, 1));
    await fs.writeFile(path.join(OUT, 'net-index.json'), JSON.stringify(index, null, 1));
    await ctx.close();
    await browser.close();
  }
  log(`ГОТОВО: экранов ${steps.length}, json-ответов ${index.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
