// kompas-qs-unlinked-diag.mjs — почему 133 карточки QS не легли на каталог.
//
// Сбор QS (2026-08-01) дал 512 карточек, из них 133 с matchMethod:"no-match" и 3964 программами.
// Одновременно сверка отдала 123 кейса kompas_no_extract — «вуз размечен партнёром через qs,
// источник собран, а выгрузки по нему нет». Это одна и та же дыра с двух сторон: у QS запись
// есть, но она не села на карточку, поэтому карточка считает, что источник по ней молчит.
// Улика в глаза: у QS «Abat Oliba CEU» без привязки, в каталоге `abat-oliba-barcelona` без выгрузки.
//
// Скрипт НИЧЕГО не пишет в каталог и не заводит карточек (правило владельца 2026-07-31).
// Он только ставит диагноз каждой из 133 записей и складывает предложения для просмотра ГЛАЗАМИ.
//
// Осторожно, оплачено предыдущими сессиями:
//   - урок 7: совпадение «по схожести слов» женит специализацию с базовой программой.
//     Здесь схожесть НИКОГДА не привязывает сама — только предлагает, и всегда с числом.
//   - урок 10: «не привязано» бывает багом привязки, а не отсутствием данных.
//   - урок 16: «карточки нет» проверяй по названию, а не по слагу.
//   - урок QS-5: бейдж партнёрства приклеен к имени («University of Worcester (Undergraduate)»),
//     и два таких имени схлопываются в один слаг каталога.
//
// Запуск:
//   node scraper/kompas-qs-unlinked-diag.mjs
//   node scraper/kompas-qs-unlinked-diag.mjs --min-score=0.6

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { ROOT, KOMPAS_DIR, CATALOG_DIR } from './lib/kompas-collect.mjs';
import { matchToCatalog, norm, stripGeneric } from './lib/kompas-catalog-match.mjs';

const WORK_DIR = path.join(KOMPAS_DIR, 'catalog-work');
const MEMBERSHIP = path.join(KOMPAS_DIR, 'membership', 'qs.json');
const REVIEW = path.join(KOMPAS_DIR, 'diff-review.json');
const OUT_JSON = path.join(KOMPAS_DIR, 'qs-unlinked.json');
const OUT_MD = path.join(KOMPAS_DIR, 'QS-UNLINKED-REPORT.md');

const arg = (p, d) => {
  const hit = process.argv.find((a) => a.startsWith(p));
  return hit ? hit.slice(p.length) : d;
};
const MIN_SCORE = Number(arg('--min-score=', '0.5'));

/** Бейдж партнёрства в хвосте имени QS: «(Undergraduate)», «(Online) (CertHE & Postgraduate)». */
const BADGE = /\s*\((?:[^()]*\b(?:undergraduate|postgraduate|online|certhe|foundation|pathway|pre-?master|research)\b[^()]*)\)\s*/gi;
export const stripBadge = (s) => (s || '').replace(BADGE, ' ').replace(/\s+/g, ' ').trim();

const tokens = (s) => new Set(stripGeneric(s).split(' ').filter((t) => t.length > 2));

/** Жаккар по значимым словам. Только для ПРЕДЛОЖЕНИЯ, привязку не делает никогда. */
export function similarity(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  return inter / (A.size + B.size - inter);
}

async function buildIndex(dir) {
  const rows = [];
  let files;
  try { files = await fs.readdir(dir); } catch { return rows; }
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    try {
      const c = JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'));
      const slug = c.slug || f.replace(/\.json$/, '');
      rows.push({
        slug,
        name: c.name || '',
        country: c.country || null,
        exact: norm(c.name),
        core: stripGeneric(c.name),
        programs: Array.isArray(c.programs) ? c.programs.length : 0,
      });
    } catch { /* битый файл пропускаем — так же, как в buildCatalogIndex */ }
  }
  return rows;
}

/** Строгий разбор + причина отказа из следа попыток. */
function diagnose(rec, catalog) {
  const names = [rec.name, stripBadge(rec.name)].filter((v, i, a) => v && a.indexOf(v) === i);
  let last = null;
  for (const name of names) {
    const m = matchToCatalog(name, catalog, { country: rec.country, refId: rec.slug });
    if (m.catalogSlug) return { ...m, usedName: name, badgeStripped: name !== rec.name };
    last = { ...m, usedName: name, badgeStripped: name !== rec.name };
  }
  return last;
}

