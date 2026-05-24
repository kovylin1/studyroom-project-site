#!/usr/bin/env node
// Overnight orchestrator: ВОЛК (collab) + МУХА v2 (Study Group API) → commit + PR + merge.
// Does NOT touch site/src/content/universities/ — extracts to sources/ only.

import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const ORCH_LOG = path.join(PROJECT_ROOT, 'sources/overnight-volk-mukha.log');

const log = async (msg) => {
  const line = `[orch ${new Date().toISOString().slice(11,19)}] ${msg}`;
  console.error(line);
  await fs.appendFile(ORCH_LOG, line + '\n').catch(()=>{});
};

function run(cmd, args, opts={}) {
  return new Promise(resolve => {
    log(`RUN: ${cmd} ${args.join(' ')}`);
    const p = spawn(cmd, args, { cwd: opts.cwd || PROJECT_ROOT, shell: true, env: { ...process.env, ...(opts.env||{}) } });
    let stdout = '', stderr = '';
    p.stdout.on('data', d => stdout += d);
    p.stderr.on('data', d => stderr += d);
    p.on('close', code => resolve({ code, stdout, stderr }));
  });
}

await fs.writeFile(ORCH_LOG, '');
await log('=== ВОЛК + МУХА START ===');

log('--- launching ВОЛК + МУХА parallel ---');
const [volk, mukha] = await Promise.all([
  run('node', ['scraper/scrape-volk-collab.mjs']),
  run('node', ['scraper/scrape-mukha-api.mjs'], { env: { SG_LOGIN: process.env.SG_LOGIN, SG_PASS: process.env.SG_PASS } }),
]);
await fs.writeFile(path.join(PROJECT_ROOT, 'sources/volk.log'), volk.stderr || '');
await fs.writeFile(path.join(PROJECT_ROOT, 'sources/mukha-api.log'), mukha.stderr || '');
await log(`ВОЛК exit=${volk.code}, stdout=${(volk.stdout||'').slice(0,300)}`);
await log(`МУХА exit=${mukha.code}, stdout=${(mukha.stdout||'').slice(0,300)}`);

await log('--- COMMIT + PR + MERGE ---');
await run('git', ['checkout', '-B', 'feat/volk-mukha']);
await run('git', ['add', 'sources/collab-extracts/', 'sources/studygroup-extracts/', 'scraper/scrape-volk-collab.mjs', 'scraper/scrape-mukha-api.mjs', 'scraper/overnight-volk-mukha.mjs', 'sources/volk.log', 'sources/mukha-api.log', 'sources/overnight-volk-mukha.log']);
const commitRes = await run('git', ['commit', '-m', 'feat(catalog): ВОЛК (collabinternational) + МУХА v2 (Study Group API)']);
await log(`commit exit=${commitRes.code}`);
const pushRes = await run('git', ['push', '-u', 'origin', 'feat/volk-mukha']);
await log(`push exit=${pushRes.code}`);
await run('gh', ['pr', 'create', '--base', 'main', '--head', 'feat/volk-mukha', '--title', 'feat: ВОЛК + МУХА aggregator scrapes', '--body', `ВОЛК: collabinternational extracts in sources/collab-extracts/\nМУХА v2: Study Group API capture in sources/studygroup-extracts/\n(merge into universities/ via next BOBR pipeline)`]);
await run('gh', ['pr', 'merge', '--merge', '--auto']);

await log('=== ВОЛК + МУХА DONE ===');
await log(`SUMMARY: volk=${volk.code}, mukha=${mukha.code}`);
