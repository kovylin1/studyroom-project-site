// Pilot photo-set downloader for Stage 11, item 4.
//
//   node pilot-photo-sets.mjs --slug glasgow
//
// Pulls up to 10 photos per category × 4 categories per uni:
//   1. general          — Wikipedia article + Wikimedia Commons category (uni exteriors, main buildings).
//   2. studentsFaculty  — Kaplan partner page <img> set, with PEOPLE-photos kept (inverse of the
//                         default download-photos.mjs filter which drops people-shots).
//   3. campuses         — Wikimedia Commons category, second-tier building photos.
//   4. accommodation    — Kaplan accommodation page (Glasgow has a dedicated college accommodation
//                         page with multiple interior shots) + uni accommodation page fallback.
//
// Output:
//   site/public/photos/{slug}/{general,studentsFaculty,campuses,accommodation}/{N}.jpg
//   site/src/content/universities/{slug}.json gets a `photoSets` object pointing at those paths.
//
// Curated Wikimedia file titles live inline in `WIKIMEDIA_SEEDS` below.

import { writeFile, mkdir, readFile, access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as cheerioLoad } from 'cheerio';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const CATALOG_DIR = resolve(PROJECT_ROOT, 'site/src/content/universities');
const PHOTOS_DIR = resolve(PROJECT_ROOT, 'site/public/photos');
const REGISTRY_FILE = resolve(PROJECT_ROOT, 'sources/universities.list.md');

const USER_AGENT = 'StudyRoom-Scraper/0.1 (+https://studyroom.kz)';

// Manual seed data per uni — for the pilot we cover Glasgow. Other unis use
// Wikimedia category scan only. Future: lift this into a TS module similar to
// campus-facts.ts.
const WIKIMEDIA_SEEDS = {
  glasgow: {
    wikipediaArticle: 'University_of_Glasgow',
    commonsCategory: 'Category:University_of_Glasgow',
    // Hand-picked general / hero shots (best photos of main buildings, exteriors).
    generalFiles: [
      'Glasgow University 3.jpg',
      'GlasgowUniversityLibrary2017.jpg',
      'Cloisters, University Of Glasgow.jpg',
      'Old College Quad.jpg',
      'Boyd Orr Building.jpg',
      'Boyd-Orr-Building-Wide.png',
      'Clarice Pears Building 001.jpg',
      'Beatson Institute for Cancer Research, Glasgow 01.jpg',
      'Beatson Institute for Cancer Research, Glasgow 02.jpg',
      'History department.jpg',
    ],
    // Specific campus buildings (different from generalFiles).
    campusFiles: [
      '42 BUTE GARDENS, LILYBANK HOUSE.jpg',
      '57-69 Oakfield Avenue LB32236.jpg',
      '57-69 Oakfield Avenue, Hillhead - geograph.org.uk - 6202694.jpg',
      '70 Oakfield Avenue, Glasgow.jpg',
    ],
  },
};

async function readRegistryRow(slug) {
  const raw = await readFile(REGISTRY_FILE, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').map((c) => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
    if (cells.length < 8) continue;
    if (cells[0] === slug) {
      return {
        slug: cells[0],
        name: cells[1],
        country: cells[2],
        aggregatorUrls: cells[6] ? cells[6].split(',').map((u) => u.trim()).filter(Boolean) : [],
      };
    }
  }
  return null;
}

async function fileExists(path) {
  try { await access(path, fsConstants.F_OK); return true; } catch { return false; }
}

async function ensureDir(path) { await mkdir(path, { recursive: true }); }

