// Auto-discover gallery photos for universities with empty gallery.items[]
// via Wikimedia Commons search. Writes external image URLs (no local download)
// into u.gallery.items[] — Astro renders <img src="https://upload.wikimedia.org/..."/>,
// Cloudflare caches at the edge. No file commits, no 300MB asset bloat.
//
// Usage:
//   node discover-photos.mjs                          # process ALL unis with <MIN_PHOTOS in gallery
//   node discover-photos.mjs --slug glasgow           # one uni
//   node discover-photos.mjs --limit 20               # first 20 needy unis (smoke test)
//   node discover-photos.mjs --dry-run                # don't write JSON, just report
//
// Strategy per uni:
//   1. Wikimedia Commons search (File: namespace) with 2 queries:
//      "{name} campus", "{name}".
//   2. Filter results: must be .jpg/.png, skip logos/maps/seals/portraits.
//   3. Resolve top N to thumbnail URLs (1200px wide).
//   4. Write up to TARGET_PHOTOS into u.gallery.items[] with captions.

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const CATALOG_DIR = resolve(PROJECT_ROOT, 'site/src/content/universities');

const UA = 'studyroom-photo-discovery/1.0 (https://studyroom-project-site.pages.dev; contact: vassiliy.kovylin@gmail.com)';
const WM_API = 'https://commons.wikimedia.org/w/api.php';
const MIN_PHOTOS = 4;       // unis with fewer than this get processed
const TARGET_PHOTOS = 8;    // try to reach this many per uni
const SEARCH_LIMIT = 30;    // max file results per query
const THUMB_WIDTH = 1200;
const CONCURRENCY = 4;      // parallel unis
const REQ_DELAY_MS = 250;   // between Wikimedia calls within a uni

// File-title patterns to skip (logos, maps, seals, single portraits)
const SKIP_PATTERNS = [
  /logo/i, /seal/i, /coat[-_ ]of[-_ ]arms/i, /crest/i,
  /\.svg$/i, /\.pdf$/i, /\.tiff$/i, /\.tif$/i, /\.webp$/i,
  /map\b/i, /location\b/i, /diagram/i, /chart/i, /graph/i,
  /portrait/i, /headshot/i,
  /signature/i,
];

// Positive signals — prefer files matching these
const PREFER_PATTERNS = [
  /campus/i, /building/i, /hall/i, /library/i, /quad/i,
  /aerial/i, /entrance/i, /facade/i, /exterior/i, /main/i,
  /tower/i, /chapel/i, /cathedral/i, /college/i, /university/i,
];

const args = process.argv.slice(2);
const argSlug = takeArg('--slug');
const argLimit = parseInt(takeArg('--limit') ?? '0', 10);
const dryRun = args.includes('--dry-run');

function takeArg(name) {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function wmGet(params) {
  const url = WM_API + '?' + new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params });
  const res = await fetch(url, { headers: { 'user-agent': UA, 'accept': 'application/json' } });
  if (!res.ok) throw new Error(`Wikimedia HTTP ${res.status}`);
  return res.json();
}

async function searchFiles(query) {
  const data = await wmGet({
    action: 'query',
    list: 'search',
    srsearch: query,
    srnamespace: '6',  // File: namespace
    srlimit: String(SEARCH_LIMIT),
    srinfo: '',
    srprop: 'snippet',
  });
  return (data?.query?.search ?? []).map((r) => r.title);
}

async function resolveThumbnails(titles) {
  if (titles.length === 0) return [];
  // imageinfo can batch up to 50 titles
  const chunks = [];
  for (let i = 0; i < titles.length; i += 50) chunks.push(titles.slice(i, i + 50));
  const out = [];
  for (const chunk of chunks) {
    const data = await wmGet({
      action: 'query',
      prop: 'imageinfo',
      iiprop: 'url|mime|size',
      iiurlwidth: String(THUMB_WIDTH),
      titles: chunk.join('|'),
    });
    for (const page of data?.query?.pages ?? []) {
      const info = page.imageinfo?.[0];
      if (!info) continue;
      if (!/^image\/(jpeg|png)$/i.test(info.mime ?? '')) continue;
      if ((info.size ?? 0) < 30_000) continue;  // too small, likely thumb
      out.push({
        title: page.title,
        url: info.thumburl ?? info.url,
        original: info.url,
        mime: info.mime,
      });
    }
    await sleep(REQ_DELAY_MS);
  }
  return out;
}

function rankCandidate(c) {
  const t = c.title.toLowerCase();
  let score = 0;
  for (const re of PREFER_PATTERNS) if (re.test(t)) score += 5;
  if (/main[-_ ]building|main[-_ ]quad/.test(t)) score += 5;
  if (/aerial/i.test(t)) score += 3;
  if (/night/i.test(t)) score -= 2;
  return score;
}

function shouldSkip(title) {
  return SKIP_PATTERNS.some((re) => re.test(title));
}

function makeCaption(title) {
  // "File:University of Glasgow Main Quadrangle.jpg" -> "Main Quadrangle"
  let s = title.replace(/^File:/i, '').replace(/\.(jpg|jpeg|png)$/i, '').replace(/_/g, ' ');
  // strip noise like "(cropped)", trailing digits
  s = s.replace(/\(.*?\)/g, '').replace(/\s+\d+\s*$/, '').trim();
  return s.length > 80 ? s.slice(0, 77) + '...' : s;
}

