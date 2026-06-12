# i18n мультиязычный сайт (RU/EN/KK) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сделать каталог StudyRoom и per-uni лэндинги доступными на русском (default), английском и казахском с видимым переключателем языка; Phase 1 = инфраструктура i18n + перевод всего интерфейса и шаблонной прозы лэндинга.

**Architecture:** Встроенный Astro i18n (`prefixDefaultLocale:false`): RU на `/`, EN на `/en/`, KK на `/kk/`. Все UI-строки уезжают в плоский словарь `src/i18n/ui.ts` (3 локали, общие ключи), доступ через `useTranslations(locale)`. Захардкоженная разметка выносится в общие компоненты, принимающие `(data, locale, t)`; корневые роуты рендерят их с `ru`, префиксные роуты `[lang]/…` — с `en`/`kk`. Контент-проза вузов уже двуязычна (`paragraphs`/`paragraphsRu`), KK падает на EN до Phase 2.

**Tech Stack:** Astro 5, TypeScript, `astro:content` collections, `@astrojs/sitemap`.

**Спека:** `docs/superpowers/specs/2026-06-12-i18n-multilingual-site-design.md`

---

## Соглашения (читать перед началом)

- **Ветка:** уже на `feat/i18n-multilingual`. Не сливать в `main` напрямую — только PR (правило каталога). Стейджить файлы **поимённо**, не `git add -A` (в дереве могут быть чужие правки параллельных сессий).
- **GateGuard:** перед каждой первой Bash-командой в шелле давать 2 строки фактов (запрос + что делает команда). `ECC_GATEGUARD=off` блокируется классификатором — не пытаться.
- **Рабочая директория:** `…/studyroom-project-site/site` (там `package.json`, `astro.config.mjs`).
- **Сборка:** `npm run build`. Дев-сервер: `npm run dev` (порт по умолчанию 4321).
- **Тип локали:** `type Locale = 'ru' | 'en' | 'kk'` — единый источник в `src/i18n/utils.ts`, импортировать оттуда везде.
- **Правило перевода:** `ru` — источник истины. Для каждого ключа исполнитель пишет **точные** EN и KK переводы (KK — литературный казахский; технические термины IELTS/TOEFL/UCAS не переводить). Топонимы и валюты не калькировать вслепую.

## Карта файлов

**Создать:**
- `site/src/i18n/utils.ts` — тип `Locale`, `locales`, `defaultLocale`, `getLocaleFromUrl`, `useTranslations`, `localizeUrl`, `getLocalePaths`.
- `site/src/i18n/ui.ts` — словарь `ui: Record<Locale, Record<string,string>>` + namespace-группы.
- `site/src/i18n/keys.test.ts` — тест паритета ключей между локалями.
- `site/src/components/LangSwitcher.astro` — переключатель RU·EN·KK.
- `site/src/components/LandingBody.astro` — вынесенное тело per-uni лэндинга (из `[slug].astro`).
- `site/src/pages/[lang]/index.astro` — каталог для en/kk.
- `site/src/pages/[lang]/compare.astro` — сравнение для en/kk.
- `site/src/pages/[lang]/[slug].astro` — лэндинг для en/kk.

**Изменить:**
- `site/astro.config.mjs` — блок `i18n`.
- `site/src/layouts/Base.astro` — проп `locale`, `<html lang>`, `og:locale`, `hreflang`, переведённые дефолты, вставка `LangSwitcher`.
- `site/src/pages/index.astro` — вынести тело в `CatalogBody.astro` ИЛИ принять `locale='ru'` и прокинуть `t` в компоненты (см. Task 5).
- `site/src/components/HeroV2.astro`, `Filters.astro`, `UniversityCardV2.astro` — принять `locale`, заменить строки на `t(...)`.
- `site/src/pages/compare.astro` — `locale='ru'`, строки через `t`.
- `site/src/pages/[slug].astro` — рендерить через `LandingBody` с `locale='ru'`.

**Не трогать:** `site/src/pages/manager.astro` (внутренний CMS, noindex).

---

## Task 1: i18n-утилиты и тип локали

**Files:**
- Create: `site/src/i18n/utils.ts`

- [ ] **Step 1: Написать `utils.ts`**

```ts
// site/src/i18n/utils.ts
import { ui, defaultLocale as DEFAULT } from './ui';

export type Locale = 'ru' | 'en' | 'kk';
export const locales: Locale[] = ['ru', 'en', 'kk'];
export const defaultLocale: Locale = DEFAULT;

/** Не-дефолтные локали — для getStaticPaths префиксных роутов. */
export function getLocalePaths(): Locale[] {
  return locales.filter((l) => l !== defaultLocale);
}

/** Локаль из URL: /en/... → 'en', /kk/... → 'kk', иначе дефолт. */
export function getLocaleFromUrl(url: URL): Locale {
  const seg = url.pathname.split('/').filter(Boolean)[0];
  return (locales as string[]).includes(seg) ? (seg as Locale) : defaultLocale;
}

/** t(key) с фоллбэком на дефолтную локаль, затем на сам ключ. */
export function useTranslations(locale: Locale) {
  return function t(key: string): string {
    return ui[locale]?.[key] ?? ui[defaultLocale]?.[key] ?? key;
  };
}

/**
 * Строит путь к той же странице в другой локали.
 * Снимает текущий префикс локали (если есть) и добавляет новый (если не дефолт).
 * '/' и '/oxford' для en → '/en' и '/en/oxford'; для ru → '/' и '/oxford'.
 */
export function localizeUrl(pathname: string, target: Locale): string {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length && (locales as string[]).includes(parts[0])) parts.shift();
  const base = parts.join('/');
  if (target === defaultLocale) return '/' + base;
  return '/' + [target, base].filter(Boolean).join('/');
}
```

