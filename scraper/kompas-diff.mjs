// kompas-diff.mjs — КОМПАС, сессия 4: замер расхождений «карточка каталога vs источник».
//
// Что делает: по каждому партнёрскому вузу берёт карточку рабочей копии
// (sources/kompas/catalog-work) и сравнивает с ОБЪЕДИНЕНИЕМ выгрузок его источников
// (правило 3 плана: агрегаторы дополняют друг друга, не режут).
//
// Ядро сравнения вынесено в lib/kompas-diff-core.mjs (сессия 5) — этот файл только
// раскладывает результат diffUniversity в отчёт и кейсы панели. Сети нет, каталог
// не трогается (правило 5).
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
import {
  WORK_DIR, SOURCES, FEE_TOLERANCE, readJson,
  loadSourceIndex, resolveAssignment, diffUniversity,
} from './lib/kompas-diff-core.mjs';

const log = logger('diff');

const CASE_CAP_PER_UNI = 20;  // потолок поштучных кейсов на вуз; остаток уходит в сводный

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

    const { ps, assigned, ready, blocked, empty } = resolveAssignment(card, slug, map);
    if (ps.type === 'none') { skipped.notPartner++; continue; }

    const entries = (index.get(slug) ?? []).filter((e) => ready.includes(e.src));
    const catProgramsLen = (card.programs ?? []).length;

    if (!entries.length) {
      // Нет данных. Разделяем ЧЕСТНО: закрытый портал — это блокер и не наш пробел;
      // источник готов, а файла нет — это уже дыра сбора, и она идёт в кейсы.
      const row = {
        slug, name: card.name ?? slug, type: ps.type, assigned, ready, blocked, empty,
        status: ready.length ? 'no-extract' : (blocked.length ? 'source-blocked' : 'source-empty'),
        catalogPrograms: catProgramsLen, sourcePrograms: 0,
      };
      report.push(row);
      if (ready.length) {
        skipped.noFileButReady.push(slug);
        cases.push({
          id: `${slug}||kompas_no_extract||${ready.join('+')}`,
          slug, name: row.name,
          issue: 'kompas_no_extract',
          severity: 'warning',
          detail: `Вуз размечен партнёром через ${ready.join(', ')}, источник собран, но выгрузки по этому вузу нет. В карточке ${catProgramsLen} программ — сверить не с чем.`,
          catalog: catProgramsLen, official: null, program: null, sourceUrl: card.sourceUrl ?? null,
          checkedAt: now, decision: null, decidedAt: null, applied: false,
        });
      } else if (blocked.length) skipped.blockedOnly.push(slug);
      else skipped.emptyOnly.push(slug);
      continue;
    }

    const d = diffUniversity(card, entries);
    const { catPrograms, srcPrograms, pairs, catalogOnly, sourceOnly,
      feeMismatch, feeMissingInCatalog, feeCurrency, catCampuses, srcCampuses, campusMissing } = d;

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
