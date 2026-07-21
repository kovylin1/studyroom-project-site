#!/usr/bin/env node
// orel.mjs — ОРЁЛ director (photos orchestrator). Runs AFTER паук.mjs + bobr.mjs.
// Pipeline: discover → download → resize → quality-filter → fill-gaps → validate
//
// Usage: node scraper/orel.mjs [--skip-download] [--dry-run] [--limit=N] [--slug SLUG]
//
// Flags:
//   --skip-download   use existing photos, skip discovery/download
//   --dry-run         pass to quality filter (no writes)
//   --limit=N         pass to each sub-script
//   --slug SLUG       process only one university (for БАМБЛБИ targeted re-runs)

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKIP_DOWNLOAD = process.argv.includes('--skip-download');
const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit=')) || '';
const _slugIdx = process.argv.indexOf('--slug');
const SLUG_ARG = _slugIdx >= 0 ? process.argv[_slugIdx + 1] : null;
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

const SLUG_PAIR = SLUG_ARG ? ['--slug', SLUG_ARG] : [];
const SLUGS_PAIR = SLUG_ARG ? ['--slugs', SLUG_ARG] : [];

log('starting' + (SKIP_DOWNLOAD ? ' [skip-download]' : '') + (DRY_RUN ? ' [dry-run]' : '') + (SLUG_ARG ? ` [slug=${SLUG_ARG}]` : ''));
const report = {};

// Phase 1: Discovery + download (parallel sources, then sequential heavier tasks)
if (!SKIP_DOWNLOAD) {
  log('=== Phase 1: discover + download ===');
  const [wiki, wikipedia, fallback] = await Promise.all([
    run('discover-photos.mjs', ...SLUG_PAIR),
    run('discover-photos-wikipedia.mjs', ...SLUG_PAIR),
    run('discover-photos-fallback.mjs', ...SLUG_PAIR),
  ]);
  report['discover-photos'] = wiki;
  report['discover-photos-wikipedia'] = wikipedia;
  report['discover-photos-fallback'] = fallback;

  report['download-photos'] = await run('download-photos.mjs', ...SLUG_PAIR);
  report['scrape-wiki-photos'] = await run('scrape-wiki-photos.mjs', ...SLUG_PAIR);
  report['resize-photos'] = await run('resize-photos.mjs', ...SLUGS_PAIR);
} else {
  log('=== Phase 1: SKIPPED ===');
}

// Phase 2: Fill gaps with library photos (from bobr-buildlib)
// ИДЁТ ПЕРЕД ОРЛОМ: добивка создаёт новые ссылки на фото, и если пустить её
// после, эти фото останутся без пометки imgKind до следующего прогона.
log('=== Phase 2: fill gaps ===');
report['bobr-variety'] = await run('bobr-variety.mjs');
report['bobr-backfill'] = await run('bobr-backfill.mjs');

// Phase 3: достоверность фото — пометить, найти замену, применить 1:1.
// Порядок внутри фазы обязателен: hunt отбирает по реестру, который строит
// audit, а apply перепроверяет по нему же.
//
// --dry-run пробрасывается в КАЖДУЮ фазу поимённо. Именно непроброшенный флаг
// был багом bobr.mjs: «сухой» прогон создал файл вуза и изменил ещё 99.
log('=== Phase 3: достоверность фото (ОРЁЛ) ===');
// Скрипты ОРЛА читают слаг ТОЛЬКО в форме --slug=X, а SLUG_PAIR выше — это
// форма «--slug X» для старых скриптов. Перепутать их значит молча обойти
// весь каталог там, где просили один вуз.
const DRY = DRY_RUN ? ['--dry-run'] : [];
const SLUG_EQ = SLUG_ARG ? [`--slug=${SLUG_ARG}`] : [];
report['orel-audit'] = await run('orel-audit.mjs', ...DRY, ...SLUG_EQ);
report['orel-hunt'] = await run('orel-hunt.mjs', ...DRY, ...SLUG_EQ);
report['orel-apply'] = await run('orel-apply.mjs', ...DRY, ...SLUG_EQ);
report['orel-preview'] = await run('orel-preview.mjs');

// Phase 4: Validate Zod
log('=== Phase 4: validate ===');
report['validate-unis'] = await runTsx('src/validate-unis.ts');

const ok = report['validate-unis']?.bad === 0;
log('pipeline complete');
console.log(JSON.stringify({ pipeline: 'orel', dryRun: DRY_RUN, ok, steps: report }, null, 2));
process.exit(ok ? 0 : 1);