- [ ] **Step 2: Проверка типов** — отложить запуск до Task 2 (utils импортирует `ui`, которого ещё нет). Перейти к Task 2.

---

## Task 2: словарь строк `ui.ts`

**Files:**
- Create: `site/src/i18n/ui.ts`

**Принцип:** плоские ключи с namespace-префиксом через точку. Группы:
`nav.*`, `footer.*`, `hero.*`, `trust.*`, `filters.*`, `card.*`, `catalog.*`,
`compare.*`, `lp.*` (landing page: nav/hero/money/programs/requirements/about/living/dates/faq/cta), `lvl.*` (уровни программ).

- [ ] **Step 1: Создать каркас с дефолтной локалью и сидом уже известных строк**

```ts
// site/src/i18n/ui.ts
export const defaultLocale = 'ru' as const;

// RU — источник истины. Сид строками, уже найденными в коде (расширяется по Task 3–7).
const ru: Record<string, string> = {
  // header / footer (Base.astro)
  'nav.catalog': 'Каталог',
  'nav.consult': 'Консультация',
  'brand.aria.home': 'StudyRoom — главная',
  'footer.tagline': 'Каталог собирается автоматически и проверяется вручную перед публикацией.',
  'footer.legal': 'Данные о программах и стоимости актуализируются раз в месяц.',
  'footer.manage': 'Управление',
  'meta.description': 'StudyRoom — каталог зарубежных университетов с актуальными ценами и дедлайнами.',
  // hero (HeroV2.astro)
  'hero.eyebrow': 'StudyRoom · поступление за рубеж',
  'hero.title.l1': 'Поступление в зарубежный вуз —',
  'hero.title.l2': 'без посредников между вами и приёмной комиссией',
  'hero.lead': 'Партнёрский каталог: UK, Австралия, Новая Зеландия, Канада и США. Цены в тенге, актуальные дедлайны, прямые контракты с университетами.',
  'hero.kpi.universities': 'университетов',
  'hero.kpi.programs': 'программ',
  'hero.kpi.countries': 'страны',
  'hero.kpi.updated': 'данные обновлены',
  'hero.search.placeholder': 'Glasgow, Канада, Computer Science, стипендия',
  'hero.search.btn': 'Найти',
  'hero.cta.scroll': '↓ Листать каталог',
  'hero.cta.consult': '15 мин с куратором',
  // trust strip + catalog (index.astro)
  'trust.consultFree': 'бесплатно',
  'catalog.filters': 'Фильтры',
  'catalog.reset': 'Сбросить',
  'catalog.found': 'Найдено:',
  'catalog.universities': 'университетов',
  'catalog.empty': 'По заданным условиям ничего не нашлось — попробуйте «Сбросить» или напишите нам в WhatsApp, подберём вручную.',
  'catalog.finalTitle': 'Не нашли подходящий университет?',
  'catalog.finalCta': '💬 Подобрать вуз в WhatsApp',
  'compare.bar.title': 'К сравнению',
  'compare.bar.clear': 'Очистить',
  'compare.bar.cta': 'Сравнить →',
  // filters (Filters.astro)
  'filters.country': 'Страна',
  'filters.all': 'Все',
  'filters.program': 'Программа',
  'filters.faculty': 'Направление',
  'filters.ieltsMax': 'IELTS не выше',
  'filters.priceMax': 'Стоимость до (GBP/год)',
  // levels
  'lvl.bachelor': 'Бакалавриат',
  'lvl.master': 'Магистратура',
  'lvl.phd': 'Аспирантура',
  // card (UniversityCardV2.astro)
  'card.priceTbd': 'уточняется',
  'card.compareAdd': 'Добавить к сравнению',
  'card.compare': 'к сравнению',
  'card.perYear': '/год',
  'card.scholarship': '🎓 Стипендия',
  'card.programs': 'программ',
  'card.faculties': 'факультетов',
  'card.more': 'Подробнее →',
  'card.ask': '💬 Спросить про этот вуз',
  // ВНИМАНИЕ: ключи lp.* (landing) добавляются в Task 7 — там же их EN/KK.
};

const en: Record<string, string> = {
  'nav.catalog': 'Catalogue',
  'nav.consult': 'Consultation',
  'brand.aria.home': 'StudyRoom — home',
  'footer.tagline': 'The catalogue is assembled automatically and verified by hand before publishing.',
  'footer.legal': 'Programme and tuition data are refreshed monthly.',
  'footer.manage': 'Manage',
  'meta.description': 'StudyRoom — a catalogue of universities abroad with up-to-date tuition and deadlines.',
  'hero.eyebrow': 'StudyRoom · study abroad',
  'hero.title.l1': 'Enrol at a university abroad —',
  'hero.title.l2': 'with no middlemen between you and the admissions office',
  'hero.lead': 'Partner catalogue: UK, Australia, New Zealand, Canada and the USA. Prices in KZT, current deadlines, direct contracts with universities.',
  'hero.kpi.universities': 'universities',
  'hero.kpi.programs': 'programmes',
  'hero.kpi.countries': 'countries',
  'hero.kpi.updated': 'data updated',
  'hero.search.placeholder': 'Glasgow, Canada, Computer Science, scholarship',
  'hero.search.btn': 'Search',
  'hero.cta.scroll': '↓ Browse the catalogue',
  'hero.cta.consult': '15 min with an advisor',
  'trust.consultFree': 'free',
  'catalog.filters': 'Filters',
  'catalog.reset': 'Reset',
  'catalog.found': 'Found:',
  'catalog.universities': 'universities',
  'catalog.empty': 'Nothing matched your filters — try “Reset” or message us on WhatsApp and we will pick options by hand.',
  'catalog.finalTitle': 'Didn’t find the right university?',
  'catalog.finalCta': '💬 Find a university on WhatsApp',
  'compare.bar.title': 'To compare',
  'compare.bar.clear': 'Clear',
  'compare.bar.cta': 'Compare →',
  'filters.country': 'Country',
  'filters.all': 'All',
  'filters.program': 'Programme',
  'filters.faculty': 'Field',
  'filters.ieltsMax': 'IELTS up to',
  'filters.priceMax': 'Tuition up to (GBP/year)',
  'lvl.bachelor': 'Bachelor’s',
  'lvl.master': 'Master’s',
  'lvl.phd': 'PhD',
  'card.priceTbd': 'to be confirmed',
  'card.compareAdd': 'Add to comparison',
  'card.compare': 'compare',
  'card.perYear': '/year',
  'card.scholarship': '🎓 Scholarship',
  'card.programs': 'programmes',
  'card.faculties': 'fields',
  'card.more': 'Details →',
  'card.ask': '💬 Ask about this university',
};

const kk: Record<string, string> = {
  'nav.catalog': 'Каталог',
  'nav.consult': 'Кеңес алу',
  'brand.aria.home': 'StudyRoom — басты бет',
  'footer.tagline': 'Каталог автоматты түрде жиналып, жарияланар алдында қолмен тексеріледі.',
  'footer.legal': 'Бағдарламалар мен оқу ақысы туралы деректер айына бір рет жаңартылады.',
  'footer.manage': 'Басқару',
  'meta.description': 'StudyRoom — шетелдік университеттер каталогы: өзекті бағалар мен мерзімдер.',
  'hero.eyebrow': 'StudyRoom · шетелде оқу',
  'hero.title.l1': 'Шетелдік университетке түсу —',
  'hero.title.l2': 'сіз бен қабылдау комиссиясының арасында делдалсыз',
  'hero.lead': 'Серіктес каталог: Ұлыбритания, Аустралия, Жаңа Зеландия, Канада және АҚШ. Бағасы теңгемен, өзекті мерзімдер, университеттермен тікелей келісімшарт.',
  'hero.kpi.universities': 'университет',
  'hero.kpi.programs': 'бағдарлама',
  'hero.kpi.countries': 'ел',
  'hero.kpi.updated': 'дерек жаңартылды',
  'hero.search.placeholder': 'Glasgow, Канада, Computer Science, стипендия',
  'hero.search.btn': 'Іздеу',
  'hero.cta.scroll': '↓ Каталогты қарау',
  'hero.cta.consult': 'Куратормен 15 минут',
  'trust.consultFree': 'тегін',
  'catalog.filters': 'Сүзгілер',
  'catalog.reset': 'Тазалау',
  'catalog.found': 'Табылды:',
  'catalog.universities': 'университет',
  'catalog.empty': 'Шарттарыңызға ештеңе сәйкес келмеді — «Тазалау» түймесін басып көріңіз немесе WhatsApp арқылы жазыңыз, қолмен таңдап береміз.',
  'catalog.finalTitle': 'Қажетті университетті таппадыңыз ба?',
  'catalog.finalCta': '💬 WhatsApp-та университет таңдау',
  'compare.bar.title': 'Салыстыруға',
  'compare.bar.clear': 'Тазалау',
  'compare.bar.cta': 'Салыстыру →',
  'filters.country': 'Ел',
  'filters.all': 'Барлығы',
  'filters.program': 'Бағдарлама',
  'filters.faculty': 'Бағыт',
  'filters.ieltsMax': 'IELTS шегі',
  'filters.priceMax': 'Оқу ақысы (GBP/жыл) дейін',
  'lvl.bachelor': 'Бакалавриат',
  'lvl.master': 'Магистратура',
  'lvl.phd': 'Аспирантура',
  'card.priceTbd': 'нақтыланып жатыр',
  'card.compareAdd': 'Салыстыруға қосу',
  'card.compare': 'салыстыруға',
  'card.perYear': '/жыл',
  'card.scholarship': '🎓 Стипендия',
  'card.programs': 'бағдарлама',
  'card.faculties': 'бағыт',
  'card.more': 'Толығырақ →',
  'card.ask': '💬 Осы университет туралы сұрау',
};

export const ui = { ru, en, kk } as const;
```

