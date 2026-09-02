#!/usr/bin/env node
// Сверка ЖИВОГО каталога (site/src/content/universities) со всеми выгрузками агрегаторов.
// Сети не трогает, в каталог ничего не пишет: только отчёт.
//   sources/kompas/LIVE-VS-AGGREGATORS.md   — читаемая сводка
//   sources/kompas/live-vs-aggregators.json — полные списки расхождений
//
// Считает:
//   1. покрытие — у скольких карточек есть выгрузка агрегатора;
//   2. состав — что доехало в карточку, чего в ней нет, что источник не подтверждает;
//   3. цены — совпадение с точностью 2 %, направление и величина расхождения, валюта;
//   4. карточки, которые есть у агрегатора, но которых нет в живом каталоге;
//   5. расхождение живого каталога с рабочей копией (карточки/программы/цены).
//
// Запуск: node scraper/kompas-live-vs-aggregators.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildIndex, matchProgram } from './lib/program-match.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EX = path.join(ROOT, 'sources/kompas/extracts');
const LIVE = path.join(ROOT, 'site/src/content/universities');
const WORK = path.join(ROOT, 'sources/kompas/catalog-work');
const OUT_MD = path.join(ROOT, 'sources/kompas/LIVE-VS-AGGREGATORS.md');
const OUT_JSON = path.join(ROOT, 'sources/kompas/live-vs-aggregators.json');

const AGGREGATORS = ['qs', 'edvoy', 'kaplan', 'studygroup', 'oxford-international', 'iapro', 'qahe'];
const TOL = 0.02;
const feeOf = (p) => {
  const v = typeof p.tuition === 'number' ? p.tuition
    : typeof p.feePerYear === 'number' ? p.feePerYear : null;
  return v != null && v > 0 ? v : null;
};
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const near = (a, b) => Math.abs(a - b) / Math.max(a, b) <= TOL;

// ---------- живой каталог ----------
const cards = new Map();
for (const f of fs.readdirSync(LIVE)) {
  if (!f.endsWith('.json')) continue;
  cards.set(f.replace(/\.json$/, ''), readJson(path.join(LIVE, f)));
}
const idx = new Map();
for (const [slug, card] of cards) idx.set(slug, buildIndex(card.programs || []));

const confirmed = new Map();      // slug карточки -> Set слагов программ, подтверждённых агрегатором
const priceConfirmed = new Map();
const cardsWithSource = new Set();
const perSource = {};
const missingCards = [];          // выгрузка есть, карточки нет
const unlinkedExtracts = [];      // выгрузка ни к чему не привязана
const feeDiffs = [];              // цена каталога против цены источника
const feeAbsent = [];             // у источника цена есть, в каталоге нет
const notInCardRows = [];         // строка источника не нашла программу в карточке
const currencyDiffs = [];         // валюта карточки против валюты источника

