// bsbi.mjs — Berlin School of Business and Innovation, berlinsbi.com
//
// Разведка 29.09.2026. Каталожные хабы (/programmes/undergraduate и т.п.) отдают на
// curl только «избранные» 10 карточек — не полный список. Полный список нашёлся в
// /programme-sitemap.xml: там же вперемешку EN/DE/ES версии одних и тех же программ —
// берём только английские пути /programmes/(undergraduate|postgraduate|doctorate|
// certificate-programmes)/… (85 страниц). Foundation/Pre-MBA/языковых пайплайнов
// (как в карточке) в сайтмапе нет вовсе — на сайте BSBI собственной страницы у них
// нет, в gaps.
//
// Цена — на самой странице программы, в блоке KEY FACTS: «PRICE** International/EU/
// Expat students: € N,NNN/year» (проверено на bsc-hons-psychology). Одно число на
// audience international/EU/expat вместе — не разделяет их, поэтому audience: null.
// Название программы — из <title>…| BSBI</title>.

import { get, text, sleep, fallbackTitle } from './_lib.mjs';

const BASE = 'https://www.berlinsbi.com';

function levelFor(url) {
  if (url.includes('/undergraduate/')) return 'bachelor';
  if (url.includes('/postgraduate/')) return 'master';
  if (url.includes('/doctorate/')) return 'phd';
  if (url.includes('/certificate-programmes/')) return 'short-course';
  return null;
}

export default {
  slug: 'bsbi',
  site: 'https://www.berlinsbi.com',
  async collect({ log }) {
    const gaps = [];
    let sitemap;
    try {
      sitemap = get(`${BASE}/programme-sitemap.xml`);
    } catch (e) {
      return { programs: [], fees: [], gaps: [{ why: `sitemap не открылся: ${e.message}`, url: `${BASE}/programme-sitemap.xml` }] };
    }
    const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map((m) => m[1])
      .filter((u) => /^https:\/\/www\.berlinsbi\.com\/programmes\/(undergraduate|postgraduate|doctorate|certificate-programmes)\/[a-z0-9-]+$/.test(u));

    const programs = [];
    const fees = [];
    let i = 0;
    for (const url of urls) {
      i += 1;
      const level = levelFor(url);
      let html;
      try {
        html = get(url);
      } catch (e) {
        gaps.push({ why: `страница не открылась: ${e.message}`, url });
        await sleep(500);
        continue;
      }
      const tm = html.match(/<title>([^<]+)<\/title>/i);
      // Без <title> раньше падал слаг «msc-data-analytics-hamburg» — теперь og:title, <h1>, слаг.
      let title = tm ? text(tm[1]) : fallbackTitle(html, url);
      title = title.replace(/\s*\|\s*BSBI\s*$/i, '').trim();
      programs.push({ title, level, url });

      const t = text(html);
      const fm = t.match(/PRICE\*{0,2}[^€]{0,60}€\s*([\d,]+)\s*\/\s*year/i);
      if (fm) {
        fees.push({
          amount: Number(fm[1].replace(/,/g, '')), currency: 'EUR', basis: 'year', audience: null,
          scope: 'program', title, level, programUrl: url, url, raw: fm[0],
        });
      } else {
        gaps.push({ why: 'на странице не нашлась строка PRICE …€…/year', url });
      }
      if (i % 10 === 0) log(`${i}/${urls.length} программ обработано`);
      await sleep(500);
    }
    gaps.push({ why: 'Foundation/Pre-MBA/German и English Language Pathway из карточки — своей страницы на berlinsbi.com у них нет (нет в /programme-sitemap.xml)', url: `${BASE}/programme-sitemap.xml` });

    return { programs, fees, gaps };
  },
};
