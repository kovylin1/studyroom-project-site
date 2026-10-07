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
//
// Разведка 29.09.2026 (список программ). У каждого major и у каждой специализации
// внутри major — своя страница вида /programs/undergraduate/<slug>/ или
// /programs/graduate/<slug>/, и именно они и есть отдельные «программы» этого сайта
// (специализации показаны отдельными страницами — берём их отдельными строками, как
// требует README). Полный список — со страниц-хабов https://www.aauni.edu/programs/
// undergraduate/ (19 ссылок на *.../undergraduate/<slug>/ после хаба самого себя —
// 7 major'ов + 12 специализаций внутри Business Administration/International
// Relations/Humanities, Society and Culture/Journalism and Media Studies) и
// https://www.aauni.edu/programs/graduate/ (2 ссылки на M.A.-программы). Уровень и
// название берём с самой страницы программы (h1), не с текста ссылки.
// Сайт хранит и старые URL той же специализации (WordPress page-sitemap.xml отдаёт,
// например, /programs/undergraduate/political-science-extended-major/ и
// /programs/undergraduate/business-administration-management/ — открываются 200,
// но это дублирующие дореформенные страницы старых названий тех же 7 major'ов
// «Political Science» → «International Relations», старые концентрации Business
// Administration и т.п.; их не выдаёт ни один хаб-каталог, ни меню сайта). Взять их
// значило бы задвоить те же майноры под старыми именами — не берём, это не
// действующий каталог, а память WordPress.
// Два LLM (LLM in Law & Development, LLM in International Intellectual Property Law)
// хабом /programs/graduate/ уже не выданы (сняты с этой страницы), но их страницы
// живые (200, настоящий контент, не 404) и это ровно те LLM, что уже в карточке —
// берём их явно по известным URL, level 'master' (LLM в схеме каталога — 'master',
// program-match.mjs относит его туда же).

import { get, text, anchors, tableRows, sleep } from './_lib.mjs';

const URL = 'https://www.aauni.edu/admissions/tuition-payment/';
const HUBS = {
  bachelor: 'https://www.aauni.edu/programs/undergraduate/',
  master: 'https://www.aauni.edu/programs/graduate/',
};
const HUB_PROGRAM_RE = /^https:\/\/www\.aauni\.edu\/programs\/(undergraduate|graduate)\/[a-z0-9-]+\/$/;
// Живые, но снятые с хаба /programs/graduate/ страницы LLM — см. разведку выше.
const EXTRA_MASTER_URLS = [
  'https://www.aauni.edu/programs/graduate/llm-in-law-and-development/',
  'https://www.aauni.edu/programs/graduate/llm-in-international-intellectual-property-law/',
];

async function hubProgramUrls(hubUrl) {
  const html = get(hubUrl);
  await sleep(500);
  const out = new Set();
  for (const a of anchors(html, hubUrl)) if (HUB_PROGRAM_RE.test(a.href)) out.add(a.href);
  return [...out];
}

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
    const programs = [];
    const gaps = [];

    for (const [level, hub] of Object.entries(HUBS)) {
      let urls;
      try {
        urls = await hubProgramUrls(hub);
      } catch (e) {
        gaps.push({ why: `хаб программ не открылся: ${e.message}`, url: hub });
        continue;
      }
      if (level === 'master') for (const u of EXTRA_MASTER_URLS) if (!urls.includes(u)) urls.push(u);
      for (const url of urls) {
        let html;
        try {
          html = get(url);
        } catch (e) {
          gaps.push({ why: `страница программы не открылась: ${e.message}`, url });
          await sleep(500);
          continue;
        }
        await sleep(500);
        const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        // «(Major)» — суффикс шаблона страницы, не часть названия: в карточке эти же
        // семь программ названы «BA in Psychology» и т.п., без «(Major)» — без снятия
        // суффикса program-match не находил совпадение вовсе (ни по названию, ни по
        // «без приставки степени»), и все семь major'ов садились в cardProgramsNotOnSite.
        const title = h1 ? text(h1[1]).replace(/\s*\(major\)\s*$/i, '').trim() : null;
        if (!title) { gaps.push({ why: 'на странице программы нет h1', url }); continue; }
        programs.push({ title, level, url });
      }
      log(`${level}: ${urls.length} страниц программ`);
    }
    if (!programs.length) gaps.push({ why: 'ни на одном хабе (undergraduate, graduate) не нашлось ссылок на программы', url: HUBS.bachelor });

    const html = get(URL);
    await sleep(500);
    const rows = tableRows(html).filter((r) => r.length >= 3 && /students/i.test(r[0]));
    log(`tuition rows: ${rows.length}`);
    const fees = [];
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
    return { programs, fees, gaps };
  },
};
