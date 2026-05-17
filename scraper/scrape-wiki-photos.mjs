// Programmatic Wikipedia + Wikimedia Commons photo scraper for Navitas unis
// (and any uni with no photos). For each uni:
//  1. Infer Wikipedia article title from uni name
//  2. Fetch the article HTML + first Commons category page
//  3. Extract upload.wikimedia.org image URLs, score them (buildings > people)
//  4. Download top N (default 10) to site/public/photos/{slug}/
//  5. Patch site/src/content/universities/{slug}.json gallery.items[]
//
//   node scrape-wiki-photos.mjs --slug curtin
//   node scrape-wiki-photos.mjs --slugs curtin,deakin
//   node scrape-wiki-photos.mjs --navitas
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

const UA = 'StudyRoomBot/1.0 (https://studyroom.kz; vassiliy.kovylin@gmail.com)';
const DELAY_MS = 500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const WIKI_OVERRIDES = {
  'queens-college-cuny': 'Queens_College,_City_University_of_New_York',
  'toronto-met': 'Toronto_Metropolitan_University',
  'western-ontario': 'University_of_Western_Ontario',
  'lancaster-leipzig': 'Lancaster_University_Leipzig',
  'srh-germany': 'SRH_University_Heidelberg',
  'dli-bandung': 'Lancaster_University',
  'edith-cowan-sl': 'Edith_Cowan_University',
  'curtin-singapore': 'Curtin_University',
  'murdoch-dubai': 'Murdoch_University',
  'sae': 'SAE_Institute',
  'acap': 'Australian_College_of_Applied_Psychology',
  'canterbury-nz': 'University_of_Canterbury',
  'hague': 'The_Hague_University_of_Applied_Sciences',
  'birmingham-city': 'Birmingham_City_University',
  'manchester-met': 'Manchester_Metropolitan_University',
  'newcastle-au': 'University_of_Newcastle_(Australia)',
};

function inferWikiTitle(name, slug) {
  if (WIKI_OVERRIDES[slug]) return WIKI_OVERRIDES[slug];
  return name.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_,()-]/g, '');
}

function scoreImage(url, alt) {
  const u = (url || '').toLowerCase();
  const a = (alt || '').toLowerCase();
  const both = u + ' ' + a;
  let score = 0;
  if (/main[-_]?building|aerial|library|quad|tower|campus|hall|chapel|cathedral|engineer|science|business|courtyard|facade|exterior|skyline|panorama|entrance|gate|architect/i.test(both)) score += 40;
  if (/logo|icon|flag|seal|crest|arms|coat[-_]of[-_]arms/i.test(u)) score -= 100;
  if (/portrait|headshot|student|graduate|ceremony|smiling|posing|cohort|group/i.test(both)) score -= 30;
  if (/19\d{2}|20\d{2}/.test(a)) score -= 5;
  return score;
}

function pickExt(url) {
  const m = (url || '').match(/\.(jpe?g|png|webp)(\?|$|#)/i);
  return m ? m[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg';
}

async function exists(path) {
  try { await access(path, fsConstants.F_OK); return true; } catch { return false; }
}

async function fetchHtml(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' } });
    if (!r.ok) return null;
    return await r.text();
  } catch { return null; }
}

async function downloadImage(url, outPath) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'image/*' }, redirect: 'follow' });
      if (r.status === 429 || r.status === 503) {
        const wait = parseInt(r.headers.get('retry-after') || '0', 10) * 1000 || 2000 * attempt;
        await sleep(wait); continue;
      }
      if (!r.ok) return false;
      const ct = r.headers.get('content-type') || '';
      if (!/^image\//i.test(ct)) return false;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 1024) return false;
      await writeFile(outPath, buf);
      await sleep(DELAY_MS);
      return true;
    } catch { await sleep(1000 * attempt); }
  }
  return false;
}

function extractWikimediaUrls(html) {
  const $ = cheerioLoad(html);
  const seen = new Set();
  const out = [];
  $('img[src]').each((_, el) => {
    let src = $(el).attr('src') || '';
    const alt = $(el).attr('alt') || '';
    if (src.startsWith('//')) src = 'https:' + src;
    if (!/upload\.wikimedia\.org\/wikipedia\/(commons|en)/i.test(src)) return;
    let canonical = src;
    const thumbMatch = src.match(/^(https?:\/\/upload\.wikimedia\.org\/wikipedia\/(?:commons|en))\/thumb\/(.+)\/[^\/]+$/);
    if (thumbMatch) canonical = thumbMatch[1] + '/' + thumbMatch[2];
    canonical = canonical.split('?')[0];
    if (seen.has(canonical)) return;
    seen.add(canonical);
    out.push({ url: canonical, alt, score: scoreImage(canonical, alt) });
  });
  return out.sort((a, b) => b.score - a.score);
}

