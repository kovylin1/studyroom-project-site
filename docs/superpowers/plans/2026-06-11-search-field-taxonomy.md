# Search Field Taxonomy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a curated "field" (направление) layer so broad/synonymous searches ("бизнес", "IT") return the full set of matching universities, and add clickable category chips above the catalog.

**Architecture:** A pure data module `fields.ts` exposes a taxonomy (field = id + RU label + EN membership keywords + broad RU aliases) and two pure functions. At build time `UniversityCardV2.astro` stamps each card with `data-fields` (chip filtering) and injects field tokens into `data-search` (smart text search). The client filter `catalog-v2.ts` gains a `field` filter mirroring the existing `faculty`/`level` mechanism, and `Filters.astro` renders a chip row. Additive — does not touch the proven `programs[].title` indexing or `search-synonyms.ts`.

**Tech Stack:** Astro 5, TypeScript, vitest (already configured: `npm run test` → `vitest run`), client-side DOM filtering.

---

## File Structure

- **Create** `site/src/scripts/fields.ts` — taxonomy table + `fieldsFor()` + `fieldSearchTokens()`. One responsibility: map a lowercased haystack to fields.
- **Create** `site/src/scripts/fields.test.ts` — vitest unit tests for the pure functions.
- **Modify** `site/src/components/UniversityCardV2.astro` — import fields, add `data-fields`, inject field tokens into `searchIndex`.
- **Modify** `site/src/scripts/catalog-v2.ts` — add `fields` to filter state + matching + URL sync.
- **Modify** `site/src/components/Filters.astro` — render field chips; accept new `fields` prop.
- **Modify** `site/src/pages/index.astro` — build the field list and pass it to `<Filters>`.

All Astro imports use the `~/` alias (e.g. `~/scripts/fields`), matching existing code.

---

## Task 1: The `fields.ts` taxonomy module (TDD)

**Files:**
- Create: `site/src/scripts/fields.ts`
- Test: `site/src/scripts/fields.test.ts`

- [ ] **Step 1: Write the failing test**

Create `site/src/scripts/fields.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { FIELDS, fieldsFor, fieldSearchTokens } from './fields';

describe('fieldsFor', () => {
  it('groups a marketing programme under business', () => {
    expect(fieldsFor('bachelor of marketing')).toContain('business');
  });

  it('maps computer science and information technology to the same field', () => {
    expect(fieldsFor('msc computer science')).toContain('cs');
    expect(fieldsFor('bsc information technology')).toContain('cs');
  });

  it('returns no fields when nothing matches', () => {
    expect(fieldsFor('basket weaving for beginners')).toEqual([]);
  });

  it('can place a title in more than one field', () => {
    const ids = fieldsFor('history of art');
    expect(ids).toContain('humanities'); // history
    expect(ids).toContain('arts');       // art
  });
});

describe('fieldSearchTokens', () => {
  it('injects the broad RU alias so "бизнес" matches a marketing card', () => {
    const tokens = fieldSearchTokens('bachelor of marketing');
    expect(tokens).toContain('бизнес');
  });

  it('returns nothing when no field matches', () => {
    expect(fieldSearchTokens('basket weaving')).toEqual([]);
  });
});

describe('FIELDS table integrity', () => {
  it('has unique ids', () => {
    const ids = FIELDS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses lowercase EN keywords (matched as substrings)', () => {
    for (const f of FIELDS) {
      for (const en of f.en) expect(en).toBe(en.toLowerCase());
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd site && npm run test -- fields`
Expected: FAIL — `Cannot find module './fields'`.

- [ ] **Step 3: Write the implementation**

Create `site/src/scripts/fields.ts`:

