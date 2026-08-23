#!/usr/bin/env node
// kompas-drop-junk-programs.mjs — убрать строки, которые не являются программами.
//
// ЗАЧЕМ. Обход офсайтов затягивал в каталог служебные страницы: строка с названием
// «Entry Requirements» лежит в карточке рядом с настоящими курсами. Это не программа
// с плохим названием, а кусок страницы приёма, и деплойный гейт справедливо держит
// на нём сборку (GARBAGE:junk-title).
//
// ПРАВИЛО. Убирается только строка, название которой ЦЕЛИКОМ состоит из приёмной
// лексики («Entry Requirements», «Admissions», «How to Apply») — то же правило, что
// у гейта. Названия, где приёмное слово лишь встречается («Pre-sessional English
// 10 weeks», «M.Sc. … with Professional Study Preparation»), не трогаются: это
// настоящие курсы. Строка с ценой или дедлайном не убирается вовсе — там есть что
// терять, такие случаи идут человеку.
//
// Сети нет. По умолчанию НИЧЕГО НЕ ПИШЕТ, запись только по --apply.
//   node scraper/kompas-drop-junk-programs.mjs
//   node scraper/kompas-drop-junk-programs.mjs --apply
//   node scraper/kompas-drop-junk-programs.mjs --dir=site/src/content/universities --apply

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const dirArg = process.argv.find((a) => a.startsWith('--dir='));
const DIR = dirArg ? path.resolve(ROOT, dirArg.slice('--dir='.length)) : path.join(ROOT, 'sources/kompas/catalog-work');
const APPLY = process.argv.includes('--apply');
const BACKUP = path.join(ROOT, 'sources/kompas/junk-programs-backup.json');

// Держать в синхроне с JUNK_TITLE в audit-catalog.mjs: гейт запрещает ровно это.
const JUNK_TITLE = /^\s*(admissions?|entry\s+requirements?|requirements|how\s+to\s+apply|apply\s+(now|online)|pathway\s+entry|foundation\s+entry)\s*$/i;

async function main() {
  const files = (await fs.readdir(DIR)).filter((f) => f.endsWith('.json'));
  const dropped = [];
  const kept = [];

  for (const f of files) {
    const fp = path.join(DIR, f);
    let card;
    try { card = JSON.parse(await fs.readFile(fp, 'utf8')); } catch { continue; }
    const programs = card.programs ?? [];
    const junk = programs.filter((p) => JUNK_TITLE.test(p.title ?? '') && p.programType !== 'pathway');
    if (!junk.length) continue;

    for (const p of junk) {
      const fee = card.tuition?.byProgram?.[p.slug];
      const deadline = card.deadlines?.[p.slug];
      const rec = { card: card.slug ?? f.replace(/\.json$/, ''), slug: p.slug, title: p.title, level: p.level, program: p };
      if (fee != null || deadline != null) { kept.push({ ...rec, fee: fee ?? null, deadline: deadline ?? null }); continue; }
      dropped.push(rec);
    }

    const drop = new Set(dropped.filter((d) => d.card === (card.slug ?? f.replace(/\.json$/, ''))).map((d) => d.slug));
    if (APPLY && drop.size) {
      card.programs = programs.filter((p) => !drop.has(p.slug));
      await fs.writeFile(fp, JSON.stringify(card, null, 2) + '\n', 'utf8');
    }
  }

  if (APPLY && dropped.length) {
    // Файл отката НАКОПИТЕЛЬНЫЙ: скрипт запускают дважды — по рабочей копии и по
    // живому каталогу, — и вторая запись начисто стёрла бы первую точку отката.
    let prev = { runs: [] };
    try { prev = JSON.parse(await fs.readFile(BACKUP, 'utf8')); } catch { /* первого прогона ещё не было */ }
    if (!Array.isArray(prev.runs)) prev = { runs: prev.dropped ? [{ generatedAt: prev.generatedAt, dir: prev.dir, dropped: prev.dropped }] : [] };
    prev.runs = prev.runs.filter((r) => r.dir !== path.relative(ROOT, DIR));
    prev.runs.push({ generatedAt: new Date().toISOString(), dir: path.relative(ROOT, DIR), dropped });
    await fs.writeFile(BACKUP, JSON.stringify(prev, null, 2) + '\n', 'utf8');
  }

  console.log((APPLY ? 'ЗАПИСАНО' : 'РАЗБОР (без записи)') + ': убрано строк ' + dropped.length + ', оставлено человеку ' + kept.length);
  for (const d of dropped) console.log('  − ' + d.card + ' :: «' + d.title + '» (level ' + d.level + ')');
  for (const k of kept) console.log('  ! ' + k.card + ' :: «' + k.title + '» — есть цена/дедлайн, не трогаю');
  if (APPLY && dropped.length) console.log('откат: ' + path.relative(ROOT, BACKUP));
  if (!APPLY) console.log('ничего не записано — для записи добавь --apply');
}

await main();
