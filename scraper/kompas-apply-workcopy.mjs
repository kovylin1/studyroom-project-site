#!/usr/bin/env node
// kompas-apply-workcopy.mjs — задача 3.1: перенос рабочей копии в ЖИВОЙ каталог.
//
// НАПРАВЛЕНИЕ. sources/kompas/catalog-work → site/src/content/universities.
// Обратного здесь нет. Не путать с `kompas-inventory.mjs --write-copy`: тот работает
// В ОБРАТНУЮ сторону и стирает рабочую копию живым каталогом.
//
// ПОЧЕМУ ПРОСТОЕ КОПИРОВАНИЕ ФАЙЛА — ЭТО ВЕРНО. Сверка (kompas-workcopy-diff.mjs)
// показывает, что рабочая копия — строгое надмножество живого каталога: ни одного
// поля, ни одной программы, ни одной записи коллекций в ней не пропало, программы
// не переименованы и уровни не переписаны. Значит карточка переносится целиком,
// а не полями: сшивать две версии по кусочкам — лишний способ ошибиться.
//
// ПЕРЕД ЗАПИСЬЮ каждая карточка проходит те же ЖЁСТКИЕ правила, что и деплойный
// гейт (audit-catalog.mjs): валюта против страны, мусорные названия, уровень против
// названия, повторы слагов, нулевые цены, битые ссылки на картинки. Карточка,
// которая внесла бы новое нарушение, НЕ ПЕРЕНОСИТСЯ — остальные переносятся.
// Так частичный перенос не может оставить сборку красной.
//
// БЭКАП. Прежние версии затронутых карточек складываются в
// backups/live_pre-3.1_<штамп>/, заведённые карточки перечислены в манифесте
// (откат для них — удаление). Откат целиком: --rollback=<путь к папке бэкапа>.
//
// Сети нет. По умолчанию НИЧЕГО НЕ ПИШЕТ (см. задачу 3.25 — «безопасные» режимы,
// которые всё-таки пишут); запись только по явному --apply.
//
//   node scraper/kompas-apply-workcopy.mjs --probe=20            # что уедет при пробое
//   node scraper/kompas-apply-workcopy.mjs --probe=20 --apply    # пробой на 20 вузах
//   node scraper/kompas-apply-workcopy.mjs --cards=essex,sydney --apply
//   node scraper/kompas-apply-workcopy.mjs --all --apply         # весь каталог
//   node scraper/kompas-apply-workcopy.mjs --rollback=backups/live_pre-3.1_2026-08-23T18-40

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inferLevel, DEGREE_LEVELS } from './lib/program-level.mjs';
import { COUNTRY_CURRENCY, SCHEMA_CURRENCIES } from './lib/country-currency.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LIVE_DIR = path.join(ROOT, 'site/src/content/universities');
const WORK_DIR = path.join(ROOT, 'sources/kompas/catalog-work');
const PUBLIC = path.join(ROOT, 'site/public');
const DIFF_JSON = path.join(ROOT, 'sources/kompas/workcopy-diff.json');
const OUT_MD = path.join(ROOT, 'sources/kompas/APPLY-WORKCOPY.md');

const argOf = (name) => {
  const a = process.argv.find((x) => x.startsWith('--' + name + '='));
  return a ? a.slice(name.length + 3) : null;
};
const APPLY = process.argv.includes('--apply');
const ALL = process.argv.includes('--all');
const PROBE = argOf('probe');
const CARDS = argOf('cards');
const ROLLBACK = argOf('rollback');

const n = (x) => Number(x || 0).toLocaleString('ru-RU').replace(/ /g, ' ');
const readJson = async (f) => JSON.parse(await fs.readFile(f, 'utf8'));

// --- жёсткие правила гейта, применённые к ОДНОЙ карточке ---------------------
const JUNK_TITLE = /^\s*(admissions?|entry\s+requirements?|requirements|how\s+to\s+apply|apply\s+(now|online)|pathway\s+entry|foundation\s+entry)\s*$/i;

