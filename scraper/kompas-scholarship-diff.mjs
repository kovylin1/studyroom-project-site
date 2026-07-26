#!/usr/bin/env node
// kompas-scholarship-diff.mjs — P4.9: сверка стипендий каталога с собранными офсайтами.
//
// Сбор с офсайтов отработал (1954 записи у 336 вузов в extracts/scholarships/), но лежал
// мёртвым грузом: сверки «что в карточке» против «что на сайте вуза» не было, и оператор
// не мог решить ничего — ни снять непроверяемую запись, ни добрать проверяемую.
//
// Скрипт НИЧЕГО не правит (правило 4): он сводит расхождения и отдаёт кейсы в панель.
// Три решения, которые после этого можно принять по каждому вузу:
//   1. на офсайте есть, в карточке нет            → добрать (записи со ссылкой и суммой);
//   2. в карточке есть, на офсайте не нашлось     → снять или проверить руками;
//   3. сумма расходится                            → чью брать.
//
// Честность обхода. «Не нашлось на офсайте» НЕ равно «не существует»: сбор читает не
// больше MAX_PAGES разделов и MAX_DETAILS отдельных страниц, и число пропущенных
// страниц каждого вуза записано в scholarship-collect-report.json. Там, где обход
// упёрся в потолок, это прямо сказано в тексте кейса — иначе оператор снимет живую
// стипендию по нашей же недоработке (урок Edvoy, сессия 3).
//
// Доверие к разбору. Записи с origin:'hub-headings' сняты с заголовков страницы-раздела,
// а не с отдельных страниц стипендий: там ловится мусор и verifiedBySite:false. Такие
// «недоборы» идут severity info, а не warning.
//
// Запуск: node kompas-scholarship-diff.mjs

import fs from 'node:fs/promises';
import path from 'node:path';
import { KOMPAS_DIR, EXTRACTS_DIR, logger } from './lib/kompas-collect.mjs';
import { similarity, SIM_THRESHOLD, isSubsetPair, normTitle } from './lib/kompas-normalize.mjs';

const log = logger('sch-diff');
const WORK = path.join(KOMPAS_DIR, 'catalog-work');
const IN_DIR = path.join(EXTRACTS_DIR, 'scholarships');
const OUT_REPORT = path.join(KOMPAS_DIR, 'scholarship-diff-report.json');
const OUT_REVIEW = path.join(KOMPAS_DIR, 'scholarship-diff-review.json');

const readJson = async (f) => JSON.parse(await fs.readFile(f, 'utf8'));

// Расхождение суммы считаем значимым от 2% — тем же порогом, что замер цен сессии 4.
// Ниже него разница это округление («£3,000» против «£2,995»), а не другая стипендия.
const AMOUNT_TOLERANCE = 0.02;

const SYMBOL = { '£': 'GBP', '€': 'EUR', 'A$': 'AUD', 'C$': 'CAD', 'NZ$': 'NZD', '$': 'USD' };

/**
 * Сумма стипендии в сравнимом виде. Каталог пишет «до £2,000», сбор — «до GBP 2,000/год»:
 * без общего вида эти две строки разошлись бы на ровном месте.
 * Возвращает { currency, value, upTo, perYear } либо null, если суммы нет или она
 * не числовая («full tuition», «50% off» — их сравнивать нечем, и выдумывать нельзя).
 */
export function parseAmount(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const m = s.match(/(A\$|C\$|NZ\$|£|€|\$|\b(?:GBP|USD|EUR|AUD|CAD|NZD|SGD|AED|CHF)\b)\s?([\d][\d,.\s]*)/i);
  if (!m) return null;
  const currency = SYMBOL[m[1]] ?? m[1].toUpperCase();
  const value = Number(String(m[2]).replace(/[,\s]/g, '').replace(/\.$/, ''));
  if (!Number.isFinite(value) || value <= 0) return null;
  return {
    currency,
    value,
    upTo: /\b(до|up to|maximum|as much as)\b/i.test(s),
    perYear: /\/год|\/year|per year|per annum|a year|annually/i.test(s),
  };
}

/** Расходятся ли суммы. Разная валюта — всегда расхождение, число — с допуском. */
export function amountsDiffer(a, b) {
  if (!a || !b) return false;
  if (a.currency !== b.currency) return true;
  const rel = Math.abs(a.value - b.value) / Math.max(a.value, b.value);
  return rel > AMOUNT_TOLERANCE;
}

