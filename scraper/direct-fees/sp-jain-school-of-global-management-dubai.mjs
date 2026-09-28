// sp-jain-school-of-global-management-dubai.mjs — SP Jain School of Global Management, spjain.org
//
// Разведка 28.09.2026. Курл проходит без блоков. У каждой настоящей программы есть
// подстраница `<programUrl>/fees` с таблицей(ами) вида «Currency … / Total Compulsory
// Tuition Fees …» (иногда с рядом «Academic Year» — тогда сумма за год, basis: 'year';
// без него — общая сумма программы, basis: 'program'). У BBA и Bachelor of Data Science
// таблица на несколько лет с двумя валютами разом (первые курсы в Singapore/Dubai —
// USD, последние в Sydney — AUD): берём КАЖДЫЙ год отдельной строкой с его валютой,
// сумму по годам не складываем. У докторантуры (DBA) другой шаблон — «Total Program
// Cost» с валютой прямо в сумме («AUD 44,170» для онлайн-варианта, «AUD 81,602» для
// очного в Сиднее) — два разных варианта обучения, обе строки отдаём.
// ВАЖНО: на странице DBA часть старых таблиц лежит в HTML-комментариях (например,
// «Total Program Cost test … AUD 44,170» и вариант для Кувейта в INR) — комментарии
// вырезаем перед разбором, иначе задвоится или всплывёт мёртвая цифra.
// Ловушка, о которой предупредили заранее: «AUD 700» на этих страницах — это НЕ
// цена обучения нигде: то скидка «rebate of AUD 700 on Semester 1 fees», то
// прожиточный минимум «AUD 700 per month in Sydney», то доплата DBA за каждые
// лишние 6 месяцев сверх 3 лет. Ни разу не берём.
//
// Что не досталось (в gaps):
//   - BBC (undergraduate/bbc/fees) и Executive MBA (postgraduate/executive-mba/fees) —
//     страницы 404;
//   - BEC (undergraduate/bec/fees), Business Management Program и Data Science Program
//     (тот же /undergraduate/.../fees) — отдают общий шаблон «SP Jain Global
//     Undergraduate Programs» без своей таблицы (мягкий 404, страница фактически не
//     существует);
//   - MGLuxM (spjain.co.in) — цена только в INR (нет в схеме каталога);
//   - HBL (spjain.co.in) — местная часть в INR, партнёрская (Glion) часть в CHF
//     разбита по рассрочкам за несколько лет без единой суммы за год или программу —
//     без сложения строк не собрать честную цифру.

import { get, text, sleep } from './_lib.mjs';

const PROGRAMS = [
  { base: 'https://www.spjain.org/programs/undergraduate/bba', level: 'bachelor', title: 'Bachelor of Business Administration' },
  { base: 'https://www.spjain.org/programs/undergraduate/bachelor-of-data-science', level: 'bachelor', title: 'Bachelor of Data Science' },
  { base: 'https://www.spjain.org/programs/postgraduate/mgb', level: 'master', title: 'Master of Global Business' },
  { base: 'https://www.spjain.org/programs/postgraduate/gmba', level: 'master', title: 'Global MBA' },
  { base: 'https://www.spjain.org/programs/postgraduate/master-of-artificial-intelligence-in-business', level: 'master', title: 'Master of Artificial Intelligence in Business' },
  { base: 'https://www.spjain.org/programs/postgraduate/master-of-applied-finance-and-wealth-management', level: 'master', title: 'Master of Applied Finance and Wealth Management' },
  { base: 'https://www.spjain.org/programs/postgraduate/master-of-management', level: 'master', title: 'Master of Management' },
  { base: 'https://www.spjain.org/programs/doctorate-business-administration', level: 'phd', title: 'Doctorate of Business Administration', totalCostPattern: true },
];

const NOFEES = [
  { url: 'https://www.spjain.org/programs/undergraduate/bbc/fees', why: 'страница 404 — у BBC нет своей fees-подстраницы' },
  { url: 'https://www.spjain.org/programs/undergraduate/bec/fees', why: 'мягкий 404 — отдаёт общий шаблон "Undergraduate Programs" без таблицы цены' },
  { url: 'https://www.spjain.org/programs/undergraduate/business-management-program/fees', why: 'страница 404' },
  { url: 'https://www.spjain.org/programs/undergraduate/data-science-program/fees', why: 'страница 404' },
  { url: 'https://www.spjain.org/programs/postgraduate/executive-mba/fees', why: 'страница 404' },
  { url: 'https://www.spjain.co.in/programs/postgraduate/mgluxm/fees', why: 'цена только в INR, не входит в схему каталога' },
  { url: 'https://www.spjain.co.in/programs/postgraduate/hospitality-business-leadership/fees', why: 'местная часть в INR, партнёрская — в CHF по рассрочкам за несколько лет без общей суммы; без сложения строк цену не собрать' },
];

