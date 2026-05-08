// Снапшот стека и пайплайна из inbox/Site.md.
// Используется на дашборде, чтобы держать общую картину перед глазами.

window.STUDYROOM_ARCHITECTURE = {
  layers: [
    {
      title: 'Сбор данных',
      cadence: 'раз в месяц по cron',
      tools: [
        'Playwright (TypeScript) — JS-тяжёлые сайты-агрегаторы',
        'Cheerio / got-scraping — статика официальных сайтов',
        'Claude API (vision + HTML) — извлечение в схему по Zod',
        'Firecrawl MCP — fallback (рендерит JS, отдаёт markdown)',
      ],
    },
    {
      title: 'Нормализация',
      cadence: 'после каждого скрейпа',
      tools: [
        'Единая Zod-схема University',
        'Файл на универ — data/universities/{slug}.json в git',
      ],
    },
    {
      title: 'Лендинги',
      cadence: 'каждый push в main',
      tools: [
        'Astro — один шаблон [slug].astro',
        'N статических страниц из JSON',
        'SEO из коробки, < 100 KB',
      ],
    },
    {
      title: 'Хостинг',
      cadence: 'постоянно',
      tools: [
        'Cloudflare Pages — бесплатно, безлимитный трафик',
        'CDN ближе к СНГ',
        'HTTPS и домен в один клик',
      ],
    },
    {
      title: 'Админка',
      cadence: 'по требованию',
      tools: [
        'Decap CMS на /admin — бесплатно',
        'Коммитит правки прямо в git',
        'Сборка обновляется за 30–60 сек',
      ],
    },
    {
      title: 'Месячный апдейт',
      cadence: 'GitHub Actions cron',
      tools: [
        'Скрейп → diff с прошлым JSON',
        'Создаётся PR с изменениями (цена, дедлайн, отмена программы)',
        'Менеджер ревьюит в Decap UI',
        'Approve → merge → автодеплой',
        'Опционально: changelog в Telegram-бот StudyRoom',
      ],
    },
  ],

  pipeline: [
    'Cron 1 раз в месяц',
    'Playwright + Claude скрейпят сайты универов и агрегаторов',
    'data/oxford.json обновлён',
    'git PR — менеджер видит "цена изменилась 25k → 26k", апрувит в Decap UI',
    'git push на main',
    'Cloudflare Pages собирает Astro и раздаёт миру',
    'studyroom.kz/oxford — новая цена живая через 60 сек',
  ],

  rejected: [
    {
      name: 'Тильда',
      reasons: [
        'API под импорт каталога, не под массовую генерацию лендингов',
        'Лимит 500 страниц, $20+/мес',
        'Нет diff "что поменял ИИ" — нечего ревьюить',
        'Сильный lock-in',
      ],
    },
    {
      name: 'Webflow',
      reasons: [
        'Дорогой API, $30+/мес',
        'Тот же lock-in и отсутствие diff',
      ],
    },
    {
      name: 'WordPress',
      reasons: [
        'Лишние слои: БД, плагины, редактор, который никто не использует',
        'Медленный TTFB',
        'Сложнее программно создавать/обновлять страницы',
        'Удобен только если правят люди — а у нас всё делает ИИ',
      ],
    },
  ],

  tradeoff:
    'Astro + Decap — быстрее, дешевле, лучше для SEO, проще автоматизируется. Если позже понадобится свободное редактирование без PR — добавим Payload/Directus (+1 сервер). Пока ИИ делает всё, человек только апрувит — это лишнее.',
};
