import { get, getBrowser, sleep } from './_lib.mjs';

// Разведка 28.09.2026, продолжена и расширена 29.09.2026 (gedu.global).
//
// Карточка: 8 программ (International Business, Accounting & Financial Management,
// Marketing, Bachelor en Management Appliqué, Sustainable Maritime Operations,
// Screen & Stage, IT Extended Diploma, Digital Marketing Essentials), у всех
// programUrl = gedu.global/course-listing-page/.
//
// 28.09.2026: gedu.global сам по себе — не сайт учебного заведения, а корпоративный
// сайт группы GEDU (Global Education Group), холдинга из нескольких разных учебных
// брендов. /course-listing-page/ (ссылка programUrl всех 8 программ карточки) —
// 404 и через curl, и через getBrowser (подтверждено заново). Ни одной страницы
// курса/программы и ни одной цифры цены на самом домене gedu.global нет.
//
// 29.09.2026, по прямому поручению: «проверить, публикуют ли перечисленные бренды
// программы карточки» (владелец, задача на доборы цен). /our-portfolio отдаёт
// список брендов-ссылок: globalbanking.ac.uk (Global Banking School, Великобритания),
// gbs.edu.mt (GBS Мальта), schiller.edu (Schiller International University, США/
// Европа), mla.ac.uk (Maritime & Logistics Academy — так у них полностью, не
// расшифровано на сайте), icn-artem.com (ICN Business School, Франция), apac.edu.au
// (Australian Performing Arts College), englishpath.com, globalu.com, metagedu.io,
// lokmani.com — это отдельные аккредитованные учебные заведения со своими доменами,
// не gedu.global. По каждой из 8 программ карточки штучно проверено, публикует ли
// её (или близкий эквивалент) какой-то из брендов:
//
//   Bachelor of Science in International Business -> schiller.edu, страница
//     /programs/bachelor-of-science-in-international-business/ — точное совпадение
//     названия. Таблица тарифов по кампусам (basis: year): European Campuses
//     €15,420/yr, Tampa $17,610/yr, Distance Learning $8,850/yr. Взята полная цена
//     ("Tuition Fee*"), не колонка "With Max. Scholarship" (скидка).
//   BSc (Hons) Accounting & Financial Management -> globalbanking.ac.uk, страница
//     /courses/bsc-hons-accounting-and-financial-management/ — точное совпадение
//     названия (то же название и в JSON-LD schema.org на странице, Awarding
//     Institution: Canterbury Christ Church University). "Fees: Foundation Year
//     £5,760 Years 1 to 3: £9,535 per year" — берём основную ставку £9,535/год
//     (год 1–3), Foundation Year — это отдельная более дешёвая подготовительная
//     ступень другой программы, не берём, чтобы не смешать разные программы.
//   MA Marketing and Brand Management -> ближайшее реальное на icn-artem.com —
//     "MSc Brand and Marketing Management" (/formation/msc-brand-and-marketing-
//     management/): степень названа MSc, не MA, и порядок слов другой — берём
//     программу как называет сам сайт (MSc Brand and Marketing Management), не
//     título карточки: раздел «Coûts de formation… coût annuel» даёт 1re année —
//     13 000 €, 2e année — 13 000 € (basis: year, EUR).
//   Bachelor en Management Appliqué -> ближайшее реальное на icn-artem.com —
//     "Bachelor en Management" (/formation/bachelor-en-management/, без
//     «Appliqué» — так называет сам сайт): «Découvrez le coût par année» — 1ère
//     année 9 000 €, 2ème année 9 000 €, 3ème année 8 900 € (basis: year, EUR).
//   Sustainable Maritime Operations Access Course -> ближайшее реальное на
//     mla.ac.uk — "BSc (Hons) Sustainable Maritime Operations"
//     (/programmes/degrees/bsc-hons-sustainable-maritime-operations/, без
//     «Access Course» — страницы именно с таким названием на сайте нет, только
//     прямой BSc). Карточка сводки "Cost £9,535 / Duration 18 months" без пометки
//     "per year" или "total" — единственное число на странице, берём как
//     basis: 'program' (буквально то, что написано, без досчёта).
//   Bachelor of Screen & Stage -> на apac.edu.au нашлись ДВЕ разные программы
//     (Bachelor of Screen and Stage: Acting; Bachelor of Screen and Stage: Screen
//     Production), ни у одной нет собственной страницы ровно с названием карточки,
//     и ни на одной странице не нашлось цифры цены — остаётся в gaps
//     (неоднозначно, какая из двух, и цены всё равно нет).
//   International Extended Diploma in IT (Level 3) -> диплом, такого уровня нет
//     в схеме каталога — gaps независимо от того, нашёлся бы бренд-первоисточник.
//   Digital Marketing Essentials Certificate -> ни на одном из проверенных
//     доменов группы (включая отдельный short-course сайт globalbankingtraining.com)
//     программы с таким или близким названием не нашлось — gaps.
//
// Это НЕ полный каталог всех программ группы GEDU (это было бы уже за пределами
// одной карточки — каждый из этих брендов свой отдельный вуз/колледж с собственным
// полным списком программ, не в этой задаче): здесь только точечно закрыты 8
// программ конкретно этой карточки.

