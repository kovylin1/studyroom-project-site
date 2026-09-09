#!/usr/bin/env node
// kompas-fix-card-currency.mjs — валюта карточки против страны вуза (подготовка к 3.1).
//
// ЗАЧЕМ. Карточка держит ОДНУ валюту на все программы, и деплойный гейт требует, чтобы
// она совпадала с валютой страны (GARBAGE:currency). После заведения новых карточек
// с edvoy таких расхождений пять: ILSC (CAD при Манчестере), Rutgers Camden (GBP при
// США), Wollongong (AED при Австралии), UP Education (AUD при Новой Зеландии) и старый
// Dublin ISC. Просто переписать ярлык нельзя: суммы не пересчитываются, и те же числа
// молча начинают значить другие деньги — 33 960 «фунтов» превратятся в 33 960 «долларов».
//
// ЧТО ДЕЛАЕТ. Сначала каждой цене проставляет ЕЁ СОБСТВЕННУЮ валюту
// (program.tuitionCurrency — поле из КОМПАС 3.5-a, ровно для этого и заведённое):
// цены, которые молча наследовали валюту карточки, получают её явно. Только после
// этого валюта карточки меняется на валюту страны. Ни одно число не трогается, ни одна
// сумма не меняет смысла — витрина пересчитает их сама (site/src/lib/tuition.ts,
// annualTuitionValues).
//
// ЧЕГО НЕ ДЕЛАЕТ. Не переставляет страну (это отдельное решение по уликам источника),
// не пересчитывает суммы по курсу и не трогает карточки, где валюта страны неизвестна —
// у офшорных кампусов (ОАЭ, Малайзия, Сингапур) валюта и должна жить при программе.
//
// Сети нет. По умолчанию НИЧЕГО НЕ ПИШЕТ, запись только по --apply (см. задачу 3.25).
//   node scraper/kompas-fix-card-currency.mjs
//   node scraper/kompas-fix-card-currency.mjs --apply
//   node scraper/kompas-fix-card-currency.mjs --dir=site/src/content/universities --apply

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COUNTRY_CURRENCY, LOCAL_CURRENCY, SCHEMA_CURRENCIES } from './lib/country-currency.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const dirArg = process.argv.find((a) => a.startsWith('--dir='));
const DIR = dirArg ? path.resolve(ROOT, dirArg.slice('--dir='.length)) : path.join(ROOT, 'sources/kompas/catalog-work');
const APPLY = process.argv.includes('--apply');
const OUT_MD = path.join(ROOT, 'sources/kompas/FIX-CARD-CURRENCY.md');
const BACKUP = path.join(ROOT, 'sources/kompas/fix-card-currency-backup.json');

