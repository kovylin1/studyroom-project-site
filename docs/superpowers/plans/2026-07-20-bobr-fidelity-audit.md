# БОБР-аудит достоверности жилья и кампусов — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Проверить 1401 карточку жилья и 2095 карточек кампусов по сайтам самих вузов; подтверждённым проставить провенанс, неподтверждённые вывести кейсами в панель `/manager`, не удаляя из каталога ничего.

**Architecture:** Повторяем контур СОРОКИ: чистые функции в `scraper/lib/` (резолвер офсайта + матчер карточек) → обходчик `bobr-audit.mjs` пишет `site/public/api/bobr-review.json` в формате РЕВИЗОРА → панель `/manager` подхватывает третьим источником → `bobr-apply.mjs` применяет решения оператора.

**Tech Stack:** Node 22 ESM (`.mjs`), `node:test` + `node:assert/strict` для юнит-тестов, Astro для панели, GitHub Actions для apply-workflow.

**Спека:** `docs/superpowers/specs/2026-07-20-accommodation-campuses-fidelity-audit-design.md`

**Ветка:** `feat/bobr-fidelity-audit` (создана от main, спека закоммичена в `baa6211a`)

---

## Структура файлов

| Файл | Ответственность |
|---|---|
| `scraper/lib/official-site.mjs` | НОВЫЙ. Единственное место, где решается «какой у вуза настоящий адрес». Экспортирует `AGG_DOMAINS` и `resolveOfficialSite`. |
| `scraper/lib/official-site.test.mjs` | НОВЫЙ. Юнит-тест резолвера. |
| `scraper/lib/accommodation-match.mjs` | НОВЫЙ. Чистая функция «подтверждает ли HTML эту карточку». |
| `scraper/lib/accommodation-match.test.mjs` | НОВЫЙ. Юнит-тест матчера. |
| `scraper/bobr-audit.mjs` | НОВЫЙ. Обходчик: офсайт → страницы → матчер → провенанс в каталог + кейсы в review. |
| `scraper/bobr-apply.mjs` | НОВЫЙ. Применение решений оператора. |
| `.github/workflows/bobr-apply.yml` | НОВЫЙ. Кнопка применения из панели. |
| `scraper/mark-stock-photos.mjs` | НОВЫЙ, разовый. Проставляет `imgKind: "stock"` карточкам с `/photos/_lib/`. |
| `scraper/soroka.mjs:262-274` | ПРАВКА. `officialRoot` → общий модуль. |
| `scraper/bobr.mjs` | ПРАВКА. Шаг `bobr-verifier` → `bobr-audit`. |
| `scraper/bobr-verifier.mjs` | УДАЛЯЕТСЯ. Работа переезжает в `bobr-audit.mjs`. |
| `site/src/schema/university.ts:96-118` | ПРАВКА. Опциональное `imgKind`. |
| `site/src/pages/manager.astro:1679-1694` | ПРАВКА. Третий источник кейсов «БОБР». |

**Как гонять тесты:** `cd scraper && node --test lib/<name>.test.mjs`
(в проекте `npm test` = `vitest run` для `src/*.test.ts`; `.mjs`-тесты в `lib/` гоняются через `node --test` — так же, как `canonicalize-faculty.test.mjs` из среза 1).

---

## Task 1: Резолвер офсайта

Сейчас логика продублирована: `soroka.mjs:262` (`officialRoot`, рабочая) и `bobr-verifier.mjs:51` (`u.sourceUrl` напрямую — **сломана**, у 237 вузов там `edge.edvoy.com`). Выносим одну общую.

**Files:**
- Create: `scraper/lib/official-site.mjs`
- Test: `scraper/lib/official-site.test.mjs`

- [ ] **Step 1: Написать падающий тест**

`scraper/lib/official-site.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveOfficialSite, AGG_DOMAINS } from './official-site.mjs';

test('officialUrl имеет высший приоритет', () => {
  const u = { officialUrl: 'https://www.aru.ac.uk', sourceUrl: 'https://edge.edvoy.com/x' };
  assert.equal(resolveOfficialSite(u, []), 'https://www.aru.ac.uk');
});

test('website из edvoy-выгрузки — второй приоритет', () => {
  const u = { sourceUrl: 'https://edge.edvoy.com/institution/aru' };
  const extracts = [{ source: 'edvoy', data: { website: 'https://www.aru.ac.uk' } }];
  assert.equal(resolveOfficialSite(u, extracts), 'https://www.aru.ac.uk');
});

test('свой домен в sourceUrl проходит', () => {
  const u = { sourceUrl: 'https://www.hw.ac.uk' };
  assert.equal(resolveOfficialSite(u, []), 'https://www.hw.ac.uk');
});

test('агрегаторный хост в sourceUrl → null (не выдумываем)', () => {
  for (const host of [
    'https://edge.edvoy.com/x',
    'https://www.kaplanpathways.com/x',
    'https://collabinternational.com/x',
    'https://www.oxfordinternational.com/x',
    'https://www.catsglobalschools.com/x',
    'https://www.intostudy.com/x',
  ]) {
    assert.equal(resolveOfficialSite({ sourceUrl: host }, []), null, host);
  }
});

test('мусорный/пустой URL → null', () => {
  assert.equal(resolveOfficialSite({ sourceUrl: 'не-урл' }, []), null);
  assert.equal(resolveOfficialSite({}, []), null);
  assert.equal(resolveOfficialSite({ sourceUrl: '' }, []), null);
});

test('агрегаторный website из edvoy тоже отвергается', () => {
  const u = { sourceUrl: 'https://edge.edvoy.com/x' };
  const extracts = [{ source: 'edvoy', data: { website: 'https://edge.edvoy.com/y' } }];
  assert.equal(resolveOfficialSite(u, extracts), null);
});

test('хвостовой слеш срезается', () => {
  assert.equal(resolveOfficialSite({ officialUrl: 'https://www.aru.ac.uk/' }, []), 'https://www.aru.ac.uk');
});

test('AGG_DOMAINS покрывает домены из каталога', () => {
  assert.ok(AGG_DOMAINS.test('catsglobalschools.com'));
  assert.ok(AGG_DOMAINS.test('oxfordinternational.com'));
  assert.ok(!AGG_DOMAINS.test('aru.ac.uk'));
});
```

