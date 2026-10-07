// university-of-new-york-in-prague.mjs — UNYP, unyp.cz (Czech Republic; EUR/CZK/USD).
//
// Разведка 29.09.2026:
// - Полный список программ — по одной странице на программу, найдены через
//   /undergraduate-programs/ и /graduate-programs/ (у обеих страниц список ссылок
//   не полный без JS — реальные адреса собраны из page-sitemap.xml):
//     Bachelor (7): bachelor-of-business-administration, bachelor-of-psychology,
//     bachelor-of-international-relations, bachelor-of-communication-media,
//     bachelor-of-digital-media-arts, bachelor-of-information-technology,
//     bachelor-of-arts-in-english-literature.
//     Master (3): mba-in-prague, master-of-science-in-digital-marketing-and-analytics-msc,
//     master-of-psychology-mgr.
//     PhD (1): ph-d-by-research. Foundation (1): foundation-program.
//   Остальные адреса под /undergraduate-programs/…-concentration-in-…/ и
//   /graduate-programs/mba-<specialisation>/ («концентрации») существуют как URL,
//   но отдают ОДИН И ТОТ ЖЕ общий текст хаба («Choose Your Business Administration
//   Concentration» / «MBA Focus Areas» / «Communication and Media (BA) —
//   Concentrations» / «International Relations Program Focus Areas») — проверено
//   на 4 разных адресах, h1 у каждого совпал с хабом. Это не отдельные страницы
//   программы (см. README: «своя страница» обязательна), поэтому не программы —
//   в карточку не идут (совпадает с решением по Modul University Vienna, где то же
//   самое с masters-programs/<специализация>).
//   «UNYP Online Summer Accelerator» — не отдельная программа для поступления
//   (двухнедельный курс для уже зачисленных, «available completely free of charge»,
//   заявленная стоимость 25 000 CZK — рекламная «ценность», не цена обучения) — не
//   программа и не цена (правило 2 README).
// - Цены — не на страницах программ (там сумм нет вовсе), а на общей странице
//   https://www.unyp.cz/tuition-fees/:
//     * «American Bachelor's Programs — ANNUAL Tuition and Fees» и «European
//       Bachelor's Programs — ANNUAL Tuition and Fees», каждая с EU/EFTA и
//       International Students (non-EU/EFTA) — подпись прямо называет уровень
//       (Bachelor's Programs) → scope 'level', basis 'year' (сайт сам пишет ANNUAL).
//     * «Tuition cost for the FULL program duration»: «Master's in Business
//       Administration (MBA)», «Master's in Digital Marketing and Analytics»,
//       «Master's in Psychology» — суммы по имени программы → scope 'program',
//       basis 'program' (сайт сам говорит — цена за весь курс, не за год).
//     * Для PhD и Foundation program сумм на этой странице нет — gaps.
//   Валюта на странице — CZK (основная), EUR и USD — пересчитанные по курсу
//   ноября 2025 («estimates based on the November 2025 exchange rate»), но каждая
//   сумма прямо написана на странице цифрой — берём валюту EUR (в каталоге эта
//   валюта), CZK эмитим тоже (в каталог не пойдёт, схема её не поддерживает).

import { get, text, sleep } from './_lib.mjs';

const TUITION_URL = 'https://www.unyp.cz/tuition-fees/';

const PROGRAM_PAGES = [
  { url: 'https://www.unyp.cz/undergraduate-programs/bachelor-of-business-administration/', level: 'bachelor' },
  { url: 'https://www.unyp.cz/undergraduate-programs/bachelor-of-psychology/', level: 'bachelor' },
  { url: 'https://www.unyp.cz/undergraduate-programs/bachelor-of-international-relations/', level: 'bachelor' },
  { url: 'https://www.unyp.cz/undergraduate-programs/bachelor-of-communication-media/', level: 'bachelor' },
  { url: 'https://www.unyp.cz/undergraduate-programs/bachelor-of-digital-media-arts/', level: 'bachelor' },
  { url: 'https://www.unyp.cz/undergraduate-programs/bachelor-of-information-technology/', level: 'bachelor' },
  { url: 'https://www.unyp.cz/undergraduate-programs/bachelor-of-arts-in-english-literature/', level: 'bachelor' },
  { url: 'https://www.unyp.cz/graduate-programs/mba-in-prague/', level: 'master', feeKey: 'mba' },
  { url: 'https://www.unyp.cz/graduate-programs/master-of-science-in-digital-marketing-and-analytics-msc/', level: 'master', feeKey: 'digital-marketing' },
  { url: 'https://www.unyp.cz/graduate-programs/master-of-psychology-mgr/', level: 'master', feeKey: 'psychology' },
  { url: 'https://www.unyp.cz/ph-d-by-research/', level: 'phd' },
  { url: 'https://www.unyp.cz/foundation-program/', level: 'foundation' },
];

