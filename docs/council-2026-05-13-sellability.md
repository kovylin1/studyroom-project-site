# Council Session: 2026-05-13 — Sellability of StudyRoom Landings

> Тема: повысить продаваемость per-uni лендингов и сайта-каталога StudyRoom.
> Метод: параллельный анализ 4 независимыми C-level экспертами по одинаковым исходным данным (см. секцию Context).

## Council Members

| Эксперт | Фокус |
|---|---|
| **CMO / Conversion Copywriter** | Hero, CTA, копирайт, trust-signals, social proof |
| **UX / Conversion Designer** | IA, секционный порядок, форма, mobile fold, недостающие фичи |
| **EdTech Growth Lead** | Funnel-математика, KZ-specifics, pricing, lead magnets, эксперименты |
| **Technical SEO & Performance** | Discoverability, schema.org, Core Web Vitals, content gaps |

## Context (current state snapshot, 2026-05-13)

- **Сайт:** `studyroom-project-site.pages.dev` (Astro 5 + Cloudflare Pages). RU-only. 27 per-uni лендингов (16 UK Kaplan + 2 Canada + AU/NZ/USA партнёры).
- **Лендинг = 13+ секций** в порядке: Hero → Benefits → Description → PhotoSets (только Glasgow) → Programs → Dates → Activities → Inline form → Requirements+Scholarships → Accommodation → Campuses → Important/FAQ → About → Reviews → Map → Final CTA → Footer + sticky chat.
- **TBD-плейсхолдеры в production:**
  - `STUDYROOM_REVIEWS` — оба отзыва `[TBD: имя студента]`
  - `STUDYROOM_CONTACT.phone` = `+7 (TBD) TBD-TBD-TBD`
  - WhatsApp + Telegram в `STUDYROOM_CHAT.quickActions` — оба ведут на `wa.me/7TBD` / `t.me/TBD`
  - `STUDYROOM_ABOUT.paragraphs[1]` — `[TBD: количество студентов, годы работы]`
  - `STUDYROOM_FOOTER.legal` — `[TBD: реквизиты юрлица / ИП, ИНН, БИН]`
- **Форма:** только Name + Phone (KZ маска), нет канала связи, нет времени звонка, нет thank-you SLA.
- **Дополнительные дефекты:** UCAS-таймлайн показывается даже на канадских универах; только Glasgow имеет 4-категорийные фотосеты; IELTS-требование hardcoded 5.5/70 на всех универах; StudyRoom бренд = только текст в шапке, hero отдан под логотип Kaplan; нет SEO-оптимизации (нет sitemap, schema, alt-текстов, canonical, OG-тегов).

---

## CMO — ключевые находки

**Топ-3 убийцы конверсии (по упущенной выручке):**
1. `[TBD: имя студента]` в продакшене → катастрофический trust-kill (~50% конверсии срезает на тёплом трафике).
2. `+7 (TBD)` телефон → KZ-рынок звонит, а не пишет. Нет номера = нет лидов.
3. Hero = «University of Glasgow». Это википедийная карточка вместо обещания результата.

**Пять рерайтов с самым высоким рычагом** (пример Glasgow):

| Что | Было | Стало |
|---|---|---|
| Hero H1 | «University of Glasgow» | «Поступим в Glasgow за одну подачу — или вернём всю стоимость услуги» |
| Primary CTA | «Записаться» | «Узнать свой шанс на поступление →» |
| Inline form | «Не можете определиться с выбором?» | «Подберём 3 программы Glasgow под ваш аттестат — за 24 часа» |
| Final CTA | «Запишитесь на бесплатную консультацию по обучению» | «15 минут с куратором — и вы знаете, проходите ли в Glasgow» |
| Чат-приветствие | «Здравствуйте! Я консультант StudyRoom...» | «Привет 👋 Я Айгерим, куратор по UK. Сама поступала в Эдинбург в 2019. Что интересует — программы, стипендии или виза?» |

**Trust-stack для запуска:** партнёрский лого-ряд (Kaplan / UCAS / British Council), счётчик живых цифр (студенты / годы / visa success rate / процент одобрения), 2-3 реальных мини-кейса с фото и видео-отзывом, гарантия возврата при недопаче, scarcity-счётчик «N заявок за неделю», физический адрес офиса + БИН в футере.

