// curtin-university-dubai.mjs — Curtin University Dubai, curtindubai.ac.ae
//
// Разведка 28.09.2026. Курл проходит без блоков. У каждой программы с собственной
// страницей есть аккордеон «Fees» (`id="fees"`) с одной или несколькими таблицами.
// Формат таблиц — два разных:
//   1) ключ-значение (2 колонки): строка «Annual fees» — цена за год (бакалавриат,
//      basis: 'year'); строка «Total fees» — цена за всю программу (магистратура,
//      Foundation-таблицы иногда тоже так), basis: 'program'. Часто две такие таблицы
//      подряд — для разных когорт поступления («For students starting before/after
//      September 2026»), обе отдаём, у них разные суммы.
//   2) сетка (3 колонки, «Total fees» — заголовок столбца, не строки): у Curtin Dubai
//      Foundation Program по одной строке на профиль (Engineering / Non-Engineering).
//   3) PhD — отдельный формат: строка «Full-time» со значением вида «AED 94,500 per
//      year (3 years; indicative total AED 283,500)» — берём именно «indicative total»
//      как basis: 'program' (это явно названная сумма за всю программу, не наша выдумка).
//      Таблицы две — по направлению (Engineering; Psychology/Business/AI & ML) — карточка
//      не различает направление PhD, поэтому обе идут как варианты одной программы.
// Уже в карточке была цена Master of Artificial Intelligence = 84 000 AED — сверено:
// на странице ровно то же значение («Total fees: AED 84,000»), формат подтверждён этим же
// прогоном.
//
// Список программ, которые запрашиваем, берём из карточки (по её programUrl), а не
// общим листингом сайта: пять карточных программ (Bachelor of Business Administration,
// три специализации Bachelor of Commerce) указывают на один и тот же хаб
// /business-and-management/ без собственной страницы — у хаба нет таблицы Fees,
// они остаются пробелом.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { get, text, sleep } from './_lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARD = path.join(__dirname, '../../site/src/content/universities/curtin-university-dubai.json');

const HUBS = new Set([
  'https://curtindubai.ac.ae/business-and-management/',
  'https://curtindubai.ac.ae/arts-and-design/',
]);

function ownPrograms() {
  const card = JSON.parse(fs.readFileSync(CARD, 'utf8').replace(/^﻿/, ''));
  const out = new Map(); // url -> { title, level }
  for (const p of card.programs || []) {
    if (!p.programUrl || !p.programUrl.startsWith('https://curtindubai.ac.ae/')) continue;
    if (HUBS.has(p.programUrl)) continue;
    if (!out.has(p.programUrl)) out.set(p.programUrl, { title: p.title, level: p.level });
  }
  return out;
}

function tableBlocks(html) {
  return [...html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map((m) => m[0]);
}

function rowsOf(tableHtml) {
  return [...tableHtml.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)]
    .map((r) => [...r[0].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) => text(c[1])))
    .filter((r) => r.length);
}

function feesSection(html) {
  const m = html.match(/<div class="accordion__content content" id="fees"[\s\S]*?(?=<div class="accordion">|<\/section>)/);
  return m ? m[0] : null;
}

function extractFeeRows(sectionHtml) {
  const out = [];
  for (const block of tableBlocks(sectionHtml)) {
    const rows = rowsOf(block);
    if (!rows.length) continue;
    const header = rows[0];
    const feeColIdx = header.findIndex((c) => /total fees|annual fees/i.test(c || ''));
    if (feeColIdx > 0 && rows.length > 1) {
      // Сетка: «Total fees»/«Annual fees» — заголовок столбца, строки — варианты программы.
      const basis = /annual/i.test(header[feeColIdx]) ? 'year' : 'program';
      for (const row of rows.slice(1)) {
        const label = (row[0] || '').trim();
        const val = row[feeColIdx] || '';
        const m = val.match(/([A-Z]{3})\s*([\d,]+)/);
        if (!m) continue;
        out.push({ note: label, basis, currency: m[1], amount: Number(m[2].replace(/,/g, '')), raw: `${label} — ${header[feeColIdx]}: ${val}` });
      }
      continue;
    }
    // Ключ-значение: ищем «Annual fees» / «Total fees» / «indicative total …» построчно.
    for (const row of rows) {
      const label = (row[0] || '').trim();
      const val = row[1] || '';
      if (/^annual fees$/i.test(label)) {
        const m = val.match(/([A-Z]{3})\s*([\d,]+)/);
        if (m) out.push({ basis: 'year', currency: m[1], amount: Number(m[2].replace(/,/g, '')), raw: `${label}: ${val}` });
      } else if (/^total fees$/i.test(label)) {
        const m = val.match(/([A-Z]{3})\s*([\d,]+)/);
        if (m) out.push({ basis: 'program', currency: m[1], amount: Number(m[2].replace(/,/g, '')), raw: `${label}: ${val}` });
      } else if (/indicative total/i.test(val)) {
        const m = val.match(/indicative total\s*([A-Z]{3})\s*([\d,]+)/i);
        if (m) out.push({ basis: 'program', currency: m[1].toUpperCase(), amount: Number(m[2].replace(/,/g, '')), raw: `${label}: ${val}` });
      }
    }
  }
  return out;
}

export default {
  slug: 'curtin-university-dubai',
  site: 'https://curtindubai.ac.ae',
  async collect({ log }) {
    const programs = ownPrograms();
    const fees = [];
    const gaps = [];
    let i = 0;
    for (const [url, meta] of programs) {
      i += 1;
      let html;
      try {
        html = get(url);
      } catch (e) {
        gaps.push({ why: `страница не открылась: ${e.message}`, url });
        await sleep(500);
        continue;
      }
      const section = feesSection(html);
      if (!section) {
        gaps.push({ why: 'на странице нет аккордеона Fees', url });
        await sleep(500);
        continue;
      }
      const rows = extractFeeRows(section);
      if (!rows.length) {
        gaps.push({ why: 'в аккордеоне Fees не нашлись строки Annual fees / Total fees / indicative total', url });
        await sleep(500);
        continue;
      }
      for (const r of rows) {
        fees.push({
          amount: r.amount, currency: r.currency, basis: r.basis, audience: null,
          scope: 'program', title: meta.title, level: meta.level,
          programUrl: url, url, raw: r.raw,
        });
      }
      log(`${meta.title}: ${rows.length} строк`);
      await sleep(500);
    }
    gaps.push({ why: 'Bachelor of Business Administration и три специализации Bachelor of Commerce в карточке ведут на общий хаб /business-and-management/ без своей таблицы Fees', url: 'https://curtindubai.ac.ae/business-and-management/' });
    return { programs: [], fees, gaps };
  },
};
