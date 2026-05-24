#!/usr/bin/env node
// Overnight v2: gap-fill campuses + accommodation + photos, then audit + build + deploy.

import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const UNI_DIR = path.join(PROJECT_ROOT, 'site/src/content/universities');
const ORCH_LOG = path.join(PROJECT_ROOT, 'sources/overnight-v2.log');

const log = async (msg) => {
  const line = `[orch2 ${new Date().toISOString().slice(11,19)}] ${msg}`;
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

async function schemaSanitize() {
  await log('schema sanitize');
  const files = (await fs.readdir(UNI_DIR)).filter(f => f.endsWith('.json'));
  let patched = 0;
  for (const f of files) {
    const p = path.join(UNI_DIR, f);
    const u = JSON.parse(await fs.readFile(p, 'utf8'));
    let changed = false;
    if (!u.tuition) { u.tuition = {currency:'USD',byProgram:{}}; changed = true; }
    if (!u.deadlines) { u.deadlines = {}; changed = true; }
    if (!u.requirements) { u.requirements = {language:{},exams:[]}; changed = true; }
    if (!u.city || !u.city.trim?.()) { u.city = u.country || '—'; changed = true; }
    if (!u.country || !u.country.trim?.()) { u.country = '—'; changed = true; }
    if (Array.isArray(u.scholarships)) {
      const cleaned = u.scholarships.filter(s => s && s.name).map(s => {
        const out = {name: s.name};
        if (s.amount && typeof s.amount === 'string' && s.amount.trim()) out.amount = s.amount;
        if (s.description && typeof s.description === 'string' && s.description.trim()) out.description = s.description;
        if (s.nameRu && s.nameRu.trim()) out.nameRu = s.nameRu;
        return out;
      });
      if (JSON.stringify(cleaned) !== JSON.stringify(u.scholarships)) { u.scholarships = cleaned; changed = true; }
    }
    if (Array.isArray(u.campuses)) {
      const cleaned = u.campuses.filter(c => c && (c.title || c.name)).map(c => {
        const out = {title: (c.title || c.name || '').trim()};
        if (c.text && c.text.trim()) out.text = c.text.trim();
        if (c.sub && c.sub.trim()) out.sub = c.sub.trim();
        if (c.img) out.img = c.img;
        return out;
      }).filter(c => c.title);
      if (JSON.stringify(cleaned) !== JSON.stringify(u.campuses)) { u.campuses = cleaned; changed = true; }
    }
    if (u.accommodation?.residences) {
      const cleaned = u.accommodation.residences.filter(r => r && r.name).map(r => {
        const out = {name: r.name.trim()};
        if (r.description && r.description.trim()) out.description = r.description.trim();
        if (r.img) out.img = r.img;
        return out;
      });
      if (JSON.stringify(cleaned) !== JSON.stringify(u.accommodation.residences)) {
        u.accommodation.residences = cleaned; changed = true;
      }
    }
    if (Array.isArray(u.gallery)) {
      u.gallery = { items: u.gallery.filter(x => typeof x === 'string' && x.trim()).map(url => ({ img: url, caption: u.name||'' })) };
      changed = true;
    }
    if (changed) { await fs.writeFile(p, JSON.stringify(u, null, 2) + '\n'); patched++; }
  }
  await log(`schema sanitize: patched ${patched}`);
}

await fs.writeFile(ORCH_LOG, '');
await log('=== OVERNIGHT V2 START ===');

await log('--- STAGE: CAMPUSES v2 ---');
const c = await run('node', ['scraper/bobr-campuses-v2.mjs']);
await fs.writeFile(path.join(PROJECT_ROOT, 'sources/campuses-v2.log'), c.stderr || '');
await log(`campuses exit=${c.code}, stdout=${(c.stdout||'').slice(0,200)}`);

await log('--- STAGE: ACCOMMODATION v2 ---');
const a = await run('node', ['scraper/bobr-accommodation-v2.mjs']);
await fs.writeFile(path.join(PROJECT_ROOT, 'sources/accom-v2.log'), a.stderr || '');
await log(`accom exit=${a.code}, stdout=${(a.stdout||'').slice(0,200)}`);

await log('--- STAGE: PHOTOS — existing scripts ---');
for (const script of ['discover-photos.mjs','discover-photos-fallback.mjs','discover-photos-wikipedia.mjs','discover-logos.mjs']) {
  const scriptPath = path.join(PROJECT_ROOT, 'scraper', script);
  try { await fs.access(scriptPath); }
  catch { await log(`SKIP ${script} (not found)`); continue; }
  const r = await run('node', ['scraper/' + script]);
  await log(`${script} exit=${r.code}`);
}

await log('--- STAGE: SCHEMA SANITIZE ---');
await schemaSanitize();

await log('--- STAGE: BUILD ---');
let build = await run('npm', ['run', 'build'], path.join(PROJECT_ROOT, 'site'));
if (build.code !== 0) {
  await log(`build failed, re-sanitize + retry. tail: ${(build.stderr||'').slice(-800)}`);
  await schemaSanitize();
  build = await run('npm', ['run', 'build'], path.join(PROJECT_ROOT, 'site'));
}
if (build.code !== 0) {
  await log(`BUILD STILL FAILING — stop. tail: ${(build.stderr||'').slice(-1000)}`);
  await fs.writeFile(path.join(PROJECT_ROOT, 'sources/build-v2-error.log'), build.stderr || '');
  process.exit(1);
}
await log('build OK');

await log('--- STAGE: DEPLOY ---');
const deploy = await run('npx', ['wrangler','pages','deploy','dist','--project-name=studyroom-project-site','--branch=main','--commit-dirty=true'], path.join(PROJECT_ROOT, 'site'));
const deployUrl = (deploy.stdout || '').match(/https:\/\/[a-z0-9.-]+\.pages\.dev/i)?.[0] || '?';
await log(`deploy exit=${deploy.code}, url=${deployUrl}`);

await log('--- STAGE: AUDIT v2 ---');
const audit = await run('node', ['scraper/audit-gaps.mjs']);
await log(`audit exit=${audit.code}, stats=${(audit.stderr||'').slice(-200)}`);

await log('--- STAGE: COMMIT + PUSH (via PR) ---');
await run('git', ['checkout', '-B', 'feat/overnight-v2']);
await run('git', ['add', 'site/src/content/universities/', 'site/public/api/status.json', 'scraper/bobr-campuses-v2.mjs', 'scraper/bobr-accommodation-v2.mjs', 'scraper/overnight-v2-orchestrator.mjs', 'sources/campuses-v2.log', 'sources/accom-v2.log', 'sources/overnight-v2.log', 'sources/audit-report.md']);
await run('git', ['commit', '-m', 'feat(catalog): overnight v2 — campuses + accommodation + photos + deploy']);
const pushRes = await run('git', ['push', '-u', 'origin', 'feat/overnight-v2']);
await log(`push exit=${pushRes.code}`);
const prRes = await run('gh', ['pr', 'create', '--base', 'main', '--head', 'feat/overnight-v2', '--title', 'feat: overnight v2 — campuses + accommodation + photos', '--body', `Auto-overnight pipeline v2.\nDeploy: ${deployUrl}\nAudit: sources/audit-report.md`]);
await log(`gh pr create exit=${prRes.code}, stdout=${(prRes.stdout||'').slice(-200)}`);
const mergeRes = await run('gh', ['pr', 'merge', '--merge', '--auto']);
await log(`gh pr merge exit=${mergeRes.code}`);

await log('=== OVERNIGHT V2 DONE ===');
await log(`SUMMARY: deploy=${deployUrl}, campuses=${c.code}, accom=${a.code}, build=${build.code}, push=${pushRes.code}`);