- [ ] **Step 2: Проверить, что проект типизируется**

Facts: (1) ставлю i18n-каркас; (2) команда проверяет типы Astro.
Run: `cd site && npx astro check 2>&1 | tail -20`
Expected: нет ошибок, связанных с `i18n/utils.ts` / `i18n/ui.ts` (предупреждения по другим файлам игнорировать).

- [ ] **Step 3: Commit**

```bash
git add site/src/i18n/utils.ts site/src/i18n/ui.ts
git commit -m "feat(i18n): add locale utils and base UI string dictionary (ru/en/kk)"
```

---

## Task 3: тест паритета ключей

**Files:**
- Create: `site/src/i18n/keys.test.ts`

Защита от пропущенных переводов: каждый ключ `ru` обязан существовать в `en` и `kk`.

- [ ] **Step 1: Написать тест**

```ts
// site/src/i18n/keys.test.ts
import { describe, it, expect } from 'vitest';
import { ui } from './ui';

describe('i18n key parity', () => {
  const ruKeys = Object.keys(ui.ru).sort();
  for (const loc of ['en', 'kk'] as const) {
    it(`${loc} has every ru key`, () => {
      const missing = ruKeys.filter((k) => !(k in ui[loc]));
      expect(missing, `missing in ${loc}: ${missing.join(', ')}`).toEqual([]);
    });
  }
});
```

