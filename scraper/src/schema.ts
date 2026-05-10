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
  currency: z.enum(['USD', 'EUR', 'GBP', 'KZT', 'RUB', 'CAD', 'AUD']),
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
  amountUSD: z.number().nonnegative().optional(),
  deadline: isoDate.optional(),
  url: z.string().url().optional(),
});

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
