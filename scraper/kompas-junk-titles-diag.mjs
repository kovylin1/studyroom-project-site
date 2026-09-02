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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (p, d) => (process.argv.find((a) => a.startsWith(p)) || `${p}${d}`).slice(p.length);
const DIR = path.resolve(arg('--dir=', path.join(ROOT, 'site/src/content/universities')));
const LIST = arg('--list=', '');
const REPORT = path.join(ROOT, 'sources/kompas/junk-titles.json');

// Разряды. Порядок важен: строка попадает в первый подошедший.
const RULES = [
  ['html-entity', /&#\d+;|&#x[0-9a-f]+;|&(amp|nbsp|quot|lt|gt);/i,
    'в названии остались HTML-сущности — брак разбора, а не название'],
  ['person-name', /\b(prof|doç|doc|dr|öğr|ogr|assoc|asst|assist)\b\.?\s*(dr|öğr|ogr|üyesi|uyesi)?\b\.?\s*[A-ZÇĞİÖŞÜ]/,
    'звание и фамилия — это карточка преподавателя'],
  ['navigation', /^\s*(mainpage|main page|home ?page|homepage|anasayfa|thank you|te[sş]ekk[uü]rler|contact( us)?|about( us)?|news|haberler|login|sitemap|search|read more|devam[ıi]|duyurular)\s*$/i,
    'пункт меню или служебная страница'],
  ['studyroom-stub', /contact\s+studyroom|уточня|— contact/i,
    'заглушка «спросите менеджера», а не программа'],
  ['sentence', /^.{95,}$/,
    'длиннее 95 знаков — обычно заголовок новости, а не название программы'],
];

const DEGREE = /\b(bsc|ba|bs|beng|bba|bcom|llb|llm|msc|ma|ms|meng|mba|mphil|phd|doctor|bachelor|master|diploma|certificate|foundation|lisans|tıp|hem[sş]irelik)\b/i;

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
    for (const [kind, re, why] of RULES) {
      if (!re.test(title)) continue;
      // Длинное название с настоящей степенью — не новость, а длинное название.
      if (kind === 'sentence' && DEGREE.test(title)) break;
      hits.push({ kind, title, level: p.level, source: p.source, why });
      byKind[kind] = (byKind[kind] || 0) + 1;
      break;
    }
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
  console.log(`  ${String(v).padStart(5)}  ${k} — ${RULES.find((r) => r[0] === k)[2]}`);
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
