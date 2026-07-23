#!/usr/bin/env node
// kompas-collect-iapro.mjs — КОМПАС: сбор программ из ProgrammeFinder портала IAPro.
//
// Найдено разведкой 2026-07-23: страница «Create Application» тянет справочник
// программ Apex-вызовом aura.ApexAction.execute. Ответ содержит brand, name,
// levelName, location — то есть IAPro годится как ИСТОЧНИК, а не только как
// список партнёров.
//
// Как работает: логинимся, открываем ProgrammeFinder, перехватываем НАСТОЯЩИЙ
// запрос (адрес + тело с токенами Aura) и повторяем его из той же страницы,
// меняя параметры. Собственный HTTP-клиент тут не годится: Aura требует
// aura.token и aura.context, действительные только внутри живой сессии.
//
// Пароли из scraper/.env, в выгрузки не попадают.
// Выход: sources/kompas/extracts/iapro/<slug>.json + membership/iapro-courses.json
//
// Запуск: node kompas-collect-iapro.mjs [--dry-run] [--headed]

import fs from 'fs/promises';
import path from 'path';
import { ROOT, KOMPAS_DIR, writeExtract, extract, mapLevel, args, logger } from './lib/kompas-collect.mjs';
import { buildCatalogIndex, matchToCatalog } from './lib/kompas-catalog-match.mjs';

const log = logger('iapro');
const DRY = args.has('dry-run');
const AGG = 'iapro';
const LOGIN_URL = 'https://iapro.my.site.com/agentportals/s/login/?language=en_US';
const FINDER_URL = 'https://iapro.my.site.com/agentportals/s/create-application';

async function loadEnv() {
  const raw = await fs.readFile(path.join(ROOT, 'scraper', '.env'), 'utf8');
  return Object.fromEntries([...raw.matchAll(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/gm)].map((m) => [m[1], m[2].trim()]));
}

