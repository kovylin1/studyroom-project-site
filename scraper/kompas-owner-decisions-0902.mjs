#!/usr/bin/env node
// kompas-owner-decisions-0902.mjs — задача C: две неоднозначные разметки закрыты
// решениями владельца 02.09.2026.
//
// 1. SRH. В партнёрском документе стоит просто «SRH, Germany», а в каталоге группа
//    из четырёх карточек. Прошлая сессия поставила партнёром только Heidelberg
//    и оставила пометку «нужно решение владельца». Решение: партнёр — ВСЯ ГРУППА,
//    включая нидерландский Haarlem.
//
// 2. METU. Прошлая сессия привязала «METU, Hungary» к milton-friedman-university,
//    хотя METU в Будапеште обычно означает Budapest Metropolitan University.
//    Решение владельца: РАЗДЕЛИТЬ — это два разных вуза. Партнёрство переезжает
//    на metropolitan-budapest (Budapest Metropolitan University, 65 программ),
//    с Milton Friedman метка снимается: улик партнёрства у него нет.
//
// Правится только поле partnerSource. Программы, цены и стипендии не трогаются.
// Пишет и в живой каталог, и в рабочую копию — иначе следующее применение копии
// затрёт решение (правило 3 плана).
//
// Запуск: node kompas-owner-decisions-0902.mjs [--apply]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = [
  path.join(ROOT, 'site/src/content/universities'),
  path.join(ROOT, 'sources/kompas/catalog-work'),
];
const APPLY = process.argv.includes('--apply');
const DECIDED = '2026-09-02';

const SRH_NOTE = `Решение владельца ${DECIDED}: партнёр — вся группа SRH, включая Haarlem. ` +
  'В документе стоит «SRH, Germany», в каталоге четыре карточки; раньше метка была только у Heidelberg.';
const METU_NOTE_NEW = `Решение владельца ${DECIDED}: «METU, Hungary» из партнёрского документа — это ` +
  'Budapest Metropolitan University. Раньше запись была ошибочно привязана к milton-friedman-university.';
const METU_NOTE_OFF = `Решение владельца ${DECIDED}: Milton Friedman University и METU — разные вузы. ` +
  'Привязка «METU, Hungary» снята и переехала на metropolitan-budapest; улик партнёрства у этой карточки нет.';

// slug → как править partnerSource
const PLAN = {
  'srh-university': { type: 'direct', directRaw: 'SRH, Germany', note: SRH_NOTE },
  'srh-hochschule-berlin': { type: 'direct', directRaw: 'SRH, Germany', note: SRH_NOTE },
  'srh-germany': { type: 'direct', directRaw: 'SRH, Germany', note: SRH_NOTE },
  'srh-haarlem-university-of-applied-sciences': { type: 'direct', directRaw: 'SRH, Germany', note: SRH_NOTE },
  'metropolitan-budapest': { type: 'direct', directRaw: 'METU, Hungary', note: METU_NOTE_NEW },
  'milton-friedman-university': { type: 'none', directRaw: null, note: METU_NOTE_OFF },
};

let touched = 0, missing = 0;
for (const dir of DIRS) {
  if (!fs.existsSync(dir)) { console.log(`нет каталога: ${dir}`); continue; }
  for (const [slug, want] of Object.entries(PLAN)) {
    const file = path.join(dir, `${slug}.json`);
    if (!fs.existsSync(file)) { console.log(`  ПРОПУСК ${slug} — нет карточки в ${path.basename(dir)}`); missing++; continue; }
    const card = JSON.parse(fs.readFileSync(file, 'utf8'));
    const was = card.partnerSource || {};
    const next = {
      type: want.type,
      // via хранит, откуда пришли данные, — решение о партнёрстве его не отменяет
      via: Array.isArray(was.via) ? was.via : [],
      note: want.note,
      decidedAt: DECIDED,
    };
    if (want.directRaw) next.directRaw = want.directRaw;
    card.partnerSource = next;
    if (APPLY) fs.writeFileSync(file, JSON.stringify(card, null, 2) + '\n');
    console.log(`  ${path.basename(dir)}/${slug}: ${was.type || '—'} → ${want.type}`);
    touched++;
  }
}

console.log(`${APPLY ? 'ЗАПИСАНО' : 'СУХОЙ ПРОГОН'}: карточек ${touched}, пропущено ${missing}`);
