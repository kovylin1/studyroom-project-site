// Этапы проекта на основе раздела "8. Следующие шаги" из inbox/Site.md.
// Статусы: 'done' | 'in_progress' | 'todo'.

window.STUDYROOM_ROADMAP = [
  {
    n: 1,
    title: 'Завести projects/studyroom-project-site/',
    detail: 'Папка проекта, README RU/EN, дашборд, схема и снапшот стека.',
    status: 'in_progress',
  },
  {
    n: 2,
    title: 'Zod-схема University',
    detail: 'Единая форма данных. Сейчас — JS-описание в data/university-schema.js. Потом — TS + Zod.',
    status: 'todo',
  },
  {
    n: 3,
    title: 'MVP Playwright-скрейпера',
    detail: '1 партнёрский универ + 1 агрегатор. Cheerio для статики, Claude API + Firecrawl как fallback.',
    status: 'todo',
  },
  {
    n: 4,
    title: 'Шаблон Astro-лендинга',
    detail: 'Один [slug].astro генерит N статических страниц из data/universities/{slug}.json.',
    status: 'todo',
  },
  {
    n: 5,
    title: 'Decap CMS admin',
    detail: '/admin как UI поверх git. Менеджер правит форму — Decap коммитит сам.',
    status: 'todo',
  },
  {
    n: 6,
    title: 'Прогон на 2–3 универах и масштабирование',
    detail: 'Подтвердить пайплайн на пробной выборке, потом разворачивать на весь портфель.',
    status: 'todo',
  },
  {
    n: 7,
    title: 'GitHub Actions cron — ежемесячный апдейт',
    detail: 'Раз в месяц: скрейп → diff с прошлым JSON → PR → ревью в Decap → merge → автодеплой.',
    status: 'todo',
  },
];
