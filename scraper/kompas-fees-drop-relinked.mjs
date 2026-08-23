#!/usr/bin/env node
// Снятие цен, потерявших источник после перепривязки (задача 3.5-g).
//
// Когда матчер научился читать уровень строки QS (`sourceLevel`), 123 строки
// перестали садиться на программу чужого уровня — строка магистратуры больше
// не привязывается к бакалаврской программе. Но цена, которую та привязка
// когда-то записала, осталась в карточке: `kompas-fees-apply.mjs` пишет только
// по своим кандидатам и чужого не трогает.
//
// Скрипт сверяет список записанных цен ДО и ПОСЛЕ перепривязки и снимает те,
// что: (1) записывал прогон цен раньше, (2) новый прогон не подтверждает,
// (3) в карточке до сих пор стоят ровно той суммой. Вместе с ценой снимаются
// её попрограммные спутники — основа, валюта и варианты.
//
// Цену не «чиним» и не переносим: под каким уровнем сумма верна, знает только
// источник, а он её этой программе не давал. Каждая снятая цена уходит кейсом.
//
// Запуск: node scraper/kompas-fees-drop-relinked.mjs [--dry]
//         [--before=sources/kompas/fees-apply-report.before-3.5g.json]
//         [--after=sources/kompas/fees-apply-report.json]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORK = path.join(ROOT, 'sources/kompas/catalog-work');
const arg = (name, def) => {
  const a = process.argv.find((x) => x.startsWith('--' + name + '='));
  return a ? a.slice(name.length + 3) : def;
};
const DRY = process.argv.includes('--dry');
const BEFORE = path.resolve(ROOT, arg('before', 'sources/kompas/fees-apply-report.before-3.5g.json'));
const AFTER = path.resolve(ROOT, arg('after', 'sources/kompas/fees-apply-report.json'));
const BACKUP = path.join(ROOT, 'sources/kompas/fees-drop-relinked-backup.json');
const REPORT = path.join(ROOT, 'sources/kompas/fees-drop-relinked.json');

const before = JSON.parse(fs.readFileSync(BEFORE, 'utf8'));
const after = JSON.parse(fs.readFileSync(AFTER, 'utf8'));
const key = (c) => c.catalogSlug + '|' + c.program;
const kept = new Set(after.changes.map(key));
const lost = before.changes.filter((c) => !kept.has(key(c)));

const stats = { before: before.changes.length, after: after.changes.length,
  lostLinks: lost.length, dropped: 0, alreadyGone: 0, rewritten: 0, cardsTouched: 0 };
const dropped = [], backup = {};
const cards = new Map();
const cardOf = (slug) => {
  if (!cards.has(slug)) cards.set(slug, JSON.parse(fs.readFileSync(path.join(WORK, slug + '.json'), 'utf8')));
  return cards.get(slug);
};

for (const c of lost) {
  const file = path.join(WORK, c.catalogSlug + '.json');
  if (!fs.existsSync(file)) { stats.alreadyGone++; continue; }
  const card = cardOf(c.catalogSlug);
  const bp = (card.tuition && card.tuition.byProgram) || {};
  const now = bp[c.program];
  if (now == null) { stats.alreadyGone++; continue; }
  // Новый прогон цену не писал, но она могла измениться руками — тогда не наша.
  if (now !== c.fee) { stats.rewritten++; continue; }
  const prog = (card.programs || []).find((p) => p.slug === c.program);
  backup[c.catalogSlug] = backup[c.catalogSlug] || {};
  backup[c.catalogSlug][c.program] = { tuition: now,
    tuitionBasis: prog && prog.tuitionBasis, tuitionCurrency: prog && prog.tuitionCurrency,
    tuitionVariants: prog && prog.tuitionVariants };
  delete bp[c.program];
  if (prog) {
    delete prog.tuitionBasis;
    delete prog.tuitionCurrency;
    delete prog.tuitionVariants;
  }
  stats.dropped++;
  dropped.push({ catalogSlug: c.catalogSlug, program: c.program,
    title: prog ? prog.title : null, level: prog ? prog.level : null,
    tuition: c.fee, currency: c.currency, source: c.source,
    reason: 'fee-lost-source',
    note: 'цену писала привязка строки чужого уровня; после перепривязки источник эту программу не подтверждает' });
}

if (!DRY) {
  for (const slug of Object.keys(backup)) {
    fs.writeFileSync(path.join(WORK, slug + '.json'), JSON.stringify(cardOf(slug), null, 2));
    stats.cardsTouched++;
  }
  fs.writeFileSync(BACKUP, JSON.stringify(backup, null, 1));
} else stats.cardsTouched = Object.keys(backup).length;
fs.writeFileSync(REPORT, JSON.stringify({ dry: DRY, before: BEFORE, after: AFTER, stats, dropped }, null, 1));
console.log(JSON.stringify(stats, null, 1));
