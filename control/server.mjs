#!/usr/bin/env node
// control/server.mjs — local control panel API for StudyRoom manager UI.
// Listens on :5174. Same JSON shape as static status.json + live run state.
//
// Usage: cd control && npm start
//        In manager UI click "изменить" and set: http://localhost:5174
//
// Endpoints:
//   GET  /api/status      — live status JSON
//   POST /api/run         — run full pauk.mjs pipeline
//   POST /api/run-one     — run pauk.mjs --slug=X  (body: {slug})
//   POST /api/verify      — run shmel + generate-verify.mjs
//   GET  /api/verify.json — serve verify.json snapshot

import http from 'http';
import { spawn } from 'child_process';
import { readFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SCRAPER = resolve(ROOT, 'scraper');
const SITE = resolve(ROOT, 'site');
const PORT = 5174;

// ── Live run state ────────────────────────────────────────────────────────
const run = { running: false, startedAt: null, finishedAt: null, exitCode: null, currentTarget: null, log: [] };

function resetRun(target) {
  Object.assign(run, { running: true, startedAt: new Date().toISOString(), finishedAt: null, exitCode: null, currentTarget: target, log: [] });
}
function finishRun(code) {
  Object.assign(run, { running: false, finishedAt: new Date().toISOString(), exitCode: code ?? 1 });
}

function spawnScript(path, args = []) {
  const child = spawn('node', [path, ...args], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env } });
  const onData = d => String(d).split('\n').filter(Boolean).forEach(line => {
    run.log.push({ line: line.trimEnd(), ts: new Date().toISOString() });
    if (run.log.length > 2000) run.log.shift();
  });
  child.stdout.on('data', onData);
  child.stderr.on('data', onData);
  return child;
}

// ── Helpers ───────────────────────────────────────────────────────────────
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
function json(res, data, status = 200) {
  cors(res); res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data));
}
async function body(req) {
  return new Promise(r => { let b = ''; req.on('data', d => b += d); req.on('end', () => { try { r(JSON.parse(b || '{}')); } catch { r({}); } }); });
}
async function staticStatus() {
  try { return JSON.parse(await readFile(resolve(SITE, 'public/api/status.json'), 'utf8')); }
  catch { return { schedule: {}, sourceProfile: {}, aggregators: [], directors: {}, gaps: null, registry: [] }; }
}

// ── Server ────────────────────────────────────────────────────────────────
http.createServer(async (req, res) => {
  const url = req.url?.split('?')[0];
  if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); res.end(); return; }

  if (url === '/api/status' && req.method === 'GET') {
    const base = await staticStatus();
    return json(res, { ...base, run, isStaticSnapshot: false });
  }

  if (url === '/api/verify.json' && req.method === 'GET') {
    try { const raw = await readFile(resolve(SITE, 'public/api/verify.json'), 'utf8'); cors(res); res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(raw); }
    catch { json(res, { error: 'no verify.json yet — run /api/verify first' }, 404); }
    return;
  }

  if (url === '/api/run' && req.method === 'POST') {
    if (run.running) return json(res, { error: 'already running' }, 409);
    resetRun('all');
    const child = spawnScript(resolve(SCRAPER, 'pauk.mjs'), ['--skip-photos']);
    child.on('close', finishRun); child.on('error', () => finishRun(1));
    return json(res, { ok: true });
  }

  if (url === '/api/run-one' && req.method === 'POST') {
    const { slug } = await body(req);
    if (!slug) return json(res, { error: 'slug required' }, 400);
    if (run.running) return json(res, { error: 'already running' }, 409);
    resetRun(slug);
    const child = spawnScript(resolve(SCRAPER, 'pauk.mjs'), ['--slug=' + slug, '--skip-shmel', '--skip-collectors']);
    child.on('close', finishRun); child.on('error', () => finishRun(1));
    return json(res, { ok: true });
  }

  if (url === '/api/verify' && req.method === 'POST') {
    if (run.running) return json(res, { error: 'already running' }, 409);
    resetRun('verify');
    const shmel = spawnScript(resolve(SCRAPER, 'shmel.mjs'), ['--limit=30', '--concurrency=4']);
    shmel.on('close', () => {
      const gv = spawnScript(resolve(SITE, 'scripts/generate-verify.mjs'));
      gv.on('close', finishRun); gv.on('error', () => finishRun(1));
    });
    shmel.on('error', () => finishRun(1));
    return json(res, { ok: true });
  }

  json(res, { error: 'not found' }, 404);
}).listen(PORT, () => {
  console.log('[control] http://localhost:' + PORT + ' — set this in manager UI via "изменить"');
});
