// Fallback photo discovery for unis that Wikimedia didn't cover (small/niche schools).
// Scrapes each uni's officialUrl (from sources/universities.list.md → status.json registry),
// pulls OG image, twitter:image, and hero <img> tags, writes external URLs into
// gallery.items[]. Mirrors discover-photos.mjs convention: NO local downloads, just URLs.
//
// Usage:
//   node discover-photos-fallback.mjs              # all unis with 0 gallery items
//   node discover-photos-fallback.mjs --slug acap  # one uni
//   node discover-photos-fallback.mjs --limit 10   # smoke test
//   node discover-photos-fallback.mjs --dry-run    # don't write JSON

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as cheerioLoad } from 'cheerio';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const CATALOG_DIR = resolve(PROJECT_ROOT, 'site/src/content/universities');
const STATUS_FILE = resolve(PROJECT_ROOT, 'site/public/api/status.json');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/120.0 Safari/537.36 studyroom-discovery';
const TARGET_PHOTOS = 6;
const MIN_PHOTOS = 1;       // process unis with fewer than this
const CONCURRENCY = 4;
const FETCH_TIMEOUT_MS = 15000;

// Reject obvious non-content images
const SKIP_SRC_PATTERNS = [
  /\blogo/i, /\bicon/i, /\bsprite/i, /\bfavicon/i,
  /\.svg(\?|$)/i, /\bplaceholder/i, /\btransparent/i,
  /1x1\./i, /pixel\./i, /\.gif(\?|$)/i,
  /linkedin|facebook|twitter|youtube|instagram|tiktok/i,
  /spinner|loading|loader/i,
];

const args = process.argv.slice(2);
const argSlug = takeArg('--slug');
const argLimit = parseInt(takeArg('--limit') ?? '0', 10);
const dryRun = args.includes('--dry-run');

function takeArg(name) {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
}

async function fetchWithTimeout(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        'user-agent': UA,
        'accept': 'text/html,application/xhtml+xml',
        'accept-language': 'en-US,en;q=0.9',
      },
      signal: ctrl.signal,
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ct = res.headers.get('content-type') ?? '';
    if (!/text\/html/i.test(ct)) throw new Error(`bad content-type: ${ct}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

function absUrl(src, base) {
  if (!src) return null;
  if (src.startsWith('data:')) return null;
  try {
    return new URL(src, base).toString();
  } catch {
    return null;
  }
}

function shouldSkipSrc(url) {
  return SKIP_SRC_PATTERNS.some((re) => re.test(url));
}

function extractCaption($el) {
  return ($el.attr('alt') || $el.attr('title') || '').trim().slice(0, 80);
}

async function discoverForUrl(officialUrl, uniName) {
  const html = await fetchWithTimeout(officialUrl);
  const $ = cheerioLoad(html);
  const seen = new Set();
  const items = [];

  // 1. og:image + twitter:image (high priority)
  for (const selector of ['meta[property="og:image"]', 'meta[name="twitter:image"]', 'meta[property="og:image:secure_url"]']) {
    $(selector).each((_, el) => {
      const content = $(el).attr('content');
      const abs = absUrl(content, officialUrl);
      if (abs && !seen.has(abs) && !shouldSkipSrc(abs)) {
        seen.add(abs);
        items.push({ img: abs, caption: uniName });
      }
    });
  }

  // 2. <img> tags with absolute or root-relative src
  $('img').each((_, el) => {
    if (items.length >= TARGET_PHOTOS) return;
    const $img = $(el);
    const src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-lazy-src');
    const abs = absUrl(src, officialUrl);
    if (!abs || seen.has(abs)) return;
    if (shouldSkipSrc(abs)) return;
    const w = parseInt($img.attr('width') ?? '0', 10);
    const h = parseInt($img.attr('height') ?? '0', 10);
    // skip declared-small images
    if ((w > 0 && w < 300) || (h > 0 && h < 200)) return;
    // skip non-image extensions
    if (!/\.(jpe?g|png|webp)(\?|$)/i.test(abs)) return;
    seen.add(abs);
    items.push({ img: abs, caption: extractCaption($img) || uniName });
  });

  return items.slice(0, TARGET_PHOTOS);
}

async function loadJson(file) {
  const raw = await readFile(file, 'utf8');
  return JSON.parse(raw);
}

async function loadOfficialUrls() {
  const status = await loadJson(STATUS_FILE);
  const map = new Map();
  for (const r of status.registry ?? []) {
    if (r.officialUrl) map.set(r.slug, r.officialUrl);
  }
  return map;
}

async function processUni(file, officialMap) {
  const path = resolve(CATALOG_DIR, file);
  const j = await loadJson(path);
  const current = j.gallery?.items?.length ?? 0;
  if (current >= MIN_PHOTOS && !argSlug) {
    return { slug: j.slug, action: 'skip', reason: `has ${current}` };
  }
  const officialUrl = officialMap.get(j.slug);
  if (!officialUrl) {
    return { slug: j.slug, action: 'gap', reason: 'no-officialUrl' };
  }
  try {
    const items = await discoverForUrl(officialUrl, j.name);
    if (items.length === 0) {
      return { slug: j.slug, action: 'gap', reason: 'no-images-on-page' };
    }
    if (!dryRun) {
      j.gallery = { items };
      await writeFile(path, JSON.stringify(j, null, 2) + '\n', 'utf8');
    }
    return { slug: j.slug, action: dryRun ? 'dry' : 'wrote', count: items.length };
  } catch (err) {
    return { slug: j.slug, action: 'gap', reason: err.message.slice(0, 60) };
  }
}

async function main() {
  const officialMap = await loadOfficialUrls();
  console.log(`[init] loaded ${officialMap.size} officialUrl entries from registry`);
  const all = (await readdir(CATALOG_DIR)).filter((f) => f.endsWith('.json'));
  let targets;
  if (argSlug) {
    targets = [`${argSlug}.json`];
  } else {
    targets = [];
    for (const f of all) {
      const j = await loadJson(resolve(CATALOG_DIR, f));
      if ((j.gallery?.items?.length ?? 0) < MIN_PHOTOS) targets.push(f);
    }
    if (argLimit > 0) targets = targets.slice(0, argLimit);
  }
  console.log(`[start] processing ${targets.length} unis (concurrency=${CONCURRENCY})`);

  const stats = { ok: 0, gap: 0 };
  const queue = targets.slice();
  async function worker() {
    while (queue.length > 0) {
      const file = queue.shift();
      if (!file) break;
      const r = await processUni(file, officialMap);
      if (r.action === 'wrote' || r.action === 'dry') {
        stats.ok++;
        console.log(`  [ok]  ${r.slug.padEnd(28)} ${r.count} photos`);
      } else if (r.action === 'gap') {
        stats.gap++;
        console.log(`  [gap] ${r.slug.padEnd(28)} ${r.reason}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  console.log(`\n[done] ok=${stats.ok} gap=${stats.gap} total=${targets.length}`);
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
