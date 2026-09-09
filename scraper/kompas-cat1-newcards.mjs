// КОМПАС — заведение карточек по остатку категории 1.
//
// Решение владельца 2026-08-23: «если есть в QS, должно быть и у нас»; города
// из списка 21.08 согласованы целиком; Durham College не заводить (0 программ).
//
// Города берутся из двух источников и оба названы явно в CITY_SOURCE:
//   'владелец 23.08'  — подтверждено человеком;
//   'карточка <slug>' — город взят из НАШЕЙ ЖЕ карточки головного вуза. Для
//                       подготовительного отделения это не догадка: центр сидит
//                       на кампусе вуза, а город вуза у нас уже проверен.
// Ничего не выдумывается: запись без города не заводится, а уходит кейсом.
//
// Записи одного вуза, разведённые у QS бейджем уровня («(Undergraduate)»,
// «(Postgraduate)», «- Foundation»), сливаются в одну карточку — иначе у Essex
// Online вышло бы три карточки на один вуз. Так же каталог уже держит TAMUCC.
//
// Ядро сборки переиспользуется из kompas-newcards-build.mjs (buildCards):
// схема, разбор уровня, правило «цена только в годовом диапазоне» — те же.
//
// Запуск: node scraper/kompas-cat1-newcards.mjs [--apply]
// Без --apply пишет только черновики и разбор; каталог не трогает.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCards, CITY } from './kompas-newcards-build.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EX = path.join(ROOT, 'sources/kompas/extracts/qs');
const CATALOG = path.join(ROOT, 'site/src/content/universities');
const WORK = path.join(ROOT, 'sources/kompas/catalog-work');
const OUT = path.join(ROOT, 'sources/kompas/newcards');
const APPLY = process.argv.includes('--apply');
const TODAY = '2026-08-23';

const OWNER = 'владелец 23.08';
const fromCard = (slug) => `город карточки \`${slug}\``;

// Ключ — слаг выгрузки в extracts/qs.
const CITIES = {
  // ── подтверждено владельцем 23.08
  'university-of-auckland': ['Auckland', OWNER],
  'university-of-auckland-foundation': ['Auckland', OWNER],
  'ara-institute-of-canterbury': ['Christchurch', OWNER],
  'seattle-university': ['Seattle', OWNER],
  'dld-college-london': ['London', OWNER],
  'mediadesign-university-of-applied-sciences': ['Munich, Düsseldorf, Berlin', OWNER],
  'victoria-university': ['Melbourne', OWNER],
  'university-of-delaware-lerner-college-of-business-and-economics': ['Newark, DE', OWNER],
  'american-business-school-of-paris': ['Paris', OWNER],
  'lci-melbourne-undergraduate': ['Melbourne', OWNER],
  'dublin-international-study-centre': ['Dublin', OWNER],
  'eu-business-school-spain': ['Barcelona', OWNER],
  'arden-university-hybrid': ['Berlin', OWNER],
  'istituto-marangoni-paris': ['Paris', OWNER],
  'istituto-marangoni-dubai': ['Dubai', OWNER],
  'kaplan-international-college-adelaide': ['Adelaide', OWNER],
  'university-of-strathclyde-bahrain': ['Manama', OWNER],
  'university-of-tasmania-international-pathway-college': ['Hobart', OWNER],
  'on-campus-ireland': ['Dublin', OWNER],
  'oxford-international-education-group-english-schools': ['London', OWNER],
  'oxford-international-education-group-ielts-and-tesol': ['London', OWNER],
  'oxford-international-education-group-junior': ['London', OWNER],

  // ── город взят из нашей же карточки головного вуза
  'university-of-oklahoma': ['Norman, OK', fromCard('into-oklahoma')],
  'stony-brook-university-undergraduate': ['Stony Brook, NY', fromCard('into-stony-brook')],
  'university-of-essex-online-certhe-and-postgraduate': ['Colchester', fromCard('essex')],
  'university-of-essex-online-undergraduate': ['Colchester', fromCard('essex')],
  'university-of-essex-online-postgraduate': ['Colchester', fromCard('essex')],
  'brunel-university-london-foundation': ['London', fromCard('brunel')],
  'royal-holloway-university-of-london-international-study-centre': ['Egham', fromCard('royal-holloway-direct-entry')],
  'into-manchester-in-partnership-with-university-of-manchester': ['Manchester', fromCard('into-manchester')],
  'on-campus-paris': ['Paris', fromCard('college-de-paris')],
  'south-australian-institute-of-business-and-technology-saibt-university-of-south-': ['Adelaide', fromCard('unisa')],
  'glasgow-international-college-foundation': ['Glasgow', fromCard('glasgow')],
  'oncampus-london-south-bank-foundation': ['London', fromCard('london-south-bank')],
  'oncampus-loughborough-foundation': ['Loughborough', fromCard('loughborough-university')],
  'university-of-winnipeg-collegiate': ['Winnipeg, MB', fromCard('winnipeg')],
  'university-of-bristol-international-foundation': ['Bristol', fromCard('bristol')],
  'kaplan-international-languages': ['London', fromCard('kaplan-international-college')],
  'university-of-stirling-uae': ['Ras Al Khaimah', fromCard('stirling-rak')],
  'istituto-marangoni-foundation': ['Milan', fromCard('marangoni-milan')],
};

