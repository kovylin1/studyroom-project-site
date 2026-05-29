#!/usr/bin/env node
// smoke-test-all.mjs — быстрая проверка всех коллекторов (--limit=1).
// Пропускает скрипты требующие credentials, если они не заданы в env.
// Usage: node scraper/smoke-test-all.mjs

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
<<<<<<< HEAD
import { readFileSync, existsSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env manually (no dotenv dependency needed)
const envFile = path.join(__dirname, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
=======

const __dirname = path.dirname(fileURLToPath(import.meta.url));
>>>>>>> origin/main
const log = (...a) => process.stderr.write(`[smoke] ${a.join(' ')}\n`);

const COLLECTORS = [
  { name: 'navitas-uk',      script: 'seed-navitas-uk.mjs',           args: [],             needsEnv: [] },
  { name: 'navitas-au',      script: 'seed-navitas-au.mjs',           args: [],             needsEnv: [] },
  { name: 'oxford-intl',     script: 'seed-oxfordintl-uk.mjs',        args: [],             needsEnv: [] },
  { name: 'qahe',            script: 'scrape-qahe-all.mjs',           args: ['--limit=1'],  needsEnv: [] },
  { name: 'cats',            script: 'scrape-cats-all.mjs',           args: ['--dry-run'],  needsEnv: [] },
  { name: 'volk',            script: 'scrape-volk-collab-v3.mjs',     args: ['--limit=1'],  needsEnv: [] },
  { name: 'gedu',            script: 'scrape-gedu-all.mjs',           args: ['--limit=1'],  needsEnv: [] },
  { name: 'edvoy',           script: 'scrape-edvoy-all.mjs',          args: ['--limit=1'],  needsEnv: ['EDVOY_LOGIN', 'EDVOY_PASS'] },
  { name: 'studygroup',      script: 'scrape-studygroup-all.mjs',     args: ['--limit=1'],  needsEnv: ['SG_LOGIN', 'SG_PASS'] },
  { name: 'iapro',           script: 'scrape-iapro-all.mjs',          args: ['--limit=1'],  needsEnv: ['IAPRO_LOGIN', 'IAPRO_PASS'] },
  { name: 'qs-topuniversities', script: 'discover-qs-partners.mjs',  args: ['--limit=1'],  needsEnv: ['QS_LOGIN', 'QS_PASS'] },
];

function run(script, args, env) {
  return new Promise((resolve) => {
    const child = spawn('node', [path.join(__dirname, script), ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
      timeout: 30000,
    });
    let out = '', err = '';
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { err += d; });
    child.on('close', code => resolve({ code, out: out.slice(0, 200), err: err.slice(-300) }));
    child.on('error', e => resolve({ code: -1, out: '', err: e.message }));
  });
}

const results = [];
for (const c of COLLECTORS) {
  const missing = c.needsEnv.filter(k => !process.env[k]);
  if (missing.length) {
    log(`SKIP ${c.name} — missing: ${missing.join(', ')}`);
    results.push({ name: c.name, status: 'skipped', reason: `no ${missing.join(', ')}` });
    continue;
  }
  log(`→ ${c.name}`);
  const r = await run(c.script, c.args, {});
  const ok = r.code === 0;
  log(`${ok ? '✓' : '✗'} ${c.name} (exit ${r.code})`);
  results.push({ name: c.name, status: ok ? 'ok' : 'fail', code: r.code, hint: ok ? r.out.trim().slice(0, 100) : r.err.trim().slice(-150) });
}

console.log('\n=== SMOKE TEST RESULTS ===');
for (const r of results) {
  const icon = r.status === 'ok' ? '✅' : r.status === 'skipped' ? '⏸️' : '❌';
  console.log(`${icon} ${r.name.padEnd(20)} ${r.status}${r.reason ? ' — ' + r.reason : ''}${r.hint ? '\n     ' + r.hint : ''}`);
}
const failed = results.filter(r => r.status === 'fail');
console.log(`\n${results.filter(r=>r.status==='ok').length} ok, ${results.filter(r=>r.status==='skipped').length} skipped, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
