#!/usr/bin/env node
// Добор officialUrl из уже собранных выгрузок — без сети и без платного поиска.
//
// Зачем. Правило подмены ссылок (`site/src/scripts/program-link.ts`) говорит:
// ссылку на агрегатор меняем на офсайт, офсайта нет — ссылки нет вовсе. Офсайт
// известен у 222 карточек из 1076, поэтому 34 057 программ (27 %) теряют ссылку
// не потому, что её нет, а потому, что мы не знаем адрес вуза. Wikidata на этом
// исчерпана (из 396 в очереди нашлось 2).
//
// Откуда берём. Адрес вуза уже лежит в наших же данных, просто россыпью:
//   * `site` у выгрузок обхода офсайтов (`extracts/direct`) — прямая улика, вес 5;
//   * `courseUrlsFound` там же — адреса страниц курсов на сайте вуза;
//   * `programUrl` в выгрузках агрегаторов и в самих карточках — часть строк
//     ведёт на сайт вуза, а не на портал.
// Домены агрегаторов отбрасываются: они не офсайт по определению.
//
// ЧЕМ ЭТО ОПАСНО И КАК ЗАЩИЩЕНО. Замер 09.09 нашёл 366 программ, чьи ссылки ведут
// на ЧУЖОЙ вуз: у карточки `nottingham` 199 ссылок на ntu.ac.uk (Nottingham Trent).
// То есть «много улик» само по себе ничего не доказывает — вуз-однофамилец даёт
// сотни улик подряд. Поэтому кандидат отклоняется, если:
//   1. его марка домена уже принадлежит ДРУГОЙ карточке (её officialUrl) —
//      именно этим ловится ntu.ac.uk при живой карточке nottingham-trent;
//   2. он не набрал большинства среди улик этой карточки (порог DOMINANCE);
//   3. улик меньше MIN_EVIDENCE и среди них нет прямой (`site` обхода офсайта).
// Отклонённые не пропадают: они уходят в отчёт кейсами, с причиной.
//
// Сети нет. Без --apply не пишет ничего.
//   node scraper/kompas-officialurl-from-extracts.mjs          # только отчёт
//   node scraper/kompas-officialurl-from-extracts.mjs --apply  # запись в каталог и копию
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EX = path.join(ROOT, 'sources/kompas/extracts');
const LIVE = path.join(ROOT, 'site/src/content/universities');
const WORK = path.join(ROOT, 'sources/kompas/catalog-work');
const OUT_JSON = path.join(ROOT, 'sources/kompas/officialurl-from-extracts.json');
const OUT_MD = path.join(ROOT, 'sources/kompas/OFFICIALURL-FROM-EXTRACTS.md');
const APPLY = process.argv.includes('--apply');
const TODAY = '2026-09-09';

const DOMINANCE = 0.6;     // доля улик, которую обязан набрать победитель
const MIN_EVIDENCE = 3;    // улик без прямой ссылки на сайт вуза
const SKIP_DIRS = new Set(['scholarships', 'cats']);

const AGGREGATOR = /(^|\.)(edvoy|topuniversities|qs)\.com$|(^|\.)intostudy\.com$|(^|\.)kaplanpathways\.com$|(^|\.)studygroup\.com$|(^|\.)oxfordinternational\.com$|(^|\.)navitas\.com$|iapro|qahe|collab/i;
// Хостинги и агрегаторы контента: адрес вуза там жить не может.
// Сайт подготовительного центра при вузе — не офсайт вуза. `isc.cardiff.ac.uk`
// это International Study Centre, а не Кардифф; `huddersfieldisc.com` — вообще
// отдельный домен центра. У поддомена берём родительский домен вуза, у отдельного
// домена родителя нет — такой кандидат отклоняется.
const PATHWAY_HOST = /(^|\.)isc\.|isc\.(com|co\.uk)$|(^|\.)oncampus\.|(^|\.)pathway/i;
const NOT_A_UNI = /(^|\.)(facebook|twitter|x|instagram|linkedin|youtube|tiktok|google|goo\.gl|bit\.ly|wikipedia|wikidata|maps\.app)\.|(^|\.)(googleapis|gstatic|cloudfront|amazonaws|typeform|eventbrite|mailchimp)\./i;

