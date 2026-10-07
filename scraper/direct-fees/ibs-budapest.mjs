// ibs-budapest.mjs — International Business School Budapest, ibs-b.hu (Hungary, EUR).
//
// Разведка 29.09.2026:
// - Полный список программ собран с трёх страниц-каталогов и четырёх отдельных
//   программ, все ссылки взяты из навигации сайта (https://www.ibs-b.hu/en/):
//     /en/programmes/bachelors-programmes/      — 11 BSc/BA программ (bachelor)
//     /en/programmes/postgraduate-programmes/   — 6 MSc программ (master)
//     /en/programmes/doctorate-programmes/      — 2 PhD программы (phd)
//     /en/programmes/master-in-business-administration/  — MBA (master, вне
//       postgraduate-programmes — отдельный пункт меню)
//     /en/programmes/international-university-foundation/ — Foundation (foundation)
//     /en/programmes/policy-management/  — Public Policy Management Postgraduate
//       Programme (master — постдипломная, ближайший уровень схемы)
//     /en/programmes/summer-school/  — Summer School (short-course, есть Certificate
//       of Completion, не степень)
//   /en/programmes/erasmus/ — обменная программа, не своя степень — в gaps, не программа.
// - Цены. На страницах отдельных программ (проверено на BSc in Corporate Finance,
//   MSc in Strategic International Management) сумм в EUR нет вовсе — только общая
//   таблица на /en/how-to-apply/fees/ («Tuition Fees and Payment Structure for
//   2026/2027 Intakes»), она не по программам, а по группам:
//     «Bachelor's degree programmes - The University of Buckingham/Dublin Business
//     School», «Master's degree programmes in Budapest», «Master's degree programme
//     in Vienna», «PhD programmes», «International University Foundation» — подпись
//     прямо называет уровень (кроме Foundation — там название программы буквально) →
//     scope 'level' (или 'program' для Foundation, где подпись совпадает с
//     названием программы буквально). Строка «MSc in IT for Business Data
//     Analytics» в этой же таблице — название конкретной программы буквально →
//     scope 'program'.
//     Основа — «Fee / semester» (7 columns: intake Sept/Feb, сумма и число
//     оплачиваемых семестров), не год и не программа целиком → basis 'semester',
//     в каталог по правилам README не едет, но по обеим датам заезда — берём обе,
//     где суммы различаются (в отчёт).
// - Summer School — единственная страница с ценой «за программу целиком»:
//     «Participation fee 2990 EUR*» — basis 'program', подходит под каталог.
// - На странице Public Policy Management Postgraduate Programme суммы в EUR нет
//   вовсе — gaps.

import { get, text, anchors, sleep } from './_lib.mjs';

