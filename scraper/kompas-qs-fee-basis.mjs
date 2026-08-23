#!/usr/bin/env node
// Замер основы цены QS: кампусная сумма — это цена за весь срок или годовая?
// Локально, без сети. Читает sources/kompas/extracts/qs/*.json.
// Гипотеза: существует целое N (число лет), при котором
//   yearlyMin * N <= tuition <= yearlyMax * N (с допуском).
// N=1 → годовая сумма; N>=2 → цена за весь срок; иначе — кейс оператору.

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const QS_DIR = path.join(ROOT, 'sources/kompas/extracts/qs');
const OUT_JSON = path.join(ROOT, 'sources/kompas/qs-fee-basis-report.json');
const OUT_MD = path.join(ROOT, 'sources/kompas/QS-FEE-BASIS.md');

const TOL = 0.06;      // допуск 6% на округления и сборы
const MAX_N = 8;

const SYM = [
  ['US$', 'USD'], ['CA$', 'CAD'], ['A$', 'AUD'], ['NZ$', 'NZD'], ['HK$', 'HKD'],
  ['S$', 'SGD'], ['R$', 'BRL'], ['AED', 'AED'], ['SAR', 'SAR'], ['QAR', 'QAR'],
  ['BHD', 'BHD'], ['CHF', 'CHF'], ['SEK', 'SEK'], ['DKK', 'DKK'], ['NOK', 'NOK'],
  ['PLN', 'PLN'], ['CZK', 'CZK'], ['HUF', 'HUF'], ['TRY', 'TRY'], ['RUB', 'RUB'],
  ['CNY', 'CNY'], ['JPY', 'JPY'], ['KRW', 'KRW'], ['THB', 'THB'], ['MYR', 'MYR'],
  ['IDR', 'IDR'], ['ZAR', 'ZAR'], ['INR', 'INR'], ['MXN', 'MXN'], ['CLP', 'CLP'],
  ['€', 'EUR'], ['£', 'GBP'], ['¥', 'JPY'], ['₹', 'INR'], ['₽', 'RUB'], ['$', 'USD'],
];

function parseYearly(s) {
  if (!s || typeof s !== 'string') return null;
  const grab = (label) => {
    const m = s.match(new RegExp(label + ':\\s*([^0-9]*)([0-9.,]+)'));
    if (!m) return null;
    const num = Number(m[2].replace(/,/g, ''));
    return Number.isFinite(num) ? { raw: m[1].trim(), num } : null;
  };
  const max = grab('Max');
  const min = grab('Min');
  if (!max && !min) return null;
  const rawSym = (min || max).raw;
  let cur = null;
  for (const pair of SYM) { if (rawSym.includes(pair[0])) { cur = pair[1]; break; } }
  return {
    min: min ? min.num : null,
    max: max ? max.num : null,
    currency: cur,
    rawSym,
    text: s,
  };
}

// какие целые N укладывают tuition в [min*N, max*N]
function fitYears(tuition, min, max) {
  const lo = (min != null && min > 0) ? min : null;
  const hi = (max != null && max > 0) ? max : null;
  if (lo == null && hi == null) return [];
  const a0 = lo != null ? lo : hi;
  const b0 = hi != null ? hi : lo;
  const fits = [];
  for (let n = 1; n <= MAX_N; n++) {
    if (tuition >= a0 * n * (1 - TOL) && tuition <= b0 * n * (1 + TOL)) fits.push(n);
  }
  return fits;
}

const files = (await fs.readdir(QS_DIR)).filter(f => f.endsWith('.json')).sort();

const records = [];   // одна запись = уникальная пара (файл, валюта+сумма)
const stats = {
  files: files.length,
  filesWithTuition: 0,
  filesNoYearly: 0,
  programsTotal: 0,
  programsWithTuition: 0,
};

