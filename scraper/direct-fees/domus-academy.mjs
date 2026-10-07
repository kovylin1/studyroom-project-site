// domus-academy.mjs — Domus Academy, domusacademy.com (Milan, Italy, EUR).
//
// Разведка 29.09.2026:
// - Полный список программ — sitemap https://www.domusacademy.com/programs-sitemap.xml
//   (114 адресов, из них 38 английских — без префиксов /it/ и /es/). У каждой своя
//   страница /courses/<area>/<slug>/ с h1 вида «Master in Product Design».
// - Уровень берём по сегменту URL (сайт сам делит программы по категориям —
//   /programmes/bachelor-of-arts-undergraduate/, /master-courses-postgraduate/,
//   /semester-courses-postgraduate/, /short-courses/, /workshop-experience/):
//     bachelor-of-arts-*        → bachelor
//     master-in-* / *-master-*  → master
//     semester-in-*             → short-course (однасеместровая версия мастера без
//                                  степени — отдельная страница, отдельная цена)
//     summer-course-*           → short-course
//     tailored-courses          → не программа (страница «под заказ», без фиксированной
//                                  программы и цены) — в gaps.
// - Цена — блок «TUITION FEES» на странице программы:
//     * Master: «Academic Master € 23.900» / «Dual Award Master € 27.900» в разделе
//       «EU & EFTA students fee», и те же подписи ещё раз в «Non-EU Students Fee»
//       (там суммы выше). Полная цена курса указана прямо (не годовая — Master идёт
//       ~11 месяцев одним блоком), basis: 'program'. Проверено на двух разных
//       мастерах (Product Design, Luxury Brand Management) — цифры совпали:
//       это единый прайс-лист на все Academic/Dual Award Master программы, а не
//       индивидуальная цена курса, но сайт публикует её только на страницах программ.
//     * Bachelor: «Annual Fee € 12.800» (EU) / выше в Non-EU — basis: 'year' (сайт сам
//       называет её Annual Fee, и отдельно предупреждает про рост на 2–3 курсе).
//     * Semester (short-course): «Semester Course Tuition € 10.000» — одна сумма без
//       деления EU/non-EU, basis: 'program' (весь семестровый курс).
//     * Summer/short courses (Boot Camp, Milano Design Lab и т.п.) — блока TUITION FEES
//       нет вовсе (проверено на двух страницах) — цена не публикуется, в gaps.
// - Matriculation Fee (540/650 EUR) и Pre-Enrollment (3000 EUR, часть суммы Tuition) —
//   не берём: это не полная цена программы (см. правило 2 README — сборы отдельно).

import { get, text, sleep } from './_lib.mjs';

const SITEMAP = 'https://www.domusacademy.com/programs-sitemap.xml';

function level(url) {
  if (/\/bachelor-of-arts/i.test(url)) return 'bachelor';
  if (/\/semester-in-/i.test(url)) return 'short-course';
  if (/\/summer-course/i.test(url)) return 'short-course';
  if (/\/master-in-|master-of-arts|\d-year-master/i.test(url)) return 'master';
  return null;
}

function tuitionFees(pageText, lvl) {
  const i = pageText.toUpperCase().indexOf('TUITION FEES');
  if (i === -1) return [];
  const seg = pageText.slice(i, i + 1600);
  const nonEuIdx = seg.search(/Non-EU Students Fee/i);
  const out = [];
  const push = (label, amountStr, m) => {
    const amount = Number(amountStr.replace(/[^\d]/g, ''));
    if (!amount) return;
    const audience = nonEuIdx === -1 ? null : (m.index < nonEuIdx ? 'eu' : 'international');
    out.push({ amount, currency: 'EUR', audience, raw: `${label} € ${amountStr}` });
  };
  if (lvl === 'master') {
    for (const m of seg.matchAll(/Academic Master\s*€\s*([\d.,]+)/gi)) push('Academic Master', m[1], m);
    for (const m of seg.matchAll(/Dual Award Master\s*€\s*([\d.,]+)/gi)) push('Dual Award Master', m[1], m);
    return out.map((f) => ({ ...f, basis: 'program' }));
  }
  if (lvl === 'bachelor') {
    for (const m of seg.matchAll(/Annual Fee\s*€\s*([\d.,]+)/gi)) push('Annual Fee', m[1], m);
    return out.map((f) => ({ ...f, basis: 'year' }));
  }
  if (lvl === 'short-course') {
    for (const m of seg.matchAll(/Semester Course Tuition\s*€\s*([\d.,]+)/gi)) push('Semester Course Tuition', m[1], m);
    return out.map((f) => ({ ...f, basis: 'program' }));
  }
  return [];
}

export default {
  slug: 'domus-academy',
  site: 'https://domusacademy.com',
  async collect({ log }) {
    const smXml = get(SITEMAP);
    await sleep(500);
    const urls = [...new Set([...smXml.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map((m) => m[1])
      .filter((u) => /^https:\/\/www\.domusacademy\.com\/courses\//.test(u) && !/\/it\/|\/es\//.test(u)))];
    log(`English programme pages: ${urls.length}`);

    const programs = [];
    const fees = [];
    const gaps = [];
    for (const url of urls) {
      let html;
      try {
        html = get(url);
      } catch (e) {
        gaps.push({ why: `страница не открылась (${String(e.message || e).split('\n')[0]})`, url });
        await sleep(500);
        continue;
      }
      await sleep(500);
      const h1m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      const title = h1m ? text(h1m[1]) : null;
      if (!title) { gaps.push({ why: 'на странице нет h1 — не понять название программы', url }); continue; }
      if (/tailored-courses/i.test(url)) {
        gaps.push({ why: 'Tailored & On Demand Courses — программа «под заказ», без фиксированной цены/учебного плана', url });
        continue;
      }
      const lvl = level(url);
      if (!lvl) { gaps.push({ why: 'не удалось определить уровень по адресу страницы', url }); continue; }
      programs.push({ title, level: lvl, url });
      const pageText = text(html);
      const found = tuitionFees(pageText, lvl);
      if (!found.length) { gaps.push({ why: 'на странице нет блока TUITION FEES (или узнаваемой подписи суммы)', url }); continue; }
      for (const f of found) fees.push({ ...f, scope: 'program', title, level: lvl, programUrl: url, url });
    }
    return { programs, fees, gaps };
  },
};
