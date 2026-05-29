#!/usr/bin/env node
// revizor-apply.mjs — применяет решения из revizor-review.json к uni JSONs.
//
// Читает site/public/api/revizor-review.json, применяет decisions:
//   decision=delete + issue=missing_on_site  → удаляет programs из uni JSON
//   decision=delete + issue=broken_url       → удаляет programs из uni JSON
//   decision=update + issue=tuition_mismatch → обновляет tuition в uni JSON
//   decision=update + issue=ielts_changed    → обновляет ielts в uni JSON
//   decision=ignore                          → только помечает applied=true
//
// После применения: помечает items applied=true + пишет summary в stdout.
//
// Usage: node scraper/revizor-apply.mjs [--dry-run]

import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const UNI_DIR = path.join(PROJECT_ROOT, 'site/src/content/universities');
const REVIEW_FILE = path.join(PROJECT_ROOT, 'site/public/api/revizor-review.json');

const DRY_RUN = process.argv.includes('--dry-run');
const log = (...a) => process.stderr.write(`[revizor-apply] ${new Date().toISOString().slice(11, 19)} ${a.join(' ')}\n`);

if (!existsSync(REVIEW_FILE)) {
  log('ERROR: revizor-review.json not found');
  process.exit(1);
}

const review = JSON.parse(await fs.readFile(REVIEW_FILE, 'utf8'));
const decided = (review.items || []).filter(i => i.decision !== null && !i.applied);

log(`${decided.length} items to apply`);

const stats = { deleted: 0, updated: 0, ignored: 0, errors: 0 };

for (const item of decided) {
  const uniPath = path.join(UNI_DIR, `${item.slug}.json`);
  if (!existsSync(uniPath)) {
    log(`SKIP ${item.slug}: file not found`);
    item.applied = true;
    continue;
  }

  let u;
  try { u = JSON.parse(await fs.readFile(uniPath, 'utf8')); }
  catch (e) { log(`ERR ${item.slug}: ${e.message}`); stats.errors++; continue; }

  let changed = false;

  if (item.decision === 'ignore') {
    stats.ignored++;
    item.applied = true;
    continue;
  }

  if (item.decision === 'delete' && (item.issue === 'missing_on_site' || item.issue === 'broken_url')) {
    const toDelete = new Set((item.programs || []).map(p => p.slug).filter(Boolean));
    const toDeleteTitles = new Set((item.programs || []).map(p => p.title).filter(Boolean));
    const before = (u.programs || []).length;
    u.programs = (u.programs || []).filter(p => !toDelete.has(p.slug) && !toDeleteTitles.has(p.title));
    const after = u.programs.length;
    if (before !== after) {
      // Clean up tuition.byProgram and deadlines for deleted slugs
      if (u.tuition?.byProgram) {
        for (const s of toDelete) delete u.tuition.byProgram[s];
      }
      if (u.deadlines) {
        for (const s of toDelete) delete u.deadlines[s];
      }
      changed = true;
      stats.deleted += before - after;
      log(`${item.slug}: deleted ${before - after} programs`);
    }
  }

  if (item.decision === 'update' && item.issue === 'tuition_mismatch' && item.official) {
    if (!u.tuition) u.tuition = {};
    u.tuition.currency = item.official.currency;
    // Update all byProgram values proportionally (scale existing values)
    if (u.tuition.byProgram && item.catalog?.value) {
      const ratio = item.official.value / item.catalog.value;
      for (const k of Object.keys(u.tuition.byProgram)) {
        u.tuition.byProgram[k] = Math.round(u.tuition.byProgram[k] * ratio);
      }
    }
    changed = true;
    stats.updated++;
    log(`${item.slug}: updated tuition → ${item.official.currency} ${item.official.value}`);
  }

  if (item.decision === 'update' && item.issue === 'ielts_changed' && item.official) {
    if (!u.requirements) u.requirements = {};
    if (!u.requirements.language) u.requirements.language = {};
    u.requirements.language.ielts = item.official;
    changed = true;
    stats.updated++;
    log(`${item.slug}: updated IELTS → ${item.official}`);
  }

  if (changed && !DRY_RUN) {
    await fs.writeFile(uniPath, JSON.stringify(u, null, 2) + '\n');
  }
  item.applied = true;
}

// Update review file
const pending = (review.items || []).filter(i => i.decision === null).length;
const allApplied = (review.items || []).filter(i => i.applied).length;
review.summary = { ...review.summary, pending, applied: allApplied, ignored: stats.ignored };
review.appliedAt = new Date().toISOString();

if (!DRY_RUN) {
  await fs.writeFile(REVIEW_FILE, JSON.stringify(review, null, 2) + '\n');
  log(`✓ updated revizor-review.json`);
} else {
  log(`dry-run: would delete=${stats.deleted} update=${stats.updated} ignore=${stats.ignored}`);
}

log(`DONE: deleted=${stats.deleted} updated=${stats.updated} ignored=${stats.ignored} errors=${stats.errors}`);
console.log(JSON.stringify({ ...stats, pending, totalApplied: allApplied }));
