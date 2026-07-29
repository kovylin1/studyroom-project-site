#!/usr/bin/env node
// orel-audit.mjs — ОРЁЛ-аудитор достоверности фото (срез 3).
//
// Читает каталог и диск, считает отпечатки, строит SSOT-реестр провенанса
// и проставляет imgKind в трёх доменах: gallery.items[], accommodation[], campuses[].
// НИЧЕГО не удаляет, не качает и не заменяет — только помечает.
//
// Заменяет orel-photo-quality.mjs, который искал сток по чёрному списку имён
// (shutterstock, happy-students) и потому не видел наш сток с именами bobr-N.jpg,
// зато умел удалять карточки из каталога.
//
// Usage: node scraper/orel-audit.mjs [--limit=N] [--slug=<uni>] [--dry-run]

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { fingerprint } from './lib/photo-fingerprint.mjs';
import { classifyPhoto } from './lib/photo-classify.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const CATALOG_DIR = path.join(PROJECT_ROOT, 'site/src/content/universities');
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'site/public');
const REGISTRY_OUT = path.join(__dirname, 'sources/photo-registry.json');
const AUDIT_OUT = path.join(__dirname, 'sources/audit/orel-audit.json');

const arg = (p) => (process.argv.find(a => a.startsWith(p)) || '').slice(p.length);
const LIMIT = parseInt(arg('--limit=') || 'Infinity', 10);
const SLUG_FILTER = arg('--slug=') || null;
const DRY_RUN = process.argv.includes('--dry-run');

const NOW = new Date().toISOString();
const log = (...a) => process.stderr.write(`[ОРЁЛ-аудит] ${NOW.slice(11, 19)} ${a.join(' ')}\n`);

const DOMAINS = [
  { key: 'gallery', get: (u) => u.gallery?.items || [] },
  { key: 'accommodation', get: (u) => u.accommodation || [] },
  { key: 'campuses', get: (u) => u.campuses || [] },
];
const itemsOf = (json, domain) => DOMAINS.find(d => d.key === domain).get(json);

