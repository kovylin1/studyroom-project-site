#!/usr/bin/env node
// kompas-close-cases.mjs — закрытие кейсов панели по решениям владельца 2026-07-29.
// Ставит decision/decidedAt в исходных review-файлах (панель их сводит заново).
// Не трогает кейсы, где решение уже стоит. Идемпотентно.
// Запуск: node kompas-close-cases.mjs [--apply]

import fs from 'node:fs/promises';
import path from 'node:path';
import { KOMPAS_DIR, args } from './lib/kompas-collect.mjs';

const APPLY = args.has('apply');
const now = new Date().toISOString();

// файл → { issue: [decision, note] }
const PLAN = {
  'diff-review.json': {
    kompas_fee_mismatch: ['update', 'Решение 2026-07-29: в каталог записана цена источника (kompas-adopt-fees --threshold=2, 1720 цен у 98 вузов).'],
    kompas_fee_mismatch_rest: ['update', 'Решение 2026-07-29: цена источника (adopt-fees >2%).'],
    kompas_fee_absent: ['ignore', 'Решение 2026-07-29: у источника цены нет — на сайте честное «Уточняется».'],
  },
  'scholarship-review.json': {
    kompas_scholarship_untraceable: ['resolved', 'Решение 2026-07-29: непроверяемые сняты (kompas-scholarships-apply, откат scholarship-apply-backup.json).'],
  },
  'scholarship-diff-review.json': {
    kompas_scholarship_not_on_site: ['resolved', 'Решение 2026-07-29: не подтверждённое источником снято; matched/nearMiss/linked оставлены.'],
    kompas_scholarship_offsite_new: ['applied', 'Решение 2026-07-29: стипендии с офсайтов добавлены (1807 записей, source=official-site).'],
    kompas_scholarship_parse_junk: ['resolved', 'Брак разбора снят clean-скриптом (сессия 6).'],
  },
  'scholarship-clean-review.json': {
    kompas_scholarship_parse_junk_uni: ['resolved', 'Брак разбора снят clean-скриптом (сессия 6).'],
  },
  'navitas-fix-review.json': {
    kompas_navitas_price_fabricated: ['resolved', 'Фабрикованные цены сняты, подмена задеплоена 2026-07-29 (PR #52).'],
  },
  'oxfordintl-fix-review.json': {
    kompas_oxfordintl_price_fabricated: ['resolved', 'Сид-цены заменены настоящими с источника, задеплоено 2026-07-29 (PR #52).'],
  },
  'cards-review.json': {
    kompas_card_new_iapro: ['resolved', 'Карточки заведены в сессии 4.5, на проде с 2026-07-29.'],
    kompas_card_empty_contract_hub: ['resolved', 'Кейс устарел: карточки заполнены с офсайтов (Fleming-заход, 6/6), на проде.'],
  },
  'dupmerge-review.json': {
    kompas_dupe_merged: ['resolved', 'Слито в сессии 6, задеплоено 2026-07-29.'],
    kompas_dupe_dropped: ['resolved', 'Слито в сессии 6, задеплоено 2026-07-29.'],
  },
  'direct-review.json': {
    direct_fee_unlinked: ['resolved', 'Решение сессии 3.5: честно непривязываемые прайс-строки лежат в feeTable; уровневые привязаны (feeScope=level).'],
  },
};

let closed = 0, skipped = 0;
for (const [file, issues] of Object.entries(PLAN)) {
  const fp = path.join(KOMPAS_DIR, file);
  let j; try { j = JSON.parse(await fs.readFile(fp, 'utf8')); } catch { continue; }
  const items = j.items ?? j.cases ?? [];
  let touched = false;
  for (const it of items) {
    const plan = issues[it.issue];
    if (!plan) continue;
    if (it.decision) { skipped++; continue; }
    it.decision = plan[0];
    it.decidedAt = now;
    it.decisionNote = plan[1];
    closed++; touched = true;
  }
  if (touched && APPLY) await fs.writeFile(fp, JSON.stringify(j, null, 2) + '\n');
}
console.log(`закрыто: ${closed}, уже имели решение: ${skipped}${APPLY ? ' — ЗАПИСАНО' : ' — СУХОЙ ПРОГОН'}`);
