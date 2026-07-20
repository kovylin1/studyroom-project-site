#!/usr/bin/env node
// scrape-requirements.mjs — СОВА v2: директор вступительных требований.
// Добывает IELTS/TOEFL/Duolingo/GPA/exams с официальных сайтов вузов.
// FILL-NULL: никогда не перезаписывает уже заполненные поля requirements.
// Провенанс пишет в requirements.provenance (вне Zod-схемы requirements,
// но безопасно — как дополнительное поле объекта).
//
// FIX v2:
//   1. AGG_DOMAINS расширен (oxfordinternational, edvoy, kaplan и т.д.);
//      resolveOfficialSite возвращает null (→ no-site) если только агрегатор.
//   2. confidence честный: quality зависит от кол-ва совпадений; corroborated =
//      значение найдено на ≥2 РАЗНЫХ страницах (не просто pages.length >= 2).
//      Поле пишется ТОЛЬКО при passes(confidence). Значения варьируются между вузами.
//   3. exams[] = ТОЛЬКО вступительные (SAT/ACT/GMAT/GRE/MAT/LNAT/UCAT/BMAT/GAMSAT).
//      IELTS/TOEFL/Duolingo идут ТОЛЬКО в language{}, НИКОГДА в exams[].
//   4. Устойчивость: per-uni try/catch; таймаут fetchPage 15 s; лимит страниц 5;
//      лог пишется построчно; процесс не падает при сетевых ошибках.
//
// Usage:
//   node scraper/scrape-requirements.mjs [--max-live=N] [--only=<slug>]
//   node scraper/scrape-requirements.mjs --dry-run --only=acadia
//
// Лог: scraper/sources/requirements.log

import fs from 'fs/promises';
import { existsSync, mkdirSync, createWriteStream } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { scoreFact, passes } from './lib/confidence.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const CATALOG_DIR = path.join(PROJECT_ROOT, 'site', 'src', 'content', 'universities');
const LOG_PATH = path.join(__dirname, 'sources', 'requirements.log');

// ── CLI args ──────────────────────────────────────────────────────────────────
const arg = (p) => (process.argv.find(a => a.startsWith(p)) || '').slice(p.length) || null;
const MAX_LIVE = parseInt(arg('--max-live=') || '999999', 10);
const ONLY = arg('--only=');
const DRY_RUN = process.argv.includes('--dry-run');
const CONCURRENCY = parseInt(arg('--concurrency=') || '4', 10);

const NOW = new Date().toISOString();
const log = (...a) => process.stderr.write(`[СОВА] ${new Date().toISOString().slice(11, 19)} ${a.join(' ')}\n`);

// ── FIX 1: расширенный список агрегаторов ─────────────────────────────────────
// Если домен совпадает — это НЕ официальный сайт вуза; пропускаем.
const AGG_DOMAINS = /edvoy|studygroup|kaplanpathways|kaplan\.com|navitas\.com|catseducation|cats\.ac\.uk|qs\.com|topuniversities|collabgroup|collabhq|wikipedia\.org|qahighereducation|oxfordinternational|oicolleges|hotcourses|timeshighereducation|studyabroad|scholarshipportal|mastersportal|bachelorsportal|phdportal|studyportals|coursesinaustralia|unipage|applyboard|keystone\.com|idp\.com|britishcouncil\.org|theuniguide|ucas\.com|whatuni|unistats|discoveruni/i;

function isAggregator(urlStr) {
  try {
    const h = new URL(urlStr).hostname.toLowerCase().replace(/^www\./, '');
    return AGG_DOMAINS.test(h);
  } catch {
    return false;
  }
}