```ts
// Curated "field" (направление) taxonomy layered ON TOP of the existing
// programs[].title indexing and search-synonyms.ts. Each field groups many
// program names under one canonical direction, powering both:
//   1. smart text search — broad/synonym terms expand to the field's tokens
//      (fieldSearchTokens → appended to the card's data-search);
//   2. clickable category chips — fieldsFor → the card's data-fields.
//
// `en` keywords are matched as substrings against an already-lowercased
// haystack (program titles + faculties), exactly like ruSynonymsFor().
// `id` is a stable slug — DO NOT rename (it is used in shareable ?field= URLs).
export interface Field {
  id: string;
  label: string;
  en: string[];
  ru: string[];
}

export const FIELDS: ReadonlyArray<Field> = [
  {
    id: 'business',
    label: 'Бизнес',
    en: ['business', 'management', 'marketing', 'finance', 'accounting',
      'economics', 'entrepreneurship', 'mba', 'human resources',
      'supply chain', 'logistics'],
    ru: ['бизнес', 'менеджмент', 'маркетинг', 'финансы', 'экономика',
      'бухгалтерия', 'предпринимательство', 'логистика'],
  },
  {
    id: 'cs',
    label: 'IT и Computer Science',
    en: ['computer science', 'computing', 'information technology', 'software',
      'data science', 'data analytics', 'artificial intelligence',
      'machine learning', 'cyber security', 'cybersecurity'],
    ru: ['айти', 'информатика', 'программирование', 'компьютерные науки',
      'информационные технологии', 'искусственный интеллект',
      'кибербезопасность', 'данные'],
  },
  {
    id: 'engineering',
    label: 'Инженерия',
    en: ['engineering', 'mechanical', 'electrical', 'electronic', 'civil',
      'aerospace', 'aeronautical', 'industrial', 'petroleum', 'mechatronics',
      'robotics'],
    ru: ['инженерия', 'инженерное', 'машиностроение', 'механика',
      'электротехника', 'строительство', 'робототехника'],
  },
  {
    id: 'medicine',
    label: 'Медицина и здоровье',
    en: ['medicine', 'medical', 'nursing', 'pharmacy', 'dentistry',
      'public health', 'nutrition', 'physiotherapy', 'midwifery',
      'veterinary', 'biomedical'],
    ru: ['медицина', 'сестринское', 'фармация', 'стоматология',
      'здравоохранение', 'ветеринария', 'физиотерапия'],
  },
  {
    id: 'law',
    label: 'Право и политика',
    en: ['law', 'legal', 'international relations', 'political science',
      'politics', 'public policy', 'criminology'],
    ru: ['право', 'юриспруденция', 'юридическая', 'международные отношения',
      'политология', 'криминология'],
  },
  {
    id: 'arts',
    label: 'Искусство и дизайн',
    en: ['art', 'design', 'fashion', 'architecture', 'graphic',
      'interior design', 'fine art', 'animation', 'music', 'dance', 'film',
      'game'],
    ru: ['искусство', 'дизайн', 'мода', 'архитектура', 'музыка', 'анимация',
      'кино', 'графический'],
  },
  {
    id: 'sciences',
    label: 'Естественные науки',
    en: ['biology', 'chemistry', 'physics', 'mathematics', 'statistics',
      'biotechnology', 'environmental', 'geography', 'astronomy'],
    ru: ['биология', 'химия', 'физика', 'математика', 'статистика',
      'биотехнология', 'экология', 'география'],
  },
  {
    id: 'humanities',
    label: 'Гуманитарные науки',
    en: ['psychology', 'sociology', 'philosophy', 'history', 'anthropology',
      'linguistics', 'theology', 'social work', 'translation'],
    ru: ['психология', 'социология', 'философия', 'история', 'антропология',
      'лингвистика', 'перевод', 'социальная работа'],
  },
  {
    id: 'media',
    label: 'Медиа и коммуникации',
    en: ['media', 'journalism', 'communication', 'public relations',
      'advertising'],
    ru: ['медиа', 'журналистика', 'коммуникации', 'реклама', 'пиар'],
  },
  {
    id: 'education',
    label: 'Образование',
    en: ['education', 'teaching', 'pedagogy', 'early childhood'],
    ru: ['образование', 'педагогика', 'преподавание'],
  },
  {
    id: 'hospitality',
    label: 'Туризм и гостеприимство',
    en: ['tourism', 'hospitality', 'hotel', 'culinary', 'event management'],
    ru: ['туризм', 'гостеприимство', 'гостиничное', 'отельный', 'кулинария'],
  },
  {
    id: 'sport',
    label: 'Спорт',
    en: ['sport', 'sports', 'physical education', 'esports', 'fitness'],
    ru: ['спорт', 'спортивная', 'физкультура', 'киберспорт', 'фитнес'],
  },
];

/** IDs of all fields whose any EN keyword is a substring of the haystack. */
export function fieldsFor(haystackLower: string): string[] {
  const out: string[] = [];
  for (const f of FIELDS) {
    if (f.en.some((en) => haystackLower.includes(en))) out.push(f.id);
  }
  return out;
}

/**
 * Search tokens to append to a card's data-search: for every matching field,
 * its label + all RU aliases + all EN keywords. This is what makes a broad
 * query ("бизнес") match a card whose only relevant programme is "Marketing".
 */
export function fieldSearchTokens(haystackLower: string): string[] {
  const out: string[] = [];
  for (const f of FIELDS) {
    if (f.en.some((en) => haystackLower.includes(en))) {
      out.push(f.label.toLowerCase(), ...f.ru, ...f.en);
    }
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd site && npm run test -- fields`
Expected: PASS — all assertions green.

