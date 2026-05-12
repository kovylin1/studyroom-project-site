import { z } from 'zod';

const isoDate = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'Expected ISO 8601 date string',
  });

const slug = z
  .string()
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'lowercase alphanumeric + hyphens only');

export const programLevel = z.enum(['bachelor', 'master', 'phd', 'foundation']);
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
export type Tuition = z.infer<typeof tuitionSchema>;

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
export type Requirements = z.infer<typeof requirementsSchema>;

export const scholarshipSchema = z.object({
  name: z.string().min(1),
  nameRu: z.string().min(1).optional(),
  amount: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  descriptionRu: z.string().min(1).optional(),
  deadline: isoDate.optional(),
  url: z.string().url().optional(),
});
export type Scholarship = z.infer<typeof scholarshipSchema>;

export const galleryItemSchema = z.object({
  img: z.string().min(1),
  caption: z.string().optional(),
});
export type GalleryItem = z.infer<typeof galleryItemSchema>;

export const gallerySchema = z.object({
  items: z.array(galleryItemSchema).default([]),
});
export type Gallery = z.infer<typeof gallerySchema>;

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

export const descriptionSchema = z.object({
  paragraphs: z.array(z.string().min(1)).default([]),
  keyFacts: z.array(z.string().min(1)).default([]),
  paragraphsRu: z.array(z.string().min(1)).optional(),
  keyFactsRu: z.array(z.string().min(1)).optional(),
});
export type Description = z.infer<typeof descriptionSchema>;

export const confidenceLevel = z.enum(['partner', 'official', 'aggregator']);
export type ConfidenceLevel = z.infer<typeof confidenceLevel>;

export const landingLanguage = z.enum(['en', 'ru', 'kz', 'mixed']);
export type LandingLanguage = z.infer<typeof landingLanguage>;

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
          message: `tuition references unknown program slug "${programSlug}"`,
        });
      }
    }

    for (const programSlug of Object.keys(data.deadlines)) {
      if (!programSlugs.has(programSlug)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['deadlines', programSlug],
          message: `deadlines reference unknown program slug "${programSlug}"`,
        });
      }
    }
  });

export type University = z.infer<typeof universitySchema>;
