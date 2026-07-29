#!/usr/bin/env node
// orel-filter-candidates.mjs — чистка уже собранного списка кандидатов.
//
// Нужен, чтобы не гонять сеть заново: охота по 807 вузам занимает три часа,
// а отсеять лишнее можно локально по файлам, которые уже лежат на диске.
//
// Убирает две вещи, замеченные владельцем при просмотре:
//   1. чёрно-белые снимки — по ДОЛЕ ЦВЕТНЫХ ПИКСЕЛЕЙ, а не по средней
//      насыщенности: у зелёной вывески Oregon средняя вышла 0.0477, у цветного
//      фасада Acadia 0.1000 — тёмные участки тянут среднее вниз и признак врёт;
//   2. повторы того, что уже стоит в каталоге, у ЛЮБОГО вуза.
//
// В КАТАЛОГ НЕ ПИШЕТ. Правит только sources/photo-candidates.json.
// Файлы отсеянных кандидатов не удаляет — их подберёт prune-orphan-photos.mjs.
//
// Usage: node scraper/orel-filter-candidates.mjs [--dry-run] [--colour=0.05]

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { hamming } from './lib/photo-fingerprint.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CANDIDATES = path.join(ROOT, 'sources/photo-candidates.json');
const REGISTRY = path.join(__dirname, 'sources/photo-registry.json');

const arg = (p) => (process.argv.find(a => a.startsWith(p)) || '').slice(p.length);
const DRY_RUN = process.argv.includes('--dry-run');
// 0.05 — граница НАСТОЯЩЕГО чёрно-белого: у серого снимка цветных пикселей
// почти нет. Выше идут цветные кадры, которые просто выглядят блёкло
// (серое здание, пасмурное небо) — это уже вопрос вкуса, а не признак архива,
// и решать его должен оператор в панели, а не порог в скрипте.
const COLOUR_MIN = parseFloat(arg('--colour=') || '0.05');
const DHASH_NEAR = 8;

const log = (...a) => process.stderr.write(`[ОРЁЛ-фильтр] ${a.join(' ')}\n`);

/** Доля пикселей, где каналы заметно расходятся. У чистого ч/б ≈ 0. */
async function colourFrac(file) {
  const { data, info } = await sharp(file).resize(200, 200, { fit: 'inside' })
    .removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.channels < 3) return 0;
  let colour = 0;
  const n = info.width * info.height;
  for (let i = 0; i < data.length; i += info.channels) {
    const mx = Math.max(data[i], data[i + 1], data[i + 2]);
    const mn = Math.min(data[i], data[i + 1], data[i + 2]);
    if (mx - mn > 12) colour++;
  }
  return n ? colour / n : 0;
}

async function main() {
  const report = JSON.parse(await fs.readFile(CANDIDATES, 'utf8'));
  const registry = JSON.parse(await fs.readFile(REGISTRY, 'utf8'));
  const inCatalog = registry.filter(r => r.dhash)
    .map(r => ({ sha1: r.sha1, dhash: r.dhash, path: r.path, slugs: r.usedBy.map(u => u.slug) }));

  const kept = [];
  const dropped = { bw: [], dup: [], missing: [] };

  for (const c of report.candidates) {
    const file = path.join(ROOT, 'site/public', c.img.replace(/^\//, ''));

    const dup = inCatalog.find(r => r.sha1 === c.sha1 || hamming(r.dhash, c.dhash) <= DHASH_NEAR);
    if (dup) { dropped.dup.push({ c, was: dup.path, slugs: dup.slugs }); continue; }

    let cf;
    try { cf = await colourFrac(file); }
    catch { dropped.missing.push({ c }); continue; }   // файла нет — брать нечего
    if (cf < COLOUR_MIN) { dropped.bw.push({ c, cf }); continue; }

    kept.push(c);
  }

  const unisBefore = new Set(report.candidates.map(c => c.slug)).size;
  const unisAfter = new Set(kept.map(c => c.slug)).size;

  log(`было ${report.candidates.length} кандидатов у ${unisBefore} вузов`);
  log(`убрано чёрно-белых: ${dropped.bw.length}`);
  for (const d of dropped.bw) log(`   ${d.cf.toFixed(4)} ${d.c.slug}/${d.c.img.split('/').pop()}`);
  const sameUni = dropped.dup.filter(d => d.slugs.includes(d.c.slug)).length;
  log(`убрано повторов каталога: ${dropped.dup.length} (дубли своего же фото ${sameUni}, чужого ${dropped.dup.length - sameUni})`);
  if (dropped.missing.length) log(`пропущено без файла на диске: ${dropped.missing.length}`);
  log(`осталось ${kept.length} кандидатов у ${unisAfter} вузов`);
  if (unisAfter < unisBefore) log(`ВНИМАНИЕ: ${unisBefore - unisAfter} вузов остались вовсе без кандидатов`);

  if (DRY_RUN) { log('СУХОЙ ПРОГОН — файл не переписан.'); return; }

  report.candidates = kept;
  report.stats = {
    ...report.stats,
    withCandidates: unisAfter,
    filteredOut: { blackAndWhite: dropped.bw.length, duplicateOfCatalog: dropped.dup.length },
  };
  await fs.writeFile(CANDIDATES, JSON.stringify(report, null, 1) + '\n');
  log('файл кандидатов обновлён.');
}

main().catch(e => { log('ФАТАЛЬНО:', e.message); process.exit(1); });
