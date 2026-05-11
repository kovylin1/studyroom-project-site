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

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const REGISTRY_FILE = resolve(PROJECT_ROOT, 'sources/universities.list.md');
const CATALOG_DIR = resolve(PROJECT_ROOT, 'site/src/content/universities');
const PHOTOS_DIR = resolve(PROJECT_ROOT, 'site/public/photos');

// Kaplan's photo CDN URL pattern. `tachyon/sites/4/YYYY/MM/file.jpg` is stable.
const KAPLAN_IMG_RE =
  /https:\/\/kaplan-prod\.altis\.cloud\/tachyon\/sites\/4\/\d{4}\/\d{2}\/[\w.-]+\.jpe?g/gi;

const SKIP_FRAGMENTS = ['logo', 'icon', 'flag', 'arrow', 'chevron', 'spinner', 'placeholder'];

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
  const matches = html.match(KAPLAN_IMG_RE) ?? [];
  const unique = Array.from(new Set(matches)).filter(isLikelyCampusPhoto);
  return unique;
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
