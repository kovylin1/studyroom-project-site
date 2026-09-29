// heriot-watt-dubai.mjs — Heriot-Watt University Dubai, hw.ac.uk/dubai
//
// Разведка 29.09.2026. Кампус Dubai — это раздел /dubai/ основного сайта hw.ac.uk
// (Эдинбург/Малайзия — соседние разделы /, /malaysia/, отдельные, их не трогаем).
// Виджет поиска программ (/dubai/search/programmes) дёргает JSON API на
// search.hw.ac.uk, а тот стоит за Cloudflare Managed Challenge («Just a moment…») —
// не проходит ни curl, ни headless Chromium (ни прямой fetch, ни навигация: ERR_FAILED
// / challenge-страница). Обходим это: полный список программ кампуса Dubai достаём из
// общего /sitemap.xml (он отдаётся без блоков) — там все страницы под /dubai/study/
// статичным списком. Программы живут под четырьмя префиксами:
//   /dubai/study/foundation/<slug>     → level: foundation
//   /dubai/study/undergraduate/<slug>  → level: bachelor
//   /dubai/study/postgraduate/<slug>   → level: master
//   /dubai/study/research/<slug>       → level: phd (все research-степени —
//     PhD/EngD/DBA — сайт не даёт отдельного уровня под EngD/DBA, phd ближе всего)
// Сами хабы (/dubai/study/foundation, /undergraduate, /postgraduate, /research без
// хвоста) и явно не-программные разделы (apply/*, fees-and-funding/*, go-global/*,
// meet-our-students/*, why-study-…, september-starts, executive-education,
// research (сам хаб)) — исключены.
// Единственное исключение по уровню: /undergraduate/certificate-of-higher-education-engineering
// — Certificate, такого уровня нет в схеме → gaps, не отдаём как bachelor.
//
// Название программы — <h1> страницы («BSc (Hons) Computer Science» и т.п.), это же
// текст в карточке.
//
// Цена. Каждая страница программы — React-приложение, но HTML отдаёт curl уже с
// SSR-разметкой и инлайновым `window.REDUX_DATA = {...}` (JS-литерал, не JSON: есть
// `undefined`). Внутри — узел "feesFunding". Два формата:
//   1) простой: content.feesInfo.data = [{ Status: "UAE and International",
//      "Full Time": "AED 82,264" }] (+ бывает "Part Time"). Это встречает
//      подавляющее большинство bachelor/master страниц.
//   2) табличный: content.feeAdditional.content — блок с type:"_table" (Year / Full-time /
//      Part-time по годам) — у части bachelor (напр. Master of Architecture, 2+2-режимы).
//      Берём первую строку (Year 1) — по тексту рядом всегда «fees displayed above are
//      per academic year», то есть Year 1 = Year 2 = ставка за год, эта строка её и даёт.
// В обоих случаях подпись страницы (https://www.hw.ac.uk/dubai/study/fees-and-funding/tuition-fees,
// проверено) прямым текстом говорит «pay the full tuition fee for the academic year» —
// это годовая ставка, basis: 'year'. audience: Status «UAE and International» —
// цена не различает аудиторию → null; если бы Status называл только один лагерь
// (UAE/Domestic или International) — ставили бы соответствующий audience.
// У research/* (PhD/EngD/DBA) страниц секции feesFunding часто нет вовсе (проверено на
// research/phd-civil-engineering) — уходит в gaps, цену не берём.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { get, text, sleep } from './_lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE = 'https://www.hw.ac.uk';

const LEVEL_BY_PREFIX = {
  '/dubai/study/foundation/': 'foundation',
  '/dubai/study/undergraduate/': 'bachelor',
  '/dubai/study/postgraduate/': 'master',
  '/dubai/study/research/': 'phd',
};

// Certificate — уровня нет в схеме, не отдаём программой.
const SKIP_SLUGS = new Set([
  '/dubai/study/undergraduate/certificate-of-higher-education-engineering',
]);

function balancedExtract(str, startIdx) {
  const BACKSLASH = String.fromCharCode(92);
  let depth = 0; let inStr = false; let strCh = null; let esc = false; let j = startIdx;
  for (; j < str.length; j += 1) {
    const c = str[j];
    if (inStr) {
      if (esc) esc = false;
      else if (c === BACKSLASH) esc = true;
      else if (c === strCh) inStr = false;
      continue;
    }
    if (c === '"' || c === "'") { inStr = true; strCh = c; continue; }
    if (c === '{') depth += 1;
    else if (c === '}') { depth -= 1; if (depth === 0) { j += 1; break; } }
  }
  return str.slice(startIdx, j);
}

function feesFundingNode(html) {
  const marker = '"feesFunding":';
  const idx = html.indexOf(marker);
  if (idx < 0) return null;
  const raw = balancedExtract(html, idx + marker.length);
  try {
    return JSON.parse(raw.replace(/:undefined/g, ':null'));
  } catch {
    return null;
  }
}

function audienceOf(status) {
  const s = (status || '').toLowerCase();
  const hasIntl = /international/.test(s);
  const hasDom = /uae|domestic|gcc/.test(s);
  if (hasIntl && hasDom) return null;
  if (hasIntl) return 'international';
  if (hasDom) return 'domestic';
  return null;
}