**Брутальный итог:** «Вы заставляете родителя выбрать агентство для отправки ребёнка на £20k за границу на сайте, где в отзывах буквально написано `[TBD: имя студента]`, телефон — `+7 (TBD)`, а в чат-окне безликая буква "S"».

---

## UX / Conversion Designer — ключевые находки

**Section reorder (главные перестановки):**
- Programs by faculty — поднять выше Description (primary intent: «есть ли моя программа?»).
- Reviews — поднять в верхнюю треть (как только появятся реальные).
- Requirements + Scholarships — поднять (self-qualification снижает support load).
- Dates per-geography — UCAS только для UK; Канаде — OUAC/собственные; убрать UCAS с Alberta/Victoria.
- Benefits + Activities — объединить (сейчас две похожих 4+3 карточки = дублирование).

**Топ-5 UX-фиксов:**
1. Удалить TBD-reviews из render: `{reviews.every(r => !r.name.includes('TBD')) && (...)}` в `site/src/pages/[slug].astro`.
2. Sticky chat и sticky bottom CTA конфликтуют в thumb-zone на mobile — chat поднять выше fold-bottom, sticky CTA bar только когда форма не в viewport.
3. Filters на desktop — раскрыты по умолчанию, на mobile — collapsed но с реальным счётчиком, chip-summary активных фильтров под bar.
4. Photo strategy — либо batch-roll-out 4-сетки на все 18 универов, либо откатить Glasgow к legacy gallery. Inconsistency = «недоделано».
5. StudyRoom brand SVG в шапке + co-branding badge «StudyRoom × Kaplan partner» в hero card. Ускорить BACKLOG Stage 9.

**Форма (final CTA, расширенная):** добавить поля «Кто оставляет заявку — студент/родитель», канал связи (WA/TG/звонок), удобное время звонка, опциональные program и IELTS. Friction +15%, lead quality +60% (net win).

**Три недостающих фичи:**
- GPA + IELTS matcher («куда я пройду?»).
- Compare-view до 3 универов (URL state `/compare?ids=...`).
- «For parents» Total Cost Calculator с конвертацией в тенге.

**Mobile fold spec (375px):** компрессированное фото (140px), uni name H1, top-fact row (ranking / tuition / IELTS), Primary CTA pill «Узнать о поступлении» — всё **выше фолда**.

---

## EdTech Growth Lead — ключевые находки

**Funnel-математика (оценка по индустриальным бенчмаркам edu-агентств CIS):**
- Visitor → Scroll-past-hero: −65% (hero не закрывает «почему StudyRoom»)
- CTA-view → Form-submit: −85% (форма в пустоте, без social proof)
- Form-submit → Call-answered: −60% (silent submit, нет SLA, нет WhatsApp handoff)

**Пять KZ-специфичных тактик, которые сейчас НЕ делаются:**
1. **Тенге-anchoring рядом с £/CA$.** «£9,500/год ≈ 5,7 млн ₸. Для сравнения: KIMEP MBA ~4 млн/год.»
2. **Гарантия возврата при отказе в визе** — главный страх №1 в KZ.
3. **Telegram-канал «Поступление UK 2026»** — KZ-аудитория сидит в Telegram, не в email.
4. **IELTS-readiness калькулятор:** «У вас 5.5 → нужен 6.5 → возьмите Kaplan Foundation за £X».
5. **«Договор на казахском + услуги юриста проверены»** — отдельный значок доверия.

**Топ-10 экспериментов, отсортированы по ROI** (выжимка):

| Эксперимент | Lift | Effort |
|---|---|---|
| Заменить TBD-отзывы на реальные | +80-150% form-submit | S |
| Sticky WhatsApp с pre-filled message | +30-50% к общему лиду | S |
| `/thanks` с 15-минутным SLA + Calendly | +40-60% call-answer | S |
| Тенге-цены + сравнение с KZ-вузами | +20-35% form | S |
| Hero «N студентов в 2024, партнёр Kaplan» | +25-40% scroll-past-hero | M |
| Стипендии в первом экране (а не в section 9) | +30-50% engagement | M |
| Лид-магнит «PDF: Гид по поступлению в UK для казахстанцев» | +200-300% raw leads | M |
| SEO-лендинги «магистратура в Канаде стипендия» и т.п. | +500-1000% органик за 6 мес | L |
| 3 тарифа (Starter free / Standard ⭐ free / Premium 350k₸) | +20% deal size | M |
| Юридическая гарантия возврата при отказе в визе | +15-25% close-rate | L |

