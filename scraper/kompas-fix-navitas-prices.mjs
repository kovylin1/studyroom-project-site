#!/usr/bin/env node
// kompas-fix-navitas-prices.mjs — P0.1: снять фабрикованные сид-цены Navitas.
//
// Диагноз (замер 2026-07-24): у 10 британских Navitas-вузов цены в tuition.byProgram
// раздавались литеральной таблицей UK_FEE_BAND_BASE/feeBand из seed-navitas-uk.mjs,
// одинаково всем. По правилу «не выдумывать» такие цены зануляются в честную пустоту;
// программы НЕ удаляем (правило 4).
//
// ПРАВКА КРИТЕРИЯ 2026-08-03. Раньше уликой фабрикации считалось отсутствие поля
// `source` у программы: сид его не писал. Критерий протух — добор цен из выгрузок
// (kompas-backfill-fees) проставил настоящие цены Edvoy, а `source` не проставил.
// На живом каталоге старый критерий снял бы 232 цены, из которых 218 сходятся с
// выгрузкой Edvoy по названию и сумме, то есть настоящие. Улика теперь одна:
// программу НЕ знает ни одна выгрузка `sources/kompas/extracts/*` (сверка по
// нормализованному названию) — тогда цене неоткуда взяться, кроме сида.
// Замер 2026-08-03 (`kompas-navitas-fees-diag.mjs`): подтверждённых цен 2760,
// расхождений 0, без цены 434, неподтверждённых 14 — и те оказались вариантами
// написания реальных записей Edvoy с той же суммой. Фабрикаций в живом каталоге нет.
//
// Работает на КОПИИ sources/kompas/catalog-work — живой каталог не тронут (правило 5).
// Снятое кладётся в бэкап, чтобы откат был одной командой. Кейсы — в панель /manager.
//
// Запуск: node kompas-fix-navitas-prices.mjs [--apply]  (без --apply только считает)

import fs from 'node:fs/promises';
import path from 'node:path';
import { KOMPAS_DIR, args, logger } from './lib/kompas-collect.mjs';
import { extractIndex, normTitle } from './kompas-navitas-fees-diag.mjs';

const log = logger('fix-navitas');
const APPLY = args.has('apply');
const WORK = path.join(KOMPAS_DIR, 'catalog-work');
const now = new Date().toISOString();

const UNIS = ['anglia-ruskin', 'birmingham-city', 'brunel', 'hertfordshire', 'portsmouth',
  'robert-gordon', 'keele', 'manchester-met', 'swansea', 'plymouth'];

const readJson = async (f) => JSON.parse(await fs.readFile(f, 'utf8'));

async function main() {
  if (!APPLY) log('СУХОЙ ПРОГОН: ничего не пишу, только считаю. Для записи добавь --apply');
  const backup = {};   // slug -> { programSlug: price } — снятые цены для отката
  const cases = [];
  const rows = [];
  let totalRemoved = 0, totalKept = 0;

  for (const slug of UNIS) {
    const file = path.join(WORK, `${slug}.json`);
    let u;
    try { u = await readJson(file); } catch { log(`  нет карточки: ${slug}`); continue; }

    const bp = (u.tuition && u.tuition.byProgram) || {};
    const bySlug = new Map((u.programs || []).map((p) => [p.slug, p]));
    const idx = await extractIndex(slug);   // название программы → цена выгрузки
    const removed = {};
    let kept = 0;

    for (const [pslug, price] of Object.entries(bp)) {
      const prog = bySlug.get(pslug);
      // Цена настоящая, если у программы есть source ИЛИ её знает выгрузка партнёра.
      const hit = prog ? idx.get(normTitle(prog.title)) : null;
      const backed = (prog && prog.source) || (hit && hit.fee > 0);
      if (!backed) { removed[pslug] = price; delete bp[pslug]; }
      else kept++;
    }

    const nRemoved = Object.keys(removed).length;
    totalRemoved += nRemoved; totalKept += kept;
    rows.push({ slug, name: u.name, removed: nRemoved, kept });
    if (nRemoved) {
      backup[slug] = removed;
      const sample = Object.entries(removed).slice(0, 3).map(([s, p]) => `«${s}» ${p} ${u.tuition.currency}`).join('; ');
      cases.push({
        id: `${slug}||kompas_navitas_price_fabricated||${nRemoved}`,
        slug, name: u.name,
        issue: 'kompas_navitas_price_fabricated',
        severity: 'critical',
        detail: `Снято ${nRemoved} фабрикованных цен Navitas (сид-таблица UK_FEE_BAND_BASE, у программ нет источника, Navitas реальных цен не отдаёт). Программы сохранены, цена теперь пустая (честно). Сохранено настоящих цен: ${kept}. Примеры снятого: ${sample}. Откат — sources/kompas/navitas-price-backup.json.`,
        catalog: nRemoved, official: null, program: null, sourceUrl: null,
        checkedAt: now, decision: null, decidedAt: null, applied: false,
      });

      if (APPLY) {
        u.tuition.byProgram = bp;
        u.lastChecked = now.slice(0, 10);
        await fs.writeFile(file, JSON.stringify(u, null, 2) + '\n', 'utf8');
      }
    }
  }

  if (APPLY) {
    await fs.writeFile(path.join(KOMPAS_DIR, 'navitas-price-backup.json'),
      JSON.stringify({ generatedAt: now, note: 'Снятые фабрикованные сид-цены Navitas. Откат: вернуть в tuition.byProgram.', prices: backup }, null, 2) + '\n', 'utf8');
    await fs.writeFile(path.join(KOMPAS_DIR, 'navitas-fix-review.json'),
      JSON.stringify({ generatedAt: now, scope: 'kompas-fix-navitas-prices', summary: { total: cases.length, removed: totalRemoved, kept: totalKept }, items: cases }, null, 2) + '\n', 'utf8');
  }

  console.table(rows);
  console.log(`ИТОГО: снято фабрикованных цен ${totalRemoved}, сохранено настоящих ${totalKept}, вузов ${rows.length}`);
  console.log(APPLY ? 'ПРИМЕНЕНО к catalog-work + бэкап + кейсы записаны' : 'СУХОЙ ПРОГОН — для записи добавь --apply');
}

main().catch((e) => { console.error(e); process.exit(1); });