const host = (u) => {
  try {
    const s = String(u).trim();
    return new URL(s.startsWith('http') ? s : 'https://' + s).hostname.replace(/^www\./, '').toLowerCase();
  } catch { return null; }
};
const brand = (h) => {
  if (!h) return null;
  const parts = h.split('.');
  const cut = parts.length > 2 && /^(ac|co|edu|org|gov|com|net|gouv)$/.test(parts[parts.length - 2])
    ? parts.slice(0, -2) : parts.slice(0, -1);
  return cut[cut.length - 1] || null;
};
const asList = (v) => (Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.keys(v) : []));

// ── каталог
const cards = new Map();
for (const f of fs.readdirSync(LIVE)) {
  if (!f.endsWith('.json')) continue;
  cards.set(f.replace(/\.json$/, ''), JSON.parse(fs.readFileSync(path.join(LIVE, f), 'utf8')));
}
// марка домена -> карточка, которой она уже принадлежит по известному officialUrl
const brandOwner = new Map();
for (const [slug, c] of cards) {
  const b = brand(host(c.officialUrl || ''));
  if (b && !brandOwner.has(b)) brandOwner.set(b, slug);
}

// ── улики
const evidence = new Map();   // slug -> host -> { n, direct }
const add = (slug, h, n, direct) => {
  if (!h || AGGREGATOR.test(h) || NOT_A_UNI.test(h)) return;
  if (!evidence.has(slug)) evidence.set(slug, new Map());
  const m = evidence.get(slug);
  const cur = m.get(h) || { n: 0, direct: false };
  cur.n += n;
  cur.direct = cur.direct || direct;
  m.set(h, cur);
};

for (const src of fs.readdirSync(EX)) {
  const dir = path.join(EX, src);
  if (!fs.statSync(dir).isDirectory() || SKIP_DIRS.has(src)) continue;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const slug = d.catalogSlug || d.slug;
    if (!slug || !cards.has(slug)) continue;
    if (d.site) add(slug, host(d.site), 5, true);
    for (const p of (d.programs || [])) if (p.programUrl) add(slug, host(p.programUrl), 1, false);
    for (const u of asList(d.courseUrlsFound).slice(0, 100)) add(slug, host(u), 1, true);
  }
}
for (const [slug, c] of cards) {
  for (const p of (c.programs || [])) if (p.programUrl) add(slug, host(p.programUrl), 1, false);
}

// ── решение
const stats = { cardsTotal: cards.size, withOfficial: 0, without: 0, noEvidence: 0,
  accepted: 0, rejectedForeign: 0, rejectedWeak: 0, rejectedSplit: 0, rejectedPathway: 0 };
const accepted = [], cases = [];

for (const [slug, card] of cards) {
  if (card.officialUrl) { stats.withOfficial++; continue; }
  stats.without++;
  const m = evidence.get(slug);
  if (!m || !m.size) { stats.noEvidence++; continue; }
  const list = [...m].map(([h, v]) => ({ host: h, ...v })).sort((a, b) => b.n - a.n);
  const total = list.reduce((s, x) => s + x.n, 0);
  const top = list[0];
  const share = top.n / total;

  // Поддомен подготовительного центра сводим к домену вуза; отдельный домен
  // центра отклоняем — вуза за ним нет.
  let chosenHost = top.host, viaPathway = null;
  if (PATHWAY_HOST.test(top.host)) {
    const parent = top.host.split('.').slice(1).join('.');
    const looksLikeUni = parent.split('.').length >= 2 && !PATHWAY_HOST.test(parent);
    if (looksLikeUni) { chosenHost = parent; viaPathway = top.host; }
    else {
      stats.rejectedPathway++;
      cases.push({ slug, name: card.name, host: top.host, evidence: top.n, share: +share.toFixed(2),
        reason: 'pathway-centre',
        note: 'домен подготовительного центра, а не вуза — родительского домена у него нет' });
      continue;
    }
  }
  const b = brand(chosenHost);

  if (b && brandOwner.has(b) && brandOwner.get(b) !== slug) {
    stats.rejectedForeign++;
    cases.push({ slug, name: card.name, host: top.host, evidence: top.n, share: +share.toFixed(2),
      reason: 'foreign-uni', belongsTo: brandOwner.get(b),
      note: `домен принадлежит карточке ${brandOwner.get(b)} — это вуз-однофамилец, а не наш` });
    continue;
  }
  if (share < DOMINANCE) {
    stats.rejectedSplit++;
    cases.push({ slug, name: card.name, host: top.host, evidence: top.n, share: +share.toFixed(2),
      reason: 'split', rivals: list.slice(0, 4).map((x) => x.host + ':' + x.n),
      note: 'улики размазаны по нескольким доменам — какой из них вуза, непонятно' });
    continue;
  }
  if (!top.direct && top.n < MIN_EVIDENCE) {
    stats.rejectedWeak++;
    cases.push({ slug, name: card.name, host: top.host, evidence: top.n, share: +share.toFixed(2),
      reason: 'weak', note: `улик ${top.n}, прямой ссылки на сайт вуза нет — мало` });
    continue;
  }

  stats.accepted++;
  accepted.push({ slug, name: card.name, country: card.country || null,
    url: 'https://' + chosenHost, host: chosenHost, viaPathway, evidence: top.n,
    share: +share.toFixed(2), direct: top.direct, programs: (card.programs || []).length });
}

