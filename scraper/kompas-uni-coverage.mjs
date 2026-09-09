#!/usr/bin/env node
// Сверка состава вузов: кто перечислен у агрегатора против того, что есть
// в рабочей копии каталога. Ответ на вопрос «все ли университеты с сайтов
// агрегаторов у нас заведены» (проверка перед задачей 3.1).
//
// Сети не трогает и ничего не пишет в каталог. Источник правды о составе —
// опись членства sources/kompas/membership/<агрегатор>.json: это снимок списка
// учреждений, снятый коллектором с портала агрегатора. У снимка своя дата,
// она в отчёте — состав на сайте с тех пор мог измениться.
//
// Привязку НЕ берём на веру из описи: она снята до заведения 65 карточек
// (20.08 и 23.08). Каждое учреждение перематчивается на ТЕКУЩУЮ рабочую копию
// общим модулем lib/kompas-catalog-match.mjs — тем же, которым работают коллекторы.
//
// Запуск: node scraper/kompas-uni-coverage.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { matchToCatalog, norm, stripGeneric } from './lib/kompas-catalog-match.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORK = path.join(ROOT, 'sources/kompas/catalog-work');
const MEM = path.join(ROOT, 'sources/kompas/membership');
const EX = path.join(ROOT, 'sources/kompas/extracts');
const OUT_JSON = path.join(ROOT, 'sources/kompas/uni-coverage.json');
const OUT_MD = path.join(ROOT, 'sources/kompas/UNI-COVERAGE.md');

// индекс рабочей копии в том виде, какого ждёт matchToCatalog
const catalog = [];
const haveCard = new Set();
for (const f of fs.readdirSync(WORK)) {
  if (!f.endsWith('.json')) continue;
  const c = JSON.parse(fs.readFileSync(path.join(WORK, f), 'utf8'));
  const slug = c.slug || f.replace(/\.json$/, '');
  haveCard.add(slug);
  catalog.push({ slug, name: c.name || '', country: c.country || null,
    exact: norm(c.name), core: stripGeneric(c.name) });
}

// Имена в карточке часто написаны иначе, чем у агрегатора: «University College London (UCL)»
// против «University College London». Скобочный хвост ломает и точное имя, и имя без родовых
// слов, и вуз выглядит незаведённым, хотя карточка есть. Индексируем карточку по всем
// написаниям её имени: как есть, без скобочного хвоста и по тому, что внутри скобок.
const noParens = (s) => String(s || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
const inParens = (s) => (String(s || '').match(/\(([^)]{2,})\)/) || [])[1] || '';
const nameIndex = new Map();
const addName = (key, slug) => {
  if (!key) return;
  if (!nameIndex.has(key)) nameIndex.set(key, new Set());
  nameIndex.get(key).add(slug);
};
for (const c of catalog) {
  for (const variant of [c.name, noParens(c.name), inParens(c.name)]) {
    addName(norm(variant), c.slug);
    addName(stripGeneric(variant), c.slug);
  }
}
/** Слаги карточек под любое написание имени. */
const cardsByName = (name) => {
  const out = new Set();
  for (const variant of [name, noParens(name), inParens(name)]) {
    for (const key of [norm(variant), stripGeneric(variant)]) {
      for (const slug of (nameIndex.get(key) || [])) out.add(slug);
    }
  }
  return [...out];
};

const readMem = (f) => {
  const p = path.join(MEM, f);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
};

