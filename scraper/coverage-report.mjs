#!/usr/bin/env node
// coverage-report.mjs — Шаг 1 «общего вида»: сводная таблица покрытия по
// агрегаторам. Read-only, $0 LLM. Ничего в каталог не пишет.
// Для каждого источника (sources/*-extracts) и каталога считает программы/цены,
// находит мульти-сорсные вузы и долю дублей (по normalize(title+level)).
// Usage: node scraper/coverage-report.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, 'sources');
const CAT = path.join(__dirname, '..', 'site', 'src', 'content', 'universities');

const norm = (t, l) => (`${t || ''}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + '|' + (l || '')).trim();
const priced = p => p && (p.feePerYear || (p.tuition && (p.tuition.amount || p.tuition)) || p.price);

function readDir(dir) {
  if (!fs.existsSync(dir)) return new Map();
  const m = new Map();
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    try {
      const o = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      const slug = o.slug || f.replace(/\.json$/, '');
      const progs = Array.isArray(o.programs) ? o.programs : [];
      m.set(slug, {
        n: progs.length,
        priced: progs.filter(priced).length,
        keys: new Set(progs.map(p => norm(p.title, p.level))),
      });
    } catch { /* skip */ }
  }
  return m;
}

// Источники-агрегаторы (порядок = приоритет merge-engine)
const SOURCES = ['official', 'kaplan', 'qahe', 'gedu'];
const src = {};
for (const s of SOURCES) src[s] = readDir(path.join(SRC, `${s}-extracts`));
const cat = readDir(CAT);

// --- 1. Тоталы по источникам ---
console.log('\n=== ПОКРЫТИЕ ПО ИСТОЧНИКАМ ===');
console.log('source      unis   programs   с ценой');
console.log('-'.repeat(42));
for (const s of SOURCES) {
  const m = src[s];
  let np = 0, pr = 0;
  for (const v of m.values()) { np += v.n; pr += v.priced; }
  console.log(`${s.padEnd(12)}${String(m.size).padEnd(7)}${String(np).padEnd(11)}${pr}`);
}
{
  let np = 0; for (const v of cat.values()) np += v.n;
  console.log(`${'КАТАЛОГ'.padEnd(12)}${String(cat.size).padEnd(7)}${String(np).padEnd(11)}—`);
}

// --- 2. Мульти-сорсные вузы (covered ≥2 источниками) ---
const allSlugs = new Set();
for (const s of SOURCES) for (const k of src[s].keys()) allSlugs.add(k);

const rows = [];
for (const slug of allSlugs) {
  const present = SOURCES.filter(s => src[s].has(slug));
  if (present.length < 2) continue;
  // объединение всех уникальных программ vs сумма → доля дублей
  const union = new Set();
  let sum = 0;
  for (const s of present) { const v = src[s].get(slug); sum += v.n; for (const k of v.keys) union.add(k); }
  const dupPct = sum ? Math.round((1 - union.size / sum) * 100) : 0;
  rows.push({ slug, present, sum, uniq: union.size, dupPct, cat: cat.has(slug) ? cat.get(slug).n : '—' });
}
rows.sort((a, b) => b.sum - a.sum);

console.log(`\n=== МУЛЬТИ-СОРСНЫЕ ВУЗЫ (covered ≥2 агрегаторами): ${rows.length} ===`);
console.log('slug'.padEnd(26) + 'sources'.padEnd(26) + 'сумма'.padEnd(7) + 'уник'.padEnd(7) + 'дубли'.padEnd(7) + 'каталог');
console.log('-'.repeat(82));
for (const r of rows) {
  console.log(
    r.slug.slice(0, 25).padEnd(26) +
    r.present.join('+').padEnd(26) +
    String(r.sum).padEnd(7) +
    String(r.uniq).padEnd(7) +
    (r.dupPct + '%').padEnd(7) +
    r.cat
  );
}

// --- 3. Сводка: сколько вузов покрыто 1 / 2 / 3+ источниками ---
const byCount = { 1: 0, 2: 0, 3: 0 };
for (const slug of allSlugs) {
  const c = SOURCES.filter(s => src[s].has(slug)).length;
  byCount[Math.min(c, 3)]++;
}
console.log(`\n=== ОХВАТ ===`);
console.log(`всего уникальных вузов в экстрактах: ${allSlugs.size}`);
console.log(`  1 источник:  ${byCount[1]}`);
console.log(`  2 источника: ${byCount[2]}`);
console.log(`  3+ источника:${byCount[3]}`);
console.log(`вузов из экстрактов, которых НЕТ в каталоге: ${[...allSlugs].filter(s => !cat.has(s)).length}`);