- [ ] **Step 2: Запустить тест, убедиться что падает**

Run: `cd scraper && node --test lib/official-site.test.mjs`
Expected: FAIL — `Cannot find module './official-site.mjs'`

- [ ] **Step 3: Реализация**

`scraper/lib/official-site.mjs`:

```javascript
// official-site.mjs — SSOT «какой у вуза настоящий адрес».
// До этого модуля логика была продублирована: soroka.mjs::officialRoot (рабочая)
// и bobr-verifier.mjs (брала u.sourceUrl напрямую — а там у 237 вузов edge.edvoy.com,
// то есть проверка шла по странице агрегатора). Теперь одна общая.

// Домены агрегаторов/партнёрских сетей: их страницы НЕ являются офсайтом вуза.
// catseducation оставлен ради обратной совместимости с прежним списком СОРОКИ;
// catsglobalschools/oxfordinternational/intostudy добавлены по замеру каталога.
export const AGG_DOMAINS =
  /edvoy|studygroup|kaplan|navitas|catseducation|catsglobalschools|oxfordinternational|intostudy|qs\.com|topuniversities|collab|wikipedia/i;

function cleanHttpUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let host;
  try { host = new URL(raw).hostname; } catch { return null; }
  if (AGG_DOMAINS.test(host)) return null;
  return raw.replace(/\/+$/, '');
}

/**
 * @param {object} uni      — распарсенный JSON вуза из site/src/content/universities
 * @param {Array<{source:string,data:object}>} extracts — выгрузки источников (может быть [])
 * @returns {string|null}   — база офсайта без хвостового слеша, либо null (не угадываем)
 */
export function resolveOfficialSite(uni, extracts = []) {
  if (!uni) return null;

  const fromField = cleanHttpUrl(uni.officialUrl);
  if (fromField) return fromField;

  const edvoy = (extracts || []).find(e => e && e.source === 'edvoy');
  const fromEdvoy = cleanHttpUrl(edvoy?.data?.website);
  if (fromEdvoy) return fromEdvoy;

  return cleanHttpUrl(uni.sourceUrl);
}
```

- [ ] **Step 4: Запустить тест, убедиться что проходит**

Run: `cd scraper && node --test lib/official-site.test.mjs`
Expected: PASS, `# pass 8`, `# fail 0`

- [ ] **Step 5: Коммит**

```bash
git add scraper/lib/official-site.mjs scraper/lib/official-site.test.mjs
git commit -m "feat(bobr): общий резолвер офсайта (SSOT для СОРОКИ и БОБРа)"
```

---

## Task 2: СОРОКА переходит на общий резолвер

Убираем дубль, чтобы оба директора искали офсайт одинаково.

**Files:**
- Modify: `scraper/soroka.mjs:49` (константа `AGG_DOMAINS`), `scraper/soroka.mjs:262-274` (функция `officialRoot`)

- [ ] **Step 1: Заменить локальные определения на импорт**

В `scraper/soroka.mjs` удалить строку 49:

```javascript
const AGG_DOMAINS = /edvoy|studygroup|kaplan|navitas|catseducation|qs\.com|topuniversities|collab|wikipedia/i;
```

и добавить к остальным импортам (рядом с `import { scoreProgram, ... } from './lib/confidence.mjs';`):

```javascript
import { AGG_DOMAINS, resolveOfficialSite } from './lib/official-site.mjs';
```

Удалить функцию `officialRoot` целиком (строки 262-274):

```javascript
function officialRoot(u, extracts) {
  const edvoy = extracts.find(e => e.source === 'edvoy');
  const site = edvoy?.data?.website;
  if (site) return site;
  try {
    if (u.sourceUrl && !AGG_DOMAINS.test(new URL(u.sourceUrl).hostname)) return u.sourceUrl;
  } catch { /* ignore */ }
  return null;
}
```

Заменить её единственный вызов в `liveCheckUni` (строка 276):

```javascript
  const root = officialRoot(u, extracts);
```

на:

```javascript
  const root = resolveOfficialSite(u, extracts);
```

**Замечание о поведении:** новый резолвер строже старого — он проверяет `website` из edvoy на агрегаторность (старый возвращал его как есть) и добавляет приоритет `officialUrl` (у 97 вузов). Это ужесточение намеренное: старый мог отдать агрегаторный адрес как «офсайт».

- [ ] **Step 2: Проверить, что СОРОКА запускается и находит офсайты**

Run: `cd "$(git rev-parse --show-toplevel)" && node scraper/soroka.mjs --skip-live --slug=aberdeen`
Expected: exit 0, на stdout JSON со `stats`; в stderr нет `ReferenceError`/`is not defined`

- [ ] **Step 3: Коммит**

