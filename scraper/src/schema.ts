import { z } from 'zod';

const isoDate = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'Expected ISO 8601 date string',
  });

const slug = z
  .string()
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'lowercase alphanumeric + hyphens only');

export const programLevel = z.enum([
  'high-school',
  'sixth-form',
  'foundation',
  'bachelor',
  'master',
  'phd',
  'english-language',
  'short-course',
]);
export type ProgramLevel = z.infer<typeof programLevel>;

export const programSchema = z.object({
  slug,
  title: z.string().min(1),
  durationYears: z.number().positive(),
  level: programLevel,
  language: z.string().min(2).optional(),
  faculty: z.string().min(1).optional(),
  intakes: z.array(z.string()).optional(),
  programUrl: z.string().url().optional(),
  programType: z.enum(['pathway', 'degree']).optional(),
});
export type Program = z.infer<typeof programSchema>;

export const tuitionSchema = z.object({
  currency: z.enum(['USD', 'EUR', 'GBP', 'KZT', 'RUB', 'CAD', 'AUD', 'NZD']),
  byProgram: z.record(slug, z.number().nonnegative()),
});

export const requirementsSchema = z.object({
  language: z
    .object({
      ielts: z.number().min(0).max(9).optional(),
      toefl: z.number().min(0).max(120).optional(),
      duolingo: z.number().min(0).max(160).optional(),
    })
    .optional(),
  gpa: z.number().min(0).max(4).optional(),
  exams: z.array(z.string()).default([]),
});

export const scholarshipSchema = z.object({
  name: z.string().min(1),
  nameRu: z.string().min(1).optional(),
  amount: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  descriptionRu: z.string().min(1).optional(),
  deadline: isoDate.optional(),
  url: z.string().url().optional(),
});

export const galleryItemSchema = z.object({
  img: z.string().min(1),
  caption: z.string().optional(),
});
export type GalleryItem = z.infer<typeof galleryItemSchema>;

export const gallerySchema = z.object({
  items: z.array(galleryItemSchema).default([]),
});
export type Gallery = z.infer<typeof gallerySchema>;

// Four categorical photo galleries, each a separate page section. All optional
// because not every uni has been backfilled yet. Sources per category:
// `general` — Wikipedia / Wikimedia Commons (uni exterior, main buildings).
// `studentsFaculty` — Kaplan partner page (student-life shots that the
//                     accommodation/gallery scoring filter pushes out).
// `campuses` — Wikimedia Commons "Category:<Uni Name>" (specific buildings).
// `accommodation` — Kaplan accommodation page + uni accommodation page.
export const photoSetsSchema = z.object({
  general: z.array(galleryItemSchema).optional(),
  studentsFaculty: z.array(galleryItemSchema).optional(),
  campuses: z.array(galleryItemSchema).optional(),
  accommodation: z.array(galleryItemSchema).optional(),
});
export type PhotoSets = z.infer<typeof photoSetsSchema>;

export const accommodationItemSchema = z.object({
  name: z.string().min(1),
  price: z.string().optional(),
  oldPrice: z.string().optional(),
  text: z.string().optional(),
  img: z.string().optional(),
});
export type AccommodationItem = z.infer<typeof accommodationItemSchema>;

export const campusItemSchema = z.object({
  title: z.string().min(1),
  sub: z.string().optional(),
  text: z.string().optional(),
  img: z.string().optional(),
});
export type CampusItem = z.infer<typeof campusItemSchema>;

// Per-uni biography section. `paragraphs[]` + `keyFacts[]` come from the Kaplan
// partner page's "About this university" copy (scraped, English). The `*Ru`
// variants are hand-curated Russian translations from `sources/description-translations.ts`,
// merged in by `buildDescription`. The page template prefers Russian when present
// and falls back to English so a missing translation never breaks the render.
export const descriptionSchema = z.object({
  paragraphs: z.array(z.string().min(1)).default([]),
  keyFacts: z.array(z.string().min(1)).default([]),
  paragraphsRu: z.array(z.string().min(1)).optional(),
  keyFactsRu: z.array(z.string().min(1)).optional(),
});
export type Description = z.infer<typeof descriptionSchema>;

export const confidenceLevel = z.enum(['partner', 'official', 'aggregator']);
export const landingLanguage = z.enum(['en', 'ru', 'kz', 'mixed']);

export const universitySchema = z
  .object({
    slug,
    name: z.string().min(1),
    country: z.string().min(2),
    city: z.string().min(1),
    programs: z.array(programSchema).min(1),
    tuition: tuitionSchema,
    deadlines: z.record(slug, isoDate),
    requirements: requirementsSchema,
    scholarships: z.array(scholarshipSchema).default([]),
    gallery: gallerySchema.optional(),
    accommodation: z.array(accommodationItemSchema).optional(),
    campuses: z.array(campusItemSchema).optional(),
    description: descriptionSchema.optional(),
    photoSets: photoSetsSchema.optional(),
    lastChecked: isoDate,
    sourceUrl: z.string().url(),
    sourceHash: z.string().min(1),
    confidence: confidenceLevel,
    language: landingLanguage,
  })
  .superRefine((data, ctx) => {
    const programSlugs = new Set(data.programs.map((p) => p.slug));
    for (const programSlug of Object.keys(data.tuition.byProgram)) {
      if (!programSlugs.has(programSlug)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['tuition', 'byProgram', programSlug],
          message: 'tuition references unknown program slug',
        });
      }
    }
    for (const programSlug of Object.keys(data.deadlines)) {
      if (!programSlugs.has(programSlug)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['deadlines', programSlug],
          message: 'deadlines reference unknown program slug',
        });
      }
    }
  });

export type University = z.infer<typeof universitySchema>;