/**
 * Пара «запись каталога ↔ запись офсайта» по названию.
 *
 * Порог и правило подмножества — те же, что у программ (lib/kompas-normalize.mjs):
 * «International Scholarship» и «International Scholarship for Nigeria» — РАЗНЫЕ
 * стипендии, а не разное написание одной, и в пару не идут.
 */
function matchByName(catalogList, offsiteList) {
  const usedOff = new Set();
  const pairs = [];
  for (const c of catalogList) {
    let best = -1; let bestSim = 0;
    for (let j = 0; j < offsiteList.length; j++) {
      if (usedOff.has(j)) continue;
      const o = offsiteList[j];
      if (normTitle(c.name) && normTitle(c.name) === normTitle(o.name)) { best = j; bestSim = 1; break; }
      if (isSubsetPair(c.name, o.name)) continue;
      const sim = similarity(c.name, o.name);
      if (sim >= SIM_THRESHOLD && sim > bestSim) { best = j; bestSim = sim; }
    }
    if (best >= 0) { usedOff.add(best); pairs.push({ c, o: offsiteList[best], sim: bestSim }); }
    else pairs.push({ c, o: null, sim: 0 });
  }
  const onlyOffsite = offsiteList.filter((_, j) => !usedOff.has(j));
  return { pairs, onlyOffsite };
}

const cases = [];
const now = new Date().toISOString();
const addCase = (slug, name, issue, severity, detail, extra = {}) => cases.push({
  id: `${slug}||${issue}||session6-scholardiff`,
  slug, name, issue, severity, detail,
  catalog: null, official: null, program: null, sourceUrl: null,
  ...extra,
  checkedAt: now, decision: null, decidedAt: null, applied: false,
});

const short = (list, n, fmt) => list.slice(0, n).map(fmt).join('; ') + (list.length > n ? ` … и ещё ${list.length - n}` : '');

