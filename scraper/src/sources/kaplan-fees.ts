import { load, type CheerioAPI, type Cheerio } from 'cheerio';
import type { Element } from 'domhandler';

export type KaplanLevel = 'foundation' | 'master';

export interface KaplanProgram {
  level: KaplanLevel;
  faculty: string;
  tuitionMin: number;
  currency: 'GBP';
  intakes: string[];
  detailsUrl: string | null;
}

export interface KaplanFeesResult {
  feesUrl: string;
  programs: KaplanProgram[];
}

const LEVEL_MARKERS: Array<{ token: string; level: KaplanLevel }> = [
  { token: 'foundation certificate', level: 'foundation' },
  { token: 'foundation pathway', level: 'foundation' },
  { token: 'international foundation', level: 'foundation' },
  { token: 'international year one', level: 'foundation' },
  { token: 'pre-master', level: 'master' },
  { token: 'pre master', level: 'master' },
  { token: 'graduate diploma', level: 'master' },
];

function detectLevel(headerText: string): KaplanLevel | null {
  const haystack = headerText.toLowerCase();
  for (const { token, level } of LEVEL_MARKERS) {
    if (haystack.includes(token)) return level;
  }
  return null;
}

function parseTuitionCell(text: string): number | null {
  const cleaned = text.replace(/[^\d.,]/g, '').replace(/,/g, '');
  if (!cleaned) return null;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function isLikelyFaculty(label: string): boolean {
  // Reject header rows and non-faculty content.
  const lower = label.toLowerCase().trim();
  if (!lower) return false;
  if (lower.includes('tuition')) return false;
  if (lower.includes('fees')) return false;
  if (lower.includes('course details')) return false;
  if (lower.includes('scholarship')) return false;
  if (lower.includes('progression scholarship')) return false;
  if (lower.includes('foundation certificate')) return false;
  if (lower.includes('foundation pathway')) return false;
  if (lower.includes('foundation pathways')) return false;
  if (lower.includes('international foundation')) return false;
  if (lower.includes('international year one')) return false;
  if (lower.includes('pre-master')) return false;
  if (lower.includes('pre master')) return false;
  if (lower.includes('graduate diploma')) return false;
  if (lower.includes('academic year')) return false;
  return true;
}

// Normalize Kaplan's per-college faculty names into 5 canonical buckets.
// Keeps the catalog filter usable (5 chips, not 43) while preserving meaning.
const FACULTY_RULES: Array<{ test: (l: string) => boolean; bucket: string }> = [
  // Most specific first.
  { test: (l) => l.includes('medic') || l.includes('vet') || l.includes('life sciences') || l.includes('physiotherapy') || l.includes('health') || l.includes('geo science'),
    bucket: 'Medical and Life Sciences' },
  { test: (l) => l.includes('engineer') || (l.includes('science') && !l.includes('social')) || l.includes('comput') || l.includes('physical') || l.includes('mathemat') || l.includes('stem') || l.includes('architect'),
    bucket: 'Science and Engineering' },
  { test: (l) => l.includes('law') || l.includes('politic') || l.includes('international relation') || l.includes('psycholog'),
    bucket: 'Law and Social Sciences' },
  { test: (l) => l.includes('business') || l.includes('econom') || l.includes('finance') || l.includes('management') || l.includes('hospital') || l.includes('tourism') || l.includes('event'),
    bucket: 'Business, Economics and Finance' },
  { test: (l) => l.includes('art') || l.includes('humanit') || l.includes('design') || l.includes('media') || l.includes('communicat') || l.includes('education') || l.includes('social science'),
    bucket: 'Arts and Humanities' },
];

export function normalizeFaculty(raw: string): string {
  const lower = raw.toLowerCase();
  for (const { test, bucket } of FACULTY_RULES) {
    if (test(lower)) return bucket;
  }
  return raw; // unknown — keep original so we can spot it
}

function extractIntakesFromDoc($: CheerioAPI): string[] {
  // The "Course dates" section (id=dates) lists intakes. Defensive: collect any
  // word matching common intake terms anywhere on the page.
  const text = $('body').text();
  const intakes = new Set<string>();
  const tokens: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /\b(autumn|sept(?:ember)?)\b/i, label: 'Autumn' },
    { pattern: /\bspring\b/i, label: 'Spring' },
    { pattern: /\bsummer\b/i, label: 'Summer' },
    { pattern: /\b(january|jan)\b/i, label: 'January' },
  ];
  for (const { pattern, label } of tokens) {
    if (pattern.test(text)) intakes.add(label);
  }
  // Filter to the most common StudyRoom-relevant trio if all four would clutter.
  const ordered = ['Autumn', 'Spring', 'Summer', 'January'].filter((i) => intakes.has(i));
  return ordered;
}

