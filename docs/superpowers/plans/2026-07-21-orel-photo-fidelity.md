# ОРЁЛ — достоверность фото и галереи (срез 3): план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Честно пометить происхождение каждого фото в каталоге и заменить чужие/стоковые картинки настоящими фото вузов там, где их удаётся подтвердить офсайтом или Wikimedia.

**Architecture:** Реестр фото с двумя отпечатками (sha1 + перцептивный dHash) — SSOT провенанса. Поверх него четыре скрипта с одной задачей каждый: `orel-audit` помечает и ничего не удаляет, `orel-hunt` ищет замены и пишет только в файл кандидатов, `orel-apply` применяет 1:1 при жёстких условиях, `orel-preview` собирает HTML для просмотра глазами. Контур скопирован с `bobr-audit`/`bobr-apply` среза 2.

**Tech Stack:** Node 22+ ESM (`.mjs`), `sharp` 0.34 (размеры и dHash), `node:test` + `node:assert/strict` (юнит-тесты, запуск `node --test`), Zod 3 (схема), Astro 5 (сайт).

**Спека:** `docs/superpowers/specs/2026-07-21-photo-gallery-fidelity-design.md`

**Ветка:** `feat/orel-photo-fidelity` (создана от `origin/main`, спека уже закоммичена в `a37efb77`).

---

## Структура файлов

| Файл | Ответственность |
|---|---|
| `scraper/lib/photo-fingerprint.mjs` | чистые функции: sha1, dHash, размеры, расстояние Хэмминга |
| `scraper/lib/photo-classify.mjs` | чистая функция: по данным реестра → `imgKind` |
| `scraper/orel-audit.mjs` | обход каталога и диска → реестр + пометки + отчёт о дырах |
| `scraper/orel-hunt.mjs` | поиск кандидатов (офсайт → Wikimedia), пишет только в кандидаты |
| `scraper/orel-apply.mjs` | применение кандидатов 1:1 + кейсы в `/manager` |
| `scraper/orel-preview.mjs` | HTML-страница «было → стало» для визуальной выборки |
| `scraper/prune-orphan-photos.mjs` | удаление файлов, на которые нет ссылок |
| `site/src/schema/university.ts` | расширение схемы полями `img*` |
| `site/src/pages/[slug].astro`, `site/src/pages/[lang]/[slug].astro` | подписи лицензии и «иллюстративное фото» |

Разделение намеренное: два чистых модуля в `lib/` тестируются изолированно, скрипты-обходчики сети не тестируются юнитами, а проверяются прогоном и глазами.

---

### Task 1: Отпечатки изображений

**Files:**
- Create: `scraper/lib/photo-fingerprint.mjs`
- Test: `scraper/lib/photo-fingerprint.test.mjs`

- [ ] **Step 1: Написать падающий тест**

```javascript
// scraper/lib/photo-fingerprint.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { fingerprint, hamming } from './photo-fingerprint.mjs';

// Детерминированные картинки без обращения к диску проекта.
const solid = (r, g, b, w = 400, h = 300) =>
  sharp({ create: { width: w, height: h, channels: 3, background: { r, g, b } } }).jpeg().toBuffer();

const gradient = async (w = 400, h = 300) => {
  const px = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 3;
    px[i] = (x * 255 / w) | 0; px[i + 1] = (y * 255 / h) | 0; px[i + 2] = 128;
  }
  return sharp(px, { raw: { width: w, height: h, channels: 3 } }).jpeg().toBuffer();
};

test('одинаковые байты дают одинаковый sha1', async () => {
  const buf = await solid(10, 20, 30);
  const a = await fingerprint(buf);
  const b = await fingerprint(buf);
  assert.equal(a.sha1, b.sha1);
  assert.equal(a.width, 400);
  assert.equal(a.height, 300);
});

test('ресайз меняет sha1, но dhash остаётся близким', async () => {
  const big = await gradient(400, 300);
  const small = await sharp(big).resize(200, 150).jpeg().toBuffer();
  const a = await fingerprint(big);
  const b = await fingerprint(small);
  assert.notEqual(a.sha1, b.sha1, 'ресайз обязан менять побайтовый хэш');
  assert.ok(hamming(a.dhash, b.dhash) <= 6, `ожидалось близкое dhash, получено ${hamming(a.dhash, b.dhash)}`);
});

test('разные изображения дают далёкие dhash', async () => {
  const a = await fingerprint(await gradient(400, 300));
  const b = await fingerprint(await solid(255, 0, 0));
  assert.ok(hamming(a.dhash, b.dhash) > 10, `ожидалось далёкое dhash, получено ${hamming(a.dhash, b.dhash)}`);
});

test('hamming считает расстояние по битам', () => {
  assert.equal(hamming('00', '00'), 0);
  assert.equal(hamming('00', '01'), 1);
  assert.equal(hamming('00', 'ff'), 8);
  assert.equal(hamming('0000000000000000', 'ffffffffffffffff'), 64);
});

test('битый буфер не роняет процесс', async () => {
  const r = await fingerprint(Buffer.from('это не картинка'));
  assert.equal(r.dhash, null);
  assert.equal(r.width, null);
  assert.ok(r.sha1, 'sha1 считается всегда — он не зависит от декодирования');
});
```

- [ ] **Step 2: Запустить тест и убедиться, что он падает**

Run: `cd scraper && node --test lib/photo-fingerprint.test.mjs`
Expected: FAIL — `Cannot find module './photo-fingerprint.mjs'`

