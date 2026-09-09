#!/usr/bin/env node
// Полная сверка рабочей копии каталога со ВСЕМИ выгрузками агрегаторов.
// Сети не трогает: читает sources/kompas/extracts/<источник>.
//
// Считает три вещи:
//   1. покрытие — у скольких карточек вообще есть выгрузка агрегатора;
//   2. состав — сколько программ источника доехало в карточку и сколько программ
//      каталога источник не подтверждает;
//   3. цены — сколько цен карточки совпадает с ценой источника.
// `direct` (обходы офсайтов) в счёт агрегаторов не идёт, но считается отдельно.
//
// Запуск: node scraper/kompas-workcopy-vs-aggregators.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildIndex, matchProgram } from './lib/program-match.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EX = path.join(ROOT, 'sources/kompas/extracts');
const WORK = path.join(ROOT, 'sources/kompas/catalog-work');
const OUT_MD = path.join(ROOT, 'sources/kompas/WORKCOPY-VS-AGGREGATORS.md');
const OUT_JSON = path.join(ROOT, 'sources/kompas/workcopy-vs-aggregators.json');

const AGGREGATORS = ['qs', 'edvoy', 'kaplan', 'studygroup', 'oxford-international', 'iapro', 'qahe'];
const feeOf = (p) => {
  const v = typeof p.tuition === 'number' ? p.tuition
    : typeof p.feePerYear === 'number' ? p.feePerYear : null;
  return v != null && v > 0 ? v : null;
};

const cards = new Map();
for (const f of fs.readdirSync(WORK)) {
  if (!f.endsWith('.json')) continue;
  cards.set(f.replace(/\.json$/, ''), JSON.parse(fs.readFileSync(path.join(WORK, f), 'utf8')));
}
// индексы программ карточки — строим один раз
const idx = new Map();
for (const [slug, card] of cards) {
  idx.set(slug, buildIndex(card.programs));
}

const confirmed = new Map();   // slug карточки -> Set слагов программ, подтверждённых агрегатором
const priceConfirmed = new Map();
const cardsWithSource = new Set();
const perSource = {};

for (const src of [...AGGREGATORS, 'direct']) {
  const dir = path.join(EX, src);
  if (!fs.existsSync(dir)) continue;
  const st = perSource[src] = {
    extracts: 0, linked: 0, unlinked: 0, cardMissing: 0,
    programs: 0, matched: 0, notInCard: 0,
    fees: 0, feeMatched: 0, feeDiffers: 0, feeAbsentInCard: 0,
  };
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    st.extracts++;
    if (d.notAnInstitution || d.noPrograms || d.excludedFromDiff) continue;
    const slug = d.catalogSlug || d.slug;
    if (!slug) { st.unlinked++; continue; }
    const card = cards.get(slug);
    if (!card) { st.cardMissing++; continue; }
    st.linked++;
    if (src !== 'direct') cardsWithSource.add(slug);
    const bp = (card.tuition && card.tuition.byProgram) || {};
    if (!confirmed.has(slug)) { confirmed.set(slug, new Set()); priceConfirmed.set(slug, new Set()); }
    for (const ep of (d.programs || [])) {
      st.programs++;
      const target = matchProgram(idx.get(slug), ep).program;
      if (!target || !target.slug) { st.notInCard++; continue; }
      st.matched++;
      if (src !== 'direct') confirmed.get(slug).add(target.slug);
      const fee = feeOf(ep);
      if (fee == null) continue;
      st.fees++;
      const written = bp[target.slug];
      if (written == null || written <= 0) { st.feeAbsentInCard++; continue; }
      const variants = target.tuitionVariants ? target.tuitionVariants.map((v) => v.tuition) : [];
      const ok = Math.abs(written - fee) / Math.max(written, fee) <= 0.02
        || variants.some((v) => Math.abs(v - fee) / Math.max(v, fee) <= 0.02);
      if (ok) { st.feeMatched++; if (src !== 'direct') priceConfirmed.get(slug).add(target.slug); }
      else st.feeDiffers++;
    }
  }
}

// сторона каталога
const total = { cards: cards.size, cardsWithAggregator: cardsWithSource.size,
  programs: 0, programsConfirmed: 0, programsCatalogOnly: 0, programsUnconfirmed: 0,
  prices: 0, pricesConfirmed: 0, pricesUnconfirmed: 0 };
for (const [slug, card] of cards) {
  const ok = confirmed.get(slug) || new Set();
  const okPrice = priceConfirmed.get(slug) || new Set();
  const bp = (card.tuition && card.tuition.byProgram) || {};
  for (const p of (card.programs || [])) {
    total.programs++;
    if (ok.has(p.slug)) total.programsConfirmed++; else total.programsUnconfirmed++;
    if (p.kompasStatus === 'catalog-only') total.programsCatalogOnly++;
    if (bp[p.slug] > 0) {
      total.prices++;
      if (okPrice.has(p.slug)) total.pricesConfirmed++; else total.pricesUnconfirmed++;
    }
  }
}

const pct = (a, b) => b ? (a / b * 100).toFixed(1) + ' %' : '—';
let md = '# Рабочая копия против агрегаторов\n\nСверка без сети: `sources/kompas/extracts/<источник>` против `sources/kompas/catalog-work`.\n';
md += 'Обходы офсайтов (`direct`) агрегатором не считаются и в итог покрытия не входят.\n\n';
md += '## По источникам\n\n| Источник | Выгрузок | Привязано | Программ | Доехало в карточку | Нет в карточке | Цен | Совпало | Разошлось | Нет цены в карточке |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n';
for (const [src, s] of Object.entries(perSource)) {
  md += `| ${src} | ${s.extracts} | ${s.linked} | ${s.programs} | ${s.matched} | ${s.notInCard} | ${s.fees} | ${s.feeMatched} | ${s.feeDiffers} | ${s.feeAbsentInCard} |\n`;
}
md += '\n## Итог по каталогу\n\n| Показатель | Значение | Доля |\n|---|---:|---:|\n';
md += `| Карточек в рабочей копии | ${total.cards} | |\n`;
md += `| Из них с выгрузкой агрегатора | ${total.cardsWithAggregator} | ${pct(total.cardsWithAggregator, total.cards)} |\n`;
md += `| Программ всего | ${total.programs} | |\n`;
md += `| Подтверждено агрегатором | ${total.programsConfirmed} | ${pct(total.programsConfirmed, total.programs)} |\n`;
md += `| Не подтверждено | ${total.programsUnconfirmed} | ${pct(total.programsUnconfirmed, total.programs)} |\n`;
md += `| Из них помечено catalog-only | ${total.programsCatalogOnly} | |\n`;
md += `| Цен всего | ${total.prices} | |\n`;
md += `| Совпадает с ценой агрегатора | ${total.pricesConfirmed} | ${pct(total.pricesConfirmed, total.prices)} |\n`;
md += `| Источник цену не подтверждает | ${total.pricesUnconfirmed} | ${pct(total.pricesUnconfirmed, total.prices)} |\n`;
fs.writeFileSync(OUT_MD, md);
fs.writeFileSync(OUT_JSON, JSON.stringify({ perSource, total }, null, 1));
console.log(JSON.stringify(perSource, null, 1));
console.log(JSON.stringify(total, null, 1));