/** Список учреждений, перечисленных агрегатором. Форма описи у каждого своя. */
function institutionsOf(src) {
  const m = readMem(src + '.json');
  if (!m) return null;
  const meta = m._meta || {};
  const at = meta.collectedAt || m.generatedAt || null;
  const rows = [];
  const push = (name, o = {}) => { if (name) rows.push({ name, ...o }); };

  if (src === 'qs') {
    for (const i of m.institutions) push(i.name, { ref: i.slug, country: i.country, courses: i.programs, said: i.catalogSlug, url: i.url });
  } else if (src === 'edvoy') {
    for (const i of m.matched) push(i.from, { ref: i.edpRefId, courses: i.courses, said: i.to });
    for (const i of m.unmatched) push(i.from, { ref: i.edpRefId, country: i.country, courses: i.courses, said: null });
    // вуз без курсов у источника — заводить его в каталог не с чем, но в составе он есть
    for (const i of m.emptyUnis) push(i.from, { ref: i.edpRefId, courses: 0, said: null, noPrograms: true });
  } else if (src === 'studygroup') {
    for (const i of m.matched) push(i.from, { courses: i.courses, said: i.to });
    for (const i of (m.unmatched || [])) push(i.from ?? i, { said: null });
    for (const i of (m.skippedNotUniversity || [])) push(i.from, { courses: i.courses, said: null, notAUni: true, why: i.reason });
  } else if (src === 'oxford-international') {
    for (const i of m.partners) push(i.name, { ref: i.slug, courses: i.courses, url: i.url });
  } else if (src === 'qahe') {
    for (const i of m.ownerList) push(i.name, { ref: i.key, said: i.catalogSlug });
  } else if (src === 'navitas') {
    for (const i of m.colleges) push(i.derivedUniversityName || i.college, { url: i.collegeUrl, country: i.collegeCountry, said: i.catalogSlug });
    for (const i of (m.noCardInCatalog || [])) push(i.college, { url: i.url, said: null, notAUni: true, why: i.why });
  } else if (src === 'iapro') {
    for (const i of m.marketingHub.partners) push(i.name, { said: i.catalog && i.catalog.slug });
    for (const i of m.contractHubOnly.institutions) push(i.name, { said: i.catalog && i.catalog.slug, contractOnly: true });
  } else if (src === 'cats') {
    for (const i of m.schools) push(i.name, { ref: i.slug, url: i.url, said: i.coveredByCollector ? i.collectorSlug : null });
  }
  return { at, meta, rows };
}

// Слаги, к которым привязаны выгрузки: вуз мог получить карточку уже после описи.
const linkedByExtract = new Map();
for (const src of fs.readdirSync(EX)) {
  const dir = path.join(EX, src);
  if (!fs.statSync(dir).isDirectory()) continue;
  const map = new Map();
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const slug = d.catalogSlug || d.slug;
    if (d.name) map.set(norm(d.name), slug);
    if (d.slug) map.set(norm(d.slug), slug);
  }
  linkedByExtract.set(src, map);
}

const SOURCES = ['qs', 'edvoy', 'kaplan', 'studygroup', 'oxford-international', 'iapro', 'qahe', 'navitas', 'cats'];
const report = {};
const missingAll = [];

for (const src of SOURCES) {
  const inst = institutionsOf(src);
  if (!inst) {
    // у kaplan описи членства нет: список партнёров агрегатора не снимался
    const dir = path.join(EX, src);
    const n = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')).length : 0;
    report[src] = { membershipSnapshot: null, listed: null, extracts: n,
      note: 'описи членства нет: список партнёров агрегатора не снимался, состав сверять не с чем' };
    continue;
  }
  const st = { membershipSnapshot: inst.at, listed: inst.rows.length,
    withCard: 0, dupCards: 0, missing: 0, notAUni: 0, noPrograms: 0,
    bySaidSlug: 0, byExtract: 0, byRematch: 0 };
  const missing = [];
  const dups = [];
  const exMap = linkedByExtract.get(src) || new Map();

  for (const r of inst.rows) {
    if (r.notAUni) { st.notAUni++; continue; }
    if (r.said && haveCard.has(r.said)) { st.withCard++; st.bySaidSlug++; continue; }
    const viaExtract = exMap.get(norm(r.name)) || (r.ref ? exMap.get(norm(r.ref)) : null);
    if (viaExtract && haveCard.has(viaExtract)) { st.withCard++; st.byExtract++; continue; }
    const hit = matchToCatalog(r.name, catalog, { url: r.url || null, country: r.country || null, refId: r.ref || null });
    if (hit.catalogSlug && haveCard.has(hit.catalogSlug)) { st.withCard++; st.byRematch++; continue; }
    // Матчер отказывается выбирать, когда под имя подходит больше одной карточки
    // (`ambiguous-core-name`), и такой вуз выглядит отсутствующим. На деле карточек
    // не ноль, а две: у части вузов рядом с основной лежит близнец `...-direct-entry`.
    // Это не дыра состава, а дубли каталога — разряд свой.
    const twins = cardsByName(r.name);
    if (twins.length === 1) { st.withCard++; st.byRematch++; continue; }
    if (twins.length) {
      st.dupCards++;
      dups.push({ source: src, name: r.name, courses: r.courses ?? null, cards: twins });
      continue;
    }
    st.missing++;
    if (r.noPrograms) st.noPrograms++;
    const row = { source: src, name: r.name, ref: r.ref || null, country: r.country || null,
      courses: r.courses ?? null, noPrograms: !!r.noPrograms };
    missing.push(row);
    missingAll.push(row);
  }
  missing.sort((a, b) => (b.courses ?? 0) - (a.courses ?? 0));
  dups.sort((a, b) => (b.courses ?? 0) - (a.courses ?? 0));
  report[src] = { ...st, missingList: missing, dupList: dups };
}

