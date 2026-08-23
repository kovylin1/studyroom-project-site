#!/usr/bin/env node
// Сверка рабочей копии каталога с выгрузками агрегатора QS: что записано против
// того, что даёт источник. Сети не трогает — читает локальные выгрузки
// sources/kompas/extracts/qs, собранные 15.08.
//
// Проверяется каждая цена: сумма, валюта (своя у программы или валюта карточки),
// основа (год против всего срока по замеру qs-fee-basis-map.json).
// Обратная сторона: цены каталога, которых у источника нет вовсе.
//
// Запуск: node scraper/kompas-workcopy-vs-qs.mjs
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const QS_DIR = path.join(ROOT, 'sources/kompas/extracts/qs');
const WORK_DIR = path.join(ROOT, 'sources/kompas/catalog-work');
const MAP_FILE = path.join(ROOT, 'sources/kompas/qs-fee-basis-map.json');
const OUT_JSON = path.join(ROOT, 'sources/kompas/workcopy-vs-qs.json');
const OUT_MD = path.join(ROOT, 'sources/kompas/WORKCOPY-VS-QS.md');

const norm = (s) => String(s || '').toLowerCase().replace(/[’'`]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim();

const basisOf = new Map();
for (const m of JSON.parse(await fs.readFile(MAP_FILE, 'utf8'))) {
  basisOf.set(m.slug + '|' + (m.currency || '?') + '|' + m.tuition, m);
}

const stats = {
  extractsLinked: 0, qsPricesTotal: 0,
  matchExact: 0, matchOwnCurrency: 0,
  priceDiffers: 0, currencyDiffers: 0, basisDiffers: 0,
  qsProgramMissingInCard: 0, qsPriceNotWritten: 0,
  catalogPriceNotInQs: 0, orphanCurrencyMark: 0, priceForUnknownProgram: 0,
};
const findings = [];
const files = (await fs.readdir(QS_DIR)).filter((f) => f.endsWith('.json')).sort();

for (const f of files) {
  const data = JSON.parse(await fs.readFile(path.join(QS_DIR, f), 'utf8'));
  if (!data.catalogSlug) continue;
  let card;
  try { card = JSON.parse(await fs.readFile(path.join(WORK_DIR, data.catalogSlug + '.json'), 'utf8')); }
  catch { findings.push({ kind: 'card-missing', extract: f, catalogSlug: data.catalogSlug }); continue; }
  stats.extractsLinked++;

  const progs = card.programs || [];
  const byUrl = new Map(), byTitle = new Map();
  for (const p of progs) {
    if (p.programUrl && !byUrl.has(p.programUrl)) byUrl.set(p.programUrl, p);
    const k = norm(p.title);
    if (k && !byTitle.has(k)) byTitle.set(k, p);
  }
  const bp = (card.tuition && card.tuition.byProgram) || {};
  const cardCur = card.tuition && card.tuition.currency;
  const seen = new Set();

  for (const ep of (data.programs || [])) {
    const t = typeof ep.tuition === 'number' ? ep.tuition : null;
    if (t == null || t <= 0) continue;
    stats.qsPricesTotal++;
    const target = (ep.programUrl && byUrl.get(ep.programUrl)) || byTitle.get(norm(ep.title));
    if (!target || !target.slug) { stats.qsProgramMissingInCard++; continue; }
    seen.add(target.slug);
    const written = bp[target.slug];
    if (written == null || written <= 0) { stats.qsPriceNotWritten++; continue; }

    const effCur = target.tuitionCurrency || cardCur;
    const m = basisOf.get((data.slug || f.replace(/\.json$/, '')) + '|' + (ep.currency || '?') + '|' + t);
    const wantBasis = m && m.bucket === 'whole-term' && !(m.ratio > 12) ? 'program' : 'year';
    const gotBasis = target.tuitionBasis || 'year';

    if (Math.abs(written - t) / Math.max(written, t) > 0.02) {
      stats.priceDiffers++;
      findings.push({ kind: 'price-differs', catalogSlug: data.catalogSlug, program: target.slug,
        written, qs: t, currency: effCur });
    } else if (ep.currency && effCur !== ep.currency) {
      stats.currencyDiffers++;
      findings.push({ kind: 'currency-differs', catalogSlug: data.catalogSlug, program: target.slug,
        written, writtenCurrency: effCur, qsCurrency: ep.currency });
    } else if (m && wantBasis !== gotBasis) {
      stats.basisDiffers++;
      findings.push({ kind: 'basis-differs', catalogSlug: data.catalogSlug, program: target.slug,
        written, want: wantBasis, got: gotBasis, ratio: m.ratio });
    } else if (target.tuitionCurrency) stats.matchOwnCurrency++;
    else stats.matchExact++;
  }

  // обратная сторона: цены каталога, которых источник не подтверждает
  const slugs = new Set(progs.map((p) => p.slug));
  for (const [slug, val] of Object.entries(bp)) {
    if (!slugs.has(slug)) { stats.priceForUnknownProgram++; findings.push({ kind: 'price-for-unknown-program', catalogSlug: data.catalogSlug, program: slug, written: val }); continue; }
    if (val > 0 && !seen.has(slug)) stats.catalogPriceNotInQs++;
  }
  for (const p of progs) {
    if (p.tuitionCurrency && !(bp[p.slug] > 0)) {
      stats.orphanCurrencyMark++;
      findings.push({ kind: 'currency-mark-without-price', catalogSlug: data.catalogSlug, program: p.slug, currency: p.tuitionCurrency });
    }
  }
}

await fs.writeFile(OUT_JSON, JSON.stringify({ stats, findings }, null, 1));
const byKind = {};
for (const x of findings) byKind[x.kind] = (byKind[x.kind] || 0) + 1;
let md = '# Рабочая копия против выгрузок QS\n\nСверка без сети: локальные выгрузки `sources/kompas/extracts/qs` (сбор 15.08)\nпротив `sources/kompas/catalog-work`.\n\n| Показатель | Значение |\n|---|---:|\n';
for (const k of Object.keys(stats)) md += `| ${k} | ${stats[k]} |\n`;
md += '\n## Расхождения\n\n| Вид | Штук |\n|---|---:|\n';
for (const k of Object.keys(byKind).sort((a, b) => byKind[b] - byKind[a])) md += `| \`${k}\` | ${byKind[k]} |\n`;
md += '\nПодробности: `workcopy-vs-qs.json`.\n';
await fs.writeFile(OUT_MD, md);
console.log(JSON.stringify(stats, null, 1));
console.log('расхождения:', JSON.stringify(byKind));
