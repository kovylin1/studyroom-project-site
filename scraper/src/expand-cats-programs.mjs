// One-off expansion: read sources/cats-collected.json, for each school explode
// each qualification's `subjects` array into per-subject program entries, then
// write back to site/src/content/universities/<slug>.json.
//
// Preserves: name, country, city, requirements, scholarships, accommodation,
// campuses, description, lastChecked, sourceUrl, sourceHash, confidence, language.
// Replaces: programs[], tuition.byProgram, deadlines.
//
// Run: node scraper/src/expand-cats-programs.mjs (from project root)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const COLLECTED = path.join(PROJECT_ROOT, 'sources', 'cats-collected.json');
const UNIS_DIR = path.join(PROJECT_ROOT, 'site', 'src', 'content', 'universities');

const collected = JSON.parse(fs.readFileSync(COLLECTED, 'utf8'));

// Keep these slugs as-is — already at fine granularity (one entry per
// degree/course). Don't re-explode them.
const SKIP = new Set(['csvpa-cambridge', 'csvpa-china', 'stafford-house']);

// Map cats-collected category keys → schema programLevel enum
const LEVEL_MAP = {
  high_school: 'high-school',
  sixth_form: 'sixth-form',
  foundation: 'foundation',
  bachelor: 'bachelor',
  master: 'master',
  english_language: 'english-language',
  summer_short: 'short-course',
};

// Slug-prefix per school (keeps program slugs short + collision-free)
const PREFIX = {
  'bournemouth-collegiate-school': 'bcs',
  'bosworth-independent-school': 'bos',
  'cats-academy-boston': 'cab',
  'worthgate-school': 'wg',
  'cats-cambridge': 'catsc',
  'cats-college-china': 'ccc',
  'forest-city-international-school': 'fcis',
  'guildhouse-school-london': 'gh',
  'st-michaels-school': 'stm',
};

const slugify = (s) =>
  String(s)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');

// Short label per qualification family — used in slug + faculty
const QUAL_LABEL = {
  // high-school
  'year-7-9': { slug: 'y7-9', faculty: 'Year 7-9 (Key Stage 3)', durYears: 1, type: 'pathway' },
  'pre-gcse': { slug: 'pre-gcse', faculty: 'Pre-GCSE (Year 9)', durYears: 1, type: 'pathway' },
  'gcse': { slug: 'gcse', faculty: 'GCSE (Year 10-11)', durYears: 2, type: 'pathway' },
  'igcse': { slug: 'igcse', faculty: 'IGCSE', durYears: 2, type: 'pathway' },
  'us-middle-school': { slug: 'us-ms', faculty: 'US Middle School (Grade 7-8)', durYears: 1, type: 'pathway' },
  'us-high-school-9-10': { slug: 'us-hs', faculty: 'US High School (Grade 9-10)', durYears: 1, type: 'pathway' },
  'year-10-11': { slug: 'y10-11', faculty: 'Year 10-11 (Grade 10-11)', durYears: 2, type: 'pathway' },
  // sixth-form
  'a-level': { slug: 'a-level', faculty: 'A-Level (Sixth Form)', durYears: 2, type: 'pathway' },
  'ib-diploma': { slug: 'ib-diploma', faculty: 'IB Diploma (Sixth Form)', durYears: 2, type: 'pathway' },
  'us-high-school-diploma': { slug: 'us-hs-diploma', faculty: 'US High School Diploma + AP', durYears: 4, type: 'pathway' },
  'btec-l3': { slug: 'btec', faculty: 'BTEC Level 3', durYears: 2, type: 'pathway' },
  'ap': { slug: 'ap', faculty: 'AP (Advanced Placement)', durYears: 2, type: 'pathway' },
  'welsh-bacc': { slug: 'welsh-bacc', faculty: 'Welsh Baccalaureate', durYears: 2, type: 'pathway' },
  // foundation
  'ufp': { slug: 'ufp', faculty: 'UFP (University Foundation)', durYears: 1, type: 'pathway' },
  'art-foundation': { slug: 'art-foundation', faculty: 'Foundation Diploma in Art & Design', durYears: 1, type: 'pathway' },
  'pre-master': { slug: 'pre-master', faculty: "Pre-Master's", durYears: 1, type: 'pathway' },
  'pre-mba': { slug: 'pre-mba', faculty: 'Pre-MBA', durYears: 1, type: 'pathway' },
  'international-foundation': { slug: 'ifp', faculty: 'International Foundation', durYears: 1, type: 'pathway' },
  'extended-foundation': { slug: 'extended-foundation', faculty: 'Extended Foundation', durYears: 1.5, type: 'pathway' },
};

