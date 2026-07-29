// kompas-diff-core.mjs — общее ядро замера «карточка каталога vs её источник».
//
// Вынесено из kompas-diff.mjs (сессия 5), чтобы скрипты P0.4/P1/P2 работали на
// ТОЧНО тех же сопоставлениях, что и замер, а не на капнутых кейсах diff-review.
// kompas-diff.mjs остаётся тонкой обёрткой: грузит источники этим модулем,
// прогоняет diffUniversity по каждому вузу и раскладывает результат в отчёт/кейсы.
//
// Сети здесь нет. Каталог не трогается — только чтение.

import fs from 'node:fs/promises';
import path from 'node:path';
import { KOMPAS_DIR } from './kompas-collect.mjs';
import { normProgram, normCatalogProgram, similarity, isSubsetPair, SIM_THRESHOLD } from './kompas-normalize.mjs';

const EXTRACTS = path.join(KOMPAS_DIR, 'extracts');
const GEDU_DIR = path.join(KOMPAS_DIR, '..', '..', 'scraper', 'sources', 'gedu-extracts');

export const WORK_DIR = path.join(KOMPAS_DIR, 'catalog-work');

// Состояние источников на 2026-07-23. «blocked» и «empty» — не наш промах разметки,
// а отсутствие данных.
export const SOURCES = {
  kaplan: { dir: path.join(EXTRACTS, 'kaplan'), state: 'ready' },
  'oxford-international': { dir: path.join(EXTRACTS, 'oxford-international'), state: 'ready' },
  qahe: { dir: path.join(EXTRACTS, 'qahe'), state: 'ready' },
  studygroup: { dir: path.join(EXTRACTS, 'studygroup'), state: 'ready' },
  edvoy: { dir: path.join(EXTRACTS, 'edvoy'), state: 'ready' },
  gedu: { dir: GEDU_DIR, state: 'ready' },
  direct: { dir: path.join(EXTRACTS, 'direct'), state: 'ready' },
  iapro: { dir: path.join(EXTRACTS, 'iapro'), state: 'ready' },
  qs: { dir: null, state: 'blocked', why: 'портал QS Apply отклонил учётные данные, программ нет' },
  navitas: { dir: null, state: 'empty', why: 'у сайтов колледжей нет типа записи «курс», сбор не дал программ' },
  cats: { dir: null, state: 'empty', why: 'у CATS школы, а не программы в единой форме' },
};

export const FEE_TOLERANCE = 0.02;   // ниже — округление источника, не расхождение

export const readJson = async (f) => { try { return JSON.parse(await fs.readFile(f, 'utf8')); } catch { return null; } };

// ------------------------------------------------------------------ загрузка --

export async function loadSourceIndex() {
  const index = new Map();   // slug → [{ src, data }]
  const loaded = {};
  for (const [src, cfg] of Object.entries(SOURCES)) {
    if (cfg.state !== 'ready') { loaded[src] = 0; continue; }
    let files = [];
    try { files = (await fs.readdir(cfg.dir)).filter((f) => f.endsWith('.json')); } catch { files = []; }
    let n = 0;
    for (const f of files) {
      const data = await readJson(path.join(cfg.dir, f));
      if (!data) continue;
      const slug = data.catalogSlug ?? data.slug ?? f.replace(/\.json$/, '');
      if (!index.has(slug)) index.set(slug, []);
      index.get(slug).push({ src, data });
      n++;
    }
    loaded[src] = n;
  }
  return { index, loaded };
}

// Объединение программ источников. Дубли внутри объединения схлопываем по
// нормализованному названию, но цену подтягиваем из того источника, где она есть.
export function unionPrograms(entries) {
  const out = [];
  const byNorm = new Map();
  for (const { src, data } of entries) {
    for (const raw of data.programs ?? []) {
      const p = normProgram(raw, src, data.currency);
      if (!p.norm) continue;
      const seen = byNorm.get(p.norm);
      if (!seen) { byNorm.set(p.norm, p); out.push(p); continue; }
      if (!seen.fee && p.fee) seen.fee = p.fee;
      if (!seen.level && p.level) seen.level = p.level;
      if (!seen.duration && p.duration) seen.duration = p.duration;
      seen.via = seen.via === p.via ? seen.via : `${seen.via}+${p.via}`;
    }
  }
  return out;
}

export function unionCampuses(entries) {
  const set = new Set();
  for (const { data } of entries) {
    for (const c of data.campuses ?? []) set.add(typeof c === 'string' ? c : (c.title ?? c.name ?? ''));
    for (const p of data.programs ?? []) for (const c of p.campuses ?? []) set.add(String(c));
    if (data.campus) set.add(String(data.campus));
  }
  set.delete('');
  return [...set];
}