- [ ] **Step 3: Реализовать модуль**

```javascript
// scraper/lib/photo-fingerprint.mjs
// Отпечатки изображений для ОРЛА. Два независимых отпечатка:
//   sha1  — побайтовый: ловит точные копии файла;
//   dhash — перцептивный: ловит то же изображение в другом размере/пережатии.
// Только sha1 недостаточно — часть дублей в каталоге замаскирована ресайзом.

import crypto from 'node:crypto';
import sharp from 'sharp';

const HASH_W = 9, HASH_H = 8; // 9x8 серых пикселей → 8x8 = 64 бита сравнений соседей

/** dHash: сравниваем каждый пиксель с соседом справа; ярче → 1. */
async function dhashOf(buf) {
  const px = await sharp(buf)
    .greyscale()
    .resize(HASH_W, HASH_H, { fit: 'fill' })
    .raw()
    .toBuffer();
  let bits = '';
  for (let y = 0; y < HASH_H; y++)
    for (let x = 0; x < HASH_W - 1; x++)
      bits += px[y * HASH_W + x] > px[y * HASH_W + x + 1] ? '1' : '0';
  // 64 бита → 16 hex-символов
  let hex = '';
  for (let i = 0; i < bits.length; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

/**
 * @param {Buffer} buf содержимое файла
 * @returns {Promise<{sha1:string, dhash:string|null, width:number|null, height:number|null, bytes:number}>}
 *          При нечитаемом изображении dhash/width/height = null, sha1 всё равно считается.
 */
export async function fingerprint(buf) {
  const sha1 = crypto.createHash('sha1').update(buf).digest('hex');
  try {
    const meta = await sharp(buf).metadata();
    return { sha1, dhash: await dhashOf(buf), width: meta.width ?? null, height: meta.height ?? null, bytes: buf.length };
  } catch {
    return { sha1, dhash: null, width: null, height: null, bytes: buf.length };
  }
}

/** Расстояние Хэмминга между двумя hex-отпечатками. Несравнимое → Infinity. */
export function hamming(a, b) {
  if (!a || !b || a.length !== b.length) return Infinity;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) { d += x & 1; x >>= 1; }
  }
  return d;
}
```

- [ ] **Step 4: Запустить тест и убедиться, что он проходит**

Run: `cd scraper && node --test lib/photo-fingerprint.test.mjs`
Expected: PASS, 5 тестов

- [ ] **Step 5: Коммит**

```bash
git add scraper/lib/photo-fingerprint.mjs scraper/lib/photo-fingerprint.test.mjs
git commit -m "feat(orel): отпечатки изображений — sha1 + перцептивный dHash"
```

---

### Task 2: Классификатор `imgKind`

**Files:**
- Create: `scraper/lib/photo-classify.mjs`
- Test: `scraper/lib/photo-classify.test.mjs`

Классификатор — чистая функция: получает уже посчитанные факты о фото и возвращает метку. Сеть и диск в него не попадают, поэтому он тестируется полностью.

- [ ] **Step 1: Написать падающий тест**

```javascript
// scraper/lib/photo-classify.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyPhoto, STOCK_MIN_UNIS } from './photo-classify.mjs';

test('провенанс с офсайта делает фото verified', () => {
  assert.equal(classifyPhoto({
    path: '/photos/glasgow/hunt-1.jpg', slug: 'glasgow', unisUsing: 1,
    provenance: { source: 'https://gla.ac.uk/about', license: 'official-site' },
  }), 'verified');
});

test('провенанс Wikimedia тоже verified', () => {
  assert.equal(classifyPhoto({
    path: '/photos/glasgow/hunt-2.jpg', slug: 'glasgow', unisUsing: 1,
    provenance: { source: 'https://commons.wikimedia.org/wiki/File:X.jpg', license: 'CC BY-SA 4.0', author: 'Ivan' },
  }), 'verified');
});

test('файл из общей библиотеки — stock, даже если вуз один', () => {
  assert.equal(classifyPhoto({
    path: '/photos/_lib/room-11.jpg', slug: 'glasgow', unisUsing: 1, provenance: null,
  }), 'stock');
});

test('картинка у многих вузов — stock', () => {
  assert.equal(classifyPhoto({
    path: '/photos/ac-badem-university/bobr-4.jpg', slug: 'glasgow',
    unisUsing: STOCK_MIN_UNIS, provenance: null,
  }), 'stock');
});

test('картинка у нескольких вузов, но ниже порога — shared', () => {
  assert.equal(classifyPhoto({
    path: '/photos/glasgow/1.jpg', slug: 'glasgow',
    unisUsing: STOCK_MIN_UNIS - 1, provenance: null,
  }), 'shared');
});

test('своё фото без провенанса — unknown, а не verified', () => {
  assert.equal(classifyPhoto({
    path: '/photos/glasgow/1.jpg', slug: 'glasgow', unisUsing: 1, provenance: null,
  }), 'unknown');
});

test('провенанс перевешивает шаринг: подтверждённое фото остаётся verified', () => {
  assert.equal(classifyPhoto({
    path: '/photos/glasgow/1.jpg', slug: 'glasgow', unisUsing: 9,
    provenance: { source: 'https://gla.ac.uk/campus', license: 'official-site' },
  }), 'verified');
});

test('внешняя ссылка без провенанса — unknown', () => {
  assert.equal(classifyPhoto({
    path: 'https://upload.wikimedia.org/x.jpg', slug: 'glasgow', unisUsing: 1, provenance: null,
  }), 'unknown');
});
```

