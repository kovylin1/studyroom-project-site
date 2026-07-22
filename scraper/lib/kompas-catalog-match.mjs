// kompas-catalog-match.mjs — сопоставление имени вуза с каталогом (КОМПАС).
//
// Общая часть для всех коллекторов сессии 2. Выделена из kompas-collect-navitas.mjs после того,
// как выяснилось: выгрузки называются слагом АГРЕГАТОРА («bangor-university», «northumbria-university»),
// а каталог знает «bangor» и «northumbria». Из-за этого сводка показывала ноль совпадений там,
// где они есть, а сессия 4 не смогла бы сверить карточку с источником.
//
// Порядок как в сессии 1: точный слаг -> точное имя -> имя без родовых слов (university/college/...).
// Плюс сверка по стране: «Griffith College - Brisbane» (домен .edu.au) по имени совпадал с карточкой
// ирландского «Griffith College» в Дублине. Однофамильцы — главный источник тихого брака.

import fs from 'fs/promises';
import path from 'path';
import { CATALOG_DIR } from './kompas-collect.mjs';

export const norm = (s) => (s || '').toLowerCase()
  .normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/&/g, ' and ').replace(/[’'`]/g, '')
  .replace(/\bthe\b/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

export const stripGeneric = (s) => norm(s)
  .replace(/\b(university|universities|college|institute|school)\b/g, ' ')
  .replace(/\s+/g, ' ').trim();

export async function buildCatalogIndex() {
  const files = await fs.readdir(CATALOG_DIR);
  const rows = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    try {
      const c = JSON.parse(await fs.readFile(path.join(CATALOG_DIR, f), 'utf8'));
      const slug = c.slug || f.replace(/\.json$/, '');
      rows.push({ slug, name: c.name || '', country: c.country || null, exact: norm(c.name), core: stripGeneric(c.name) });
    } catch { /* битый файл пропускаем */ }
  }
  return rows;
}

const TLD_COUNTRY = [
  [/\.edu\.au$|\.com\.au$|\.au$/i, 'Australia'],
  [/\.ac\.uk$|\.co\.uk$|\.uk$/i, 'United Kingdom'],
  [/\.ca$/i, 'Canada'],
  [/\.ac\.nz$|\.co\.nz$|\.nz$/i, 'New Zealand'],
  [/\.de$/i, 'Germany'],
  [/\.nl$/i, 'Netherlands'],
  [/\.ac\.lk$|\.lk$/i, 'Sri Lanka'],
  [/\.ac\.id$|\.id$/i, 'Indonesia'],
  [/\.edu\.sg$|\.sg$/i, 'Singapore'],
];

/** Страна по домену. null — если домен её не выдаёт (.com), тогда сверку не делаем. */
export function countryFromUrl(url) {
  let host;
  try { host = new URL(url).host; } catch { return null; }
  for (const [re, country] of TLD_COUNTRY) if (re.test(host)) return country;
  return null;
}

function pick(list, expectedCountry, method) {
  if (!list.length) return null;
  if (expectedCountry) {
    const same = list.filter((c) => c.country === expectedCountry);
    if (same.length === 1) return { slug: same[0].slug, catalogName: same[0].name, method };
    if (same.length > 1) return { slug: null, method: `ambiguous-${method}`, candidates: same.map((c) => c.slug) };
    if (list.length === 1) return { slug: null, method: `country-mismatch-${method}`, rejected: list[0].slug };
    return { slug: null, method: `ambiguous-${method}`, candidates: list.map((c) => c.slug) };
  }
  if (list.length === 1) return { slug: list[0].slug, catalogName: list[0].name, method };
  return { slug: null, method: `ambiguous-${method}`, candidates: list.map((c) => c.slug) };
}

/** Имя вуза -> слаг каталога. expectedCountry необязателен. */
export function resolveCatalogSlug(uniName, catalog, expectedCountry = null) {
  const wantSlug = norm(uniName).replace(/\s+/g, '-');
  const r1 = pick(catalog.filter((c) => c.slug === wantSlug), expectedCountry, 'exact-slug');
  if (r1?.slug) return r1;

  const wantExact = norm(uniName);
  const r2 = pick(catalog.filter((c) => c.exact === wantExact), expectedCountry, 'exact-name');
  if (r2?.slug) return r2;

  const wantCore = stripGeneric(uniName);
  if (wantCore.length >= 5) {
    const r3 = pick(catalog.filter((c) => c.core === wantCore), expectedCountry, 'core-name');
    if (r3) return r3;
  }
  return r2 || r1 || { slug: null, method: 'no-match' };
}

/**
 * Кандидаты в имя вуза для агрегаторских названий вида
 * «Anglia Ruskin University College», «International College of Manitoba»,
 * «Charles Sturt University Melbourne», «The College, Swansea University».
 */
const NETWORK_SUFFIXES = [
  /\s+Global Student Success Program$/i,
  /\s+International Study Centre$/i,
  /\s+Pathway College$/i,
  /\s+International College$/i,
  /\s+University College$/i,
  /\s+English Centre$/i,
  /\s+College Australia$/i,
  /\s+College$/i,
];

const CAMPUS_TAIL = new RegExp(
  '\\s+(?:' + [
    'City Campus', 'Campus', 'Online', 'Sydney', 'Melbourne', 'Perth', 'Brisbane', 'Adelaide',
    'Gold Coast', 'Byron Bay', 'Geelong', 'Canberra', 'Auckland', 'Calgary', 'Vancouver',
    'Toronto', 'Chicago', 'Atlanta', 'Nashville', 'Miami', 'NYC', 'New York',
    'Berlin', 'Heidelberg', 'Munich', 'Leipzig', 'Singapore', 'Dubai', 'Bandung', 'London',
  ].join('|') + ')+$', 'i',
);

export function universityNameCandidates(rawName) {
  const out = [];
  const push = (name, how) => {
    const v = (name || '').replace(/\s+/g, ' ').trim();
    if (v.length >= 3 && !out.some((o) => o.name.toLowerCase() === v.toLowerCase())) out.push({ name: v, how });
  };

  const commaTail = rawName.match(/,\s*(.+)$/);
  if (commaTail) push(commaTail[1], 'after-comma');

  const base = rawName.split(/\s+[|]\s+/)[0]
    .replace(/\s+[-–—]\s+[A-Za-z .'()]+$/, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim();
  push(base, 'as-is');

  const prefixed = base.replace(/^International College(?:\s+of)?\s+/i, '');
  if (prefixed !== base) push(prefixed, 'strip-prefix-international-college');

  for (const src of [base, prefixed]) {
    for (const re of NETWORK_SUFFIXES) {
      if (re.test(src)) { push(src.replace(re, ''), 'strip-suffix'); break; }
    }
  }

  for (const c of [...out]) {
    const cut = c.name.replace(CAMPUS_TAIL, '');
    if (cut !== c.name) push(cut, `${c.how}+strip-campus`);
  }

  for (const c of [...out]) {
    const m = c.name.match(/^U([A-Z][a-z]{3,})\b(.*)$/);
    if (m) push(`${m[1]}${m[2]}`, `${c.how}+expand-U-prefix`);
  }

  return out;
}

/** Полный разбор: перебор кандидатов имени + сверка страны. Возвращает hit и след попыток. */
export function matchToCatalog(rawName, catalog, { url = null, country = null } = {}) {
  const expected = country || (url ? countryFromUrl(url) : null);
  const tried = [];
  for (const cand of universityNameCandidates(rawName)) {
    const res = resolveCatalogSlug(cand.name, catalog, expected);
    tried.push(`${cand.how}:${cand.name}=${res.method}`);
    if (res.slug) return { catalogSlug: res.slug, catalogName: res.catalogName, matchMethod: `${cand.how}/${res.method}`, tried, expectedCountry: expected };
  }
  return { catalogSlug: null, catalogName: null, matchMethod: 'no-match', tried, expectedCountry: expected };
}
