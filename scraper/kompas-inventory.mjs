#!/usr/bin/env node
// kompas-inventory.mjs — КОМПАС, сессия 1: разметка каталога по партнёрским источникам.
//
// Читает scraper/sources/partner-registry.json (структурированный партнёрский документ),
// собирает по каждому агрегатору его состав из локальных выгрузок, сопоставляет со слагами
// каталога и проставляет каждому вузу поле partnerSource:
//   { type: "direct" | "aggregator" | "none", via: ["<ключ агрегатора>", ...] }
//
// Правила владельца (см. план КОМПАС):
//   1. Прямой партнёр → источник офсайт; партнёр через агрегатор → источник агрегатор.
//   2. Дан явный список — партнёры только они; просто ссылка — все вузы агрегатора.
//   3. Агрегаторы ДОПОЛНЯЮТ друг друга: вуз у нескольких агрегаторов — одна карточка,
//      поэтому via — массив, а не одно значение.
//   4. Ничего не удаляем и не фабрикуем.
//   5. Живой каталог не трогаем: разметка пишется в РАБОЧУЮ КОПИЮ (--write-copy).
//
// Сеть не используется. Usage:
//   node scraper/kompas-inventory.mjs              # только отчёты
//   node scraper/kompas-inventory.mjs --write-copy # + рабочая копия каталога с разметкой

import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CATALOG = path.join(ROOT, 'site/src/content/universities');
const REGISTRY = path.join(ROOT, 'scraper/sources/partner-registry.json');
const ALIASES = path.join(ROOT, 'scraper/sources/slug-aliases.json');
const OUT_DIR = path.join(ROOT, 'sources/kompas');
const WORK_COPY = path.join(OUT_DIR, 'catalog-work');
const WRITE_COPY = process.argv.includes('--write-copy');

const log = (...a) => process.stderr.write(`[kompas] ${a.join(' ')}\n`);

// Тот же нормализатор, что в build-slug-aliases.mjs — держим сопоставление имён единым.
// «&» → «and» делаем ДО общего нормализатора: иначе «Technology & Innovation»
// и «Technology and Innovation» расходятся (амперсанд просто выбрасывается).
const amp = (s) => String(s || '').replace(/&/g, ' and ');
const norm = (s) => amp(s).toLowerCase().normalize('NFKD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/\b(university|the|of|college|institute|school)\b/g, '')
  .replace(/[^a-z0-9]/g, '').trim();

// Точное имя — БЕЗ выбрасывания слов university/college. Нужно там, где стоп-слова
// и есть всё различие: «University of Birmingham» ≠ «University College Birmingham».
const exact = (s) => amp(s).toLowerCase().normalize('NFKD')
  .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '').trim();

// Хвосты маршрутов у агрегаторов: «Deakin University Undergraduate» — это не
// отдельный вуз, а запись о программе. Срезаем ТОЛЬКО из белого списка и помечаем
// метод route-suffix, чтобы пару было видно глазами в отчёте.
const ROUTE_SUFFIXES = [
  'direct entry', 'undergraduate', 'graduate', 'international college',
  'international study centre', 'pathway', 'pathways', 'foundation',
];
const stripRoute = (s) => {
  let out = String(s || '').trim();
  for (let i = 0; i < 3; i++) {
    const before = out;
    for (const suf of ROUTE_SUFFIXES) {
      const re = new RegExp(`[\\s-]*${suf.replace(/ /g, '[\\s-]+')}$`, 'i');
      out = out.replace(re, '').trim();
    }
    if (out === before) break;
  }
  return out;
};

const readJson = async (p) => JSON.parse(await fs.readFile(p, 'utf8'));

// ─── индекс каталога ────────────────────────────────────────────────────────
const catalog = {};                 // slug → name
for (const f of (await fs.readdir(CATALOG)).filter(f => f.endsWith('.json'))) {
  const slug = f.replace(/\.json$/, '');
  try { catalog[slug] = (await readJson(path.join(CATALOG, f))).name || slug; }
  catch { catalog[slug] = slug; }
}
const catSlugs = Object.keys(catalog);

// нормализованное имя → слаг(и) каталога; коллизии храним, чтобы не угадывать вслепую
const byName = new Map();
const byExact = new Map();
for (const [slug, name] of Object.entries(catalog)) {
  const k = norm(name);
  if (k) {
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push(slug);
  }
  const e = exact(name);
  if (e) {
    if (!byExact.has(e)) byExact.set(e, []);
    byExact.get(e).push(slug);
  }
}

