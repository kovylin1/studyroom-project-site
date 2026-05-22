// Shared Navitas seeder helpers. Used by per-country seed-navitas-{xx}.mjs.

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const CONTENT_DIR = resolve(__dirname, '../../site/src/content/universities');

export const TODAY = new Date().toISOString();
export const NEXT_YEAR = new Date().getUTCFullYear() + 1;

export const NAVITAS_BURSARY_AUD = {
  name: 'Navitas Loyalty Bursary',
  nameRu: 'Navitas Loyalty Bursary',
  amount: 'до AU$2,000',
  description: 'Discount on first-trimester fees for students progressing from a Navitas pathway college to the partner university.',
  descriptionRu: 'Скидка на оплату первого триместра для студентов, переходящих из pathway-колледжа Navitas в партнёрский университет.',
  url: 'https://www.navitas.com/study/scholarships/',
};

export const NAVITAS_BURSARY_GBP = {
  name: 'Navitas Loyalty Bursary',
  nameRu: 'Navitas Loyalty Bursary',
  amount: 'до £1,500',
  description: 'Discount on first-term fees for students progressing from a Navitas pathway college to the partner university.',
  descriptionRu: 'Скидка на оплату первого триместра для студентов, переходящих из pathway-колледжа Navitas в партнёрский университет.',
  url: 'https://www.navitas.com/study/scholarships/',
};

export const NAVITAS_BURSARY_EUR = {
  name: 'Navitas Loyalty Bursary',
  nameRu: 'Navitas Loyalty Bursary',
  amount: 'до €1,500',
  description: 'Discount on first-semester fees for students progressing from a Navitas pathway college to the partner university.',
  descriptionRu: 'Скидка на оплату первого семестра для студентов, переходящих из pathway-колледжа Navitas в партнёрский университет.',
  url: 'https://www.navitas.com/study/scholarships/',
};

export const NAVITAS_BURSARY_USD = {
  name: 'Navitas Loyalty Bursary',
  nameRu: 'Navitas Loyalty Bursary',
  amount: 'до US$2,500',
  description: 'Discount on first-semester fees for students progressing from a Navitas pathway college to the partner university.',
  descriptionRu: 'Скидка на оплату первого семестра для студентов, переходящих из pathway-колледжа Navitas в партнёрский университет.',
  url: 'https://www.navitas.com/study/scholarships/',
};

export const NAVITAS_BURSARY_NZD = {
  name: 'Navitas Loyalty Bursary',
  nameRu: 'Navitas Loyalty Bursary',
  amount: 'до NZ$2,000',
  description: 'Discount on first-trimester fees for students progressing from a Navitas pathway college to the partner university.',
  descriptionRu: 'Скидка на оплату первого триместра для студентов, переходящих из pathway-колледжа Navitas в партнёрский университет.',
  url: 'https://www.navitas.com/study/scholarships/',
};

export function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['‘’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function isoIntake(month, day = 1) {
  return `${NEXT_YEAR}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00.000Z`;
}

function buildProgramsForFacultyGroup(uni, group, programType, defaultIntakes) {
  const out = [];
  for (const [faculty, programs] of Object.entries(group)) {
    for (const [title, level, durationYears, feeBandKey, intakes] of programs) {
      const slug = `${uni.slug}-${slugify(title).slice(0, 70)}`;
      out.push({
        slug,
        title,
        level,
        durationYears,
        faculty,
        feeBandKey: feeBandKey || level,
        intakes: intakes || defaultIntakes,
        programType,
      });
    }
  }
  return out;
}

function buildPrograms(uni, defaultIntakes) {
  const all = [
    ...buildProgramsForFacultyGroup(uni, uni.pathwayPrograms ?? {}, 'pathway', defaultIntakes),
    ...buildProgramsForFacultyGroup(uni, uni.bachelorPrograms ?? {}, 'degree', defaultIntakes),
    ...buildProgramsForFacultyGroup(uni, uni.masterPrograms ?? {}, 'degree', defaultIntakes),
  ];
  const seen = new Set();
  return all.filter((p) => {
    if (seen.has(p.slug)) return false;
    seen.add(p.slug);
    return true;
  });
}

export function buildUniversity(uni, opts) {
  const { country, currency, primaryIntake, secondaryIntake, defaultIntakes, scholarship } = opts;
  const programs = buildPrograms(uni, defaultIntakes);
  const tuitionByProgram = {};
  const deadlines = {};
  for (const p of programs) {
    const fee = uni.feeBand[p.feeBandKey] ?? uni.feeBand[p.level] ?? 0;
    tuitionByProgram[p.slug] = fee;
    deadlines[p.slug] = p.level === 'master' ? secondaryIntake : primaryIntake;
  }
  const scholarships = [scholarship, ...(uni.extraScholarships ?? [])];
  const sourceHash = `sha256:${createHash('sha256').update(`navitas-${uni.slug}-${TODAY.slice(0, 10)}`).digest('hex').slice(0, 16)}`;
  return {
    slug: uni.slug,
    name: uni.name,
    country,
    city: uni.city,
    programs: programs.map((p) => ({
      slug: p.slug,
      title: p.title,
      durationYears: p.durationYears,
      level: p.level,
      language: 'en',
      faculty: p.faculty,
      intakes: p.intakes,
      programUrl: p.programType === 'pathway' ? uni.coursesUrl : uni.officialUrl,
      programType: p.programType,
    })),
    tuition: { currency, byProgram: tuitionByProgram },
    deadlines,
    requirements: {
      language: { ielts: uni.ielts },
      exams: ['IELTS Academic'],
    },
    scholarships,
    accommodation: uni.accommodation,
    campuses: uni.campuses,
    description: {
      paragraphs: uni.paragraphs,
      paragraphsRu: uni.paragraphsRu,
      keyFacts: uni.keyFacts,
      keyFactsRu: uni.keyFactsRu,
    },
    lastChecked: TODAY,
    sourceUrl: uni.navitasUrl,
    sourceHash,
    confidence: 'aggregator',
    language: 'ru',
  };
}

// Fields that may have been added by other pipelines (photo discovery,
// translations) and must NOT be wiped by the seeder. If the existing JSON
// on disk has any of these populated, we merge them onto the freshly-built
// university object before writing.
const PRESERVE_FIELDS = ['gallery', 'photoSets'];

export async function writeAll(unis, opts) {
  await mkdir(CONTENT_DIR, { recursive: true });
  let totalPrograms = 0;
  for (const uni of unis) {
    const university = buildUniversity(uni, opts);
    const filePath = resolve(CONTENT_DIR, `${uni.slug}.json`);

    // Read existing JSON (if any) and copy over preserved fields so other
    // pipelines (photo discovery, manual edits) don't get clobbered.
    try {
      const existingRaw = await readFile(filePath, 'utf8');
      const existing = JSON.parse(existingRaw);
      for (const key of PRESERVE_FIELDS) {
        if (existing[key] != null && university[key] == null) {
          university[key] = existing[key];
        }
      }
    } catch {
      // file didn't exist or couldn't parse — skip merge, write fresh
    }

    await writeFile(filePath, JSON.stringify(university, null, 2) + '\n', 'utf8');
    totalPrograms += university.programs.length;
    console.log(`[seed] wrote ${uni.slug}.json (${university.programs.length} programs)`);
  }
  console.log(`[seed] done · ${unis.length} universities · ${totalPrograms} programs total`);
}
