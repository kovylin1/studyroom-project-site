# Передача смены 01.10.2026: прямые партнёры, шаги 1–3 сделаны, остался шаг 4

Предыдущая передача: `HANDOFF-2026-09-30-direct.md` (план из четырёх шагов).
Ветка `feat/direct-fees`, PR #73 (не смержен), коммиты `3ca78ea6` и `92ebce7e` запушены.
Worktree: `scratchpad/wt-direct-fees` сессии 09c1c283. Живой каталог в этой сессии НЕ трогали.

## Решения владельца 30.09.2026 (внесены)

1. Ежемесячный прогон `direct` создаёт **PR на проверку**, не идёт сразу в прод. В
   `scrape-staggered.yml` для `direct` сделаны ветка `auto/direct-<дата>`, `gh pr create`, деплоя нет.
2. Цена «за семестр» / «в месяц» пишется как есть: `tuitionBasis: 'semester' | 'month'`, витрина
   подписывает « за семестр» / « в месяц» (ru/en/kk), в «от … в год» не входит (`site/src/lib/tuition.ts`).
   Покредитные (`credit`) и `other` (Wollongong — за предмет) в каталог не попадают.
3. Demiroğlu Bilim без цены: скидочные строки не отдаются, пометка в `gaps`.

## Что сделано

- **Шаг 1.** `scraper/lib/program-match.mjs`: четвёртая ступень `canonTitle` (флаг `{ canon: true }`).
  Покрывает степень в конце, «M.Sc.», «Hons/Honours», «HR», «&», «(STEM)», «(ODL)», «Focus on», префикс школы через «|»,
  «Bachelor of Fine Arts» → BFA, хвост XJTLU «with Contemporary Entrepreneurialism». Уровень должен
  совпасть строго. Агрегаторы флаг не включают и считают по-старому. Тесты: 128/128.
- **Шаг 2.** `scraper/kompas-direct-review.mjs` ставит флажки по вузам и пишет
  `sources/kompas/direct-review.json`. Запускалка чистит названия с сайта (`cleanSiteTitle`) и не заводит
  закрытые программы, голую степень и рекламные заголовки. В парсерах Webster и BSBI добавлен
  `fallbackTitle` (og:title → h1 → слаг), обе выгрузки пересобраны. «Новых» программ стало 557 → 419.
- **Шаг 3.** `kompas-update.mjs --agg=direct`: сбор, рабочая копия, запускалка с
  `--catalog=<рабочая копия>`, порог, перенос, гейт. Свои карточки — вузы с парсером.
  4-е число в `aggregator-schedules.json`. Сухой прогон `--skip-collect`: 29 карточек (2,7 %), гейт зелёный.
- Вердикты: `scraper/direct-fees/verdicts.json` (программы заводятся только у `ok`):
  Webster — `fix`, Abu Dhabi — `gap`, остальные `ok`.
- Удалён незакоммиченный черновик `.github/workflows/scrape-direct.yml`, его заменила ветка `direct`.

## Следующая сессия

1. **Убрать мусор сухого прогона** (~1 000 файлов в worktree: `sources/kompas/catalog-work`, отчёты,
   `site/public/api/update-runs.json`, `scraper/sources/audit-report.json`):
   `git -c core.longpaths=true stash push -- sources/kompas scraper/sources site/public/api`
   (файл с длинным путём `anglican-schools-commission-…` стешить отдельно).
2. **Шаг 4 — применить:** `node scraper/kompas-direct-fees.mjs --from-extracts --add-programs --apply`
   → `cd site && npm run build` (обязательно: гейт не ловит схему и сироты `deadlines`) → коммит в PR #73.
   Ожидаемо: около 419 программ и около 384 цен. Перед этим взглянуть на `sources/kompas/DIRECT-FEES.md`.
   Классификатор раньше блокировал запись в живой каталог — если откажет, это делает владелец через `!`.
3. **Webster:** парсер берёт рекламный `<title>` («Top-Ranked …», «Accredited … Master’s»).
   Перейти на `<h1>` или на название из списка программ, пересобрать выгрузку
   (`node scraper/kompas-direct-fees.mjs --slug=webster-university`), снять `fix` в `verdicts.json`.
4. Обновить `BACKLOG.md`: перенести «прямые партнёры» в DONE с evidence после применения.

## Что видно в данных и пока ждёт

- Настоящие новые программы: CSUDH (в карточке 4 из 70), CIU (магистратура и PhD), SRH University, PhD у XJTLU,
  магистратура Bilim.
- Мусор в карточках (не чистили): у XJTLU программы с китайскими названиями («BSc 供应链管理»), у SRH University
  «Application Periods and Deadlines for Master Programs in China».
- Карточки, где у агрегаторов программ больше, чем на сайте (Middlesex 348/72, SRH Germany 165/7, BSBI 278/85):
  правило «ничего не удалять» в силе.
- Цены, которые отбиты: валюта CZK (Anglo-American, UNYP) и INR (SP Jain) — этих валют нет в схеме, решать владельцу.

Сессия 30.09 стоила около $67: дорого обходятся чтение больших выводов и много мелких правок.
Следующую лучше начать сразу с п.1–2 одной командой.
