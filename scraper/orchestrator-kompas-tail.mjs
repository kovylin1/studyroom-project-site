#!/usr/bin/env node
// orchestrator-kompas-tail.mjs — хвост КОМПАСа после сбора QS, одним прогоном.
//
// Закрывает пять разрядов незакрытых кейсов сверки (см. BACKLOG, 2026-08-10):
//   123 kompas_no_extract, 274 kompas_programs_missing, 113 kompas_programs_extra,
//   57 kompas_campus_missing, 6 kompas_fee_currency.
//
// ПОРЯДОК ВАЖЕН:
//   1. рабочая копия обновляется с живого каталога — она отстала (255 размеченных
//      карточек против 333), и P1 по устаревшей копии пометил бы не то;
//   2. привязка выгрузок QS — до замера, иначе замер снова отдаст «выгрузки нет»;
//   3. P1/P2 работают через то же ядро сверки, отдельный замер им не нужен;
//   4. замер снимается ОДИН раз в конце, решения переносятся в него из прошлого
//      файла (id кейса содержит количество и после добора меняется).
//
// Сети нет. Живой каталог не трогается ни на одном шаге: всё пишется в
// sources/kompas/catalog-work и в файлы кейсов.
//
// Запуск: node orchestrator-kompas-tail.mjs [--dry] — --dry прогоняет всё без --apply.

import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KOMPAS = path.join(HERE, '..', 'sources', 'kompas');
const LOG = path.join(KOMPAS, 'tail-run.log');
const DRY = process.argv.includes('--dry');
const APPLY = DRY ? [] : ['--apply'];

async function log(msg) {
  const line = `[tail ${new Date().toISOString().slice(11, 19)}] ${msg}`;
  console.log(line);
  await fs.appendFile(LOG, line + '\n', 'utf8');
}

function run(script, argv = []) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [path.join(HERE, script), ...argv], { cwd: HERE });
    let out = ''; let err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (code) => resolve({ code, out, err }));
  });
}

/** Последние значимые строки вывода шага — в отчёт идут они, а не простыня. */
const tail = (s, n = 6) => s.split('\n').filter((l) => l.trim()).slice(-n).join('\n');

const steps = [
  ['тесты', 'node', ['--test', 'kompas-diff-triage.test.mjs', 'kompas-qs-relink.test.mjs', 'kompas-backfill-campuses.test.mjs']],
  // В сухом прогоне копия не переписывается: --write-copy пишет на диск всегда.
  ['1. рабочая копия с живого каталога', 'kompas-inventory.mjs', DRY ? [] : ['--write-copy']],
  ['2. проверка копии до правок', 'kompas-workcopy-check.mjs', [`--stamp=${path.join(KOMPAS, 'workcopy-check-before.json')}`]],
  ['3. привязка выгрузок QS', 'kompas-qs-relink.mjs', APPLY],
  ['4. P1: метка catalog-only', 'kompas-mark-catalog-only.mjs', APPLY],
  ['5. P2: добор программ', 'kompas-backfill-programs.mjs', APPLY],
  ['6. добор кампусов', 'kompas-backfill-campuses.mjs', APPLY],
  ['7. проверка копии после правок', 'kompas-workcopy-check.mjs', [`--stamp=${path.join(KOMPAS, 'workcopy-check-after.json')}`]],
  ['8. замер сверки', 'kompas-diff.mjs', []],
  ['9. перенос решений', 'kompas-diff-carry.mjs', ['--prev=' + path.join(KOMPAS, 'diff-review.prev.json'), ...APPLY]],
  ['10. разбор кейсов', 'kompas-diff-triage.mjs', APPLY],
  ['11. валюта: 6 вузов вне P0.4', 'kompas-currency-review.mjs', APPLY],
  ['12. сборка панели', 'kompas-panel.mjs', []],
];

async function main() {
  await log(`СТАРТ${DRY ? ' (сухой прогон)' : ''}`);

  // Снимок прошлой сверки: замер пересоберёт diff-review.json с нуля, решения
  // переносятся из этого файла. Без снимка 464 решения ушли бы в ноль.
  if (!DRY) {
    await fs.copyFile(path.join(KOMPAS, 'diff-review.json'), path.join(KOMPAS, 'diff-review.prev.json'));
    await log('снимок прошлой сверки → diff-review.prev.json');
  }

  const results = [];
  for (const [name, script, argv] of steps) {
    const started = Date.now();
    const r = script === 'node' ? await runNode(argv) : await run(script, argv);
    const secs = Math.round((Date.now() - started) / 1000);
    results.push({ name, code: r.code, secs, tail: tail(r.out || r.err) });
    await log(`${name}: код ${r.code}, ${secs}с`);
    for (const l of tail(r.out || r.err, 4).split('\n')) if (l.trim()) await log(`    ${l.trim()}`);
    // Проверка копии не гейт: живой каталог мог прийти с нарушениями и до нас.
    if (r.code !== 0 && !name.includes('проверка')) {
      await log(`ОСТАНОВ: шаг «${name}» упал.\n${r.err.slice(-2000)}`);
      await fs.writeFile(path.join(KOMPAS, 'tail-run-report.json'), JSON.stringify({ ok: false, failedAt: name, results }, null, 2) + '\n', 'utf8');
      process.exitCode = 1;
      return;
    }
  }

  // Итог: что осталось незакрытым в сверке.
  const review = JSON.parse(await fs.readFile(path.join(KOMPAS, 'diff-review.json'), 'utf8'));
  const openBy = {}; const closedBy = {};
  for (const it of review.items) {
    const b = it.decision ? closedBy : openBy;
    b[it.issue] = (b[it.issue] ?? 0) + 1;
  }
  // Гейт схемы — не «ноль нарушений», а «ни одного нового»: часть карточек
  // приезжает битой из живого каталога.
  const stamp = async (f) => { try { return JSON.parse(await fs.readFile(path.join(KOMPAS, f), 'utf8')); } catch { return null; } };
  const before = await stamp('workcopy-check-before.json');
  const after = await stamp('workcopy-check-after.json');
  const schema = {
    before: before?.violations ?? null,
    after: after?.violations ?? null,
    новых: before && after ? after.violations - before.violations : null,
  };
  await log(`схема рабочей копии: было ${schema.before}, стало ${schema.after}, новых ${schema.новых}`);

  await fs.writeFile(path.join(KOMPAS, 'tail-run-report.json'), JSON.stringify({
    ok: true, dry: DRY, finishedAt: new Date().toISOString(),
    cases: { total: review.items.length, closed: closedBy, open: openBy },
    schema,
    results,
  }, null, 2) + '\n', 'utf8');

  await log(`ГОТОВО. кейсов ${review.items.length}; закрыто ${JSON.stringify(closedBy)}; открыто ${JSON.stringify(openBy)}`);
}

function runNode(argv) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, argv, { cwd: HERE });
    let out = ''; let err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (code) => resolve({ code, out, err }));
  });
}

main().catch(async (e) => { await log(`СБОЙ: ${e.stack}`); process.exitCode = 1; });