```bash
git add scraper/soroka.mjs
git commit -m "refactor(soroka): резолв офсайта через общий lib/official-site"
```

---

## Task 3: Матчер карточек

Нынешняя сверка (`bobr-verifier.mjs:36`) берёт первые 15 символов названия, выкидывает всё кроме `[a-z0-9]` и ищет подстроку. «Homestay через Navitas» → `homestay`, что совпадёт с любой страницей. Плюс цены не проверяются вовсе.

**Files:**
- Create: `scraper/lib/accommodation-match.mjs`
- Test: `scraper/lib/accommodation-match.test.mjs`

- [ ] **Step 1: Написать падающий тест**

`scraper/lib/accommodation-match.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchCard, extractPriceNear, normalizeName } from './accommodation-match.mjs';

const HTML_ARU = `
  <html><body>
    <h1>Accommodation</h1>
    <div class="hall"><h2>Sedley Court</h2><p>En-suite rooms from £168 per week.</p></div>
    <div class="hall"><h2>Swinhoe Court</h2><p>Studios from £215 per week.</p></div>
    <p>Our homestay partners can help you find a host family.</p>
  </body></html>`;

test('точное название найдено + цена совпала → confirmed', () => {
  const r = matchCard({ name: 'Sedley Court', price: 'от £168/нед' }, HTML_ARU);
  assert.equal(r.verdict, 'confirmed');
  assert.equal(r.foundPrice, 168);
});

test('название найдено, цена другая → price-mismatch с найденным значением', () => {
  const r = matchCard({ name: 'Swinhoe Court', price: 'от £165/нед' }, HTML_ARU);
  assert.equal(r.verdict, 'price-mismatch');
  assert.equal(r.foundPrice, 215);
  assert.equal(r.catalogPrice, 165);
});

test('название найдено, цены на странице нет → price-unconfirmed', () => {
  const html = '<h2>Bishop Complex</h2><p>Classic halls of residence.</p>';
  const r = matchCard({ name: 'Bishop Complex', price: 'от £155/нед' }, html);
  assert.equal(r.verdict, 'price-unconfirmed');
  assert.equal(r.foundPrice, null);
});

test('карточка без цены, название найдено → confirmed', () => {
  const r = matchCard({ name: 'Sedley Court' }, HTML_ARU);
  assert.equal(r.verdict, 'confirmed');
});

test('ложная подстрока не проходит: «Homestay через Navitas» ≠ упоминание homestay', () => {
  const r = matchCard({ name: 'Homestay через Navitas', price: 'от £180/нед' }, HTML_ARU);
  assert.equal(r.verdict, 'not-found');
});

test('названия нет на странице → not-found', () => {
  const r = matchCard({ name: 'Mary Seacole Halls' }, HTML_ARU);
  assert.equal(r.verdict, 'not-found');
});

test('пустой HTML → not-found, без исключений', () => {
  assert.equal(matchCard({ name: 'Sedley Court' }, '').verdict, 'not-found');
  assert.equal(matchCard({ name: 'Sedley Court' }, null).verdict, 'not-found');
});

test('карточка без name → not-found (нечего искать)', () => {
  assert.equal(matchCard({}, HTML_ARU).verdict, 'not-found');
});

test('normalizeName схлопывает регистр, пунктуацию и пробелы', () => {
  assert.equal(normalizeName('  Sedley   Court!  '), 'sedley court');
  assert.equal(normalizeName('The Heights (BCU On-Campus)'), 'the heights bcu on campus');
});

test('extractPriceNear берёт первое число в окне, а не любое на странице', () => {
  const html = 'Fees page. <h2>Tindal Hall</h2> from £145 per week. Elsewhere £999 per week.';
  assert.equal(extractPriceNear(html, 'tindal hall'), 145);
});

test('extractPriceNear понимает разные валюты и разделители', () => {
  assert.equal(extractPriceNear('<h2>Acme Hall</h2> from AU$330 per week', 'acme hall'), 330);
  assert.equal(extractPriceNear('<h2>Acme Hall</h2> CA$1,150 per month', 'acme hall'), 1150);
});

test('допуск ±2% считается совпадением (округления сайтов)', () => {
  const html = '<h2>Acme Hall</h2> from £170 per week';
  assert.equal(matchCard({ name: 'Acme Hall', price: 'от £168/нед' }, html).verdict, 'confirmed');
});
```

- [ ] **Step 2: Запустить тест, убедиться что падает**

Run: `cd scraper && node --test lib/accommodation-match.test.mjs`
Expected: FAIL — `Cannot find module './accommodation-match.mjs'`

- [ ] **Step 3: Реализация**

`scraper/lib/accommodation-match.mjs`:

