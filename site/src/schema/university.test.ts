import { describe, expect, it } from 'vitest';
import { universitySchema, type University } from './university';

const validSample: University = {
  slug: 'oxford',
  name: 'University of Oxford',
  country: 'United Kingdom',
  city: 'Oxford',
  programs: [
    { slug: 'cs-bsc', title: 'Computer Science, BSc', durationYears: 3, level: 'bachelor' },
    { slug: 'math-msc', title: 'Mathematics, MSc', durationYears: 1, level: 'master' },
  ],
  tuition: {
    currency: 'GBP',
    byProgram: { 'cs-bsc': 38000, 'math-msc': 32000 },
  },
  deadlines: {
    'cs-bsc': '2026-10-15',
    'math-msc': '2026-11-30',
  },
  requirements: {
    language: { ielts: 7.5, toefl: 110 },
    gpa: 3.7,
    exams: ['MAT'],
  },
  scholarships: [
    { name: 'Reach Oxford', amountUSD: 35000, deadline: '2026-03-01' },
  ],
  lastChecked: '2026-05-01T08:00:00Z',
  sourceUrl: 'https://www.ox.ac.uk/admissions',
  sourceHash: 'sha256:abc123',
  confidence: 'official',
  language: 'en',
};

describe('universitySchema', () => {
  it('accepts a fully valid sample', () => {
    const result = universitySchema.safeParse(validSample);

    expect(result.success).toBe(true);
  });

  it('rejects when a required field is missing', () => {
    const { sourceUrl: _omitted, ...withoutSourceUrl } = validSample;

    const result = universitySchema.safeParse(withoutSourceUrl);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === 'sourceUrl')).toBe(true);
    }
  });

  it('rejects tuition.byProgram entries that point to unknown program slugs', () => {
    const broken: University = {
      ...validSample,
      tuition: {
        currency: 'GBP',
        byProgram: { 'cs-bsc': 38000, 'ghost-program': 10000 },
      },
    };

    const result = universitySchema.safeParse(broken);

    expect(result.success).toBe(false);
    if (!result.success) {
      const ghostIssue = result.error.issues.find(
        (issue) => issue.path.join('.') === 'tuition.byProgram.ghost-program',
      );
      expect(ghostIssue?.message).toContain('ghost-program');
    }
  });

  it('rejects deadlines whose key is not a known program slug', () => {
    const broken: University = {
      ...validSample,
      deadlines: { 'cs-bsc': '2026-10-15', 'mystery-prog': '2027-01-01' },
    };

    const result = universitySchema.safeParse(broken);

    expect(result.success).toBe(false);
  });

  it('rejects an invalid slug shape', () => {
    const broken = { ...validSample, slug: 'Has Spaces & Caps' };

    const result = universitySchema.safeParse(broken);

    expect(result.success).toBe(false);
  });

  it('rejects an unparseable lastChecked date', () => {
    const broken: University = { ...validSample, lastChecked: 'not-a-date' };

    const result = universitySchema.safeParse(broken);

    expect(result.success).toBe(false);
  });

  it('rejects an unsupported currency', () => {
    const broken = {
      ...validSample,
      tuition: { ...validSample.tuition, currency: 'JPY' as const },
    };

    const result = universitySchema.safeParse(broken);

    expect(result.success).toBe(false);
  });
});
