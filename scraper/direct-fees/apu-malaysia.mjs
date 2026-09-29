// apu-malaysia.mjs — Asia Pacific University of Technology & Innovation, apu.edu.my
//
// Разведка 29.09.2026. Курл проходит без блоков. Полный список программ — каталог
// https://www.apu.edu.my/our-courses (одна страница, без пагинации): 137 ссылок вида
// /course/<slug>, включая языковые программы APLC и Korean Language. У каждой
// программы своя страница /course/<slug>, заголовок берём из <title> (обрезаем
// " | APU").
//
// Уровень программы определяем по префиксу URL/заголовку:
//   foundation-programme*                              -> foundation (5 программ)
//   bachelor-*, ba-*, bsc-*                             -> bachelor
//   master-*, mba-*, msc-* (в т.ч. "MSc of Philosophy…" — это MPhil, исследовательский
//     магистр, тоже master)                             -> master
//   phd-*                                               -> phd
//   diploma-*, cert-*, pg-diploma-*, pg-certificate-*   -> gaps (diploma/certificate
//     нет в схеме уровней)
//   english-language-study/aplc-english-package-programmes -> english-language
//   english-language-study/…summer-camp, tesol-aplc,
//   korean-language-*                                   -> short-course (короткие
//     нестепенные программы; Korean — не английский, но по формату это тот же
//     нестепенной языковой курс, значит short-course, а не english-language)
//
// Цена: на странице каждой degree-программы (foundation/bachelor/master/phd) есть
// блок "fee-calc-block" — секции "Malaysian" и "International", в каждой по годам
// (Year 1, Year 2, …) и итоговая строка "Total for Malaysian" / "Total for
// International". Берём только Total — это полная цена программы, годовые строки
// не складываем и Year 1 отдельно не берём (правило: не выдумывать основу цены).
// scope: 'program', basis: 'program', audience domestic/international.
// Международная цена в RM (иногда рядом USD-эквивалент в скобках — не берём его,
// берём RM: "Any USD amounts… are for reference only and are non-binding").
//
// У языковых/short-course программ (APLC, Korean, TESOL) фиксированного одного
// "Total"-числа на странице нет — таблицы по неделям/пакетам/уровням без явной
// итоговой суммы за программу целиком, поэтому цены по ним не берём (риск
// перепутать пакет), только сами программы — в programs.
//
// Дипломы/сертификаты (diploma-*, cert-*, pg-diploma-*, pg-certificate-*) — уровня
// diploma/certificate нет в схеме каталога (foundation/bachelor/master/phd/
// english-language/short-course), поэтому идут в gaps, а не в programs.

import { get, text, sleep } from './_lib.mjs';

const BASE = 'https://www.apu.edu.my';
const LISTING_URL = `${BASE}/our-courses`;

function levelOf(slug, title) {
  const s = slug.toLowerCase();
  if (s.startsWith('foundation-programme')) return 'foundation';
  if (s.startsWith('phd-')) return 'phd';
  if (/^(master-|mba-|msc-)/.test(s)) return 'master';
  if (/^(bachelor-|ba-|bsc-)/.test(s)) return 'bachelor';
  if (/^(diploma-|cert-|pg-diploma-|pg-certificate-)/.test(s)) return null; // gaps
  if (s === 'english-language-study/aplc-english-package-programmes') return 'english-language';
  if (s === 'english-language-study/aplc-english-winter-spring-summer-camp'
    || s === 'tesol-aplc' || s.startsWith('korean-language')) return 'short-course';
  return undefined; // неизвестный префикс — разбирать отдельно
}

function feeTotals(html) {
  // Внутри fee-calc-block: секция "Malaysian"/"International", в каждой строки
  // "<h3>RM33,800</h3> <p> Year 1</p>" и "<h3>RM104,600</h3> <p> Total for Malaysian</p>".
  const block = html.match(/fee-calc-block__wrapper[\s\S]*?<\/section>\s*<\/section>/);
  const src = block ? block[0] : html;
  const out = [];
  const itemRe = /<h3>\s*([\s\S]*?)<\/h3>\s*<p>\s*([^<]*?)\s*<\/p>/gi;
  let m;
  while ((m = itemRe.exec(src))) {
    const amountText = text(m[1]);
    const label = text(m[2]);
    if (!/^Total for /i.test(label)) continue;
    const audience = /malaysian/i.test(label) ? 'domestic' : /international/i.test(label) ? 'international' : null;
    if (!audience) continue;
    // Берём первое RM-число (международная строка может нести "(USDxxxx)" вторым числом).
    const rm = amountText.match(/RM\s*([\d,]+)/i);
    if (!rm) continue;
    const amount = Number(rm[1].replace(/,/g, ''));
    if (!amount) continue;
    out.push({ audience, amount, raw: `${label}: ${amountText}` });
  }
  return out;
}

export default {
  slug: 'apu-malaysia',
  site: 'https://apu.edu.my',
  async collect({ log }) {
    const gaps = [];
    const fees = [];
    const programs = [];

    let listingHtml;
    try {
      listingHtml = get(LISTING_URL);
    } catch (e) {
      gaps.push({ why: `каталог программ не открылся: ${e.message}`, url: LISTING_URL });
      return { programs: [], fees: [], gaps };
    }

    const seen = new Map(); // slug -> title
    for (const m of listingHtml.matchAll(/href="\/course\/([a-zA-Z0-9/_-]+)"[^>]*>([^<]{2,150})/g)) {
      const slug = m[1];
      const title = text(m[2]);
      if (!seen.has(slug)) seen.set(slug, title);
    }
    if (!seen.size) {
      gaps.push({ why: 'на /our-courses не нашлось ни одной ссылки /course/*', url: LISTING_URL });
      return { programs: [], fees: [], gaps };
    }

    let i = 0;
    for (const [slug, listTitle] of seen) {
      i += 1;
      const url = `${BASE}/course/${slug}`;
      const level = levelOf(slug, listTitle);
      if (level === undefined) {
        gaps.push({ why: `неизвестный тип программы по URL (не удалось определить уровень): ${listTitle}`, url });
        continue;
      }
      if (level === null) {
        gaps.push({ why: `diploma/certificate — нет такого уровня в схеме каталога: ${listTitle}`, url });
        continue;
      }

      let html;
      try {
        html = get(url);
      } catch (e) {
        gaps.push({ why: `страница не открылась: ${e.message}`, url });
        await sleep(500);
        continue;
      }
      const titleMatch = html.match(/<title>([^<]*?)\s*\|\s*APU/i);
      const title = titleMatch ? text(titleMatch[1]) : listTitle;
      programs.push({ title, level, url });

      if (level === 'foundation' || level === 'bachelor' || level === 'master' || level === 'phd') {
        const totals = feeTotals(html);
        if (!totals.length) {
          gaps.push({ why: 'на странице программы нет блока "Total for …" с ценой', url });
        } else {
          for (const t of totals) {
            fees.push({
              title, level, amount: t.amount, currency: 'MYR', basis: 'program',
              audience: t.audience, scope: 'program', programUrl: url, url, raw: t.raw,
            });
          }
        }
      }
      if (i % 20 === 0) log(`${i}/${seen.size} страниц программ`);
      await sleep(500);
    }

    if (!fees.length) gaps.push({ why: 'ни одна страница программы не отдала цену', url: LISTING_URL });
    return { programs, fees, gaps };
  },
};
