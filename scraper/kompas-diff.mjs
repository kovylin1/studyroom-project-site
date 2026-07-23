// kompas-diff.mjs — КОМПАС, сессия 4: замер расхождений «карточка каталога vs её источник».
//
// Что делает: по каждому партнёрскому вузу берёт карточку рабочей копии
// (sources/kompas/catalog-work) и сравнивает с ОБЪЕДИНЕНИЕМ выгрузок его источников
// (правило 3 плана: агрегаторы дополняют друг друга, не режут).
//
// Сети нет. Каталог не трогается вообще — только чтение (правило 5).
//
// Выход:
//   sources/kompas/diff-report.json   — полный замер по вузам и полям
//   sources/kompas/DIFF-REPORT.md     — таблица владельцу
//   sources/kompas/diff-review.json   — кейсы в формате панели /manager
//
// Запуск: node kompas-diff.mjs

import fs from 'node:fs/promises';
import path from 'node:path';
import { KOMPAS_DIR, logger } from './lib/kompas-collect.mjs';
import { normProgram, normCatalogProgram, similarity, isSubsetPair, SIM_THRESHOLD } from './lib/kompas-normalize.mjs';

const log = logger('diff');

const WORK_DIR = path.join(KOMPAS_DIR, 'catalog-work');
const EXTRACTS = path.join(KOMPAS_DIR, 'extracts');
const GEDU_DIR = path.join(KOMPAS_DIR, '..', '..', 'scraper', 'sources', 'gedu-extracts');

// Состояние источников на 2026-07-23. «blocked» и «empty» — не наш промах разметки,
// а отсутствие данных; такие вузы в кейсы поштучно НЕ идут, иначе панель забьётся
// четырьмя сотнями одинаковых карточек. Они сведены в отчёт и в один сводный кейс.
const SOURCES = {
  kaplan: { dir: path.join(EXTRACTS, 'kaplan'), state: 'ready' },
  'oxford-international': { dir: path.join(EXTRACTS, 'oxford-international'), state: 'ready' },
  qahe: { dir: path.join(EXTRACTS, 'qahe'), state: 'ready' },
  studygroup: { dir: path.join(EXTRACTS, 'studygroup'), state: 'ready' },
  edvoy: { dir: path.join(EXTRACTS, 'edvoy'), state: 'ready' },
  gedu: { dir: GEDU_DIR, state: 'ready' },
  direct: { dir: path.join(EXTRACTS, 'direct'), state: 'ready' },
  // IAPro открылся 2026-07-23: ProgrammeFinder отдаёт названия, уровни и города.
  // Цен там нет — по стоимости эти вузы сверяются другими источниками.
  iapro: { dir: path.join(EXTRACTS, 'iapro'), state: 'ready' },
  qs: { dir: null, state: 'blocked', why: 'портал QS Apply отклонил учётные данные, программ нет' },
  navitas: { dir: null, state: 'empty', why: 'у сайтов колледжей нет типа записи «курс», сбор не дал программ' },
  cats: { dir: null, state: 'empty', why: 'у CATS школы, а не программы в единой форме' },
};

const FEE_TOLERANCE = 0.02;   // ниже — округление источника, не расхождение
const CASE_CAP_PER_UNI = 20;  // потолок поштучных кейсов на вуз; остаток уходит в сводный

const readJson = async (f) => { try { return JSON.parse(await fs.readFile(f, 'utf8')); } catch { return null; } };

// ------------------------------------------------------------------ загрузка --

async function loadSourceIndex() {
  const index = new Map();   // slug → [{ src, data }]
  const loaded = {};
  for (const [src, cfg] of Object.entries(SOURCES)) {
    if (cfg.state !== 'ready') { loaded[src] = 0; continue; }
    let files = [];
    try { files = (await fs.readdir(cfg.dir)).filter((f) => f.endsWith('.json')); } catch { files = []; }
    let n = 0;
    for (const f of files) {
      const data = await readJson(path.join(cfg.dir, f));
      if (!data) continue;
      const slug = data.catalogSlug ?? data.slug ?? f.replace(/\.json$/, '');
      if (!index.has(slug)) index.set(slug, []);
      index.get(slug).push({ src, data });
      n++;
    }
    loaded[src] = n;
  }
  return { index, loaded };
}

