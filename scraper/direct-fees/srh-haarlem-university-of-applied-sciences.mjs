// srh-haarlem-university-of-applied-sciences.mjs — SRH Haarlem, Netherlands
//
// Разведка 29.09.2026. Карточка раньше опиралась на edvoy (агрегатор, 4 программы).
// У кампуса есть собственный сайт srh-haarlem-campus.com с разделами /bachelor/
// (хаб + 4 отдельные страницы программ) и /master/ (хаб + 1 страница программы) —
// это и есть полный список.
// На странице программы — таблица «Your tuition fees» с двумя строками по
// гражданству: «Citizenship | EU/EAA … EUR N/year» и «Citizenship | Non-EU/EAA …
// EUR N/year» — обе отдаём (audience eu / international). Рядом упомянут «Visa
// application fee of EUR 500» — это не цена обучения, пропускаем по правилу 2.

import { get, anchors, text, sleep } from './_lib.mjs';

const BASE = 'https://www.srh-haarlem-campus.com';

async function ownLinks(hubPath, level, gaps) {
  const hubUrl = `${BASE}${hubPath}`;
  let html;
  try {
    html = get(hubUrl);
  } catch (e) {
    gaps.push({ why: `хаб не открылся: ${e.message}`, url: hubUrl });
    return new Map();
  }
  const re = new RegExp(`^${BASE}${hubPath}[a-z0-9-]+/?$`);
  const out = new Map();
  for (const a of anchors(html, hubUrl)) {
    if (re.test(a.href) && a.href !== hubUrl && `${a.href}/`.replace(/\/+$/, '/') !== hubUrl) out.set(a.href, level);
  }
  return out;
}

export default {
  slug: 'srh-haarlem-university-of-applied-sciences',
  site: 'https://www.srh-haarlem-campus.com',
  async collect({ log }) {
    const gaps = [];
    const bachelor = await ownLinks('/bachelor/', 'bachelor', gaps);
    await sleep(500);
    const master = await ownLinks('/master/', 'master', gaps);
    const links = new Map([...bachelor, ...master]);
    log(`собственный сайт: ${links.size} программ`);

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
      let title = og ? text(og[1]) : (tm ? text(tm[1]) : url);
      title = title.replace(/^Bachelor of\s+/i, '').replace(/^Master of\s+/i, '').replace(/\s*\|\s*SRH Haarlem Campus\s*$/i, '').trim();
      programs.push({ title, level, url });

      const t = text(html);
      const euM = t.match(/Citizenship\s*\|\s*EU\/EAA[^E]{0,80}EUR\s*([\d,.]+)\s*\/\s*year/i);
      const nonEuM = t.match(/Citizenship\s*\|\s*Non-?\s*EU\/EAA[^E]{0,80}EUR\s*([\d,.]+)\s*\/\s*year/i);
      if (euM) {
        fees.push({
          amount: Number(euM[1].replace(/,/g, '')), currency: 'EUR', basis: 'year', audience: 'eu',
          scope: 'program', title, level, programUrl: url, url, raw: euM[0],
        });
      }
      if (nonEuM) {
        fees.push({
          amount: Number(nonEuM[1].replace(/,/g, '')), currency: 'EUR', basis: 'year', audience: 'international',
          scope: 'program', title, level, programUrl: url, url, raw: nonEuM[0],
        });
      }
      if (!euM && !nonEuM) gaps.push({ why: 'на странице не нашлась таблица Your tuition fees / Citizenship | …', url });
      await sleep(500);
    }
    log(`${i} программ обработано`);

    return { programs, fees, gaps };
  },
};
