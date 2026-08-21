// КОМПАС — категория 1: крепление выгрузок QS к карточкам каталога.
//
// Разбор 21.08: из 512 выгрузок QS 111 не привязаны (2925 программ). Пересчёт по
// `extracts/qs` (не по membership — тот снимок портала и о привязке не знает).
// Оказалось, что «есть у агрегатора, нет в каталоге» почти всегда неверно:
// карточка есть, привязки нет. Заводить новое нужно единицам.
//
// Здесь применяется только то, где решать нечего:
//   SAME  — слаг выгрузки буква в букву равен слагу карточки, страна сходится.
//           Это карточки, заведённые 20.08: привязка не была прописана.
//   PAIRS — пары, названные явно. Порог сходства их не берёт («UCAM Universidad
//           Catolica San Antonio de Murcia» против `ucam-murcia`), но это один
//           и тот же вуз: имя, страна и город сходятся, кандидат единственный.
//   VOID  — записи портала, не являющиеся учебным заведением (решение 20.08).
//
// Спорное сюда не попадает: подготовительные отделения, чужие кампусы сети и
// однофамильцы разобраны в sources/kompas/CAT1-REVIEW.md и ждут владельца.
//
// Живой каталог не трогается: пишется только поле catalogSlug в extracts/qs.
// Откат — sources/kompas/qs-relink-cat1-backup.json.
//
// Запуск: node scraper/kompas-qs-relink-cat1.mjs [--apply]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EX = path.join(ROOT, 'sources/kompas/extracts/qs');
const CATALOG = path.join(ROOT, 'site/src/content/universities');
const BACKUP = path.join(ROOT, 'sources/kompas/qs-relink-cat1-backup.json');
const REPORT = path.join(ROOT, 'sources/kompas/qs-relink-cat1.json');
const APPLY = process.argv.includes('--apply');

// Пары «выгрузка → карточка». Слева слаг файла в extracts/qs, справа слаг карточки.
const PAIRS = [
  // карточки, заведённые 20.08 — слаг выгрузки отличается от слага карточки
  ['university-of-worcester-undergraduate', 'university-of-worcester'],
  ['university-of-worcester-postgraduate', 'university-of-worcester'],
  ['university-of-west-of-england-bristol-international-college-uwe-bristol-foundati', 'university-of-the-west-of-england-bristol-international-college-uwe-bristol-foun'],
  ['northumbria-university-london-campus-qahe-lz1dz7he', 'northumbria-university-london-campus-qahe'],
  ['hague-university-of-applied-science-foundation', 'the-hague-university-of-applied-science-foundation'],
  // слаг совпал, но карточка чужая: у QS это Мальта, а `global-banking-school` — Лондон
  ['global-banking-school', 'gbs-malta'],
  // разряд «надёжно» из QS-UNLINKED-REPORT.md (0.75–0.83, страна та же) — задача 1.6
  ['cardenal-herrera-ceu', 'cardenal-herrera-valencia'],
  ['naba-nuova-accademia-di-belle-arti-milano', 'naba-milano'],
  ['naba-nuova-accademia-di-belle-arti-foundation', 'naba-milano'],
  ['rochester-institute-of-technology-rit-dubai-undergraduate', 'rit-dubai'],
  ['rochester-institute-of-technology-rit-dubai-postgraduate', 'rit-dubai'],
  ['cretin-derham-hall-high-school', 'cretin-derham-hall'],
  ['queen-mary-university-in-malta', 'queen-mary-malta'],
  ['royal-college-of-surgeons-ireland-rcsi-foundation', 'rcsi'],
  // тот же вуз, имя у QS длиннее или короче каталожного
  ['ucam-universidad-catolica-san-antonio-de-murcia', 'ucam-murcia'],
  ['asia-pacific-university', 'apu-malaysia'],
  ['university-of-wollongong-malaysia-kdu', 'wollongong-malaysia'],
  ['istituto-marangoni-milan', 'marangoni-milan'],
  ['thompson-rivers-university-in-british-columbia', 'thompson-rivers'],
  ['san-pablo-ceu', 'san-pablo-ceu-madrid'],
  ['florida-international-university-fiu', 'florida-international'],
  ['abat-oliba-ceu', 'abat-oliba-barcelona'],
  ['queens-college', 'queens-college-cuny'],
  ['new-york-institute-of-technology-nyit-postgraduate', 'nyit'],
  ['new-york-institute-of-technology-nyit-undergraduate', 'nyit'],
  ['fox-school-of-business-temple-university', 'fox-temple'],
  ['trinity-western-university-postgraduate', 'trinity-western'],
  ['webster-university-in-vienna-austria', 'webster-vienna'],
  ['business-hotel-management-school', 'bhms'],
  ['queen-ethelburgas-collegiate', 'queen-ethelburgas'],
  ['university-of-canberra-sydney-hills', 'canberra-sydney'],
  ['american-collegiate-los-angeles', 'american-collegiate-la'],
  ['royal-veterinary-college-university-of-london-foundation', 'rvc'],
  // Les Roches: у QS четыре записи, страна различает кампус
  ['les-roches-postgraduate', 'les-roches-crans-montana'],
  ['les-roches-undegraduate-svrxwyhw', 'les-roches-crans-montana'],
  ['les-roches-undegraduate', 'les-roches-marbella'],
  ['les-roches-postgraduate-fdkgswdc', 'les-roches-marbella'],
];

