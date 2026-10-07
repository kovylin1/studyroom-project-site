// cyprus-international-university.mjs — Cyprus International University (ciu.edu.tr).
//
// РАЗВЕДКА 28.09.2026 — ЦЕНЫ НЕДОСТУПНЫ, GAP.
//
// Публичная страница цен:
//   https://www.ciu.edu.tr/en/become-student/international/fees-and-scholarships
// (curl: 200, обычный серверный Drupal-рендер) — но на ней НЕТ ни одной суммы,
// только текст про проценты стипендий («All undergraduate international students
// are granted a 50% tuition fee scholarship», «50%, 75% or 100% scholarships»).
// За конкретной цифрой страница сама отправляет на калькулятор:
//   https://sis.ciu.edu.tr/service/fee-calculator/en
// Это Vue/axios-приложение (проверено — curl отдаёт голый шаблон без чисел, все
// суммы приходят с бэкенда). Разобран инлайновый JS: калькулятор — цепочка
// последовательных POST на /service/fee-calculator/{countries,program-levels,
// faculties,departments,scholarships,currencies}/fetch, и лишь потом POST
// /service/fee-calculator/result — который принимает `fee_program_group_code_id`
// (код программы, отдаётся только предыдущим вызовом departments/fetch и не виден
// нигде в статике) и обязательный `g-recaptcha-response` (Google reCAPTCHA v3,
// see `this.executeRecaptcha()` в коде страницы). Проверено: POST без валидного
// `_token`/сессии на departments/fetch и на result уходит в редирект-луп (curl:
// «Maximum redirects followed», сервер не отдаёт данные анонимному запросу).
//
// Итог: решить капчу и получить код программы без реального браузерного сеанса
// нельзя, а страницы с ценами в открытом виде (PDF, таблица, текст) на сайте нет —
// проверены сайт-мап (пуст) и страницы всех разведанных программ (у каждой вкладка
// «Fees» отправляет на тот же калькулятор, ни цифры). Строк цены нет — честный GAP,
// а не «не нашли с первого раза»: изобретать сумму по правилу 1 нельзя.
//
// СПИСОК ПРОГРАММ (добавлено 29.09.2026). Две сводные страницы дают полный каталог:
//   https://www.ciu.edu.tr/en/programs/undergraduate  — 59 ссылок (включая
//     параллельные варианты одной специальности: «Architecture» и «Architecture
//     (BSc)», «Pharmacy (MPharm)» и «Pharmacy (PharmD)», «Law» и «Law (English)» —
//     каждая ведёт на свою страницу программы, это разные записи, а не дубли);
//   https://www.ciu.edu.tr/en/programs/postgraduate — 66 ссылок, магистратура и
//     докторантура вперемешку.
// Уровень не пришлось угадывать: текст ссылки на этих страницах сам подписан
// хвостом «(Undergraduate)» / «(Master)» / «(PhD)» / «(Professional Doctorate)» —
// сверено с <h1> самих программ (например «Architecture (BSc)», без хвоста
// уровня) — поэтому хвост уровня срезаем, а внутренняя аббревиатура степени
// (BSc/MSc/MA/PhD/MPharm/PharmD/DBA/DHM/MID/MFA/MAF/MArch/MA-LLM) остаётся
// частью названия, как на самой странице программы. «Professional Doctorate»
// (DBA, DBA German, DHM) — по существу докторская степень практика, ближайший
// уровень схемы каталога — phd.
// Карточка (24 «программы») почти целиком мусор старого пересбора: реальных
// совпадений с сайтом по названию мало, «Başvuru Portalı», «Direct», «Direct-Entry
// PhD», «Double Minor / Major Programs», «Pedagogical Formation» — не программы
// (портал заявки, отдельный вступительный трек, зачётный минор, сертификат
// педформации) и уйдут в cardProgramsNotOnSite — это ожидаемо, не недосбор.

import { get, anchors, sleep } from './_lib.mjs';

const UG_URL = 'https://www.ciu.edu.tr/en/programs/undergraduate';
const PG_URL = 'https://www.ciu.edu.tr/en/programs/postgraduate';

function stripLevelTag(title) {
  return title.replace(/\s*\((Undergraduate|Master|PhD|Professional Doctorate)\)\s*$/i, '').trim();
}

export default {
  slug: 'cyprus-international-university',
  site: 'https://www.ciu.edu.tr/',
  async collect({ log }) {
    log('цены за платным JS-калькулятором sis.ciu.edu.tr с обязательной reCAPTCHA — без него ни одной суммы на сайте нет, см. комментарий в начале файла');

    const programs = [];
    for (const [url, defaultLevel] of [[UG_URL, 'bachelor'], [PG_URL, null]]) {
      const html = get(url);
      await sleep(500);
      const seen = new Set();
      for (const a of anchors(html, url)) {
        const m = a.href.match(/\/en\/programs\/(undergraduate|postgraduate)\/([a-z0-9-]+)$/i);
        if (!m || !a.text || seen.has(a.href)) continue;
        seen.add(a.href);
        let level = defaultLevel;
        if (/\(Undergraduate\)/i.test(a.text)) level = 'bachelor';
        else if (/\(Master\)/i.test(a.text)) level = 'master';
        else if (/\(PhD\)/i.test(a.text) || /\(Professional Doctorate\)/i.test(a.text)) level = 'phd';
        if (!level) continue;
        programs.push({ title: stripLevelTag(a.text), level, url: a.href });
      }
    }
    log(`программ на сайте: ${programs.length}`);

    return {
      programs,
      fees: [],
      gaps: [
        {
          why: 'страница fees-and-scholarships называет только проценты стипендий, ни одной суммы в USD/EUR/TRY; сами цифры считает sis.ciu.edu.tr/service/fee-calculator — Vue-приложение за Google reCAPTCHA v3 и CSRF-токеном сессии, без браузера с решённой капчой ни один из его /fetch-эндпоинтов данные не отдаёт (проверено: POST без токена уходит в бесконечный редирект)',
          url: 'https://www.ciu.edu.tr/en/become-student/international/fees-and-scholarships',
        },
        {
          why: 'ни PDF, ни текстового прайс-листа на сайте не нашлось (sitemap.xml пуст, проверены страницы отдельных программ — везде та же вкладка «Fees» со ссылкой на калькулятор)',
          url: 'https://sis.ciu.edu.tr/service/fee-calculator/en',
        },
      ],
    };
  },
};