async function main() {
  const env = await loadEnv();
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: !args.has('headed') });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Перехватываем тело запроса: без него повторить Aura-вызов нечем.
  const captured = [];
  page.on('request', (req) => {
    if (!/aura\.ApexAction\.execute/.test(req.url())) return;
    const body = req.postData();
    if (body) captured.push({ url: req.url(), body });
  });
  const responses = [];
  page.on('response', async (r) => {
    if (!/aura\.ApexAction\.execute/.test(r.url())) return;
    try { responses.push(await r.text()); } catch { /* тело недоступно */ }
  });

  try {
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);
    await page.locator('input[type=email], input[type=text]').first().fill(env.IAPRO_LOGIN);
    await page.locator('input[type=password]').first().fill(env.IAPRO_PASS_ALT || env.IAPRO_PASS);
    const terms = page.locator('input[type=checkbox]').first();
    if (await terms.count()) await terms.check({ timeout: 5000 }).catch(() => {});
    await page.locator('button:has-text("Sign in"), button[type=submit]').first().click({ timeout: 10000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(5000);
    if (/\/s\/login/.test(page.url())) throw new Error('вход не прошёл');

    await page.goto(FINDER_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(10000);

    // Пробуем долистать выдачу: у финдера есть подгрузка по прокрутке/кнопке.
    for (let i = 0; i < 25; i++) {
      const more = page.locator('button:has-text("Load more"), button:has-text("Show more"), button:has-text("View more")').first();
      if (await more.count()) { await more.click({ timeout: 5000 }).catch(() => {}); }
      else await page.mouse.wheel(0, 4000);
      await page.waitForTimeout(1500);
    }
    await page.waitForTimeout(4000);

    log(`перехвачено запросов ${captured.length}, ответов ${responses.length}`);

    // Разбираем ВСЕ ответы: программы лежат массивом с полями brand/name/levelName.
    const programmes = new Map();
    const brands = new Map();
    for (const raw of responses) {
      let j; try { j = JSON.parse(raw); } catch { continue; }
      for (const a of j.actions ?? []) {
        const rv = a.returnValue?.returnValue;
        if (!rv) continue;
        if (Array.isArray(rv)) {
          for (const p of rv) {
            if (!p?.name || !p?.brand) continue;
            programmes.set(p.id ?? `${p.brand}|${p.name}`, p);
          }
        } else if (Array.isArray(rv.brands)) {
          for (const b of rv.brands) brands.set(b.value, b.label);
        }
      }
    }
    // Сколько программ ОБЪЯВЛЯЕТ сам портал. Без этой сверки «получено 1436»
    // ничего не значит: в сессии 3 у Edvoy пустая страница была неотличима от
    // «данные кончились», и прогон отчитался бы об успехе на 1 % данных.
    const declared = new Map();
    for (const raw of responses) {
      for (const m of raw.matchAll(/"(total|totalCount|recordCount|totalRecords|count|totalPrograms|totalProgrammes)"\s*:\s*(\d+)/gi)) {
        const k = m[1]; const v = Number(m[2]);
        if (!declared.has(k) || declared.get(k) < v) declared.set(k, v);
      }
    }
    const declaredStr = [...declared].map(([k, v]) => `${k}=${v}`).join(', ') || 'портал числа не объявляет';
    log(`брендов в справочнике: ${brands.size}, программ получено: ${programmes.size}`);
    log(`объявлено источником: ${declaredStr}`);
    const best = Math.max(0, ...[...declared.values()]);
    if (best > programmes.size) log(`НЕДОБОР: получено ${programmes.size} из объявленных ${best}`);

    await fs.mkdir(path.join(KOMPAS_DIR, 'membership'), { recursive: true });
    if (!DRY) {
      await fs.writeFile(path.join(KOMPAS_DIR, 'membership', 'iapro-courses.json'), JSON.stringify({
        generatedAt: new Date().toISOString(),
        source: 'ProgrammeFinder (aura.ApexAction.execute)',
        brands: [...brands].map(([value, label]) => ({ value, label })),
        programmesCollected: programmes.size,
        note: 'Цены в выдаче финдера нет: поля brand, name, levelName, location. Стоимость обучения портал на этом экране не отдаёт.',
      }, null, 2) + '\n', 'utf8');
    }

    // Раскладываем по вузам каталога.
    const catalog = await buildCatalogIndex();
    const byBrand = new Map();
    for (const p of programmes.values()) {
      if (!byBrand.has(p.brand)) byBrand.set(p.brand, []);
      byBrand.get(p.brand).push(p);
    }

    let written = 0; const unmatched = [];
    for (const [brand, list] of byBrand) {
      // В программах бренд стоит КОДОМ («GIH», «TUA»), а человеческое название
      // лежит в справочнике brands. Резолвер по коду не найдёт ничего, а по
      // названию находит: «GIH» → «Gisma University of Applied Sciences».
      const brandName = brands.get(brand) ?? brand;
      const res = matchToCatalog(brandName, catalog, {});
      if (!res.catalogSlug) { unmatched.push({ brand, brandName, programmes: list.length }); continue; }
      const payload = extract({
        slug: res.catalogSlug,
        name: brand,
        source: AGG,
        sourceUrl: FINDER_URL,
        programs: list.map((p) => ({
          title: p.name,
          level: mapLevel(p.levelName || ''),
          sourceLevel: p.levelName || null,
          campus: p.location || null,
          programUrl: null,
        })),
        extra: {
          aggregator: 'IAPro (GUS Gateway)',
          access: 'login',
          matchMethod: res.matchMethod,
          feeNote: 'ProgrammeFinder цены не отдаёт — в выдаче только название, уровень и город',
        },
      });
      const w = await writeExtract(AGG, res.catalogSlug, payload, { dryRun: DRY });
      if (w.written) written++;
    }
    log(`${DRY ? '(сухой прогон) ' : ''}файлов записано ${written}, брендов без карточки ${unmatched.length}`);
    for (const u of unmatched) log(`  нет карточки: ${u.brandName} [${u.brand}] (${u.programmes} программ)`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => { log('ОШИБКА: ' + e.message); process.exit(1); });