// Не заводим — с обоснованием, чтобы решение было видно, а не потерялось.
const SKIP = {
  'durham-college': 'решение владельца 23.08: 0 программ, заводить нечего',
  'american-collegiate-washington-dc': '0 программ у источника',
  'university-bridge': 'страна расходится: у QS США, владелец назвал Саскатун (Канада) — ждёт уточнения',
  'oxford-international-education-group-north-america-pathway-programs': 'город не назван: у QS Канада без города',
};

// Бейдж уровня у записи QS — не отдельный вуз. Срезаем, чтобы записи одного
// вуза сложились в одну карточку.
const BADGE = /\s*[-–—]?\s*\((?:certhe\s*&\s*)?(?:post|under|un)?grad(?:uate)?\)|\s*[-–—]\s*foundation\b|\s*\(foundation\)/gi;
const stripBadge = (s) => String(s || '').replace(BADGE, '').replace(/\s{2,}/g, ' ').trim();

// Нормализатор имени — тот же приём, что в kompas-inventory.mjs: служебные слова
// выбрасываются, чтобы «Brunel University London» и «Brunel University of London»
// сошлись. Нужен, чтобы не заводить близнеца к уже живой карточке.
const normName = (x) => String(x || '').toLowerCase().normalize('NFKD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/&/g, ' and ')
  .replace(/\b(university|the|of|college|institute|school)\b/g, '')
  .replace(/[^a-z0-9]/g, '').trim();

const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

// ── отбор: всё, что у QS не привязано и не помечено «не вуз»
const rows = [];
const skipped = [];
for (const f of fs.readdirSync(EX).filter((x) => x.endsWith('.json'))) {
  const slug = f.replace(/\.json$/, '');
  const ex = readJson(path.join(EX, f));
  if (ex.catalogSlug || ex.notAnInstitution) continue;
  if (SKIP[slug]) { skipped.push({ slug, name: ex.name, programs: (ex.programs || []).length, why: SKIP[slug] }); continue; }
  if (!CITIES[slug]) { skipped.push({ slug, name: ex.name, programs: (ex.programs || []).length, why: 'города нет в таблице' }); continue; }
  rows.push({ slug, fate: 'new' });
}

// Если после снятия бейджа имя совпало с ЖИВОЙ карточкой той же страны — это не
// новый вуз, а непривязанная выгрузка. Заводить близнеца нельзя: «Brunel University
// London - Foundation» при живой карточке `brunel` дал бы два Брунеля на сайте.
const catalogIndex = new Map();
for (const f of fs.readdirSync(CATALOG).filter((x) => x.endsWith('.json'))) {
  const c = readJson(path.join(CATALOG, f));
  catalogIndex.set(`${normName(c.name)}|${c.country || ''}`, f.replace('.json', ''));
}
const linkedInstead = [];
for (let i = rows.length - 1; i >= 0; i--) {
  const ex = readJson(path.join(EX, `${rows[i].slug}.json`));
  const hit = catalogIndex.get(`${normName(stripBadge(ex.name))}|${ex.country || ''}`);
  if (!hit) continue;
  linkedInstead.push({ qsSlug: rows[i].slug, name: ex.name, catalogSlug: hit, programs: (ex.programs || []).length });
  rows.splice(i, 1);
}

// Города — в таблицу ядра (CITY экспортируется как живой объект).
for (const [k, v] of Object.entries(CITIES)) CITY[k] = v;

const existing = new Set(fs.readdirSync(CATALOG).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', '')));

const { cards, cases } = buildCards({
  rows,
  readExtract: (slug) => {
    const ex = readJson(path.join(EX, `${slug}.json`));
    return { ...ex, name: stripBadge(ex.name) };
  },
  existing,
});

// Ядро проставляет свою дату сборки — поправляем на дату этого прогона.
for (const c of cards) { c.lastChecked = TODAY; if (c._kompas) c._kompas.builtAt = TODAY; }

fs.mkdirSync(OUT, { recursive: true });
for (const c of cards) fs.writeFileSync(path.join(OUT, `${c.slug}.cat1.json`), JSON.stringify(c, null, 1));

const ready = cards.filter((c) => !c._kompas.missing.length);
const draft = cards.filter((c) => c._kompas.missing.length);

for (const c of cards) {
  console.log(`${c._kompas.missing.length ? 'ЧЕРНОВИК' : 'ГОТОВА  '} ${c.slug.padEnd(56)}${String(c.programs.length).padStart(4)}п  цена ${c._kompas.priceKept}${c._kompas.missing.length ? '  нет: ' + c._kompas.missing.join(',') : ''}`);
}

const applied = [];
if (APPLY) {
  for (const l of linkedInstead) {
    const p = path.join(EX, `${l.qsSlug}.json`);
    const ex = readJson(p);
    ex.catalogSlug = l.catalogSlug;
    ex.catalogSlugSource = 'cat1-newcards-2026-08-23 (имя совпало с живой карточкой)';
    fs.writeFileSync(p, JSON.stringify(ex, null, 1));
  }
  for (const c of ready) {
    const { _kompas, ...card } = c;
    fs.writeFileSync(path.join(CATALOG, `${c.slug}.json`), JSON.stringify(card, null, 2));
    // рабочая копия: без пометки источника сверка сочтёт карточку непартнёрской
    fs.writeFileSync(path.join(WORK, `${c.slug}.json`), JSON.stringify({ ...card, partnerSource: { type: 'aggregator', via: ['qs'] } }, null, 2));
    // выгрузки этой карточки — на неё же
    for (const qsSlug of _kompas.qsRecords) {
      const p = path.join(EX, `${qsSlug}.json`);
      const ex = readJson(p);
      ex.catalogSlug = c.slug;
      ex.catalogSlugSource = 'cat1-newcards-2026-08-23';
      fs.writeFileSync(p, JSON.stringify(ex, null, 1));
    }
    applied.push({ slug: c.slug, name: card.name, programs: card.programs.length, city: card.city, qsRecords: _kompas.qsRecords });
  }
  fs.writeFileSync(path.join(OUT, 'cat1-applied.json'), JSON.stringify({ appliedAt: TODAY, cards: applied }, null, 1));
}

fs.writeFileSync(path.join(OUT, 'cat1-cases.json'), JSON.stringify({ generatedAt: TODAY, cases, skipped, linkedInstead }, null, 1));

if (linkedInstead.length) {
  console.log(`\nне заводились, привязаны к живой карточке (${linkedInstead.length}):`);
  for (const l of linkedInstead) console.log(`  ${String(l.programs).padStart(4)}п  «${l.name}» → ${l.catalogSlug}`);
}

console.log(`\nзаписей взято ${rows.length} → карточек ${cards.length} (готовых ${ready.length}, черновиков ${draft.length})`);
console.log(`программ в готовых: ${ready.reduce((s, c) => s + c.programs.length, 0)}`);
console.log(`не заводим ${skipped.length}: ${skipped.map((s) => s.slug).join(', ')}`);
console.log(`кейсов оператору: ${cases.length}`);
console.log(APPLY ? `ПРИМЕНЕНО: ${applied.length} карточек в каталог и рабочую копию` : 'СУХОЙ ПРОГОН');
