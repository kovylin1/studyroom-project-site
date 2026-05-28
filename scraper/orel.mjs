#!/usr/bin/env node
// orel.mjs — ОРЁЛ director (photos orchestrator). Runs AFTER паук.mjs + bobr.mjs.
// Pipeline: discover → download → resize → quality-filter → fill-gaps → validate
//
// Usage: node scraper/orel.mjs [--skip-download] [--dry-run] [--limit=N]
//
// Flags:
//   --skip-download   use existing photos, skip discovery/download
//   --dry-run         pass to quality filter (no writes)
//   --limit=N         pass to each sub-script

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKIP_DOWNLOAD = process.argv.includes('--skip-download');
const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit=')) || '';
const log = (...a) => process.stderr.write(`[ОРЁЛ] ${new Date().toISOString().slice(11,19)} ${a.join(' ')}\n`);

function run(script, ...extra) {
  const args = [path.join(__dirname, script), ...extra];
  if (LIMIT_ARG) args.push(LIMIT_ARG);
  return new Promise((resolve) => {
    log(`→ ${script}`);
    const child = spawn('node', args, { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env } });
    let out = '';
    child.stdout.on('data', d => { out += d; });
    child.on('close', code => {
      let r = {}; try { r = JSON.parse(out.trim()); } catch { r = { raw: out.slice(0, 120) }; }
      if (code !== 0) log(`WARN exit ${code}`); else log(`✓ ${JSON.stringify(r)}`);
      resolve({ script, code, ...r });
    });
    child.on('error', e => resolve({ script, code: -1, error: e.message }));
  });
}

async function runTsx(script) {
  const tsx = path.join(__dirname, 'node_modules/tsx/dist/cli.mjs');
  return new Promise((resolve) => {
    const child = spawn('node', [tsx, path.join(__dirname, script)], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env } });
    let out = '';
    child.stdout.on('data', d => { out += d; });
    child.on('close', code => {
      let r = {}; try { r = JSON.parse(out.trim()); } catch { r = { raw: out.slice(0, 120) }; }
      resolve({ script, code, ...r });
    });
    child.on('error', e => resolve({ script, code: -1, error: e.message }));
  });
}

log('starting' + (SKIP_DOWNLOAD ? ' [skip-download]' : '') + (DRY_RUN ? ' [dry-run]' : ''));
const report = {};

// Phase 1: Discovery + download (parallel sources, then sequential heavier tasks)
if (!SKIP_DOWNLOAD) {
  log('=== Phase 1: discover + download ===');
  const [wiki, wikipedia, fallback] = await Promise.all([
    run('discover-photos.mjs'),
    run('discover-photos-wikipedia.mjs'),
    run('discover-photos-fallback.mjs'),
  ]);
  report['discover-photos'] = wiki;
  report['discover-photos-wikipedia'] = wikipedia;
  report['discover-photos-fallback'] = fallback;

  report['download-photos'] = await run('download-photos.mjs');
  report['scrape-wiki-photos'] = await run('scrape-wiki-photos.mjs');
  report['resize-photos'] = await run('resize-photos.mjs');
} else {
  log('=== Phase 1: SKIPPED ===');
}

// Phase 2: Quality filter + dedup (ОРЁЛ verifier)
log('=== Phase 2: quality filter ===');
report['orel-photo-quality'] = await run('orel-photo-quality.mjs');

// Phase 3: Fill gaps with library photos (from bobr-buildlib)
log('=== Phase 3: fill gaps ===');
report['bobr-variety'] = await run('bobr-variety.mjs');
report['bobr-backfill'] = await run('bobr-backfill.mjs');

// Phase 4: Validate Zod
log('=== Phase 4: validate ===');
report['validate-unis'] = await runTsx('src/validate-unis.ts');

const ok = report['validate-unis']?.bad === 0;
log('pipeline complete');
console.log(JSON.stringify({ pipeline: 'orel', dryRun: DRY_RUN, ok, steps: report }, null, 2));
process.exit(ok ? 0 : 1);