```javascript
// accommodation-match.mjs — «подтверждает ли страница вуза эту карточку?».
// Чистая функция: на вход карточка + HTML, на выход вердикт. Ничего не пишет,
// ничего не выдумывает, найденную на сайте цену только ВОЗВРАЩАЕТ (решение —
// за оператором в панели).

const PRICE_WINDOW = 400;   // символов после названия, где ищем цену
const PRICE_TOLERANCE = 0.02; // ±2% — округления и разные способы подачи

/** Схлопывает регистр, пунктуацию и пробелы: «The Heights (BCU On-Campus)» → «the heights bcu on campus» */
export function normalizeName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** HTML → плоский нормализованный текст (теги и сущности выброшены) */
function htmlToText(html) {
  return normalizeName(
    String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;|&#\d+;/gi, ' ')
  );
}

/** «от £168/нед» → 168; «от CA$1,150/мес» → 1150; мусор → null */
export function parseCatalogPrice(price) {
  if (price == null) return null;
  const m = String(price).replace(/[\s, ]/g, '').match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

/**
 * Ищет первое число-цену в окне после названия. Смотрит ТОЛЬКО в окне —
 * иначе поймает любую цифру со страницы (сборы, годы, телефоны).
 */
export function extractPriceNear(html, normalizedName) {
  const text = htmlToText(html);
  const at = text.indexOf(normalizedName);
  if (at < 0) return null;
  const window = text.slice(at + normalizedName.length, at + normalizedName.length + PRICE_WINDOW);
  // «from 168 per week», «au 330 per week», «ca 1 150 per month» —
  // после htmlToText символы валют и запятые выброшены, остаются числа.
  // Первая альтернатива ловит разряды через пробел (1 150), вторая — обычные числа.
  const m = window.match(/\b(\d{1,3}(?:\s\d{3})+|\d{2,5}(?:\.\d+)?)\b/);
  if (!m) return null;
  return Number(m[1].replace(/\s/g, ''));
}

/**
 * @param {{name?:string, price?:string}} card — карточка accommodation/campus из каталога
 * @param {string} html — HTML страницы офсайта
 * @returns {{verdict:'confirmed'|'price-mismatch'|'price-unconfirmed'|'not-found',
 *            foundPrice:number|null, catalogPrice:number|null}}
 */
export function matchCard(card, html) {
  const nameKey = normalizeName(card && (card.name || card.title));
  const none = { verdict: 'not-found', foundPrice: null, catalogPrice: null };
  if (!nameKey || nameKey.length < 4) return none;

  const text = htmlToText(html);
  if (!text || !text.includes(nameKey)) return none;

  const catalogPrice = parseCatalogPrice(card.price);
  if (catalogPrice == null) {
    return { verdict: 'confirmed', foundPrice: null, catalogPrice: null };
  }

  const foundPrice = extractPriceNear(html, nameKey);
  if (foundPrice == null) {
    return { verdict: 'price-unconfirmed', foundPrice: null, catalogPrice };
  }

  const within = Math.abs(foundPrice - catalogPrice) <= catalogPrice * PRICE_TOLERANCE;
  return {
    verdict: within ? 'confirmed' : 'price-mismatch',
    foundPrice,
    catalogPrice,
  };
}
```

- [ ] **Step 4: Запустить тест, убедиться что проходит**

Run: `cd scraper && node --test lib/accommodation-match.test.mjs`
Expected: PASS, `# pass 12`, `# fail 0`

- [ ] **Step 5: Коммит**

```bash
git add scraper/lib/accommodation-match.mjs scraper/lib/accommodation-match.test.mjs
git commit -m "feat(bobr): матчер карточек жилья/кампусов (имя + цена, вместо подстроки)"
```

---

## Task 4: Обходчик `bobr-audit.mjs`

**Files:**
- Create: `scraper/bobr-audit.mjs`

- [ ] **Step 1: Реализация**

`scraper/bobr-audit.mjs`:

```javascript
#!/usr/bin/env node
// bobr-audit.mjs — БОБР-аудитор достоверности жилья и кампусов.
// Заменяет bobr-verifier.mjs: тот брал за офсайт u.sourceUrl (у 237 вузов там
// edge.edvoy.com) и сверял подстрокой из 15 символов.
//
// Контур скопирован с СОРОКИ: подтверждённое → провенанс в каталог,
// всё спорное → кейсы в site/public/api/bobr-review.json (формат РЕВИЗОРА),
// решения оператора применяет bobr-apply.mjs. Из каталога НИЧЕГО не удаляется,
// содержимое карточек (name/text/price/img) не переписывается.
//
// Usage: node scraper/bobr-audit.mjs [--limit=N] [--slug=<uni>] [--dry-run] [--concurrency=N]

import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveOfficialSite } from './lib/official-site.mjs';
import { matchCard } from './lib/accommodation-match.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const CATALOG_DIR = path.join(PROJECT_ROOT, 'site/src/content/universities');
const SOURCES_DIR = path.join(__dirname, 'sources');
const REVIEW_OUT = path.join(PROJECT_ROOT, 'site/public/api/bobr-review.json');

const arg = (p) => (process.argv.find(a => a.startsWith(p)) || '').slice(p.length);
const LIMIT = parseInt(arg('--limit=') || 'Infinity', 10);
const SLUG_FILTER = arg('--slug=') || null;
const CONCURRENCY = parseInt(arg('--concurrency=') || '4', 10);
const DRY_RUN = process.argv.includes('--dry-run');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';
const NOW = new Date().toISOString();
const TODAY = NOW.slice(0, 10);
const log = (...a) => process.stderr.write(`[БОБР-аудит] ${NOW.slice(11, 19)} ${a.join(' ')}\n`);

const ACCOM_PATHS = ['/accommodation', '/housing', '/halls', '/student-life/accommodation', '/living', '/residences'];
const CAMPUS_PATHS = ['/about/campuses', '/our-campuses', '/campuses', '/locations', '/about/locations', '/campus'];

async function fetchText(url, ms = 9000) {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms);
    const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: ac.signal });
    clearTimeout(t);
    return r.ok ? await r.text() : null;
  } catch { return null; }
}

async function tryPaths(base, paths) {
  for (const p of paths) {
    const html = await fetchText(base + p);
    if (html && html.length > 500) return { html, url: base + p };
  }
  return null;
}

// Выгрузки источников нужны только ради edvoy.website в резолвере офсайта.
const EXTRACT_DIRS = ['edvoy-extracts', 'official-extracts', 'gedu-extracts', 'qahe-extracts', 'kaplan-extracts'];
async function loadExtracts(slug) {
  const out = [];
  for (const dir of EXTRACT_DIRS) {
    const f = path.join(SOURCES_DIR, dir, `${slug}.json`);
    try { out.push({ source: dir.replace('-extracts', ''), data: JSON.parse(await fs.readFile(f, 'utf8')) }); }
    catch { /* нет такого файла — нормально */ }
  }
  return out;
}

const SEVERITY = { 'price-mismatch': 'critical', 'not-found': 'warning', 'price-unconfirmed': 'warning', 'no-official-site': 'warning', 'no-page': 'warning' };

function makeCase({ slug, name, domain, card, verdict, detail, foundPrice, catalogPrice }) {
  return {
    id: `${slug}||bobr_${verdict.replace(/-/g, '_')}||${domain}||${(card && (card.name || card.title) || '').slice(0, 60)}`,
    slug,
    name,
    issue: `bobr_${verdict.replace(/-/g, '_')}`,
    severity: SEVERITY[verdict] || 'warning',
    detail,
    catalog: catalogPrice ?? null,
    official: foundPrice ?? null,
    domain,                       // 'accommodation' | 'campuses'
    card: (card && (card.name || card.title)) || null,
    checkedAt: NOW,
    decision: null,
    decidedAt: null,
    applied: false,
  };
}

async function processUni(slug) {
  const fpath = path.join(CATALOG_DIR, `${slug}.json`);
  const u = JSON.parse(await fs.readFile(fpath, 'utf8'));
  const acc = u.accommodation || [];
  const camp = u.campuses || [];
  if (!acc.length && !camp.length) return { slug, status: 'skip-empty', cases: [] };

  const extracts = await loadExtracts(slug);
  const base = resolveOfficialSite(u, extracts);
  if (!base) {
    return {
      slug, status: 'no-official-site',
      cases: [makeCase({
        slug, name: u.name, domain: 'uni', card: null, verdict: 'no-official-site',
        detail: `Офсайт неизвестен (sourceUrl = ${u.sourceUrl || '—'}), проверить жильё/кампусы не по чему`,
      })],
    };
  }

  const cases = [];
  let confirmed = 0;

  for (const [domain, items, paths] of [['accommodation', acc, ACCOM_PATHS], ['campuses', camp, CAMPUS_PATHS]]) {
    if (!items.length) continue;
    const page = await tryPaths(base, paths);
    if (!page) {
      cases.push(makeCase({
        slug, name: u.name, domain, card: null, verdict: 'no-page',
        detail: `На ${base} не найдена страница ${domain} (пробовали: ${paths.join(', ')})`,
      }));
      continue;
    }
    for (const card of items) {
      // Идемпотентность: уже подтверждённое офсайтом не перепроверяем.
      if (card.verifiedBySite === true) continue;
      const r = matchCard(card, page.html);
      const label = card.name || card.title;
      if (r.verdict === 'confirmed') {
        card.source = page.url;
        card.verifiedBySite = true;
        card.checkedAt = TODAY;
        confirmed++;
      } else {
        const detail = {
          'not-found': `«${label}» не найдено на ${page.url}`,
          'price-unconfirmed': `«${label}» найдено, но цена ${card.price} на странице не подтверждена`,
          'price-mismatch': `«${label}»: в каталоге ${card.price}, на сайте ${r.foundPrice}`,
        }[r.verdict];
        cases.push(makeCase({
          slug, name: u.name, domain, card, verdict: r.verdict, detail,
          foundPrice: r.foundPrice, catalogPrice: r.catalogPrice,
        }));
      }
    }
  }

  if (confirmed > 0 && !DRY_RUN) {
    await fs.writeFile(fpath, JSON.stringify(u, null, 2) + '\n');
  }
  return { slug, status: 'ok', confirmed, cases };
}

// ── main ────────────────────────────────────────────────────────────────────
const files = (await fs.readdir(CATALOG_DIR))
  .filter(f => f.endsWith('.json') && (!SLUG_FILTER || f === `${SLUG_FILTER}.json`));
const queue = isFinite(LIMIT) ? files.slice(0, LIMIT) : files;
log(`обрабатываю ${queue.length} вузов, офсайт-база: ${DRY_RUN ? 'DRY-RUN' : 'запись'}`);

let idx = 0;
const results = [];
async function worker() {
  while (idx < queue.length) {
    const f = queue[idx++];
    try { results.push(await processUni(f.replace('.json', ''))); }
    catch (e) { results.push({ slug: f, status: 'error', err: e.message, cases: [] }); }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

const allCases = results.flatMap(r => r.cases || []);

// Слияние с прошлым review: решения оператора сохраняются, кейсы вне скоупа
// точечного прогона не стираются (тот же приём, что в soroka.mjs).
let existing = { items: [] };
try { if (existsSync(REVIEW_OUT)) existing = JSON.parse(await fs.readFile(REVIEW_OUT, 'utf8')); } catch { /* ignore */ }
const prevById = new Map((existing.items || []).map(it => [it.id, it]));
const pending = allCases.map(c => {
  const prev = prevById.get(c.id);
  return prev && prev.decision !== null
    ? { ...c, decision: prev.decision, decidedAt: prev.decidedAt, applied: prev.applied }
    : c;
});
const scopeSlugs = new Set(queue.map(f => f.replace(/\.json$/, '')));
const kept = (existing.items || []).filter(it => !scopeSlugs.has(it.slug));
const items = [...kept, ...pending];

const stats = {
  unis: results.length,
  confirmed: results.reduce((s, r) => s + (r.confirmed || 0), 0),
  noOfficialSite: results.filter(r => r.status === 'no-official-site').length,
  errors: results.filter(r => r.status === 'error').length,
  cases: items.length,
};

if (!DRY_RUN) {
  await fs.mkdir(path.dirname(REVIEW_OUT), { recursive: true });
  await fs.writeFile(REVIEW_OUT, JSON.stringify({
    generatedAt: NOW,
    scope: SLUG_FILTER || 'all',
    summary: { total: items.length, pending: items.filter(c => c.decision === null).length, autoResolved: 0 },
    items,
  }, null, 2) + '\n');
}

console.log(JSON.stringify(stats));
```

