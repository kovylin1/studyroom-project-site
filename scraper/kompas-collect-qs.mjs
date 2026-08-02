#!/usr/bin/env node
// kompas-collect-qs.mjs — сбор QS Apply (Appian/SAIL) под КОМПАС.
//
// Разметка портала (разведка sources/kompas/qs-recon + пробы 2026-07-31):
//  - список: /suite/sites/qs-apply/group/students-and-applications/page/institutions
//    грид «List of Institutions», портал объявляет 512 вузов, по 20 строк на странице;
//  - карточка вуза — record-дашборд с вкладками Summary | Degrees and Programs |
//    Student Testimonials | Commission (имена вкладок — непрозрачные хэши);
//  - программы лежат за КАСКАДОМ выбора внутри «Degrees and Programs»:
//        List of Degrees  ->  List of Study Levels  ->  <кампус> Campus Costs + Programs
//    каскадные таблицы — однoколоночные, без заголовков; грид Programs имеет
//    заголовки Name | STEM | Program Type | Application Fee | Intake Dates | Commissions
//    и свою пагинацию (10 строк на страницу);
//  - POST-ответы портала — ДЕЛЬТЫ интерфейса (грида в них нет), поэтому строки
//    снимаются с DOM, а не из JSON.
//
// Живой каталог не трогаем: пишем в sources/kompas/qs/ и sources/kompas/extracts/qs/.
//
// Стадии:
//   1) list    -> sources/kompas/qs/institutions.json      (сверяем с числом портала)
//   2) records -> sources/kompas/qs/records/<id>.json      (resume: файл есть — пропуск)
//   3) extract -> sources/kompas/extracts/qs/<slug>.json + membership/qs.json
//
// Запуск:
//   node scraper/kompas-collect-qs.mjs                    # полный прогон
//   node scraper/kompas-collect-qs.mjs --limit=3          # проба
//   node scraper/kompas-collect-qs.mjs --workers=4        # параллельные вкладки
//   node scraper/kompas-collect-qs.mjs --extract-only     # только разбор дампов
//   node scraper/kompas-collect-qs.mjs --list-only        # только список вузов

import fs from 'fs/promises';
import path from 'path';
import {
  ROOT, KOMPAS_DIR, logger, args, mapLevel, parseMoney,
  writeExtract, writeMembership, extract as mkExtract,
} from './lib/kompas-collect.mjs';
import { buildCatalogIndex, matchToCatalog, norm } from './lib/kompas-catalog-match.mjs';

const log = logger('qs');
const OUT = path.join(KOMPAS_DIR, 'qs');
const RECORDS = path.join(OUT, 'records');
const LOGFILE = path.join(OUT, 'collect.log');

const BASE = 'https://admissions.qs.com';
const LIST_URL = `${BASE}/suite/sites/qs-apply/group/students-and-applications/page/institutions`;

const LIMIT = args.num('limit', 0);
const WORKERS = Math.max(1, Math.min(6, args.num('workers', 3)));
const HEADED = args.has('headed');
const REFRESH = args.has('refresh');
const EXTRACT_ONLY = args.has('extract-only');
const LIST_ONLY = args.has('list-only');
const MAX_GRID_PAGES = args.num('max-grid-pages', 80);
const MAX_DEPTH = args.num('max-depth', 3);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Переходы всех вкладок идут по очереди. В прогоне 15:40 четыре вкладки роняли друг
// другу навигацию («is interrupted by another navigation») — 339 карточек из 508.
// Сам переход занимает секунду, а дорогая часть (прокликивание каскада) остаётся
// параллельной, так что очередь почти ничего не стоит.
let navChain = Promise.resolve();
const NAV_RETRYABLE = /interrupted by another navigation|Timeout .* exceeded|net::ERR|Target closed/i;

async function gotoSafe(page, url, { tries = 3 } = {}) {
  let lastErr = null;
  for (let i = 0; i < tries; i++) {
    const job = navChain.then(() => page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }));
    navChain = job.catch(() => {});
    try { await job; return true; } catch (e) {
      lastErr = e;
      if (!NAV_RETRYABLE.test(e.message)) throw e;
      await sleep(1200 * (i + 1));
    }
  }
  throw lastErr;
}

async function say(msg) {
  log(msg);
  await fs.appendFile(LOGFILE, `${new Date().toISOString()} ${msg}\n`).catch(() => {});
}