for (const f of files) {
  let data;
  try {
    data = JSON.parse(await fs.readFile(path.join(QS_DIR, f), 'utf8'));
  } catch (e) {
    records.push({ file: f, slug: f.replace(/\.json$/, ''), bucket: 'parse-error', programs: 0, levels: [], fitYears: [], note: String(e.message) });
    continue;
  }

  const programs = Array.isArray(data.programs) ? data.programs : [];
  stats.programsTotal += programs.length;
  const yearly = parseYearly(data.yearlyFeesStated);

  // feeBasis campusLevelStated даёт одну сумму на кампус+уровень — группируем по (валюта, сумма)
  const groups = new Map();
  for (const p of programs) {
    const t = (typeof p.tuition === 'number') ? p.tuition : null;
    if (t == null || t <= 0) continue;
    stats.programsWithTuition++;
    const key = (p.currency || '?') + '|' + t;
    if (!groups.has(key)) groups.set(key, { currency: p.currency || null, tuition: t, programs: 0, levels: new Set(), bases: new Set() });
    const g = groups.get(key);
    g.programs++;
    if (p.sourceLevel) g.levels.add(p.sourceLevel);
    if (p.feeBasis) g.bases.add(p.feeBasis);
  }
  if (groups.size) stats.filesWithTuition++;
  if (groups.size && !yearly) stats.filesNoYearly++;

  for (const g of groups.values()) {
    const rec = {
      file: f,
      slug: data.slug || f.replace(/\.json$/, ''),
      catalogSlug: data.catalogSlug || null,
      country: data.country || null,
      name: data.name || null,
      currency: g.currency,
      tuition: g.tuition,
      levels: Array.from(g.levels),
      feeBases: Array.from(g.bases),
      programs: g.programs,
      yearlyMin: yearly ? yearly.min : null,
      yearlyMax: yearly ? yearly.max : null,
      yearlyCurrency: yearly ? yearly.currency : null,
      yearlyText: yearly ? yearly.text : null,
      ratioMin: null,
      ratioMax: null,
      fitYears: [],
      bucket: null,
      note: null,
    };

    if (!yearly || (!yearly.min && !yearly.max)) {
      rec.bucket = 'no-yearly';
      rec.note = 'нет годового диапазона — сравнивать не с чем';
      records.push(rec);
      continue;
    }
    if (rec.currency && yearly.currency && rec.currency !== yearly.currency) {
      rec.bucket = 'currency-mismatch';
      rec.note = 'валюта программы ' + rec.currency + ' не совпадает с валютой диапазона ' + yearly.currency + ' (' + yearly.rawSym + ')';
      records.push(rec);
      continue;
    }

    rec.ratioMin = yearly.min ? Number((g.tuition / yearly.min).toFixed(3)) : null;
    rec.ratioMax = yearly.max ? Number((g.tuition / yearly.max).toFixed(3)) : null;
    const fits = fitYears(g.tuition, yearly.min, yearly.max);
    rec.fitYears = fits;

    // Основной критерий — отношение суммы к ВЕРХУ годового диапазона.
    // Если сумма укладывается в годовой потолок, это годовая сумма, сколько бы
    // целых N ни подошло формально (широкий диапазон вида 9000–30000 даёт ложное N=2).
    const r = (rec.ratioMax != null) ? rec.ratioMax : rec.ratioMin;
    rec.ratio = r;
    if (r == null) {
      rec.bucket = 'no-yearly';
      rec.note = 'нет годового диапазона — сравнивать не с чем';
    } else if (r <= 1.15) {
      rec.bucket = 'annual';
      rec.note = 'сумма в пределах годового потолка (x' + r + ') — это годовая цена';
    } else if (r < 1.8) {
      rec.bucket = 'annual-loose';
      rec.note = 'x' + r + ' от годового потолка — на цену за срок не тянет, диапазон портала занижен';
    } else {
      rec.bucket = 'whole-term';
      rec.impliedYears = fits.length ? fits : [Math.round(r)];
      rec.note = 'x' + r + ' от годового потолка — цена за весь срок, лет ~' + rec.impliedYears.join('/');
    }
    records.push(rec);
  }
}

const BUCKETS = ['annual', 'annual-loose', 'whole-term', 'currency-mismatch', 'no-yearly', 'parse-error'];
const LABEL = {
  'annual': 'годовая сумма (<=1.15 от годового потолка) — подпись «за всю программу» будет ложью',
  'annual-loose': 'серая зона 1.15–1.8 от потолка — на цену за срок не тянет, но диапазон портала врёт; кейс оператору',
  'whole-term': 'цена за весь срок (>=1.8 от годового потолка) — писать как решил владелец',
  'currency-mismatch': 'валюты не совпадают — кейс оператору',
  'no-yearly': 'нет годового диапазона — сравнить не с чем',
  'parse-error': 'файл не разобрался',
};

const summary = {};
for (const b of BUCKETS) summary[b] = { records: 0, programs: 0, universities: new Set() };
for (const r of records) {
  const b = r.bucket || 'parse-error';
  if (!summary[b]) summary[b] = { records: 0, programs: 0, universities: new Set() };
  summary[b].records++;
  summary[b].programs += (r.programs || 0);
  summary[b].universities.add(r.file);
}

const nDist = {};
for (const r of records) {
  if (r.bucket !== 'whole-term') continue;
  const n = (r.impliedYears && r.impliedYears.length) ? r.impliedYears[0] : '?';
  nDist[n] = (nDist[n] || 0) + 1;
}

// N против заявленного уровня — sanity-check (Bachelors ждём 3-4, Masters 1-2)
const nByLevel = {};
for (const r of records) {
  if (!['annual', 'annual-loose', 'whole-term'].includes(r.bucket)) continue;
  const levels = r.levels.length ? r.levels : ['(без уровня)'];
  for (const lv of levels) {
    if (!nByLevel[lv]) nByLevel[lv] = {};
    nByLevel[lv][r.bucket] = (nByLevel[lv][r.bucket] || 0) + 1;
  }
}

const totalRec = records.length;
const totalProg = records.reduce((s, r) => s + (r.programs || 0), 0);

