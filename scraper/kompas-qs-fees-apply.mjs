#!/usr/bin/env node
// Применение кампусных цен QS в рабочую копию каталога по результату замера
// (scraper/kompas-qs-fee-basis.mjs → sources/kompas/qs-fee-basis-map.json).
//
// Пишутся суммы разрядов `annual` и `whole-term`. Разница в подписи: у
// whole-term проставляется program.tuitionBasis = 'program', и вёрстка пишет
// «за всю программу» вместо «/год», а сама сумма исключается из «от … в год»
// (site/src/lib/tuition.ts). Без этого признака whole-term завысил бы ценник
// вуза в 2-4 раза. annual-loose и currency-mismatch — отдельным списком оператору.
//
// По умолчанию цены НЕ перезаписываются: заполняются только пустые места.
// --overwrite — писать поверх существующих. Решение владельца 23.08: цена агрегатора
//   важнее каталожной, поэтому штатный режим применения теперь именно --overwrite.
// --dry — ничего не писать, только отчёт.
//
// Запуск: node scraper/kompas-qs-fees-apply.mjs [--dry] [--overwrite]

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const QS_DIR = path.join(ROOT, 'sources/kompas/extracts/qs');
const WORK_DIR = path.join(ROOT, 'sources/kompas/catalog-work');
const MAP_FILE = path.join(ROOT, 'sources/kompas/qs-fee-basis-map.json');
const BACKUP = path.join(ROOT, 'sources/kompas/qs-fees-apply-backup.json');
const REPORT = path.join(ROOT, 'sources/kompas/qs-fees-apply-report.json');
const CASES = path.join(ROOT, 'sources/kompas/qs-fees-apply-cases.json');
const REPORT_MD = path.join(ROOT, 'sources/kompas/QS-FEES-APPLY.md');

const DRY = process.argv.includes('--dry');
const OVERWRITE = process.argv.includes('--overwrite');

// валюты, которые принимает site/src/schema/university.ts
const CURRENCIES = ['USD', 'EUR', 'GBP', 'KZT', 'RUB', 'CAD', 'AUD', 'NZD', 'CHF', 'AED', 'HKD', 'THB', 'CNY'];

