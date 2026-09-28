import { get, text, tableRows, sleep } from './_lib.mjs';

// Разведка 28.09.2026 (csudh.edu, US public CSU campus).
//
// Карточка: 4 программы (Certificate/BA/MS/MA), все со ссылками на общий
// university-catalog / certificate-programs, цен нет.
//
// Что нашлось:
// - https://www.csudh.edu/ceie-intl/intl-student-info/future-students/sample-fees/
//   (ссылка "Tuition & Fees" на странице ceie-intl) отдаёт 404 — мёртвая ссылка,
//   несмотря на то что она есть в навигации сайта.
// - https://www.csudh.edu/financial-aid/cost/ — "How Much Does CSUDH Cost?": таблица
//   "2026-2027 Cost of Attendance" отдельной строкой даёт Tuition (без Campus Fees/
//   Food/Housing/Transportation/Personal — те явно не обучение): Undergraduate $6,838,
//   Credential $7,938, Graduate $8,548 в год. Это БАЗОВАЯ (resident) плата — единая для
//   всех кампусов CSU. Сразу под таблицей текстом: "Non-California resident fee for both
//   graduate and undergraduate students is $420 per unit, in addition to the university
//   fees listed above. Foreign Visa Student fee ... is $420 per unit, in addition to the
///  university fees listed above." — т.е. иностранный студент платит Tuition + $420/unit,
//   набора это page не суммирует и мы тоже не суммируем (правило 1).
// - https://www.csudh.edu/future-students/international/financial-certification —
//   таблица "financial certification": TOTAL $38,292 (undergrad) / $36,562 (grad) —
//   это total cost of attendance ПЕРВОГО года включая Rooms and Meals, Insurance,
//   Transportation, Misc — не обучение, пропуск по правилу (жильё/страховка не едут).
//   В этой же таблице отдельной строкой: "Nonresident Tuition Fee ($396.00 per unit)"
//   $9,504 (undergrad, 24 units/год) / $6,336 (grad, 16 units/год) — это опять только
//   надбавка за нерезидентство/визу за конкретное число юнитов, не полная стоимость
//   обучения, и ставка ($396) не совпадает с текущей 2026-27 ($420) — расходится по годам.
// - Итог: единой цифры "оценочная годовая стоимость обучения для международных студентов"
//   на сайте нет. Отдаём: (а) базовую Tuition по уровням — audience 'domestic' (расчёт
//   валиден только для резидентов CA, поэтому это отчётные строки, в каталог не едут);
//   (б) ставку за юнит для nonresident/foreign-visa — basis 'credit' (тоже отчётные,
//   в каталог их сумма не попадёт); (в) gap с объяснением, почему полной цены для
//   международных студентов нет.

export default {
  slug: 'california-state-university-dominguez-hills',
  site: 'https://www.csudh.edu',
  async collect({ log }) {
    const fees = [];
    const gaps = [];

    // 1) Базовая (resident) Tuition по уровням — financial-aid/cost/, таблица 2026-2027.
    const costUrl = 'https://www.csudh.edu/financial-aid/cost/';
    let costHtml;
    try {
      costHtml = get(costUrl);
    } catch (e) {
      gaps.push({ why: `не удалось загрузить ${costUrl}: ${e.message}`, url: costUrl });
      costHtml = '';
    }
    await sleep(500);

    if (costHtml) {
      const rows = tableRows(costHtml);
      const levelByCol = { UNDERGRADUATE: 'bachelor', CREDENTIAL: 'diploma', GRADUATE: 'master' };
      let header = null;
      const seen = new Set();
      for (const row of rows) {
        if (row.length >= 3 && row.slice(1).some((c) => levelByCol[c])) { header = row; continue; }
        if (header && row[0] === 'Tuition' && row.length === header.length) {
          for (let i = 1; i < header.length; i++) {
            const level = levelByCol[header[i]];
            const amount = Number(String(row[i]).replace(/[^\d.]/g, ''));
            if (!level || !amount || seen.has(level)) continue;
            seen.add(level);
            fees.push({
              amount, currency: 'USD', basis: 'year', audience: 'domestic', scope: 'level', level,
              url: costUrl, raw: `${header.join(' ')} | Tuition ${row.slice(1).join(' ')}`,
            });
          }
        }
      }
      if (!seen.size) gaps.push({ why: 'таблица 2026-2027 Cost of Attendance со строкой Tuition не нашлась (вёрстка могла измениться)', url: costUrl });

      // 2) Надбавка нерезидента/иностранного студента — та же страница, текстом.
      const t = text(costHtml);
      const m = t.match(/Foreign Visa Student fee for both graduate and undergraduate students is \$([\d,.]+) per unit/i);
      if (m) {
        const amount = Number(m[1].replace(/,/g, ''));
        for (const level of ['bachelor', 'master']) {
          fees.push({
            amount, currency: 'USD', basis: 'credit', audience: 'international', scope: 'level', level,
            url: costUrl, raw: m[0],
          });
        }
      } else {
        gaps.push({ why: 'на странице cost/ не нашлась фраза "Foreign Visa Student fee ... per unit" — надбавка для иностранцев не извлечена', url: costUrl });
      }
    }

    // 3) financial-certification — только для report/сверки, сама сумма это cost of
    // attendance (включает жильё/страховку), в fees не идёт, оставляем как gap.
    gaps.push({
      why: 'единой "estimated annual tuition for international students" на сайте нет: '
        + 'Tuition (домашняя, $6,838–$8,548/год) и надбавка Foreign Visa ($420/unit) публикуются '
        + 'раздельно, страница сама их не складывает. Ближайшая опубликованная сумма — '
        + 'financial-certification (TOTAL $38,292 undergrad / $36,562 grad) — это cost of attendance '
        + 'первого года с жильём/питанием/страховкой, не обучение — пропуск по правилу.',
      url: 'https://www.csudh.edu/future-students/international/financial-certification',
    });

    return { programs: [], fees, gaps };
  },
};
