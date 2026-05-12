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
import {
  universitySchema,
  type University,
  type Program,
  type GalleryItem,
  type AccommodationItem,
  type CampusItem,
  type Description,
} from './schema.ts';
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
import { scrapeKaplanAccommodation, type KaplanAccommodationResult } from './sources/kaplan-accommodation.ts';
import { getCampusFacts, type CampusFact } from './sources/campus-facts.ts';
import { getUniAccommodationFacts } from './sources/uni-accommodation-facts.ts';
import { getDescriptionTranslation } from './sources/description-translations.ts';
import { BASELINE_KAPLAN_SCHOLARSHIPS, getUniScholarships, type ScholarshipFact } from './sources/uni-scholarships.ts';
import { classifyFaculty } from './sources/program-faculty-classifier.ts';

// Unis where the Kaplan global award-faculty map returns "Прочее" for every
// program and we need to reclassify by program-title pattern. UK and Canada
// (except Victoria) are covered by Kaplan's feed; USA partially; AU/NZ not at
// all (those have only 1 placeholder program each, so the classifier is moot).
const NEEDS_LOCAL_FACULTY_CLASSIFIER = new Set([
  'victoria',
  'arizona-state',
  'pace',
  'simmons',
  'uconn',
  'oregon',
]);

// Dynamic import of the JS-only photo downloader (no .d.ts; declared inline).
interface PhotoDownloader {
  fetchAndSaveGallery(
    row: RegistryRow,
    opts?: { force?: boolean }
  ): Promise<{ slug: string; items: GalleryItem[]; skipped?: string }>;
}
let photoModule: PhotoDownloader | null = null;
async function loadPhotoModule(): Promise<PhotoDownloader> {
  if (photoModule) return photoModule;
  photoModule = (await import('../download-photos.mjs')) as unknown as PhotoDownloader;
  return photoModule;
}

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

// Hand-curated Kaplan Living card photo per slug, used when the auto-scraped
// Kaplan accommodation-page photo isn't representative (e.g. kitchen shot
// instead of a bedroom). Local paths under site/public/photos/. Empty entries
// fall through to the scraped photoUrl.
const KAPLAN_LIVING_IMG_OVERRIDE: Record<string, string> = {
  glasgow: '/photos/glasgow/accommodation-cards/kaplan-living.jpg',
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
    tuition: { currency: currencyForCountry(row.country), byProgram: allTuition },
    deadlines: allDeadlines,
    requirements: STANDARD_REQUIREMENTS,
    scholarships: buildScholarships(row.slug),
    lastChecked: main.fetchedAt,
    sourceUrl: main.sourceUrl,
    sourceHash: main.sourceHash,
    confidence: row.tier,
    language: 'en',
  };
}

// Tuition currency by country. Kaplan's degree-finder feed reports
// `current_fees_per_year` in the destination country's local currency, so we
// match the country here. Falls back to GBP for unknown countries to keep
// existing UK behaviour.
function currencyForCountry(country: string): 'GBP' | 'CAD' | 'USD' | 'AUD' | 'EUR' | 'NZD' {
  const c = country.toLowerCase();
  if (c.includes('canada')) return 'CAD';
  if (c.includes('united states') || c === 'usa') return 'USD';
  if (c.includes('australia')) return 'AUD';
  if (c.includes('new zealand') || c === 'nz') return 'NZD';
  if (c.includes('united kingdom') || c === 'uk') return 'GBP';
  return 'GBP';
}

