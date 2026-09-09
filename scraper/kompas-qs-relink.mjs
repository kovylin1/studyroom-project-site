#!/usr/bin/env node
// kompas-qs-relink.mjs — привязка выгрузок QS к карточкам каталога там, где
// имя совпадает буква в букву, а привязка не сработала.
//
// ЗАЧЕМ. Диагноз 2026-08-02 (QS-UNLINKED-REPORT.md): 133 выгрузки QS не сели на
// карточки. Это не дыра сбора — это промах привязки, и он же даёт кейсы
// `kompas_no_extract`: карточка считает, что источник по ней молчит, хотя запись
// собрана и лежит рядом.
//
// ЧТО ЗАКРЫВАЕТСЯ САМО. Только записи, где лучшая подсказка ТОЙ ЖЕ СТРАНЫ
// совпала по нормализованному имени полностью (score 1.00): «University of
// Illinois at Chicago» → `uic`, «Solent University, Southampton» → `solent`.
// Тут решать нечего — одинаковое имя плюс одинаковая страна, разбор просто не
// дотянулся. Всё, что 0.75–0.99 («Cardenal Herrera CEU» → `cardenal-herrera-valencia`),
// уходит кейсом владельцу: там нужен глаз, а не порог.
//
// ФАЙЛ НЕ ПЕРЕИМЕНОВЫВАЕТСЯ. У QS бывает две записи на одну карточку (бейджи
// «(Postgraduate)» / «(Undergraduate)»: TAMUCC, Victoria, NABA). Переименование
// в слаг каталога затёрло бы одну другой — ровно тот урок, что записан в бэклоге.
// Ставим только поле `catalogSlug`: сверка группирует выгрузки по нему и
// объединяет программы (unionPrograms), поэтому обе записи доезжают целиком.
//
// Живой каталог не трогается вообще: пишем только в sources/kompas/extracts/qs.
// Откат — по qs-relink-backup.json.
//
// Запуск: node kompas-qs-relink.mjs [--apply]

import fs from 'node:fs/promises';
import path from 'node:path';
import { KOMPAS_DIR, CATALOG_DIR, args, logger } from './lib/kompas-collect.mjs';

const log = logger('qs-relink');
const APPLY = args.has('apply');
const QS_DIR = path.join(KOMPAS_DIR, 'extracts', 'qs');
const UNLINKED = path.join(KOMPAS_DIR, 'qs-unlinked.json');
const REVIEW = path.join(KOMPAS_DIR, 'qs-relink-review.json');
const BACKUP = path.join(KOMPAS_DIR, 'qs-relink-backup.json');

/** Порог автопривязки: только полное совпадение имени. Ниже — глаз человека. */
export const EXACT = 0.999;

/**
 * Решение по одной непривязанной записи QS.
 * `catalogSlugs` — множество слагов, которые в каталоге реально есть (подсказка
 * могла устареть: замер снят 2026-08-02).
 *
 * Возвращает { action: 'link', to, score } | { action: 'ask', to, score, tier }
 *          | { action: 'none', why }
 */
export function decideLink(row, catalogSlugs) {
  const same = (row.suggestions ?? []).filter((s) => s.sameCountry && catalogSlugs.has(s.slug));
  const best = same.sort((a, b) => b.score - a.score)[0];
  if (!best) return { action: 'none', why: (row.suggestions ?? []).length ? 'подсказки только из другой страны' : 'похожей карточки нет' };
  if (best.score >= EXACT) return { action: 'link', to: best.slug, score: best.score };
  if (best.score >= 0.75) return { action: 'ask', to: best.slug, score: best.score, tier: 'надёжно' };
  return { action: 'ask', to: best.slug, score: best.score, tier: 'нужен глаз' };
}

