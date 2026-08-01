#!/usr/bin/env node
// kompas-sito-rollback.mjs — точечный откат СИТО по решению владельца 2026-08-01.
//
// СИТО считал обход офсайта «полным» при ≥8 найденных программах. Порог оказался
// слишком щедрым: у крупных вузов краулер снимал 10–50 программ из сотен, и СИТО
// вычищал живые программы (chester −701, brighton −403). Правило отката:
// офсайт нашёл < 25% программ карточки (offsite*4 < removed+left) → обход признаём
// недокраулом, снятые программы возвращаем С МЕТКОЙ catalog-only.
// Честные снятия (67 вузов) не трогаем.
//
// Запуск: node scraper/kompas-sito-rollback.mjs [--dry]

import fs from 'node:fs/promises';
import path from 'node:path';
import { KOMPAS_DIR, EXTRACTS_DIR, args } from './lib/kompas-collect.mjs';
import { WORK_DIR, readJson } from './lib/kompas-diff-core.mjs';

const DRY = args.has('dry');
const today = new Date().toISOString().slice(0, 10);
const log = (m) => console.log(`[sito-rollback] ${m}`);

const backup = await readJson(path.join(KOMPAS_DIR, 'sito-backup.json'));
const rolled = [];
let programsReturned = 0;

for (const [slug, entry] of Object.entries(backup.unis)) {
  const fp = path.join(WORK_DIR, `${slug}.json`);
  const card = await readJson(fp);
  if (!card) { log(`ПРОПУСК ${slug}: карточки нет`); continue; }
  const ex = await readJson(path.join(EXTRACTS_DIR, 'direct', `${slug}.json`));
  const offsite = ex?.programs?.length ?? 0;
  const removed = entry.programs.length;
  const left = (card.programs || []).length;
  if (offsite * 4 >= removed + left) continue; // обход честный — снятие остаётся

  // Возвращаем программы (метка catalog-only на них сохранилась в бэкапе) и цены.
  const have = new Set((card.programs || []).map((p) => p.slug));
  const back = entry.programs.filter((p) => !have.has(p.slug));
  for (const p of back) { p.kompasStatus = 'catalog-only'; p.kompasCheckedAt = today; }
  card.programs = [...(card.programs || []), ...back];
  if (entry.tuition && Object.keys(entry.tuition).length) {
    card.tuition = card.tuition || {};
    card.tuition.byProgram = { ...(card.tuition.byProgram || {}), ...entry.tuition };
  }
  if (!DRY) await fs.writeFile(fp, JSON.stringify(card, null, 2) + '\n');
  rolled.push({ slug, returned: back.length, offsite, left });
  programsReturned += back.length;
}

// Правим кейсы панели: у откаченных вузов кейс «снято» превращается в пояснение отката.
const review = await readJson(path.join(KOMPAS_DIR, 'sito-review.json'));
if (review?.items) {
  const rolledSet = new Set(rolled.map((r) => r.slug));
  for (const it of review.items) {
    if (it.issue === 'sito_programs_removed' && rolledSet.has(it.slug)) {
      it.issue = 'sito_rollback_undercrawl';
      it.severity = 'info';
      it.detail = `ОТКАЧЕНО ${today}: обход офсайта признан неполным (нашёл меньше четверти программ карточки), снятые программы возвращены с меткой catalog-only. Решение владельца 2026-08-01.`;
      it.checkedAt = today;
    }
  }
  if (!DRY) await fs.writeFile(path.join(KOMPAS_DIR, 'sito-review.json'), JSON.stringify(review, null, 2) + '\n');
}

if (!DRY) await fs.writeFile(path.join(KOMPAS_DIR, 'sito-rollback-report.json'), JSON.stringify({ generatedAt: new Date().toISOString(), rule: 'offsite*4 < removed+left', unis: rolled, programsReturned }, null, 2) + '\n');
log(`ИТОГ: откачено ${rolled.length} вузов, возвращено ${programsReturned} программ${DRY ? ' (DRY — без записи)' : ''}`);