// ── Official site resolver ────────────────────────────────────────────────────
// Returns the official uni root URL, or null if only aggregator sources found.
function resolveOfficialSite(u) {
  // 1. sourceUrl if not aggregator
  if (u.sourceUrl && !isAggregator(u.sourceUrl)) {
    try {
      new URL(u.sourceUrl); // validate
      const parsed = new URL(u.sourceUrl);
      return `${parsed.protocol}//${parsed.hostname}`;
    } catch { /* fall through */ }
  }

  // 2. websiteUrl (some entries have this)
  if (u.websiteUrl && !isAggregator(u.websiteUrl)) {
    try {
      new URL(u.websiteUrl);
      const parsed = new URL(u.websiteUrl);
      return `${parsed.protocol}//${parsed.hostname}`;
    } catch { /* fall through */ }
  }

  // 3. programUrl of first explicitly-official program
  for (const p of u.programs || []) {
    try {
      if (p.source === 'official' && p.programUrl && !isAggregator(p.programUrl)) {
        const u2 = new URL(p.programUrl);
        return `${u2.protocol}//${u2.hostname}`;
      }
    } catch { /* skip */ }
  }

  // 4. first non-agg programUrl (any source)
  for (const p of u.programs || []) {
    try {
      if (p.programUrl && !isAggregator(p.programUrl)) {
        const u2 = new URL(p.programUrl);
        return `${u2.protocol}//${u2.hostname}`;
      }
    } catch { /* skip */ }
  }

  // Only aggregator/unknown sources → cannot determine official site
  return null;
}

// ── Fetch helper ──────────────────────────────────────────────────────────────
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

async function fetchPage(url, timeoutMs = 15000) {
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    const r = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8' },
      signal: ac.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!r.ok) return { status: r.status, ok: false, finalUrl: r.url, html: '' };
    const html = await r.text();
    return { status: r.status, ok: true, finalUrl: r.url, html };
  } catch (e) {
    return { status: 0, ok: false, finalUrl: url, html: '', err: e.message };
  }
}

// ── Admissions page candidates ────────────────────────────────────────────────
const ADM_PATHS = [
  '/international/entry-requirements',
  '/international/admissions',
  '/international/how-to-apply',
  '/international/apply',
  '/study/international',
  '/admissions/international',
  '/admissions/entry-requirements',
  '/entry-requirements',
  '/admissions',
  '/how-to-apply',
  '/apply',
  '/international',
  '/study-with-us/entry-requirements',
  '/study-with-us/how-to-apply',
  '/future-students/admissions',
  '/future-students/international',
  '/undergraduate/admission',
  '/graduate/admission',
];

const ADM_LINK_RE = /\b(admissions?|entry.?requirements?|how.?to.?apply|international.?students?|apply.?now|undergraduate.?requirements?|postgraduate.?requirements?|future.?students?)\b/i;

// ── HTML stripping ────────────────────────────────────────────────────────────
function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ');
}

// ── FIX 3: exams = ONLY entrance exams, NOT language tests ───────────────────
// Short ambiguous acronyms (SAT, ACT, GRE, MAT) require uppercase match AND
// an admissions context window to avoid false positives from ordinary English words.
const ENTRANCE_EXAMS = ['SAT', 'ACT', 'GMAT', 'GRE', 'LNAT', 'UCAT', 'BMAT', 'GAMSAT', 'MCAT'];

// Admissions context: must appear within 120 chars of the exam keyword
const EXAM_ADMIT_CTX = /\b(admission|entry requirement|require|test score|exam|standardized|undergraduate|graduate|minimum score|application)\b/i;

// Ambiguous short words that match common English — require uppercase + context
const AMBIGUOUS_EXAMS = new Set(['SAT', 'ACT', 'GRE', 'MAT']);

function extractExams(textByPage) {
  const found = new Set();
  const allText = textByPage.join('\n');

  for (const exam of ENTRANCE_EXAMS) {
    if (AMBIGUOUS_EXAMS.has(exam)) {
      // Must appear as UPPERCASE acronym (not 'sat', 'act', 'gre') AND have context
      const re = new RegExp(`\\b${exam}\\b`, 'g'); // case-sensitive via no 'i' flag
      for (const m of allText.matchAll(re)) {
        const ctx = allText.slice(Math.max(0, m.index - 120), m.index + 120);
        if (EXAM_ADMIT_CTX.test(ctx)) { found.add(exam); break; }
      }
    } else {
      // Unambiguous long acronyms (GMAT, LNAT, UCAT, BMAT, GAMSAT, MCAT)
      // Still require admissions context to be safe
      const re = new RegExp(`\\b${exam}\\b`, 'ig');
      for (const m of allText.matchAll(re)) {
        const ctx = allText.slice(Math.max(0, m.index - 120), m.index + 120);
        if (EXAM_ADMIT_CTX.test(ctx)) { found.add(exam); break; }
      }
    }
  }
  return [...found];
}