- [ ] **Step 2: Запустить тест и убедиться, что он падает**

Run: `cd scraper && node --test lib/photo-classify.test.mjs`
Expected: FAIL — `Cannot find module './photo-classify.mjs'`

- [ ] **Step 3: Реализовать модуль**

```javascript
// scraper/lib/photo-classify.mjs
// Классификатор происхождения фото. Чистая функция: никакой сети и диска.
//
// Порядок правил важен: провенанс сильнее шаринга. Фото, подтверждённое
// офсайтом, остаётся verified, даже если та же картинка стоит у других вузов
// (например, общий снимок городского кампуса).

/** Начиная со скольких вузов общая картинка считается стоком. Порог проверяется на пилоте. */
export const STOCK_MIN_UNIS = 5;

const LIB_PREFIX = '/photos/_lib/';

/**
 * @param {{path:string, slug:string, unisUsing:number, provenance:{source?:string,license?:string,author?:string}|null}} f
 * @returns {'verified'|'stock'|'shared'|'unknown'}
 */
export function classifyPhoto(f) {
  if (f.provenance && f.provenance.source && f.provenance.license) return 'verified';
  if (typeof f.path === 'string' && f.path.startsWith(LIB_PREFIX)) return 'stock';
  if (f.unisUsing >= STOCK_MIN_UNIS) return 'stock';
  if (f.unisUsing > 1) return 'shared';
  return 'unknown';
}
```

- [ ] **Step 4: Запустить тест и убедиться, что он проходит**

Run: `cd scraper && node --test lib/photo-classify.test.mjs`
Expected: PASS, 8 тестов

- [ ] **Step 5: Коммит**

```bash
git add scraper/lib/photo-classify.mjs scraper/lib/photo-classify.test.mjs
git commit -m "feat(orel): классификатор imgKind — verified/stock/shared/unknown"
```

---

### Task 3: Схема каталога — поля провенанса

**Files:**
- Modify: `site/src/schema/university.ts:77-120`

Сейчас `galleryItemSchema` знает только `img` и `caption`, а `imgKind` — это `z.enum(['stock','real'])` у жилья и кампусов. В каталоге реально встречается единственное значение `stock` (2309 раз), `real` не используется ни разу, но оставляем его ради совместимости со старыми записями.

- [ ] **Step 1: Добавить общий фрагмент полей провенанса**

Вставить перед `galleryItemSchema` (строка 77):

```typescript
/** Происхождение фото. Общий фрагмент для галереи, кампусов и жилья (ОРЁЛ, срез 3). */
export const photoProvenanceFields = {
  /** verified — подтверждено офсайтом или Wikimedia; shared — картинка есть у других вузов;
   *  stock — общая стоковая библиотека; unknown — происхождение неизвестно.
   *  'real' — легаси-значение до среза 3, оставлено ради совместимости. */
  imgKind: z.enum(['verified', 'stock', 'shared', 'unknown', 'real']).optional(),
  imgSource: z.string().url().optional(),
  imgLicense: z.string().optional(),
  imgAuthor: z.string().optional(),
  imgCheckedAt: z.string().optional(),
};
```

- [ ] **Step 2: Подмешать фрагмент в три схемы**

`galleryItemSchema` (было `z.object({ img, caption })`):

```typescript
export const galleryItemSchema = z.object({
  img: z.string().min(1),
  caption: z.string().optional(),
  ...photoProvenanceFields,
});
```

В `accommodationItemSchema` и `campusItemSchema` — заменить существующую строку `imgKind: z.enum(['stock', 'real']).optional(),` на `...photoProvenanceFields,` (поле `img` там уже есть и остаётся).

- [ ] **Step 3: Проверить, что схема компилируется и каталог валиден**

Run: `cd site && npx tsc --noEmit && node ../scraper/validate-catalog.mjs`
Expected: `tsc` без ошибок; валидатор — 807 валидных, 0 ошибок

- [ ] **Step 4: Коммит**

```bash
git add site/src/schema/university.ts
git commit -m "feat(orel): поля провенанса фото в Zod-схеме"
```

---

### Task 4: `orel-audit` — реестр и пометки

**Files:**
- Create: `scraper/orel-audit.mjs`
- Создаёт при прогоне: `scraper/sources/photo-registry.json`, `scraper/sources/audit/orel-audit.json`

Скрипт ничего не качает, не удаляет и не заменяет: только считает отпечатки, строит реестр и проставляет `imgKind`. Флаг `--dry-run` обязан не оставлять следов в рабочем дереве — это прямое требование из `BACKLOG.md`, где записан баг `bobr.mjs --dry-run`.

- [ ] **Step 1: Написать скрипт**

