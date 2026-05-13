// Massey University (New Zealand) degree scraper.
//
// www.massey.ac.nz is publicly accessible (no Cloudflare challenge) and
// publishes a complete CMS sitemap. Each qualification has a stable URL of
// the form `/study/all-qualifications-and-degrees/<title-slug>-<CODE>/`
// where CODE is a 4-5 char internal identifier (e.g. PMHLM, UBVSA).
//
// Pipeline:
//   1. fetchMasseyQualificationUrls() — pull the CMS sitemap, filter to
//      URLs under /study/all-qualifications-and-degrees/.
//   2. fetchMasseyQualification(url) — GET the page, parse the
//      `<dl class="key-facts">` block (Qualification type, Time to
//      complete, Where you can study, International students) and the
//      rich-text fee block ("International students: $XX,XXX").
//   3. Filter: only keep degrees whose "International students" dd starts
//      with "Open to international students".

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const SITEMAP_URL = 'https://www.massey.ac.nz/cms_sitemap.xml';
const URL_PREFIX = 'https://www.massey.ac.nz/study/all-qualifications-and-degrees/';

export interface MasseyDegree {
  code: string;
  title: string;
  liveUrl: string;
  qualType: string;
  level: 'foundation' | 'bachelor' | 'master' | 'phd';
  durationYears: number;
  campuses: string[];
  openToInternational: boolean;
  tuitionNZD: number | null;
}

async function fetchText(url: string): Promise<string | null> {
  const resp = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html, application/xml' },
  });
  if (!resp.ok) return null;
  return resp.text();
}

export async function fetchMasseyQualificationUrls(): Promise<string[]> {
  const xml = await fetchText(SITEMAP_URL);
  if (!xml) throw new Error('failed to fetch ' + SITEMAP_URL);
  const out = new Set<string>();
  const re = /<loc>([^<]+)<\/loc>/g;
  for (const m of xml.matchAll(re)) {
    const url = m[1];
    if (!url.startsWith(URL_PREFIX)) continue;
    const tail = url.slice(URL_PREFIX.length).replace(/\/$/, '');
    if (!tail) continue;
    if (!/-[A-Z]{3,6}$/.test(tail)) continue;
    out.add(url);
  }
  return Array.from(out);
}