for (const src of [...AGGREGATORS, 'direct']) {
  const dir = path.join(EX, src);
  if (!fs.existsSync(dir)) continue;
  const st = perSource[src] = {
    extracts: 0, linked: 0, unlinked: 0, cardMissing: 0, skipped: 0,
    programs: 0, matched: 0, notInCard: 0,
    fees: 0, feeMatched: 0, feeDiffers: 0, feeAbsentInCard: 0,
    catalogHigher: 0, catalogLower: 0,
  };
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const d = readJson(path.join(dir, f));
    st.extracts++;
    if (d.notAnInstitution || d.noPrograms || d.excludedFromDiff) { st.skipped++; continue; }
    const slug = d.catalogSlug || d.slug;
    if (!slug) { st.unlinked++; unlinkedExtracts.push({ src, file: f, name: d.name || null }); continue; }
    const card = cards.get(slug);
    if (!card) {
      st.cardMissing++;
      missingCards.push({ src, slug, name: d.name || null, programs: (d.programs || []).length });
      continue;
    }
    st.linked++;
    if (src !== 'direct') cardsWithSource.add(slug);
    const bp = (card.tuition && card.tuition.byProgram) || {};
    const cardCur = card.tuition && card.tuition.currency ? card.tuition.currency : null;
    if (!confirmed.has(slug)) { confirmed.set(slug, new Set()); priceConfirmed.set(slug, new Set()); }

    // защита от общей ссылки источника (QS отдаёт один portal URL всем строкам)
    const rows = d.programs || [];
    const urlCount = new Map();
    for (const r of rows) if (r.programUrl) urlCount.set(r.programUrl, (urlCount.get(r.programUrl) || 0) + 1);
    const sharedUrls = new Set([...urlCount].filter(([, n]) => n > 1 && n >= rows.length * 0.5).map(([u]) => u));

    for (const ep0 of rows) {
      st.programs++;
      const ep = sharedUrls.has(ep0.programUrl) ? { ...ep0, programUrl: null } : ep0;
      const target = matchProgram(idx.get(slug), ep).program;
      if (!target || !target.slug) {
        st.notInCard++;
        if (src !== 'direct') {
          notInCardRows.push({
            src, slug, title: ep.title || null,
            level: ep.level || ep.sourceLevel || null, fee: feeOf(ep),
          });
        }
        continue;
      }
      st.matched++;
      if (src !== 'direct') confirmed.get(slug).add(target.slug);
      const fee = feeOf(ep);
      if (fee == null) continue;
      st.fees++;
      const written = bp[target.slug];
      if (written == null || written <= 0) {
        st.feeAbsentInCard++;
        if (src !== 'direct') {
          feeAbsent.push({
            src, slug, program: target.slug, title: target.title,
            sourceFee: fee, sourceCurrency: ep.currency || null,
          });
        }
        continue;
      }
      const variants = target.tuitionVariants ? target.tuitionVariants.map((v) => v.tuition) : [];
      const ok = near(written, fee) || variants.some((v) => near(v, fee));
      if (ok) {
        st.feeMatched++;
        if (src !== 'direct') priceConfirmed.get(slug).add(target.slug);
      } else {
        st.feeDiffers++;
        if (written > fee) st.catalogHigher++; else st.catalogLower++;
        if (src !== 'direct') {
          feeDiffs.push({
            src, slug, program: target.slug, title: target.title,
            catalog: written, source: fee,
            deltaPct: +(((written - fee) / fee) * 100).toFixed(1),
            catalogCurrency: target.tuitionCurrency || cardCur,
            sourceCurrency: ep.currency || null,
            basis: target.tuitionBasis || (card.tuition && card.tuition.basis) || null,
          });
        }
      }
      const sc = ep.currency || null;
      const cc = target.tuitionCurrency || cardCur;
      if (src !== 'direct' && sc && cc && sc !== cc) {
        currencyDiffs.push({ src, slug, program: target.slug, catalogCurrency: cc, sourceCurrency: sc });
      }
    }
  }
}

// ---------- сторона каталога ----------
const total = {
  cards: cards.size, cardsWithAggregator: cardsWithSource.size,
  programs: 0, programsConfirmed: 0, programsCatalogOnly: 0, programsUnconfirmed: 0,
  prices: 0, pricesConfirmed: 0, pricesUnconfirmed: 0, programsWithoutPrice: 0,
};
const perCard = [];
for (const [slug, card] of cards) {
  const ok = confirmed.get(slug) || new Set();
  const okPrice = priceConfirmed.get(slug) || new Set();
  const bp = (card.tuition && card.tuition.byProgram) || {};
  const row = {
    slug, name: card.name, country: card.country || null,
    hasSource: cardsWithSource.has(slug),
    programs: 0, confirmed: 0, prices: 0, pricesConfirmed: 0,
  };
  for (const p of (card.programs || [])) {
    total.programs++; row.programs++;
    if (ok.has(p.slug)) { total.programsConfirmed++; row.confirmed++; } else total.programsUnconfirmed++;
    if (p.kompasStatus === 'catalog-only') total.programsCatalogOnly++;
    if (bp[p.slug] > 0) {
      total.prices++; row.prices++;
      if (okPrice.has(p.slug)) { total.pricesConfirmed++; row.pricesConfirmed++; } else total.pricesUnconfirmed++;
    } else total.programsWithoutPrice++;
  }
  perCard.push(row);
}

