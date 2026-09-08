# BACKLOG — studyroom-project-site

> **SSOT for this project's tasks.** Root `BACKLOG.md` is just an aggregator that mirrors this file.
> Read `IN PROGRESS` + `TODO` before starting any new task. On close → move to `DONE` with date and evidence.

---

> **План работ с номерами задач — [PLAN.md](./PLAN.md).** Три категории:
> есть у агрегатора и нет в каталоге · есть в каталоге и нет у агрегатора · остальное.
> На задачи можно ссылаться номером («делаем 2.3»). Этот файл остаётся историей;
> план — рабочим списком.

## IN PROGRESS

- **КОМПАС — приведение каталога к партнёрским источникам.** Сессии 1–3 сделаны (ветка `feat/kompas`, коммиты `66bbdb80`, `e7713fdd`, `8a17ce0e`, `21f08863`, `c5e77823`). Собраны Kaplan, QA, Oxford International, Study Group, Edvoy (48 833 программы). Живой каталог не тронут ни разу. **Полный список незакрытого — `docs/superpowers/plans/2026-07-22-kompas-open-tasks.md`** (8 задач). Ближайшие по важности: (1) Navitas — в живом каталоге стоят фабрикованные сид-цены у 10 британских вузов; (2) IAPro и QS — пароли в `scraper/.env` устарели, порталы их отклонили, нужен владелец; (3) сессия 3.5 — прямые партнёры, начинать с замера 757 файлов `official-extracts` глазами. **2026-07-25: P0–P4 плана `sources/kompas/FIX-PLAN.md` пройдены, отчёты `OWNER-REPORT-session5.md` и `OWNER-REPORT-session5-p3p4.md`.** Уточнение по (2): IAPro на самом деле пускает — пароли рабочие, ломалась проба (портал переехал в shadow DOM), починено; отклоняет только QS Apply, и это блокирует 227 вузов / 21% каталога. Открыто и ждёт владельца: доступ QS, слияние 6 пар карточек-дублей, судьба 1234 непроверяемых стипендий, полный прогон сбора стипендий с офсайтов. **2026-07-26 (сессия 6): хвост P3/P4 закрыт, отчёт `OWNER-REPORT-session6.md`.** 6 пар дублей слиты (объединением, с переносом стипендий и фотонаборов, откат — `dupmerge-backup.json`); всем 1769 стипендиям проставлен разряд происхождения (`untraceable` 1234), поле объявлено в схеме сайта; собранные с офсайтов записи сведены с каталогом — 553 кейса решений в панели; разборщики сбора вынесены в `lib` и покрыты 26 тестами; просмотр выборки `hub-headings` отбросил 131 запись брака разбора. Панель: 1894 → 2469 кейсов. Единственное, что по-прежнему упирается в владельца, — **доступ QS Apply** (227 вузов, 21% каталога).
  **2026-07-31: ДОСТУП ПОЛУЧЕН ПОЛНОСТЬЮ.** Пароль рабочий (elmira.k@, кред в `scraper/.env`),
  раздел Institutions открывается — верный деп-линк подсказал владелец:
  `/suite/sites/qs-apply/group/students-and-applications/page/institutions`
  (мои ранние «403» были ошибкой формата ссылки, не прав). Разведчик `scraper/kompas-qs-recon.mjs`
  снял разметку: страница — Appian SAIL, список вузов с фильтрами (education level / destination /
  study level / intake), интерфейс-JSON 450 КБ — `sources/kompas/qs-recon/net/007.json` (GET
  `…/page/g.students-and-applications.p.institutions`), обновления списка — POST туда же (008.json).
  **2026-08-01: QS СОБРАН ЦЕЛИКОМ — блокер снят.** Коллектор `scraper/kompas-collect-qs.mjs`
  (3 стадии, resume, `--extract-only` для повторного разбора без сети, `--workers=N`).
  Итог: **512 / 512 карточек** (портал объявлял 512 — сошлось), 508 с программами,
  **35 303 программы**, из них 34 864 с ценой, 379 привязано к каталогу, 133 без привязки,
  33 страны (UK 197, US 104, CA 47, AU 33), ошибок сбора 0.
  Выход: `sources/kompas/qs/records/*.json` (сырые дампы), `sources/kompas/extracts/qs/*.json`,
  `sources/kompas/membership/qs.json`, `sources/kompas/qs/grid-shapes.json`.
  Источник `qs` переведён из `blocked` в `ready` в `lib/kompas-diff-core.mjs`; сверка прогнана:
  сверено 569 вузов, 1361 кейс (`sources/kompas/DIFF-REPORT.md`, `diff-review.json`).
  **Как устроен портал (Appian/SAIL):** POST-ответы — дельты интерфейса, грида в них нет,
  поэтому строки снимаются с DOM. Программы лежат за каскадом
  `List of Degrees -> List of Study Levels -> <кампус> Campus Costs + Programs`,
  грид Programs со своей пагинацией по 10 строк.
  **Уроки прогонов:** (1) сверять собранное с числом, объявленным порталом — сошлось 512/512;
  (2) несколько вкладок роняли друг другу переход («interrupted by another navigation»,
  339 карточек из 508) — переходы поставлены в общую очередь `gotoSafe`, после этого 0 ошибок;
  (3) первая степень каскада терялась: `settle()` успокаивался раньше, чем приезжала таблица
  уровней — добавлено ожидание `waitCascadeAdvance`; (4) имя вуза берётся из текста record-ссылки,
  а не из ячейки: в ячейке к имени приклеен бейдж типа партнёрства («… (Postgraduate) University»),
  из-за него не сходился каталог; (5) имя файла выгрузки — слаг стороны QS, не каталога:
  «UEL (Postgraduate)» и «UEL (Undergraduate)» сходятся в один слаг каталога и затирали друг друга.
  **Важно про цену:** портал НЕ показывает цену программы — только стоимость обучения кампуса
  для уровня (Campus Costs). У программ стоит `feeBasis: "campusLevelStated"`, программных цен
  не выдумано. Живой каталог не тронут.
  **2026-08-02: сбор закоммичен и запушен** — `8af05278` (коллектор + 512 сырых дампов +
  512 выгрузок + `membership/qs.json` + пересчитанная сверка, 1036 файлов). До этого вся
  работа жила в одном экземпляре на диске владельца. Разведочные дампы `sources/kompas/qs-recon/`
  в git НЕ поехали: в 7 файлах лежит логин владельца открытым текстом, а репозиторий публичный —
  папка добавлена в `.gitignore` рядом с `portal-probe/` по тому же основанию. Ссылки на
  `qs-recon/net/007.json` выше — на локальный файл. В самих данных (`extracts/qs`, `qs/records`)
  ни логина, ни пароля, ни чужих email нет — проверено перед индексированием.
  `feat/kompas` запушена; в `main` ветка НЕ влита (11 коммитов), решение владельца — мерж позже,
  потому что мерж = деплой, а 1361 кейс сверки ещё не разобран.

  **2026-08-02: 133 непривязанным поставлен диагноз** — `b3fb584d`, отчёт
  `sources/kompas/QS-UNLINKED-REPORT.md`, полный разбор `qs-unlinked.json`,
  замер `scraper/kompas-qs-unlinked-diag.mjs` (только чтение, карточек не заводит).
  Это оказалась НЕ дыра сбора, а по большей части баг привязки, и та же самая дыра,
  что даёт 123 кейса `kompas_no_extract`: у QS запись есть, но она не села на карточку,
  поэтому карточка считает, что источник по ней молчит. У 39 записей обе улики сразу.
  Расклад: 5 привязываются строгим разбором сразу, 24 «надёжно» (0.75+ и та же страна,
  просмотрены глазами — брака нет), 45 «нужен глаз», 13 «другая страна» (скорее другой
  кампус сети), 9 страна разошлась, 3 однофамильца, **46 карточки нет вовсе** (1318 программ)
  — вот эти и есть настоящий пробел, и заводить их скрипту нельзя по правилу 31.07.
  Бейдж-дубли QS: Victoria, Texas A&M Corpus Christi, NABA приходят двумя записями на одну
  карточку — привязывать объединением, иначе вторая затрёт первую.
  **Ждёт владельца:** подтвердить разряд «надёжно» (24 шт.) к применению и решить по 46 без карточки.

  **2026-08-10: 1361 кейс сверки разобран — решений 464, отчёт `sources/kompas/DIFF-TRIAGE.md`.**
  `scraper/kompas-diff-triage.mjs` (+8 тестов) ставит решение только там, где владелец уже решал
  ТАКОЙ ЖЕ случай, и отказывается решать, где семантика другая. Закрыто: 318 «лишних программ»
  (метка `catalog-only` на карточке реально стоит — проверяется, а не предполагается),
  130 «у источника цены нет» → `ignore` по прецеденту 29.07, 12 расхождений валюты → `ignore`
  (разобраны вручную в P0.4), 3 расхождения цены с программной основой → `update`, 1 «источник
  без программ». Панель пересобрана: 4940 кейсов, 1564 с решением.
  **2026-08-15: хвост из пяти разрядов пройден одним прогоном** —
  `scraper/orchestrator-kompas-tail.mjs` (12 шагов, сети нет, живой каталог не тронут,
  всё пишется в `catalog-work` и в файлы кейсов, лог `sources/kompas/tail-run.log`,
  итог `tail-run-report.json`). Кейсов в сверке 1502, с решением 745, открыто 757.
  - **Привязка QS.** `kompas-qs-relink.mjs` (+5 тестов) привязал 16 выгрузок
    (558 программ) к 14 карточкам — только там, где имя совпало полностью и страна
    та же (`uic`, `solent`, `uvic`, `tamucc`…). Файлы НЕ переименовываются: у QS
    бывает две записи на карточку (бейджи Postgraduate/Undergraduate), переименование
    затёрло бы одну другой — ставится только поле `catalogSlug`, сверка их объединяет.
    Ещё 53 записи ушли кейсами владельцу (`kompas_qs_link`, схожесть 0.5–0.83),
    64 без кандидата. Откат — `qs-relink-backup.json`.
  - **123 `kompas_no_extract` → закрыт 91.** Разряд перестал быть загадкой: у QS
    сбор доказано полный (портал объявил 512, снято 512), значит «выгрузки нет»
    означает либо непривязанную запись (такие карточки перечислены в
    `pendingTargets` и остаются открытыми — 59), либо что вуза в списке QS нет
    вовсе, и тогда это не пробел сбора, а разметка партнёрства.
  - **113 «лишних» без метки → закрыто 310 из 439.** Рабочая копия обновлена с
    живого каталога (отставала: 18 599 меток против 21 621), P1 доставил метку
    `catalog-only` ещё на 8350 программ у 129 вузов. Остаток 129 — вузы, где
    сверять пока не с чем.
  - **274 добора программ → 207.** P2 завёл 14 820 программ у 237 вузов
    (`kompasStatus: source-added`). **Найден и починен дефект:** добор писал бы
    кампусную цену QS (`campusLevelStated`) в цену программы — ровно то, что
    сейчас на решении владельца по 342 кейсам. Теперь программа заводится, цена нет:
    с ценой всего 34 из 14 820. Без уровня пропущено 6087 (уровень не выдумываем).
  - **57 кампусов → закрыто 42, открыто 4.** Просмотр всех 99 названий глазами
    показал, что настоящих пропусков там меньшинство: 37 дописано у 22 вузов,
    а 846 отброшено с причиной — тот же кампус под именем агрегатора
    («Abertay Campus» при «City Centre Campus»), дубль, «Online Campus»
    (не место, а форма обучения) и абзацы описания программ, заехавшие в поле
    кампусов у коллектора. Последнее — отдельная находка про сбор, не про каталог.
  - **6 расхождений валюты → закрыты все 18.** Прецедент P0.4 распространён по
    основанию, а не по списку: валюту карточки определяет страна вуза, национальная
    или международная (USD/EUR) валюта законна, флип остаётся за человеком.
    **Заодно найдена щель:** при разной валюте сверка сравнивает валюты и
    останавливается — сумму не сравнивает НИКОГДА. Пересчёт по справочному курсу
    дал 17 кейсов `kompas_fee_amount_fx`, где расходится и само число
    (Wollongong Dubai — 23 %). Курс в данные не пишется. Отчёт `CURRENCY-REVIEW.md`.
  - **Побочно починено:** `kompas-diff.mjs` пересобирает `diff-review.json` с нуля и
    обнулял решения (id кейса содержит количество, после добора оно меняется) —
    появился `kompas-diff-carry.mjs`, переносит решения по паре «вуз + разряд» и
    выписывает сирот; накопительный бэкап добора падал на слаге, совпавшем с ключом
    прототипа объекта (`prev[s] ?? []` возвращал метод); появилась проверка
    инвариантов схемы сайта по рабочей копии (`kompas-workcopy-check.mjs`) —
    до и после правок 0 нарушений.
  - **Не закрыто и почему:** 342 расхождения цены (тот же вопрос про кампусную
    цену — ждёт владельца), 207 доборов программ (кейс останется открытым, пока
    добор живёт только в рабочей копии), 129 «лишних» без метки, 59 `no_extract`,
    53 привязки QS, 17 новых кейсов на сумму.

  **Осталось из этих 1361 (897):**
  - **323 расхождения цены — вопрос владельцу, один на все.** У QS цена не программная, а
    стоимость обучения кампуса для уровня (`feeBasis: campusLevelStated`). Прецедент 29.07
    «писать цену источника» принимался, когда источники давали программную цену. Подставить
    кампусную вместо программной — подмена смысла, поэтому скрипт этого не делает.
  - **274 «программа есть у источника, нет в карточке»** — добор P2, механический, но меняет каталог.
  - **123 `kompas_no_extract`** — тот же баг привязки, что в `QS-UNLINKED-REPORT.md`.
  - **113 «лишних программ» без метки** — P1 метил каталог, когда QS был заблокирован, и до этих
    карточек не дошёл. Нужен повторный прогон, но рабочая копия `catalog-work` отстала от живого
    каталога (255 размеченных карточек против 333) — сперва `kompas-inventory.mjs --write-copy`.
  - **57 недостающих кампусов**; **6 расхождений валюты** у вузов, появившихся после сбора QS
    (`birmingham-dubai`, `canadian-university-dubai`, `debrecen`, `reading-malaysia`, `roehampton`,
    `wollongong-dubai`) — ручной разбор P0.4 их не покрывает.
  - 3 кейса с решением `update` ждут прогона применения цен вместе с решением владельца по 323.

  **Осталось по QS:** применить диагноз 133 непривязанных; 4 вуза без программ у самого портала
  (American Collegiate Washington DC, Centennial College, Durham College, Heriot-Watt Malaysia
  Foundation); даты приёма лежат за ссылкой «View Intakes» — отдельным проходом, если понадобятся.

- **Stage 13 — Program-catalog expansion to 30+ per uni (resume after 20:00 Almaty 2026-05-22 — Sonnet budget reset).** Started 2026-05-22 at 17:00 Almaty. 7 parallel Sonnet agents launched on `sources/expand-batch-{J,K,L,M,N,O,P}.json` (249 thin universities total, ~36 each). All 7 hit Sonnet session limit ~10 min in. Net result: 55/249 touched, 33 reached the 30+ target, 194 still queued. **K-12 (12 unis), language schools (8), pathway-only centres (41) — 61 unis total — DELIBERATELY EXCLUDED** because <15 programs is realistic for their type. **Resume protocol** after 20:00 Almaty Sonnet reset: re-launch the same 7 parallel Sonnet agents on the same 7 batch JSONs — each agent has "skip if file exists with current >= target" gate, so the 33 already-expanded unis auto-skip; agents only re-process the 194 untouched. Promote J/K/L/M/N/O/P to a 5-agent batch (35-50 unis each) if budget allows.

- **Maintenance gap (after Stage 13):** 1 uni with 0 photos (`basis-mclean` — no Wikimedia, no Wikipedia, no working officialUrl), 6 unis with empty `scholarships` (agents marked as "no public int'l scholarships found"), 110 unis without `logoUrl` (sites blocked scraper / no `apple-touch-icon` / 403). Photo gap is hardest — would need Exa/manual hunt. Logo gap can re-run `scraper/discover-logos.mjs` after some sites recover.

