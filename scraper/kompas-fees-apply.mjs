#!/usr/bin/env node
// Применение цен агрегаторов в рабочую копию каталога — один движок на все источники.
// Заменяет kompas-qs-fees-apply.mjs, который умел только QS.
//
// Правила (решения владельца 23.08):
//   * цена агрегатора важнее каталожной — пишем поверх;
//   * у одной программы у источника бывает несколько сумм (цена привязана к кампусу
//     и уровню). Пишем МИНИМАЛЬНУЮ, витрина говорит «от …»; все суммы кладём
//     в program.tuitionVariants и раскрываем в строке программы;
//   * валюта попрограммная (program.tuitionCurrency), карточка держит базовую;
//   * когда источник пересчитал цену в чужую для страны кампуса валюту, а есть сумма
//     в валюте карточки или в местной — берём её, пересчёт уходит только в варианты.
//
// Основа цены: у QS берётся из замера qs-fee-basis-map.json (annual / whole-term),
// у edvoy все строки помечены approxAnnual, у kaplan/oxford-international/qahe поле
// называется feePerYear — все они годовые по определению источника.
//
// Запуск: node scraper/kompas-fees-apply.mjs --sources=qs,edvoy [--dry]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildIndex, matchProgram } from './lib/program-match.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EX = path.join(ROOT, 'sources/kompas/extracts');
const WORK = path.join(ROOT, 'sources/kompas/catalog-work');
const MAP_FILE = path.join(ROOT, 'sources/kompas/qs-fee-basis-map.json');
const BACKUP = path.join(ROOT, 'sources/kompas/fees-apply-backup.json');
const REPORT = path.join(ROOT, 'sources/kompas/fees-apply-report.json');
const CASES = path.join(ROOT, 'sources/kompas/fees-apply-cases.json');
const REPORT_MD = path.join(ROOT, 'sources/kompas/FEES-APPLY.md');

const DRY = process.argv.includes('--dry');
const SOURCES = (process.argv.find((a) => a.startsWith('--sources=')) || '--sources=qs,edvoy')
  .slice(10).split(',').map((x) => x.trim()).filter(Boolean);

const CURRENCIES = ['USD', 'EUR', 'GBP', 'KZT', 'RUB', 'CAD', 'AUD', 'NZD', 'CHF',
  'AED', 'HKD', 'THB', 'CNY', 'BHD', 'MYR', 'SGD'];
// те же приблизительные курсы, что у витрины (site/src/content/studyroom/static.ts)
const KZT = { GBP: 600, USD: 480, EUR: 520, CAD: 350, AUD: 320, NZD: 290, CHF: 545,
  AED: 131, HKD: 62, THB: 14, CNY: 66, BHD: 1276, MYR: 108, SGD: 369, KZT: 1, RUB: 6 };
const LOCAL_CURRENCY = {
  'United Arab Emirates': 'AED', Malaysia: 'MYR', Singapore: 'SGD', Switzerland: 'CHF',
  'United Kingdom': 'GBP', Ireland: 'EUR', 'New Zealand': 'NZD', Australia: 'AUD',
  Canada: 'CAD', 'United States': 'USD', Bahrain: 'BHD', China: 'CNY', 'Hong Kong': 'HKD',
  Thailand: 'THB', Kazakhstan: 'KZT', Germany: 'EUR', Spain: 'EUR', France: 'EUR',
  Italy: 'EUR', Netherlands: 'EUR', Austria: 'EUR', Portugal: 'EUR', Greece: 'EUR',
  Finland: 'EUR', Malta: 'EUR', Cyprus: 'EUR', Latvia: 'EUR', Lithuania: 'EUR',
  Estonia: 'EUR', Slovakia: 'EUR', Slovenia: 'EUR', Croatia: 'EUR', Belgium: 'EUR',
};
const inKzt = (v, cur) => v * (KZT[cur] || 500);
const feeOf = (p) => {
  const v = typeof p.tuition === 'number' ? p.tuition
    : typeof p.feePerYear === 'number' ? p.feePerYear : null;
  return v != null && v > 0 ? v : null;
};

const basisOf = new Map();
for (const m of JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'))) {
  basisOf.set(m.slug + '|' + (m.currency || '?') + '|' + m.tuition, m);
}

const cards = new Map(), idx = new Map();
for (const f of fs.readdirSync(WORK)) {
  if (!f.endsWith('.json')) continue;
  const slug = f.replace(/\.json$/, '');
  const card = JSON.parse(fs.readFileSync(path.join(WORK, f), 'utf8'));
  cards.set(slug, card);
  idx.set(slug, buildIndex(card.programs));
}