- [ ] **Step 5: Commit**

```bash
git add site/src/scripts/fields.ts site/src/scripts/fields.test.ts
git commit -m "feat(search): add curated field taxonomy module"
```

---

## Task 2: Stamp cards with fields (build-time)

**Files:**
- Modify: `site/src/components/UniversityCardV2.astro`

- [ ] **Step 1: Add the import**

At the top of the frontmatter, next to the existing synonyms import (line 4):

```astro
import { ruSynonymsFor } from '~/scripts/search-synonyms';
import { fieldsFor, fieldSearchTokens } from '~/scripts/fields';
```

- [ ] **Step 2: Compute fields and inject tokens**

Replace the existing `searchIndex` line (currently line 77):

```astro
const searchIndex = [searchBase, ...ruSynonymsFor(searchBase)].join(' ');
```

with:

```astro
const cardFields = fieldsFor(searchBase);
const searchIndex = [
  searchBase,
  ...ruSynonymsFor(searchBase),
  ...fieldSearchTokens(searchBase),
].join(' ');
```

- [ ] **Step 3: Add the `data-fields` attribute**

In the `<article>` opening tag, after `data-faculties={facultyKeywords}` (line 89), add:

```astro
  data-fields={cardFields.join(',')}
```

- [ ] **Step 4: Verify the build still compiles**

Run: `cd site && npm run build`
Expected: build completes, "811 page(s) built" (or current count), no type errors.

- [ ] **Step 5: Spot-check the output**

Run: `cd site && node -e "const fs=require('fs');const h=fs.readFileSync('dist/index.html','utf8');console.log('data-fields count:', (h.match(/data-fields=/g)||[]).length); console.log('has business chip data:', h.includes('data-fields=\"') )"`
Expected: a large `data-fields count` (hundreds), confirming cards are stamped.

- [ ] **Step 6: Commit**

```bash
git add site/src/components/UniversityCardV2.astro
git commit -m "feat(search): stamp cards with data-fields and field search tokens"
```

---

## Task 3: Add the `field` filter to the client logic

**Files:**
- Modify: `site/src/scripts/catalog-v2.ts`

This mirrors the existing `faculties` filter exactly (OR-semantics: a card passes if any of its fields is selected).

- [ ] **Step 1: Add `fields` to `FilterState`**

In the `FilterState` interface (lines 1-9), after `faculties: Set<string>;` add:

```ts
  fields: Set<string>;
```

- [ ] **Step 2: Read `field` values in `readState`**

In `readState` (after the `faculties` loop, before the `return`), add:

```ts
  const fields = new Set<string>();
  for (const value of fd.getAll('field')) {
    if (typeof value === 'string' && value) fields.add(value);
  }
```

and add `fields,` to the returned object.

- [ ] **Step 3: Match on `data-fields` in `cardMatches`**

In `cardMatches`, after the `faculties` block (lines 59-62), add:

```ts
  if (state.fields.size > 0) {
    const cardFields = (card.dataset.fields ?? '').split(',').filter(Boolean);
    if (!cardFields.some((f) => state.fields.has(f))) return false;
  }
```

- [ ] **Step 4: Count the active field filter**

In `countActive`, after `if (state.faculties.size > 0) n++;` (line 79), add:

```ts
  if (state.fields.size > 0) n++;
```

- [ ] **Step 5: Sync `field` to the URL**

In `syncUrl`, after the `faculties` param line (line 139), add:

```ts
  if (state.fields.size > 0) params.set('field', Array.from(state.fields).join(','));
```

- [ ] **Step 6: Restore `field` from the URL**

In `restoreFromUrl`, after the `faculty` restore block (lines 160-166), add:

```ts
  const field = params.get('field');
  if (field) {
    const wanted = new Set(field.split(',').filter(Boolean));
    form.querySelectorAll<HTMLInputElement>('input[name="field"]').forEach((i) => {
      i.checked = wanted.has(i.value);
    });
  }
```

- [ ] **Step 7: Verify it compiles**

