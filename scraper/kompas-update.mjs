#!/usr/bin/env node
// kompas-update.mjs — обновление живого каталога ОДНИМ агрегатором.
//
// ЗАЧЕМ. До этого путь от агрегатора до каталога был разорван: коллекторы КОМПАСа
// складывают собранное в песочницу sources/kompas/extracts/, а в живой каталог
// оттуда никто не переносил — перенос делался руками раз в несколько недель.
// Старое поколение (Kaplan, CATS, GEDU, volk) писало в каталог напрямую через
// merge-programs. Здесь обе дороги сведены в одну команду на агрегатор:
//
//   node scraper/kompas-update.mjs --agg=edvoy --apply
//
// Расписание (scrape-staggered.yml) вызывает ровно её, по одному агрегатору в свой
// день месяца. Что обновляется: вузы, которые пришли ИЗ ЭТОГО агрегатора, — чужие
// карточки прогон не трогает.
//
// ПОРЯДОК И ПОЧЕМУ ИМЕННО ТАКОЙ
//   1. сбор — коллектор агрегатора. Упал или отдал ноль — дальше не идём: пустая
//      выдача, принятая за правду, стирает хорошие данные;
//   2. рабочая копия обновляется с ЖИВОГО каталога. Без этого шага применятель
//      вернул бы в каталог всё, что изменилось в нём с прошлого прогона;
//   3. цены и программы агрегатора применяются В РАБОЧУЮ КОПИЮ (--sources=<агрегатор>),
//      живой каталог ещё не тронут;
//   4. считается, сколько карточек изменилось. Больше порога — НЕ ПРИМЕНЯЕМ:
//      один агрегатор за месяц столько менять не должен, и если меняет, то
//      случилось что-то с источником, а не с вузами. Кейсы уходят в панель;
//   5. перенос в живой каталог — только изменившиеся карточки, каждая проходит
//      жёсткие правила деплойного гейта, нарушившая не переносится;
//   6. гейт каталога целиком. Красный — значит перенос что-то внёс, и в отчёте
//      лежит команда отката.
//
// Без --apply не пишется НИЧЕГО: прогон показывает, что бы уехало.
//
// Отчёт каждого прогона: site/public/api/update-runs.json (читает панель менеджера).
//
// Usage:
//   node scraper/kompas-update.mjs --agg=edvoy                 # сухой прогон
//   node scraper/kompas-update.mjs --agg=edvoy --apply         # с записью в каталог
//   node scraper/kompas-update.mjs --agg=qahe --skip-collect   # без сети, по готовым выгрузкам
//   node scraper/kompas-update.mjs --agg=edvoy --max-change=10 # порог в процентах (по умолчанию 5)
//   node scraper/kompas-update.mjs --list                      # какие агрегаторы известны

import fs from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const LIVE = path.join(ROOT, 'site', 'src', 'content', 'universities');
const WORK = path.join(ROOT, 'sources', 'kompas', 'catalog-work');
const RUNS = path.join(ROOT, 'site', 'public', 'api', 'update-runs.json');
const SCHEDULES = path.join(__dirname, 'sources', 'aggregator-schedules.json');

const arg = (k, d = null) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : d;
};
const has = (k) => process.argv.includes(`--${k}`);

const AGG = arg('agg');
const APPLY = has('apply');
const SKIP_COLLECT = has('skip-collect');
const MAX_CHANGE = Number(arg('max-change', '5'));
const log = (...a) => process.stderr.write(`[update] ${new Date().toISOString().slice(11, 19)} ${a.join(' ')}\n`);