// Объединение программ источников. Дубли внутри объединения схлопываем по
// нормализованному названию, но цену подтягиваем из того источника, где она есть:
// у одного вуза Edvoy даёт название, а Kaplan — сумму.
function unionPrograms(entries) {
  const out = [];
  const byNorm = new Map();
  for (const { src, data } of entries) {
    for (const raw of data.programs ?? []) {
      const p = normProgram(raw, src, data.currency);
      if (!p.norm) continue;
      const seen = byNorm.get(p.norm);
      if (!seen) { byNorm.set(p.norm, p); out.push(p); continue; }
      if (!seen.fee && p.fee) seen.fee = p.fee;
      if (!seen.level && p.level) seen.level = p.level;
      if (!seen.duration && p.duration) seen.duration = p.duration;
      seen.via = seen.via === p.via ? seen.via : `${seen.via}+${p.via}`;
    }
  }
  return out;
}

function unionCampuses(entries) {
  const set = new Set();
  for (const { data } of entries) {
    for (const c of data.campuses ?? []) set.add(typeof c === 'string' ? c : (c.title ?? c.name ?? ''));
    for (const p of data.programs ?? []) for (const c of p.campuses ?? []) set.add(String(c));
    if (data.campus) set.add(String(data.campus));
  }
  set.delete('');
  return [...set];
}

// --------------------------------------------------------------- сопоставление --

// Сначала точные совпадения нормализованных названий, потом жадное сближение
// по Жаккару. Порядок важен: без точного прохода «BA Business» может увести
// к «BA Business Management» и обе программы отчитаются как расхождение.
function pairPrograms(catalog, source) {
  const pairs = [];
  const srcByNorm = new Map();
  for (const p of source) if (!srcByNorm.has(p.norm)) srcByNorm.set(p.norm, p);

  const usedSrc = new Set();
  const restCat = [];

  for (const c of catalog) {
    const hit = srcByNorm.get(c.norm);
    if (hit && !usedSrc.has(hit)) { pairs.push({ cat: c, src: hit, how: 'exact' }); usedSrc.add(hit); }
    else restCat.push(c);
  }

  const restSrc = source.filter((p) => !usedSrc.has(p));
  for (const c of restCat.slice()) {
    let best = null; let bestScore = 0;
    for (const s of restSrc) {
      if (usedSrc.has(s)) continue;
      if (isSubsetPair(c.title, s.title)) continue;   // специализация, а не другое написание
      const score = similarity(c.title, s.title);
      if (score > bestScore) { bestScore = score; best = s; }
    }
    if (best && bestScore >= SIM_THRESHOLD) {
      pairs.push({ cat: c, src: best, how: 'fuzzy', score: Number(bestScore.toFixed(2)) });
      usedSrc.add(best);
      restCat.splice(restCat.indexOf(c), 1);
    }
  }

  return {
    pairs,
    catalogOnly: restCat,
    sourceOnly: source.filter((p) => !usedSrc.has(p)),
  };
}

// ---------------------------------------------------------------------- замер --