// Build the accommodation array: Kaplan Living first (real fee scraped from
// kaplanpathways.com), then 1-2 official-uni halls from the curated
// uni-accommodation-facts module (real fees from gla.ac.uk, bristol.ac.uk,
// etc.). All entries carry real prices — no TBD placeholders.
// `photoCount` controls the photo fallback — when the assigned index exceeds
// the number of photos actually saved on disk (e.g. Canadian partner pages
// only have 5-7 building photos after filtering people-shots), we omit `img`
// so the page renders the logo placeholder instead of a broken-image icon.
function buildAccommodation(
  result: KaplanAccommodationResult,
  slug: string,
  uniName: string,
  photoCount: number,
): AccommodationItem[] {
  const items: AccommodationItem[] = [];

  if (result.priceFrom && result.priceCurrency === 'GBP') {
    const features = result.features.length > 0
      ? result.features.slice(0, 3).join(' · ')
      : 'Партнёрское жильё Kaplan Living — приватная спальня и ванная, общая или собственная кухня, безопасный въезд и социальные пространства.';
    const contractNote = result.contractNote ? `Контракт: ${result.contractNote}.` : '';
    const text = `Официальная партнёрская резиденция при колледже Kaplan для ${uniName}. ${features}${contractNote ? ` ${contractNote}` : ''}`.trim();
    // Per-slug override for the Kaplan Living card photo. Kaplan partner-page
    // photo discovery picks a kitchen/lounge shot; for some unis we want a
    // bedroom or specific room shot pulled from kaplanliving.com instead.
    const kaplanLivingImg = KAPLAN_LIVING_IMG_OVERRIDE[slug] ?? result.photoUrl ?? undefined;
    items.push({
      name: result.residence ?? `Kaplan Living — ${uniName}`,
      price: `от £${result.priceFrom.toLocaleString('en-GB')}`,
      text,
      ...(kaplanLivingImg ? { img: kaplanLivingImg } : {}),
    });
  }

  // Layer in real official-uni halls from the curated dictionary. These come
  // from each uni's own accommodation page (verified 2026-05-11 via Exa).
  // Photo assignment: prefer a curated img URL from the fact if present;
  // otherwise fall back to a cycling per-uni gallery photo (`/photos/{slug}/N.jpg`,
  // using indices 6-9 to avoid the hero's photos 1-2 and gallery's 1-3).
  // Accommodation cards use the LAST available photos (descending from
  // photoCount), capped at index ≥ 6 so we never reuse a gallery photo (3-5)
  // or hero photo (1-2). Examples: 10 photos → 10, 9, 8; 8 photos → 8, 7, 6;
  // 7 photos → 7, 6, (logo); 6 photos → 6, (logo), (logo); ≤5 → all logos.
  // The "last" photos are the lowest-scoring buildings/interiors in the saved
  // set — exactly the right content for accommodation cards.
  const facts = getUniAccommodationFacts(slug);
  facts.forEach((f, i) => {
    const accIdx = photoCount - i;
    const fallbackImg = accIdx >= 6 ? `/photos/${slug}/${accIdx}.jpg` : undefined;
    const img = f.img ?? fallbackImg;
    items.push({ name: f.name, price: f.price, text: f.text, ...(img ? { img } : {}) });
  });

  // Fallback only if we have nothing at all: a single TBD card so the section
  // doesn't disappear.
  if (items.length === 0) {
    items.push({
      name: `En-suite комната в студенческом общежитии (${uniName})`,
      price: '[TBD: £/нед]',
      text: `Одноместная комната с собственной ванной, общая кухня на 4–8 человек. Партнёрское жильё рядом с кампусом ${uniName}.`,
    });
  }
  return items;
}

// Build the scholarship list for a uni. Every uni gets the universal Kaplan
// scholarships (Early Bird + Academic Achievement) plus any uni-specific
// entries hand-curated in `sources/uni-scholarships.ts`. Each entry carries
// both EN + RU names + descriptions; the page picks Russian when present.
type Scholarship = NonNullable<University['scholarships']>[number];
function buildScholarships(slug: string): Scholarship[] {
  const all: ScholarshipFact[] = [...BASELINE_KAPLAN_SCHOLARSHIPS, ...getUniScholarships(slug)];
  return all.map((s): Scholarship => {
    const out: Scholarship = { name: s.name };
    if (s.nameRu) out.nameRu = s.nameRu;
    if (s.amount) out.amount = s.amount;
    if (s.description) out.description = s.description;
    if (s.descriptionRu) out.descriptionRu = s.descriptionRu;
    if (s.url) out.url = s.url;
    return out;
  });
}

// Build the per-uni biography from what `scrapeKaplanUni` already extracted +
// hand-curated Russian translations from `sources/description-translations.ts`.
// Returns `undefined` when the page yielded nothing usable so the field stays
// absent on the University record (the page template already falls back to a
// generic auto-generated paragraph in that case).
function buildDescription(main: KaplanScrapeResult, slug: string): Description | undefined {
  const paragraphs = main.descriptionParagraphs ?? [];
  const keyFacts = main.keyFacts ?? [];
  if (paragraphs.length === 0 && keyFacts.length === 0) return undefined;
  const translation = getDescriptionTranslation(slug);
  const result: Description = { paragraphs, keyFacts };
  if (translation.paragraphsRu?.length) result.paragraphsRu = translation.paragraphsRu;
  if (translation.keyFactsRu?.length) result.keyFactsRu = translation.keyFactsRu;
  return result;
}

