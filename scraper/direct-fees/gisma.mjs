// gisma.mjs — GISMA University of Applied Sciences, gisma.com (Berlin/Potsdam/Hamburg)
//
// Разведка 29.09.2026. Список программ — на пагинированных каталогах, обычным curl
// (Next.js, но HTML уже содержит ссылки и подписи): английские /programmes,
// /programmes/page/2..4 (undergraduate/postgraduate, 4 страницы, дальше 404) и
// немецкие /de/programme, /de/programme/page/2..3 (bachelor/master). У каждой ссылки
// на странице-каталоге три вхождения одного href — берём то, где текст не пустой и
// не «Read More».
//
// Цены по отдельным программам в HTML страницы программы НЕ публикуются (проверено на
// /programmes/undergraduate/bsc-artificial-intelligence — ни одного числа с валютой).
// Зато есть общая страница /life-at-gisma/tuition-fees-and-funding с таблицей
// «Gisma Tuition Fees 2026»: Undergraduate Programmes (Bachelor's Degree — цена ЗА ГОД)
// и Postgraduate Programmes + Global MBA (Total Tuition Fee — цена ЗА ВСЮ ПРОГРАММУ).
// Это уровневые цены (подпись называет степень), берём их как scope: 'level'.
// Master's Degree дан тремя вариантами по ECTS (60/90/120) с разными total — это три
// отдельные валидные цены одного уровня 'master', так на сайте, не выдумываем среднюю.
// Строки «Foundation + Bachelor's Degree» и «Premaster's + Master's Degree» смешивают
// два уровня в одной программе — не грузим ни как level, ни как program (в gaps).
// Депозит (€1,500 / €3,000) и рассрочка — не цена обучения, пропускаем по правилу 2.

import { get, anchors, text, sleep } from './_lib.mjs';

const BASE = 'https://www.gisma.com';

const LIST_PAGES = [
  { url: `${BASE}/programmes`, re: /\/programmes\/(undergraduate|postgraduate)\/[a-z0-9-]+$/ },
  { url: `${BASE}/programmes/page/2`, re: /\/programmes\/(undergraduate|postgraduate)\/[a-z0-9-]+$/ },
  { url: `${BASE}/programmes/page/3`, re: /\/programmes\/(undergraduate|postgraduate)\/[a-z0-9-]+$/ },
  { url: `${BASE}/programmes/page/4`, re: /\/programmes\/(undergraduate|postgraduate)\/[a-z0-9-]+$/ },
  { url: `${BASE}/de/programme`, re: /\/de\/programme\/(bachelor|master)\/[a-z0-9-]+$/ },
  { url: `${BASE}/de/programme/page/2`, re: /\/de\/programme\/(bachelor|master)\/[a-z0-9-]+$/ },
  { url: `${BASE}/de/programme/page/3`, re: /\/de\/programme\/(bachelor|master)\/[a-z0-9-]+$/ },
];

function levelFor(href) {
  if (/foundation-programme|premasters-programme/.test(href)) return 'foundation';
  if (/\/undergraduate\/|\/bachelor\//.test(href)) return 'bachelor';
  if (/\/postgraduate\/|\/master\//.test(href)) return 'master';
  return null;
}

export default {
  slug: 'gisma',
  site: 'https://www.gisma.com',
  async collect({ log }) {
    const byUrl = new Map(); // url -> Set(candidate titles)
    const gaps = [];
    for (const page of LIST_PAGES) {
      let html;
      try {
        html = get(page.url);
      } catch (e) {
        gaps.push({ why: `каталог не открылся: ${e.message}`, url: page.url });
        await sleep(500);
        continue;
      }
      for (const a of anchors(html, page.url)) {
        if (!page.re.test(a.href)) continue;
        if (!a.text || a.text === 'Read More') continue;
        if (!byUrl.has(a.href)) byUrl.set(a.href, new Set());
        byUrl.get(a.href).add(a.text);
      }
      log(`${page.url}: накоплено ${byUrl.size} программ`);
      await sleep(500);
    }

    const programs = [];
    for (const [url, titles] of byUrl) {
      const level = levelFor(url);
      if (!level) { gaps.push({ why: 'не удалось определить уровень по адресу', url }); continue; }
      const title = [...titles].sort((x, y) => y.length - x.length)[0];
      programs.push({ title, level, url });
    }

    // Отдельная программа Foundation Programme — на английском каталоге как
    // undergraduate, ловится общим циклом (levelFor распознаёт по слову foundation-programme).

    const fees = [];
    let tuitionHtml;
    try {
      tuitionHtml = get(`${BASE}/life-at-gisma/tuition-fees-and-funding`);
    } catch (e) {
      gaps.push({ why: `страница цен не открылась: ${e.message}`, url: `${BASE}/life-at-gisma/tuition-fees-and-funding` });
      tuitionHtml = null;
    }
    if (tuitionHtml) {
      const t = text(tuitionHtml);
      const feeUrl = `${BASE}/life-at-gisma/tuition-fees-and-funding`;
      const rows = [
        { re: /Bachelor.s Degree \(180 ECTS Credits\)\s+3\s+€\s*([\d,]+)/, level: 'bachelor', basis: 'year', note: "Bachelor's Degree (180 ECTS Credits)" },
        { re: /Master.s Degree \(60 ECTS Credits\)\s+1\s+€\s*([\d,]+)/, level: 'master', basis: 'program', note: "Master's Degree (60 ECTS Credits)" },
        { re: /Master.s Degree \(90 ECTS Credits\)\s+1\.5\s+€\s*([\d,]+)/, level: 'master', basis: 'program', note: "Master's Degree (90 ECTS Credits)" },
        { re: /Master.s Degree \(120 ECTS Credits\)\s+2\s+€\s*([\d,]+)/, level: 'master', basis: 'program', note: "Master's Degree (120 ECTS Credits)" },
        { re: /Premaster.s\s+0\.5\s+€\s*([\d,]+)/, level: 'foundation', basis: 'program', note: "Premaster's" },
        { re: /Global MBA \(60 ECTS Credits\)\s+1\s+€\s*([\d,]+)/, level: 'master', basis: 'program', note: 'Global MBA (60 ECTS Credits)' },
      ];
      for (const r of rows) {
        const m = t.match(r.re);
        if (!m) { gaps.push({ why: `в таблице цен не нашлась строка «${r.note}»`, url: feeUrl }); continue; }
        fees.push({
          amount: Number(m[1].replace(/,/g, '')), currency: 'EUR', basis: r.basis, audience: null,
          scope: 'level', level: r.level, url: feeUrl, raw: `${r.note}: € ${m[1]}`,
        });
      }
      gaps.push({ why: 'строки «Foundation + Bachelor’s Degree» и «Premaster’s + Master’s Degree» смешивают два уровня в одной цене — не грузим', url: feeUrl });
      gaps.push({ why: 'по отдельным программам цены на сайте не публикуются (только общая таблица по уровням на этой странице)', url: feeUrl });
    }

    return { programs, fees, gaps };
  },
};
