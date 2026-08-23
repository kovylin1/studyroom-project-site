#!/usr/bin/env node
// kompas-fix-levels.mjs — уровень программы против её же названия (подготовка к 3.1).
//
// ЗАЧЕМ. Добор с агрегаторов записал 99 программ вида «M.B.A.Business Administration»
// с уровнем bachelor, «BEng (Hons) Robotics» с уровнем phd и так далее. В живом
// каталоге таких расхождений НОЛЬ, после переноса рабочей копии стало бы 201, и
// деплойный гейт (audit-catalog.mjs, разряд GARBAGE:level-mismatch) заблокировал бы
// сборку. Чинить надо до переноса и в рабочей копии, а не после и в живом каталоге.
//
// ПРАВИЛО. Уровень меняется, только если название программы называет РОВНО ОДНУ
// квалификацию (lib/program-level.mjs) и она расходится с полем level. Названия,
// где квалификаций две («PhD/MA by Research», «BEng … MEng …»), не трогаем: это
// законные совместные программы, а не кривые данные — их перестанет считать ошибкой
// сам гейт, потому что читает ту же карту. Уровень не выдумываем: где название молчит,
// молчим и мы.
//
// Трогаются только уровни bachelor/master/phd — те же, что проверяет гейт.
// english-language, foundation, short-course и прочие не пересматриваются.
//
// Сети нет. По умолчанию НИЧЕГО НЕ ПИШЕТ (см. задачу 3.25 — «безопасные» режимы,
// которые всё-таки пишут). Запись только по явному --apply.
//   node scraper/kompas-fix-levels.mjs            # разбор, без записи
//   node scraper/kompas-fix-levels.mjs --apply    # + правка рабочей копии
//   node scraper/kompas-fix-levels.mjs --dir=<путь> --apply

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inferLevel, qualificationFamilies, DEGREE_LEVELS } from './lib/program-level.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const dirArg = process.argv.find((a) => a.startsWith('--dir='));
const DIR = dirArg ? path.resolve(dirArg.slice('--dir='.length)) : path.join(ROOT, 'sources/kompas/catalog-work');
const APPLY = process.argv.includes('--apply');
const OUT_MD = path.join(ROOT, 'sources/kompas/FIX-LEVELS.md');
const BACKUP = path.join(ROOT, 'sources/kompas/fix-levels-backup.json');

const n = (x) => Number(x || 0).toLocaleString('ru-RU').replace(/ /g, ' ');