- [ ] **Step 2: Запустить тест**

Facts: (1) проверяю полноту переводов; (2) команда гоняет тест паритета ключей.
Run: `cd site && npx vitest run src/i18n/keys.test.ts`
Expected: PASS (если `vitest` не настроен — см. `package.json` scripts; уже используется в `fields.test.ts`, значит доступен). Если падает — дозаполнить недостающие ключи.

- [ ] **Step 3: Commit**

```bash
git add site/src/i18n/keys.test.ts
git commit -m "test(i18n): assert en/kk cover all ru keys"
```

---

## Task 4: конфиг Astro i18n

**Files:**
- Modify: `site/astro.config.mjs`

- [ ] **Step 1: Добавить блок `i18n`** (внутри объекта `defineConfig`, например после `trailingSlash`):

```js
  i18n: {
    locales: ['ru', 'en', 'kk'],
    defaultLocale: 'ru',
    routing: { prefixDefaultLocale: false },
  },
```

- [ ] **Step 2: Проверить сборку (роутов пока нет — должна пройти как раньше)**

Facts: (1) включаю i18n-роутинг; (2) команда собирает сайт для регресс-проверки.
Run: `cd site && npm run build 2>&1 | tail -15`
Expected: build OK, число страниц как до изменения.

- [ ] **Step 3: Commit**

```bash
git add site/astro.config.mjs
git commit -m "feat(i18n): enable astro i18n routing (ru default, en/kk prefixed)"
```

---

## Task 5: переключатель языка + локаль-aware Base

**Files:**
- Create: `site/src/components/LangSwitcher.astro`
- Modify: `site/src/layouts/Base.astro`

- [ ] **Step 1: Создать `LangSwitcher.astro`**

```astro
---
import { locales, localizeUrl, getLocaleFromUrl, type Locale } from '~/i18n/utils';
const current: Locale = getLocaleFromUrl(Astro.url);
const labels: Record<Locale, string> = { ru: 'RU', en: 'EN', kk: 'KK' };
const path = Astro.url.pathname;
---
<nav class="lang-switcher" aria-label="Язык сайта">
  {locales.map((loc) => (
    loc === current
      ? <span class="lang-switcher__item is-active" aria-current="true">{labels[loc]}</span>
      : <a class="lang-switcher__item" hreflang={loc} href={localizeUrl(path, loc)}>{labels[loc]}</a>
  ))}
</nav>
<style>
  .lang-switcher { display: inline-flex; gap: 2px; align-items: center; }
  .lang-switcher__item {
    padding: 4px 8px; font-size: 0.8rem; font-weight: 700; border-radius: var(--radius-pill);
    color: var(--color-text-muted); text-decoration: none; line-height: 1;
  }
  .lang-switcher__item:hover { color: var(--color-primary-dark); }
  .lang-switcher__item.is-active { background: var(--color-primary-soft); color: var(--color-primary-dark); }
</style>
```

- [ ] **Step 2: Сделать `Base.astro` локаль-aware**

Изменения в `site/src/layouts/Base.astro`:

1. Во фронтматтере добавить импорты и вычисление локали/`t`:

```astro
import { getLocaleFromUrl, useTranslations, locales, localizeUrl } from '~/i18n/utils';
import LangSwitcher from '~/components/LangSwitcher.astro';
const locale = getLocaleFromUrl(Astro.url);
const t = useTranslations(locale);
const ogLocale = { ru: 'ru_RU', en: 'en_US', kk: 'kk_KZ' }[locale];
```

2. Дефолт `description` заменить на `t('meta.description')`:

```astro
const { title, description = t('meta.description'), hideHeader = false, noindex = false } = Astro.props;
```

3. `<html lang="ru">` → `<html lang={locale}>`.

4. `og:locale` content `ru_RU` → `{ogLocale}`.