const out = {
  generatedFrom: 'sources/kompas/extracts/qs',
  tolerance: TOL,
  maxYears: MAX_N,
  stats,
  totals: { records: totalRec, programs: totalProg },
  summary: Object.fromEntries(BUCKETS.filter(b => summary[b] && summary[b].records).map(b => [b, {
    label: LABEL[b],
    records: summary[b].records,
    programs: summary[b].programs,
    universities: summary[b].universities.size,
  }])),
  yearsDistribution: nDist,
  yearsByLevel: nByLevel,
  records,
};
await fs.writeFile(OUT_JSON, JSON.stringify(out, null, 2));

// компактная карта для шага применения цен
const BASIS = { 'annual': 'annual', 'whole-term': 'wholeTerm' };
const map = records.map(r => ({
  slug: r.slug,
  catalogSlug: r.catalogSlug,
  currency: r.currency,
  tuition: r.tuition,
  basis: BASIS[r.bucket] || 'review',
  bucket: r.bucket,
  ratio: r.ratio != null ? r.ratio : null,
  years: r.impliedYears || null,
  programs: r.programs,
  levels: r.levels,
}));
await fs.writeFile(path.join(ROOT, 'sources/kompas/qs-fee-basis-map.json'), JSON.stringify(map, null, 2));

const pct = (x, total) => total ? ((x / total) * 100).toFixed(1) + '%' : '—';
let md = '# Основа цены QS — замер\n\n';
md += 'Источник: `sources/kompas/extracts/qs/*.json` (' + stats.files + ' файлов), допуск ±' + (TOL * 100).toFixed(0) + '%.\n';
md += 'Записей (уникальная пара вуз+сумма): **' + totalRec + '**, за ними программ: **' + totalProg + '**.\n\n';
md += 'Метод: подобрать целое N (1..' + MAX_N + '), при котором `yearlyMin*N <= tuition <= yearlyMax*N`.\n\n';
md += '| Разряд | Записей | % | Программ | Вузов | Что значит |\n|---|---:|---:|---:|---:|---|\n';
for (const b of BUCKETS) {
  if (!summary[b] || !summary[b].records) continue;
  md += '| `' + b + '` | ' + summary[b].records + ' | ' + pct(summary[b].records, totalRec) + ' | ' + summary[b].programs + ' | ' + summary[b].universities.size + ' | ' + LABEL[b] + ' |\n';
}
md += '\n## Сколько лет уложилось (разряд whole-term)\n\n| N лет | Записей |\n|---:|---:|\n';
for (const n of Object.keys(nDist).sort((a, b) => a - b)) md += '| ' + n + ' | ' + nDist[n] + ' |\n';

const NS = [1, 2, 3, 4, 5, 6, 7, 8];
md += '\n## N против заявленного уровня (sanity-check)\n\n| Уровень QS | ' + NS.map(n => 'N=' + n).join(' | ') + ' |\n|---|' + '---:|'.repeat(NS.length) + '\n';
for (const lv of Object.keys(nByLevel).sort()) {
  md += '| ' + lv + ' | ' + NS.map(n => nByLevel[lv][n] || '').join(' | ') + ' |\n';
}

const cases = records.filter(r => ['no-fit', 'below-range', 'currency-mismatch', 'ambiguous-incl-1'].includes(r.bucket));
md += '\n## Кейсы оператору (' + cases.length + ')\n\n| Вуз | Страна | Сумма | Годовой диапазон | Программ | Почему |\n|---|---|---:|---|---:|---|\n';
for (const r of cases.slice(0, 150)) {
  md += '| ' + r.slug + ' | ' + (r.country || '—') + ' | ' + r.tuition + ' ' + (r.currency || '') + ' | ' +
    (r.yearlyMin != null ? r.yearlyMin : '—') + '–' + (r.yearlyMax != null ? r.yearlyMax : '—') + ' ' + (r.yearlyCurrency || '') + ' | ' +
    r.programs + ' | ' + r.note + ' |\n';
}
if (cases.length > 150) md += '\n_…ещё ' + (cases.length - 150) + ' — см. `qs-fee-basis-report.json`._\n';

md += '\n## Контроль: Kwantlen\n\n';
const kw = records.filter(r => /kwantlen/i.test(r.slug));
if (!kw.length) md += '- записей не найдено\n';
for (const r of kw) {
  md += '- ' + r.slug + ': ' + r.tuition + ' ' + r.currency + ', диапазон ' + r.yearlyMin + '–' + r.yearlyMax +
    ', N=' + (r.fitYears.join('/') || '—') + ' → `' + r.bucket + '` (' + r.programs + ' программ)\n';
}
await fs.writeFile(OUT_MD, md);

console.log('records=' + totalRec + ' programs=' + totalProg + ' files=' + stats.files + ' filesWithTuition=' + stats.filesWithTuition);
for (const b of BUCKETS) {
  if (summary[b] && summary[b].records) console.log(b + ': rec=' + summary[b].records + ' prog=' + summary[b].programs + ' uni=' + summary[b].universities.size);
}
console.log('years: ' + JSON.stringify(nDist));
console.log('written: ' + OUT_MD);
console.log('written: ' + OUT_JSON);
