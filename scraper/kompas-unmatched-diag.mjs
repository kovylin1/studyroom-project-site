#!/usr/bin/env node
// Разбор остатка непривязанного (задача 3.5-g).
// Сети не трогает, ничего не пишет в каталог: только считает и раскладывает по причинам.
//
// Для каждой строки выгрузки агрегатора, которую матчер не находит в карточке,
// определяет, ПОЧЕМУ она осталась за бортом:
//   ambiguous          — после снятия приставки степени подходит больше одной программы;
//   level-unsupported  — уровень источника схема каталога не принимает;
//   no-level           — уровня нет ни у источника, ни в названии;
//   empty-title        — название пустое либо от него после нормализации ничего не осталось;
//   dup-in-source      — такое название уже встречалось в этой карточке (заводится один раз);
//   unexplained        — уровень есть, дубля нет, но программы всё равно нет: разбирать руками.
//
// Запуск: node scraper/kompas-unmatched-diag.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildIndex, matchProgram, norm, stripAward, rowLevel } from './lib/program-match.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EX = path.join(ROOT, 'sources/kompas/extracts');
const WORK = path.join(ROOT, 'sources/kompas/catalog-work');
const OUT_JSON = path.join(ROOT, 'sources/kompas/unmatched-diag.json');
const OUT_MD = path.join(ROOT, 'sources/kompas/UNMATCHED-DIAG.md');
const OUT_REVIEW = path.join(ROOT, 'sources/kompas/unmatched-review.json');

const AGGREGATORS = ['qs', 'edvoy', 'kaplan', 'studygroup', 'oxford-international', 'iapro', 'qahe'];

const cards = new Map(), idx = new Map();
for (const f of fs.readdirSync(WORK)) {
  if (!f.endsWith('.json')) continue;
  const slug = f.replace(/\.json$/, '');
  const card = JSON.parse(fs.readFileSync(path.join(WORK, f), 'utf8'));
  cards.set(slug, card);
  idx.set(slug, buildIndex(card.programs));
}

const rows = [];
const stats = {};
const bump = (src, key) => {
  stats[src] = stats[src] || {};
  stats[src][key] = (stats[src][key] || 0) + 1;
};

for (const src of AGGREGATORS) {
  const dir = path.join(EX, src);
  if (!fs.existsSync(dir)) continue;
  const seenPerCard = new Map();
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (d.notAnInstitution || d.noPrograms || d.excludedFromDiff) continue;
    const slug = d.catalogSlug || d.slug;
    const card = cards.get(slug);
    if (!card) continue;
    if (!seenPerCard.has(slug)) seenPerCard.set(slug, new Set());
    const seen = seenPerCard.get(slug);

    for (const ep of (d.programs || [])) {
      const hit = matchProgram(idx.get(slug), ep);
      const key = norm(ep.title);
      if (hit.program) { if (key) seen.add(key); continue; }

      let reason, extra = {};
      const lv = rowLevel(ep);
      if (hit.how === 'ambiguous') {
        reason = 'ambiguous';
        const pool = idx.get(slug).byStripped.get(stripAward(ep.title)) || [];
        const fit = lv.level ? pool.filter((p) => !p.level || p.level === lv.level) : pool;
        extra.rowLevel = lv.level;
        extra.candidates = fit.map((p) => ({ slug: p.slug, title: p.title, level: p.level }));
        // кандидаты одного уровня — уровень такую спорность не разведёт,
        // это чаще всего пара программ-двойников в самой карточке
        extra.sameLevel = new Set(fit.map((p) => p.level)).size === 1;
      } else if (!key) {
        reason = 'empty-title';
      } else if (seen.has(key)) {
        reason = 'dup-in-source';
      } else if (lv.from === 'unsupported') {
        reason = 'level-unsupported';
        extra.sourceLevel = lv.raw;
      } else if (!lv.level) {
        reason = 'no-level';
      } else {
        reason = 'unexplained';
        extra.level = lv.level;
        extra.stripped = stripAward(ep.title);
      }
      if (key) seen.add(key);
      bump(src, reason);
      rows.push({ source: src, catalogSlug: slug, title: ep.title || '', level: ep.level || null,
        sourceLevel: ep.sourceLevel || null, programUrl: ep.programUrl || null, reason, ...extra });
    }
  }
}