// алиасы каталог→extract, разворачиваем в extract→каталог
const aliasToCat = new Map();
if (existsSync(ALIASES)) {
  const { aliases = {} } = await readJson(ALIASES);
  for (const [catSlug, exSlugs] of Object.entries(aliases)) {
    if (!Array.isArray(exSlugs)) continue;          // guard: slug 'constructor' и прочие прототипные ключи
    for (const ex of exSlugs) if (!aliasToCat.has(ex)) aliasToCat.set(ex, catSlug);
  }
}

// ─── резолвер: кандидат источника → слаг каталога ───────────────────────────
// Порядок намеренный: точный слаг → готовая карта алиасов → нормализованное имя.
// Неоднозначное имя (несколько слагов) НЕ угадываем — возвращаем ambiguous.
function resolve({ slug, name, catalogSlug }) {
  // ручная подсказка из реестра сильнее любой автоматики
  if (catalogSlug) {
    return catalog[catalogSlug] !== undefined
      ? { slug: catalogSlug, method: 'manual' }
      : { slug: null, method: 'manual-slug-missing' };
  }
  if (slug && catalog[slug] !== undefined) return { slug, method: 'exact-slug' };
  if (slug && aliasToCat.has(slug)) return { slug: aliasToCat.get(slug), method: 'alias' };

  const cands = [name, slug && slug.replace(/-/g, ' ')].filter(Boolean);

  // 1) точное имя целиком — снимает пары, различающиеся только стоп-словами
  for (const cand of cands) {
    const hits = byExact.get(exact(cand));
    if (hits && hits.length === 1) return { slug: hits[0], method: 'exact-name' };
  }
  // 2) нормализованное имя (стоп-слова срезаны)
  for (const cand of cands) {
    const k = norm(cand);
    if (!k || !byName.has(k)) continue;
    const hits = byName.get(k);
    if (hits.length === 1) return { slug: hits[0], method: name && norm(name) === k ? 'name' : 'slug-as-name' };
    return { slug: null, method: 'ambiguous', ambiguous: hits };
  }
  // 3) запись о маршруте, а не о вузе: срезаем хвост из белого списка и пробуем снова
  for (const cand of cands) {
    const base = stripRoute(cand);
    if (!base || base === cand) continue;
    const eh = byExact.get(exact(base));
    if (eh && eh.length === 1) return { slug: eh[0], method: 'route-suffix', from: cand };
    const nh = byName.get(norm(base));
    if (nh && nh.length === 1) return { slug: nh[0], method: 'route-suffix', from: cand };
  }
  return { slug: null, method: 'unresolved' };
}

// ─── загрузчики состава агрегаторов ─────────────────────────────────────────
const dirMembers = async (rel) => {
  const dir = path.join(ROOT, rel);
  if (!existsSync(dir)) return [];
  const out = [];
  for (const f of (await fs.readdir(dir)).filter(f => f.endsWith('.json') && !f.startsWith('_'))) {
    const slug = f.replace(/\.json$/, '');
    let name = null;
    try { const j = await readJson(path.join(dir, f)); name = Array.isArray(j) ? null : j.name || null; } catch { /* битый файл — берём слаг */ }
    out.push({ slug, name });
  }
  return out;
};

async function membersOf(agg) {
  switch (agg.key) {
    case 'kaplan':    return dirMembers('scraper/sources/kaplan-extracts');
    case 'qahe':      return agg.list.map(e => typeof e === 'string'
                        ? { slug: null, name: e }
                        : { slug: null, name: e.name, catalogSlug: e.catalogSlug, note: e.note });
    case 'gedu':      return dirMembers('scraper/sources/gedu-extracts');
    case 'edvoy':     return dirMembers('sources/edvoy-extracts');
    case 'studygroup':return dirMembers('sources/studygroup-extracts');
    case 'cats': {
      const j = await readJson(path.join(ROOT, 'sources/cats-collected.json'));
      return Object.entries(j).filter(([k]) => k !== '_meta')
        .map(([slug, v]) => ({ slug, name: (v && v.name) || null }));
    }
    case 'navitas': {
      const src = await fs.readFile(path.join(ROOT, 'scraper/seed-navitas-uk.mjs'), 'utf8');
      return [...src.matchAll(/slug:\s*'([^']+)'/g)].map(m => ({ slug: m[1], name: null }));
    }
    case 'oxford-international':
      return (agg.knownPartners || []).map(name => ({ slug: null, name }));
    case 'qs': {
      const j = await readJson(path.join(ROOT, 'sources/qs-targets.json'));
      return j.map(x => ({ slug: x.slug, name: x.rawName }));
    }
    case 'iapro':     return [];                     // список не назван — блокер сессии 1
    default:          return [];
  }
}

