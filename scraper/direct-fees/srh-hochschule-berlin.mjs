// srh-hochschule-berlin.mjs — «SRH Berlin University of Applied Sciences», Berlin campus
//
// Разведка 29.09.2026. Собственного сайта у SRH Berlin University of Applied Sciences
// больше нет: srh-berlin.de сейчас 301-редиректит на srh-university.de/de/ — кампус
// поглощён общим сайтом SRH University (см. подробности в srh-university.mjs, того
// же прогона). Карточка raньше опиралась на edvoy (агрегатор) — теперь берём
// собственный список сайта: /en/our-campuses/berlin/ перечисляет ровно те
// bachelor/master-программы, которые ведутся в Берлине.
//
// Название и цена — со страницы самой программы (og:title; «Costs: from €NNN per
// month» — цена в месяц, basis: 'other', без пересчёта на год).
// Часть программ также идёт в кампусе Heidelberg (и в карточке srh-university) —
// это не дубль-ошибка, а факт сайта: программа читается в нескольких городах сразу.

import { get, anchors, text, sleep } from './_lib.mjs';

const BASE = 'https://www.srh-university.de';
const CAMPUS_URL = `${BASE}/en/our-campuses/berlin/`;

function levelFor(href) {
  if (href.includes('/en/bachelor/')) return 'bachelor';
  if (href.includes('/en/master/')) return 'master';
  return null;
}

export default {
  slug: 'srh-hochschule-berlin',
  site: 'https://www.srh-university.de',
  async collect({ log }) {
    const gaps = [
      { why: 'srh-berlin.de больше не существует отдельно — 301 на srh-university.de/de/; SRH Berlin University of Applied Sciences стала одним из кампусов «SRH University»', url: 'https://www.srh-berlin.de/' },
    ];
    let campusHtml;
    try {
      campusHtml = get(CAMPUS_URL);
    } catch (e) {
      return { programs: [], fees: [], gaps: [{ why: `страница кампуса не открылась: ${e.message}`, url: CAMPUS_URL }] };
    }
    const links = new Map();
    for (const a of anchors(campusHtml, CAMPUS_URL)) {
      if (!/\/en\/(bachelor|master)\/[a-z0-9-]+\/[a-z]\/?$/.test(a.href)) continue;
      const level = levelFor(a.href);
      if (level) links.set(a.href, level);
    }
    log(`кампус Berlin: ${links.size} программ в списке`);

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
    gaps.push({ why: 'цены даны «в месяц», не за год/программу — basis: month — с 30.09.2026 едет в каталог с подписью «в месяц» (решение владельца)', url: CAMPUS_URL });

    return { programs, fees, gaps };
  },
};
