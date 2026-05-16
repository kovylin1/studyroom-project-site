// Reads scraper/photo-manifests/*.json, downloads each URL to
// site/public/photos/{slug}/, and patches site/src/content/universities/{slug}.json
// with gallery.items[], accommodation[].img, campuses[].img.
//
// Naming: hero.jpg, gallery-N.jpg, accom-N.jpg, campus-N.jpg.
// Failed downloads are skipped silently (img field left undefined).
//   node photos-from-manifests.mjs            # all
//   node photos-from-manifests.mjs --slug kent

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const MANIFESTS_DIR = resolve(__dirname, 'photo-manifests');
const CATALOG_DIR = resolve(PROJECT_ROOT, 'site/src/content/universities');
const PHOTOS_DIR = resolve(PROJECT_ROOT, 'site/public/photos');

// Wikimedia policy requires a meaningful UA with contact + tool name.
const USER_AGENT = 'StudyRoomBot/1.0 (https://studyroom.kz; vassiliy.kovylin@gmail.com) Node-fetch';
const DELAY_MS = 600;     // polite gap between consecutive downloads
const MAX_RETRY = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tryDownload(url, outPath) {
  if (!url) return false;
  for (let attempt = 1; attempt <= MAX_RETRY; attempt += 1) {
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'image/*,*/*;q=0.8' },
        redirect: 'follow',
      });
      if (r.status === 429 || r.status === 503) {
        const ra = parseInt(r.headers.get('retry-after') || '0', 10);
        const wait = ra > 0 ? ra * 1000 : 2000 * attempt;
        console.warn('  [retry ' + attempt + '] ' + r.status + ' wait=' + wait + 'ms ' + url);
        await sleep(wait);
        continue;
      }
      if (!r.ok) { console.warn('  [skip] ' + r.status + ' ' + url); return false; }
      const ct = r.headers.get('content-type') || '';
      if (!/^image\//i.test(ct)) { console.warn('  [skip] not-image ' + ct + ' ' + url); return false; }
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 1024) { console.warn('  [skip] too-small ' + buf.length + 'b ' + url); return false; }
      await writeFile(outPath, buf);
      await sleep(DELAY_MS);
      return true;
    } catch (err) {
      console.warn('  [retry ' + attempt + '] err ' + err.message + ' ' + url);
      await sleep(1000 * attempt);
    }
  }
  return false;
}

function pickExt(url) {
  const m = (url || '').match(/\.(jpe?g|png|webp)(\?|$)/i);
  return m ? m[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg';
}

async function processManifest(manifestPath) {
  const raw = await readFile(manifestPath, 'utf8');
  const m = JSON.parse(raw);
  const slug = m.slug;
  console.log('\n=== ' + slug + ' ===');

  const slugDir = resolve(PHOTOS_DIR, slug);
  await mkdir(slugDir, { recursive: true });

  // 1. Hero + gallery → gallery.items[]
  const galleryItems = [];
  const heroUrl = m.hero?.url;
  if (heroUrl) {
    const ext = pickExt(heroUrl);
    const fname = 'hero.' + ext;
    if (await tryDownload(heroUrl, resolve(slugDir, fname))) {
      galleryItems.push({ img: '/photos/' + slug + '/' + fname, caption: m.hero.caption || '' });
    }
  }
  let gIdx = 1;
  for (const g of (m.gallery || [])) {
    if (!g.url) continue;
    if (heroUrl && g.url === heroUrl) continue; // skip dupe of hero
    const ext = pickExt(g.url);
    const fname = 'gallery-' + gIdx + '.' + ext;
    if (await tryDownload(g.url, resolve(slugDir, fname))) {
      galleryItems.push({ img: '/photos/' + slug + '/' + fname, caption: g.caption || '' });
      gIdx += 1;
    }
  }

  // 2. Accommodation: build name → relative-img map
  const accomImgByName = new Map();
  let aIdx = 1;
  for (const a of (m.accommodation || [])) {
    if (!a.url) continue;
    const ext = pickExt(a.url);
    const fname = 'accom-' + aIdx + '.' + ext;
    if (await tryDownload(a.url, resolve(slugDir, fname))) {
      accomImgByName.set(a.name, '/photos/' + slug + '/' + fname);
      aIdx += 1;
    }
  }

  // 3. Campuses: title → relative-img map
  const campusImgByTitle = new Map();
  let cIdx = 1;
  for (const c of (m.campuses || [])) {
    if (!c.url) continue;
    const ext = pickExt(c.url);
    const fname = 'campus-' + cIdx + '.' + ext;
    if (await tryDownload(c.url, resolve(slugDir, fname))) {
      campusImgByTitle.set(c.title, '/photos/' + slug + '/' + fname);
      cIdx += 1;
    }
  }

  // 4. Patch uni JSON
  const jsonPath = resolve(CATALOG_DIR, slug + '.json');
  const jsonRaw = await readFile(jsonPath, 'utf8');
  const data = JSON.parse(jsonRaw);

  if (galleryItems.length > 0) {
    data.gallery = { items: galleryItems };
  }

  if (Array.isArray(data.accommodation)) {
    data.accommodation = data.accommodation.map((a) => {
      const img = accomImgByName.get(a.name);
      return img ? { ...a, img } : a;
    });
  }

  if (Array.isArray(data.campuses)) {
    data.campuses = data.campuses.map((c) => {
      const img = campusImgByTitle.get(c.title);
      return img ? { ...c, img } : c;
    });
  }

  await writeFile(jsonPath, JSON.stringify(data, null, 2) + '\n', 'utf8');

  console.log('  gallery: ' + galleryItems.length + ' photos');
  console.log('  accommodation: ' + accomImgByName.size + '/' + (m.accommodation?.length || 0) + ' photos matched');
  console.log('  campuses: ' + campusImgByTitle.size + '/' + (m.campuses?.length || 0) + ' photos matched');
}

async function main() {
  const onlySlug = process.argv.includes('--slug')
    ? process.argv[process.argv.indexOf('--slug') + 1]
    : null;

  const files = (await readdir(MANIFESTS_DIR)).filter((f) => f.endsWith('.json'));
  const targets = onlySlug
    ? files.filter((f) => f === onlySlug + '.json')
    : files;

  console.log('Processing ' + targets.length + ' manifests…');
  for (const f of targets) {
    try {
      await processManifest(resolve(MANIFESTS_DIR, f));
    } catch (err) {
      console.error('[fail] ' + f + ': ' + err.message);
    }
  }
  console.log('\nDone.');
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