// --------------------------------------------------------------- сопоставление --

// Сначала точные совпадения нормализованных названий, потом жадное сближение
// по Жаккару. Порядок важен: без точного прохода «BA Business» может увести
// к «BA Business Management» и обе программы отчитаются как расхождение.
export function pairPrograms(catalog, source) {
  const pairs = [];
  const srcByNorm = new Map();
  for (const p of source) if (!srcByNorm.has(p.norm)) srcByNorm.set(p.norm, p);

  const usedSrc = new Set();
  const restCat = [];

  for (const c of catalog) {
    const hit = srcByNorm.get(c.norm);
    if (hit && !usedSrc.has(hit)) { pairs.push({ cat: c, src: hit, how: 'exact' }); usedSrc.add(hit); }
    else restCat.push(c);
  }

  const restSrc = source.filter((p) => !usedSrc.has(p));
  for (const c of restCat.slice()) {
    let best = null; let bestScore = 0;
    for (const s of restSrc) {
      if (usedSrc.has(s)) continue;
      if (isSubsetPair(c.title, s.title)) continue;   // специализация, а не другое написание
      const score = similarity(c.title, s.title);
      if (score > bestScore) { bestScore = score; best = s; }
    }
    if (best && bestScore >= SIM_THRESHOLD) {
      pairs.push({ cat: c, src: best, how: 'fuzzy', score: Number(bestScore.toFixed(2)) });
      usedSrc.add(best);
      restCat.splice(restCat.indexOf(c), 1);
    }
  }

  return {
    pairs,
    catalogOnly: restCat,
    sourceOnly: source.filter((p) => !usedSrc.has(p)),
  };
}

// Разбор назначенных источников вуза на ready/blocked/empty и отбор его выгрузок.
export function resolveAssignment(card, slug, map) {
  const ps = card.partnerSource ?? map[slug] ?? { type: 'none', via: [] };
  const assigned = ps.type === 'direct' ? ['direct', ...(ps.via ?? [])] : (ps.via ?? []);
  const ready = assigned.filter((s) => SOURCES[s]?.state === 'ready');
  const blocked = assigned.filter((s) => SOURCES[s]?.state === 'blocked');
  const empty = assigned.filter((s) => SOURCES[s]?.state === 'empty');
  return { ps, assigned, ready, blocked, empty };
}

// Полный замер одного вуза. Возвращает ПОЛНЫЕ массивы (не капнутые) —
// именно этим ядро отличается от старого diff, который сразу резал на кейсы.
export function diffUniversity(card, entries) {
  const catPrograms = (card.programs ?? []).map((p) => normCatalogProgram(p, card));
  const srcPrograms = unionPrograms(entries);
  const { pairs, catalogOnly, sourceOnly } = pairPrograms(catPrograms, srcPrograms);

  const feeMismatch = []; const feeMissingInCatalog = []; const feeCurrency = [];
  for (const { cat, src } of pairs) {
    if (!src.fee) continue;
    if (!cat.fee) { feeMissingInCatalog.push({ program: cat.title, slug: cat.slug, source: src.fee, via: src.via }); continue; }
    if (cat.fee.currency !== src.fee.currency) {
      feeCurrency.push({ program: cat.title, slug: cat.slug, catalog: cat.fee, source: src.fee, via: src.via });
      continue;
    }
    const rel = Math.abs(cat.fee.amount - src.fee.amount) / Math.max(cat.fee.amount, src.fee.amount);
    if (rel > FEE_TOLERANCE) {
      feeMismatch.push({
        program: cat.title, slug: cat.slug,
        catalog: cat.fee.amount, source: src.fee.amount, currency: src.fee.currency,
        basis: src.fee.basis, audience: src.fee.audience, via: src.via,
        rel: Number((rel * 100).toFixed(1)),
      });
    }
  }

  const srcCampuses = unionCampuses(entries);
  const catCampuses = (card.campuses ?? []).map((c) => String(c.title ?? c.sub ?? ''));
  const campusMissing = srcCampuses.filter(
    (s) => !catCampuses.some((c) => similarity(c, s) >= 0.6),
  );

  return {
    catPrograms, srcPrograms, pairs, catalogOnly, sourceOnly,
    feeMismatch, feeMissingInCatalog, feeCurrency,
    srcCampuses, catCampuses, campusMissing,
  };
}
