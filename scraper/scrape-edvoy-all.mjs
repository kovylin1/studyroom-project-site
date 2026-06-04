#!/usr/bin/env node
// Edvoy full-data scrape — Phase 3+4 of discover-edvoy-partners.mjs.
// Logs in to edge.edvoy.com, captures the GraphQL auth token, then pulls
// per-institution data straight from api-prod.edvoy.com (no DOM scraping):
//   - searchInstitutions       -> full partner list (refId + name + country)
//   - findEducationPartnerByRefId -> profile (overview, gallery, logo, address, rankings, keyFacts)
//   - findManyEdpCampus        -> campuses
//   - fetchOnlyCourseList      -> all programs (every level), with intakes/fee/duration
// One JSON file per university -> sources/edvoy-extracts/<slug>.json
// gallery[] stores URLs only. Data goes to disk, never through chat.
//
// Usage: EDVOY_LOGIN=... EDVOY_PASS=... node scraper/scrape-edvoy-all.mjs [--headed] [--limit=N]

import { config } from 'dotenv'; config();
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(PROJECT_ROOT, 'sources', 'edvoy-extracts');

const PORTAL_URL = 'https://edge.edvoy.com/';
const EDP = 'https://api-prod.edvoy.com/edp/graphql';
const PARTNER = 'https://api-prod.edvoy.com/partner/graphql';
const LOGIN = process.env.EDVOY_LOGIN;
const PASS = process.env.EDVOY_PASS;
const CONCURRENCY = 2;

if (!LOGIN || !PASS) { console.error('ERROR: set EDVOY_LOGIN and EDVOY_PASS'); process.exit(1); }
const headed = process.argv.includes('--headed');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;

const log = (...a) => console.error('[edvoy]', ...a);

