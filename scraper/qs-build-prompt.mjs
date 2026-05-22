#!/usr/bin/env node
// Emits a per-uni Sonnet prompt for the QS aggregator parsing fleet.
// Usage:   node scraper/qs-build-prompt.mjs <slug>
// Reads:   sources/qs-queue.json
// Writes:  stdout (the prompt text — feed into Agent() prompt arg)

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const COUNTRY_RULES = {
  'United Kingdom':        { cur: 'GBP', dl: '2027-09-15T00:00:00.000Z', ielts: 6.5 },
  'Ireland':               { cur: 'EUR', dl: '2027-07-01T00:00:00.000Z', ielts: 6.5 },
  'United States':         { cur: 'USD', dl: '2027-12-01T00:00:00.000Z', ielts: 6.5 },
  'Canada':                { cur: 'CAD', dl: '2027-03-01T00:00:00.000Z', ielts: 6.5 },
  'Australia':             { cur: 'AUD', dl: '2027-02-15T00:00:00.000Z', ielts: 6.5 },
  'New Zealand':           { cur: 'NZD', dl: '2027-02-15T00:00:00.000Z', ielts: 6.0 },
  'United Arab Emirates':  { cur: 'USD', dl: '2027-09-01T00:00:00.000Z', ielts: 6.0 },
  'Japan':                 { cur: 'USD', dl: '2027-04-01T00:00:00.000Z', ielts: 6.0 },
  'Malaysia':              { cur: 'USD', dl: '2027-09-01T00:00:00.000Z', ielts: 6.0 },
  'Singapore':             { cur: 'USD', dl: '2027-08-01T00:00:00.000Z', ielts: 6.5 },
  'China':                 { cur: 'USD', dl: '2027-09-01T00:00:00.000Z', ielts: 6.0 },
  'Austria':               { cur: 'EUR', dl: '2027-07-01T00:00:00.000Z', ielts: 6.5 },
  'Belgium':               { cur: 'EUR', dl: '2027-09-01T00:00:00.000Z', ielts: 6.5 },
  'Cyprus':                { cur: 'EUR', dl: '2027-08-01T00:00:00.000Z', ielts: 6.0 },
  'Finland':               { cur: 'EUR', dl: '2027-01-15T00:00:00.000Z', ielts: 6.5 },
  'France':                { cur: 'EUR', dl: '2027-06-15T00:00:00.000Z', ielts: 6.0 },
  'Germany':               { cur: 'EUR', dl: '2027-07-15T00:00:00.000Z', ielts: 6.0 },
  'Hungary':               { cur: 'EUR', dl: '2027-06-01T00:00:00.000Z', ielts: 6.0 },
  'Italy':                 { cur: 'EUR', dl: '2027-07-01T00:00:00.000Z', ielts: 6.0 },
  'Malta':                 { cur: 'EUR', dl: '2027-09-01T00:00:00.000Z', ielts: 6.0 },
  'Netherlands':           { cur: 'EUR', dl: '2027-05-01T00:00:00.000Z', ielts: 6.5 },
  'Poland':                { cur: 'EUR', dl: '2027-07-15T00:00:00.000Z', ielts: 6.0 },
  'Portugal':              { cur: 'EUR', dl: '2027-07-01T00:00:00.000Z', ielts: 6.0 },
  'Spain':                 { cur: 'EUR', dl: '2027-06-30T00:00:00.000Z', ielts: 6.0 },
  'Switzerland':           { cur: 'EUR', dl: '2027-07-15T00:00:00.000Z', ielts: 6.5 },
  'Turkey':                { cur: 'USD', dl: '2027-08-01T00:00:00.000Z', ielts: 6.0 },
  'Grenada':               { cur: 'USD', dl: '2027-08-01T00:00:00.000Z', ielts: 6.5 },
};
const DEFAULT_RULES = { cur: 'USD', dl: '2027-09-01T00:00:00.000Z', ielts: 6.0 };

const CURRENCY_SYMBOL = {
  GBP: '£', EUR: '€', USD: '$', AUD: 'AU$', NZD: 'NZ$', CAD: 'CA$', KZT: '₸', RUB: '₽',
};

const programCountTarget = (qsLevel) => {
  switch (qsLevel) {
    case 'high-school': return '3-10 entries (year levels + English programs)';
    case 'college':     return '6-15 entries (foundation/diploma/pathway streams)';
    case 'university':
    default:            return '15-40 entries spanning all faculties';
  }
};

