// anglo-american-university.mjs — aauni.edu / www.aauni.edu (Prague, EUR/CZK/USD).
//
// Разведка 28.09.2026:
// - Единственная страница с ценами — https://www.aauni.edu/admissions/tuition-payment/
//   (сайт на WordPress, редиректит aauni.edu → www.aauni.edu; sitemap_index.xml →
//   page-sitemap.xml — там и нашлась /admissions/tuition-payment/; более ранний общий
//   краулер вместо этого приносил «Thank you»-страницы и новости).
// - На странице одна таблица «2026/27 General Tuition & Fees» на 4 строки:
//   Undergraduate (BA) / Graduate (MA) × EU-EFTA-or-Czech-resident / non-EU-non-EFTA.
//   Это цена по СТУПЕНИ (подпись прямо называет «Undergraduate (BA)» / «Graduate (MA)»),
//   не по программе — у AAU нет отдельных цен на каждую из ~60 карточек-специализаций.
//   Колонка «Price per semester» и колонка «Price Per degree» — обе с оговоркой
//   «Tuition fees are set in CZK; amounts in USD or EUR are only indicative» — то есть
//   валюта по умолчанию CZK, USD/EUR идут расчётным курсом, но раз они прямо написаны
//   на странице, берём их тоже: сумма должна быть в raw, а не вычислена нами.
// - non-EU/non-EFTA = 'international' для каталога (аудитория КОМПАСа — Казахстан).
// - Нет: цен по отдельным специализациям/минорам (напр. «Business Administration:
//   Marketing and Communications»), нет цен для short-course / english-language единиц
//   (это отдельные короткие курсы, не про Tuition & Payment) — они останутся без цены,
//   уровневая цена сядет только на bachelor/master в карточке.

import { get, tableRows, sleep } from './_lib.mjs';

const URL = 'https://www.aauni.edu/admissions/tuition-payment/';

function levelFromLabel(label) {
  if (/undergraduate|\bba\b/i.test(label)) return 'bachelor';
  if (/graduate|\bma\b/i.test(label)) return 'master';
  return null;
}

function audienceFromLabel(label) {
  if (/non-eu|non-efta/i.test(label)) return 'international';
  if (/\beu\b|efta|czech permanent resident/i.test(label)) return 'eu';
  return null;
}

/** Суммы + валюты из ячейки вида «125 489 CZK / 5 976 USD / 5 185 EUR». */
function currenciesFromCell(cell) {
  const out = [];
  for (const m of cell.matchAll(/([\d][\d\s]*\d|\d)\s*(CZK|USD|EUR)/g)) {
    out.push({ amount: Number(m[1].replace(/\s+/g, '')), currency: m[2] });
  }
  return out;
}

export default {
  slug: 'anglo-american-university',
  site: 'https://www.aauni.edu',
  async collect({ log }) {
    const html = get(URL);
    await sleep(500);
    const rows = tableRows(html).filter((r) => r.length >= 3 && /students/i.test(r[0]));
    log(`tuition rows: ${rows.length}`);
    const fees = [];
    const gaps = [];
    for (const row of rows) {
      const [label, perSemester, perDegree] = row;
      const level = levelFromLabel(label);
      const audience = audienceFromLabel(label);
      if (!level || !audience) { gaps.push({ why: `строка таблицы не разобралась: ${label}`, url: URL }); continue; }
      for (const { amount, currency } of currenciesFromCell(perDegree)) {
        fees.push({ amount, currency, basis: 'program', audience, scope: 'level', level, url: URL, raw: `${label}: ${perDegree}` });
      }
      for (const { amount, currency } of currenciesFromCell(perSemester)) {
        fees.push({ amount, currency, basis: 'semester', audience, scope: 'level', level, url: URL, raw: `${label}: ${perSemester}` });
      }
    }
    if (!rows.length) gaps.push({ why: 'таблица General Tuition & Fees не нашлась на странице', url: URL });
    return { programs: [], fees, gaps };
  },
};