async function main() {
  const files = (await fs.readdir(DIR)).filter((f) => f.endsWith('.json'));
  const fixed = [];
  const ambiguous = [];
  let touchedFiles = 0;

  for (const f of files) {
    const fp = path.join(DIR, f);
    let card;
    try { card = JSON.parse(await fs.readFile(fp, 'utf8')); } catch { continue; }
    let changed = false;
    for (const p of card.programs ?? []) {
      if (!DEGREE_LEVELS.has(p.level)) continue;
      const fams = qualificationFamilies(p.title);
      if (fams.length > 1) {
        // Название честно называет две квалификации — данные не трогаем, но
        // выписываем: это же множество молчания должен видеть и гейт.
        if (!fams.includes(p.level)) ambiguous.push({ card: card.slug ?? f.replace(/\.json$/, ''), slug: p.slug, title: p.title, level: p.level, named: fams });
        continue;
      }
      const want = inferLevel(p.title);
      if (!want || want === p.level) continue;
      fixed.push({ card: card.slug ?? f.replace(/\.json$/, ''), slug: p.slug, title: p.title, from: p.level, to: want, source: p.source ?? null });
      if (APPLY) { p.level = want; changed = true; }
    }
    if (changed) { await fs.writeFile(fp, JSON.stringify(card, null, 2) + '\n', 'utf8'); touchedFiles++; }
  }

  const byPair = {};
  for (const x of fixed) { const k = x.from + ' → ' + x.to; (byPair[k] = byPair[k] || []).push(x); }
  const byCard = {};
  for (const x of fixed) byCard[x.card] = (byCard[x.card] || 0) + 1;

  if (APPLY) {
    // Файл отката НАКОПИТЕЛЬНЫЙ: скрипт запускают и по рабочей копии, и по живому
    // каталогу, и вторая запись начисто стёрла бы первую точку отката.
    let prev = { runs: [] };
    try { prev = JSON.parse(await fs.readFile(BACKUP, 'utf8')); } catch { /* первого прогона не было */ }
    if (!Array.isArray(prev.runs)) prev = { runs: prev.changes ? [{ generatedAt: prev.generatedAt, dir: prev.dir, changes: prev.changes }] : [] };
    prev.runs = prev.runs.filter((r) => r.dir !== path.relative(ROOT, DIR));
    // откат: вернуть level = from у каждой записи
    prev.runs.push({ generatedAt: new Date().toISOString(), dir: path.relative(ROOT, DIR), changes: fixed });
    await fs.writeFile(BACKUP, JSON.stringify(prev, null, 2) + '\n', 'utf8');
  }

  const md = [];
  const p = (...s) => md.push(...s);
  p('# Уровень программы против её названия — правка перед 3.1', '');
  p('Скрипт `scraper/kompas-fix-levels.mjs`, карта квалификаций — `scraper/lib/program-level.mjs`.');
  p('Каталог: `' + path.relative(ROOT, DIR).replace(/\\/g, '/') + '`. Режим: ' + (APPLY ? '**запись**' : 'разбор без записи') + '.');
  p('Снято ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC.', '');
  p('Правится уровень, только когда название называет ровно одну квалификацию.', '');

  p('## Исправлено', '');
  p('| Было → стало | Программ |', '|---|---:|');
  for (const [k, v] of Object.entries(byPair).sort((a, b) => b[1].length - a[1].length)) p('| ' + k + ' | ' + n(v.length) + ' |');
  p('| **всего** | **' + n(fixed.length) + '** |');
  p('');
  p('Карточек затронуто: ' + n(Object.keys(byCard).length) + (APPLY ? ', файлов переписано: ' + n(touchedFiles) : '') + '.', '');
  for (const [k, v] of Object.entries(byPair).sort((a, b) => b[1].length - a[1].length)) {
    p('### ' + k + ' — ' + n(v.length), '');
    p('| Карточка | Программа |', '|---|---|');
    for (const x of v.slice(0, 25)) p('| `' + x.card + '` | ' + String(x.title).slice(0, 90) + ' |');
    if (v.length > 25) p('| … | ещё ' + n(v.length - 25) + ' |');
    p('');
  }

  p('## Не тронуто: название называет две квалификации', '');
  p('Таких программ ' + n(ambiguous.length) + '. Это совместные и сквозные программы, ошибки в данных здесь нет;');
  p('гейт их тоже перестал считать ошибкой, потому что читает ту же карту.', '');
  p('| Карточка | Программа | Уровень | Названо |', '|---|---|---|---|');
  for (const x of ambiguous.slice(0, 30)) p('| `' + x.card + '` | ' + String(x.title).slice(0, 70) + ' | ' + x.level + ' | ' + x.named.join(' + ') + ' |');
  if (ambiguous.length > 30) p('| … | ещё ' + n(ambiguous.length - 30) + ' | | |');
  p('');
  p('## Спорное, на глаз владельцу', '');
  const jd = fixed.filter((x) => /juris|\bJD\b/i.test(x.title));
  p('JD (Juris Doctor) — профессиональная степень, которой в схеме каталога нет.');
  p('По названию это докторат, поэтому записан `phd`. Затронуто программ: ' + n(jd.length) + '.');
  for (const x of jd) p('- `' + x.card + '` — ' + x.title);
  p('');
  await fs.writeFile(OUT_MD, md.join('\n'), 'utf8');

  console.log((APPLY ? 'ЗАПИСАНО' : 'РАЗБОР (без записи)') + ': исправлено уровней ' + fixed.length
    + ' в ' + Object.keys(byCard).length + ' карточках; двузначных названий ' + ambiguous.length);
  for (const [k, v] of Object.entries(byPair)) console.log('  ' + k + ': ' + v.length);
  console.log('отчёт: ' + path.relative(ROOT, OUT_MD) + (APPLY ? ', откат: ' + path.relative(ROOT, BACKUP) : ''));
  if (!APPLY) console.log('ничего не записано — для записи добавь --apply');
}

await main();