```javascript
#!/usr/bin/env node
// orel-audit.mjs — ОРЁЛ-аудитор достоверности фото.
//
// Читает каталог и диск, считает отпечатки, строит SSOT-реестр провенанса
// и проставляет imgKind в трёх доменах: gallery.items[], accommodation[], campuses[].
// НИЧЕГО не удаляет, не качает и не заменяет — только помечает.
//
// Заменяет orel-photo-quality.mjs, который ловил сток по чёрному списку имён
// (shutterstock, happy-students) и потому не видел наш сток с именами bobr-N.jpg,
// зато умел удалять карточки из каталога.
//
// Usage: node scraper/orel-audit.mjs [--limit=N] [--slug=<uni>] [--dry-run]

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { fingerprint } from './lib/photo-fingerprint.mjs';
import { classifyPhoto } from './lib/photo-classify.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const CATALOG_DIR = path.join(PROJECT_ROOT, 'site/src/content/universities');
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'site/public');
const REGISTRY_OUT = path.join(__dirname, 'sources/photo-registry.json');
const AUDIT_OUT = path.join(__dirname, 'sources/audit/orel-audit.json');

const arg = (p) => (process.argv.find(a => a.startsWith(p)) || '').slice(p.length);
const LIMIT = parseInt(arg('--limit=') || 'Infinity', 10);
const SLUG_FILTER = arg('--slug=') || null;
const DRY_RUN = process.argv.includes('--dry-run');

const NOW = new Date().toISOString();
const log = (...a) => process.stderr.write(`[ОРЁЛ-аудит] ${NOW.slice(11, 19)} ${a.join(' ')}\n`);

const DOMAINS = [
  { key: 'gallery', get: (u) => u.gallery?.items || [] },
  { key: 'accommodation', get: (u) => u.accommodation || [] },
  { key: 'campuses', get: (u) => u.campuses || [] },
];

async function main() {
  let files = (await fs.readdir(CATALOG_DIR)).filter(f => f.endsWith('.json')).sort();
  if (SLUG_FILTER) files = files.filter(f => f === `${SLUG_FILTER}.json`);
  if (Number.isFinite(LIMIT)) files = files.slice(0, LIMIT);
  log(`вузов к обходу: ${files.length}${DRY_RUN ? ' (сухой прогон)' : ''}`);

  // Проход 1 — собрать все ссылки и отпечатки.
  const unis = new Map();          // slug -> { file, json }
  const refs = [];                 // { slug, domain, index, img }
  for (const f of files) {
    const json = JSON.parse(await fs.readFile(path.join(CATALOG_DIR, f), 'utf8'));
    const slug = json.slug || f.replace(/\.json$/, '');
    unis.set(slug, { file: f, json });
    for (const d of DOMAINS) d.get(json).forEach((item, index) => {
      if (item?.img) refs.push({ slug, domain: d.key, index, img: item.img });
    });
  }
  log(`ссылок на фото: ${refs.length}`);

  // Отпечаток каждого локального файла считаем один раз.
  const fpCache = new Map();
  for (const r of refs) {
    if (!r.img.startsWith('/') || fpCache.has(r.img)) continue;
    try {
      fpCache.set(r.img, await fingerprint(await fs.readFile(path.join(PUBLIC_DIR, r.img))));
    } catch {
      fpCache.set(r.img, null);    // файла нет на диске
    }
  }
  log(`уникальных файлов отпечатано: ${fpCache.size}`);

  // Сколько РАЗНЫХ вузов использует каждое изображение (по содержимому, не по пути).
  const unisByHash = new Map();
  for (const r of refs) {
    const fp = fpCache.get(r.img);
    const key = fp?.sha1 || r.img;   // внешние ссылки группируются по URL
    if (!unisByHash.has(key)) unisByHash.set(key, new Set());
    unisByHash.get(key).add(r.slug);
  }

  // Проход 2 — проставить метки, сохранив уже имеющийся провенанс.
  const tally = { verified: 0, stock: 0, shared: 0, unknown: 0 };
  const touched = new Set();
  for (const r of refs) {
    const { json } = unis.get(r.slug);
    const item = DOMAINS.find(d => d.key === r.domain).get(json)[r.index];
    const fp = fpCache.get(r.img);
    const provenance = item.imgSource && item.imgLicense
      ? { source: item.imgSource, license: item.imgLicense, author: item.imgAuthor }
      : null;
    const kind = classifyPhoto({
      path: r.img, slug: r.slug,
      unisUsing: unisByHash.get(fp?.sha1 || r.img).size,
      provenance,
    });
    tally[kind]++;
    if (item.imgKind !== kind) { item.imgKind = kind; touched.add(r.slug); }
  }

  // Реестр: одна запись на уникальное изображение.
  const registry = [];
  for (const [img, fp] of fpCache) {
    const users = refs.filter(r => r.img === img);
    registry.push({
      path: img,
      sha1: fp?.sha1 ?? null, dhash: fp?.dhash ?? null,
      width: fp?.width ?? null, height: fp?.height ?? null, bytes: fp?.bytes ?? null,
      onDisk: fp !== null,
      usedBy: users.map(u => ({ slug: u.slug, domain: u.domain })),
    });
  }

  // Дыры: вузы, отсортированные по количеству подтверждённых фото.
  const gaps = [...unis.keys()].map(slug => {
    const mine = refs.filter(r => r.slug === slug);
    const verified = mine.filter(r => {
      const item = DOMAINS.find(d => d.key === r.domain).get(unis.get(slug).json)[r.index];
      return item.imgKind === 'verified';
    }).length;
    return { slug, photos: mine.length, verified };
  }).sort((a, b) => a.verified - b.verified || b.photos - a.photos);

  const report = {
    generatedAt: NOW, dryRun: DRY_RUN,
    unis: unis.size, refs: refs.length,
    uniqueImages: new Set([...fpCache.values()].map(f => f?.sha1).filter(Boolean)).size,
    tally, gaps,
  };

  if (DRY_RUN) {
    log(`СУХОЙ ПРОГОН — на диск не пишем. ${JSON.stringify(tally)}`);
    log(`изменилось бы вузов: ${touched.size}`);
    return;
  }

  for (const slug of touched) {
    const { file, json } = unis.get(slug);
    await fs.writeFile(path.join(CATALOG_DIR, file), JSON.stringify(json, null, 2) + '\n');
  }
  await fs.mkdir(path.dirname(AUDIT_OUT), { recursive: true });
  await fs.writeFile(REGISTRY_OUT, JSON.stringify(registry, null, 1) + '\n');
  await fs.writeFile(AUDIT_OUT, JSON.stringify(report, null, 1) + '\n');
  log(`готово. вузов изменено: ${touched.size}. ${JSON.stringify(tally)}`);
}

main().catch(e => { log('ФАТАЛЬНО:', e.message); process.exit(1); });
```

