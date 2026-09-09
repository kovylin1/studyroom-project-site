#!/usr/bin/env node
// kompas-backfill-campuses.mjs — добор кампусов, которых нет в карточке.
//
// ЗАЧЕМ. Сверка отдала 57 кейсов «источник называет кампусы, которых нет в
// карточке» (99 названий). Механически дописать их все — испортить каталог:
// просмотр всех 57 кейсов глазами показал, что настоящих пропусков там меньшинство.
//
// ЧТО НА САМОМ ДЕЛЕ В ЭТИХ 99 НАЗВАНИЯХ:
//   1. Тот же самый кампус под именем агрегатора: «Abertay Campus» при
//      «City Centre Campus», «Bradford Campus» при «City Campus», «DMU Leicester
//      Campus» при «Leicester City Campus». Дописать = завести второй кампус там,
//      где он один, и прямо соврать на странице вуза.
//   2. Брак разбора у коллектора: в поле кампусов приехали абзацы описания
//      программ (ema, englishpath, gbs-dubai, gbs-malta, global-banking-school,
//      schiller). Это находка про коллектор, а не данные.
//   3. «Online Campus» — не место, а форма обучения.
//   4. И только остаток — настоящие недостающие кампусы: у Otago четыре города,
//      а в карточке ни одного; Wrexham у Bangor; Lakeshore у Humber.
//
// ПРАВИЛО ОТБОРА. У названия снимаются служебные слова, аббревиатура заведения
// (AU, CSU, TUOS, UNIC…) и слова, повторяющие имя вуза, его город и страну
// (с допуском на опечатку в одну букву: «Alabama Biringham Campus»). Что
// осталось — и есть место. Пусто → это главный кампус под чужим именем.
// Осталось подмножеством уже имеющегося кампуса → дубль.
//
// Описание кампуса НЕ выдумывается: пишем только title, происхождение и
// confidence 0.4 — сколько источник и даёт.
//
// Работает на КОПИИ sources/kompas/catalog-work. Живой каталог не тронут.
// Идемпотентно: на повторном прогоне дописанное совпадёт и в добор не пойдёт.
// Откат — по campus-backfill-backup.json.
//
// Запуск: node kompas-backfill-campuses.mjs [--apply]

import fs from 'node:fs/promises';
import path from 'node:path';
import { KOMPAS_DIR, args, logger } from './lib/kompas-collect.mjs';
import { WORK_DIR, readJson, loadSourceIndex, resolveAssignment } from './lib/kompas-diff-core.mjs';
import { similarity } from './lib/kompas-normalize.mjs';

const log = logger('backfill-campus');
const APPLY = args.has('apply');
const TODAY = new Date().toISOString().slice(0, 10);
const BACKUP = path.join(KOMPAS_DIR, 'campus-backfill-backup.json');
const REVIEW = path.join(KOMPAS_DIR, 'campus-backfill-review.json');

/** Служебные слова названия кампуса: сами по себе места не обозначают. */
const GENERIC = new Set(['campus', 'campuses', 'main', 'the', 'of', 'and', 'at', 'in', 'our', 'university', 'universities', 'college', 'school', 'institute']);
/** Не место, а форма обучения. */
const NON_PLACE = new Set(['online', 'distance', 'virtual', 'digital', 'remote']);

const words = (s) => String(s ?? '').toLowerCase()
  .normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);

/** Правка Дамерау—Левенштейна не нужна: хватает расстояния 1 на опечатку. */
export function closeWord(a, b) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length < 4 || b.length < 4) return false;   // на коротких словах допуск врёт
  let i = 0; let j = 0; let diff = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++diff > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else { i++; j++; }
  }
  return diff + (a.length - i) + (b.length - j) <= 1;
}

/** Похоже на абзац текста, а не на имя кампуса (брак разбора у коллектора). */
export function looksLikeProse(title) {
  const t = String(title ?? '').trim();
  return t.length > 60 || /[.,;:]\s/.test(t) || t.split(/\s+/).length > 8;
}