// Не учебные заведения — разделы интерфейса портала (решение владельца 20.08).
const VOID = ['indian-internal-applications', 'testing-december-testing-purpose'];

const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const cardPath = (s) => path.join(CATALOG, s + '.json');

const rows = [];
const backup = [];
let programs = 0;

function link(qsSlug, cardSlug, kind) {
  const src = path.join(EX, qsSlug + '.json');
  if (!fs.existsSync(src)) return rows.push({ qsSlug, cardSlug, kind, ok: false, why: 'нет выгрузки QS' });
  if (!fs.existsSync(cardPath(cardSlug))) return rows.push({ qsSlug, cardSlug, kind, ok: false, why: 'нет карточки в каталоге' });

  const ex = read(src);
  if (ex.catalogSlug) {
    const same = ex.catalogSlug === cardSlug;
    return rows.push({ qsSlug, cardSlug, kind, ok: false, why: same ? 'уже привязана' : 'уже привязана к ' + ex.catalogSlug });
  }
  const card = read(cardPath(cardSlug));
  if (card.country && ex.country && card.country !== ex.country) {
    return rows.push({ qsSlug, cardSlug, kind, ok: false, why: 'страна расходится: QS ' + ex.country + ', карточка ' + card.country });
  }
  const n = (ex.programs || []).length;
  backup.push({ file: qsSlug + '.json', catalogSlug: null });
  if (APPLY) {
    ex.catalogSlug = cardSlug;
    ex.catalogSlugSource = 'relink-cat1-2026-08-21';
    fs.writeFileSync(src, JSON.stringify(ex, null, 1));
  }
  programs += n;
  rows.push({ qsSlug, cardSlug, kind, ok: true, programs: n, card: card.name });
}

// SAME: слаг выгрузки равен слагу карточки
const pairSlugs = new Set(PAIRS.map((p) => p[0]));
for (const f of fs.readdirSync(EX).filter((x) => x.endsWith('.json'))) {
  const slug = f.replace(/\.json$/, '');
  if (pairSlugs.has(slug) || VOID.includes(slug)) continue;
  const ex = read(path.join(EX, f));
  if (ex.catalogSlug) continue;
  if (fs.existsSync(cardPath(slug))) link(slug, slug, 'same-slug');
}
for (const p of PAIRS) link(p[0], p[1], 'pair');

// VOID: вывести из сверки, не привязывая
const voided = [];
for (const slug of VOID) {
  const src = path.join(EX, slug + '.json');
  if (!fs.existsSync(src)) { voided.push({ slug, ok: false, why: 'нет выгрузки' }); continue; }
  const ex = read(src);
  if (ex.notAnInstitution) { voided.push({ slug, ok: false, why: 'уже помечена' }); continue; }
  backup.push({ file: slug + '.json', notAnInstitution: false });
  if (APPLY) {
    ex.notAnInstitution = true;
    ex.notAnInstitutionReason = 'раздел портала QS, не учебное заведение (решение владельца 2026-08-20)';
    fs.writeFileSync(src, JSON.stringify(ex, null, 1));
  }
  voided.push({ slug, ok: true, programs: (ex.programs || []).length });
}

const okRows = rows.filter((r) => r.ok);
const skipped = rows.filter((r) => !r.ok);
const out = { generatedAt: '2026-08-21', applied: APPLY, linked: okRows.length, programs, voided, rows };
if (APPLY) {
  fs.writeFileSync(BACKUP, JSON.stringify(backup, null, 1));
  fs.writeFileSync(REPORT, JSON.stringify(out, null, 1));
}

console.log((APPLY ? 'ПРИВЯЗАНО' : 'СУХОЙ ПРОГОН') + ': ' + okRows.length + ' выгрузок, ' + programs + ' программ');
console.log('  по слагу: ' + okRows.filter((r) => r.kind === 'same-slug').length + ', по таблице: ' + okRows.filter((r) => r.kind === 'pair').length);
console.log('  помечено «не вуз»: ' + voided.filter((v) => v.ok).length);
if (skipped.length) {
  console.log('\nПропущено ' + skipped.length + ':');
  for (const r of skipped) console.log('  ' + r.qsSlug + ' → ' + r.cardSlug + ': ' + r.why);
}
