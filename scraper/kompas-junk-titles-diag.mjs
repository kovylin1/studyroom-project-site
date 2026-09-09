#!/usr/bin/env node
// kompas-junk-titles-diag.mjs — замер: сколько в каталоге «программ», которые
// программами не являются.
//
// Повод. Карточка beykent-university держит 10 «программ бакалавриата»:
// «Mainpage», «Programmes — contact StudyRoom» и семь новостей вида
// «Uluslararası Yayın Başarısı - Prof. Dr. Fatma G&#252;ler YILDIRIM».
// Штатный гейт этого не видит: его JUNK_TITLE ловит только приёмную лексику
// («Admissions», «How to apply»), а навигацию, фамилии и новости — нет.
// Тот же брак дал общий офсайт-сборщик на прогоне A1 02.09 у sp-jain и
// anglo-american, так что вопрос не в одной карточке.
//
// Только чтение. Ничего не правит, ничего не удаляет.
//
// Запуск: node kompas-junk-titles-diag.mjs [--dir=<путь>] [--list=<разряд>]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES, classifyTitle } from './lib/junk-title.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (p, d) => (process.argv.find((a) => a.startsWith(p)) || `${p}${d}`).slice(p.length);
const DIR = path.resolve(arg('--dir=', path.join(ROOT, 'site/src/content/universities')));
const LIST = arg('--list=', '');
const REPORT = path.join(ROOT, 'sources/kompas/junk-titles.json');

// Правило живёт в lib/junk-title.mjs — замер и чистилка обязаны отвечать
// на вопрос «это программа?» одинаково.

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json'));
const byKind = {};
const cards = [];
let programsTotal = 0;

for (const f of files) {
  let card;
  try { card = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch { continue; }
  const programs = card.programs || [];
  programsTotal += programs.length;
  const hits = [];
  for (const p of programs) {
    const title = String(p.title || '');
    const rule = classifyTitle(title);
    if (!rule) continue;
    hits.push({ kind: rule.kind, title, level: p.level, source: p.source, why: rule.why });
    byKind[rule.kind] = (byKind[rule.kind] || 0) + 1;
  }
  if (hits.length) {
    cards.push({
      slug: card.slug || f.replace(/\.json$/, ''),
      name: card.name,
      programs: programs.length,
      junk: hits.length,
      share: programs.length ? Math.round((100 * hits.length) / programs.length) : 0,
      partnerSource: card.partnerSource?.type,
      sources: [...new Set(hits.map((h) => h.source || '(нет)'))],
      hits,
    });
  }
}

cards.sort((a, b) => b.share - a.share || b.junk - a.junk);
const junkTotal = cards.reduce((s, c) => s + c.junk, 0);

console.log(`каталог: ${files.length} карточек, ${programsTotal} программ`);
console.log(`подозрительных названий: ${junkTotal} у ${cards.length} карточек\n`);
console.log('по разрядам:');
for (const [k, v] of Object.entries(byKind).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(v).padStart(5)}  ${k} — ${RULES.find((r) => r.kind === k).why}`);
}
console.log('\nхудшие карточки (доля мусора):');
for (const c of cards.slice(0, 20)) {
  console.log(`  ${String(c.share).padStart(3)}%  ${String(c.junk).padStart(4)}/${String(c.programs).padEnd(5)} ${c.slug.padEnd(42)} ${c.partnerSource || ''} [${c.sources.join(',')}]`);
}

if (LIST) {
  console.log(`\nвсе строки разряда «${LIST}»:`);
  for (const c of cards) {
    for (const h of c.hits.filter((x) => x.kind === LIST).slice(0, 6)) {
      console.log(`  ${c.slug}: ${h.title.slice(0, 100)}`);
    }
  }
}

fs.writeFileSync(REPORT, JSON.stringify({
  ranAt: new Date().toISOString(), dir: DIR.slice(ROOT.length + 1),
  files: files.length, programsTotal, junkTotal, byKind, cards,
}, null, 2) + '\n');
console.log(`\nотчёт: ${REPORT.slice(ROOT.length + 1)}`);