// ── Extraction with per-page tracking (for real corroboration) ────────────────
function extractIELTSFromText(text) {
  const patterns = [
    /IELTS\s+(?:Academic\s+)?(?:score\s+)?(?:of\s+)?(\d+(?:\.\d)?)\s*(?:\(overall\))?/gi,
    /(?:overall|minimum|minimum overall)\s+(?:score\s+of\s+)?(\d+(?:\.\d)?)\s*(?:in\s+IELTS|IELTS)/gi,
    /IELTS[^0-9]{0,30}?(\d+(?:\.\d)?)/gi,
  ];
  const vals = [];
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      const v = parseFloat(m[1]);
      if (v >= 4.0 && v <= 9.0) vals.push(v);
    }
  }
  return vals;
}

function extractTOEFLFromText(text) {
  const patterns = [
    /TOEFL\s+i?B?T?\s*(?:score\s+)?(?:of\s+)?(\d{2,3})/gi,
    /TOEFL[^0-9]{0,30}?(\d{2,3})\s*(?:points?|marks?)?/gi,
  ];
  const vals = [];
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      const v = parseInt(m[1], 10);
      if (v >= 40 && v <= 120) vals.push(v);
    }
  }
  return vals;
}

function extractDuolingoFromText(text) {
  const patterns = [
    /Duolingo\s+(?:English\s+Test\s+)?(?:score\s+)?(?:of\s+)?(\d{2,3})/gi,
    /DET\s+(?:score\s+)?(?:of\s+)?(\d{2,3})/gi,
  ];
  const vals = [];
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      const v = parseInt(m[1], 10);
      if (v >= 60 && v <= 160) vals.push(v);
    }
  }
  return vals;
}

function pctToGpa(pct) {
  if (pct < 50 || pct > 100) return null;
  return Math.round(((pct - 50) / 50 * 2.0 + 2.0) * 10) / 10;
}

function extractGPAFromText(text) {
  const vals = [];
  // Only match explicit "GPA of X" or "GPA X/4" patterns — no percent heuristics
  // (percent-to-GPA conversion too noisy: matches unrelated numbers like "100% pass rate")
  for (const m of text.matchAll(/\bGPA\s+(?:of\s+)?(\d+(?:\.\d+)?)\s*(?:\/\s*4(?:\.0)?)?/gi)) {
    const v = parseFloat(m[1]);
    if (v >= 1.5 && v <= 4.0) vals.push(v);
  }
  // "minimum GPA: X" or "GPA: X.X" patterns
  for (const m of text.matchAll(/\bGPA\s*[:=]\s*(\d+(?:\.\d+)?)/gi)) {
    const v = parseFloat(m[1]);
    if (v >= 1.5 && v <= 4.0) vals.push(v);
  }
  return vals;
}

// ── FIX 2: Real corroboration — value found on ≥2 distinct pages ─────────────
function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function extractWithCorroboration(pages, extractFn) {
  // Returns { value, corroborated, matchCount }
  // corroborated = same value (within tolerance) found on ≥2 different pages
  const perPage = pages.map(p => extractFn(stripHtml(p.html)));
  const allVals = perPage.flat();
  if (!allVals.length) return { value: null, corroborated: false, matchCount: 0 };

  const med = median(allVals);
  // Count how many pages contain a value close to the median
  const pagesWithValue = perPage.filter(vals =>
    vals.some(v => Math.abs(v - med) < 0.26)
  ).length;

  return {
    value: med,
    corroborated: pagesWithValue >= 2,
    matchCount: allVals.length,
  };
}