const byReason = {};
for (const r of rows) byReason[r.reason] = (byReason[r.reason] || 0) + 1;
const byCard = {};
for (const r of rows) byCard[r.catalogSlug] = (byCard[r.catalogSlug] || 0) + 1;
const topCards = Object.entries(byCard).sort((a, b) => b[1] - a[1]).slice(0, 20);

fs.writeFileSync(OUT_JSON, JSON.stringify({ total: rows.length, byReason, perSource: stats, rows }, null, 1));

// Кейсы оператору: то, что осталось, — не работа скрипта, а три решения владельца
// (уровня нет у источника; квалификации нет в схеме каталога; в карточке двойники).
// Повтор строки внутри выгрузки (`dup-in-source`) отдельным кейсом не идёт: у первой
// такой строки кейс уже есть, а второй такой же — не новая проблема.
const ISSUE = {
  'no-level': ['kompas_program_no_level', 'warning',
    'строк источника без уровня — программа не заводится, уровень не выдумываем'],
  'level-unsupported': ['kompas_program_level_unsupported', 'warning',
    'строк с квалификацией, которой нет в схеме каталога (certificate / diploma)'],
  'ambiguous-twins': ['kompas_program_ambiguous_twins', 'warning',
    'строк не привязать: в карточке две программы одного уровня с одинаковым названием'],
  'ambiguous-level': ['kompas_program_ambiguous_level', 'warning',
    'строк не привязать: уровня у строки нет, а в карточке кандидаты разных уровней'],
};
const groupKey = (r) => (r.reason === 'ambiguous' ? (r.sameLevel ? 'ambiguous-twins' : 'ambiguous-level') : r.reason);
const groups = new Map();
for (const r of rows) {
  const g = groupKey(r);
  if (!ISSUE[g]) continue;
  const k = r.catalogSlug + '||' + g;
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(r);
}
const NOW = new Date().toISOString();
const items = [];
for (const [k, list] of groups) {
  const [slug, g] = k.split('||');
  const [issue, severity, what] = ISSUE[g];
  const ex = list.slice(0, 5).map((r) => {
    let s2 = '«' + r.title + '» (' + r.source + ')';
    if (r.sourceLevel) s2 += ', разметка источника «' + r.sourceLevel + '»';
    if (r.candidates && r.candidates.length) s2 += ' ↔ ' + r.candidates.map((c) => c.title).join(' / ');
    return s2;
  });
  items.push({
    id: slug + '||' + issue + '||' + list.length,
    slug, name: slug, issue, severity,
    detail: list.length + ' ' + what + '. Примеры: ' + ex.join('; ') + '.',
    catalog: null, official: list.length, program: null, sourceUrl: null,
    checkedAt: NOW, decision: null, decidedAt: null, applied: false,
  });
}
items.sort((a, b) => b.official - a.official || a.slug.localeCompare(b.slug));
fs.writeFileSync(OUT_REVIEW, JSON.stringify({
  generatedAt: NOW,
  scope: 'Остаток непривязанного после перепривязки по уровню (3.5-g)',
  summary: { rows: rows.length, cases: items.length, byReason },
  items,
}, null, 1));

let md = '# Остаток непривязанного — разбор (3.5-g)\n\nВсего строк агрегаторов без программы в карточке: **' + rows.length + '**.\n\n';
md += '## По причинам\n\n| Причина | Штук |\n|---|---:|\n';
for (const [k, v] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) md += '| `' + k + '` | ' + v + ' |\n';
md += '\n## По источникам\n\n| Источник | ' + Object.keys(byReason).map((k) => '`' + k + '`').join(' | ') + ' | Всего |\n';
md += '|---|' + Object.keys(byReason).map(() => '---:').join('|') + '|---:|\n';
for (const [src, s] of Object.entries(stats)) {
  const sum = Object.values(s).reduce((a, b) => a + b, 0);
  md += '| ' + src + ' | ' + Object.keys(byReason).map((k) => s[k] || 0).join(' | ') + ' | ' + sum + ' |\n';
}
md += '\n## Где больше всего (топ-20 карточек)\n\n| Карточка | Штук |\n|---|---:|\n';
for (const [slug, n] of topCards) md += '| ' + slug + ' | ' + n + ' |\n';
md += '\nПострочно: `unmatched-diag.json`.\n';
fs.writeFileSync(OUT_MD, md);

console.log(JSON.stringify({ total: rows.length, byReason }, null, 1));
console.log('кейсов в панель:', items.length);
console.log(JSON.stringify(stats, null, 1));
