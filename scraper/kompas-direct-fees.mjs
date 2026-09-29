#!/usr/bin/env node
// kompas-direct-fees.mjs — цены прямых партнёров с их офсайтов, парсер на домен.
//
// ЗАЧЕМ. На 28.09.2026 у 15 прямых партнёров программы в карточке есть, а цен нет
// ни одной (замер по живому каталогу). Агрегаторы этих вузов не показывают, брать
// цену больше неоткуда. Общий сборщик kompas-collect-direct на этих сайтах цен не
// нашёл ни одной (A1, 02.09) — поэтому у каждого домена свой разбор в
// scraper/direct-fees/<slug>.mjs, а этот скрипт только гоняет их, проверяет
// и сводит собранное с программами карточки.
//
// Формат парсера — scraper/direct-fees/README.md.
//
// Что проверяется у каждой строки цены (нарушившая не едет, а уходит в отчёт):
//   - сумма буквально стоит в сырой ячейке `raw` — число не выдумано;
//   - валюта из списка схемы сайта;
//   - основа 'year' или 'program' — семестровые и покредитные суммы не пересчитываем;
//   - аудитория не 'domestic' и не 'eu' — каталог для студентов из Казахстана;
//   - scope 'program' садится только на программу, найденную program-match
//     (точно по ссылке или названию, без нечёткого сравнения);
//   - scope 'level' — только если подпись прямо называет уровень (решение 23.07.2026),
//     и только на программы карточки без программной цены.
//
// Живой каталог правится только с --apply и только там, где у программы цены
// ещё нет: чужие цены не перезаписываются. Прежние значения — в бэкап.
//
// Запуск:
//   node kompas-direct-fees.mjs                 все парсеры, сухой прогон
//   node kompas-direct-fees.mjs --slug=inti-international-university
//   node kompas-direct-fees.mjs --from-extracts [--apply]   без сети, по сохранённым выгрузкам

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildIndex, matchProgram } from './lib/program-match.mjs';
import { SCHEMA_CURRENCIES } from './lib/country-currency.mjs';
import { tuitionPlausible } from './lib/numbers.mjs';
import { closeBrowser } from './direct-fees/_lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PARSERS = path.join(ROOT, 'scraper/direct-fees');
const CATALOG = path.join(ROOT, 'site/src/content/universities');
const OUT = path.join(ROOT, 'sources/kompas/extracts/direct-fees');
const REPORT_JSON = path.join(ROOT, 'sources/kompas/direct-fees-report.json');
const REPORT_MD = path.join(ROOT, 'sources/kompas/DIRECT-FEES.md');
const BACKUP = path.join(ROOT, 'sources/kompas/direct-fees-backup.json');

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const FROM_EXTRACTS = argv.includes('--from-extracts');
const ONLY = (argv.find((a) => a.startsWith('--slug=')) || '').slice(7);
const TODAY = new Date().toISOString().slice(0, 10);

const BASES = new Set(['year', 'program']);
const SKIP_AUDIENCE = new Set(['domestic', 'eu']);
// Уровни схемы сайта (programLevel в site/src/schema/university.ts). diploma/associate в схеме нет.
const LEVELS = new Set(['foundation', 'bachelor', 'master', 'phd', 'english-language', 'short-course']);
const ADD_PROGRAMS = argv.includes('--add-programs');
const PLACEHOLDER = /contact studyroom/i;

const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, ''));
const digits = (s) => String(s ?? '').replace(/[^\d]/g, '');

/** Почему строка цены не годится — или null, если годится. */
function rejectReason(f) {
  if (!(typeof f.amount === 'number' && f.amount > 0)) return 'amount-not-number';
  if (!f.raw || !digits(f.raw).includes(digits(Math.round(f.amount)))) return 'amount-not-in-raw';
  if (!SCHEMA_CURRENCIES.has(f.currency)) return `currency-${f.currency ?? 'none'}`;
  if (!BASES.has(f.basis)) return `basis-${f.basis ?? 'none'}`;
  if (SKIP_AUDIENCE.has(f.audience)) return `audience-${f.audience}`;
  // Цена со скидкой — не цена программы (Demiroğlu Bilim даёт только «% 50 İNDİRİMLİ»).
  if (/[iİı]nd[iİı]r[iİı]m|discount|scholarship|early[- ]bird/i.test(f.raw)) return 'discounted-price';
  // Заочная/дистанционная цена дешевле очной, и по правилу минимума она подменяла
  // бы цену программы (TSI: «Part time: 3800 EUR» вместо очной). Студенты из
  // Казахстана едут на очное — такие строки не едут (28.09.2026).
  if (/\b(part[- ]?time|distance|online|blended|evening|weekend)\b/i.test(f.raw)
    && !/\bfull[- ]?time\b/i.test(f.raw)) return 'mode-not-full-time';
  if (f.scope === 'program' && !f.title) return 'program-scope-without-title';
  if (f.scope === 'level' && !LEVELS.has(f.level)) return 'level-scope-without-level';
  if (f.scope !== 'program' && f.scope !== 'level') return `scope-${f.scope ?? 'none'}`;
  if (!f.url) return 'no-url';
  return null;
}

