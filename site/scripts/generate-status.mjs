// Generates site/public/api/status.json at build time.
//
// Mirrors the shape of `control/server.mjs` GET /api/status so the public
// manager page (deployed to Cloudflare Pages) shows the same registry +
// catalog freshness data without a backend. The static file is regenerated
// on every Astro build (which happens after every scraper run, manual or
// monthly cron), so the snapshot stays current.
//
// The `run.*` fields are zeroed out since there's no live run state on a
// static deploy. The local control panel (port 5174) still owns the
// run-scrape actions and overrides this file when the manager page is
// pointed at it via localStorage.

import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(__dirname, '..');
const PROJECT_ROOT = resolve(SITE_ROOT, '..');
const REGISTRY_FILE = resolve(PROJECT_ROOT, 'sources/universities.list.md');
const AGGREGATORS_FILE = resolve(PROJECT_ROOT, 'sources/aggregators.md');
const CATALOG_DIR = resolve(SITE_ROOT, 'src/content/universities');
const CRON_FILE = resolve(PROJECT_ROOT, '.github/workflows/scrape-monthly.yml');
const OUTPUT_FILE = resolve(SITE_ROOT, 'public/api/status.json');
const TASK_REGISTRY_FILE = resolve(PROJECT_ROOT, 'scraper/tasks/registry.json');
const GAPS_FILE = resolve(PROJECT_ROOT, 'scraper/sources/shmel-worklist.json');

