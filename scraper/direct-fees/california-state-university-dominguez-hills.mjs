import { get, text, anchors, tableRows, sleep } from './_lib.mjs';

// Разведка 28.09.2026 (csudh.edu, US public CSU campus).
//
// Карточка: 4 программы (Certificate/BA/MS/MA), все со ссылками на общий
// university-catalog / certificate-programs, цен нет.
//
// СПИСОК ПРОГРАММ (добавлено 29.09.2026). Бакалавриат — со страниц пяти колледжей
// («Explore» → «Majors and Programs», по одной на колледж):
//   /future-students/explore/majors-and-programs/{cah,cbapp,chhsn,cnbs,coe}
// Каждая — аккордеон `<div class="accTitle">Название B.A./B.S.: Специализация</div>`.
// Специализации внутри одной программы («Business Administration B.S.: Accounting»,
// «…: Finance», «…: Marketing» — 12 штук) ведут на ОДНУ и ту же страницу отдела
// (`/business-administration/`) — своей страницы у специализации нет, поэтому по
// правилу README они не отдельные программы: берём название до двоеточия один раз
// («Business Administration», B.S.), специализации — не заводим построчно. Так
// вышло 48 уникальных бакалаврских программ (34+20+16+28+1 строка аккордеона
// схлопнулись по base-названию). Ссылку берём из первого найденного «Learn more»
// внутри аккордеона; у части программ (Art, Audio Engineering, Dance, Design,
// Film and Television Production, Journalism, Behavioral Science, Chemistry,
// Earth Science, Organizational Leadership Studies) ссылки на сайте нет вовсе —
// url не отдаём.
// Магистратура — сводная страница /gsr/graduate-studies/ (Graduate Studies &
// Research): в её HTML — прямые ссылки вида «MS …»/«MA …»/«Occupational Therapy
// Doctorate» на 21 магистерскую программу (Accounting, Biology, Computer Science,
// Cyber Security, Counseling, Education, English, Environmental Science, Health
// Science — Orthotics and Prosthetics, Marital Family and Therapy, Negotiation
// Conflict Resolution and Peacebuilding, Nursing, Occupational Therapy,
// Psychology, Quality Assurance, School Leadership, Sociology, Systems
// Engineering, Special Education, Radiology and Imaging Sciences, TESOL) и одну
// докторскую (Occupational Therapy Doctorate — профессиональная докторская
// степень последипломного уровня, ближайший уровень схемы каталога — phd).
// Проверено выборочно: две программы карточки («MA Humanities», «MS Criminal
// Justice Administration») на этой витрине не значатся, но страницы у них на
// сайте есть (csudh.edu/humanities/, csudh.edu/criminal-justice-administration/,
// 200) — единого открытого реестра ВСЕХ магистратур по ВСЕМ департаментам на
// сайте нет (только PDF university-catalog), эта витрина — самый полный
// доступный список, но не исчерпывающий; гэп об этом ниже.
//
// Что нашлось (цены):
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

    // Список программ.
    const programs = [];
    const COLLEGES = ['cah', 'cbapp', 'chhsn', 'cnbs', 'coe'];
    const seen = new Map(); // title||level -> program (для схлопывания специализаций)
    for (const c of COLLEGES) {
      const url = `https://www.csudh.edu/future-students/explore/majors-and-programs/${c}`;
      let html;
      try { html = get(url); } catch (e) { gaps.push({ why: `не удалось загрузить колледж ${c}: ${e.message}`, url }); continue; }
      await sleep(500);
      const re = /<div class="accTitle"[^>]*>([\s\S]*?)<\/div><div class="accContent">([\s\S]*?)<\/div><\/div>/g;
      for (const m of html.matchAll(re)) {
        const rawTitle = text(m[1]);
        const degM = rawTitle.match(/(?:^|\s)(B\.A\.|B\.S\.|B\.F\.A\.|B\.M\.)(?=\s|:|$)/);
        if (!degM) continue; // не бакалаврская строка (не встречалось, но на всякий случай).
        const level = 'bachelor';
        const baseTitle = rawTitle.split(':')[0].replace(degM[0], '').trim();
        const key = `${baseTitle}||${level}`;
        if (seen.has(key)) continue;
        const linkm = m[2].match(/href="([^"#]+)"/);
        const progUrl = linkm ? (linkm[1].startsWith('http') ? linkm[1] : `https://www.csudh.edu${linkm[1]}`) : undefined;
        const p = { title: baseTitle, level, ...(progUrl ? { url: progUrl } : {}) };
        seen.set(key, p);
        programs.push(p);
      }
    }
    log(`бакалавриат на сайте: ${programs.length} (5 колледжей)`);

    // Магистратура — витрина /gsr/graduate-studies/.
    const gsrUrl = 'https://www.csudh.edu/gsr/graduate-studies/';
    try {
      const gsrHtml = get(gsrUrl);
      await sleep(500);
      let gradCount = 0;
      for (const a of anchors(gsrHtml, gsrUrl)) {
        const t = a.text.trim();
        if (!t || !/^(MS|MA|MSN|MFA|MBA|MEd|MPA)\s+/.test(t) && !/Doctorate/i.test(t)) continue;
        const level = /Doctorate/i.test(t) ? 'phd' : 'master';
        programs.push({ title: t, level, url: a.href });
        gradCount++;
      }
      log(`магистратура/докторантура на витрине gsr: ${gradCount}`);
      gaps.push({ why: '/gsr/graduate-studies/ — самая полная доступная витрина (21 магистерская программа + Occupational Therapy Doctorate), но не гарантированно полный список всех магистратур по всем департаментам (единого открытого реестра на сайте нет, только PDF university-catalog); минимум 2 программы карточки («MA Humanities», «MS Criminal Justice Administration») существуют на сайте отдельными страницами, но на этой витрине не перечислены', url: gsrUrl });
    } catch (e) {
      gaps.push({ why: `не удалось загрузить ${gsrUrl}: ${e.message}`, url: gsrUrl });
    }

    return { programs, fees, gaps };
  },
};
