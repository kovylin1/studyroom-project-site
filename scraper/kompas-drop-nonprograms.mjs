#!/usr/bin/env node
// kompas-drop-nonprograms.mjs — снять из каталога строки, которые программами
// не являются: рекламные и служебные страницы сайтов вузов.
//
// Решение владельца 02.09.2026 по замеру kompas-junk-titles-diag.mjs: снять
// 252 рекламные строки у 80 карточек разом, а пересбор с офсайтов оставить
// прямым партнёрам. Это исключение из правила «из каталога ничего не удаляем»,
// принятое владельцем на конкретный разряд.
//
// Что снимается по умолчанию: разряды marketing, navigation, studyroom-stub,
// person-name. НЕ снимается `sentence` — там в основном настоящие длинные
// названия Kaplan со слипшимися колонками, и `html-entity` — тот разряд уже
// починен разворотом сущностей, а не удалением.
//
// Строка с ценой или сроком НЕ СНИМАЕТСЯ: на слаге программы висят
// tuition.byProgram и deadlines, и удаление осиротило бы их, уронив сборку.
// Такие строки уходят в отчёт отдельным списком.
//
// Правит живой каталог и рабочую копию (правило 3 плана). Откат — из бэкапа.
//
// Запуск: node kompas-drop-nonprograms.mjs [--apply] [--kinds=marketing,navigation]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyTitle } from './lib/junk-title.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = [
  path.join(ROOT, 'site/src/content/universities'),
  path.join(ROOT, 'sources/kompas/catalog-work'),
];
const BACKUP = path.join(ROOT, 'sources/kompas/nonprograms-drop-backup.json');
const REPORT = path.join(ROOT, 'sources/kompas/nonprograms-drop.json');
const APPLY = process.argv.includes('--apply');
const KINDS = new Set(
  ((process.argv.find((a) => a.startsWith('--kinds=')) || '--kinds=marketing,navigation,studyroom-stub,person-name')
    .split('=')[1]).split(',').map((s) => s.trim()).filter(Boolean),
);

const dropped = [];
const keptBecausePriced = [];
let filesTouched = 0;

for (const dir of DIRS) {
  if (!fs.existsSync(dir)) { console.log(`нет каталога: ${dir}`); continue; }
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const file = path.join(dir, f);
    let card;
    try { card = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { continue; }
    const priced = new Set(Object.keys(card.tuition?.byProgram || {}));
    const dated = new Set(Object.keys(card.deadlines || {}));
    const keep = [];
    let removedHere = 0;
    for (const p of card.programs || []) {
      const rule = classifyTitle(p.title);
      if (!rule || !KINDS.has(rule.kind)) { keep.push(p); continue; }
      if (priced.has(p.slug) || dated.has(p.slug)) {
        keptBecausePriced.push({ dir: path.basename(dir), slug: card.slug || f, program: p.slug, title: p.title, kind: rule.kind });
        keep.push(p);
        continue;
      }
      dropped.push({ dir: path.basename(dir), slug: card.slug || f, program: p.slug, title: p.title, kind: rule.kind, level: p.level, source: p.source });
      removedHere++;
    }
    if (!removedHere) continue;
    // Карточка без программ схему не проходит: programs.min(1). Такую не трогаем.
    if (!keep.length) {
      console.log(`  ПРОПУСК ${card.slug || f}: снялись бы ВСЕ ${removedHere} строк, карточка осталась бы пустой`);
      for (let i = 0; i < removedHere; i++) dropped.pop();
      continue;
    }
    card.programs = keep;
    filesTouched++;
    if (APPLY) fs.writeFileSync(file, JSON.stringify(card, null, 2) + '\n');
  }
}

const byKind = {};
for (const d of dropped) byKind[d.kind] = (byKind[d.kind] || 0) + 1;
const cards = new Set(dropped.map((d) => `${d.dir}/${d.slug}`));

if (APPLY) {
  fs.writeFileSync(BACKUP, JSON.stringify({ ranAt: new Date().toISOString(), dropped }, null, 2) + '\n');
  fs.writeFileSync(REPORT, JSON.stringify({
    ranAt: new Date().toISOString(), kinds: [...KINDS], byKind,
    droppedCount: dropped.length, cards: cards.size, keptBecausePriced,
  }, null, 2) + '\n');
}

console.log(`${APPLY ? 'ЗАПИСАНО' : 'СУХОЙ ПРОГОН'}: снято ${dropped.length} строк у ${cards.size} карточко-файлов (${filesTouched} файлов правлено)`);
console.log(`по разрядам: ${JSON.stringify(byKind)}`);
if (keptBecausePriced.length) console.log(`оставлено из-за цены или срока: ${keptBecausePriced.length}`);
for (const d of dropped.slice(0, 10)) console.log(`  ${d.slug}: «${d.title.slice(0, 70)}»`);
if (APPLY) console.log(`откат: ${BACKUP.slice(ROOT.length + 1)}`);