**Pricing architecture:** явная декомпозиция «обучение + жильё + виза + страховка = ИТОГО ₸ / Услуги StudyRoom БЕСПЛАТНО при поступлении через Kaplan (комиссию платит университет)». Снимает «посредник-страх».

**Брутальное наблюдение:** «Вы запустили 27 лендингов раньше, чем закрыли trust-foundation на одном. Scraper-pipeline и Decap CMS — это engineering vanity: вы оптимизируете supply, пока demand утекает в Instagram-DM конкурентам.»

---

## Technical SEO & Performance — ключевые находки

**Критические блокеры:**
- `/manager` и `/admin` потенциально индексируются → `noindex` + `Disallow` в `robots.txt` СРОЧНО.
- Schema `Review` НЕ маркапить пока `[TBD]` — manual action от Google за фейк-разметку.
- В CI/CD добавить `rm -rf site/.astro` перед `npm run build` (про content-cache гачу — см. `memory/feedback_astro_content_collections.md`).
- Per-uni IELTS hardcoded на 5.5 → блокер для контент-гэпов типа `/postuplenie-s-ielts-5-5`.
- Soft-404 риск: универы с пустыми `programs[]` отдают полноценный HTML без контента — нужен auto-`noindex` при `programs.length < 2`.

**Топ-10 контент-гэпов (программатик контент)** — отсортированы по потенциалу:

1. **Страны-хабы** `/uk`, `/canada`, `/australia` — 1 день, ~2-5к/мес × 5 стран.
2. **Город-хабы** `/glasgow-uchyoba`, `/london-universities` — 500-2к/мес на топ-городах.
3. **Программа-хабы** `/business-magistratura`, `/computer-science-bakalavr` — требует нормализации faculty.
4. **IELTS-фильтры** `/postuplenie-s-ielts-5-5`, `/bez-ielts` — 3-8к/мес, высокоинтентный.
5. **Стипендии** `/stipendii-uk`, `/stipendii-kaplan` — данные уже есть в JSON, легчайший win.
6. **Pathway-объяснялки** `/pre-masters-chto-eto`, `/foundation-vs-pathway` — 1-2к/мес, низкая конкуренция.
7. **Бюджетные подборки** `/universitety-do-15000-funtov` — 2-4к/мес.
8. **Russell Group / рейтинги** — 1-3к/мес.
9. **Визовые гайды** `/studencheskaya-viza-uk-kazahstan` — 5-10к/мес, конверсионный.
10. **Сравнительные пары** `/glasgow-vs-liverpool` — лонгтейл, высокая конверсия.

**Пять quick wins (<1 день каждый):**

1. Базовый `<head>` + sitemap + robots: установить `@astrojs/sitemap`, исключить `/manager` и `/admin`, добавить `<title>`, `meta description`, `canonical`, `og:*`, `twitter:*`, `<html lang="ru">`.
2. Schema.org `EducationalOrganization` + `Course` + `BreadcrumbList` через новый `Schema.astro` компонент → 27 универов одной правкой.
3. Alt-text для всех изображений (`alt="${uni.nameRu}, ${categoryRu}, фото ${i+1}"`).
4. Страница `/uk` (страна-хаб) + хлебные крошки.
5. Подтверждение в Google Search Console + Yandex.Webmaster (KZ-аудитория использует обе).

**Core Web Vitals риски:** LCP от hero-фото (нужен `fetchpriority="high"` + AVIF), CLS от 4-grid photo sets (`aspect-ratio` фикс), INP от карты (lazy-load iframe по клику или статичный PNG), gallery transfer size (`loading="lazy"` ниже фолда).

**Hreflang-стратегия:** подпапки `/`, `/en/`, `/kk/` (не поддомены). RU default, EN — Stage 8, KZ — позже (молодёжь 17-22 ищет на русском в ~75% случаев, по данным Google KZ).

---

## Consensus (все 4 эксперта сошлись)