- [ ] **Step 2: Прогнать dry-run на одном вузе с известным офсайтом**

Run: `node scraper/bobr-audit.mjs --dry-run --slug=aberdeen`
Expected: exit 0, на stdout JSON вида `{"unis":1,"confirmed":N,...}`; каталог не изменён (`git status --short site/` пусто)

- [ ] **Step 3: Прогнать dry-run на выборке из 20**

Run: `node scraper/bobr-audit.mjs --dry-run --limit=20`
Expected: exit 0. Глазами проверить в stderr/stdout: `noOfficialSite` заметно меньше 20 (резолвер работает), `errors: 0`.

- [ ] **Step 4: Коммит**

```bash
git add scraper/bobr-audit.mjs
git commit -m "feat(bobr): аудитор достоверности жилья/кампусов по офсайтам"
```

---

## Task 5: Схема — поле `imgKind`

**Files:**
- Modify: `site/src/schema/university.ts:96-118`

- [ ] **Step 1: Добавить опциональное поле в обе схемы**

В `site/src/schema/university.ts` в `accommodationItemSchema` (после `img: z.string().optional(),`) добавить:

```typescript
  imgKind: z.enum(['stock', 'real']).optional(),
```

То же самое в `campusItemSchema` (после его `img: z.string().optional(),`).

- [ ] **Step 2: Проверить типы**

Run: `cd site && npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 3: Коммит**

```bash
git add site/src/schema/university.ts
git commit -m "feat(schema): imgKind у карточек жилья и кампусов"
```

---

## Task 6: Разовая пометка стоковых фото

22 картинки жилья и 59 картинок кампусов лежат в общей библиотеке `/photos/_lib/`: `room-11.jpg` стоит у 40 вузов, `campus-5.jpg` — у 28. Помечаем, чтобы срез 3 (ОРЁЛ) видел, что заменять. Фото остаются на месте.

**Files:**
- Create: `scraper/mark-stock-photos.mjs`

- [ ] **Step 1: Реализация**

`scraper/mark-stock-photos.mjs`:

```javascript
#!/usr/bin/env node
// mark-stock-photos.mjs — разовая пометка стоковых фото.
// Карточки жилья/кампусов, чей img лежит в общей библиотеке /photos/_lib/,
// получают imgKind: 'stock'. Фото НЕ удаляются и не меняются — признак нужен
// срезу 3 (ОРЁЛ), чтобы адресно заменить их на реальные.
// Идемпотентен: повторный прогон не меняет ничего.
//
// Usage: node scraper/mark-stock-photos.mjs [--dry-run]

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_DIR = path.resolve(__dirname, '..', 'site/src/content/universities');
const DRY_RUN = process.argv.includes('--dry-run');
const isStock = (img) => typeof img === 'string' && img.startsWith('/photos/_lib/');

let files = 0, marked = 0;
for (const f of (await fs.readdir(CATALOG_DIR)).filter(x => x.endsWith('.json'))) {
  const p = path.join(CATALOG_DIR, f);
  const u = JSON.parse(await fs.readFile(p, 'utf8'));
  let touched = 0;
  for (const card of [...(u.accommodation || []), ...(u.campuses || [])]) {
    const want = isStock(card.img) ? 'stock' : null;
    if (want && card.imgKind !== want) { card.imgKind = want; touched++; }
  }
  if (touched && !DRY_RUN) await fs.writeFile(p, JSON.stringify(u, null, 2) + '\n');
  if (touched) { files++; marked += touched; }
}
console.log(JSON.stringify({ files, marked, dryRun: DRY_RUN }));
```

- [ ] **Step 2: Dry-run**

Run: `node scraper/mark-stock-photos.mjs --dry-run`
Expected: JSON вида `{"files":N,"marked":M,"dryRun":true}` где M > 0; `git status --short site/` пусто

- [ ] **Step 3: Прогон**

Run: `node scraper/mark-stock-photos.mjs`
Expected: тот же `marked`, каталог изменён

- [ ] **Step 4: Проверить, что в diff только `imgKind`**

Run: `git diff --unified=0 site/src/content/universities | grep '^[+-]' | grep -v '^[+-][+-]' | grep -v imgKind | head`
Expected: пусто (никаких других изменённых строк)

- [ ] **Step 5: Идемпотентность**

Run: `node scraper/mark-stock-photos.mjs && git diff --stat site/src/content/universities`
Expected: `marked` тот же, но новых изменений относительно предыдущего прогона нет

- [ ] **Step 6: Коммит**

```bash
git add scraper/mark-stock-photos.mjs site/src/content/universities
git commit -m "data(catalog): пометка стоковых фото imgKind=stock"
```

---

## Task 7: Панель `/manager` — третий источник кейсов

Формат `items` у БОБРа тот же (схема РЕВИЗОРА), поэтому рендер переиспользуется целиком — достаточно добавить запись в `REVIEW_SRCS`.

**Files:**
- Modify: `site/src/pages/manager.astro:1260-1261` (константы workflow), `site/src/pages/manager.astro:1679-1694` (`REVIEW_SRCS`)

- [ ] **Step 1: Добавить константу workflow**

После строки `const SOROKA_APPLY_WORKFLOW  = 'soroka-apply.yml';` добавить:

```javascript
  const BOBR_APPLY_WORKFLOW    = 'bobr-apply.yml';