const CATALOG_PAGES = [
  { url: 'https://www.ibs-b.hu/en/programmes/bachelors-programmes/', level: 'bachelor' },
  { url: 'https://www.ibs-b.hu/en/programmes/postgraduate-programmes/', level: 'master' },
  { url: 'https://www.ibs-b.hu/en/programmes/doctorate-programmes/', level: 'phd' },
];
// title — то, что сайт сам показывает в меню (https://www.ibs-b.hu/en/); ссылка на
// MBA в меню на 29.09.2026 сама ведёт на 404 (сломана на сайте), но пункт меню
// программу называет — оставляем title с сайта, страница в gaps по HTTP-ошибке.
const STANDALONE_PAGES = [
  { url: 'https://www.ibs-b.hu/en/programmes/master-in-business-administration/', level: 'master', navTitle: 'MBA in Strategic Data-Driven Management' },
  { url: 'https://www.ibs-b.hu/en/programmes/international-university-foundation/', level: 'foundation', navTitle: 'International University Foundation' },
  { url: 'https://www.ibs-b.hu/en/programmes/policy-management/', level: 'master', navTitle: 'Public Policy Management Postgraduate Programme' },
  { url: 'https://www.ibs-b.hu/en/programmes/summer-school/', level: 'short-course', navTitle: 'Summer School' },
];
const FEES_URL = 'https://www.ibs-b.hu/en/how-to-apply/fees/';

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export default {
  slug: 'ibs-budapest',
  site: 'https://www.ibs-b.hu',
  async collect({ log }) {
    const programs = [];
    const gaps = [];

    for (const { url, level } of CATALOG_PAGES) {
      let html;
      try {
        html = get(url);
      } catch (e) {
        gaps.push({ why: `каталог не открылся (${String(e.message || e).split('\n')[0]})`, url });
        await sleep(500);
        continue;
      }
      await sleep(500);
      const prefix = url;
      const bestTitle = new Map(); // href -> longest anchor text seen (сайт дублирует ссылки укороченным текстом)
      for (const a of anchors(html, url)) {
        if (!a.href.startsWith(prefix) || a.href === prefix) continue;
        if (!/^[a-z0-9-]+\/$/.test(a.href.slice(prefix.length))) continue;
        const prev = bestTitle.get(a.href);
        if (!prev || a.text.length > prev.length) bestTitle.set(a.href, a.text);
      }
      for (const [href, title] of bestTitle) {
        if (!title) continue;
        programs.push({ title, level, url: href });
      }
    }

    for (const { url, level, navTitle } of STANDALONE_PAGES) {
      let html;
      try {
        html = get(url);
      } catch (e) {
        gaps.push({ why: `страница не открылась (${String(e.message || e).split('\n')[0]})`, url });
        await sleep(500);
        continue;
      }
      await sleep(500);
      if (/<h1[^>]*class=["'][^"']*page__title[^"']*["'][^>]*>\s*Page not found/i.test(html)) {
        gaps.push({ why: 'ссылка на программу из меню сайта ведёт на 404 (страница удалена/перенесена, но пункт меню остался)', url });
        programs.push({ title: navTitle, level, url: null });
        continue;
      }
      const title = navTitle;
      programs.push({ title, level, url });
      if (/summer-school/.test(url)) {
        const pageText = text(html);
        const m = pageText.match(/Participation fee\s*([\d,.]+)\s*EUR/i);
        if (m) {
          const amount = Number(m[1].replace(/[^\d]/g, ''));
          // fees массив собирается ниже после разбора общей таблицы — добавим прямо тут
          programs[programs.length - 1]._fee = {
            amount, currency: 'EUR', basis: 'program', audience: null, scope: 'program',
            title, level, programUrl: url, url, raw: `Participation fee ${m[1]} EUR`,
          };
        } else {
          gaps.push({ why: 'Summer School: на странице нет «Participation fee … EUR»', url });
        }
      }
      if (/policy-management/.test(url) && !/€|EUR/i.test(html)) {
        gaps.push({ why: 'Public Policy Management Postgraduate Programme: на странице нет суммы в EUR', url });
      }
    }

    const fees = [];
    for (const p of programs) if (p._fee) { fees.push(p._fee); delete p._fee; }

    let feesHtml;
    try {
      feesHtml = get(FEES_URL);
    } catch (e) {
      gaps.push({ why: `общая страница тарифов не открылась (${String(e.message || e).split('\n')[0]})`, url: FEES_URL });
      return { programs, fees, gaps };
    }
    await sleep(500);
    const table = feesHtml.match(/<table\b[\s\S]*?<\/table>/i);
    if (!table) { gaps.push({ why: 'на /en/how-to-apply/fees/ нет таблицы тарифов', url: FEES_URL }); return { programs, fees, gaps }; }
    const rows = [...table[0].matchAll(/<tr\b[\s\S]*?<\/tr>/gi)]
      .map((m) => [...m[0].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) => text(c[1])))
      .filter((r) => r.length >= 5 && !/^programmes$/i.test(r[0]));

    const LEVEL_LABEL = [
      [/bachelor's degree programmes/i, 'bachelor'],
      [/master's degree programmes? in (budapest|vienna)/i, 'master'],
      [/phd programmes/i, 'phd'],
    ];
    for (const [label, sept, septSem, feb, febSem] of rows) {
      let scope = 'level', level = null, title = null;
      for (const [re, lvl] of LEVEL_LABEL) if (re.test(label)) level = lvl;
      const exactProgram = programs.find((p) => norm(p.title) === norm(label));
      if (exactProgram) { scope = 'program'; title = exactProgram.title; level = exactProgram.level; }
      if (!level) { gaps.push({ why: `строка тарифа «${label}» — не распознан уровень/программа`, url: FEES_URL }); continue; }
      const seen = new Set();
      for (const [amountStr, semStr] of [[sept, septSem], [feb, febSem]]) {
        const amount = Number(String(amountStr).replace(/[^\d]/g, ''));
        if (!amount || seen.has(amount)) continue;
        seen.add(amount);
        fees.push({
          amount, currency: 'EUR', basis: 'semester', audience: null, scope,
          title, level, programUrl: exactProgram ? exactProgram.url : null, url: FEES_URL,
          raw: `${label} ${amountStr} / semester (${semStr} paid semesters)`,
        });
      }
    }

    log(`programme pages: ${programs.length}, fee rows: ${fees.length}`);
    return { programs, fees, gaps };
  },
};
