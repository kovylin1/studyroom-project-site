#!/usr/bin/env node
// kompas-orphan-decisions-audit.mjs — разбор осиротевших решений оператора.
//
// Осиротевшее решение — то, которому в свежей сборке панели не нашлось кейса
// (`kompas-panel.mjs` складывает такие в `panel-orphan-decisions.json`). У всех 757
// стоял `applied: false`, и по этому флагу выходило, что 747 цен ждут применения.
//
// Флаг врал. В самих кейсах записано, чем всё кончилось:
// «Решение 2026-07-29: в каталог записана цена источника (kompas-adopt-fees
// --threshold=2, 1720 цен у 98 вузов)». Тот скрипт цены записал, а `applied` в кейсах
// не проставил — и следующая смена порога вымыла кейсы из части, оставив висеть флаг.
//
// Скрипт не правит каталог. Он сверяет каждое решение с живым каталогом и проставляет
// разряд:
//   already-applied — цена в каталоге равна цене решения: работа сделана 29.07;
//   pending         — цена расходится: решение и правда не применено;
//   summary-case    — кейс-сводка («ещё 68 расхождений»), у него нет своей программы;
//   ignore          — решение «пропустить»: применять нечего по определению;
//   program-gone    — программы, к которой относилось решение, в каталоге больше нет.
//
// Usage: node scraper/kompas-orphan-decisions-audit.mjs [--write]

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'sources/kompas/panel-orphan-decisions.json');
const CATALOG = path.join(ROOT, 'site/src/content/universities');
const WRITE = process.argv.includes('--write');

const cards = new Map();
async function card(slug) {
  if (cards.has(slug)) return cards.get(slug);
  const f = path.join(CATALOG, `${slug}.json`);
  let u = null;
  if (existsSync(f)) { try { u = JSON.parse(await fs.readFile(f, 'utf8')); } catch { u = null; } }
  cards.set(slug, u);
  return u;
}

/** Разряд одного решения. Чистая функция от кейса и карточки — ради теста. */
export function classify(item, uni) {
  if (item.decision === 'ignore') return 'ignore';
  const pslug = String(item.id ?? '').split('||')[2];
  if (!pslug || item.program == null) return 'summary-case';
  if (!uni) return 'program-gone';
  const cur = uni.tuition?.byProgram?.[pslug];
  if (cur == null) return 'program-gone';
  return Math.round(Number(cur)) === Math.round(Number(item.official)) ? 'already-applied' : 'pending';
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const j = JSON.parse(await fs.readFile(FILE, 'utf8'));
  const tally = {};
  const pending = [];

  for (const it of j.items) {
    const verdict = classify(it, await card(it.slug));
    tally[verdict] = (tally[verdict] ?? 0) + 1;
    it.orphanVerdict = verdict;
    if (verdict === 'already-applied') {
      it.applied = true;
      it.appliedNote = 'Сверено с живым каталогом 2026-08-03: цена совпадает с решением. Записана 29.07 скриптом kompas-adopt-fees --threshold=2, флаг applied тогда не проставили.';
    }
    if (verdict === 'pending') pending.push(it);
  }

  console.log('разбор осиротевших решений:');
  for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(16)} ${v}`);
  console.log(`\nтребуют правки каталога: ${pending.length}`);
  for (const p of pending.slice(0, 20)) console.log(`  ${p.slug} ${p.program} → ${p.official}`);

  if (WRITE) {
    j.auditedAt = new Date().toISOString();
    j.audit = tally;
    j.note = 'Решения оператора, которым в сборке панели не нашлось кейса. Разобраны '
      + 'kompas-orphan-decisions-audit.mjs: разряд в orphanVerdict. Каталог не правился.';
    await fs.writeFile(FILE, JSON.stringify(j, null, 2) + '\n', 'utf8');
    console.log('\nразряды записаны в panel-orphan-decisions.json');
  } else {
    console.log('\nсухой прогон — для записи разрядов добавь --write');
  }
}
