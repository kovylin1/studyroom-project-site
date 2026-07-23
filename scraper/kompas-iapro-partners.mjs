#!/usr/bin/env node
// kompas-iapro-partners.mjs — КОМПАС: снять список партнёров IAPro по живой сессии.
//
// Задача сессии 1, висевшая блокером: документ владельца говорит «11 партнёров,
// вкладка Marketing Hub», но сами названия нигде не записаны. Без них разметка
// каталога по IAPro не закрывается.
//
// Работает по сохранённой сессии (kompas-iapro.mjs), пароль повторно не нужен.
// Ничего не пишет в каталог.
//
// Запуск: node kompas-iapro-partners.mjs [--headed]

import fs from 'fs/promises';
import path from 'path';
import { ROOT, logger } from './lib/kompas-collect.mjs';

const log = logger('iapro-p');
const OUT = path.join(ROOT, 'sources', 'kompas', 'portal-probe');
const SESSION = path.join(OUT, 'iapro-session.json');
const HOME = 'https://iapro.my.site.com/agentportals/s/';

// Обход теневых корней: портал на Experience Cloud, обычный querySelectorAll
// внутрь не заходит и отчитывается пустотой.
const DEEP = `(() => {
  const all = [];
  const walk = (root) => {
    for (const el of root.querySelectorAll('*')) { all.push(el); if (el.shadowRoot) walk(el.shadowRoot); }
  };
  walk(document);
  return all;
})()`;

const describe = (page) => page.evaluate(`(() => {
  const all = ${DEEP};
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length);
  return {
    url: location.href,
    title: document.title,
    links: all.filter(e => e.tagName === 'A' && vis(e))
      .map(a => ((a.innerText || '').trim().slice(0, 60)) + ' -> ' + (a.getAttribute('href') || ''))
      .filter(s => s.length > 4),
    tabs: all.filter(e => /tab|menu/i.test(e.getAttribute('role') || '') && vis(e))
      .map(e => (e.innerText || '').trim()).filter(Boolean),
    tables: all.filter(e => e.tagName === 'TABLE' && vis(e)).map(t => (t.innerText || '').slice(0, 4000)),
    text: document.body.innerText.replace(/[ \\t]+/g, ' ').slice(0, 6000),
  };
})()`);

async function main() {
  try { await fs.access(SESSION); }
  catch { log('нет сохранённой сессии — сначала node kompas-iapro.mjs'); process.exit(1); }

  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: !process.argv.includes('--headed') });
  const ctx = await browser.newContext({ storageState: SESSION, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const seen = [];

  try {
    await page.goto(HOME, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(6000);
    let d = await describe(page);
    seen.push({ step: 'home', ...d });
    await page.screenshot({ path: path.join(OUT, 'iapro-10-home.png'), fullPage: true });
    log(`главная: ${d.url}`);
    log(`  ссылки: ${d.links.slice(0, 40).join(' | ')}`);
    log(`  текст: ${d.text.slice(0, 500)}`);

    // Ищем вкладку Marketing Hub среди чего угодно кликабельного.
    const hub = d.links.find((l) => /marketing\s*hub/i.test(l));
    if (hub) {
      const href = hub.split(' -> ').pop();
      const url = href.startsWith('http') ? href : new URL(href, HOME).href;
      log(`Marketing Hub: ${url}`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForLoadState('networkidle', { timeout: 25000 }).catch(() => {});
      await page.waitForTimeout(6000);
      d = await describe(page);
      seen.push({ step: 'marketing-hub', ...d });
      await page.screenshot({ path: path.join(OUT, 'iapro-11-hub.png'), fullPage: true });

      // Таблица разбита на страницы по 10, а партнёров 11: без листания
      // одиннадцатый молча потерялся бы — ровно как offset у Edvoy в сессии 3.
      for (let p = 2; p <= 6; p++) {
        const next = page.locator('button:has-text("Next"), a:has-text("Next")').first();
        if (!(await next.count())) break;
        const disabled = await next.getAttribute('disabled').catch(() => null);
        if (disabled !== null) break;
        await next.click({ timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(4000);
        const dp = await describe(page);
        if (seen.some((s) => s.text === dp.text)) { log(`  страница ${p}: содержимое не изменилось, листание кончилось`); break; }
        seen.push({ step: `marketing-hub-p${p}`, ...dp });
        await page.screenshot({ path: path.join(OUT, `iapro-11-hub-p${p}.png`), fullPage: true });
        log(`  страница ${p} снята`);
      }
    } else {
      log('ссылки «Marketing Hub» на главной нет — смотри iapro-10-home.png и iapro-nav.json');
    }
    // Contract Hub: там названия учреждений полностью, а не брендовыми кодами
    // вроде «CCTB». Кодов документ владельца не содержит, сопоставлять нужно
    // по именам.
    for (const [tab, url] of [['contract-hub', '/agentportals/s/contract-hub'], ['my-account', '/agentportals/s/comm-my-account']]) {
      await page.goto(new URL(url, HOME).href, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
      await page.waitForLoadState('networkidle', { timeout: 25000 }).catch(() => {});
      await page.waitForTimeout(6000);
      const dt = await describe(page);
      seen.push({ step: tab, ...dt });
      await page.screenshot({ path: path.join(OUT, `iapro-12-${tab}.png`), fullPage: true }).catch(() => {});
      log(`${tab}: ${dt.text.slice(0, 400).replace(/\n+/g, ' | ')}`);

      // Contract Hub тоже разбит по 10 строк, а страниц 4. Ровно та же ловушка,
      // что и в Marketing Hub: без листания видно четверть договоров.
      if (tab !== 'contract-hub') continue;
      for (let p = 2; p <= 10; p++) {
        const next = page.locator('button:has-text("Next"), a:has-text("Next")').first();
        if (!(await next.count())) break;
        await next.click({ timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(4000);
        const dp = await describe(page);
        if (seen.some((s) => s.text === dp.text)) { log(`  ${tab} стр.${p}: не изменилось, конец`); break; }
        seen.push({ step: `${tab}-p${p}`, ...dp });
        log(`  ${tab} стр.${p} снята`);
      }
    }
  } finally {
    await fs.writeFile(path.join(OUT, 'iapro-nav.json'), JSON.stringify(seen, null, 2), 'utf8');
    await browser.close();
  }
  log('подробности: sources/kompas/portal-probe/iapro-nav.json');
}

main().catch((e) => { log('ОШИБКА: ' + e.message); process.exit(1); });