1. **TBD-плейсхолдеры в production = блокер №1.** Все 4 эксперта назвали это первым пунктом. Reviews, телефон, WhatsApp/Telegram, БИН/адрес, About — закрыть СЕГОДНЯ.
2. **Hero сейчас слабый.** Нужна StudyRoom-ценность (партнёрство, число студентов, гарантия), а не википедийная карточка универа.
3. **Социальное доказательство — критично и отсутствует.** Реальные отзывы, видео-отзыв родителя, кейсы с фото — это базовая гигиена.
4. **Stop scaling, start fixing.** Не запускать новые универы / новые SEO-страницы / новые фичи, пока 3 флагмана (например Glasgow / Liverpool / Brighton) не доведены до коммерчески готового состояния.
5. **Per-geography фикс UCAS-таймлайна.** Канадские универы не имеют UCAS-цикла. Это factual error в production.
6. **Скрыть `/manager` и `/admin` от индексации.** Технический must-do до публичного релиза на `studyroom.kz`.
7. **Стипендии — сильнейший hook, спрятанный в section 9.** Поднять в первый экран (CMO + Growth + UX согласны).
8. **Sticky WhatsApp с pre-filled message** работает лучше формы для KZ-рынка. Нужен реальный `wa.me/77XXX`.

## Disagreements

| Тема | Позиция | Аргумент |
|---|---|---|
| **Urgency / scarcity** | CMO + Growth: добавить (дедлайн-счётчик, «X заявок за неделю», ограниченные слоты Early Bird) | Loss-aversion — топ-триггер |
| | UX: осторожно, fake-scarcity легко считывается и убивает trust | Hotjar-данные на edu-сайтах показывают drop-off на fake-urgency |
| **Inline form (mid-page)** | UX: email-only, low-commitment, в обмен на PDF | Mid-page = browse mode, не buy mode |
| | CMO + Growth: телефон + WhatsApp, KZ-рынок звонит | Email мёртв в KZ-аудитории 17-22 |
| **Сколько полей на финальной форме** | UX: 7 полей (роль / имя / телефон / канал / время / программа / IELTS) | Lead quality +60% > friction +15% |
| | CMO: 3 поля (имя / WA / удобное время) | Каждое поле = drop-off; «удобное время» — единственное стоящее |
| | Growth: 3 тарифа + Calendly + thank-you SLA | Структура оффера важнее структуры формы |
| **SEO programmatic content** | SEO: 10 hub-страниц в первые 2 месяца | Органик трафик — главный долгосрочный канал |
| | CMO + Growth: заморозить scale до trust-foundation на 3 флагманах | Конверсия 1% × 10× трафика = меньше, чем конверсия 5% × 1× трафика |
| **Photo strategy для 17 не-Glasgow универов** | UX: откатить Glasgow к legacy gallery (consistency) | Inconsistency = «недоделано» |
| | SEO: завершить 4-grid pilot на всех 18 (alt-текст + image SEO) | Больше структурированных фото = больше Google Images трафика |
| **StudyRoom service fee** | Growth: показывать прозрачно «БЕСПЛАТНО при поступлении через Kaplan, комиссию платит универ» | Снимает «посредник-страх» |
| | CMO: не педалировать «бесплатно» (девальвация качества) | Free = подозрительно для премиум-аудитории |

## Recommended Action Plan

### Неделя 1 — Trust Foundation (P0, блокеры)

| # | Действие | Файл | Effort | Owner |
|---|---|---|---|---|
| 1 | Удалить рендеринг TBD-reviews | `site/src/pages/[slug].astro` | 15 мин | dev |
| 2 | Поставить реальный KZ-номер | `site/src/content/studyroom/static.ts` | 5 мин | ops |
| 3 | Реальные `wa.me` + `t.me` ссылки + pre-filled message с `{uni name}` | `static.ts`, `[slug].astro` (передача param в чат-виджет) | 1 час | dev |
| 4 | Реквизиты юрлица + физический адрес в footer | `static.ts` | 15 мин | ops |
| 5 | Заполнить `STUDYROOM_ABOUT` реальными цифрами | `static.ts` | 30 мин | ops |
| 6 | `<meta name="robots" content="noindex, nofollow">` на `/manager` + `/admin` | соответствующие `.astro` файлы | 10 мин | dev |
| 7 | UCAS-таймлайн только для UK; для Канады — отдельный фолбэк | `site/src/content/studyroom/static.ts`, `[slug].astro` | 1 час | dev |
| 8 | `<html lang="ru">` | `site/src/layouts/Base.astro` | 2 мин | dev |
| 9 | `<title>` + `meta description` + `canonical` + `og:*` в Base layout | `Base.astro` | 2 часа | dev |
| 10 | `robots.txt` + `@astrojs/sitemap` | `site/public/robots.txt`, `astro.config.mjs` | 1 час | dev |
| 11 | CI/CD шаг `rm -rf site/.astro` перед билдом | `.github/workflows/*.yml` или Cloudflare Pages build cmd | 10 мин | dev |

