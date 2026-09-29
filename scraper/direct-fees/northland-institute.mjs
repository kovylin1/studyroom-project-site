// northland-institute.mjs — The North Land Institute of Training, northlandinstitute.com
//
// Разведка 29.09.2026. Карточка сейчас ошибочно ссылается на northland.edu
// (Northland College, Висконсин, США — маленький ликвидированный колледж) — это
// не тот вуз. Реальный "Northland Institute" каталога StudyRoom — The North Land
// Institute of Training, Дубай, ОАЭ (KHDA-аккредитация, партнёрство с George Brown
// Polytechnic, Канада): northlandinstitute.com. Курл проходит без блоков.
//
// На сайте два раздела с программами:
//   /programs-curriculum/ — 3 программы верхнего уровня, все "Diploma"
//     (Food & Beverage Management / Hospitality & Hotel Operations Management /
//     Tourism & Hospitality Management) — диплом, такого уровня в схеме каталога
//     нет (foundation/bachelor/master/phd/english-language/short-course) -> gaps,
//     не programs. Цены на этих страницах не смотрели — диплом всё равно не едет.
//   /professional-training-programs/ — 4 коротких (4 недели) непрофильных курса
//     с сертификатом KHDA: English for Beginners, International Hospitality
//     Management, Human Resources Management, Cybersecurity Analyst. Это не
//     диплом/степень, а короткий курс — level: short-course (тот же класс, что
//     BSBI /certificate-programmes/ и Wollongong Dubai /short-courses/*, где
//     решение владельца уже относило такие Graduate/KHDA Certificate к
//     short-course, а не в gaps). У каждой — своя явная строка "Fees: AED N".
//     Разбивки на local/international нет (сайт цену не различает по гражданству,
//     это дубайский частный вуз для всех студентов одинаково) — audience: null.
//     basis: 'program' — сумма за весь 4-недельный курс целиком, не за неделю/
//     кредит.
//   Единой страницы со сводным прайс-листом или отдельных URL на каждую из 4
//   программ нет — все 4 описаны на одной странице /professional-training-
//   programs/, оттуда и programUrl/url.

import { get, sleep } from './_lib.mjs';

const BASE = 'https://northlandinstitute.com';
const DIPLOMA_URL = `${BASE}/programs-curriculum/`;
const TRAINING_URL = `${BASE}/professional-training-programs/`;

export default {
  slug: 'northland-institute',
  site: 'https://northlandinstitute.com',
  async collect({ log }) {
    const gaps = [];
    const fees = [];
    const programs = [];

    let diplomaHtml;
    try {
      diplomaHtml = get(DIPLOMA_URL);
    } catch (e) {
      gaps.push({ why: `страница дипломных программ не открылась: ${e.message}`, url: DIPLOMA_URL });
      diplomaHtml = '';
    }
    await sleep(500);

    const diplomaLinks = [...diplomaHtml.matchAll(/href="(https:\/\/northlandinstitute\.com\/programs-curriculum\/[a-z0-9-]+\/)"/gi)]
      .map((m) => m[1]);
    const seenDiploma = new Set();
    for (const url of diplomaLinks) {
      if (seenDiploma.has(url)) continue;
      seenDiploma.add(url);
      gaps.push({ why: 'программа уровня Diploma — нет такого уровня в схеме каталога', url });
    }
    if (!seenDiploma.size) {
      gaps.push({ why: 'на /programs-curriculum/ не нашлось ни одной ссылки на программу', url: DIPLOMA_URL });
    } else {
      log(`${seenDiploma.size} дипломных программ -> gaps (нет уровня diploma в схеме)`);
    }

    let trainingHtml;
    try {
      trainingHtml = get(TRAINING_URL);
    } catch (e) {
      gaps.push({ why: `страница профессиональных курсов не открылась: ${e.message}`, url: TRAINING_URL });
      trainingHtml = '';
    }
    await sleep(500);

    const chunks = trainingHtml.split('<div class="action action_contain action_style-one">');
    for (let i = 1; i < chunks.length; i += 1) {
      const c = chunks[i];
      const titleMatch = c.match(/action__title[^>]*>([\s\S]*?)<\/h3>/);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : null;
      if (!title) continue;
      programs.push({ title, level: 'short-course', url: TRAINING_URL });

      const feeMatch = c.match(/Fees:[\s\S]{0,200}?AED\s*([\d,]+)/);
      if (!feeMatch) {
        gaps.push({ why: `у программы "${title}" не нашлась строка "Fees: AED …"`, url: TRAINING_URL });
        continue;
      }
      const amount = Number(feeMatch[1].replace(/,/g, ''));
      if (!amount) continue;
      fees.push({
        title, level: 'short-course', amount, currency: 'AED', basis: 'program',
        audience: null, scope: 'program', programUrl: TRAINING_URL, url: TRAINING_URL,
        raw: `${title} — Fees: AED ${feeMatch[1]}`,
      });
    }

    if (!programs.length) gaps.push({ why: 'на /professional-training-programs/ не нашлось ни одной программы', url: TRAINING_URL });
    if (!fees.length && programs.length) gaps.push({ why: 'программы short-course нашлись, но ни одна цена не распозналась', url: TRAINING_URL });

    return { programs, fees, gaps };
  },
};
