#!/usr/bin/env node
// kompas-fix-currency.mjs — P0.4: валюта, где страна ≠ валюта (точечно).
//
// Диагноз (замер 2026-07-24): движок нашёл 79 «расхождений валюты» у 11 вузов.
// Правило плана: массовый авто-фикс «по источнику» ЗАПРЕЩЁН — он сломает корректное.
// Валюта в схеме одна на карточку (card.tuition.currency), решает страна вуза,
// а не источник. Каждый случай сверен со страной и суммами вручную:
//
//   • card.currency == национальная валюта страны  → каталог ПРАВ, источник
//     показывает пересчёт (UK в GBP, источник в USD/EUR; Canada в CAD и т.п.).
//     Таких 6 — не трогаем.
//   • card в USD, источник в локальной (MYR/AED), но СУММЫ карточки — настоящий
//     USD-масштаб (apu 4.5–7.8k, dubai 11–27k), а не локальная валюта под меткой USD
//     (был бы в 3.7–4.7× больше). Это легитимный международный прайс — не трогаем.
//   • offshore-кампусы австралийских вузов в AUD родителя (curtin-singapore,
//     murdoch-dubai, edith-cowan-sl, dli-bandung) — защитимая конвенция, не трогаем.
//   • bhms: Швейцария, card=EUR, но суммы (27–38k) — это ФРАНКИ (BHMS прайсит в CHF),
//     источник подтверждает CHF, EUR/CHF ≈ паритет → метка EUR ошибочна.
//     ЕДИНСТВЕННЫЙ настоящий баг → относка на CHF (суммы валидны как франки).
//
// Работает на КОПИИ sources/kompas/catalog-work. Снятое в бэкап, откат одной командой.
// Запуск: node kompas-fix-currency.mjs [--apply]

import fs from 'node:fs/promises';
import path from 'node:path';
import { KOMPAS_DIR, args, logger } from './lib/kompas-collect.mjs';

const log = logger('fix-currency');
const APPLY = args.has('apply');
const WORK = path.join(KOMPAS_DIR, 'catalog-work');
const now = new Date().toISOString();
const readJson = async (f) => JSON.parse(await fs.readFile(f, 'utf8'));

// Точечные относки метки валюты. Только value-safe (пара валют ≈ паритет, сумма
// как число остаётся верной в новой валюте) И валюта должна быть в enum схемы
// сайта (USD/EUR/GBP/KZT/RUB/CAD/AUD/NZD) — иначе карточка станет невалидной и
// сломает сборку + отображение (символы и конвертация в KZT знают только 6 валют).
const RELABEL = [
  {
    slug: 'bhms', from: 'EUR', to: 'CHF',
    reason: 'BHMS — швейцарская школа гостеприимства (Люцерн), прайсит в CHF. '
      + 'Суммы карточки (27–38k) — франки; метка EUR ошибочна, источник даёт CHF. '
      + 'CHF добавлен в enum схемы + символ + курс KZT (решение владельца 2026-07-25). '
      + 'EUR/CHF ≈ паритет, сумма как число остаётся верной под новой валютой.',
  },
];

// Разобранные и оставленные без изменений (для прозрачности — валютный обзор сделан,
// а не пропущен). Сводятся в ОДИН кейс панели, а не в 10 (урок 9: кейсы не размножать).
const REVIEWED_KEEP = [
  { slug: 'arden', why: 'UK, каталог GBP = нац. валюта; источник EUR — пересчёт' },
  { slug: 'chester', why: 'UK, каталог GBP = нац. валюта; источник USD — пересчёт' },
  { slug: 'global-banking-school', why: 'UK, каталог GBP = нац. валюта; источник EUR — пересчёт' },
  { slug: 'niagara-falls', why: 'Canada, каталог CAD = нац. валюта; источник GBP — пересчёт' },
  { slug: 'hult', why: 'US HQ, каталог USD = нац. валюта; источник AED/GBP — другие кампусы' },
  { slug: 'schiller-international-university', why: 'US HQ, каталог USD = нац. валюта; источник EUR/GBP — кампусы ЕС' },
  { slug: 'apu-malaysia', why: 'Malaysia, каталог USD — настоящий международный прайс (4.5–7.8k USD), не MYR под меткой USD' },
  { slug: 'heriot-watt-malaysia', why: 'Malaysia, каталог USD — настоящий международный прайс (3.5–11.5k USD)' },
  { slug: 'de-montfort-dubai', why: 'UAE, каталог USD — настоящий международный прайс (11.5–19.5k USD), не AED под меткой USD' },
  { slug: 'middlesex-dubai', why: 'UAE, каталог USD — настоящий международный прайс (12.5–27.5k USD)' },
  { slug: 'curtin-singapore', why: 'Singapore, AUD — офшорный кампус австралийского Curtin, прайс родителя' },
  { slug: 'murdoch-dubai', why: 'UAE, AUD — офшорный кампус австралийского Murdoch, прайс родителя' },
];

