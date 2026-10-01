// karelia-university-of-applied-sciences.mjs — karelia.fi (Joensuu, Finland, EUR).
//
// Разведка 28.09.2026:
// - Всё на одной странице https://www.karelia.fi/en/tuition-fees/, разделе «As of
//   1.1.2023 at Karelia UAS the tuition fee for non-EU/EEA students are following»:
//   по программе на строку — «International Business 9 000 € / academic year»,
//   «Industrial Management 9 000 € / academic year», «Information and Communication
//   Technology 10 000 € / academic year» (все bachelor's), «Sustainability Management
//   10 500 € / academic year» (master's). Audience прямо назван non-EU/EEA →
//   'international'; EU/EEA/Швейцария и финские граждане освобождены от платы вовсе —
//   у них цены нет (это не 0, отдельной строки для EU не будет).
// - «Early-bird priced tuition fee … -20%» — скидка за раннюю оплату, не берём (правило 3).
//
// Разведка 29.09.2026 (список программ). Полный список программ на английском —
// на двух страницах-хабах: https://www.karelia.fi/en/bachelor-s-degrees/ и
// https://www.karelia.fi/en/master-s-degrees/. У обеих одинаковое навигационное меню
// (Admission, Apply to Us, Studying at Karelia, …) — это не программы, исключены
// списком NAV_EXCLUDE. После исключения на странице бакалавриата остаются ровно три
// ссылки на страницы программ (International Business, Industrial Management,
// Information and Communication Technology — все английские, других англоязычных
// бакалаврских программ на сайте нет; «Bachelor's Degree Programmes taught in Finnish»
// — отдельная ветка на финском, туда не идём). На странице магистратуры — ровно одна
// англоязычная ссылка (Sustainability Management, /en/sustainability-management/);
// остальные магистерские ссылки ведут на karelia.fi/ylemmat-amk-tutkinnot/… (без /en/,
// финский раздел «ylempi AMK» — не берём, это не то же дерево что /en/). Итого 4
// англоязычных программы верхнего уровня — ровно те же названия, что были в фиксах цен
// (KNOWN раньше), теперь их находим со страниц-хабов, а не жёстко прописываем: если
// сайт добавит новую программу на этих хабах, она попадёт в список сама. Название и
// уровень программы берём с самой страницы программы (h1 + текст рядом с «Degree» —
// не с текста ссылки, у master-хаба текст ссылки везде «Read more»).

import { get, text, anchors, sleep } from './_lib.mjs';

const URL = 'https://www.karelia.fi/en/tuition-fees/';
const HUBS = {
  bachelor: 'https://www.karelia.fi/en/bachelor-s-degrees/',
  master: 'https://www.karelia.fi/en/master-s-degrees/',
};

// Известные из карточки соответствия «голое имя со страницы цен» → programUrl —
// используем как запасной вариант, если обход хабов не найдёт страницу программы
// (сайт недоступен и т.п.), чтобы сопоставление цены с карточкой не развалилось.
const KNOWN_FEE_URL = {
  'International Business': 'https://www.karelia.fi/en/international-business/',
  'Industrial Management': 'https://www.karelia.fi/en/industrial-management/',
  'Information and Communication Technology': 'https://www.karelia.fi/en/information-and-communication-technology/',
  'Sustainability Management': 'https://www.karelia.fi/en/sustainability-management/',
};