async function main() {
  // ВАЖНО: граф использования строится ВСЕГДА по всему каталогу, даже когда
  // просят обработать один вуз. Метка зависит от того, скольким вузам
  // принадлежит картинка; посчитав это по выборке, мы записали бы ложь —
  // фото, стоящее у 40 вузов, в выборке из 20 выглядит уникальным.
  // Фильтры --limit/--slug сужают только то, что ЗАПИСЫВАЕТСЯ.
  const allFiles = (await fs.readdir(CATALOG_DIR)).filter(f => f.endsWith('.json')).sort();
  let targetFiles = allFiles;
  if (SLUG_FILTER) targetFiles = targetFiles.filter(f => f === `${SLUG_FILTER}.json`);
  if (Number.isFinite(LIMIT)) targetFiles = targetFiles.slice(0, LIMIT);
  log(`каталог: ${allFiles.length} вузов; помечаем: ${targetFiles.length}${DRY_RUN ? ' (сухой прогон)' : ''}`);

  // Проход 1 — собрать все ссылки на фото по ВСЕМУ каталогу.
  const unis = new Map();        // slug -> { file, json }
  const fileToSlug = new Map();  // имя файла -> слаг внутри него
  const refs = [];               // { slug, domain, index, img }
  for (const f of allFiles) {
    const json = JSON.parse(await fs.readFile(path.join(CATALOG_DIR, f), 'utf8'));
    const slug = json.slug || f.replace(/\.json$/, '');
    unis.set(slug, { file: f, json });
    fileToSlug.set(f, slug);
    for (const d of DOMAINS) d.get(json).forEach((item, index) => {
      if (item?.img) refs.push({ slug, domain: d.key, index, img: item.img });
    });
  }
  log(`ссылок на фото: ${refs.length}`);

  // Кого помечаем — считаем ПО СЛАГАМ, а не по именам файлов: имя файла и слаг
  // внутри совпадают не всегда (есть файл с лишним дефисом на конце имени),
  // и сопоставление по имени тихо теряло такие вузы.
  const targetSlugs = new Set(
    targetFiles.map(f => fileToSlug.get(f)).filter(Boolean)
  );
  if (targetSlugs.size !== targetFiles.length) {
    log(`ВНИМАНИЕ: слагов ${targetSlugs.size} против ${targetFiles.length} файлов — есть дубли слагов`);
  }

  // Отпечаток каждого локального файла считаем ровно один раз.
  const fpCache = new Map();
  let done = 0;
  for (const r of refs) {
    if (!r.img.startsWith('/') || fpCache.has(r.img)) continue;
    if (++done % 500 === 0) log(`отпечатков посчитано: ${done}`);
    try {
      fpCache.set(r.img, await fingerprint(await fs.readFile(path.join(PUBLIC_DIR, r.img))));
    } catch {
      fpCache.set(r.img, null);   // файла нет на диске
    }
  }
  log(`уникальных файлов отпечатано: ${fpCache.size}`);

  // Сколько РАЗНЫХ вузов использует каждое изображение — по содержимому, не по пути.
  // Внешние ссылки группируются по URL: скачивать их аудит не имеет права.
  const keyOf = (img) => fpCache.get(img)?.sha1 || img;
  const unisByKey = new Map();
  for (const r of refs) {
    const k = keyOf(r.img);
    if (!unisByKey.has(k)) unisByKey.set(k, new Set());
    unisByKey.get(k).add(r.slug);
  }

  // Проход 2 — проставить метки, не тронув уже имеющийся провенанс.
  const tally = { verified: 0, stock: 0, shared: 0, unknown: 0 };
  const touched = new Set();
  for (const r of refs) {
    if (!targetSlugs.has(r.slug)) continue;
    const item = itemsOf(unis.get(r.slug).json, r.domain)[r.index];
    const provenance = item.imgSource && item.imgLicense
      ? { source: item.imgSource, license: item.imgLicense, author: item.imgAuthor }
      : null;
    const kind = classifyPhoto({
      path: r.img,
      slug: r.slug,
      unisUsing: unisByKey.get(keyOf(r.img)).size,
      provenance,
    });
    tally[kind]++;
    if (item.imgKind !== kind) { item.imgKind = kind; touched.add(r.slug); }
  }

  // Реестр: одна запись на уникальный путь.
  const usersByImg = new Map();
  for (const r of refs) {
    if (!usersByImg.has(r.img)) usersByImg.set(r.img, []);
    usersByImg.get(r.img).push({ slug: r.slug, domain: r.domain });
  }
  const registry = [...fpCache.entries()].map(([img, fp]) => ({
    path: img,
    sha1: fp?.sha1 ?? null,
    dhash: fp?.dhash ?? null,
    width: fp?.width ?? null,
    height: fp?.height ?? null,
    bytes: fp?.bytes ?? null,
    onDisk: fp !== null,
    usedBy: usersByImg.get(img) || [],
  }));

  // Дыры: вузы, отсортированные по числу подтверждённых фото.
  const gaps = [...unis.entries()].map(([slug, { json }]) => {
    const mine = refs.filter(r => r.slug === slug);
    const verified = mine.filter(r => itemsOf(json, r.domain)[r.index].imgKind === 'verified').length;
    return { slug, photos: mine.length, verified };
  }).sort((a, b) => a.verified - b.verified || b.photos - a.photos);

  const report = {
    generatedAt: NOW,
    dryRun: DRY_RUN,
    unis: unis.size,
    refs: refs.length,
    uniqueImages: new Set([...fpCache.values()].map(f => f?.sha1).filter(Boolean)).size,
    tally,
    gaps,
  };

  if (DRY_RUN) {
    log(`СУХОЙ ПРОГОН — на диск не пишем. ${JSON.stringify(tally)}`);
    log(`изменилось бы вузов: ${touched.size}`);
    return;
  }

  for (const slug of touched) {
    const { file, json } = unis.get(slug);
    await fs.writeFile(path.join(CATALOG_DIR, file), JSON.stringify(json, null, 2) + '\n');
  }
  await fs.mkdir(path.dirname(AUDIT_OUT), { recursive: true });
  await fs.writeFile(REGISTRY_OUT, JSON.stringify(registry, null, 1) + '\n');
  await fs.writeFile(AUDIT_OUT, JSON.stringify(report, null, 1) + '\n');
  log(`готово. вузов изменено: ${touched.size}. ${JSON.stringify(tally)}`);
}

main().catch(e => { log('ФАТАЛЬНО:', e.message); process.exit(1); });
