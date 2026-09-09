#!/usr/bin/env node
// kompas-fee-drop-review.mjs — какие цены после 3.1 упадут и на чьём основании.
//
// ЗАЧЕМ. Решение владельца: цена агрегатора важнее каталожной, а когда у одной
// программы несколько цен — пишем минимальную. Правило применено сплошь, и в
// рабочей копии 3 191 цена ниже каталожной. Почти всё — законные уточнения, но
// правило «минимум» не отличает дешёвую программу от битого числа: у магистратуры
// Сиднея вместо 61 700 AUD встало 5 300 AUD, потому что одна строка QS столько
// показала. Отчёт отделяет одно от другого — решать владельцу, скрипт не чинит.
//
// РАЗРЯДЫ:
//   outlier-variant — у программы несколько цен источников, и выбранная ниже
//                     следующей больше чем вдвое. Это не «дешевле», это разнобой.
//   steep           — вариантов нет, но цена упала больше чем вдвое.
//   mild            — падение в пределах половины: уточнение, смотреть незачем.
//
// Сети нет, ничего не пишется в каталог. Отчёты: sources/kompas/FEE-DROPS.md
// и fee-drops.json. Запуск: node scraper/kompas-fee-drop-review.mjs [--top=30]

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LIVE_DIR = path.join(ROOT, 'site/src/content/universities');
const WORK_DIR = path.join(ROOT, 'sources/kompas/catalog-work');
const OUT_MD = path.join(ROOT, 'sources/kompas/FEE-DROPS.md');
const OUT_JSON = path.join(ROOT, 'sources/kompas/fee-drops.json');

const topArg = process.argv.find((a) => a.startsWith('--top='));
const TOP = topArg ? Number(topArg.slice(6)) : 30;
const n = (x) => Number(x || 0).toLocaleString('ru-RU').replace(/ /g, ' ');

const readCard = async (dir, slug) => {
  try { return JSON.parse(await fs.readFile(path.join(dir, slug + '.json'), 'utf8')); } catch { return null; }
};

