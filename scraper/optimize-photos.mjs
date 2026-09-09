#!/usr/bin/env node
// optimize-photos.mjs — задача E: сжать site/public/photos под веб.
//
// Замер 30.08: 3,4 ГБ на 5 379 файлов, в среднем ~640 КБ. Это исходники со стоков
// и Wikimedia, никогда не пережатые: 925 файлов тяжелее мегабайта.
//
// Что делает: у каждого .jpg/.jpeg ширина сводится к MAX_WIDTH, качество к Q,
// mozjpeg + progressive. ИМЯ ФАЙЛА НЕ МЕНЯЕТСЯ — пути в photoSets карточек
// и манифесты сбора остаются валидными, шаблоны править не надо.
//
// Файл переписывается, только если новый меньше старого хотя бы на MIN_GAIN.
// Иначе остаётся как был: пережимать уже сжатое — терять качество даром.
// .png (3 штуки) и .webp (2) не трогаем: переименование сломало бы ссылки.
//
// Оригиналы восстановимы: манифесты сбора лежат в scraper/photo-manifests,
// перекачка — download-photos.mjs.
//
// Запуск: node optimize-photos.mjs [--dry-run] [--width=1600] [--quality=78]
//         [--concurrency=4] [--min-gain=0.1]

import { readdir, stat, writeFile, readFile } from 'node:fs/promises';
import { resolve, dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PHOTOS_DIR = join(ROOT, 'site/public/photos');
const REPORT = join(ROOT, 'sources/kompas/photos-optimize.json');

const arg = (p, d) => {
  const hit = process.argv.find((a) => a.startsWith(p));
  return hit ? hit.slice(p.length) : d;
};
const DRY_RUN = process.argv.includes('--dry-run');
const MAX_WIDTH = parseInt(arg('--width=', '1600'), 10);
const QUALITY = parseInt(arg('--quality=', '78'), 10);
const CONCURRENCY = parseInt(arg('--concurrency=', '4'), 10);
const MIN_GAIN = parseFloat(arg('--min-gain=', '0.1'));

const log = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (/\.jpe?g$/i.test(e.name)) out.push(p);
  }
  return out;
}

const stats = { seen: 0, rewritten: 0, kept: 0, failed: 0, bytesBefore: 0, bytesAfter: 0 };
const failures = [];

async function processFile(file) {
  stats.seen++;
  let before = 0;
  try {
    before = (await stat(file)).size;
    stats.bytesBefore += before;
    const buf = await sharp(await readFile(file))
      .rotate()
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: QUALITY, mozjpeg: true, progressive: true })
      .toBuffer();
    if (buf.length > before * (1 - MIN_GAIN)) {
      stats.kept++;
      stats.bytesAfter += before;
      return;
    }
    if (!DRY_RUN) await writeFile(file, buf);
    stats.rewritten++;
    stats.bytesAfter += buf.length;
  } catch (err) {
    stats.failed++;
    stats.bytesAfter += before;
    failures.push({ file: file.slice(ROOT.length + 1), error: String(err.message || err) });
  }
  if (stats.seen % 250 === 0) {
    const mb = (n) => (n / 1024 / 1024).toFixed(0);
    log(`${stats.seen} файлов: переписано ${stats.rewritten}, оставлено ${stats.kept}, ` +
        `${mb(stats.bytesBefore)} → ${mb(stats.bytesAfter)} МБ`);
  }
}

const files = await walk(PHOTOS_DIR);
log(`файлов jpeg: ${files.length}${DRY_RUN ? ' (DRY-RUN)' : ''}, ширина ≤ ${MAX_WIDTH}, качество ${QUALITY}`);

let cursor = 0;
const worker = async () => {
  while (cursor < files.length) await processFile(files[cursor++]);
};
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const mb = (n) => +(n / 1024 / 1024).toFixed(1);
const summary = {
  ranAt: new Date().toISOString(),
  dryRun: DRY_RUN,
  maxWidth: MAX_WIDTH,
  quality: QUALITY,
  files: stats.seen,
  rewritten: stats.rewritten,
  kept: stats.kept,
  failed: stats.failed,
  mbBefore: mb(stats.bytesBefore),
  mbAfter: mb(stats.bytesAfter),
  savedPct: stats.bytesBefore ? +(100 * (1 - stats.bytesAfter / stats.bytesBefore)).toFixed(1) : 0,
  failures: failures.slice(0, 50),
};
await writeFile(REPORT, JSON.stringify(summary, null, 2));
log(`ГОТОВО: ${summary.mbBefore} → ${summary.mbAfter} МБ (−${summary.savedPct} %), ` +
    `переписано ${summary.rewritten}, оставлено ${summary.kept}, ошибок ${summary.failed}`);
log(`отчёт: ${REPORT.slice(ROOT.length + 1)}`);
