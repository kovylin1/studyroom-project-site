// StudyRoom control panel — vanilla Node HTTP server.
// Endpoints:
//   GET  /                  -> dashboard HTML
//   GET  /api/status        -> JSON: schedule + registry + run state + last log
//   POST /api/run           -> spawn `npm run scrape -- --all` in ../scraper
//   POST /api/run-one       -> body { slug } -> spawn `npm run scrape -- --slug <slug>`
// One concurrent run at a time. State held in memory (resets on restart).

import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 5174);
const PROJECT_ROOT = resolve(__dirname, '..');
const SCRAPER_DIR = resolve(PROJECT_ROOT, 'scraper');
const REGISTRY_FILE = resolve(PROJECT_ROOT, 'sources/universities.list.md');
const AGGREGATORS_FILE = resolve(PROJECT_ROOT, 'sources/aggregators.md');
const CATALOG_DIR = resolve(PROJECT_ROOT, 'site/src/content/universities');
const CRON_FILE = resolve(PROJECT_ROOT, '.github/workflows/scrape-monthly.yml');

const state = {
  running: false,
  startedAt: null,
  finishedAt: null,
  exitCode: null,
  log: [],
  currentTarget: null,
};

function pushLog(line) {
  const trimmed = line.trimEnd();
  if (trimmed.length === 0) return;
  state.log.push({ at: new Date().toISOString(), line: trimmed });
  if (state.log.length > 500) state.log.shift();
}

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
      try { host = baseUrl ? new URL(baseUrl).hostname.replace(/^www\./, '') : ''; } catch {}
      const tierMatch = section.match(/Confidence tier in our schema:\*\*\s*`?([a-z]+)`?/i);
      const name = slug
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      aggregators.push({ slug, name, baseUrl, host, tier: tierMatch ? tierMatch[1] : 'aggregator' });
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
    try { host = new URL(u).hostname.replace(/^www\./, ''); } catch { continue; }
    const match = aggregators.find((a) => a.host && (host === a.host || host.endsWith('.' + a.host)));
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
      const cells = line.split('|').map((c) => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
      if (cells.length < 8) continue;
      const [slug, name, country, city, tier, officialUrl, aggregatorUrlCell] = cells;
      if (slug === 'slug' || slug.startsWith('---')) continue;
      if (tier !== 'partner' && tier !== 'official' && tier !== 'aggregator') continue;
      const aggregatorSlug = resolveAggregatorSlug(aggregatorUrlCell, aggregators);
      rows.push({ slug, name, country, city, tier, officialUrl: officialUrl || null, aggregatorSlug });
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
  // Supports "M H D * *" (e.g. "0 3 1 * *"). Returns ISO UTC, or null.
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
  let candidate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), dayOfMonth, hour, minute, 0));
  if (candidate <= now) {
    candidate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, dayOfMonth, hour, minute, 0));
  }
  return candidate.toISOString();
}

function spawnNpmScript(scriptName, args, target) {
  if (state.running) return false;
  state.running = true;
  state.startedAt = new Date().toISOString();
  state.finishedAt = null;
  state.exitCode = null;
  state.log = [];
  state.currentTarget = target;
  pushLog('> npm run ' + scriptName + (args.length ? ' -- ' + args.join(' ') : ''));

  const npmArgs = ['run', scriptName, ...(args.length ? ['--', ...args] : [])];
  const child = spawn('npm', npmArgs, {
    cwd: SCRAPER_DIR,
    shell: process.platform === 'win32',
  });
  child.stdout.on('data', (chunk) => chunk.toString().split('\n').forEach(pushLog));
  child.stderr.on('data', (chunk) => chunk.toString().split('\n').forEach(pushLog));
  child.on('close', (code) => {
    state.running = false;
    state.finishedAt = new Date().toISOString();
    state.exitCode = code;
    pushLog('= exit ' + code);
  });
  child.on('error', (err) => {
    pushLog('! spawn error: ' + err.message);
    state.running = false;
    state.finishedAt = new Date().toISOString();
    state.exitCode = -1;
  });
  return true;
}

function startScrape(args, target) {
  return spawnNpmScript('scrape', args, target);
}

function startVerify() {
  return spawnNpmScript('verify', [], 'verify');
}

function readJsonBody(req) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolveBody(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function setCors(res) {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type');
  res.setHeader('access-control-max-age', '600');
}

const server = createServer(async (req, res) => {
  try {
    setCors(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      const html = await readFile(resolve(__dirname, 'public/index.html'), 'utf8');
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(html);
    }

    if (req.method === 'GET' && req.url === '/api/status') {
      const [catalog, cron, aggregators] = await Promise.all([
        readCatalog(),
        readCronExpression(),
        readAggregators(),
      ]);
      const registry = await readRegistry(aggregators);
      const merged = registry.map((row) => ({
        ...row,
        catalog: catalog[row.slug] ?? null,
      }));
      const defaultProfile = aggregators[0] ?? {
        slug: 'kaplan-pathways',
        name: 'Kaplan Pathways',
        baseUrl: 'https://www.kaplanpathways.com/',
        tier: 'partner',
      };
      const payload = {
        run: {
          running: state.running,
          startedAt: state.startedAt,
          finishedAt: state.finishedAt,
          exitCode: state.exitCode,
          currentTarget: state.currentTarget,
          log: state.log,
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
        registry: merged,
      };
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify(payload));
    }

    if (req.method === 'POST' && req.url === '/api/run') {
      if (state.running) {
        res.writeHead(409, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ error: 'already running' }));
      }
      const ok = startScrape(['--all'], 'all');
      res.writeHead(ok ? 202 : 409, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ accepted: ok }));
    }

    if (req.method === 'POST' && req.url === '/api/run-one') {
      if (state.running) {
        res.writeHead(409, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ error: 'already running' }));
      }
      const body = await readJsonBody(req);
      const slug = String(body.slug ?? '').trim();
      if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)) {
        res.writeHead(400, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ error: 'invalid slug' }));
      }
      const ok = startScrape(['--slug', slug], slug);
      res.writeHead(ok ? 202 : 409, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ accepted: ok, slug }));
    }

    if (req.method === 'POST' && req.url === '/api/verify') {
      if (state.running) {
        res.writeHead(409, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ error: 'already running' }));
      }
      const ok = startVerify();
      res.writeHead(ok ? 202 : 409, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ accepted: ok }));
    }

    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('server error: ' + err.message);
  }
});

server.listen(PORT, () => {
  console.log('StudyRoom control panel -> http://localhost:' + PORT);
  console.log('(scraper at ' + SCRAPER_DIR + ')');
});
