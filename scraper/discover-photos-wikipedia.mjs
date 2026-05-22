// Third-tier photo source: scrape the en.wikipedia.org article for each uni,
// pull infobox image + body images. Useful for small/niche schools that
// have a Wikipedia article but no Commons category and a hostile officialUrl
// (403 / no OG image).
//
// Usage:
//   node discover-photos-wikipedia.mjs              # all unis with <MIN_PHOTOS gallery
//   node discover-photos-wikipedia.mjs --slug acap  # one
//   node discover-photos-wikipedia.mjs --limit 5    # smoke
//   node discover-photos-wikipedia.mjs --dry-run

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as cheerioLoad } from 'cheerio';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const CATALOG_DIR = resolve(PROJECT_ROOT, 'site/src/content/universities');

const UA = 'studyroom-photo-discovery/1.0 (https://studyroom-project-site.pages.dev)';
const MIN_PHOTOS = 1;
const TARGET_PHOTOS = 6;
const CONCURRENCY = 3;

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

// Try several candidate Wikipedia article slugs derived from the uni name.
function candidateArticles(uni) {
  const out = new Set();
  const variants = [
    uni.name,
    uni.name.replace(/,.*$/, ''),                          // strip trailing ", City"
    uni.name.replace(/\([^)]*\)/g, '').trim(),             // strip parens
    uni.name.replace(/\bUniversity College\b/, 'University'),
    uni.name + ` (${uni.city})`,
  ];
  for (const v of variants) {
    out.add(v.trim().replace(/\s+/g, '_'));
  }
  return Array.from(out);
}

// Use Wikipedia's opensearch API to find the canonical article title for a uni.
// Try multiple short query variants (full name often loses to short queries).
// Returns an array of underscored titles ordered by relevance.
async function searchWikiTitles(uni) {
  const queries = new Set();
  queries.add(uni.name);
  // strip trailing location qualifiers ("Milano", "Malaysia", "RAK")
  queries.add(uni.name.replace(/\s+(Milano|Malaysia|Singapore|Dubai|RAK|Riyadh|Sri Lanka|China|Bandung)\b.*$/i, '').trim());
  // strip trailing generic words ("University", "College") to find e.g. just "LUISS"
  const firstTwoWords = uni.name.split(/\s+/).slice(0, 2).join(' ');
  if (firstTwoWords.length >= 4) queries.add(firstTwoWords);
  // first word alone if it's a strong acronym/proper noun (≥4 chars, all caps or capitalized)
  const firstWord = uni.name.split(/\s+/)[0];
  if (firstWord && firstWord.length >= 4 && /^[A-Z]/.test(firstWord)) queries.add(firstWord);

  const allTitles = [];
  const seen = new Set();
  for (const q of queries) {
    if (!q) continue;
    const url = `https://en.wikipedia.org/w/api.php?action=opensearch&format=json&limit=5&namespace=0&search=${encodeURIComponent(q)}`;
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA } });
      if (!res.ok) continue;
      const data = await res.json();
      const titles = Array.isArray(data) && Array.isArray(data[1]) ? data[1] : [];
      for (const t of titles) {
        const norm = t.replace(/\s+/g, '_');
        if (!seen.has(norm)) {
          seen.add(norm);
          allTitles.push(norm);
        }
      }
      await sleep(150);
    } catch {
      // continue
    }
    if (allTitles.length >= 5) break;
  }
  return allTitles.slice(0, 5);
}