Run: `cd site && npm run check`
Expected: no TypeScript errors from `catalog-v2.ts`.

- [ ] **Step 8: Commit**

```bash
git add site/src/scripts/catalog-v2.ts
git commit -m "feat(search): wire field chips into the client filter and URL state"
```

---

## Task 4: Render the field chips

**Files:**
- Modify: `site/src/components/Filters.astro`
- Modify: `site/src/pages/index.astro`

- [ ] **Step 1: Accept a `fields` prop in Filters.astro**

In `Filters.astro`, change the `Props` interface and destructuring. Replace lines 1-9:

```astro
---
import { FIELDS } from '~/scripts/fields';

interface Props {
  countries: string[];
  levels: string[];
  faculties: string[];
  tuitionMax: number;
}

const { countries, levels, tuitionMax } = Astro.props;
```

(We import `FIELDS` directly rather than threading a prop — the taxonomy is static. The `faculties` prop stays in the interface for compatibility with `index.astro`.)

- [ ] **Step 2: Render the chip row**

In `Filters.astro`, immediately after the "Программа" (levels) group block (after line 38, before the IELTS group), add:

```astro
  <div class="filterbar__group filterbar__group--grow">
    <span class="filterbar__label">Направление</span>
    <div class="filterbar__chips">
      {FIELDS.map((field) => (
        <label class="filterbar__chip">
          <input type="checkbox" name="field" value={field.id} form="catalog-filters" />
          <span>{field.label}</span>
        </label>
      ))}
    </div>
  </div>
```

This reuses the existing `.filterbar__chips` / `.filterbar__chip` styles already used by the level chips — no new CSS needed.

- [ ] **Step 3: Verify the build renders chips**

Run: `cd site && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Confirm chips are in the HTML**

Run: `cd site && node -e "const fs=require('fs');const h=fs.readFileSync('dist/index.html','utf8');console.log('field inputs:', (h.match(/name=\"field\"/g)||[]).length)"`
Expected: `field inputs: 12` (one per field in the taxonomy).

- [ ] **Step 5: Commit**

```bash
git add site/src/components/Filters.astro
git commit -m "feat(search): render clickable field category chips"
```

Note: `index.astro` already passes `faculties={faculties}` to `<Filters>` (line 88); no change is required there because the field chips read `FIELDS` directly. The `index.astro` "Modify" entry in the file structure is therefore a no-op — left listed only to confirm it was reviewed. If a future change wants per-build field lists, thread a `fields` prop here.

---

## Task 5: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Run the unit tests**

Run: `cd site && npm run test`
Expected: all tests pass, including `fields.test.ts`.

- [ ] **Step 2: Build**

Run: `cd site && npm run build`
Expected: clean build.

- [ ] **Step 3: Smoke-test broad search against the built HTML**

Run:
```bash
cd site && node -e "
const fs=require('fs');
const h=fs.readFileSync('dist/index.html','utf8');
// crude: count cards whose data-search contains 'бизнес'
const m=h.match(/data-search=\"[^\"]*\"/g)||[];
const biz=m.filter(s=>s.includes('бизнес')).length;
console.log('cards matching бизнес:', biz);
"
```
Expected: dozens of cards (not 1-2), proving the broad term now groups marketing/finance/etc.

- [ ] **Step 4: Manual browser check (preview)**

Run: `cd site && npm run preview` then open the local URL.
Verify: (a) a "Направление" chip row appears in the filters panel; (b) clicking "Бизнес" narrows the grid; (c) typing "бизнес" in search returns many universities; (d) `?field=business` in the URL pre-checks the chip on reload.

- [ ] **Step 5: Final commit (if any cleanup)**

```bash
git add -A
git commit -m "test(search): verify field taxonomy end-to-end"
```

(If nothing changed in this task, skip the commit.)

---

## Notes for the implementer

- **Git hazard in this repo:** a background automation can silently eat tracked edits. Work on an isolated branch, commit immediately after each task, and `git add` by explicit path (the commands above already do this) — never `git add -A` except the final optional cleanup where you've reviewed `git status` first.
- **Deploy is outward-facing** and handled separately (GitHub Actions `deploy.yml` on push to `main`). This plan does not deploy; merging to `main` triggers it.
- **Do not touch** `search-synonyms.ts` or the `programs[].title` indexing — the field layer is purely additive on top of them.
- **Known limitation (by design):** coverage is bounded by the `FIELDS` table; new exotic directions are added by hand.
