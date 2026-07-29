#!/usr/bin/env node
// fix-catalog.mjs — Модуль 1: детерминированная чистка каталога. $0 LLM, идемпотентно.
// Фиксеры: currency (USD-leak), level (из тайтла), junk-title→pathway, dup-slug, zero-price, broken-img.
// Не удаляет вузы. Не фабрикует. Перед записью требует бэкап (sources/_catalog_backup_2026-06-24).
// Usage: node scraper/fix-catalog.mjs [--dry] [--only=currency,level,...]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CAT = path.join(__dirname, '..', 'site', 'src', 'content', 'universities');
const PUBLIC = path.join(__dirname, '..', 'site', 'public');
const DRY = process.argv.includes('--dry');
const onlyArg = process.argv.find(a => a.startsWith('--only='));
const ONLY = onlyArg ? new Set(onlyArg.split('=')[1].split(',')) : null;
const on = name => !ONLY || ONLY.has(name);

const CCY = {
  'United Kingdom': 'GBP', 'UK': 'GBP', 'England': 'GBP', 'Scotland': 'GBP', 'Wales': 'GBP',
  'United States': 'USD', 'USA': 'USD', 'Canada': 'CAD', 'Australia': 'AUD', 'New Zealand': 'NZD',
  'Kazakhstan': 'KZT', 'Germany': 'EUR', 'France': 'EUR', 'Netherlands': 'EUR', 'Spain': 'EUR',
  'Italy': 'EUR', 'Ireland': 'EUR', 'Austria': 'EUR', 'Belgium': 'EUR', 'Finland': 'EUR', 'Malta': 'EUR',
};
const JUNK_TITLE = /\b(admission|preparation|pathway entry|pre-?sessional|foundation entry)\b/i;
// ВНИМАНИЕ: держать в синхроне с LEVEL_HINT в audit-catalog.mjs (общий источник правил).
const LEVEL_HINT = [
  [/\b(master'?s?|msc|m\.?a\b|m\.?b\.?a\b|llm|postgraduate|pg)\b/i, 'master'],
  [/\b(bachelor'?s?|bsc|b\.?a\b|beng|llb|undergraduate|ug)\b/i, 'bachelor'],
  [/\b(phd|doctoral|doctorate)\b/i, 'phd'],
];
const inferLevel = t => { for (const [re, exp] of LEVEL_HINT) if (re.test(t || '')) return exp; return null; };
const imgExists = rel => !rel || /^https?:\/\//.test(rel) || fs.existsSync(path.join(PUBLIC, rel.replace(/^\//, '')));

const stat = {}; // fixer → changes
const add = (k, n = 1) => (stat[k] = (stat[k] || 0) + n);
const touched = new Set();

for (const f of fs.readdirSync(CAT).filter(f => f.endsWith('.json'))) {
  const fp = path.join(CAT, f);
  let o; try { o = JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { continue; }
  const programs = Array.isArray(o.programs) ? o.programs : [];
  let changed = false;

  // 1. currency: валюта вуза = валюта страны (страна — авторитетный сигнал; чинит USD-leak и пр.)
  if (on('currency') && o.tuition && o.tuition.currency) {
    const exp = CCY[o.country];
    if (exp && o.tuition.currency !== exp) { o.tuition.currency = exp; add('currency'); changed = true; }
  }

  // 2. level: переразметка из тайтла (только bachelor/master/phd). inferLevel = первый
  // подходящий hint по порядку массива — тот же выбор, что в audit-catalog.mjs (без осцилляций).
  if (on('level')) {
    for (const p of programs) {
      if (!['bachelor', 'master', 'phd'].includes(p.level)) continue;
      const inf = inferLevel(p.title);
      if (inf && inf !== p.level) { p.level = inf; add('level'); changed = true; }
    }
  }

  // 3. junk-title → programType:'pathway' (честный тег ярлыка пути)
  if (on('junk')) {
    for (const p of programs) {
      if (JUNK_TITLE.test(p.title || '') && p.programType !== 'pathway') { p.programType = 'pathway'; add('junk'); changed = true; }
    }
  }

  // 4. dup-slug: убрать повторные программы с одинаковым slug (оставить первый)
  if (on('dup')) {
    const seen = new Set(); const kept = [];
    for (const p of programs) { if (p.slug && seen.has(p.slug)) { add('dup'); changed = true; continue; } if (p.slug) seen.add(p.slug); kept.push(p); }
    if (kept.length !== programs.length) o.programs = kept;
  }

  // 5. zero-price: byProgram[slug]===0 → удалить ключ (честно «нет цены»)
  if (on('zero') && o.tuition && o.tuition.byProgram) {
    for (const k of Object.keys(o.tuition.byProgram)) if (o.tuition.byProgram[k] === 0) { delete o.tuition.byProgram[k]; add('zero'); changed = true; }
  }

  // 6. broken-img: путь без файла в public/ → убрать
  if (on('img')) {
    if (o.logoUrl && !imgExists(o.logoUrl)) { delete o.logoUrl; add('img'); changed = true; }
    if (o.gallery && Array.isArray(o.gallery.items)) {
      const k = o.gallery.items.filter(it => imgExists(it.img)); if (k.length !== o.gallery.items.length) { add('img', o.gallery.items.length - k.length); o.gallery.items = k; changed = true; }
    }
    if (o.photoSets) for (const key of ['general', 'studentsFaculty', 'campuses', 'accommodation']) {
      if (Array.isArray(o.photoSets[key])) { const k = o.photoSets[key].filter(it => imgExists(it.img)); if (k.length !== o.photoSets[key].length) { add('img', o.photoSets[key].length - k.length); o.photoSets[key] = k; changed = true; } }
    }
    for (const key of ['campuses', 'accommodation']) if (Array.isArray(o[key])) for (const it of o[key]) if (it.img && !imgExists(it.img)) { delete it.img; add('img'); changed = true; }
  }

  if (changed) { touched.add(f); if (!DRY) fs.writeFileSync(fp, JSON.stringify(o, null, 2) + '\n'); }
}

console.log((DRY ? '=== DRY RUN (без записи) ===' : '=== ПРИМЕНЕНО ==='));
for (const k of Object.keys(stat).sort()) console.log(`  ${k.padEnd(10)} ${stat[k]} изменений`);
console.log(`файлов затронуто: ${touched.size}`);