// ---------- живой каталог против рабочей копии ----------
let workDiff = null;
if (fs.existsSync(WORK)) {
  const count = (dir) => {
    let cardsN = 0, progs = 0, prices = 0;
    const slugs = new Set();
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.json')) continue;
      const d = readJson(path.join(dir, f));
      cardsN++; slugs.add(f.replace(/\.json$/, ''));
      progs += (d.programs || []).length;
      const bp = (d.tuition && d.tuition.byProgram) || {};
      prices += Object.values(bp).filter((v) => v > 0).length;
    }
    return { cards: cardsN, programs: progs, prices, slugs };
  };
  const L = count(LIVE), W = count(WORK);
  workDiff = {
    live: { cards: L.cards, programs: L.programs, prices: L.prices },
    work: { cards: W.cards, programs: W.programs, prices: W.prices },
    onlyInWork: [...W.slugs].filter((s) => !L.slugs.has(s)),
    onlyInLive: [...L.slugs].filter((s) => !W.slugs.has(s)),
  };
}

// ---------- отчёт ----------
const pct = (a, b) => (b ? (a / b * 100).toFixed(1) + ' %' : '—');
const byCount = (arr, key) => {
  const m = new Map();
  for (const x of arr) m.set(x[key], (m.get(x[key]) || 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]);
};

let md = '# Живой каталог против агрегаторов\n\n';
md += 'Сверка без сети: выгрузки в sources/kompas/extracts против site/src/content/universities.\n';
md += 'Совпадением цены считается расхождение до 2 %. Обходы офсайтов (direct) агрегатором не считаются.\n\n';

md += '## Покрытие каталога\n\n| Показатель | Значение | Доля |\n|---|---:|---:|\n';
md += `| Карточек в живом каталоге | ${total.cards} | |\n`;
md += `| Из них с выгрузкой агрегатора | ${total.cardsWithAggregator} | ${pct(total.cardsWithAggregator, total.cards)} |\n`;
md += `| Программ всего | ${total.programs} | |\n`;
md += `| Подтверждено агрегатором | ${total.programsConfirmed} | ${pct(total.programsConfirmed, total.programs)} |\n`;
md += `| Не подтверждено | ${total.programsUnconfirmed} | ${pct(total.programsUnconfirmed, total.programs)} |\n`;
md += `| Из них помечено catalog-only | ${total.programsCatalogOnly} | |\n`;
md += `| Цен всего | ${total.prices} | ${pct(total.prices, total.programs)} от программ |\n`;
md += `| Цена совпадает с агрегатором | ${total.pricesConfirmed} | ${pct(total.pricesConfirmed, total.prices)} |\n`;
md += `| Цену источник не подтверждает | ${total.pricesUnconfirmed} | ${pct(total.pricesUnconfirmed, total.prices)} |\n`;
md += `| Программ без цены | ${total.programsWithoutPrice} | ${pct(total.programsWithoutPrice, total.programs)} |\n\n`;

md += '## По источникам\n\n| Источник | Выгрузок | Привязано | Нет карточки | Строк | Доехало | Нет в карточке | Цен | Совпало | Разошлось | Нет цены в каталоге |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n';
for (const [src, s] of Object.entries(perSource)) {
  md += `| ${src} | ${s.extracts} | ${s.linked} | ${s.cardMissing} | ${s.programs} | ${s.matched} | ${s.notInCard} | ${s.fees} | ${s.feeMatched} | ${s.feeDiffers} | ${s.feeAbsentInCard} |\n`;
}
md += '\n### Совпадение цен по источникам\n\n| Источник | Цен сверено | Совпало | Каталог дороже | Каталог дешевле |\n|---|---:|---:|---:|---:|\n';
for (const [src, s] of Object.entries(perSource)) {
  const cmp = s.feeMatched + s.feeDiffers;
  md += `| ${src} | ${cmp} | ${s.feeMatched} (${pct(s.feeMatched, cmp)}) | ${s.catalogHigher} | ${s.catalogLower} |\n`;
}

md += '\n## Расхождения\n\n';
md += `### Карточки нет в каталоге, а выгрузка есть — ${missingCards.length}\n\n`;
if (missingCards.length) {
  md += '| Источник | Слаг | Название | Программ в выгрузке |\n|---|---|---|---:|\n';
  for (const m of missingCards.slice(0, 60)) md += `| ${m.src} | ${m.slug} | ${m.name || ''} | ${m.programs} |\n`;
  if (missingCards.length > 60) md += `\n…и ещё ${missingCards.length - 60}, полный список в JSON.\n`;
}
md += `\n### Выгрузок без привязки к карточке — ${unlinkedExtracts.length}\n`;