async function main() {
  const files = (await fs.readdir(DIR)).filter((f) => f.endsWith('.json'));
  const done = [];
  const skipped = [];

  for (const f of files) {
    const fp = path.join(DIR, f);
    let card;
    try { card = JSON.parse(await fs.readFile(fp, 'utf8')); } catch { continue; }
    const have = card.tuition?.currency;

    // Карточка без валюты вовсе. Заведение новых карточек оставляет
    // `tuition.currency: null`, когда цен у вуза нет ни одной, — в рабочей копии
    // это никого не смущало, а zod на сборке сайта валит весь build: поле
    // обязательное. Цен нет, значит переписывать нечего: ставим валюту страны.
    if (!SCHEMA_CURRENCIES.has(have)) {
      const local = LOCAL_CURRENCY[card.country];
      const priced = Object.keys(card.tuition?.byProgram ?? {}).length;
      if (!local || priced) {
        skipped.push({ slug: card.slug ?? f, from: have ?? 'нет', to: local ?? '—',
          reason: priced ? priced + ' цен при валюте вне схемы — руками' : 'валюта страны «' + card.country + '» неизвестна' });
        continue;
      }
      if (APPLY) {
        if (!card.tuition) card.tuition = { currency: local, byProgram: {} };
        else card.tuition.currency = local;
        await fs.writeFile(fp, JSON.stringify(card, null, 2) + '\n', 'utf8');
      }
      done.push({ slug: card.slug ?? f.replace(/\.json$/, ''), name: card.name ?? '', country: card.country,
        city: card.city ?? null, from: have ?? 'нет', to: local, stamped: 0, alreadyOwn: 0, prices: 0, ownCurrencies: [] });
      continue;
    }

    const want = COUNTRY_CURRENCY[card.country];
    if (!want || have === want) continue;

    const fees = card.tuition.byProgram ?? {};
    const priced = Object.keys(fees);
    const programs = card.programs ?? [];
    const byslug = new Map(programs.map((p) => [p.slug, p]));

    if (!SCHEMA_CURRENCIES.has(want)) {
      skipped.push({ slug: card.slug ?? f, reason: 'валюта страны вне схемы: ' + want, from: have, to: want });
      continue;
    }

    // Цены, которые сейчас молча читаются как валюта карточки.
    const inherit = priced.filter((s) => byslug.has(s) && !byslug.get(s).tuitionCurrency);
    const own = priced.filter((s) => byslug.get(s)?.tuitionCurrency);
    const orphan = priced.filter((s) => !byslug.has(s));

    if (orphan.length) {
      // Цена без программы — стамп ставить некуда, а значит смысл суммы после смены
      // ярлыка изменится. Такое чинится не здесь (см. workcopy-check).
      skipped.push({ slug: card.slug ?? f, reason: orphan.length + ' цен без программы', from: have, to: want });
      continue;
    }

    if (APPLY) {
      for (const s of inherit) byslug.get(s).tuitionCurrency = have;
      card.tuition.currency = want;
      await fs.writeFile(fp, JSON.stringify(card, null, 2) + '\n', 'utf8');
    }
    done.push({
      slug: card.slug ?? f.replace(/\.json$/, ''), name: card.name ?? '', country: card.country, city: card.city ?? null,
      from: have, to: want, stamped: inherit.length, alreadyOwn: own.length, prices: priced.length,
      ownCurrencies: [...new Set(own.map((s) => byslug.get(s).tuitionCurrency))],
    });
  }

  if (APPLY) {
    // Файл отката НАКОПИТЕЛЬНЫЙ: прогонов бывает два — по рабочей копии и по живому
    // каталогу, — и вторая запись начисто стёрла бы первую точку отката.
    let prev = { runs: [] };
    try { prev = JSON.parse(await fs.readFile(BACKUP, 'utf8')); } catch { /* первого прогона не было */ }
    if (!Array.isArray(prev.runs)) prev = { runs: prev.changes ? [{ generatedAt: prev.generatedAt, dir: prev.dir, changes: prev.changes }] : [] };
    prev.runs = prev.runs.filter((r) => r.dir !== path.relative(ROOT, DIR));
    // откат: вернуть карточке валюту from и снять tuitionCurrency у stamped-программ
    prev.runs.push({ generatedAt: new Date().toISOString(), dir: path.relative(ROOT, DIR), changes: done });
    await fs.writeFile(BACKUP, JSON.stringify(prev, null, 2) + '\n', 'utf8');
  }

  const md = [];
  const p = (...s) => md.push(...s);
  p('# Валюта карточки против страны — правка перед 3.1', '');
  p('Скрипт `scraper/kompas-fix-card-currency.mjs`. Каталог: `' + path.relative(ROOT, DIR).replace(/\\/g, '/') + '`.');
  p('Режим: ' + (APPLY ? '**запись**' : 'разбор без записи') + '. Снято ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC.', '');
  p('Суммы не пересчитываются. Каждая цена сперва получает свою валюту явно, и только', '');
  p('потом валюта карточки становится валютой страны.', '');
  p('| Карточка | Страна / город | Валюта карточки | Цен | Проставлено валют | Уже свои |', '|---|---|---|---:|---:|---|');
  for (const d of done) {
    p('| `' + d.slug + '` | ' + d.country + ' / ' + (d.city ?? '—') + ' | ' + d.from + ' → ' + d.to + ' | '
      + d.prices + ' | ' + d.stamped + ' | ' + (d.ownCurrencies.length ? d.ownCurrencies.join(', ') + ' (' + d.alreadyOwn + ')' : '—') + ' |');
  }
  p('');
  if (skipped.length) {
    p('## Не тронуто', '');
    p('| Карточка | Почему | Валюта |', '|---|---|---|');
    for (const s of skipped) p('| `' + s.slug + '` | ' + s.reason + ' | ' + s.from + ' → ' + s.to + ' |');
    p('');
  }
  p('## На глаз владельцу', '');
  p('Проставленная валюта — это то, что сказал источник, а не то, что похоже на правду.');
  p('Отдельно стоит посмотреть Rutgers Camden: edvoy отдал все 59 цен в GBP при');
  p('американском вузе, и суммы (33–46 тысяч) больше похожи на доллары. Пока источник');
  p('говорит «фунты» — в каталоге фунты; переписывать за источник без улик мы не будем.', '');
  await fs.writeFile(OUT_MD, md.join('\n'), 'utf8');

  console.log((APPLY ? 'ЗАПИСАНО' : 'РАЗБОР (без записи)') + ': карточек ' + done.length + ', пропущено ' + skipped.length);
  for (const d of done) console.log('  ' + d.slug + ': ' + d.from + ' → ' + d.to + ', валют проставлено ' + d.stamped + ' из ' + d.prices);
  for (const s of skipped) console.log('  пропущено ' + s.slug + ': ' + s.reason);
  console.log('отчёт: ' + path.relative(ROOT, OUT_MD));
  if (!APPLY) console.log('ничего не записано — для записи добавь --apply');
}

await main();
