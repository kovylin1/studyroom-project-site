#!/usr/bin/env node
// kompas-backfill-fees.mjs — P2 (часть а): добор цен в каталог.
//
// Замер: у источников есть цена по 26 026 программам, которые в каталоге совпали
// по названию, но цены не имеют. Это чистый плюс — заполняем пустое, ничего не
// перетираем. НО безопасно только когда:
//   • валюта источника == валюте карточки (иначе положим чужую валюту под метку
//     карточки — ровно баг «CZK как USD», урок 5). Разную валюту → в кейс.
//   • основа цены источника не 'level' (уровневую цену растягивать на программу
//     нельзя — это фабрикация Navitas). → в кейс.
//   • аудитория не 'home' (домашняя цена британца не годится казахстанцу, урок 3.5).
//
// Ставит число в card.tuition.byProgram[slug]. Идемпотентно: заполненное не трогаем.
// Бэкап накопительный (union со старым) — повторный прогон не затирает откат.
// Работает на КОПИИ sources/kompas/catalog-work.
//
// Запуск: node kompas-backfill-fees.mjs [--apply]

import fs from 'node:fs/promises';
import path from 'node:path';
import { KOMPAS_DIR, args, logger } from './lib/kompas-collect.mjs';
import { WORK_DIR, readJson, loadSourceIndex, resolveAssignment, diffUniversity } from './lib/kompas-diff-core.mjs';

const log = logger('backfill-fees');
const APPLY = args.has('apply');
const TODAY = new Date().toISOString().slice(0, 10);
const BACKUP_FILE = path.join(KOMPAS_DIR, 'fee-backfill-backup.json');

async function main() {
  if (!APPLY) log('СУХОЙ ПРОГОН: только считаю. Для записи добавь --apply');
  const map = await readJson(path.join(KOMPAS_DIR, 'partner-source-map.json')) ?? {};
  const { index } = await loadSourceIndex();
  const files = (await fs.readdir(WORK_DIR)).filter((f) => f.endsWith('.json'));

  const added = {};   // slug -> { programSlug: amount } — добавленное ЭТИМ прогоном
  const skip = { diffCur: 0, levelBasis: 0, homeAud: 0, noCardCur: 0, already: 0 };
  let filled = 0, unisTouched = 0;
  const top = [];

  for (const f of files) {
    const slug = f.replace(/\.json$/, '');
    const card = await readJson(path.join(WORK_DIR, f));
    if (!card) continue;
    const { ps, ready } = resolveAssignment(card, slug, map);
    if (ps.type === 'none') continue;
    const entries = (index.get(slug) ?? []).filter((e) => ready.includes(e.src));
    if (!entries.length) continue;

    const cardCur = card.tuition?.currency ?? null;
    const d = diffUniversity(card, entries);
    if (!d.feeMissingInCatalog.length) continue;

    if (!card.tuition) card.tuition = { currency: cardCur, byProgram: {} };
    if (!card.tuition.byProgram) card.tuition.byProgram = {};
    const bp = card.tuition.byProgram;
    const validSlugs = new Set((card.programs ?? []).map((p) => p.slug));
    let n = 0;

    for (const m of d.feeMissingInCatalog) {
      const fee = m.source;
      if (!cardCur) { skip.noCardCur++; continue; }
      if (fee.currency !== cardCur) { skip.diffCur++; continue; }
      if (fee.basis === 'level') { skip.levelBasis++; continue; }
      if (fee.audience === 'home') { skip.homeAud++; continue; }
      if (!validSlugs.has(m.slug)) { skip.already++; continue; }  // слаг не из карточки — пропуск
      if (bp[m.slug] !== undefined) { skip.already++; continue; } // уже есть цена
      if (APPLY) bp[m.slug] = fee.amount;
      (added[slug] ??= {})[m.slug] = fee.amount;
      n++; filled++;
    }
    if (n) {
      unisTouched++;
      top.push({ slug, name: card.name, filled: n });
      if (APPLY) await fs.writeFile(path.join(WORK_DIR, f), JSON.stringify(card, null, 2) + '\n', 'utf8');
    }
  }

  top.sort((a, b) => b.filled - a.filled);

  if (APPLY) {
    // Накопительный бэкап: объединяем со старым, чтобы повтор не стёр историю отката.
    const prev = (await readJson(BACKUP_FILE))?.added ?? {};
    for (const [s, obj] of Object.entries(added)) prev[s] = { ...(prev[s] ?? {}), ...obj };
    const total = Object.values(prev).reduce((a, o) => a + Object.keys(o).length, 0);
    await fs.writeFile(BACKUP_FILE, JSON.stringify({
      generatedAt: new Date().toISOString(),
      note: 'P2a: цены, вписанные в tuition.byProgram из источника. Откат: удалить эти ключи из byProgram.',
      summary: { unis: Object.keys(prev).length, prices: total },
      added: prev,
    }, null, 2) + '\n', 'utf8');
  }

  console.table(top.slice(0, 15));
  console.log(`ДОБРАНО цен ${filled} у ${unisTouched} вузов`);
  console.log(`ПРОПУЩЕНО: разная валюта ${skip.diffCur}, level-цена ${skip.levelBasis}, home-аудитория ${skip.homeAud}, уже есть/нет слага ${skip.already}, нет валюты карточки ${skip.noCardCur}`);
  console.log(APPLY ? 'ПРИМЕНЕНО к catalog-work + бэкап fee-backfill-backup.json' : 'СУХОЙ ПРОГОН — для записи добавь --apply');
}

main().catch((e) => { console.error(e); process.exit(1); });