// ─── сборка ────────────────────────────────────────────────────────────────
const reg = await readJson(REGISTRY);
const overrides = Object.fromEntries(
  Object.entries(reg.manualOverrides || {}).filter(([k]) => !k.startsWith('_')));
const mark = {};                                     // catSlug → { type, via[] }
for (const s of catSlugs) mark[s] = { type: 'none', via: [] };

const perAgg = [];        // отчёт по каждому агрегатору
const missingCards = [];  // партнёры документа без карточки каталога

for (const agg of reg.aggregators) {
  const members = await membersOf(agg);
  const stat = { key: agg.key, label: agg.label, rule: agg.rule, access: agg.access, members: members.length, matched: 0, byMethod: {}, matches: [], unmatched: [] };
  for (const m of members) {
    const ov = overrides[`${agg.key}:${m.slug || m.name}`];
    const r = ov ? { slug: ov.catalogSlug, method: ov.catalogSlug ? 'override' : 'override-none', reason: ov.reason } : resolve(m);
    if (r.slug) {
      stat.matched++;
      stat.byMethod[r.method] = (stat.byMethod[r.method] || 0) + 1;
      // пары храним целиком: сопоставление по имени проверяется только глазами
      stat.matches.push({ from: m.slug || m.name, method: r.method, to: r.slug, catalogName: catalog[r.slug] });
      if (mark[r.slug].type === 'none') mark[r.slug].type = 'aggregator';
      if (!mark[r.slug].via.includes(agg.key)) mark[r.slug].via.push(agg.key);
    } else {
      stat.unmatched.push({ slug: m.slug, name: m.name, why: r.method, ambiguous: r.ambiguous, reason: r.reason });
      // override-none — это «сопоставлять нечем», а не «карточки нет»: в список
      // недостающих карточек такие не идут, они идут в вопросы владельцу.
      if (r.method !== 'override-none') missingCards.push({ source: agg.key, slug: m.slug, name: m.name, why: r.method });
    }
  }
  if (agg.listStatus === 'MISSING') stat.blocked = agg.listNote;
  perAgg.push(stat);
}

// прямые партнёры проставляются ПОСЛЕ агрегаторов и перекрывают их:
// по правилу 1 источник прямого партнёра — офсайт, даже если вуз есть и у агрегатора.
const directStat = { total: reg.directPartners.length, matched: 0, unmatched: [] };
for (const dp of reg.directPartners) {
  const r = resolve({ slug: dp.extract, name: dp.raw, catalogSlug: dp.catalogSlug });
  if (r.slug) {
    directStat.matched++;
    mark[r.slug].type = 'direct';
    mark[r.slug].directRaw = dp.raw;
    if (dp.note) mark[r.slug].note = dp.note;
  } else {
    directStat.unmatched.push({ raw: dp.raw, extract: dp.extract, why: r.method });
    missingCards.push({ source: 'direct', slug: dp.extract, name: dp.raw, why: r.method });
  }
}

// ─── отчёты ────────────────────────────────────────────────────────────────
const counts = { direct: 0, aggregator: 0, none: 0 };
const multi = [];
for (const [slug, m] of Object.entries(mark)) {
  counts[m.type]++;
  if (m.type === 'aggregator' && m.via.length > 1) multi.push({ slug, name: catalog[slug], via: m.via });
}
const outsiders = Object.entries(mark).filter(([, m]) => m.type === 'none')
  .map(([slug]) => ({ slug, name: catalog[slug] }))
  .sort((a, b) => a.slug.localeCompare(b.slug));

await fs.mkdir(OUT_DIR, { recursive: true });
const report = {
  _meta: { plan: 'КОМПАС сессия 1', generatedAt: new Date().toISOString().slice(0, 10), catalogSize: catSlugs.length, network: 'не использовалась' },
  counts,
  perAggregator: perAgg,
  directPartners: directStat,
  multiAggregator: multi.sort((a, b) => b.via.length - a.via.length),
  outsideePartnerList: outsiders,
  partnersWithoutCatalogCard: missingCards,
  blockers: reg.aggregators.filter(a => a.listStatus === 'MISSING').map(a => ({ key: a.key, note: a.listNote })),
};
await fs.writeFile(path.join(OUT_DIR, 'partner-source-map.json'), JSON.stringify(mark, null, 2));
await fs.writeFile(path.join(OUT_DIR, 'coverage-report.json'), JSON.stringify(report, null, 2));

