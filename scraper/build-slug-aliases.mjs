#!/usr/bin/env node
// build-slug-aliases.mjs — строит карту алиасов «каталожный слаг → слаг(и) extract».
//
// Проблема: extracts иногда лежат под другим слагом, чем каталог
// (каталог `abertay` ↔ extract `abertay-university`, `bath` ↔ `university-of-bath`).
// loadExtracts() в soroka.mjs / merge-programs.mjs ищет файл строго по
// `<catalog-slug>.json`, поэтому такие вузы НЕ кросс-сверяются (тихая дыра).
//
// Решение: матчим по НОРМАЛИЗОВАННОМУ названию вуза внутри extract (надёжнее
// подстроки слага — не даёт ложных пар вроде arizona ↔ arizona-state). Пишем
// детерминированную карту в scraper/sources/slug-aliases.json; потребители
// (soroka, merge-programs) подмешивают алиасы к кандидатам файла.
//
// Запускать после изменения extracts/каталога. $0 LLM — чистый fs-проход.
//
// Usage: node scraper/build-slug-aliases.mjs [--dry-run]

import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const CATALOG_DIR = path.join(PROJECT_ROOT, 'site/src/content/universities');
const SOURCES_ROOTS = [path.join(PROJECT_ROOT, 'scraper/sources'), path.join(PROJECT_ROOT, 'sources')];
const EXTRACT_DIRS = ['edvoy-extracts', 'qahe-extracts', 'gedu-extracts', 'iapro-extracts', 'official-extracts'];
const OUT = path.join(PROJECT_ROOT, 'scraper/sources/slug-aliases.json');
const DRY_RUN = process.argv.includes('--dry-run');
const log = (...a) => process.stderr.write(`[slug-aliases] ${a.join(' ')}\n`);

// Нормализация названия: убираем регистр, диакритику и общие «шумовые» слова,
// чтобы «University of Bath» и «Bath» сошлись, но «Arizona» и «Arizona State» — нет.
const norm = (s) => String(s || '').toLowerCase().normalize('NFKD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/\b(university|the|of|college|institute|school)\b/g, '')
  .replace(/[^a-z0-9]/g, '').trim();

// catalog: slug → name
const cat = {};
for (const f of (await fs.readdir(CATALOG_DIR)).filter(f => f.endsWith('.json'))) {
  const s = f.replace(/\.json$/, '');
  try { cat[s] = JSON.parse(await fs.readFile(path.join(CATALOG_DIR, f), 'utf8')).name; } catch { /* skip */ }
}
const catSlugs = Object.keys(cat);

// per-dir index: set of file-slugs + map нормИмя → file-slug
const exIdx = {};
for (const d of EXTRACT_DIRS) {
  const slugs = new Set();
  const byName = new Map();
  for (const root of SOURCES_ROOTS) {
    const dir = path.join(root, d);
    if (!existsSync(dir)) continue;
    for (const f of (await fs.readdir(dir)).filter(f => f.endsWith('.json'))) {
      const s = f.replace(/\.json$/, '');
      slugs.add(s);
      try {
        const nm = JSON.parse(await fs.readFile(path.join(dir, f), 'utf8')).name;
        const key = norm(nm);
        // 1:1 only — если имя уже занято другим слагом, помечаем как неоднозначное (null).
        if (key) byName.set(key, byName.has(key) ? null : s);
      } catch { /* skip */ }
    }
  }
  exIdx[d] = { slugs, byName };
}

const aliases = {};
let hits = 0;
for (const cs of catSlugs) {
  const cnorm = norm(cat[cs]);
  if (!cnorm) continue;
  const set = new Set();
  for (const d of EXTRACT_DIRS) {
    const idx = exIdx[d];
    if (idx.slugs.has(cs)) continue;          // точный файл уже есть — алиас не нужен
    const cand = idx.byName.get(cnorm);
    if (cand && cand !== cs) set.add(cand);     // null (неоднозначно) отсекается
  }
  if (set.size) { aliases[cs] = [...set].sort(); hits += set.size; }
}

const sorted = Object.fromEntries(Object.entries(aliases).sort(([a], [b]) => a.localeCompare(b)));
const payload = {
  generatedBy: 'build-slug-aliases.mjs',
  note: 'catalog-slug → extract-slug(s); матч по нормализованному названию вуза',
  count: Object.keys(sorted).length,
  aliases: sorted,
};

log(`${catSlugs.length} catalog unis → ${Object.keys(sorted).length} с алиасами (${hits} dir-hits)`);
if (DRY_RUN) {
  log('dry-run: файл не записан');
} else {
  await fs.writeFile(OUT, JSON.stringify(payload, null, 2) + '\n');
  log(`✓ wrote ${path.relative(PROJECT_ROOT, OUT)}`);
}