/** Аббревиатура заведения: «AU», «TUOS», «UoP», «BCU». */
const isAcronym = (raw) => /^[A-Za-z]{2,6}$/.test(raw) && (raw.match(/[A-Z]/g) ?? []).length >= 2;

/**
 * Что от названия остаётся после снятия служебных слов, аббревиатуры и слов,
 * повторяющих вуз/город/страну. Это и есть «место».
 */
export function placeTokens(title, { name = '', city = '', country = '' } = {}) {
  const own = new Set([...words(name), ...words(city), ...words(country)]);
  const raws = String(title ?? '').split(/[^A-Za-z0-9]+/).filter(Boolean);
  const out = [];
  for (const raw of raws) {
    const w = words(raw)[0];
    if (!w) continue;
    if (GENERIC.has(w)) continue;
    if (isAcronym(raw)) continue;
    if ([...own].some((o) => closeWord(w, o))) continue;
    out.push(w);
  }
  return out;
}

/**
 * Решение по одному названию кампуса из источника.
 * `have` — названия кампусов, уже стоящих в карточке.
 */
export function classifyCampus(title, card, have) {
  if (looksLikeProse(title)) return { action: 'skip', kind: 'prose', why: 'не название кампуса, а абзац описания — брак разбора у коллектора' };
  const place = placeTokens(title, card);
  if (!place.length) return { action: 'skip', kind: 'alias', why: 'после снятия имени вуза и города не остаётся места — это главный кампус под именем агрегатора' };
  if (place.every((t) => NON_PLACE.has(t))) return { action: 'skip', kind: 'not-place', why: 'форма обучения, а не место' };

  for (const h of have) {
    const hp = placeTokens(h, card);
    if (!hp.length) continue;
    const hs = new Set(hp);
    if (place.every((t) => [...hs].some((x) => closeWord(t, x)))) {
      return { action: 'skip', kind: 'duplicate', why: `то же место, что у «${h}»` };
    }
    if (similarity(title, h) >= 0.6) return { action: 'skip', kind: 'duplicate', why: `совпадает с «${h}»` };
  }
  return { action: 'add', place };
}

