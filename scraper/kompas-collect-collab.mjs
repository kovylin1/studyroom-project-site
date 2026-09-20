#!/usr/bin/env node
// kompas-collect-collab.mjs — КОМПАС. Collab International (collabinternational.com).
//
// Владелец подтвердил 20.09.2026: Collab International — партнёр. Прежний ВОЛК
// (scrape-volk-collab-v3.mjs, май 2026, «полнота важнее точности») удалён: он
// складывал 121 файл в папку, которую никто не читал, и принимал блог-посты за вузы.
//
// У источника ДВА слоя, и коллектор берёт оба:
//   1. СОСТАВ — официальный PDF «Partner Institutions List» с главной страницы
//      (~190 вузов по 25 странам, обновляется раз в год). В CI нет pdftotext, поэтому
//      текст списка лежит снимком в sources/kompas/collab/partners-list.txt;
//      коллектор сверяет имя PDF на сайте с записанным в снимке и, если файл
//      сменился, честно пишет в замер «снимок устарел» — обновить его руками:
//        pdftotext -layout <pdf> sources/kompas/collab/partners-list.txt
//      и поправить строку «# pdf:» в шапке снимка.
//   2. СТРАНИЦЫ ВУЗОВ — 23 страницы «Study in <страна>» ссылаются на страницы
//      вузов (страна берётся оттуда, а не угадывается по имени). На странице вуза
//      берём ТОЛЬКО структурное: списки программ под заголовком уровня
//      («Undergraduate Programs:» + <ul>) и таблицы цен. Проза не разбирается —
//      из неё в мае и вырос мусор.
//
// Цены у Collab — диапазоны на уровень («15,000 – 25,000 EUR / Annually») либо
// строка на программу в таблице. По решению владельца от 23.08 пишем минимум,
// основа «from», сырую строку сохраняем в feeRaw. Аудитория цены не указана.
//
// Запуск:
//   node scraper/kompas-collect-collab.mjs --dry-run      # только отчёт
//   node scraper/kompas-collect-collab.mjs                # пишет sources/kompas/{extracts/collab,membership/collab.json}
//   node scraper/kompas-collect-collab.mjs --only=fontys  # один вуз

import fs from 'fs/promises';
import path from 'path';
import { KOMPAS_DIR, fetchHtml, decodeEntities, writeExtract, writeMembership, extract, args, logger, stats } from './lib/kompas-collect.mjs';
import { buildCatalogIndex, matchToCatalog } from './lib/kompas-catalog-match.mjs';
import { inferLevel } from './lib/program-level.mjs';

const log = logger('collab');
const AGG = 'collab';
const SITE = 'https://www.collabinternational.com';
const SNAPSHOT = path.join(KOMPAS_DIR, 'collab', 'partners-list.txt');
const dryRun = args.has('dry-run');
const only = args.get('only');

// Названия стран сайта и PDF -> страна в терминах каталога.
const COUNTRY = {
  UK: 'United Kingdom', 'United Kingdom': 'United Kingdom', USA: 'United States', 'United States': 'United States',
  'Czech Republic (Czechia)': 'Czech Republic', Czechia: 'Czech Republic', 'Czech Republic': 'Czech Republic',
  UAE: 'United Arab Emirates', 'United Arab Emirates': 'United Arab Emirates', 'United Arab': 'United Arab Emirates',
  'UNITED KINGDOM': 'United Kingdom', 'UNITED ARAB': 'United Arab Emirates', 'UNITED ARAB EMIRATES': 'United Arab Emirates', CZECHIA: 'Czech Republic',
};
const countryOf = (s) => COUNTRY[s] || s;