async function main() {
  if (!APPLY) log('СУХОЙ ПРОГОН: только считаю. Для записи добавь --apply');
  const un = JSON.parse(await fs.readFile(UNLINKED, 'utf8'));
  const catalogSlugs = new Set(
    (await fs.readdir(CATALOG_DIR)).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')),
  );

  const now = new Date().toISOString();
  const linked = []; const ask = []; const none = [];
  const backup = [];

  for (const row of un.rows ?? []) {
    const r = decideLink(row, catalogSlugs);
    if (r.action === 'none') { none.push({ ...row, why: r.why }); continue; }
    if (r.action === 'ask') { ask.push({ qsSlug: row.qsSlug, qsName: row.qsName, country: row.country, programs: row.programs, to: r.to, score: r.score, tier: r.tier }); continue; }

    const file = path.join(QS_DIR, `${row.qsSlug}.json`);
    let data;
    try { data = JSON.parse(await fs.readFile(file, 'utf8')); }
    catch { none.push({ ...row, why: `выгрузки ${row.qsSlug}.json нет на диске` }); continue; }

    backup.push({ file: `${row.qsSlug}.json`, catalogSlug: data.catalogSlug ?? null, matchMethod: data.matchMethod ?? null });
    if (APPLY) {
      data.catalogSlug = r.to;
      data.matchMethod = 'qs-relink/exact-name-same-country';
      data.relinkedAt = now;
      await fs.writeFile(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
    }
    linked.push({ qsSlug: row.qsSlug, qsName: row.qsName, to: r.to, programs: row.programs, score: r.score });
  }

  // Кейсы владельцу: привязка по подсказке — не механика, а решение.
  const cases = ask.map((a) => ({
    id: `${a.to}||kompas_qs_link||${a.qsSlug}`,
    slug: a.to, name: a.qsName,
    issue: 'kompas_qs_link',
    severity: a.tier === 'надёжно' ? 'warning' : 'info',
    detail: `Выгрузка QS «${a.qsName}» (${a.country}, программ ${a.programs}) не села ни на одну карточку. Ближайшая — \`${a.to}\`, схожесть имени ${a.score.toFixed(2)}, страна та же. Разряд «${a.tier}». Привязать = карточка начнёт сверяться с этой выгрузкой; ошибка привязки тихо подмешает чужие программы, поэтому автоматом не привязываю.`,
    catalog: null, official: a.programs, program: null, sourceUrl: null,
    checkedAt: now, decision: null, decidedAt: null, applied: false,
  }));

  const payload = {
    generatedAt: now,
    scope: 'kompas-qs-relink',
    note: 'Привязано автоматически только полное совпадение имени при той же стране. Остальное — кейсы владельцу.',
    summary: {
      rows: (un.rows ?? []).length,
      linked: linked.length,
      linkedPrograms: linked.reduce((a, l) => a + (l.programs ?? 0), 0),
      ask: ask.length,
      none: none.length,
    },
    // Слаги, по которым привязка ещё под вопросом: сверка не должна закрывать по
    // ним `kompas_no_extract` как «вуза у QS нет» — он есть, просто не привязан.
    // Берём ВСЕ подсказки непривязанных записей, включая иностранные: «Istituto
    // Marangoni Paris» указывает на `marangoni-milan` через границу, и закрывать
    // ту карточку как «QS её не знает» было бы неправдой.
    pendingTargets: [...new Set([
      ...ask.map((a) => a.to),
      ...none.flatMap((n) => (n.suggestions ?? []).map((s) => s.slug)),
    ])],
    linked,
    items: cases,
    none: none.map((n) => ({ qsSlug: n.qsSlug, qsName: n.qsName, country: n.country, programs: n.programs, why: n.why })),
  };

  if (APPLY) {
    await fs.writeFile(REVIEW, JSON.stringify(payload, null, 2) + '\n', 'utf8');
    await fs.writeFile(BACKUP, JSON.stringify({
      generatedAt: now,
      note: 'Откат привязки QS: вернуть перечисленным файлам прежний catalogSlug/matchMethod и удалить relinkedAt.',
      files: backup,
    }, null, 2) + '\n', 'utf8');
  }

  console.table(linked.slice(0, 20));
  console.log(`ПРИВЯЗАНО ${linked.length} выгрузок (${payload.summary.linkedPrograms} программ) к ${new Set(linked.map((l) => l.to)).size} карточкам`);
  console.log(`КЕЙСОВ владельцу ${ask.length}; без кандидата ${none.length}`);
  console.log(APPLY ? `ПРИМЕНЕНО + ${path.basename(REVIEW)} / ${path.basename(BACKUP)}` : 'СУХОЙ ПРОГОН — для записи добавь --apply');
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) await main();