async function main() {
  const files = (await fs.readdir(WORK_DIR)).filter((f) => f.endsWith('.json'));
  const cases = [];

  for (const f of files) {
    const slug = f.replace(/\.json$/, '');
    const work = await readCard(WORK_DIR, slug);
    const live = await readCard(LIVE_DIR, slug);
    if (!work || !live) continue;                       // новая карточка — падать нечему
    const lf = live.tuition?.byProgram ?? {};
    const wf = work.tuition?.byProgram ?? {};
    const byslug = new Map((work.programs ?? []).map((p) => [p.slug, p]));

    for (const [ps, was] of Object.entries(lf)) {
      const now = wf[ps];
      if (now == null || !(now < was)) continue;
      const p = byslug.get(ps) ?? {};
      const variants = (p.tuitionVariants ?? []).map((v) => ({
        tuition: v.tuition, currency: v.currency ?? null, source: v.source ?? null,
        campus: v.campus ?? null, level: v.level ?? null,
      })).sort((a, b) => a.tuition - b.tuition);
      const second = variants.length > 1 ? variants[1].tuition : null;
      const ratio = was ? now / was : null;
      const kind = variants.length > 1 && second && now * 2 < second ? 'outlier-variant'
        : (ratio != null && ratio < 0.5 ? 'steep' : 'mild');
      cases.push({
        card: slug, name: work.name ?? '', country: work.country ?? null, program: ps,
        title: p.title ?? null, level: p.level ?? null, currency: p.tuitionCurrency ?? work.tuition?.currency ?? null,
        was, now, dropPct: was ? Math.round((1 - now / was) * 100) : null,
        kind, pickedFrom: variants.find((v) => v.tuition === now)?.source ?? null,
        secondBest: second, variants,
      });
    }
  }

  const byKind = { 'outlier-variant': [], steep: [], mild: [] };
  for (const c of cases) byKind[c.kind].push(c);
  for (const k of Object.keys(byKind)) byKind[k].sort((a, b) => b.dropPct - a.dropPct);

  // Кто поставляет выбранные минимумы — по разрядам.
  const sourceTally = {};
  for (const c of cases) {
    if (c.kind === 'mild') continue;
    const s = c.pickedFrom ?? 'источник не назван';
    (sourceTally[s] ??= { 'outlier-variant': 0, steep: 0 })[c.kind]++;
  }
  const cardTally = {};
  for (const c of cases) if (c.kind !== 'mild') cardTally[c.card] = (cardTally[c.card] || 0) + 1;

  await fs.writeFile(OUT_JSON, JSON.stringify({
    generatedAt: new Date().toISOString(),
    totals: { all: cases.length, outlier: byKind['outlier-variant'].length, steep: byKind.steep.length, mild: byKind.mild.length },
    sourceTally, cases,
  }, null, 2) + '\n', 'utf8');

  const md = [];
  const p = (...s) => md.push(...s);
  p('# Цены, которые после 3.1 упадут — что смотреть глазами', '');
  p('Скрипт `scraper/kompas-fee-drop-review.mjs`, только чтение. Снято '
    + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC.', '');
  p('Правило владельца — «цена агрегатора важнее каталожной, из нескольких берём минимум» —');
  p('применено сплошь. Отчёт отделяет уточнение цены от разнобоя источников.', '');
  p('| Разряд | Цен | Что это |', '|---|---:|---|');
  p('| `outlier-variant` | ' + n(byKind['outlier-variant'].length) + ' | у программы несколько цен, выбранная ниже следующей больше чем вдвое |');
  p('| `steep` | ' + n(byKind.steep.length) + ' | вариантов нет, но цена упала больше чем вдвое |');
  p('| `mild` | ' + n(byKind.mild.length) + ' | падение в пределах половины — уточнение |');
  p('| **всего** | **' + n(cases.length) + '** | |');
  p('');

  p('## Откуда взяты подозрительные минимумы', '');
  p('| Источник | outlier-variant | steep |', '|---|---:|---:|');
  for (const [s, v] of Object.entries(sourceTally).sort((a, b) => (b[1]['outlier-variant'] + b[1].steep) - (a[1]['outlier-variant'] + a[1].steep))) {
    p('| ' + s + ' | ' + n(v['outlier-variant']) + ' | ' + n(v.steep) + ' |');
  }
  p('');
  p('## Карточки с наибольшим числом спорных цен', '');
  p('| Карточка | Спорных цен |', '|---|---:|');
  for (const [c, v] of Object.entries(cardTally).sort((a, b) => b[1] - a[1]).slice(0, 15)) p('| `' + c + '` | ' + n(v) + ' |');
  p('');

  for (const kind of ['outlier-variant', 'steep']) {
    const list = byKind[kind];
    p('## ' + kind + ' — ' + n(list.length), '');
    if (!list.length) { p('пусто', ''); continue; }
    p('| Карточка | Программа | Было | Станет | −% | Кто дал | Следующая цена |', '|---|---|---:|---:|---:|---|---:|');
    for (const c of list.slice(0, TOP)) {
      p('| `' + c.card + '` | ' + String(c.title ?? c.program).slice(0, 55) + ' | ' + n(c.was) + ' | ' + n(c.now)
        + ' | ' + c.dropPct + ' | ' + (c.pickedFrom ?? '—') + ' | ' + (c.secondBest != null ? n(c.secondBest) : '—') + ' |');
    }
    if (list.length > TOP) p('| … | ещё ' + n(list.length - TOP) + ' | | | | | |');
    p('');
  }
  p('Построчно, со всеми вариантами стоимости — `sources/kompas/fee-drops.json`.', '');
  await fs.writeFile(OUT_MD, md.join('\n'), 'utf8');

  console.log('снижений цены ' + cases.length + ': outlier-variant ' + byKind['outlier-variant'].length
    + ', steep ' + byKind.steep.length + ', mild ' + byKind.mild.length);
  console.log('отчёты: ' + path.relative(ROOT, OUT_MD) + ', ' + path.relative(ROOT, OUT_JSON));
}

await main();