function reasonFromTried(tried = []) {
  const joined = tried.join(' ');
  if (/country-mismatch/.test(joined)) return 'country-mismatch';
  if (/ambiguous/.test(joined)) return 'ambiguous';
  return 'absent';
}

function suggest(rec, catalog, limit = 3) {
  const base = stripBadge(rec.name) || rec.name;
  return catalog
    .map((c) => ({
      slug: c.slug,
      name: c.name,
      country: c.country,
      programs: c.programs,
      score: similarity(base, c.name),
      sameCountry: c.country === rec.country,
    }))
    .filter((c) => c.score >= MIN_SCORE)
    .sort((a, b) => (b.sameCountry - a.sameCountry) || (b.score - a.score))
    .slice(0, limit);
}

// Разряд надёжности предложения. Заведён после просмотра ГЛАЗАМИ первого прогона:
// при пороге 0.5 совпадали заведомо разные заведения — «University of Auckland» садился
// на `auckland-institute-of-studies`, «Ara Institute of Canterbury» на университет
// Кентербери, «The American Business School of Paris» на американский Kogod, а все
// кампусы Marangoni (Париж, Дубай) — на миланскую карточку. Это ровно урок 7: схожесть
// слов женит соседей. Порог не поднимаю (тогда потеряются верные пары вроде
// `abat-oliba-barcelona` при 0.60), но развожу по разрядам, чтобы владелец не читал
// полсотни строк, где половина — брак.
export function tierOf(s) {
  if (!s) return null;
  if (s.score >= 0.75 && s.sameCountry) return 'надёжно';
  if (!s.sameCountry) return 'другая страна';
  return 'нужен глаз';
}

const TIER_NOTE = {
  'надёжно': 'Имя совпадает на 0.75+ и страна та же. Проверить стоит всё равно, но брака тут не нашлось.',
  'нужен глаз': 'Страна та же, схожесть 0.5–0.74. Здесь брак и живёт: «University of Auckland» → `auckland-institute-of-studies` — разные заведения.',
  'другая страна': 'Кандидат в ДРУГОЙ стране — почти всегда другой кампус той же сети, а не та же карточка (все Marangoni садятся на миланскую). Привязывать без проверки нельзя.',
};

/** Таблицы предложений, разнесённые по разряду надёжности. */
function byTier(rows, pickSuggestion) {
  const out = [];
  for (const tier of ['надёжно', 'нужен глаз', 'другая страна']) {
    const list = rows
      .map((r) => ({ r, s: pickSuggestion(r) }))
      .filter(({ s }) => tierOf(s) === tier)
      .sort((a, b) => b.r.programs - a.r.programs);
    if (!list.length) continue;
    out.push(`### ${tier} — ${list.length} шт., ${list.reduce((n, { r }) => n + r.programs, 0)} программ`);
    out.push('');
    out.push(TIER_NOTE[tier]);
    out.push('');
    out.push('| Имя у QS | Программ | Страна | Кандидат | Схожесть |');
    out.push('|---|---:|---|---|---:|');
    for (const { r, s } of list) {
      const country = s.sameCountry ? r.country : `${r.country} → ${s.country || '—'}`;
      out.push(`| ${r.qsName} | ${r.programs} | ${country} | \`${s.slug}\` — ${s.name} | ${s.score.toFixed(2)} |`);
    }
    out.push('');
  }
  return out.join('\n');
}

