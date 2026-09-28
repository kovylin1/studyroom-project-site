import { get, text, sleep } from './_lib.mjs';

// Разведка 28.09.2026 (lanecollege.edu, Jackson, Tennessee — частный HBCU-колледж).
//
// Карточка: 20 программ, все level: 'bachelor', ссылки на общий
// academics/associate-degrees (агрегированная страница, не по-программно) — цен нет.
//
// Что нашлось:
// - https://lanecollege.edu/financial-aid-tuition/college-costs — "TUITION AND FEES
//   ACADEMIC YEAR 2025-26": единая для всех Total Tuition (12-16 hours) $5,099.00 (Fall)
//   + $5,099.00 (Spring) = $10,198.00 (Total) — совпадает и в блоке RESIDENTIAL STUDENTS,
//   и в блоке NON-RESIDENTIAL STUDENTS (разница между блоками — только Housing/Meal Plan
//   vs Commuter Fees, к обучению отношения не имеющие). "Resident/Non-Resident" здесь —
//   про общежитие (дневная форма vs приходящие), а не про гражданство/штат — частный
//   колледж, единая цена tuition для всех.
// - https://lanecollege.edu/admissions/international-students — про визовый процесс
//   (I-20, SEVIS), сумм нет; сказано лишь "students will be required to cover fees of
//   one year of tuition before issuing a Form I-20" — то есть та же единая цена.
//   Итого: audience не различается сайтом → null.
// - Подпись на College Costs не называет уровень словом "undergraduate" буквально, но
//   Lane College — исключительно бакалаврский HBCU (About: "deeply transformative
//   undergraduate education"), выпускных программ на сайте нет вовсе. Здесь это не
//   расчёт цены, а атрибуция единственно возможного уровня — риска перепутать с
//   графической ценой нет, т.к. другого уровня у колледжа не существует.
// - Прочие суммы на странице (Text Book Fee, Matriculation, Technology, Student Activity,
//   Housing, Meal Plan, Health Service, Commuter Fees, Parking, Graduation Fee и т.д.) —
//   не обучение, пропущены по правилу.

export default {
  slug: 'lane-college',
  site: 'https://lanecollege.edu',
  async collect({ log }) {
    const fees = [];
    const gaps = [];
    const url = 'https://lanecollege.edu/financial-aid-tuition/college-costs';
    let html;
    try {
      html = get(url);
    } catch (e) {
      gaps.push({ why: `не удалось загрузить ${url}: ${e.message}`, url });
      return { programs: [], fees, gaps };
    }
    await sleep(500);

    const t = text(html);
    const m = t.match(/Total Tuition \(12-16 hours\) \$[\d,.]+\.\d\d \$[\d,.]+\.\d\d \$([\d,.]+)\.\d\d/);
    if (m) {
      const amount = Number(m[1].replace(/,/g, ''));
      fees.push({
        amount, currency: 'USD', basis: 'year', audience: null, scope: 'level', level: 'bachelor',
        url, raw: m[0],
      });
    } else {
      gaps.push({ why: 'на странице college-costs не нашлась строка "Total Tuition (12-16 hours)" — вёрстка могла измениться', url });
    }

    return { programs: [], fees, gaps };
  },
};