// Реестр: чем собирать и под каким именем источник лежит в данных.
//   kind: 'kompas' — выгрузка идёт в песочницу, дальше применяется в рабочую копию;
//         'legacy' — коллектор пишет в scraper/sources/*-extracts, дальше merge-programs
//                    сам дозаполняет живой каталог (versions КОМПАСа для них ещё нет).
const AGGREGATORS = {
  'kaplan-pathways': { kind: 'kompas', source: 'kaplan', collect: ['kompas-collect-kaplan.mjs'] },
  'navitas-pathways': { kind: 'kompas', source: 'navitas', collect: ['kompas-collect-navitas.mjs', 'kompas-collect-navitas-programs.mjs'] },
  qahe: { kind: 'kompas', source: 'qahe', collect: ['kompas-collect-qahe.mjs'] },
  studygroup: { kind: 'kompas', source: 'studygroup', collect: ['kompas-collect-studygroup.mjs'] },
  cats: { kind: 'legacy', source: 'cats', collect: ['scrape-cats-all.mjs', 'kompas-collect-cats.mjs'] },
  'oxford-international': { kind: 'kompas', source: 'oxford-international', collect: ['kompas-collect-oxford-international.mjs'] },
  edvoy: { kind: 'kompas', source: 'edvoy', collect: ['kompas-collect-edvoy.mjs'] },
  iapro: { kind: 'kompas', source: 'iapro', collect: ['kompas-collect-iapro.mjs'] },
  'qs-topuniversities': { kind: 'kompas', source: 'qs', collect: ['kompas-collect-qs.mjs'] },
  gedu: { kind: 'kompas', source: 'gedu', collect: ['kompas-collect-gedu.mjs'] },
  volk: { kind: 'kompas', source: 'collab', collect: ['kompas-collect-collab.mjs'] },
};

if (has('list')) {
  const sch = JSON.parse(readFileSync(SCHEDULES, 'utf8'));
  for (const [name, cfg] of Object.entries(AGGREGATORS)) {
    const day = sch[name]?.dayOfMonth ?? '?';
    console.log(`${String(day).padStart(2)} число · ${name.padEnd(22)} ${cfg.kind.padEnd(7)} источник=${cfg.source}`);
  }
  process.exit(0);
}

if (!AGG || !AGGREGATORS[AGG]) {
  console.error(`нужен --agg=<имя>. Известные: ${Object.keys(AGGREGATORS).join(', ')}`);
  process.exit(2);
}
const CFG = AGGREGATORS[AGG];

function run(script, args = []) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [path.join(__dirname, script), ...args], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = ''; let err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; process.stderr.write(d); });
    p.on('close', (code) => resolve({ code, out, err }));
  });
}

const sameJson = (a, b) => {
  if (a === b) return true;
  try { return JSON.stringify(JSON.parse(a)) === JSON.stringify(JSON.parse(b)); } catch { return false; }
};

const readCards = async (dir) => {
  const out = new Map();
  for (const f of await fs.readdir(dir)) {
    if (!f.endsWith('.json')) continue;
    out.set(f.replace(/\.json$/, ''), await fs.readFile(path.join(dir, f), 'utf8'));
  }
  return out;
};

// Карточка «принадлежит» агрегатору, если он записан её источником партнёрства
// или если хоть одна её программа пришла от него. Чужие карточки прогон не трогает.
function belongsTo(rawCard, source) {
  let card;
  try { card = JSON.parse(rawCard); } catch { return false; }
  const via = card.partnerSource?.via;
  if (Array.isArray(via) && via.includes(source)) return true;
  if (card._kompas?.source === source) return true;
  return (card.programs || []).some((p) => typeof p.source === 'string' && p.source.split('+').includes(source));
}