md += `\n### Строк источника, не нашедших программу в карточке — ${notInCardRows.length}\n\n`;
md += '| Источник | Строк |\n|---|---:|\n';
for (const [src, n] of byCount(notInCardRows, 'src')) md += `| ${src} | ${n} |\n`;
md += '\nТоп карточек по числу непривязанных строк:\n\n| Карточка | Строк |\n|---|---:|\n';
for (const [slug, n] of byCount(notInCardRows, 'slug').slice(0, 25)) md += `| ${slug} | ${n} |\n`;

md += `\n### Цены разошлись больше чем на 2 % — ${feeDiffs.length}\n\n`;
md += '| Источник | Расхождений |\n|---|---:|\n';
for (const [src, n] of byCount(feeDiffs, 'src')) md += `| ${src} | ${n} |\n`;
const bigDiffs = [...feeDiffs].sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct)).slice(0, 30);
md += '\nСамые крупные расхождения:\n\n| Карточка | Программа | Каталог | Источник | Δ | Откуда |\n|---|---|---:|---:|---:|---|\n';
for (const d of bigDiffs) {
  md += `| ${d.slug} | ${String(d.title || d.program).slice(0, 60)} | ${d.catalog} ${d.catalogCurrency || ''} | ${d.source} ${d.sourceCurrency || ''} | ${d.deltaPct > 0 ? '+' : ''}${d.deltaPct} % | ${d.src} |\n`;
}

md += `\n### У источника цена есть, в каталоге нет — ${feeAbsent.length}\n\n`;
md += '| Источник | Строк |\n|---|---:|\n';
for (const [src, n] of byCount(feeAbsent, 'src')) md += `| ${src} | ${n} |\n`;

md += `\n### Валюта каталога расходится с валютой источника — ${currencyDiffs.length}\n\n`;
if (currencyDiffs.length) {
  const pairs = new Map();
  for (const c of currencyDiffs) {
    const k = `${c.catalogCurrency} → ${c.sourceCurrency}`;
    pairs.set(k, (pairs.get(k) || 0) + 1);
  }
  md += '| Каталог → источник | Программ |\n|---|---:|\n';
  for (const [k, n] of [...pairs].sort((a, b) => b[1] - a[1]).slice(0, 20)) md += `| ${k} | ${n} |\n`;
}

md += '\n### Карточки без единой выгрузки агрегатора\n\n';
const noSource = perCard.filter((c) => !c.hasSource);
md += `Всего ${noSource.length} из ${total.cards}. Программ в них: ${noSource.reduce((a, c) => a + c.programs, 0)}.\n\n`;
md += '| Карточка | Страна | Программ |\n|---|---|---:|\n';
for (const c of [...noSource].sort((a, b) => b.programs - a.programs).slice(0, 30)) {
  md += `| ${c.slug} | ${c.country || ''} | ${c.programs} |\n`;
}

if (workDiff) {
  md += '\n## Живой каталог против рабочей копии\n\n| Показатель | Живой | Рабочая копия | Δ |\n|---|---:|---:|---:|\n';
  for (const k of ['cards', 'programs', 'prices']) {
    md += `| ${k} | ${workDiff.live[k]} | ${workDiff.work[k]} | ${workDiff.live[k] - workDiff.work[k]} |\n`;
  }
  md += `\nТолько в рабочей копии: ${workDiff.onlyInWork.length}. Только в живом: ${workDiff.onlyInLive.length}.\n`;
}

fs.writeFileSync(OUT_MD, md);
fs.writeFileSync(OUT_JSON, JSON.stringify({
  generatedFrom: { live: 'site/src/content/universities', extracts: 'sources/kompas/extracts' },
  perSource, total, workDiff,
  missingCards, unlinkedExtracts, feeDiffs, feeAbsent, notInCardRows, currencyDiffs, perCard,
}, null, 1));
console.log(JSON.stringify({
  perSource, total,
  workDiff: workDiff && {
    live: workDiff.live, work: workDiff.work,
    onlyInWork: workDiff.onlyInWork.length, onlyInLive: workDiff.onlyInLive.length,
  },
}, null, 1));
console.log('missingCards', missingCards.length, 'feeDiffs', feeDiffs.length,
  'feeAbsent', feeAbsent.length, 'notInCard', notInCardRows.length, 'currencyDiffs', currencyDiffs.length);