function moneyMatch(val) {
  const m = String(val || '').match(/([A-Z]{3})\s*([\d,]+)/);
  if (!m) return null;
  return { currency: m[1], amount: Number(m[2].replace(/,/g, '')) };
}

// Простой формат: content.feesInfo.data = [{ Status, "Full Time": "AED N", ... }]
function feesFromFeesInfo(feesFunding) {
  const data = feesFunding?.content?.feesInfo?.data;
  if (!Array.isArray(data)) return [];
  const out = [];
  for (const row of data) {
    const audience = audienceOf(row.Status);
    for (const [key, val] of Object.entries(row)) {
      if (key === 'Status') continue;
      const money = moneyMatch(val);
      if (!money) continue;
      out.push({ ...money, audience, note: key, raw: `${row.Status}, ${key}: ${val}` });
    }
  }
  return out;
}

// Ищем узлы type: "_table" в дереве content.feeAdditional.content (rich-text).
function findTables(node, out = []) {
  if (Array.isArray(node)) { for (const n of node) findTables(n, out); return out; }
  if (node && typeof node === 'object') {
    if (node.type === '_table' && Array.isArray(node.value)) out.push(node.value);
    for (const v of Object.values(node)) findTables(v, out);
  }
  return out;
}

function cellsOfRow(row) {
  return (row.value || []).map((c) => (Array.isArray(c.value) ? c.value : c.value));
}

function textOfCell(cell) {
  if (typeof cell === 'string') return cell;
  return '';
}

// Табличный формат: первая строка данных (Year 1) — колонки кроме "Year".
function feesFromTable(feesFunding) {
  const content = feesFunding?.content?.feeAdditional?.content;
  if (!content) return [];
  const tables = findTables(content);
  const out = [];
  for (const table of tables) {
    const headerBlock = table.find((n) => n.type === '_tableHeader');
    const bodyBlock = table.find((n) => n.type === '_tableBody');
    if (!headerBlock || !bodyBlock) continue;
    const headerRow = headerBlock.value?.[0];
    const headers = (headerRow?.value || []).map((c) => textOfCell(c.value));
    const firstDataRow = bodyBlock.value?.[0];
    if (!firstDataRow) continue;
    const cells = (firstDataRow.value || []).map((c) => textOfCell(c.value));
    const yearLabel = cells[0] || headers[0] || '';
    for (let i = 1; i < headers.length; i += 1) {
      const money = moneyMatch(cells[i]);
      if (!money) continue;
      out.push({ ...money, audience: null, note: `${yearLabel} ${headers[i]}`, raw: `${yearLabel} — ${headers[i]}: ${cells[i]}` });
    }
  }
  return out;
}

function programUrlsFromSitemap(xml) {
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const out = [];
  for (const loc of locs) {
    let u;
    try { u = new URL(loc); } catch { continue; }
    if (u.hostname !== 'www.hw.ac.uk') continue;
    const p = u.pathname;
    for (const [prefix, level] of Object.entries(LEVEL_BY_PREFIX)) {
      if (p.startsWith(prefix) && p.length > prefix.length && !SKIP_SLUGS.has(p)) {
        out.push({ url: loc, level });
      }
    }
  }
  return out;
}

function h1Title(html) {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  return m ? text(m[1]) : null;
}

export default {
  slug: 'heriot-watt-dubai',
  site: 'https://www.hw.ac.uk/dubai',
  async collect({ log }) {
    let sitemap;
    try {
      sitemap = get(`${SITE}/sitemap.xml`, { timeout: 60 });
    } catch (e) {
      return { programs: [], fees: [], gaps: [{ why: `sitemap.xml не открылся: ${e.message}`, url: `${SITE}/sitemap.xml` }] };
    }
    const entries = programUrlsFromSitemap(sitemap);
    const programs = [];
    const fees = [];
    const gaps = [];
    let n = 0;
    for (const { url, level } of entries) {
      n += 1;
      if (n > 200) { gaps.push({ why: 'достигнут лимит запросов (200) — обход остановлен', url }); break; }
      let html;
      try {
        html = get(url);
      } catch (e) {
        gaps.push({ why: `страница не открылась: ${e.message}`, url });
        await sleep(500);
        continue;
      }
      const title = h1Title(html);
      if (!title) {
        gaps.push({ why: 'не нашёлся <h1> с названием программы', url });
        await sleep(500);
        continue;
      }
      programs.push({ title, level, url });

      const ff = feesFundingNode(html);
      let rows = ff ? feesFromFeesInfo(ff) : [];
      if (!rows.length && ff) rows = feesFromTable(ff);
      if (!rows.length) {
        gaps.push({ why: 'на странице программы нет секции с ценой (feesFunding пуста или отсутствует)', url });
        await sleep(500);
        continue;
      }
      for (const r of rows) {
        fees.push({
          amount: r.amount, currency: r.currency, basis: 'year', audience: r.audience,
          scope: 'program', title, level, programUrl: url, url, raw: r.raw,
        });
      }
      log(`${title}: ${rows.length} строк`);
      await sleep(500);
    }
    return { programs, fees, gaps };
  },
};