5. После `<link rel="canonical" …>` добавить hreflang-альтернативы:

```astro
{Astro.site && locales.map((loc) => (
  <link rel="alternate" hreflang={loc} href={new URL(localizeUrl(Astro.url.pathname, loc), Astro.site).href} />
))}
{Astro.site && <link rel="alternate" hreflang="x-default" href={new URL(localizeUrl(Astro.url.pathname, 'ru'), Astro.site).href} />}
```

6. В шапке: бренд-ссылку `href="/"` → `href={localizeUrl('/', locale)}`, `aria-label={t('brand.aria.home')}`; навигацию перевести:

```astro
<nav class="site-header__nav" aria-label="StudyRoom">
  <a href={localizeUrl('/', locale)}>{t('nav.catalog')}</a>
  <LangSwitcher />
  <a class="btn btn-primary btn-sm" href="https://studyroom.kz#contact" target="_blank" rel="noopener">
    {t('nav.consult')}
  </a>
</nav>
```

7. Footer: tagline/legal/manage через `t`, ссылку `/manager` оставить как есть (не локализуем):

```astro
<p class="muted" style="color:#cfcfcf;margin:0;">{t('footer.tagline')}</p>
…
© {year} StudyRoom. {t('footer.legal')}
<span style="margin-left: 8px; opacity: 0.5;">·</span>
<a href="/manager" style="color: #cfcfcf; margin-left: 4px;">{t('footer.manage')}</a>
```

- [ ] **Step 3: Проверить сборку**

Facts: (1) добавляю переключатель и локаль в layout; (2) команда собирает сайт.
Run: `cd site && npm run build 2>&1 | tail -15`
Expected: build OK.

- [ ] **Step 4: Commit**

```bash
git add site/src/components/LangSwitcher.astro site/src/layouts/Base.astro
git commit -m "feat(i18n): locale-aware Base layout + language switcher + hreflang"
```

---

## Task 6: локализовать компоненты каталога (Hero, Filters, Card)

**Files:**
- Modify: `site/src/components/HeroV2.astro`, `Filters.astro`, `UniversityCardV2.astro`

Каждый компонент получает проп `locale: Locale`, внутри строит `t = useTranslations(locale)` и заменяет захардкоженные строки. `toLocaleString('ru-RU')` / `localeCompare(…, 'ru')` заменить на локаль-зависимый код (`'en'`/`'kk'` → использовать `'en-US'` для чисел в en/kk, `'ru-RU'` для ru).

- [ ] **Step 1: `HeroV2.astro` — worked example**

Во фронтматтере:

```astro
import { useTranslations, type Locale } from '~/i18n/utils';
interface Props {
  locale: Locale;
  totalUniversities: number; totalPrograms: number; totalCountries: number;
  updatedAt: Date; whatsAppDeepLink: string;
}
const { locale, totalUniversities, totalPrograms, totalCountries, updatedAt, whatsAppDeepLink } = Astro.props;
const t = useTranslations(locale);
const numLocale = locale === 'ru' ? 'ru-RU' : 'en-US';
const updatedLabel = updatedAt.toLocaleDateString(numLocale, { day: 'numeric', month: 'long' });
```

В разметке заменить:
- eyebrow → `{t('hero.eyebrow')}`
- две строки заголовка → `{t('hero.title.l1')}` и `<span …>{t('hero.title.l2')}</span>`
- lead → `{t('hero.lead')}`
- KPI-лейблы → `{t('hero.kpi.universities')}`, `…programs`, `…countries`, `…updated`
- `totalPrograms.toLocaleString('ru-RU')` → `totalPrograms.toLocaleString(numLocale)`
- placeholder поиска → `placeholder={t('hero.search.placeholder')}`
- кнопка «Найти» → `{t('hero.search.btn')}`
- «↓ Листать каталог» → `{t('hero.cta.scroll')}`
- «15 мин с куратором» → `{t('hero.cta.consult')}`

- [ ] **Step 2: `Filters.astro`** — добавить `interface Props { locale: Locale; countries; levels; faculties; tuitionMax }`, `const t = useTranslations(locale)`. Заменить: «Страна»→`t('filters.country')`, «Все»→`t('filters.all')`, «Программа»→`t('filters.program')`, «Направление»→`t('filters.faculty')`, «IELTS не выше»→`t('filters.ieltsMax')`, «Стоимость до (GBP/год)»→`t('filters.priceMax')`, «Сбросить»→`t('catalog.reset')`. Словарь уровней (`bachelor/master/phd`) → `t('lvl.bachelor')` и т.д.

- [ ] **Step 3: `UniversityCardV2.astro`** — добавить `locale` в Props, `const t = useTranslations(locale)`. Заменить: «уточняется»→`t('card.priceTbd')`, «Добавить к сравнению»→`t('card.compareAdd')`, «к сравнению»→`t('card.compare')`, «/год»→`t('card.perYear')`, «🎓 Стипендия»→`t('card.scholarship')`, «программ»→`t('card.programs')`, «факультетов»→`t('card.faculties')`, «Подробнее →»→`t('card.more')`, «💬 Спросить про этот вуз»→`t('card.ask')`. Словарь уровней → `t('lvl.*')`. **Не трогать** скрытые `searchKeywords`-строки (RU синонимы для поиска) — это поисковый индекс, не UI. Ссылку на лэндинг внутри карточки строить через `localizeUrl(\`/\${data.slug}\`, locale)` (импортировать `localizeUrl`).

