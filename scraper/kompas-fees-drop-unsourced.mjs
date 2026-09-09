#!/usr/bin/env node
// kompas-fees-drop-unsourced.mjs — снять цены, которые в рабочую копию записал
// прошлый прогон, а нынешний уже не подтверждает (КОМПАС 3.28).
//
// ЗАЧЕМ. Правило «цена подготовительной ступени — не цена степени» убрало 110 строк
// источников. У части программ такая строка была ЕДИНСТВЕННЫМ источником цены, и в
// рабочей копии у них до сих пор стоит сумма, которую больше никто не подтверждает.
// Оставить её — значит показывать на витрине цену подготовки под видом цены степени.
//
// ЧТО СНИМАЕТСЯ. Только цена, которая (1) есть в рабочей копии, (2) записана прошлым
// прогоном движка цен, (3) отсутствует в нынешнем и (4) отсутствует в живом каталоге —
// то есть до КОМПАСа её не было вовсе. Цена, которая была в каталоге и до нас,
// не трогается: спорить с ней — отдельное решение владельца, а не побочный эффект.
// Вместе с ценой снимаются её попрограммные признаки (валюта, основа, варианты).
//
// Сети нет. По умолчанию НИЧЕГО НЕ ПИШЕТ, запись только по --apply.
//   node scraper/kompas-fees-drop-unsourced.mjs
//   node scraper/kompas-fees-drop-unsourced.mjs --apply

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const WORK = path.join(ROOT, 'sources/kompas/catalog-work');
const LIVE = path.join(ROOT, 'site/src/content/universities');
const NOW = path.join(ROOT, 'sources/kompas/fees-apply-report.json');
const PREV = path.join(ROOT, 'sources/kompas/fees-apply-report.before-3.28.json');
const BACKUP = path.join(ROOT, 'sources/kompas/fees-drop-unsourced-backup.json');
const OUT_MD = path.join(ROOT, 'sources/kompas/FEES-DROP-UNSOURCED.md');
const APPLY = process.argv.includes('--apply');

const readJson = async (f) => JSON.parse(await fs.readFile(f, 'utf8'));
const key = (c) => c.catalogSlug + '|' + c.program;

async function main() {
  const now = await readJson(NOW);
  const prev = await readJson(PREV);
  const nowSet = new Set(now.changes.map(key));
  const lost = prev.changes.filter((c) => !nowSet.has(key(c)));

  const dropped = []; const kept = [];
  const byCard = new Map();
  for (const c of lost) (byCard.get(c.catalogSlug) ?? byCard.set(c.catalogSlug, []).get(c.catalogSlug)).push(c);

  for (const [slug, list] of byCard) {
    const wfp = path.join(WORK, slug + '.json');
    let work; try { work = await readJson(wfp); } catch { continue; }
    let live = null; try { live = await readJson(path.join(LIVE, slug + '.json')); } catch { /* новая карточка */ }
    const byslug = new Map((work.programs ?? []).map((p) => [p.slug, p]));
    let changed = false;

    for (const c of list) {
      const cur = work.tuition?.byProgram?.[c.program];
      if (cur == null) continue;
      const liveFee = live?.tuition?.byProgram?.[c.program];
      if (liveFee != null) { kept.push({ card: slug, program: c.program, fee: cur, liveFee }); continue; }
      const p = byslug.get(c.program);
      dropped.push({ card: slug, program: c.program, fee: cur,
        tuitionCurrency: p?.tuitionCurrency ?? null, tuitionBasis: p?.tuitionBasis ?? null,
        tuitionVariants: p?.tuitionVariants ?? null });
      if (APPLY) {
        delete work.tuition.byProgram[c.program];
        if (p) { delete p.tuitionCurrency; delete p.tuitionBasis; delete p.tuitionVariants; }
        changed = true;
      }
    }
    if (APPLY && changed) await fs.writeFile(wfp, JSON.stringify(work, null, 2) + '\n', 'utf8');
  }

  if (APPLY) {
    await fs.writeFile(BACKUP, JSON.stringify({
      generatedAt: new Date().toISOString(),
      // откат: вернуть fee в tuition.byProgram и признаки программе
      dropped,
    }, null, 2) + '\n', 'utf8');
  }

  const md = ['# Цены без источника после правила 3.28', '',
    'Скрипт `scraper/kompas-fees-drop-unsourced.mjs`. Режим: ' + (APPLY ? '**запись**' : 'разбор без записи') + '.',
    'Снято ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC.', '',
    '| Что | Программ |', '|---|---:|',
    '| Цена снята (в живом каталоге её не было) | ' + dropped.length + ' |',
    '| Цена оставлена (она есть и в живом каталоге) | ' + kept.length + ' |', ''];
  if (dropped.length) {
    md.push('## Снято', '', '| Карточка | Программа | Была цена |', '|---|---|---:|');
    for (const d of dropped) md.push('| `' + d.card + '` | `' + d.program + '` | ' + d.fee + ' |');
    md.push('');
  }
  if (kept.length) {
    md.push('## Оставлено — вопрос владельцу', '',
      'Эта сумма стоит и в живом каталоге, то есть попала туда до нынешней сверки, но',
      'источник её больше не подтверждает: по всем признакам это цена подготовительной',
      'ступени. Снимать её или оставить — решение владельца.', '',
      '| Карточка | Программа | В копии | В каталоге |', '|---|---|---:|---:|');
    for (const k of kept) md.push('| `' + k.card + '` | `' + k.program + '` | ' + k.fee + ' | ' + k.liveFee + ' |');
    md.push('');
  }
  await fs.writeFile(OUT_MD, md.join('\n'), 'utf8');

  console.log((APPLY ? 'ЗАПИСАНО' : 'РАЗБОР (без записи)') + ': снято ' + dropped.length + ', оставлено ' + kept.length);
  console.log('отчёт: ' + path.relative(ROOT, OUT_MD) + (APPLY && dropped.length ? ', откат: ' + path.relative(ROOT, BACKUP) : ''));
  if (!APPLY) console.log('ничего не записано — для записи добавь --apply');
}

await main();
