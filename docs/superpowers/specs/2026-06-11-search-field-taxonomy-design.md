# Унификация поиска: слой «направлений» (field taxonomy)

Дата: 2026-06-11
Статус: одобрено владельцем (подход A)

## Проблема

Пользователи ищут не точное название программы, а намерение: «хочу бизнес»,
«инженерия». Плюс одна специальность называется по-разному: «computer science»
и «IT engineering» — одно и то же. Сейчас поиск — это подстрочный
`data-search.includes(q)` по названиям программ + RU-синонимам
(`search-synonyms.ts`). Поэтому:

- «бизнес» матчит только карточки, где буквально есть слово business —
  программа «Marketing» не попадёт, хотя это бизнес-направление.
- «computer science» и «IT» дают разные выборки — нет группировки.
- Нет видимых категорий: кто не знает термина, не может ткнуть «Инженерия».

## Решение (обзор)

Добавить **поверх уже работающего** курируемый слой «направлений» (fields).
Направление = каноническое имя + набор EN-ключей принадлежности + широкие
RU-алиасы + ярлык для чипа. Слой питает обе вещи сразу:

1. **Умный текст-поиск** — широкие/синонимичные термины разворачиваются в полный
   набор ключей направления (через дозапись в `data-search`).
2. **Кликабельные чипы-категории** — отдельный мультивыбор-фильтр `field`,
   зеркало уже существующего механизма `faculty`.

Проверенный фикс (индексация `programs[].title` + `search-synonyms.ts`)
**не трогаем** — новый слой идёт сверху, аддитивно.

## Подход: A (отдельный фильтр `field`)

Отклонённая альтернатива B (чип вписывает слово в поле `q`): single-select по
ощущению, затирает введённый текст, не шарится отдельным URL-параметром. A —
тот же паттерн, что уже в коде для `faculty`/`level`, минимум нового.

## Архитектура (3 юнита)

### 1. `site/src/scripts/fields.ts` (новый)

Курируемая таблица направлений и функция вывода.

```ts
export interface Field {
  id: string;        // стабильный slug для data-fields / URL: 'business'
  label: string;     // RU-ярлык чипа: 'Бизнес'
  en: string[];      // ключи принадлежности (lowercase), матч-подстрока по haystack
  ru: string[];      // широкие RU-алиасы для дозаписи в data-search
}

export const FIELDS: ReadonlyArray<Field> = [ /* ~12 стартовых */ ];

// Какие направления у карточки: id всех полей, чей хоть один en-ключ есть в haystack.
export function fieldsFor(haystackLower: string): string[];

// Поисковые токены направления для дозаписи в data-search:
// для каждого подходящего поля — label + все ru + все en.
export function fieldSearchTokens(haystackLower: string): string[];
```

Контракт:
- `en` матчатся как подстрока по уже-lowercase haystack (как `ruSynonymsFor`).
- `id` стабилен — менять нельзя (ломает шарящиеся URL).
- Юнит чистый, без DOM/Astro — тестируется изолированно.

Стартовые ~12 направлений (внутри `en` — сколько нужно ключей):
business, cs (IT/Computer Science), engineering, medicine (health),
law, arts (design/art), sciences (естественные), humanities,
media (media/journalism/communication), education, hospitality (tourism), sport.

### 2. `site/src/components/UniversityCardV2.astro` (+~4 строки)

На этапе билда, после уже существующего `searchBase`:

- вычислить `const cardFields = fieldsFor(searchBase);`
- `const fieldChips = cardFields.join(',');` → новый атрибут `data-fields={fieldChips}`;
- в `searchIndex` добавить `...fieldSearchTokens(searchBase)` рядом с
  `...ruSynonymsFor(searchBase)`.

Результат: «бизнес» (ru-алиас поля business) попадает в haystack карточки с
программой Marketing → матчится. «IT» и «computer science» — оба en-ключи поля
cs → обе формулировки дают один набор.

### 3. `site/src/scripts/catalog-v2.ts` + UI чипов

Клиентский фильтр — зеркало `faculty`:

- `FilterState` += `fields: Set<string>`.
- `readState`: собрать `fd.getAll('field')`.
- `cardMatches`: если `state.fields.size > 0` — карточка проходит, если хоть один
  её `data-fields` есть в выбранных (OR-семантика, как у faculty).
- `countActive`: +1 если `fields.size > 0`.
- `syncUrl` / `restoreFromUrl`: параметр `field=business,cs` (как `faculty`).

UI: ряд чипов-чекбоксов `name="field"` над сеткой (в `index.astro` либо
`Filters.astro`, по месту существующих фильтров). Каждый чип = `Field.label`,
value = `Field.id`. Источник — импорт `FIELDS` (рендер на билде).

## Поток данных

```
programs[].title (билд)
  → searchBase (lowercase)
  → fieldsFor()        → data-fields  ──┐
  → fieldSearchTokens()→ data-search    │
  → ruSynonymsFor()    → data-search    │  (клиент)
                                        ▼
   чип name="field"  →  state.fields  → cardMatches(data-fields)
   текст q           →  state.q       → cardMatches(data-search.includes)
```

Два независимых пути: чипы фильтруют по `data-fields`, текст — по `data-search`.
Комбинируются по AND (как все существующие фильтры).

## Обработка краёв

- Карточка без подходящих полей: `data-fields=""` → не попадает ни под один чип
  (ожидаемо). Текст-поиск по ней работает как раньше.
- Пустой выбор чипов: ветка `fields` пропускается — поведение как сегодня.
- Неизвестный `field` в URL: просто не матчит ни одну карточку чипом; не падает.
- Новое экзотическое направление, не вписанное в таблицу: не группируется —
  принятый компромисс «лёгкого словаря» (добавляется рукой при необходимости).

## Тестирование

- `fields.ts` — юнит-проверки чистых функций:
  - `fieldsFor('... marketing ...')` содержит `'business'`.
  - `fieldsFor('... computer science ...')` и `fieldsFor('... information technology ...')`
    оба содержат `'cs'`.
  - `fieldSearchTokens('... marketing ...')` содержит `'бизнес'`.
- Сборка: `npm run build` проходит, карточки получают `data-fields`.
- Дымовая проверка на собранном `dist`: запрос «бизнес» даёт десятки карточек
  (а не единицы); клик по чипу «Инженерия» фильтрует.

## Объём и риск

~1 новый файл + 3 точечные правки. Не трогает проверенный фикс
(`programs[].title` индексация, `search-synonyms.ts`). Риск низкий —
все изменения аддитивны и зеркалят существующий механизм `faculty`.

Известный минус: покрытие ограничено таблицей (выбор владельца — «лёгкий
словарь»), новые направления добавляются вручную.