```

- [ ] **Step 2: Добавить источник в `REVIEW_SRCS`**

В массив `REVIEW_SRCS` после блока `soroka` добавить:

```javascript
    {
      key: 'bobr', title: 'БОБР',
      api: '/api/bobr-review.json',
      contentPath: 'site/public/api/bobr-review.json',
      workflow: BOBR_APPLY_WORKFLOW,
      lsKey: 'studyroom.bobr.decisions',
    },
```

- [ ] **Step 3: Проверить сборку**

Run: `cd site && npm run build`
Expected: exit 0

- [ ] **Step 4: Коммит**

```bash
git add site/src/pages/manager.astro
git commit -m "feat(manager): вкладка БОБР — кейсы достоверности жилья/кампусов"
```

---

## Task 8: Применение решений оператора

**Files:**
- Create: `scraper/bobr-apply.mjs`, `.github/workflows/bobr-apply.yml`

- [ ] **Step 1: Реализация `bobr-apply.mjs`**

`scraper/bobr-apply.mjs`:

```javascript
#!/usr/bin/env node
// bobr-apply.mjs — применяет решения оператора из bobr-review.json.
// Зеркало soroka-apply.mjs: тот же контракт, те же гарантии каталога.
//
//   decision=update + bobr_price_mismatch → ставит найденную на офсайте цену
//                                            (case.official) в карточку жилья
//   decision=delete + любой price-issue    → снимает поле price у карточки
//                                            (сама карточка ОСТАЁТСЯ — правило
//                                             «из каталога ничего не удалять»)
//   decision=ignore                        → только помечает applied=true
//   bobr_not_found / bobr_no_official_site / bobr_no_page → авто-фикса нет,
//                                            решение лишь помечает applied=true
//
// Usage: node scraper/bobr-apply.mjs [--dry-run]

import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const UNI_DIR = path.join(PROJECT_ROOT, 'site/src/content/universities');
const REVIEW_FILE = path.join(PROJECT_ROOT, 'site/public/api/bobr-review.json');
const DRY_RUN = process.argv.includes('--dry-run');
const log = (...a) => process.stderr.write(`[bobr-apply] ${new Date().toISOString().slice(11, 19)} ${a.join(' ')}\n`);

if (!existsSync(REVIEW_FILE)) { log('ERROR: bobr-review.json not found'); process.exit(1); }

const review = JSON.parse(await fs.readFile(REVIEW_FILE, 'utf8'));
const todo = (review.items || []).filter(it => it.decision && !it.applied);
log(`решений к применению: ${todo.length}`);

const stats = { priceUpdated: 0, priceCleared: 0, ignored: 0, noop: 0, missed: 0 };

function findCard(uni, item) {
  const list = item.domain === 'campuses' ? (uni.campuses || []) : (uni.accommodation || []);
  return list.find(c => (c.name || c.title) === item.card) || null;
}

for (const item of todo) {
  const p = path.join(UNI_DIR, `${item.slug}.json`);
  if (!existsSync(p)) { stats.missed++; continue; }
  const uni = JSON.parse(await fs.readFile(p, 'utf8'));
  const card = findCard(uni, item);
  let changed = false;

  if (item.decision === 'ignore') {
    stats.ignored++;
  } else if (!card) {
    stats.missed++;
  } else if (item.decision === 'update' && item.issue === 'bobr_price_mismatch' && item.official != null) {
    // Валюту/формат берём из существующей строки, меняем только число.
    card.price = String(card.price || '').replace(/\d[\d\s,.]*/, String(item.official));
    card.verifiedBySite = true;
    card.checkedAt = new Date().toISOString().slice(0, 10);
    stats.priceUpdated++; changed = true;
  } else if (item.decision === 'delete' && item.issue.startsWith('bobr_price')) {
    delete card.price;
    stats.priceCleared++; changed = true;
  } else {
    stats.noop++;
  }

  if (changed && !DRY_RUN) await fs.writeFile(p, JSON.stringify(uni, null, 2) + '\n');
  item.applied = true;
}

