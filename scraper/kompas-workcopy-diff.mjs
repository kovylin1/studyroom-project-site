#!/usr/bin/env node
// kompas-workcopy-diff.mjs — что именно изменится в ЖИВОМ каталоге, если применить
// рабочую копию (задача 3.1). Только чтение: ни один файл каталога не трогается.
//
// ЗАЧЕМ. Перенос рабочей копии в живой каталог — самая крупная и опасная операция
// плана: расходятся состав карточек, состав программ, весь ценовой блок и метки.
// Прежде чем писать применятель, надо увидеть дифф целиком и отдельно — его
// опасную половину: то, что из живого каталога ИСЧЕЗНЕТ.
//
// Направление всегда одно: catalog-work → site/src/content/universities.
// Обратного здесь нет (им занимается kompas-inventory --write-copy, и он стирает
// рабочую копию живым каталогом — не путать).
//
// Отчёты: sources/kompas/WORKCOPY-DIFF.md (глазами) и workcopy-diff.json (машинно).
// Запуск: node scraper/kompas-workcopy-diff.mjs [--top=20] [--card=<слаг>]

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LIVE_DIR = path.join(ROOT, 'site/src/content/universities');
const WORK_DIR = path.join(ROOT, 'sources/kompas/catalog-work');
const OUT_MD = path.join(ROOT, 'sources/kompas/WORKCOPY-DIFF.md');
const OUT_JSON = path.join(ROOT, 'sources/kompas/workcopy-diff.json');

const argOf = (name, def) => {
  const a = process.argv.find((x) => x.startsWith('--' + name + '='));
  return a ? a.slice(name.length + 3) : def;
};
const TOP = Number(argOf('top', 20));
const ONE_CARD = argOf('card', null);

const n = (x) => Number(x || 0).toLocaleString('ru-RU').replace(/ /g, ' ');
const eq = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// Поля программы, расхождение по которым интересно показать «до/после».
const PROGRAM_KEYS = new Set([
  'title', 'level', 'durationYears', 'language', 'faculty', 'intakes', 'programUrl',
  'programType', 'source', 'verifiedBySite', 'confidence', 'kompasStatus',
  'tuitionBasis', 'tuitionCurrency', 'kompasCheckedAt', 'checkedAt', 'brokenLink',
]);
// Коллекции карточки: сравниваем составом, а не поштучно.
const COLLECTIONS = ['campuses', 'scholarships', 'accommodation', 'gallery', 'photoSets', 'faq', 'reviews'];