const NAV_EXCLUDE = new Set([
  'https://www.karelia.fi/en/admission/', 'https://www.karelia.fi/en/apply-to-us/',
  'https://www.karelia.fi/en/bachelor-s-degrees/', 'https://www.karelia.fi/en/master-s-degrees/',
  'https://www.karelia.fi/en/studying-at-karelia/', 'https://www.karelia.fi/en/new-students/exchange-students/',
  'https://www.karelia.fi/en/education-for-immigrants/', 'https://www.karelia.fi/en/open-uas/',
  'https://www.karelia.fi/en/global-education-services/', 'https://www.karelia.fi/en/local-services/',
  'https://www.karelia.fi/en/education-agents/', 'https://www.karelia.fi/en/alumni-activities/',
  'https://www.karelia.fi/en/future-talents-partnership-programme/', 'https://www.karelia.fi/en/students-at-your-service/',
  'https://www.karelia.fi/en/research-development-and-innovation/', 'https://www.karelia.fi/en/research-and-development-projects/',
  'https://www.karelia.fi/en/research-infrastructures/', 'https://www.karelia.fi/en/research-permissions/',
  'https://www.karelia.fi/en/entrepreneurship-2/', 'https://www.karelia.fi/en/open-science-and-research/',
  'https://www.karelia.fi/en/about-us/', 'https://www.karelia.fi/en/campuses-of-karelia-uas/',
  'https://www.karelia.fi/en/internationality/', 'https://www.karelia.fi/en/safety/',
  'https://www.karelia.fi/en/responsibility/', 'https://www.karelia.fi/en/library/',
  'https://www.karelia.fi/en/contact-us/', 'https://www.karelia.fi/en/frontpage/',
  'https://www.karelia.fi/en/front-page/', 'https://www.karelia.fi/en/accessibility-statement/',
]);
const PROGRAM_PAGE_RE = /^https:\/\/www\.karelia\.fi\/en\/[a-z0-9-]+\/$/;

async function hubProgramLinks(hubUrl) {
  const html = get(hubUrl);
  await sleep(500);
  const seen = new Map();
  for (const a of anchors(html, hubUrl)) {
    if (!PROGRAM_PAGE_RE.test(a.href) || NAV_EXCLUDE.has(a.href)) continue;
    if (!seen.has(a.href)) seen.set(a.href, true);
  }
  return [...seen.keys()];
}

export default {
  slug: 'karelia-university-of-applied-sciences',
  site: 'https://www.karelia.fi',
  async collect({ log }) {
    const programs = [];
    const gaps = [];
    const titleByUrl = new Map();

    for (const [level, hub] of Object.entries(HUBS)) {
      let links;
      try {
        links = await hubProgramLinks(hub);
      } catch (e) {
        gaps.push({ why: `хаб программ не открылся: ${e.message}`, url: hub });
        continue;
      }
      for (const url of links) {
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
        const title = h1 ? text(h1[1]) : null;
        if (!title) { gaps.push({ why: 'на странице программы нет h1', url }); continue; }
        programs.push({ title, level, url });
        titleByUrl.set(title, url);
      }
      log(`${level}: ${links.length} страниц программ`);
    }
    if (!programs.length) gaps.push({ why: 'ни на одном хабе (bachelor-s-degrees, master-s-degrees) не нашлось программ вне навигационного меню', url: HUBS.bachelor });

    const urlForName = (name) => titleByUrl.get(name) ?? KNOWN_FEE_URL[name];

    const html = get(URL);
    await sleep(500);
    const pageText = text(html);
    const i = pageText.search(/tuition fee for non-eu\/eea students are following/i);
    if (i === -1) return { programs, fees: [], gaps: [...gaps, { why: 'не нашёлся абзац с ценами non-EU/EEA', url: URL }] };
    const j = pageText.indexOf('Early-bird priced tuition fee', i);
    const block = pageText.slice(i, j > i ? j : i + 900);
    log(`block: ${block.slice(0, 200)}`);

    const fees = [];
    for (const m of block.matchAll(/[-‐-―]?\s*([A-Za-z][A-Za-z &]+?)\s+([\d][\d\s]*)\s*€\s*\/\s*academic year/g)) {
      const name = m[1].trim();
      const amount = Number(m[2].replace(/\s+/g, ''));
      const level = /master/i.test(block.slice(Math.max(0, m.index - 60), m.index)) ? 'master' : 'bachelor';
      fees.push({
        amount, currency: 'EUR', basis: 'year', audience: 'international', scope: 'program',
        title: name, level, programUrl: urlForName(name), url: URL, raw: m[0].trim(),
      });
    }
    if (!fees.length) gaps.push({ why: 'абзац найден, но строки формата «Название X 000 € / academic year» не распознались', url: URL });
    return { programs, fees, gaps };
  },
};