/** Лучший кандидат программы: программная цена важнее уровневой, международная — прочих, затем минимум. */
function pick(cands) {
  const rank = (c) => [c.scope === 'program' ? 0 : 1, c.audience === 'international' ? 0 : 1, c.amount];
  return [...cands].sort((a, b) => {
    const ra = rank(a), rb = rank(b);
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
    return 0;
  })[0];
}

/** Сводит выгрузку парсера с карточкой: что куда сядет и что отбито. */
function plan(extract, card) {
  const programs = card.programs || [];
  const idx = buildIndex(programs);
  const priced = new Set(Object.keys(card.tuition?.byProgram || {}));
  const rejected = [], unmatched = [], cands = new Map();
  const add = (p, f) => { if (!cands.has(p.slug)) cands.set(p.slug, []); cands.get(p.slug).push(f); };

  for (const f of extract.fees || []) {
    const why = rejectReason(f);
    if (why) { rejected.push({ why, raw: f.raw, title: f.title ?? f.level }); continue; }
    if (f.scope === 'program') {
      const m = matchProgram(idx, { title: f.title, level: f.level, programUrl: f.programUrl });
      if (m.program) add(m.program, { ...f, how: m.how });
      else unmatched.push({ title: f.title, how: m.how, amount: f.amount, currency: f.currency });
    } else {
      const hits = programs.filter((p) => p.level === f.level);
      if (!hits.length) unmatched.push({ title: `[level ${f.level}]`, how: 'no-programs-of-level', amount: f.amount, currency: f.currency });
      for (const p of hits) add(p, { ...f, how: 'level' });
    }
  }

  const assign = [];
  for (const [slug, list] of cands) {
    const best = pick(list);
    const program = programs.find((p) => p.slug === slug);
    assign.push({
      slug, title: program.title, level: program.level,
      amount: best.amount, currency: best.currency, basis: best.basis, scope: best.scope,
      audience: best.audience ?? null, how: best.how, url: best.url, raw: best.raw,
      variants: list.length, alreadyPriced: priced.has(slug),
      plausible: best.basis === 'year' ? tuitionPlausible(best.amount, best.currency, program.level) : null,
    });
  }

  // Покрытие: что вуз публикует и чего нет в карточке, и наоборот. Сопоставление то же,
  // что у цен (program-match), в обе стороны.
  const sitePrograms = extract.programs || [];
  const siteOnly = sitePrograms.filter((sp) => !matchProgram(idx, { title: sp.title, level: sp.level, programUrl: sp.url }).program);
  const siteIdx = buildIndex(sitePrograms.map((sp) => ({ ...sp, slug: sp.title, programUrl: sp.url })));
  const cardOnly = sitePrograms.length
    ? programs.filter((p) => !matchProgram(siteIdx, { title: p.title, level: p.level, programUrl: p.programUrl }).program)
    : [];

  return {
    slug: extract.slug,
    cardPrograms: programs.length,
    cardPricedBefore: priced.size,
    feeRows: (extract.fees || []).length,
    rejected, unmatched, assign,
    newPrices: assign.filter((a) => !a.alreadyPriced).length,
    byScope: {
      program: assign.filter((a) => !a.alreadyPriced && a.scope === 'program').length,
      level: assign.filter((a) => !a.alreadyPriced && a.scope === 'level').length,
    },
    implausible: assign.filter((a) => a.plausible === false).length,
    sitePrograms: sitePrograms.length,
    siteProgramsNotInCard: siteOnly.length,
    siteProgramsNotInCardSample: siteOnly.slice(0, 8).map((p) => p.title),
    cardProgramsNotOnSite: cardOnly.length,
    cardProgramsNotOnSiteSample: cardOnly.slice(0, 8).map((p) => p.title),
    gaps: extract.gaps || [],
  };
}

