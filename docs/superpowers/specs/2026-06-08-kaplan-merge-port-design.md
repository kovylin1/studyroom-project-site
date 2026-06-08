# Kaplan → merge-пайплайн: дизайн порта

**Дата:** 2026-06-08
**Проект:** studyroom-project-site
**Статус:** дизайн одобрен владельцем, готов к плану реализации

## Проблема

Kaplan — первый («founding») коллектор проекта: TS-пайплайн в `scraper/src/`
(`cli.ts` ~900 строк + `kaplan-feed.ts`, `kaplan-fees.ts`, `kaplan-accommodation.ts`,
`kaplan.ts`). Он наполнил каталог ~29 вузами (commit `f323513`). Но он архитектурно
осиротел:

- `cli.ts` пишет **напрямую** в каталог `site/src/content/universities/{slug}.json`
  (full-replace) — старая архитектура «коллектор = каталог».
- Текущее поколение (11 .mjs-коллекторов) пишет в `sources/<agg>-extracts/<slug>.json`,
  затем `merge-programs.mjs` сливает по precedence. Слот `kaplan-extracts` в merge **есть,
  но пуст**.
- В CI (`scrape-staggered.yml`) слот `kaplan-pathways` запускает чужой generic
  `scrape-direct-partners-v2.mjs`, а не Kaplan-фид. Rich-коллектор в CI не зовётся вообще.

**Цель:** портировать Kaplan в merge-пайплайн — собственный .mjs-коллектор пишет в
`sources/kaplan-extracts/`, данные идут через общий merge + гейт + СОРОКА + РЕВИЗОР,
как у остальных коллекторов. Реальные цены Kaplan довести до каталога.

## Решения владельца

1. **Портировать в merge-пайплайн** (не оживлять cli.ts как есть, не плодить вторую
   архитектуру).
2. **Нести реальные цены** через расширение merge (fill-null, без перезаписи).
3. Жёсткое требование: сквозная цепочка **коллектор → merge → РЕВИЗОР** отрабатывает
   в конце прогона.

## Архитектура

Источник данных — встроенный в HTML фид. Каждая страница degree-finder содержит всю
базу Kaplan как JS-литерал `degree_finder_object = {...};`. Один `fetch` + regex +
`JSON.parse` → институты, программы (с ценой/валютой/длительностью/интейками/URL),
preparation courses. **Playwright не нужен** (в отличие от gedu) — фид в статичном HTML.
Детерминированно, $0.

### Компонент 1 — `scraper/scrape-kaplan-all.mjs` (новый коллектор)

Plain .mjs, паттерн как `scrape-gedu-all.mjs` (лог `[kaplan]` в stderr, итог-JSON в stdout,
`--limit=N`). Логика портируется из проверенного `kaplan-feed.ts`:

- `fetchKaplanFeed()`: `fetch` страницы degree-finder → regex `/degree_finder_object\s*=\s*(\{[\s\S]+?\});/`
  → `.split('\\/').join('/')` → `JSON.parse` → `obj.degrees.data.{institutions,degrees,preparation_courses}`.
- `mapDegreeLevel()` / `parseDuration()` / `parseIntakes()` — портируются.
- Группировка `degrees` по `institution_id`; матчинг института на слаг каталога:
  переносится `REGISTRY_TO_FEED_ID` (ручные оверрайды) + fuzzy-match по имени из `cli.ts`.
- Выход `sources/kaplan-extracts/<slug>.json`:
  ```json
  {
    "slug": "glasgow",
    "name": "University of Glasgow",
    "source": "kaplan",
    "sourceUrl": "https://www.kaplanpathways.com/...",
    "scrapedAt": "2026-06-08T...",
    "programs": [
      { "title": "...", "level": "master", "duration": "1 year",
        "intake": ["September", "January"], "programUrl": "https://...",
        "feePerYear": 27720, "currency": "GBP" }
    ]
  }
  ```
- `feePerYear` — число (`current_fees_per_year` распарсенный), `currency` — `currency_code`.
  Если цена не парсится — поле отсутствует (не 0, не null).

### Компонент 2 — `merge-programs.mjs`: перенос tuition (fill-null)

Сейчас merge tuition из extracts **не переносит вообще** — только чистит осиротевшие
ключи `tuition.byProgram`. Расширение (аддитивно, выгода всем коллекторам):

- В `applyExtract`, для каждой программы extract с `feePerYear` (число) и `currency`:
  - **Новая программа** (нет в `byKey`): после генерации `finalSlug` —
    если `catalog.tuition.byProgram[finalSlug]` пуст/отсутствует, записать `= feePerYear`.
  - **Существующая программа**: если её tuition-ключ (по её слагу) пуст — записать.
    Никогда не перезаписывать существующее число.
  - Если `catalog.tuition.currency` пусто/отсутствует — выставить из `currency` extract.
    Существующую валюту не трогать.
- Только для НЕ-official источников действует fill-null; official может оверрайдить
  (по аналогии с программами) — но Kaplan не official, так что фактически только fill-null.
- `applyExtract` сейчас не получает объект `catalog` — нужно прокинуть ссылку на
  `catalog.tuition` в сигнатуру (или вернуть собранные цены наверх в `mergeAllSourcesForSlug`,
  где `catalog` доступен). Предпочтительно: собрать `tuitionBySlug`-map в `applyExtract`
  и применить в `mergeAllSourcesForSlug` ДО шага пруна осиротевших ключей.

