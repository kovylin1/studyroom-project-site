#!/usr/bin/env node
// Куда на самом деле ведёт ссылка программы.
//
// Повод: у bristol «MSc Data Science» в programUrl стоял courses.uwe.ac.uk —
// сайт ДРУГОГО вуза. Посетитель уходит не туда, и заметить это глазами нельзя:
// ссылка выглядит как офсайт. Правило подмены в site/src/scripts/program-link.ts
// такое не ловит — оно отличает агрегатор от офсайта, а не свой офсайт от чужого.
//
// Замер сравнивает домен ссылки с officialUrl карточки и делит расхождения:
//   aggregator-leak — ссылка на агрегатор, которую правило подмены не узнало;
//   same-brand      — тот же вуз под другим доменом (.com против .eu, кампусный
//                     поддомен, домен группы) — не брак;
//   pathway         — домен подготовительного центра при вузе (navitas, into,
//                     kaplan-кампус) — законная ссылка для pathway-программы;
//   foreign-uni     — домен ЧУЖОГО вуза из каталога, вот это и есть брак.
//
// Сети нет, ничего не пишет кроме отчётов.
// Запуск: node scraper/kompas-programurl-check.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIVE = path.join(ROOT, 'site/src/content/universities');
const OUT_JSON = path.join(ROOT, 'sources/kompas/programurl-check.json');
const OUT_MD = path.join(ROOT, 'sources/kompas/PROGRAMURL-CHECK.md');

const AGGREGATOR = /(^|\.)(edvoy|topuniversities|qs)\.com$|(^|\.)intostudy\.com$|(^|\.)kaplanpathways\.com$|(^|\.)studygroup\.com$|(^|\.)oxfordinternational\.com$|(^|\.)iapro|(^|\.)qahe/i;
const PATHWAY = /(^|\.)navitas\.com$|(^|\.)intostudy\.com$|(^|\.)studygroup\.com$/i;

const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch { return null; } };
// «Марка» домена: две значащие части без публичного суффикса. bcu.ac.uk → bcu,
// atelierdesevres.eu → atelierdesevres. Нужна, чтобы .com и .eu одного вуза
// не считались разными вузами.
const brand = (h) => {
  if (!h) return null;
  const parts = h.split('.');
  const cut = parts.length > 2 && /^(ac|co|edu|org|gov|com|net)$/.test(parts[parts.length - 2])
    ? parts.slice(0, -2) : parts.slice(0, -1);
  return cut[cut.length - 1] || null;
};

const cards = new Map();
for (const f of fs.readdirSync(LIVE)) {
  if (!f.endsWith('.json')) continue;
  cards.set(f.replace(/\.json$/, ''), JSON.parse(fs.readFileSync(path.join(LIVE, f), 'utf8')));
}
// какой марке домена принадлежит какая карточка — чтобы узнать ЧУЖОЙ вуз в лицо
const brandOwner = new Map();
for (const [slug, c] of cards) {
  const b = brand(host(c.officialUrl || ''));
  if (b && !brandOwner.has(b)) brandOwner.set(b, slug);
}

const stats = { programs: 0, withUrl: 0, aggregatorKnown: 0, noOfficial: 0, ownDomain: 0,
  aggregatorLeak: 0, sameBrand: 0, pathway: 0, foreignUni: 0, unknownDomain: 0 };
const rows = [];

for (const [slug, c] of cards) {
  const oh = host(c.officialUrl || '');
  const ob = brand(oh);
  for (const p of (c.programs || [])) {
    stats.programs++;
    if (!p.programUrl) continue;
    stats.withUrl++;
    const ph = host(p.programUrl);
    if (!ph) continue;
    if (AGGREGATOR.test(ph) && !PATHWAY.test(ph)) { stats.aggregatorKnown++; continue; }
    if (!oh) { stats.noOfficial++; continue; }
    if (ph === oh || ph.endsWith('.' + oh) || oh.endsWith('.' + ph)) { stats.ownDomain++; continue; }

    const pb = brand(ph);
    let kind;
    if (pb && ob && pb === ob) { kind = 'sameBrand'; }
    else if (PATHWAY.test(ph)) { kind = 'pathway'; }
    else if (AGGREGATOR.test(ph)) { kind = 'aggregatorLeak'; }
    else if (pb && brandOwner.has(pb) && brandOwner.get(pb) !== slug) { kind = 'foreignUni'; }
    else { kind = 'unknownDomain'; }
    stats[kind]++;
    if (kind === 'foreignUni' || kind === 'aggregatorLeak') {
      rows.push({ slug, program: p.slug, title: p.title, url: p.programUrl, host: ph,
        officialHost: oh, kind, belongsTo: kind === 'foreignUni' ? brandOwner.get(pb) : null });
    }
  }
}

const byCard = {};
for (const r of rows) {
  const k = r.slug + ' → ' + (r.belongsTo || r.host);
  byCard[k] = (byCard[k] || 0) + 1;
}
const top = Object.entries(byCard).sort((a, b) => b[1] - a[1]);

fs.writeFileSync(OUT_JSON, JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), stats, rows }, null, 1) + '\n');

let md = '# Куда ведёт ссылка программы\n\n| Разряд | Программ |\n|---|---:|\n';
md += `| Программ всего | ${stats.programs} |\n| Со ссылкой | ${stats.withUrl} |\n`;
md += `| Ссылка на агрегатор (правило подмены её знает) | ${stats.aggregatorKnown} |\n`;
md += `| У карточки нет officialUrl — сравнивать не с чем | ${stats.noOfficial} |\n`;
md += `| Свой домен | ${stats.ownDomain} |\n`;
md += `| Тот же вуз под другим доменом | ${stats.sameBrand} |\n`;
md += `| Подготовительный центр при вузе | ${stats.pathway} |\n`;
md += `| **Агрегатор, которого правило не узнало** | **${stats.aggregatorLeak}** |\n`;
md += `| **ЧУЖОЙ вуз из каталога** | **${stats.foreignUni}** |\n`;
md += `| Домен не опознан | ${stats.unknownDomain} |\n`;
if (top.length) {
  md += '\n## Куда утекают ссылки\n\n| Карточка → чужой домен | Программ |\n|---|---:|\n';
  for (const [k, n] of top.slice(0, 40)) md += `| ${k} | ${n} |\n`;
}
fs.writeFileSync(OUT_MD, md);
console.log(JSON.stringify(stats, null, 1));
console.log('→ ' + path.relative(ROOT, OUT_MD));
