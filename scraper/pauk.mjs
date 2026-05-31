#!/usr/bin/env node
// pauk.mjs — ПАУК director (programs domain orchestrator).
// Runs the full programs enrichment pipeline in order:
//   1. Collectors (aggregators) → sources/*-extracts/
//   2. detect-gaps → sources/shmel-worklist.json
//   3. shmel (verifier) → sources/official-extracts/
//   4. merge-programs → catalog/*.json (enrichment, never deletes)
//   5. validate-unis (Zod check)
//
// Usage: node scraper/pauk.mjs [--skip-collectors] [--skip-shmel] [--dry-run] [--limit=N] [--headed] [--slug SLUG]
//
// Flags:
//   --skip-collectors   use existing extracts, skip scraping
//   --skip-shmel        skip official site verification step
//   --dry-run           merge-programs reports but does not write
//   --limit=N           pass --limit=N to each sub-script (smoke test)
//   --headed            pass to Playwright collectors (show browser)
//   --slug SLUG         process only one university (for БАМБЛБИ targeted re-runs)

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKIP_COLLECTORS = process.argv.includes('--skip-collectors');
const SKIP_SHMEL = process.argv.includes('--skip-shmel');
const DRY_RUN = process.argv.includes('--dry-run');
const HEADED = process.argv.includes('--headed');
const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit=')) || '';
const _slugIdx = process.argv.indexOf('--slug');
const SLUG_ARG = _slugIdx >= 0 ? process.argv[_slugIdx + 1] : null;

const log = (...a) => process.stderr.write(`[ПАУК] ${new Date().toISOString().slice(11, 19)} ${a.join(' ')}\n`);

function runScript(scriptPath, extraArgs = []) {
  const args = [scriptPath, ...extraArgs];
  if (LIMIT_ARG) args.push(LIMIT_ARG);
  if (SLUG_ARG && !args.some(a => a.startsWith('--slug'))) args.push(`--slug=${SLUG_ARG}`);
  return new Promise((resolve) => {
    log(`→ ${path.basename(scriptPath)} ${extraArgs.join(' ')}`);
    const child = spawn('node', args, {
      stdio: ['ignore', 'pipe', 'inherit'],
      env: { ...process.env },
    });
    let stdout = '';
    child.stdout.on('data', d => { stdout += d; });
    child.on('close', code => {
      let result = {};
      try { result = JSON.parse(stdout.trim()); } catch { result = { raw: stdout.slice(0, 200) }; }
      if (code !== 0) log(`WARN: exit ${code} — ${JSON.stringify(result)}`);
      else log(`✓ ${JSON.stringify(result)}`);
      resolve({ script: path.basename(scriptPath), code, ...result });
    });
    child.on('error', e => resolve({ script: path.basename(scriptPath), code: -1, error: e.message }));
  });
}

function S(name, ...extra) { return runScript(path.join(__dirname, name), extra); }

async function runTsx(script) {
  return new Promise((resolve) => {
    const tsx = path.join(__dirname, 'node_modules/tsx/dist/cli.mjs');
    const child = spawn('node', [tsx, path.join(__dirname, script)], {
      stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env },
    });
    let out = '';
    child.stdout.on('data', d => { out += d; });
    child.on('close', code => {
      let r = {}; try { r = JSON.parse(out.trim()); } catch { r = { raw: out.slice(0, 200) }; }
      resolve({ script, code, ...r });
    });
    child.on('error', e => resolve({ script, code: -1, error: e.message }));
  });
}

// ---- pipeline ----
log('starting — ' + (DRY_RUN ? 'DRY RUN' : 'LIVE'));
const report = {};

// Phase 1: Collectors
if (!SKIP_COLLECTORS) {
  log('=== Phase 1: Collectors ===');
  // Fetch-based (parallel — no browser contention)
  const [qahe, gedu] = await Promise.all([S('scrape-qahe-all.mjs'), S('scrape-gedu-all.mjs')]);
  report['scrape-qahe-all'] = qahe;
  report['scrape-gedu-all'] = gedu;

  // Playwright-based (sequential)
  if (process.env.EDVOY_LOGIN && process.env.EDVOY_PASS) {
    report['scrape-edvoy-all'] = await S('scrape-edvoy-all.mjs', ...(HEADED ? ['--headed'] : []));
  } else { log('SKIP edvoy: EDVOY_LOGIN not set'); }

  if (process.env.IAPRO_LOGIN && process.env.IAPRO_PASS) {
    report['scrape-iapro-all'] = await S('scrape-iapro-all.mjs', ...(HEADED ? ['--headed'] : []));
  } else { log('SKIP iapro: IAPRO_LOGIN not set'); }
} else {
  log('=== Phase 1: Collectors SKIPPED ===');
}

// Phase 2: Gap detection
log('=== Phase 2: detect-gaps ===');
report['detect-gaps'] = await S('detect-gaps.mjs');

// Phase 3: Official site verifier
if (!SKIP_SHMEL) {
  log('=== Phase 3: shmel ===');
  report['shmel'] = await S('shmel.mjs', '--concurrency=4');
} else {
  log('=== Phase 3: shmel SKIPPED ===');
}

// Phase 4: Merge all extracts into catalog
log('=== Phase 4: merge-programs ===');
report['merge-programs'] = await S('merge-programs.mjs', ...(DRY_RUN ? ['--dry-run'] : []));

// Phase 5: Zod validate
log('=== Phase 5: validate-unis ===');
report['validate-unis'] = await runTsx('src/validate-unis.ts');

log('pipeline complete');
const ok = report['validate-unis']?.bad === 0;
console.log(JSON.stringify({ pipeline: 'pauk', dryRun: DRY_RUN, ok, steps: report }, null, 2));
process.exit(ok ? 0 : 1);
