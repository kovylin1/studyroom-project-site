#!/usr/bin/env node
// kompas-iapro-courses.mjs — КОМПАС: есть ли у IAPro данные о ПРОГРАММАХ.
//
// Разметку портал уже закрыл (11 партнёров). Отдельный вопрос: годится ли IAPro
// как ИСТОЧНИК по правилу 1, то есть отдаёт ли он курсы с ценами. Если да —
// это одиннадцатый источник; если нет — вузы IAPro сверяются по своим офсайтам
// или другим агрегаторам, и это надо знать до сессии 5, а не после.
//
// Смотрим форму заявки: там выбирается вуз и программа, значит справочник курсов
// где-то есть. Пишем ВСЕ ответы порталa в формате JSON — по ним видно, какой
// запрос отдаёт список.
//
// Работает по сохранённой сессии. Ничего не пишет в каталог.
// Запуск: node kompas-iapro-courses.mjs [--headed]

import fs from 'fs/promises';
import path from 'path';
import { ROOT, logger } from './lib/kompas-collect.mjs';

const log = logger('iapro-c');
const OUT = path.join(ROOT, 'sources', 'kompas', 'portal-probe');
const SESSION = path.join(OUT, 'iapro-session.json');
const TARGET = 'https://iapro.my.site.com/agentportals/s/create-application';

async function main() {
  try { await fs.access(SESSION); }
  catch { log('нет сессии — сначала node kompas-iapro.mjs'); process.exit(1); }

  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: !process.argv.includes('--headed') });
  const ctx = await browser.newContext({ storageState: SESSION, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const calls = [];
  page.on('response', async (r) => {
    const u = r.url();
    if (!/aura|apexremote|api|services\/data|course|program/i.test(u)) return;
    let body = '';
    try { body = (await r.text()).slice(0, 4000); } catch { return; }
    if (!/course|programme|program|tuition|fee/i.test(body)) return;
    calls.push({ url: u.slice(0, 200), status: r.status(), sample: body.slice(0, 1500) });
  });

  try {
    // Сохранённая сессия Salesforce живёт недолго: первый прогон получил форму
    // входа вместо формы заявки. Логинимся заново в этом же контексте.
    const raw = await fs.readFile(path.join(ROOT, 'scraper', '.env'), 'utf8');
    const env = Object.fromEntries([...raw.matchAll(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/gm)].map((m) => [m[1], m[2].trim()]));
    await page.goto('https://iapro.my.site.com/agentportals/s/login/?language=en_US', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);
    await page.locator('input[type=email], input[type=text]').first().fill(env.IAPRO_LOGIN);
    await page.locator('input[type=password]').first().fill(env.IAPRO_PASS_ALT || env.IAPRO_PASS);
    const terms = page.locator('input[type=checkbox]').first();
    if (await terms.count()) await terms.check({ timeout: 5000 }).catch(() => {});
    await page.locator('button:has-text("Sign in"), button[type=submit]').first().click({ timeout: 10000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(6000);
    log(`после входа: ${page.url()}`);

    await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(9000);
    await page.screenshot({ path: path.join(OUT, 'iapro-20-application.png'), fullPage: true }).catch(() => {});

    const text = await page.evaluate(() => {
      const all = [];
      const walk = (root) => { for (const el of root.querySelectorAll('*')) { all.push(el); if (el.shadowRoot) walk(el.shadowRoot); } };
      walk(document);
      return {
        body: document.body.innerText.replace(/\s+/g, ' ').slice(0, 2000),
        selects: all.filter((e) => e.tagName === 'SELECT').map((s) => (s.innerText || '').slice(0, 300)),
        comboboxes: all.filter((e) => (e.getAttribute('role') || '') === 'combobox').length,
        inputs: all.filter((e) => e.tagName === 'INPUT').map((i) => i.placeholder || i.name || '').filter(Boolean).slice(0, 20),
      };
    });

    log(`страница заявки: ${text.body.slice(0, 400)}`);
    log(`полей ввода: ${text.inputs.join(' | ')}`);
    log(`выпадающих списков: select ${text.selects.length}, combobox ${text.comboboxes}`);
    log(`сетевых ответов со словами course/programme/fee: ${calls.length}`);
    for (const c of calls.slice(0, 5)) log(`  ${c.status} ${c.url}`);

    await fs.writeFile(path.join(OUT, 'iapro-courses-probe.json'),
      JSON.stringify({ page: text, calls }, null, 2), 'utf8');
  } finally {
    await browser.close();
  }
  log('подробности: sources/kompas/portal-probe/iapro-courses-probe.json');
}

main().catch((e) => { log('ОШИБКА: ' + e.message); process.exit(1); });
