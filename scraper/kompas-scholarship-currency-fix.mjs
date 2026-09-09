#!/usr/bin/env node
// kompas-scholarship-currency-fix.mjs — задача 3.9.
//
// ЧТО ПОЧИНЕНО. Сборщик стипендий до 10.08 нормализовал голый «$» в «USD»,
// не глядя на страну вуза. В итоге канадская стипендия «$5 000» на сайте
// показана как 5 000 долларов США, австралийская — тоже. Сейчас сборщик
// читает «$» с оглядкой на страну (kompas-collect-scholarships.mjs), и 323
// из 341 выгрузки пересобраны в августе уже правильно.
//
// ЧТО ДЕЛАЕТ ЭТОТ СКРИПТ. Переносит исправленную сумму из выгрузки в каталог.
// Ничего не вычисляет и не додумывает: сумма берётся из выгрузки как есть,
// и только у тех записей, где каталог говорит USD, а выгрузка — уже нет.
// Меняется ровно поле amount, остальные поля стипендии не трогаются.
//
// Где выгрузка тоже осталась с USD (июльские сборы) — запись идёт в кейсы
// оператору: чинится только пересбором с офсайта, локальных данных нет.
//
// Запуск: node kompas-scholarship-currency-fix.mjs [--apply] [--live]
//   без флагов — сухой прогон;
//   --apply — писать в рабочую копию (sources/kompas/catalog-work);
//   --live  — писать ещё и в живой каталог (site/src/content/universities),
//            потому что врёт именно он.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXTRACTS = path.join(ROOT, 'sources/kompas/extracts/scholarships');
const WORK_DIR = path.join(ROOT, 'sources/kompas/catalog-work');
const LIVE_DIR = path.join(ROOT, 'site/src/content/universities');
const BACKUP = path.join(ROOT, 'sources/kompas/scholarship-currency-backup.json');
const REPORT = path.join(ROOT, 'sources/kompas/scholarship-currency-report.json');
const REPORT_MD = path.join(ROOT, 'sources/kompas/SCHOLARSHIP-CURRENCY.md');

const APPLY = process.argv.includes('--apply');
const LIVE = process.argv.includes('--live');

// Страны, где доллар США — законная валюта стипендии; их не трогаем вовсе.
const USD_COUNTRIES = new Set(['United States', 'Cayman Islands', 'Ecuador', 'Panama']);

const isUsd = (a) => /\bUSD\b|US\$/.test(a || '') || /(^|\s)\$\s?\d/.test(a || '');
const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9а-яё ]+/gi, ' ').replace(/\s+/g, ' ').trim();

async function readJson(p) {
  try { return JSON.parse(await fs.readFile(p, 'utf8')); } catch { return null; }
}

const extractCache = new Map();
async function extractFor(slug) {
  if (!extractCache.has(slug)) extractCache.set(slug, await readJson(path.join(EXTRACTS, slug + '.json')));
  return extractCache.get(slug);
}

const backup = {};
const changes = [];
const cases = [];
const stats = { dirs: 0, cards: 0, cardsTouched: 0, usdFound: 0, fixed: 0, casesLeft: 0 };

async function processDir(dir, label) {
  stats.dirs++;
  const files = (await fs.readdir(dir)).filter(f => f.endsWith('.json')).sort();
  for (const f of files) {
    const card = await readJson(path.join(dir, f));
    if (!card || !Array.isArray(card.scholarships) || !card.scholarships.length) continue;
    stats.cards++;
    if (USD_COUNTRIES.has(card.country)) continue;

    const bad = card.scholarships.filter(s => isUsd(s.amount));
    if (!bad.length) continue;

    const ex = await extractFor(card.slug || f.replace(/\.json$/, ''));
    const byName = new Map((ex?.scholarships || []).map(s => [norm(s.name), s]));

    let touched = false;
    for (const s of bad) {
      stats.usdFound++;
      const hit = byName.get(norm(s.name));
      const reason = !ex ? 'нет выгрузки по вузу'
        : !hit ? 'в выгрузке нет стипендии с таким названием'
        : isUsd(hit.amount) ? 'в выгрузке та же USD — нужен пересбор с офсайта'
        : null;

      if (reason) {
        stats.casesLeft++;
        cases.push({
          dir: label, slug: card.slug, country: card.country, name: s.name,
          amount: s.amount, extractAmount: hit ? hit.amount : null,
          scrapedAt: ex ? (ex.scrapedAt || '').slice(0, 10) : null, reason,
        });
        continue;
      }

      if (!touched) {
        backup[label + '/' + card.slug] = card.scholarships.map(x => ({ name: x.name, amount: x.amount }));
        touched = true;
        stats.cardsTouched++;
      }
      changes.push({ dir: label, slug: card.slug, country: card.country, name: s.name, from: s.amount, to: hit.amount });
      s.amount = hit.amount;
      stats.fixed++;
    }

    if (touched && APPLY) {
      await fs.writeFile(path.join(dir, f), JSON.stringify(card, null, 2));
    }
  }
}

await processDir(WORK_DIR, 'work');
if (LIVE) await processDir(LIVE_DIR, 'live');

if (APPLY) await fs.writeFile(BACKUP, JSON.stringify(backup, null, 2));
await fs.writeFile(REPORT, JSON.stringify({ apply: APPLY, live: LIVE, stats, changes }, null, 2));

const byCountry = {};
for (const c of changes) byCountry[c.country] = (byCountry[c.country] || 0) + 1;

let md = '# Валюта стипендий — 3.9\n\n';
if (!APPLY) md += '**Сухой прогон, ничего не записано.**\n\n';
md += 'Сумма берётся из выгрузки как есть; меняется только поле `amount` и только там,\n';
md += 'где каталог говорит USD, а пересобранная выгрузка — уже нет.\n\n';
md += '| Показатель | Значение |\n|---|---:|\n';
for (const k of Object.keys(stats)) md += '| ' + k + ' | ' + stats[k] + ' |\n';
md += '\n## Исправлено по странам\n\n| Страна | Сумм |\n|---|---:|\n';
for (const k of Object.keys(byCountry).sort((a, b) => byCountry[b] - byCountry[a])) md += '| ' + k + ' | ' + byCountry[k] + ' |\n';
md += '\n## Кейсы оператору (' + cases.length + ')\n\n| Вуз | Страна | Стипендия | В каталоге | В выгрузке | Сбор | Почему |\n|---|---|---|---|---|---|---|\n';
for (const c of cases.slice(0, 80)) {
  md += '| ' + c.slug + ' | ' + c.country + ' | ' + c.name + ' | ' + c.amount + ' | ' + (c.extractAmount || '—') + ' | ' + (c.scrapedAt || '—') + ' | ' + c.reason + ' |\n';
}
md += '\nОткат: `scholarship-currency-backup.json` (прежние суммы каждой изменённой карточки).\n';
await fs.writeFile(REPORT_MD, md);

console.log(JSON.stringify(stats, null, 1));
console.log('по странам:', JSON.stringify(byCountry));
console.log('примеры:', changes.slice(0, 5).map(c => c.slug + ': ' + c.from + ' → ' + c.to).join(' | '));
