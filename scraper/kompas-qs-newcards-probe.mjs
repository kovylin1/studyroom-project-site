#!/usr/bin/env node
// Замер выгрузок QS по 24 записям «новый вуз»: что в самих данных есть про
// город и длительность, прежде чем идти в сеть за офсайтами.
// Только чтение. Каталог не трогает, карточек не заводит.
//
// Выход: sources/kompas/qs-newcards-probe.json + краткая сводка в stdout.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const EXTRACTS = path.join(ROOT, 'sources/kompas/extracts/qs');
const CATALOG = path.join(ROOT, 'site/src/content/universities');
const OUT = path.join(ROOT, 'sources/kompas/qs-newcards-probe.json');

// Список из sources/kompas/QS-NEW-CARDS.md, раздел «новый вуз — 24».
const NAMES = [
  'University of the West of England (UWE)',
  'Falmouth University',
  'University of Worcester (Undergraduate)',
  'Kwantlen Polytechnic University',
  'University of Worcester (Postgraduate)',
  'Marshall University',
  'Mercy University',
  'SRH Universities (India)',
  'Luiss University - Libera Università Internazionale degli Studi Sociali Guido Carli',
  'Glion',
  'Westminster International University in Tashkent',
  'UCL Centre for Languages & International Education',
  'University Bridge',
  'CESI School of Engineering',
  'MPW',
  'On Campus Ireland',
  'Wycombe Abbey International School, Bangkok',
  'Peking University HSBC Business School',
  'Testing December - Testing purpose',
  'Wycombe Abbey International School',
  'Wycombe Abbey International School, Hong kong',
  'ILAC International Language Academy of Canada',
  'St. James Catholic Middle School',
  'TEDI - London',
];

// Длительность в тексте названия программы. Ищем И словом, И цифрой.
const WORD_NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 };
const DURATION_PATTERNS = [
  /\b(one|two|three|four|five|six|seven)[\s-]year\b/i,
  /\b(\d(?:\.\d)?)[\s-]?(?:year|yr)s?\b/i,
  /\b(\d{1,2})[\s-]?months?\b/i,
];

function durationHit(text) {
  if (!text) return null;
  for (const re of DURATION_PATTERNS) {
    const m = text.match(re);
    if (!m) continue;
    const token = m[1].toLowerCase();
    const isMonths = /month/i.test(m[0]);
    const num = WORD_NUM[token] ?? Number(token);
    if (!Number.isFinite(num) || num <= 0) continue;
    return { phrase: m[0].trim(), years: isMonths ? num / 12 : num };
  }
  return null;
}

// Город прозой в описании: «located in X», «in X, England», «based in X».
const CITY_HINTS = [
  /\blocated in ([^.,;()]{3,60})/i,
  /\bbased in ([^.,;()]{3,60})/i,
  /\bcampus(?:es)? in ([^.,;()]{3,60})/i,
  /\bin (?:and around )?([A-Z][\w'’-]+(?: [A-Z][\w'’-]+)?), (?:England|Scotland|Wales|Italy|France|Germany|Canada|Switzerland)\b/,
];

function cityHints(desc) {
  if (!desc) return [];
  const out = [];
  for (const re of CITY_HINTS) {
    const m = desc.match(re);
    if (m) out.push(m[1].trim());
  }
  return [...new Set(out)];
}

const catalogSlugs = new Set(
  fs.readdirSync(CATALOG).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')),
);

const byName = new Map();
for (const f of fs.readdirSync(EXTRACTS)) {
  if (!f.endsWith('.json')) continue;
  const rec = JSON.parse(fs.readFileSync(path.join(EXTRACTS, f), 'utf8'));
  if (!NAMES.includes(rec.name)) continue;
  const key = `${rec.name}::${f}`;
  byName.set(key, { file: f, rec });
}

const report = [];
for (const [, { file, rec }] of byName) {
  const programs = rec.programs || [];
  const durations = [];
  let withDuration = 0;
  for (const p of programs) {
    const hay = [p.title, ...(Array.isArray(p.raw) ? p.raw : [])].filter(Boolean).join(' | ');
    const hit = durationHit(hay);
    if (hit) {
      withDuration += 1;
      durations.push(hit.phrase.toLowerCase());
    }
  }
  const campusValues = new Set();
  for (const p of programs) {
    for (const c of p.campuses || []) campusValues.add(typeof c === 'string' ? c : JSON.stringify(c));
    if (p.campusCosts?.campus) campusValues.add(String(p.campusCosts.campus));
  }
  report.push({
    file,
    name: rec.name,
    country: rec.country,
    provider: rec.provider,
    programs: programs.length,
    catalogSlug: rec.catalogSlug,
    slugFreeInCatalog: !catalogSlugs.has(file.replace(/\.json$/, '')),
    campusesStated: rec.campusesStated,
    campusValuesFromPrograms: [...campusValues],
    descriptionLength: (rec.description || '').length,
    cityHints: cityHints(rec.description),
    description: rec.description || null,
    programsWithDuration: withDuration,
    durationPhrases: Object.entries(
      durations.reduce((acc, d) => ((acc[d] = (acc[d] || 0) + 1), acc), {}),
    ).sort((a, b) => b[1] - a[1]),
  });
}

report.sort((a, b) => b.programs - a.programs);
fs.writeFileSync(OUT, JSON.stringify(report, null, 2));

const totalPrograms = report.reduce((s, r) => s + r.programs, 0);
const totalWithDuration = report.reduce((s, r) => s + r.programsWithDuration, 0);
console.log(`записей: ${report.length} / ${NAMES.length} имён, программ: ${totalPrograms}`);
console.log(`длительность в тексте названия: ${totalWithDuration} программ (${((totalWithDuration / totalPrograms) * 100).toFixed(1)}%)`);
console.log('');
console.log('имя | программ | с длительностью | подсказки города | описание, симв.');
for (const r of report) {
  console.log(
    [r.name.slice(0, 46), r.programs, r.programsWithDuration, (r.cityHints.join(' / ') || '—').slice(0, 40), r.descriptionLength].join(' | '),
  );
}
const missing = NAMES.filter((n) => ![...byName.values()].some((v) => v.rec.name === n));
if (missing.length) console.log('\nне нашлось в выгрузках: ' + missing.join(' ; '));
console.log(`\nразбор: ${path.relative(ROOT, OUT)}`);