function slugify(s) {
  return (s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/['‘’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// ---- GraphQL queries (captured from the live portal) ----
const Q_INSTITUTIONS = `query searchInstitutions($filter: CourseFilterInputDto!, $paging: PagingInputDto) {
  searchInstitutions(searchType: SmartSearch, filter: $filter, filterType: "student", paging: $paging, query: "", courseQuery: "") {
    count items { name refId edPartnerType partnerRating address { country } }
  }
}`;

const Q_EDP = `query findEducationPartnerByRefId($refId: String!) {
  findOneEdp(refId: $refId) {
    _id refId slug logoUrl bannerUrl website email mobile partnerRating overview name
    edPartnerType recruitmentType showForIntroducers
    keyFacts { key name value }
    upcomingIntakes { intakeYear intakeMonth }
    address { country countryId city cityId state postalCode address1 }
    edpContent {
      galleryImages
      rankings { title value image }
      highlights { title value image highlightType }
      accreditation { title image }
      employability { title description }
      employabilityRate
      faqs { question answer }
      instagram facebook
    }
  }
}`;

const Q_CAMPUS = `query findManyEdpCampus($edpRefId: String!, $paging: PagingInputDto = {limit: 100, offset: 0, skip: -1}) {
  findManyEdpCampus(edpRefId: $edpRefId, paging: $paging, query: "") {
    count items { _id refId name edpRefId selfFunded edpCampusContent { description } }
  }
}`;

const Q_COURSES = `query fetchOnlyCourseList($filter: CourseFilterInputDto = {}, $paging: PagingInputDto = {limit: 100, offset: 0, skip: -1}) {
  searchCourse(searchType: SmartSearch, enReqRuleFilter: {activateBestFit: false}, filter: $filter, filterType: "student", paging: $paging, query: "") {
    count
    items {
      _id name refId edpRefId courseLevel status approxAnnualFee currency scholarshipTag
      courseIntakes {
        intakeYear intakeMonth attendanceType courseDurationUnit courseDurationUnitValue
        campusRef { name refId address { country } }
      }
      institution { name address { country } }
    }
  }
}`;

// ---- auth ----
let AUTH = null;
async function login(page) {
  log('navigating to portal');
  await page.goto(PORTAL_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.evaluate(() => {
    const c = Array.from(document.querySelectorAll('a,button')).find(el => /^(login|log in|sign in)$/i.test((el.innerText || '').trim()));
    if (c) c.click();
  });
  await page.waitForTimeout(2500);
  const findSel = (arr) => page.evaluate(a => { for (const s of a) if (document.querySelector(s)) return s; return null; }, arr);
  const emailSel = await findSel(['input[type=email]', 'input[name="username"]', 'input[name="email"]', 'input[id*=email i]', 'input[placeholder*=email i]']);
  if (!emailSel) throw new Error('no email field');
  await page.fill(emailSel, LOGIN);
  await page.waitForTimeout(400);
  try { await page.click('button:has-text("Continue")', { timeout: 5000 }); } catch { await page.press(emailSel, 'Enter'); }
  await page.waitForTimeout(3000);
  const passSel = await findSel(['input[type=password]', 'input[name="password"]', 'input[id*=pass i]']);
  if (!passSel) throw new Error('no password field (2FA / blocked?) — auto-mode blocked, tell the operator');
  await page.fill(passSel, PASS);
  await page.waitForTimeout(400);
  try { await page.click('button:has-text("Sign in"), button:has-text("Log in"), button:has-text("Login"), button[type=submit]', { timeout: 5000 }); }
  catch { await page.press(passSel, 'Enter'); }
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await page.waitForFunction(() => { const m = document.querySelector('input[type=password]'); return !m || m.offsetParent === null; }, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(4000);
  if (await page.evaluate(() => /(two.factor|verification code|otp|enter code)/i.test(document.body.innerText.toLowerCase()))) {
    throw new Error('2FA required — auto-mode blocked, tell the operator');
  }
  log('logged in:', page.url());
}

async function acquireToken(page) {
  AUTH = null;
  page.on('request', req => {
    if (/api-prod\.edvoy\.com/.test(req.url())) { const h = req.headers(); if (h['authorization']) AUTH = h['authorization']; }
  });
  await page.goto('https://edge.edvoy.com/search', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(8000);
  if (!AUTH) throw new Error('could not capture auth token');
  log('auth token captured');
}

async function gql(page, endpoint, query, variables, op) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const resp = await page.request.post(endpoint, {
      headers: { 'content-type': 'application/json', authorization: AUTH },
      data: { operationName: op, query, variables },
    });
    if (resp.status() === 401) { log('401 — refreshing token'); await acquireToken(page); continue; }
    const j = await resp.json().catch(() => null);
    if (j && j.data) return j.data;
    if (attempt === 2) throw new Error(`${op} failed: ${JSON.stringify(j?.errors?.[0]?.message || j).slice(0, 160)}`);
    await page.waitForTimeout(1000);
  }
}

// ---- per-institution assembly ----
function fmtDuration(it) {
  if (!it || it.courseDurationUnitValue == null) return null;
  const u = (it.courseDurationUnit || '').replace(/s$/i, '');
  const v = it.courseDurationUnitValue;
  return `${v} ${u}${v > 1 && u ? 's' : ''}`.trim();
}

function buildProgram(c, edpRefId) {
  const intakes = [...new Set((c.courseIntakes || []).map(i => [i.intakeMonth, i.intakeYear].filter(Boolean).join(' ')).filter(Boolean))];
  const dur = fmtDuration((c.courseIntakes || [])[0]);
  return {
    title: c.name,
    level: c.courseLevel || null,
    duration: dur,
    tuition: c.approxAnnualFee != null ? `${c.approxAnnualFee} ${c.currency || ''}`.trim() : null,
    intake: intakes,
    programUrl: `https://edge.edvoy.com/institutions/${edpRefId}`,
    edvoyCourseRefId: c.refId || c._id || null,
    scholarshipTag: c.scholarshipTag || null,
  };
}

async function processInstitution(page, inst) {
  const refId = inst.refId;
  if (!refId) return { status: 'skip-no-refid', name: inst.name };
  const slug = slugify(inst.name) || refId;
  const filePath = path.join(OUT_DIR, `${slug}.json`);

  const edpData = await gql(page, PARTNER, Q_EDP, { refId }, 'findEducationPartnerByRefId');
  const edp = edpData?.findOneEdp || {};

  // all programs (every level), paginate (offset = page index). Campuses are derived from these.
  const programs = [];
  const campusMap = new Map();
  let count = Infinity, pageIdx = 0;
  while (programs.length < count && pageIdx < 200) {
    const d = await gql(page, EDP, Q_COURSES, {
      filter: { edpRefIds: [refId], dataSources: ['ALL', 'EDGE'], showForIntroducers: true },
      paging: { limit: 100, offset: pageIdx, skip: -1 },
    }, 'fetchOnlyCourseList');
    const block = d?.searchCourse;
    if (!block) break;
    count = block.count;
    if (!block.items.length) break;
    for (const c of block.items) {
      programs.push(buildProgram(c, refId));
      for (const it of (c.courseIntakes || [])) {
        const cr = it.campusRef;
        if (cr && cr.refId && !campusMap.has(cr.refId)) {
          campusMap.set(cr.refId, { refId: cr.refId, name: cr.name || null, country: cr.address?.country || null });
        }
      }
    }
    pageIdx++;
  }
  const campuses = [...campusMap.values()];

  const scholarships = [...new Set(programs.map(p => p.scholarshipTag).filter(Boolean))];
  const gallery = Array.isArray(edp.edpContent?.galleryImages) ? edp.edpContent.galleryImages.filter(Boolean) : [];

  const out = {
    slug,
    name: edp.name || inst.name,
    edvoyRefId: refId,
    country: edp.address?.country || inst.address?.country || null,
    city: edp.address?.city || null,
    logoUrl: edp.logoUrl || null,
    bannerUrl: edp.bannerUrl || null,
    website: edp.website || null,
    partnerRating: edp.partnerRating ?? inst.partnerRating ?? null,
    description: edp.overview || null,
    gallery,                       // URLs only
    rankings: edp.edpContent?.rankings || [],
    keyFacts: edp.keyFacts || [],
    highlights: edp.edpContent?.highlights || [],
    scholarships,                  // derived from program scholarshipTag
    accommodation: null,           // not exposed by Edvoy institution API (Stays is a separate surface)
    campuses,
    programs,
    source: 'edvoy',
    sourceUrl: `https://edge.edvoy.com/institutions/${refId}`,
    scrapedAt: new Date().toISOString(),
  };
  await fs.writeFile(filePath, JSON.stringify(out, null, 2) + '\n');
  return {
    status: 'ok', slug, programs: programs.length, campuses: campuses.length,
    scholarships: scholarships.length, gallery: gallery.length,
    logo: out.logoUrl ? 1 : 0, banner: out.bannerUrl ? 1 : 0,
  };
}

// ---- main ----
await fs.mkdir(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: !headed });
const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  viewport: { width: 1440, height: 900 },
});
const page = await ctx.newPage();

const results = [];
try {
  await login(page);
  await acquireToken(page);

  // full partner list
  const institutions = [];
  let count = Infinity, pageIdx = 0;
  while (institutions.length < count && pageIdx < 50) {
    const d = await gql(page, EDP, Q_INSTITUTIONS, {
      filter: { dataSources: ['ALL', 'EDGE'], showForIntroducers: true },
      paging: { limit: 100, offset: pageIdx, skip: -1 },
    }, 'searchInstitutions');
    const block = d?.searchInstitutions;
    if (!block || !block.items.length) break;
    count = block.count;
    institutions.push(...block.items);
    pageIdx++;
  }
  log('institutions to process:', institutions.length, '(catalog count', count + ')');

  const queue = institutions.slice(0, LIMIT);
  let idx = 0;
  async function worker(wid) {
    const wpage = wid === 0 ? page : await ctx.newPage();
    while (idx < queue.length) {
      const i = idx++;
      const inst = queue[i];
      try {
        const r = await processInstitution(wpage, inst);
        results.push(r);
        log(`[${i + 1}/${queue.length}] ${r.slug || inst.name} -> ${r.status}` + (r.programs != null ? ` (${r.programs} progs, ${r.campuses} campuses, ${r.gallery} imgs)` : ''));
      } catch (e) {
        results.push({ status: 'error', name: inst.name, error: e.message });
        log(`[${i + 1}/${queue.length}] ${inst.name} -> ERROR ${e.message}`);
      }
    }
    if (wid !== 0) await wpage.close().catch(() => {});
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, (_, w) => worker(w)));
} catch (e) {
  log('FATAL:', e.message);
} finally {
  await browser.close();
}

const ok = results.filter(r => r.status === 'ok');
const summary = {
  universities: ok.length,
  errors: results.filter(r => r.status === 'error').length,
  programs: ok.reduce((s, r) => s + (r.programs || 0), 0),
  scholarships: ok.reduce((s, r) => s + (r.scholarships || 0), 0),
  accommodation: 0,
  campuses: ok.reduce((s, r) => s + (r.campuses || 0), 0),
  photos: ok.reduce((s, r) => s + (r.gallery || 0) + (r.logo || 0) + (r.banner || 0), 0),
};
console.error('---SUMMARY--- ' + JSON.stringify(summary));
console.log(JSON.stringify(summary, null, 2));