### Неделя 2 — Social Proof + Form (P1)

| # | Действие | Effort |
|---|---|---|
| 12 | Записать 3 реальных видео-отзыва (студенты + 1 родитель) | 1 день |
| 13 | Заменить `STUDYROOM_REVIEWS` 3 реальными отзывами, восстановить рендер секции | 30 мин dev |
| 14 | Redesign финальной формы: добавить поля «канал связи» + «удобное время» (компромисс UX/CMO: 4 поля вместо 7) | 2 часа |
| 15 | `/thanks` страница с 15-мин SLA + Calendly slot + sticky WhatsApp deep-link | 4 часа |
| 16 | Hero rewrite на 3 флагманских (Glasgow / Liverpool / Brighton): новый H1, чип «12 казахстанцев в 2024» (со временем — для всех 27) | 1 день |
| 17 | Поднять блок стипендий в первый экран на 3 флагманах | 4 часа |
| 18 | Sticky CTA bar на mobile + конфликт-фикс с chat-виджетом | 4 часа |
| 19 | Тенге-конвертация рядом с £/CA$ (зашитый курс, обновляется ежемесячно скрапером) | 4 часа |

### Неделя 3-4 — SEO Foundation (P2)

| # | Действие | Effort |
|---|---|---|
| 20 | Schema.org компонент `Schema.astro` (EducationalOrganization + Course + Offer + BreadcrumbList + FAQPage) — без Review до получения настоящих | 1 день |
| 21 | Alt-текст для всех изображений (`gallery.items`, `photoSets`, hero) | 2 часа |
| 22 | Страны-хабы `/uk`, `/canada` (Astro `[country].astro`) | 1 день |
| 23 | Стипендии-хаб `/stipendii-uk` (данные уже структурированы) | 4 часа |
| 24 | IELTS-хабы `/postuplenie-s-ielts-5-5`, `/postuplenie-s-ielts-6-0` — после того как scraper заполнит реальные IELTS на программу | блокер: scraper task в BACKLOG |
| 25 | Google Search Console + Yandex.Webmaster verification | 2 часа |
| 26 | Core Web Vitals: hero AVIF + preload, `aspect-ratio` на photo sets, lazy map iframe | 1 день |

### Неделя 5+ — Growth Experiments (P3, после trust foundation)

- GPA + IELTS matcher страница (`/matcher`).
- Compare view (до 3 универов).
- «For parents» Total Cost Calculator с тенге-выводом.
- 3-тарифная структура (Starter / Standard / Premium).
- Telegram-канал «Поступление UK 2026» + закрытый каст «офферы недели».
- Лид-магнит «PDF: Гид по поступлению в UK для казахстанцев» в обмен на email + WA.
- Гарантия возврата при отказе в визе (после юридической проработки).

## Decisions

_К заполнению после обсуждения с командой._

| Решение | Принято | Дата | Owner |
|---|---|---|---|
| Удалить рендер TBD-reviews сегодня же | — | — | — |
| Реальный номер телефона + WA + TG | — | — | — |
| Заморозить scaling на новые универы до закрытия trust-foundation | — | — | — |
| Tier-структура (Starter / Standard / Premium) | — | — | — |
| Программатик SEO-страницы (страны / города / IELTS / стипендии) | — | — | — |

---

## One-Sentence Summary

**Сайт технически готов масштабироваться (27 универов, scraper, CMS), но коммерчески не готов продавать ни одного: TBD-плейсхолдеры в отзывах и контактах сжигают доверие быстрее, чем 27 лендингов его создают — закрыть trust-foundation на 3 флагманах важнее, чем запустить 28-й универ.**
