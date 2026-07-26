#!/usr/bin/env node
// kompas-merge-dupes.mjs — КОМПАС: слияние дублей каталога в одну карточку.
//
// Решение владельца 2026-07-24: «сливай все воедино». Три пары, найденные попутно
// в сессии 4.5 — один вуз под двумя карточками:
//   niagara-falls        ← university-of-niagara-falls
//   humber-college       ← humber-polytechnic
//   university-of-law    ← the-university-of-law
//
// Решение владельца 2026-07-26 (сессия 6): «объединением, дополнять карточки друг
// другом, без повторов; оставлять более полную». Ещё шесть пар — четыре «… Direct Entry»
// и два разночтения имени, найденные kompas-dupe-scan.mjs и разбором дыр P3.8:
//   fisher-college (78)  ← fisher-college-boston (42)
//   ism-germany (43)     ← international-school-of-management-ism (1)
//   liu-brooklyn (89)    ← long-island-university-brooklyn-direct-entry (2)
//   liu-post (144)       ← long-island-university-post-direct-entry (2)
//   tamucc (121)         ← texas-aandm-corpus-christi-university-direct-entry (2)
//   royal-holloway (496) ← royal-holloway-direct-entry (3)
//
// В каждой паре оставляем БОЛЕЕ ПОЛНУЮ карточку (офсайт как источник, больше
// программ, логотип, описания) и вливаем вторую ОБЪЕДИНЕНИЕМ. Ключевая тонкость,
// оплаченная парой University of Law: у сливаемой карточки бывают цены на программы,
// которых у оставляемой нет, — при совпадении названия цену ПЕРЕНОСИМ, иначе теряем
// 89 цен на ровном месте. Валюту при этом сверяем: перенести число из GBP-карточки
// в CAD-карточку нельзя (схема хранит одну валюту на карточку).
//
// Живой каталог НЕ трогаем: всё в sources/kompas/catalog-work. Сливаемая карточка
// НЕ удаляется — помечается mergedInto, снятие делает сессия 5.
//
// Запуск: node kompas-merge-dupes.mjs [--apply]

import fs from 'node:fs/promises';
import path from 'node:path';
import { KOMPAS_DIR, args, logger } from './lib/kompas-collect.mjs';

const log = logger('merge');
const APPLY = args.has('apply');
const WORK = path.join(KOMPAS_DIR, 'catalog-work');
const MAP_FILE = path.join(KOMPAS_DIR, 'partner-source-map.json');
const TODAY = new Date().toISOString().slice(0, 10);

const readJson = async (f) => JSON.parse(await fs.readFile(f, 'utf8'));
const writeJson = async (f, o) => { if (APPLY) await fs.writeFile(f, JSON.stringify(o, null, 2) + '\n', 'utf8'); };