async function main() {
  const map = await readJson(path.join(KOMPAS_DIR, 'partner-source-map.json')) ?? {};
  const { index, loaded } = await loadSourceIndex();
  const now = new Date().toISOString();

  const files = (await fs.readdir(WORK_DIR)).filter((f) => f.endsWith('.json'));
  const report = [];
  const cases = [];
  const skipped = { blockedOnly: [], emptyOnly: [], notPartner: 0, noFileButReady: [] };

  for (const f of files) {
    const slug = f.replace(/\.json$/, '');
    const card = await readJson(path.join(WORK_DIR, f));
    if (!card) continue;

    const ps = card.partnerSource ?? map[slug] ?? { type: 'none', via: [] };
    if (ps.type === 'none') { skipped.notPartner++; continue; }

    const assigned = ps.type === 'direct' ? ['direct', ...(ps.via ?? [])] : (ps.via ?? []);
    const ready = assigned.filter((s) => SOURCES[s]?.state === 'ready');
    const blocked = assigned.filter((s) => SOURCES[s]?.state === 'blocked');
    const empty = assigned.filter((s) => SOURCES[s]?.state === 'empty');

    const entries = (index.get(slug) ?? []).filter((e) => ready.includes(e.src));

    const catPrograms = (card.programs ?? []).map((p) => normCatalogProgram(p, card));

    if (!entries.length) {
      // Нет данных. Разделяем ЧЕСТНО: закрытый портал — это блокер и не наш пробел;
      // источник готов, а файла нет — это уже дыра сбора, и она идёт в кейсы.
      const row = {
        slug, name: card.name ?? slug, type: ps.type, assigned, ready, blocked, empty,
        status: ready.length ? 'no-extract' : (blocked.length ? 'source-blocked' : 'source-empty'),
        catalogPrograms: catPrograms.length, sourcePrograms: 0,
      };
      report.push(row);
      if (ready.length) {
        skipped.noFileButReady.push(slug);
        cases.push({
          id: `${slug}||kompas_no_extract||${ready.join('+')}`,
          slug, name: row.name,
          issue: 'kompas_no_extract',
          severity: 'warning',
          detail: `Вуз размечен партнёром через ${ready.join(', ')}, источник собран, но выгрузки по этому вузу нет. В карточке ${catPrograms.length} программ — сверить не с чем.`,
          catalog: catPrograms.length, official: null, program: null, sourceUrl: card.sourceUrl ?? null,
          checkedAt: now, decision: null, decidedAt: null, applied: false,
        });
      } else if (blocked.length) skipped.blockedOnly.push(slug);
      else skipped.emptyOnly.push(slug);
      continue;
    }

    const srcPrograms = unionPrograms(entries);
    const { pairs, catalogOnly, sourceOnly } = pairPrograms(catPrograms, srcPrograms);

    // ---- цены
    const feeMismatch = []; const feeMissingInCatalog = []; const feeCurrency = [];
    for (const { cat, src } of pairs) {
      if (!src.fee) continue;
      if (!cat.fee) { feeMissingInCatalog.push({ program: cat.title, slug: cat.slug, source: src.fee, via: src.via }); continue; }
      if (cat.fee.currency !== src.fee.currency) {
        feeCurrency.push({ program: cat.title, slug: cat.slug, catalog: cat.fee, source: src.fee, via: src.via });
        continue;
      }
      const rel = Math.abs(cat.fee.amount - src.fee.amount) / Math.max(cat.fee.amount, src.fee.amount);
      if (rel > FEE_TOLERANCE) {
        feeMismatch.push({
          program: cat.title, slug: cat.slug,
          catalog: cat.fee.amount, source: src.fee.amount, currency: src.fee.currency,
          basis: src.fee.basis, audience: src.fee.audience, via: src.via,
          rel: Number((rel * 100).toFixed(1)),
        });
      }
    }

    // ---- кампусы (описания и стипендии источники не отдают — см. отчёт)
    const srcCampuses = unionCampuses(entries);
    const catCampuses = (card.campuses ?? []).map((c) => String(c.title ?? c.sub ?? ''));
    const campusMissing = srcCampuses.filter(
      (s) => !catCampuses.some((c) => similarity(c, s) >= 0.6),
    );

    const row = {
      slug, name: card.name ?? slug, type: ps.type, assigned, ready, blocked, empty,
      status: 'compared',
      catalogPrograms: catPrograms.length,
      sourcePrograms: srcPrograms.length,
      matched: pairs.length,
      matchedFuzzy: pairs.filter((p) => p.how === 'fuzzy').length,
      catalogOnly: catalogOnly.length,
      sourceOnly: sourceOnly.length,
      catalogWithFee: catPrograms.filter((p) => p.fee).length,
      sourceWithFee: srcPrograms.filter((p) => p.fee).length,
      feeMismatch: feeMismatch.length,
      feeMissingInCatalog: feeMissingInCatalog.length,
      feeCurrency: feeCurrency.length,
      catalogCampuses: catCampuses.length,
      sourceCampuses: srcCampuses.length,
      campusMissing: campusMissing.length,
      hasDescription: Boolean(card.description && String(card.description).trim()),
      scholarships: (card.scholarships ?? []).length,
      samples: {
        sourceOnly: sourceOnly.slice(0, 5).map((p) => p.title),
        catalogOnly: catalogOnly.slice(0, 5).map((p) => p.title),
        feeMismatch: feeMismatch.slice(0, 5),
        // Пары нечёткого совпадения выписываем нарочно: цифра «совпало N» ничего
        // не доказывает, брак ловится просмотром самих пар (урок сессии 3).
        fuzzyPairs: pairs.filter((p) => p.how === 'fuzzy').slice(0, 5)
          .map((p) => ({ catalog: p.cat.title, source: p.src.title, score: p.score })),
      },
    };
    report.push(row);

    // ---- кейсы
    const push = (o) => cases.push({
      slug, name: row.name, catalog: null, official: null, program: null,
      sourceUrl: entries[0]?.data?.sourceUrl ?? null,
      checkedAt: now, decision: null, decidedAt: null, applied: false, ...o,
    });

    if (sourceOnly.length) {
      push({
        id: `${slug}||kompas_programs_missing||${sourceOnly.length}`,
        issue: 'kompas_programs_missing',
        severity: catPrograms.length === 0 ? 'critical' : (sourceOnly.length > catPrograms.length ? 'warning' : 'info'),
        detail: `Источник (${ready.join(', ')}) даёт ${srcPrograms.length} программ, в карточке ${catPrograms.length}. Нет в карточке: ${sourceOnly.length}. Примеры: ${sourceOnly.slice(0, 6).map((p) => `«${p.title}»`).join(', ')}`,
        catalog: catPrograms.length, official: srcPrograms.length,
      });
    }
    if (catalogOnly.length) {
      push({
        id: `${slug}||kompas_programs_extra||${catalogOnly.length}`,
        issue: 'kompas_programs_extra',
        severity: 'warning',
        detail: `В карточке ${catalogOnly.length} программ, которых нет ни в одном назначенном источнике (${ready.join(', ')}). Либо источник их не показывает, либо запись устарела/выдумана — удалять нельзя (правило 4), нужно решение. Примеры: ${catalogOnly.slice(0, 6).map((p) => `«${p.title}»`).join(', ')}`,
        catalog: catalogOnly.length, official: srcPrograms.length,
      });
    }

    // Цены — поштучно: это единица решения оператора, как у СОРОКИ.
    const shown = feeMismatch.slice(0, CASE_CAP_PER_UNI);
    for (const m of shown) {
      push({
        id: `${slug}||kompas_fee_mismatch||${m.slug}`,
        issue: 'kompas_fee_mismatch',
        severity: m.basis === 'from' || m.basis === 'level' ? 'info' : 'warning',
        detail: `«${m.program}»: в каталоге ${m.catalog} ${m.currency}, у источника ${m.source} ${m.currency} (${m.via}), расхождение ${m.rel}%${m.basis ? `, основа цены источника: ${m.basis}` : ''}${m.audience ? `, аудитория: ${m.audience}` : ''}.`,
        catalog: m.catalog, official: m.source, currency: m.currency, program: m.program,
      });
    }
    if (feeMismatch.length > shown.length) {
      push({
        id: `${slug}||kompas_fee_mismatch_rest||${feeMismatch.length}`,
        issue: 'kompas_fee_mismatch_rest',
        severity: 'info',
        detail: `Ещё ${feeMismatch.length - shown.length} расхождений цены сверх показанных ${shown.length} — полный список в sources/kompas/diff-report.json.`,
        catalog: feeMismatch.length, official: shown.length,
      });
    }
    if (feeMissingInCatalog.length) {
      push({
        id: `${slug}||kompas_fee_absent||${feeMissingInCatalog.length}`,
        issue: 'kompas_fee_absent',
        severity: 'info',
        detail: `У источника есть цена по ${feeMissingInCatalog.length} программам, в карточке цены нет. Примеры: ${feeMissingInCatalog.slice(0, 5).map((x) => `«${x.program}» ${x.source.amount} ${x.source.currency}`).join('; ')}`,
        catalog: 0, official: feeMissingInCatalog.length,
      });
    }
    if (feeCurrency.length) {
      push({
        id: `${slug}||kompas_fee_currency||${feeCurrency.length}`,
        issue: 'kompas_fee_currency',
        severity: 'critical',
        detail: `Валюта не совпадает у ${feeCurrency.length} программ: каталог ${feeCurrency[0].catalog.currency}, источник ${feeCurrency[0].source.currency}. Это недостоверность на сайте, а не округление. Примеры: ${feeCurrency.slice(0, 5).map((x) => `«${x.program}» ${x.catalog.amount} ${x.catalog.currency} vs ${x.source.amount} ${x.source.currency}`).join('; ')}`,
        catalog: feeCurrency[0].catalog.amount, official: feeCurrency[0].source.amount,
      });
    }
    if (campusMissing.length) {
      push({
        id: `${slug}||kompas_campus_missing||${campusMissing.length}`,
        issue: 'kompas_campus_missing',
        severity: 'info',
        detail: `Источник называет кампусы, которых нет в карточке (${campusMissing.length}): ${campusMissing.slice(0, 6).join(', ')}.`,
        catalog: catCampuses.length, official: srcCampuses.length,
      });
    }
  }

  // Сводный кейс по блокерам — один, а не четыре сотни одинаковых.
  if (skipped.blockedOnly.length) {
    cases.push({
      id: `__kompas__||kompas_source_blocked||${skipped.blockedOnly.length}`,
      slug: '__kompas__', name: 'КОМПАС — блокеры источников',
      issue: 'kompas_source_blocked',
      severity: 'warning',
      detail: `${skipped.blockedOnly.length} вузов сверить не с чем: их единственный источник за логином и данные не получены (QS Apply, GUS Gateway). Нужен рабочий доступ от владельца. Полный список — в sources/kompas/diff-report.json.`,
      catalog: skipped.blockedOnly.length, official: null, program: null, sourceUrl: null,
      checkedAt: now, decision: null, decidedAt: null, applied: false,
    });
  }
  if (skipped.emptyOnly.length) {
    cases.push({
      id: `__kompas__||kompas_source_empty||${skipped.emptyOnly.length}`,
      slug: '__kompas__', name: 'КОМПАС — источники без программ',
      issue: 'kompas_source_empty',
      severity: 'warning',
      detail: `${skipped.emptyOnly.length} вузов сверить не с чем: назначенный источник данных о программах не отдаёт (Navitas — нет типа записи «курс»; CATS — школы, а не программы).`,
      catalog: skipped.emptyOnly.length, official: null, program: null, sourceUrl: null,
      checkedAt: now, decision: null, decidedAt: null, applied: false,
    });
  }

  // ------------------------------------------------------------------- выдача --
  const compared = report.filter((r) => r.status === 'compared');
  const sum = (k) => compared.reduce((a, r) => a + (r[k] ?? 0), 0);
  const byIssue = {};
  for (const c of cases) byIssue[c.issue] = (byIssue[c.issue] ?? 0) + 1;

  const summary = {
    catalogFiles: files.length,
    notPartner: skipped.notPartner,
    partners: report.length,
    compared: compared.length,
    sourceBlocked: skipped.blockedOnly.length,
    sourceEmpty: skipped.emptyOnly.length,
    noExtract: skipped.noFileButReady.length,
    programsCatalog: sum('catalogPrograms'),
    programsSource: sum('sourcePrograms'),
    matched: sum('matched'),
    matchedFuzzy: sum('matchedFuzzy'),
    catalogOnly: sum('catalogOnly'),
    sourceOnly: sum('sourceOnly'),
    feeMismatch: sum('feeMismatch'),
    feeMissingInCatalog: sum('feeMissingInCatalog'),
    feeCurrency: sum('feeCurrency'),
    campusMissing: sum('campusMissing'),
    extractsLoaded: loaded,
    caseCapPerUni: CASE_CAP_PER_UNI,
    feeTolerance: FEE_TOLERANCE,
  };

  await fs.writeFile(path.join(KOMPAS_DIR, 'diff-report.json'), JSON.stringify({
    generatedAt: now, scope: 'kompas-session4', summary,
    blockedSlugs: skipped.blockedOnly, emptySlugs: skipped.emptyOnly, noExtractSlugs: skipped.noFileButReady,
    universities: report,
  }, null, 2) + '\n', 'utf8');

  await fs.writeFile(path.join(KOMPAS_DIR, 'diff-review.json'), JSON.stringify({
    generatedAt: now, scope: 'kompas-diff',
    summary: { total: cases.length, byIssue },
    items: cases,
  }, null, 2) + '\n', 'utf8');

  // Таблица владельцу: только вузы с расхождениями, по убыванию веса.
  const weight = (r) => r.sourceOnly + r.catalogOnly + r.feeMismatch * 3 + r.feeCurrency * 10;
  const worst = compared.filter((r) => weight(r) > 0).sort((a, b) => weight(b) - weight(a));
  const md = [
    '# КОМПАС — сессия 4: расхождения «каталог vs источник»',
    '',
    `**Дата:** ${now.slice(0, 10)} · сети нет, каталог не тронут (только чтение).`,
    '',
    '## Сводка',
    '',
    '| Показатель | Значение |',
    '|---|---|',
    `| Карточек в рабочей копии | ${summary.catalogFiles} |`,
    `| Из них партнёрских | ${summary.partners} (не партнёры: ${summary.notPartner}) |`,
    `| **Сверено с источником** | **${summary.compared}** |`,
    `| Сверить не с чем: источник за логином | ${summary.sourceBlocked} (QS, IAPro) |`,
    `| Сверить не с чем: источник без программ | ${summary.sourceEmpty} (Navitas, CATS) |`,
    `| Сверить не с чем: источник готов, выгрузки по вузу нет | ${summary.noExtract} |`,
    `| Программ в каталоге (сверенные вузы) | ${summary.programsCatalog} |`,
    `| Программ у источников (объединение) | ${summary.programsSource} |`,
    `| Совпало названий | ${summary.matched} (из них по написанию: ${summary.matchedFuzzy}) |`,
    `| Есть в каталоге, нет у источника | ${summary.catalogOnly} |`,
    `| Есть у источника, нет в каталоге | ${summary.sourceOnly} |`,
    `| Цена расходится | ${summary.feeMismatch} |`,
    `| **Валюта расходится** | **${summary.feeCurrency}** |`,
    `| У источника цена есть, в каталоге нет | ${summary.feeMissingInCatalog} |`,
    `| Кампусы источника, которых нет в карточке | ${summary.campusMissing} |`,
    '',
    `Кейсов в панель: **${cases.length}** — ${Object.entries(byIssue).map(([k, v]) => `${k} ${v}`).join(', ')}.`,
    '',
    `Потолок поштучных кейсов на вуз — ${CASE_CAP_PER_UNI|| 0}; остаток сведён в кейс `
      + '`kompas_fee_mismatch_rest`, полный список расхождений — в `diff-report.json` (ничего не срезано молча).',
    '',
    '## Худшие 40 вузов',
    '',
    '| Вуз | Источник | Каталог | Источник, программ | Совпало | Только каталог | Только источник | Цена ≠ | Валюта ≠ |',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|',
    ...worst.slice(0, 40).map((r) => `| ${r.name} (\`${r.slug}\`) | ${r.ready.join('+')} | ${r.catalogPrograms} | ${r.sourcePrograms} | ${r.matched} | ${r.catalogOnly} | ${r.sourceOnly} | ${r.feeMismatch} | ${r.feeCurrency} |`),
    '',
    '## Расхождение валюты (недостоверность на сайте)',
    '',
    '| Вуз | Программ | Источники |',
    '|---|---:|---|',
    ...compared.filter((r) => r.feeCurrency).sort((a, b) => b.feeCurrency - a.feeCurrency)
      .map((r) => `| ${r.name} (\`${r.slug}\`) | ${r.feeCurrency} | ${r.ready.join('+')} |`),
    '',
  ].join('\n');
  await fs.writeFile(path.join(KOMPAS_DIR, 'DIFF-REPORT.md'), md + '\n', 'utf8');

  log(`сверено ${compared.length}, кейсов ${cases.length}: ${Object.entries(byIssue).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  console.log('DIFF DONE', JSON.stringify(summary));
}

main().catch((e) => { console.error(e); process.exit(1); });
