// kompas-direct-audit.mjs — КОМПАС, сессия 3.5, задача 1: ЗАМЕР прямых партнёров.
// Сети не нужно. Ничего не пишет в каталог. Отвечает на один вопрос:
// что на самом деле лежит в scraper/sources/official-extracts у 35 прямых партнёров.
//
// Урок сессии 3: замерщик врёт так же охотно, как коллектор. Поэтому скрипт не только
// считает, но и ВЫПИСЫВАЕТ образцы названий — чтобы владелец/оператор посмотрел глазами.
//
// Запуск: node kompas-direct-audit.mjs
// Выход:  sources/kompas/direct-audit.json + sources/kompas/DIRECT-AUDIT.md

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AGG_DOMAINS } from './lib/official-site.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(HERE, '..');
const REGISTRY = path.join(HERE, 'sources', 'partner-registry.json');
const EXTRACTS = path.join(HERE, 'sources', 'official-extracts');
const CATALOG = path.join(REPO, 'site', 'src', 'content', 'universities');
// Артефакты КОМПАСа живут в КОРНЕ репозитория, не в scraper/sources.
const OUT_DIR = path.join(REPO, 'sources', 'kompas');
const SOURCE_MAP = path.join(OUT_DIR, 'partner-source-map.json');

// Признаки «это не программа, а пункт меню / заголовок статьи».
// Собраны по уже пойманным случаям: Collab (27 карточек), EnglishPath, Study Group.
const NOT_A_PROGRAM = [
  /^(our|the)\s+(courses|programmes|programs)\b/i,
  /^(top|best|popular)\s+/i,
  /\b(how to|why |what is|guide|tips|deadlines?|application periods?)\b/i,
  /\bscholarship opportunities\b/i,
  /^(about|contact|news|blog|admissions?|apply|fees?|tuition fees?|accommodation|student life|campus life|visa|faq)\b/i,
  /^(high school diploma|bachelor'?s degree \(\d)/i,
  /\bin china\b/i,
  /^(read more|learn more|find out more|view all|see all)\b/i,
];

const isSuspicious = (t) => !t || NOT_A_PROGRAM.some((re) => re.test(t.trim()));

// Цена может лежать под разными именами — эти файлы собирались разными скриптами.
function findMoney(p) {
  const cands = [p.tuition, p.tuitionFee, p.fee, p.fees, p.price, p.cost];
  for (const c of cands) {
    if (c == null) continue;
    if (typeof c === 'number' && c > 0) return { amount: c, currency: p.currency ?? null };
    if (typeof c === 'string' && /\d/.test(c)) return { amount: c, currency: p.currency ?? null };
    if (typeof c === 'object') {
      const amt = c.amount ?? c.value ?? c.min ?? null;
      if (amt != null && String(amt).match(/\d/)) return { amount: amt, currency: c.currency ?? null };
    }
  }
  return null;
}

const slugVariants = (s) =>
  !s ? [] : [s, s.replace(/-university.*$/, ''), s.replace(/^university-of-/, ''), s.replace(/-+/g, '-')];

async function readJson(f) {
  try { return JSON.parse(await fs.readFile(f, 'utf8')); } catch { return null; }
}

async function main() {
  const registry = await readJson(REGISTRY);
  const sourceMap = await readJson(SOURCE_MAP);
  const files = new Set((await fs.readdir(EXTRACTS)).filter((f) => f.endsWith('.json')));
  const catalogFiles = new Set((await fs.readdir(CATALOG)).filter((f) => f.endsWith('.json')));

  // Привязка «партнёр из документа → карточка каталога» живёт в карте сессии 1
  // (у записей реестра поля catalogSlug почти нигде нет — оно есть ровно у одной).
  const byRaw = new Map();
  for (const [slug, v] of Object.entries(sourceMap)) {
    if (v?.type === 'direct' && v.directRaw) byRaw.set(v.directRaw, slug);
  }

  const rows = [];

  for (const dp of registry.directPartners) {
    const catalogSlug = byRaw.get(dp.raw) ?? dp.catalogSlug ?? null;
    const tried = [...new Set([...slugVariants(catalogSlug), ...slugVariants(dp.extract)])];
    const hit = tried.find((s) => files.has(`${s}.json`));

    const row = {
      raw: dp.raw,
      catalogSlug,
      extractSlug: dp.extract ?? null,
      note: dp.note ?? null,
      hasCatalogCard: catalogSlug ? catalogFiles.has(`${catalogSlug}.json`) : false,
      extractFile: hit ? `${hit}.json` : null,
      triedSlugs: hit ? undefined : tried,
    };

    if (hit) {
      const j = await readJson(path.join(EXTRACTS, `${hit}.json`));
      const programs = Array.isArray(j?.programs) ? j.programs : [];
      let host = null;
      try { host = j?.sourceUrl ? new URL(j.sourceUrl).hostname : null; } catch { /* битый url */ }

      const withMoney = programs.filter((p) => findMoney(p));
      const suspicious = programs.filter((p) => isSuspicious(p.title));

      Object.assign(row, {
        sourceUrl: j?.sourceUrl ?? null,
        sourceHost: host,
        // ГЛАВНАЯ проверка: файл лежит в official-extracts, но офсайт ли это на самом деле
        sourceIsOfficial: host ? !AGG_DOMAINS.test(host) : null,
        scrapedAt: j?.scrapedAt ? String(j.scrapedAt).slice(0, 10) : null,
        programs: programs.length,
        withPrice: withMoney.length,
        withCurrency: withMoney.filter((m) => m.currency).length,
        withLevel: programs.filter((p) => p.level).length,
        withProgramUrl: programs.filter((p) => p.programUrl).length,
        withFeeAudience: programs.filter((p) => p.feeAudience).length,
        suspiciousTitles: suspicious.length,
        // для просмотра ГЛАЗАМИ — иначе цифрам верить нельзя
        sampleTitles: programs.slice(0, 6).map((p) => p.title),
        sampleSuspicious: suspicious.slice(0, 4).map((p) => p.title),
        samplePrice: withMoney.slice(0, 2).map((m) => `${m.amount} ${m.currency ?? '?'}`),
      });
    }

    // сколько программ у этого вуза в ЖИВОМ каталоге — для сравнения объёма
    if (row.hasCatalogCard) {
      const c = await readJson(path.join(CATALOG, `${catalogSlug}.json`));
      const cp = Array.isArray(c?.programs) ? c.programs : [];
      row.catalogPrograms = cp.length;
      row.catalogWithPrice = cp.filter((p) => findMoney(p)).length;
    }

    rows.push(row);
  }

  const found = rows.filter((r) => r.extractFile);
  const summary = {
    generatedAt: new Date().toISOString(),
    directPartners: rows.length,
    withCatalogCard: rows.filter((r) => r.hasCatalogCard).length,
    withExtractFile: found.length,
    extractFromOfficialSite: found.filter((r) => r.sourceIsOfficial === true).length,
    extractFromAggregator: found.filter((r) => r.sourceIsOfficial === false).length,
    totalPrograms: found.reduce((a, r) => a + (r.programs || 0), 0),
    totalWithPrice: found.reduce((a, r) => a + (r.withPrice || 0), 0),
    totalSuspicious: found.reduce((a, r) => a + (r.suspiciousTitles || 0), 0),
    filesInFolder: files.size,
  };

  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(
    path.join(OUT_DIR, 'direct-audit.json'),
    JSON.stringify({ summary, rows }, null, 2),
    'utf8',
  );

  // Читаемый отчёт: таблица + образцы названий, чтобы смотреть глазами.
  const L = [];
  L.push('# КОМПАС 3.5 — замер прямых партнёров (official-extracts)', '');
  L.push(`Сгенерировано: ${summary.generatedAt.slice(0, 16).replace('T', ' ')} · сети не использовалось`, '');
  L.push('## Сводка', '');
  L.push('| Показатель | Значение |', '|---|---|');
  for (const [k, v] of Object.entries(summary)) if (k !== 'generatedAt') L.push(`| ${k} | ${v} |`);
  L.push('');
  L.push('## По вузам', '');
  L.push('| Партнёр | Карточка | Файл | Источник | Офсайт? | Дата | Прогр. | С ценой | Подозрит. | В каталоге |');
  L.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) {
    L.push(
      `| ${r.raw} | ${r.hasCatalogCard ? '✔' : '—'} | ${r.extractFile ?? '**НЕТ**'} | ${r.sourceHost ?? '—'} | ` +
        `${r.sourceIsOfficial === true ? '✔' : r.sourceIsOfficial === false ? '**АГРЕГАТОР**' : '—'} | ` +
        `${r.scrapedAt ?? '—'} | ${r.programs ?? '—'} | ${r.withPrice ?? '—'} | ${r.suspiciousTitles ?? '—'} | ${r.catalogPrograms ?? '—'} |`,
    );
  }
  L.push('', '## Образцы названий (смотреть глазами)', '');
  for (const r of found) {
    L.push(`### ${r.raw} — \`${r.extractFile}\``);
    L.push(`Источник: ${r.sourceUrl ?? '—'}`);
    for (const t of r.sampleTitles) L.push(`- ${t}`);
    if (r.sampleSuspicious.length) L.push(`- ⚠️ похоже на меню/статью: ${r.sampleSuspicious.join(' · ')}`);
    if (r.samplePrice.length) L.push(`- 💰 ${r.samplePrice.join(' · ')}`);
    L.push('');
  }
  await fs.writeFile(path.join(OUT_DIR, 'DIRECT-AUDIT.md'), L.join('\n'), 'utf8');

  console.log(JSON.stringify(summary, null, 2));
  console.log('DIRECT-AUDIT DONE');
}

main().catch((e) => { console.error(e); process.exit(1); });
