#!/usr/bin/env node
// Перепроверка 24 записей QS, помеченных разбором как «карточки нет вовсе».
// Штатный разборщик по ним не выдал ни одной подсказки, а глазами видно, что
// как минимум UWE / CESI / Glion / Luiss в каталоге есть под другим именем.
// Здесь — мягкое сопоставление по токенам, чтобы поднять кандидатов на просмотр.
// Только чтение. Ничего не привязывает и не заводит.
//
// Выход: sources/kompas/qs-newcards-rematch.json + таблица в stdout.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CATALOG = path.join(ROOT, 'site/src/content/universities');
const PROBE = path.join(ROOT, 'sources/kompas/qs-newcards-probe.json');
const OUT = path.join(ROOT, 'sources/kompas/qs-newcards-rematch.json');

// Слова, которые есть у половины каталога и на различение не работают.
const STOP = new Set([
  'university', 'universities', 'college', 'school', 'schools', 'institute', 'institution',
  'of', 'the', 'and', 'for', 'de', 'la', 'di', 'des', 'du', 'international', 'higher',
  'education', 'group', 'centre', 'center', 'studies', 'sciences', 'science', 'applied',
  'undergraduate', 'postgraduate', 'foundation', 'campus', 'academy', 'global', 'national',
]);

const norm = (s) => (s || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const tokens = (s) => norm(s).split(' ').filter((t) => t && !STOP.has(t));

function score(aName, bName, bSlug) {
  const a = new Set(tokens(aName));
  const b = new Set([...tokens(bName), ...tokens(bSlug.replace(/-/g, ' '))]);
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  const base = inter / Math.min(a.size, b.size);
  // Аббревиатура вуза: «UWE» против слага «uwe-bristol».
  const acro = [...a].some((t) => t.length >= 3 && b.has(t)) ? 0 : 0;
  return base + acro;
}

const catalog = fs.readdirSync(CATALOG)
  .filter((f) => f.endsWith('.json'))
  .map((f) => {
    const j = JSON.parse(fs.readFileSync(path.join(CATALOG, f), 'utf8'));
    return { slug: j.slug || f.replace(/\.json$/, ''), name: j.name, city: j.city, country: j.country, programs: (j.programs || []).length };
  });

const probe = JSON.parse(fs.readFileSync(PROBE, 'utf8'));
const rows = [];
for (const rec of probe) {
  const scored = catalog
    .map((c) => ({ ...c, score: score(rec.name, c.name, c.slug), sameCountry: c.country === rec.country }))
    .filter((c) => c.score > 0)
    .sort((a, b) => (b.score + (b.sameCountry ? 0.15 : 0)) - (a.score + (a.sameCountry ? 0.15 : 0)))
    .slice(0, 4);
  rows.push({ name: rec.name, country: rec.country, programs: rec.programs, candidates: scored });
}

fs.writeFileSync(OUT, JSON.stringify(rows, null, 2));

console.log('запись QS | прогр. | кандидаты каталога (слаг · score · страна ок · программ)');
for (const r of rows) {
  const c = r.candidates.length
    ? r.candidates.map((x) => `${x.slug}·${x.score.toFixed(2)}${x.sameCountry ? '·=' : '·≠'}·${x.programs}`).join('  ')
    : '—';
  console.log(`${r.name.slice(0, 44)} | ${r.programs} | ${c}`);
}
console.log(`\nразбор: ${path.relative(ROOT, OUT)}`);