// ── запись
if (APPLY) {
  for (const a of accepted) {
    for (const dir of [LIVE, WORK]) {
      const f = path.join(dir, a.slug + '.json');
      if (!fs.existsSync(f)) continue;
      const c = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (c.officialUrl) continue;
      c.officialUrl = a.url;
      c.officialUrlSource = `выгрузки: ${a.evidence} ссылок на ${a.viaPathway || a.host}`
        + (a.viaPathway ? ` (домен вуза для подготовительного центра ${a.viaPathway})` : '') + (a.direct ? ' (включая прямую на сайт вуза)' : '');
      c.officialUrlCheckedAt = TODAY;
      fs.writeFileSync(f, JSON.stringify(c, null, 2) + '\n');
    }
  }
}

accepted.sort((a, b) => b.programs - a.programs);
fs.writeFileSync(OUT_JSON, JSON.stringify({ generatedAt: TODAY, applied: APPLY,
  thresholds: { DOMINANCE, MIN_EVIDENCE }, stats, accepted, cases }, null, 1) + '\n');

let md = '# Офсайт вуза из уже собранных выгрузок\n\nСети нет: адрес выводится из наших же данных.\n\n';
md += '| Показатель | Карточек |\n|---|---:|\n';
md += `| Всего | ${stats.cardsTotal} |\n| Офсайт уже был | ${stats.withOfficial} |\n`;
md += `| Без офсайта | ${stats.without} |\n| Из них улик нет вовсе | ${stats.noEvidence} |\n`;
md += `| **Адрес выведен** | **${stats.accepted}** |\n`;
md += `| Отклонено: домен чужого вуза | ${stats.rejectedForeign} |\n`;
md += `| Отклонено: улики размазаны | ${stats.rejectedSplit} |\n`;
md += `| Отклонено: улик мало | ${stats.rejectedWeak} |\n`;
md += `\nПокрытие офсайтом: ${stats.withOfficial} → ${stats.withOfficial + stats.accepted} `;
md += `(${((stats.withOfficial + stats.accepted) / stats.cardsTotal * 100).toFixed(1)} % каталога).\n`;
const foreign = cases.filter((c) => c.reason === 'foreign-uni');
if (foreign.length) {
  md += `\n## Отклонены как чужой вуз — ${foreign.length}\n\n| Карточка | Домен | Улик | Принадлежит |\n|---|---|---:|---|\n`;
  for (const c of foreign) md += `| ${c.slug} | ${c.host} | ${c.evidence} | ${c.belongsTo} |\n`;
}
md += `\n## Принято — первые 40 по числу программ\n\n| Карточка | Страна | Адрес | Улик | Доля | Программ |\n|---|---|---|---:|---:|---:|\n`;
for (const a of accepted.slice(0, 40)) md += `| ${a.slug} | ${a.country || '—'} | ${a.host} | ${a.evidence} | ${(a.share * 100).toFixed(0)} % | ${a.programs} |\n`;
fs.writeFileSync(OUT_MD, md);

console.log(JSON.stringify(stats, null, 1));
console.log(APPLY ? 'ЗАПИСАНО в живой каталог и рабочую копию' : 'сухой прогон — ничего не записано');
console.log('→ ' + path.relative(ROOT, OUT_MD));
