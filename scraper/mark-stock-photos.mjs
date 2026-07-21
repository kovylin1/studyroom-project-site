#!/usr/bin/env node
// mark-stock-photos.mjs — разовая пометка стоковых фото.
// Карточки жилья/кампусов, чей img лежит в общей библиотеке /photos/_lib/,
// получают imgKind: 'stock'. Фото НЕ удаляются и не меняются — признак нужен
// срезу 3 (ОРЁЛ), чтобы адресно заменить их на реальные.
// Идемпотентен: повторный прогон не меняет ничего.
//
// Usage: node scraper/mark-stock-photos.mjs [--dry-run]

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_DIR = path.resolve(__dirname, '..', 'site/src/content/universities');
const DRY_RUN = process.argv.includes('--dry-run');
const isStock = (img) => typeof img === 'string' && img.startsWith('/photos/_lib/');

let files = 0, marked = 0;
for (const f of (await fs.readdir(CATALOG_DIR)).filter(x => x.endsWith('.json'))) {
  const p = path.join(CATALOG_DIR, f);
  const u = JSON.parse(await fs.readFile(p, 'utf8'));
  let touched = 0;
  for (const card of [...(u.accommodation || []), ...(u.campuses || [])]) {
    const want = isStock(card.img) ? 'stock' : null;
    if (want && card.imgKind !== want) { card.imgKind = want; touched++; }
  }
  if (touched && !DRY_RUN) await fs.writeFile(p, JSON.stringify(u, null, 2) + '\n');
  if (touched) { files++; marked += touched; }
}
console.log(JSON.stringify({ files, marked, dryRun: DRY_RUN }));