const MASTER_FEE_RE = [
  ['mba', /Master.s in Business Administration \(MBA\)[^0-9]*?([\d,]+)\s+([\d,]+)\s+([\d,]+)/i],
  ['digital-marketing', /Master.s in Digital Marketing and Analytics[^0-9]*?([\d,]+)\s+([\d,]+)\s+([\d,]+)/i],
  ['psychology', /Master.s in Psychology[^0-9]*?([\d,]+)\s+([\d,]+)\s+([\d,]+)/i],
];

export default {
  slug: 'university-of-new-york-in-prague',
  site: 'https://www.unyp.cz',
  async collect({ log }) {
    const programs = [];
    const gaps = [];

    for (const { url, level, feeKey } of PROGRAM_PAGES) {
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
      if (!title) { gaps.push({ why: 'на странице нет h1', url }); continue; }
      programs.push({ title, level, url, feeKey });
    }
    log(`programme pages: ${programs.length}`);

    let tfText;
    try {
      tfText = text(get(TUITION_URL));
    } catch (e) {
      gaps.push({ why: `страница тарифов не открылась (${String(e.message || e).split('\n')[0]})`, url: TUITION_URL });
      return { programs: programs.map(({ feeKey, ...p }) => p), fees: [], gaps };
    }
    await sleep(500);

    const fees = [];
    const bachelorRe = /(American|European) Bachelor.s Programs.{0,20}Tuition and Fees EU\/EFTA Nationals[^0-9]*?([\d,]+)\s+([\d,]+)\s+([\d,]+)\s*International Students \(non-EU\/EFTA\)[^0-9]*?([\d,]+)\s+([\d,]+)\s+([\d,]+)/gi;
    for (const m of tfText.matchAll(bachelorRe)) {
      const [, kind, czkEu, eurEu, usdEu, czkIntl, eurIntl, usdIntl] = m;
      fees.push({
        amount: Number(eurEu.replace(/[^\d]/g, '')), currency: 'EUR', basis: 'year', audience: 'eu', scope: 'level', level: 'bachelor',
        url: TUITION_URL, raw: `${kind} Bachelor's Programs — ANNUAL Tuition and Fees EU/EFTA Nationals in CZK ${czkEu} in EUR ${eurEu} in USD ${usdEu}`,
      });
      fees.push({
        amount: Number(eurIntl.replace(/[^\d]/g, '')), currency: 'EUR', basis: 'year', audience: 'international', scope: 'level', level: 'bachelor',
        url: TUITION_URL, raw: `${kind} Bachelor's Programs — ANNUAL Tuition and Fees International Students (non-EU/EFTA) in CZK ${czkIntl} in EUR ${eurIntl} in USD ${usdIntl}`,
      });
      // CZK — не в списке валют схемы (SCHEMA_CURRENCIES), но по правилу задания эмитим и её, для отчёта.
      fees.push({
        amount: Number(czkEu.replace(/[^\d]/g, '')), currency: 'CZK', basis: 'year', audience: 'eu', scope: 'level', level: 'bachelor',
        url: TUITION_URL, raw: `${kind} Bachelor's Programs — ANNUAL Tuition and Fees EU/EFTA Nationals in CZK ${czkEu} in EUR ${eurEu} in USD ${usdEu}`,
      });
      fees.push({
        amount: Number(czkIntl.replace(/[^\d]/g, '')), currency: 'CZK', basis: 'year', audience: 'international', scope: 'level', level: 'bachelor',
        url: TUITION_URL, raw: `${kind} Bachelor's Programs — ANNUAL Tuition and Fees International Students (non-EU/EFTA) in CZK ${czkIntl} in EUR ${eurIntl} in USD ${usdIntl}`,
      });
    }

    const feeByKey = {};
    for (const [key, re] of MASTER_FEE_RE) {
      const m = tfText.match(re);
      if (!m) { gaps.push({ why: `на /tuition-fees/ не нашлась строка тарифа для «${key}»`, url: TUITION_URL }); continue; }
      feeByKey[key] = { czk: m[1], eur: m[2], usd: m[3] };
    }
    for (const p of programs) {
      if (!p.feeKey) continue;
      const f = feeByKey[p.feeKey];
      if (!f) continue;
      const raw = `Tuition cost for the FULL program duration ${p.title} in CZK ${f.czk} in EUR ${f.eur} in USD ${f.usd}`;
      fees.push({ amount: Number(f.eur.replace(/[^\d]/g, '')), currency: 'EUR', basis: 'program', audience: null, scope: 'program', title: p.title, level: p.level, programUrl: p.url, url: TUITION_URL, raw });
      fees.push({ amount: Number(f.czk.replace(/[^\d]/g, '')), currency: 'CZK', basis: 'program', audience: null, scope: 'program', title: p.title, level: p.level, programUrl: p.url, url: TUITION_URL, raw });
    }
    if (!programs.some((p) => p.level === 'phd' && p.title)) gaps.push({ why: 'PhD: цена не публикуется на /tuition-fees/', url: TUITION_URL });
    gaps.push({ why: 'Foundation program: цена не публикуется на /tuition-fees/', url: TUITION_URL });

    return { programs: programs.map(({ feeKey, ...p }) => p), fees, gaps };
  },
};