- [ ] **Step 4: Проверить сборка не падает по типам** (страницы ещё передают `locale` в Task 7 — временно компоненты могут требовать проп; это нормально, исправится в Task 7. Если нужен промежуточный билд — дать `locale` дефолт `= 'ru'` в Props и убрать дефолт в Task 7). Использовать дефолт `locale: Locale = 'ru'` в Props всех трёх компонентов, чтобы билд оставался зелёным между задачами.

- [ ] **Step 5: Commit**

```bash
git add site/src/components/HeroV2.astro site/src/components/Filters.astro site/src/components/UniversityCardV2.astro
git commit -m "feat(i18n): localize hero, filters and university card"
```

---

## Task 7: вынести тело лэндинга, локализовать всю прозу `[slug].astro`

**Files:**
- Create: `site/src/components/LandingBody.astro`
- Modify: `site/src/pages/[slug].astro`
- Modify: `site/src/i18n/ui.ts` (добавить namespace `lp.*` + таймлайны)

Это самая объёмная задача: лэндинг содержит ~100+ захардкоженных RU-предложений, общих для всех вузов (hero-заголовок, таймлайны по странам, тексты money/programs/requirements/about/living/dates/faq, калькулятор). Все они — шаблонные, переводятся один раз в `ui.ts`.

- [ ] **Step 1: Инвентаризация строк**

Facts: (1) собираю все RU-строки лэндинга для словаря; (2) команда печатает кириллические строки `[slug].astro` с номерами.
Run: `cd site && grep -nP '[А-Яа-яЁё]{3,}' src/pages/'[slug].astro'`
Действие: для каждой UI-строки (не комментарии `//`) завести ключ `lp.<section>.<name>` в `ui.ts` (`ru`/`en`/`kk`). Динамические интерполяции (`{u.name}`, `{sym}{tuitionMin}`) оставить в разметке, в словарь класть только статические сегменты; где предложение содержит переменную в середине — разбить на части или использовать функцию-формат (напр. ключ `'lp.hero.title'` = `'Поступим в {uni} с одной подачи — или вернём оплату услуги'` и заменять `{uni}` в компоненте через `.replace('{uni}', u.name)`).

Группы ключей (минимум): `lp.nav.*` (Каталог/Стипендии/Программы/Требования/Жильё/Сроки/«Виза и документы»/«Жильё и кампусы»/«Бесплатная консультация»), `lp.hero.*` (заголовок, lead, факт-лейблы «программ доступно»/«стипендий для иностранцев»/«стоимость / год», кнопки, строка про куратора, подпись медиа), `lp.money.*`, `lp.calc.*` (строки калькулятора: «Обучение, 1 год», «Жильё (≈30 нед)», «Виза + страховка», «Услуги StudyRoom», «Итого за год», «Со стипендией» …), `lp.programs.*` (+ уровни-кнопки Все/Школа/Бакалавриат/Магистратура/Английский/Короткие), `lp.req.*` (документы, баллы, подсказки по странам, IELTS-блок), `lp.reviews.*`, `lp.about.*`, `lp.living.*`, `lp.dates.*`, `lp.faq.*`, `lp.cta.*`. Таймлайны (4 страновых массива + нейтральный) вынести как ключи `lp.timeline.uk.0.title` / `.text` … или как локализованные массивы в отдельном модуле `src/i18n/timelines.ts` (предпочтительно — массивы громоздкие для плоского словаря).

- [ ] **Step 2: Создать `src/i18n/timelines.ts`** с типизированными локализованными таймлайнами:

```ts
// site/src/i18n/timelines.ts
import type { Locale } from './utils';
export interface TimelineItem { title: string; text: string; }
type Key = 'uk' | 'canada' | 'au' | 'us' | 'generic';
export const timelines: Record<Locale, Record<Key, TimelineItem[]>> = {
  ru: { /* перенести существующие 5 массивов из [slug].astro как есть */ },
  en: { /* перевод */ },
  kk: { /* перевод */ },
};
export function pickTimeline(locale: Locale, country: string): TimelineItem[] {
  const c = country.toLowerCase();
  const key: Key =
    /kingdom|britain|england|scotland|wales/.test(c) ? 'uk'
    : /canada/.test(c) ? 'canada'
    : /australia|zealand/.test(c) ? 'au'
    : /united states|usa|america/.test(c) ? 'us'
    : 'generic';
  return timelines[locale][key];
}
```

- [ ] **Step 3: Вынести тело в `LandingBody.astro`**

Создать `site/src/components/LandingBody.astro` с `interface Props { u: <тип university>; locale: Locale }`. Перенести в него всю разметку из `<body>`-части `[slug].astro` (всё, что сейчас рендерит лэндинг), плюс относящийся к рендеру код фронтматтера (вычисления `heroPhoto`, `faculties`, `tuitionMin`, `sym`, `waLink`, и т.п.). Внутри: `const t = useTranslations(locale)`, таймлайн через `pickTimeline(locale, u.country)`. Все захардкоженные строки → `t('lp.*')`. Выбор прозы вуза по локали:

```astro
const paragraphs = locale === 'ru'
  ? (u.description?.paragraphsRu ?? u.description?.paragraphs ?? [])
  : (u.description?.paragraphs ?? u.description?.paragraphsRu ?? []);
const keyFacts = locale === 'ru'
  ? (u.description?.keyFactsRu ?? u.description?.keyFacts ?? [])
  : (u.description?.keyFacts ?? u.description?.keyFactsRu ?? []);
```

(KK берёт `paragraphs`/`keyFacts` — EN-фоллбэк до Phase 2.)

- [ ] **Step 4: Превратить `[slug].astro` в тонкую обёртку (RU)**

```astro
---
import { getCollection } from 'astro:content';
import Base from '~/layouts/Base.astro';
import LandingBody from '~/components/LandingBody.astro';
export async function getStaticPaths() {
  const unis = await getCollection('universities');
  return unis.map((e) => ({ params: { slug: e.data.slug }, props: { u: e.data } }));
}
const { u } = Astro.props;
const pageTitle = `${u.name} — поступление из Казахстана | StudyRoom`;
// pageDescription как было
---
<Base title={pageTitle} description={pageDescription}>
  <LandingBody u={u} locale="ru" />
</Base>
```

(Сохранить существующие `<style>`/`<script>` лэндинга — перенести их в `LandingBody.astro` либо оставить в обёртке; держать рядом с разметкой, которую они обслуживают.)

- [ ] **Step 5: Сборка + визуальная сверка RU-лэндинга**

Facts: (1) проверяю, что вынос тела не сломал RU-лэндинг; (2) команда собирает сайт.
Run: `cd site && npm run build 2>&1 | tail -15`
Expected: build OK, число страниц как раньше. Открыть один лэндинг в `npm run dev` и глазами сверить с прежним видом (регрессий нет).

- [ ] **Step 6: Commit**

```bash
git add site/src/components/LandingBody.astro site/src/pages/'[slug].astro' site/src/i18n/ui.ts site/src/i18n/timelines.ts
git commit -m "feat(i18n): extract LandingBody, localize landing copy + timelines"
```

---

## Task 8: префиксные роуты `/en/` и `/kk/`

**Files:**
- Create: `site/src/pages/[lang]/index.astro`, `site/src/pages/[lang]/compare.astro`, `site/src/pages/[lang]/[slug].astro`
- Modify: `site/src/pages/index.astro`, `site/src/pages/compare.astro` (прокинуть `locale` в компоненты)

- [ ] **Step 1: Обновить корневой `index.astro`** — передать `locale="ru"` во все локализованные компоненты:
`<HeroV2 locale="ru" … />`, `<Filters locale="ru" … />`, `<UniversityCardV2 locale="ru" … />`, и заменить захардкоженные строки самой `index.astro` (trust-strip, «Фильтры», «Сбросить», «Найдено», «университетов», empty-текст, final-cta, compare-bar) на `t('…')` с `const t = useTranslations('ru')`. Числа: оставить `'ru-RU'` для ru.

- [ ] **Step 2: Создать `src/pages/[lang]/index.astro`**

```astro
---
import { getCollection } from 'astro:content';
import Base from '~/layouts/Base.astro';
import HeroV2 from '~/components/HeroV2.astro';
import UniversityCardV2 from '~/components/UniversityCardV2.astro';
import Filters from '~/components/Filters.astro';
import { CONTACTS } from '~/content/studyroom/contacts';
import { getLocalePaths, useTranslations, type Locale } from '~/i18n/utils';

export function getStaticPaths() {
  return getLocalePaths().map((lang) => ({ params: { lang } }));
}
const locale = Astro.params.lang as Locale;
const t = useTranslations(locale);
const numLocale = locale === 'ru' ? 'ru-RU' : 'en-US';
// …та же подготовка данных, что в корневом index.astro (universities, countries, levels, faculties, tuitionMax, totalPrograms, whatsapp-хелперы)…
---
<!-- тот же разметочный блок, что в index.astro, но locale={locale}, t(...) и numLocale -->
```

**DRY-примечание:** чтобы не дублировать ~250 строк разметки index, допустимо вынести тело каталога в `components/CatalogBody.astro(props: {locale})` и звать его и из корневого `index.astro` (`locale="ru"`), и из `[lang]/index.astro` (`locale={Astro.params.lang}`). Рекомендуется этот вариант — тогда Step 1 и Step 2 рендерят один компонент. Подготовку данных (getCollection) сделать внутри `CatalogBody`.

- [ ] **Step 3: Создать `src/pages/[lang]/[slug].astro`**

```astro
---
import { getCollection } from 'astro:content';
import Base from '~/layouts/Base.astro';
import LandingBody from '~/components/LandingBody.astro';
import { getLocalePaths, type Locale } from '~/i18n/utils';

export async function getStaticPaths() {
  const unis = await getCollection('universities');
  const langs = getLocalePaths();
  return langs.flatMap((lang) =>
    unis.map((e) => ({ params: { lang, slug: e.data.slug }, props: { u: e.data } }))
  );
}
const { u } = Astro.props;
const locale = Astro.params.lang as Locale;
const titleByLocale = {
  en: `${u.name} — study from Kazakhstan | StudyRoom`,
  kk: `${u.name} — Қазақстаннан оқуға түсу | StudyRoom`,
  ru: `${u.name} — поступление из Казахстана | StudyRoom`,
}[locale];
---
<Base title={titleByLocale}>
  <LandingBody u={u} locale={locale} />
</Base>
```