function buildCampuses(slug: string, photoCount: number): CampusItem[] {
  // Photos cycle through `/photos/{slug}/N.jpg` (N = 6..9) so the first 4
  // campuses each get a distinct photo from the per-uni gallery, while
  // avoiding photos 1-2 (hero) and 3-5 (gallery section right below hero).
  // When the assigned index exceeds available photos (e.g. only 6 saved
  // after filtering people-shots), we omit `img` so the page renders the
  // `.placeholder-img` block with the uni logo instead.
  const facts: CampusFact[] = getCampusFacts(slug);
  return facts.map((f, i) => {
    const item: CampusItem = { title: f.title, sub: f.sub, text: f.text };
    // Prefer a curated img URL from the fact (set per-uni in campus-facts.ts
    // for unis that have specific campus photos available); fall back to a
    // cycling gallery photo when not.
    if (f.img) {
      item.img = f.img;
    } else {
      const photoIdx = (i % 4) + 6;
      if (photoIdx <= photoCount) item.img = `/photos/${slug}/${photoIdx}.jpg`;
    }
    return item;
  });
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

  // Per-uni faculty override. Kaplan's global award-faculty map doesn't cover
  // some unis (Victoria, all 5 US partners), so every program ends up in
  // "Прочее" by default and the per-faculty modal collapses to a single
  // bucket. For listed unis, reclassify by program-title pattern so the page
  // shows real faculty groupings.
  if (NEEDS_LOCAL_FACULTY_CLASSIFIER.has(row.slug)) {
    degreePrograms.programs = degreePrograms.programs.map((p) => ({
      ...p,
      faculty: classifyFaculty(p.title),
    }));
  }

  const built = buildUniversity(row, main, pathwayPrograms, degreePrograms);

  const validated = universitySchema.parse(built);

  // Refresh per-uni gallery photos from Kaplan partner page. Failures are logged
  // but never break the scrape — the gallery field stays optional in the schema.
  if (!dryRun) {
    try {
      const photos = await loadPhotoModule();
      const result = await photos.fetchAndSaveGallery(row);
      if (result.items.length > 0) {
        validated.gallery = { items: result.items };
        console.log('[photo] ' + row.slug + ' · ' + result.items.length + ' images');
      } else if (result.skipped) {
        console.warn('[photo] ' + row.slug + ' skipped: ' + result.skipped);
      }
    } catch (err) {
      console.warn('[warn]  ' + row.slug + ' photo fetch failed: ' + (err as Error).message);
    }
  }

  // Accommodation — real Kaplan starting fee + features + photo when available,
  // plus generic non-Kaplan alternatives so students see options to compare.
  let accommodationResult: KaplanAccommodationResult | null = null;
  try {
    accommodationResult = await scrapeKaplanAccommodation(target);
    if (accommodationResult.priceFrom) {
      console.log(
        '[acc]   ' + row.slug + ' · £' + accommodationResult.priceFrom.toLocaleString('en-GB') +
        (accommodationResult.residence ? ' (' + accommodationResult.residence + ')' : ''),
      );
    } else if (accommodationResult.accommodationUrl) {
      console.warn('[acc]   ' + row.slug + ' · page found but no price parsed (' + accommodationResult.accommodationUrl + ')');
    } else {
      console.warn('[acc]   ' + row.slug + ' · no Kaplan accommodation page linked from partner page');
    }
  } catch (err) {
    console.warn('[warn]  ' + row.slug + ' accommodation fetch failed: ' + (err as Error).message);
  }
  const photoCount = validated.gallery?.items?.length ?? 0;
  validated.accommodation = buildAccommodation(
    accommodationResult ?? {
      accommodationUrl: null,
      residence: null,
      priceLabel: null,
      priceFrom: null,
      priceCurrency: null,
      contractNote: null,
      features: [],
      photoUrl: null,
    },
    row.slug,
    row.name,
    photoCount,
  );

  // Campuses — curated facts per uni slug (Kaplan does not publish a structured
  // per-campus dataset; the truth lives in `sources/campus-facts.ts`).
  const campusItems = buildCampuses(row.slug, photoCount);
  if (campusItems.length > 0) {
    validated.campuses = campusItems;
    console.log('[camp]  ' + row.slug + ' · ' + campusItems.length + ' campus entries');
  }

  // Description — Kaplan partner page "About this university" paragraphs +
  // facts (scraped earlier in `scrapeKaplanUni`), merged with hand-curated
  // Russian translations from `sources/description-translations.ts`.
  const description = buildDescription(main, row.slug);
  if (description) {
    validated.description = description;
    const ruParas = description.paragraphsRu?.length ?? 0;
    const ruFacts = description.keyFactsRu?.length ?? 0;
    console.log('[desc]  ' + row.slug + ' · ' + description.paragraphs.length + ' paragraphs (+' +
      ruParas + ' ru), ' + description.keyFacts.length + ' facts (+' + ruFacts + ' ru)');
  }

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
