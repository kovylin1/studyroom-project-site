// University of Newcastle (Australia) degree scraper.
//
// www.newcastle.edu.au sits behind a Cloudflare bot challenge (JS + cookies
// required), and the underlying CourseLoop GraphQL API at
// api-ap-southeast-2.prod.courseloop.com is locked down at the gateway.
// However, the publicly-accessible academic handbook at
// handbook.newcastle.edu.au is built with Next.js and ships the full
// program record inside the SSR-rendered `__NEXT_DATA__` script — for
// every URL in its sitemap.
//
// Pipeline:
//   1. fetchNewcastleProgramUrls() — pull the handbook sitemap index, follow
//      each referenced sitemap (main + incrementals), collect every
//      /program/<year>/<id> URL.
//   2. Filter to the current year (CURRENT_YEAR).
//   3. fetchNewcastleProgram(url) — GET the page, extract pageContent from
//      __NEXT_DATA__, return a typed degree record.
//
// Tuition note: Newcastle does NOT publish per-program international fees
// in the handbook (the `fees_description` field is null for every program
// sampled). We leave `tuitionAUD` null; the landing-page UI hides the
// price strip when fee is 0. Adding fees here would require a separate
// fee-table scrape and is left as future work.

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const SITEMAP_INDEX = 'https://handbook.newcastle.edu.au/sitemap.xml';
const CURRENT_YEAR = '2026';

export interface NewcastleDegree {
  code: string;
  title: string;
  liveUrl: string;
  level: 'foundation' | 'bachelor' | 'master' | 'phd';
  durationYears: number;
  cricosCode: string | null;
  location: string;
  college: string;
  intakes: string[];
  tuitionAUD: number | null;
}

async function fetchText(url: string): Promise<string | null> {
  const resp = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html, application/xml' },
  });
  if (!resp.ok) return null;
  return resp.text();
}

function extractLocs(xml: string): string[] {
  const out: string[] = [];
  const re = /<loc>([^<]+)<\/loc>/g;
  for (const m of xml.matchAll(re)) out.push(m[1]);
  return out;
}

export async function fetchNewcastleProgramUrls(): Promise<string[]> {
  const index = await fetchText(SITEMAP_INDEX);
  if (!index) throw new Error('failed to fetch sitemap index ' + SITEMAP_INDEX);
  const childMaps = extractLocs(index);
  const allUrls = new Set<string>();
  const responses = await Promise.all(childMaps.map((u) => fetchText(u)));
  for (const xml of responses) {
    if (!xml) continue;
    for (const loc of extractLocs(xml)) {
      if (loc.includes(`/program/${CURRENT_YEAR}/`)) allUrls.add(loc);
    }
  }
  return Array.from(allUrls);
}

function inferLevel(
  title: string,
  studyLevelRef: string,
): NewcastleDegree['level'] {
  const t = title.toLowerCase();
  if (t.startsWith('doctor of') || /\bphd\b/i.test(title)) return 'phd';
  if (t.startsWith('master ') || t.startsWith('master of')) return 'master';
  if (
    t.startsWith('graduate certificate') ||
    t.startsWith('graduate diploma') ||
    t.startsWith('professional certificate') ||
    t.startsWith('certificate')
  ) {
    return 'master';
  }
  if (t.startsWith('diploma ') || t.startsWith('diploma of')) return 'foundation';
  if (t.startsWith('bachelor')) return 'bachelor';
  if (/postgrad|research/i.test(studyLevelRef)) return 'master';
  return 'bachelor';
}

const NEXT_DATA_RE =
  /<script id="__NEXT_DATA__" type="application\/json">([\s\S]+?)<\/script>/;

export async function fetchNewcastleProgram(url: string): Promise<NewcastleDegree | null> {
  const html = await fetchText(url);
  if (!html) return null;
  const m = html.match(NEXT_DATA_RE);
  if (!m) return null;
  let pc: Record<string, unknown> | null = null;
  try {
    const parsed = JSON.parse(m[1]) as {
      props?: { pageProps?: { pageContent?: Record<string, unknown> } };
    };
    pc = parsed.props?.pageProps?.pageContent ?? null;
  } catch {
    return null;
  }
  if (!pc || typeof pc !== 'object') return null;

  const title = typeof pc.title === 'string' ? pc.title.trim() : '';
  if (!title) return null;

  // Filter: only programs with a CRICOS code are open to international students.
  // The `international_students` boolean is frequently `false` even for clearly
  // intl-eligible programs, so CRICOS presence is the more reliable signal.
  const cricos = typeof pc.cricos_code === 'string' ? pc.cricos_code.trim() : '';
  if (!cricos) return null;

  const titleLower = title.toLowerCase();
  const isDegree =
    titleLower.startsWith('bachelor') ||
    titleLower.startsWith('master') ||
    titleLower.startsWith('doctor') ||
    titleLower.startsWith('graduate certificate') ||
    titleLower.startsWith('graduate diploma') ||
    titleLower.startsWith('diploma');
  if (!isDegree) return null;

  const code = typeof pc.code === 'string' ? pc.code : '';
  const studyLevelRef = typeof pc.study_level_ref === 'string' ? pc.study_level_ref : '';
  const duration =
    typeof pc.duration_ft_std === 'number'
      ? pc.duration_ft_std
      : typeof pc.duration_ft_std === 'string'
        ? Number.parseFloat(pc.duration_ft_std) || 3
        : 3;
  const location = typeof pc.location === 'string' ? pc.location.trim() : '';
  const college =
    typeof pc.parent_academic_org === 'string' ? pc.parent_academic_org.trim() : '';

  return {
    code,
    title,
    liveUrl: url,
    level: inferLevel(title, studyLevelRef),
    durationYears: duration,
    cricosCode: cricos || null,
    location,
    college,
    intakes: ['Semester 1', 'Semester 2'],
    tuitionAUD: null,
  };
}

