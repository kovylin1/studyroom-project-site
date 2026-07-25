#!/usr/bin/env node
// kompas-dupe-scan.mjs — КОМПАС, сессия 5: поиск ДУБЛЕЙ каталога по данным источников.
//
// Зачем отдельный скрипт. Дубли до сих пор находились попутно и заносились в
// kompas-merge-dupes.mjs руками (три пары сессии 4.5). Пара
// «international-school-of-management-ism ↔ ism-germany» всплыла в сессии 5 только
// потому, что у одной из карточек не было выгрузки — и как только выгрузка появилась,
// пара пропала из отчёта о дырах вместе с самим фактом дубля. Так дубль теряется.
//
// Признак дубля, который даёт источник. Агрегатор ведёт свой список вузов и сам
// привязывает каждую запись к слагу каталога (поле `to`). Если ИМЯ записи источника
// само по себе даёт слаг, под которым в каталоге лежит ОТДЕЛЬНАЯ карточка, а привязка
// ушла к ДРУГОЙ карточке — в каталоге две карточки на один вуз источника.
//
// Скрипт ничего не сливает и не пишет в каталог: только кейсы оператору. Слияние —
// решение владельца (см. kompas-merge-dupes.mjs).
//
// Запуск: node kompas-dupe-scan.mjs

import fs from 'node:fs/promises';
import path from 'node:path';
import { KOMPAS_DIR, logger } from './lib/kompas-collect.mjs';

const log = logger('dupes');
const WORK = path.join(KOMPAS_DIR, 'catalog-work');
const MEM = path.join(KOMPAS_DIR, 'membership');
const OUT = path.join(KOMPAS_DIR, 'dupe-scan-review.json');

// «&» → «and» до срезки символов: каталог пишет «texas-aandm-…», наивная срезка
// давала «texas-a-m-…» и совпадение терялось.
const slugify = (s) => String(s).toLowerCase().replace(/&/g, 'and')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const readJson = async (f) => JSON.parse(await fs.readFile(f, 'utf8'));

async function main() {
  const now = new Date().toISOString();

  const cards = new Map();  // слаг → { programs, name }
  for (const f of await fs.readdir(WORK)) {
    if (!f.endsWith('.json')) continue;
    const d = await readJson(path.join(WORK, f));
    cards.set(f.replace(/\.json$/, ''), { name: d.name, programs: (d.programs ?? []).length, mergedInto: d.mergedInto ?? null });
  }
  log(`карточек в рабочей копии: ${cards.size}`);

  // Слаги, по которым кейс уже выпустил kompas-gaps (kind «merged» описывает ровно ту же
  // пару). Без этого оператор увидел бы один и тот же дубль дважды разными словами.
  let inGaps = new Set();
  try {
    const g = await readJson(path.join(KOMPAS_DIR, 'gap-review.json'));
    inGaps = new Set((g.items ?? []).map((i) => i.slug));
  } catch { /* отчёта о дырах нет — тогда просто не исключаем */ }

  const cases = [];
  const seen = new Set();
  for (const f of await fs.readdir(MEM)) {
    if (!f.endsWith('.json')) continue;
    const agg = f.replace(/\.json$/, '');
    const mem = await readJson(path.join(MEM, f));
    for (const m of mem.matched ?? []) {
      if (!m.from || !m.to) continue;
      // Кандидаты в слаг дубля: имя записи источника и его собственный ref.
      for (const cand of new Set([slugify(m.from), m.edpRefId].filter(Boolean))) {
        if (cand === m.to) continue;
        const dup = cards.get(cand); const keep = cards.get(m.to);
        if (!dup || !keep) continue;          // одной из карточек нет — это не дубль
        if (dup.mergedInto || keep.mergedInto) continue;  // уже разобрано раньше
        if (inGaps.has(cand)) continue;                   // кейс уже выпустил kompas-gaps
        const id = `${cand}||kompas_dupe_candidate||${m.to}`;
        if (seen.has(id)) continue;
        seen.add(id);
        cases.push({
          id, slug: cand, name: dup.name,
          issue: 'kompas_dupe_candidate',
          severity: 'warning',
          detail: `Источник ${agg} знает этот вуз как «${m.from}» (${m.courses ?? '?'} курсов) и привязал его к карточке «${m.to}». В каталоге при этом лежат ОБЕ карточки: «${cand}» — ${dup.programs} программ, «${m.to}» — ${keep.programs} программ. Похоже на один вуз под двумя слагами. Нужно решение: слить (и в какую) или развести как разные заведения.`,
          catalog: dup.programs, official: keep.programs, program: null, sourceUrl: null,
          checkedAt: now, decision: null, decidedAt: null, applied: false,
        });
      }
    }
  }

  cases.sort((a, b) => String(a.slug).localeCompare(String(b.slug)));
  await fs.writeFile(OUT, JSON.stringify({
    generatedAt: now, scope: 'kompas-dupe-scan',
    summary: { total: cases.length, byIssue: { kompas_dupe_candidate: cases.length } },
    items: cases,
  }, null, 2) + '\n', 'utf8');

  log(`кандидатов в дубли: ${cases.length}`);
  for (const c of cases) log(`  ${c.slug} (${c.catalog}) ↔ ${c.id.split('||')[2]} (${c.official})`);
  console.log('DUPE SCAN DONE', JSON.stringify({ total: cases.length }));
}

main().catch((e) => { console.error(e); process.exit(1); });
