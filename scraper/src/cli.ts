// CLI: npm run scrape -- --slug glasgow
//      npm run scrape -- --all
//
// Pipeline (v2 — full Kaplan database):
//   1. Fetch the global Kaplan degree-finder feed once (~6 MB JSON embedded in any page).
//      Gives us institutions[], degrees[] (~4800 entries), preparation_courses[].
//   2. For each registered uni:
//      a. Fetch the main uni page (description, hero, source hash, fees URL).
//      b. Fetch the fees-and-dates page (pathway-level summaries: Foundation/PMP per faculty).
//      c. Filter the global degrees[] by university institution_id -> per-uni real degrees
//         (Bachelor/Master/PhD, with exact tuition + duration + intake + program URL).
//      d. Combine into a single programs[] array on the University record.
//   3. Validate with Zod. Write site/src/content/universities/{slug}.json (full replace).

import { writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { universitySchema, type University, type Program } from './schema.ts';
import { readRegistry, type RegistryRow } from './registry.ts';
import { scrapeKaplanUni, type KaplanScrapeResult } from './sources/kaplan.ts';
import { fetchKaplanFees, facultySlug, type KaplanProgram } from './sources/kaplan-fees.ts';
import {
  fetchKaplanFeed,
  buildAwardFacultyMap,
  inferDegreeFaculty,
  mapDegreeLevel,
  parseDuration,
  parseIntakes,
  type KaplanFeed,
  type KaplanDegree,
  type KaplanInstitution,
} from './sources/kaplan-feed.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG_DIR = resolve(__dirname, '../../site/src/content/universities');

interface CliArgs {
  slug: string | null;
  all: boolean;
  dryRun: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  let slug: string | null = null;
  let all = false;
  let dryRun = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--slug') slug = argv[++i] ?? null;
    else if (arg === '--all') all = true;
    else if (arg === '--dry-run') dryRun = true;
  }
  return { slug, all, dryRun };
}

const INTAKE_TO_DEADLINE: Record<string, string> = {
  Autumn: '2026-08-01',
  September: '2026-08-01',
  Spring: '2026-12-01',
  Summer: '2027-04-01',
  January: '2026-11-15',
};

const STANDARD_REQUIREMENTS = {
  language: { ielts: 5.5, toefl: 70 },
  exams: [] as string[],
};

function pathwaySlugFor(p: KaplanProgram): string {
  const prefix = p.level === 'foundation' ? 'fc' : 'pmp';
  return prefix + '-' + facultySlug(p.faculty);
}

function pathwayTitleFor(p: KaplanProgram): string {
  const levelLabel = p.level === 'foundation' ? 'Foundation Certificate' : "Pre-Master's";
  return levelLabel + ' — ' + p.faculty;
}

function degreeSlugFor(d: KaplanDegree, level: string): string {
  // program_id is unique within Kaplan's feed and stable across runs.
  return level + '-' + d.program_id;
}

function pickDeadline(intakes: string[]): string {
  for (const i of intakes) {
    const d = INTAKE_TO_DEADLINE[i];
    if (d) return d;
  }
  return '2026-09-01';
}