async function main() {
  const files = (await fs.readdir(IN_DIR)).filter((f) => f.endsWith('.json'));

  // Отчёт сбора — чтобы знать, где обход упёрся в потолок и сколько страниц прочитано.
  const collect = await readJson(path.join(KOMPAS_DIR, 'scholarship-collect-report.json')).catch(() => null);
  const collectBySlug = new Map((collect?.universitiesDetail ?? []).map((r) => [r.slug, r]));

  const perUni = [];
  const totals = {
    universities: 0, offsiteRecords: 0, catalogRecords: 0,
    matched: 0, onlyCatalog: 0, onlyOffsite: 0, amountDiff: 0, amountOnlyInCatalog: 0,
    nearMisses: 0, cappedUnis: 0,
  };

  for (const f of files) {
    const slug = f.replace(/\.json$/, '');
    const ex = await readJson(path.join(IN_DIR, f));
    let card;
    try { card = await readJson(path.join(WORK, `${slug}.json`)); } catch { continue; }
    // Карточка-дубль: её стипендии уже перенесены в оставленную, сверять здесь нечего.
    if (card.mergedInto) continue;

    const offsite = ex.scholarships ?? [];
    const catalog = card.scholarships ?? [];
    if (!offsite.length) continue;

    const { pairs, onlyOffsite } = matchByName(catalog, offsite);
    const matched = pairs.filter((p) => p.o);
    const onlyCatalog = pairs.filter((p) => !p.o).map((p) => p.c);

    const amountDiffs = [];
    const amountOnlyInCatalog = [];
    for (const { c, o } of matched) {
      const ac = parseAmount(c.amount); const ao = parseAmount(o.amount);
      if (ac && ao && amountsDiffer(ac, ao)) amountDiffs.push({ name: c.name, catalog: c.amount, offsite: o.amount, url: o.url });
      else if (ac && !o.amount) amountOnlyInCatalog.push({ name: c.name, catalog: c.amount, url: o.url });
    }

    // «Почти совпало» (0.5 ≤ sim < порога). В пару такие не идут сознательно: «Felix
    // Scholarship» и «Felix Non-Indian Scholarship» — разные стипендии, а не разное
    // написание одной. Но оператору перед снятием записи это надо видеть, иначе он
    // снимет живую стипендию, у которой на сайте просто другое имя.
    const nearMisses = [];
    for (const c of onlyCatalog) {
      let best = null; let bestSim = 0;
      for (const o of offsite) {
        const s = similarity(c.name, o.name);
        if (s >= 0.5 && s < SIM_THRESHOLD && s > bestSim) { bestSim = s; best = o; }
      }
      if (best) nearMisses.push({ catalog: c.name, offsite: best.name, sim: Number(bestSim.toFixed(2)), url: best.url });
    }

    const cr = collectBySlug.get(slug) ?? {};
    const origin = ex.origin ?? cr.origin ?? 'unknown';
    const capped = (cr.detailsSkipped ?? 0) > 0;
    if (capped) totals.cappedUnis++;

    totals.universities++;
    totals.offsiteRecords += offsite.length;
    totals.catalogRecords += catalog.length;
    totals.matched += matched.length;
    totals.onlyCatalog += onlyCatalog.length;
    totals.onlyOffsite += onlyOffsite.length;
    totals.amountDiff += amountDiffs.length;
    totals.amountOnlyInCatalog += amountOnlyInCatalog.length;

    perUni.push({
      slug, name: card.name, origin, base: ex.sourceUrl ?? null,
      pagesRead: (ex.pagesRead ?? []).length, detailsSkipped: cr.detailsSkipped ?? 0,
      counts: {
        catalog: catalog.length, offsite: offsite.length, matched: matched.length,
        onlyCatalog: onlyCatalog.length, onlyOffsite: onlyOffsite.length,
        amountDiff: amountDiffs.length, amountOnlyInCatalog: amountOnlyInCatalog.length,
      },
      matched: matched.map(({ c, o, sim }) => ({ catalog: c.name, offsite: o.name, sim: Number(sim.toFixed(2)), amountCatalog: c.amount ?? null, amountOffsite: o.amount ?? null, url: o.url })),
      onlyCatalog: onlyCatalog.map((c) => ({ name: c.name, amount: c.amount ?? null, kompasStatus: c.kompasStatus ?? null, url: c.url ?? null })),
      onlyOffsite: onlyOffsite.map((o) => ({ name: o.name, amount: o.amount ?? null, url: o.url })),
      amountDiffs, amountOnlyInCatalog, nearMisses,
    });
    totals.nearMisses += nearMisses.length;

    const cappedNote = capped
      ? ` ВНИМАНИЕ: обход этого вуза упёрся в потолок, ${cr.detailsSkipped} страниц стипендий не прочитано — «не нашлось» здесь может быть нашей недоработкой, а не отсутствием стипендии.`
      : '';
    const originNote = origin === 'hub-headings'
      ? ' Записи офсайта сняты с заголовков страницы-раздела (origin hub-headings), не с отдельных страниц: разбор грязнее, verifiedBySite:false — проверить глазами перед добором.'
      : '';

    // 1. На офсайте есть, в карточке нет — недобор. Это ЕДИНСТВЕННЫЕ проверяемые
    //    стипендии, которые у нас вообще есть: у каждой ссылка на страницу вуза.
    if (onlyOffsite.length) {
      addCase(slug, card.name, 'kompas_scholarship_offsite_new',
        origin === 'hub-headings' ? 'info' : 'warning',
        `На офсайте найдено ${onlyOffsite.length} стипендий, которых нет в карточке (в карточке ${catalog.length}, на офсайте ${offsite.length}, совпало ${matched.length}). У каждой есть ссылка на страницу вуза — в отличие от записей каталога, где ссылки нет у 79%. Примеры: ${short(onlyOffsite, 5, (o) => `«${o.name}»${o.amount ? ` ${o.amount}` : ' без суммы'}`)}. Полный список — scholarship-diff-report.json.${originNote}`,
        { catalog: catalog.length, official: offsite.length, sourceUrl: ex.sourceUrl ?? null });
    }

    // 2. В карточке есть, на офсайте не нашлось. Разряд записи решает, насколько это
    //    тревожно: непроверяемая запись, не подтверждённая сайтом вуза, — это ровно
    //    та выдумка, которую искали.
    if (onlyCatalog.length) {
      const shady = onlyCatalog.filter((c) => c.kompasStatus === 'untraceable' || c.kompasStatus === 'cloned');
      addCase(slug, card.name, 'kompas_scholarship_not_on_site',
        shady.length && !capped ? 'critical' : 'warning',
        `${onlyCatalog.length} стипендий карточки не подтвердились офсайтом (прочитано страниц ${(ex.pagesRead ?? []).length}, найдено на сайте ${offsite.length}, совпало ${matched.length}). Из них непроверяемых по разряду: ${shady.length}. Примеры: ${short(onlyCatalog, 5, (c) => `«${c.name}»${c.amount ? ` ${c.amount}` : ''} [${c.kompasStatus ?? 'без разряда'}]`)}.${nearMisses.length ? ` ПОЧТИ СОВПАЛО (в пару не пошло, проверить перед снятием): ${short(nearMisses, 3, (n) => `«${n.catalog}» ↔ «${n.offsite}» (${n.sim})`)}.` : ''}${cappedNote} Решение: снять, проверить руками или заменить записью с офсайта.`,
        { catalog: catalog.length, official: offsite.length, sourceUrl: ex.sourceUrl ?? null });
    }

    // 3. Сумма расходится.
    if (amountDiffs.length || amountOnlyInCatalog.length) {
      const parts = [];
      if (amountDiffs.length) parts.push(`сумма расходится у ${amountDiffs.length}: ${short(amountDiffs, 4, (d) => `«${d.name}» каталог ${d.catalog} ↔ офсайт ${d.offsite}`)}`);
      if (amountOnlyInCatalog.length) parts.push(`сумма есть только в каталоге у ${amountOnlyInCatalog.length}: ${short(amountOnlyInCatalog, 4, (d) => `«${d.name}» ${d.catalog}`)} — на странице вуза подписанной суммы нет, происхождение числа неизвестно`);
      addCase(slug, card.name, 'kompas_scholarship_amount_diff', 'warning',
        `Совпало по названию ${matched.length} записей; ${parts.join('. ')}. Порог значимости 2%.${originNote}`,
        { catalog: catalog.length, official: offsite.length, sourceUrl: ex.sourceUrl ?? null });
    }
  }

  // Свод по каталогу: чтобы масштаб был виден одной строкой, а не суммой 300 кейсов.
  addCase('__kompas__', 'Каталог целиком', 'kompas_scholarship_diff_summary', 'warning',
    `Сверено ${totals.universities} вузов, у которых есть выгрузка с офсайта. В карточках ${totals.catalogRecords} записей, на офсайтах ${totals.offsiteRecords}. Совпало по названию ${totals.matched}. Не подтвердилось офсайтом ${totals.onlyCatalog} записей каталога; на офсайте есть и не заведено ${totals.onlyOffsite}. Сумма расходится у ${totals.amountDiff}, сумма есть только в каталоге у ${totals.amountOnlyInCatalog}. Порог совпадения проверен глазами: «почти совпало» (0.5–${SIM_THRESHOLD}) всего ${totals.nearMisses} пар, и это в основном РАЗНЫЕ стипендии («Felix Scholarship» ↔ «Felix Non-Indian Scholarship») — низкое пересечение не артефакт сверки, а факт: имена в карточках взяты не с сайтов вузов. У ${totals.cappedUnis} вузов обход упёрся в потолок страниц — там «не нашлось» ненадёжно. Ничего не менялось: это свод для решения.`,
    { catalog: totals.catalogRecords, official: totals.offsiteRecords });

  perUni.sort((a, b) => b.counts.onlyOffsite - a.counts.onlyOffsite);

  await fs.writeFile(OUT_REPORT, JSON.stringify({
    generatedAt: now,
    note: 'Сверка стипендий каталога с собранными офсайтами. Ничего не правится — свод для решения оператора.',
    thresholds: { similarity: SIM_THRESHOLD, amountTolerance: AMOUNT_TOLERANCE },
    summary: totals,
    universities: perUni,
  }, null, 2) + '\n', 'utf8');

  const byIssue = {};
  for (const c of cases) byIssue[c.issue] = (byIssue[c.issue] ?? 0) + 1;
  await fs.writeFile(OUT_REVIEW, JSON.stringify({
    generatedAt: now, scope: 'kompas-scholarship-diff',
    summary: { total: cases.length, byIssue }, items: cases,
  }, null, 2) + '\n', 'utf8');

  log(`вузов ${totals.universities}: каталог ${totals.catalogRecords} ↔ офсайт ${totals.offsiteRecords}, совпало ${totals.matched}`);
  log(`не подтвердилось ${totals.onlyCatalog}, недобор ${totals.onlyOffsite}, сумма расходится ${totals.amountDiff}, сумма только в каталоге ${totals.amountOnlyInCatalog}`);
  log(`кейсов ${cases.length}: ${Object.entries(byIssue).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  console.log('SCHOLARSHIP DIFF DONE', JSON.stringify({ ...totals, cases: cases.length }));
}

main().catch((e) => { console.error(e); process.exit(1); });