const stripComments = (html) => html.replace(/<!--[\s\S]*?-->/g, ' ');

function tableBlocks(html) {
  return [...html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map((m) => m[0]);
}

function rowsOf(tableHtml) {
  return [...tableHtml.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)]
    .map((r) => [...r[0].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) => text(c[1])))
    .filter((r) => r.length);
}

/** Таблицы вида «Currency … / Total Compulsory Tuition Fees …», по колонкам. */
function currencyTotalRows(html) {
  const out = [];
  for (const block of tableBlocks(html)) {
    const rows = rowsOf(block);
    const academicYearRow = rows.find((r) => /^academic year$/i.test((r[0] || '').trim()));
    const currencyRow = rows.find((r) => /^currency$/i.test((r[0] || '').trim()));
    const totalRow = rows.find((r) => /^total compulsory tuition fees$/i.test((r[0] || '').trim()));
    if (!currencyRow || !totalRow || currencyRow.length !== totalRow.length) continue;
    const basis = academicYearRow ? 'year' : 'program';
    for (let j = 1; j < totalRow.length; j += 1) {
      const currency = (currencyRow[j] || '').trim();
      const digits = String(totalRow[j] || '').replace(/[^\d]/g, '');
      if (!currency || !digits) continue;
      const yearLabel = academicYearRow ? ` (${academicYearRow[j]})` : '';
      out.push({
        amount: Number(digits), currency, basis,
        raw: `Total Compulsory Tuition Fees${yearLabel}: ${currency} ${totalRow[j]}`,
      });
    }
  }
  return out;
}

/** Таблицы DBA вида «Total Program Cost | Fee Per Credit | Total Credits» — валюта в сумме,
 * либо разбивка компонентов с шапкой «Amount (in AUD)» и строкой «Total Program Cost» / «TOTAL». */
function totalProgramCostRows(html) {
  const out = [];
  for (const block of tableBlocks(html)) {
    const rows = rowsOf(block);
    // Валюта прямо в сумме: "AUD 44,170".
    for (let i = 0; i < rows.length; i += 1) {
      if (!/^total program cost/i.test((rows[i][0] || '').trim())) continue;
      const data = rows[i + 1];
      if (!data || !data[0]) continue;
      const m = data[0].match(/([A-Z]{3})\s*([\d,.]+)/);
      if (!m) continue;
      const digits = m[2].replace(/[^\d]/g, '');
      if (!digits) continue;
      out.push({ amount: Number(digits), currency: m[1], basis: 'program', raw: `Total Program Cost: ${data[0]}` });
    }
    // Валюта в шапке "Amount (in AUD)", сумма — строкой "Total Program Cost" или "TOTAL".
    const header = rows[0] || [];
    const curCell = header.find((c) => /amount\s*\(in\s*([a-z]{3})\)/i.test(c || ''));
    if (curCell) {
      const currency = curCell.match(/amount\s*\(in\s*([a-z]{3})\)/i)[1].toUpperCase();
      for (const row of rows) {
        const label = (row[0] || '').trim();
        if (!/^total program cost$/i.test(label) && !/^total$/i.test(label)) continue;
        const last = row[row.length - 1];
        const digits = String(last || '').replace(/[^\d]/g, '');
        if (!digits) continue;
        out.push({ amount: Number(digits), currency, basis: 'program', raw: `${label} (Amount in ${currency}): ${last}` });
      }
    }
  }
  return out;
}

export default {
  slug: 'sp-jain-school-of-global-management-dubai',
  site: 'https://www.spjain.org/',
  async collect({ log }) {
    const fees = [];
    const gaps = [];

    for (const prog of PROGRAMS) {
      const feesUrl = `${prog.base}/fees`;
      let html;
      try {
        html = get(feesUrl);
      } catch (e) {
        gaps.push({ why: `страница fees не открылась: ${e.message}`, url: feesUrl });
        await sleep(500);
        continue;
      }
      const clean = stripComments(html);
      const rows = prog.totalCostPattern ? totalProgramCostRows(clean) : currencyTotalRows(clean);
      if (!rows.length) {
        gaps.push({ why: 'на странице fees не нашлась ни таблица "Currency/Total Compulsory Tuition Fees", ни "Total Program Cost"', url: feesUrl });
        await sleep(500);
        continue;
      }
      for (const r of rows) {
        fees.push({
          amount: r.amount, currency: r.currency, basis: r.basis, audience: null,
          scope: 'program', title: prog.title, level: prog.level,
          programUrl: prog.base, url: feesUrl, raw: r.raw,
        });
      }
      log(`${prog.title}: ${rows.length} строк`);
      await sleep(500);
    }

    for (const g of NOFEES) gaps.push(g);

    return { programs: [], fees, gaps };
  },
};
