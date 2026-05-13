// Verification agent — samples program URLs per university and checks them
// for accuracy against the live source. For each sampled program:
//   - HTTP status (200 OK / 3xx / 4xx dead / 5xx / network error)
//   - Page title contains the program name (loose substring match)
//
// Writes a per-uni report to site/public/api/verify.json so the manager
// page can show freshness scores + the deployed snapshot picks it up.
//
// Run with `npm run verify` from the scraper directory.

import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');
const CATALOG_DIR = resolve(PROJECT_ROOT, 'site/src/content/universities');
const OUTPUT_FILE = resolve(PROJECT_ROOT, 'site/public/api/verify.json');

// Browser-like UA — some uni sites (especially Cloudflare-protected ones)
// 403 unknown UAs. Matches what the per-uni scrapers use.
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const SAMPLE_PER_UNI = 5;
const CONCURRENCY = 8;
const TIMEOUT_MS = 15000;

type SampleStatus =
  | 'ok'
  | 'redirect'
  | 'dead'
  | 'error'
  | 'unreachable'
  | 'title_mismatch';

interface SampleResult {
  slug: string;
  title: string;
  programUrl: string;
  httpStatus: number | null;
  status: SampleStatus;
  pageTitle: string | null;
  durationMs: number;
}

interface UniReport {
  slug: string;
  name: string;
  totalPrograms: number;
  sampled: number;
  alive: number;
  redirect: number;
  dead: number;
  mismatch: number;
  errors: number;
  freshnessPct: number;
  samples: SampleResult[];
}

interface VerifyPayload {
  generatedAt: string;
  sampleSize: number;
  totalSampled: number;
  totalAlive: number;
  overallFreshnessPct: number;
  reports: UniReport[];
}

interface ProgramFields {
  slug: string;
  title: string;
  programUrl?: string;
}

interface UniversityFields {
  slug: string;
  name: string;
  programs: ProgramFields[];
}

function pickN<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length > 0) {
    const i = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
}

interface FetchOutcome {
  res: Response | null;
  durationMs: number;
}

async function fetchWithTimeout(url: string): Promise<FetchOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const start = Date.now();
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      signal: controller.signal,
      redirect: 'follow',
    });
    return { res, durationMs: Date.now() - start };
  } catch {
    return { res: null, durationMs: Date.now() - start };
  } finally {
    clearTimeout(timer);
  }
}

