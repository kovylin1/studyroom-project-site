// One-shot + reusable: scrape university photos from Kaplan partner pages and
// patch each site/src/content/universities/{slug}.json with a `gallery` field.
//
//   node download-photos.mjs                  # all 16 unis
//   node download-photos.mjs --slug glasgow   # one
//   node download-photos.mjs --force          # re-download even if files exist
//
// Pipeline per uni:
//   1. Read registry row from sources/universities.list.md (aggregatorUrls[0]).
//   2. Fetch the Kaplan partner HTML page.
//   3. Regex-extract image URLs from `kaplan-prod.altis.cloud/tachyon/...jpg`.
//   4. Filter out logos / icons / decorative graphics; pick the first 3 unique.
//   5. Download to site/public/photos/{slug}/{1,2,3}.jpg.
//   6. Patch site/src/content/universities/{slug}.json with gallery.items[].
//
// This module is also imported by scraper/src/cli.ts (dynamic import) so a full
// `npm run scrape -- --all` automatically refreshes photos.

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as cheerioLoad } from 'cheerio';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const REGISTRY_FILE = resolve(PROJECT_ROOT, 'sources/universities.list.md');
const CATALOG_DIR = resolve(PROJECT_ROOT, 'site/src/content/universities');
const PHOTOS_DIR = resolve(PROJECT_ROOT, 'site/public/photos');

// Kaplan's photo CDN URL pattern. `tachyon/sites/4/YYYY/MM/file.jpg` is stable
// across both legacy host (`kaplan-prod.altis.cloud`, used for older UK photos)
// and current host (`www.kaplanpathways.com`, used for newer photos including
// every Canadian partner). The original regex matched only the legacy host so
// Canadian partner pages came back empty until this was broadened.
const KAPLAN_IMG_RE =
  /https:\/\/(?:kaplan-prod\.altis\.cloud|www\.kaplanpathways\.com)\/tachyon\/sites\/4\/\d{4}\/\d{2}\/[\w.-]+\.jpe?g/gi;

const SKIP_FRAGMENTS = ['logo', 'icon', 'flag', 'arrow', 'chevron', 'spinner', 'placeholder', 'logo-raster'];

export async function readRegistryRows() {
  const raw = await readFile(REGISTRY_FILE, 'utf8');
  const rows = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').map((c) => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
    if (cells.length < 8) continue;
    const [slug, name, country, city, tier, officialUrl, aggregatorBlob, notes] = cells;
    if (slug === 'slug' || slug.startsWith('---')) continue;
    if (tier !== 'partner' && tier !== 'official' && tier !== 'aggregator') continue;
    rows.push({
      slug,
      name,
      country,
      city,
      tier,
      officialUrl,
      aggregatorUrls: aggregatorBlob ? aggregatorBlob.split(',').map((u) => u.trim()).filter(Boolean) : [],
      notes: notes ?? '',
    });
  }
  return rows;
}

function isLikelyCampusPhoto(url) {
  const lower = url.toLowerCase();
  return !SKIP_FRAGMENTS.some((frag) => lower.includes(frag));
}

