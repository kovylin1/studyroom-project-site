#!/usr/bin/env node
// kompas-iapro.mjs — КОМПАС: вход в портал IAPro и снятие списка партнёров.
//
// Почему отдельный скрипт, а не общий разведчик: вход IAPro живёт на Experience
// Cloud и вся форма лежит в shadow DOM (3 теневых корня). Общий разведчик искал
// поля через document.querySelector в page.evaluate — тот сквозь теневой корень
// не смотрит, поэтому и отчитался «формы нет». Локаторы Playwright смотрят.
//
// Пароли берутся из scraper/.env (в gitignore) и НЕ печатаются.
// Результат: sources/kompas/portal-probe/iapro-*.png + iapro-session.json
//
// Запуск: node kompas-iapro.mjs [--headed]

import fs from 'fs/promises';
import path from 'path';
import { ROOT, logger } from './lib/kompas-collect.mjs';

const log = logger('iapro');
const OUT = path.join(ROOT, 'sources', 'kompas', 'portal-probe');
const LOGIN_URL = 'https://iapro.my.site.com/agentportals/s/login/?language=en_US';

async function loadEnv() {
  try {
    const raw = await fs.readFile(path.join(ROOT, 'scraper', '.env'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch { /* нет файла */ }
}

const describe = (page) => page.evaluate(() => {
  // Обходим теневые корни руками: обычный querySelectorAll в них не заходит.
  const all = [];
  const walk = (root) => {
    for (const el of root.querySelectorAll('*')) {
      all.push(el);
      if (el.shadowRoot) walk(el.shadowRoot);
    }
  };
  walk(document);
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length);
  return {
    url: location.href,
    title: document.title,
    inputs: all.filter((e) => /^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName) && vis(e))
      .map((i) => `${i.tagName.toLowerCase()}:${i.type || ''}|name=${i.name || ''}|id=${i.id || ''}|ph=${i.placeholder || ''}`),
    buttons: all.filter((e) => /^(BUTTON|A)$/.test(e.tagName) && vis(e))
      .map((x) => (x.innerText || x.value || '').trim()).filter(Boolean).slice(0, 40),
    text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 1200),
  };
});

async function tryLogin(page, login, pass, tag) {
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(2500);

  const user = page.locator('input[type=email], input[name*="user" i], input[name*="mail" i], input[type=text]').first();
  const pw = page.locator('input[type=password]').first();
  await user.waitFor({ state: 'visible', timeout: 20000 });
  await user.fill(login);
  await pw.fill(pass);

  // Галочка «I accept the Terms & Conditions» — без неё портал вход не примет.
  const terms = page.locator('input[type=checkbox]').first();
  if (await terms.count()) await terms.check({ timeout: 5000 }).catch(() => {});

  await page.screenshot({ path: path.join(OUT, `iapro-${tag}-01-filled.png`) });
  const before = page.url();
  await page.locator('button:has-text("Sign in"), button[type=submit]').first().click({ timeout: 10000 }).catch(() => pw.press('Enter'));
  await page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(7000);
  await page.screenshot({ path: path.join(OUT, `iapro-${tag}-02-after.png`) });

  const d = await describe(page);
  const bad = /(invalid|incorrect|not match|failed|error|check your username)/i.test(d.text);
  const moved = d.url !== before && !/\/s\/login/.test(d.url);
  return { ok: moved && !bad, moved, bad, d };
}

async function main() {
  await loadEnv();
  await fs.mkdir(OUT, { recursive: true });
  const login = process.env.IAPRO_LOGIN;
  const passes = [process.env.IAPRO_PASS, process.env.IAPRO_PASS_ALT].filter(Boolean);
  if (!login || !passes.length) { log('нет учётных данных в .env'); process.exit(1); }

  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: !process.argv.includes('--headed') });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  let done = null;
  try {
    for (let i = 0; i < passes.length; i++) {
      log(`пробую пароль ${i + 1} из ${passes.length}`);
      const r = await tryLogin(page, login, passes[i], `p${i + 1}`);
      log(`  адрес после: ${r.d.url}`);
      log(`  текст: ${r.d.text.slice(0, 220)}`);
      if (r.ok) { done = { pass: i + 1, d: r.d }; break; }
    }

    if (done) {
      log(`ВОШЁЛ (пароль ${done.pass}). Заголовок: ${done.d.title}`);
      log(`  кнопки/ссылки: ${done.d.buttons.slice(0, 25).join(' / ')}`);
      await ctx.storageState({ path: path.join(OUT, 'iapro-session.json') });
      log('сессия сохранена: sources/kompas/portal-probe/iapro-session.json');
    } else {
      log('ВОЙТИ НЕ УДАЛОСЬ ни с одним паролем');
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => { log('ОШИБКА: ' + e.message); process.exit(1); });
