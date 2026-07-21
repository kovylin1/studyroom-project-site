#!/usr/bin/env node
// bobr-apply.mjs — применяет решения оператора из bobr-review.json.
// Зеркало soroka-apply.mjs: тот же контракт, те же гарантии каталога.
//
//   decision=update + bobr_price_mismatch → ставит найденную на офсайте цену
//                                            (case.official) в карточку жилья
//   decision=delete + любой price-issue    → снимает поле price у карточки
//                                            (сама карточка ОСТАЁТСЯ — правило
//                                             «из каталога ничего не удалять»)
//   decision=ignore                        → только помечает applied=true
//   bobr_not_found / bobr_no_official_site / bobr_no_page → авто-фикса нет,
//                                            решение лишь помечает applied=true
//
// Usage: node scraper/bobr-apply.mjs [--dry-run]

import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const UNI_DIR = path.join(PROJECT_ROOT, 'site/src/content/universities');
const REVIEW_FILE = path.join(PROJECT_ROOT, 'site/public/api/bobr-review.json');
const DRY_RUN = process.argv.includes('--dry-run');
const log = (...a) => process.stderr.write(`[bobr-apply] ${new Date().toISOString().slice(11, 19)} ${a.join(' ')}\n`);

if (!existsSync(REVIEW_FILE)) { log('ERROR: bobr-review.json not found'); process.exit(1); }

const review = JSON.parse(await fs.readFile(REVIEW_FILE, 'utf8'));
const todo = (review.items || []).filter(it => it.decision && !it.applied);
log(`решений к применению: ${todo.length}`);

const stats = { priceUpdated: 0, priceCleared: 0, ignored: 0, noop: 0, missed: 0 };

function findCard(uni, item) {
  const list = item.domain === 'campuses' ? (uni.campuses || []) : (uni.accommodation || []);
  return list.find(c => (c.name || c.title) === item.card) || null;
}

for (const item of todo) {
  const p = path.join(UNI_DIR, `${item.slug}.json`);
  if (!existsSync(p)) { stats.missed++; continue; }
  const uni = JSON.parse(await fs.readFile(p, 'utf8'));
  const card = findCard(uni, item);
  let changed = false;

  if (item.decision === 'ignore') {
    stats.ignored++;
  } else if (!card) {
    stats.missed++;
  } else if (item.decision === 'update' && item.issue === 'bobr_price_mismatch' && item.official != null) {
    // Валюту/формат берём из существующей строки, меняем только число.
    card.price = String(card.price || '').replace(/\d[\d\s,.]*/, String(item.official));
    card.verifiedBySite = true;
    card.checkedAt = new Date().toISOString().slice(0, 10);
    stats.priceUpdated++; changed = true;
  } else if (item.decision === 'delete' && String(item.issue || '').startsWith('bobr_price')) {
    delete card.price;
    stats.priceCleared++; changed = true;
  } else {
    stats.noop++;
  }

  if (changed && !DRY_RUN) await fs.writeFile(p, JSON.stringify(uni, null, 2) + '\n');
  item.applied = true;
}

if (!DRY_RUN) await fs.writeFile(REVIEW_FILE, JSON.stringify(review, null, 2) + '\n');
console.log(JSON.stringify({ ...stats, total: todo.length, dryRun: DRY_RUN }));