fs.writeFileSync(OUT_JSON, JSON.stringify({ report, missingAll }, null, 1));

const pct = (a, b) => (b ? (a / b * 100).toFixed(1) + ' %' : '—');
let md = '# Состав вузов: агрегаторы против рабочей копии\n\n';
md += 'Сверка без сети. Состав агрегатора берётся из описи членства `sources/kompas/membership/`,\n';
md += 'привязка пересчитывается на ТЕКУЩУЮ рабочую копию, а не берётся из описи.\n\n';
md += '| Агрегатор | Снимок описи | Перечислено | Карточка есть | Карточек несколько | Нет карточки | Не вуз (решено) |\n|---|---|---:|---:|---:|---:|---:|\n';
for (const [src, s] of Object.entries(report)) {
  if (s.listed == null) { md += '| ' + src + ' | — | опись не снималась | | | | |\n'; continue; }
  md += '| ' + src + ' | ' + String(s.membershipSnapshot || '—').slice(0, 10) + ' | ' + s.listed
    + ' | ' + s.withCard + ' (' + pct(s.withCard, s.listed - s.notAUni) + ') | ' + s.dupCards
    + ' | ' + s.missing + ' | ' + s.notAUni + ' |\n';
}
md += '\n## Кого нет в рабочей копии\n\n';
for (const [src, s] of Object.entries(report)) {
  if (!s.missingList || !s.missingList.length) continue;
  md += '\n### ' + src + ' — ' + s.missing + '\n\n| Вуз | Страна | Программ у источника |\n|---|---|---:|\n';
  for (const r of s.missingList) {
    md += '| ' + r.name + ' | ' + (r.country || '—') + ' | ' + (r.noPrograms ? 'программ нет' : (r.courses ?? '—')) + ' |\n';
  }
}
md += '\n## Где карточек несколько на один вуз источника\n\n';
for (const [src, s] of Object.entries(report)) {
  if (!s.dupList || !s.dupList.length) continue;
  md += '\n### ' + src + ' — ' + s.dupCards + '\n\n| Вуз у источника | Карточки | Программ у источника |\n|---|---|---:|\n';
  for (const r of s.dupList) md += '| ' + r.name + ' | `' + r.cards.join('`, `') + '` | ' + (r.courses ?? '—') + ' |\n';
}
md += '\nПострочно: `uni-coverage.json`.\n';
fs.writeFileSync(OUT_MD, md);

for (const [src, s] of Object.entries(report)) {
  if (s.listed == null) { console.log(src.padEnd(22), 'описи нет, выгрузок', s.extracts); continue; }
  console.log(src.padEnd(22), 'перечислено', String(s.listed).padStart(4),
    '| карточка есть', String(s.withCard).padStart(4),
    '| карточек несколько', String(s.dupCards).padStart(3),
    '| нет', String(s.missing).padStart(4),
    '| не вуз', s.notAUni);
}
console.log('ИТОГО без карточки:', missingAll.length);
