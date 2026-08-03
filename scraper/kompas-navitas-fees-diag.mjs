#!/usr/bin/env node
// kompas-navitas-fees-diag.mjs — замер, только чтение. Ничего не правит.
//
// Вопрос: сколько цен в живом каталоге у 10 британских вузов Navitas НЕ подтверждено
// ни одной партнёрской выгрузкой, то есть остались с литеральной сид-таблицы
// `seed-navitas-uk.mjs` (UK_FEE_BAND_BASE + feeBand вуза).
//
// Как сверяем. Совпадение цены со значением сид-полосы уликой НЕ считается: полосы
// круглые (24 500, 19 500), их значения случайно совпадают с настоящими ценами Edvoy.
// Единственная надёжная улика — программа каталога сошлась с записью выгрузки по
// нормализованному названию. Сошлась и цена та же → подтверждена; сошлась, а цена
// другая → расхождение; не сошлась вовсе → цене неоткуда взяться, кроме сида.
//
// Usage: node scraper/kompas-navitas-fees-diag.mjs [--list-unbacked]

import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const UNI_DIR = path.join(ROOT, 'site/src/content/universities');
const EXTRACT_DIR = path.join(ROOT, 'sources/kompas/extracts');
const SEED_FILE = path.join(ROOT, 'scraper/seed-navitas-uk.mjs');

const LIST = process.argv.includes('--list-unbacked');

export const NAVITAS_UK_SLUGS = [
  'anglia-ruskin', 'birmingham-city', 'brunel', 'hertfordshire', 'portsmouth',
  'robert-gordon', 'keele', 'manchester-met', 'swansea', 'plymouth',
];

// «BSc (Hons) Computer Science» → «bsc hons computer science»
export const normTitle = (s) => String(s || '')
  .toLowerCase()
  .replace(/[’']/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

export async function readSeedBands(slugs = NAVITAS_UK_SLUGS) {
  const src = await fs.readFile(SEED_FILE, 'utf8');
  const base = {};
  const baseBlock = src.match(/const UK_FEE_BAND_BASE = \{([\s\S]*?)\n\};/);
  if (baseBlock) for (const m of baseBlock[1].matchAll(/'?([\w-]+)'?:\s*(\d+)/g)) base[m[1]] = Number(m[2]);
  const bands = {};
  for (const slug of slugs) {
    const at = src.indexOf(`slug: '${slug}'`);
    const fb = at < 0 ? null : src.slice(at).match(/feeBand: \{([\s\S]*?)\n {4}\},/);
    const band = { ...base };
    if (fb) for (const m of fb[1].matchAll(/'?([\w-]+)'?:\s*(\d+)/g)) band[m[1]] = Number(m[2]);
    bands[slug] = band;
  }
  return bands;
}

// Все выгрузки по вузу: Map<нормализованное название, {fee, src}>
export async function extractIndex(slug) {
  const idx = new Map();
  if (!existsSync(EXTRACT_DIR)) return idx;
  for (const srcName of await fs.readdir(EXTRACT_DIR)) {
    const f = path.join(EXTRACT_DIR, srcName, `${slug}.json`);
    if (!existsSync(f)) continue;
    let j;
    try { j = JSON.parse(await fs.readFile(f, 'utf8')); } catch { continue; }
    for (const p of j.programs || j.items || []) {
      const key = normTitle(p.title || p.name);
      if (!key) continue;
      const fee = Number(p.tuition ?? p.fee ?? p.amount ?? 0);
      const prev = idx.get(key);
      // предпочитаем запись с ценой
      if (!prev || (!(prev.fee > 0) && fee > 0)) idx.set(key, { fee, src: srcName });
    }
  }
  return idx;
}

// Запуск напрямую (на Windows pathToFileURL даёт file:///D:/…, «file://»+путь не сходится).
if (process.argv[1] && import.meta.url === (await import('url')).pathToFileURL(process.argv[1]).href) {
  const bands = await readSeedBands();
  const totals = { programs: 0, backedSame: 0, backedDiff: 0, unbacked: 0, noPrice: 0 };
  const unbackedAll = [];

  console.log('slug                 прогр  подтв  расх  БЕЗ-ПОДТВ  без-цены  из-сид-полосы');
  for (const slug of NAVITAS_UK_SLUGS) {
    const f = path.join(UNI_DIR, `${slug}.json`);
    if (!existsSync(f)) { console.log(`${slug.padEnd(20)} нет карточки`); continue; }
    const u = JSON.parse(await fs.readFile(f, 'utf8'));
    const byProgram = u.tuition?.byProgram || {};
    const idx = await extractIndex(slug);
    const bandValues = new Set(Object.values(bands[slug] || {}));

    let same = 0, diff = 0, unbacked = 0, none = 0, inBand = 0;
    for (const p of u.programs || []) {
      const price = Number(byProgram[p.slug] ?? 0);
      if (!(price > 0)) { none++; continue; }
      const hit = idx.get(normTitle(p.title));
      if (hit && hit.fee > 0) { if (hit.fee === price) same++; else diff++; continue; }
      unbacked++;
      if (bandValues.has(price)) inBand++;
      unbackedAll.push({ slug, program: p.slug, title: p.title, price, inBand: bandValues.has(price) });
    }
    totals.programs += (u.programs || []).length;
    totals.backedSame += same; totals.backedDiff += diff;
    totals.unbacked += unbacked; totals.noPrice += none;

    console.log(
      `${slug.padEnd(20)} ${String((u.programs || []).length).padStart(5)} ${String(same).padStart(6)} ` +
      `${String(diff).padStart(5)} ${String(unbacked).padStart(10)} ${String(none).padStart(9)} ${String(inBand).padStart(14)}`,
    );
  }

  console.log(
    `\nИТОГО: программ ${totals.programs}; цена подтверждена выгрузкой ${totals.backedSame}; ` +
    `выгрузка знает программу, но цена другая ${totals.backedDiff}; ` +
    `НИЧЕМ НЕ ПОДТВЕРЖДЕНА ${totals.unbacked}; без цены (уже «уточняется») ${totals.noPrice}`,
  );
  console.log(`из неподтверждённых совпадает со значением сид-полосы: ${unbackedAll.filter(x => x.inBand).length}`);

  if (LIST) {
    console.log('\n— неподтверждённые —');
    for (const x of unbackedAll) console.log(`${x.slug}\t${x.program}\t${x.price}\t${x.inBand ? 'сид-полоса' : 'иное'}\t${x.title}`);
  }
}
