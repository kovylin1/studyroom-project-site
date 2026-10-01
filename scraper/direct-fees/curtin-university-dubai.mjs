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
// Список программ, которые запрашиваем, раньше брали из карточки (по её programUrl) —
// это годилось только для цен уже известных программ, но пять карточных программ
// (Bachelor of Business Administration, три специализации Bachelor of Commerce)
// указывали на один и тот же хаб /business-and-management/ без собственной страницы.
//
// Разведка 29.09.2026 (список программ): полный каталог — страница
// https://curtindubai.ac.ae/courses/, на ней ссылки на все программы кампуса, сгруппированные
// по факультетам-хабам (arts-and-design, built-environment, business-and-management,
// engineering, it-and-computing, arts-humanities-and-health-sciences — бакалавриат;
// postgraduate-programs — магистратура; doctoral-programs — докторантура). У хаба
// самого по себе (напр. /business-and-management/) страницы Fees нет — только у
// программ на два сегмента пути внутри хаба (/business-and-management/finance/ и т.п.),
// их и берём. Так нашлись настоящие страницы у Accounting, Finance, International
// Business, Marketing, Accounting and Finance (Double Major), Mechanical Engineering
// (Honours), Information Technology, Cyber Security — раньше их программные ссылки в
// карточке не было вовсе (только пять хаб-ссылок неспециализированного BBA/BCom, для
// которых своей страницы по-прежнему нет — остаются пробелом).
// /postgraduate-business/<slug>/ — старый путь тех же двух магистратур
// (MBA International Business, Master of Engineering Management), 200 редиректит на
// /postgraduate-programs/<slug>/ — берём только канонический, чтобы не задвоить.
// «Graduate Certificate in Business Fundamentals» (postgraduate-programs/business-fundamentals/)
// — это сертификат, не квалификация схемы (foundation/bachelor/master/phd/…) — в gaps,
// программой не отдаём, даже вопреки тому что раньше в карточке было записано как
// «master» (ошибочно, до этой разведки).
// Curtin Dubai Foundation Program — одна страница на все пять профилей (Business /
// Design / Hard Sciences and Engineering / Health Sciences / Information Technology,
// см. правило «отдельные строки только если своя страница») — отдаём ОДНОЙ программой
// уровня foundation с этим общим URL, профили внутри не разбиваем.

import { get, text, anchors, sleep } from './_lib.mjs';

const BASE = 'https://curtindubai.ac.ae';
const COURSES_URL = `${BASE}/courses/`;
const FOUNDATION_URL = `${BASE}/curtin-dubai-foundation-program/`;
const BACHELOR_HUBS = new Set(['arts-and-design', 'built-environment', 'business-and-management',
  'engineering', 'it-and-computing', 'health-sciences', 'arts-humanities-and-health-sciences']);
const MASTER_HUBS = new Set(['postgraduate-programs']);
const PHD_HUBS = new Set(['doctoral-programs']);
// Квалификации вне схемы каталога — своя страница есть, но уровня для неё нет.
const NOT_A_SCHEMA_LEVEL = new Set(['postgraduate-programs/business-fundamentals']);
const PROGRAM_PAGE_RE = /^https:\/\/curtindubai\.ac\.ae\/([a-z0-9-]+)\/([a-z0-9-]+)\/$/;

function levelForHref(href) {
  const m = href.match(PROGRAM_PAGE_RE);
  if (!m) return null;
  const [, hub, slug] = m;
  if (hub === 'postgraduate-business') return null; // дубль postgraduate-programs, тот же контент по редиректу
  if (NOT_A_SCHEMA_LEVEL.has(`${hub}/${slug}`)) return null;
  if (BACHELOR_HUBS.has(hub)) return 'bachelor';
  if (MASTER_HUBS.has(hub)) return 'master';
  if (PHD_HUBS.has(hub)) return 'phd';
  return null;
}

async function coursesPrograms() {
  const html = get(COURSES_URL);
  await sleep(500);
  const out = new Map(); // url -> level
  for (const a of anchors(html, COURSES_URL)) {
    const level = levelForHref(a.href);
    if (level && !out.has(a.href)) out.set(a.href, level);
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
    const gaps = [];
    let hrefLevels;
    try {
      hrefLevels = await coursesPrograms();
    } catch (e) {
      gaps.push({ why: `страница /courses/ не открылась: ${e.message}`, url: COURSES_URL });
      hrefLevels = new Map();
    }
    // Программа-фундамент — одна страница на все профили (см. разведку выше).
    if (!hrefLevels.has(FOUNDATION_URL)) hrefLevels.set(FOUNDATION_URL, 'foundation');
    log(`courses: ${hrefLevels.size} страниц программ`);

    const programs = [];
    const fees = [];
    let i = 0;
    for (const [url, level] of hrefLevels) {
      i += 1;
      let html;
      try {
        html = get(url);
      } catch (e) {
        gaps.push({ why: `страница не открылась: ${e.message}`, url });
        await sleep(500);
        continue;
      }
      const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      const title = h1 ? text(h1[1]) : null;
      if (!title) { gaps.push({ why: 'на странице программы нет h1', url }); await sleep(500); continue; }
      programs.push({ title, level, url });

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
          scope: 'program', title, level, programUrl: url, url, raw: r.raw,
        });
      }
      if (i % 10 === 0) log(`${i}/${hrefLevels.size} страниц программ`);
      await sleep(500);
    }
    gaps.push({ why: 'Bachelor of Business Administration и три специализации Bachelor of Commerce в карточке ведут на общий хаб /business-and-management/ без своей страницы', url: 'https://curtindubai.ac.ae/business-and-management/' });
    return { programs, fees, gaps };
  },
};