function findLevelHeaderBefore($: CheerioAPI, table: Element): KaplanLevel | null {
  // Walk previous siblings + look at preceding heading or paragraph for "Foundation Certificate" / "Pre-Master's"
  let cur: Cheerio<Element> = $(table);
  for (let i = 0; i < 10; i += 1) {
    cur = cur.prev();
    if (cur.length === 0) break;
    const txt = cur.text();
    const detected = detectLevel(txt);
    if (detected) return detected;
  }
  // Fallback: parent figure -> previous siblings
  let parent: Cheerio<Element> = $(table).parent();
  for (let i = 0; i < 10; i += 1) {
    parent = parent.prev();
    if (parent.length === 0) break;
    const txt = parent.text();
    const detected = detectLevel(txt);
    if (detected) return detected;
  }
  return null;
}

function detectLevelFromTable($: CheerioAPI, table: Element): KaplanLevel | null {
  // Strategy 1: look at the first cell of the first row (header label like "Foundation Certificate")
  const firstCell = $(table).find('tr').first().find('td,th').first().text().trim();
  const fromCell = detectLevel(firstCell);
  if (fromCell) return fromCell;
  // Strategy 2: walk back from the table looking for a heading
  return findLevelHeaderBefore($, table);
}

export async function fetchKaplanFees(feesUrl: string): Promise<KaplanFeesResult> {
  const response = await fetch(feesUrl, {
    headers: {
      'User-Agent': 'StudyRoom-Scraper/0.2 (+https://studyroom.kz)',
      Accept: 'text/html,application/xhtml+xml',
    },
  });
  if (!response.ok) {
    throw new Error('Fetch ' + feesUrl + ' returned HTTP ' + response.status);
  }
  const html = await response.text();
  const $ = load(html);
  const intakes = extractIntakesFromDoc($);

  const programs: KaplanProgram[] = [];

  $('figure.wp-block-table table, table').each((_, table) => {
    const level = detectLevelFromTable($, table);
    if (!level) return;

    $(table).find('tbody tr').each((_, row) => {
      const cells = $(row).find('td');
      if (cells.length < 2) return;
      const facultyRaw = $(cells[0]).text().replace(/ /g, ' ').trim();
      if (!isLikelyFaculty(facultyRaw)) return;

      // Pick rightmost numeric tuition cell (skip the link column).
      let tuitionMin: number | null = null;
      cells.each((idx, c) => {
        if (idx === 0) return;
        const candidate = parseTuitionCell($(c).text());
        if (candidate !== null) tuitionMin = candidate;
      });
      if (tuitionMin === null) return;

      const detailsLink = $(row).find('a').last().attr('href') ?? null;
      const detailsUrl = detailsLink ? new URL(detailsLink, feesUrl).toString() : null;

      programs.push({
        level,
        faculty: normalizeFaculty(facultyRaw),
        tuitionMin,
        currency: 'GBP',
        intakes,
        detailsUrl,
      });
    });
  });

  return { feesUrl, programs };
}

// Helper for callers: turn a faculty name into a URL-safe slug suffix.
export function facultySlug(faculty: string): string {
  return faculty
    .toLowerCase()
    .replace(/[‘’']/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
