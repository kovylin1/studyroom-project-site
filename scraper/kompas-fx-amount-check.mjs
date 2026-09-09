#!/usr/bin/env node
// Расходится не валюта, а СУММА — замер по живому каталогу.
//
// Зачем отдельный замер. Сверка `kompas-live-vs-aggregators.mjs` сравнивает суммы
// только при одинаковой валюте: при разной сравнивать нечего, курс в данные не
// пишется. Из-за этого офшорные кампусы (Дубай, Малайзия, Сингапур) выпадают из
// проверки целиком — у них карточка в USD, а источник прайсит в местной. Разбор
// 15.08 (`CURRENCY-REVIEW.md`) насчитал там 17 кейсов на сумму, но решение не
// принималось, а цены с тех пор переприменялись.
//
// Что делает: приводит обе суммы к тенге справочным курсом (общий модуль
// lib/country-currency.mjs, тем же приближением считает витрина) и смотрит, велика
// ли разница ПОСЛЕ пересчёта. Курс справочный, поэтому порог широкий: расхождение
// до 15 % — шум курса, выше — расходится сама сумма.
//
// Сети нет, ничего не пишет кроме отчётов:
//   sources/kompas/FX-AMOUNT-CHECK.md, sources/kompas/fx-amount-check.json
//
// Запуск: node scraper/kompas-fx-amount-check.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIndex, matchProgram } from './lib/program-match.mjs';
import { inKzt, LOCAL_CURRENCY } from './lib/country-currency.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EX = path.join(ROOT, 'sources/kompas/extracts');
const LIVE = path.join(ROOT, 'site/src/content/universities');
const OUT_JSON = path.join(ROOT, 'sources/kompas/fx-amount-check.json');
const OUT_MD = path.join(ROOT, 'sources/kompas/FX-AMOUNT-CHECK.md');

const AGGREGATORS = ['qs', 'edvoy', 'kaplan', 'studygroup', 'oxford-international', 'qahe'];
const NOISE = 0.15;          // до 15 % — шум справочного курса

const feeOf = (p) => {
  const v = typeof p.tuition === 'number' ? p.tuition
    : typeof p.feePerYear === 'number' ? p.feePerYear : null;
  return v != null && v > 0 ? v : null;
};

const cards = new Map();
for (const f of fs.readdirSync(LIVE)) {
  if (!f.endsWith('.json')) continue;
  cards.set(f.replace(/\.json$/, ''), JSON.parse(fs.readFileSync(path.join(LIVE, f), 'utf8')));
}
const idx = new Map();
for (const [slug, card] of cards) idx.set(slug, buildIndex(card.programs || []));

const rows = [];
const stats = { compared: 0, sameCurrency: 0, crossCurrency: 0, withinNoise: 0, differs: 0 };

for (const src of AGGREGATORS) {
  const dir = path.join(EX, src);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (d.notAnInstitution || d.noPrograms || d.excludedFromDiff) continue;
    const slug = d.catalogSlug || d.slug;
    const card = cards.get(slug);
    if (!card) continue;
    const bp = (card.tuition && card.tuition.byProgram) || {};
    const cardCur = (card.tuition && card.tuition.currency) || null;

    for (const ep of (d.programs || [])) {
      const fee = feeOf(ep);
      const sc = ep.currency || null;
      if (fee == null || !sc) continue;
      const target = matchProgram(idx.get(slug), ep).program;
      if (!target || !target.slug) continue;
      const written = bp[target.slug];
      if (written == null || written <= 0) continue;
      const cc = target.tuitionCurrency || cardCur;
      if (!cc) continue;
      stats.compared++;
      if (cc === sc) { stats.sameCurrency++; continue; }
      stats.crossCurrency++;

      // Варианты цены — законные суммы той же программы у других источников
      // и кампусов. Если хоть один вариант сходится с источником после пересчёта,
      // расхождения нет: каталог просто показывает минимальный из них.
      // У каждого варианта СВОЯ валюта, и это здесь главное. QS отдаёт Roehampton
      // одну и ту же сумму двумя строками — 13 705 USD и 13 705 GBP; каталог берёт
      // фунтовую как местную, долларовая остаётся вариантом. Считать варианты
      // в валюте каталога — значит увидеть расхождение там, где сумма ровно та же.
      const candidates = [{ tuition: written, currency: cc },
        ...(target.tuitionVariants || [])]
        .filter((v) => typeof v.tuition === 'number' && v.tuition > 0);
      const srcKzt = inKzt(fee, sc);
      const best = candidates
        .map((v) => {
          const k = inKzt(v.tuition, v.currency || cc);
          return Math.abs(k - srcKzt) / Math.max(k, srcKzt);
        })
        .sort((a, b) => a - b)[0];
      if (best <= NOISE) { stats.withinNoise++; continue; }

      stats.differs++;
      rows.push({
        src, slug, country: card.country || null, program: target.slug, title: target.title,
        catalog: written, catalogCurrency: cc, source: fee, sourceCurrency: sc,
        catalogKzt: Math.round(inKzt(written, cc)), sourceKzt: Math.round(srcKzt),
        deltaPct: +(best * 100).toFixed(1),
        localCurrency: LOCAL_CURRENCY[card.country] || null,
        catalogIsLocal: (LOCAL_CURRENCY[card.country] || null) === cc,
      });
    }
  }
}

