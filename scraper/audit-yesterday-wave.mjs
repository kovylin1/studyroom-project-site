#!/usr/bin/env node
// Audit & cleanup: for each uni in sources/yesterday-suspect.txt
// 1. Compute programs added by commit 9bb3423 (current vs parent)
// 2. Remove those (they were LLM-written without programUrl → unverifiable)
// Re-running expand-programs-verified.mjs after this will refill from real sources.

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const UNI_DIR = path.join(PROJECT_ROOT, 'site/src/content/universities');
const SUSPECT_FILE = path.join(PROJECT_ROOT, 'sources/yesterday-suspect.txt');
const PARENT_COMMIT = '9bb3423~1';

const suspect = (await fs.readFile(SUSPECT_FILE, 'utf8')).split(/\r?\n/).filter(Boolean);

const report = [];
for (const slug of suspect) {
  const filePath = path.join(UNI_DIR, slug + '.json');
  const relPath = `site/src/content/universities/${slug}.json`;
  const current = JSON.parse(await fs.readFile(filePath,'utf8'));

  let parentJson;
  try {
    const raw = execSync(`git show ${PARENT_COMMIT}:${relPath}`, { cwd: PROJECT_ROOT, encoding: 'utf8', stdio: ['ignore','pipe','ignore'] });
    parentJson = JSON.parse(raw);
  } catch {
    parentJson = { programs: [] };
  }
  const parentSlugs = new Set((parentJson.programs||[]).map(p=>p.slug));
  const added = current.programs.filter(p => !parentSlugs.has(p.slug));
  const toDrop = added.filter(p => !p.verified);
  if (!toDrop.length) {
    report.push({ slug, dropped: 0, before: current.programs.length, after: current.programs.length });
    continue;
  }
  const dropSlugs = new Set(toDrop.map(p=>p.slug));
  current.programs = current.programs.filter(p => !dropSlugs.has(p.slug));
  await fs.writeFile(filePath, JSON.stringify(current, null, 2) + '\n');
  report.push({ slug, dropped: toDrop.length, before: current.programs.length + toDrop.length, after: current.programs.length });
  process.stderr.write(`${slug}: -${toDrop.length} (${current.programs.length + toDrop.length} → ${current.programs.length})\n`);
}

const totalDropped = report.reduce((a,b)=>a+b.dropped, 0);
console.error(`---DONE--- Total dropped: ${totalDropped} across ${report.filter(r=>r.dropped>0).length} unis`);
console.log(JSON.stringify(report, null, 2));
