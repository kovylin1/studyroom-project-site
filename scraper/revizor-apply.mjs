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
    // Только у целевых программ БЕЗ slug матчим по title — иначе две программы
    // с одинаковым title (но разными slug) удалились бы обе.
    const toDeleteTitlesNoSlug = new Set(
      (item.programs || []).filter(p => !p.slug && p.title).map(p => p.title),
    );
    const isTargeted = (p) => (p.slug ? toDelete.has(p.slug) : toDeleteTitlesNoSlug.has(p.title));
    const before = (u.programs || []).length;
    const kept = (u.programs || []).filter(p => !isTargeted(p));

    if (before > 0 && kept.length === 0) {
      // GUARD: never leave a university with zero programs.
      // Astro schema requires programs.min(1) → empty array breaks the build;
      // catalog rule: enrich, don't cut. Keep the targeted programs but flag
      // brokenLink so the page still renders and the template can degrade the link.
      u.programs = (u.programs || []).map(p => isTargeted(p) ? { ...p, brokenLink: true } : p);
      changed = true;
      log(`${item.slug}: SKIP delete — would empty programs; flagged ${u.programs.length} brokenLink instead`);
    } else if (kept.length !== before) {
      u.programs = kept;
      // Clean up tuition.byProgram and deadlines for deleted slugs
      if (u.tuition?.byProgram && typeof u.tuition.byProgram === 'object' && !Array.isArray(u.tuition.byProgram)) {
        for (const s of toDelete) delete u.tuition.byProgram[s];
      }
      if (u.deadlines && typeof u.deadlines === 'object' && !Array.isArray(u.deadlines)) {
        for (const s of toDelete) delete u.deadlines[s];
      }
      changed = true;
      stats.deleted += before - kept.length;
      log(`${item.slug}: deleted ${before - kept.length} programs`);
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

  if (item.decision === 'update' && item.issue === 'ielts_changed' && item.official != null) {
    const ielts = Number(item.official);
    if (!Number.isFinite(ielts) || ielts < 0 || ielts > 9) {
      log(`${item.slug}: SKIP IELTS update — некорректное значение «${item.official}» (нужно число 0–9)`);
    } else {
      if (!u.requirements) u.requirements = {};
      if (!u.requirements.language) u.requirements.language = {};
      u.requirements.language.ielts = ielts;
      changed = true;
      stats.updated++;
      log(`${item.slug}: updated IELTS → ${ielts}`);
    }
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