// ── Require explicit admissions context for IELTS/TOEFL/GPA ──────────────────
// Pages must contain admission-related keywords near the value
const ADMISSION_CONTEXT_RE = /\b(admission|entry\s+requirement|minimum\s+requirement|english\s+requirement|language\s+requirement|international\s+student|apply|undergraduate|graduate|postgraduate|enrol)\b/i;

function pageHasAdmissionsContext(text) {
  return ADMISSION_CONTEXT_RE.test(text);
}

// ── Fetch admissions pages for a university ──────────────────────────────────
async function fetchAdmissionsPages(base) {
  const visited = new Set();
  const pages = [];

  // Fetch homepage
  const home = await fetchPage(base);
  if (!home.ok) return pages;

  const baseUrl = (() => { try { return new URL(home.finalUrl || base); } catch { return null; } })();

  // Build queue: static candidates
  const queue = ADM_PATHS.map(p => {
    try { return new URL(p, base).href; } catch { return null; }
  }).filter(Boolean);

  // Discover admissions links from homepage
  if (baseUrl) {
    for (const m of home.html.matchAll(/href=["']([^"'#?][^"']*?)["']/gi)) {
      try {
        const link = new URL(m[1], baseUrl);
        if (link.hostname === baseUrl.hostname && ADM_LINK_RE.test(link.pathname + link.href)) {
          queue.push(link.href);
        }
      } catch { /* skip */ }
    }
  }

  // Include homepage if it has admissions context
  const homeText = stripHtml(home.html);
  if (pageHasAdmissionsContext(homeText)) {
    pages.push({ url: home.finalUrl || base, html: home.html });
  }
  visited.add(home.finalUrl || base);
  visited.add(base);

  // Fetch up to 5 admissions pages (limit reduced from 6 for realism)
  const MAX_PAGES = 5;
  for (const url of queue.slice(0, 25)) {
    if (visited.has(url)) continue;
    visited.add(url);
    if (pages.length >= MAX_PAGES) break;
    const page = await fetchPage(url);
    if (!page.ok) continue;
    // Only keep pages with admission-related text
    const txt = stripHtml(page.html);
    if (pageHasAdmissionsContext(txt)) {
      pages.push({ url: page.finalUrl || url, html: page.html });
    }
  }

  return pages;
}

// ── Process one university ────────────────────────────────────────────────────
async function processUni(u) {
  const slug = u.slug;
  const req = u.requirements || {};
  const lang = req.language || {};

  // FIX 3: treat existing exams[] as dirty if it contains language tests
  const LANG_TESTS = /^(ielts|toefl|duolingo|pte|cae|cpe|cambridge\s|det\b)/i;
  const existingExams = (req.exams || []).filter(e => !LANG_TESTS.test(e));
  // If exams had language tests, force re-check
  const hadDirtyExams = (req.exams || []).some(e => LANG_TESTS.test(e));

  const needsIelts    = lang.ielts    == null;
  const needsToefl    = lang.toefl    == null;
  const needsDuolingo = lang.duolingo == null;
  const needsGpa      = req.gpa       == null;
  const needsExams    = existingExams.length === 0;

  const nothingNeeded = !needsIelts && !needsToefl && !needsDuolingo && !needsGpa && !needsExams && !hadDirtyExams;
  if (nothingNeeded) {
    return { slug, status: 'skip-full', ielts: null, toefl: null, duolingo: null, gpa: null, exams: [] };
  }

  // FIX 1: use extended aggregator check
  const base = resolveOfficialSite(u);
  if (!base) {
    return { slug, status: 'no-site', ielts: null, toefl: null, duolingo: null, gpa: null, exams: [] };
  }

  let pages;
  try {
    pages = await fetchAdmissionsPages(base);
  } catch (e) {
    return { slug, status: 'no-data', ielts: null, toefl: null, duolingo: null, gpa: null, exams: [], base, err: e.message };
  }

  if (!pages.length) {
    return { slug, status: 'no-data', ielts: null, toefl: null, duolingo: null, gpa: null, exams: [], base };
  }

  const sourceUrls = pages.map(p => p.url);

  // FIX 2: Extract with real per-page corroboration
  const ieltsR  = needsIelts    ? extractWithCorroboration(pages, extractIELTSFromText)    : null;
  const toeflR  = needsToefl    ? extractWithCorroboration(pages, extractTOEFLFromText)    : null;
  const duoR    = needsDuolingo ? extractWithCorroboration(pages, extractDuolingoFromText) : null;
  const gpaR    = needsGpa      ? extractWithCorroboration(pages, extractGPAFromText)      : null;
  const rawExams = needsExams   ? extractExams(pages.map(p => stripHtml(p.html)))          : [];

  const hasData = (ieltsR?.value != null) || (toeflR?.value != null) ||
                  (duoR?.value != null)   || (gpaR?.value != null)   ||
                  rawExams.length > 0;

  if (!hasData) {
    return { slug, status: 'no-data', ielts: null, toefl: null, duolingo: null, gpa: null, exams: [], base };
  }

  // FIX 2: Honest confidence per-field
  // quality: based on matchCount (more matches = higher quality signal)
  function fieldConfidence(extracted, corroborated) {
    if (!extracted || extracted.value == null) return 0;
    const mc = extracted.matchCount || 1;
    const quality = mc >= 3 ? 0.9 : mc === 2 ? 0.7 : 0.5;
    return scoreFact({
      sourceTier: 'official',
      quality,
      corroborated: corroborated ?? extracted.corroborated,
      linkLive: true,
    });
  }

  const ieltsConf  = fieldConfidence(ieltsR);
  const toeflConf  = fieldConfidence(toeflR);
  const duoConf    = fieldConfidence(duoR);
  const gpaConf    = fieldConfidence(gpaR);

  // Overall confidence = average of fields that have data
  const confVals = [
    ieltsR?.value  != null ? ieltsConf  : null,
    toeflR?.value  != null ? toeflConf  : null,
    duoR?.value    != null ? duoConf    : null,
    gpaR?.value    != null ? gpaConf    : null,
    rawExams.length > 0    ? scoreFact({ sourceTier: 'official', quality: 0.6, corroborated: false, linkLive: true }) : null,
  ].filter(v => v != null);
  const overallConf = confVals.length ? confVals.reduce((a, b) => a + b) / confVals.length : 0;

  const result = {
    slug,
    status: 'found',
    ielts:    (passes(ieltsConf)  && needsIelts)    ? ieltsR.value    : null,
    toefl:    (passes(toeflConf)  && needsToefl)    ? toeflR.value    : null,
    duolingo: (passes(duoConf)    && needsDuolingo) ? duoR.value      : null,
    gpa:      (passes(gpaConf)    && needsGpa)      ? gpaR.value      : null,
    exams:    needsExams ? rawExams : existingExams,
    confidence: Math.round(overallConf * 100) / 100,
    sourceUrls,
  };

  // No fields passed confidence gate → no-data
  const anyPassed = result.ielts != null || result.toefl != null ||
                    result.duolingo != null || result.gpa != null ||
                    result.exams.length > 0;
  if (!anyPassed) {
    return { slug, status: 'no-data', ielts: null, toefl: null, duolingo: null, gpa: null, exams: [], base };
  }

  // Write to catalog (fill-null only; FIX 3: also fix dirty exams)
  if (!DRY_RUN) {
    let changed = false;

    if (!u.requirements) u.requirements = { exams: [] };
    if (!u.requirements.language) u.requirements.language = {};
    if (!Array.isArray(u.requirements.exams)) u.requirements.exams = [];

    if (needsIelts && result.ielts != null) {
      u.requirements.language.ielts = result.ielts;
      changed = true;
    }
    if (needsToefl && result.toefl != null) {
      u.requirements.language.toefl = result.toefl;
      changed = true;
    }
    if (needsDuolingo && result.duolingo != null) {
      u.requirements.language.duolingo = result.duolingo;
      changed = true;
    }
    if (needsGpa && result.gpa != null) {
      u.requirements.gpa = result.gpa;
      changed = true;
    }
    if (needsExams && result.exams.length > 0) {
      u.requirements.exams = result.exams;
      changed = true;
    } else if (hadDirtyExams) {
      // Remove language tests from existing exams array
      u.requirements.exams = existingExams; // already filtered above
      if (existingExams.length !== (req.exams || []).length) changed = true;
    }

    if (changed) {
      // FIX 1: _source = domain of the university's own site
      const sourceDomain = (() => { try { return new URL(base).hostname; } catch { return base; } })();
      u.requirements.provenance = {
        _source: sourceDomain,
        _sourceUrl: sourceUrls[0] || base,
        _confidence: result.confidence,
        _checkedAt: NOW,
        _pages: sourceUrls.length,
      };

      const filePath = path.join(CATALOG_DIR, `${slug}.json`);
      try {
        await fs.writeFile(filePath, JSON.stringify(u, null, 2) + '\n');
        result.written = true;
      } catch (e) {
        log(`WRITE ERROR ${slug}: ${e.message}`);
      }
    }
  }

  return result;
}

// ── main ──────────────────────────────────────────────────────────────────────

mkdirSync(path.join(__dirname, 'sources'), { recursive: true });

// Open log file in append mode for resilient per-uni streaming
const logStream = createWriteStream(LOG_PATH, { flags: 'a' });
const logLine = (s) => { logStream.write(s + '\n'); };

let files = (await fs.readdir(CATALOG_DIR)).filter(f => f.endsWith('.json'));
if (ONLY) files = files.filter(f => f === `${ONLY}.json`);
files = files.slice(0, MAX_LIVE);

log(`СОВА v2: ${files.length} unis, concurrency=${CONCURRENCY}, dry=${DRY_RUN}`);

let totalFound = 0, totalSkipped = 0, totalNoSite = 0, totalNoData = 0, totalError = 0;

let idx = 0;
async function worker() {
  while (idx < files.length) {
    const f = files[idx++];
    const slug = f.replace(/\.json$/, '');
    let u;
    try {
      u = JSON.parse(await fs.readFile(path.join(CATALOG_DIR, f), 'utf8'));
    } catch (e) {
      log(`SKIP ${slug}: unreadable: ${e.message}`);
      continue;
    }

    let res;
    try {
      res = await processUni(u);
    } catch (e) {
      res = { slug, status: 'error', err: e.message, ielts: null, toefl: null, duolingo: null, gpa: null, exams: [] };
    }

    const examsStr = res.exams?.length ? `[${res.exams.join(',')}]` : '[]';
    const conf = res.confidence != null ? `conf=${res.confidence.toFixed(2)}` : '';
    const line = `${slug}: ielts=${res.ielts ?? 'null'} toefl=${res.toefl ?? 'null'} duolingo=${res.duolingo ?? 'null'} gpa=${res.gpa ?? 'null'} exams=${examsStr} ${conf} status=${res.status}${res.err ? ' err=' + res.err : ''}`;
    logLine(line);

    if (res.status === 'found') {
      totalFound++;
      process.stderr.write(`  OK ${line}\n`);
    } else if (res.status === 'skip-full') {
      totalSkipped++;
    } else if (res.status === 'no-site') {
      totalNoSite++;
    } else if (res.status === 'error') {
      totalError++;
      log(`ERR ${line}`);
    } else {
      totalNoData++;
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));

logStream.end();

log(`done: found=${totalFound} skip-full=${totalSkipped} no-site=${totalNoSite} no-data=${totalNoData} error=${totalError}`);
log(`log: ${LOG_PATH}`);

console.log(JSON.stringify({
  script: 'sova-v2', dryRun: DRY_RUN,
  total: files.length, found: totalFound, skipFull: totalSkipped,
  noSite: totalNoSite, noData: totalNoData, error: totalError,
}));
process.exit(0);