// Ручные привязки страниц сайта (ключ — слаг страницы). Каждая с причиной; резолвер
// здесь бессилен: другой порядок слов, полное имя в каталоге, другая страна.
const MANUAL = {
  'wittenborg-university': { slug: 'wittenborg', reason: 'в каталоге полное имя «Wittenborg University of Applied Sciences»' },
  'royal-holloway-university': { slug: 'royal-holloway', reason: 'в каталоге «Royal Holloway, University of London»; есть ещё две карточки-родни (direct-entry, ISC)' },
  'liverpool-university': { slug: 'liverpool', reason: 'порядок слов: «University of Liverpool»' },
  'brunel-university': { slug: 'brunel', reason: 'в каталоге «Brunel University of London»' },
  'debrecen-university': { slug: 'debrecen', reason: 'порядок слов: «University of Debrecen»' },
  'campus-biomedico-university-of-rome': { slug: 'the-campus-bio-medico-university-of-rome-ucbm', reason: 'в каталоге итальянское имя «Università Campus Bio-Medico di Roma»' },
  ied: { slug: 'istituto-europeo-di-design-ied', reason: 'аббревиатура; в каталоге полное имя' },
  'eastern-mediterranean-university': { slug: 'eastern-mediterranean-university', reason: 'сайт относит к Турции, карточка — Северный Кипр; вуз тот же' },
  'eu-business-school': { slug: 'eu-business-school-spain', reason: 'страница на сайте — под Испанией; у каталога четыре карточки EU Business School по странам' },
  'niels-brock-copenhagen-business-college': { slug: null, reason: 'карточки нет; «brock» в каталоге — Brock University в Канаде, не путать' },
  'acibadem-university': { slug: 'ac-badem-university', reason: 'слаг карточки родился из «Acıbadem» с потерянной ı; имя в каталоге — «Acıbadem Mehmet Ali Aydınlar University»' },
};

const strip = (s) => decodeEntities(String(s || '').replace(/<[^>]+>/g, ' ')).replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();

// ------------------------------------------------------------ деньги ----
// «9.031 Euro - 15,250 Euro annually», «€ 9,800 Annually», «5.296 $ - 24.200 $», «15,00 EUR – 35,000 EUR».
// Берём МИНИМАЛЬНУЮ сумму диапазона. Точка между тысячами (9.031) — европейская запись.
const CUR = [[/€|\beur\b|\beuro\b/i, 'EUR'], [/£|\bgbp\b/i, 'GBP'], [/\bcad\b/i, 'CAD'], [/\busd\b|\$/i, 'USD'], [/\btry\b|\btl\b/i, 'TRY'], [/\bpln\b/i, 'PLN'], [/\bhuf\b/i, 'HUF'], [/\bczk\b/i, 'CZK'], [/\bdkk\b/i, 'DKK'], [/\bchf\b/i, 'CHF'], [/\baud\b/i, 'AUD']];
export function parseFee(raw) {
  const t = String(raw || '');
  let currency = null;
  for (const [re, cur] of CUR) if (re.test(t)) { currency = cur; break; }
  const nums = [...t.matchAll(/\d[\d.,]*\d|\d/g)].map((m) => m[0])
    .map((s) => (/^\d{1,3}\.\d{3}$/.test(s) ? s.replace('.', '') : s))    // 9.031 -> 9031
    .map((s) => (/^\d{1,3},\d{2}$/.test(s) ? s.replace(',', '') + '0' : s)) // 15,00 -> 15000 (опечатка источника)
    .map((s) => Number(s.replace(/,/g, '').replace(/\.\d+$/, '')))
    .filter((n) => Number.isFinite(n) && n >= 300 && n <= 200000);
  if (!nums.length || !currency) return null;
  return { amount: Math.min(...nums), currency, range: nums.length > 1 };
}

// ------------------------------------------------------------ уровни ----
const LEVEL_OF_HEAD = [
  [/pre-?master|preparatory|foundation|pathway/i, 'foundation'],
  [/language|english prep/i, 'english-language'],
  [/phd|doctor/i, 'phd'],
  [/undergraduate|bachelor/i, 'bachelor'],
  [/graduate|master|postgraduate|\bpg\b/i, 'master'],
  [/certificate|diploma/i, null],
];
const levelOfHead = (h) => { for (const [re, l] of LEVEL_OF_HEAD) if (re.test(h)) return l; return null; };
const SOURCE_LEVEL = { bachelor: 'Undergraduate', master: 'Postgraduate', foundation: 'Foundation', phd: 'PhD', 'english-language': 'English Course' };

