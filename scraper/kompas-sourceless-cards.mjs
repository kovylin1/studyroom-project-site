#!/usr/bin/env node
// Карточки живого каталога без единой выгрузки агрегатора: почему их нет и что делать.
//
// Сверка kompas-live-vs-aggregators.mjs показала 223 такие карточки. Причин две,
// и лечатся они по-разному:
//   а) выгрузка ЕСТЬ, но привязана не туда или не привязана вовсе — чинится
//      привязкой, сеть не нужна;
//   б) вуза нет ни на одном портале из тех, что мы обошли — чинится только
//      обходом портала, и то если он там вообще есть.
// Скрипт разделяет одно от другого: сверяет имена карточек со ВСЕМИ именами,
// какие встречаются в выгрузках (включая имя агрегатора, а не только слаг карточки),
// и с очередями партнёров, которые проект уже собрал.
//
// Сети нет, ничего не пишет кроме отчётов:
//   sources/kompas/SOURCELESS-CARDS.md
//   sources/kompas/sourceless-cards.json
//
// Запуск: node scraper/kompas-sourceless-cards.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { norm, stripGeneric } from './lib/kompas-catalog-match.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIVE = path.join(ROOT, 'site/src/content/universities');
const EX = path.join(ROOT, 'sources/kompas/extracts');
const QUEUE = path.join(ROOT, 'sources/kompas/newcards-queue.json');
const OUT_JSON = path.join(ROOT, 'sources/kompas/sourceless-cards.json');
const OUT_MD = path.join(ROOT, 'sources/kompas/SOURCELESS-CARDS.md');

const AGGREGATORS = ['qs', 'edvoy', 'kaplan', 'studygroup', 'oxford-international', 'iapro', 'qahe'];

const COUNTRY_ALIAS = {
  uae: 'united arab emirates', usa: 'united states', us: 'united states',
  uk: 'united kingdom', 'great britain': 'united kingdom',
};
const normCountry = (c) => {
  const k = String(c || '').toLowerCase().replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim();
  return COUNTRY_ALIAS[k] || k;
};
const noParens = (s) => String(s || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
const inParens = (s) => (String(s || '').match(/\(([^)]{2,})\)/) || [])[1] || '';
const keysOf = (name) => {
  const out = new Set();
  for (const v of [name, noParens(name), inParens(name)]) {
    for (const k of [norm(v), stripGeneric(v)]) if (k && k.length > 3) out.add(k);
  }
  return [...out];
};

// ── живой каталог
const cards = new Map();
for (const f of fs.readdirSync(LIVE)) {
  if (!f.endsWith('.json')) continue;
  const slug = f.replace(/\.json$/, '');
  cards.set(slug, JSON.parse(fs.readFileSync(path.join(LIVE, f), 'utf8')));
}

// ── все выгрузки: к какой карточке привязаны и под какими именами известны
const extractOf = new Map();          // slug карточки -> [источники]
const byName = new Map();             // ключ имени -> [{src, aggregatorSlug, name, country, linkedTo, programs}]
for (const src of AGGREGATORS) {
  const dir = path.join(EX, src);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const linked = d.catalogSlug || f.replace(/\.json$/, '');
    if (!extractOf.has(linked)) extractOf.set(linked, []);
    extractOf.get(linked).push(src);
    const rec = { src, aggregatorSlug: d.slug || f.replace(/\.json$/, ''), name: d.name || '',
      country: d.country || null, linkedTo: linked, programs: (d.programs || []).length };
    for (const k of keysOf(d.name)) {
      if (!byName.has(k)) byName.set(k, []);
      byName.get(k).push(rec);
    }
  }
}

// ── очередь партнёров QS: вуз может быть НА портале, но выгрузки у нас нет
const queue = [];
try {
  const q = JSON.parse(fs.readFileSync(QUEUE, 'utf8'));
  for (const r of q.rows || []) queue.push({ name: r.name, country: r.country, programs: r.prog, slug: r.slug });
} catch { /* очереди может не быть — не улика */ }
const queueByName = new Map();
for (const r of queue) for (const k of keysOf(r.name)) {
  if (!queueByName.has(k)) queueByName.set(k, []);
  queueByName.get(k).push(r);
}