- [ ] **Step 4: Создать `src/pages/[lang]/compare.astro`** — аналогично: `getStaticPaths` по `getLocalePaths()`, рендер общего тела сравнения с `locale={Astro.params.lang}`. Предварительно (в этом же шаге) корневой `compare.astro` так же перевести через `t` и, по аналогии с каталогом, вынести тело в `components/CompareBody.astro(props:{locale})`, чтобы оба роута его звали. Все RU-строки `compare.astro` (заголовки колонок, кнопки, лейблы) добавить в `ui.ts` под `compare.*` с EN/KK.

- [ ] **Step 5: Сборка — проверить генерацию префиксных страниц**

Facts: (1) проверяю генерацию /en/ и /kk/; (2) команда собирает сайт и считает выходные страницы по локалям.
Run: `cd site && npm run build 2>&1 | tail -20 && ls dist/en dist/kk >/dev/null && echo "EN+KK dirs OK"`
Expected: build OK; присутствуют `dist/en/index.html`, `dist/kk/index.html`, `dist/en/<slug>/index.html` и т.д.

- [ ] **Step 6: Commit**

```bash
git add site/src/pages/'[lang]' site/src/pages/index.astro site/src/pages/compare.astro site/src/components/CatalogBody.astro site/src/components/CompareBody.astro
git commit -m "feat(i18n): add /en and /kk prefixed routes for catalog, compare, landings"
```

---

## Task 9: финальная проверка ключей, сборка, QA, PR

- [ ] **Step 1: Прогнать тест паритета ключей (теперь со всеми lp.* и compare.*)**

Facts: (1) финальная проверка полноты переводов; (2) команда гоняет тест паритета.
Run: `cd site && npx vitest run src/i18n/keys.test.ts`
Expected: PASS. Если падает — дозаполнить EN/KK для перечисленных ключей.

- [ ] **Step 2: Чистая сборка**

Facts: (1) финальная сборка; (2) команда собирает весь сайт.
Run: `cd site && npm run build 2>&1 | tail -20`
Expected: build OK, без ошибок.

- [ ] **Step 3: Ручной QA в dev**

Facts: (1) проверяю переключатель и три локали; (2) команда поднимает dev-сервер.
Run: `cd site && npm run dev` (фоном), открыть `/`, `/en`, `/kk`; на лэндинге `/oxford`, `/en/oxford`, `/kk/oxford`.
Чек-лист: переключатель ведёт на эквивалентный путь; активная локаль подсвечена; `<html lang>` корректен (DevTools); UI переведён на EN/KK; проза вуза показывается (EN на en/kk, RU на ru); нет «голых ключей» вида `lp.hero.title` на странице.

- [ ] **Step 4: Финальный коммит и PR**

```bash
git add -A   # ВНИМАНИЕ: только если в дереве нет чужих изменений; иначе git add по путям
git commit -m "feat(i18n): finalize multilingual site (ru/en/kk) phase 1" --allow-empty
git push -u origin feat/i18n-multilingual
gh pr create --fill --base main --title "feat(i18n): multilingual site RU/EN/KK (Phase 1: UI)"
gh pr merge --auto --squash
```

(Прямой push в `main` блокируется авто-классификатором — только через PR.)

---

## Phase 2 (вне этого плана) — кодворд ТІЛ

Перевод **прозы вузов** на казахский (и недостающей RU-прозы): добавить `paragraphsKk`/`keyFactsKk` в Zod-схему (`site/src/schema/university.ts` + `scraper`-копию), затем bulk-перевод 808 файлов фоновым Node/Agent-пайплайном (quiet_mode). После — в `LandingBody` ветку `kk` переключить с EN-фоллбэка на `*Kk`. Локализация `manager.astro` — отдельно, по необходимости.

## Self-review (выполнено автором плана)

- **Spec coverage:** конфиг (T4), каркас ui/utils (T1–T2), страницы без дублирования (T7–T8, вынос Body-компонентов), контент-фоллбэк (T7 Step 3), переключатель+SEO/hreflang (T5), sitemap (авто, конфиг не трогаем), тест полноты (T3/T9). manager исключён (T5 footer-ссылка не локализуется). Phase 2 вынесена.
- **Placeholder scan:** конкретные строки и ключи приведены; «инвентаризация» (T7 S1) — это процедура с явным правилом именования и grep-командой, не TODO. Переводы EN/KK для уже найденных строк даны в T2; для lp.*/compare.* исполнитель производит переводы по указанному правилу (литературный KK, термины не переводить).
- **Type consistency:** `Locale`, `useTranslations`, `localizeUrl`, `getLocalePaths`, `getLocaleFromUrl`, `pickTimeline` — имена согласованы между задачами; компоненты везде принимают `locale: Locale` (дефолт `'ru'` до T7/T8, затем явный проп).
