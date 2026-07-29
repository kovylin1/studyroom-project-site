#!/usr/bin/env node
// audit-catalog.mjs — комплексный аудит качества данных каталога. Read-only, $0.
// Категории: MISSING (дыры), GARBAGE (кривые данные), INTEGRITY (битые ссылки/слаги).
// Печатает сводку + топ-офендеров; пишет полный разбор в sources/audit-report.json.
// Usage: node scraper/audit-catalog.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CAT = path.join(__dirname, '..', 'site', 'src', 'content', 'universities');
const PUBLIC = path.join(__dirname, '..', 'site', 'public');

// страна → ожидаемая валюта (для детекта несоответствий вроде chester=USD)
const CCY = {
  'United Kingdom': 'GBP', 'UK': 'GBP', 'England': 'GBP', 'Scotland': 'GBP', 'Wales': 'GBP',
  'United States': 'USD', 'USA': 'USD',
  'Canada': 'CAD', 'Australia': 'AUD', 'New Zealand': 'NZD', 'Kazakhstan': 'KZT',
  'Germany': 'EUR', 'France': 'EUR', 'Netherlands': 'EUR', 'Spain': 'EUR', 'Italy': 'EUR',
  'Ireland': 'EUR', 'Austria': 'EUR', 'Belgium': 'EUR', 'Finland': 'EUR', 'Malta': 'EUR',
};
const JUNK_TITLE = /\b(admission|preparation|pathway entry|pre-?sessional|foundation entry)\b/i;
// ВНИМАНИЕ: держать в синхроне с LEVEL_HINT в fix-catalog.mjs (общий источник правил).
const LEVEL_HINT = [
  [/\b(master'?s?|msc|m\.?a\b|m\.?b\.?a\b|llm|postgraduate|pg)\b/i, 'master'],
  [/\b(bachelor'?s?|bsc|b\.?a\b|beng|llb|undergraduate|ug)\b/i, 'bachelor'],
  [/\b(phd|doctoral|doctorate)\b/i, 'phd'],
];
const inferLevel = t => { for (const [re, exp] of LEVEL_HINT) if (re.test(t || '')) return exp; return null; };

const files = fs.readdirSync(CAT).filter(f => f.endsWith('.json'));
const report = [];                       // per-uni issues
const tally = {};                        // category → {unis:Set, items:n}
const bump = (cat, slug, n = 1) => { (tally[cat] ??= { unis: new Set(), items: 0 }); tally[cat].unis.add(slug); tally[cat].items += n; };

// кеш существующих картинок в public/ для проверки 404
const imgExists = rel => {
  if (!rel || /^https?:\/\//.test(rel)) return true;        // внешние не проверяем
  const p = path.join(PUBLIC, rel.replace(/^\//, ''));
  try { return fs.existsSync(p); } catch { return false; }
};

for (const f of files) {
  const slug = f.replace(/\.json$/, '');
  let o;
  try { o = JSON.parse(fs.readFileSync(path.join(CAT, f), 'utf8')); }
  catch (e) { bump('INTEGRITY:bad-json', slug); report.push({ slug, issues: ['bad-json: ' + e.message] }); continue; }

  const issues = [];
  const programs = Array.isArray(o.programs) ? o.programs : [];
  const byProg = (o.tuition && o.tuition.byProgram) || {};
  const deadlines = o.deadlines || {};
  const progSlugs = new Set(programs.map(p => p.slug));

  // --- MISSING: покрытие цен / дедлайнов ---
  const noPrice = programs.filter(p => !(p.slug in byProg)).length;
  const noDline = programs.filter(p => !(p.slug in deadlines)).length;
  if (noPrice) { bump('MISSING:price', slug, noPrice); issues.push(`price: ${noPrice}/${programs.length} программ без цены`); }
  if (noDline) { bump('MISSING:deadline', slug, noDline); issues.push(`deadline: ${noDline}/${programs.length} без дедлайна`); }
  const noFac = programs.filter(p => !p.faculty).length;
  if (noFac) { bump('MISSING:faculty', slug, noFac); }

  // --- MISSING: опциональные секции (дыры на карточке) ---
  const empty = (v) => !v || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);
  const ps = o.photoSets || {};
  const photoN = ['general', 'studentsFaculty', 'campuses', 'accommodation'].reduce((s, k) => s + ((ps[k] || []).length), 0);
  if (empty(o.scholarships)) { bump('MISSING:scholarships', slug); issues.push('нет стипендий'); }
  if (empty(o.accommodation)) { bump('MISSING:accommodation', slug); }
  if (empty(o.campuses)) { bump('MISSING:campuses', slug); }
  if (photoN === 0 && empty(o.gallery && o.gallery.items)) { bump('MISSING:photos', slug); issues.push('нет фото'); }
  if (empty(o.description && o.description.paragraphs)) { bump('MISSING:description', slug); }
  if (!o.requirements || !o.requirements.language || (o.requirements.language.ielts == null && o.requirements.language.toefl == null)) bump('MISSING:lang-req', slug);
  if (!o.logoUrl) bump('MISSING:logo', slug);

  // --- GARBAGE: цена 0, валюта, мусорные тайтлы, дубли, уровень ---
  const zeros = Object.values(byProg).filter(v => v === 0).length;
  if (zeros) { bump('GARBAGE:price-zero', slug, zeros); issues.push(`цена=0 у ${zeros} программ`); }
  const expCcy = CCY[o.country];
  if (expCcy && o.tuition && o.tuition.currency && o.tuition.currency !== expCcy) {
    bump('GARBAGE:currency', slug); issues.push(`валюта ${o.tuition.currency}, ожидалась ${expCcy} (${o.country})`);
  }
  const junk = programs.filter(p => JUNK_TITLE.test(p.title || '') && p.programType !== 'pathway').length;
  if (junk) { bump('GARBAGE:junk-title', slug, junk); issues.push(`${junk} мусорных тайтлов (admission/preparation)`); }
  const dupSlugs = programs.length - progSlugs.size;
  if (dupSlugs > 0) { bump('GARBAGE:dup-program-slug', slug, dupSlugs); issues.push(`${dupSlugs} дублей program.slug`); }
  let lvlBad = 0;
  for (const p of programs) {
    if (!['bachelor', 'master', 'phd'].includes(p.level)) continue;
    const inf = inferLevel(p.title);
    if (inf && inf !== p.level) lvlBad++;
  }
  if (lvlBad) { bump('GARBAGE:level-mismatch', slug, lvlBad); }

  // --- INTEGRITY: битые ссылки на картинки, brokenLink ---
  const imgs = [];
  if (o.logoUrl) imgs.push(o.logoUrl);
  for (const g of (o.gallery && o.gallery.items) || []) imgs.push(g.img);
  for (const k of ['general', 'studentsFaculty', 'campuses', 'accommodation']) for (const it of (ps[k] || [])) imgs.push(it.img);
  for (const it of (o.campuses || [])) if (it.img) imgs.push(it.img);
  for (const it of (o.accommodation || [])) if (it.img) imgs.push(it.img);
  const broken = imgs.filter(i => i && !imgExists(i)).length;
  if (broken) { bump('INTEGRITY:img-404', slug, broken); issues.push(`${broken} картинок 404`); }
  const brokenL = programs.filter(p => p.brokenLink).length;
  if (brokenL) bump('INTEGRITY:broken-link', slug, brokenL);

  if (issues.length) report.push({ slug, issues });
}

// --- ВЫВОД ---
const order = Object.keys(tally).sort((a, b) => tally[b].unis.size - tally[a].unis.size);
console.log(`\n=== АУДИТ КАТАЛОГА: ${files.length} вузов ===\n`);
console.log('категория'.padEnd(30) + 'вузов'.padEnd(8) + 'случаев');
console.log('-'.repeat(50));
for (const c of order) console.log(c.padEnd(30) + String(tally[c].unis.size).padEnd(8) + tally[c].items);

// топ-офендеры по числу проблем
report.sort((a, b) => b.issues.length - a.issues.length);
console.log(`\n=== ТОП-15 ПРОБЛЕМНЫХ ВУЗОВ ===`);
for (const r of report.slice(0, 15)) console.log(`${r.slug}: ${r.issues.join(' · ')}`);

const out = { generatedAt: new Date().toISOString(), totalUnis: files.length, tally: Object.fromEntries(order.map(c => [c, { unis: tally[c].unis.size, items: tally[c].items }])), perUni: report };
fs.writeFileSync(path.join(__dirname, 'sources', 'audit-report.json'), JSON.stringify(out, null, 2));
console.log(`\nПолный разбор: scraper/sources/audit-report.json (${report.length} вузов с проблемами)`);

// --- ГЕЙТ: hard-правила блокируют деплой, soft — только репорт ---
// HARD = объективно «кривые данные», которые НЕ должны попадать в прод.
// MISSING:* — soft (честные дыры, не фабрикуем; следим, чтобы не росли отдельным baseline).
const HARD = ['GARBAGE:currency', 'GARBAGE:junk-title', 'GARBAGE:level-mismatch', 'GARBAGE:dup-program-slug', 'GARBAGE:price-zero', 'INTEGRITY:bad-json', 'INTEGRITY:img-404'];
if (process.argv.includes('--gate')) {
  const failed = HARD.filter(c => tally[c] && tally[c].unis.size > 0);
  if (failed.length) {
    console.log(`\n❌ GATE FAIL — hard-нарушения (${failed.length} категорий):`);
    for (const c of failed) console.log(`  ${c}: ${tally[c].unis.size} вузов / ${tally[c].items} случаев`);
    console.log('Деплой заблокирован. Прогони scraper/fix-catalog.mjs или почини вручную.');
    process.exit(1);
  }
  console.log('\n✅ GATE PASS — hard-нарушений нет.');
}
