import { get, text, anchors, sleep } from './_lib.mjs';

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
//
// СПИСОК ПРОГРАММ (добавлено 29.09.2026). Три страницы отделений (academics/departments/
// business-social-and-behavioral-science, liberal-studies-and-education,
// natural-and-physical-science) — их даёт academics/departments — каждая перечисляет
// свои специальности карточками «Read more» без текста названия в самой ссылке, но
// адрес каждой (…/<department>/<major>) и есть страница программы (<title>Lane
// College | <Название></title> подтверждает: department = program). Название беру
// человекочитаемым из слага (business → Business, criminal-justice → Criminal
// Justice) — сверено с уже заведёнными 17 программами карточки, совпадает
// побуквенно. Итого 19 специальностей одним уровнем (bachelor, других на сайте
// нет вовсе — см. выше): 4 (business/criminal-justice/history/sociology) + 10
// (art/english/french/interdisciplinary-studies/mass-communication/music/
// physical-education/religion/spanish/teacher-education) + 5 (biology/chemistry/
// computer-science/mathematics/physics). «Art» и «Spanish» на сайте есть, в
// карточке — нет; «BA Concentration Requirements», «Bachelor's Degrees»,
// «Bachelor's of Science» карточки — не программы (служебные страницы из
// прежнего пересбора), с сайта не переподтверждаются. Отдельно: «Teacher
// Education» карточками отделения liberal-studies-and-education не выводится
// (там 9 «Read more», не 10), но собственная страница у неё есть (…/liberal-
// studies-and-education/teacher-education, curl: 200, видна в меню сайта) —
// добавлена вручную, это прямая проверка URL, не догадка.

const DEPT_GROUPS = [
  'business-social-and-behavioral-science',
  'liberal-studies-and-education',
  'natural-and-physical-science',
];
const EXTRA_PROGRAMS = [
  { title: 'Teacher Education', level: 'bachelor', url: 'https://lanecollege.edu/academics/departments/liberal-studies-and-education/teacher-education' },
];
const titleCase = (slug) => slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

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

    // Список программ — обход трёх отделений.
    const programs = [];
    for (const dept of DEPT_GROUPS) {
      const deptUrl = `https://lanecollege.edu/academics/departments/${dept}`;
      let deptHtml;
      try { deptHtml = get(deptUrl); } catch (e) { gaps.push({ why: `не удалось загрузить отделение ${dept}: ${e.message}`, url: deptUrl }); continue; }
      await sleep(500);
      const seen = new Set();
      for (const a of anchors(deptHtml, deptUrl)) {
        if (!a.href.startsWith(`${deptUrl}/`) || a.href === deptUrl) continue;
        const slug = a.href.split('/').filter(Boolean).pop();
        if (seen.has(slug)) continue;
        seen.add(slug);
        programs.push({ title: titleCase(slug), level: 'bachelor', url: a.href });
      }
    }
    for (const p of EXTRA_PROGRAMS) if (!programs.some((q) => q.url === p.url)) programs.push(p);
    log(`программ на сайте: ${programs.length}`);

    return { programs, fees, gaps };
  },
};