const normTitle = (s) => (s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
const dedupKey = (title, level) => `${normTitle(title)}|${level || ''}`;
const normCampus = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Пары: [оставляем, сливаем]. Порядок выбран по полноте карточки, не по алфавиту.
// tag — в какой сессии пара решена: он уходит в id кейса, чтобы решение оператора по
// старым парам не перезаписалось новым прогоном.
const PAIRS = [
  { keep: 'niagara-falls', drop: 'university-of-niagara-falls', tag: 'session4.5-merge' },
  { keep: 'humber-college', drop: 'humber-polytechnic', tag: 'session4.5-merge' },
  { keep: 'university-of-law', drop: 'the-university-of-law', tag: 'session4.5-merge' },
  { keep: 'fisher-college', drop: 'fisher-college-boston', tag: 'session6-merge' },
  { keep: 'ism-germany', drop: 'international-school-of-management-ism', tag: 'session6-merge' },
  { keep: 'liu-brooklyn', drop: 'long-island-university-brooklyn-direct-entry', tag: 'session6-merge' },
  { keep: 'liu-post', drop: 'long-island-university-post-direct-entry', tag: 'session6-merge' },
  { keep: 'tamucc', drop: 'texas-aandm-corpus-christi-university-direct-entry', tag: 'session6-merge' },
  { keep: 'royal-holloway', drop: 'royal-holloway-direct-entry', tag: 'session6-merge' },
];

// Агрегаторы, чьи выгрузки лежат по слагу. При слиянии выгрузку сливаемой карточки
// надо перенести на слаг оставленной — иначе метка источника есть, а данных под
// новым слагом нет, и замер объявит «сверить не с чем» (ровно stale-mark).
const AGG_DIRS = ['kaplan', 'oxford-international', 'qahe', 'studygroup', 'edvoy', 'gedu', 'direct', 'iapro'];

async function relocateExtracts(dropSlug, keepSlug) {
  const moved = [];
  for (const agg of AGG_DIRS) {
    const from = path.join(KOMPAS_DIR, 'extracts', agg, `${dropSlug}.json`);
    const to = path.join(KOMPAS_DIR, 'extracts', agg, `${keepSlug}.json`);
    let src;
    try { src = await readJson(from); } catch { continue; }
    try { await fs.access(to); moved.push(`${agg}: у ${keepSlug} уже есть — не трогаю`); continue; } catch { /* цели нет — переносим */ }
    src.slug = keepSlug;
    src.mergedFromSlug = dropSlug;
    if (APPLY) {
      await fs.writeFile(to, JSON.stringify(src, null, 2) + '\n', 'utf8');
      await fs.rm(from); // оригинал убираем: под слагом дубля он теперь сирота
    }
    moved.push(`${agg}: ${dropSlug} → ${keepSlug}`);
  }
  return moved;
}

const cases = [];
const addCase = (slug, name, issue, severity, detail, tag) => cases.push({
  id: `${slug}||${issue}||${tag}`,
  slug, name, issue, severity, detail,
  catalog: null, official: null, program: null, sourceUrl: null,
  checkedAt: new Date().toISOString(), decision: null, decidedAt: null, applied: false,
});

// Числа слияний, измеренные первым прогоном против ЧИСТОГО каталога. Нужны потому,
// что merge идемпотентен: на втором прогоне programs дедуплицируются и «добавлено»
// станет 0. Чтобы отчёт не врал при повторе, дельты берём отсюда, а не пересчётом.
const KNOWN = {
  'university-of-niagara-falls': { added: 1, feesMoved: 1, feesEnriched: 7, dlMoved: 8, campusesAdded: 0, feesSkippedCurrency: 0, scholarshipsAdded: 0, accommodationAdded: 0, photoSetsTaken: 0, totalPrograms: 54 },
  'humber-polytechnic': { added: 6, feesMoved: 0, feesEnriched: 0, dlMoved: 0, campusesAdded: 1, feesSkippedCurrency: 0, scholarshipsAdded: 0, accommodationAdded: 0, photoSetsTaken: 0, totalPrograms: 29 },
  'the-university-of-law': { added: 3, feesMoved: 3, feesEnriched: 86, dlMoved: 90, campusesAdded: 0, feesSkippedCurrency: 0, scholarshipsAdded: 0, accommodationAdded: 0, photoSetsTaken: 0, totalPrograms: 202 },
  // Сессия 6, замерено первым прогоном 2026-07-26 против каталога до слияния.
  'fisher-college-boston': { added: 19, feesMoved: 9, feesEnriched: 17, dlMoved: 26, campusesAdded: 0, feesSkippedCurrency: 0, scholarshipsAdded: 0, accommodationAdded: 0, photoSetsTaken: 0, totalPrograms: 97 },
  'international-school-of-management-ism': { added: 1, feesMoved: 1, feesEnriched: 0, dlMoved: 1, campusesAdded: 0, feesSkippedCurrency: 0, scholarshipsAdded: 0, accommodationAdded: 0, photoSetsTaken: 0, totalPrograms: 44 },
  'long-island-university-brooklyn-direct-entry': { added: 2, feesMoved: 2, feesEnriched: 0, dlMoved: 0, campusesAdded: 0, feesSkippedCurrency: 0, scholarshipsAdded: 0, accommodationAdded: 0, photoSetsTaken: 1, totalPrograms: 91 },
  'long-island-university-post-direct-entry': { added: 2, feesMoved: 2, feesEnriched: 0, dlMoved: 0, campusesAdded: 0, feesSkippedCurrency: 0, scholarshipsAdded: 0, accommodationAdded: 0, photoSetsTaken: 1, totalPrograms: 146 },
  'texas-aandm-corpus-christi-university-direct-entry': { added: 2, feesMoved: 0, feesEnriched: 0, dlMoved: 0, campusesAdded: 0, feesSkippedCurrency: 0, scholarshipsAdded: 2, accommodationAdded: 0, photoSetsTaken: 1, totalPrograms: 123 },
  'royal-holloway-direct-entry': { added: 3, feesMoved: 0, feesEnriched: 0, dlMoved: 0, campusesAdded: 0, feesSkippedCurrency: 0, scholarshipsAdded: 2, accommodationAdded: 0, photoSetsTaken: 1, totalPrograms: 499 },
};

async function mergePair(keepSlug, dropSlug, tag, MAP, backup) {
  const keep = await readJson(path.join(WORK, `${keepSlug}.json`));
  const drop = await readJson(path.join(WORK, `${dropSlug}.json`));
  const alreadyMerged = (keep.mergedFrom ?? []).includes(dropSlug);

  // Бэкап на откат — ДО первой правки и только один раз за пару. Если карточка уже
  // слита, а бэкапа нет (пары сессии 4.5 слиты до того, как бэкап появился), снимок
  // сделать нечем: писать текущее состояние в «оригинал» значит соврать про откат.
  if (!backup[dropSlug]) {
    backup[dropSlug] = alreadyMerged
      ? { keep: keepSlug, note: 'слито до появления бэкапа — откат только через git' }
      // structuredClone обязателен: keep/drop правятся ниже по месту, и ссылка
      // в бэкапе показала бы уже слитое состояние вместо исходного.
      : { keep: keepSlug, mergedAt: TODAY, cards: { [keepSlug]: structuredClone(keep), [dropSlug]: structuredClone(drop) } };
  }

  keep.tuition ??= { byProgram: {} };
  keep.tuition.byProgram ??= {};
  keep.deadlines ??= {};
  const sameCurrency = (keep.tuition.currency ?? null) === (drop.tuition?.currency ?? null);
  const dropFees = drop.tuition?.byProgram ?? {};
  const dropDl = drop.deadlines ?? {};

  const byKey = new Map();
  for (const p of keep.programs ?? []) byKey.set(dedupKey(p.title, p.level), p);
  const usedSlugs = new Set((keep.programs ?? []).map((p) => p.slug));

  let added = 0; let feesMoved = 0; let feesEnriched = 0; let dlMoved = 0; let feesSkippedCurrency = 0;

  for (const dp of drop.programs ?? []) {
    const key = dedupKey(dp.title, dp.level);
    const hit = byKey.get(key);
    if (hit) {
      // Совпадение: программу не дублируем, но если у оставляемой карточки цены на
      // неё НЕТ, а у сливаемой ЕСТЬ — переносим (обогащение). Это и есть 89 цен U of Law.
      if (keep.tuition.byProgram[hit.slug] === undefined && dropFees[dp.slug] !== undefined) {
        if (sameCurrency) { keep.tuition.byProgram[hit.slug] = dropFees[dp.slug]; feesEnriched++; }
        else feesSkippedCurrency++;
      }
      if (keep.deadlines[hit.slug] === undefined && dropDl[dp.slug] !== undefined) {
        keep.deadlines[hit.slug] = dropDl[dp.slug]; dlMoved++;
      }
      continue;
    }
    // Новая программа: слаг, не пересекающийся с оставляемой карточкой.
    let slug = dp.slug;
    if (usedSlugs.has(slug)) { let n = 1; while (usedSlugs.has(`${slug}-${++n}`)); slug = `${slug}-${n}`; }
    usedSlugs.add(slug);
    const np = { ...dp, slug };
    keep.programs.push(np);
    byKey.set(key, np);
    added++;
    if (dropFees[dp.slug] !== undefined) {
      if (sameCurrency) { keep.tuition.byProgram[slug] = dropFees[dp.slug]; feesMoved++; }
      else feesSkippedCurrency++;
    }
    if (dropDl[dp.slug] !== undefined) { keep.deadlines[slug] = dropDl[dp.slug]; dlMoved++; }
  }

  // Кампусы — объединением по нормализованному заголовку.
  let campusesAdded = 0;
  if (Array.isArray(drop.campuses) && drop.campuses.length) {
    keep.campuses ??= [];
    const have = new Set(keep.campuses.map((c) => normCampus(c.title || c.name || '')));
    for (const c of drop.campuses) {
      const t = normCampus(c.title || c.name || '');
      if (!t || have.has(t)) continue;
      have.add(t); keep.campuses.push(c); campusesAdded++;
    }
  }

  // Стипендии — объединением по названию. У texas-aandm-…-direct-entry и
  // royal-holloway-direct-entry они есть, а у оставляемых карточек этих записей нет:
  // без переноса слияние молча выбросило бы данные, которых больше взять негде.
  let scholarshipsAdded = 0;
  if (Array.isArray(drop.scholarships) && drop.scholarships.length) {
    keep.scholarships ??= [];
    const have = new Set(keep.scholarships.map((s) => normTitle(s.name)));
    for (const s of drop.scholarships) {
      const t = normTitle(s.name);
      if (!t || have.has(t)) continue;
      have.add(t); keep.scholarships.push(s); scholarshipsAdded++;
    }
  }

  // Жильё — тем же правилом объединения по названию.
  let accommodationAdded = 0;
  if (Array.isArray(drop.accommodation) && drop.accommodation.length) {
    keep.accommodation ??= [];
    const have = new Set(keep.accommodation.map((a) => normTitle(a.name)));
    for (const a of drop.accommodation) {
      const t = normTitle(a.name);
      if (!t || have.has(t)) continue;
      have.add(t); keep.accommodation.push(a); accommodationAdded++;
    }
  }

  // Фотонаборы — только если у оставляемой их нет вовсе (правило описания и логотипа:
  // дыру заполняем, поверх непустого не кладём). Галерею НЕ сливаем сознательно: у
  // оставляемых карточек она уже полная, а второй комплект снимков того же кампуса —
  // это не дополнение, а удвоение с риском чужого фото.
  let photoSetsTaken = 0;
  if (!keep.photoSets && drop.photoSets) { keep.photoSets = drop.photoSets; photoSetsTaken = 1; }

  // Метки источника — объединением. Обе карточки — один вуз, партнёрство через
  // РАЗНЫЕ агрегаторы (qs у одной, edvoy у другой) должно сложиться, а не потеряться.
  const via = new Set([...(keep.partnerSource?.via ?? []), ...(drop.partnerSource?.via ?? [])]);
  const type = (keep.partnerSource?.type === 'direct' || drop.partnerSource?.type === 'direct')
    ? 'direct' : (via.size ? 'aggregator' : 'none');
  keep.partnerSource = { type, via: [...via] };
  MAP[keepSlug] = { type, via: [...via] };

  // Недостающие у оставляемой поля добираем из сливаемой (не затирая имеющиеся).
  if (!keep.logoUrl && drop.logoUrl) keep.logoUrl = drop.logoUrl;
  if (!keep.officialUrl && drop.officialUrl) keep.officialUrl = drop.officialUrl;
  const keepDescr = (keep.description?.paragraphs?.length || keep.description?.paragraphsRu?.length || 0);
  const dropDescr = (drop.description?.paragraphs?.length || drop.description?.paragraphsRu?.length || 0);
  if (!keepDescr && dropDescr && drop.description) keep.description = drop.description;

  keep.lastChecked = TODAY;
  keep.mergedFrom = [...new Set([...(keep.mergedFrom ?? []), dropSlug])];
  await writeJson(path.join(WORK, `${keepSlug}.json`), keep);

  // Сливаемая карточка остаётся на месте, помечена. Метку источника гасим и её,
  // и в карте — чтобы замер не считал вуз дважды.
  drop.mergedInto = keepSlug;
  drop.mergedAt = TODAY;
  drop.partnerSource = { type: 'none', via: [] };
  await writeJson(path.join(WORK, `${dropSlug}.json`), drop);
  MAP[dropSlug] = { type: 'none', via: [] };

  const relocated = await relocateExtracts(dropSlug, keepSlug);
  if (relocated.length) log(`  выгрузки: ${relocated.join('; ')}`);

  // Для отчёта — измеренные дельты. При повторном прогоне пересчёт даёт нули
  // (программы уже слиты), поэтому берём зафиксированные числа первого слияния.
  const m = alreadyMerged && KNOWN[dropSlug]
    ? { ...KNOWN[dropSlug] }
    : { added, feesMoved, feesEnriched, dlMoved, campusesAdded, feesSkippedCurrency, scholarshipsAdded, accommodationAdded, photoSetsTaken, totalPrograms: keep.programs.length };
  ({ added, feesMoved, feesEnriched, dlMoved, campusesAdded, feesSkippedCurrency } = m);
  scholarshipsAdded = m.scholarshipsAdded ?? scholarshipsAdded;
  accommodationAdded = m.accommodationAdded ?? accommodationAdded;
  photoSetsTaken = m.photoSetsTaken ?? photoSetsTaken;

  const feeNote = feesSkippedCurrency
    ? ` ${feesSkippedCurrency} цен НЕ перенесено — валюта карточек разная (${keep.tuition.currency} vs ${drop.tuition?.currency}).`
    : '';
  const decidedOn = tag === 'session4.5-merge' ? '2026-07-24' : '2026-07-26';
  const extraNote = [
    scholarshipsAdded ? `стипендий перенесено ${scholarshipsAdded}` : '',
    accommodationAdded ? `вариантов жилья ${accommodationAdded}` : '',
    photoSetsTaken ? 'взяты фотонаборы дубля (у оставленной их не было)' : '',
  ].filter(Boolean).join(', ');
  addCase(keepSlug, keep.name, 'kompas_dupe_merged', 'warning',
    `Дубль «${dropSlug}» слит сюда (решение владельца ${decidedOn}). Программ добавлено ${added} (стало ${keep.programs.length}), цен перенесено ${feesMoved}, цен добавлено на совпавшие программы ${feesEnriched}, дедлайнов ${dlMoved}, кампусов ${campusesAdded}.${extraNote ? ` Кроме программ: ${extraNote}.` : ''}${feeNote} Метки источников объединены: ${[...via].join(', ') || '—'}. Файл дубля оставлен с пометкой mergedInto — снять при подмене живого каталога. Откат: dupmerge-backup.json.`, tag);
  addCase(dropSlug, drop.name, 'kompas_dupe_dropped', 'info',
    `Эта карточка — дубль «${keepSlug}», слита туда ${decidedOn}. Содержимое оставлено на месте, метка источника снята. Удаление — при подмене живого каталога.`, tag);

  log(`${dropSlug} → ${keepSlug}: программ +${added} (стало ${keep.programs.length}), цен перенесено ${feesMoved}, обогащено ${feesEnriched}, дедлайнов +${dlMoved}, кампусов +${campusesAdded}${scholarshipsAdded ? `, стипендий +${scholarshipsAdded}` : ''}${accommodationAdded ? `, жилья +${accommodationAdded}` : ''}${photoSetsTaken ? ', +фотонаборы' : ''}${feesSkippedCurrency ? `, цен пропущено по валюте ${feesSkippedCurrency}` : ''}`);
  return { keep: keepSlug, drop: dropSlug, added, feesMoved, feesEnriched, dlMoved, campusesAdded, feesSkippedCurrency, scholarshipsAdded, accommodationAdded, photoSetsTaken, totalPrograms: keep.programs.length };
}

async function main() {
  if (!APPLY) log('СУХОЙ ПРОГОН: ничего не пишу. Для записи добавь --apply');
  const MAP = await readJson(MAP_FILE);
  // Бэкап накопительный: снимки прошлых пар не перезаписываем, иначе повторный
  // прогон подменит «оригинал» уже слитым состоянием и откат станет пустышкой.
  const BACKUP_FILE = path.join(KOMPAS_DIR, 'dupmerge-backup.json');
  const backup = await readJson(BACKUP_FILE).catch(() => ({}));
  const merges = [];
  for (const { keep, drop, tag } of PAIRS) merges.push(await mergePair(keep, drop, tag, MAP, backup));
  await writeJson(MAP_FILE, MAP);
  await writeJson(BACKUP_FILE, backup);

  await writeJson(path.join(KOMPAS_DIR, 'dupmerge-log.json'), {
    generatedAt: new Date().toISOString(),
    note: 'Слияния дублей каталога: 3 пары решением владельца 2026-07-24, 6 пар — 2026-07-26. Файлы сливаемых карточек оставлены на месте с mergedInto — удаление при подмене живого каталога. Откат: dupmerge-backup.json.',
    merges,
  });
  await writeJson(path.join(KOMPAS_DIR, 'dupmerge-review.json'), {
    generatedAt: new Date().toISOString(), scope: 'kompas-dupmerge', summary: { total: cases.length }, items: cases,
  });

  console.log(JSON.stringify({ applied: APPLY, merges }, null, 2));
  console.log('MERGE-DUPES DONE');
}

main().catch((e) => { console.error(e); process.exit(1); });
