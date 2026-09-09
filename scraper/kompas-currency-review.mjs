#!/usr/bin/env node
// kompas-currency-review.mjs — разбор расхождений валюты у вузов, которых не
// покрыл ручной проход P0.4 (они появились в сверке уже после сбора QS).
//
// ПРЕЦЕДЕНТ P0.4 (kompas-fix-currency.mjs, разбор владельца): валюта в схеме одна
// на карточку, и решает её страна вуза, а не источник. Источник законно
// показывает другое: пересчёт, прайс кампуса в валюте головного вуза,
// международный прайс в USD. Массовый «фикс по источнику» там запретили, вывод
// был «каталог прав» у всех, кроме одного вуза (bhms, уже починен). Флип валюты
// остаётся решением человека — скрипт его не делает.
//
// ЧТО ЭТОТ СКРИПТ ДОБАВЛЯЕТ К ПРЕЦЕДЕНТУ. Он проверяет то, чего сверка не меряет
// вообще: при разной валюте она сравнивает валюты и на этом останавливается,
// сумму не сравнивает никогда. Поэтому под «расхождением валюты» может прятаться
// расхождение ЧИСЛА — на странице вуза стоит цена, которой у источника нет ни в
// какой валюте. Пересчёт по справочному курсу это показывает. Курс сюда
// подставляется только для оценки масштаба и в данные не пишется НИКОГДА.
//
// Итог: вопрос валюты закрывается по прецеденту (`ignore`), а если пересчитанная
// сумма разошлась больше чем на 10 % — заводится отдельный кейс на сумму.
//
// Запуск: node kompas-currency-review.mjs [--apply]

import fs from 'node:fs/promises';
import path from 'node:path';
import { KOMPAS_DIR, args, logger } from './lib/kompas-collect.mjs';
import { WORK_DIR, readJson, loadSourceIndex, resolveAssignment, diffUniversity } from './lib/kompas-diff-core.mjs';

const log = logger('currency');
const APPLY = args.has('apply');
const REVIEW = path.join(KOMPAS_DIR, 'diff-review.json');
const REPORT = path.join(KOMPAS_DIR, 'CURRENCY-REVIEW.md');

/** Национальная валюта страны — та же таблица, что в добор-скриптах. */
export const NAT = {
  Australia: 'AUD', Austria: 'EUR', Belgium: 'EUR', Canada: 'CAD', China: 'CNY',
  Cyprus: 'EUR', 'Czech Republic': 'CZK', Denmark: 'DKK', Finland: 'EUR', France: 'EUR',
  Germany: 'EUR', Hungary: 'HUF', India: 'INR', Indonesia: 'IDR', Ireland: 'EUR', Italy: 'EUR',
  Japan: 'JPY', Latvia: 'EUR', Lithuania: 'EUR', Malaysia: 'MYR', Malta: 'EUR',
  Netherlands: 'EUR', 'New Zealand': 'NZD', Poland: 'PLN', Portugal: 'EUR', Singapore: 'SGD',
  'South Korea': 'KRW', Spain: 'EUR', 'Sri Lanka': 'LKR', Switzerland: 'CHF', Turkey: 'TRY',
  UAE: 'AED', 'United Arab Emirates': 'AED', USA: 'USD', 'United States': 'USD',
  'United Kingdom': 'GBP',
};
/** Валюты международного прайса: законны для вуза любой страны. */
export const INTL = new Set(['USD', 'EUR']);

// Справочный курс к доллару, только для оценки масштаба расхождения.
// AED и SGD у доллара привязаны/почти привязаны, остальное — порядок величины.
export const RATE_TO_USD = {
  USD: 1, AED: 1 / 3.6725, EUR: 1.09, GBP: 1.27, CAD: 1 / 1.36, AUD: 1 / 1.52,
  NZD: 1 / 1.65, MYR: 1 / 4.4, SGD: 1 / 1.34, CHF: 1.12, HUF: 1 / 355, CZK: 1 / 23,
  PLN: 1 / 3.9, TRY: 1 / 33, INR: 1 / 84, CNY: 1 / 7.2, JPY: 1 / 150,
};

export const toUsd = (amount, cur) => (RATE_TO_USD[cur] ? amount * RATE_TO_USD[cur] : null);

/**
 * Решение по валюте одной карточки. Возвращает {decision, note}.
 * `catalogCur` — валюта карточки, `country` — страна вуза.
 */
export function decideCurrency(catalogCur, country) {
  const nat = NAT[country] ?? null;
  if (catalogCur === nat) {
    return { decision: 'ignore', note: `Валюта каталога ${catalogCur} — национальная валюта страны вуза (${country}). Источник показывает свой прайс в другой валюте; по прецеденту P0.4 валюту карточки определяет страна вуза, а не источник.` };
  }
  if (INTL.has(catalogCur)) {
    return { decision: 'ignore', note: `Валюта каталога ${catalogCur} — международный прайс, для вуза в ${country} он законен (прецедент P0.4: offshore-кампус и международный набор прайсятся в USD/EUR). Флип валюты на ${nat ?? 'местную'} — решение владельца, не скрипта.` };
  }
  return { decision: null, why: `валюта каталога ${catalogCur} не национальная для ${country} (${nat ?? 'нет в таблице'}) и не международная — разбирать руками` };
}