// Заголовок, за которым идёт список программ. Не любой <strong>: «The programs and
// fees of the university are as follows» — вводная фраза, а не уровень.
const PROGRAM_HEAD = /program|department|degree|bachelor|master|undergraduate|graduate|preparat|phd|doctor/i;
const BARE = /^(master'?s?|bachelor'?s?|certificate|diploma|foundation|postgraduate|undergraduate|courses?|programmes?|programs?|degrees?|departments?)$/i;

function parsePrograms(html) {
  const out = [];
  const re = /<strong>([^<]{3,90})<\/strong>\s*(?:<\/p>)?\s*<ul>([\s\S]*?)<\/ul>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const head = strip(m[1]).replace(/:$/, '');
    if (!PROGRAM_HEAD.test(head)) continue;
    const level = levelOfHead(head);
    for (const li of m[2].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)) {
      let title = strip(li[1]);
      if (title.length < 3 || title.length > 200 || BARE.test(title)) continue;
      // «European Studies: 4000 Euros» — цена в самом пункте (Ягеллонский).
      let fee = null;
      const priced = title.match(/^(.*?)[:\-–]\s*((?:€|£|\$)?\s?\d[\d.,]*\s?(?:euros?|eur|usd|gbp|cad|\$|€|£)[^,;]*)$/i);
      if (priced) { title = priced[1].trim(); fee = parseFee(priced[2]); }
      const own = inferLevel(title);
      out.push({ title, head, level: own || level, sourceLevel: SOURCE_LEVEL[level] || undefined, fee });
    }
  }
  return out;
}