async function main() {
  if (!APPLY) log('СУХОЙ ПРОГОН: только считаю. Для записи добавь --apply');
  const backup = [];
  const rows = [];

  for (const fix of RELABEL) {
    const file = path.join(WORK, `${fix.slug}.json`);
    let u;
    try { u = await readJson(file); } catch { log(`  нет карточки: ${fix.slug}`); continue; }
    const cur = u.tuition?.currency ?? null;
    if (cur !== fix.from) {
      rows.push({ slug: fix.slug, было: cur, стало: '(пропуск)', note: `валюта уже ${cur}, не ${fix.from}` });
      continue;
    }
    backup.push({ slug: fix.slug, from: fix.from, to: fix.to });
    rows.push({ slug: fix.slug, было: fix.from, стало: fix.to, note: 'relabel' });
    if (APPLY) {
      u.tuition.currency = fix.to;
      u.lastChecked = now.slice(0, 10);
      await fs.writeFile(file, JSON.stringify(u, null, 2) + '\n', 'utf8');
    }
  }

  // Кейсы: по одному на относку + один сводный «разобрано, оставлено».
  const cases = [];
  for (const b of backup) {
    const fix = RELABEL.find((r) => r.slug === b.slug);
    cases.push({
      id: `${b.slug}||kompas_fee_currency_fixed||${b.from}-${b.to}`,
      slug: b.slug, name: b.slug,
      issue: 'kompas_fee_currency_fixed',
      severity: 'info',
      detail: `Валюта карточки исправлена ${b.from} → ${b.to}. ${fix.reason} Суммы не пересчитывались (относка метки). Откат — sources/kompas/currency-fix-backup.json.`,
      catalog: null, official: null, program: null, sourceUrl: null,
      checkedAt: now, decision: 'applied', decidedAt: now, applied: true,
    });
  }
  cases.push({
    id: `__kompas__||kompas_fee_currency_reviewed||${REVIEWED_KEEP.length}`,
    slug: '__kompas__', name: 'КОМПАС — валютный обзор P0.4',
    issue: 'kompas_fee_currency_reviewed',
    severity: 'info',
    detail: `79 расхождений валюты сверены со страной вуза. Авто-относок валюты: ${backup.length} (bhms EUR→CHF). `
      + `Остальные ${REVIEWED_KEEP.length} проверенных вузов — легитимны, оставлены как есть: `
      + REVIEWED_KEEP.map((r) => `${r.slug} (${r.why})`).join('; ') + '.',
    catalog: null, official: null, program: null, sourceUrl: null,
    checkedAt: now, decision: null, decidedAt: null, applied: false,
  });

  if (APPLY) {
    await fs.writeFile(path.join(KOMPAS_DIR, 'currency-fix-backup.json'),
      JSON.stringify({ generatedAt: now, note: 'Относки метки валюты P0.4. Откат: вернуть tuition.currency в поле from.', relabels: backup }, null, 2) + '\n', 'utf8');
    await fs.writeFile(path.join(KOMPAS_DIR, 'currency-fix-review.json'),
      JSON.stringify({ generatedAt: now, scope: 'kompas-fix-currency', summary: { relabeled: backup.length, reviewedKept: REVIEWED_KEEP.length }, items: cases }, null, 2) + '\n', 'utf8');
  }

  console.table(rows);
  console.log(`ИТОГО: относок валюты ${backup.length}, разобрано без изменений ${REVIEWED_KEEP.length}`);
  console.log(APPLY ? 'ПРИМЕНЕНО к catalog-work + бэкап + кейсы' : 'СУХОЙ ПРОГОН — для записи добавь --apply');
}

main().catch((e) => { console.error(e); process.exit(1); });