- **Known source issues from monthly scrape workflow:**
  - ~~**Navitas UK** — `navitas.com/study/destinations/uk/` returns HTTP 404.~~ **Закрыто 24.08.2026 (3.24).** Страна переехала с слага `uk` на `united-kingdom` — `https://www.navitas.com/study/destinations/united-kingdom/` отдаёт 200. В коде старый адрес не зашит нигде: `kompas-collect-navitas.mjs` ходит в `/study/colleges-campuses/` (200), а `scraper/src/sources/` не существует. Ни один из 10 вузов не пострадал — 404 был только в документации.
  - **Oxford 403** — `ox.ac.uk/` blocks scraper bot. Need realistic User-Agent or playwright/curl-impersonate for that one URL.

- **Stage 12 — QS aggregator roll-out (237 of 338 done; resume scheduled 03:20 Almaty 2026-05-19 — token reset).** Started 2026-05-18. **Session 2 (2026-05-18/19):** waves 1-3 (24 unis) shipped + Zod-fixed (BOM stripped on 3 CA files; programType `course→pathway` on 16; level `undergraduate/postgraduate→bachelor/master` on 31). Wave-4 hit token limit mid-flight — only `heriot-watt-malaysia` survived on disk (not yet deployed). Live: https://fee7576c.studyroom-project-site.pages.dev (240 pages). Resume queue ~190 missing in `sources/qs-resume.json` (next 7: utah, wyoming, washington-state, western-new-england, western-washington, yamanashi-gakuin, apu-malaysia). After wakeup: rebuild + deploy heriot-watt-malaysia + resume waves with explicit reminders "level∈{bachelor,master,...}; programType∈{pathway,degree}; no BOM". Original 2026-05-18: Sub-agent parsing fleet for the QS / topuniversities partner list (PDF source: `sources/qs-list.pdf`; cleaned queue: `sources/qs-queue.json`; remaining work queue: `sources/qs-resume.json`). Phases 1 (inventory dedup), 1b (`aggregators.md` + 338 rows in `universities.list.md`) DONE. Phase 2 (parsing) PARTIAL: **53 of 338 net-new JSONs written**, all Zod-valid. Confirmed wins: Batch 1 direct dispatch 8/8 (asc-perth, aut, curtin-college, eynesbury, icae[WARN], ichm, james-cook, kaplan-business-school); Canada supervisor 38/38 (all CA partners — adler→yorkville with `confidence:"aggregator"`, `tuition.currency:"CAD"`); direct dispatch wins on nmit-nz, tasmania, adler, alexander-college, adelphi. **Sub-agent fan-out doesn't work** — the auto-mode classifier blocks sub-agents from spawning sub-sub-agents AND from doing the parsing work directly when the supervisor prompt says "don't write files yourself". AU/NZ, USA, Europe+TR, Asia+ME, UK&I supervisors all bailed. Direct per-uni Agent() calls from the main conversation DO work (Sonnet 4.6, ~50-70k tokens, 5-10 min each). Token budget hit at ~10:10 Almaty; resets 12:10pm Almaty. **Resume protocol** (per `memory/feedback_auto_resume_on_token_refresh.md`): on next session, read `sources/qs-resume.json` (285 slugs), dispatch direct per-uni Agent() calls in waves of ~20 per message, each with prompt `QS-partner parser slug=<SLUG>. cwd <project-root>. Skip if file exists. Run \`node scraper/qs-build-prompt.mjs <SLUG>\`; follow output. No safety-hook bypass. Report ONE LINE.` Continue through Phases 3 (build + Zod fix), 4 (logos+photos), 5 (Cloudflare deploy). Helper script `scraper/qs-build-prompt.mjs` ships the full per-uni prompt with country-specific currency/deadline/IELTS norms.
- **Stage 11 — Scraper extension to fill Oxford-style landing fields.** Started 2026-05-12. Slices 1+2+3 + photo pilot shipped. Remaining sub-tasks:
  - **Fill out photo pilot to 10/10/10/10 for Glasgow:** current counts `general=10 campuses=4 students=4 accommodation=6`. Source pages exhaust at these counts; need additional Wikimedia file titles in `pilot-photo-sets.mjs:WIKIMEDIA_SEEDS.glasgow.campusFiles[]` (Glasgow has many more building photos on Commons under sub-categories), and a secondary student-life source (uni's own student-life page) for the `studentsFaculty` bucket.
  - **Roll out the photo pilot to the other 17 unis:** seed Wikimedia titles for each uni in `WIKIMEDIA_SEEDS`. The Kaplan-side scraping (`studentsFaculty`, `accommodation`) already works without per-uni config.
  - **`dates.items[]`** — per-uni admission deadlines. Today the timeline is a generic UK UCAS cycle from `STUDYROOM_DATES_TIMELINE`. The scraper already pulls per-program ISO deadlines into `u.deadlines`; collapse those into a 4-step timeline.
  - **`requirements.exams[]`** + accurate per-uni IELTS/TOEFL — currently a hardcoded `STANDARD_REQUIREMENTS` (5.5 / 70). Scrape per-uni pathway entry requirements page.
  - **`location.{lat,lng,bbox,address}`** — exact coords for OSM/Google embed. Today the page uses a hardcoded `UNI_COORDS` map at `[slug].astro:145` (UK only; Canadian unis fall back to name-search embed). Geocode once via Nominatim, write to `u.location`.
  - **`reviews[].{thumbnail,videoUrl,text}`** — real testimonials with consent (StudyRoom-side data, not scraped). Out of scraper scope.
  - ~~`description.paragraphs[]`~~ — DONE 2026-05-12 (English + Russian).
  - ~~`scholarships[]`~~ — DONE 2026-05-12 (Kaplan baseline + uni-specific × 18 unis, EN + RU).
  - ~~`hero.bgImage` / `hero.cover`~~ — already wired up via `u.gallery.items[0..1]`, not a gap.
  - ~~`gallery.items[]`~~ — already populated by `download-photos.mjs`, not a gap.
  - ~~`accommodation[]`~~ — DONE 2026-05-11 (Kaplan Living + curated uni-accommodation-facts).
  - ~~`campuses[]`~~ — DONE 2026-05-11 (curated campus-facts).

## Правила сбора (решение владельца 2026-07-31)

- **Парсеры не создают карточки вузов.** STAGE 1.5 в `bobr-accommodation-merge.mjs`
  (заводил вузы из непривязанных edvoy-выгрузок; так само добавилось ~15 вузов) выключен,
  включается только флагом `--allow-new-cards`. Новые вузы заводит человек.
- **Программы и цены — только с агрегаторов.** Офсайты вузов для программ/цен не парсить
  (`kompas-collect-direct`, `scrape-direct-partners-v2` — только по явной просьбе).
  Фото (Wikimedia) и жильё/кампусы — как раньше. СИТО-обход 31.07 — разовое исключение,
  разрешён владельцем до конца прогона.

## TODO

### Хвост после прогона 2026-08-15 — решения владельца

Всё ниже лежит в рабочей копии и в панели `/manager`; живой каталог не тронут.
Разбор — `sources/kompas/tail-run-report.json`, лог `sources/kompas/tail-run.log`.

- [ ] **Применить рабочую копию в живой каталог — самое крупное и самое опасное.**
  В `catalog-work` накоплено: 14 820 добранных программ у 237 вузов
  (`kompasStatus: source-added`), метка `catalog-only` ещё на 8350 программах,
  37 кампусов. Каталог вырастет с 91 213 до ~106 000 программ, то есть на четверть,
  и это увидят все страницы вузов. Откат по трём бэкапам
  (`program-backfill-backup.json`, `catalog-only-marks.json`, `campus-backfill-backup.json`).
  Схема проверена: 0 нарушений. **Решать отдельно, поэтапно и, вероятно, не целиком.**
- [ ] **53 привязки выгрузок QS — кейсы `kompas_qs_link` в панели.** Схожесть имени
  0.5–0.83 при той же стране: «Cardenal Herrera CEU» → `cardenal-herrera-valencia`,
  «University of Oklahoma» → `into-oklahoma`. Ошибка привязки тихо подмешает в карточку
  чужие программы, поэтому автоматом не привязывалось. Разбор — `qs-relink-review.json`.
- [ ] **17 кейсов `kompas_fee_amount_fx` — расходится не валюта, а сумма.** Сверка
  такие случаи пропускает по построению: при разной валюте она сумму не сравнивает
  вовсе. Пересчёт по справочному курсу: Wollongong Dubai 23 %, Birmingham Dubai,
  Reading Malaysia и др. Отчёт — `CURRENCY-REVIEW.md`. Курс справочный, в данные не писался.
- [ ] **59 карточек `kompas_no_extract` — ждут решения по привязке QS,** это тот же
  вопрос, что и 53 кейса выше, только со стороны карточки.
- [ ] **Брак разбора кампусов у коллекторов.** У ema, englishpath, gbs-dubai, gbs-malta,
  global-banking-school, schiller в поле кампусов приезжают абзацы описания программ.
  Чинить на стороне сбора; в каталог это не переносилось.
- [ ] **271 кейс `kompas_fee_absent` закрыт прецедентом с устаревшей формулировкой.**
  Решение (`ignore`) верное — цену QS мы намеренно не пишем, — но текст прецедента
  29.07 говорит «у источника цены нет», а тут она есть, просто кампусная. Переписать
  примечание, когда будет решение по 342 кейсам цены: это один и тот же вопрос.

### QS — заведение новых карточек, вариант Б (2026-08-03)

- [x] **Решения владельца получены 2026-08-03.** MPW и ILAC **держим** — в каталоге уже
  живут такие же (`abbey-cambridge`, `abbey-manchester`, `abbey-dld-london`,
  `language-studies-international`), выкидывать их при живом прецеденте непоследовательно.
  PHBS **заводим** отдельной карточкой. Итого под заведение 9 записей, а не 7.
  Разбор — `sources/kompas/QS-NEW-CARDS-TRIAGE.md`.
- [x] **Пагинация — ЗАКРЫТО 2026-08-03** (`0c4e0b49`). Кнопочное «дожимание» не работало
  и не могло: у Falmouth «Load More» — скрытый Drupal-пейджер (`visually-hidden`,
  infinite scroll), у Worcester листалка — ссылки «1 2 3 …». Обе жмутся адресом
  (`?page=,N` и `&index=N`), ссылки снимаются с КАЖДОЙ страницы (у Falmouth переход
  заменяет карточки, а не дописывает). Заодно нашлось, что правило отбора ссылок у
  Falmouth било мимо: курсы лежат по `/study/<уровень>/<слаг>`, а не `/courses/<слаг>`;
  прежние 43 записи взялись по степени в тексте ссылки и притащили `/events/`.
  **Стало: Falmouth 102 программы (100 со сроком) + 18 разделов `kind: "hub"`,
  Worcester 245 программ (198 со сроком). Было 43 и 52.** У QS Falmouth 124, Worcester 212.
- [x] **Адаптеры PHBS, MPW, ILAC — СДЕЛАНО 2026-08-03** (`0c4e0b49`). Целятся в
  конкретные страницы под строки QS (у QS там 2, 4 и 1 программа), сайт не обходят:
  программы и цены — с агрегатора, офсайт только под срок и город.
  - **PHBS** — обе программы QS это Cross-Border MiF/MiM, их страницы на сайте
    британского кампуса: `pku.org.uk/Study/Cross_Border_Master_s_i{n,}_{Finance,Management}.htm`,
    «Duration → Two years». Срок взялся у обеих. Кампусы: год в Оксфордшире, год в Шэньчжэне.
  - **MPW** — на страницах уровня сразу ДВА срока («one year courses and two year
    courses»), одного значения нет; отдана улика, выбор оператору. У QS срок стоит
    в самом названии строки («1 year A Level», «2 year A Level»), у «GCSE Subjects» — нет.
  - **ILAC** — сайт прямо пишет: срок зависит от входного уровня английского
    (8–56 недель), фиксированного срока у программы нет. `durationYears` не берётся ниоткуда.
- [x] **Сведение офсайта с QS — СДЕЛАНО 2026-08-03.** `scraper/kompas-merge-offsite.mjs`
  (+ 13 тестов). Цена от QS (`campusLevelStated`), срок с офсайта либо из названия строки QS,
  город — за человеком. Выход: `sources/kompas/newcards/*.draft.json` (черновики),
  `newcards/cases.json`, отчёт `sources/kompas/QS-NEW-CARDS-MERGE.md`.
  **Живой каталог не тронут.** Итог: 191 программа в черновиках — Falmouth 93,
  Worcester 94, PHBS 2, MPW 2, ILAC 0. Кейсов оператору 182.
  - Пара ищется по названию QS против заголовка офсайта И слага адреса (берётся лучшее):
    у Worcester заголовок «Business Management» одинаков у базового курса и у top-up,
    различает их только адрес.
  - Вариант курса (нулевой год, практика, top-up) снимается с ОБЕИХ сторон и сверяется
    отдельно; если у варианта нет своей страницы, срок берётся с базовой и помечается
    спорным (у Falmouth в сыром тексте прямо «3 years / 4 years»).
  - Опечатки QS ловятся одной правкой Дамерау: «Television & Flim Production»,
    «Fine Arts» против «Fine Art», «Games Animation» против «Game Animation».
- [x] **Добор Worcester — СДЕЛАНО 2026-08-04.** Диагноз прошлой смены («дыра только
  в сборе») подтвердился наполовину: сбор действительно тёк, но остаток оказался
  браком нормализации названий, а не порогом сходства. Порог не тронут.
  - **Сбор.** У коллектора появился флаг `--merge`: выгрузка не перезаписывается, а
    дополняется; курсы сводятся по ключу «домен вуза + путь», `worc.ac.uk` и
    `worcester.ac.uk` считаются одним доменом. Плюс ретраи на страницах списка —
    поиск Worcester трижды подряд отдавал ноль адресов по таймауту, и без слияния
    такой прогон СТИРАЛ предыдущий (это случилось на первом же заходе, файл уцелел
    только благодаря флагу). Шесть прогонов: **было 246 страниц, стало 263**
    (со сроком 198 → 213). Пул адресов сошёлся: последний прогон дал 177 адресов,
    все уже известные. Страницы «animation» и «accounting» в выгрузке появились.
  - **Нормализация — два дефекта, оба видны на счёте пары.**
    1. `normTitle` не идемпотентна: `stripDegreeCode` на ВТОРОМ прогоне съедал «mphil»
       у «mphil phd law» (перед «phd» он выглядит кодом степени). На первом прогоне
       слэш в «MPHIL/PHD LAW» разбор закрывал, поэтому дефект вылезал только внутри
       `scorePair`, где нормализованный текст нормализуется снова. Строка QS
       расходилась со своей же страницей «LAW MPHIL AND PHD»: 0.67 вместо 1.0 — 17 строк.
       Починено: `tokensOfNorm` для уже нормализованного текста.
    2. Год приёма в адресе (`law-llb-hons-2024`, `…-hons-2022-entry`) считался словом
       названия и на один лишний токен ронял счёт до 0.67–0.75 — 6 строк.
       Починено в `urlSlugText`.
  - **Итог: пар у Worcester 106 → 135, в черновике 94 → 108 программ, «нет пары» 95 → 66.**
    Черновик полон по схеме (`_kompas.missing` пуст). Falmouth не сдвинулся ни на строку —
    правки его не задели. Тестов 13 → 15, все зелёные.
- [ ] **66 строк QS Worcester без пары — расхождения по существу, решать человеку.**
  Это уже не сбор и не нормализация. Три класса:
  - **страницы под строку у вуза нет** («BSc BUSINESS PSYCHOLOGY» → ближайшая
    `psychology-bsc-hons` 0.67; «BSc DATA SCIENCE» → `computer-science-bsc-hons` 0.50;
    «BA DIGITAL BUSINESS» и «MARKETING» → `business-marketing-ba-hons` 0.50).
    Похоже, QS перечисляет специализации внутри программы вуза;
  - **уровень у QS в хвосте названия, у вуза — отдельная страница другого уровня**
    («ACCOUNTING and FINANCE DIPHE» → страница `…-ba-hons`; «COUNSELLING FDSC» →
    `counselling-msc`; «CRIMINOLOGY FDA» → `criminology-ba-hons`). Садить их на
    страницу другого уровня нельзя — это была бы другая программа;
  - **код степени в начале строки QS без ответа в адресе** («BA CRIMINOLOGY with
    FORENSIC PSYCHOLOGY (HONS)» → `criminology-with-forensic-psychology`, 0.75).
    Лишний токен `ba` есть только у QS. Снимать код степени у QS СЛЕВА опасно:
    у Worcester уровень на офсайте почти везде `null`, и «BA X» с «MSc X» станут
    неразличимы. Нужно решение владельца.
- [x] **Города проставлены — 2026-08-03, решение владельца «что написано в QS, ставь,
  где кампусов несколько — оба».** Falmouth «Falmouth, Penryn», MPW «London, Birmingham,
  Cambridge», ILAC «Toronto, Vancouver», PHBS «Shenzhen, Oxfordshire» (учатся и там, и там).
  У Worcester города в описании QS НЕТ — взят с офсайта; json-ld того же сайта отдаёт
  графство «Worcestershire», его не брать.
- [x] **19 программ без уровня — ЗАКРЫТО 2026-08-03.** Уровень выводится по однозначной
  разметке названия и адреса (`levelFromMarks`): PGCE → master, A Level → sixth-form,
  GCSE → high-school, `ba|bsc|hons|joint-honours` → bachelor. Кредиты и срок в уровень
  НЕ пересчитываются. Кейсов «нет уровня» после правила — ноль.
- [x] **Цена PHBS — ПРОВЕРЕНА 2026-08-03 по офсайту.** `pku.org.uk`: «Tuition fee (2026/27)
  Year 1 Oxfordshire, UK £23,000; Year 2 Shenzhen, China £6,500» — итого £29 500, ровно
  как в шапке QS. Число 272 895 из выгрузки — та же сумма в юанях (курс ~9.25), поэтому
  валюты при ней и не было. В черновик поставлено 29 500 GBP.
  **Осталось решить человеку: это цена за ВСЮ программу (2 года), а не за год.
  Если поле хранит годовую — ставить 14 750.**
- [ ] **43 варианта курса Falmouth со спорным сроком — ОТЛОЖЕНО владельцем 2026-08-03.**
  На странице «3 years / 4 years»: 3 — базовый курс, 4 — вариант с нулевым годом или
  практикой. Строка QS просит вариант, отдельной страницы под него нет. Сейчас в черновик
  идёт срок базовой страницы с пометкой `needsCheck`. Если владелец утвердит правило
  «вариант = база + 1 год», оно применяется ко всем 43 разом одной правкой `pickDuration`.
- [ ] **16 программ без срока — НЕ ЗАВОДИТЬ (решение владельца 2026-08-03).** Срока нет
  ни на странице, ни в названии строки QS (MPhil/PhD, CELTA, PGCert, вся ILAC).
  В черновики они не попали; карточка ILAC из-за этого пустая — программ ноль.
- [ ] **49 программ Worcester без срока — кейсы оператору.** Проверено вручную: на
  страницах MPhil/PhD и части магистратуры срока нет на странице ВООБЩЕ (ни подписи
  «Duration», ни текста про годы). Это не промах разбора. По итогам сведения 2026-08-04
  таких строк, дошедших до пары, стало 31 (было 16): добор нормализации подсадил
  17 строк MPhil/PhD ровно на те страницы, где срока нет. В черновик они не идут.
- [ ] **Пекинский университет — отдельной карточкой, собирать не из чего.** У QS его нет:
  в выгрузке лежит только бизнес-школа (PHBS). Схема требует минимум одну программу
  с `durationYears` и ценой, значит карточку ПУ можно завести лишь отдельным сбором
  с `pku.edu.cn` — по объёму это задача уровня Falmouth или больше. Решение владельца
  2026-08-03: записать в backlog, PHBS заводить не дожидаясь головной карточки.
- [ ] **Коллекторы офсайтов, по вузу за раз.** Начинать с Falmouth (124 программы) и
  Worcester (212) — у них длительность на странице курса есть и берётся устойчиво.
  Замер разметки — `sources/kompas/QS-NEW-CARDS-MARKUP.md`, обходчик замера —
  `scraper/kompas-qs-newcards-crawl.mjs`.
- [ ] **KPU (107), Marshall (85), Mercy (68) — 260 программ без длительности на офсайте.**
  Учебные каталоги дают только кредиты. Пересчёт кредитов в годы запрещён (это вывод,
  а не источник). Заводить эти карточки можно лишь после ответа оператора в `/manager`,
  потому что схема требует `durationYears` у каждой программы.
- [ ] **Привязка 7 записей QS к живым карточкам** (`uwe-bristol`, `luiss`, `glion-switzerland`,
  `cesi`, `ucl`, `asu-london`, сеть `srh-*`) — 482 программы. Объёмом больше, чем заведение.
- [ ] **Починить разбор привязки: `verdict: absent` без подсказок врёт.** По всем 24 записям
  стояло «карточки нет вовсе», хотя у семи карточка есть и никем не занята. Тот же класс,
  что даёт 123 кейса `kompas_no_extract`.

### КОМПАС — хвост после сессии 6 (2026-07-26)

- [x] **Добор `officialUrl` — ЧАСТИЧНО ЗАКРЫТО 2026-08-10.** Wikidata (`discover-official-sites.mjs`)
  по этим вузам уже отработала и упёрлась: в `scraper/sources/official-sites-worklist.json` 196 записей
  с причинами «no-wikidata-entity» / «no-verified-site», проба на пяти дала 0 из 5. Зато у части
  карточек адрес лежал внутри них самих — программы собирались с офсайта, и домен вуза стоит в
  `programUrl` (у Бирмингема таких ссылок 372). `scraper/kompas-officialurl-from-links.mjs` берёт
  самый частый «свой» домен карточки при пороге ≥3 ссылок; агрегаторы и соцсети отброшены.
  **Проставлено 34 адреса, осталось без офсайта 165** (отчёт `sources/kompas/OFFICIALURL-FROM-LINKS.md`).
- [ ] **165 карточек без офсайта — нужен поиск, которого у нас нет.** Wikidata их не знает, своих
  ссылок в карточке нет (программы пришли с агрегатора). Дальше — либо поисковик (Exa/WebSearch,
  платно), либо руками.
- [x] ~~**Суммы стипендий в собранных выгрузках чинятся только повторным обходом.**~~ **СДЕЛАНО
  2026-08-10** (`f22a495b`). Прогон `--refetch` по 823 вузам: ok 323, ничего не найдено 246,
  недоступны 56, без адреса офсайта 198; записей 1866. Дефект оказался шире оценки в ~9 записей:
  **110 сумм переехали с USD на местную валюту (CAD 76, AUD 34)**, 11 получили «до …»,
  3 — пометку «/мес». Живой каталог не тронут — перебор пишет в выгрузки.
- [ ] **Перенести починенные суммы стипендий в каталог.** В живых карточках у этих 110 записей
  по-прежнему стоит USD — то есть недостоверность на сайте (канадская стипендия «$5,000»
  показана как 5000 долларов США). Переносит `kompas-scholarships-apply.mjs`; шаг меняет живой
  каталог, поэтому за владельцем.
- [x] ~~**Голый `$` в сумме всегда читается как USD.**~~ **ЗАКРЫТО в коде** (`lib/kompas-scholarships-parse.mjs`:
  `DOLLAR_BY_COUNTRY` + `resolveCurrency`, тесты на месте): голый знак читается по стране вуза
  (Канада → CAD, Австралия → AUD, Сингапур/Гонконг), а `C$`/`US$`/явный код валюты не трогаются.
  В данные приедет тем же прогоном `--refetch`.
- [x] ~~**Метка `kompasStatus` на программах срезается схемой сайта.**~~ **ЗАКРЫТО** — коммит
  `f57f109c`, `programSchema` объявляет `kompasStatus` и `kompasCheckedAt`
  (`site/src/schema/university.ts:42`). Проверено 2026-08-10: метка стоит у 333 карточек живого
  каталога на 21 621 программе, то есть до страницы вуза доезжает.
- [x] ~~**46 кейсов с одинаковым id внутри `direct-review.json`.**~~ **НЕ ПОДТВЕРДИЛОСЬ 2026-08-10.**
  Замер по всем 16 частям панели: 4940 кейсов, 4940 уникальных id, дублей ноль (в самом
  `direct-review.json` — 2170 кейсов, 0 дублей). Похоже, снялось свёрткой прайса 2026-08-03.
  Сборка панели дубли по-прежнему считает (`duplicatesDropped`), так что регресс будет виден.

### «Безопасные» режимы пишут в данные — починить флаги dry-run (найдено 2026-07-20)

Обнаружено при реализации среза 2 (БОБР-аудит). Оба бага откачены вручную, в коммиты не попали,
но выстрелят снова при следующем «пробном» прогоне.

- [x] ~~**`bobr.mjs --dry-run` не сухой.**~~ **ЗАКРЫТО 2026-07-31.** Сам проброс флага был починен
  ранее (в `bobr.mjs` `--dry-run` уходит во все фазы, все `bobr-*` скрипты его чтут — проверено
  grep'ом по `DRY_RUN`), оставался только сквозной тест. `bobr.mjs` добавлен в
  `scraper/dry-run-clean.test.mjs` (аргументы повторяют прогон-улику: `--dry-run --limit=3
  --skip-photos`, плюс `--skip-audit` — баг был в коллекторах фазы 1). Прогон: pass 1 / fail 0,
  дерево чистое. Историческая улика: прогон 2026-07-20 создал невалидный
  `university-of-the-west-of-england.json` и изменил 99 вузов (~91 000 строк из edvoy).
- [x] ~~**`soroka.mjs --slug=X` затирает общий review.**~~ **НЕ ПОДТВЕРДИЛОСЬ** (проверено 2026-07-21).
  Заявление пришло из отчёта субагента и оказалось неверным. Замер: кейсов в
  `site/public/api/soroka-review.json` до точечного прогона — 987, после — **987**. Меняются только
  метаданные `generatedAt` и `scope`. Scope-preserving логика (`keptItems`) работает штатно.
  Единственное, что действительно перезаписывается, — диагностический дамп
  `sources/audit/soroka-report.json` (в нём всегда только кейсы текущего прогона: 1 → 0).
  Это его назначение, не потеря данных: панель оператора читает review.json, а не его.
- [x] ~~Общее: сквозной тест «после любого `--dry-run` рабочее дерево чистое».~~ **СДЕЛАНО 2026-07-21** —
  `scraper/dry-run-clean.test.mjs` сравнивает `git status --porcelain` до и после сухого прогона
  (по содержимому, а не по mtime: скрипт может переписать файл тем же текстом). Покрыты
  `orel-apply.mjs`, `orel-hunt.mjs` и — с 2026-07-31 — `bobr.mjs`; все зелёные.

### Launch-readiness audit (2026-06-03) — чеклист по итогам полного аудита сайта+скрейпера

**✅ Сделано в сессии 2026-06-03 (закоммичено):**
- [x] **#1 Формы шлют лиды в CRM** — `site/functions/api/lead.js` (Cloudflare Pages Function, Bitrix24 `crm.lead.add` по умолчанию / generic-режим), фронт `[slug].astro` шлёт `fetch('/api/lead')` вместо пустого `form.reset()`. Honeypot, валидация, блок кнопки, тост-ошибка. Доп. поле email в CTA/модалку.
- [x] **#2 Контакты → единый источник** — `site/src/content/studyroom/contacts.ts` (`CONTACTS` + `waLink/tgLink/telLink`). Убран хардкод из `index.astro`, `compare.astro`, `[slug].astro`, `static.ts`.
- [x] **#3/#4 Статистика лендинга** — `AGENCY` в `contacts.ts`: 2015 / 1000+ / 99% / лет на рынке (авто) / счёт вузов (динамически). Убраны видимые `[год]`/`N%`/«27».
- [x] **#5 Баги схемы в `scraper/bobr-accommodation-merge.mjs`** — пустые `amount`/`description` стипендий, плоский `gallery`, пустой `programUrl` (все роняли build). Проверено zod.

**🔴 Блокеры запуска — нужны данные владельца:**
- [ ] Заполнить `contacts.ts`: реальные телефон / WhatsApp / Telegram / email / БИН / адрес.
- [ ] Видео-отзывы: залить на YouTube (unlisted), ссылки → в `STUDYROOM_REVIEWS` (`static.ts`), подключить секцию reviews в `[slug].astro` (сейчас `[TBD]`-заглушка; поле `videoUrl` в схеме готово). Не Google Drive для embed.
- [ ] Настроить env в Cloudflare Pages: `CRM_WEBHOOK_URL` (+ опц. `CRM_TYPE`, `LEAD_NOTIFY_URL`) — без него формы отдают ошибку.

**✅ Сделано в сессии 2026-06-03 (пачка 2, закоммичено, НЕ запушено):**
- [x] **Таймлайн** — `pickTimeline()` fallback `UK_TIMELINE` → новый `GENERIC_TIMELINE` (нейтральный, «за N мес до старта»). Затрагивало 292/804 вуза (Европа/ОАЭ/Азия видели UCAS-дедлайны). Коммит `aa25ad3`.
- [x] **Курсы валют** — единый источник `CURRENCY_TO_KZT`/`CURRENCY_SYMBOL`/`DEFAULT_KZT_RATE` в `static.ts`, импорт в `[slug].astro` и `UniversityCardV2.astro`. Коммит `aa25ad3`.
- [x] **Self-XSS в чате** — ввод юзера через `textContent`, HTML бота сохранён через `innerHTML`. Коммит `aa25ad3`.
- [x] **SEO** — `@astrojs/sitemap` (`sitemap-index.xml`, 806 url, `manager`/`admin` исключены), `robots.txt`, `favicon.svg` (был 404), `canonical` + `og:url/site_name/locale` + `twitter:card` в `Base.astro`, `noindex` на `manager`. Коммит `78fb056`. **og:image отложен** — нужен дизайн-ассет 1200×630 от владельца.
- [x] **Маппинг `master`** — `compare.astro:22` + `UniversityCardV2.astro:42`: `"Pre-Master's"` → `"Магистратура"`. 658 вузов с master-программами, лишь 1 — only-pathway. Per-program различие pathway/degree остаётся в `[slug].astro levelLabel()`. Коммит `1f1583d`.

**🟡 Важное (можно автономно, не блок запуска):**
- [ ] Хардкод требований (IELTS/GPA/финподтверждение) в секции `#requirements` `[slug].astro:719–729` игнорирует `u.requirements.*`. Часть — баг (GPA «4.0+» захардкожен, реальный `gpa` есть у 13/804; TOEFL/Duolingo подтягивать условно). Часть — **маркетинговое решение владельца**: тиры «IELTS 6.0 Pre-Master's / 6.5 магистратура» и весь Foundation/Pre-Master's питч — UK-pathway формулировка, показывается всем странам. Решить с владельцем, прежде чем чинить копирайт.
- [x] **140 JSON с `sourceHash: "sha256:placeholder"` (исправлено 2026-06-04, коммит `c578dd0`)** — заменены на детерминированный `sha256(slug|sourceUrl).slice(0,16)` (конвенция `create-missing-from-extracts.mjs`); следующий реальный скрейп перезапишет честным хэшем HTML. `qs-build-prompt.mjs` поправлен: формула вместо «any plausible value». Проверено: 0 плейсхолдеров, 140/140 JSON валидны.

**🟡 Скрейпер/инфра:**
- [x] **Проглоченные exit-коды** — `bobr.mjs`/`pauk.mjs`: сбой data-шага теперь валит пайплайн (`failedSteps` гейтит `ok` + в JSON-отчёте). Фото-фаза bobr остаётся soft. Коммит `99b35eb`.
- [x] **`revizor.mjs:197` сэмплинг** — `sort(()=>Math.random()-0.5)` (мутация на месте + нестабильные 404) → детерминированный шаговый сэмпл. Коммит `99b35eb`.
- [x] **Дедуп расписания** — bash-таблица `case $DOM` убрана; шаг detect читает `dayOfMonth` из `aggregator-schedules.json` (единый источник). Маппинг идентичен старому для всех 11 дней. Cron остаётся статичным (YAML не читает JSON), помечен как ручной-синк. Коммит `9911d5c`.
- [ ] IAPro не работает (нет кредов `IAPRO_LOGIN/PASS`, `exit(1)` проглочен `|| true`).
- [ ] Kaplan-коллектор не написан (день 1 зовёт `scrape-direct-partners-v2.mjs`, который Kaplan не обрабатывает).
- [x] **`verify-on-demand.yml` (исправлено 2026-06-04)** — `shmel` теперь soft (`continue-on-error`, обогащение опционально); `generate verify.json` soft + финальный гейт-шаг: частичные результаты revizor/shmel коммитятся, но ран помечается failed, если verify.json не сгенерился (паттерн bobr/pauk: не глотать, но и не терять).

**🟢 Техдолг:**
- [x] **Мёртвый код сайта (7 файлов, удалены 2026-06-04)** — `UniversityCard.astro` (v1, index использует V2), `catalog-filters.ts` (index грузит `catalog-v2`; DOM-id `catalog-filters` — живая форма, не скрипт), 5× `oxford-*.ts` (старый шаблон `[slug].astro` переписан в v2). Каждый проверен: импортеров 0. Build после удаления: 807 стр., exit 0.
- [x] **Мёртвые скрейпер-скрипты (10 файлов, удалены 2026-06-04, коммит `cc4d157`)** — граф проверен по всему репо: живые = `scrape-direct-partners-v2`, `scrape-volk-collab-v3`, `scrape-studygroup-all`; `overnight-volk-mukha.mjs` никем не зовётся → `scrape-volk-collab.mjs` (v1) и `scrape-mukha-api.mjs` транзитивно мертвы. ПАУК/БОБР-цепочки не затронуты (проверено: pauk зовёт qahe/gedu/edvoy/iapro/detect-gaps/shmel/merge-programs, bobr — только `bobr-*`). Удалены: overnight-orchestrator, overnight-v2-orchestrator, overnight-volk-mukha, mukha-v3/v4/v5-apex, mukha-api, volk-collab v1+v2, direct-partners v1. Фото-зоопарк не проверялся — отдельный заход.
- [x] ~~Стейл-мусор: `edvoy-scrape.log`, корневой `sources/revizor-flags.json` (дубль), `scraper-*.log` в корне.~~ **ЗАКРЫТО 2026-08-02.** Дерева не пачкает: корневого дубля `sources/revizor-flags.json` больше нет (остался один настоящий `scraper/sources/revizor-flags.json`), `*.log` покрыт `.gitignore`, `git ls-files "*revizor-flags.json"` пуст. Локально лежит только `scraper/edvoy-scrape.log` от 23.05 — вне git, удалить можно в любой момент.
- [x] ~~`site/public/api/status.json` коммитится и грязнит дерево → в `.gitignore`.~~ **ЗАКРЫТО** (дата не отмечена, обнаружено 2026-08-02): строка в `.gitignore` есть, `git ls-files site/public/api/status.json` → «did not match any file(s) known to git», то есть файл не отслеживается.
- [x] ~~i18n `/en` не начат; `deploy.yml` на `wrangler@latest` (незакреплённая версия).~~ **ЗАКРЫТО** (обнаружено 2026-08-02): `astro.config` → `locales: ['ru','en','kk']`, `defaultLocale: 'ru'`, маршрут `site/src/pages/[lang]/` на месте, словарь `site/src/i18n/ui.ts`. Версия закреплена: `deploy.yml:45` зовёт `npx --yes wrangler@4`, не `@latest`.
- [x] ~~Рабочее дерево захламлено 1159 неотслеживаемыми файлами~~ **ЗАКРЫТО 2026-08-02**, коммит `6de42623`. В `.gitignore` уехали кандидаты ОРЛА `site/public/photos/*/hunt-*.jpg` (1125 файлов, 2.1 ГБ — промежуточный результат, в git едут только применённые фото), их страница просмотра `site/public/orel-preview.html` (пересобирается скриптом, ссылается на локальные картинки) и снимок `sources/_faculty_backup_2026-06-19/`. `git status` пуст.

---

- **Stage 14b — Clean up & re-scrape the ~122 "no-official-site" universities (START 2026-05-27).** Skipped by the under-60 program expansion (waves 1-3) because their catalog JSON has no resolvable official URL. Lists on disk: `sources/under60-wave1.no-site.json` (76), `wave2.no-site.json` (31), `wave3.no-site.json` (15). Two categories:
  1. **Collab-sourced junk → DELETE (destructive, confirm list first).** Fake non-university entries from collabinternational.com with `country:"International"` and 6 identical bogus programs all titled "Study in Malta" — e.g. `academic-coaching`, `admission-consultancy`, `dcu-successfull-career-services`, `canadian-universities-to-elevate-your-career`, `berk-alyeni`. Show full filtered list before deleting anything.
  2. **Real universities with junk collab data → find official site + re-scrape.** Same garbage but legit institution, e.g. `aalto-university`, `czech-technical-university`. Need official-URL discovery (WebSearch/Exa — costs tokens), then `node scraper/expand-programs-verified.mjs --worklist=<file>` with `EXPAND_TARGET=1000` like waves 1-3.
  - Infra ready: `scraper/build-under60-worklist.mjs` (URL resolution) + expander `--worklist`/`EXPAND_TARGET` flags.
- **Stage 5.1 — Set up Decap OAuth** (manual, ~10 min). Follow `DECAP_OAUTH.md`: register a GitHub OAuth App, deploy `decap-proxy` Worker on Cloudflare, update `site/public/admin/config.yml` `base_url`.
- **Stage 6.1 — Connect Cloudflare Pages** (manual, ~5 min). Follow `DEPLOYMENT.md`: connect repo, build cmd `cd site && npm ci && npm run build`, output `site/dist`, attach custom domain.
- **Stage 5.1 — Set up Decap OAuth** (manual, ~10 min). Follow `DECAP_OAUTH.md`: register a GitHub OAuth App, deploy `decap-proxy` Worker on Cloudflare, update `site/public/admin/config.yml` `base_url`.
- **Stage 6.1 — Connect Cloudflare Pages** (manual, ~5 min). Follow `DEPLOYMENT.md`: connect repo, build cmd `cd site && npm ci && npm run build`, output `site/dist`, attach custom domain.
- **Stage 8 — English version (`/en/...`).** Currently RU-only. Either a `/en` route variant or a runtime toggle.
- **Stage 9 — Replace text wordmark with real StudyRoom SVG logo.** SVG asset exists at `studyroom-oxford-landing/sources/.../logotype_1.svg` (white-fill — needs a dark variant for the light header).
- **Stage 10 — Fill TBD content.** `site/src/content/studyroom/static.ts` has `[TBD: ...]` markers in reviews, about, and CTA contact info. Replace before launch.

## DONE

- 2026-09-08 — **Сверка живого каталога с агрегаторами: 1 081 потерянная цена возвращена, 5 карточек заведено, «расхождения» разобраны по причинам.**
  Прогон `kompas-live-vs-aggregators.mjs` дал 4 разряда расхождений. Разобраны все.
  **1. 1 326 цен QS, которых нет в каталоге, — причина не в непривязке.** 1 417 строк лежали в разряде `annual-loose` (сумма в 1.15–1.8 раза выше годового потолка самого же QS): `kompas-fees-apply.mjs` откладывал такие «оператору» и молчал. Решение владельца 08.09 — считать разряд ГОДОВОЙ ценой и писать (до порога цены за срок 1.8 не дотягивает, значит врёт диапазон портала, а не основа суммы); записано в `OWNER-DECISIONS.md`, счётчик `annualLooseWritten`. **Цен в каталоге 90 149 → 91 242, «у источника есть, у нас нет» 1 338 → 42.**
  **2. 150 расхождений цен > 2 % оказались браком ИСТОЧНИКА, а не каталога.** 43 из них — ловушка `pathway-stage-fee` у oxford-international (roehampton 18 980 GBP против 4 000 GBP: портал вешает на степень цену подготовки); 11 edvoy и 4 QS — правило минимума из всех агрегаторов (у bristol MSc Data Science каталог держит 18 000 GBP от kaplan против 36 500 у edvoy) и многовалютные кампусы Hult. Каталог прав во всех; после переприменения цен осталось 58.
  **3. 7 выгрузок oxford-international без карточки → заведено 5.** Новый `scraper/kompas-oi-newcards.mjs` по образцу edvoy-сборщика: страна ТОЛЬКО по валюте выгрузки, город — из Wikidata по самому вузу, иначе из поля `campus`/имени с подтверждением, что это поселение той же страны. Порядок ступеней выстрадан: с `campus` впереди Coquitlam College уезжал в «Ванкувер», а Whitecliffe — в «Берлин, Германия». `university-of-southampton-delhi` не заведён (0 программ), `whitecliffe` не заведён (OI даёт EUR, страну по валюте не вывести) — кейсы оператору.
  **4. 223 карточки без единой выгрузки разобраны `scraper/kompas-sourceless-cards.mjs`.** 15 — выгрузка висит на соседней карточке, и это НЕ механическая ошибка привязки: «INTO Stony Brook» подготовительный центр, а не сам Stony Brook, «Victoria University (Gold Coast)» другой кампус. Кейс на слияние, решает владелец. Остальные 208 (6 811 программ) не встречаются ни в одной выгрузке и ни в одной очереди — закрывается только обходом порталов, а доступов к закрытым порталам QS/edvoy в окружении нет.
  **Попутно: 254 «расхождения валют» — 252 не расхождения.** Портал пересчитывает ценник в свою витринную валюту (QS показывает британский Roehampton в USD), каталог держит валюту страны кампуса и прав. Сверка теперь делит их на разряды `foreign-quote` и `real`; настоящих осталось **2** (heriot-watt-dubai, hult — офшорные кампусы с попрограммной валютой).
  — evidence: `sources/kompas/LIVE-VS-AGGREGATORS.md`, `SOURCELESS-CARDS.md`, `oi-newcards-review.json`. Проверки: `audit-catalog.mjs --gate` GATE PASS, `npm run build` 3 235 страниц exit 0. Карточек 1 071 → 1 076, программ 124 252 → 124 265, цен 90 149 → 91 242, подтверждено агрегатором 77 184 → 78 292 (85.6 % → 85.8 %). Бэкапы живого каталога: `backups/live_pre-3.1_2026-09-08-03-21`, `…-03-42`.

- 2026-09-08 — **Класс бага «поле пишется, но до страниц не доезжает» закрыт сторожем; проверка рабочей копии перестала врать.**
  Поле, не объявленное в `site/src/schema/university.ts`, zod молча вырезает при чтении: скрипты пишут, отчёты видят, сборка зелёная — а на страницах пусто. Так уже терялись `kompasStatus` (чинили 29.07), `officialUrl` (02.09) и `partnerSource`. Вместо четвёртой починки по одной — **сплошной замер каталога против схемы**: `scraper/schema-fields-check.mjs` (только чтение, ненулевой код возврата при находке) плюс тест `scraper/schema-fields-check.test.mjs`, который гоняет его по живому каталогу И по рабочей копии, так что новое поле без объявления теперь роняет `node --test`.
  Замер нашёл **14 не объявленных полей**, все объявлены: `partnerSource` (все 1071 карточки — тип партнёрства и через какой агрегатор), `programs[].verified` (52 847 программ у 558 вузов — название подтверждено обходом офсайта), `_kompas` (след сборщика у 181 карточки), `photoSets.hero` (главный кадр у 11 вузов), `requirements.notes` + `requirements.language.pte/ieltsDiploma/pteDiploma/ieltsNotes` (пороги по уровням словами и PTE — ровно то, чего не хватало разговору о захардкоженных требованиях), `mergedFrom/mergedInto/mergedAt` (след слияния дублей сессии 6) и разметка QS у Eynesbury (`qsLevel`, `region`, `isPathwayCentre`, `pathwayParentSlug`). Вёрстка их пока не показывает — данные больше не теряются, показ отдельной задачей.
  **`kompas-workcopy-check.mjs` починен.** Он требовал `durationYears` у каждой программы, хотя схема сделала поле необязательным 20.08, и выдавал тысячи ложных нарушений, за которыми не было видно настоящих. Теперь проверяет срок только когда он есть — и **обе копии проходят чисто (1071 карточка, 0 нарушений)**. Заодно добавлена проверка, которой не хватало: `tuition.currency` из перечисления схемы — именно на `currency: null` у 61 карточки упал build 23.08; список валют читается из самой схемы, чтобы копия не разъехалась.
  — evidence: `scraper/schema-fields-check.mjs`, `scraper/schema-fields-check.test.mjs`, `scraper/kompas-workcopy-check.mjs`, `site/src/schema/university.ts`. Проверки: `node --test scraper/**/*.test.mjs` 207/207, `npm run build` 3220 страниц exit 0 (`logs/build-schema-fields.log`).

- 2026-09-02 — **Смена по плану владельца от 30.08: закрыты D, E, F, 3.21 и докторантура; A4 оказалась закрытой раньше, A1 упёрлась в вёрстку офсайтов.**
  **Докторантура в фильтре** (просьба владельца): в каталоге 3620 phd-программ у 304 вузов, чип уровня на странице каталога строится из данных и был, а на лендинге список уровней зашит руками — докторантуры не было. Кнопка добавлена в оба фильтра, ключ `lp.programs.lvlPhd` в ru/en/kk, подпись уровня больше не зашита строкой `'PhD'`. Термин выровнен: «Аспирантура» → «Докторантура» везде.
  **D — направления.** Канон-таксономия прогнана по выросшему каталогу: 41 843 программы получили `faculty`, «без направления» 52 689 (42 %) → 10 846 (8,7 %), занулено 0. Зеркалировано в рабочую копию — у `backfill-faculties.mjs` появился переключатель `KOMPAS_WORK_DIR`.
  **E — вес сайта.** `optimize-photos.mjs`: ширина ≤ 1600, качество 78, mozjpeg+progressive, **имена файлов не менялись** (пути в `photoSets` и манифесты сбора целы). 3392,7 → 1292,1 МБ, минус 61,9 %; переписано 1643 файла, 3731 оставлен как был, ошибок 0.
  **F — ссылка на цену.** У 42 900 программ из 124 592 `programUrl` вёл на агрегатор (edvoy 38 240, qs 1551, intostudy 1352, topuniversities 1345, collab 444) — посетитель уходил к конкуренту. Правило в `site/src/scripts/program-link.ts`: домен вуза оставляем, агрегатор подменяем офсайтом, офсайта нет — ссылки нет вовсе. **Попутно вскрыто, почему сбор офсайтов не помогал: `officialUrl` НЕ БЫЛ ОБЪЯВЛЕН В ZOD-СХЕМЕ** и вырезался при чтении (тот же класс, что был у `kompasStatus`); объявлен вместе с `officialUrlSource` и `officialUrlCheckedAt`.
  **3.21 — обещание подготовки.** Блок «IELTS ниже 6.0 — не блокер» звал на Foundation и Pre-Master's у всех подряд, а подготовки нет вовсе у **508 вузов из 1070**; ещё 46 держат только Foundation, 78 — только Pre-Master's. Текст выбирается по программам карточки, четыре варианта. Половина 3.21 про GPA оказалась закрытой раньше — подсказка по аттестату уже страновая.
  **A4 — фабрикованные цены Navitas: их нет.** Замер `kompas-navitas-fees-diag.mjs` по живому каталогу: 4679 программ, цена сошлась с выгрузкой 3998, подтверждена уровнем 34, **ничем не подтверждено 0**, совпадений с сид-полосой 0. В плане 30.08 задача числилась открытой ошибочно.
  **A1 — офсайт-сбор цен прямых партнёров НЕ РАБОТАЕТ общим сборщиком.** Разрешение владельца получено 02.09. Прогнаны 4 слага из 19: у sp-jain «программами» приехали 37 профилей преподавателей, у anglo-american — «Thank you» и заголовки новостей, у inti — названия факультетов; **цен не найдено ни одной**. Выгрузки откачены, в каталог не поехало. Нужен парсер на домен, а не общий проход.
  **3.12/F — офсайты добрать нечем.** Wikidata исчерпана: из 396 в очереди найдено 2 (349 вузов Wikidata не знает, 45 не прошли проверку). Добор из ссылок карточки даёт ещё 2. Остаток 393 закрывается только платным поиском или руками.
  **3.2 — «1842 непринятых решения» посчитаны неверно.** В review-файлах 4014 решений, из них терминальных (`resolved`/`ignore`/`applied`) 3981; данных требуют только 33 `kompas_fee_mismatch → update`, и их примечание говорит, что adopt-fees записал их ещё 29.07. Нужна точечная сверка, а не массовое применение.
  **C — SRH и METU закрыты решениями владельца.** SRH: партнёр вся группа, включая нидерландский Haarlem (карточек в каталоге четыре, не пять — `srh-international-college` и `srh-germany` это одна). METU: разделить, это два разных вуза — партнёрство «METU, Hungary» переехало с `milton-friedman-university` на `metropolitan-budapest` (Budapest Metropolitan University, 65 программ), с Milton Friedman метка снята. Правится только `partnerSource`, записано сразу в живой каталог и в рабочую копию — `scraper/kompas-owner-decisions-0902.mjs`, коммит `456c719a`.
  **Решение владельца по деплою:** пока НЕ мержить, ждём `CRM_WEBHOOK_URL`.
  — evidence: коммиты `7a09b183`, `f18fcdf9`, `b1ecefd8`, `24808fbe`; `sources/kompas/photos-optimize.json`, `sources/kompas/direct-nofees-collect.json`, `scraper/optimize-photos.mjs`, `scraper/collect-direct-nofees.mjs`, `site/src/scripts/program-link.ts`. Проверки: `npm run build` 3217 страниц exit 0 (трижды), `node --test` 203/204 — падает `src/sources/infer-level.test.ts`, это vitest-файл под `node --test`, предсуществующее.

- 2026-08-23 — КОМПАС, категория 1 закрыта почти целиком. Заведено 35 карточек / 1101 программа (каталог 852 → 887); выгрузок QS привязано 505 из 512, не привязано 5 (15 программ). Ядро сборки переиспользовано из `kompas-newcards-build.mjs`. Города — подтверждённые владельцем 23.08 плюс взятые из нашей же карточки головного вуза; записи без города не заводятся. Три ловушки закрыты на сухом прогоне: QS разводит один вуз бейджами уровня (Essex Online был тремя карточками, стал одной на 85; Auckland 274 + Foundation 8 → 280); имя после снятия бейджа сверяется с живым каталогом, иначе «Brunel University London - Foundation» дал бы второго Брунеля; Strathclyde Bahrain остался черновиком из-за неразобранной валюты BHD. Не заведены: University Bridge (у QS США, названный владельцем Саскатун — это мост, ложная наводка Wikidata), OI North America (нет города), Durham College и American Collegiate DC (0 программ). **Решение владельца по 3.3: кампусную цену QS писать как цену за ВСЮ ПРОГРАММУ; перед применением обязателен замер основы — это следующий шаг.** — evidence: `scraper/kompas-cat1-newcards.mjs`, `sources/kompas/newcards/cat1-applied.json`, `sources/kompas/newcards/cat1-cases.json`, `HANDOFF-2026-08-23.md`
- 2026-08-21 — КОМПАС, категория 1: привязка QS + пересверка — из 512 выгрузок QS 111 были не привязаны; пересчёт вёлся по `sources/kompas/extracts/qs` (а не по membership, который о привязке не знает). Привязано 64 выгрузки / 1591 программа: 27 по слагу (карточки, заведённые 20.08) и 37 по явной таблице — включая весь разряд «надёжно» из отчёта 02.08, то есть **задача 1.6 закрыта**. Ловушка: выгрузка `global-banking-school` совпадала по слагу с лондонской карточкой, хотя у QS это Мальта — сверка страны отвела её на `gbs-malta`. Две записи портала помечены `notAnInstitution`. Пересверка: сверено 607 вузов (было 553), `kompas_no_extract` 150 → 126 карточек, новых ноль, все 24 ушедшие — из таблицы привязки; кейсы `kompas_qs_link` (1.8) 53 → 25. Разряды «нет в карточке» выросли (programs_missing 207 → 239) — привязка показывает источник, но программы не переносит, это задача 1.9. Решения панели 743 → 739 (4 сироты — отработавшие кейсы no_extract). Осталось 45 выгрузок / 1294 программы, разобраны по разрядам владельцу. — evidence: `scraper/kompas-qs-relink-cat1.mjs`, `sources/kompas/CAT1-REVIEW.md`, `sources/kompas/qs-relink-cat1.json`, откат `sources/kompas/qs-relink-cat1-backup.json` и `sources/kompas/diff-review.before-2026-08-21.json`
- 2026-08-03 — **Три пункта, одобренные владельцем 2026-08-03, закрыты; ветка `feat/kompas`
  влита в `main`.**
  **(1) Navitas — выдуманные цены.** Замер `scraper/kompas-navitas-fees-diag.mjs` (только
  чтение) показал: в живом каталоге фабрикованных сид-цен уже НЕТ. У 10 британских вузов
  3208 программ, 2760 цен сходятся с выгрузками Edvoy по названию и сумме, расхождений 0,
  434 программы без цены и честно показывают «уточняется». Оставшиеся 14 — варианты
  написания реальных записей Edvoy с той же суммой. Настоящая мина была в другом:
  `seed-navitas-uk.mjs` собирает карточку с нуля и затирает `programs` и `tuition` целиком,
  а `smoke-test-all.mjs` запускал его без сухого прогона прямо в живой каталог — боевой
  прогон стёр бы 2577 программ выгрузок и вернул полосы `UK_FEE_BAND_BASE`. Починено
  (`02c5627b`): цены из литеральной таблицы требуют явного `feeProvenance='source-confirmed'`,
  `planWrite` не даёт перезаписать карточку богаче сида без `--force` и переносит настоящие
  цены, smoke-test гоняет сидеры с `--dry-run`; критерий в `kompas-fix-navitas-prices.mjs`
  протух и снял бы 218 настоящих цен — заменён на «программу не знает ни одна выгрузка».
  Проверено: боевой прогон сидера пропускает все 10 карточек, каталог не тронут. 8 тестов.
  **(2) Пересчёт `direct-review.json`** (`0e530bf8`). 164 → 2170 кейсов, все 157 принятых
  решений нашли свои кейсы, конфликтов 0. По уроку 9 кейсы прайса сведены: построчно вышло
  бы 3265, но одна сумма стоит против десятков подписей (galway 2 500 EUR — 20 бакалавриатов,
  toronto-school-of-management 950 USD — 30). Кейс теперь на пару «вуз + сумма + валюта +
  аудитория», подписи в `labels`, строки в `members`; сведено 1095 строк. Заодно закрыта
  дыра в `kompas-panel.mjs`: `/manager` коммитит решения прямо в панель, а сборщик собирал
  её заново из частей и стёр бы 829 решений оператора — теперь переносит, а решения без
  кейса уезжают в `sources/kompas/panel-orphan-decisions.json`. Панель: 2791 → 4940 кейсов,
  решений 1140. +16 тестов.
  **(3) Голый `$` → валюта по стране вуза** (`00d38b31`). Подменяется только голый знак;
  `C$`/`A$`/`NZ$`/`US$` и явный код не трогаются, `numbers.mjs` намеренно не изменён (его
  зовёт СОРОКА на ценах каталога). Карта узкая: CA, AU, NZ, SG, HK. +9 тестов к 26.
  Замер: из 453 собранных записей с суммой валюту сменят 118 (Канада 68, Австралия 45,
  Новая Зеландия 5) — применится на сетевом прогоне `--refetch`.
  Сборка сайта зелёная (2476 страниц), весь набор `node --test` — 133 зелёных.
  **Ждёт владельца:** 757 осиротевших решений (`kompas_fee_mismatch` 729,
  `kompas_fee_mismatch_rest` 18, `kompas_fee_absent` 10), все `applied=false`. Их часть
  `fee-mismatch-review.json` даёт сейчас 0 кейсов — порог отсёк 1723 записи. Решения приняты,
  но не применены, и кейсов под ними больше нет. Не регрессия пересчёта: так было и раньше,
  просто терялось без следа.

- 2026-07-21 — **СРЕЗ 3, массовый прогон МОТЫЛЬКА: 289 вузов из 807 получили кандидатов
  (36%), 1242 фото.** 5745 запросов к Wikimedia, **торможений 429 — ноль**, неудачных ответов
  ноль: починка лимитов подтверждена на объёме, а не на пилоте. Провенанс полный (лицензия +
  автор) у 1230 из 1242 — **лицензионный долг CC BY-SA закрыт**, кроме 12 снимков.
  **Каталог не изменён**: все 1242 ушли кейсами оператору, автозамен ноль (режим `--no-auto`).
  Три бага, найденных замером по ходу прогона: (1) 429 при СКАЧИВАНИИ картинок — первая
  починка охватила только api.php, а `upload.wikimedia.org` остался без очереди, из-за чего
  выпадали хорошие кадры; (2) ведущий артикль «The» ломал сверку с Wikidata у 18 вузов
  (вернуло Melbourne, Sydney, Oxford); (3) `orel-hunt --worklist` стирал общий файл кандидатов —
  догон по 16 вузам снёс 1225 результатов, спасла ручная копия. Все три починены,
  третий проверен: 1242 до точечного прогона → 1242 после. Пороги качества MIN_SIDE 900,
  MIN_BPP 0.10, MIN_SAT 0.03 — каждый взят по замеру выборки, не на глаз.
  Тесты 58/58, validate 807/0, build 2428 стр. exit 0.
  Открытый вопрос вкуса: слабые кадры (парковка, дождь) числовыми признаками не ловятся —
  отбор за оператором в панели. Evidence: `sources/audit/orel-pilot-eyeball.md`.

- 2026-07-21 — **СРЕЗ 3 (фото/галерея, ОРЁЛ) — половина: пометка сделана, регрессия поиска закрыта.**
  Ветка `feat/orel-photo-fidelity` (в main НЕ влита, финальный merge за владельцем).
  Замер опроверг отчёт среза 2: «2309 карточек помечены stock» покрывало лишь 54% объёма —
  `mark-stock-photos.mjs` знал один признак (путь `/photos/_lib/`) и не обходил галерею.
  Факты по 807 файлам: 7074 ссылки на фото, уникальных по содержимому (sha1) — 2854, т.е.
  **4287 ссылок (61%) ведут на картинку другого вуза**; у 235 вузов ВСЯ галерея чужая;
  одна картинка стоит в галерее у 64 вузов. Провенанса не было ни у одного из 2854 изображений.
  Сделано: `lib/photo-fingerprint.mjs` (sha1 + перцептивный dHash), `lib/photo-classify.mjs`
  (verified/stock/shared/unknown), `orel-audit.mjs` (реестр `sources/photo-registry.json` + пометка,
  НИЧЕГО не удаляет), поля `img*` в Zod-схеме, подписи «Иллюстративное фото» в `LandingBody.astro`
  (728 страниц), `prune-orphan-photos.mjs` (диск 1.5→1.1 ГБ, 1152 осиротевших файла).
  **Все 7074 фото классифицированы** (stock 3647, unknown 2787, shared 640, verified 0 — провенанса
  взять было неоткуда). Тесты 50/50, validate 807/0, build 2428 стр. exit 0, идемпотентно.
  **Регрессия МОТЫЛЬКА закрыта замером:** три прогона подряд отчитывались «Wikimedia-кандидатов 0»,
  и откат кода результат не возвращал. Причина — **HTTP 429**: 40 запросов к Commons пачкой дают
  32 отказа с `Retry-After: 19`, а общий `catch { return null }` делал лимит неотличимым от
  «файла нет». Штраф накопительный, поэтому чинили код, а тормозил счётчик на стороне Wikimedia;
  прежняя проверка «Wikidata отвечает штатно» проходила ровно потому, что это был ОДИН запрос.
  Лечение — `lib/wikimedia.mjs`: общая очередь (~1 запрос/с), уважение `Retry-After` с повтором,
  `ThrottledError` вместо молчаливой пустоты, пакетные запросы (2 запроса на вуз вместо 41),
  счётчики торможений в отчёте прогона. Замер после: acadia 0→41 кандидат, cranfield 0→40,
  bristol 41, торможений 0, автор известен у 41 из 41. Коммит `5da07082`.
  **НЕ СДЕЛАНО (переходит дальше):** сама замена фото, `orel-preview.mjs`, `orel-apply.mjs`,
  вкладка ОРЁЛ в `manager.astro`. Спека: `docs/superpowers/specs/2026-07-21-photo-gallery-fidelity-design.md`,
  план: `docs/superpowers/plans/2026-07-21-orel-photo-fidelity.md`,
  визуальные проверки: `sources/audit/orel-pilot-eyeball.md`.

- 2026-07-21 — **СРЕЗ 2 (достоверность жилья и кампусов, БОБР) — PR #51 смёрджен в main** (merge
  `354deda7`, автодеплой Cloudflare success). Замер опроверг посылки спеки среза 1: жильё есть
  у 430 вузов (не ~29), кампусы у 668, а в extract-источниках домена почти нет — «merge несёт
  accommodation/campuses» переносить нечего. Настоящая проблема оказалась в недостоверности:
  `source` у 2 карточек из 1401, `verifiedBySite` у 0, 974 карточки (70%) — русский текст,
  написанный вручную, **102 цены у 18 вузов захардкожены литералами** повторяющейся «лесенкой»
  £140–195/нед (нарушение правила «не фабриковать»). `bobr-verifier.mjs` существовал, но был
  выключен флагом `--skip-verifier` и всё равно сверял бы с агрегатором. Сделано:
  `lib/official-site.mjs` (SSOT резолва офсайта), `lib/accommodation-match.mjs`, `bobr-audit.mjs`,
  `bobr-apply.mjs` + workflow, `mark-stock-photos.mjs`, вкладка БОБР в manager; `bobr-verifier.mjs`
  удалён. Прогон 807 вузов, 0 ошибок: **404 карточки подтверждены офсайтом, 1529 кейсов ждут
  владельца в /manager** (not_found 879, no_page 415, no_official_site 235). Из каталога ничего
  не удалено — решение владельца. Тесты 27/27, build 2428 стр. exit 0, validate 807/0.
  Спека: `docs/superpowers/specs/2026-07-20-accommodation-campuses-fidelity-audit-design.md`.

- 2026-07-20 — **СРЕЗ 1 (канонические факультеты) — PR #50 смёрджен в main.**
  `lib/canonicalize-faculty.mjs` (чистая функция raw+title→канон|null, идемпотентна) +
  `backfill-faculties.mjs`. Прогон: **1677→12 значений, 74018 программ, 807 файлов**. Встроено
  в `merge-programs.mjs`, поэтому будущие скрейпы сразу дают канон. Build 2428 страниц, exit 0.

- 2026-05-15 — `/v2` promoted to the main `/` route. User decision: "Это будет основной сайт". (1) `site/src/pages/index.astro` overwritten with the v2 layout (HeroV2 + KPI bar + trust-strip + UniversityCardV2 grid + compare bar + final-cta + `<Filters />` panel) — net `+170 / -334` lines vs the old hero+`UniversityCard` shell. Title cleaned from "(v2 preview)" to plain "StudyRoom — каталог зарубежных университетов". Form id stays `catalog-filters` so the `<Filters />` component (the "old filter" — chip toggle, country select, GBP-tuition range, IELTS cap, scholarship toggle) drops in untouched and `catalog-v2.ts` script binds to the same canonical ids. (2) `site/src/pages/v2.astro` removed via `git rm` since its content now lives at `/`. (3) `site/astro.config.mjs` gained `redirects: { '/v2': '/' }` so the previous-session URL pattern (`/v2/?maxTuition=124000`) keeps resolving — Astro emits `dist/v2/index.html` with `<meta http-equiv="refresh" content="0;url=/">` + `<link rel="canonical" href="https://studyroom.kz/">` + `robots=noindex`. Query strings are NOT preserved through the meta-refresh, but the URL doesn't 404. Old `UniversityCard.astro` + `catalog-filters.ts` are now dead code (only `/` used them) but left in-tree as a small cleanup follow-up. Built locally (41 pages, 73s) and deployed via `npx wrangler pages deploy dist --project-name=studyroom-project-site --branch=main --commit-dirty=true` — preview at https://f3e54677.studyroom-project-site.pages.dev, alias `studyroom-project-site.pages.dev/` smoke-tested 200 (new layout), `/v2` smoke-tested 200 with the expected meta-refresh redirect to `/`. — evidence: `site/src/pages/index.astro` (rewrite), `site/astro.config.mjs` (`redirects` key), `git rm site/src/pages/v2.astro`. Commit `0a3abdd` on `main`.

- 2026-05-15 — `/v2` catalog prototype recoloured to brand green + original filter restored. Previous session shipped `/v2` with WhatsApp-tinted CTAs (`#25d366` / `#1da851`) on the hero/card/final CTA buttons and an inline bespoke filter block — neither matched the per-uni landings. Fix: (1) every `background: #25d366` / `#1da851` (3 sites — `HeroV2.astro` primary CTA, `UniversityCardV2.astro` `__wa` hover, `v2.astro` `.final-cta__btn` + the same rule mirrored into `compare.astro`) swapped to `var(--color-primary)` / `var(--color-primary-dark)` (`#00950f` / `#007a0c` from `brand.css`, identical to `oxford-landing.css :root --green`). (2) `v2.astro` reverted its 80-line inline `<div class="filterbar">…</div>` chip+range+slider markup to a single `<Filters countries levels faculties tuitionMax />` invocation — same component the canonical `/` uses, so v2 inherits the chip toggle behaviour, GBP-tuition range, IELTS cap and scholarship toggle from one place. (3) The custom `-v2`-suffixed DOM ids (`catalog-filters-v2`, `catalog-grid-v2`, `catalog-filters-toggle-v2`, …) were renamed to the canonical ids so the in-page form, `Filters.astro`'s field `form="catalog-filters"`, `catalog-v2.ts`'s id constants and the new `HeroV2.astro` search input all bind to the same `<form id="catalog-filters">`. `HeroV2.astro`'s WhatsApp CTA label tightened from "15 мин с куратором в WhatsApp" to "15 мин с куратором" to keep the dual-CTA row balanced. `compare.astro` gained the matching `.final-cta__btn` block (was missing — page rendered an unstyled link). DEPLOYMENT.md rewritten to document the actual manual `wrangler pages deploy` flow + the 3 Pages projects (`studyroom-project-site`, `studyroom-redesign`, `studyroom-glasgow-v2`) since Cloudflare's GitHub auto-deploy is **not** connected. Built locally (`site/dist`, 42 pages, 88s) and deployed to production with `npx wrangler pages deploy dist --project-name=studyroom-project-site --branch=main --commit-dirty=true` — preview at https://0bc25d0a.studyroom-project-site.pages.dev, alias https://studyroom-project-site.pages.dev/v2/?maxTuition=124000 served the same build. — evidence: `site/src/components/HeroV2.astro` (CTA + search form id), `site/src/components/UniversityCardV2.astro` (WA hover), `site/src/pages/v2.astro` (filter inlining removed, ids renamed, CTA recolour), `site/src/pages/compare.astro` (`.final-cta__btn` block added), `site/src/scripts/catalog-v2.ts` (id constants), `DEPLOYMENT.md` rewrite. Commit `993ca84` on `main`.

- 2026-05-12 — Stage 11 (slice 4 pilot): per-uni photo sets — 4 categorical galleries rendered on the landing page. **Schema:** new optional `photoSetsSchema = { general?, studentsFaculty?, campuses?, accommodation? }` (each an array of `galleryItemSchema`), mirrored on both scraper + site sides, added to `universitySchema` as optional `photoSets`. **One-shot script** `scraper/pilot-photo-sets.mjs`: pulls photos from 3 sources per category — (1) `general` from Wikimedia Commons via hand-curated file titles in inline `WIKIMEDIA_SEEDS` (resolved via Commons `action=query&prop=imageinfo` API), (2) `campuses` from a second list of Wikimedia file titles per uni, (3) `studentsFaculty` from Kaplan partner page `<img>` set with inverse scoring (`scorePeoplePhoto` adds positive points for `students having|cheering|orientation|graduation|laboratory|library-reading` and negative for `exterior|aerial|tower|cathedral` — exactly the inverse of `download-photos.mjs`'s building-positive scorer), (4) `accommodation` from Kaplan accommodation page (`a[href*="/accommodation/"]` link discovery + image scan). Skip-if-cached behavior on writes so re-runs are cheap. Photos save to `site/public/photos/{slug}/{general,campuses,students,accommodation}/{N}.jpg` (subdirs per category to avoid clashes with the legacy single-pool layout). JSON patch appends the new `photoSets` object with relative URLs + captions, leaving existing fields untouched. **Page rendering:** 4 new sections inserted right after `<section id="description">` in `[slug].astro`. Each section conditionally renders only when its category has photos — sections with 0 photos are silently skipped so unis without the pilot data fall through to the legacy `gallery` section unchanged. New CSS rules `.photo-set`, `.photo-set__grid` (`grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px;`), `.photo-set__tile` (aspect-ratio 4/3, hover scale 1.04, caption fade-in via gradient overlay), responsive 2-col at ≤600px. **Glasgow pilot results:** `general=10, campuses=4, studentsFaculty=4, accommodation=6` (24 total). The user asked for 10×4=40; we hit 10/10 on `general` because Wikimedia has plenty of well-tagged Glasgow building/cloisters/library photos, but the other categories exhaust at 4-6 because (a) the curated Wikimedia file list for `campuses` only has 4 entries so far, (b) Kaplan's Glasgow page surfaces only ~4 distinct people-shots above the scoring threshold, (c) Kaplan accommodation page has 6 distinct images. Filling to 10/10 in each category requires (a) expanding the `campusFiles` list with Sir-Charles-Wilson / Wolfson-Medical / James-McCune-Smith / etc., and (b) adding a secondary student-life source (gla.ac.uk student life pages). **Plumbing kept narrow:** schema is optional, page sections conditional, photo dirs co-exist with legacy `site/public/photos/{slug}/{1..10}.jpg` from `download-photos.mjs` — both work side-by-side, no migration needed. **Pilot scope: Glasgow only**; other 17 unis will pick up the same 4 sections once their `WIKIMEDIA_SEEDS` entries are filled. — evidence: `scraper/src/schema.ts` + `site/src/schema/university.ts` (`photoSetsSchema` + optional field), `scraper/pilot-photo-sets.mjs` (new, ~240 lines: WIKIMEDIA_SEEDS, resolveWikimediaUrl helper, scrapeKaplanImages with inverse scoring, fetchKaplanAccommodationImages with link discovery, processSlug pipeline), `site/src/pages/[slug].astro` (4 new conditional sections after description + `.photo-set` styles), `site/public/photos/glasgow/{general,campuses,students,accommodation}/` (24 new JPGs), regenerated `site/src/content/universities/glasgow.json` with `photoSets` key.

- 2026-05-12 — Stage 11 (slice 3): real scholarships replace TBD placeholder on every uni landing. **Schema:** `scholarshipSchema` extended with `nameRu?`, `amount?` (free-form string replaces the old rigid `amountUSD?: number`), `description?`, `descriptionRu?`. Mirrored both sides. **Curated module** `scraper/src/sources/uni-scholarships.ts`: exports `BASELINE_KAPLAN_SCHOLARSHIPS` (2 universal scholarships every Kaplan applicant qualifies for — Kaplan Early Bird до £2,000 + Kaplan Academic Achievement до £4,000, both with bilingual descriptions and source URL to kaplanpathways.com/how-to-apply/.../scholarships-for-international-students/) plus a `UNI_SPECIFIC` dictionary keyed by slug carrying additional uni-funded scholarships (Glasgow → Glasgow International Leadership £10,000 + Chevening full-coverage; Bristol → Think Big Undergraduate £6,500-£20,000 + Think Big Postgraduate £10,000-£25,000; Liverpool → VC International £2,500-£5,000; Westminster → Westminster International full + VC 50%; York → York International £6,000; Nottingham → Developing Solutions 50-100%; etc. — 1-2 entries per uni for all 18). Each entry has hand-translated `nameRu` + `descriptionRu` per StudyRoom convention. **CLI:** new `buildScholarships(slug)` in `cli.ts` returns `[...BASELINE, ...UNI_SPECIFIC[slug]]` mapped to the `Scholarship` schema shape (omits empty optional fields cleanly). Called from `buildUniversity()` replacing the hardcoded `scholarships: []`. **Page:** `[slug].astro` scholarship section rewritten to use a new `.scholarships__list/__item/__head/__name/__amount/__desc/__meta` markup; renders Russian name + amount pill + Russian description + optional deadline + "подробнее" link, falls back to English when Russian missing. New CSS block in `site/src/styles/oxford-landing.css` for the card layout (white card with border, green amount pill, hover-friendly link underline). **Results:** every uni now shows 3-4 real scholarship entries with amounts; TBD placeholder gone from all 18 landings. Verified live: glasgow shows 2 Kaplan + 2 Glasgow-specific (£10,000 Leadership, Chevening Full Coverage); bristol shows 2 Kaplan + 2 Think Big tiers; westminster shows 2 Kaplan + 2 Westminster-specific (full tuition + 50%); alberta shows 2 Kaplan + 1 Alberta-specific (CA$5,000). — evidence: `scraper/src/schema.ts` + `site/src/schema/university.ts` (scholarship field expansion), `scraper/src/sources/uni-scholarships.ts` (new, ~210 lines), `scraper/src/cli.ts` (Scholarship type alias + buildScholarships helper + buildUniversity call site), `site/src/pages/[slug].astro` (section rewrite), `site/src/styles/oxford-landing.css` (`.scholarships__list` block ~50 lines), all 18 `site/src/content/universities/*.json` (regenerated with `scholarships` array).

- 2026-05-12 — Modal "Подробнее" pill no longer overlaps program titles (user feedback: Image #1 showed `PRE-MASTER'S / МАГИСТРАТУРА` pill spilling over `MSc Ancient Cultures` title in Glasgow's Arts & Humanities modal). **Two coordinated fixes in `site/src/pages/[slug].astro`:** (1) **Shorter, semantically correct labels.** Replaced the dual `LEVEL_LABELS.master = "Pre-Master's / Магистратура"` string (24 chars uppercased, ~200px wide, never fit the 120px column) with two distinct labels driven by `programType`: new `levelLabel(level, programType)` helper returns `"Pre-Master's"` for `level=master & programType=pathway` (1-year prep, NOT a master's degree) and `"Магистратура"` for `level=master & programType=degree` (actual MSc/MA). The visual category is unchanged (same amber pill color for both via `.programs-modal__level--master`), but the text now matches the row's content type. (2) **Safety-net column width.** Changed `.programs-modal__row` grid from `120px 1fr auto` to `minmax(120px, max-content) 1fr auto` so the level column grows to fit naturally even when a future translation lengthens a label. Verified live on `/glasgow#programs` (Arts and Humanities modal): foundation row shows "FOUNDATION", pathway rows show "PRE-MASTER'S", MSc/MA rows show "МАГИСТРАТУРА", no overlap. Inline expand panel (the "Подробнее" preview before opening the modal) also picks up the new label via the same helper at line 385. — evidence: `site/src/pages/[slug].astro` (`LEVEL_LABELS.master` shortened, new `levelLabel()` helper, two call-site updates at line 385 + line 422, `.programs-modal__row` grid column widened to `minmax(120px, max-content)`).

- 2026-05-12 — Stage 11 (slice 2): per-uni description + facts available in Russian, page prefers Russian when present. User feedback: "если Лэндинг на русском, переведи все на русский (название направлений и сайтов оставь на английском)". **Schema:** `descriptionSchema` gained two optional fields `paragraphsRu: string[]` and `keyFactsRu: string[]` (mirrored on both `scraper/src/schema.ts` + `site/src/schema/university.ts`). **Translation module:** new `scraper/src/sources/description-translations.ts` (370 lines) — hand-curated Russian translations of all 18 unis' Kaplan partner page "About" copy. Same module pattern as `campus-facts.ts` / `uni-accommodation-facts.ts` (curated TS data + slug-keyed lookup function); translations survive every re-scrape because they live in code, not in the JSON. **Translation conventions documented inline:** narrative prose fully translated; faculty/program names ("Arts and Humanities", "Engineering") kept English per StudyRoom landing convention; brand/source citations (Times Higher Education, Complete University Guide, QS, Russell Group, Kaplan International College, AACSB, etc.) kept English; uni long names case-by-case ("University of Glasgow" → kept English mid-sentence for brand consistency; "Glasgow" → "Глазго" when referring to the city; "U of A" → kept English as a known abbreviation); ordinal rankings translated systematically — "5th in the UK" → "5-е место в Великобритании", "Joint Nth in the UK for X" → "Совместное N-е место в Великобритании по X", "Top N in the world" → "Топ-N в мире", "#N in Canada" → "№N в Канаде". **CLI wiring:** `buildDescription(main, slug)` in `scraper/src/cli.ts` now takes a `slug` parameter, looks up translations via `getDescriptionTranslation(slug)`, attaches them when non-empty. Log line `[desc]` now reports both counts: `glasgow · 4 paragraphs (+4 ru), 8 facts (+8 ru)`. **Page wiring:** section 3 of `[slug].astro` wrapped in an IIFE that picks `paragraphsRu/keyFactsRu` first, falls back to `paragraphs/keyFacts`, then to the TBD placeholder. So a missing translation never breaks rendering — if Kaplan adds a new uni and translations haven't been written yet, the English scraped content shows instead. **Results:** all 18 unis now have 4 RU paragraphs + matching RU facts (4 ru paragraphs + 0-10 ru facts depending on uni). Verified live: glasgow renders "Имея более 550 лет истории, University of Glasgow в Шотландии — один из старейших..."; bristol renders "Основанный в 1876 году, University of Bristol..."; victoria renders "UVic — научно-ориентированный и прогрессивный..."; the Рейтинги и факты list shows e.g. "5-е место в Великобритании (Times and Sunday Times Good University Guide 2025)". Source name "Times and Sunday Times Good University Guide" stays English exactly as requested. Faculty names in the topFaculties list ("Engineering", "Business and Management", "Arts and Humanities") also stay English. — evidence: `scraper/src/schema.ts` + `site/src/schema/university.ts` (optional `paragraphsRu`/`keyFactsRu`), `scraper/src/sources/description-translations.ts` (new, ~370 lines, 18 unis with paragraphsRu + keyFactsRu where applicable), `scraper/src/cli.ts` (buildDescription signature change + translation merge + `[desc]` log refinement), `site/src/pages/[slug].astro` (section 3 IIFE with Russian-preferred picker), all 18 `site/src/content/universities/*.json` (regenerated with `description.paragraphsRu` + `description.keyFactsRu`).

- 2026-05-12 — Stage 11 (slice 1): per-uni `description.paragraphs[]` + `keyFacts[]` populated from the Kaplan partner page. **Scraper:** `scraper/src/sources/kaplan.ts` extractor widened from "first `<p>` only" to "walk 5 selector tiers (`.university-description p`, `[class*="about"] p`, `main article p`, `main section p`, `main p`) and harvest up to 4 narrative paragraphs with content filters" (skip cookie/newsletter/short blurbs, require >= 60 chars, dedupe). New helper `isFact(text)` routes ranking-shaped lines (`^Nth in the UK`, `^Joint Nth in...`, `^Top N`, `^Ranked N`, `^#1 in the USA`, `^Over 30,000 students`, `^Founded in 1451`, `^550 years of...`) to `keyFacts[]` instead of `paragraphs[]`. Length cap on facts at < 100 chars so narrative paragraphs starting with "Founded in 1876, the University of Bristol has..." stay in `paragraphs[]`. **Schema:** new `descriptionSchema = { paragraphs: string[]; keyFacts: string[] }` mirrored on both sides (`scraper/src/schema.ts` + `site/src/schema/university.ts`); `universitySchema.description` optional. **CLI:** new `buildDescription(main)` helper in `scraper/src/cli.ts` (returns `undefined` when both arrays empty so the page falls back to the `[TBD]` placeholder); `processOne` writes it onto the validated University. **Page:** `[slug].astro` section 3 — replaced the static `<span class="tbd">[TBD: исторический контекст...]</span>` block with a conditional `u.description?.paragraphs?.map((para) => <p>{para}</p>)` + a new `<h3>Рейтинги и факты</h3>` + `<ul>` for `u.description?.keyFacts`, both gated on `?.length`. **Astro cache gotcha (per `memory/feedback_astro_content_collections.md`):** after the Zod schema change, the cached `site/.astro/collections/universities.schema.json` doesn't include the new field and the content-store silently strips it from validated entries, leaving the page rendering only the [TBD] fallback. Fix: full `rm -rf site/.astro` (not just `data-store.json` — the cached `collections/universities.schema.json` is the actual culprit on Astro 5.18), then `npm run dev` regenerates the whole cache from the current schema. **Results for all 18 unis (16 UK + 2 Canadian):** 4 paragraphs each. Facts vary by partner-page markup — 8/8 for glasgow, bournemouth, birmingham, nottingham, york, alberta; 10/10 for liverpool, victoria; 7 for bristol; 6 for nottingham-trent, westminster, uwe-bristol; 0 for asu-london/city-london/cranfield/essex (their `<p>` rankings exist but use a different markup we don't yet target — follow-up). Verified live: `/glasgow` renders "At over 550 years old..." paragraph, "Рейтинги и факты" section with 8 ranking entries, TBD count on the page dropped from 6 → 5 (remaining 5 TBDs are in still-untouched sections: dates note, requirements, scholarships). — evidence: `scraper/src/sources/kaplan.ts` (extractor rewrite + isFact + FACT_PATTERNS), `scraper/src/schema.ts` + `site/src/schema/university.ts` (new descriptionSchema + optional `universitySchema.description`), `scraper/src/cli.ts` (Description import + buildDescription helper + processOne wiring + `[desc]` log line), `site/src/pages/[slug].astro` (section 3 conditional render), all 18 `site/src/content/universities/*.json` (gained `description` key).

- 2026-05-11 — Hard-filter Kaplan people-photos: strict `score >= 0` cap so no people-only shots reach the saved set. User feedback "не повторяй фото с людьми. Поменяй их" — the previous scoring deprioritized but didn't REPLACE people-photos. Three coordinated fixes: **(1) `download-photos.mjs` switched to cheerio + alt-text parsing** — img URLs collected via `$('img[src]')` so each photo's `<img alt>` text is available to the scorer, not just the URL filename. People-content like "Students having lunch" is now visible to the scorer even when the URL is generic. **(2) `scorePhoto(url, alt)` rewritten** with three-tier signal extraction: STRONG-POS +40 for named buildings (`main-quad|convocation|library|aerial view|innovation cent|memorial|tower|residence (building|hall)|dorm-room|view of|interior of|kitchen|cci|cheko|sngequ|gilmorehill|garscube|entrance of`), STRONG-NEG −40 for people action verbs in URL **or** alt (`socialising|cheering|orientation|attending|having lunch|having a tour|having a meal|smiling|chatting|enjoying themselves|relaxing|walking around|sitting on|talking to`), MED-NEG −25 for "Students <people-verb>" pattern in alt, additional URL-filename penalties for `^students-` prefixes (excepting known good slugs like `student-in-her-`/`student-innovation-`) and mid-slug `-students-` patterns. **(3) Hard cap `.filter(x => x.score >= 0)`** — anything that scores negative is dropped, not just deprioritized. **Dedup fix:** URLs are now compared by canonical form (strip query string) so `main-quad.jpg?resize=994x456&crop=...` and `main-quad.jpg?fit=1024x960` are treated as the same image. **Photo allocation when fewer than 10 saved photos:** `cli.ts buildAccommodation` switched from hardcoded `10 - (i % 3)` to `photoCount - i` with cap `>= 6` (never reuse gallery photos 3-5). For Alberta with 7 saved photos, accommodation cards get photo 7 (dorm-room interior — perfect) + photo 6 (PCL-Lounge interior — perfect) + logo fallback for card 3. **Result for Alberta:** 14 source photos → 7 saved (all buildings/exteriors + 1 dorm-room interior); zero people-only shots in the set (`gardens-socialising`, `ALES Orientation`, `students-cheering`, `EcoCar project`, `home-sweet-campus tour`, `students-having-lunch`, `building-students-socialising` all filtered). **Victoria:** 17 source → 8 saved, similar profile. **Trade-off:** with fewer photos, some lower-section cards (campus 3-4 on Alberta, accommodation card 3) now show the logo placeholder instead of a real photo. The user explicitly asked to "replace" people photos, so logo > people-photo per their priorities. — evidence: `scraper/download-photos.mjs` (cheerio + alt parsing + rewritten scorePhoto + canonical-URL dedup + hard score filter), `scraper/src/cli.ts` (photoCount-aware accommodation/campus index allocation), regenerated `site/public/photos/{alberta,victoria}/*.jpg` (7 and 8 photos respectively).
- 2026-05-11 — Eliminated cross-section photo repetition + biased photo picks away from people-only shots. **Bug found via user feedback** ("не повторяй фотки. Особенно с людьми"). Three coordinated fixes: (1) **Content-aware photo scoring in `scraper/download-photos.mjs`** — new `scorePhoto(url)` reads the URL filename slug and adds +40 for building/interior keywords (`main-quad|convocation|library|aerial|innovation-center|tower|hall|cci|dorm-room|lounge|kitchen|residence|exterior|architecture`), +15 for generic building/campus keywords, **−25** for people-only keywords (`socialising|cheering|orientation|attending|lunch|smiling|portrait|graduation`), and −10 for `students-…` filenames. `fetchKaplanPhotos()` now sorts the matched URLs by descending score (stable on ties) before slicing to top-10, so the worst people-only shots drop off the end and the saved set is dominated by exteriors + interiors. (2) **Hero ↔ gallery duplication** — `[slug].astro` gallery section used `slice(0, 3)` so photos 1+2 appeared in BOTH the hero AND the 3 gallery tiles right beneath it. Replaced with `slice(HERO_SKIP, HERO_SKIP + 3)` (photos 3, 4, 5) with a fallback to `slice(0, 3)` for unis with too few photos. (3) **Faculty cards reusing gallery photos** — `facultyPool` was `galleryPhotos.slice(HERO_SKIP=2)`, so faculty card 1 = photo 3 = gallery tile 1. Added `FACULTY_SKIP = 5` so faculty cards draw from photos 6+ only (overlapping with campus + accommodation cards, but those sections are 4-5 content blocks away — visually distant). (4) **Campus card indices** — `cli.ts buildCampuses` shifted from `(i % 4) + 2` (photos 2-5, clashed with hero+gallery) to `(i % 4) + 6` (photos 6-9, clean separation). (5) **Accommodation card indices** — `cli.ts buildAccommodation` shifted from `(i % 4) + 6` to `10 - (i % 3)` (descending 10, 9, 8) — overlaps only with the LAST 2 campus cards in a distant section. **Result for Alberta:** photos 1-5 each used exactly 1 time (hero + gallery, zero internal repetition). Photos 6-10 used 1-3 times across faculty/campus/accommodation cards in visually-separated sections. People-only Kaplan photos (gardens-socialising, ALESOrientation, students-cheering, lunch) are now ranked below building/interior shots and most fall off the top-10. — evidence: `scraper/download-photos.mjs` (scorePhoto + sort in fetchKaplanPhotos), `site/src/pages/[slug].astro` (gallery slice change + FACULTY_SKIP), `scraper/src/cli.ts` (campus + accommodation index shifts), regenerated `site/src/content/universities/{alberta,victoria}.json` + photos.
- 2026-05-11 — Real photos for Canadian universities (hero square + blurred backdrop, gallery, accommodation, campuses). One-line bug fix in the photo downloader: `scraper/download-photos.mjs` `KAPLAN_IMG_RE` regex matched only `kaplan-prod.altis.cloud` (legacy host used for older UK photos). All newer Kaplan images, including every Canadian partner's gallery, live on `www.kaplanpathways.com/tachyon/...`. Broadened the regex to accept either host (`(?:kaplan-prod\.altis\.cloud|www\.kaplanpathways\.com)`) and added `'logo-raster'` to `SKIP_FRAGMENTS` so partner-page logo PNGs don't end up in the gallery. **Result:** Alberta now has 10 real Kaplan-published photos (aerial of main quad, Arts/Convocation Hall, students socialising in gardens, Student Innovation Center, EcoCar project lab, International House entrance, dorm room interior, etc.) totalling ~3 MB; Victoria similar 10 photos totalling ~3.6 MB. Re-ran full scrape for both — `hasGalleryPhotos` is now `true` so `buildAccommodation()` and `buildCampuses()` populate the per-card `img` paths (`/photos/{slug}/{N}.jpg`). On the rendered page: hero gets `heroBgPhoto` (photo 1, blurred backdrop) + `heroCoverPhoto` (photo 2, sharp square) — matches UK layout exactly. Gallery section after «Описание» renders 3 real campus photos. Размещение section's 3 accommodation cards each carry a real photo (photos 6-8). Кампусы cards each carry a real campus photo (photos 2-5). Same UK template, same exact UX. — evidence: `scraper/download-photos.mjs` (regex + SKIP_FRAGMENTS edit), `site/public/photos/alberta/{1..10}.jpg` + `site/public/photos/victoria/{1..10}.jpg` (20 new JPGs), regenerated `site/src/content/universities/{alberta,victoria}.json` with `gallery.items[10]`.
- 2026-05-11 — Canada added as 2nd country: University of Alberta + University of Victoria (Kaplan Canadian partners). Same pipeline as UK with three minor fixes for Canadian-specific edge cases. **Registry:** added 2 rows to `sources/universities.list.md` (alberta → Edmonton; victoria → Victoria, BC) under tier `partner`; doc header updated to mention Canada source. **Scraper changes in `cli.ts`:** (1) new `currencyForCountry(country)` helper replaces the hardcoded `currency: 'GBP'` — country string is normalised and matched against Canada → CAD, USA → USD, Australia → AUD, fallback GBP. (2) `buildAccommodation` and `buildCampuses` now take a `hasGalleryPhotos: boolean` parameter — when false (e.g. Alberta's Kaplan page has no downloadable gallery), the photo path is omitted so the page falls back to the `.placeholder-img` block with the uni logo instead of pointing to non-existent `/photos/alberta/N.jpg` files. **Curated content** added to `campus-facts.ts` and `uni-accommodation-facts.ts` per uni — sourced via Exa from `ualberta.ca/residence/` and `uvic.ca/residence/`. Real prices: Alberta Lister Residence from CA$1,033/mo (Classic Towers, meal plan included), Peter Lougheed Hall from CA$1,335/mo (en-suite), Augustana Camrose from CA$532/mo; Victoria Cluster 4-bedroom CA$9,653/yr (cheapest), Dormitory Single CA$15,785/yr (meal plan included), One-bedroom apartment CA$12,105/yr. Campus info per uni: Alberta 4 campuses (North/South/Saint-Jean/Augustana), Victoria 2 (Main Gordon Head + Downtown for business/law). **Logos** downloaded from Kaplan CDN to `site/public/logos/alberta.png` + `victoria.png` (small 3-3.5KB PNGs). **Scrape results:** Alberta 105 degrees (institution_id=57, no pathways since Canadian Kaplan pages have no `/fees-and-dates/` link); Victoria 92 degrees (institution_id=54, gallery has 5 photos). **Verified live:** `/alberta` and `/victoria` return 200 with full landings; catalog `/` lists 18 unis; manager API reports both Canadian rows with `aggregatorSlug: 'kaplan-pathways'`, `country: 'Canada'`, both `in catalog: true`. Country select on catalog filter pulldown + manager filter now offers "Canada" as an option (auto-populated from registry). — evidence: `sources/universities.list.md` (2 new rows + header rewrite), `scraper/src/cli.ts` (currencyForCountry helper + hasGalleryPhotos plumbing), `scraper/src/sources/campus-facts.ts` (alberta + victoria entries), `scraper/src/sources/uni-accommodation-facts.ts` (alberta + victoria entries), `site/public/logos/{alberta,victoria}.png` (new), `site/src/content/universities/{alberta,victoria}.json` (new).
- 2026-05-11 — Catalog filters now in a pulldown (matches `/manager` UX). Per user "make filters pulldown like in maneger website". On `/` the `<Filters />` component used to render always-expanded under the hero, making the catalog grid sit far below the fold. **Markup change in `site/src/pages/index.astro`:** wrapped the existing `<Filters />` invocation in a `.catalog-filters-wrap` containing a `.catalog-filters-bar` (toggle button + reset button + result counter) and a `.catalog-filters-panel[data-open]` rolldown. The form id (`#catalog-filters`), grid (`#catalog-grid`), empty state, and count element are all untouched, so `catalog-filters.ts` keeps working without changes to its filter logic. **Toggle:** `<button id="catalog-filters-toggle" aria-controls="catalog-filters-panel">` with a chevron that rotates 180° on `aria-expanded="true"`, plus a small primary-color count badge (hidden when 0 active filters). Panel uses CSS `max-height` transition (0 → 1200px) — same pattern as `/manager`'s `.filter-panel`. **Script changes in `catalog-filters.ts`:** added `countActiveFilters(state, form)` (counts q/country/levels/faculties/maxTuition!=default/maxIelts/hasScholarship as one each), `updateBadge(activeCount, visible, total)` (sets badge digits + "N из M" text in `.catalog-filters-bar__result`), `wireToggle()` (click handler + ARIA toggle). `applyFilters()` gained one extra line to call `updateBadge` so the badge stays in sync as the user changes filters. `init()` now also auto-opens the pulldown when the URL already carries active filter params (`?country=…&level=…`), so a shared URL surfaces what's filtering the grid without the user having to click. **Verified:** `/` renders with `data-open="false"` initially, all four new DOM ids present, dev server returns 200 in ~100 ms. — evidence: `site/src/pages/index.astro` (wrap + `<style is:global>` block with bar/panel/badge rules), `site/src/scripts/catalog-filters.ts` (new constants + 3 new helpers + auto-open URL logic in `init`).
- 2026-05-11 — Faculty programs modal — per-faculty "Подробнее" popup when more than 8 programs. **Markup change in `[slug].astro`:** the existing inline expand panel for each `.program-card` previously showed `«… и ещё N программ»` as plain text when the faculty had more than 8 programs. Replaced that text node with a `<button class="programs-modal__open btn btn--ghost btn--sm" data-modal-target="programs-modal-${idx}">Подробнее · ещё N программ</button>` and, in the same article element, a sibling `<dialog class="programs-modal" id="programs-modal-${idx}">` containing the full faculty program list (each row: level pill, program title, optional `£N,NNN GBP/год` price). The dialog only renders when `fac.programs.length > 8` — for ≤8-program faculties the inline 8-row expansion stays the canonical UX and no modal is emitted. **New client script `site/src/scripts/oxford-program-modal.ts`** (imported alongside the existing oxford-* scripts in `[slug].astro`) handles open via `dialog.showModal()` on click of `[data-modal-target]`, close via the X button OR clicking the backdrop area outside `.programs-modal__inner`; native `<dialog>` handles Escape and focus trap. **Styles** added in the page-local `<style>` block: modal sized to `min(720px, 92vw)` × max 88vh with sticky header + scrollable body, level pills tinted per level (bachelor → green, master/phd → amber, foundation → blue), CSS-grid row layout (`level | title | price`) on desktop collapsing to single-column at ≤600px. Backdrop blur via `::backdrop`. **Verified:** Glasgow (222 programs / 5 faculties) emits 5 dialogs; ASU London (7 programs total) emits 0; Cranfield (42 programs split unevenly) emits exactly 1 (the one faculty crossing the 8-program threshold). — evidence: `site/src/pages/[slug].astro` (markup + `programs-modal__*` styles), `site/src/scripts/oxford-program-modal.ts` (new), import wired into the existing `<script>` block in `[slug].astro`.
- 2026-05-11 — Campus cards resized to match accommodation card width. Per user request "make information about Кампусы pretty much the same size as Размещение". Accommodation cards use `.accommodation__grid { repeat(3, 1fr) }` from oxford-landing.css, yielding ~380px per card on a 1200px container. The campus flex-grid was previously `flex: 0 1 240px; max-width: 280px` — visibly narrower. Updated `.campuses--centered .campuses__grid > .campus-card` to `flex: 1 1 320px; max-width: 400px; min-width: 280px`, so 3 cards roughly fill a desktop row with comparable card width to accommodation. Added a `:has(> .campus-card:nth-child(4))` rule that tightens to `flex: 1 1 240px; max-width: 300px` for the 4-campus unis (Westminster, Queen Mary London, Nottingham, UWE Bristol) so all 4 cards still fit one row instead of wrapping awkwardly. Responsive breakpoints unchanged (≤1000px → 2/row, ≤600px → 1/row). — evidence: `site/src/pages/[slug].astro` `.campuses--centered .campuses__grid > .campus-card` rule + new `:has()` sibling-count rule.
- 2026-05-11 — Photos on every accommodation + campus card; campus grid now flex-centered. (1) Scraper `cli.ts buildCampuses()` and `buildAccommodation()` now assign `img: /photos/{slug}/N.jpg` from the existing per-uni gallery (downloaded earlier via `download-photos.mjs`) to every card by index — campus cards cycle photos 2-5, non-Kaplan accommodation cards cycle photos 6-9, the Kaplan Living card keeps its real Kaplan-CDN apartment photo. No card renders the logo placeholder anymore. (2) `UniAccommodationFact` interface gained an optional `img` field so future per-hall curated apartment photos (from official uni accommodation pages) can override the gallery-photo fallback without code changes. (3) Page CSS — `.campuses--centered .campuses__grid` switched from `grid repeat(4,1fr)` to `flex + justify-content: center` so 1-, 2-, 3- and 4-card sections all sit horizontally centered on the page (instead of left-aligning with an empty 4th column). Card width clamped to `flex: 0 1 240px; max-width: 280px` to match the oxford-landing screenshot aesthetic; responsive at 1000px → 2 per row, 600px → 1 per row. Note: gallery-photo fallback uses real per-uni Kaplan photos but they're scenic shots rather than apartment interiors — for truly hall-specific apartment photos, a follow-up scraper that parses raw HTML `<img>` tags from each uni's accommodation page (`bristol.ac.uk/accommodation/...`, etc.) would be needed; Exa's markdown fetcher strips inline images. — evidence: `scraper/src/cli.ts` (buildAccommodation + buildCampuses img assignment), `scraper/src/sources/uni-accommodation-facts.ts` (optional `img` field), `site/src/pages/[slug].astro` (.campuses--centered flex rules), all 16 `site/src/content/universities/*.json` (regenerated with img URLs).
- 2026-05-11 — Real official-uni hall data for every accommodation card (no more TBD placeholders), section reordered. Used Exa web search against each university's OWN accommodation pricing pages (`gla.ac.uk/undergraduate/accommodation/fees/`, `bristol.ac.uk/accommodation/about/costs/cost-by-residence/`, `liverpool.ac.uk/accommodation/finder/`, `york.ac.uk/study/accommodation/rooms-prices/`, `nottingham.ac.uk/accommodation/options/`, etc.) — pulled 32 real hall entries (2 per uni × 16 unis) with exact weekly rates and per-hall descriptions. **New scraper module** `scraper/src/sources/uni-accommodation-facts.ts` holds the curated dataset; each entry carries a `sourceUrl` for future re-verification. **`cli.ts buildAccommodation()`** rewritten — every uni now emits 2-3 real cards: Kaplan Living (when fee parsed) + 2 official-uni halls from the new module. Generic "Студия / Совместная квартира" TBD cards removed. **Examples scraped:** Glasgow → Kaplan Glasgow Int'l £8,330 + Cairncross House £161.49/wk + Murano Street £172.90/wk; Bristol → University Hall £140.21/wk + Clifton Hill House £210.63-263.06/wk (catered); Liverpool → Kaplan + Crown Place £197.33/wk + Greenbank Premier £219.03/wk; Westminster → Kaplan + Alexander Fleming Budget £197.96/wk + Standard £219.94/wk; York → Kaplan + Halifax College £149/wk + Constantine College ensuite £231/wk. **Page side:** moved `<section id="campuses">` from between gallery and programs to right after `<section id="accommodation">` (per user instruction "put Кампусы after Размещение"), so final order is `… → requirements → accommodation → campuses → important → …`. Astro `data-store.json` cache wiped after re-scrape so the new accommodation array makes it into the rendered HTML. Verified: `/glasgow` shows Cairncross House + £161.49 + Murano in DOM; section order confirmed via grep on rendered HTML. — evidence: `scraper/src/sources/uni-accommodation-facts.ts` (new, ~200 lines of curated data with sourceUrls), `scraper/src/cli.ts` (buildAccommodation rewrite — generic TBD helper removed), `site/src/pages/[slug].astro` (campuses block moved after accommodation), all 16 `site/src/content/universities/*.json` (regenerated).
- 2026-05-11 — Real Kaplan accommodation fees + campus enrichment baked into main scraper. **New scraper sources:** (1) `scraper/src/sources/kaplan-accommodation.ts` discovers the per-uni college slug from the main partner page's `/accommodation/` link, fetches that page, and extracts `residence`, `priceLabel`, `priceFrom` (numeric, e.g. `8330`), `priceCurrency: 'GBP'`, `contractNote` (e.g. `based on a two-term contract`), `features[]`, `photoUrl`. Handles 404 / missing-link gracefully. (2) `scraper/src/sources/campus-facts.ts` exports `getCampusFacts(slug)` — hand-curated `{ title, sub, text }[]` for all 16 Kaplan UK partners with richer per-campus descriptions (history, location, faculties, distinguishing features). **Wired into `cli.ts`** — every `--all` run now also calls `scrapeKaplanAccommodation` + `getCampusFacts` per uni, builds a 3-card `accommodation[]` (1 real Kaplan Living entry when fee parsed + 2 generic TBD alternatives) and a `campuses[]` array, and sets them on the validated University before write. Schema mirrored on both sides (`scraper/src/schema.ts` + `site/src/schema/university.ts`) with optional `accommodationItemSchema` / `campusItemSchema`. **Real fees captured (14/16):** asu-london £12,240, bournemouth £7,004, city-london £12,240, cranfield £12,240, nottingham-trent £6,630, queen-mary-london £12,240, brighton £9,520, essex £7,260, glasgow £8,330, liverpool £6,800, nottingham £6,630, westminster £12,240, york £8,228, uwe-bristol £8,745; birmingham + bristol have Kaplan accommodation pages but no published price (graceful fallback to TBD). **Page side:** moved `campuses` section back into the page middle (between gallery and programs) per "in the middle" feedback while keeping `accommodation` after requirements/scholarships; new `.campuses--centered` modifier on the section center-aligns card body content (`align-items: center; text-align: center`). Same `.tbd` badge pattern + green-pill `.card__price` from oxford-landing.css applies to real fees too (renders as e.g. `от £8,330` in a green pill without the TBD badge when the price is real). — evidence: `scraper/src/sources/kaplan-accommodation.ts` (new), `scraper/src/sources/campus-facts.ts` (new), `scraper/src/schema.ts` (+ optional fields), `scraper/src/cli.ts` (buildAccommodation / buildCampuses helpers + processOne wiring + new log lines `[acc]` and `[camp]`), `site/src/pages/[slug].astro` (section moved + `.campuses--centered` rule), all 16 `site/src/content/universities/*.json` (regenerated with real fees + enriched campus data).
- 2026-05-11 — Accommodation + campuses repositioned + oxford-exact price styling — per user feedback (screenshots compared against `studyroom-oxford-landing`): moved both new sections from between `gallery` and `programs` to **after** the `requirements` section (which holds requirements + scholarships in a 2-col layout), so the new order is `… → requirements → accommodation → campuses → important → about → reviews → location → cta`. Removed page-local `.accommodation .card__price{,_old,_row}` style overrides — the oxford `.card__price` green pill style (`oxford-landing.css:424`) now applies untouched (green background, white text, rounded-pill, with subtle green shadow). Added `priceParts()` helper in the frontmatter mirroring oxford's `withTBD()` — splits `[TBD: £/нед]` into `{ text: '£/нед', tbd: true }` so the template can render the text inside the pill and append a small `<span class="tbd">TBD</span>` badge (oxford-landing.css:147). Dropped the per-section subtitles to match the oxford `<section__head>` (h2 only, no `<p>`). Verified rendered markup: `<span class="card__price"> £/нед <span class="tbd">TBD</span></span>` on every accommodation card. — evidence: `site/src/pages/[slug].astro` (sections moved, `priceParts` added, overrides removed).
- 2026-05-11 — Accommodation + campuses sections on per-uni landings — ported oxford-landing's "Размещение" + "Кампусы университета" blocks into `site/src/pages/[slug].astro` (rendered between gallery and programs, conditionally on non-empty arrays, matching oxford-landing.css classes `.accommodation`/`.accommodation__grid`/`.campuses`/`.campuses__grid`/`.campus-card`). Schema extended in `site/src/schema/university.ts` with optional `accommodation: { name; price?; oldPrice?; text?; img? }[]` and `campuses: { title; sub?; text?; img? }[]`. Seeded all 16 unis via one-shot `scraper/seed-accommodation-campuses.mjs` (kept in repo for re-runs): public-knowledge campus list per uni (1–4 entries: Glasgow → Gilmorehill/Garscube/Dumfries; Westminster → Regent/Cavendish/Marylebone/Harrow; Nottingham → University Park/Jubilee/Sutton Bonington/Royal Derby; etc.) + uniform 3-tier accommodation template (en-suite hall / studio / shared apartment) with `[TBD: £/нед]` price placeholders. When per-item `img` is missing, the page renders a gradient placeholder block with the uni logo centered (`.placeholder-img`, defined inline in `[slug].astro`). Gotcha hit and recorded: Astro 5's content-collection cache (`site/.astro/data-store.json`) persisted the validated entries from before the schema change, so even after a dev-server restart the new fields were stripped — fix is to delete `data-store.json` after any schema-shape change (or `rm -rf .astro/`). Verified: `/glasgow` shows Gilmorehill + En-suite; `/westminster` shows all 4 campuses (Regent/Cavendish/Marylebone/Harrow); `/asu-london` shows 1 campus (Holborn). — evidence: `site/src/schema/university.ts` (new optional fields), `site/src/pages/[slug].astro` (new conditional sections + `.placeholder-img` styles), `scraper/seed-accommodation-campuses.mjs` (new one-shot seed script), all 16 `site/src/content/universities/*.json` (gained `accommodation` + `campuses` keys).
- 2026-05-11 — Manager registry filters with aggregator selection — compact filter bar above the registry table on `/manager` with always-visible search input ("поиск по слагу или названию"), "Фильтры ▾ (N)" toggle button with active-filter count badge, and "Сбросить" button. Toggle expands a rolldown panel (`max-height` transition) containing five filter groups: **Агрегатор** chips (auto-populated from API `aggregators[]`, today only `Kaplan Pathways` + `Все`), **Тир** chips (multi-select: partner / official / aggregator), **Страна** select, **В каталоге** chips (Все / Да / Нет), **Свежесть** chips (Все / Свежие &le;35д / Устарели / Никогда). All filters apply client-side via `rowMatchesFilters()` in the existing `renderRegistry()`; result count shown as "N из 16". Registry table now has new **Агрегатор** column rendering the per-row aggregator as a tier-coloured pill. Server side: `control/server.mjs` gained `readAggregators()` (parses `sources/aggregators.md` for `## <slug>` headings + `**Base URL:**` + `**Confidence tier:**`) and `resolveAggregatorSlug()` (host-matches the `aggregator_url(s)` column of `universities.list.md` to an aggregator); `/api/status` now exposes `aggregators[]` and per-row `aggregatorSlug`. Verified: all 16 Kaplan rows resolve to `aggregatorSlug: 'kaplan-pathways'`, `/manager` renders all expected DOM IDs. — evidence: `control/server.mjs` (readAggregators + resolveAggregatorSlug + updated readRegistry/status handler), `site/src/pages/manager.astro` (filter bar markup + rolldown CSS + filter state + handlers).
- 2026-05-11 — Manager page on site (`/manager`) — embedded the scraper-trigger UI directly into the Astro site (was previously only at `control/public/index.html:5174`). New file `site/src/pages/manager.astro` renders the same dashboard (next-scheduled-run card, source card, big "Запустить скрапинг сейчас" button, status pill, registry table with per-uni "обновить" buttons, live log) using brand tokens from `brand.css`. Script polls `http://localhost:5174/api/status` (override via `localStorage.studyroom.manager.controlUrl` or "изменить" link in header), POSTs `/api/run` and `/api/run-one`. Offline-state handling: yellow banner + disabled buttons when control panel is unreachable. Added CORS to `control/server.mjs` (`access-control-allow-origin: *` + OPTIONS preflight) so the site (4321) can call the panel (5174) cross-origin. Discreet footer link `Управление → /manager` in `site/src/layouts/Base.astro`. Verified: `OPTIONS /api/run` → 204 with CORS headers, `GET /api/status` returns JSON envelope, `GET /manager` → 200 with all expected DOM IDs. Note: `trailingSlash: 'never'` in `astro.config.mjs`, so canonical URL is `/manager` (no slash). — evidence: `site/src/pages/manager.astro` (new), `site/src/layouts/Base.astro` (footer link), `control/server.mjs` (`setCors` helper + OPTIONS branch).
- 2026-05-11 — Stage 10 (Oxford-style universal landing) — ported 13 sections from `studyroom-oxford-landing/` (hero / benefits / description / programs-by-faculty / dates / activities / requirements + scholarships / important / about / reviews / location / final CTA / footer + chat widget). Shared StudyRoom content lives in `site/src/content/studyroom/static.ts` (extended with `STUDYROOM_DATES_TIMELINE`, `STUDYROOM_FORM`, `STUDYROOM_FOOTER`, `STUDYROOM_CHAT`). Per-uni rewrite uses `site/src/styles/oxford-landing.css` (1414 lines copied verbatim from oxford project) and 4 client-side TS modules in `site/src/scripts/oxford-{reveal,phone-mask,chat,program-card}.ts`. Hero `cover` slot shows the Kaplan logo on a white card (no per-uni hero photos yet — see Stage 11). Programs section groups all programs by faculty (top 6) with expand-to-list interaction matching oxford's `program-card` UX. Forms (inline + final CTA) wired with KZ phone mask + validation. Chat widget hydrates from `STUDYROOM_CHAT`. — evidence: `site/src/pages/[slug].astro` (rewrite), `site/src/styles/oxford-landing.css` (new), `site/src/scripts/oxford-*.ts` (4 new), `site/src/content/studyroom/static.ts` (extended)
- 2026-05-11 — Logos on catalog + per-uni hero — downloaded all 16 Kaplan partner logos to `site/public/logos/{slug}.png` via one-shot `scraper/download-logos.mjs`; replaced green initials boxes in `UniversityCard.astro` (catalog) and `[slug].astro` hero with `<img>` + onerror→initials fallback; updated `.uni-card__logo` and `.uni-hero__logo` styles in `brand.css`/`[slug].astro` to white box with light border + `object-fit: contain`. Verified live at http://localhost:4321/ — all 16 cards now show real logos. — evidence: `scraper/download-logos.mjs`, `site/public/logos/*.png` (16 files), `site/src/components/UniversityCard.astro`, `site/src/styles/brand.css`
- 2026-05-10 — Stage 7 (cron) — Monthly scraper cron `0 3 1 * *` opens diff PR via `peter-evans/create-pull-request` — `.github/workflows/scrape-monthly.yml`
- 2026-05-10 — Stage 6 (deploy guide) — Cloudflare Pages connection + custom domain step-by-step — `DEPLOYMENT.md`
- 2026-05-10 — Stage 5 (Decap scaffold) — Decap admin at `/admin`, GitHub backend with editorial workflow, full schema fields — `site/public/admin/{index.html,config.yml}` + `DECAP_OAUTH.md`
- 2026-05-10 — Stage 3 (scraper MVP) — `scraper/` workspace with TS + Cheerio + Zod + CLI (`--slug`/`--all`/`--dry-run`), reads `sources/universities.list.md`, writes validated JSONs, preserves hand-curated fields. Verified live on Glasgow + Liverpool — `scraper/{package.json,tsconfig.json,src/{schema.ts,registry.ts,cli.ts,sources/kaplan.ts}}` + `scraper/README.md`
- 2026-05-10 — Stage 2 (per-uni landing redesign) — 9-section Oxford-style landing (hero with logo + facts panel, benefits, programs table, requirements, scholarships, services, FAQ, reviews, about, CTA). Static StudyRoom content extracted to `site/src/content/studyroom/static.ts` — `site/src/pages/[slug].astro` + `site/src/content/studyroom/static.ts`
- 2026-05-10 — Stage 2 (catalog redesign) — Kaplan-finder-style catalog: search-prominent hero, horizontal filter bar with chip-toggle levels + tuition slider + IELTS cap + scholarship-only, branded UniversityCard with green initials-circle "logo" — `site/src/pages/index.astro`, `site/src/components/{Filters,UniversityCard}.astro`, `site/src/styles/brand.css`, `site/src/layouts/Base.astro`, `site/src/scripts/catalog-filters.ts`
- 2026-05-10 — Stage 0 (UK partners locked) — Replaced MIT/Oxford/UCL with 6 Kaplan UK partners (glasgow, liverpool, bristol, westminster, york, nottingham) + filled `sources/universities.list.md` with all 16 Kaplan UK partners + Kaplan profile in `sources/aggregators.md` — `site/src/content/universities/*.json`, `sources/{universities.list.md,aggregators.md}`
- 2026-05-08 — Stage 2 — Astro app + catalog hub + landing template + brand CSS + 3 sample JSONs (oxford, mit, ucl) — `site/astro.config.mjs`, `site/src/content/config.ts`, `site/src/styles/brand.css`, `site/src/layouts/Base.astro`, `site/src/components/{UniversityCard,Filters}.astro`, `site/src/scripts/catalog-filters.ts`, `site/src/pages/{index,[slug]}.astro` (`npm run build`: 4 pages, 4.83s)
- 2026-05-08 — Stage 1 — TS workspace scaffolded + Zod `University` schema ported from `data/university-schema.js` + 7 Vitest cases green — `site/package.json`, `site/tsconfig.json`, `site/src/schema/university.ts`, `site/src/schema/university.test.ts` (`npm test`: 7 passed)
- 2026-05-08 — Stage 0 — Input templates seeded — `sources/universities.list.md`, `sources/aggregators.md`
