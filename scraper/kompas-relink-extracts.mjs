#!/usr/bin/env node
// kompas-relink-extracts.mjs — КОМПАС сессия 2: привязка собранных выгрузок к слагам каталога.
//
// ЗАЧЕМ. Коллекторы назвали файлы слагом АГРЕГАТОРА: Oxford International — «bangor-university»,
// QA — «northumbria-university», тогда как каталог знает «bangor» и «northumbria». Сводка
// показывала ноль совпадений там, где они есть, а сессия 4 не смогла бы сверить карточку
// с её источником. Здесь каждая выгрузка получает поле catalogSlug и переименовывается
// в слаг каталога; исходное имя сохраняется в aggregatorSlug.
//
// Сети нет — работает по уже собранным файлам, прогон идемпотентен, живой каталог не трогает.
// Usage: node scraper/kompas-relink-extracts.mjs [--dry-run]

import fs from 'fs/promises';
import path from 'path';
import { EXTRACTS_DIR, KOMPAS_DIR, args, logger } from './lib/kompas-collect.mjs';
import { buildCatalogIndex, matchToCatalog } from './lib/kompas-catalog-match.mjs';

const log = logger('relink');
const DRY = args.has('dry-run');

const catalog = await buildCatalogIndex();
log(`каталог: ${catalog.length} вузов`);

const aggs = await fs.readdir(EXTRACTS_DIR);
const report = [];

for (const agg of aggs) {
  const dir = path.join(EXTRACTS_DIR, agg);
  const stat = await fs.stat(dir);
  if (!stat.isDirectory()) continue;
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json'));

  for (const file of files) {
    const p = path.join(dir, file);
    const data = JSON.parse(await fs.readFile(p, 'utf8'));
    const aggregatorSlug = data.aggregatorSlug || data.slug;

    // уже привязано — не трогаем (идемпотентность)
    if (data.catalogSlug && data.slug === data.catalogSlug) {
      report.push({ agg, file, catalogSlug: data.catalogSlug, method: data.matchMethod || 'already', changed: false });
      continue;
    }

    const hit = matchToCatalog(data.name || aggregatorSlug, catalog, { url: data.sourceUrl });
    // если имя не сошлось, пробуем слаг агрегатора как имя («bangor-university» -> «bangor university»)
    const fallback = hit.catalogSlug ? null : matchToCatalog(aggregatorSlug.replace(/-/g, ' '), catalog, { url: data.sourceUrl });
    const final = hit.catalogSlug ? hit : (fallback?.catalogSlug ? fallback : hit);

    const out = {
      ...data,
      slug: final.catalogSlug || aggregatorSlug,
      aggregatorSlug,
      catalogSlug: final.catalogSlug,
      matchMethod: final.matchMethod,
      ...(final.catalogSlug ? {} : { unmatchedTried: final.tried }),
    };

    const targetName = `${out.slug}.json`;
    const target = path.join(dir, targetName);

    if (!DRY) {
      await fs.writeFile(target, JSON.stringify(out, null, 2) + '\n', 'utf8');
      if (targetName !== file) await fs.unlink(p);
    }
    report.push({ agg, file, catalogSlug: final.catalogSlug, method: final.matchMethod, changed: targetName !== file });
  }
}

const matched = report.filter((r) => r.catalogSlug);
const unmatched = report.filter((r) => !r.catalogSlug);

if (!DRY) {
  await fs.writeFile(
    path.join(KOMPAS_DIR, 'relink-report.json'),
    JSON.stringify({
      _meta: { generatedAt: new Date().toISOString(), total: report.length, matched: matched.length, unmatched: unmatched.length },
      rows: report,
    }, null, 2) + '\n',
    'utf8',
  );
}

log(`выгрузок ${report.length}: привязано ${matched.length}, переименовано ${report.filter((r) => r.changed).length}, без пары ${unmatched.length}`);
for (const u of unmatched) log(`  без пары: ${u.agg}/${u.file}`);
if (DRY) log('DRY-RUN: на диск не писали');