export async function fetchAllNewcastleDegrees(
  urls: string[],
  concurrency = 8,
  onProgress?: (done: number, total: number) => void,
): Promise<NewcastleDegree[]> {
  const out: (NewcastleDegree | null)[] = new Array(urls.length).fill(null);
  let cursor = 0;
  let done = 0;
  async function worker(): Promise<void> {
    while (true) {
      const i = cursor;
      cursor += 1;
      if (i >= urls.length) return;
      try {
        out[i] = await fetchNewcastleProgram(urls[i]);
      } catch {
        out[i] = null;
      }
      done += 1;
      if (onProgress) onProgress(done, urls.length);
    }
  }
  const workers = Array.from({ length: Math.max(1, concurrency) }, () => worker());
  await Promise.all(workers);
  return out.filter((d): d is NewcastleDegree => d !== null);
}

export function newcastleSlugFromCode(code: string): string {
  return 'un-' + code.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// CRICOS fee enhancer — Newcastle's handbook does not publish international
// fees, but every registered program is listed on the Australian government's
// CRICOS registry (cricos.education.gov.au) with `Tuition Fee` (total program
// cost in AUD) and `Duration` (weeks). We compute annual fee = total / years.
//
// One detail page per program, ~32 KB each, 159 programs = ~5 MB / 30s @ 5
// concurrency.

const CRICOS_BASE =
  'https://cricos.education.gov.au/Course/CourseDetails.aspx?CourseCode=';
const CRICOS_TUITION_RE =
  /id="ctl00_cphDefaultPage_courseDetail_lblTuition"[^>]*>\s*([0-9,]+)\s*</;
const CRICOS_DURATION_RE =
  /id="ctl00_cphDefaultPage_courseDetail_lblDuration"[^>]*>\s*([0-9]+)\s*</;

async function fetchCricosFee(cricosCode: string): Promise<number | null> {
  const url = CRICOS_BASE + encodeURIComponent(cricosCode);
  const resp = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
  });
  if (!resp.ok) return null;
  const html = await resp.text();
  const feeMatch = html.match(CRICOS_TUITION_RE);
  const durMatch = html.match(CRICOS_DURATION_RE);
  if (!feeMatch) return null;
  const totalFee = Number.parseInt(feeMatch[1].replace(/,/g, ''), 10);
  if (!Number.isFinite(totalFee) || totalFee <= 0) return null;
  // Duration is in WEEKS on CRICOS. Convert to years (52 weeks/year) and
  // amortise the total tuition. Fall back to total/3 if duration is missing.
  let years = 3;
  if (durMatch) {
    const weeks = Number.parseInt(durMatch[1], 10);
    if (Number.isFinite(weeks) && weeks > 0) years = Math.max(0.5, weeks / 52);
  }
  return Math.round(totalFee / years);
}

export async function fetchNewcastleFeesFromCricos(
  degrees: NewcastleDegree[],
  concurrency = 5,
  onProgress?: (done: number, total: number) => void,
): Promise<NewcastleDegree[]> {
  const out = degrees.map((d) => ({ ...d }));
  let cursor = 0;
  let done = 0;
  async function worker(): Promise<void> {
    while (true) {
      const i = cursor;
      cursor += 1;
      if (i >= out.length) return;
      const d = out[i];
      if (d.cricosCode) {
        try {
          out[i].tuitionAUD = await fetchCricosFee(d.cricosCode);
        } catch {
          out[i].tuitionAUD = null;
        }
      }
      done += 1;
      if (onProgress) onProgress(done, out.length);
    }
  }
  const workers = Array.from({ length: Math.max(1, concurrency) }, () => worker());
  await Promise.all(workers);
  return out;
}
