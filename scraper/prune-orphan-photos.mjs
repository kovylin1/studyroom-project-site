#!/usr/bin/env node
// prune-orphan-photos.mjs — удаляет файлы из site/public/photos, на которые
// не ссылается ни одна карточка каталога (ОРЁЛ, срез 3).
//
// Список ссылок пересчитывается ПО КАТАЛОГУ ПРЯМО СЕЙЧАС, а не берётся из
// реестра: реестр мог устареть, а цена ошибки здесь — безвозвратно удалённое
// фото. Лишний проход по 807 файлам дешевле такой ошибки.
//
// По умолчанию — сухой прогон: печатает, что удалил бы, и ничего не трогает.
// Удаляет только с флагом --apply.
//
// Usage:
//   node scraper/prune-orphan-photos.mjs              # показать, ничего не делая
//   node scraper/prune-orphan-photos.mjs --apply      # удалить
//   node scraper/prune-orphan-photos.mjs --apply --include-hunt   # заодно кандидатов МОТЫЛЬКА

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const CATALOG_DIR = path.join(PROJECT_ROOT, 'site/src/content/universities');
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'site/public');
const PHOTOS_DIR = path.join(PUBLIC_DIR, 'photos');

const APPLY = process.argv.includes('--apply');
const INCLUDE_HUNT = process.argv.includes('--include-hunt');
const LIST = process.argv.includes('--list');
const log = (...a) => process.stderr.write(`[prune] ${a.join(' ')}\n`);

// Кандидаты МОТЫЛЬКА формально тоже ни на что не ссылаются, но это не мусор,
// а несогласованный результат поиска. Удаляем их только по явному требованию.
const isHuntCandidate = (rel) => /\/hunt-\d+\.jpg$/i.test(rel);

async function main() {
  // 1. Все ссылки на картинки из каталога.
  const referenced = new Set();
  const files = (await fs.readdir(CATALOG_DIR)).filter(f => f.endsWith('.json'));
  for (const f of files) {
    const u = JSON.parse(await fs.readFile(path.join(CATALOG_DIR, f), 'utf8'));
    const arrays = [u.gallery?.items || [], u.accommodation || [], u.campuses || []];
    for (const key of ['general', 'studentsFaculty', 'campuses', 'accommodation']) {
      if (u.photoSets?.[key]) arrays.push(u.photoSets[key]);
    }
    for (const arr of arrays) for (const it of arr) if (it?.img) referenced.add(it.img);
    if (u.logoUrl) referenced.add(u.logoUrl);
  }
  log(`каталог: ${files.length} вузов, ${referenced.size} уникальных ссылок`);

  // 2. Все файлы на диске.
  const onDisk = [];
  const crawl = async (dir) => {
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) await crawl(p);
      else if (/\.(jpe?g|png|webp|avif|gif)$/i.test(e.name)) onDisk.push(p);
    }
  };
  await crawl(PHOTOS_DIR);

  // 3. Разница.
  const orphans = [], hunts = [];
  let orphanBytes = 0, huntBytes = 0;
  for (const abs of onDisk) {
    const rel = '/' + path.relative(PUBLIC_DIR, abs).replace(/\\/g, '/');
    if (referenced.has(rel)) continue;
    const { size } = await fs.stat(abs);
    if (isHuntCandidate(rel)) { hunts.push(abs); huntBytes += size; }
    else { orphans.push(abs); orphanBytes += size; }
  }

  const mb = (b) => (b / 1048576).toFixed(1);
  log(`файлов на диске: ${onDisk.length}`);
  log(`осиротевших: ${orphans.length} (${mb(orphanBytes)} МБ)`);
  log(`кандидатов МОТЫЛЬКА: ${hunts.length} (${mb(huntBytes)} МБ)${INCLUDE_HUNT ? ' — удаляем' : ' — оставляем, нужен --include-hunt'}`);

  const doomed = INCLUDE_HUNT ? [...orphans, ...hunts] : orphans;

  // Страховка от катастрофы: если под удаление попало больше половины
  // библиотеки, это почти наверняка сломанный расчёт ссылок, а не мусор.
  if (doomed.length > onDisk.length / 2) {
    log(`ОТКАЗ: под удаление попало ${doomed.length} из ${onDisk.length} файлов — больше половины.`);
    log('Похоже на ошибку в расчёте ссылок, а не на мусор. Проверьте каталог.');
    process.exit(1);
  }

  if (!APPLY) {
    if (LIST) {
      // Полный список в stdout — чтобы выборку для проверки глазами можно было
      // брать из НАСТОЯЩЕГО списка удаления, а не из постороннего замера.
      for (const p of doomed) console.log('/' + path.relative(PUBLIC_DIR, p).replace(/\\/g, '/'));
    } else {
      for (const p of doomed.slice(0, 10)) log('  ' + path.relative(PUBLIC_DIR, p).replace(/\\/g, '/'));
      if (doomed.length > 10) log(`  … и ещё ${doomed.length - 10}`);
    }
    log('СУХОЙ ПРОГОН. Чтобы удалить — повторите с --apply');
    return;
  }

  for (const p of doomed) await fs.unlink(p);
  log(`удалено ${doomed.length} файлов, освобождено ${mb(INCLUDE_HUNT ? orphanBytes + huntBytes : orphanBytes)} МБ`);
}

main().catch(e => { log('ФАТАЛЬНО:', e.message); process.exit(1); });
