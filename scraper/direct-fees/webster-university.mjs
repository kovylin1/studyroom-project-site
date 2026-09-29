// webster-university.mjs — Webster University, webster.edu
//
// Разведка 29.09.2026. Карточка (sourceUrl = edge.edvoy.com/institutions/
// webster-university-st-louis, campuses: "Webster San Antonio Campus", "Webster
// Groves Main Campus", country United States) — это главный американский кампус
// (Сент-Луис, штат Миссури, с доп. локациями в США), НЕ международный кампус:
// у Webster есть отдельные международные кампусы (Vienna, Leiden, Geneva, Athens,
// Accra, Thailand …) с собственными сайтами — у Vienna в каталоге своя карточка
// webster-vienna.json. Эта карточка — про webster.edu (домен главного/американских
// кампусов), это и берём.
//
// Полный список программ — две официальные страницы-каталога:
//   /academics/undergraduate/majors-minors.php — бакалавриат (54 major-страницы,
//     minors — те же якоря на этой же странице, не отдельные программы, не берём);
//   /academics/graduate/graduate-programs.php  — магистратура/докторантура
//     (32 страницы: MA/MS/MBA/MHA/MSN + Doctor of Education (EdD));
//   /academics/certificates/index.php          — сертификаты (5 страниц, все
//     non-degree — уровня "certificate" в схеме нет, ближайшее — short-course).
// У каждой программы своя страница /<school>/<award>-<slug>.php, заголовок берём
// из <title> (обрезаем " | Webster University").
//
// Уровень по префиксу файла: bs-/ba-/bfa-/bm-/bed- -> bachelor; ms-/ma-/mba-/mha-/
// msn- -> master; edd- -> phd; gcrt-/cert-/ucrt- -> short-course.
//
// ЦЕНА. У webster.edu нет цены на странице конкретной программы (проверено —
// ни на одной program-странице нет ни одной суммы, кроме несвязанных зарплатных
// цифр BLS). Общеуниверситетские тарифы — на двух страницах:
//   /admissions/undergraduate/tuition.php — один плоский тариф на учебный год на
//     ВСЕ бакалаврские программы, кроме программ Conservatory (там свой, более
//     высокий). Страница содержит расценки сразу на два учебных года (2025-2026
//     и 2026-2027 — видимо, обе вкладки в разметке, переключение табом на JS);
//     берём 2026-2027 (текущий на дату разведки 29.09.2026): "Full-time
//     undergraduate tuition (except Conservatory) per academic year — $33,360
//     flat fee" (год, USD). Conservatory-тариф ($38,780) не берём вовсе —
//     страница не называет, каким именно программам он относится, а угадывать
//     нельзя; вместо этого программы Leigh Gerdine College of Fine Arts (пути
//     /fine-arts/*, 13 программ — BFA/BM + BA Art History/Dance/Directing/Music,
//     это и есть Conservatory of Webster) остаются без цены (gaps).
//   /admissions/graduate/tuition.php — только за кредит-час ($775/кредит на все
//     магистерские программы St. Louis, отдельно $940/кредит для EdD), общего
//     годового/полного тарифа на программу нет нигде. Не пересчитываем
//     кредит-час в год/программу (правило — не выдумывать основу цены), поэтому
//     магистратура/докторантура/сертификаты остаются без цены — тоже gaps.

import { get, text, sleep } from './_lib.mjs';

const BASE = 'https://www.webster.edu';
const UG_LISTING = `${BASE}/academics/undergraduate/majors-minors.php`;
const GRAD_LISTING = `${BASE}/academics/graduate/graduate-programs.php`;
const CERT_LISTING = `${BASE}/academics/certificates/index.php`;
const UG_TUITION_URL = `${BASE}/admissions/undergraduate/tuition.php`;
const GRAD_TUITION_URL = `${BASE}/admissions/graduate/tuition.php`;

const PREFIX_LEVEL = [
  [/^(bs|ba|bfa|bm|bed)-/, 'bachelor'],
  [/^(ms|ma|mba|mha|msn)-/, 'master'],
  [/^edd-/, 'phd'],
  [/^(gcrt|cert|ucrt)-/, 'short-course'],
];

function levelOf(path) {
  const file = path.split('/').pop().replace(/\.php$/, '');
  for (const [re, level] of PREFIX_LEVEL) if (re.test(file)) return level;
  return undefined;
}

function collectLinks(html, re) {
  const urls = new Map(); // path -> true
  for (const m of html.matchAll(re)) urls.set(m[1], true);
  return [...urls.keys()];
}

