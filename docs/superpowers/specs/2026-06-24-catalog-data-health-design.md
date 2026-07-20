# Catalog Data-Health: чистка + гейт + бэкфилл

**Дата:** 2026-06-24
**Проект:** studyroom-project-site
**Цель:** убрать массовые ошибки данных каталога (пустые / кривые / не отображаемые) и
поставить заслон, чтобы они не возвращались при будущих merge/scrape.

## Проблема (по аудиту `scraper/audit-catalog.mjs`, 808 вузов)

| категория | вузов | случаев | корень |
|---|---|---|---|
| MISSING:price | 714 | 55 038 | офсайт-краул добавлял программы без метаданных |
| MISSING:deadline | 729 | 59 526 | то же |
| GARBAGE:level-mismatch | 219 | 2 297 | level ≠ тайтлу |
| GARBAGE:currency | 113 | 113 | дефолт USD у не-US вузов |
| GARBAGE:junk-title | 122 | 232 | ярлыки пути «admission/preparation» как программа |
| INTEGRITY:img-404 | 67 | 175 | путь без файла в `public/` |
| GARBAGE:dup-program-slug | 34 | 167 | merge без дедупа |
| GARBAGE:price-zero | 9 | 50 | парс-мусор |
| + MISSING:lang-req(384)/accommodation(378)/scholarships(331)/description(231)/campuses(139)/logo(113) |

Плюс **5 контейнеров-агрегаторов** в каталоге как «вузы»: `navitas`, `into-partnerships`,
`kaplan-anz`, `study-group`, `qa-higher-education` (мусор-тайтлы, дефолт USD, 0 цен).

## Принципы

- **Никакой фабрикации.** Чего нет на диске — помечаем `absent`, не выдумываем (правило достоверности).
- **Ничего не удалять из `site/src/content/universities/*.json`** (правило каталога). Не-вузы и
  мусор-программы — **флагаем** (`hidden: true` / `programType:'pathway'` + фильтр фронта), не режем.
- **Детерминированно и $0** где возможно. LLM — только если иначе никак (в этом спеке не нужен).
- **Идемпотентность.** Каждый фиксер можно гонять повторно без побочек; перед записью — бэкап.
- **Гейт — единый источник правды** правил качества (тот же `audit-catalog.mjs`, расширенный).

## Архитектура (3 модуля, чёткие границы)

### Модуль 1 — Fixers (разовая детерминированная чистка)
Папка `scraper/fixers/`, каждый фиксер = отдельный файл, читает каталог, пишет на диск, печатает
diff-сводку. Оркестратор `scraper/fix-catalog.mjs` гоняет их по порядку + бэкап в
`sources/_catalog_backup_2026-06-24/`.

1. `fix-currency.mjs` — валюта из страны (карта country→ccy уже в audit). Конфликт → исправить
   `tuition.currency`. 113 вузов.
2. `fix-level.mjs` — переразметка `program.level` из тайтла (regex LEVEL_HINT). 2 297 программ.
   Только для bachelor/master/phd (foundation/pathway/english не трогаем).
3. `fix-junk-titles.mjs` — программы с тайтлом admission/preparation → `programType:'pathway'`
   (фронт уже умеет прятать pathway-only? проверить; иначе добавить `hidden:true`). 232.
4. `fix-dup-slugs.mjs` — дедуп program.slug внутри вуза (оставить первый, выкинуть повтор +
   почистить tuition.byProgram/deadlines на удалённый слаг). 167.
5. `fix-zero-price.mjs` — `byProgram[slug]===0` → удалить ключ (= честно «нет цены»). 50.
6. `fix-broken-img.mjs` — img-путь без файла в `public/` → `null`/убрать элемент. 175.
7. `flag-non-unis.mjs` — 5 контейнеров → `hidden:true` (не удалять). Список в конфиге.

### Модуль 2 — Backfill (заполнение из того, что уже на диске)
`scraper/backfill-from-extracts.mjs` — детерминированный merge цены/дедлайна/валюты из
`sources/{kaplan,gedu,qahe,official}-extracts` в каталог **по матчингу программ**.
- Матчинг: точный `normalize(title+level)`, fallback — fuzzy по токенам (порог). Без матча — пропуск.
- Пишет только пустые поля (не перетирает существующее), ставит `program.source` + `checkedAt`.
- Приоритет источников: official > kaplan > gedu > qahe (как merge-programs.mjs).
- Покрытие после — мерить аудитом, остаток честно `absent`.

### Модуль 3 — Gate (заслон от регресса)
Расширить `scraper/audit-catalog.mjs` → разделить правила на **hard** и **soft** + exit-code.
- `scraper/validate-health.mjs` (или флаг `--gate`): hard-fail (exit 1) если есть
  currency≠country / junk-title-as-degree / level-mismatch / dup-slug / img-404 / price-zero /
  не-флагнутый не-вуз. Soft-warn (exit 0, репорт): покрытие price/deadline/photo ниже порога.
- Подключить в `npm run build` (pre-build hook) и в `.github/workflows/deploy.yml` (шаг перед
  wrangler deploy). Регресс блокирует выкатку.
- `site/scripts/generate-status.mjs` — добавить per-uni `healthScore` + список проблем →
  карточка data-health в `/manager`.
- Baseline: текущие soft-гэпы (price/deadline coverage) фиксируем как стартовую планку, гейт
  следит, чтобы **не росли** (новые merge не имеют права ухудшать покрытие).

## Порядок исполнения (чекпойнты)

1. Бэкап каталога + smoke `npm run build` (зелёный baseline).
2. Модуль 1 fixers по одному → после каждого `validate-unis` + повторный аудит (видим Δ).
3. Модуль 2 backfill → аудит (видим, насколько упали price/deadline gaps).
4. Модуль 3 gate → подключить в build + CI + manager.
5. Финал: `npm run build` зелёный, `validate-health --gate` exit 0 на hard-правилах, deploy
   вручную через wrangler по команде владельца. Ветка `feat/data-health`, коммит по путям.

## Тестирование

- Каждый fixer: dry-run флаг (`--dry`) печатает что изменит, без записи. Прогон на 2-3 вузах
  из топ-офендеров, проверка JSON-валидности + что программы целы (число не падает).
- Идемпотентность: второй прогон fixer'а = 0 изменений.
- Gate: намеренно внести 1 ошибку (валюта) в тест-копию → `--gate` должен дать exit 1.

## Out of scope (YAGNI)

- Скрейп новых цен/дедлайнов с офсайтов (отдельная задача; здесь только бэкфилл с диска).
- LLM-обогащение описаний/стипендий.
- Редизайн фронта (только фильтр hidden/pathway, если его ещё нет).
