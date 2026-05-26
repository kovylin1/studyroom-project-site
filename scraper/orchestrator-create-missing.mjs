#!/usr/bin/env node
// Оркестратор фазы-1 «допарсить» (гибрид): create → build-валидация → commit + push + PR (без merge).
// Запуск фоном: node scraper/orchestrator-create-missing.mjs
import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LOG = path.join(ROOT, 'sources/orch-create-missing.log');
const NODE = `"${process.execPath}"`;                                   // full node path (quoted for shell)
const NPM = `"${path.join(path.dirname(process.execPath), 'npm.cmd')}"`; // npm next to node (quoted)
const BRANCH = 'feat/create-missing-extracts';

const log = async (m) => {
  const line = `[orch ${new Date().toISOString().slice(11, 19)}] ${m}`;
  console.error(line);
  await fs.appendFile(LOG, line + '\n').catch(() => {});
};

const NODE_DIR = path.dirname(process.execPath);
const ENV = { ...process.env, PATH: NODE_DIR + path.delimiter + (process.env.PATH || process.env.Path || '') };

function run(cmd, args, cwd) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { cwd, shell: true, env: ENV });
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => resolve({ code, out, err }));
  });
}

(async () => {
  await fs.writeFile(LOG, '');
  await log('=== ORCH START ===');

  // 1) CREATE
  const c = await run(NODE, ['scraper/create-missing-from-extracts.mjs'], ROOT);
  await log(`create exit=${c.code} :: ${(c.out || '').trim().slice(-200)}`);
  if (c.code !== 0) { await log('!! CREATE FAILED — abort'); await log(`stderr: ${(c.err || '').slice(-500)}`); return; }
  let createdN = 0;
  try { createdN = JSON.parse((c.out || '').trim().split('\n').pop()).created; } catch {}
  await log(`created this run=${createdN} (files may already exist from a prior run; proceeding to build either way)`);

  // 2) BUILD (validates Zod content schema + template rendering for all unis)
  await log(`build start (validating ${createdN} new + existing)...`);
  const b = await run(NPM, ['run', 'build'], path.join(ROOT, 'site'));
  if (b.code !== 0) {
    await log('!! BUILD FAILED — NOT committing. Tail:');
    await log((b.err || b.out || '').slice(-1500));
    await log('=== ORCH ABORTED (build red) ===');
    return;
  }
  await log('build OK (green)');

  // 3) GIT: feat branch + commit + push + PR (no merge — leave for review)
  const git = (args) => run('git', args, ROOT);
  await git(['checkout', '-B', BRANCH]);
  await git(['add', 'site/src/content/universities', 'scraper/create-missing-from-extracts.mjs', 'scraper/orchestrator-create-missing.mjs']);
  const added = await git(['diff', '--cached', '--name-only', '--diff-filter=A', '--', 'site/src/content/universities']);
  const newN = (added.out || '').trim().split('\n').filter(Boolean).length;
  await log(`new university files staged: ${newN}`);
  const msg = `feat(catalog): create ${newN} new universities from extracts\n\nedvoy/studygroup/collab/direct extracts that had no catalog file yet.\nDeterministic transform; tuition/deadlines empty (phase-2 enrichment pending).\n\nCo-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`;
  const cm = await git(['commit', '-m', msg]);
  await log(`commit exit=${cm.code} :: ${(cm.out || cm.err || '').trim().slice(-200)}`);
  if (cm.code !== 0) { await log('!! commit failed (nothing staged?) — abort'); return; }

  const push = await git(['push', '-u', 'origin', BRANCH]);
  await log(`push exit=${push.code} :: ${(push.err || push.out || '').trim().slice(-200)}`);
  if (push.code !== 0) { await log('!! push failed — branch committed locally only'); return; }

  const prBody = `Phase-1 of "допарсить" (hybrid). Creates ${newN} universities present in extracts but missing from the catalog.\n\n- Source: edvoy / studygroup / collab / direct-partners extracts\n- Deterministic transform (0 LLM tokens), schema-validated via astro build\n- tuition.byProgram and deadlines intentionally empty — phase-2 per-uni agent enrichment pending\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)`;
  const pr = await run('gh', ['pr', 'create', '--base', 'main', '--head', BRANCH, '--title', `feat(catalog): +${newN} universities from extracts`, '--body', prBody], ROOT);
  await log(`pr exit=${pr.code} :: ${(pr.out || pr.err || '').trim().slice(-300)}`);

  await log('=== ORCH DONE (PR open, awaiting review — NO auto-merge, NO deploy) ===');
})();
