// kompas-direct-cases.mjs — КОМПАС 3.5: непривязанное превращаем в КЕЙСЫ, а не в данные.
// Сети не нужно, каталог не трогаем.
//
// Зачем: у прямых партнёров цена почти нигде не стоит рядом с программой — она лежит
// сводным прайсом, где подпись это «Total Tuition Fees in USD» или «Bachelor’s degrees».
// Растянуть такую цену на все программы уровня = ровно та фабрикация, из-за которой
// у 10 британских вузов Navitas сейчас стоят выдуманные суммы. Поэтому неоднозначное
// уходит оператору в панель, как это уже сделано у СОРОКИ и БОБРа.
//
// Формат кейса совпадает с soroka-review.json, чтобы панель /manager читала его так же.
//
// Запуск: node kompas-direct-cases.mjs

import fs from 'node:fs/promises';
import path from 'node:path';
import { KOMPAS_DIR, CATALOG_DIR, logger } from './lib/kompas-collect.mjs';

const log = logger('cases');
const DIR = path.join(KOMPAS_DIR, 'extracts', 'direct');
const OUT = path.join(KOMPAS_DIR, 'direct-review.json');

const readJson = async (f) => { try { return JSON.parse(await fs.readFile(f, 'utf8')); } catch { return null; } };

async function main() {
  const files = (await fs.readdir(DIR)).filter((f) => f.endsWith('.json'));
  const runReport = await readJson(path.join(KOMPAS_DIR, 'direct-collect-report.json'));
  const items = [];
  const now = new Date().toISOString();

  for (const f of files) {
    const j = await readJson(path.join(DIR, f));
    if (!j) continue;
    const uni = await readJson(path.join(CATALOG_DIR, `${j.slug}.json`));
    const name = uni?.name ?? j.name ?? j.slug;
    const programs = j.programs ?? [];

    // 1. Строки прайса, которые не удалось честно привязать к программе.
    //    Оператор видит сумму, валюту, подпись и адрес страницы — и решает сам.
    for (const r of j.feeTable ?? []) {
      items.push({
        id: `${j.slug}||direct_fee_unlinked||${r.amount}-${r.currency}-${(r.label || '').slice(0, 40)}`,
        slug: j.slug,
        name,
        issue: 'direct_fee_unlinked',
        severity: 'info',
        detail: `Прайс офсайта: ${r.amount} ${r.currency}${r.feeAudience ? ` (${r.feeAudience})` : ''} — подпись «${r.label}». К конкретной программе не привязано: подпись не является названием программы. Строка на странице: «${r.rawCell ?? ''}»`,
        catalog: null,
        official: r.amount,
        currency: r.currency,
        feeAudience: r.feeAudience ?? null,
        sourceUrl: r.feeUrl,
        program: null,
        checkedAt: now,
        decision: null, decidedAt: null, applied: false,
      });
    }

    // 2. Вуз, у которого сбор не дал ни одной программы — разбирать сайт отдельно.
    if (!programs.length) {
      items.push({
        id: `${j.slug}||direct_zero_programs||site`,
        slug: j.slug, name,
        issue: 'direct_zero_programs',
        severity: 'warning',
        detail: `Офсайт ${j.sourceUrl} обычным обходом не отдал ни одной страницы курса (найдено адресов: ${j.urlsSeen ?? 0}, из них курсовых ${j.courseUrlsFound ?? 0}). Нужен разбор под этот домен.`,
        catalog: uni?.programs?.length ?? null,
        official: 0,
        sourceUrl: j.sourceUrl,
        program: null,
        checkedAt: now,
        decision: null, decidedAt: null, applied: false,
      });
    }

    // 3. Выдача упёрлась в потолок — часть программ заведомо не собрана.
    if (j.capped) {
      items.push({
        id: `${j.slug}||direct_capped||${j.pageCap}`,
        slug: j.slug, name,
        issue: 'direct_capped',
        severity: 'warning',
        detail: `Найдено ${j.courseUrlsFound} адресов курсов, разобрано ${j.pagesFetched} (потолок ${j.pageCap}). Остаток не собран.`,
        catalog: uni?.programs?.length ?? null,
        official: j.courseUrlsFound,
        sourceUrl: j.sourceUrl,
        program: null,
        checkedAt: now,
        decision: null, decidedAt: null, applied: false,
      });
    }
  }

  // 4. Вузы, у которых офсайт вообще неизвестен: в карточке стоит адрес агрегатора.
  for (const r of runReport?.report ?? []) {
    if (r.status !== 'no-official-site' && r.status !== 'unreachable') continue;
    items.push({
      id: `${r.slug}||direct_${r.status === 'unreachable' ? 'unreachable' : 'no_official_site'}||site`,
      slug: r.slug,
      name: r.name ?? r.slug,
      issue: r.status === 'unreachable' ? 'direct_site_unreachable' : 'direct_no_official_site',
      severity: 'warning',
      detail: r.status === 'unreachable'
        ? `Сайт ${r.official} не ответил ни на одном написании адреса (проверены http/https, с www и без). Нужен рабочий адрес от владельца.`
        : 'Офсайт неизвестен: в карточке каталога стоит адрес агрегатора (edge.edvoy.com). Нужен адрес от владельца — сами не угадываем.',
      catalog: null, official: null, program: null,
      checkedAt: now,
      decision: null, decidedAt: null, applied: false,
    });
  }

  const byIssue = {};
  for (const it of items) byIssue[it.issue] = (byIssue[it.issue] ?? 0) + 1;

  await fs.writeFile(OUT, JSON.stringify({
    generatedAt: now,
    scope: 'kompas-direct',
    summary: { total: items.length, byIssue },
    items,
  }, null, 2) + '\n', 'utf8');

  log(`кейсов ${items.length}: ${Object.entries(byIssue).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  console.log('DIRECT-CASES DONE');
}

main().catch((e) => { console.error(e); process.exit(1); });
