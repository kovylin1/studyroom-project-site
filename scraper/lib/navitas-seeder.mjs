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

/**
 * Откуда у сидера цены. По умолчанию — из литеральной таблицы `feeBand` в самом
 * скрипте: это НЕ данные источника, а придуманные полосы, одинаковые всем вузам.
 * Такие цены в каталог не попадают (правило «не выдумывать»): программа пишется
 * без цены и страница вуза честно показывает «уточняется».
 *
 * Значение 'source-confirmed' ставит тот, кто сверил полосы с прайсом источника, —
 * только тогда сидер раздаёт цены. Разбор 2026-08-03: Navitas реальных цен не отдаёт
 * (замер `kompas-navitas-fees-diag.mjs`), поэтому у него остаётся 'seed-literal'.
 */
export const FEE_PROVENANCE = ['seed-literal', 'source-confirmed'];

export function buildUniversity(uni, opts) {
  const { country, currency, primaryIntake, secondaryIntake, defaultIntakes, scholarship } = opts;
  const feeProvenance = opts.feeProvenance ?? 'seed-literal';
  if (!FEE_PROVENANCE.includes(feeProvenance)) {
    throw new Error(`buildUniversity: неизвестный feeProvenance «${feeProvenance}»`);
  }
  const programs = buildPrograms(uni, defaultIntakes);
  const tuitionByProgram = {};
  const deadlines = {};
  for (const p of programs) {
    if (feeProvenance === 'source-confirmed') {
      const fee = uni.feeBand[p.feeBandKey] ?? uni.feeBand[p.level] ?? 0;
      tuitionByProgram[p.slug] = fee;
    }
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

/**
 * Решение по одной карточке: писать её или отойти в сторону.
 *
 * Сидер собирает карточку с нуля и затирает `programs` и `tuition` целиком, а поверх
 * его сида давно легли выгрузки партнёров. У 10 британских Navitas-вузов это 3208
 * программ и 2774 цены Edvoy против ~60 программ сида — повторный прогон стёр бы их
 * подчистую. Поэтому: карточка, где программ больше, чем у сида, не перезаписывается,
 * пока не позовут явно (`force`). Цены существующих программ переносятся в любом случае.
 *
 * Отдельная функция, а не ветка внутри цикла, чтобы решение можно было проверить тестом
 * без записи на диск.
 */
export function planWrite(built, existing, { force = false } = {}) {
  if (!existing) return { action: 'write', reason: 'новая карточка', university: built };

  const university = { ...built };
  for (const key of PRESERVE_FIELDS) {
    if (existing[key] != null && university[key] == null) university[key] = existing[key];
  }

  // Настоящие цены (выгрузки партнёров, решения оператора) переносим на те программы,
  // которые в сборке остались. Сид своих цен не даёт — затирать нечем и незачем.
  const existingFees = existing.tuition?.byProgram;
  if (existingFees && typeof existingFees === 'object' && !Array.isArray(existingFees)) {
    const carried = {};
    for (const p of university.programs) {
      const fee = existingFees[p.slug];
      if (Number(fee) > 0) carried[p.slug] = fee;
    }
    university.tuition = { ...university.tuition, byProgram: { ...carried, ...university.tuition.byProgram } };
  }

  const existingCount = (existing.programs || []).length;
  const builtCount = university.programs.length;
  if (existingCount > builtCount && !force) {
    return {
      action: 'skip',
      reason: `в каталоге ${existingCount} программ, у сида ${builtCount} — перезапись потеряла бы ${existingCount - builtCount}. Нужен --force`,
      university,
    };
  }
  return { action: 'write', reason: force ? 'force' : 'сид не беднее каталога', university };
}

export async function writeAll(unis, opts) {
  const force = opts.force ?? process.argv.includes('--force');
  const dryRun = opts.dryRun ?? process.argv.includes('--dry-run');
  await mkdir(CONTENT_DIR, { recursive: true });
  let totalPrograms = 0, written = 0, skipped = 0;
  for (const uni of unis) {
    const built = buildUniversity(uni, opts);
    const filePath = resolve(CONTENT_DIR, `${uni.slug}.json`);

    let existing = null;
    try { existing = JSON.parse(await readFile(filePath, 'utf8')); } catch { /* нет файла или битый — пишем свежий */ }

    const plan = planWrite(built, existing, { force });
    if (plan.action === 'skip') {
      skipped++;
      console.log(`[seed] SKIP ${uni.slug}.json — ${plan.reason}`);
      continue;
    }
    if (!dryRun) await writeFile(filePath, JSON.stringify(plan.university, null, 2) + '\n', 'utf8');
    written++;
    totalPrograms += plan.university.programs.length;
    console.log(`[seed] ${dryRun ? 'DRY ' : ''}wrote ${uni.slug}.json (${plan.university.programs.length} programs)`);
  }
  console.log(
    `[seed] done · записано ${written} · пропущено ${skipped} · программ ${totalPrograms}` +
    `${dryRun ? ' · СУХОЙ ПРОГОН, на диск не писал' : ''}`,
  );
}
