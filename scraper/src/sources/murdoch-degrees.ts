// Murdoch University degree scraper.
//
// Murdoch's Kaplan partner page lists zero programs (same gap as the other
// AU/NZ partners). The Funnelback search at search.murdoch.edu.au returns a
// JS shell, not JSON. Instead we crawl Murdoch's own static study-area pages
// (one per discipline), collect the unique `/course/<level>/<code>` links,
// then fetch each degree page for title + duration + international fee.
//
// Pipeline:
//   1. fetchMurdochDegreeUrls() — 17 study-area pages fetched in parallel,
//      yields a deduped list of degree URLs (~110 unique degrees).
//   2. fetchMurdochDegree(url) — pulls title, level (from URL segment),
//      duration (in years), intakes (from inline admissionCalendarArr),
//      CRICOS code, and international first-year fee.

import { load } from 'cheerio';

const USER_AGENT = 'StudyRoom-Scraper/0.4 (+https://studyroom.kz)';
const BASE = 'https://www.murdoch.edu.au';

const STUDY_AREAS = [
  'agricultural-science',
  'allied-health',
  'business',
  'creative-media-and-communication',
  'criminology',
  'education',
  'engineering-and-energy',
  'environmental-and-conservation-sciences',
  'humanities-arts-and-social-sciences',
  'indigenous-knowledges',
  'information-technology',
  'law',
  'medical-molecular-and-forensic-sciences',
  'nursing',
  'physical-sciences-and-mathematics',
  'psychology',
  'veterinary-science',
];

export interface MurdochDegreeRef {
  url: string;
  level: 'undergraduate' | 'postgraduate';
  code: string;
  studyAreas: string[];
}

export interface MurdochDegree {
  code: string;
  title: string;
  liveUrl: string;
  level: 'foundation' | 'bachelor' | 'master' | 'phd';
  durationYears: number;
  cricosCode: string | null;
  intakes: string[];
  courseMode: string;
  tuitionAUD: number | null;
  studyAreas: string[];
}

async function fetchHtml(url: string): Promise<string | null> {
  const resp = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
  });
  if (!resp.ok) return null;
  return resp.text();
}

function extractDegreeUrls(
  html: string,
): { url: string; level: 'undergraduate' | 'postgraduate'; code: string }[] {
  const out = new Map<string, { url: string; level: 'undergraduate' | 'postgraduate'; code: string }>();
  const regex = /https:\/\/www\.murdoch\.edu\.au\/course\/(undergraduate|postgraduate)\/([a-z][0-9]+)/g;
  for (const m of html.matchAll(regex)) {
    const level = m[1] as 'undergraduate' | 'postgraduate';
    const code = m[2];
    const url = `https://www.murdoch.edu.au/course/${level}/${code}`;
    if (!out.has(url)) out.set(url, { url, level, code });
  }
  return Array.from(out.values());
}

export async function fetchMurdochDegreeUrls(): Promise<MurdochDegreeRef[]> {
  const refs = new Map<string, MurdochDegreeRef>();
  const results = await Promise.all(
    STUDY_AREAS.map(async (area) => {
      const html = await fetchHtml(`${BASE}/study/courses/study-areas/${area}`);
      if (!html) return { area, urls: [] as ReturnType<typeof extractDegreeUrls> };
      return { area, urls: extractDegreeUrls(html) };
    }),
  );
  for (const { area, urls } of results) {
    for (const u of urls) {
      const existing = refs.get(u.url);
      if (existing) {
        if (!existing.studyAreas.includes(area)) existing.studyAreas.push(area);
      } else {
        refs.set(u.url, { url: u.url, level: u.level, code: u.code, studyAreas: [area] });
      }
    }
  }
  return Array.from(refs.values());
}

function inferProgramLevel(
  urlLevel: 'undergraduate' | 'postgraduate',
  title: string,
): MurdochDegree['level'] {
  const t = title.toLowerCase();
  if (t.startsWith('doctor of') || t.includes('phd')) return 'phd';
  if (urlLevel === 'undergraduate') {
    if (t.startsWith('diploma of') || t.startsWith('certificate ')) return 'foundation';
    return 'bachelor';
  }
  if (t.startsWith('master ') || t.startsWith('master of')) return 'master';
  if (t.startsWith('doctor of')) return 'phd';
  // Graduate Certificates / Diplomas: cluster with masters for the faculty modal.
  return 'master';
}

const DURATION_RE = /<dt[^>]*>\s*Duration\s*<\/dt>\s*<dd[^>]*>\s*([0-9](?:\.[0-9])?)/i;
const CRICOS_RE = /<dt[^>]*>\s*CRICOS code\s*<\/dt>\s*<dd[^>]*>\s*([A-Z0-9]+)/i;
const MODE_RE = /<dt[^>]*>\s*Study mode\s*<\/dt>\s*<dd[^>]*>\s*([^<]+)/i;
const INTL_FIRST_YEAR_FEE_RE =
  /First year fee\s*<span class="sr-only">\(international\)<\/span>\s*<\/dt>\s*<dd[^>]*>\s*\$\s*([0-9,]+)/i;
const INTAKE_RE = /admissionCalendarArr\.push\('([^']+)'\)/g;

export async function fetchMurdochDegree(ref: MurdochDegreeRef): Promise<MurdochDegree | null> {
  const html = await fetchHtml(ref.url);
  if (!html) return null;

  const $ = load(html);
  const title = $('h1.title').first().text().trim();
  if (!title) return null;

  const durationMatch = html.match(DURATION_RE);
  const cricosMatch = html.match(CRICOS_RE);
  const modeMatch = html.match(MODE_RE);
  const feeMatch = html.match(INTL_FIRST_YEAR_FEE_RE);

  const intakeSet = new Set<string>();
  for (const m of html.matchAll(INTAKE_RE)) intakeSet.add(m[1]);
  const intakes = Array.from(intakeSet);

  const tuition = feeMatch ? Number.parseInt(feeMatch[1].replace(/,/g, ''), 10) : null;

  return {
    code: ref.code.toUpperCase(),
    title,
    liveUrl: ref.url,
    level: inferProgramLevel(ref.level, title),
    durationYears: durationMatch ? Number.parseFloat(durationMatch[1]) : 3,
    cricosCode: cricosMatch ? cricosMatch[1] : null,
    intakes,
    courseMode: modeMatch ? modeMatch[1].trim() : '',
    tuitionAUD: Number.isFinite(tuition ?? NaN) && (tuition ?? 0) > 0 ? tuition : null,
    studyAreas: ref.studyAreas,
  };
}

export async function fetchAllMurdochDegrees(
  refs: MurdochDegreeRef[],
  concurrency = 5,
  onProgress?: (done: number, total: number) => void,
): Promise<MurdochDegree[]> {
  const out: (MurdochDegree | null)[] = new Array(refs.length).fill(null);
  let cursor = 0;
  let done = 0;
  async function worker(): Promise<void> {
    while (true) {
      const i = cursor;
      cursor += 1;
      if (i >= refs.length) return;
      try {
        out[i] = await fetchMurdochDegree(refs[i]);
      } catch {
        out[i] = null;
      }
      done += 1;
      if (onProgress) onProgress(done, refs.length);
    }
  }
  const workers = Array.from({ length: Math.max(1, concurrency) }, () => worker());
  await Promise.all(workers);
  return out.filter((d): d is MurdochDegree => d !== null);
}

export function murdochSlugFromCode(code: string): string {
  return 'mu-' + code.toLowerCase();
}