const report = {
  aggregator: AGG, kind: CFG.kind, startedAt: new Date().toISOString(),
  applied: false, dryRun: !APPLY, steps: [], changedCards: 0, ownCards: 0, error: null, hold: null,
};
const step = (name, ok, detail) => { report.steps.push({ name, ok, detail }); log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`); };

async function finish(code) {
  report.finishedAt = new Date().toISOString();
  let all = {};
  try { all = JSON.parse(await fs.readFile(RUNS, 'utf8')); } catch { /* первого отчёта ещё нет */ }
  all[AGG] = report;
  await fs.mkdir(path.dirname(RUNS), { recursive: true });
  await fs.writeFile(RUNS, JSON.stringify(all, null, 2) + '\n', 'utf8');
  log(`отчёт: ${path.relative(ROOT, RUNS)}`);
  process.exit(code);
}

// ---------------------------------------------------------------- 1. сбор ----
if (!SKIP_COLLECT) {
  for (const script of CFG.collect) {
    const r = await run(script);
    if (r.code !== 0) {
      report.error = `коллектор ${script} завершился с кодом ${r.code}`;
      step(`сбор ${script}`, false, report.error);
      await finish(1);
    }
    step(`сбор ${script}`, true);
  }
} else {
  step('сбор', true, 'пропущен по --skip-collect');
}

// --------------------------------------------- 2–3. применение в копию ----
if (CFG.kind === 'legacy') {
  // Старое поколение дозаполняет живой каталог само, рабочая копия ему не нужна.
  // merge-programs никогда не перезаписывает заполненное поле — только пустое.
  const r = await run('merge-programs.mjs', APPLY ? [] : ['--dry-run']);
  if (r.code !== 0) { report.error = 'merge-programs упал'; step('слияние в каталог', false, report.error); await finish(1); }
  step('слияние в каталог (merge-programs)', true, APPLY ? 'записано' : 'сухой прогон');
  report.applied = APPLY;
} else {
  const inv = await run('kompas-inventory.mjs', ['--write-copy']);
  if (inv.code !== 0) { report.error = 'не удалось обновить рабочую копию с живого каталога'; step('рабочая копия ← каталог', false, report.error); await finish(1); }
  step('рабочая копия ← каталог', true);

  const fees = await run('kompas-fees-apply.mjs', [`--sources=${CFG.source}`]);
  step('цены агрегатора в рабочую копию', fees.code === 0, fees.code === 0 ? '' : `код ${fees.code}`);
  const progs = await run('kompas-programs-backfill.mjs', [`--sources=${CFG.source}`]);
  step('программы агрегатора в рабочую копию', progs.code === 0, progs.code === 0 ? '' : `код ${progs.code}`);

  // ------------------------------------------- 4. что изменилось и порог ----
  if (!existsSync(WORK)) { report.error = 'рабочей копии нет'; step('сравнение копии с каталогом', false, report.error); await finish(1); }
  const live = await readCards(LIVE);
  const work = await readCards(WORK);
  const changed = [];
  let own = 0;
  for (const [slug, rawWork] of work) {
    const rawLive = live.get(slug);
    if (rawLive === undefined) continue;                    // новых карточек прогон не заводит
    if (!belongsTo(rawLive, CFG.source) && !belongsTo(rawWork, CFG.source)) continue;
    own++;
    // Сравниваем содержимое, а не текст: живой каталог лежит с CRLF, рабочая копия
    // пишется с LF, и до 20.09.2026 каждая своя карточка считалась изменённой
    // (Kaplan 25 из 25, GEDU 10 из 10, Collab 76 из 76 при 25 настоящих) —
    // порог 5 % срабатывал на переводах строк.
    if (!sameJson(rawWork, rawLive)) changed.push(slug);
  }
  report.ownCards = own;
  report.changedCards = changed.length;
  const share = live.size ? (changed.length / live.size) * 100 : 0;
  step('сравнение копии с каталогом', true, `свои карточки ${own}, изменились ${changed.length} (${share.toFixed(1)}% каталога)`);

  if (!changed.length) { step('перенос', true, 'менять нечего'); await finish(0); }

  if (share > MAX_CHANGE) {
    report.hold = { reason: `изменение ${share.toFixed(1)}% каталога больше порога ${MAX_CHANGE}%`, cards: changed.slice(0, 50) };
    step('порог изменения', false, report.hold.reason + ' — перенос остановлен, кейсы в панель');
    await finish(1);
  }
  step('порог изменения', true, `${share.toFixed(1)}% ≤ ${MAX_CHANGE}%`);

  // -------------------------------------------------- 5. перенос в каталог ----
  const applyArgs = [`--cards=${changed.join(',')}`];
  if (APPLY) applyArgs.push('--apply');
  const ap = await run('kompas-apply-workcopy.mjs', applyArgs);
  if (ap.code !== 0) { report.error = 'применятель завершился с ошибкой'; step('перенос в каталог', false, report.error); await finish(1); }
  step('перенос в каталог', true, APPLY ? `карточек ${changed.length}` : 'сухой прогон, ничего не записано');
  report.applied = APPLY;
}

// ------------------------------------------------------------- 6. гейт ----
const gate = await run('audit-catalog.mjs', ['--gate']);
if (gate.code !== 0) {
  report.error = 'гейт каталога красный после переноса';
  step('гейт каталога', false, 'откат: node scraper/kompas-apply-workcopy.mjs --rollback=<последняя папка в backups/>');
  await finish(1);
}
step('гейт каталога', true);
await finish(0);