const buildPrompt = (row) => {
  const rules = COUNTRY_RULES[row.country] || DEFAULT_RULES;
  const cur = rules.cur;
  const symbol = CURRENCY_SYMBOL[cur] || cur;
  const pathwayNote = row.isPathwayCentre
    ? `\n**Pathway-centre context:** This is a pathway college${row.pathwayParentSlug ? ` for parent uni "${row.pathwayParentSlug}" (already in catalog at site/src/content/universities/${row.pathwayParentSlug}.json — peek at it for tone/style if helpful)` : ''}. Use \`programType: "pathway"\` on all programs. Levels: foundation/english-language only. No PhDs.`
    : '';

  return `You are parsing ONE QS-partner institution for the StudyRoom catalog. Strict, token-tight. Write the JSON to disk, return ONE LINE.

**Target row:**
\`\`\`json
${JSON.stringify(row)}
\`\`\`
${pathwayNote}

**Project root (cwd already set):** \`F:/Эдгар( не трож опасно для жизни)/программы/cursor/Claude/projects/studyroom-project-site/\`

**Step 1: Read the canonical example ONCE** — \`site/src/content/universities/abertay.json\`. Mirror its shape. Zod schema is at \`site/src/schema/university.ts\`.

**Step 2: Research the institution.** WebFetch \`${row.officialUrl || '(officialUrl is empty — search Wikipedia or guess the .edu/.ac.* domain)'}\` then sub-pages: \`/courses\`, \`/programs\`, \`/programmes\`, \`/study\`, \`/study-with-us\`, \`/admissions\`, \`/international\`, \`/fees\`, \`/scholarships\`, \`/accommodation\`, \`/about\`, \`/campus\`. If 403/blocked or page is JS-only, try Wikipedia: \`https://en.wikipedia.org/wiki/${encodeURIComponent(row.rawName.replace(/\s/g,'_'))}\`. Stay under ~12 web fetches.

**Step 3: Build the JSON** with the 8 user-mandated sections:
1. **campuses[]** — 1-4 entries: title, sub (location), text (descriptor)
2. **programs[]** — ALL programs on the site: ${programCountTarget(row.qsLevel)}. EVERY program needs slug+title+durationYears+level∈{high-school,sixth-form,foundation,bachelor,master,phd,english-language,short-course}. ${row.isPathwayCentre ? 'Mark all programs as `"programType":"pathway"`.' : 'Mark academic degrees as `"programType":"degree"` and pathway/foundation/English programs as `"programType":"pathway"`.'}
3. **scholarships[]** — 3-6 awards: name, nameRu, amount (STRING — "до ${symbol}..." or "full funding"), description, descriptionRu, optional url.
4. **accommodation[]** — 2-4 halls: name, price (STRING with currency, weekly or yearly), text.
5. **requirements** — { language: { ielts: ${rules.ielts} (number) }, exams: ["IELTS Academic"] }. Adjust ielts up to 7.0 for top-tier or Medicine programs.
6. **description** — { paragraphs: 4 English paragraphs about history+location+distinctives+international cohort; paragraphsRu: 4 Russian translations (keep faculty names, brand citations, program titles in ENGLISH per StudyRoom convention; translate only narrative prose); keyFacts: 5-8 ranking/founding/notable facts; keyFactsRu: Russian translations }.
7. **deadlines** — per-program ISO 8601 strings. Default: \`"${rules.dl}"\`. Adjust for the country's actual academic cycle if you find specifics on the site.
8. **gallery.items[]** — OPTIONAL. Skip if you can't find a clean Wikipedia/Wikimedia hero shot.

**Schema HARD constraints (Zod will reject otherwise):**
- top-level \`slug\`: \`"${row.slug}"\` exactly.
- program slugs: lowercase ASCII + hyphens, prefixed with \`${row.slug}-\`.
- \`tuition.currency\`: \`"${cur}"\`.
- \`tuition.byProgram\`: object with ALL keys being valid program slugs from \`programs[].slug\`. Numbers ≥0.
- \`deadlines\`: object with ALL keys being valid program slugs from \`programs[].slug\`. ISO date strings.
- \`scholarship.amount\`: STRING (NEVER a number).
- \`requirements.language.ielts\`: 0-9 number. \`requirements.exams\`: string[] (default \`[]\`).
- \`lastChecked\`: \`"2026-05-18T00:00:00.000Z"\`.
- \`sourceUrl\`: HTTPS URL (use \`officialUrl\` or Wikipedia URL if no other).
- \`sourceHash\`: \`"sha256:" + 16 hex chars\` (any plausible value).
- \`confidence\`: \`"aggregator"\`.
- \`language\`: \`"ru"\`.
- OMIT optional fields entirely if unknown — never write \`null\`.

**Write the file:** \`site/src/content/universities/${row.slug}.json\` (pretty-printed, 2-space indent).

**Report ONE LINE only**, no JSON, no explanation:
- Success: \`OK: ${row.slug} — N programs, S scholarships, A accommodation, C campuses\`
- Partial: \`WARN: ${row.slug} — N programs [missing: X]\`
- Block: \`GAP: ${row.slug} — <reason in <12 words>\`

**Safety rules (do not violate):**
- DO NOT disable, unset, or override any safety env vars (e.g. \`ECC_GATEGUARD\`, \`ECC_DISABLED_HOOKS\`). If a hook blocks a Write/Edit, respond to the hook with the required facts inline — do NOT bypass.
- DO NOT modify \`.claude/settings.json\` or any harness config.
- DO NOT touch files outside the project root.`;
};

const slug = process.argv[2];
if (!slug) {
  console.error('usage: node scraper/qs-build-prompt.mjs <slug>');
  process.exit(1);
}
const queue = JSON.parse(readFileSync(resolve(ROOT, 'sources/qs-queue.json'), 'utf8'));
const row = queue.find((r) => r.slug === slug);
if (!row) {
  console.error('slug not found in qs-queue.json:', slug);
  process.exit(1);
}
process.stdout.write(buildPrompt(row));
