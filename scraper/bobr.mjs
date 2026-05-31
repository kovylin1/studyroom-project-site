#!/usr/bin/env node
// bobr.mjs — БОБР director (campuses + accommodation orchestrator).
// Pipeline: accommodation merge → campus fill → keyfacts → verifier → photos → validate
//
// Usage: node scraper/bobr.mjs [--skip-photos] [--skip-verifier] [--dry-run] [--limit=N] [--slug SLUG]

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKIP_PHOTOS = process.argv.includes('--skip-photos');
const SKIP_VERIFIER = process.argv.includes('--skip-verifier');
const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit=')) || '';
const _slugIdx = process.argv.indexOf('--slug');
const SLUG_ARG = _slugIdx >= 0 ? process.argv[_slugIdx + 1] : null;
const log = (...a) => process.stderr.write(`[БОБР] ${new Date().toISOString().slice(11,19)} ${a.join(' ')}\n`);

function run(script, ...extra) {
  const args = [path.join(__dirname, script), ...extra];
  if (LIMIT_ARG) args.push(LIMIT_ARG);
  if (SLUG_ARG && !args.some(a => a.startsWith('--slug'))) args.push(`--slug=${SLUG_ARG}`);
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

log('starting — ' + (DRY_RUN ? 'DRY RUN' : 'LIVE'));
const report = {};

log('=== Phase 1: campuses + accommodation ===');
report['bobr-accommodation-merge'] = await run('bobr-accommodation-merge.mjs', ...(DRY_RUN ? ['--no-scrape'] : []));
report['bobr-accommodation-v2'] = await run('bobr-accommodation-v2.mjs');
report['bobr-campuses-v2'] = await run('bobr-campuses-v2.mjs');
report['bobr-keyfacts'] = await run('bobr-keyfacts.mjs', ...(DRY_RUN ? ['--dry-run'] : []));

if (!SKIP_VERIFIER) {
  log('=== Phase 2: verifier ===');
  report['bobr-verifier'] = await run('bobr-verifier.mjs', ...(DRY_RUN ? ['--dry-run'] : []));
} else {
  log('=== Phase 2: verifier SKIPPED ===');
}

if (!SKIP_PHOTOS) {
  log('=== Phase 3: photos ===');
  report['bobr-buildlib'] = await run('bobr-buildlib.mjs');
  report['bobr-pilot'] = await run('bobr-pilot.mjs');
  report['bobr-variety'] = await run('bobr-variety.mjs');
  report['bobr-backfill'] = await run('bobr-backfill.mjs');
} else {
  log('=== Phase 3: photos SKIPPED ===');
}

log('=== Phase 4: validate ===');
report['validate-unis'] = await runTsx('src/validate-unis.ts');

const ok = report['validate-unis']?.bad === 0;
log('pipeline complete');
console.log(JSON.stringify({ pipeline: 'bobr', dryRun: DRY_RUN, ok, steps: report }, null, 2));
process.exit(ok ? 0 : 1);