const slugify = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/ı/g, 'i').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90).replace(/-+$/, '');

/**
 * Заводит в карточку программы с сайта вуза, которых в ней нет (--add-programs).
 * Уровень обязателен и должен быть из схемы — без него программа не создаётся.
 * Заглушка «Programmes — contact StudyRoom» снимается, если завелась хоть одна.
 */
function addPrograms(card, extract) {
  const programs = card.programs || [];
  const idx = buildIndex(programs);
  const taken = new Set(programs.map((p) => p.slug));
  const added = [], skipped = [];
  for (const sp of extract.programs || []) {
    if (!sp.title || !LEVELS.has(sp.level)) { skipped.push({ title: sp.title, why: `level-${sp.level ?? 'none'}` }); continue; }
    if (matchProgram(idx, { title: sp.title, level: sp.level, programUrl: sp.url }).how !== 'none') continue;
    if (added.some((a) => a.title.toLowerCase() === sp.title.toLowerCase())) continue;
    let slug = slugify(`${card.slug}-${sp.title}`), n = 2;
    while (taken.has(slug)) slug = `${slugify(`${card.slug}-${sp.title}`)}-${n++}`;
    taken.add(slug);
    added.push({ slug, title: sp.title, level: sp.level, ...(sp.url ? { programUrl: sp.url } : {}),
      source: 'official', verifiedBySite: true, kompasStatus: 'source-added', kompasCheckedAt: TODAY });
  }
  if (added.length) {
    const drop = programs.filter((p) => PLACEHOLDER.test(p.title));
    for (const p of drop) delete card.tuition?.byProgram?.[p.slug];
    card.programs = [...programs.filter((p) => !PLACEHOLDER.test(p.title)), ...added];
  }
  return { added, skipped };
}

/** Пишет назначенные цены в карточку. Только туда, где цены ещё не было. */
function applyToCard(file, card, p, backup) {
  const before = { tuition: structuredClone(card.tuition ?? null), programs: {} };
  card.tuition ??= { currency: null, byProgram: {} };
  card.tuition.byProgram ??= {};
  const todo = p.assign.filter((a) => !a.alreadyPriced && a.plausible !== false);
  if (!todo.length) return 0;
  // Валюта карточки: если её нет — самая частая валюта назначенных цен.
  if (!card.tuition.currency) {
    const n = {};
    for (const a of todo) n[a.currency] = (n[a.currency] || 0) + 1;
    card.tuition.currency = Object.entries(n).sort((a, b) => b[1] - a[1])[0][0];
  }
  for (const a of todo) {
    const prog = card.programs.find((x) => x.slug === a.slug);
    before.programs[a.slug] = Object.fromEntries(['tuitionBasis', 'tuitionCurrency', 'feeScope', 'feeSourceUrl']
      .map((k) => [k, prog[k] ?? null]));
    card.tuition.byProgram[a.slug] = a.amount;
    if (a.basis === 'program') prog.tuitionBasis = 'program'; else delete prog.tuitionBasis;
    if (a.currency !== card.tuition.currency) prog.tuitionCurrency = a.currency; else delete prog.tuitionCurrency;
    prog.feeScope = a.scope;
    prog.feeSourceUrl = a.url;
  }
  backup[p.slug] = before;
  fs.writeFileSync(file, JSON.stringify(card, null, 2) + '\n', 'utf8');
  return todo.length;
}