// ─── отчёт владельцу (человекочитаемый) ────────────────────────────────────
// Вузы вне партнёрского списка делим на две пачки: карточки с реальной страной
// и карточки с country="International" — последние на поверку оказались страницами
// меню и блога агрегатора, а не вузами.
const catFile = async (s) => readJson(path.join(CATALOG, `${s}.json`));
const junk = [], realOutsiders = [];
for (const o of outsiders) {
  const j = await catFile(o.slug);
  (j.country === 'International' ? junk : realOutsiders)
    .push({ ...o, country: j.country, programs: (j.programs || []).length });
}
realOutsiders.sort((a, b) => b.programs - a.programs);

const viaHist = {};
for (const m of multi) viaHist[m.via.length] = (viaHist[m.via.length] || 0) + 1;

const md = [];
md.push('# КОМПАС, сессия 1 — разметка и инвентаризация', '');
md.push(`**Дата:** ${report._meta.generatedAt}  •  **Каталог:** ${catSlugs.length} вузов  •  **Сеть не использовалась**`, '');
md.push('Живой каталог не изменён. Разметка лежит в рабочей копии `sources/kompas/catalog-work/`.', '');
md.push('## Итог разметки', '');
md.push('| Тип источника | Вузов | Что значит |', '|---|---:|---|');
md.push(`| \`direct\` | ${counts.direct} | прямой партнёр — данные берём с офсайта вуза |`);
md.push(`| \`aggregator\` | ${counts.aggregator} | партнёр через агрегатор — данные берём с сайта агрегатора |`);
md.push(`| \`none\` | ${counts.none} | вне партнёрского списка — нужно ваше решение |`, '');
md.push(`У **${multi.length}** вузов источник не один — они есть сразу у нескольких агрегаторов. По вашему правилу это одна карточка, программы объединяются. Распределение: ${Object.entries(viaHist).map(([k, v]) => `${v} вузов у ${k}`).join(', ')}.`, '');

md.push('## Покрытие по источникам', '');
md.push('| Агрегатор | Правило | Записей в источнике | Сошлось с каталогом | Доступ |', '|---|---|---:|---:|---|');
for (const a of perAgg) md.push(`| ${a.label} | ${a.rule === 'all' ? 'все вузы' : 'явный список'} | ${a.members} | ${a.matched} | ${a.access} |`);
md.push(`| **Прямые партнёры** | список | ${directStat.total} | ${directStat.matched} | офсайты |`, '');

md.push('## Список А — вузы каталога вне партнёрского списка', '');
md.push(`Всего ${outsiders.length}. Разбиваются на две очень разные пачки.`, '');
md.push(`### А1. Не вузы вообще — ${junk.length} карточек`, '');
md.push('Это страницы меню и блога Collab International, попавшие в каталог как университеты. Программы у них тоже фиктивные. Ни одна из них не размечена партнёрской — весь мусор сидит именно здесь.', '');
for (const j of junk) md.push(`- \`${j.slug}\` — ${j.name}`);
md.push('', '**Предлагаю:** это кандидаты на удаление, но правило «ничего не удаляем» ваше — решение за вами.', '');
md.push(`### А2. Настоящие вузы вне списка — ${realOutsiders.length}`, '');
md.push('| Слаг | Название | Страна | Программ |', '|---|---|---|---:|');
for (const o of realOutsiders) md.push(`| \`${o.slug}\` | ${o.name} | ${o.country} | ${o.programs} |`);
md.push('');

md.push('## Список Б — партнёры без карточки в каталоге', '');
if (!missingCards.length) md.push('Нет.', '');
else {
  md.push('| Источник | Название в источнике | Почему не сошлось |', '|---|---|---|');
  for (const m of missingCards) md.push(`| ${m.source} | ${m.name || m.slug} | ${m.why} |`);
  md.push('');
}

md.push('## Что блокирует', '');
for (const b of report.blockers) md.push(`- **${b.key}** — ${b.note}`);
md.push('');
await fs.writeFile(path.join(OUT_DIR, 'OWNER-REPORT.md'), md.join('\n'));

// ─── рабочая копия каталога с разметкой (живой каталог не трогаем) ──────────
if (WRITE_COPY) {
  await fs.mkdir(WORK_COPY, { recursive: true });
  let written = 0;
  for (const slug of catSlugs) {
    const j = await readJson(path.join(CATALOG, `${slug}.json`));
    j.partnerSource = mark[slug];
    await fs.writeFile(path.join(WORK_COPY, `${slug}.json`), JSON.stringify(j, null, 2));
    written++;
  }
  log(`рабочая копия: ${written} файлов → sources/kompas/catalog-work/`);
}

log(`каталог ${catSlugs.length}: direct ${counts.direct}, aggregator ${counts.aggregator}, none ${counts.none}`);
log(`у нескольких агрегаторов: ${multi.length}; партнёров без карточки: ${missingCards.length}`);
log(`отчёты → sources/kompas/{partner-source-map,coverage-report}.json`);
