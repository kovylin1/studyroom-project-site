#!/usr/bin/env node
// kompas-workcopy-check.mjs — проверка рабочей копии на инварианты схемы сайта.
//
// ЗАЧЕМ. Добор программ и кампусов пишет в catalog-work, а применяться будет в
// живой каталог, где карточку встречает zod (site/src/schema/university.ts).
// Ошибку схемы дешевле поймать здесь, чем на build после применения: раньше
// именно так падал build (пустые amount у стипендий, плоская gallery).
//
// Проверяются ровно те инварианты, которые может нарушить добор:
//   • program.slug — только [a-z0-9-], уникален внутри карточки;
//   • program.durationYears > 0; level — из перечисления схемы;
//   • tuition.byProgram ссылается только на существующие слаги программ;
//   • deadlines — то же самое;
//   • campus.title непустой.
//
// Сети нет, ничего не пишется. Ненулевой код возврата = есть нарушения.
// Запуск: node kompas-workcopy-check.mjs [--dir=<каталог>]

import fs from 'node:fs/promises';
import path from 'node:path';
import { logger } from './lib/kompas-collect.mjs';
import { WORK_DIR } from './lib/kompas-diff-core.mjs';

const log = logger('workcopy-check');
const dirArg = process.argv.find((a) => a.startsWith('--dir='));
const DIR = dirArg ? path.resolve(dirArg.slice('--dir='.length)) : WORK_DIR;

const LEVELS = new Set(['high-school', 'sixth-form', 'foundation', 'bachelor', 'master', 'phd', 'english-language', 'short-course']);
const SLUG = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export function checkCard(card) {
  const bad = [];
  const slugs = new Set();
  for (const p of card.programs ?? []) {
    if (!SLUG.test(String(p.slug ?? ''))) bad.push(`слаг программы «${p.slug}» не по схеме`);
    if (slugs.has(p.slug)) bad.push(`слаг программы «${p.slug}» повторяется`);
    slugs.add(p.slug);
    if (!(typeof p.durationYears === 'number' && p.durationYears > 0)) bad.push(`«${p.title}»: durationYears ${p.durationYears}`);
    if (!LEVELS.has(p.level)) bad.push(`«${p.title}»: level «${p.level}» вне схемы`);
    if (!String(p.title ?? '').trim()) bad.push(`программа ${p.slug} без названия`);
  }
  for (const k of Object.keys(card.tuition?.byProgram ?? {})) {
    if (!slugs.has(k)) bad.push(`tuition.byProgram ссылается на несуществующую программу «${k}»`);
  }
  for (const k of Object.keys(card.deadlines ?? {})) {
    if (!slugs.has(k)) bad.push(`deadlines ссылается на несуществующую программу «${k}»`);
  }
  for (const c of card.campuses ?? []) {
    if (!String(c.title ?? '').trim()) bad.push('кампус без названия');
  }
  return bad;
}

async function main() {
  const files = (await fs.readdir(DIR)).filter((f) => f.endsWith('.json'));
  const problems = {};
  let total = 0;
  for (const f of files) {
    let card;
    try { card = JSON.parse(await fs.readFile(path.join(DIR, f), 'utf8')); }
    catch (e) { problems[f] = [`не читается: ${e.message}`]; total++; continue; }
    const bad = checkCard(card);
    if (bad.length) { problems[f] = bad; total += bad.length; }
  }
  const files1 = Object.keys(problems);
  // Снимок для сравнения «до/после»: в живом каталоге нарушения могли быть и до
  // нас (452 битые ссылки deadlines в 24 карточках на 2026-08-14), и гейтом
  // служит не их наличие, а появление НОВЫХ.
  const stampArg = process.argv.find((a) => a.startsWith('--stamp='));
  if (stampArg) {
    await fs.writeFile(stampArg.slice('--stamp='.length), JSON.stringify({
      generatedAt: new Date().toISOString(), dir: DIR, cards: files.length,
      violations: total, cardsWithViolations: files1.length, problems,
    }, null, 2) + '\n', 'utf8');
  }
  if (!files1.length) { console.log(`ПРОВЕРКА ОК: ${files.length} карточек, нарушений нет`); return; }
  for (const f of files1.slice(0, 20)) console.log(`${f}: ${problems[f].slice(0, 5).join('; ')}`);
  console.log(`НАРУШЕНИЙ ${total} в ${files1.length} карточках из ${files.length}`);
  log('проверка не пройдена');
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) await main();
