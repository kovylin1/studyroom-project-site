#!/usr/bin/env node
// kompas-fix-oxfordintl-prices.mjs — P0.3: снять сид-цены Oxford International.
//
// Диагноз (2026-07-24): seed-oxfordintl-uk.mjs раздавал цены из литеральной таблицы
// UK_FEE_BAND_BASE (как Navitas), у программ без поля source. В отличие от Navitas,
// по OI есть НАСТОЯЩИЕ цены в выгрузках sources/kompas/extracts/oxford-international/
// (kent, dundee, bradford, bangor, greenwich, sf-state и др.).
//
// Ход: зануляем фабрикованные сид-цены (программы без источника) — ложь уходит сразу.
// Настоящие цены НЕ теряются: выгрузки целы, их подтянет P2-добор. В кейсе к каждому
// вузу пишем, сколько реальных цен ждёт возврата. Программы не удаляем (правило 4),
// цены с реальным source не трогаем. Работа на копии catalog-work (правило 5).
//
// Запуск: node kompas-fix-oxfordintl-prices.mjs [--apply]

import fs from 'node:fs/promises';
import path from 'node:path';
import { KOMPAS_DIR, args, logger } from './lib/kompas-collect.mjs';

const log = logger('fix-oi');
const APPLY = args.has('apply');
const WORK = path.join(KOMPAS_DIR, 'catalog-work');
const OI = path.join(KOMPAS_DIR, 'extracts', 'oxford-international');
const now = new Date().toISOString();
const readJson = async (f) => JSON.parse(await fs.readFile(f, 'utf8'));

async function main() {
  if (!APPLY) log('СУХОЙ ПРОГОН: только считаю. Для записи добавь --apply');

  // Сколько реальных цен есть у OI по каждому вузу — для подсказки P2.
  const oiFee = new Map();
  try {
    for (const f of await fs.readdir(OI)) {
      if (!f.endsWith('.json')) continue;
      const d = await readJson(path.join(OI, f));
      const slug = d.catalogSlug ?? d.slug ?? f.replace(/\.json$/, '');
      const withFee = (d.programs ?? []).filter((p) => p.fee || p.tuition || p.price || p.feePerYear).length;
      oiFee.set(slug, withFee);
    }
  } catch { /* нет выгрузок — ок */ }

  const backup = {}; const cases = []; const rows = [];
  let totalRemoved = 0, totalKept = 0;

  for (const f of await fs.readdir(WORK)) {
    if (!f.endsWith('.json')) continue;
    const u = await readJson(path.join(WORK, f));
    const via = (u.partnerSource && u.partnerSource.via) || [];
    if (!via.includes('oxford-international')) continue;

    const slug = u.slug ?? f.replace(/\.json$/, '');
    const bp = (u.tuition && u.tuition.byProgram) || {};
    const bySlug = new Map((u.programs || []).map((p) => [p.slug, p]));
    const removed = {}; let kept = 0;

    for (const [pslug, price] of Object.entries(bp)) {
      const prog = bySlug.get(pslug);
      if (prog && prog.source) { kept++; continue; }   // реальный источник — не трогаем
      removed[pslug] = price; delete bp[pslug];
    }

    const n = Object.keys(removed).length;
    if (!n) continue;
    totalRemoved += n; totalKept += kept;
    const restore = oiFee.get(slug) || 0;
    rows.push({ slug, removed: n, kept, oiRestoreP2: restore });
    backup[slug] = removed;
    cases.push({
      id: `${slug}||kompas_oxfordintl_price_fabricated||${n}`,
      slug, name: u.name,
      issue: 'kompas_oxfordintl_price_fabricated',
      severity: 'critical',
      detail: `Снято ${n} сид-цен Oxford International (литерал UK_FEE_BAND_BASE, программы без источника). Программы сохранены, цена пустая. Настоящих цен сохранено: ${kept}. ${restore ? `P2-добор вернёт ~${restore} реальных цен из выгрузки OI.` : 'Реальных цен у OI по этому вузу нет — остаётся честно пусто.'} Откат — oxfordintl-price-backup.json.`,
      catalog: n, official: restore || null, program: null, sourceUrl: null,
      checkedAt: now, decision: null, decidedAt: null, applied: false,
    });

    if (APPLY) {
      u.tuition.byProgram = bp;
      u.lastChecked = now.slice(0, 10);
      await fs.writeFile(path.join(WORK, f), JSON.stringify(u, null, 2) + '\n', 'utf8');
    }
  }

  if (APPLY) {
    await fs.writeFile(path.join(KOMPAS_DIR, 'oxfordintl-price-backup.json'),
      JSON.stringify({ generatedAt: now, note: 'Снятые сид-цены Oxford International. Откат: вернуть в tuition.byProgram.', prices: backup }, null, 2) + '\n', 'utf8');
    await fs.writeFile(path.join(KOMPAS_DIR, 'oxfordintl-fix-review.json'),
      JSON.stringify({ generatedAt: now, scope: 'kompas-fix-oxfordintl-prices', summary: { total: cases.length, removed: totalRemoved, kept: totalKept }, items: cases }, null, 2) + '\n', 'utf8');
  }

  console.table(rows);
  console.log(`ИТОГО: снято сид-цен OI ${totalRemoved}, сохранено настоящих ${totalKept}, вузов ${rows.length}`);
  console.log(APPLY ? 'ПРИМЕНЕНО к catalog-work + бэкап + кейсы' : 'СУХОЙ ПРОГОН — для записи добавь --apply');
}

main().catch((e) => { console.error(e); process.exit(1); });