// Build a set of "must-match" tokens from uni name + city for relevance filtering.
// We require the file title to contain at least one of these (≥4 chars, not a stopword).
const STOP_TOKENS = new Set([
  'the', 'and', 'of', 'university', 'college', 'school', 'institute',
  'national', 'international', 'community', 'state', 'central', 'central',
  'centre', 'center', 'academy', 'group', 'inc',
]);

function uniTokens(uni) {
  const parts = [uni.name, uni.city ?? ''].join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !STOP_TOKENS.has(t));
  return new Set(parts);
}

function fileMatchesUni(title, tokens) {
  if (tokens.size === 0) return false;
  const t = title.toLowerCase();
  for (const token of tokens) {
    if (t.includes(token)) return true;
  }
  return false;
}

async function discoverForUni(uni) {
  const tokens = uniTokens(uni);
  if (tokens.size === 0) {
    return { items: [], reason: 'no-tokens-from-name' };
  }
  // Use quoted full name to force phrase matching, plus a campus-narrowed variant.
  const queries = [
    `"${uni.name}" campus`,
    `"${uni.name}"`,
  ];
  const seen = new Set();
  const titles = [];
  for (const q of queries) {
    try {
      const hits = await searchFiles(q);
      for (const t of hits) {
        if (seen.has(t)) continue;
        if (shouldSkip(t)) continue;
        if (!fileMatchesUni(t, tokens)) continue;  // post-filter: title must mention uni
        seen.add(t);
        titles.push(t);
      }
      await sleep(REQ_DELAY_MS);
    } catch (err) {
      console.warn(`  [warn] search "${q}" failed: ${err.message}`);
    }
    if (titles.length >= SEARCH_LIMIT) break;
  }
  if (titles.length === 0) return { items: [], reason: 'no-relevant-hits' };

  let resolved;
  try {
    resolved = await resolveThumbnails(titles);
  } catch (err) {
    return { items: [], reason: `resolve-failed: ${err.message}` };
  }

  // rank + dedupe by original URL
  const seenUrl = new Set();
  const ranked = resolved
    .map((r) => ({ ...r, score: rankCandidate(r) }))
    .sort((a, b) => b.score - a.score)
    .filter((r) => {
      if (seenUrl.has(r.original)) return false;
      seenUrl.add(r.original);
      return true;
    });

  const top = ranked.slice(0, TARGET_PHOTOS);
  return {
    items: top.map((r) => ({ img: r.url, caption: makeCaption(r.title) })),
    reason: top.length >= 4 ? 'ok' : 'partial',
  };
}

async function loadJson(file) {
  const raw = await readFile(file, 'utf8');
  return JSON.parse(raw);
}

async function processUni(file) {
  const path = resolve(CATALOG_DIR, file);
  const j = await loadJson(path);
  const current = j.gallery?.items?.length ?? 0;
  if (current >= MIN_PHOTOS && !argSlug) {
    return { slug: j.slug, action: 'skip', reason: `already has ${current} photos` };
  }
  const result = await discoverForUni(j);
  if (result.items.length === 0) {
    return { slug: j.slug, action: 'gap', reason: result.reason, count: 0 };
  }
  if (!dryRun) {
    j.gallery = { items: result.items };
    await writeFile(path, JSON.stringify(j, null, 2) + '\n', 'utf8');
  }
  return { slug: j.slug, action: dryRun ? 'dry' : 'wrote', reason: result.reason, count: result.items.length };
}

async function main() {
  const all = (await readdir(CATALOG_DIR)).filter((f) => f.endsWith('.json'));
  let targets;
  if (argSlug) {
    targets = [`${argSlug}.json`];
  } else {
    // pre-filter: read each, keep only those with <MIN_PHOTOS
    targets = [];
    for (const f of all) {
      const j = await loadJson(resolve(CATALOG_DIR, f));
      if ((j.gallery?.items?.length ?? 0) < MIN_PHOTOS) targets.push(f);
    }
    if (argLimit > 0) targets = targets.slice(0, argLimit);
  }
  console.log(`[start] processing ${targets.length} unis (concurrency=${CONCURRENCY}, target=${TARGET_PHOTOS} photos)`);

  let okCount = 0;
  let gapCount = 0;
  let partialCount = 0;

  // simple bounded concurrency
  const queue = targets.slice();
  async function worker(id) {
    while (queue.length > 0) {
      const file = queue.shift();
      if (!file) break;
      try {
        const r = await processUni(file);
        if (r.action === 'gap') {
          gapCount++;
          console.log(`  [gap] ${r.slug.padEnd(28)} ${r.reason}`);
        } else if (r.reason === 'partial') {
          partialCount++;
          console.log(`  [partial] ${r.slug.padEnd(25)} ${r.count} photos`);
        } else if (r.action === 'wrote' || r.action === 'dry') {
          okCount++;
          console.log(`  [ok] ${r.slug.padEnd(28)} ${r.count} photos`);
        }
      } catch (err) {
        gapCount++;
        console.log(`  [err] ${file}: ${err.message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i)));
  console.log(`\n[done] ok=${okCount} partial=${partialCount} gap=${gapCount} total=${targets.length}`);
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