const cases = [];
const stats = { sources: SOURCES.join(','), extracts: 0, linked: 0,
  candidates: 0, skippedCurrency: 0, skippedBucket: 0, skippedNoMatch: 0, skippedNoCard: 0,
  skippedAudience: 0, skippedPartTime: 0, matchedByAward: 0, ambiguousMatch: 0,
  programsWritten: 0, cardsTouched: 0, overwritten: 0, ownCurrency: 0,
  variantPrograms: 0, variantSums: 0, foreignQuoteDemoted: 0,
  // 3.28: цена подготовительной ступени, выданная за цену степени
  skippedPathwayFee: 0 };

// Строка подготовительной ступени ПЕРЕД магистратурой. Намеренно узко: обычные
// foundation-программы сюда не входят — у них своя законная цена, и по ней в каталоге
// стоят собственные программы. Ловим только приставку к степени.
const PRE_MASTER_TITLE = /pre[-\s'’]*master|extended\s+master/i;
const isPreMasterRow = (ep) => PRE_MASTER_TITLE.test(ep.title || '');
// Строка, которая сама называет подготовительный маршрут: «BEng … with International
// Year One», «Undergraduate Foundation Programme», курсы центров INTO и CEG. У таких
// цена подготовительного года — своя законная цена товара, снимать её нельзя.
const ROUTE_TITLE = /international\s+year\s+one|\biy1\b|foundation|pathway|pre[-\s'’]*sessional/i;
const isRouteRow = (ep) => ep.level === 'foundation' || ROUTE_TITLE.test(ep.title || '');
const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

// slug карточки -> slug программы -> список кандидатов
const pool = new Map();

for (const src of SOURCES) {
  const dir = path.join(EX, src);
  if (!fs.existsSync(dir)) { console.log('нет каталога источника:', src); continue; }
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    stats.extracts++;
    if (d.notAnInstitution || d.noPrograms || d.excludedFromDiff) continue;
    const slug = d.catalogSlug || d.slug;
    if (!slug) continue;
    const card = cards.get(slug);
    if (!card) { stats.skippedNoCard++; continue; }
    stats.linked++;

    // Цена подготовительной ступени, выданная за цену степени (КОМПАС 3.28).
    // Улика лежит в самой выгрузке: у «расширенных» маршрутов на 15 месяцев
    // (Pre-Master's + степень) источник ставит степенной строке цену ПОДГОТОВКИ,
    // и ровно то же число стоит у соседней строки Pre-Master's. Примеры 23.08:
    // Roehampton 4 000 при обычных 16 950–18 250, Sheffield Hallam 4 500 при 17 000,
    // Edinburgh Napier 9 445 при 15 325. По правилу минимума такая сумма выигрывала
    // у настоящей цены и занижала ценник вчетверо.
    // Улик нужно две сразу, одной мало: совпадение суммы бывает и случайным.
    //   1. ровно эта сумма стоит у строки Pre-Master's / Extended Masters того же вуза;
    //   2. она заметно ниже медианы того же источника по этому же вузу.
    const preMasterFees = new Set();
    const ordinaryFees = [];
    for (const ep of (d.programs || [])) {
      const t = feeOf(ep);
      if (t == null) continue;
      if (isPreMasterRow(ep)) preMasterFees.add(t + '|' + (ep.currency || ''));
      else ordinaryFees.push(inKzt(t, ep.currency || ''));
    }
    const medianFee = median(ordinaryFees);

    for (const ep of (d.programs || [])) {
      const t = feeOf(ep);
      if (t == null) continue;
      if (!isPreMasterRow(ep) && !isRouteRow(ep) && preMasterFees.has(t + '|' + (ep.currency || ''))
          && medianFee && inKzt(t, ep.currency || '') < medianFee * 0.75) {
        stats.skippedPathwayFee++;
        cases.push({ source: src, catalogSlug: slug, program: ep.title, tuition: t, currency: ep.currency,
          level: ep.level, duration: ep.duration, medianFee: Math.round(medianFee), reason: 'pathway-stage-fee',
          note: 'та же сумма стоит у строки Pre-Master’s этого вуза и заметно ниже медианы источника — это цена ступени, а не степени' });
        continue;
      }
      // Цена не для международного студента в выбор не идёт: у qahe 20 строк из 102
      // помечены feeAudience: unknown, и там британский внутренний тариф 9 790 GBP —
      // он выиграл бы минимум и занизил ценник вдвое.
      if (ep.feeAudience && ep.feeAudience !== 'international') {
        stats.skippedAudience++;
        cases.push({ source: src, catalogSlug: slug, program: ep.title, tuition: t, currency: ep.currency,
          feeAudience: ep.feeAudience, feeLabel: ep.feeLabel, reason: 'fee-audience',
          note: 'цена не помечена как международная — оператору' });
        continue;
      }
      // Заочная форма дешевле очной и с ней несравнима.
      if (ep.studyMode && /part[\s-]*time/i.test(ep.studyMode)) {
        stats.skippedPartTime++;
        cases.push({ source: src, catalogSlug: slug, program: ep.title, tuition: t, currency: ep.currency,
          studyMode: ep.studyMode, reason: 'part-time', note: 'заочная форма — с очной не сравнивается' });
        continue;
      }
      const cur = ep.currency || null;
      if (!CURRENCIES.includes(cur)) {
        stats.skippedCurrency++;
        cases.push({ source: src, catalogSlug: slug, program: ep.title, tuition: t,
          currency: cur, reason: 'currency-unsupported', note: 'валюты нет в схеме каталога' });
        continue;
      }
      let basis = 'year';
      if (src === 'qs') {
        const m = basisOf.get((d.slug || f.replace(/\.json$/, '')) + '|' + cur + '|' + t);
        const bucket = m ? m.bucket : 'unknown';
        if (bucket === 'whole-term' && m.ratio > 12) {
          stats.skippedBucket++;
          cases.push({ source: src, catalogSlug: slug, program: ep.title, tuition: t, currency: cur,
            ratio: m.ratio, reason: 'whole-term-implausible',
            note: 'отношение к годовому диапазону ' + m.ratio + ' — диапазон источника мусорный' });
          continue;
        }
        if (bucket !== 'annual' && bucket !== 'whole-term') {
          stats.skippedBucket++;
          cases.push({ source: src, catalogSlug: slug, program: ep.title, tuition: t, currency: cur,
            bucket, reason: 'bucket', note: 'разряд основы цены не определился — оператору' });
          continue;
        }
        if (bucket === 'whole-term') basis = 'program';
      }
      const hit = matchProgram(idx.get(slug), ep);
      const target = hit.program;
      if (!target || !target.slug) {
        stats.skippedNoMatch++;
        if (hit.how === 'ambiguous') stats.ambiguousMatch++;
        cases.push({ source: src, catalogSlug: slug, program: ep.title, tuition: t, currency: cur,
          reason: hit.how === 'ambiguous' ? 'match-ambiguous' : 'no-match',
          note: hit.how === 'ambiguous'
            ? 'после снятия приставки степени подходит больше одной программы карточки — привязывать нельзя'
            : 'программа выгрузки не нашлась в карточке' });
        continue;
      }
      if (hit.how === 'award-stripped') stats.matchedByAward++;
      stats.candidates++;
      if (!pool.has(slug)) pool.set(slug, new Map());
      const m2 = pool.get(slug);
      if (!m2.has(target.slug)) m2.set(target.slug, []);
      const cc = ep.campusCosts || {};
      // площадку называют по-разному: edvoy массивом campuses, oxford-international
      // строкой campus; QS не даёт ни того ни другого
      const campus = (Array.isArray(ep.campuses) && ep.campuses.length
        ? ep.campuses.map((c) => (typeof c === 'string' ? c : (c && (c.name || c.city))))
          .filter(Boolean).join(', ')
        : (typeof ep.campus === 'string' ? ep.campus : '')) || undefined;
      m2.get(target.slug).push({ target, t, cur, basis, source: src,
        level: ep.sourceLevel || undefined,
        degreeGroup: ep.degreeGroup || undefined,
        campus,
        accommodation: cc.accommodation > 0 ? cc.accommodation : undefined,
        other: cc.other > 0 ? cc.other : undefined,
        total: cc.total > 0 ? cc.total : undefined });
    }
  }
}

const backup = {}, changes = [];
for (const [slug, byProgram] of pool) {
  const card = cards.get(slug);
  const cardCur = card.tuition && card.tuition.currency;
  const local = LOCAL_CURRENCY[card.country];
  const progs = card.programs || [];
  backup[slug] = {
    tuition: JSON.parse(JSON.stringify(card.tuition || {})),
    tuitionBasis: Object.fromEntries(progs.filter((p) => p.tuitionBasis).map((p) => [p.slug, p.tuitionBasis])),
    tuitionCurrency: Object.fromEntries(progs.filter((p) => p.tuitionCurrency).map((p) => [p.slug, p.tuitionCurrency])),
    tuitionVariants: Object.fromEntries(progs.filter((p) => p.tuitionVariants).map((p) => [p.slug, p.tuitionVariants])),
  };
  if (!card.tuition) card.tuition = { currency: null, byProgram: {} };
  if (!card.tuition.byProgram) card.tuition.byProgram = {};
  stats.cardsTouched++;

  for (const [progSlug, list] of byProgram) {
    const target = list[0].target;
    // Родная валюта важнее пересчитанной: сперва ищем суммы в валюте карточки или
    // в местной валюте страны кампуса, и только если таких нет — берём что есть.
    const native = list.filter((c) => c.cur === cardCur || (local && c.cur === local));
    const usable = native.length ? native : list;
    if (native.length && native.length < list.length) stats.foreignQuoteDemoted += list.length - native.length;
    const chosen = usable.reduce((a, b) => (inKzt(b.t, b.cur) < inKzt(a.t, a.cur) ? b : a));

    const prev = card.tuition.byProgram[progSlug];
    if (!card.tuition.currency) card.tuition.currency = chosen.cur;
    if (prev != null && prev > 0) stats.overwritten++;
    card.tuition.byProgram[progSlug] = chosen.t;
    if (chosen.cur !== card.tuition.currency) { target.tuitionCurrency = chosen.cur; stats.ownCurrency++; }
    else delete target.tuitionCurrency;
    if (chosen.basis === 'program') target.tuitionBasis = 'program';
    else delete target.tuitionBasis;

    // варианты: все суммы источников, без повторов по «сумма+валюта+источник»
    const seen = new Set();
    const variants = list
      .filter((c) => { const k = c.t + '|' + c.cur + '|' + c.source; return !seen.has(k) && seen.add(k); })
      .sort((a, b) => inKzt(a.t, a.cur) - inKzt(b.t, b.cur))
      .map((c) => {
        const v = { tuition: c.t, currency: c.cur, source: c.source };
        for (const k of ['campus', 'level', 'degreeGroup', 'accommodation', 'other', 'total']) {
          if (c[k] != null) v[k] = c[k];
        }
        return v;
      });
    const distinctSums = new Set(variants.map((v) => v.tuition + '|' + v.currency));
    if (distinctSums.size > 1) {
      target.tuitionVariants = variants;
      stats.variantPrograms++;
      stats.variantSums += distinctSums.size;
    } else if (target.tuitionVariants) delete target.tuitionVariants;

    stats.programsWritten++;
    changes.push({ catalogSlug: slug, program: progSlug, fee: chosen.t, currency: chosen.cur,
      source: chosen.source, variants: distinctSums.size > 1 ? distinctSums.size : undefined,
      prev: prev != null ? prev : null });
  }
  if (!DRY) fs.writeFileSync(path.join(WORK, slug + '.json'), JSON.stringify(card, null, 2));
}

if (!DRY) fs.writeFileSync(BACKUP, JSON.stringify(backup, null, 1));
fs.writeFileSync(REPORT, JSON.stringify({ dry: DRY, sources: SOURCES, stats, changes }, null, 1));
fs.writeFileSync(CASES, JSON.stringify(cases, null, 1));
const byReason = {};
for (const c of cases) byReason[c.reason] = (byReason[c.reason] || 0) + 1;
let md = '# Применение цен агрегаторов\n\n' + (DRY ? '**Прогон вхолостую (--dry).**\n\n' : '');
md += 'Источники: `' + SOURCES.join('`, `') + '`.\n\n| Показатель | Значение |\n|---|---:|\n';
for (const k of Object.keys(stats)) {
  const v = stats[k];
  md += '| ' + k + ' | ' + (v && typeof v === 'object'
    ? Object.entries(v).map(([s, c]) => s + ': ' + c).join(', ') : v) + ' |\n';
}
md += '\n## Не записано\n\n| Причина | Штук |\n|---|---:|\n';
for (const k of Object.keys(byReason).sort((a, b) => byReason[b] - byReason[a])) md += '| `' + k + '` | ' + byReason[k] + ' |\n';
md += '\nПодробности: `fees-apply-cases.json`, откат: `fees-apply-backup.json`.\n';
fs.writeFileSync(REPORT_MD, md);
console.log(JSON.stringify(stats, null, 1));
console.log('кейсы:', JSON.stringify(byReason));