// Score a Kaplan photo by its URL filename slug AND its <img alt> text.
// Both signals matter — the URL slug usually carries place names ("main-quad",
// "convocation-hall", "PCL-Lounge") while the alt text reveals the human
// subject ("Students having lunch", "International students touring..."). A
// photo with `campus` in the URL but `Students having lunch` in the alt is a
// people-photo, not a building-photo, and we want to push it out of top-10.
function scorePhoto(url, alt) {
  const u = url.toLowerCase();
  const a = (alt || '').toLowerCase();
  const both = u + ' ' + a;
  let score = 0;

  // STRONG positive — named buildings, libraries, aerials, dorm interiors.
  // Reliable signal whether it appears in URL or alt.
  if (/main[-\s]quad|convocation|library|aerial(?:\s|-)view|aerial view|architecture|building exterior|innovation cent|memorial|tower|residence (building|hall)|dorm[-\s]?room|view of|interior of|kitchen|studio flat|\bcci\b|cheko|sngequ|sngequ|gilmorehill|garscube|entrance of/.test(both)) {
    score += 40;
  }

  // STRONG negative — explicit people action verbs ANYWHERE (URL or alt).
  // Match against `both` so people-photos with empty alt are still caught
  // (URL filename usually carries the activity word: "students-cheering",
  // "ALESOrientation", "gardens-socialising").
  if (/socialising|socializing|cheering|orientation|attending|having lunch|having a tour|having a meal|having coffee|smiling|posing|presentation|portrait|graduation|standing in front|chatting|enjoying themselves|relaxing|walking around|sitting on|talking to/.test(both)) {
    score -= 40;
  }

  // MEDIUM negative — "Students <verb>" pattern in alt. Requires both subject
  // AND a known people-activity verb together, so neutral mentions like
  // "Student that resides on campus..." (where the photo is of the room, not
  // the activity) don't get penalized.
  if (/\bstudents?\s+(having|cheering|attending|socialis|outside|working|playing|relaxing|enjoying|chatting|listening|smiling|walking)/.test(a)) {
    score -= 25;
  }
  // URL-filename people-as-subject (last-segment of URL starts with students- / student-,
  // but allow exceptions for known good slugs like `student-in-her-dorm-room`,
  // `Student-Innovation-Center`).
  const filename = u.split('/').pop() || '';
  if (/^students?-(?!in-her|innovation|residence|dorm)/.test(filename)) {
    score -= 25;
  }
  // Also penalize when filename contains `-students-` (mid-slug), e.g.
  // `building-students-Alberta2405053`, `home-sweet-campus-home` (containing
  // "campus" but actually a people-tour shot per alt text).
  if (/-students?-/.test(filename) || /-students?$/.test(filename.replace(/\.\w+$/, ''))) {
    score -= 20;
  }

  // Small bonus when alt text reads like a place description (no people).
  if (a && !/student|people|group|tour|cohort/.test(a) && /\b(campus|building|hall|library|centre|center|residence|exterior)\b/.test(a)) {
    score += 10;
  }

  return score;
}

async function exists(path) {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function fetchKaplanPhotos(partnerUrl) {
  const response = await fetch(partnerUrl, {
    headers: {
      'User-Agent': 'StudyRoom-Scraper/0.4 (+https://studyroom.kz)',
      Accept: 'text/html,application/xhtml+xml',
    },
  });
  if (!response.ok) {
    throw new Error('HTTP ' + response.status + ' for ' + partnerUrl);
  }
  const html = await response.text();

  // Parse <img src + alt> pairs via cheerio so scoring can read alt text too
  // (filename alone misses people-content like "Students having lunch", which
  // is the strongest "this is a people photo" signal). Dedupe by canonical
  // URL (strip query string) so `?resize=…&crop=…` variants of the same image
  // don't count twice.
  const $ = cheerioLoad(html);
  const collected = new Map(); // canonicalUrl -> { fullUrl, alt }
  $('img[src]').each((_, el) => {
    const src = $(el).attr('src') || '';
    const alt = $(el).attr('alt') || '';
    KAPLAN_IMG_RE.lastIndex = 0;
    if (!KAPLAN_IMG_RE.test(src)) return;
    KAPLAN_IMG_RE.lastIndex = 0;
    if (!isLikelyCampusPhoto(src)) return;
    const canonical = src.split('?')[0];
    // First occurrence wins, but prefer entries that DO have alt text over
    // those that don't (alt is essential for scoring people-photos).
    const existing = collected.get(canonical);
    if (!existing) {
      collected.set(canonical, { fullUrl: src, alt });
    } else if (!existing.alt && alt) {
      collected.set(canonical, { fullUrl: src, alt });
    }
  });

  // Sort by content-quality score (buildings + interiors first, people last)
  // so the top-10 slice the page actually consumes is the best mix available.
  // No hard cut-off — even negative-score photos are kept in case a uni's
  // page is mostly people-content; the page consumer (`[slug].astro`) already
  // dedupes hero ↔ gallery and `cli.ts` keeps adjacent sections distinct.
  // Stable: equal-score entries keep their page order.
  let i = 0;
  const scored = [];
  for (const [, { fullUrl, alt }] of collected) {
    scored.push({ url: fullUrl, alt, score: scorePhoto(fullUrl, alt), i: i++ });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((x) => x.url);
}

async function downloadJpg(url, outPath) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'StudyRoom-Scraper/0.4 (+https://studyroom.kz)',
      Accept: 'image/jpeg,image/*',
    },
  });
  if (!response.ok) {
    throw new Error('HTTP ' + response.status + ' for ' + url);
  }
  const buf = Buffer.from(await response.arrayBuffer());
  await writeFile(outPath, buf);
  return buf.length;
}