- [ ] **Step 2: Проверить, что сухой прогон действительно сухой**

```bash
cd "$(git rev-parse --show-toplevel)"
git status --porcelain > /tmp/orel-before.txt
node scraper/orel-audit.mjs --dry-run --limit=20
git status --porcelain > /tmp/orel-after.txt
diff /tmp/orel-before.txt /tmp/orel-after.txt && echo "СУХОЙ ПРОГОН ЧИСТ"
```

Expected: `СУХОЙ ПРОГОН ЧИСТ`. Если появились файлы — это тот же баг, что у `bobr.mjs`; чинить до продолжения.

- [ ] **Step 3: Прогнать на 20 вузах и проверить пометки глазами**

Run: `node scraper/orel-audit.mjs --limit=20 && git diff --stat`
Expected: изменения только в полях `imgKind`. Проверить вручную `git diff` на одном вузе: ни одно фото не удалено, `img` не изменён.

- [ ] **Step 4: Полный прогон**

Run: `node scraper/orel-audit.mjs`
Expected: `refs: 7074`, 100% фото получили метку; `tally.unknown + shared + stock + verified === 7074`; `verified` близко к нулю — провенанса пока ни у кого нет, это ожидаемо.

- [ ] **Step 5: Проверить, что каталог цел**

Run: `node scraper/validate-catalog.mjs && cd site && npm run build`
Expected: 807/0; build exit 0, 2428 страниц

- [ ] **Step 6: Проверить идемпотентность**

Run: `node scraper/orel-audit.mjs && git status --porcelain site/src/content | head`
Expected: пусто — повторный прогон ничего не меняет

- [ ] **Step 7: Коммит (код и данные — раздельно)**

```bash
git add scraper/orel-audit.mjs && git rm scraper/orel-photo-quality.mjs
git commit -m "feat(orel): аудитор фото — реестр, отпечатки, пометки imgKind"
git add site/src/content/universities scraper/sources/photo-registry.json scraper/sources/audit/orel-audit.json
git commit -m "data(catalog): ОРЁЛ-аудит — imgKind у всех 7074 фото"
```

---

### Task 5: `orel-hunt` — поиск замен, пилот на 30 вузах

**Files:**
- Create: `scraper/orel-hunt.mjs`
- Создаёт при прогоне: `sources/photo-candidates.json`, файлы `site/public/photos/<slug>/hunt-N.jpg`

Скрипт **физически не пишет в каталог** — это то, что спасло срез 2. Он умеет только скачивать кандидатов и вести их список.

- [ ] **Step 1: Написать скрипт**

Ключевые части (полный файл собирается из них):

```javascript
#!/usr/bin/env node
// orel-hunt.mjs — МОТЫЛЁК: поиск настоящих фото вузов.
// Источники по приоритету: офсайт вуза → Wikimedia через Wikidata.
// В КАТАЛОГ НЕ ПИШЕТ. Кандидаты → sources/photo-candidates.json,
// файлы → site/public/photos/<slug>/hunt-N.jpg.
//
// Usage: node scraper/orel-hunt.mjs [--limit=N] [--slug=<uni>] [--worklist=<file>] [--dry-run]

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';
import { resolveOfficialSite } from './lib/official-site.mjs';
import { fingerprint, hamming } from './lib/photo-fingerprint.mjs';

const MIN_SIDE = 800;                       // короткая сторона, px
const MAX_PER_UNI = 6;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';
const SITE_PATHS = ['', '/about', '/about-us', '/campus', '/campuses', '/student-life', '/life', '/gallery'];

// Отсекаем не-фотографии по имени файла.
const JUNK_NAME = /(logo|icon|favicon|sprite|crest|seal|coat[-_]of[-_]arms|map|banner|badge|placeholder|avatar|button|arrow)/i;

/** Кандидат годен, если это фотография, а не графика или портрет. */
function acceptable(fp, url) {
  if (JUNK_NAME.test(url)) return { ok: false, why: 'имя намекает на графику' };
  if (!fp.width || !fp.height) return { ok: false, why: 'не декодируется' };
  if (Math.min(fp.width, fp.height) < MIN_SIDE) return { ok: false, why: `мелкое ${fp.width}x${fp.height}` };
  const ratio = fp.width / fp.height;
  if (ratio < 0.5 || ratio > 3.5) return { ok: false, why: `пропорции ${ratio.toFixed(2)}` };
  return { ok: true };
}
```

Логика на вуз:

1. `resolveOfficialSite(uni)` → базовый адрес. Нет адреса → кейс `no_official_site`, переходим к Wikimedia.
2. Для каждого пути из `SITE_PATHS`: скачать HTML, взять `og:image` и `<img>` с площадью выше порога, привести ссылки к абсолютным.
3. Скачать кандидата, посчитать `fingerprint`, применить `acceptable`.
4. Отбросить, если `sha1` совпадает с любым фото из реестра, принадлежащим **другому** вузу, или `hamming(dhash) <= 6` с таким фото. Это защита от повторного втягивания того же стока.
5. Сохранить как `hunt-N.jpg`, записать кандидата с провенансом: `{ slug, domain: 'gallery'|'campuses', img, imgSource: <URL страницы>, imgLicense: 'official-site', imgCheckedAt, replaces: <img, который он заменит> }`.
6. Если офсайт не дал нужного числа — Wikimedia: Wikidata по названию, проверить `P31` (учебное заведение) и совпадение label, взять `P18` и Commons-категорию, лицензию и автора взять из API (`extmetadata.LicenseShortName`, `extmetadata.Artist`).

Защита Wikidata переиспользуется из `discover-official-sites.mjs` — там она уже написана и проверена на 59 адресах.

- [ ] **Step 2: Собрать список пилота — 30 вузов, не случайных**

```bash
node -e "
const fs=require('fs');
const audit=JSON.parse(fs.readFileSync('scraper/sources/audit/orel-audit.json','utf8'));
const cat=s=>JSON.parse(fs.readFileSync('site/src/content/universities/'+s+'.json','utf8'));
const withSite=[],without=[];
for(const g of audit.gaps){ const u=cat(g.slug); (u.officialUrl?withSite:without).push({...g,programs:u.programs.length}); }
const big=withSite.filter(x=>x.programs>=100).slice(0,10);
const small=withSite.filter(x=>x.programs<100).slice(0,10);
const none=without.slice(0,10);
fs.writeFileSync('sources/orel-pilot.json',JSON.stringify([...big,...small,...none].map(x=>x.slug),null,1));
console.log('пилот:',big.length,'крупных +',small.length,'мелких +',none.length,'без офсайта');
"
```

Expected: `пилот: 10 крупных + 10 мелких + 10 без офсайта`

- [ ] **Step 3: Прогнать пилот**

Run: `node scraper/orel-hunt.mjs --worklist=sources/orel-pilot.json`
Expected: отчёт вида `кандидатов: N, вузов с ≥1 кандидатом: M из 30`

- [ ] **Step 4: Убедиться, что каталог не тронут**

Run: `git status --porcelain site/src/content`
Expected: пусто. Если не пусто — скрипт нарушил своё главное ограничение, откатить и чинить.

- [ ] **Step 5: Коммит кода (кандидаты и картинки — пока не коммитим)**

```bash
git add scraper/orel-hunt.mjs sources/orel-pilot.json
git commit -m "feat(orel): МОТЫЛЁК — поиск фото по офсайту и Wikimedia"
```

---

### Task 6: `orel-preview` — просмотр глазами

**Files:**
- Create: `scraper/orel-preview.mjs`

Урок среза 2: брак виден только глазами, цифра «найдено N» дважды обманула. Этот шаг — обязательный гейт, а не украшение.

- [ ] **Step 1: Написать скрипт**

Читает `sources/photo-candidates.json` и текущий каталог, пишет `site/public/orel-preview.html`: по строке на вуз, слева нынешние фото с их метками, справа кандидаты с источником и лицензией. Образец разметки — `scraper/bobr-preview.mjs`.

```javascript
#!/usr/bin/env node
// orel-preview.mjs — HTML «было → стало» для просмотра кандидатов глазами.
// Usage: node scraper/orel-preview.mjs [--out=site/public/orel-preview.html]
```

- [ ] **Step 2: Собрать превью пилота и просмотреть**

Run: `node scraper/orel-preview.mjs && cd site && npm run dev`
Открыть `http://localhost:4321/orel-preview.html`.

**Проверить глазами по всем 30 вузам пилота:**
- фото действительно принадлежит этому вузу, а не соседнему кампусу или городу;
- это не логотип, не карта, не портрет ректора, не рекламный баннер;
- у Wikimedia-кандидатов заполнены автор и лицензия.

Записать долю брака в `sources/audit/orel-pilot-eyeball.md`: сколько кандидатов пригодны, сколько мусор, какие ошибки повторяются.

- [ ] **Step 3: Решение по порогу**

Если брак выше 10% — ужесточить фильтры в `orel-hunt` и повторить пилот, **не переходя** к массовому прогону. Если ниже — доложить владельцу реальную достижимую цифру покрытия и ждать его решения (требование спеки: массовый прогон только после этого).

- [ ] **Step 4: Коммит**

```bash
git add scraper/orel-preview.mjs sources/audit/orel-pilot-eyeball.md
git commit -m "feat(orel): превью кандидатов + результаты визуальной выборки пилота"
```

---

### Task 7: `orel-apply` — применение замен

**Files:**
- Create: `scraper/orel-apply.mjs`
- Создаёт при прогоне: `site/public/api/orel-review.json` (кейсы для `/manager`)

- [ ] **Step 1: Написать скрипт**

