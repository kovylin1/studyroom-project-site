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
//
// Разведка 29.09.2026 (список программ, только Dubai-кампус). Полный каталог —
// хаб-страница https://www.spjain.org/programs/undergraduate (в её меню и бакалаврские,
// и магистерские ссылки разом) плюс отдельная /programs/doctorate-business-administration.
// spjain.org — сайт «глобальной» школы (единая программа читается в Дубае, Сингапуре
// и Сиднее по семестрам, кампусы не разделены по доменам); spjain.co.in — индийский
// (Мумбаи) кампус, отдельный домен, в список НЕ идёт (правило «только список
// кампуса-партнёра»). Так же исключена /programs/partnership/master-of-arts-in-hospitality-
// and-tourism-entrepreneurship — её h1 «Hospitality Business Leadership (HBL) Program
// by SP Jain and Glion»: это зеркало того же HBL, что уже в gaps под spjain.co.in
// (индийская программа), просто с другим URL на spjain.org — не отдельная Dubai-программа.
// /programs/undergraduate/bbc и /programs/undergraduate/bec (старый слаг) у самой базовой
// страницы (не только /fees) отдают общий шаблон-баннер «UNDERGRADUATE Programs» —
// это мягкий 404 сайта, а не программа; у BEC есть отдельная действующая страница по
// новому слагу /undergraduate/bachelor-of-economics (у неё уже нашлась настоящая
// таблица цены). /programs/postgraduate-certificate/graduate-certificate-of-global-management —
// это Graduate Certificate, квалификации вне схемы каталога — не отдаём (правило про
// diploma/certificate). Business Management Program, Data Science Program и Executive
// MBA — настоящие страницы (свой h1), но их /fees по-прежнему мягкий 404 — они идут в
// `programs`, а цена для них остаётся в gaps.

import { get, text, sleep } from './_lib.mjs';

const HUB_URL = 'https://www.spjain.org/programs/undergraduate';
const HUB_LINK_RE = /^https:\/\/www\.spjain\.org\/programs\/(undergraduate|postgraduate)\/([a-z0-9-]+)$/;
const HUB_LEVEL = { undergraduate: 'bachelor', postgraduate: 'master' };
// Мягкий 404: базовая страница отдаёт общий баннер каталога вместо своей программы.
const SOFT_404_TITLE = /^(undergraduate|postgraduate) programs$/i;

const DBA = { base: 'https://www.spjain.org/programs/doctorate-business-administration', level: 'phd', title: 'Doctor of Business Administration', totalCostPattern: true };

function firstH1(html) {
  for (const m of html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)) {
    const t = text(m[1]);
    if (t) return t;
  }
  return null;
}

/** Обходит хаб-меню, отсеивает мягкий 404, возвращает найденные программы с их h1. */
async function discoverPrograms(log) {
  const html = get(HUB_URL);
  await sleep(500);
  const seen = new Set();
  const found = [];
  const gaps = [];
  for (const m of html.matchAll(/href\s*=\s*["']([^"'#]+)["']/gi)) {
    const href = m[1].split(/[?#]/)[0];
    const hm = href.match(HUB_LINK_RE);
    if (!hm || seen.has(href)) continue;
    seen.add(href);
    let page;
    try {
      page = get(href);
    } catch (e) {
      gaps.push({ why: `страница программы не открылась: ${e.message}`, url: href });
      await sleep(500);
      continue;
    }
    await sleep(500);
    const h1 = firstH1(page);
    if (!h1 || SOFT_404_TITLE.test(h1)) {
      gaps.push({ why: `мягкий 404 — у ссылки ${href} нет своей страницы программы (h1: ${h1 ?? 'нет'})`, url: href });
      continue;
    }
    found.push({ base: href, level: HUB_LEVEL[hm[1]], title: h1 });
  }
  log(`hub: ${found.length} программ, ${gaps.length} мягких 404 / ошибок`);
  return { found, gaps };
}

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
    const { found, gaps } = await discoverPrograms(log);
    const PROGRAMS = [...found, DBA];
    // Партнёрская HBL-зеркало на spjain.org — не Dubai-программа, см. разведку выше.
    gaps.push({ why: 'HBL Program (SP Jain и Glion) — та же программа, что уже пропущена под spjain.co.in, зеркало не по Dubai-кампусу', url: 'https://www.spjain.org/programs/partnership/master-of-arts-in-hospitality-and-tourism-entrepreneurship' });
    gaps.push({ why: 'MGLuxM (spjain.co.in) — цена только в INR, не входит в схему каталога', url: 'https://www.spjain.co.in/programs/postgraduate/mgluxm/fees' });
    gaps.push({ why: 'HBL (spjain.co.in) — местная часть в INR, партнёрская — в CHF по рассрочкам за несколько лет без общей суммы; без сложения строк цену не собрать', url: 'https://www.spjain.co.in/programs/postgraduate/hospitality-business-leadership/fees' });

    const programs = PROGRAMS.map((p) => ({ title: p.title, level: p.level, url: p.base }));
    const fees = [];
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

    return { programs, fees, gaps };
  },
};