async function fetchBytes(url) {
  const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!r.ok) throw new Error(`GET ${url} -> ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

async function resolveWikimediaUrl(fileTitle) {
  const title = fileTitle.startsWith('File:') ? fileTitle : 'File:' + fileTitle;
  const api = 'https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=url|mime|size&titles=' +
    encodeURIComponent(title) + '&format=json';
  const r = await fetch(api, { headers: { 'User-Agent': USER_AGENT } });
  if (!r.ok) return null;
  const j = await r.json();
  const pages = Object.values(j?.query?.pages ?? {});
  const info = pages[0]?.imageinfo?.[0];
  if (!info) return null;
  if (info.mime && !/^image\/(jpeg|png)$/i.test(info.mime)) return null;
  return info.url || null;
}

async function downloadOne(url, destPath) {
  if (await fileExists(destPath)) return { skipped: true, destPath };
  const buf = await fetchBytes(url);
  await writeFile(destPath, buf);
  return { skipped: false, destPath, bytes: buf.length };
}

async function scrapeKaplanImages(uniUrl) {
  const r = await fetch(uniUrl, { headers: { 'User-Agent': USER_AGENT } });
  if (!r.ok) throw new Error(`GET ${uniUrl} -> ${r.status}`);
  const html = await r.text();
  const $ = cheerioLoad(html);
  const out = [];
  const seen = new Set();
  $('img[src]').each((_, el) => {
    const src = $(el).attr('src') || '';
    const alt = $(el).attr('alt') || '';
    if (!/\/tachyon\/.*\.jpe?g/i.test(src)) return;
    if (/logo|icon|flag|arrow|chevron|spinner|placeholder/i.test(src)) return;
    const canonical = src.split('?')[0];
    if (seen.has(canonical)) return;
    seen.add(canonical);
    out.push({ url: src, alt });
  });
  return out;
}

function scorePeoplePhoto(url, alt) {
  const both = (url + ' ' + (alt || '')).toLowerCase();
  let s = 0;
  if (/students?\s+(having|cheering|attending|socialis|outside|working|enjoying|chatting|smiling|walking|playing|relaxing|posing|listening)/.test(both)) s += 40;
  if (/students?-cheering|students?-having|students?-socialising|students?-lunch|orientation|graduation/.test(both)) s += 35;
  if (/student-innovation|student-life|lecture|workshop|laboratory|library-reading/.test(both)) s += 25;
  if (/exterior|aerial|tower|cathedral|clock-tower|building-only|hall-only/.test(both)) s -= 30;
  return s;
}

async function fetchKaplanAccommodationImages(partnerUrl) {
  const r = await fetch(partnerUrl, { headers: { 'User-Agent': USER_AGENT } });
  if (!r.ok) return [];
  const html = await r.text();
  const $ = cheerioLoad(html);
  const accLink = $('a[href*="/accommodation/"]').first().attr('href');
  if (!accLink) return [];
  const accUrl = new URL(accLink, partnerUrl).toString();
  const r2 = await fetch(accUrl, { headers: { 'User-Agent': USER_AGENT } });
  if (!r2.ok) return [];
  const html2 = await r2.text();
  const $2 = cheerioLoad(html2);
  const seen = new Set();
  const out = [];
  $2('img[src]').each((_, el) => {
    const src = $2(el).attr('src') || '';
    const alt = $2(el).attr('alt') || '';
    if (!/\/tachyon\/.*\.jpe?g/i.test(src)) return;
    if (/logo|icon|flag|arrow|chevron|spinner|placeholder/i.test(src)) return;
    const canonical = src.split('?')[0];
    if (seen.has(canonical)) return;
    seen.add(canonical);
    out.push({ url: src, alt });
  });
  return out;
}

async function processSlug(slug) {
  console.log('[pilot] ' + slug);
  const row = await readRegistryRow(slug);
  if (!row) throw new Error('no registry row for ' + slug);
  const seed = WIKIMEDIA_SEEDS[slug] ?? {};

  const generalDir = resolve(PHOTOS_DIR, slug, 'general');
  await ensureDir(generalDir);
  const generalItems = [];
  let gi = 0;
  for (const fileTitle of seed.generalFiles ?? []) {
    if (generalItems.length >= 10) break;
    try {
      const url = await resolveWikimediaUrl(fileTitle);
      if (!url) continue;
      gi += 1;
      const dest = resolve(generalDir, gi + '.jpg');
      const res = await downloadOne(url, dest);
      generalItems.push({ img: `/photos/${slug}/general/${gi}.jpg`, caption: fileTitle.replace(/\.(jpg|png|jpeg)$/i, '') });
      console.log('  [general]   ' + (res.skipped ? '(cached) ' : '') + dest);
    } catch (err) {
      console.warn('  [general!]  ' + fileTitle + ': ' + err.message);
    }
  }

  const campusDir = resolve(PHOTOS_DIR, slug, 'campuses');
  await ensureDir(campusDir);
  const campusItems = [];
  let ci = 0;
  for (const fileTitle of seed.campusFiles ?? []) {
    if (campusItems.length >= 10) break;
    try {
      const url = await resolveWikimediaUrl(fileTitle);
      if (!url) continue;
      ci += 1;
      const dest = resolve(campusDir, ci + '.jpg');
      const res = await downloadOne(url, dest);
      campusItems.push({ img: `/photos/${slug}/campuses/${ci}.jpg`, caption: fileTitle.replace(/\.(jpg|png|jpeg)$/i, '') });
      console.log('  [campuses]  ' + (res.skipped ? '(cached) ' : '') + dest);
    } catch (err) {
      console.warn('  [campuses!] ' + fileTitle + ': ' + err.message);
    }
  }

  const studentsDir = resolve(PHOTOS_DIR, slug, 'students');
  await ensureDir(studentsDir);
  const studentsItems = [];
  const kaplanUrl = row.aggregatorUrls[0];
  if (kaplanUrl) {
    try {
      const imgs = await scrapeKaplanImages(kaplanUrl);
      const scored = imgs
        .map((x) => ({ ...x, score: scorePeoplePhoto(x.url, x.alt) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
      let si = 0;
      for (const it of scored) {
        si += 1;
        const dest = resolve(studentsDir, si + '.jpg');
        try {
          const res = await downloadOne(it.url, dest);
          studentsItems.push({ img: `/photos/${slug}/students/${si}.jpg`, caption: it.alt });
          console.log('  [students]  ' + (res.skipped ? '(cached) ' : '') + dest + ' (score ' + it.score + ')');
        } catch (err) {
          console.warn('  [students!] ' + it.url + ': ' + err.message);
        }
      }
    } catch (err) {
      console.warn('  [students!] kaplan fetch failed: ' + err.message);
    }
  }

  const accDir = resolve(PHOTOS_DIR, slug, 'accommodation');
  await ensureDir(accDir);
  const accItems = [];
  if (kaplanUrl) {
    try {
      const imgs = await fetchKaplanAccommodationImages(kaplanUrl);
      let ai = 0;
      for (const it of imgs.slice(0, 10)) {
        ai += 1;
        const dest = resolve(accDir, ai + '.jpg');
        try {
          const res = await downloadOne(it.url, dest);
          accItems.push({ img: `/photos/${slug}/accommodation/${ai}.jpg`, caption: it.alt });
          console.log('  [accom]     ' + (res.skipped ? '(cached) ' : '') + dest);
        } catch (err) {
          console.warn('  [accom!]    ' + it.url + ': ' + err.message);
        }
      }
    } catch (err) {
      console.warn('  [accom!]    fetch failed: ' + err.message);
    }
  }

  const jsonPath = resolve(CATALOG_DIR, slug + '.json');
  const json = JSON.parse(await readFile(jsonPath, 'utf8'));
  json.photoSets = {
    ...(generalItems.length ? { general: generalItems } : {}),
    ...(studentsItems.length ? { studentsFaculty: studentsItems } : {}),
    ...(campusItems.length ? { campuses: campusItems } : {}),
    ...(accItems.length ? { accommodation: accItems } : {}),
  };
  await writeFile(jsonPath, JSON.stringify(json, null, 2) + '\n', 'utf8');
  console.log('  [ok]        photoSets: general=' + generalItems.length + ' campuses=' + campusItems.length +
    ' students=' + studentsItems.length + ' accom=' + accItems.length);
}

async function main() {
  const argv = process.argv.slice(2);
  let slug = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--slug') slug = argv[++i];
  }
  if (!slug) {
    console.error('Usage: node pilot-photo-sets.mjs --slug <slug>');
    process.exit(2);
  }
  await processSlug(slug);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