**Замечание о слагах.** Существующие Kaplan-ключи в `byProgram` (`master-1841`,
`fc-arts-and-humanities`) сгенерены старым `cli.ts` (`level-program_id`). merge генерит
слаги иначе (`slugify(uniSlug-title-level)`). Дедуп идёт по `title+level`, не по слагу,
поэтому совпавшие по тайтлу программы **обогащаются** (слаг и tuition-ключ сохраняются),
а не дублируются. При дрейфе тайтла возможны редкие дубли с новым слагом/ключом — это
ловит СОРОКА (outlier/mismatch) и панель manager. Существующие числа не теряются
(пруну подлежат только ключи без программы; существующие программы сохраняются).

### Компонент 3 — CI (`scrape-staggered.yml`)

- Кейс `kaplan-pathways)`: заменить `node scraper/scrape-direct-partners-v2.mjs`
  на `node scraper/scrape-kaplan-all.mjs`.
- Существующий шаг `git add scraper/sources/` коммитит новый extract; monthly-ремердж
  (`scrape-monthly.yml`) подхватит на 1-е число. Monthly не меняем (он только ремерджит +
  СОРОКА, коллекторы не зовёт).

### Компонент 4 — РЕВИЗОР: выравнивание ключа агрегатора

**Баг, ломающий требование владельца.** Staggered зовёт
`revizor.mjs --aggregator=${detect.outputs.aggregator}`, где aggregator = ключ расписания
`kaplan-pathways`. Но в `revizor.mjs` `AGGREGATOR_DOMAINS` имеет ключ `kaplan`
(`['kaplanpathways.com','kaplan.co.uk']`). `AGGREGATOR_DOMAINS['kaplan-pathways']`
не определён → ревизор логирует «unknown aggregator, running on all» и теряет скоуп Kaplan.

Фикс: в `revizor.mjs` добавить алиас ключа расписания → ключ домена
(`'kaplan-pathways' → 'kaplan'`), либо добавить ключ `'kaplan-pathways'` в
`AGGREGATOR_DOMAINS` с теми же доменами. Предпочтительно — карта алиасов
schedule-key→domain-key, чтобы закрыть и другие суффиксные ключи
(`navitas-pathways`, `qs-topuniversities`, `oxford-international`) единообразно,
но в скоупе этой задачи обязателен только `kaplan-pathways`.

### Компонент 5 — `scraper/tasks/registry.json`

- Запись `kaplan`: `script` → `scraper/scrape-kaplan-all.mjs`, `status` → `done`.
- Старый `cli.ts` **не удаляется** (правило владельца «не используется ≠ удалять»);
  в шапке `cli.ts` добавить комментарий-маркер: legacy direct-write, заменён
  `scrape-kaplan-all.mjs`, оставлен для accommodation/scholarships/описаний, которые
  merge не несёт.

## Безопасность для 29 существующих Kaplan-вузов

merge **только обогащает** каталог: трогает `catalog.programs` (добавляет/проставляет
provenance) и чистит осиротевшие `tuition.byProgram`/`deadlines`. Accommodation, campuses,
scholarships, description, gallery — не трогает. Поэтому жильё/стипендии/описания, ранее
записанные `cli.ts`, остаются. Дедуп по `title+level` сливает программы из того же фида,
а не плодит.

## Не входит (YAGNI)

- Accommodation/photos/scholarships/description из фида — домены БОБР/ОРЁЛ; у 29 вузов
  уже есть от cli.ts.
- Удаление `cli.ts` и сопутствующих `kaplan-*.ts` / `uni-scholarships.ts`.
- Единообразное выравнивание ВСЕХ суффиксных ключей ревизора (только `kaplan-pathways`
  обязателен; остальные — опционально, если дёшево).
- i18n `/en` — отдельная фича, следующим заходом.

## План проверки

1. `node scraper/scrape-kaplan-all.mjs --limit=3` → глазами проверить 3 extract-файла
   (программы, feePerYear, currency, валидный слаг).
2. `node scraper/merge-programs.mjs --dry-run --slug=glasgow` → убедиться, что цены
   попадают в `tuition.byProgram`, существующие не перезаписаны, дублей нет.
3. Полный `node scraper/scrape-kaplan-all.mjs` → `node scraper/merge-programs.mjs`.
4. `node scraper/revizor.mjs --aggregator=kaplan-pathways --dry-run` → убедиться, что
   скоуп = только Kaplan-вузы (не «running on all»).
5. `cd site && npm run build` → exit 0, 807 страниц.
6. `node scraper/validate-catalog.mjs` (если есть) → 804/804.

## Файлы

- НОВЫЙ: `scraper/scrape-kaplan-all.mjs`
- НОВЫЙ (генерится): `scraper/sources/kaplan-extracts/*.json`
- ПРАВКА: `scraper/merge-programs.mjs` (перенос tuition)
- ПРАВКА: `scraper/revizor.mjs` (алиас kaplan-pathways→kaplan)
- ПРАВКА: `.github/workflows/scrape-staggered.yml` (кейс kaplan-pathways)
- ПРАВКА: `scraper/tasks/registry.json` (kaplan script/status)
- ПРАВКА: `scraper/src/cli.ts` (комментарий-маркер legacy)