```javascript
#!/usr/bin/env node
// orel-apply.mjs — применение найденных фото.
// Автозамена ТОЛЬКО при всех условиях сразу:
//   1. кандидат скачан с домена офсайта этого вуза (imgLicense === 'official-site'), ЛИБО
//      это Wikimedia с заполненными автором и лицензией;
//   2. прошёл фильтры пригодности (размер, пропорции, не графика);
//   3. отпечаток не совпадает ни с одним фото другого вуза в реестре.
// Всё остальное → кейс в site/public/api/orel-review.json для оператора.
//
// Замена строго 1:1: кандидат встаёт НА МЕСТО фото с imgKind stock|shared,
// начиная с худших. Число фото у вуза не уменьшается никогда.
// Из каталога ничего не удаляется — заменяется значение поля img и пишется провенанс.
//
// Usage: node scraper/orel-apply.mjs [--slug=<uni>] [--dry-run] [--auto-only]
```

Замена одного элемента:

```javascript
item.img = cand.img;
item.imgKind = 'verified';
item.imgSource = cand.imgSource;
item.imgLicense = cand.imgLicense;
if (cand.imgAuthor) item.imgAuthor = cand.imgAuthor;
item.imgCheckedAt = TODAY;
```

**Домены замены — только `gallery` и `campuses`** (решение владельца: фото общежитий ищем следующим шагом, вместе с разбором 1529 кейсов БОБРа). Карточки `accommodation` этот скрипт не трогает вообще — они только помечены аудитом.

Порядок замены внутри вуза: сначала `stock`, затем `shared`, затем `unknown`. `verified` не трогаем никогда. Если кандидатов больше, чем непроверенных фото, лишние **добавляются** в конец галереи, а не выбрасываются.

- [ ] **Step 2: Сухой прогон на пилоте**

```bash
git status --porcelain > /tmp/apply-before.txt
node scraper/orel-apply.mjs --dry-run
git status --porcelain > /tmp/apply-after.txt
diff /tmp/apply-before.txt /tmp/apply-after.txt && echo "СУХОЙ ПРОГОН ЧИСТ"
```

Expected: `СУХОЙ ПРОГОН ЧИСТ` + отчёт «заменил бы N фото у M вузов, кейсов K»

- [ ] **Step 3: Боевой прогон на пилоте**

Run: `node scraper/orel-apply.mjs && node scraper/validate-catalog.mjs`
Expected: 807/0

- [ ] **Step 4: Проверить, что фото не потерялись**

```bash
node -e "
const fs=require('fs');const d='site/src/content/universities/';
let n=0; for(const f of fs.readdirSync(d)){ const u=JSON.parse(fs.readFileSync(d+f,'utf8'));
n+=(u.gallery?.items||[]).length+(u.accommodation||[]).length+(u.campuses||[]).length; }
console.log('карточек с фото всего:',n);
"
```

Expected: не меньше, чем до прогона (7074 ссылки + возможные добавления). Уменьшение = баг замены, откатывать.

- [ ] **Step 5: Пересчитать аудит и собрать превью результата**

Run: `node scraper/orel-audit.mjs && node scraper/orel-preview.mjs`
Expected: `tally.verified` вырос ровно на число применённых замен

- [ ] **Step 6: Build и коммит**

```bash
cd site && npm run build && cd ..
git add scraper/orel-apply.mjs
git commit -m "feat(orel): применение фото-замен 1:1 + кейсы оператору"
git add site/src/content/universities site/public/photos site/public/api/orel-review.json sources/photo-candidates.json
git commit -m "data(catalog): ОРЁЛ — подтверждённые фото пилота"
```

---

### Task 8: Подписи на сайте

**Files:**
- Modify: `site/src/pages/[slug].astro`
- Modify: `site/src/pages/[lang]/[slug].astro`

Wikimedia отдаёт фото под CC BY-SA — без указания автора и лицензии использовать их нельзя. Сейчас не указано ничего ни у одного из 325 внешних фото.

- [ ] **Step 1: Найти места отрисовки фото**

Run: `grep -n "gallery" site/src/pages/\[slug\].astro | head -20`

- [ ] **Step 2: Добавить подпись под фото**

```astro
{item.imgKind && item.imgKind !== 'verified' && (
  <span class="photo-note">Иллюстративное фото</span>
)}
{item.imgLicense && item.imgLicense !== 'official-site' && (
  <span class="photo-credit">
    {item.imgAuthor ? `${item.imgAuthor}, ` : ''}{item.imgLicense}
    {item.imgSource && <a href={item.imgSource} rel="nofollow noopener" target="_blank">источник</a>}
  </span>
)}
```

Стиль — мелкий приглушённый текст под картинкой, не перекрывающий её.

- [ ] **Step 3: Продублировать в `[lang]/[slug].astro`**

Тот же блок в соответствующем месте второго шаблона.

- [ ] **Step 4: Проверить глазами**

Run: `cd site && npm run build && npm run preview`
Открыть карточку вуза с Wikimedia-фото и карточку с непроверенным: подписи на месте, вёрстка не поехала.

- [ ] **Step 5: Коммит**

```bash
git add "site/src/pages/[slug].astro" "site/src/pages/[lang]/[slug].astro"
git commit -m "feat(orel): подписи лицензии и пометка иллюстративных фото"
```

---

### Task 9: Чистка мусора на диске

**Files:**
- Create: `scraper/prune-orphan-photos.mjs`

1432 файла не упомянуты в каталоге ни разу, 1194 файла — побайтовые копии. Отдельный коммит, чтобы откат был в одну команду.

- [ ] **Step 1: Написать скрипт**