const BRAND_SOURCES = [
  {
    title: 'Bachelor of Science in International Business', level: 'bachelor',
    url: 'https://www.schiller.edu/programs/bachelor-of-science-in-international-business/',
  },
  {
    title: 'BSc (Hons) Accounting & Financial Management', level: 'bachelor',
    url: 'https://globalbanking.ac.uk/courses/bsc-hons-accounting-and-financial-management/',
  },
  {
    title: 'MSc Brand and Marketing Management', level: 'master',
    url: 'https://www.icn-artem.com/formation/msc-brand-and-marketing-management/',
  },
  {
    title: 'Bachelor en Management', level: 'bachelor',
    url: 'https://www.icn-artem.com/formation/bachelor-en-management/',
  },
  {
    title: 'BSc (Hons) Sustainable Maritime Operations', level: 'bachelor',
    url: 'https://www.mla.ac.uk/programmes/degrees/bsc-hons-sustainable-maritime-operations/',
  },
];

export default {
  slug: 'gedu-global-education',
  site: 'https://gedu.global',
  async collect({ log }) {
    const gaps = [];
    const fees = [];
    const programs = [];

    // Подтверждаем заново (28.09.2026), что сам gedu.global всё ещё без программ/цен.
    try {
      get('https://gedu.global/course-listing-page/');
      log('gedu.global/course-listing-page/: неожиданно ответил без ошибки');
    } catch (e) {
      log(`gedu.global/course-listing-page/ по-прежнему недоступен: ${e.message.split('\n')[0]}`);
    }
    await sleep(500);
    gaps.push({
      why: 'gedu.global — корпоративный сайт группы-холдинга GEDU, не сайт вуза: '
        + 'страниц курсов/программ и цен на самом домене нет (/course-listing-page/ — 404).',
      url: 'https://gedu.global/course-listing-page/',
    });

    for (const src of BRAND_SOURCES) {
      let html;
      try {
        html = get(src.url);
      } catch (e) {
        gaps.push({ why: `страница бренда не открылась: ${e.message}`, url: src.url });
        await sleep(500);
        continue;
      }
      programs.push({ title: src.title, level: src.level, url: src.url });

      if (src.title === 'Bachelor of Science in International Business') {
        const rows = [
          { re: /European Campuses<\/td>\s*<td>€([\d,]+)\/yr/, currency: 'EUR', label: 'European Campuses' },
          { re: /Tampa<\/td>\s*<td>\$([\d,]+)\/yr/, currency: 'USD', label: 'Tampa' },
          { re: /Distance Learning<\/td>\s*<td>\$([\d,]+)\/yr/, currency: 'USD', label: 'Distance Learning' },
        ];
        for (const r of rows) {
          const m = html.match(r.re);
          if (!m) continue;
          const amount = Number(m[1].replace(/,/g, ''));
          fees.push({
            title: src.title, level: src.level, amount, currency: r.currency, basis: 'year',
            audience: null, scope: 'program', programUrl: src.url, url: src.url,
            raw: `${r.label}: ${m[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}`,
          });
        }
      } else if (src.title === 'BSc (Hons) Accounting & Financial Management') {
        const m = html.match(/Years 1 to 3:\s*£([\d,]+)\s*per year/);
        if (m) {
          const amount = Number(m[1].replace(/,/g, ''));
          fees.push({
            title: src.title, level: src.level, amount, currency: 'GBP', basis: 'year',
            audience: null, scope: 'program', programUrl: src.url, url: src.url,
            raw: `Years 1 to 3: £${m[1]} per year`,
          });
        }
      } else if (src.title === 'MSc Brand and Marketing Management') {
        for (const re of [/1re année\s*[–-]\s*([\d ]+)\s*€/, /2e année\s*[–-]\s*([\d ]+)\s*€/]) {
          const m = html.match(re);
          if (!m) continue;
          const amount = Number(m[1].replace(/\s+/g, ''));
          if (!amount) continue;
          fees.push({
            title: src.title, level: src.level, amount, currency: 'EUR', basis: 'year',
            audience: null, scope: 'program', programUrl: src.url, url: src.url,
            raw: m[0],
          });
        }
      } else if (src.title === 'Bachelor en Management') {
        for (const re of [/1ère année\s*[–-]\s*([\d ]+)\s*€/, /2ème année\s*[–-]\s*([\d ]+)\s*€/, /3ème année\s*[–-]\s*([\d ]+)\s*€/]) {
          const m = html.match(re);
          if (!m) continue;
          const amount = Number(m[1].replace(/\s+/g, ''));
          if (!amount) continue;
          fees.push({
            title: src.title, level: src.level, amount, currency: 'EUR', basis: 'year',
            audience: null, scope: 'program', programUrl: src.url, url: src.url,
            raw: m[0],
          });
        }
      } else if (src.title === 'BSc (Hons) Sustainable Maritime Operations') {
        const m = html.match(/key-programme-info__cost[\s\S]{0,120}?£([\d,]+)/);
        if (m) {
          const amount = Number(m[1].replace(/,/g, ''));
          fees.push({
            title: src.title, level: src.level, amount, currency: 'GBP', basis: 'program',
            audience: null, scope: 'program', programUrl: src.url, url: src.url,
            raw: `Cost £${m[1]}`,
          });
        }
      }
      await sleep(500);
    }

    gaps.push({ why: 'Bachelor of Screen & Stage — на apac.edu.au две разные программы (Acting / Screen Production), ни одна не совпадает названием ровно, и ни на одной нет цены', url: 'https://apac.edu.au/courses/' });
    gaps.push({ why: 'International Extended Diploma in IT (Level 3) — диплом, уровня diploma нет в схеме каталога', url: 'https://gedu.global/course-listing-page/' });
    gaps.push({ why: 'Digital Marketing Essentials Certificate — ни на одном проверенном бренд-домене группы (включая globalbankingtraining.com) программа не нашлась', url: 'https://gedu.global/course-listing-page/' });

    return { programs, fees, gaps };
  },
};
