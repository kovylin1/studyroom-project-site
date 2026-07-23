#!/usr/bin/env node
// kompas-probe-portals.mjs — КОМПАС, сессия 3. Разведка входа в IAPro и QS.
//
// Ничего не собирает и никуда не пишет данные каталога. Задача одна: войти и ОПИСАТЬ,
// что за разметка внутри, чтобы коллектор писался по факту, а не по догадке. На Edvoy
// догадка уже стоила лишнего захода — там поле почты оказалось input[name=name], а клики
// перехватывал баннер cookies.
//
// Пароли берутся из scraper/.env (в gitignore) и НЕ печатаются.
// Результат: sources/kompas/portal-probe.json + снимки экрана рядом.

import fs from 'fs/promises';
import path from 'path';
import { ROOT, logger } from './lib/kompas-collect.mjs';

const log = logger('probe');
const OUT = path.join(ROOT, 'sources', 'kompas', 'portal-probe');

async function loadEnv() {
  try {
    const raw = await fs.readFile(path.join(ROOT, 'scraper', '.env'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch { /* нет файла */ }
}

/** Описание страницы: поля, кнопки, кадры, сетевые вызовы. Значения полей НЕ читаем. */
async function describe(page) {
  return page.evaluate(() => {
    const vis = (el) => !!(el.offsetParent || el.getClientRects().length);
    return {
      url: location.href,
      title: document.title,
      inputs: [...document.querySelectorAll('input,textarea,select')]
        .filter(vis)
        .map((i) => `${i.tagName.toLowerCase()}:${i.type || ''}|name=${i.name}|id=${i.id}|ph=${i.placeholder || ''}`),
      buttons: [...document.querySelectorAll('button,a[role=button],input[type=submit]')]
        .filter(vis).map((x) => (x.innerText || x.value || '').trim()).filter(Boolean).slice(0, 25),
      links: [...document.querySelectorAll('a[href]')].filter(vis)
        .map((a) => `${(a.innerText || '').trim().slice(0, 30)} -> ${a.getAttribute('href')}`)
        .filter((s) => s.length > 6).slice(0, 30),
      iframes: [...document.querySelectorAll('iframe')].map((f) => f.src),
      shadowRoots: [...document.querySelectorAll('*')].filter((e) => e.shadowRoot).length,
      textHead: document.body.innerText.replace(/\s+/g, ' ').slice(0, 400),
    };
  });
}

async function probeOne(browser, name, cfg) {
  const result = { portal: name, steps: [], network: [], error: null };
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('response', (r) => {
    const u = r.url();
    if (/\.(png|jpg|svg|woff2?|css)(\?|$)/i.test(u)) return;
    if (result.network.length < 250) result.network.push({ url: u.slice(0, 220), status: r.status(), ct: (r.headers()['content-type'] || '').slice(0, 40) });
  });

  try {
    await page.goto(cfg.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(3000);
    result.steps.push({ step: 'до входа', ...(await describe(page)) });
    await page.screenshot({ path: path.join(OUT, `${name}-01-before.png`), fullPage: false });

    // снимаем баннеры согласия — на Edvoy они перехватывали клики
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('button,a')].find((e) => /^(accept all|accept|allow all|i agree)$/i.test((e.innerText || '').trim()));
      if (el) el.click();
    });
    await page.waitForTimeout(1000);

    const findSel = (list) => page.evaluate((a) => { for (const s of a) if (document.querySelector(s)) return s; return null; }, list);
    const userSel = await findSel(['input[type=email]', 'input[name*=user i]', 'input[id*=user i]', 'input[placeholder*="email" i]', 'input[placeholder*="user" i]', 'input[type=text]']);
    const passSel = await findSel(['input[type=password]', 'input[name*=pass i]', 'input[id*=pass i]']);
    result.steps.push({ step: 'селекторы', userSel, passSel });

    if (!userSel || !passSel) {
      result.error = `форма входа не опознана (поле пользователя: ${userSel || 'нет'}, пароля: ${passSel || 'нет'})`;
      return result;
    }

    await page.fill(userSel, cfg.login);
    await page.fill(passSel, cfg.pass);
    await page.waitForTimeout(300);
    try { await page.click('button[type=submit], input[type=submit], button:has-text("Log In"), button:has-text("Login"), button:has-text("Sign In")', { timeout: 6000 }); }
    catch { await page.press(passSel, 'Enter'); }

    await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(8000);
    result.steps.push({ step: 'после входа', ...(await describe(page)) });
    await page.screenshot({ path: path.join(OUT, `${name}-02-after.png`), fullPage: false });

    const body = (await page.evaluate(() => document.body.innerText)).toLowerCase();
    if (/(two.factor|verification code|one.time|enter the code|authenticator)/.test(body)) result.error = 'портал требует код подтверждения — нужен владелец';
    else if (/(invalid|incorrect|wrong password|failed to log)/.test(body)) result.error = 'портал отклонил учётные данные';
  } catch (e) {
    result.error = e.message;
    await page.screenshot({ path: path.join(OUT, `${name}-99-error.png`) }).catch(() => {});
  } finally {
    await ctx.close();
  }
  return result;
}

async function main() {
  await loadEnv();
  await fs.mkdir(OUT, { recursive: true });

  // Адрес IAPro уточнён владельцем 2026-07-23: вход живёт на Experience Cloud
  // (/s/login/), а не на /login — прежняя разведка стучалась не туда.
  // Паролей владелец дал по два на портал, поэтому пробуем оба: «отклонил» с
  // первого раза ещё не значит «пароль не тот».
  const targets = [];
  const add = (name, url, login, passes) => {
    const list = passes.filter(Boolean);
    if (!login || !list.length) { log(`${name}: нет учётных данных в .env — пропускаем`); return; }
    list.forEach((pass, i) => targets.push({ name: list.length > 1 ? `${name}-p${i + 1}` : name, portal: name, url, login, pass }));
  };
  add('iapro', 'https://iapro.my.site.com/agentportals/s/login/?language=en_US',
    process.env.IAPRO_LOGIN, [process.env.IAPRO_PASS, process.env.IAPRO_PASS_ALT]);
  add('qs', 'https://admissions.qs.com/suite/sites/qs-apply',
    process.env.QS_LOGIN, [process.env.QS_PASS, process.env.QS_PASS_ALT]);

  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: !process.argv.includes('--headed') });
  const out = [];
  try {
    const done = new Set();
    for (const t of targets) {
      if (done.has(t.portal)) { log(`${t.name}: пропускаю, на этот портал уже вошли`); continue; }
      log(`${t.name}: захожу`);
      const r = await probeOne(browser, t.name, t);
      log(`${t.name}: ${r.error ? 'ПРОБЛЕМА — ' + r.error : 'вход прошёл'}`);
      if (!r.error) done.add(t.portal);
      out.push(r);
    }
  } finally { await browser.close(); }

  await fs.writeFile(path.join(OUT, 'probe.json'), JSON.stringify(out, null, 2), 'utf8');
  for (const r of out) {
    const after = r.steps.find((s) => s.step === 'после входа');
    log(`--- ${r.portal} ---`);
    log(`  итог: ${r.error || 'ок'}`);
    if (after) {
      log(`  адрес: ${after.url}`);
      log(`  заголовок: ${after.title}`);
      log(`  теневых корней: ${after.shadowRoots}, кадров: ${after.iframes.length}`);
      log(`  кнопки: ${after.buttons.slice(0, 12).join(' / ')}`);
      log(`  текст: ${after.textHead.slice(0, 200)}`);
    }
  }
  log(`подробности: sources/kompas/portal-probe/probe.json`);
}

main().catch((e) => { log('ОШИБКА: ' + e.message); process.exit(1); });