```javascript
#!/usr/bin/env node
// prune-orphan-photos.mjs — удаляет файлы из site/public/photos, на которые
// не ссылается ни один вуз каталога. Список берётся из реестра ОРЛА,
// поэтому запускать ТОЛЬКО после свежего orel-audit.
//
// Usage: node scraper/prune-orphan-photos.mjs [--dry-run] [--apply]
// Без --apply работает как сухой прогон: печатает список и вес, ничего не трогает.
```

Защита: если реестр старше суток или каталог менялся после него — отказаться и попросить перепрогнать аудит. Удалять только под `--apply`.

- [ ] **Step 2: Сухой прогон**

Run: `node scraper/orel-audit.mjs && node scraper/prune-orphan-photos.mjs`
Expected: список ~1432 файлов и вес к освобождению; рабочее дерево не тронуто

- [ ] **Step 3: Спот-чек 10 файлов из списка**

Взять 10 путей и убедиться `grep`-ом, что они действительно не встречаются в каталоге:

```bash
for p in $(node scraper/prune-orphan-photos.mjs 2>/dev/null | head -10); do
  grep -rl "$p" site/src/content/universities/ | head -1 || echo "не используется: $p"
done
```

Expected: все десять — «не используется»

- [ ] **Step 4: Удалить и проверить сайт**

Run: `node scraper/prune-orphan-photos.mjs --apply && cd site && npm run build`
Expected: build exit 0, 2428 страниц, ни одной битой картинки

- [ ] **Step 5: Коммит**

```bash
git add scraper/prune-orphan-photos.mjs
git commit -m "feat(orel): удаление осиротевших фото по реестру"
git add -A site/public/photos
git commit -m "chore(photos): удалены осиротевшие файлы"
```

---

### Task 10: Оркестратор, панель и закрытие долга по dry-run

**Files:**
- Modify: `scraper/orel.mjs`
- Modify: `site/src/pages/manager.astro`
- Create: `scraper/dry-run-clean.test.mjs`
- Modify: `BACKLOG.md`

- [ ] **Step 1: Прописать новые фазы в `orel.mjs`**

Заменить вызов удалённого `orel-photo-quality.mjs` на цепочку `orel-audit` → `orel-hunt` → `orel-apply`. Флаги `--dry-run`, `--limit`, `--slug` пробрасывать **во все** фазы — именно непроброшенный флаг был багом `bobr.mjs`.

- [ ] **Step 2: Написать сквозной тест чистоты сухого прогона**

```javascript
// scraper/dry-run-clean.test.mjs
// Закрывает долг из BACKLOG.md: «после любого --dry-run рабочее дерево чистое».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' });
const treeState = () => git('status', '--porcelain', 'site/', 'scraper/sources/');

for (const script of ['orel-audit.mjs', 'orel-hunt.mjs', 'orel-apply.mjs']) {
  test(`${script} --dry-run не оставляет следов`, () => {
    const before = treeState();
    execFileSync('node', [`scraper/${script}`, '--dry-run', '--limit=3'], { encoding: 'utf8' });
    assert.equal(treeState(), before, `${script} записал что-то в сухом прогоне`);
  });
}
```

- [ ] **Step 3: Запустить тест**

Run: `node --test scraper/dry-run-clean.test.mjs`
Expected: PASS, 3 теста. Падение = скрипт пишет в сухом прогоне, чинить его, а не тест.

- [ ] **Step 4: Вкладка ОРЁЛ в панели**

По образцу вкладки БОБР в `manager.astro`: грузит `site/public/api/orel-review.json`, показывает кейс с картинкой-кандидатом и кнопками «применить / отклонить», решения роутит в свой файл.

- [ ] **Step 5: Обновить BACKLOG**

Отметить закрытым пункт «Общее: добавить сквозной тест "после любого `--dry-run` рабочее дерево чистое"» с датой и ссылкой на тест. Пункт про `bobr.mjs --dry-run` уже закрыт в срезе 2 — не трогать.

- [ ] **Step 6: Финальная проверка целиком**

```bash
node --test scraper/lib/*.test.mjs scraper/dry-run-clean.test.mjs
node scraper/validate-catalog.mjs
cd site && npm run build
```

Expected: все тесты зелёные; 807/0; build exit 0, 2428 страниц

- [ ] **Step 7: Коммит**

```bash
git add scraper/orel.mjs scraper/dry-run-clean.test.mjs site/src/pages/manager.astro BACKLOG.md
git commit -m "feat(orel): фазы в оркестраторе, вкладка ОРЁЛ, тест чистоты dry-run"
```

---

## Гейт перед массовым прогоном

Задачи 1–4 (пометка) выполняются до конца — они безопасны и обратимы. Задачи 5–7 на пилоте из 30 вузов останавливаются на визуальной выборке (Task 6, Step 3). **Массовый прогон охоты по всем 807 вузам запускается только после того, как владелец увидит долю попадания с пилота и скажет продолжать.** Это прямое требование спеки, а не осторожность ради осторожности: в срезе 2 автопоиск давал 29% брака, невидимого в цифрах.

## Итоговая проверка среза

1. Все юнит-тесты зелёные (`node --test scraper/lib/*.test.mjs scraper/dry-run-clean.test.mjs`).
2. `node scraper/validate-catalog.mjs` → 807/0.
3. `cd site && npm run build` → exit 0, 2428 страниц.
4. 100% фото имеют `imgKind` (было 0% у галереи).
5. Повторный `orel-audit` → ноль изменений.
6. Ни один `--dry-run` не оставляет следов.
7. Число фото у каждого вуза не уменьшилось.
8. Визуальная выборка просмотрена, доля брака записана.
