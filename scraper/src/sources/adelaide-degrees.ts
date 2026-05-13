// Adelaide University degree scraper.
//
// Adelaide is not in Kaplan's global degree-finder feed (the Kaplan pathway
// partnership exists, but their partner page lists zero programs and zero
// fees). We instead pull degrees from Adelaide's public Funnelback search
// API — the same engine that powers https://adelaide.edu.au/search/ when
// filtered to "Degrees & Courses".
//
// Pipeline:
//   1. fetchAdelaideInternationalDegrees() — paginated Funnelback search
//      filtered to international students. ~500 entries, returns metadata
//      only (no fees).
//   2. fetchDegreeFeeAUD(liveUrl) — fetches each degree's detail page with
//      ?student-type=international and parses "$NN,NNN" near
//      "Indicative annual fees".
//
// The faculty classifier (program-faculty-classifier.ts) handles the
// title-to-faculty mapping later in cli.ts, so this module returns raw
// metadata and stays narrow.

const FUNNELBACK_BASE = 'https://search.adelaideuni.edu.au/s/search.json';
const COLLECTION = 'uosa~sp-aem-prod';
const PROFILE = 'site-search';
const PAGE_SIZE = 100;
const USER_AGENT = 'StudyRoom-Scraper/0.4 (+https://studyroom.kz)';

export type AdelaideStudyLevel =
  | 'Undergraduate'
  | 'Postgraduate'
  | 'Research'
  | 'Non-Award'
  | 'Pre-degree';

export interface AdelaideDegree {
  degreeCode: string;
  compositeId: string;
  shortTitle: string;
  liveUrl: string;
  studyLevel: AdelaideStudyLevel;
  timeRequired: string;
  startMonths: string[];
  location: string;
  courseMode: string;
  tuitionAUD: number | null;
}

interface FunnelbackResult {
  title: string;
  liveUrl: string;
  listMetadata?: Record<string, string[]>;
}

interface FunnelbackResponse {
  response?: {
    resultPacket?: {
      resultsSummary?: { totalMatching?: number };
      results?: FunnelbackResult[];
    };
  };
}

function buildSearchUrl(startRank: number): string {
  // URLSearchParams encodes `|` as `%7C` and spaces as `+`, matching what
  // Funnelback expects in facet keys like `f.Study type|studyType`.
  const params = new URLSearchParams();
  params.set('collection', COLLECTION);
  params.set('profile', PROFILE);
  params.set('query', '!nullquery');
  params.set('num_ranks', String(PAGE_SIZE));
  params.set('start_rank', String(startRank));
  params.append('f.Tabs|type', 'Degrees & Courses');
  params.append('f.Study type|studyType', 'Degree');
  params.append('f.Student type|studentType', 'International');
  return FUNNELBACK_BASE + '?' + params.toString();
}

export async function fetchAdelaideInternationalDegrees(): Promise<AdelaideDegree[]> {
  const all: AdelaideDegree[] = [];
  let total = Number.POSITIVE_INFINITY;
  for (let start = 1; start <= total; start += PAGE_SIZE) {
    const url = buildSearchUrl(start);
    const resp = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
    if (!resp.ok) {
      throw new Error('Funnelback ' + start + ' returned HTTP ' + resp.status);
    }
    const data = (await resp.json()) as FunnelbackResponse;
    const pkt = data.response?.resultPacket;
    total = pkt?.resultsSummary?.totalMatching ?? 0;
    const results = pkt?.results ?? [];
    if (results.length === 0) break;
    for (const r of results) {
      const m = r.listMetadata ?? {};
      const degreeCode = m.degreeCode?.[0] ?? '';
      const compositeId = m.compositeID?.[0] ?? '';
      const liveUrl = r.liveUrl;
      if (!liveUrl) continue;
      all.push({
        degreeCode,
        compositeId,
        shortTitle: (m.shortTitle?.[0] ?? r.title ?? '').trim(),
        liveUrl,
        studyLevel: (m.studyLevel?.[0] ?? 'Undergraduate') as AdelaideStudyLevel,
        timeRequired: m.timeRequired?.[0] ?? '',
        startMonths: Array.isArray(m.startMonth) ? m.startMonth.filter(Boolean) : [],
        location: m.location?.[0] ?? '',
        courseMode: m.courseMode?.[0] ?? '',
        tuitionAUD: null,
      });
    }
  }
  return all;
}

// Fee block on degree pages looks like:
//   <span>Indicative annual fees</span>
//   ...tooltip markup...
//   <div class="degree-details-content-section-subtitle">
//     <span>
//          $50,500
//     </span>
// The label appears twice (visible span + tooltip heading); we accept the
// first $-amount within ~4 KB after either occurrence.
const FEE_REGEX = /Indicative annual fees[\s\S]{0,4000}?\$\s*([0-9][0-9,]+)/;

export async function fetchDegreeFeeAUD(liveUrl: string): Promise<number | null> {
  const url = new URL(liveUrl);
  url.searchParams.set('student-type', 'international');
  const resp = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
  });
  if (!resp.ok) return null;
  const html = await resp.text();
  const match = html.match(FEE_REGEX);
  if (!match) return null;
  const value = Number.parseInt(match[1].replace(/,/g, ''), 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

// Fetches fees for all degrees concurrently, bounded by `concurrency`.
// 538 degrees × ~300 KB per page = ~160 MB of HTML; we throttle to 5 in
// flight to be polite to adelaide.edu.au and avoid CDN rate limits.
export async function fetchAllDegreeFees(
  degrees: AdelaideDegree[],
  concurrency = 5,
  onProgress?: (done: number, total: number) => void,
): Promise<AdelaideDegree[]> {
  const out = degrees.map((d) => ({ ...d }));
  let cursor = 0;
  let done = 0;
  async function worker(): Promise<void> {
    while (true) {
      const i = cursor;
      cursor += 1;
      if (i >= out.length) return;
      try {
        out[i].tuitionAUD = await fetchDegreeFeeAUD(out[i].liveUrl);
      } catch {
        out[i].tuitionAUD = null;
      }
      done += 1;
      if (onProgress) onProgress(done, out.length);
    }
  }
  const workers = Array.from({ length: Math.max(1, concurrency) }, () => worker());
  await Promise.all(workers);
  return out;
}

export function mapStudyLevelToProgramLevel(
  sl: AdelaideStudyLevel,
): 'foundation' | 'bachelor' | 'master' | 'phd' {
  if (sl === 'Pre-degree' || sl === 'Non-Award') return 'foundation';
  if (sl === 'Undergraduate') return 'bachelor';
  if (sl === 'Research') return 'phd';
  return 'master'; // Postgraduate
}

export function parseTimeRequiredYears(s: string): number {
  const yr = s.match(/(\d+(?:\.\d+)?)\s*year/i);
  if (yr) return Number.parseFloat(yr[1]);
  const mo = s.match(/(\d+(?:\.\d+)?)\s*month/i);
  if (mo) return Math.max(0.25, Number.parseFloat(mo[1]) / 12);
  return 1;
}

export function adelaideSlugFromDegreeCode(code: string, fallback: string): string {
  if (code) return 'au-' + code.toLowerCase();
  return 'au-' + fallback.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
