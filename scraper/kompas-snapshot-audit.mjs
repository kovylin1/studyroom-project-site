#!/usr/bin/env node
// КОМПАС, сессия 3 — замер снимков закрытых агрегаторов (Edvoy / StudyGroup / GEDU).
// Сети нет. Ничего не пишет в каталог. Отвечает на один вопрос:
// «файл есть» — это ещё не «данные годные». Что именно лежит в снимках и чему верить.
//
// Запуск: node scraper/kompas-snapshot-audit.mjs [--json]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const SNAPSHOTS = [
  { key: 'edvoy', dir: path.join(ROOT, 'sources/edvoy-extracts') },
  { key: 'studygroup', dir: path.join(ROOT, 'sources/studygroup-extracts') },
  { key: 'gedu', dir: path.join(ROOT, 'scraper/sources/gedu-extracts') },
];

const CATALOG = path.join(ROOT, 'site/src/content/universities');

// Признаки мусора, пойманные в сессии 1 на снимке Study Group: в выгрузку попали
// заголовки интерфейса и новостей вместо названий программ.
const JUNK_TITLE = [
  /^university$/i,
  /^universities$/i,
  /^courses?$/i,
  /^programmes?$/i,
  /^study (group|options)$/i,
  /^(read|find out) more$/i,
  /partners? with/i,
  /^exciting new/i,
  /^news$/i,
  /^blog$/i,
  /^apply now$/i,
  /^(home|about us|contact)$/i,
];

const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

// Форма поля цены за годы разошлась по коллекторам, и каждая несёт валюту по-своему:
// edvoy — «19950 GBP», studygroup — «£19,500», gedu — feePerYear + отдельное currency.
const SYMBOL_CURRENCY = { '£': 'GBP', '€': 'EUR', $: 'USD', '₹': 'INR', 'A$': 'AUD', 'C$': 'CAD' };

function feeFields(p) {
  return [p.tuition, p.tuitionFee, p.feePerYear, p.fee, p.price];
}

function priceOf(p) {
  for (const c of feeFields(p)) {
    if (c == null) continue;
    if (typeof c === 'number') return c > 0 ? c : null;
    const raw = typeof c === 'object' ? c.amount : c;
    if (raw == null) continue;
    const n = Number(String(raw).replace(/[^\d.]/g, ''));
    if (n > 0) return n;
  }
  return null;
}

function currencyOf(p) {
  const direct = p.currency || p.tuitionCurrency || p.tuition?.currency;
  if (direct) return String(direct).toUpperCase();
  for (const c of feeFields(p)) {
    if (typeof c !== 'string') continue;
    const code = c.match(/\b(GBP|USD|EUR|AUD|CAD|NZD|CHF|SGD|AED|INR|MYR|KRW|CNY|TRY|PLN|CZK|HUF)\b/i);
    if (code) return code[1].toUpperCase();
    for (const [sym, cur] of Object.entries(SYMBOL_CURRENCY)) {
      if (c.includes(sym)) return cur;
    }
  }
  return null;
}

const catalogSlugs = new Set(
  fs.existsSync(CATALOG)
    ? fs.readdirSync(CATALOG).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''))
    : []
);

const report = [];

for (const snap of SNAPSHOTS) {
  if (!fs.existsSync(snap.dir)) {
    report.push({ key: snap.key, error: 'директории нет: ' + snap.dir });
    continue;
  }
  const files = fs.readdirSync(snap.dir).filter((f) => f.endsWith('.json'));
  const r = {
    key: snap.key,
    dir: path.relative(ROOT, snap.dir),
    files: files.length,
    unis: 0,
    emptyPrograms: 0,
    programs: 0,
    withPrice: 0,
    withCurrency: 0,
    withDuration: 0,
    junkTitles: [],
    dupTitles: 0,
    currencies: {},
    scrapedAt: { min: null, max: null },
    inCatalog: 0,
    notInCatalog: [],
    parseErrors: [],
  };

  for (const f of files) {
    let j;
    try {
      j = readJson(path.join(snap.dir, f));
    } catch (e) {
      r.parseErrors.push(f + ': ' + e.message);
      continue;
    }
    r.unis++;
    const slug = j.slug || f.replace(/\.json$/, '');
    if (catalogSlugs.has(slug)) r.inCatalog++;
    else r.notInCatalog.push(slug);

    if (j.scrapedAt) {
      const d = String(j.scrapedAt).slice(0, 10);
      if (!r.scrapedAt.min || d < r.scrapedAt.min) r.scrapedAt.min = d;
      if (!r.scrapedAt.max || d > r.scrapedAt.max) r.scrapedAt.max = d;
    }

    const progs = Array.isArray(j.programs) ? j.programs : [];
    if (progs.length === 0) r.emptyPrograms++;
    r.programs += progs.length;

    const seen = new Set();
    for (const p of progs) {
      const title = String(p.title || p.name || '').trim();
      if (seen.has(title.toLowerCase())) r.dupTitles++;
      seen.add(title.toLowerCase());

      if (!title || JUNK_TITLE.some((re) => re.test(title))) {
        if (r.junkTitles.length < 40) r.junkTitles.push({ slug, title: title || '(пусто)' });
      }
      if (priceOf(p) != null) r.withPrice++;
      const cur = currencyOf(p);
      if (cur) {
        r.withCurrency++;
        r.currencies[cur] = (r.currencies[cur] || 0) + 1;
      }
      if (p.duration) r.withDuration++;
    }
  }
  report.push(r);
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  for (const r of report) {
    if (r.error) {
      console.log(`\n### ${r.key}: ${r.error}`);
      continue;
    }
    console.log(`\n### ${r.key}  (${r.dir})`);
    console.log(`  файлов ${r.files}, разобрано ${r.unis}, ошибок разбора ${r.parseErrors.length}`);
    console.log(`  снято: ${r.scrapedAt.min || '?'} … ${r.scrapedAt.max || '?'}`);
    console.log(`  программ ${r.programs}; с ценой ${r.withPrice}; с валютой ${r.withCurrency}; с длительностью ${r.withDuration}`);
    console.log(`  вузов без программ ${r.emptyPrograms}; дублей названий ${r.dupTitles}`);
    console.log(`  валюты: ${Object.entries(r.currencies).map(([k, v]) => k + ':' + v).join(', ') || '—'}`);
    console.log(`  слаг есть в каталоге: ${r.inCatalog}/${r.unis}; нет: ${r.notInCatalog.length}`);
    if (r.notInCatalog.length) console.log(`    ${r.notInCatalog.slice(0, 12).join(', ')}${r.notInCatalog.length > 12 ? ' …' : ''}`);
    if (r.junkTitles.length) {
      console.log(`  подозрительные названия (первые ${Math.min(10, r.junkTitles.length)}):`);
      for (const t of r.junkTitles.slice(0, 10)) console.log(`    ${t.slug}: «${t.title}»`);
    }
    for (const e of r.parseErrors.slice(0, 5)) console.log(`  ОШИБКА ${e}`);
  }
  console.log('');
}
