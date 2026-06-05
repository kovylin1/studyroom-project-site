# СОРОКА — агент достоверных цифр (дизайн, одобрен 2026-06-05)

## Цель

Новый директор в ПАУК-пайплайне: достаёт и проверяет числовые факты каталога —
цены программ (tuition), цены жилья, keyFacts-цифры, IELTS/GPA — и присваивает
каждому факту confidence. Каталог только обогащается, ничего не удаляется.

## Архитектура

`scraper/soroka.mjs` (директор) + `scraper/lib/numbers.mjs` (парсинг/диапазоны).
Запускается сам по себе и как Phase 4.5 в `pauk.mjs` (после merge-programs,
до validate-unis). Флаги: `--slug=`, `--limit=`, `--dry-run`, `--skip-live`,
`--max-live=N` (кап живых проверок), `--concurrency=`.

## Три прохода

1. **Кросс-сверка ($0):** каталог vs extracts (edvoy/qahe/gedu/iapro/official).
   Парсим денежные строки («25800 GBP», «£250/week»). Совпадение двух
   независимых источников в пределах 5% → corroborated. Расхождение >15% →
   кейс `tuition_mismatch`.
2. **Санити-диапазоны ($0):** годовой tuition по валюте (GBP 3–60k, USD 2–80k,
   EUR 1–45k, …), жильё per week/month/year, IELTS 4–9 шаг 0.5, GPA 0–4,
   год основания 800–2026, студенты 50–500k, проценты 0–100, рейтинг 1–2000.
   Выброс → кейс `*_outlier`.
3. **Живая точечная проверка (сеть, только спорные):** для unis с mismatch —
   fetch офиц. fees/accommodation страниц (паттерн ШМЕЛЯ, fetch+timeout 9s).
   Если на офсайте найдена цифра в пределах 5% одного из спорных значений —
   она побеждает: official tier, scoreFact ≥ 0.85. Сетевые сбои не валят
   пайплайн — кейс остаётся неразрешённым.

## Скоринг

Существующий `scoreFact()` из `lib/confidence.mjs`, MIN_CONFIDENCE = 0.85.

## Применение результатов (гибрид)

- **Авто-применение** только official-подтверждённых ≥0.85 (live-проход):
  обновление `tuition.byProgram[slug]` + provenance на программе
  (`source`, `verifiedBySite`, `confidence`, `checkedAt`). Лог в
  `sources/audit/soroka-applied.json`.
- **Кейсы на ручное решение** → `site/public/api/soroka-review.json` —
  формат item идентичен РЕВИЗОРУ (`id/slug/name/issue/severity/detail/
  catalog/official/officialUrl/checkedAt/decision/decidedAt/applied`),
  merge-preserve уже принятых решений. Полный отчёт →
  `sources/audit/soroka-report.json`.
- Подключение кейсов в UI панели manager + revizor-apply — follow-up
  (формат совместим, wiring механический).

## Схема

Паритет со схемой сайта: `confidence?: 0..1` добавляется в item-схемы
(`programSchema`, `scholarshipSchema`, `campusItemSchema`,
`accommodationItemSchema`) в `scraper/src/schema.ts` и
`scraper/src/validate-unis.ts`. Site-схема уже содержит эти поля.

## Тестирование

`--slug=X --dry-run --skip-live` смоук → `--limit=20 --dry-run --skip-live` →
один live-слаг → `validate-unis` → сборка сайта (807 стр., exit 0).

## Критические правила (наследуются)

- НИКОГДА не удалять данные каталога; цены меняются только official-evidence.
- Любой ненулевой exit валит ПАУК (failedSteps-гейт).