function normalizeTitle(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

async function verifySample(p: ProgramFields): Promise<SampleResult> {
  const programUrl = p.programUrl ?? '';
  const result: SampleResult = {
    slug: p.slug,
    title: p.title,
    programUrl,
    httpStatus: null,
    status: 'error',
    pageTitle: null,
    durationMs: 0,
  };
  if (!programUrl) return result;

  const { res, durationMs } = await fetchWithTimeout(programUrl);
  result.durationMs = durationMs;
  if (!res) {
    result.status = 'unreachable';
    return result;
  }
  result.httpStatus = res.status;
  if (res.status >= 400) {
    result.status = 'dead';
    return result;
  }
  if (res.status >= 300) {
    result.status = 'redirect';
    return result;
  }

  let html = '';
  try {
    html = await res.text();
  } catch {
    result.status = 'error';
    return result;
  }
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  result.pageTitle = titleMatch ? titleMatch[1].trim().slice(0, 200) : null;

  // Title match: take the 4 most-significant program-title words (length ≥ 4)
  // and require ≥ 40% to appear in the page title. Loose enough to handle
  // sub-brand prefixes ("Study X at Y") and code suffixes; strict enough to
  // flag a page that's actually about something else.
  if (result.pageTitle) {
    const pageNorm = normalizeTitle(result.pageTitle);
    const progNorm = normalizeTitle(p.title);
    const significantWords = progNorm
      .split(/\s+/)
      .filter((w) => w.length >= 4)
      .slice(0, 4);
    if (significantWords.length === 0) {
      result.status = 'ok';
    } else {
      const hits = significantWords.filter((w) => pageNorm.includes(w)).length;
      result.status = hits / significantWords.length >= 0.4 ? 'ok' : 'title_mismatch';
    }
  } else {
    result.status = 'ok';
  }
  return result;
}

async function verifyUniversity(u: UniversityFields): Promise<UniReport> {
  const withUrl = (u.programs || []).filter((p) => !!p.programUrl);
  const sampled = pickN(withUrl, SAMPLE_PER_UNI);
  const samples: SampleResult[] = new Array(sampled.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (true) {
      const i = cursor;
      cursor += 1;
      if (i >= sampled.length) return;
      try {
        samples[i] = await verifySample(sampled[i]);
      } catch {
        samples[i] = {
          slug: sampled[i].slug,
          title: sampled[i].title,
          programUrl: sampled[i].programUrl ?? '',
          httpStatus: null,
          status: 'error',
          pageTitle: null,
          durationMs: 0,
        };
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  const alive = samples.filter((s) => s.status === 'ok').length;
  const redirect = samples.filter((s) => s.status === 'redirect').length;
  const dead = samples.filter((s) => s.status === 'dead').length;
  const mismatch = samples.filter((s) => s.status === 'title_mismatch').length;
  const errors = samples.filter(
    (s) => s.status === 'error' || s.status === 'unreachable',
  ).length;
  const freshnessPct =
    sampled.length > 0 ? Math.round((alive / sampled.length) * 100) : 0;

  return {
    slug: u.slug,
    name: u.name,
    totalPrograms: u.programs.length,
    sampled: sampled.length,
    alive,
    redirect,
    dead,
    mismatch,
    errors,
    freshnessPct,
    samples,
  };
}

async function main(): Promise<void> {
  const files = (await readdir(CATALOG_DIR)).filter((f) => f.endsWith('.json'));
  const reports: UniReport[] = [];

  console.log(
    '[verify] sampling ' +
      SAMPLE_PER_UNI +
      ' programs from each of ' +
      files.length +
      ' universities',
  );

  for (const file of files) {
    const raw = await readFile(resolve(CATALOG_DIR, file), 'utf8');
    const u = JSON.parse(raw) as UniversityFields;
    const start = Date.now();
    const report = await verifyUniversity(u);
    const elapsed = Date.now() - start;
    reports.push(report);
    console.log(
      '[verify] ' +
        report.slug.padEnd(20) +
        '· ' +
        report.alive +
        '/' +
        report.sampled +
        ' ok' +
        (report.dead ? ' · ' + report.dead + ' dead' : '') +
        (report.mismatch ? ' · ' + report.mismatch + ' mismatch' : '') +
        (report.errors ? ' · ' + report.errors + ' err' : '') +
        ' (' +
        elapsed +
        'ms, ' +
        report.freshnessPct +
        '%)',
    );
  }

  const totalSampled = reports.reduce((s, r) => s + r.sampled, 0);
  const totalAlive = reports.reduce((s, r) => s + r.alive, 0);
  const overallFreshnessPct =
    totalSampled > 0 ? Math.round((totalAlive / totalSampled) * 100) : 0;

  const payload: VerifyPayload = {
    generatedAt: new Date().toISOString(),
    sampleSize: SAMPLE_PER_UNI,
    totalSampled,
    totalAlive,
    overallFreshnessPct,
    reports,
  };

  await mkdir(dirname(OUTPUT_FILE), { recursive: true });
  await writeFile(OUTPUT_FILE, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(
    '[verify] done. ' +
      totalAlive +
      '/' +
      totalSampled +
      ' ok (' +
      overallFreshnessPct +
      '%) — wrote ' +
      OUTPUT_FILE,
  );
}

main().catch((err) => {
  console.error('[verify] fatal:', err);
  process.exit(1);
});
