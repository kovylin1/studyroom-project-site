#!/usr/bin/env node
// Overnight v3 FINAL: waits for orch-v2 + ПАУК-thin → ОРЁЛ → РЕВИЗОР → re-build → deploy → PR

import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const ORCH_LOG = path.join(PROJECT_ROOT, 'sources/overnight-v3-final.log');
const V2_LOG = path.join(PROJECT_ROOT, 'sources/overnight-v2.log');
const THIN_LOG = path.join(PROJECT_ROOT, 'sources/pauk-thin.log');

const log = async (msg) => {
  const line = `[orch3 ${new Date().toISOString().slice(11,19)}] ${msg}`;
  console.error(line);
  await fs.appendFile(ORCH_LOG, line + '\n').catch(()=>{});
};

function run(cmd, args, cwd) {
  return new Promise((resolve) => {
    log(`RUN: ${cmd} ${args.join(' ')}`);
    const p = spawn(cmd, args, { cwd: cwd || PROJECT_ROOT, shell: true });
    let stdout = '', stderr = '';
    p.stdout.on('data', d => stdout += d);
    p.stderr.on('data', d => stderr += d);
    p.on('close', code => resolve({ code, stdout, stderr }));
  });
}

async function waitDone(file, marker, label) {
  await log(`waiting for ${label} (poll ${file} for ${marker})`);
  for (let i = 0; i < 600; i++) {
    try { const txt = await fs.readFile(file, 'utf8'); if (txt.includes(marker)) { await log(`${label} done`); return; } }
    catch {}
    await new Promise(r => setTimeout(r, 30000));
  }
  await log(`${label} TIMEOUT — proceeding anyway`);
}

await fs.writeFile(ORCH_LOG, '');
await log('=== OVERNIGHT V3 FINAL START ===');

await waitDone(V2_LOG, 'OVERNIGHT V2 DONE', 'orchestrator-v2');
await waitDone(THIN_LOG, '---SUMMARY---', 'ПАУК-thin');

await log('--- STAGE: ОРЁЛ (photo quality) ---');
const orel = await run('node', ['scraper/orel-photo-quality.mjs']);
await log(`orel exit=${orel.code}, stdout=${(orel.stdout||'').slice(0,200)}`);

await log('--- STAGE: BUILD (after ОРЁЛ) ---');
let build = await run('npm', ['run', 'build'], path.join(PROJECT_ROOT, 'site'));
if (build.code !== 0) {
  await log(`build failed. tail: ${(build.stderr||'').slice(-800)}`);
  await fs.writeFile(path.join(PROJECT_ROOT, 'sources/build-v3-error.log'), build.stderr || '');
  process.exit(1);
}
await log('build OK');

await log('--- STAGE: DEPLOY ---');
const deploy = await run('npx', ['wrangler','pages','deploy','dist','--project-name=studyroom-project-site','--branch=main','--commit-dirty=true'], path.join(PROJECT_ROOT, 'site'));
const deployUrl = (deploy.stdout || '').match(/https:\/\/[a-z0-9.-]+\.pages\.dev/i)?.[0] || '?';
await log(`deploy exit=${deploy.code}, url=${deployUrl}`);

await log('--- STAGE: РЕВИЗОР ---');
const rev = await run('node', ['scraper/revizor.mjs']);
await log(`revizor exit=${rev.code}, stdout=${(rev.stdout||'').slice(0,500)}`);

await log('--- STAGE: AUDIT v3 ---');
await run('node', ['scraper/audit-gaps.mjs']);

await log('--- STAGE: COMMIT + PR + MERGE ---');
await run('git', ['checkout', '-B', 'feat/overnight-v3-final']);
await run('git', ['add', 'site/src/content/universities/', 'site/public/api/status.json', 'scraper/orel-photo-quality.mjs', 'scraper/revizor.mjs', 'scraper/overnight-v3-final.mjs', 'sources/overnight-v3-final.log', 'sources/revizor-report.md', 'sources/revizor-flags.json', 'sources/audit-report.md']);
await run('git', ['commit', '-m', 'feat(catalog): overnight v3 — ОРЁЛ photo quality + РЕВИЗОР audit + final deploy']);
const pushRes = await run('git', ['push', '-u', 'origin', 'feat/overnight-v3-final']);
await run('gh', ['pr', 'create', '--base', 'main', '--head', 'feat/overnight-v3-final', '--title', 'feat: overnight v3 final', '--body', `Deploy: ${deployUrl}\nRevizor: sources/revizor-report.md\nAudit: sources/audit-report.md`]);
await run('gh', ['pr', 'merge', '--merge', '--auto']);
await log(`push exit=${pushRes.code}`);

await log('=== OVERNIGHT V3 FINAL DONE ===');
await log(`SUMMARY: deploy=${deployUrl}, orel=${orel.code}, build=${build.code}, revizor=${rev.code}`);
