#!/usr/bin/env node
// kompas-fee-review.mjs — P2 (часть в): расхождения цены каталог vs источник → панель.
//
// Замер (порог 2%) даёт ~1800 расхождений — для панели это шум. Владелец задал
// порог как у СОРОКИ: значимо расхождение >25%. Ниже — округление/курс/скидка,
// не трогаем. Выше — кейс в /manager, где владелец решает поштучно (адоптировать
// цену источника или оставить). НИЧЕГО не перезаписываем автоматически: сумма —
// это не валюта, «источник прав» тут владельцем не объявлялся.
//
// Только читает catalog-work, пишет sources/kompas/fee-mismatch-review.json.
// Запуск: node kompas-fee-review.mjs [--threshold=25]

import fs from 'node:fs/promises';
import path from 'node:path';
import { KOMPAS_DIR, logger } from './lib/kompas-collect.mjs';
import { WORK_DIR, readJson, loadSourceIndex, resolveAssignment, diffUniversity } from './lib/kompas-diff-core.mjs';

const log = logger('fee-review');
const THRESHOLD = Number((process.argv.find((a) => a.startsWith('--threshold=')) || '').slice(12)) || 25;
const now = new Date().toISOString();

async function main() {
  const map = await readJson(path.join(KOMPAS_DIR, 'partner-source-map.json')) ?? {};
  const { index } = await loadSourceIndex();
  const files = (await fs.readdir(WORK_DIR)).filter((f) => f.endsWith('.json'));

  const cases = [];
  let above = 0, below = 0, unis = 0;

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
    below += d.feeMismatch.length - big.length;
    if (!big.length) continue;
    unis++;
    above += big.length;

    // По одному кейсу на программу, но не больше 20 на вуз (как в замере) —
    // остаток сводим, чтобы панель не захлебнулась (урок 9).
    const shown = big.slice(0, 20);
    for (const m of shown) {
      cases.push({
        id: `${slug}||kompas_fee_gap25||${m.slug}`,
        slug, name: card.name,
        issue: 'kompas_fee_gap25',
        severity: m.rel > 100 ? 'critical' : 'warning',
        detail: `«${m.program}»: каталог ${m.catalog} ${m.currency}, источник ${m.source} ${m.currency} (${m.via}), расхождение ${m.rel}%${m.basis ? `, основа источника: ${m.basis}` : ''}${m.audience ? `, аудитория: ${m.audience}` : ''}. Порог владельца >${THRESHOLD}%.`,
        catalog: m.catalog, official: m.source, currency: m.currency, program: m.program,
        checkedAt: now, decision: null, decidedAt: null, applied: false,
      });
    }
    if (big.length > shown.length) {
      cases.push({
        id: `${slug}||kompas_fee_gap25_rest||${big.length}`,
        slug, name: card.name,
        issue: 'kompas_fee_gap25_rest',
        severity: 'info',
        detail: `Ещё ${big.length - shown.length} расхождений >${THRESHOLD}% сверх показанных ${shown.length}. Полный список — diff-report.json.`,
        catalog: big.length, official: shown.length, program: null,
        checkedAt: now, decision: null, decidedAt: null, applied: false,
      });
    }
  }

  await fs.writeFile(path.join(KOMPAS_DIR, 'fee-mismatch-review.json'),
    JSON.stringify({ generatedAt: now, scope: 'kompas-fee-review', threshold: THRESHOLD,
      summary: { unis, above, belowThreshold: below, cases: cases.length }, items: cases }, null, 2) + '\n', 'utf8');

  log(`порог >${THRESHOLD}%: значимых расхождений ${above} у ${unis} вузов; ниже порога ${below} (не трогаем); кейсов ${cases.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
