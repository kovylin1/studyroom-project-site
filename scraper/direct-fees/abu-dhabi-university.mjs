// abu-dhabi-university.mjs — Abu Dhabi University, adu.ac.ae
//
// Разведка 29.09.2026. Весь домен (www.adu.ac.ae и adu.ac.ae, любой путь — включая
// главную страницу) закрыт Imperva/Incapsula: `get()` (curl) получает служебную
// HTML-заглушку ~850 байт с `_Incapsula_Resource` и incident_id, `getBrowser()`
// (headless Chromium через Playwright, ожидание до 4с) получает ту же заглушку —
// похоже на фингерпринтинг автоматизации (navigator.webdriver и т.п.), а не на
// решаемый по времени JS-челлендж.
// Обходные пути тоже не сработали:
//   - Wayback Machine отдаёт снимок страницы https://www.adu.ac.ae/study/programs/program-finder
//     от 25.09.2026 — это SPA-заглушка, сама Incapsula-обёртка, без содержимого
//     (краулер архива тоже был заблокирован в момент снятия снимка).
//   - CDX-поиск archive.org по adu.ac.ae/study/programs* не находит вообще ни одной
//     сохранённой страницы этого раздела (только древние URL вида acad_programs_*.html
//     с домена без www — не тот сайт, актуальная структура другая).
//   - Reader-прокси r.jina.ai сам упирается в свой Cloudflare-челлендж на этом URL.
// Итог: ни один доступный транспорт не даёт содержимое сайта. Список программ и цены
// взять неоткуда без нарушения «ничего не выдумывать» — весь охват идёт в gaps.
// Карточка (site/src/content/universities/abu-dhabi-university.json) уже содержит
// 111 записей разного качества (часть — явный мусор вида «Bachelor (33) UG(33)»,
// «MasterProject Management» — слипшиеся строки из старого скрейпа), но перепроверить
// их по сайту сейчас нечем.

export default {
  slug: 'abu-dhabi-university',
  site: 'https://www.adu.ac.ae',
  async collect({ log }) {
    log('домен закрыт Incapsula для curl и headless-браузера (см. комментарий вверху файла) — сбор невозможен');
    return {
      programs: [],
      fees: [],
      gaps: [{
        why: 'весь сайт (adu.ac.ae, www.adu.ac.ae) отдаёт Incapsula-заглушку и через curl, и через headless Playwright; Wayback и reader-прокси не помогли — контент недоступен ни одним доступным способом',
        url: 'https://www.adu.ac.ae/study/programs/program-finder',
      }],
    };
  },
};
