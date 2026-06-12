// Валидирует ВСЕ universities/*.json против Zod-схемы (копия site/src/schema/university.ts,
// держать в синхроне со схемой сайта). zod резолвится из scraper/node_modules.
// Запуск из scraper/: node node_modules/tsx/dist/cli.mjs src/validate-unis.ts
import { readdirSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const isoDate = z.string().refine((v) => !Number.isNaN(Date.parse(v)), { message: 'Expected ISO 8601 date string' });
const slug = z.string().regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'lowercase alphanumeric + hyphens only');

const programLevel = z.enum(['high-school', 'sixth-form', 'foundation', 'bachelor', 'master', 'phd', 'english-language', 'short-course']);
const programSchema = z.object({
  slug,
  title: z.string().min(1),
  durationYears: z.number().positive(),
  level: programLevel,
  language: z.string().min(2).optional(),
  faculty: z.string().min(1).optional(),
  intakes: z.array(z.string()).optional(),
  programUrl: z.string().url().optional(),
  programType: z.enum(['pathway', 'degree']).optional(),
  source: z.string().optional(),
  verifiedBySite: z.boolean().optional(),
  confidence: z.number().min(0).max(1).optional(),
  checkedAt: isoDate.optional(),
});
const tuitionSchema = z.object({ currency: z.enum(['USD', 'EUR', 'GBP', 'KZT', 'RUB', 'CAD', 'AUD', 'NZD']), byProgram: z.record(slug, z.number().nonnegative()) });
const requirementsSchema = z.object({
  language: z.object({ ielts: z.number().min(0).max(9).optional(), toefl: z.number().min(0).max(120).optional(), duolingo: z.number().min(0).max(160).optional() }).optional(),
  gpa: z.number().min(0).max(4).optional(),
  exams: z.array(z.string()).default([]),
});
const scholarshipSchema = z.object({
  name: z.string().min(1), nameRu: z.string().min(1).optional(), amount: z.string().min(1).optional(),
  description: z.string().min(1).optional(), descriptionRu: z.string().min(1).optional(), deadline: isoDate.optional(), url: z.string().url().optional(),
  confidence: z.number().min(0).max(1).optional(),
});
const galleryItemSchema = z.object({ img: z.string().min(1), caption: z.string().optional() });
const gallerySchema = z.object({ items: z.array(galleryItemSchema).default([]) });
const photoSetsSchema = z.object({
  general: z.array(galleryItemSchema).optional(), studentsFaculty: z.array(galleryItemSchema).optional(),
  campuses: z.array(galleryItemSchema).optional(), accommodation: z.array(galleryItemSchema).optional(),
});
const accommodationItemSchema = z.object({ name: z.string().min(1), price: z.string().optional(), oldPrice: z.string().optional(), text: z.string().optional(), img: z.string().optional(), source: z.string().optional(), verifiedBySite: z.boolean().optional(), confidence: z.number().min(0).max(1).optional(), checkedAt: isoDate.optional() });
const campusItemSchema = z.object({ title: z.string().min(1), sub: z.string().optional(), text: z.string().optional(), img: z.string().optional(), source: z.string().optional(), verifiedBySite: z.boolean().optional(), confidence: z.number().min(0).max(1).optional(), checkedAt: isoDate.optional() });
const descriptionSchema = z.object({
  paragraphs: z.array(z.string().min(1)).default([]), keyFacts: z.array(z.string().min(1)).default([]),
  paragraphsRu: z.array(z.string().min(1)).optional(), keyFactsRu: z.array(z.string().min(1)).optional(),
  paragraphsKk: z.array(z.string().min(1)).optional(), keyFactsKk: z.array(z.string().min(1)).optional(),
});
const confidenceLevel = z.enum(['partner', 'official', 'aggregator']);
const landingLanguage = z.enum(['en', 'ru', 'kz', 'mixed']);

const universitySchema = z.object({
  slug, name: z.string().min(1), country: z.string().min(2), city: z.string().min(1),
  programs: z.array(programSchema).min(1), tuition: tuitionSchema, deadlines: z.record(slug, isoDate),
  requirements: requirementsSchema, scholarships: z.array(scholarshipSchema).default([]),
  gallery: gallerySchema.optional(), accommodation: z.array(accommodationItemSchema).optional(), campuses: z.array(campusItemSchema).optional(),
  description: descriptionSchema.optional(), photoSets: photoSetsSchema.optional(), logoUrl: z.string().min(1).optional(),
  lastChecked: isoDate, sourceUrl: z.string().url(), sourceHash: z.string().min(1), confidence: confidenceLevel, language: landingLanguage,
}).superRefine((data, ctx) => {
  const programSlugs = new Set(data.programs.map((p) => p.slug));
  for (const ps of Object.keys(data.tuition.byProgram)) if (!programSlugs.has(ps)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['tuition', 'byProgram', ps], message: `tuition references unknown program slug "${ps}"` });
  for (const ps of Object.keys(data.deadlines)) if (!programSlugs.has(ps)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['deadlines', ps], message: `deadlines reference unknown program slug "${ps}"` });
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(__dirname, '../../site/src/content/universities');

let ok = 0;
let bad = 0;
const errs: string[] = [];
for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  let data: unknown;
  try { data = JSON.parse(readFileSync(path.join(dir, f), 'utf8')); }
  catch { bad++; if (errs.length < 60) errs.push(`${f}: JSON parse error`); continue; }
  const r = universitySchema.safeParse(data);
  if (r.success) ok++;
  else { bad++; if (errs.length < 60) errs.push(`${f}: ${JSON.stringify(r.error.issues.slice(0, 3))}`); }
}
for (const e of errs) console.error(e);
console.log(JSON.stringify({ ok, bad }));
process.exit(bad ? 1 : 0);
