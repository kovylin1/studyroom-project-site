#!/usr/bin/env node
// kompas-adopt-fees.mjs — P2 (часть в, применение): адаптировать цену источником
// там, где расхождение каталог vs источник >25%.
//
// Решение владельца 2026-07-25: «адаптировать цену источником». Для расхождений
// выше порога (как СОРОКА) записываем сумму источника в каталог. Ниже 25% —
// округление/курс/скидка, не трогаем. Валюта совпадает (расхождение валюты — это
// отдельный класс, сюда не попадает), поэтому меняется только СУММА.
//
// Старые значения в бэкап (откат одной командой). Идемпотентно: после адаптации
// пара совпадает и в следующий замер уже не попадает. Работает на КОПИИ catalog-work.
//
// Запуск: node kompas-adopt-fees.mjs [--apply] [--threshold=25]

import fs from 'node:fs/promises';
import path from 'node:path';
import { KOMPAS_DIR, args, logger } from './lib/kompas-collect.mjs';
import { WORK_DIR, readJson, loadSourceIndex, resolveAssignment, diffUniversity } from './lib/kompas-diff-core.mjs';

const log = logger('adopt-fees');
const APPLY = args.has('apply');
const THRESHOLD = Number((process.argv.find((a) => a.startsWith('--threshold=')) || '').slice(12)) || 25;
const now = new Date().toISOString();
const BACKUP_FILE = path.join(KOMPAS_DIR, 'fee-adopt-backup.json');

async function main() {
  if (!APPLY) log('СУХОЙ ПРОГОН: только считаю. Для записи добавь --apply');
  const map = await readJson(path.join(KOMPAS_DIR, 'partner-source-map.json')) ?? {};
  const { index } = await loadSourceIndex();
  const files = (await fs.readdir(WORK_DIR)).filter((f) => f.endsWith('.json'));

  const changed = {};   // slug -> { programSlug: { from, to } }
  let adopted = 0, unisTouched = 0;
  const top = [];

  for (const f of files) {
    const slug = f.replace(/\.json$/, '');
    const card = await readJson(path.join(WORK_DIR, f));
    if (!card) continue;
    const { ps, ready } = resolveAssignment(card, slug, map);
    if (ps.type === 'none') continue;
    const entries = (index.get(slug) ?? []).filter((e) => ready.includes(e.src));
    if (!entries.length) continue;

    const d = diffUniversity(card, entries);
    const big = d.feeMismatch.filter((m) => m.rel > THRESHOLD);
    if (!big.length) continue;

    const bp = card.tuition?.byProgram ?? {};
    let n = 0;
    for (const m of big) {
      if (bp[m.slug] === undefined) continue;       // цены в каталоге нет — это P2a, не сюда
      if (bp[m.slug] === m.source) continue;         // уже адаптировано
      (changed[slug] ??= {})[m.slug] = { from: bp[m.slug], to: m.source };
      if (APPLY) bp[m.slug] = m.source;
      n++; adopted++;
    }
    if (n) {
      unisTouched++;
      top.push({ slug, name: card.name, adopted: n });
      if (APPLY) {
        card.lastChecked = now.slice(0, 10);
        await fs.writeFile(path.join(WORK_DIR, f), JSON.stringify(card, null, 2) + '\n', 'utf8');
      }
    }
  }

  top.sort((a, b) => b.adopted - a.adopted);

  if (APPLY) {
    const prev = (await readJson(BACKUP_FILE))?.changed ?? {};
    for (const [s, obj] of Object.entries(changed)) prev[s] = { ...(prev[s] ?? {}), ...obj };
    const total = Object.values(prev).reduce((a, o) => a + Object.keys(o).length, 0);
    await fs.writeFile(BACKUP_FILE, JSON.stringify({
      generatedAt: now, threshold: THRESHOLD,
      note: `P2: адаптировано цен источником при расхождении >${THRESHOLD}%. Откат: вернуть from в tuition.byProgram.`,
      summary: { unis: Object.keys(prev).length, prices: total },
      changed: prev,
    }, null, 2) + '\n', 'utf8');
  }

  console.table(top.slice(0, 15));
  console.log(`АДАПТИРОВАНО цен ${adopted} у ${unisTouched} вузов (порог >${THRESHOLD}%)`);
  console.log(APPLY ? 'ПРИМЕНЕНО к catalog-work + бэкап fee-adopt-backup.json' : 'СУХОЙ ПРОГОН — для записи добавь --apply');
}

main().catch((e) => { console.error(e); process.exit(1); });