// Таблицы: (а) строка уровней + строка цен; (б) «Departments | Prices» построчно;
// (в) «Программа | … | Tuition» построчно. Остальное (семестры, сборы за подачу) — мимо.
function parseTables(html) {
  const levelFees = {};   // level -> { amount, currency, raw }
  const programRows = []; // { title, fee }
  for (const t of html.matchAll(/<table[\s\S]*?<\/table>/g)) {
    const rows = [...t[0].matchAll(/<tr[\s\S]*?<\/tr>/g)].map((r) => [...r[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => strip(c[1])));
    if (rows.length < 2) continue;
    const head = rows[0];
    const headLevels = head.map(levelOfHead);
    if (rows.length === 2 && headLevels.filter(Boolean).length >= 1 && head.every((h) => !parseFee(h))) {
      head.forEach((h, i) => { const lvl = headLevels[i]; const fee = parseFee(rows[1][i]); if (lvl && fee && !levelFees[lvl]) levelFees[lvl] = { ...fee, raw: rows[1][i] }; });
      continue;
    }
    // (в) «Program Name | … | Annual Tuition Fee»; либо таблица с одним заголовком
    // «Undergraduate Program» и строками «General Medicine | 12 | € 11.760» (Масарик).
    let feeCol = head.findIndex((h) => /tuition|fee|price/i.test(h));
    const singleHead = head.length === 1 && rows[1].length >= 2 && parseFee(rows[1][rows[1].length - 1]);
    if (singleHead) feeCol = rows[1].length - 1;
    const headLevel = singleHead ? levelOfHead(head[0]) : null;
    if (feeCol > 0 && (singleHead || /department|program|course|study field|type/i.test(head[0]))) {
      for (const r of rows.slice(1)) {
        const name = r[0]; const fee = parseFee(r[feeCol]);
        if (!name || !fee) continue;
        // «Arts», «Management» — группа курсов, а не программа: без второго слова
        // или степени в названии такую строку не заводим.
        if (!/\s/.test(name.trim()) && !inferLevel(name)) continue;
        const lvl = levelOfHead(name);
        if (lvl && /^(undergraduate|graduate|postgraduate|bachelor'?s?( degree)?|master'?s?( degree)?)$/i.test(name)) { if (!levelFees[lvl]) levelFees[lvl] = { ...fee, raw: r[feeCol] }; continue; }
        if (/^(type|pre-inscription|application|opening|registration|residence|living|insurance|deposit)/i.test(name)) continue;
        const ctxLevel = headLevel || levelOfHead(strip(t[0]).slice(0, 80));
        programRows.push({ title: name, fee: { ...fee, raw: r[feeCol] }, sourceLevel: SOURCE_LEVEL[ctxLevel] || undefined });
      }
    }
  }
  return { levelFees, programRows };
}

// ---------------------------------------------------------- состав ----
const isCountryLine = (s) => /^[A-Z][A-Z ]{2,}$/.test(s) && !/^(UG|PG)$/.test(s);
function parseSnapshot(txt) {
  const meta = {}; const declared = {};
  let country = null; let pending = [];
  const rowsByCountry = {};
  for (const raw of txt.split(/\r?\n/)) {
    if (raw.startsWith('# ')) { const [k, ...v] = raw.slice(2).split(':'); meta[k.trim()] = v.join(':').trim(); continue; }
    const t = raw.trim();
    if (!t) continue;
    if (isCountryLine(t)) { pending.push(t); continue; }
    if (pending.length) {
      const rawCountry = pending.join(' ');
      // Сначала по заглавной записи PDF (USA, UK, UNITED ARAB), потом в обычном регистре.
      country = COUNTRY[rawCountry] || countryOf(rawCountry.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()));
      pending = []; rowsByCountry[country] ||= [];
    }
    if (!country) continue;
    // Две колонки разделены минимум двумя пробелами; внутри названия двойных пробелов нет.
    const cells = raw.split(/\s{2,}/).map((s) => s.trim()).filter((s) => s && !isCountryLine(s));
    if (!cells.length) continue;
    rowsByCountry[country].push({ indent: raw.match(/^\s*/)[0].length, cells });
  }
  // Переносы: ячейка-продолжение начинается со строчной буквы, «(», «&», «and»,
  // либо предыдущая оканчивается на «-», «&», «of», «and», «for», «(», «w.», «Bio-».
  const contStart = /^([a-z]|\(|&|and\b|of\b)/;
  const contEnd = /(-|&|\bof|\band|\bfor|\(|\bw\.)$/;
  for (const [c, rows] of Object.entries(rowsByCountry)) {
    const cols = [[], []];
    for (const r of rows) {
      if (r.cells.length >= 2) { cols[0].push(r.cells[0]); cols[1].push(r.cells.slice(1).join(' ')); }
      else if (r.indent >= 20) cols[1].push(r.cells[0]);
      else cols[0].push(r.cells[0]);
    }
    const names = [];
    for (const col of cols) for (const cell of col) {
      const prev = names[names.length - 1];
      if (prev && (contStart.test(cell) || contEnd.test(prev))) { names[names.length - 1] = `${prev} ${cell}`; continue; }
      names.push(cell);
    }
    declared[c] = names.map((n) => n.replace(/\s+/g, ' ').trim()).filter((n) => n.length >= 3 && !/^(www\.|info@|Our Portal|Application and|For more|website or)/i.test(n));
  }
  delete declared['Partner Institutions List'];
  return { meta, declared };
}

// Имя из PDF -> имя для резолвера: снимаем скобки с пометками и хвосты «(UG)».
const cleanPdfName = (n) => n.replace(/\s*\((UG|PG|Graduate|UG Only|Polytechnic|international college|w\. Spanish Pathway)[^)]*\)/gi, '').replace(/\s*-\s*(Camden|New Brunswick|Toronto|Riga|Florence & Milano)$/i, '').replace(/\s+/g, ' ').trim();

// ------------------------------------------------------------- main ----
async function main() {
  const catalog = await buildCatalogIndex();

  // 1. Состав по PDF (снимок) + проверка, что PDF на сайте тот же.
  const snap = parseSnapshot(await fs.readFile(SNAPSHOT, 'utf8'));
  let livePdf = null;
  try {
    const home = await fetchHtml(SITE + '/');
    livePdf = (home.match(/href="([^"]*partners?-list[^"]*\.pdf)"/i) || [])[1] || null;
  } catch (e) { log('главная недоступна: ' + e.message); }
  const snapshotStale = !!(livePdf && snap.meta.pdf && !livePdf.endsWith(snap.meta.pdf));
  // Совпадение по «ядру» имени (без слов university/college) — слабое: «Birmingham
  // University» из PDF садится на University College Birmingham, а не на University of
  // Birmingham. Такие пары не считаем найденными — они идут отдельным списком на просмотр.
  const declaredMatched = []; const declaredWeak = []; const declaredUnmatched = [];
  for (const [country, names] of Object.entries(snap.declared)) {
    for (const name of names) {
      const r = matchToCatalog(cleanPdfName(name), catalog, { country });
      if (!r.catalogSlug) { declaredUnmatched.push({ name, country, tried: r.tried.slice(-2) }); continue; }
      const row = { name, country, to: r.catalogSlug, method: r.matchMethod };
      (/core-name/.test(r.matchMethod) ? declaredWeak : declaredMatched).push(row);
    }
  }
  const declaredTotal = declaredMatched.length + declaredWeak.length + declaredUnmatched.length;
  log(`PDF-список: ${declaredTotal} вузов в ${Object.keys(snap.declared).length} странах; в каталоге ${declaredMatched.length}, похоже есть ${declaredWeak.length} (проверить), нет ${declaredUnmatched.length}${snapshotStale ? '; СНИМОК УСТАРЕЛ: на сайте ' + livePdf : ''}`);

  // 2. Страницы вузов через страницы стран.
  const sitemap = await fetchHtml(SITE + '/sitemap.xml');
  const countryPages = [...new Set([...sitemap.matchAll(/<loc>(https?:\/\/[^<]+\/study-in-[a-z-]+)<\/loc>/g)].map((m) => m[1]))];
  const SERVICE = /^(study-|studying-|about|contact|partner|blog|masters-|undergraduate-|veterinary|our-offices|services|visa-|scholarships|academic-|admission-|exam-|ielts|gre-|sat-|toefl|ucat|advanced-|imat|open-consent|data-protection|make-a-comment|toronto|istanbul|cairo|privacy|terms|why-|how-|types-|trends-|navigating-|spring-|canadian-|medical-|dcu-|pte-|berk-)/;
  const pages = new Map(); // slug -> country
  for (const cp of countryPages) {
    let h; try { h = await fetchHtml(cp); } catch { continue; }
    const country = countryOf(strip((h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '').replace(/^Study in\s+/i, ''));
    for (const m of h.matchAll(/href="https:\/\/www\.collabinternational\.com\/([a-z0-9-]+)"/g)) {
      if (SERVICE.test(m[1]) || pages.has(m[1])) continue;
      pages.set(m[1], country);
    }
  }
  log(`страниц вузов по страницам стран: ${pages.size}`);

  const matched = []; const unmatched = []; const noStructure = [];
  let written = 0; let programsTotal = 0; let withPrice = 0;
  for (const [slug, country] of pages) {
    if (only && !slug.includes(only)) continue;
    let html; try { html = await fetchHtml(`${SITE}/${slug}`); } catch (e) { log(`  ${slug}: ${e.message}`); continue; }
    const name = strip((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '');
    if (!name) continue;
    // refId = слаг страницы: карточки, заведённые в мае с сайта Collab, носят ровно его.
    const manual = MANUAL[slug];
    const r = manual ? { catalogSlug: manual.slug, matchMethod: 'manual', tried: [manual.reason] } : matchToCatalog(name, catalog, { country, refId: slug });
    if (!r.catalogSlug) { unmatched.push({ from: name, slug, country, tried: r.tried }); continue; }

    const listed = parsePrograms(html);
    const { levelFees, programRows } = parseTables(html);
    const programs = [];
    const seen = new Set();
    const push = (p) => { const k = p.title.toLowerCase(); if (seen.has(k)) return; seen.add(k); programs.push(p); };
    for (const p of listed) {
      const fee = p.fee || (p.level && levelFees[p.level]) || null;
      push({
        title: p.title, level: p.level, ...(p.sourceLevel ? { sourceLevel: p.sourceLevel } : {}),
        ...(fee ? { tuition: fee.amount, currency: fee.currency, feeBasis: p.fee ? 'program' : 'from', feeRaw: fee.raw || p.title, ...(p.fee ? {} : { feeScope: 'level' }) } : {}),
      });
    }
    for (const p of programRows) {
      const own = inferLevel(p.title);
      push({ title: p.title, level: own, ...(p.sourceLevel && !own ? { sourceLevel: p.sourceLevel } : {}), tuition: p.fee.amount, currency: p.fee.currency, feeBasis: 'from', feeRaw: p.fee.raw });
    }
    programsTotal += programs.length;
    withPrice += programs.filter((p) => p.tuition != null).length;
    matched.push({ from: name, slug, to: r.catalogSlug, method: r.matchMethod, programs: programs.length, levelFees: Object.keys(levelFees).length });
    if (!programs.length && !Object.keys(levelFees).length) { noStructure.push({ slug, to: r.catalogSlug }); continue; }

    const payload = extract({
      slug: r.catalogSlug, name, source: AGG, sourceUrl: `${SITE}/${slug}`,
      currency: [...new Set(programs.map((p) => p.currency).filter(Boolean))].length === 1 ? programs.find((p) => p.currency).currency : null,
      programs,
      extra: {
        aggregator: 'Collab International', access: 'public', country, matchMethod: r.matchMethod,
        levelFees: Object.fromEntries(Object.entries(levelFees).map(([l, f]) => [l, { from: f.amount, currency: f.currency, raw: f.raw }])),
        feeNote: 'Цены Collab — диапазон на уровень или строка таблицы; записан минимум (feeBasis from). Аудитория не указана.',
      },
    });
    const res = await writeExtract(AGG, r.catalogSlug, payload, { dryRun });
    if (res.written) written++;
  }

  const membership = {
    _meta: {
      aggregator: AGG, label: 'Collab International', source: SITE,
      collectedAt: new Date().toISOString(), rule: 'all', access: 'public',
      partnersPdf: { snapshot: snap.meta.pdf || null, snapshotDate: snap.meta.date || null, live: livePdf, stale: snapshotStale },
      notes: [
        'Состав — официальный PDF «Partner Institutions List» (снимок sources/kompas/collab/partners-list.txt; в CI нет pdftotext).',
        'Страницы вузов найдены через страницы «Study in <страна>» — страна оттуда, не по имени.',
        'Со страниц берётся только структурное: списки под заголовком уровня и таблицы цен. Проза не разбирается.',
        'Цены — минимум диапазона, feeBasis from; аудитория источником не указана.',
        'Вузы из PDF, которых нет в каталоге, НЕ заводятся — список declaredUnmatched на решение владельца.',
      ],
      counts: {
        declared: declaredTotal, declaredInCatalog: declaredMatched.length, declaredWeakMatch: declaredWeak.length, declaredNotInCatalog: declaredUnmatched.length,
        pages: pages.size, matched: matched.length, unmatched: unmatched.length, noStructure: noStructure.length,
        extracts: written, programs: programsTotal, withPrice,
      },
    },
    declaredMatched, declaredWeak, declaredUnmatched, matched, unmatched, noStructure,
  };
  await writeMembership(AGG, membership, { dryRun });

  log(`страницы: привязано ${matched.length}, не привязано ${unmatched.length}, без структуры ${noStructure.length}; программ ${programsTotal}, с ценой ${withPrice}; файлов ${written}${dryRun ? ' (сухой прогон)' : ''}`);
  log(`запросов ${stats.requests}, неудач ${stats.failed}`);
  log('ПРИВЯЗКИ (проверять глазами):');
  const cat = new Map(catalog.map((c) => [c.slug, c.name]));
  for (const m of matched.sort((a, b) => a.from.localeCompare(b.from))) log(`   ${m.from.padEnd(48)} -> ${m.to.padEnd(30)} «${(cat.get(m.to) || '?').slice(0, 34)}» [${m.method}] программ ${m.programs}`);
  if (unmatched.length) { log('НЕ ПРИВЯЗАНЫ:'); for (const u of unmatched) log(`   ${u.from} [${u.country}] (${u.slug})`); }
  if (!matched.length) throw new Error('ни одна страница не привязана к каталогу — сайт или резолвер сломались');
}

main().catch((e) => { log('ОШИБКА: ' + e.message); process.exit(1); });