async function readAggregators() {
  try {
    const raw = await readFile(AGGREGATORS_FILE, 'utf8');
    const aggregators = [];
    const sections = raw.split(/^## /m).slice(1);
    for (const section of sections) {
      const slugMatch = section.match(/^`?([a-z0-9-]+)`?/);
      if (!slugMatch) continue;
      const slug = slugMatch[1];
      const baseUrlMatch = section.match(/\*\*Base URL:\*\*\s*`?(https?:\/\/[^`\s)]+)`?/i);
      const baseUrl = baseUrlMatch ? baseUrlMatch[1] : null;
      let host = '';
      try {
        host = baseUrl ? new URL(baseUrl).hostname.replace(/^www\./, '') : '';
      } catch {}
      const tierMatch = section.match(/Confidence tier in our schema:\*\*\s*`?([a-z]+)`?/i);
      const name = slug
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      aggregators.push({
        slug,
        name,
        baseUrl,
        host,
        tier: tierMatch ? tierMatch[1] : 'aggregator',
      });
    }
    return aggregators;
  } catch {
    return [];
  }
}

function resolveAggregatorSlug(urlCell, aggregators) {
  if (!urlCell || aggregators.length === 0) return null;
  const urls = urlCell.match(/https?:\/\/[^\s,)]+/g) || [];
  for (const u of urls) {
    let host = '';
    try {
      host = new URL(u).hostname.replace(/^www\./, '');
    } catch {
      continue;
    }
    const match = aggregators.find(
      (a) => a.host && (host === a.host || host.endsWith('.' + a.host)),
    );
    if (match) return match.slug;
  }
  return null;
}

async function readRegistry(aggregators) {
  try {
    const raw = await readFile(REGISTRY_FILE, 'utf8');
    const rows = [];
    for (const line of raw.split(/\r?\n/)) {
      if (!line.startsWith('|')) continue;
      const cells = line
        .split('|')
        .map((c) => c.trim())
        .filter((_, i, arr) => i > 0 && i < arr.length - 1);
      if (cells.length < 8) continue;
      const [slug, name, country, city, tier, officialUrl, aggregatorUrlCell] = cells;
      if (slug === 'slug' || slug.startsWith('---')) continue;
      if (tier !== 'partner' && tier !== 'official' && tier !== 'aggregator') continue;
      rows.push({
        slug,
        name,
        country,
        city,
        tier,
        officialUrl: officialUrl || null,
        aggregatorSlug: resolveAggregatorSlug(aggregatorUrlCell, aggregators),
      });
    }
    return rows;
  } catch {
    return [];
  }
}

async function readCatalog() {
  try {
    const files = await readdir(CATALOG_DIR);
    const out = {};
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      const raw = await readFile(resolve(CATALOG_DIR, f), 'utf8');
      try {
        const parsed = JSON.parse(raw);
        out[parsed.slug] = {
          lastChecked: parsed.lastChecked,
          sourceUrl: parsed.sourceUrl,
          sourceHash: parsed.sourceHash,
          confidence: parsed.confidence,
          programsCount: Array.isArray(parsed.programs) ? parsed.programs.length : 0,
        };
      } catch {}
    }
    return out;
  } catch {
    return {};
  }
}

async function readCronExpression() {
  try {
    const raw = await readFile(CRON_FILE, 'utf8');
    const match = raw.match(/-\s+cron:\s*["']([^"']+)["']/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function nextRunFromCron(cron) {
  if (!cron) return null;
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [minStr, hourStr, domStr, monStr, dowStr] = parts;
  if (monStr !== '*' || dowStr !== '*') return null;
  const minute = Number(minStr);
  const hour = Number(hourStr);
  const dayOfMonth = Number(domStr);
  if (Number.isNaN(minute) || Number.isNaN(hour) || Number.isNaN(dayOfMonth)) return null;
  const now = new Date();
  let candidate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), dayOfMonth, hour, minute, 0),
  );
  if (candidate <= now) {
    candidate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, dayOfMonth, hour, minute, 0),
    );
  }
  return candidate.toISOString();
}

async function readDirectors() {
  try {
    const raw = await readFile(TASK_REGISTRY_FILE, 'utf8');
    return JSON.parse(raw).directors || {};
  } catch { return {}; }
}

async function readGaps() {
  try {
    const raw = await readFile(GAPS_FILE, 'utf8');
    const { total, byPriority, generated } = JSON.parse(raw);
    return { total: total || 0, byPriority: byPriority || {}, generatedAt: generated || null };
  } catch { return null; }
}

async function main() {
  const [catalog, cron, aggregators, directors, gaps] = await Promise.all([
    readCatalog(),
    readCronExpression(),
    readAggregators(),
    readDirectors(),
    readGaps(),
  ]);
  const registry = await readRegistry(aggregators);

  // Attach gap priority per-uni from worklist
  let gapBySlug = {};
  if (gaps) {
    try {
      const raw = await readFile(GAPS_FILE, 'utf8');
      const wl = JSON.parse(raw);
      for (const item of wl.items || []) gapBySlug[item.slug] = item.priority;
    } catch {}
  }

  const merged = registry.map((row) => ({
    ...row,
    catalog: catalog[row.slug] ?? null,
    gapPriority: gapBySlug[row.slug] || null,
  }));
  const defaultProfile = aggregators[0] ?? {
    slug: 'kaplan-pathways',
    name: 'Kaplan Pathways',
    baseUrl: 'https://www.kaplanpathways.com/',
    tier: 'partner',
  };
  const payload = {
    run: {
      running: false,
      startedAt: null,
      finishedAt: null,
      exitCode: null,
      currentTarget: null,
      log: [],
    },
    schedule: {
      cron,
      nextRunUTC: nextRunFromCron(cron),
      source: '.github/workflows/scrape-monthly.yml',
    },
    sourceProfile: {
      name: defaultProfile.name,
      baseUrl: defaultProfile.baseUrl,
      tier: defaultProfile.tier,
    },
    aggregators,
    directors,
    gaps,
    registry: merged,
    generatedAt: new Date().toISOString(),
    isStaticSnapshot: true,
  };
  await mkdir(dirname(OUTPUT_FILE), { recursive: true });
  await writeFile(OUTPUT_FILE, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(
    '[status] wrote ' +
      OUTPUT_FILE +
      ' (' +
      merged.length +
      ' unis, ' +
      aggregators.length +
      ' aggregators)',
  );
}

main().catch((err) => {
  console.error('[status] fatal:', err);
  process.exit(1);
});