// Pull the current JSON for a school, with the bits we want to preserve
const loadCurrent = (slug) => {
  const file = path.join(UNIS_DIR, `${slug}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
};

const writeUni = (slug, payload) => {
  const file = path.join(UNIS_DIR, `${slug}.json`);
  fs.writeFileSync(file, JSON.stringify(payload, null, 2) + '\n');
};

// Build expanded programs[] for a single school
const expandSchool = (slug, schoolData) => {
  const prefix = PREFIX[slug];
  if (!prefix) throw new Error(`No PREFIX for ${slug}`);

  const programs = [];
  const tuitionBy = {};
  const deadlines = {};

  for (const [category, items] of Object.entries(schoolData.programs)) {
    const level = LEVEL_MAP[category];
    if (!level) continue;

    for (const item of items) {
      const qualKey = item.qualification || item.level || item.type || null;
      const qualMeta = qualKey ? QUAL_LABEL[qualKey] : null;
      const qualSlug = qualMeta?.slug ?? slugify(qualKey ?? item.name).slice(0, 32);
      const faculty = qualMeta?.faculty ?? item.name;
      const durYears = qualMeta?.durYears
        ?? (typeof item.duration_years === 'number' ? item.duration_years : null)
        ?? parseDurationYears(item.duration);
      const programType = qualMeta?.type ?? 'pathway';

      const intakes = Array.isArray(item.intakes) ? item.intakes : [];
      const programUrl = item.source_url ?? null;
      const subjects = Array.isArray(item.subjects) ? item.subjects : null;

      if (subjects && subjects.length > 1) {
        for (const subject of subjects) {
          const subjectSlug = slugify(subject).slice(0, 50);
          if (!subjectSlug) continue;
          const programSlug = `${prefix}-${qualSlug}-${subjectSlug}`;
          programs.push({
            slug: programSlug,
            title: buildTitle(qualKey, qualMeta, subject),
            durationYears: durYears ?? 1,
            level,
            language: 'en',
            faculty,
            intakes: intakes.length ? intakes : ['September'],
            ...(programUrl ? { programUrl } : {}),
            programType,
          });
          if (item.tuition?.value != null) {
            tuitionBy[programSlug] = item.tuition.value;
          }
          deadlines[programSlug] = inferDeadline(intakes);
        }
      } else {
        const baseSlug = slugify(item.name).slice(0, 60);
        const programSlug = `${prefix}-${baseSlug}`.slice(0, 80);
        programs.push({
          slug: programSlug,
          title: item.name,
          durationYears: durYears ?? 1,
          level,
          language: 'en',
          faculty,
          intakes: intakes.length ? intakes : ['September'],
          ...(programUrl ? { programUrl } : {}),
          programType,
        });
        if (item.tuition?.value != null) {
          tuitionBy[programSlug] = item.tuition.value;
        }
        deadlines[programSlug] = inferDeadline(intakes);
      }
    }
  }

  const seen = new Set();
  const uniq = [];
  for (const p of programs) {
    if (seen.has(p.slug)) continue;
    seen.add(p.slug);
    uniq.push(p);
  }

  return { programs: uniq, tuitionBy, deadlines };
};

const buildTitle = (qualKey, qualMeta, subject) => {
  if (!qualKey) return subject;
  const labels = {
    'a-level': 'A-Level',
    'ib-diploma': 'IB Diploma',
    'us-high-school-diploma': 'US HS Diploma',
    'btec-l3': 'BTEC L3',
    'ap': 'AP',
    'welsh-bacc': 'Welsh Bacc',
    'gcse': 'GCSE',
    'igcse': 'IGCSE',
    'pre-gcse': 'Pre-GCSE',
    'year-7-9': 'Year 7-9',
    'us-middle-school': 'Grade 7-8',
    'us-high-school-9-10': 'Grade 9-10',
    'year-10-11': 'Grade 10-11',
    'ufp': 'UFP',
    'art-foundation': 'Art Foundation',
    'pre-master': "Pre-Master's",
    'international-foundation': 'IFP',
  };
  const prefix = labels[qualKey] ?? qualKey;
  return `${prefix} ${subject}`;
};

const parseDurationYears = (s) => {
  if (!s) return null;
  const m = String(s).match(/(\d+(?:\.\d+)?)\s*year/i);
  if (m) return Number(m[1]);
  const t = String(s).match(/(\d+)\s*term/i);
  if (t) return Number(t[1]) / 3;
  return null;
};

const inferDeadline = (intakes) => {
  if (!intakes || !intakes.length) return '2026-08-01';
  const lowered = intakes.join(',').toLowerCase();
  if (lowered.includes('june') || lowered.includes('july')) return '2026-05-01';
  if (lowered.includes('august')) return '2026-06-01';
  if (lowered.includes('january')) return '2026-08-01';
  if (lowered.includes('flexible') || lowered.includes('mondays')) return '2026-08-01';
  return '2026-08-01';
};

const getCurrency = (slug) => {
  const cur = loadCurrent(slug)?.tuition?.currency;
  return cur ?? 'GBP';
};

const summary = [];
for (const [slug, schoolData] of Object.entries(collected)) {
  if (slug.startsWith('_')) continue;
  if (SKIP.has(slug)) {
    const cur = loadCurrent(slug);
    summary.push(`SKIP ${slug} (already granular: ${cur?.programs?.length ?? '?'} programs)`);
    continue;
  }

  const current = loadCurrent(slug);
  if (!current) {
    summary.push(`MISS ${slug} (no existing JSON)`);
    continue;
  }

  const { programs, tuitionBy, deadlines } = expandSchool(slug, schoolData);
  if (programs.length === 0) {
    summary.push(`EMPTY ${slug} (0 programs after expansion — skipped)`);
    continue;
  }

  const updated = {
    ...current,
    programs,
    tuition: {
      currency: getCurrency(slug),
      byProgram: tuitionBy,
    },
    deadlines,
  };

  writeUni(slug, updated);
  summary.push(`OK ${slug}: ${current.programs.length} → ${programs.length} programs`);
}

console.log(summary.join('\n'));