rows.sort((a, b) => b.deltaPct - a.deltaPct);
const byCard = new Map();
for (const r of rows) {
  if (!byCard.has(r.slug)) byCard.set(r.slug, { slug: r.slug, country: r.country, n: 0, worst: 0, srcs: new Set() });
  const c = byCard.get(r.slug);
  c.n++; c.worst = Math.max(c.worst, r.deltaPct); c.srcs.add(r.src);
}
const cardsOut = [...byCard.values()].map((c) => ({ ...c, srcs: [...c.srcs] }))
  .sort((a, b) => b.n - a.n);

fs.writeFileSync(OUT_JSON, JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10),
  noiseThreshold: NOISE, stats, cards: cardsOut, rows }, null, 1) + '\n');

let md = '# Расходится не валюта, а сумма\n\n';
md += 'Обе суммы приведены к тенге справочным курсом (`lib/country-currency.mjs`).\n';
md += `Расхождение до ${NOISE * 100} % считается шумом курса. Варианты цены программы\n`;
md += 'учитываются: если с источником сходится любой из них, расхождения нет.\n\n';
md += '| Показатель | Значение |\n|---|---:|\n';
md += `| Сверено пар «программа × источник» | ${stats.compared} |\n`;
md += `| Валюта совпала — считает обычная сверка | ${stats.sameCurrency} |\n`;
md += `| Валюта разная — считает этот замер | ${stats.crossCurrency} |\n`;
md += `| Из них сошлось после пересчёта | ${stats.withinNoise} |\n`;
md += `| **Сумма расходится** | **${stats.differs}** |\n`;
if (cardsOut.length) {
  md += `\n## Карточки — ${cardsOut.length}\n\n| Карточка | Страна | Строк | Худшее | Источники |\n|---|---|---:|---:|---|\n`;
  for (const c of cardsOut) md += `| ${c.slug} | ${c.country || '—'} | ${c.n} | ${c.worst} % | ${c.srcs.join(', ')} |\n`;
  md += '\n## Худшие 40 строк\n\n| Карточка | Программа | Каталог | Источник | Δ | Валюта каталога местная? |\n|---|---|---:|---:|---:|---|\n';
  for (const r of rows.slice(0, 40)) {
    md += `| ${r.slug} | ${r.title} | ${r.catalog} ${r.catalogCurrency} | ${r.source} ${r.sourceCurrency} (${r.src}) | ${r.deltaPct} % | ${r.catalogIsLocal ? 'да' : 'нет, местная ' + (r.localCurrency || '—')} |\n`;
  }
}
fs.writeFileSync(OUT_MD, md);
console.log(JSON.stringify(stats, null, 1));
console.log('карточек с расхождением суммы:', cardsOut.length);
console.log('→ ' + path.relative(ROOT, OUT_MD));