const norm = (s) => String(s || '')
  .toLowerCase()
  .replace(/[’'`]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const mapRows = JSON.parse(await fs.readFile(MAP_FILE, 'utf8'));
// (slug, currency, tuition) → разряд
const basisOf = new Map();
for (const m of mapRows) basisOf.set(m.slug + '|' + (m.currency || '?') + '|' + m.tuition, m);

const files = (await fs.readdir(QS_DIR)).filter(f => f.endsWith('.json')).sort();

const backup = {};        // catalogSlug → прежние tuition и метки основы (для отката)
const changes = [];       // что записали
const cases = [];         // что не записали и почему
const stats = {
  extracts: files.length,
  extractsLinked: 0,
  cardsTouched: 0,
  written: 0,
  wholeTerm: 0,
  keptExisting: 0,
  overwritten: 0,
  skippedBucket: 0,
  skippedCurrency: 0,
  skippedNoMatch: 0,
  skippedNoCard: 0,
};
const cardCache = new Map();

async function loadCard(slug) {
  if (cardCache.has(slug)) return cardCache.get(slug);
  let card = null;
  try {
    card = JSON.parse(await fs.readFile(path.join(WORK_DIR, slug + '.json'), 'utf8'));
  } catch { card = null; }
  cardCache.set(slug, card);
  return card;
}

for (const f of files) {
  let data;
  try { data = JSON.parse(await fs.readFile(path.join(QS_DIR, f), 'utf8')); } catch { continue; }
  const catalogSlug = data.catalogSlug;
  if (!catalogSlug) continue;
  stats.extractsLinked++;

  const card = await loadCard(catalogSlug);
  if (!card) {
    stats.skippedNoCard++;
    cases.push({ extract: f, catalogSlug, reason: 'no-card', note: 'карточки нет в рабочей копии' });
    continue;
  }

  const progs = Array.isArray(card.programs) ? card.programs : [];
  // индексы для сопоставления программ выгрузки с программами карточки
  const byUrl = new Map();
  const byTitle = new Map();
  for (const p of progs) {
    if (p.programUrl && !byUrl.has(p.programUrl)) byUrl.set(p.programUrl, p);
    const k = norm(p.title);
    if (k && !byTitle.has(k)) byTitle.set(k, p);
  }

  if (!card.tuition) card.tuition = { currency: null, byProgram: {} };
  if (!card.tuition.byProgram) card.tuition.byProgram = {};

  let touched = false;
  const before = JSON.stringify({
    tuition: card.tuition,
    tuitionBasis: Object.fromEntries(progs.filter(p => p.tuitionBasis).map(p => [p.slug, p.tuitionBasis])),
  });

  for (const ep of (data.programs || [])) {
    const t = (typeof ep.tuition === 'number') ? ep.tuition : null;
    if (t == null || t <= 0) continue;
    const cur = ep.currency || null;
    const m = basisOf.get((data.slug || f.replace(/\.json$/, '')) + '|' + (cur || '?') + '|' + t);
    const bucket = m ? m.bucket : 'unknown';

    // невозможный срок: у Oxford Int. NA Pathway годовой диапазон 250-250 (это
    // сбор, а не цена), отношение 196 — такое писать нельзя ни с какой подписью
    if (bucket === 'whole-term' && m && m.ratio > 12) {
      stats.skippedBucket++;
      cases.push({
        extract: f, catalogSlug, program: ep.title, tuition: t, currency: cur,
        bucket, ratio: m.ratio, reason: 'whole-term-implausible',
        note: 'отношение к годовому диапазону ' + m.ratio + ' — диапазон источника мусорный',
      });
      continue;
    }

    if (bucket !== 'annual' && bucket !== 'whole-term') {
      stats.skippedBucket++;
      cases.push({
        extract: f, catalogSlug, program: ep.title, tuition: t, currency: cur,
        bucket, reason: 'bucket', note: 'не разряд annual — оператору',
      });
      continue;
    }

    // валюта: карточка держит ОДНУ валюту на все программы
    const cardCur = card.tuition.currency || null;
    if (!CURRENCIES.includes(cur)) {
      stats.skippedCurrency++;
      cases.push({ extract: f, catalogSlug, program: ep.title, tuition: t, currency: cur, reason: 'currency-unsupported', note: 'валюты нет в схеме' });
      continue;
    }
    if (cardCur && cardCur !== cur) {
      stats.skippedCurrency++;
      cases.push({ extract: f, catalogSlug, program: ep.title, tuition: t, currency: cur, reason: 'currency-conflict', note: 'валюта карточки ' + cardCur });
      continue;
    }

    const target = (ep.programUrl && byUrl.get(ep.programUrl)) || byTitle.get(norm(ep.title)) || null;
    if (!target || !target.slug) {
      stats.skippedNoMatch++;
      cases.push({ extract: f, catalogSlug, program: ep.title, tuition: t, currency: cur, reason: 'no-match', note: 'программа выгрузки не нашлась в карточке' });
      continue;
    }

    const prev = card.tuition.byProgram[target.slug];
    if (prev != null && prev > 0 && !OVERWRITE) {
      stats.keptExisting++;
      if (Math.abs(prev - t) / Math.max(prev, t) > 0.02) {
        cases.push({
          extract: f, catalogSlug, program: target.slug, title: target.title,
          catalogFee: prev, qsFee: t, currency: cur, reason: 'fee-mismatch',
          note: 'у программы уже есть цена каталога, QS даёт другую — решение 3.3',
        });
      }
      continue;
    }

    if (!card.tuition.currency) card.tuition.currency = cur;
    if (!touched) { backup[catalogSlug] = JSON.parse(before); touched = true; stats.cardsTouched++; }
    if (prev != null && prev > 0) stats.overwritten++;
    card.tuition.byProgram[target.slug] = t;
    if (bucket === 'whole-term') {
      target.tuitionBasis = 'program';
      stats.wholeTerm++;
    }
    stats.written++;
    changes.push({ catalogSlug, program: target.slug, fee: t, currency: cur, basis: bucket === 'whole-term' ? 'program' : 'year', prev: prev != null ? prev : null });
  }

  if (touched && !DRY) {
    await fs.writeFile(path.join(WORK_DIR, catalogSlug + '.json'), JSON.stringify(card, null, 2));
  }
}

if (!DRY) {
  await fs.writeFile(BACKUP, JSON.stringify(backup, null, 2));
}
await fs.writeFile(REPORT, JSON.stringify({ dry: DRY, overwrite: OVERWRITE, stats, changes }, null, 2));
await fs.writeFile(CASES, JSON.stringify(cases, null, 2));

const byReason = {};
for (const c of cases) byReason[c.reason] = (byReason[c.reason] || 0) + 1;

let md = '# Применение цен QS\n\n';
md += (DRY ? '**Прогон вхолостую (--dry), ничего не записано.**\n\n' : '') ;
md += 'Источник: `sources/kompas/qs-fee-basis-map.json`. Пишется только разряд `annual` —\n';
md += 'сайт подписывает любое число из `tuition.byProgram` как цену за год (`card.perYear`).\n';
md += (OVERWRITE ? 'Режим: **перезапись существующих цен**.\n\n' : 'Режим: заполняются только пустые места, существующие цены не трогаются.\n\n');
md += '| Показатель | Значение |\n|---|---:|\n';
for (const k of Object.keys(stats)) md += '| ' + k + ' | ' + stats[k] + ' |\n';
md += '\n## Не записано\n\n| Причина | Штук |\n|---|---:|\n';
for (const k of Object.keys(byReason).sort((a, b) => byReason[b] - byReason[a])) md += '| `' + k + '` | ' + byReason[k] + ' |\n';
md += '\nПодробности: `qs-fees-apply-cases.json`, откат: `qs-fees-apply-backup.json`.\n';
await fs.writeFile(REPORT_MD, md);

console.log(JSON.stringify(stats, null, 1));
console.log('cases:', JSON.stringify(byReason));