async function loadEnv() {
  const raw = await fs.readFile(path.join(ROOT, 'scraper', '.env'), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

// =============================================================== чтение DOM ===

/**
 * Все таблицы страницы с контекстом.
 * cascade — однoколоночная выбираемая таблица (List of Degrees / Study Levels):
 * её строки не данные, а шаги каскада.
 */
const READ_TABLES = () => {
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const NOISE = /^(sorted by|this table contains|column headers|\d+ items? available|\d+ items?|items \d+ through|\d[\d,]*\s*[-–—]\s*\d)/i;
  const labelsFor = (t) => {
    const out = [];
    let node = t;
    for (let up = 0; up < 8 && node && out.length < 3; up++) {
      let sib = node.previousElementSibling;
      while (sib && out.length < 3) {
        const txt = clean(sib.innerText || '');
        if (txt && txt.length <= 160 && !NOISE.test(txt)) out.push(txt);
        sib = sib.previousElementSibling;
      }
      node = node.parentElement;
    }
    return out;
  };
  return [...document.querySelectorAll('table')].map((t, index) => {
    const headers = [...t.querySelectorAll('thead th, thead td')].map((th) => clean(th.innerText));
    const rows = [];
    t.querySelectorAll('tbody tr').forEach((tr) => {
      const tds = [...tr.querySelectorAll('td, th')];
      if (!tds.length) return;
      const cells = tds.map((td) => clean(td.innerText));
      if (!cells.some(Boolean)) return;
      const recLink = [...tr.querySelectorAll('a[href]')].find((a) => /\/record\//.test(a.href)) || null;
      // Текст ссылки — чистое имя вуза: бейдж типа партнёрства лежит рядом, вне ссылки.
      rows.push({ cells, recordUrl: recLink ? recLink.href : null, linkText: recLink ? clean(recLink.innerText) : null });
    });
    const context = labelsFor(t);
    const selectable = !!t.querySelector('tr[aria-selected]');
    return {
      index,
      caption: context[0] || '',
      context,
      headers,
      selectable,
      cascade: selectable && headers.filter(Boolean).length === 0,
      selected: [...t.querySelectorAll('tr[aria-selected="true"]')].map((r) => clean(r.innerText)),
      rows,
    };
  });
};

/** Кнопки «следующая страница» с привязкой к своей таблице. */
const READ_NEXT = () => {
  const tables = [...document.querySelectorAll('table')];
  return [...document.querySelectorAll('[aria-label="Next page"]')].map((el, i) => {
    let tableIndex = -1;
    tables.forEach((t, ti) => {
      // DOCUMENT_POSITION_PRECEDING = таблица идёт раньше кнопки
      if (t.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) tableIndex = ti;
    });
    return { i, tableIndex, disabled: el.getAttribute('aria-disabled') === 'true' };
  });
};

/** Счётчики пагинации: «1 – 20 of 512» / «Items 1 through 20 of 512». */
const READ_PAGING = () => {
  const out = [];
  document.querySelectorAll('[data-testid="GridFooter-count"], [aria-live="polite"]').forEach((el) => {
    const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
    const m = t.match(/(\d[\d,]*)\s*(?:through|[-–—])\s*(\d[\d,]*)\s*of\s*(\d[\d,]*)\s*$/i);
    if (!m) return;
    const num = (s) => Number(s.replace(/,/g, ''));
    out.push({ text: t, from: num(m[1]), to: num(m[2]), total: num(m[3]) });
  });
  return out;
};

// ================================================================ ожидания ===

/**
 * Ждём отрисовку и остановку изменений. networkidle у Appian не наступает (SSE),
 * а первые ~4 с body почти пуст — поэтому «тишина» засчитывается только после
 * порога содержимого.
 */
async function settle(page, { maxMs = 25000, quietMs = 700, minLen = 500 } = {}) {
  let prev = null; let stableSince = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const st = await page.evaluate(() => ({
      len: document.body.innerText.length,
      tables: document.querySelectorAll('table').length,
    })).catch(() => ({ len: 0, tables: 0 }));
    const key = `${st.len}/${st.tables}`;
    const ready = st.tables > 0 || st.len >= minLen;
    if (ready && key === prev) {
      if (!stableSince) stableSince = Date.now();
      if (Date.now() - stableSince >= quietMs) return true;
    } else { stableSince = 0; prev = key; }
    await sleep(250);
  }
  return false;
}

const sig = (g) => `${g.context.join(' > ')}||${g.headers.join('|')}`;
const rowKey = (r) => `${r.recordUrl || ''}##${r.cells.join('§')}`;

/**
 * Снимает данные-гриды текущего состояния, прокликивая ИХ пагинацию.
 * Каскадные таблицы не листаем: перелистывание сбило бы выбор шага каскада.
 */
async function harvestGrids(page, { includeCascade = false } = {}) {
  const acc = new Map();
  const merge = (tables) => {
    let added = 0;
    for (const t of tables) {
      if (!t.rows.length) continue;
      if (t.cascade && !includeCascade) continue;
      const k = sig(t);
      if (!acc.has(k)) acc.set(k, { caption: t.caption, context: t.context, headers: t.headers, rows: [], seen: new Set() });
      const a = acc.get(k);
      for (const r of t.rows) {
        const rk = rowKey(r);
        if (a.seen.has(rk)) continue;
        a.seen.add(rk); a.rows.push(r); added++;
      }
    }
    return added;
  };

  merge(await page.evaluate(READ_TABLES));
  const done = new Set();
  for (let i = 0; i < MAX_GRID_PAGES; i++) {
    const tables = await page.evaluate(READ_TABLES);
    const nexts = await page.evaluate(READ_NEXT);
    const target = nexts.find((n) => !n.disabled && !done.has(n.i)
      && n.tableIndex >= 0 && tables[n.tableIndex]
      && (includeCascade || !tables[n.tableIndex].cascade));
    if (!target) break;

    const before = (await page.evaluate(READ_PAGING)).map((p) => p.text).join(' // ');
    await page.locator('[aria-label="Next page"]').nth(target.i).click({ timeout: 8000 }).catch(() => {});
    // Ждём именно смену счётчика: длина текста после перелистывания почти та же,
    // и «тишина» наступает раньше, чем приедут новые строки.
    const t0 = Date.now();
    let changed = false;
    while (Date.now() - t0 < 20000) {
      await sleep(350);
      if ((await page.evaluate(READ_PAGING)).map((p) => p.text).join(' // ') !== before) { changed = true; break; }
    }
    await settle(page, { maxMs: 12000, quietMs: 500 });
    if (!changed) done.add(target.i); // кнопка активна, но грид не двигается — больше не трогаем
    merge(await page.evaluate(READ_TABLES));
  }

  return [...acc.values()].map((g) => ({ caption: g.caption, context: g.context, headers: g.headers, rows: g.rows }));
}

// ================================================================== каскад ===

/** Клик по строке каскадной таблицы. Строка может быть на другой странице грида. */
async function clickCascadeRow(page, tableIndex, name, maxPages = 12) {
  for (let p = 0; p < maxPages; p++) {
    const row = page.locator('table').nth(tableIndex).locator('tbody tr').filter({ hasText: name }).first();
    if (await row.count().catch(() => 0)) {
      await row.click({ timeout: 8000 }).catch(() => {});
      return true;
    }
    const nexts = await page.evaluate(READ_NEXT);
    const n = nexts.find((x) => x.tableIndex === tableIndex && !x.disabled);
    if (!n) return false;
    await page.locator('[aria-label="Next page"]').nth(n.i).click({ timeout: 8000 }).catch(() => {});
    await settle(page, { maxMs: 12000, quietMs: 500 });
  }
  return false;
}

const cascadeKey = (t) => t.rows.map((r) => r.cells.find(Boolean) || '').join('|');

/**
 * После выбора шага каскада ждём, что портал ДЕЙСТВИТЕЛЬНО показал следующий шаг.
 * Без этого первая степень терялась: settle() успокаивался раньше, чем приезжала
 * таблица уровней, каскад выглядел «пустым», и ветка молча пропускалась.
 */
async function waitCascadeAdvance(page, beforeTables, maxMs = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const tables = await page.evaluate(READ_TABLES);
    const grew = tables.length > beforeTables;
    const hasData = tables.some((t) => !t.cascade && t.rows.length);
    const hasOpenCascade = tables.some((t) => t.cascade && t.rows.length && !t.selected.length);
    if (grew || hasData || hasOpenCascade) return true;
    await sleep(500);
  }
  return false;
}

/**
 * Рекурсивный обход каскада выбора. На каждом «листе» (когда открывать больше
 * нечего) снимает все данные-гриды и кладёт их в out вместе со следом выбора.
 */
async function drill(page, trail, out, depth) {
  const tables = await page.evaluate(READ_TABLES);
  const cascades = tables.filter((t) => t.cascade && t.rows.length);
  const open = cascades.find((t) => !t.selected.length);

  // Снимаем только «лист» каскада — когда открывать больше нечего.
  // На промежуточных шагах на экране ещё висят гриды предыдущей ветки,
  // и захват там давал программы, приписанные чужой степени (поймано на пробе).
  if (!open || depth >= MAX_DEPTH) {
    const grids = await harvestGrids(page);
    if (grids.length) {
      // След выбора берём из самого портала, а не из своих кликов: это защита
      // от гонки «кликнули B, на экране ещё A».
      const state = await page.evaluate(READ_TABLES);
      const selectedTrail = state.filter((t) => t.cascade).map((t) => t.selected[0] || null).filter(Boolean);
      out.push({ trail: [...trail], selectedTrail, grids });
    }
  }
  if (!open || depth >= MAX_DEPTH) return;

  const key = cascadeKey(open);
  const names = open.rows.map((r) => r.cells.find(Boolean)).filter(Boolean);
  for (const name of names) {
    // Таблицы могли переехать после предыдущей итерации — ищем свою заново по составу строк.
    const now = await page.evaluate(READ_TABLES);
    const t = now.find((x) => x.cascade && cascadeKey(x) === key);
    if (!t) break;
    if (!(await clickCascadeRow(page, t.index, name))) continue;
    await settle(page);
    await waitCascadeAdvance(page, now.length);

    // Если портал допускает множественный выбор — снимаем прежние отметки,
    // иначе следующий шаг каскада покажет смесь двух ветвей.
    const after = await page.evaluate(READ_TABLES);
    const t2 = after.find((x) => x.cascade && cascadeKey(x) === key);
    for (const selected of (t2?.selected || [])) {
      if (selected.startsWith(name)) continue;
      await clickCascadeRow(page, t2.index, selected);
      await settle(page);
    }

    await drill(page, [...trail, name], out, depth + 1);
  }
}

// ================================================================ стадия 1 ===

// Бейдж типа партнёрства приклеен к ячейке Institution («… (Postgraduate) University»),
// а колонка Partner Type в DOM пустая (там TagGroup без текста). Надёжный источник
// имени — текст record-ссылки; этот список нужен только для старых дампов.
const PARTNER_BADGES = ['University', 'Pathway', 'High School', 'Language School', 'College',
  'Boarding School', 'Vocational', 'Institute'];

/** Имя вуза без бейджа типа партнёрства. */
export function cleanInstitutionName(cell, partnerType, linkText) {
  if (linkText && linkText.length >= 3) return linkText.trim();
  let name = (cell || '').split('\n')[0].trim();
  for (const badge of [(partnerType || '').trim(), ...PARTNER_BADGES]) {
    if (!badge) continue;
    if (name.toLowerCase().endsWith(` ${badge.toLowerCase()}`)) {
      name = name.slice(0, name.length - badge.length).trim();
      break;
    }
  }
  return name.replace(/[\s·|,-]+$/, '').trim();
}

function parseListRow(row, headers) {
  const byLabel = {};
  headers.forEach((h, i) => { if (h) byLabel[h.toLowerCase()] = row.cells[i] ?? ''; });
  const get = (label, fallbackIdx) => byLabel[label] ?? row.cells[fallbackIdx] ?? '';
  const instCell = get('institution', 2);
  const name = cleanInstitutionName(instCell, get('partner type', 4), row.linkText);
  const m = (row.recordUrl || '').match(/\/record\/([^/]+)\//);
  return {
    name,
    institutionCell: instCell,
    linkText: row.linkText || null,
    recordUrl: row.recordUrl,
    recordRef: m ? m[1] : null,
    provider: get('provider', 3),
    partnerType: get('partner type', 4),
    country: get('country', 5),
    campuses: get('campuses', 6),
    educationLevels: get('education levels offered', 7),
    internationalStudents: get('international student count', 8),
    yearlyFees: get('yearly fees', 9),
    createdOn: get('created on', 10),
  };
}

async function stageList(page) {
  await say('стадия 1: список вузов');
  await gotoSafe(page, LIST_URL);
  await settle(page);
  if (await page.locator('input[type=password]').count()) throw new Error('session-lost');

  const grids = await harvestGrids(page, { includeCascade: true });
  const grid = grids.sort((a, b) => b.rows.length - a.rows.length)[0];
  if (!grid) throw new Error('грид списка не найден');

  const paging = await page.evaluate(READ_PAGING);
  const declared = paging.map((p) => p.total).filter(Boolean);
  const total = declared.length ? Math.max(...declared) : null;

  const rows = grid.rows.map((r) => parseListRow(r, grid.headers)).filter((r) => r.name && r.recordUrl);
  const seen = new Set();
  const uniq = rows.filter((r) => (seen.has(r.recordUrl) ? false : (seen.add(r.recordUrl), true)));

  const payload = {
    _meta: {
      source: 'QS Apply (Appian)',
      listUrl: LIST_URL,
      collectedAt: new Date().toISOString(),
      declaredTotal: total,
      collected: uniq.length,
      complete: total ? uniq.length >= total : null,
      headers: grid.headers,
    },
    institutions: uniq,
  };
  await fs.mkdir(OUT, { recursive: true });
  await fs.writeFile(path.join(OUT, 'institutions.json'), JSON.stringify(payload, null, 2) + '\n', 'utf8');
  await say(`список: собрано ${uniq.length}, портал объявил ${total ?? '—'}`);
  if (total && uniq.length < total) await say(`ВНИМАНИЕ: недобор ${total - uniq.length} строк`);
  return payload;
}

// ================================================================ стадия 2 ===

/**
 * Имя файла дампа: слаг имени + хвост record-ссылки.
 * Обрезать саму ссылку нельзя — у соседних вузов первые ~100 знаков совпадают
 * (поймано на пробе: два вуза писались в один файл).
 */
const idOf = (inst) => {
  const ref = ((inst.recordUrl || '').match(/\/record\/([^/]+)\//) || [])[1] || '';
  const tail = ref.slice(-12).replace(/[^A-Za-z0-9_-]/g, '');
  const name = norm(inst.name).replace(/\s+/g, '-').slice(0, 60) || 'unknown';
  return tail ? `${name}--${tail}` : name;
};

async function collectRecord(page, inst) {
  const url = inst.recordUrl;
  await gotoSafe(page, url);
  await settle(page);
  if (await page.locator('input[type=password]').count()) throw new Error('session-lost');

  const views = await page.evaluate(() => {
    const set = new Map();
    document.querySelectorAll('a[href*="/record/"]').forEach((a) => {
      const m = a.href.match(/\/record\/[^/]+\/view\/([a-z0-9_.-]+)/i);
      if (m && !set.has(m[1])) set.set(m[1], { name: m[1], href: a.href, label: (a.innerText || '').replace(/\s+/g, ' ').trim() });
    });
    return [...set.values()];
  });
  const order = [{ name: 'summary', href: url, label: 'Summary' }, ...views.filter((v) => v.name !== 'summary')].slice(0, 8);

  const out = { name: inst.name, url, collectedAt: new Date().toISOString(), views: [] };
  for (const v of order) {
    if (v.name !== 'summary') {
      await gotoSafe(page, v.href).catch(() => {});
      await settle(page);
    }
    const text = await page.evaluate(() => document.body.innerText.replace(/\n{2,}/g, '\n').slice(0, 40000));
    const view = { view: v.name, label: v.label, url: v.href, text, grids: [], captures: [] };

    const hasCascade = /Select a degree|Select a study level|List of Degrees/i.test(text);
    if (hasCascade) {
      await drill(page, [], view.captures, 0);
    } else {
      view.grids = await harvestGrids(page);
    }
    out.views.push(view);
  }
  return out;
}

async function stageRecords(browserCtx, list) {
  await say('стадия 2: карточки вузов');
  await fs.mkdir(RECORDS, { recursive: true });
  const done = new Set(REFRESH ? [] : (await fs.readdir(RECORDS).catch(() => [])).map((f) => f.replace(/\.json$/, '')));
  let queue = list.institutions.filter((i) => REFRESH || !done.has(idOf(i)));
  if (LIMIT) queue = queue.slice(0, LIMIT);
  await say(`к обходу ${queue.length} из ${list.institutions.length} (на диске ${done.size}), вкладок ${WORKERS}`);

  let cursor = 0; let ok = 0; let fail = 0;
  const t0 = Date.now();

  const worker = async (wid) => {
    const page = await browserCtx.newPage();
    page.setDefaultTimeout(30000);
    try {
      for (;;) {
        const n = cursor++;
        if (n >= queue.length) break;
        const inst = queue[n];
        const id = idOf(inst);
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const rec = await collectRecord(page, inst);
            rec.list = inst;
            await fs.writeFile(path.join(RECORDS, `${id}.json`), JSON.stringify(rec, null, 1), 'utf8');
            ok++;
            const rows = rec.views.reduce((s, v) => s
              + v.grids.reduce((x, g) => x + g.rows.length, 0)
              + v.captures.reduce((x, c) => x + c.grids.reduce((y, g) => y + g.rows.length, 0), 0), 0);
            const done2 = ok + fail;
            if (done2 % 10 === 0 || done2 === 1) {
              const rate = (Date.now() - t0) / done2;
              const eta = Math.round((queue.length - done2) * rate / 60000);
              await say(`[${done2}/${queue.length}] ${inst.name} — строк ${rows}; ETA ~${eta} мин`);
            }
            break;
          } catch (e) {
            if (e.message === 'session-lost' && attempt === 0) {
              await say(`w${wid}: сессия слетела — вход заново`);
              await login(page);
              continue;
            }
            fail++;
            await say(`ОШИБКА ${inst.name}: ${e.message}`);
            break;
          }
        }
      }
    } finally {
      await page.close().catch(() => {});
    }
  };

  await Promise.all(Array.from({ length: WORKERS }, (_, i) => worker(i + 1)));
  await say(`карточки: ок ${ok}, ошибок ${fail}`);
  return { ok, fail };
}

// ================================================================ стадия 3 ===

const EMPTY_ROW = /^(no items available|no .* to display|нет данных)$/i;
const PROGRAM_GRID = /name/i;
const COSTS_HEADERS = /accommodation cost|tuition cost|total cost/i;

const CURRENCY_WORDS = {
  'pound sterling': 'GBP', 'british pound': 'GBP', 'us dollar': 'USD', 'united states dollar': 'USD',
  euro: 'EUR', 'australian dollar': 'AUD', 'canadian dollar': 'CAD', 'new zealand dollar': 'NZD',
  'swiss franc': 'CHF', 'singapore dollar': 'SGD', 'uae dirham': 'AED', dirham: 'AED',
  'malaysian ringgit': 'MYR', 'japanese yen': 'JPY', 'hong kong dollar': 'HKD', 'irish euro': 'EUR',
};
const currencyOf = (s) => {
  const t = (s || '').toLowerCase().trim();
  if (CURRENCY_WORDS[t]) return CURRENCY_WORDS[t];
  const iso = t.match(/\b(gbp|usd|eur|aud|cad|nzd|chf|sgd|aed|myr|jpy|hkd)\b/);
  return iso ? iso[1].toUpperCase() : null;
};

const isProgramGrid = (g) => g.headers.some((h) => PROGRAM_GRID.test(h))
  && g.headers.some((h) => /program type|intake|stem|commission|application fee/i.test(h));
const isCostsGrid = (g) => g.headers.some((h) => COSTS_HEADERS.test(h));

function colIndex(headers, ...res) {
  for (const re of res) {
    const i = headers.findIndex((h) => re.test(h || ''));
    if (i !== -1) return i;
  }
  return -1;
}

/** Стоимости кампуса: одна строка Currency | Accommodation | Tuition | Other | Total. */
function costsFrom(grid) {
  const H = grid.headers;
  const r = grid.rows[0];
  if (!r) return null;
  const at = (re) => { const i = colIndex(H, re); return i >= 0 ? (r.cells[i] || '').trim() : ''; };
  const num = (s) => { const m = (s || '').replace(/[,\s]/g, '').match(/\d+(?:\.\d+)?/); return m ? Number(m[0]) : null; };
  const currency = currencyOf(at(/currency/i));
  return {
    currency,
    accommodation: num(at(/accommodation/i)),
    tuition: num(at(/tuition/i)),
    other: num(at(/other cost/i)),
    total: num(at(/total cost/i)),
    campus: campusOf(grid),
  };
}

/** Название кампуса из контекста грида: «Docklands campus - United Kingdom», а не подпись «Campus Costs». */
const campusOf = (grid) => (grid.context || [])
  .find((c) => /campus/i.test(c) && !/^(campus costs|programs?)$/i.test(c)) || null;

/** Программы одного грида. Цена берётся из стоимостей кампуса — она уровневая, не программная. */
function programsFrom(grid, { degree, studyLevel, campus, costs }) {
  const H = grid.headers;
  const iName = colIndex(H, /^name$/i, /program|course|title/i);
  const iType = colIndex(H, /program type/i);
  const iFee = colIndex(H, /application fee/i);
  const iIntake = colIndex(H, /intake/i);
  const iStem = colIndex(H, /stem/i);
  const out = [];
  for (const r of grid.rows) {
    const cell = (i) => (i >= 0 ? (r.cells[i] || '').trim() : '');
    const title = (cell(iName) || r.cells.find((c) => c && c.length > 4) || '').split('\n')[0].trim();
    if (!title || EMPTY_ROW.test(title)) continue;
    const appFee = parseMoney(cell(iFee));
    out.push({
      title,
      level: mapLevel(studyLevel, degree, title),
      sourceLevel: studyLevel || null,
      degreeGroup: degree || null,
      programType: cell(iType) || null,
      stem: iStem >= 0 ? /yes|true|✓/i.test(cell(iStem)) || null : null,
      applicationFee: appFee ? appFee.amount : null,
      applicationFeeCurrency: appFee ? appFee.currency : null,
      // «View Intakes» — это подпись ссылки, а не даты: дат в гриде нет.
      intakeNote: /^view\b/i.test(cell(iIntake)) ? null : (cell(iIntake) || null),
      campuses: campus ? [campus] : [],
      tuition: costs?.tuition ?? null,
      currency: costs?.currency ?? null,
      feeBasis: costs?.tuition ? 'campusLevelStated' : null,
      campusCosts: costs || null,
      programUrl: r.recordUrl || null,
      raw: r.cells,
    });
  }
  return out;
}

function programsOfRecord(rec) {
  const programs = [];
  const byKey = new Map();
  for (const v of rec.views) {
    for (const cap of v.captures || []) {
      // Приоритет — фактический выбор портала, а не наши клики.
      const path = (cap.selectedTrail?.length ? cap.selectedTrail : cap.trail) || [];
      const [degree = null, studyLevel = null] = path;
      // Стоимости и программы идут парами по кампусам — связываем по контексту грида.
      const costsGrids = cap.grids.filter(isCostsGrid);
      for (const g of cap.grids) {
        if (!isProgramGrid(g)) continue;
        const campus = campusOf(g);
        const costs = costsGrids.find((c) => campusOf(c) === campus)
          || (costsGrids.length === 1 ? costsGrids[0] : null);
        for (const p of programsFrom(g, { degree, studyLevel, campus, costs: costs ? costsFrom(costs) : null })) {
          const k = `${degree}##${studyLevel}##${p.title}`;
          const seen = byKey.get(k);
          if (seen) {
            for (const c of p.campuses) if (!seen.campuses.includes(c)) seen.campuses.push(c);
            continue;
          }
          byKey.set(k, p); programs.push(p);
        }
      }
    }
    for (const g of v.grids || []) {
      if (!isProgramGrid(g)) continue;
      for (const p of programsFrom(g, {})) {
        const k = `##${p.title}`;
        if (byKey.has(k)) continue;
        byKey.set(k, p); programs.push(p);
      }
    }
  }
  return programs;
}

/** Поля карточки из текста вкладки Summary: «Метка \n значение». */
function summaryFields(rec) {
  const sum = rec.views.find((v) => /summary/i.test(v.label || v.view));
  if (!sum) return {};
  const lines = sum.text.split('\n').map((s) => s.trim()).filter(Boolean);
  const after = (label) => {
    const i = lines.findIndex((l) => l.toLowerCase() === label.toLowerCase());
    return i >= 0 && lines[i + 1] ? lines[i + 1] : null;
  };
  const desc = (() => {
    const i = lines.findIndex((l) => /^description$/i.test(l));
    return i >= 0 ? lines.slice(i + 1, i + 4).join(' ').slice(0, 2000) : null;
  })();
  return {
    ownership: after('Ownership'),
    foundedYear: after('Founded Year'),
    providerName: after('Provider'),
    typeStated: after('Type'),
    countryStated: after('Country'),
    description: desc,
  };
}

const slugify = (s) => norm(s).replace(/\s+/g, '-').slice(0, 80);

async function stageExtract() {
  await say('стадия 3: разбор дампов в схему КОМПАСа');
  const files = (await fs.readdir(RECORDS).catch(() => [])).filter((f) => f.endsWith('.json'));
  if (!files.length) { await say('дампов нет — стадия 3 пропущена'); return null; }
  const catalog = await buildCatalogIndex();

  const membership = [];
  const usedSlugs = new Set();
  const counts = { records: 0, withPrograms: 0, programs: 0, withPrice: 0, matched: 0, unmatched: 0, noProgramGrid: 0 };
  const gridShapes = new Map();

  for (const f of files) {
    const rec = JSON.parse(await fs.readFile(path.join(RECORDS, f), 'utf8'));
    counts.records++;
    for (const v of rec.views) {
      const label = v.label || v.view;
      const all = [...(v.grids || []), ...(v.captures || []).flatMap((c) => c.grids)];
      for (const g of all) {
        const k = `${label} :: ${g.headers.join(' | ')}`;
        gridShapes.set(k, (gridShapes.get(k) || 0) + g.rows.length);
      }
    }

    const programs = programsOfRecord(rec);
    if (!programs.length) counts.noProgramGrid++; else counts.withPrograms++;
    counts.programs += programs.length;
    counts.withPrice += programs.filter((p) => p.tuition).length;

    const li = rec.list || {};
    const fields = summaryFields(rec);
    const country = li.country || fields.countryStated || null;
    // Имя чистим и здесь: дампы, снятые до правки списка, хранят его с бейджем типа.
    const name = cleanInstitutionName(li.institutionCell || rec.name, li.partnerType, li.linkText);
    const hit = matchToCatalog(name, catalog, { country });
    if (hit.catalogSlug) counts.matched++; else counts.unmatched++;
    // Имя файла — слаг СТОРОНЫ QS, не каталога: у портала «UEL (Postgraduate)» и
    // «UEL (Undergraduate)» — две карточки, обе сходятся в один слаг каталога,
    // и вторая затирала первую (поймано на пробе). Привязка живёт полем catalogSlug.
    let slug = slugify(name);
    if (usedSlugs.has(slug)) {
      const tail = ((rec.url || '').match(/\/record\/([^/]+)\//) || [])[1]?.slice(-8) || String(counts.records);
      slug = `${slug}-${tail.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    }
    usedSlugs.add(slug);

    await writeExtract('qs', slug, mkExtract({
      slug,
      name,
      source: 'qs-apply',
      sourceUrl: rec.url,
      programs,
      extra: {
        aggregator: 'QS Apply',
        access: 'partner-login',
        country,
        provider: li.provider || fields.providerName || null,
        partnerType: li.partnerType || fields.typeStated || null,
        campusesStated: li.campuses || null,
        educationLevels: li.educationLevels || null,
        internationalStudents: li.internationalStudents || null,
        yearlyFeesStated: li.yearlyFees || null,
        ownership: fields.ownership || null,
        foundedYear: fields.foundedYear || null,
        description: fields.description || null,
        catalogSlug: hit.catalogSlug,
        matchMethod: hit.matchMethod,
        feeNote: 'tuition — стоимость обучения кампуса для выбранного уровня (Campus Costs), '
          + 'а не цена конкретной программы; портал программных цен не показывает',
      },
    }));

    membership.push({
      name, slug, catalogSlug: hit.catalogSlug, matchMethod: hit.matchMethod,
      country, partnerType: li.partnerType || null, provider: li.provider || null,
      programs: programs.length, url: rec.url,
    });
  }

  await writeMembership('qs', {
    _meta: {
      aggregator: 'qs', label: 'QS Apply', source: LIST_URL,
      collectedAt: new Date().toISOString(), access: 'partner-login',
      notes: [
        'Портал Appian/SAIL: POST-ответы — дельты интерфейса, строки снимаются с DOM.',
        'Программы лежат за каскадом Degree -> Study Level -> кампус; коллектор прокликивает каскад целиком.',
        'Цена — уровневая (Campus Costs), программных цен портал не показывает; feeBasis=campusLevelStated.',
        'Уровни и деньги нормализованы общими разборщиками lib/kompas-collect.mjs, ничего не выдумано.',
      ],
      counts,
    },
    institutions: membership,
  });

  await fs.writeFile(path.join(OUT, 'grid-shapes.json'),
    JSON.stringify([...gridShapes.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ grid: k, rows: n })), null, 2), 'utf8');
  await say(`разбор: вузов ${counts.records}, с программами ${counts.withPrograms}, программ ${counts.programs}, `
    + `с ценой ${counts.withPrice}, привязано к каталогу ${counts.matched}`);
  return counts;
}

// =================================================================== вход ====

async function login(page) {
  await gotoSafe(page, `${BASE}/suite/sites/qs-apply`);
  await sleep(2500);
  if (!(await page.locator('input[type=password]').count())) return;
  const findSel = async (list) => {
    for (const s of list) if (await page.locator(s).count().catch(() => 0)) return s;
    return null;
  };
  const userSel = await findSel(['input[type=email]', 'input[id*=user i]', 'input[placeholder*="user" i]', 'input[type=text]']);
  if (!userSel) throw new Error('форма входа не опознана');
  await page.locator(userSel).first().fill(process.env.QS_LOGIN);
  await page.locator('input[type=password]').first().fill(process.env.QS_PASS);
  try { await page.locator('button[type=submit], input[type=submit], button:has-text("Sign In")').first().click({ timeout: 6000 }); }
  catch { await page.locator('input[type=password]').first().press('Enter'); }
  await sleep(6000);
  const body = (await page.evaluate(() => document.body.innerText)).toLowerCase();
  if (/invalid|incorrect|not recognised/.test(body)) throw new Error('портал отклонил учётные данные');
  if (await page.locator('input[type=password]').count()) throw new Error('после входа снова форма пароля');
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  await say(`СТАРТ ${process.argv.slice(2).join(' ') || '(полный прогон)'}`);

  if (EXTRACT_ONLY) { await stageExtract(); return; }

  await loadEnv();
  if (!process.env.QS_LOGIN || !process.env.QS_PASS) throw new Error('нет QS_LOGIN/QS_PASS в scraper/.env');

  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: !HEADED });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1100 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);

  try {
    await login(page);
    await say('вход выполнен');

    const listPath = path.join(OUT, 'institutions.json');
    let list = null;
    if (!REFRESH) list = await fs.readFile(listPath, 'utf8').then(JSON.parse).catch(() => null);
    if (!list || !list.institutions?.length) list = await stageList(page);
    else await say(`список взят с диска: ${list.institutions.length} вузов`);

    await page.close().catch(() => {});
    if (!LIST_ONLY) await stageRecords(ctx, list);
  } finally {
    await ctx.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  if (!LIST_ONLY) await stageExtract();
  await say('ГОТОВО');
}

main().catch(async (e) => { await say(`ФАТАЛЬНО: ${e.message}`); console.error(e); process.exit(1); });