async function main() {
  const membership = JSON.parse(await fs.readFile(MEMBERSHIP, 'utf8'));
  const unlinked = membership.institutions.filter((i) => !i.catalogSlug);

  const live = await buildIndex(CATALOG_DIR);
  const work = await buildIndex(WORK_DIR);

  const review = JSON.parse(await fs.readFile(REVIEW, 'utf8'));
  const noExtract = new Set(
    review.items.filter((i) => i.issue === 'kompas_no_extract').map((i) => i.slug),
  );

  // Бейдж-схлопывание: два имени QS с разными бейджами -> одно базовое имя.
  const byBase = new Map();
  for (const r of unlinked) {
    const b = norm(stripBadge(r.name));
    if (!byBase.has(b)) byBase.set(b, []);
    byBase.get(b).push(r.name);
  }
  const collisions = [...byBase.entries()].filter(([, v]) => v.length > 1);

  const rows = [];
  for (const rec of unlinked) {
    const inWork = diagnose(rec, work);
    const inLive = diagnose(rec, live);
    const hit = inWork?.catalogSlug || inLive?.catalogSlug || null;

    let verdict;
    if (hit) {
      verdict = inWork?.catalogSlug && !inLive?.catalogSlug ? 'resolved-work-only' : 'resolved';
    } else {
      verdict = reasonFromTried(inWork?.tried);
    }

    const suggestions = hit ? [] : suggest(rec, work);
    const pairs = suggestions.filter((s) => noExtract.has(s.slug)).map((s) => s.slug);

    rows.push({
      qsName: rec.name,
      qsSlug: rec.slug,
      country: rec.country,
      programs: rec.programs || 0,
      provider: rec.provider || null,
      verdict,
      badgeStripped: Boolean(inWork?.badgeStripped || inLive?.badgeStripped),
      catalogSlug: hit,
      matchMethod: hit ? (inWork?.catalogSlug ? inWork.matchMethod : inLive.matchMethod) : null,
      suggestions,
      tier: tierOf(suggestions[0]),
      pairsWithNoExtract: pairs,
      tried: hit ? undefined : (inWork?.tried || []).slice(0, 6),
    });
  }

  const by = (v) => rows.filter((r) => r.verdict === v);
  const withSuggestion = rows.filter((r) => !r.catalogSlug && r.suggestions.length);
  const strong = rows.filter((r) => r.pairsWithNoExtract.length);
  const absentClean = rows.filter((r) => !r.catalogSlug && !r.suggestions.length);
  const prog = (list) => list.reduce((s, r) => s + r.programs, 0);

  const payload = {
    generatedAt: new Date().toISOString(),
    minScore: MIN_SCORE,
    catalogs: { live: live.length, work: work.length },
    totals: {
      unlinked: rows.length,
      programs: prog(rows),
      resolved: by('resolved').length + by('resolved-work-only').length,
      resolvedWorkOnly: by('resolved-work-only').length,
      countryMismatch: by('country-mismatch').length,
      ambiguous: by('ambiguous').length,
      absent: absentClean.length,
      withSuggestion: withSuggestion.length,
      pairsWithNoExtract: strong.length,
    },
    badgeCollisions: collisions.map(([base, names]) => ({ base, names })),
    rows,
  };
  await fs.writeFile(OUT_JSON, JSON.stringify(payload, null, 2) + '\n', 'utf8');

  const md = [];
  md.push('# QS — почему 133 карточки не легли на каталог');
  md.push('');
  md.push(`**Дата:** ${payload.generatedAt.slice(0, 10)} · только чтение, каталог не тронут, карточки не заводились.`);
  md.push('');
  md.push('## Сводка');
  md.push('');
  md.push('| Показатель | Значение |');
  md.push('|---|---:|');
  md.push(`| Записей QS без привязки | ${rows.length} |`);
  md.push(`| Программ в них | ${prog(rows)} |`);
  md.push(`| **Привязались строгим разбором** (баг привязки, не пробел) | **${payload.totals.resolved}** |`);
  md.push(`| …из них только в рабочей копии, в живом каталоге карточки нет | ${payload.totals.resolvedWorkOnly} |`);
  md.push(`| Имя совпало, страна разошлась | ${payload.totals.countryMismatch} |`);
  md.push(`| Несколько кандидатов, однофамильцы | ${payload.totals.ambiguous} |`);
  md.push(`| Есть похожая карточка | ${withSuggestion.length} |`);
  md.push(`| …из них карточка САМА жалуется «выгрузки нет» | **${strong.length}** |`);
  md.push(`| …разряд «надёжно» (0.75+, страна та же) | ${withSuggestion.filter((r) => r.tier === 'надёжно').length} |`);
  md.push(`| …разряд «нужен глаз» (0.5–0.74) | ${withSuggestion.filter((r) => r.tier === 'нужен глаз').length} |`);
  md.push(`| …разряд «другая страна» (скорее другой кампус) | ${withSuggestion.filter((r) => r.tier === 'другая страна').length} |`);
  md.push(`| Ничего похожего: карточки нет вовсе | ${absentClean.length} (программ ${prog(absentClean)}) |`);
  md.push('');
  md.push('Каталогов сверено два: живой (' + live.length + ' карточек) и рабочая копия КОМПАСа (' + work.length + ').');
  md.push('');

  if (strong.length) {
    md.push('## Двойная улика: и QS не привязался, и карточка жалуется «выгрузки нет»');
    md.push('');
    md.push('Самое надёжное, что даёт этот замер. С одной стороны запись QS не села на карточку,');
    md.push('с другой — сверка по этой самой карточке отдала кейс `kompas_no_extract`. Совпадение');
    md.push('двух независимых признаков; привязку всё равно не делаю сам — решает владелец.');
    md.push('');
    md.push(byTier(strong, (r) => r.suggestions.find((x) => r.pairsWithNoExtract.includes(x.slug))));
  }

  const rest = withSuggestion.filter((r) => !r.pairsWithNoExtract.length);
  if (rest.length) {
    md.push('## Похожая карточка есть, но второй улики нет');
    md.push('');
    md.push(byTier(rest, (r) => r.suggestions[0]));
  }

  if (by('country-mismatch').length) {
    md.push('## Имя совпало, страна разошлась');
    md.push('');
    md.push('Однофамильцы — главный источник тихого брака (Griffith College в Брисбене и в Дублине).');
    md.push('Либо страна в карточке неверна, либо это разные учреждения.');
    md.push('');
    for (const r of by('country-mismatch')) md.push(`- **${r.qsName}** (${r.country}, ${r.programs} программ) — ${r.tried?.slice(-1)[0] || ''}`);
    md.push('');
  }

  if (collisions.length) {
    md.push('## Бейджи QS схлопываются в одно имя');
    md.push('');
    md.push('У QS партнёрство разнесено по уровням, и бейдж приклеен прямо к имени. Две записи —');
    md.push('одно учреждение: привязывать надо ОБЪЕДИНЕНИЕМ программ, иначе вторая затрёт первую.');
    md.push('');
    for (const [, names] of collisions) md.push(`- ${names.map((n) => `«${n}»`).join(' + ')}`);
    md.push('');
  }

  md.push('## Карточки нет вовсе');
  md.push('');
  md.push(`${absentClean.length} записей, ${prog(absentClean)} программ. Заводить карточки скрипт не имеет права`);
  md.push('(правило владельца 2026-07-31: «Новые вузы заводит человек»), поэтому это список на решение.');
  md.push('');
  md.push('| Имя у QS | Программ | Страна | Провайдер |');
  md.push('|---|---:|---|---|');
  for (const r of absentClean.sort((a, b) => b.programs - a.programs)) {
    md.push(`| ${r.qsName} | ${r.programs} | ${r.country} | ${r.provider || '—'} |`);
  }
  md.push('');
  md.push(`Полный разбор с следом попыток — \`${path.relative(ROOT, OUT_JSON).replace(/\\/g, '/')}\`.`);
  md.push('');

  await fs.writeFile(OUT_MD, md.join('\n'), 'utf8');

  const t = payload.totals;
  process.stderr.write(
    `[qs-diag] без привязки ${t.unlinked} (${t.programs} программ): ` +
    `привязалось строгим разбором ${t.resolved} (только в рабочей копии ${t.resolvedWorkOnly}), ` +
    `страна разошлась ${t.countryMismatch}, однофамильцы ${t.ambiguous}, ` +
    `есть кандидат ${t.withSuggestion} (двойная улика ${t.pairsWithNoExtract}), ` +
    `карточки нет ${t.absent}. Бейдж-схлопываний ${collisions.length}.\n`,
  );
}

// Замер запускается только при прямом вызове: файл ещё импортируют тесты,
// а им не нужен ни каталог на диске, ни перезапись отчёта.
const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((e) => { process.stderr.write(`[qs-diag] упал: ${e.stack}\n`); process.exit(1); });
}