// Manual overrides for slugs whose registry name doesn't fuzzy-match the feed name
// (e.g. "UWE Bristol" abbreviation vs. "University of the West of England, Bristol").
const REGISTRY_TO_FEED_ID: Record<string, number> = {
  'uwe-bristol': 19,
};

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’'`]/g, '')
    .replace(/[,.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Match a registry row to its Kaplan institution_id.
function matchUniversity(row: RegistryRow, institutions: KaplanInstitution[]): KaplanInstitution | null {
  const overrideId = REGISTRY_TO_FEED_ID[row.slug];
  if (overrideId) {
    const direct = institutions.find((i) => i.id === overrideId);
    if (direct) return direct;
  }

  const targetTokens = normalizeForMatch(row.name)
    .replace(/\buniversity of\b/g, '')
    .replace(/\buniversity\b/g, '')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);

  // Universities first (the actual degree-granting bodies).
  const universities = institutions.filter((i) => i.institution_type_code === 'university');
  for (const inst of universities) {
    const name = normalizeForMatch(inst.institution_name);
    if (targetTokens.every((tok) => name.includes(tok))) return inst;
  }
  for (const inst of institutions) {
    const name = normalizeForMatch(inst.institution_name);
    if (targetTokens.every((tok) => name.includes(tok))) return inst;
  }
  return null;
}

interface BuiltPrograms {
  programs: Program[];
  byProgramTuition: Record<string, number>;
  deadlines: Record<string, string>;
}

function buildPathwayPrograms(pathways: KaplanProgram[]): BuiltPrograms {
  const seen = new Map<string, KaplanProgram>();
  for (const p of pathways) {
    const slug = pathwaySlugFor(p);
    const existing = seen.get(slug);
    if (!existing) {
      seen.set(slug, p);
      continue;
    }
    seen.set(slug, {
      ...existing,
      tuitionMin: Math.min(existing.tuitionMin, p.tuitionMin),
      intakes: Array.from(new Set([...existing.intakes, ...p.intakes])),
    });
  }

  const programs: Program[] = [];
  const byProgramTuition: Record<string, number> = {};
  const deadlines: Record<string, string> = {};

  for (const [slug, p] of seen) {
    programs.push({
      slug,
      title: pathwayTitleFor(p),
      durationYears: 1,
      level: p.level,
      language: 'en',
      faculty: p.faculty,
      intakes: p.intakes,
      programType: 'pathway',
    });
    byProgramTuition[slug] = p.tuitionMin;
    deadlines[slug] = pickDeadline(p.intakes);
  }

  return { programs, byProgramTuition, deadlines };
}

function buildDegreePrograms(
  degrees: KaplanDegree[],
  awardFacultyMap: Map<number, string>,
): BuiltPrograms {
  const programs: Program[] = [];
  const byProgramTuition: Record<string, number> = {};
  const deadlines: Record<string, string> = {};

  for (const d of degrees) {
    const level = mapDegreeLevel(d);
    const slug = degreeSlugFor(d, level);
    const fee = Number.parseFloat(d.current_fees_per_year);
    const intakes = parseIntakes(d.degree_intake_dates);
    const faculty = inferDegreeFaculty(d, awardFacultyMap) ?? 'Прочее';

    const program: Program = {
      slug,
      title: d.program_name,
      durationYears: parseDuration(d.degree_duration),
      level,
      language: 'en',
      faculty,
      intakes: intakes.length > 0 ? intakes : undefined,
      programType: 'degree',
    };
    if (d.program_url && /^https?:\/\//.test(d.program_url)) {
      program.programUrl = d.program_url;
    }

    programs.push(program);
    byProgramTuition[slug] = Number.isFinite(fee) && fee > 0 ? fee : 0;
    deadlines[slug] = pickDeadline(intakes);
  }

  return { programs, byProgramTuition, deadlines };
}

function buildUniversity(
  row: RegistryRow,
  main: KaplanScrapeResult,
  pathwayPrograms: BuiltPrograms,
  degreePrograms: BuiltPrograms,
): University {
  const allPrograms = [...pathwayPrograms.programs, ...degreePrograms.programs];
  const allTuition = { ...pathwayPrograms.byProgramTuition, ...degreePrograms.byProgramTuition };
  const allDeadlines = { ...pathwayPrograms.deadlines, ...degreePrograms.deadlines };

  if (allPrograms.length === 0) {
    const placeholderSlug = 'kaplan-pathway';
    allPrograms.push({
      slug: placeholderSlug,
      title: 'Kaplan pathway (см. сайт партнёра — программы не распознаны)',
      durationYears: 1,
      level: 'foundation',
      language: 'en',
      faculty: 'Прочее',
      intakes: ['Autumn'],
      programType: 'pathway',
    });
    allTuition[placeholderSlug] = 0;
    allDeadlines[placeholderSlug] = '2026-09-01';
  }

  return {
    slug: row.slug,
    name: row.name,
    country: row.country,
    city: row.city,
    programs: allPrograms,
    tuition: { currency: 'GBP', byProgram: allTuition },
    deadlines: allDeadlines,
    requirements: STANDARD_REQUIREMENTS,
    scholarships: [],
    lastChecked: main.fetchedAt,
    sourceUrl: main.sourceUrl,
    sourceHash: main.sourceHash,
    confidence: row.tier,
    language: 'en',
  };
}

async function processOne(
  row: RegistryRow,
  feed: KaplanFeed,
  awardFacultyMap: Map<number, string>,
  dryRun: boolean,
): Promise<void> {
  const target = row.aggregatorUrls[0] ?? row.officialUrl;
  if (!target) {
    console.warn('[skip] ' + row.slug + ': no scrape URL in registry');
    return;
  }

  console.log('[main]  ' + row.slug + ' <- ' + target);
  const main = await scrapeKaplanUni(target);

  // Pathway data from fees-and-dates (Foundation/PMP per-faculty summaries).
  let pathways: KaplanProgram[] = [];
  if (main.feesUrl) {
    try {
      const feesResult = await fetchKaplanFees(main.feesUrl);
      pathways = feesResult.programs;
      console.log('[fees]  ' + row.slug + ' · ' + pathways.length + ' pathway entries');
    } catch (err) {
      console.warn('[warn]  ' + row.slug + ' fees fetch failed: ' + (err as Error).message);
    }
  }

  // Real degrees from the global feed, filtered by institution_id.
  const inst = matchUniversity(row, feed.institutions);
  let degrees: KaplanDegree[] = [];
  if (inst) {
    degrees = feed.degrees.filter((deg) => deg.university_block?.institution_id === inst.id);
    console.log('[feed]  ' + row.slug + ' · ' + degrees.length + ' degrees (institution_id=' + inst.id + ')');
  } else {
    console.warn('[warn]  ' + row.slug + ' not found in feed institutions[]');
  }

  const pathwayPrograms = buildPathwayPrograms(pathways);
  const degreePrograms = buildDegreePrograms(degrees, awardFacultyMap);
  const built = buildUniversity(row, main, pathwayPrograms, degreePrograms);

  const validated = universitySchema.parse(built);
  const out = JSON.stringify(validated, null, 2) + '\n';

  if (dryRun) {
    console.log('[dry]   ' + row.slug + '.json (' + out.length + ' bytes, ' + validated.programs.length + ' programs)');
    return;
  }

  await writeFile(resolve(CATALOG_DIR, row.slug + '.json'), out, 'utf8');
  console.log('[ok]    ' + row.slug + '.json · ' + validated.programs.length + ' programs (' +
    pathwayPrograms.programs.length + ' pathway + ' + degreePrograms.programs.length + ' degree)');
}

async function main(): Promise<void> {
  const { slug, all, dryRun } = parseArgs(process.argv.slice(2));

  if (!slug && !all) {
    console.error('Usage: npm run scrape -- (--slug <slug> | --all) [--dry-run]');
    process.exit(2);
  }

  console.log('[init]  fetching Kaplan global feed...');
  const feed = await fetchKaplanFeed();
  console.log('[init]  feed loaded: ' + feed.institutions.length + ' institutions, ' +
    feed.degrees.length + ' degrees, ' + feed.preparationCourses.length + ' colleges');

  const awardFacultyMap = buildAwardFacultyMap(feed);
  console.log('[init]  built award->faculty map: ' + awardFacultyMap.size + ' awards mapped');

  const registry = await readRegistry();
  const targets = all ? registry : registry.filter((r) => r.slug === slug);

  if (targets.length === 0) {
    console.error('No matching universities for slug=' + slug);
    process.exit(1);
  }

  let ok = 0;
  let failed = 0;
  for (const row of targets) {
    try {
      await processOne(row, feed, awardFacultyMap, dryRun);
      ok += 1;
    } catch (err) {
      failed += 1;
      console.error('[fail] ' + row.slug + ': ' + (err as Error).message);
    }
  }

  console.log('\nDone: ' + ok + ' ok, ' + failed + ' failed, ' + targets.length + ' total.');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