async function findUniImages(name, slug) {
  const title = inferWikiTitle(name, slug);
  const wikiUrl = 'https://en.wikipedia.org/wiki/' + title.replace(/ /g, '_');
  console.log('  wiki: ' + wikiUrl);
  const wikiHtml = await fetchHtml(wikiUrl);
  let imgs = wikiHtml ? extractWikimediaUrls(wikiHtml) : [];
  const commonsUrl = 'https://commons.wikimedia.org/wiki/Category:' + title;
  console.log('  commons: ' + commonsUrl);
  const commonsHtml = await fetchHtml(commonsUrl);
  if (commonsHtml) {
    const more = extractWikimediaUrls(commonsHtml);
    const known = new Set(imgs.map((x) => x.url));
    for (const m of more) if (!known.has(m.url)) imgs.push(m);
  }
  return imgs;
}

async function processUni(uni, opts = {}) {
  const { count = 10 } = opts;
  console.log('\n=== ' + uni.slug + ' (' + uni.name + ') ===');
  const slugDir = resolve(PHOTOS_DIR, uni.slug);
  await mkdir(slugDir, { recursive: true });

  const imgs = await findUniImages(uni.name, uni.slug);
  if (imgs.length === 0) { console.warn('  [skip] no wiki images'); return { slug: uni.slug, downloaded: 0 }; }
  console.log('  found ' + imgs.length + ' candidates, top score: ' + imgs[0].score);

  const galleryItems = [];
  let idx = 1;
  const heroUrl = imgs[0].url;
  if (await downloadImage(heroUrl, resolve(slugDir, 'hero.' + pickExt(heroUrl)))) {
    galleryItems.push({ img: '/photos/' + uni.slug + '/hero.' + pickExt(heroUrl), caption: imgs[0].alt || uni.name });
  }
  for (let i = 1; i < imgs.length && idx <= count; i += 1) {
    const c = imgs[i];
    if (c.url === heroUrl) continue;
    const fname = 'gallery-' + idx + '.' + pickExt(c.url);
    if (await downloadImage(c.url, resolve(slugDir, fname))) {
      galleryItems.push({ img: '/photos/' + uni.slug + '/' + fname, caption: c.alt || (uni.name + ' (' + idx + ')') });
      idx += 1;
    }
  }

  if (galleryItems.length === 0) { console.warn('  [warn] no downloads succeeded'); return { slug: uni.slug, downloaded: 0 }; }

  const jsonPath = resolve(CATALOG_DIR, uni.slug + '.json');
  if (await exists(jsonPath)) {
    const data = JSON.parse(await readFile(jsonPath, 'utf8'));
    data.gallery = { items: galleryItems };
    await writeFile(jsonPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  }
  console.log('  ' + galleryItems.length + ' photos saved');
  return { slug: uni.slug, downloaded: galleryItems.length };
}

async function readNavitasRegistry() {
  const raw = await readFile(REGISTRY_FILE, 'utf8');
  const rows = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').map((c) => c.trim());
    if (cells.length < 9) continue;
    const slug = cells[1];
    if (slug === 'slug' || slug.startsWith('---')) continue;
    if (!/navitas/i.test(cells[7] || '')) continue;
    rows.push({ slug, name: cells[2], country: cells[3], city: cells[4] });
  }
  return rows;
}

async function main() {
  const args = process.argv.slice(2);
  const onlyArg = args.includes('--slug') ? args[args.indexOf('--slug') + 1] : null;
  const slugsArg = args.includes('--slugs') ? args[args.indexOf('--slugs') + 1] : null;
  const allNavitas = args.includes('--navitas');

  let targets = [];
  if (onlyArg) {
    const all = await readNavitasRegistry();
    targets = all.filter((r) => r.slug === onlyArg);
    if (targets.length === 0) targets = [{ slug: onlyArg, name: onlyArg }];
  } else if (slugsArg) {
    const slugs = slugsArg.split(',').map((s) => s.trim());
    const all = await readNavitasRegistry();
    targets = all.filter((r) => slugs.includes(r.slug));
  } else if (allNavitas) {
    targets = await readNavitasRegistry();
  } else {
    console.error('Usage: --navitas | --slug <slug> | --slugs s1,s2,s3');
    process.exit(2);
  }

  console.log('Targets: ' + targets.length + ' unis');
  const results = [];
  for (const t of targets) {
    try { results.push(await processUni(t)); }
    catch (err) { console.error('[fail] ' + t.slug + ': ' + err.message); results.push({ slug: t.slug, downloaded: 0, error: err.message }); }
  }
  console.log('\n=== SUMMARY ===');
  const ok = results.filter((r) => r.downloaded > 0).length;
  console.log(ok + '/' + results.length + ' unis got photos. Failed:');
  for (const r of results) if (r.downloaded === 0) console.log('  ' + r.slug + (r.error ? ': ' + r.error : ': no images'));
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