export default {
  slug: 'webster-university',
  site: 'https://webster.edu',
  async collect({ log }) {
    const gaps = [];
    const fees = [];
    const programs = [];

    let ugHtml, gradHtml, certHtml;
    try {
      ugHtml = get(UG_LISTING);
      await sleep(500);
      gradHtml = get(GRAD_LISTING);
      await sleep(500);
      certHtml = get(CERT_LISTING);
      await sleep(500);
    } catch (e) {
      gaps.push({ why: `каталог программ не открылся: ${e.message}`, url: UG_LISTING });
      return { programs: [], fees: [], gaps };
    }

    const linkRe = /href="(\/[a-z0-9-]+\/(?:bs|ba|bfa|bm|bed|ms|ma|mba|mha|msn|edd|gcrt|cert|ucrt)-[a-z0-9-]*\.php)"/gi;
    const paths = new Set([...collectLinks(ugHtml, linkRe), ...collectLinks(gradHtml, linkRe), ...collectLinks(certHtml, linkRe)]);
    if (!paths.size) {
      gaps.push({ why: 'на страницах-каталогах не нашлось ни одной ссылки на программу', url: UG_LISTING });
      return { programs: [], fees: [], gaps };
    }

    let i = 0;
    for (const path of paths) {
      i += 1;
      const url = `${BASE}${path}`;
      const level = levelOf(path);
      if (!level) {
        gaps.push({ why: `не удалось определить уровень по имени страницы: ${path}`, url });
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
      const titleMatch = html.match(/<title>([^<]*?)\s*\|\s*Webster University/i);
      const title = titleMatch ? text(titleMatch[1]) : path;
      programs.push({ title, level, url });
      if (i % 20 === 0) log(`${i}/${paths.size} страниц программ`);
      await sleep(500);
    }

    // Общий тариф бакалавриата (кроме Conservatory), 2026-2027 учебный год.
    let ugTuitionHtml;
    try {
      ugTuitionHtml = get(UG_TUITION_URL);
    } catch (e) {
      gaps.push({ why: `страница тарифов бакалавриата не открылась: ${e.message}`, url: UG_TUITION_URL });
      ugTuitionHtml = null;
    }
    await sleep(500);

    let flatFee = null;
    if (ugTuitionHtml) {
      const section = ugTuitionHtml.match(/2026-2027 Undergraduate[\s\S]{0,4000}?Part-time undergraduate tuition/);
      const src = section ? section[0] : ugTuitionHtml;
      const m = src.match(/Full-time undergraduate tuition \(except Conservatory\) per academic year[\s\S]{0,300}?\$([\d,]+)\s*flat fee/i);
      if (m) flatFee = { amount: Number(m[1].replace(/,/g, '')), raw: `Full-time undergraduate tuition (except Conservatory) per academic year — $${m[1]} flat fee (2026-2027)` };
    }
    if (!flatFee) {
      gaps.push({ why: 'на странице тарифов бакалавриата не нашлась строка "Full-time undergraduate tuition (except Conservatory)"', url: UG_TUITION_URL });
    } else {
      const nonConservatory = programs.filter((p) => p.level === 'bachelor' && !p.url.includes('/fine-arts/'));
      const conservatory = programs.filter((p) => p.level === 'bachelor' && p.url.includes('/fine-arts/'));
      for (const p of nonConservatory) {
        fees.push({
          title: p.title, level: 'bachelor', amount: flatFee.amount, currency: 'USD', basis: 'year',
          audience: null, scope: 'program', programUrl: p.url, url: UG_TUITION_URL, raw: flatFee.raw,
        });
      }
      for (const p of conservatory) {
        gaps.push({ why: 'программа Leigh Gerdine College of Fine Arts (Conservatory) — тариф выше общего, но страница не даёт разбивку по программам, поэтому цену не берём', url: p.url });
      }
    }

    // Магистратура/докторантура/сертификаты: цена только за кредит-час, полной
    // цены за программу или за год нигде нет — не пересчитываем, оставляем gaps.
    let gradTuitionHtml;
    try {
      gradTuitionHtml = get(GRAD_TUITION_URL);
      if (/per credit hour/i.test(gradTuitionHtml)) {
        log('graduate tuition: подтверждено — только тариф за кредит-час, без общей цены на программу');
      }
    } catch (e) {
      log(`graduate tuition page: ${e.message}`);
    }
    for (const p of programs.filter((p2) => p2.level !== 'bachelor')) {
      gaps.push({ why: 'тариф только за кредит-час (год/полная цена программы не публикуется) — не пересчитываем', url: GRAD_TUITION_URL });
    }

    if (!fees.length) gaps.push({ why: 'ни одна программа не получила цену', url: UG_TUITION_URL });
    return { programs, fees, gaps };
  },
};