// ── разбор
const rows = [];
for (const [slug, card] of cards) {
  if (extractOf.has(slug)) continue;                     // выгрузка есть — не наш случай
  const cc = normCountry(card.country);
  const hits = [];
  for (const k of keysOf(card.name)) for (const h of (byName.get(k) || [])) {
    const hc = normCountry(h.country);
    if (hc && cc && hc !== cc) continue;                 // однофамилец из другой страны
    if (!hits.some((x) => x.src === h.src && x.aggregatorSlug === h.aggregatorSlug)) hits.push(h);
  }
  const onPortal = [];
  for (const k of keysOf(card.name)) for (const q of (queueByName.get(k) || [])) {
    const qc = normCountry(q.country);
    if (qc && cc && qc !== cc) continue;
    if (!onPortal.some((x) => x.slug === q.slug)) onPortal.push(q);
  }

  let verdict, note;
  if (hits.length) {
    // Выгрузка с этим именем есть, но висит на СОСЕДНЕЙ карточке. Автоматом это
    // не чинится: половина случаев — не дубль, а родня. «INTO Stony Brook» —
    // подготовительный центр, а не сам Stony Brook; «Victoria University (Gold
    // Coast)» — другой кампус, а не мельбурнский головной. Перевесить выгрузку
    // на такую карточку значит выдать чужой состав за свой. Разряд — кейс на
    // слияние, решение владельца.
    verdict = 'sibling-has-extract';
    note = 'выгрузка с тем же именем привязана к ' + [...new Set(hits.map((h) => h.linkedTo))].join(', ');
  } else if (onPortal.length) {
    verdict = 'on-portal-not-scraped';
    note = 'вуз есть в очереди партнёров QS, выгрузки нет — нужен обход портала';
  } else {
    verdict = 'absent-from-aggregators';
    note = 'ни в одной выгрузке и ни в одной очереди не встречается — сверять нечем';
  }

  rows.push({ slug, name: card.name, country: card.country || null,
    programs: (card.programs || []).length, verdict, note,
    hits: hits.slice(0, 5), onPortal: onPortal.slice(0, 3) });
}

rows.sort((a, b) => b.programs - a.programs);
const byVerdict = rows.reduce((a, r) => (a[r.verdict] = (a[r.verdict] || 0) + 1, a), {});
const progsBy = rows.reduce((a, r) => (a[r.verdict] = (a[r.verdict] || 0) + r.programs, a), {});

fs.writeFileSync(OUT_JSON, JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10),
  cards: cards.size, sourceless: rows.length, byVerdict, programsByVerdict: progsBy, rows }, null, 1) + '\n');

const LABEL = {
  'sibling-has-extract': 'Выгрузка висит на соседней карточке (дубль или родня) — кейс на слияние, решает владелец',
  'on-portal-not-scraped': 'Вуз есть в очереди партнёров QS, выгрузки нет — нужен обход портала',
  'absent-from-aggregators': 'Ни в выгрузках, ни в очередях — на обойдённых порталах вуза нет',
};
let md = '# Карточки без выгрузки агрегатора\n\n';
md += `Всего карточек ${cards.size}, без единой выгрузки ${rows.length}. `;
md += `Программ в них ${rows.reduce((s, r) => s + r.programs, 0)}.\n\n`;
md += '| Разряд | Карточек | Программ | Что это значит |\n|---|---:|---:|---|\n';
for (const v of ['sibling-has-extract', 'on-portal-not-scraped', 'absent-from-aggregators']) {
  md += `| ${v} | ${byVerdict[v] || 0} | ${progsBy[v] || 0} | ${LABEL[v]} |\n`;
}
for (const v of ['sibling-has-extract', 'on-portal-not-scraped']) {
  const list = rows.filter((r) => r.verdict === v);
  if (!list.length) continue;
  md += `\n## ${LABEL[v]} — ${list.length}\n\n| Карточка | Страна | Программ | Улика |\n|---|---|---:|---|\n`;
  for (const r of list) md += `| ${r.slug} | ${r.country || '—'} | ${r.programs} | ${r.note} |\n`;
}
const absent = rows.filter((r) => r.verdict === 'absent-from-aggregators');
md += `\n## ${LABEL['absent-from-aggregators']} — ${absent.length}\n\nПервые 40 по числу программ:\n\n`;
md += '| Карточка | Страна | Программ |\n|---|---|---:|\n';
for (const r of absent.slice(0, 40)) md += `| ${r.slug} | ${r.country || '—'} | ${r.programs} |\n`;
fs.writeFileSync(OUT_MD, md);

console.log(JSON.stringify({ cards: cards.size, sourceless: rows.length, byVerdict, programsByVerdict: progsBy }, null, 1));
console.log('→ ' + path.relative(ROOT, OUT_MD));
