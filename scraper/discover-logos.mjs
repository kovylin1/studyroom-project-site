// Discover logo URLs for universities without one. Looks at officialUrl for:
//   1. <link rel="apple-touch-icon"> (usually 180x180 hi-res icon)
//   2. <link rel="icon" sizes="..."> (prefer larger sizes)
//   3. <meta property="og:logo">
//   4. <link rel="icon"> (any favicon as last resort)
//
// Writes the resolved absolute URL into u.logoUrl in the JSON. The Astro
// UniversityCard component reads logoUrl from the registry; if missing,
// it shows initials. By writing external URLs we don't have to download
// hundreds of .png files into the repo.
//
// Usage:
//   node discover-logos.mjs                    # all unis missing logoUrl
//   node discover-logos.mjs --slug asu-london  # one
//   node discover-logos.mjs --limit 5

import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as cheerioLoad } from 'cheerio';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const CATALOG_DIR = resolve(PROJECT_ROOT, 'site/src/content/universities');
const LOGOS_DIR = resolve(PROJECT_ROOT, 'site/public/logos');
const STATUS_FILE = resolve(PROJECT_ROOT, 'site/public/api/status.json');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 studyroom-logo-discovery';
const FETCH_TIMEOUT_MS = 12000;
const CONCURRENCY = 4;

const args = process.argv.slice(2);
const argSlug = takeArg('--slug');
const argLimit = parseInt(takeArg('--limit') ?? '0', 10);

function takeArg(name) {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
}

async function fetchWithTimeout(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': UA, 'accept': 'text/html' },
      signal: ctrl.signal,
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ct = res.headers.get('content-type') ?? '';
    if (!/text\/html/i.test(ct)) throw new Error(`bad ct: ${ct}`);
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

function pickLogoUrl(html, baseUrl) {
  const $ = cheerioLoad(html);
  const candidates = [];

  // 1. apple-touch-icon variants
  $('link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]').each((_, el) => {
    const href = $(el).attr('href');
    const sizes = $(el).attr('sizes') ?? '';
    const size = parseInt(sizes.split('x')[0], 10) || 180;
    const abs = absUrl(href, baseUrl);
    if (abs) candidates.push({ url: abs, score: 100 + size });
  });

  // 2. <link rel="icon" sizes="...">
  $('link[rel*="icon"][sizes]').each((_, el) => {
    const href = $(el).attr('href');
    const sizes = $(el).attr('sizes') ?? '';
    const size = parseInt(sizes.split('x')[0], 10) || 32;
    const abs = absUrl(href, baseUrl);
    if (abs) candidates.push({ url: abs, score: 50 + size });
  });

  // 3. og:logo or og:image (logo-tagged)
  $('meta[property="og:logo"], meta[name="og:logo"]').each((_, el) => {
    const content = $(el).attr('content');
    const abs = absUrl(content, baseUrl);
    if (abs) candidates.push({ url: abs, score: 80 });
  });

  // 4. plain rel="icon" / rel="shortcut icon"
  $('link[rel="icon"]:not([sizes]), link[rel="shortcut icon"]').each((_, el) => {
    const href = $(el).attr('href');
    const abs = absUrl(href, baseUrl);
    if (abs) candidates.push({ url: abs, score: 30 });
  });

  if (candidates.length === 0) return null;
  // Prefer PNG/JPG over ICO (most uni-card UIs render ICO poorly)
  candidates.forEach((c) => {
    if (/\.png(\?|$)/i.test(c.url)) c.score += 10;
    else if (/\.(jpe?g|webp)(\?|$)/i.test(c.url)) c.score += 5;
    else if (/\.ico(\?|$)/i.test(c.url)) c.score -= 30;
    else if (/\.svg(\?|$)/i.test(c.url)) c.score += 8;
  });
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].url;
}

async function loadJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function loadOfficialUrls() {
  const status = await loadJson(STATUS_FILE);
  const map = new Map();
  for (const r of status.registry ?? []) {
    if (r.officialUrl) map.set(r.slug, r.officialUrl);
  }
  return map;
}

async function localLogoExists(slug) {
  for (const ext of ['png', 'jpg', 'webp']) {
    try {
      await stat(resolve(LOGOS_DIR, `${slug}.${ext}`));
      return `/logos/${slug}.${ext}`;
    } catch {}
  }
  return null;
}

async function processUni(file, officialMap) {
  const path = resolve(CATALOG_DIR, file);
  const j = await loadJson(path);

  // Already has a local logo file? Set logoUrl if missing and skip web fetch.
  const local = await localLogoExists(j.slug);
  if (local && !argSlug) {
    if (j.logoUrl !== local) {
      j.logoUrl = local;
      await writeFile(path, JSON.stringify(j, null, 2) + '\n', 'utf8');
      return { slug: j.slug, action: 'local', logo: local };
    }
    return { slug: j.slug, action: 'skip-local' };
  }

  if (j.logoUrl && !argSlug) return { slug: j.slug, action: 'skip-has-url' };

  const officialUrl = officialMap.get(j.slug);
  if (!officialUrl) return { slug: j.slug, action: 'gap', reason: 'no-officialUrl' };
  try {
    const html = await fetchWithTimeout(officialUrl);
    const logo = pickLogoUrl(html, officialUrl);
    if (!logo) return { slug: j.slug, action: 'gap', reason: 'no-logo-link' };
    j.logoUrl = logo;
    await writeFile(path, JSON.stringify(j, null, 2) + '\n', 'utf8');
    return { slug: j.slug, action: 'wrote', logo };
  } catch (err) {
    return { slug: j.slug, action: 'gap', reason: err.message.slice(0, 50) };
  }
}

async function main() {
  const officialMap = await loadOfficialUrls();
  const all = (await readdir(CATALOG_DIR)).filter((f) => f.endsWith('.json'));
  let targets;
  if (argSlug) {
    targets = [`${argSlug}.json`];
  } else {
    targets = all;
    if (argLimit > 0) targets = targets.slice(0, argLimit);
  }
  console.log(`[start] ${targets.length} unis (concurrency=${CONCURRENCY})`);

  const stats = { wrote: 0, local: 0, gap: 0, skip: 0 };
  const queue = targets.slice();
  async function worker() {
    while (queue.length > 0) {
      const file = queue.shift();
      if (!file) break;
      const r = await processUni(file, officialMap);
      if (r.action === 'wrote') {
        stats.wrote++;
        console.log(`  [ok]    ${r.slug.padEnd(28)} ${r.logo.slice(0, 80)}`);
      } else if (r.action === 'local') {
        stats.local++;
        console.log(`  [local] ${r.slug.padEnd(28)} ${r.logo}`);
      } else if (r.action === 'gap') {
        stats.gap++;
        console.log(`  [gap]   ${r.slug.padEnd(28)} ${r.reason}`);
      } else {
        stats.skip++;
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  console.log(`\n[done] wrote=${stats.wrote} local=${stats.local} skip=${stats.skip} gap=${stats.gap}`);
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