function mdReport(plans, errors) {
  const L = [`# Цены прямых партнёров с офсайтов — ${TODAY}`, '',
    'Скрипт `scraper/kompas-direct-fees.mjs`, парсеры `scraper/direct-fees/<slug>.mjs`.', '',
    '| вуз | в карточке | на сайте | с сайта нет в карточке | из карточки нет на сайте | цен было | строк цены | новых цен | уровневых | отбито | не сопоставлено |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|'];
  for (const p of plans) {
    L.push(`| ${p.slug} | ${p.cardPrograms} | ${p.sitePrograms || '—'} | ${p.sitePrograms ? p.siteProgramsNotInCard : '—'} | ${p.sitePrograms ? p.cardProgramsNotOnSite : '—'} | ${p.cardPricedBefore} | ${p.feeRows} | ${p.newPrices} | ${p.byScope.level} | ${p.rejected.length} | ${p.unmatched.length} |`);
  }
  for (const e of errors) L.push(`| ${e.slug} | — | — | — | ОШИБКА: ${e.error.slice(0, 80)} | | | | | |`);
  L.push('');
  for (const p of plans) {
    if (!p.gaps.length && !p.unmatched.length && !p.rejected.length) continue;
    L.push(`## ${p.slug}`, '');
    for (const g of p.gaps) L.push(`- пробел: ${g.why}${g.url ? ` — ${g.url}` : ''}`);
    for (const u of p.unmatched.slice(0, 10)) L.push(`- не сопоставлено (${u.how}): ${u.title} — ${u.amount} ${u.currency}`);
    const why = {};
    for (const r of p.rejected) why[r.why] = (why[r.why] || 0) + 1;
    for (const [k, n] of Object.entries(why)) L.push(`- отбито ${k}: ${n}`);
    L.push('');
  }
  return L.join('\n');
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const slugs = fs.readdirSync(FROM_EXTRACTS ? OUT : PARSERS)
    .filter((f) => f.endsWith(FROM_EXTRACTS ? '.json' : '.mjs') && !f.startsWith('_'))
    .map((f) => f.replace(/\.(mjs|json)$/, ''))
    .filter((s) => !ONLY || s === ONLY);

  const plans = [], errors = [], backup = {};
  let written = 0;
  for (const slug of slugs) {
    const cardFile = path.join(CATALOG, `${slug}.json`);
    if (!fs.existsSync(cardFile)) { errors.push({ slug, error: 'нет карточки в каталоге' }); continue; }
    let extract;
    try {
      if (FROM_EXTRACTS) {
        extract = readJson(path.join(OUT, `${slug}.json`));
      } else {
        const mod = (await import(pathToFileURL(path.join(PARSERS, `${slug}.mjs`)).href)).default;
        const t0 = Date.now();
        const r = await mod.collect({ log: (...a) => console.error(`[${slug}]`, ...a) });
        extract = {
          slug, site: mod.site, source: 'official-direct-fees', scrapedAt: new Date().toISOString(),
          seconds: Math.round((Date.now() - t0) / 1000),
          programs: r.programs || [], fees: r.fees || [], gaps: r.gaps || [],
        };
        fs.writeFileSync(path.join(OUT, `${slug}.json`), JSON.stringify(extract, null, 2) + '\n', 'utf8');
      }
    } catch (e) {
      errors.push({ slug, error: String(e?.message || e).split('\n')[0] });
      console.error(`[${slug}] ОШИБКА`, e?.message || e);
      continue;
    }
    const card = readJson(cardFile);
    let addedPrograms = null;
    if (ADD_PROGRAMS) {
      addedPrograms = addPrograms(card, extract);
      if (APPLY && addedPrograms.added.length) fs.writeFileSync(cardFile, JSON.stringify(card, null, 2) + '\n', 'utf8');
    }
    const p = plan(extract, card);
    if (addedPrograms) p.addedPrograms = addedPrograms.added.length, p.addedProgramsSample = addedPrograms.added.slice(0, 8).map((a) => a.title), p.skippedPrograms = addedPrograms.skipped;
    plans.push(p);
    console.log(`${slug}: ${p.addedPrograms != null ? `программ заведено ${p.addedPrograms}, ` : ''}строк ${p.feeRows}, новых цен ${p.newPrices} (программных ${p.byScope.program}, уровневых ${p.byScope.level}), отбито ${p.rejected.length}, не сопоставлено ${p.unmatched.length}, вне диапазона ${p.implausible}`);
    if (APPLY) written += applyToCard(cardFile, card, p, backup);
  }
  await closeBrowser();

  // При прогоне одного слага общий отчёт не затираем — пишем рядом.
  const suffix = ONLY ? `-${ONLY}` : '';
  fs.writeFileSync(REPORT_JSON.replace('.json', `${suffix}.json`), JSON.stringify({ generatedAt: new Date().toISOString(), applied: APPLY, written, plans, errors }, null, 2) + '\n', 'utf8');
  if (!ONLY) fs.writeFileSync(REPORT_MD, mdReport(plans, errors) + '\n', 'utf8');
  if (APPLY) fs.writeFileSync(BACKUP, JSON.stringify({ at: new Date().toISOString(), cards: backup }, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ parsers: slugs.length, ok: plans.length, errors: errors.length,
    newPrices: plans.reduce((s, p) => s + p.newPrices, 0), written, applied: APPLY }));
  console.log('DIRECT-FEES DONE');
}

main().catch((e) => { console.error(e); process.exit(1); });