async function fetchWiki(articleSlug) {
  const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(articleSlug)}`;
  const res = await fetch(url, {
    headers: { 'user-agent': UA, 'accept': 'text/html' },
    redirect: 'follow',
  });
  if (!res.ok) return null;
  return await res.text();
}

function extractImages(html, articleUrl) {
  const $ = cheerioLoad(html);
  const seen = new Set();
  const items = [];

  // 1. infobox image (.infobox-image img, .infobox img)
  $('.infobox img, .infobox-image img').each((_, el) => {
    if (items.length >= TARGET_PHOTOS) return;
    const $img = $(el);
    const src = $img.attr('src');
    if (!src) return;
    const abs = absoluteUrl(src);
    if (seen.has(abs)) return;
    if (!isContentImage(abs, $img)) return;
    seen.add(abs);
    items.push({ img: upgradeToFullsize(abs), caption: ($img.attr('alt') || '').trim().slice(0, 80) });
  });

  // 2. thumbnail figures in body (.thumbinner img, figure.mw-default-size img)
  $('.thumbinner img, figure.mw-default-size img, .image img').each((_, el) => {
    if (items.length >= TARGET_PHOTOS) return;
    const $img = $(el);
    const src = $img.attr('src');
    if (!src) return;
    const abs = absoluteUrl(src);
    if (seen.has(abs)) return;
    if (!isContentImage(abs, $img)) return;
    seen.add(abs);
    items.push({ img: upgradeToFullsize(abs), caption: ($img.attr('alt') || '').trim().slice(0, 80) });
  });

  return items;
}

function absoluteUrl(src) {
  if (src.startsWith('//')) return 'https:' + src;
  if (src.startsWith('http')) return src;
  return 'https://en.wikipedia.org' + src;
}

function isContentImage(url, $img) {
  if (!/\.(jpg|jpeg|png)$/i.test(url) && !/\.(jpg|jpeg|png)\/\d+px-/i.test(url)) return false;
  // Skip flags, icons, tiny graphics
  if (/Flag_of_|coat[-_]of[-_]arms|seal|logo|crest/i.test(url)) return false;
  const w = parseInt($img.attr('width') ?? '0', 10);
  if (w > 0 && w < 100) return false;
  return true;
}

// Wikipedia serves "220px-..." thumbnails by default. We want larger.
// Upgrade to /1280px- by rewriting the path.
function upgradeToFullsize(url) {
  return url.replace(/\/(\d+)px-/, '/1200px-');
}

async function discoverForUni(uni) {
  // 1. Try opensearch-resolved canonical titles first (handles "LUISS" → "LUISS_Guido_Carli").
  const apiTitles = await searchWikiTitles(uni);
  // 2. Fall back to naive name variants if opensearch returns nothing.
  const naive = candidateArticles(uni);
  // dedupe, opensearch results first
  const seen = new Set();
  const candidates = [...apiTitles, ...naive].filter((t) => {
    if (seen.has(t)) return false;
    seen.add(t);
    return true;
  });

  for (const slug of candidates) {
    try {
      const html = await fetchWiki(slug);
      if (!html) continue;
      if (/<table[^>]+class="[^"]*disambiguation/i.test(html)) continue;
      // reject if article body doesn't even mention a token from the uni name
      const lowerHtml = html.toLowerCase();
      const nameTokens = uni.name.toLowerCase().split(/\s+/).filter((t) => t.length >= 4);
      const hasNameMatch = nameTokens.some((t) => lowerHtml.includes(t));
      if (!hasNameMatch && nameTokens.length > 0) continue;
      const items = extractImages(html);
      if (items.length > 0) return items;
    } catch {
      // try next candidate
    }
    await sleep(200);
  }
  return [];
}

async function loadJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function processUni(file) {
  const path = resolve(CATALOG_DIR, file);
  const j = await loadJson(path);
  const current = j.gallery?.items?.length ?? 0;
  if (current >= MIN_PHOTOS && !argSlug) {
    return { slug: j.slug, action: 'skip' };
  }
  const items = await discoverForUni(j);
  if (items.length === 0) {
    return { slug: j.slug, action: 'gap', reason: 'no-wiki-article' };
  }
  if (!dryRun) {
    j.gallery = { items };
    await writeFile(path, JSON.stringify(j, null, 2) + '\n', 'utf8');
  }
  return { slug: j.slug, action: dryRun ? 'dry' : 'wrote', count: items.length };
}

async function main() {
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
  console.log(`[start] ${targets.length} unis (concurrency=${CONCURRENCY})`);

  const stats = { ok: 0, gap: 0 };
  const queue = targets.slice();
  async function worker() {
    while (queue.length > 0) {
      const file = queue.shift();
      if (!file) break;
      const r = await processUni(file);
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