/** Download up to 3 photos for one uni and return GalleryItem[] (public-URL form). */
export async function fetchAndSaveGallery(row, opts = {}) {
  const { force = false } = opts;
  if (!row.aggregatorUrls || row.aggregatorUrls.length === 0) {
    return { slug: row.slug, items: [], skipped: 'no partner URL' };
  }
  const partnerUrl = row.aggregatorUrls[0];

  const urls = await fetchKaplanPhotos(partnerUrl);
  if (urls.length === 0) {
    return { slug: row.slug, items: [], skipped: 'no images on page' };
  }

  // Up to 10 unique campus photos per uni — enough to give the hero (2) and
  // up to 6 faculty cards distinct images without repeats. Pages with fewer
  // available photos just yield fewer items; consumer (slug page) cycles.
  const picked = urls.slice(0, 10);
  const slugDir = resolve(PHOTOS_DIR, row.slug);
  await mkdir(slugDir, { recursive: true });

  const items = [];
  for (let i = 0; i < picked.length; i += 1) {
    const idx = i + 1;
    const outPath = resolve(slugDir, idx + '.jpg');
    if (!force && (await exists(outPath))) {
      items.push({ img: '/photos/' + row.slug + '/' + idx + '.jpg', caption: 'Кампус ' + row.name });
      continue;
    }
    try {
      await downloadJpg(picked[i], outPath);
      items.push({ img: '/photos/' + row.slug + '/' + idx + '.jpg', caption: 'Кампус ' + row.name });
    } catch (err) {
      console.warn('[warn] ' + row.slug + ' photo ' + idx + ' failed: ' + err.message);
    }
  }
  return { slug: row.slug, items };
}

export async function patchUniversityJson(slug, items) {
  const jsonPath = resolve(CATALOG_DIR, slug + '.json');
  if (!(await exists(jsonPath))) {
    console.warn('[warn] no JSON to patch: ' + jsonPath);
    return false;
  }
  const raw = await readFile(jsonPath, 'utf8');
  const data = JSON.parse(raw);
  data.gallery = { items };
  await writeFile(jsonPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  return true;
}

function parseArgs(argv) {
  let only = null;
  let force = false;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--slug') only = argv[++i] ?? null;
    else if (a === '--force') force = true;
  }
  return { only, force };
}

async function main() {
  const { only, force } = parseArgs(process.argv.slice(2));
  const rows = await readRegistryRows();
  const targets = only ? rows.filter((r) => r.slug === only) : rows;
  if (targets.length === 0) {
    console.error('No matching registry rows. Known: ' + rows.map((r) => r.slug).join(', '));
    process.exit(2);
  }

  let ok = 0;
  let failed = 0;
  for (const row of targets) {
    try {
      const result = await fetchAndSaveGallery(row, { force });
      if (result.skipped) {
        console.warn('[skip] ' + row.slug + ' (' + result.skipped + ')');
        continue;
      }
      const patched = await patchUniversityJson(row.slug, result.items);
      console.log(
        '[ok]   ' + row.slug + '  ' + result.items.length + ' photos · json ' + (patched ? 'patched' : 'NOT FOUND')
      );
      ok += 1;
    } catch (err) {
      console.error('[fail] ' + row.slug + ': ' + err.message);
      failed += 1;
    }
  }
  console.log('\nDone: ' + ok + ' ok, ' + failed + ' failed.');
  process.exit(failed > 0 ? 1 : 0);
}

// Reliable across platforms (Windows-friendly): compare the script's own
// realpath via fileURLToPath() to process.argv[1].
const thisFile = fileURLToPath(import.meta.url);
const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === thisFile;
if (invokedDirectly) {
  main().catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
  });
}