const KEY_FACTS_RE =
  /<dt[^>]*class="[^"]*key-facts__heading[^"]*"[^>]*>\s*([^<]+?)\s*<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/g;
const INTL_DD_RE =
  /<span class="key-facts__heading"[^>]*>\s*International students\s*<\/span>[\s\S]{0,800}?<dd[^>]*>([\s\S]*?)<\/dd>/;
const INTL_FEE_RE = /International students:\s*\$\s*([0-9,]+)/i;
const DURATION_YEARS_RE = /(\d+(?:\.\d+)?)\s*years?\s*(?:full[- ]time|standard)?/i;
const DURATION_MONTHS_RE = /(\d+)(?:\s*[-–to]+\s*\d+)?\s*months?\s*full[- ]time/i;

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function inferLevel(qualType: string, title: string): MasseyDegree['level'] {
  const q = qualType.toLowerCase();
  const t = title.toLowerCase();
  if (
    q.includes('doctoral') ||
    q.includes("doctor's") ||
    t.startsWith('doctor of') ||
    /\bphd\b/i.test(title)
  ) {
    return 'phd';
  }
  if (q.includes('master') || t.startsWith('master ') || t.startsWith('master of')) return 'master';
  if (
    q.includes('postgraduate') ||
    q.includes('graduate certificate') ||
    q.includes('graduate diploma')
  ) {
    return 'master';
  }
  if (q.includes('bachelor') || t.startsWith('bachelor')) return 'bachelor';
  // Certificate/Diploma checks come after the bachelor check (so "Bachelor of X"
  // wins) but before the fallback, and consult BOTH qualType AND title so
  // certificates whose qualType field is missing still classify correctly.
  if (
    q.includes('certificate') ||
    q.includes('diploma') ||
    q.includes('foundation') ||
    t.startsWith('certificate ') ||
    t.startsWith('diploma ') ||
    t.startsWith('graduate certificate') ||
    t.startsWith('graduate diploma') ||
    t.startsWith('postgraduate certificate') ||
    t.startsWith('postgraduate diploma')
  ) {
    // Postgraduate/Graduate Cert+Dip cluster with master (postgrad track);
    // plain Certificate/Diploma cluster with foundation.
    if (/^(graduate|postgraduate)\s/.test(t)) return 'master';
    return 'foundation';
  }
  return 'bachelor';
}

function parseDuration(text: string): number {
  const yearMatch = text.match(DURATION_YEARS_RE);
  if (yearMatch) return Number.parseFloat(yearMatch[1]);
  const monthMatch = text.match(DURATION_MONTHS_RE);
  if (monthMatch) {
    const months = Number.parseInt(monthMatch[1], 10);
    return Math.max(0.25, Math.round((months / 12) * 4) / 4);
  }
  return 1;
}

export async function fetchMasseyQualification(url: string): Promise<MasseyDegree | null> {
  const html = await fetchText(url);
  if (!html) return null;

  const ldMatch = html.match(
    /"@type":\s*"EducationalOccupationalProgram"[^}]*?"name":\s*"([^"]+)"/,
  );
  const codeFromUrl = (url.replace(/\/$/, '').split('-').pop() ?? '').toUpperCase();
  let title = ldMatch ? ldMatch[1].replace(/\\u2013/g, '–').trim() : '';
  // Strip the trailing " – CODE" abbreviation the JSON-LD includes. Massey codes
  // vary from short (PMHLM, UBVSA) to long (CertCreativeArt, PGDipHSM), so we
  // accept any uppercase-leading camelCase / all-caps token after an em-dash.
  title = title.replace(/\s*[–-]\s*[A-Z][A-Za-z]{1,30}$/, '').trim();
  if (!title) return null;

  const keyFacts: Record<string, string> = {};
  for (const m of html.matchAll(KEY_FACTS_RE)) {
    const heading = m[1].trim();
    const value = stripHtml(m[2]);
    if (heading && value) keyFacts[heading] = value;
  }
  const intlMatch = html.match(INTL_DD_RE);
  const intlValue = intlMatch ? stripHtml(intlMatch[1]) : '';

  const qualType = keyFacts['Qualification type'] || '';
  const timeToComplete = keyFacts['Time to complete'] || '';
  const wherePerStudy = keyFacts['Where you can study'] || '';

  const campuses = wherePerStudy
    .split(/,\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

  const openToInternational = /^Open to international students/i.test(intlValue);

  const feeMatch = html.match(INTL_FEE_RE);
  const tuition = feeMatch ? Number.parseInt(feeMatch[1].replace(/,/g, ''), 10) : null;

  return {
    code: codeFromUrl,
    title,
    liveUrl: url,
    qualType,
    level: inferLevel(qualType, title),
    durationYears: parseDuration(timeToComplete),
    campuses,
    openToInternational,
    tuitionNZD: Number.isFinite(tuition ?? NaN) && (tuition ?? 0) > 0 ? tuition : null,
  };
}

export async function fetchAllMasseyDegrees(
  urls: string[],
  concurrency = 8,
  onProgress?: (done: number, total: number) => void,
): Promise<MasseyDegree[]> {
  const out: (MasseyDegree | null)[] = new Array(urls.length).fill(null);
  let cursor = 0;
  let done = 0;
  async function worker(): Promise<void> {
    while (true) {
      const i = cursor;
      cursor += 1;
      if (i >= urls.length) return;
      try {
        out[i] = await fetchMasseyQualification(urls[i]);
      } catch {
        out[i] = null;
      }
      done += 1;
      if (onProgress) onProgress(done, urls.length);
    }
  }
  const workers = Array.from({ length: Math.max(1, concurrency) }, () => worker());
  await Promise.all(workers);
  return out.filter((d): d is MasseyDegree => d !== null);
}

export function masseySlugFromCode(code: string): string {
  return 'ma-' + code.toLowerCase();
}
