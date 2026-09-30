// srh-university.mjs — SRH University, srh-university.de (Heidelberg campus)
//
// Разведка 29.09.2026. Карточка называется «SRH University of Applied Sciences
// Heidelberg» и её собственный официальный источник (sourceUrl в карточке) —
// https://www.srh-university.de/en/. Это НЕ старый отдельный сайт srh-hochschule-
// heidelberg — SRH в 2026 объединила все свои кампусы (Berlin, Hamburg, Dresden,
// Heidelberg и ещё 14 городов) под одним сайтом srh-university.de с разделом
// /en/our-campuses/<city>/, где перечислены программы именно этого кампуса.
// srh-berlin.de сейчас 301-редиректит на srh-university.de/de/ — то есть «SRH
// Berlin University of Applied Sciences» (карточка srh-hochschule-berlin) тоже
// растворилась в этом же сайте; её парсер берёт свой список с
// /en/our-campuses/berlin/. Программы, которые кампусы предлагают совместно
// (в подписи страницы программы «Location: Berlin, Heidelberg, …»), поэтому
// попадают в ОБА парсера — это не ошибка, а факт сайта (см. gaps).
//
// Список программ этого файла — только то, что перечислено на
// /en/our-campuses/heidelberg/ (бакалавриат + магистратура). Название и цену берём
// с собственной страницы программы: og:title — чистое название; в тексте страницы
// есть строка «Costs: from €NNN per month» — это цена в месяц (basis: 'other', не
// year/program, in raw — как на сайте, без умножения на 12).

import { get, anchors, text, sleep } from './_lib.mjs';

const BASE = 'https://www.srh-university.de';
const CAMPUS_URL = `${BASE}/en/our-campuses/heidelberg/`;

function levelFor(href) {
  if (href.includes('/en/bachelor/')) return 'bachelor';
  if (href.includes('/en/master/')) return 'master';
  return null;
}

export default {
  slug: 'srh-university',
  site: 'https://www.srh-university.de',
  async collect({ log }) {
    const gaps = [];
    let campusHtml;
    try {
      campusHtml = get(CAMPUS_URL);
    } catch (e) {
      return { programs: [], fees: [], gaps: [{ why: `страница кампуса не открылась: ${e.message}`, url: CAMPUS_URL }] };
    }
    const links = new Map(); // url -> level
    for (const a of anchors(campusHtml, CAMPUS_URL)) {
      if (!/\/en\/(bachelor|master)\/[a-z0-9-]+\/[a-z]\/?$/.test(a.href)) continue;
      const level = levelFor(a.href);
      if (level) links.set(a.href, level);
    }
    log(`кампус Heidelberg: ${links.size} программ в списке`);

    const programs = [];
    const fees = [];
    let i = 0;
    for (const [url, level] of links) {
      i += 1;
      let html;
      try {
        html = get(url);
      } catch (e) {
        gaps.push({ why: `страница программы не открылась: ${e.message}`, url });
        await sleep(500);
        continue;
      }
      const og = html.match(/property="og:title" content="([^"]+)"/i);
      const tm = html.match(/<title>([^<]+)<\/title>/i);
      let title = og ? text(og[1]) : (tm ? text(tm[1]).replace(/^Study (Bachelor|Master)\s*/i, '') : url);
      title = title.replace(/\s*\|\s*SRH University\s*$/i, '').trim();
      programs.push({ title, level, url });

      const t = text(html);
      const fm = t.match(/Costs:\s*from\s*€\s*([\d,.]+)\s*per\s*month/i);
      if (fm) {
        fees.push({
          amount: Number(fm[1].replace(/,/g, '')), currency: 'EUR', basis: 'month', audience: null,
          scope: 'program', title, level, programUrl: url, url, raw: fm[0],
        });
      } else {
        gaps.push({ why: 'на странице не нашлась строка Costs: from €…per month', url });
      }
      if (i % 10 === 0) log(`${i}/${links.size} программ обработано`);
      await sleep(500);
    }
    gaps.push({ why: 'цены на страницах программы даны «в месяц» (Costs: from €…per month), не за год и не за программу — basis: month — с 30.09.2026 едет в каталог с подписью «в месяц» (решение владельца), но зафиксировано в отчёте', url: CAMPUS_URL });
    gaps.push({ why: 'часть этих программ также в кампусах Berlin/Dresden/Leipzig — карточка srh-hochschule-berlin может содержать те же URL (пересечение ожидаемо, см. её парсер)', url: CAMPUS_URL });

    return { programs, fees, gaps };
  },
};
