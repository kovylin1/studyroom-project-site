// Kaplan degree-finder feed extractor.
// Every Kaplan page that loads the degree finder JS embeds the full database
// as a window-level `degree_finder_object` JSON literal. Single fetch -> all data.
// We use this for: complete per-university degree lists with exact tuition,
// duration, intake months, and program URLs.

import { normalizeFaculty } from './kaplan-fees.ts';
import { inferLevelFromTitle } from './infer-level.ts';

const FEED_PAGE = 'https://www.kaplanpathways.com/degree-finder/';

export interface KaplanInstitution {
  id: number;
  institution_type_code: 'university' | 'college' | string;
  institution_name: string;
  institution_short_name: string;
  country_code: string;
  expected_living_cost?: string;
  cms_branding_image?: string;
  cms_institution_description?: string;
}

export interface KaplanDegree {
  program_id: number;
  program_name: string;
  university_block?: {
    institution_id: number;
    institution_name: string;
    institution_country: string;
    institution_unit_detail?: string;
  };
  degree_duration: string;
  degree_intake_dates: string;
  Intake_month_year: string;
  current_fees_per_year: string;
  currency_code: string;
  program_url: string;
  program_level: number;
  program_type: string;
  awards: string;
  pathway_study_location: string;
}

export interface KaplanAward {
  award_id: number;
  award_code: string;
  award_name: string;
}

export interface KaplanPreparationCourse {
  institution_id: number;
  institution_code: string;
  institution_name: string;
  awards: KaplanAward[];
}

export interface KaplanFeed {
  institutions: KaplanInstitution[];
  degrees: KaplanDegree[];
  preparationCourses: KaplanPreparationCourse[];
  fetchedAt: string;
}

let cachedFeed: KaplanFeed | null = null;

export async function fetchKaplanFeed(forceRefresh = false): Promise<KaplanFeed> {
  if (cachedFeed && !forceRefresh) return cachedFeed;

  const response = await fetch(FEED_PAGE, {
    headers: {
      'User-Agent': 'StudyRoom-Scraper/0.3 (+https://studyroom.kz)',
      Accept: 'text/html,application/xhtml+xml',
    },
  });
  if (!response.ok) {
    throw new Error('Fetch ' + FEED_PAGE + ' returned HTTP ' + response.status);
  }
  const html = await response.text();
  const match = html.match(/degree_finder_object\s*=\s*(\{[\s\S]+?\});/);
  if (!match) {
    throw new Error('degree_finder_object not found in ' + FEED_PAGE);
  }

  const decoded = match[1].split('\\/').join('/');
  const obj = JSON.parse(decoded) as {
    degrees: { data: { institutions?: KaplanInstitution[]; degrees?: KaplanDegree[]; preparation_courses?: KaplanPreparationCourse[] } };
  };
  const data = obj.degrees?.data;
  if (!data) {
    throw new Error('degree_finder_object.degrees.data missing');
  }

  cachedFeed = {
    institutions: data.institutions ?? [],
    degrees: data.degrees ?? [],
    preparationCourses: data.preparation_courses ?? [],
    fetchedAt: new Date().toISOString(),
  };
  return cachedFeed;
}

export function buildAwardFacultyMap(feed: KaplanFeed): Map<number, string> {
  const map = new Map<number, string>();
  for (const pc of feed.preparationCourses) {
    for (const award of pc.awards) {
      const stripped = award.award_name
        .replace(/^Foundation Certificate (for|in)\s*/i, '')
        .replace(/^Pre-Master'?s (for|in)\s*/i, '')
        .replace(/^International Year One (for|in)\s*/i, '')
        .replace(/^Graduate Diploma (for|in)\s*/i, '')
        .trim();
      const faculty = normalizeFaculty(stripped);
      map.set(award.award_id, faculty);
    }
  }
  return map;
}

export function inferDegreeFaculty(degree: KaplanDegree, awardMap: Map<number, string>): string | null {
  if (!degree.awards) return null;
  const ids = degree.awards.split(',').map((s) => Number.parseInt(s.trim(), 10)).filter((n) => Number.isFinite(n));
  if (ids.length === 0) return null;
  const counts = new Map<string, number>();
  for (const id of ids) {
    const fac = awardMap.get(id);
    if (fac) counts.set(fac, (counts.get(fac) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0];
}

export function mapDegreeLevel(degree: KaplanDegree): 'foundation' | 'bachelor' | 'master' | 'phd' {
  // Title is the strongest signal — recognises UK + US + AU/NZ degree codes
  // (BS/BA/BSE/MS/MFA… not just BSc/MSc). See infer-level.ts.
  const fromTitle = inferLevelFromTitle(degree.program_name ?? '');
  if (fromTitle) return fromTitle;
  // Title gave no confident signal — fall back to Kaplan's numeric level code.
  const lvl = degree.program_level;
  if (lvl === 150) return 'master';
  if (lvl === 30) return 'phd';
  if (lvl === 20) return 'bachelor';
  return 'master';
}

export function parseDuration(durationStr: string): number {
  const m = durationStr.match(/(\d+(?:\.\d+)?)\s*year/i);
  if (m) return Number.parseFloat(m[1]);
  const m2 = durationStr.match(/(\d+)\s*month/i);
  if (m2) return Math.max(0.25, Number.parseInt(m2[1], 10) / 12);
  return 1;
}

export function parseIntakes(intakeStr: string): string[] {
  if (!intakeStr) return [];
  return intakeStr
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
