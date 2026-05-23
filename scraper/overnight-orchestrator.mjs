#!/usr/bin/env node
// Overnight autopilot:
// 1. Wait for ПАУК (expand-programs-v2.mjs) to finish — poll v2-all.log for SUMMARY
// 2. Run БОБЁР (bobr-accommodation-merge.mjs)
// 3. Orphan/schema sweep on universities/*.json
// 4. npm build (retry once if schema error after auto-fix)
// 5. wrangler deploy
// 6. git commit + push

import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const UNI_DIR = path.join(PROJECT_ROOT, 'site/src/content/universities');
const PAUK_LOG = path.join(PROJECT_ROOT, 'sources/v2-all.log');
const ORCH_LOG = path.join(PROJECT_ROOT, 'sources/overnight.log');

const log = async (msg) => {
  const line = `[orch ${new Date().toISOString().slice(11,19)}] ${msg}`;
  console.error(line);
  await fs.appendFile(ORCH_LOG, line + '\n').catch(()=>{});
};

function run(cmd, args, cwd) {
  return new Promise((resolve) => {
    log(`RUN: ${cmd} ${args.join(' ')} (cwd=${cwd||PROJECT_ROOT})`);
    const p = spawn(cmd, args, { cwd: cwd || PROJECT_ROOT, shell: true });
    let stdout = '', stderr = '';
    p.stdout.on('data', d => stdout += d);
    p.stderr.on('data', d => stderr += d);
    p.on('close', code => resolve({ code, stdout, stderr }));
  });
}

async function waitForPauk() {
  await log('waiting for ПАУК to finish (poll v2-all.log every 30s)');
  for (let i = 0; i < 600; i++) {
    try {
      const txt = await fs.readFile(PAUK_LOG, 'utf8');
      if (txt.includes('---SUMMARY---')) { await log('ПАУК done'); return true; }
    } catch {}
    await new Promise(r => setTimeout(r, 30000));
  }
  await log('TIMEOUT waiting for ПАУК (5h)');
  return false;
}

async function orphanSweep() {
  await log('orphan/schema sweep');
  const files = (await fs.readdir(UNI_DIR)).filter(f => f.endsWith('.json'));
  let touched = 0, fixed = 0;
  for (const f of files) {
    const p = path.join(UNI_DIR, f);
    const u = JSON.parse(await fs.readFile(p, 'utf8'));
    const valid = new Set(u.programs.map(x => x.slug));
    let changed = false;
    for (const prog of u.programs||[]) {
      if (prog.level === 'short') { prog.level = 'short-course'; changed = true; fixed++; }
      if (prog.programType === 'short' || prog.programType === 'research') { prog.programType = 'degree'; changed = true; fixed++; }
      if (prog.slug) {
        const cleaned = prog.slug.replace(/-+$/,'').replace(/^-+/,'').replace(/-{2,}/g,'-');
        if (cleaned !== prog.slug) { prog.slug = cleaned; changed = true; fixed++; }
      }
    }
    if (u.tuition?.byProgram) for (const k of Object.keys(u.tuition.byProgram)) if (!valid.has(k) && k.startsWith(u.slug+'-')) { delete u.tuition.byProgram[k]; changed = true; fixed++; }
    if (u.deadlines && typeof u.deadlines === 'object' && !Array.isArray(u.deadlines)) for (const k of Object.keys(u.deadlines)) if (!valid.has(k) && k.startsWith(u.slug+'-')) { delete u.deadlines[k]; changed = true; fixed++; }
    if (changed) { await fs.writeFile(p, JSON.stringify(u, null, 2) + '\n'); touched++; }
  }
  await log(`sweep: ${fixed} fixes across ${touched} files`);
  return { touched, fixed };
}

await fs.writeFile(ORCH_LOG, '');
await log('=== OVERNIGHT ORCHESTRATOR START ===');

const paukOK = await waitForPauk();
if (!paukOK) { await log('proceeding despite timeout'); }

await log('--- STAGE: БОБЁР ---');
const bobr = await run('node', ['scraper/bobr-accommodation-merge.mjs']);
await log(`БОБЁР exit=${bobr.code}, stderr tail: ${(bobr.stderr||'').slice(-500)}`);
await fs.writeFile(path.join(PROJECT_ROOT, 'sources/bobr.log'), bobr.stderr || '');
await fs.writeFile(path.join(PROJECT_ROOT, 'sources/bobr-result.json'), bobr.stdout || '');

await log('--- STAGE: orphan sweep #1 ---');
await orphanSweep();

await log('--- STAGE: BUILD ---');
let build = await run('npm', ['run', 'build'], path.join(PROJECT_ROOT, 'site'));
if (build.code !== 0) {
  await log(`build failed, auto-fix + retry. tail: ${(build.stderr||'').slice(-800)}`);
  await orphanSweep();
  build = await run('npm', ['run', 'build'], path.join(PROJECT_ROOT, 'site'));
}
if (build.code !== 0) {
  await log(`BUILD STILL FAILING — stopping before deploy. tail: ${(build.stderr||'').slice(-800)}`);
  await fs.writeFile(path.join(PROJECT_ROOT, 'sources/build-error.log'), build.stderr || '');
  process.exit(1);
}
await log('build OK');

await log('--- STAGE: DEPLOY ---');
const deploy = await run('npx', ['wrangler', 'pages', 'deploy', 'dist', '--project-name=studyroom-project-site', '--branch=main', '--commit-dirty=true'], path.join(PROJECT_ROOT, 'site'));
const deployUrl = (deploy.stdout || '').match(/https:\/\/[a-z0-9.-]+\.pages\.dev/i)?.[0] || '?';
await log(`deploy exit=${deploy.code}, url=${deployUrl}`);

await log('--- STAGE: GAP AUDIT ---');
const audit = await run('node', ['scraper/audit-gaps.mjs']);
await log(`audit exit=${audit.code}, stderr: ${(audit.stderr||'').slice(-300)}`);

await log('--- STAGE: COMMIT + PUSH ---');
await run('git', ['add', 'site/src/content/universities/', 'site/src/pages/[slug].astro', 'site/public/api/status.json', 'scraper/bobr-accommodation-merge.mjs', 'scraper/overnight-orchestrator.mjs', 'scraper/audit-gaps.mjs', 'sources/bobr.log', 'sources/bobr-result.json', 'sources/overnight.log', 'sources/audit-report.md']);
const commitRes = await run('git', ['commit', '-m', 'feat(catalog): overnight pipeline (БОБЁР merge + accommodation + map block + deploy)']);
await log(`git commit exit=${commitRes.code}`);
const pushRes = await run('git', ['push', 'origin', 'main']);
await log(`git push exit=${pushRes.code}`);

await log('=== OVERNIGHT ORCHESTRATOR DONE ===');
await log(`SUMMARY: deploy=${deployUrl}, bobr=${bobr.code}, build=${build.code}, push=${pushRes.code}`);