const readDir = async (dir) => {
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json'));
  const out = new Map();
  for (const f of files) {
    const slug = f.replace(/\.json$/, '');
    if (ONE_CARD && slug !== ONE_CARD) continue;
    try { out.set(slug, JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'))); }
    catch (e) { out.set(slug, { __unreadable: e.message, programs: [] }); }
  }
  return out;
};

const programMap = (card) => {
  const m = new Map();
  for (const p of card?.programs ?? []) if (p?.slug) m.set(p.slug, p);
  return m;
};

const collectionSize = (v) => {
  if (Array.isArray(v)) return v.length;
  if (v && typeof v === 'object') return Object.values(v).reduce((s, x) => s + (Array.isArray(x) ? x.length : 1), 0);
  return v == null ? 0 : 1;
};

const short = (v) => {
  const s = typeof v === 'string' ? v : JSON.stringify(v ?? null);
  if (s == null) return 'null';
  return s.length > 70 ? s.slice(0, 67) + '…' : s;
};

function diffCard(slug, live, work) {
  const d = {
    slug,
    name: work.name ?? live.name ?? slug,
    country: work.country ?? live.country ?? null,
    programsAdded: [], programsRemoved: [], programsChanged: [],
    feesAdded: [], feesChanged: [], feesRemoved: [],
    currencyChange: null,
    fieldChanges: [], collectionChanges: [],
    marks: { 'catalog-only': 0, 'source-added': 0 },
    newFields: { tuitionBasis: 0, tuitionCurrency: 0, tuitionVariants: 0 },
  };

  const lp = programMap(live);
  const wp = programMap(work);
  for (const [s, p] of wp) {
    if (!lp.has(s)) {
      d.programsAdded.push({ slug: s, title: p.title, level: p.level, kompasStatus: p.kompasStatus ?? null });
      continue;
    }
    const o = lp.get(s);
    const keys = new Set([...Object.keys(o), ...Object.keys(p)]);
    const changed = [];
    for (const k of keys) if (!eq(o[k], p[k])) changed.push(k);
    if (changed.length) {
      d.programsChanged.push({
        slug: s, title: p.title, keys: changed,
        // «до/после» показываем только для коротких значений: длинные списки
        // вариантов стоимости в markdown нечитаемы, они есть в json.
        sample: Object.fromEntries(changed.filter((k) => PROGRAM_KEYS.has(k)).slice(0, 4)
          .map((k) => [k, [short(o[k]), short(p[k])]])),
      });
    }
  }
  for (const [s, p] of lp) if (!wp.has(s)) d.programsRemoved.push({ slug: s, title: p.title, level: p.level });

  // Метки и попрограммные поля цен — считаем по рабочей копии: это и есть
  // содержимое переноса.
  for (const p of wp.values()) {
    if (p.kompasStatus && d.marks[p.kompasStatus] != null) d.marks[p.kompasStatus]++;
    if (p.tuitionBasis) d.newFields.tuitionBasis++;
    if (p.tuitionCurrency) d.newFields.tuitionCurrency++;
    if (p.tuitionVariants) d.newFields.tuitionVariants++;
  }

  const lf = live.tuition?.byProgram ?? {};
  const wf = work.tuition?.byProgram ?? {};
  for (const [s, v] of Object.entries(wf)) {
    if (!(s in lf)) d.feesAdded.push({ slug: s, to: v, orphan: !wp.has(s) });
    else if (lf[s] !== v) d.feesChanged.push({ slug: s, from: lf[s], to: v, delta: v - lf[s] });
  }
  for (const [s, v] of Object.entries(lf)) if (!(s in wf)) d.feesRemoved.push({ slug: s, from: v, programGone: !wp.has(s) });

  const lc = live.tuition?.currency ?? null;
  const wc = work.tuition?.currency ?? null;
  if (lc !== wc) d.currencyChange = { from: lc, to: wc };

  // Скалярные поля карточки.
  const skip = new Set(['programs', 'tuition', ...COLLECTIONS]);
  const keys = new Set([...Object.keys(live), ...Object.keys(work)].filter((k) => !skip.has(k)));
  for (const k of keys) if (!eq(live[k], work[k])) d.fieldChanges.push({ key: k, from: short(live[k]), to: short(work[k]) });
  for (const k of COLLECTIONS) if (!eq(live[k], work[k])) {
    d.collectionChanges.push({ key: k, from: collectionSize(live[k]), to: collectionSize(work[k]) });
  }

  // Вес — для сортировки «где крупнее». Потери весят втрое: они необратимы.
  d.weight = d.programsAdded.length + d.programsRemoved.length * 3 + d.programsChanged.length
    + d.feesAdded.length + d.feesRemoved.length * 3 + d.feesChanged.length
    + d.fieldChanges.length + d.collectionChanges.length + (d.currencyChange ? 5 : 0);
  return d;
}

async function main() {
  const live = await readDir(LIVE_DIR);
  const work = await readDir(WORK_DIR);

  const newCards = [...work.keys()].filter((s) => !live.has(s)).sort();
  const goneCards = [...live.keys()].filter((s) => !work.has(s)).sort();
  const common = [...work.keys()].filter((s) => live.has(s)).sort();

  const diffs = [];
  for (const s of common) {
    const d = diffCard(s, live.get(s), work.get(s));
    if (d.weight) diffs.push(d);
  }

  const countPrograms = (m) => [...m.values()].reduce((s, c) => s + (c.programs?.length ?? 0), 0);
  const countFees = (m) => [...m.values()].reduce((s, c) => s + Object.keys(c.tuition?.byProgram ?? {}).length, 0);
  const countList = (m, k) => [...m.values()].reduce((s, c) => s + (c[k]?.length ?? 0), 0);
  const countMark = (m, mark) => [...m.values()].reduce((s, c) => s + (c.programs ?? []).filter((p) => p.kompasStatus === mark).length, 0);
  const countField = (m, key, only) => [...m.values()]
    .filter((c) => !only || only.has(c.slug ?? ''))
    .reduce((s, c) => s + (c.programs ?? []).filter((p) => p[key] != null).length, 0);

  const newCardsPrograms = newCards.reduce((s, x) => s + (work.get(x).programs?.length ?? 0), 0);
  const newCardsFees = newCards.reduce((s, x) => s + Object.keys(work.get(x).tuition?.byProgram ?? {}).length, 0);
  const goneCardsPrograms = goneCards.reduce((s, x) => s + (live.get(x).programs?.length ?? 0), 0);

  const sum = (f) => diffs.reduce((s, d) => s + f(d), 0);
  const totals = {
    cards: { live: live.size, work: work.size, new: newCards.length, gone: goneCards.length, changed: diffs.length },
    programs: {
      live: countPrograms(live), work: countPrograms(work),
      addedInCommon: sum((d) => d.programsAdded.length),
      addedWithNewCards: newCardsPrograms,
      removedInCommon: sum((d) => d.programsRemoved.length),
      removedWithGoneCards: goneCardsPrograms,
      changed: sum((d) => d.programsChanged.length),
    },
    fees: {
      live: countFees(live), work: countFees(work),
      addedInCommon: sum((d) => d.feesAdded.length),
      addedWithNewCards: newCardsFees,
      changed: sum((d) => d.feesChanged.length),
      removedInCommon: sum((d) => d.feesRemoved.length),
      currencyChanges: diffs.filter((d) => d.currencyChange).length,
    },
    marks: {
      catalogOnlyLive: countMark(live, 'catalog-only'),
      catalogOnlyWork: countMark(work, 'catalog-only'),
      sourceAddedLive: countMark(live, 'source-added'),
      sourceAddedWork: countMark(work, 'source-added'),
    },
    newFields: {
      tuitionBasis: countField(work, 'tuitionBasis'),
      tuitionCurrency: countField(work, 'tuitionCurrency'),
      tuitionVariants: countField(work, 'tuitionVariants'),
      tuitionBasisLive: countField(live, 'tuitionBasis'),
      tuitionCurrencyLive: countField(live, 'tuitionCurrency'),
      tuitionVariantsLive: countField(live, 'tuitionVariants'),
    },
    campuses: { live: countList(live, 'campuses'), work: countList(work, 'campuses') },
    scholarships: { live: countList(live, 'scholarships'), work: countList(work, 'scholarships') },
    fieldChanges: sum((d) => d.fieldChanges.length),
    collectionChanges: sum((d) => d.collectionChanges.length),
  };

  // Разряды изменений: по какому полю расходится.
  const keyTally = {};
  for (const d of diffs) for (const pr of d.programsChanged) for (const k of pr.keys) keyTally[k] = (keyTally[k] || 0) + 1;
  const fieldTally = {};
  for (const d of diffs) for (const f of d.fieldChanges) fieldTally[f.key] = (fieldTally[f.key] || 0) + 1;
  for (const d of diffs) for (const c of d.collectionChanges) fieldTally[c.key] = (fieldTally[c.key] || 0) + 1;

  // Опасная половина: всё, что из живого каталога уйдёт или переменится необратимо.
  const risky = {
    cardsLosingPrograms: diffs.filter((d) => d.programsRemoved.length).sort((a, b) => b.programsRemoved.length - a.programsRemoved.length),
    cardsLosingFees: diffs.filter((d) => d.feesRemoved.length).sort((a, b) => b.feesRemoved.length - a.feesRemoved.length),
    currencyChanges: diffs.filter((d) => d.currencyChange),
    feesDropped: diffs.flatMap((d) => d.feesChanged.filter((f) => f.delta < 0).map((f) => ({ card: d.slug, ...f }))).sort((a, b) => a.delta - b.delta),
    feesRaised: diffs.flatMap((d) => d.feesChanged.filter((f) => f.delta > 0).map((f) => ({ card: d.slug, ...f }))).sort((a, b) => b.delta - a.delta),
    orphanFees: diffs.flatMap((d) => d.feesAdded.filter((f) => f.orphan).map((f) => ({ card: d.slug, ...f }))),
    titleChanges: diffs.flatMap((d) => d.programsChanged.filter((pr) => pr.keys.includes('title')).map((pr) => ({ card: d.slug, ...pr }))),
    levelChanges: diffs.flatMap((d) => d.programsChanged.filter((pr) => pr.keys.includes('level')).map((pr) => ({ card: d.slug, ...pr }))),
  };

  await fs.writeFile(OUT_JSON, JSON.stringify({
    generatedAt: new Date().toISOString(),
    direction: 'catalog-work → site/src/content/universities',
    totals, keyTally, fieldTally, newCards, goneCards,
    riskySummary: {
      cardsLosingPrograms: risky.cardsLosingPrograms.length,
      programsLost: totals.programs.removedInCommon,
      cardsLosingFees: risky.cardsLosingFees.length,
      feesLost: totals.fees.removedInCommon,
      currencyChanges: risky.currencyChanges.length,
      feesDropped: risky.feesDropped.length,
      feesRaised: risky.feesRaised.length,
      orphanFees: risky.orphanFees.length,
      titleChanges: risky.titleChanges.length,
      levelChanges: risky.levelChanges.length,
    },
    risky,
    cards: diffs.sort((a, b) => b.weight - a.weight),
  }, null, 2) + '\n', 'utf8');

  const md = [];
  const p = (...s) => md.push(...s);
  p('# Что изменится в живом каталоге после применения рабочей копии (3.1)', '');
  p('Сверка только читает. Направление: `sources/kompas/catalog-work` → `site/src/content/universities`.');
  p('Снято ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC, скрипт `scraper/kompas-workcopy-diff.mjs`.', '');

  p('## Итог', '');
  p('| | Живой каталог | Рабочая копия | Разница |', '|---|---:|---:|---:|');
  const row = (t, a, b) => p('| ' + t + ' | ' + n(a) + ' | ' + n(b) + ' | ' + (b - a >= 0 ? '+' : '') + n(b - a) + ' |');
  row('Карточек', totals.cards.live, totals.cards.work);
  row('Программ', totals.programs.live, totals.programs.work);
  row('Цен (tuition.byProgram)', totals.fees.live, totals.fees.work);
  row('Кампусов', totals.campuses.live, totals.campuses.work);
  row('Стипендий', totals.scholarships.live, totals.scholarships.work);
  p('');
  p('Карточек затронуто: **' + n(totals.cards.new) + ' новых** и **' + n(totals.cards.changed)
    + ' изменённых** из ' + n(totals.cards.live) + ' существующих.');
  if (totals.cards.gone) {
    p('Карточек есть в живом каталоге и НЕТ в рабочей копии: **' + n(totals.cards.gone)
      + '** (' + n(goneCardsPrograms) + ' программ). Перенос их не тронет — разбирать отдельно.');
  }
  p('');

  p('## Программы', '');
  p('| Что | Сколько |', '|---|---:|');
  p('| Заведётся новых карточек | ' + n(totals.cards.new) + ' |');
  p('| Программ придёт с новыми карточками | ' + n(totals.programs.addedWithNewCards) + ' |');
  p('| Программ добавится в существующие карточки | ' + n(totals.programs.addedInCommon) + ' |');
  p('| Программ изменится | ' + n(totals.programs.changed) + ' |');
  p('| Программ ИСЧЕЗНЕТ из существующих карточек | ' + n(totals.programs.removedInCommon) + ' |');
  p('');
  p('Изменения программ по полям:', '');
  p('| Поле | Программ |', '|---|---:|');
  for (const [k, v] of Object.entries(keyTally).sort((a, b) => b[1] - a[1])) p('| `' + k + '` | ' + n(v) + ' |');
  p('');

  p('## Цены', '');
  p('| Что | Сколько |', '|---|---:|');
  p('| Цен придёт с новыми карточками | ' + n(totals.fees.addedWithNewCards) + ' |');
  p('| Цен добавится в существующие карточки | ' + n(totals.fees.addedInCommon) + ' |');
  p('| Цен изменится | ' + n(totals.fees.changed) + ' |');
  p('| — из них вниз | ' + n(risky.feesDropped.length) + ' |');
  p('| — из них вверх | ' + n(risky.feesRaised.length) + ' |');
  p('| Цен ИСЧЕЗНЕТ | ' + n(totals.fees.removedInCommon) + ' |');
  p('| Карточек сменят валюту | ' + n(totals.fees.currencyChanges) + ' |');
  p('');
  p('Попрограммные признаки цены (в живом каталоге их почти нет):', '');
  p('| Признак | В живом каталоге | В рабочей копии |', '|---|---:|---:|');
  p('| `tuitionBasis` (основа цены) | ' + n(totals.newFields.tuitionBasisLive) + ' | ' + n(totals.newFields.tuitionBasis) + ' |');
  p('| `tuitionCurrency` (валюта программы) | ' + n(totals.newFields.tuitionCurrencyLive) + ' | ' + n(totals.newFields.tuitionCurrency) + ' |');
  p('| `tuitionVariants` (варианты стоимости) | ' + n(totals.newFields.tuitionVariantsLive) + ' | ' + n(totals.newFields.tuitionVariants) + ' |');
  p('');

  p('## Метки КОМПАСа', '');
  p('| Метка | В живом каталоге | В рабочей копии |', '|---|---:|---:|');
  p('| `catalog-only` | ' + n(totals.marks.catalogOnlyLive) + ' | ' + n(totals.marks.catalogOnlyWork) + ' |');
  p('| `source-added` | ' + n(totals.marks.sourceAddedLive) + ' | ' + n(totals.marks.sourceAddedWork) + ' |');
  p('');

  p('## Опасная половина', '');
  p('То, что из живого каталога уйдёт или переменится необратимо. Здесь и решается, можно ли применять сплошь.', '');
  p('| Разряд | Карточек | Записей |', '|---|---:|---:|');
  p('| Карточки теряют программы | ' + n(risky.cardsLosingPrograms.length) + ' | ' + n(totals.programs.removedInCommon) + ' |');
  p('| Карточки теряют цены | ' + n(risky.cardsLosingFees.length) + ' | ' + n(totals.fees.removedInCommon) + ' |');
  p('| Смена валюты карточки | ' + n(risky.currencyChanges.length) + ' | — |');
  p('| Цена уменьшилась | — | ' + n(risky.feesDropped.length) + ' |');
  p('| Название программы переписано | — | ' + n(risky.titleChanges.length) + ' |');
  p('| Уровень программы переписан | — | ' + n(risky.levelChanges.length) + ' |');
  p('| Цена без программы (осиротевшая) | — | ' + n(risky.orphanFees.length) + ' |');
  p('');
  if (risky.cardsLosingPrograms.length) {
    p('Кто теряет больше всех программ:', '');
    p('| Карточка | Теряет | Останется | Пример |', '|---|---:|---:|---|');
    for (const d of risky.cardsLosingPrograms.slice(0, TOP)) {
      const left = (work.get(d.slug).programs ?? []).length;
      p('| `' + d.slug + '` | ' + n(d.programsRemoved.length) + ' | ' + n(left) + ' | '
        + String(d.programsRemoved[0]?.title ?? '').slice(0, 50) + ' |');
    }
    p('');
  }
  if (risky.currencyChanges.length) {
    p('Смена валюты карточки:', '');
    p('| Карточка | Было | Станет |', '|---|---|---|');
    for (const d of risky.currencyChanges.slice(0, TOP)) {
      p('| `' + d.slug + '` | ' + (d.currencyChange.from ?? '—') + ' | ' + (d.currencyChange.to ?? '—') + ' |');
    }
    p('');
  }
  if (risky.feesDropped.length) {
    p('Самые крупные снижения цены:', '');
    p('| Карточка | Программа | Было | Станет |', '|---|---|---:|---:|');
    for (const f of risky.feesDropped.slice(0, TOP)) {
      p('| `' + f.card + '` | `' + f.slug + '` | ' + n(f.from) + ' | ' + n(f.to) + ' |');
    }
    p('');
  }

  p('## Поля карточки', '');
  p('| Поле | Карточек |', '|---|---:|');
  for (const [k, v] of Object.entries(fieldTally).sort((a, b) => b[1] - a[1])) p('| `' + k + '` | ' + n(v) + ' |');
  p('');

  p('## ' + TOP + ' самых крупных изменений', '');
  p('| Карточка | +прогр | −прогр | ~прогр | +цен | ~цен | −цен | поля |', '|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const d of diffs.slice(0, TOP)) {
    p('| `' + d.slug + '` | ' + n(d.programsAdded.length) + ' | ' + n(d.programsRemoved.length) + ' | '
      + n(d.programsChanged.length) + ' | ' + n(d.feesAdded.length) + ' | ' + n(d.feesChanged.length) + ' | '
      + n(d.feesRemoved.length) + ' | ' + n(d.fieldChanges.length + d.collectionChanges.length) + ' |');
  }
  p('');
  p('Новых карточек: ' + n(newCards.length) + (newCards.length ? ' — ' + newCards.slice(0, 40).join(', ') + (newCards.length > 40 ? ', …' : '') : ''), '');
  p('Построчно — `sources/kompas/workcopy-diff.json`.', '');
  await fs.writeFile(OUT_MD, md.join('\n'), 'utf8');

  console.log('карточек: живой ' + live.size + ', копия ' + work.size + ', новых ' + newCards.length
    + ', изменённых ' + diffs.length + ', только в живом ' + goneCards.length);
  console.log('программ: ' + countPrograms(live) + ' → ' + countPrograms(work)
    + '; цен: ' + countFees(live) + ' → ' + countFees(work));
  console.log('ИСЧЕЗНЕТ: программ ' + totals.programs.removedInCommon + ', цен ' + totals.fees.removedInCommon);
  console.log('отчёты: ' + path.relative(ROOT, OUT_MD) + ', ' + path.relative(ROOT, OUT_JSON));
}

await main();
