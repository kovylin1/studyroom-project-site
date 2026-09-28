import { get, getBrowser, sleep } from './_lib.mjs';

// Разведка 28.09.2026 (gedu.global).
//
// Карточка: 8 программ (несколько институтов группы GEDU — International Business,
// Accounting & Financial Management, Marketing, Bachelor en Management Appliqué,
// Sustainable Maritime Operations, Screen & Stage, IT Extended Diploma, Digital
// Marketing Essentials), все со ссылкой на programUrl = gedu.global/course-listing-page/.
//
// Что нашлось: gedu.global — не сайт учебного заведения, а корпоративный сайт группы
// ("Global Education Group" / GEDU) — холдинга, которому принадлежит несколько разных
// учебных брендов (в т.ч. Global Banking School — globalbanking.ac.uk, судя по ссылке
// с главной). У самого gedu.global (проверено и curl, и getBrowser/Playwright —
// сайт на React/Next, серверный HTML почти пуст, но рендер браузером подтверждает
// то же самое) есть только: Home, Our Portfolio, About Us, News, Impact (PDF), Contact
// Us — ни одной страницы курса/программы, ни одной цифры цены.
// - /course-listing-page/ (ссылка из programUrl всех 8 программ карточки) — 404 и
//   через curl, и через getBrowser (страница-заглушка "404: This page could not be
//   found" — значит маршрут не существует на сервере, не проблема клиентского роутинга).
// - /our-portfolio — тоже без текстового содержимого (только shell-разметка, судя по
//   всему логотипы-картинки без alt/подписей).
// - Старые проиндексированные Google страницы конкретных стран (studying-in-spain/,
//   studying-in-malta/ и т.п.) — тоже 404, сайт был переделан.
// - /student-referral-scheme/ (200, единственная содержательная страница с деньгами) —
//   про реферальную программу (£500 ваучер за привлечённого студента), не про tuition.
// Итог: цены за обучение по программам не публикуются на gedu.global вообще — это
// маркетинговый сайт холдинга, а не сайт конкретного вуза. Публикация цен, если она
// есть, идёт на сайтах конкретных институтов группы (другой домен, не gedu.global) —
// вне области этого парсера.

export default {
  slug: 'gedu-global-education',
  site: 'https://gedu.global',
  async collect({ log }) {
    const gaps = [];
    const checks = [
      { url: 'https://gedu.global/course-listing-page/', via: 'curl' },
      { url: 'https://gedu.global/our-portfolio', via: 'curl' },
    ];
    for (const c of checks) {
      try {
        get(c.url);
      } catch (e) {
        log(`${c.url}: ${e.message}`);
      }
      await sleep(500);
    }
    // Подтверждаем браузером, что /course-listing-page/ — настоящий 404 (не клиентский роутинг SPA).
    try {
      const html = await getBrowser('https://gedu.global/course-listing-page/', { waitMs: 3000 });
      if (/404/.test(html)) log('course-listing-page: подтверждён 404 и в браузерном рендере');
    } catch (e) {
      log(`getBrowser course-listing-page: ${e.message}`);
    }

    gaps.push({
      why: 'gedu.global — корпоративный сайт группы GEDU (холдинг из нескольких учебных брендов), '
        + 'не сайт вуза: страниц курсов/программ нет, /course-listing-page/ (ссылка programUrl всех '
        + '8 программ карточки) отдаёт 404 и через curl, и через getBrowser. Цены за обучение по '
        + 'программам на этом домене не публикуются нигде.',
      url: 'https://gedu.global/course-listing-page/',
    });

    return { programs: [], fees: [], gaps };
  },
};
