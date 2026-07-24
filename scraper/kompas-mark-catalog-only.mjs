#!/usr/bin/env node
// kompas-mark-catalog-only.mjs — P1: пометить программы, которых нет ни в одном
// назначенном источнике вуза.
//
// Замер: 21 621 программа есть только в каталоге. Это НЕ команда на удаление
// (правило 4): либо источник их прячет, либо запись устарела/выдумана — решает
// владелец в сессии 5. Задача P1 — проставить метку, чтобы решение было по чему
// принимать, и НЕ трогать те вузы, где сравнивать не с чем.
//
// Что делает: по каждому СВЕРЕННОМУ вузу (есть выгрузка источника) берёт
// catalogOnly из того же движка, что и замер, и ставит на программу
//   program.kompasStatus   = 'catalog-only'
//   program.kompasCheckedAt = <дата>
// Заблокированные (QS) и пустые (Navitas/CATS) источники пропускаются — их
// программы не помечаются, потому что «нет в источнике» там ничего не значит.
//
// Идемпотентно: повторный прогон не двоит. Снятие метки — по бэкапу.
// Работает на КОПИИ sources/kompas/catalog-work. Живой каталог не тронут.
//
// Запуск: node kompas-mark-catalog-only.mjs [--apply]

import fs from 'node:fs/promises';
import path from 'node:path';
import { KOMPAS_DIR, args, logger } from './lib/kompas-collect.mjs';
import { WORK_DIR, readJson, loadSourceIndex, resolveAssignment, diffUniversity } from './lib/kompas-diff-core.mjs';

const log = logger('mark-cat-only');
const APPLY = args.has('apply');
const TODAY = new Date().toISOString().slice(0, 10);
const MARK = 'catalog-only';

async function main() {
  if (!APPLY) log('СУХОЙ ПРОГОН: только считаю. Для записи добавь --apply');
  const map = await readJson(path.join(KOMPAS_DIR, 'partner-source-map.json')) ?? {};
  const { index } = await loadSourceIndex();
  const files = (await fs.readdir(WORK_DIR)).filter((f) => f.endsWith('.json'));

  const backup = {};        // slug -> [programSlug, ...] ВСЕ помеченные (для отката)
  let unisTouched = 0, marked = 0, alreadyMarked = 0, unisCompared = 0;
  const top = [];

  for (const f of files) {
    const slug = f.replace(/\.json$/, '');
    const card = await readJson(path.join(WORK_DIR, f));
    if (!card) continue;

    const { ps, ready } = resolveAssignment(card, slug, map);
    if (ps.type === 'none') continue;
    const entries = (index.get(slug) ?? []).filter((e) => ready.includes(e.src));
    if (!entries.length) continue;   // сверить не с чем — не помечаем
    unisCompared++;

    const { catalogOnly } = diffUniversity(card, entries);
    if (!catalogOnly.length) continue;

    const coSlugs = new Set(catalogOnly.map((p) => p.slug).filter(Boolean));
    const bySlug = new Map((card.programs ?? []).map((p) => [p.slug, p]));
    const nowMarked = [];
    const allMarked = [];   // все catalog-only этого вуза, включая помеченные ранее
    for (const pslug of coSlugs) {
      const prog = bySlug.get(pslug);
      if (!prog) continue;
      allMarked.push(pslug);
      if (prog.kompasStatus === MARK) { alreadyMarked++; continue; }
      if (APPLY) { prog.kompasStatus = MARK; prog.kompasCheckedAt = TODAY; }
      nowMarked.push(pslug);
    }
    // Бэкап отражает ВЕСЬ текущий набор catalog-only вуза (для отката),
    // а не только дельту прогона — иначе идемпотентный повтор затрёт откат в пустой.
    if (allMarked.length) backup[slug] = allMarked;
    if (nowMarked.length) {
      marked += nowMarked.length;
      unisTouched++;
      top.push({ slug, name: card.name, catalogOnly: catalogOnly.length, marked: nowMarked.length });
      if (APPLY) await fs.writeFile(path.join(WORK_DIR, f), JSON.stringify(card, null, 2) + '\n', 'utf8');
    }
  }

  top.sort((a, b) => b.marked - a.marked);

  const totalMarked = Object.values(backup).reduce((a, v) => a + v.length, 0);
  if (APPLY) {
    await fs.writeFile(path.join(KOMPAS_DIR, 'catalog-only-marks.json'),
      JSON.stringify({
        generatedAt: new Date().toISOString(),
        note: 'P1: программы с kompasStatus=catalog-only. Снятие метки — пройти по slug и удалить поле kompasStatus/kompasCheckedAt.',
        mark: MARK,
        summary: { unis: Object.keys(backup).length, programs: totalMarked },
        marks: backup,
      }, null, 2) + '\n', 'utf8');
  }

  console.table(top.slice(0, 20));
  console.log(`СВЕРЕНО вузов ${unisCompared}; помечено ${marked} программ у ${unisTouched} вузов; уже было помечено ${alreadyMarked}`);
  console.log(APPLY ? 'ПРИМЕНЕНО к catalog-work + бэкап catalog-only-marks.json' : 'СУХОЙ ПРОГОН — для записи добавь --apply');
}

main().catch((e) => { console.error(e); process.exit(1); });