if (!DRY_RUN) await fs.writeFile(REVIEW_FILE, JSON.stringify(review, null, 2) + '\n');
console.log(JSON.stringify({ ...stats, total: todo.length, dryRun: DRY_RUN }));
```

- [ ] **Step 2: Проверить на пустом наборе решений**

Run: `node scraper/bobr-apply.mjs --dry-run`
Expected: exit 0, JSON вида `{"priceUpdated":0,...,"total":0,"dryRun":true}` (решений оператор ещё не принимал)

- [ ] **Step 3: Workflow-кнопка**

`.github/workflows/bobr-apply.yml` — копия `soroka-apply.yml` с заменой скрипта. Взять содержимое:

```bash
sed 's/soroka-apply/bobr-apply/g; s/СОРОКА/БОБР/g; s/soroka/bobr/g' .github/workflows/soroka-apply.yml > .github/workflows/bobr-apply.yml
```

Затем открыть файл и убедиться, что: `name:` осмысленный, шаг запускает `node scraper/bobr-apply.mjs`, коммитятся `site/public/api/bobr-review.json` и `site/src/content/universities`.

- [ ] **Step 4: Коммит**

```bash
git add scraper/bobr-apply.mjs .github/workflows/bobr-apply.yml
git commit -m "feat(bobr): применение решений оператора + workflow-кнопка"
```

---

## Task 9: `bobr.mjs` переключается на аудитор, `bobr-verifier.mjs` удаляется

**Files:**
- Modify: `scraper/bobr.mjs`
- Delete: `scraper/bobr-verifier.mjs`

- [ ] **Step 1: Найти вызов верификатора**

Run: `grep -n "verifier" scraper/bobr.mjs .github/workflows/bobr-on-demand.yml`
Expected: видны шаг `run('bobr-verifier.mjs')`, флаг `SKIP_VERIFIER` и `--skip-verifier` в workflow

- [ ] **Step 2: Заменить шаг**

В `scraper/bobr.mjs`: заменить `bobr-verifier.mjs` на `bobr-audit.mjs` в вызове `run(...)`; переименовать `SKIP_VERIFIER` → `SKIP_AUDIT` и флаг `--skip-verifier` → `--skip-audit` (сохранив `--skip-verifier` как принимаемый алиас, чтобы существующий workflow не сломался).

В `.github/workflows/bobr-on-demand.yml` убрать `--skip-verifier` из строки запуска: аудит должен идти по умолчанию — именно его отключение и было причиной нулевого `verifiedBySite`.

- [ ] **Step 3: Удалить верификатор**

```bash
git rm scraper/bobr-verifier.mjs
```

- [ ] **Step 4: Проверить, что БОБР запускается**

Run: `node scraper/bobr.mjs --dry-run --limit=3 --skip-photos`
Expected: exit 0, в stderr видна строка `→ bobr-audit.mjs`

- [ ] **Step 5: Коммит**

```bash
git add scraper/bobr.mjs .github/workflows/bobr-on-demand.yml
git commit -m "refactor(bobr): аудит вместо выключенного верификатора"
```

---

## Task 10: Полный прогон и проверка

- [ ] **Step 1: Полный аудит**

Run: `node scraper/bobr-audit.mjs --concurrency=6 2>&1 | tail -5`
Expected: exit 0, JSON со `stats`. Ожидаемые порядки: `unis` ≈ 807, `confirmed` > 0, `cases` — сотни.

- [ ] **Step 2: Проверить, что каталог тронут ТОЛЬКО в провенансе**

Run:
```bash
git diff --unified=0 site/src/content/universities | grep '^[+-]' | grep -v '^[+-][+-]' \
  | grep -vE '"(source|verifiedBySite|checkedAt|imgKind)"' | head -20
```
Expected: пусто. Любая строка с `"name"`, `"text"`, `"price"`, `"img"` здесь — **баг**, аудит не должен переписывать содержимое.

- [ ] **Step 3: Проверить 18 вузов с захардкоженными ценами**

Run:
```bash
node -e "const r=require('./site/public/api/bobr-review.json');
const s=['abertay','anglia-ruskin','birmingham-city','brunel','de-montfort','dundee','greenwich','hertfordshire','keele','kent','manchester-met','plymouth','portsmouth','robert-gordon','rvc','swansea','ulster','bradford'];
const hit=new Set(r.items.filter(i=>s.includes(i.slug)).map(i=>i.slug));
console.log('покрыто кейсами:',hit.size,'из',s.length,'|',[...hit].join(' '))"
```
Expected: покрыто большинство — это и есть вузы с непроверяемыми ценами

- [ ] **Step 4: Сборка сайта**

Run: `cd site && npm run build`
Expected: exit 0, все страницы собраны

- [ ] **Step 5: Идемпотентность**

Run: `node scraper/bobr-audit.mjs --slug=aberdeen && git diff --stat site/src/content/universities/aberdeen.json`
Expected: пусто — уже подтверждённые карточки (`verifiedBySite === true`) пропускаются

- [ ] **Step 6: Юнит-тесты целиком**

Run: `cd scraper && node --test lib/*.test.mjs`
Expected: `# fail 0`

- [ ] **Step 7: Коммит данных**

```bash
git add site/src/content/universities site/public/api/bobr-review.json
git commit -m "data(catalog): БОБР-аудит — провенанс подтверждённых карточек + кейсы в панель"
```

- [ ] **Step 8: Пуш и PR**

```bash
git push -u origin feat/bobr-fidelity-audit
gh pr create --title "Срез 2: достоверность жилья и кампусов (БОБР-аудит)" --body "См. docs/superpowers/specs/2026-07-20-accommodation-campuses-fidelity-audit-design.md"
```

**Мёрдж в main делает владелец** — авто-merge блокируется классификатором.

---

## Что НЕ входит

- Заполнение пустых вузов (377 без жилья, 139 без кампусов) — следующий шаг, отдельной спекой.
- Перенос домена в `merge-programs.mjs` и БОБР в месячный CI — шаг после покрытия.
- Замена стоковых фото на реальные — срез 3 (ОРЁЛ); здесь только пометка `imgKind`.
- Массовая чистка скрейп-мусора в текстах кампусов — через панель, операторскими решениями.