async function main() {
  if (!APPLY) log('СУХОЙ ПРОГОН: только считаю. Для записи добавь --apply');
  const map = await readJson(path.join(KOMPAS_DIR, 'partner-source-map.json')) ?? {};
  const { index } = await loadSourceIndex();
  const files = (await fs.readdir(WORK_DIR)).filter((f) => f.endsWith('.json'));
  const now = new Date().toISOString();

  const addedLog = {}; const skipped = {}; let addedTotal = 0; const proseUnis = new Set();
  // Разбор по вузам: что именно осталось «недостающим» после отбора. Нужен
  // сверке — иначе кейс «источник называет кампусы, которых нет» останется
  // висеть открытым, хотя ответ на него уже дан: это не кампусы.
  const verdicts = {};
  const top = [];

  for (const f of files) {
    const slug = f.replace(/\.json$/, '');
    const card = await readJson(path.join(WORK_DIR, f));
    if (!card) continue;
    const { ps, ready } = resolveAssignment(card, slug, map);
    if (ps.type === 'none') continue;
    const entries = (index.get(slug) ?? []).filter((e) => ready.includes(e.src));
    if (!entries.length) continue;

    // Названия кампусов источника — с пометкой, откуда пришли.
    const fromSource = new Map();   // title -> via
    for (const { src, data } of entries) {
      const push = (v) => { const t = String(typeof v === 'string' ? v : (v?.title ?? v?.name ?? '')).trim(); if (t && !fromSource.has(t)) fromSource.set(t, src); };
      for (const c of data.campuses ?? []) push(c);
      for (const p of data.programs ?? []) for (const c of p.campuses ?? []) push(c);
      if (data.campus) push(data.campus);
    }
    if (!fromSource.size) continue;

    const have = (card.campuses ?? []).map((c) => String(c.title ?? c.sub ?? '')).filter(Boolean);
    const nowAdded = [];
    for (const [title, via] of fromSource) {
      const r = classifyCampus(title, card, [...have, ...nowAdded]);
      if (r.action === 'skip') {
        (skipped[r.kind] ??= []).push({ slug, title });
        ((verdicts[slug] ??= { added: 0, skipped: {}, examples: [] }).skipped[r.kind] ??= 0);
        verdicts[slug].skipped[r.kind]++;
        if (verdicts[slug].examples.length < 4) verdicts[slug].examples.push(`«${title}» — ${r.why}`);
        if (r.kind === 'prose') proseUnis.add(slug);
        continue;
      }
      (verdicts[slug] ??= { added: 0, skipped: {}, examples: [] }).added++;
      nowAdded.push(title);
      if (APPLY) {
        (card.campuses ??= []).push({
          title,
          source: `kompas:${via}`,
          confidence: 0.4,
          checkedAt: TODAY,
        });
      }
    }

    if (nowAdded.length) {
      addedLog[slug] = nowAdded;
      addedTotal += nowAdded.length;
      top.push({ slug, name: card.name, added: nowAdded.length, titles: nowAdded.join(' | ') });
      if (APPLY) await fs.writeFile(path.join(WORK_DIR, f), JSON.stringify(card, null, 2) + '\n', 'utf8');
    }
  }

  top.sort((a, b) => b.added - a.added);

  // Брак разбора у коллектора — это находка, а не «пропущенные кампусы».
  const cases = [...proseUnis].map((s) => ({
    id: `${s}||kompas_campus_prose||${(skipped.prose ?? []).filter((x) => x.slug === s).length}`,
    slug: s, name: s,
    issue: 'kompas_campus_prose',
    severity: 'warning',
    detail: `У источника в поле кампусов лежат абзацы описания программ, а не названия кампусов (${(skipped.prose ?? []).filter((x) => x.slug === s).length} шт.). Это дефект разбора у коллектора — в каталог такое не переносится. Чинить на стороне сбора.`,
    catalog: null, official: null, program: null, sourceUrl: null,
    checkedAt: now, decision: null, decidedAt: null, applied: false,
  }));

  if (APPLY) {
    // Прототип у разобранного JSON живой: слаг вуза, совпавший с именем метода
    // Object.prototype, вернул бы функцию вместо массива (на этом падал
    // kompas-backfill-programs.mjs). Берём только собственные ключи-массивы.
    const prev = Object.assign(Object.create(null), (await readJson(BACKUP))?.added ?? {});
    for (const [s, arr] of Object.entries(addedLog)) {
      const было = Array.isArray(prev[s]) ? prev[s] : [];
      prev[s] = [...new Set([...было, ...arr])];
    }
    await fs.writeFile(BACKUP, JSON.stringify({
      generatedAt: now,
      note: 'Кампусы, дописанные с источника (source=kompas:<via>, confidence 0.4). Откат: удалить эти title из card.campuses.',
      summary: { unis: Object.keys(prev).length, campuses: Object.values(prev).reduce((a, v) => a + v.length, 0) },
      added: prev,
    }, null, 2) + '\n', 'utf8');
    await fs.writeFile(REVIEW, JSON.stringify({
      generatedAt: now, scope: 'kompas-backfill-campuses',
      summary: {
        added: addedTotal,
        skipped: Object.fromEntries(Object.entries(skipped).map(([k, v]) => [k, v.length])),
      },
      verdicts,
      skipped,
      items: cases,
    }, null, 2) + '\n', 'utf8');
  }

  console.table(top.slice(0, 20));
  console.log(`ДОПИСАНО кампусов ${addedTotal} у ${Object.keys(addedLog).length} вузов`);
  console.log(`ПРОПУЩЕНО: ${Object.entries(skipped).map(([k, v]) => `${k} ${v.length}`).join(', ') || 'ничего'}`);
  console.log(APPLY ? `ПРИМЕНЕНО к catalog-work + ${path.basename(BACKUP)}` : 'СУХОЙ ПРОГОН — для записи добавь --apply');
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) await main();