async function main() {
  if (!APPLY) log('СУХОЙ ПРОГОН: только считаю. Для записи добавь --apply');
  const map = await readJson(path.join(KOMPAS_DIR, 'partner-source-map.json')) ?? {};
  const { index } = await loadSourceIndex();
  const review = JSON.parse(await fs.readFile(REVIEW, 'utf8'));
  // Берём ВСЕ кейсы валюты, а не только нерешённые: решение по валюте и вопрос
  // о сумме — разные вещи. Закрытая валюта не значит, что сумма сошлась, а
  // пересчёт по ней никто не считал (сверка при разной валюте суммы не сравнивает).
  // Первый заход этого не учитывал: после переноса решений список открытых стал
  // пуст, и отчёт перезаписался пустым, унеся с собой уже найденные расхождения.
  const open = review.items.filter((i) => i.issue === 'kompas_fee_currency');
  const now = new Date().toISOString();

  const rows = []; const newCases = []; let closed = 0;

  for (const it of open) {
    const card = await readJson(path.join(WORK_DIR, `${it.slug}.json`));
    if (!card) { rows.push({ slug: it.slug, verdict: 'карточки нет в рабочей копии' }); continue; }
    const { ready } = resolveAssignment(card, it.slug, map);
    const entries = (index.get(it.slug) ?? []).filter((e) => ready.includes(e.src));
    const { feeCurrency } = entries.length ? diffUniversity(card, entries) : { feeCurrency: [] };

    const cur = card.tuition?.currency ?? null;
    const d = decideCurrency(cur, card.country);

    // Пересчёт: сравниваем то, чего сверка не сравнивает — сумму.
    const gaps = [];
    for (const p of feeCurrency) {
      const a = toUsd(p.catalog.amount, p.catalog.currency);
      const b = toUsd(p.source.amount, p.source.currency);
      if (a == null || b == null) continue;
      const rel = Math.abs(a - b) / Math.max(a, b);
      gaps.push({ program: p.program, catalog: `${p.catalog.amount} ${p.catalog.currency}`, source: `${p.source.amount} ${p.source.currency}`, usdCatalog: Math.round(a), usdSource: Math.round(b), rel: Number((rel * 100).toFixed(1)) });
    }
    const bad = gaps.filter((g) => g.rel > 10);

    rows.push({
      slug: it.slug, name: card.name, country: card.country, catalogCur: cur,
      programs: feeCurrency.length, decision: d.decision ?? '—',
      fxWorst: gaps.length ? Math.max(...gaps.map((g) => g.rel)) : null,
      fxBad: bad.length,
    });

    if (d.decision && !it.decision) {
      closed++;
      if (APPLY) { it.decision = d.decision; it.decidedAt = now; it.decisionNote = d.note; }
    }

    if (bad.length) {
      newCases.push({
        id: `${it.slug}||kompas_fee_amount_fx||${bad.length}`,
        slug: it.slug, name: card.name,
        issue: 'kompas_fee_amount_fx',
        severity: 'warning',
        detail: `У ${bad.length} программ расходится не только валюта, но и сама сумма: после пересчёта по справочному курсу разница больше 10 %. Сверка этого не показывает — при разной валюте она сумму не сравнивает вовсе. Примеры: ${bad.slice(0, 4).map((g) => `«${g.program}» каталог ${g.catalog} (~$${g.usdCatalog}) против источника ${g.source} (~$${g.usdSource}), ${g.rel}%`).join('; ')}. Курс справочный, в данные не пишется.`,
        catalog: null, official: bad.length, program: null, sourceUrl: null,
        checkedAt: now, decision: null, decidedAt: null, applied: false,
      });
    }
  }

  if (APPLY) {
    const known = new Set(review.items.map((i) => i.id));
    for (const c of newCases) if (!known.has(c.id)) review.items.push(c);
    review.summary = { ...(review.summary ?? {}), total: review.items.length };
    await fs.writeFile(REVIEW, JSON.stringify(review, null, 2) + '\n', 'utf8');

    const md = [
      '# Расхождение валюты — разбор вузов, не покрытых P0.4',
      '',
      `**Дата:** ${now.slice(0, 10)} · каталог не тронут, курс справочный и в данные не пишется.`,
      '',
      '| Вуз | Страна | Валюта каталога | Программ | Решение | Худшее расхождение суммы после пересчёта |',
      '|---|---|---|---:|---|---:|',
      ...rows.map((r) => `| ${r.name ?? r.slug} (\`${r.slug}\`) | ${r.country ?? '—'} | ${r.catalogCur ?? '—'} | ${r.programs ?? 0} | ${r.decision} | ${r.fxWorst != null ? `${r.fxWorst}%` : '—'} |`),
      '',
      '## Что это значит',
      '',
      '- Вопрос валюты закрыт прецедентом P0.4: валюту карточки определяет страна вуза, источник вправе прайсить иначе.',
      `- Отдельно заведено ${newCases.length} кейсов на СУММУ: там расходится не только валюта, и сверка такие случаи пропускает по построению.`,
      '',
    ].join('\n');
    await fs.writeFile(REPORT, md + '\n', 'utf8');
  }

  console.table(rows);
  console.log(`ЗАКРЫТО по валюте ${closed} из ${open.length}; новых кейсов на сумму ${newCases.length}`);
  console.log(APPLY ? `ЗАПИСАНО в diff-review.json + ${path.basename(REPORT)}` : 'СУХОЙ ПРОГОН — для записи добавь --apply');
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) await main();
