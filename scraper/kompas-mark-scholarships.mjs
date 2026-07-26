#!/usr/bin/env node
// kompas-mark-scholarships.mjs — P4.9: пометить стипендии разрядом происхождения.
//
// Замер (kompas-scholarship-audit.mjs) показал: из 1765 записей каталога 1234 непроверяемы
// — ни ссылки, ни источника, ни повтора. Решение владельца 2026-07-26: НЕ удалять, а
// пометить. Скрипт ставит разряд КАЖДОЙ записи (включая проверяемые), чтобы «без метки»
// значило «скрипт сюда не доходил», а не «запись хорошая».
//
// Что проставляется на записи стипендии:
//   scholarship.kompasStatus    = linked | cloned | generic-external | untraceable
//   scholarship.kompasCheckedAt = <дата>
//
// Классификатор общий с замером — lib/kompas-scholarship-kind.mjs. Разряд «клон»
// считается по ВСЕМУ каталогу: по одной карточке штамп сид-таблицы неотличим от своей
// стипендии вуза.
//
// Ничего не удаляется (правило 4). Идемпотентно: повтор не двоит, но обновит разряд,
// если каталог изменился. Откат — sources/kompas/scholarship-marks.json: там снимок
// ВСЕХ записей с прежними метками.
//
// Работает на КОПИИ sources/kompas/catalog-work. Живой каталог не тронут.
//
// Запуск: node kompas-mark-scholarships.mjs [--apply]

import fs from 'node:fs/promises';
import path from 'node:path';
import { KOMPAS_DIR, args, logger } from './lib/kompas-collect.mjs';
import { KINDS, buildCloneCounts, classifyScholarship } from './lib/kompas-scholarship-kind.mjs';

const log = logger('mark-schol');
const APPLY = args.has('apply');
const WORK = path.join(KOMPAS_DIR, 'catalog-work');
const OUT_MARKS = path.join(KOMPAS_DIR, 'scholarship-marks.json');
const TODAY = new Date().toISOString().slice(0, 10);

const readJson = async (f) => JSON.parse(await fs.readFile(f, 'utf8'));

async function main() {
  if (!APPLY) log('СУХОЙ ПРОГОН: только считаю. Для записи добавь --apply');

  const files = (await fs.readdir(WORK)).filter((f) => f.endsWith('.json'));

  // Проход 1: все записи каталога — иначе не посчитать повторы (разряд «клон»).
  const cards = [];
  for (const f of files) {
    const slug = f.replace(/\.json$/, '');
    const card = await readJson(path.join(WORK, f));
    cards.push({ slug, file: f, card });
  }
  const cloneCount = buildCloneCounts(cards.flatMap((c) => c.card.scholarships ?? []));

  // Проход 2: метка. Бэкап отражает ВЕСЬ набор записей вуза с прежним значением метки,
  // а не дельту прогона: иначе повторный прогон затрёт откат в пустой (урок P1).
  const byKind = Object.fromEntries(KINDS.map((k) => [k, 0]));
  const backup = {};
  let marked = 0; let unchanged = 0; let changed = 0; let cardsTouched = 0;
  const top = [];

  for (const { slug, file, card } of cards) {
    const list = card.scholarships ?? [];
    if (!list.length) continue;

    const snapshot = [];
    let dirty = false; let bad = 0;
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      const kind = classifyScholarship(s, cloneCount);
      byKind[kind]++;
      if (kind !== 'linked') bad++;
      snapshot.push({ i, name: s.name ?? null, was: s.kompasStatus ?? null, kind });

      if (s.kompasStatus === kind) { unchanged++; continue; }
      if (s.kompasStatus == null) marked++; else changed++;
      if (APPLY) { s.kompasStatus = kind; s.kompasCheckedAt = TODAY; }
      dirty = true;
    }

    backup[slug] = snapshot;
    if (dirty) {
      cardsTouched++;
      top.push({ slug, name: card.name, scholarships: list.length, untraceable: bad });
      if (APPLY) await fs.writeFile(path.join(WORK, file), JSON.stringify(card, null, 2) + '\n', 'utf8');
    }
  }

  top.sort((a, b) => b.untraceable - a.untraceable);

  if (APPLY) {
    await fs.writeFile(OUT_MARKS, JSON.stringify({
      generatedAt: new Date().toISOString(),
      note: 'P4.9: разряд происхождения на стипендиях (kompasStatus/kompasCheckedAt). '
        + 'Откат: пройти по slug, для каждой записи вернуть was (null = удалить поля kompasStatus и kompasCheckedAt). '
        + 'Ничего не удалялось — решение владельца 2026-07-26 «не удалять, а пометить».',
      kinds: KINDS,
      summary: { cards: Object.keys(backup).length, records: Object.values(backup).reduce((a, v) => a + v.length, 0), byKind },
      marks: backup,
    }, null, 2) + '\n', 'utf8');
  }

  console.table(top.slice(0, 15));
  console.log(`записей ${Object.values(byKind).reduce((a, b) => a + b, 0)}: ${KINDS.map((k) => `${k} ${byKind[k]}`).join(', ')}`);
  console.log(`помечено впервые ${marked}, разряд обновлён ${changed}, без изменений ${unchanged}; карточек затронуто ${cardsTouched}`);
  console.log(APPLY ? `ПРИМЕНЕНО к catalog-work + бэкап ${path.basename(OUT_MARKS)}` : 'СУХОЙ ПРОГОН — для записи добавь --apply');
}

main().catch((e) => { console.error(e); process.exit(1); });