function hardViolations(card) {
  const bad = [];
  const programs = card.programs ?? [];
  // Проверки схемы (site/src/schema/university.ts) — то, на чём валится сборка сайта,
  // а не только деплойный гейт. 23.08 именно это и случилось: у 61 заведённой карточки
  // без цен стояло `tuition.currency: null`, в рабочей копии никого не смущало,
  // а zod уронил весь build. Гейт таких вещей не ловит, поэтому они здесь.
  if (!card.tuition || !SCHEMA_CURRENCIES.has(card.tuition.currency)) {
    bad.push('валюта карточки «' + (card.tuition?.currency ?? 'нет') + '» вне схемы — сборка сайта упадёт');
  }
  if (!card.slug || !card.name || !card.country || !card.city) {
    bad.push('нет обязательного поля карточки (slug/name/country/city)');
  }
  const want = COUNTRY_CURRENCY[card.country];
  if (want && card.tuition?.currency && card.tuition.currency !== want) {
    bad.push('валюта ' + card.tuition.currency + ' при стране ' + card.country + ' (ожидалась ' + want + ')');
  }
  const slugs = new Set();
  for (const p of programs) {
    if (slugs.has(p.slug)) bad.push('повтор слага программы «' + p.slug + '»');
    slugs.add(p.slug);
    if (JUNK_TITLE.test(p.title ?? '') && p.programType !== 'pathway') bad.push('мусорное название «' + p.title + '»');
    if (DEGREE_LEVELS.has(p.level)) {
      const inf = inferLevel(p.title);
      if (inf && inf !== p.level) bad.push('уровень «' + p.level + '» против названия «' + p.title + '» (' + inf + ')');
    }
  }
  for (const [s, v] of Object.entries(card.tuition?.byProgram ?? {})) {
    if (!(Number(v) > 0)) bad.push('нулевая цена у «' + s + '»');
  }
  const imgs = [];
  if (card.logoUrl) imgs.push(card.logoUrl);
  for (const it of card.gallery?.items ?? []) if (it.img) imgs.push(it.img);
  for (const it of card.accommodation ?? []) if (it.img) imgs.push(it.img);
  for (const i of imgs) {
    if (!i || /^https?:\/\//.test(i)) continue;
    if (!existsSync(path.join(PUBLIC, i.replace(/^\//, '')))) bad.push('картинка 404: ' + i);
  }
  return bad;
}

// --- откат -------------------------------------------------------------------
async function rollback(dir) {
  const abs = path.resolve(ROOT, dir);
  const manifest = await readJson(path.join(abs, 'manifest.json'));
  let restored = 0; let removed = 0;
  for (const slug of manifest.updated ?? []) {
    await fs.copyFile(path.join(abs, slug + '.json'), path.join(LIVE_DIR, slug + '.json'));
    restored++;
  }
  for (const slug of manifest.created ?? []) {
    const fp = path.join(LIVE_DIR, slug + '.json');
    if (existsSync(fp)) { await fs.unlink(fp); removed++; }
  }
  console.log('откат из ' + dir + ': возвращено ' + restored + ', удалено заведённых ' + removed);
}

// --- перенос -----------------------------------------------------------------
async function main() {
  if (ROLLBACK) return rollback(ROLLBACK);
  if (!ALL && !PROBE && !CARDS) {
    console.log('нужен выбор: --all, --probe=N или --cards=a,b,c');
    process.exitCode = 1;
    return;
  }

  const workFiles = (await fs.readdir(WORK_DIR)).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
  let chosen = workFiles;
  if (CARDS) {
    chosen = CARDS.split(',').map((s) => s.trim()).filter(Boolean);
    const missing = chosen.filter((s) => !workFiles.includes(s));
    if (missing.length) { console.log('нет в рабочей копии: ' + missing.join(', ')); process.exitCode = 1; return; }
  } else if (PROBE) {
    // Пробой — по самым крупным изменениям: если где-то и рванёт, то там.
    // Порядок берём из сверки, чтобы «двадцать вузов» значили одно и то же у всех.
    let order = [];
    try {
      const diff = await readJson(DIFF_JSON);
      order = [...diff.cards.map((c) => c.slug), ...diff.newCards];
    } catch {
      console.log('нет ' + path.relative(ROOT, DIFF_JSON) + ' — прогони kompas-workcopy-diff.mjs');
      process.exitCode = 1;
      return;
    }
    chosen = order.filter((s) => workFiles.includes(s)).slice(0, Number(PROBE));
  }

  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const backupDir = path.join(ROOT, 'backups', 'live_pre-3.1_' + stamp);

  const created = []; const updated = []; const refused = []; const same = [];
  for (const slug of chosen) {
    const workFp = path.join(WORK_DIR, slug + '.json');
    const liveFp = path.join(LIVE_DIR, slug + '.json');
    const raw = await fs.readFile(workFp, 'utf8');
    let card;
    try { card = JSON.parse(raw); } catch (e) { refused.push({ slug, why: ['не читается: ' + e.message] }); continue; }

    const bad = hardViolations(card);
    if (bad.length) { refused.push({ slug, why: bad.slice(0, 5) }); continue; }

    const exists = existsSync(liveFp);
    if (exists && (await fs.readFile(liveFp, 'utf8')) === raw) { same.push(slug); continue; }

    if (APPLY) {
      await fs.mkdir(backupDir, { recursive: true });
      if (exists) await fs.copyFile(liveFp, path.join(backupDir, slug + '.json'));
      await fs.writeFile(liveFp, raw, 'utf8');
    }
    (exists ? updated : created).push(slug);
  }

  if (APPLY && (created.length || updated.length)) {
    await fs.mkdir(backupDir, { recursive: true });
    await fs.writeFile(path.join(backupDir, 'manifest.json'), JSON.stringify({
      generatedAt: new Date().toISOString(),
      direction: 'catalog-work → site/src/content/universities',
      created, updated, refused,
    }, null, 2) + '\n', 'utf8');
  }

  const md = [];
  const p = (...s) => md.push(...s);
  p('# 3.1 — перенос рабочей копии в живой каталог', '');
  p('Скрипт `scraper/kompas-apply-workcopy.mjs`. Режим: ' + (APPLY ? '**запись**' : 'разбор без записи') + '.');
  p('Выбор: ' + (ALL ? 'весь каталог' : CARDS ? 'карточки по списку' : 'пробой на ' + PROBE) + ', всего ' + n(chosen.length) + '.');
  p('Снято ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC.', '');
  p('| Что | Карточек |', '|---|---:|');
  p('| Заведено новых | ' + n(created.length) + ' |');
  p('| Обновлено | ' + n(updated.length) + ' |');
  p('| Уже совпадало | ' + n(same.length) + ' |');
  p('| Не перенесено (нарушили бы гейт) | ' + n(refused.length) + ' |');
  p('');
  if (APPLY) p('Откат: `node scraper/kompas-apply-workcopy.mjs --rollback=backups/live_pre-3.1_' + stamp + '`', '');
  if (refused.length) {
    p('## Не перенесено', '');
    p('| Карточка | Почему |', '|---|---|');
    for (const r of refused) p('| `' + r.slug + '` | ' + r.why.join('; ').slice(0, 160) + ' |');
    p('');
  }
  if (created.length) { p('## Заведены', ''); p(created.map((s) => '`' + s + '`').join(', '), ''); }
  if (updated.length) { p('## Обновлены', ''); p(updated.slice(0, 200).map((s) => '`' + s + '`').join(', ') + (updated.length > 200 ? ' и ещё ' + n(updated.length - 200) : ''), ''); }
  await fs.writeFile(OUT_MD, md.join('\n'), 'utf8');

  console.log((APPLY ? 'ЗАПИСАНО' : 'РАЗБОР (без записи)') + ': заведено ' + created.length
    + ', обновлено ' + updated.length + ', совпадало ' + same.length + ', не перенесено ' + refused.length);
  for (const r of refused.slice(0, 10)) console.log('  ✗ ' + r.slug + ': ' + r.why[0]);
  if (APPLY && (created.length || updated.length)) console.log('бэкап: ' + path.relative(ROOT, backupDir));
  console.log('отчёт: ' + path.relative(ROOT, OUT_MD));
  if (!APPLY) console.log('ничего не записано — для записи добавь --apply');
}

await main();
