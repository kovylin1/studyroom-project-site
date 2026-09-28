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

export default {
  slug: 'cyprus-international-university',
  site: 'https://www.ciu.edu.tr/',
  async collect({ log }) {
    log('цены за платным JS-калькулятором sis.ciu.edu.tr с обязательной reCAPTCHA — без него ни одной суммы на сайте нет, см. комментарий в начале файла');
    return {
      programs: [],
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
