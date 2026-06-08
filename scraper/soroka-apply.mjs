#!/usr/bin/env node
// soroka-apply.mjs — применяет решения из soroka-review.json к uni JSONs.
//
// СОРОКА — директор достоверных цифр. Её кейсы (формат РЕВИЗОРА) лежат в
// site/public/api/soroka-review.json. Оператор проставляет decision в панели
// manager, этот скрипт их применяет:
//   decision=update + tuition_mismatch  → ставит official-цену в tuition.byProgram[program]
//   decision=delete + tuition_zero      → удаляет программу из uni JSON (с guard «не опустошать»)
//   decision=delete + tuition_outlier   → удаляет программу из uni JSON (с guard «не опустошать»)
//   decision=ignore                     → только помечает applied=true
//   ielts_implausible                   → авто-фикса нет (значение чинят руками, пункт B);
//                                          любое решение лишь помечает applied=true
//
// После применения: помечает items applied=true + пишет summary в stdout.
// Зеркало scraper/revizor-apply.mjs — тот же контракт, те же гарантии каталога.
//
// Usage: node scraper/soroka-apply.mjs [--dry-run]

import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const UNI_DIR = path.join(PROJECT_ROOT, 'site/src/content/universities');
const REVIEW_FILE = path.join(PROJECT_ROOT, 'site/public/api/soroka-review.json');

const DRY_RUN = process.argv.includes('--dry-run');
const log = (...a) => process.stderr.write(`[soroka-apply] ${new Date().toISOString().slice(11, 19)} ${a.join(' ')}\n`);

if (!existsSync(REVIEW_FILE)) {
  log('ERROR: soroka-review.json not found');
  process.exit(1);
}

const review = JSON.parse(await fs.readFile(REVIEW_FILE, 'utf8'));
const decided = (review.items || []).filter(i => i.decision !== null && !i.applied);

log(`${decided.length} items to apply`);

const stats = { deleted: 0, updated: 0, ignored: 0, skipped: 0, errors: 0 };

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

  // ── ignore + любой не-авто-фиксируемый кейс (ielts_implausible) → просто отметить ──
  if (item.decision === 'ignore' || item.issue === 'ielts_implausible') {
    if (item.decision !== 'ignore') stats.skipped++; else stats.ignored++;
    item.applied = true;
    continue;
  }

  // ── delete: убрать проблемную программу из каталога ──
  // tuition_zero / tuition_outlier — у кейса один program-слаг (item.program).
  if (item.decision === 'delete' && (item.issue === 'tuition_zero' || item.issue === 'tuition_outlier')) {
    const target = item.program;
    if (!target) { log(`${item.slug}: SKIP delete — no program slug`); item.applied = true; continue; }
    const before = (u.programs || []).length;
    const kept = (u.programs || []).filter(p => p.slug !== target);

    if (before > 0 && kept.length === 0) {
      // GUARD: никогда не оставлять вуз с пустыми programs (Zod programs.min(1) +
      // правило каталога «обогащать, не резать»). Помечаем brokenLink, страница рендерится.
      u.programs = (u.programs || []).map(p => p.slug === target ? { ...p, brokenLink: true } : p);
      changed = true;
      log(`${item.slug}: SKIP delete — would empty programs; flagged brokenLink instead`);
    } else if (kept.length !== before) {
      u.programs = kept;
      if (u.tuition?.byProgram && typeof u.tuition.byProgram === 'object' && !Array.isArray(u.tuition.byProgram)) {
        delete u.tuition.byProgram[target];
      }
      if (u.deadlines && typeof u.deadlines === 'object' && !Array.isArray(u.deadlines)) {
        delete u.deadlines[target];
      }
      changed = true;
      stats.deleted += before - kept.length;
      log(`${item.slug}: deleted program ${target}`);
    } else {
      log(`${item.slug}: program ${target} not found — nothing to delete`);
    }
  }

  // ── update: подставить official-цену из соседнего источника (tuition_mismatch) ──
  if (item.decision === 'update' && item.issue === 'tuition_mismatch' && item.official != null) {
    const target = item.program;
    const value = Number(item.official);
    if (!target) {
      log(`${item.slug}: SKIP update — no program slug`);
    } else if (!Number.isFinite(value) || value <= 0) {
      log(`${item.slug}: SKIP update — некорректная official-цена «${item.official}»`);
    } else {
      if (!u.tuition) u.tuition = {};
      if (!u.tuition.byProgram || typeof u.tuition.byProgram !== 'object' || Array.isArray(u.tuition.byProgram)) {
        u.tuition.byProgram = {};
      }
      u.tuition.byProgram[target] = Math.round(value);
      changed = true;
      stats.updated++;
      log(`${item.slug}: updated tuition ${target} → ${Math.round(value)}`);
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
  log(`✓ updated soroka-review.json`);
} else {
  log(`dry-run: would delete=${stats.deleted} update=${stats.updated} ignore=${stats.ignored} skip=${stats.skipped}`);
}

log(`DONE: deleted=${stats.deleted} updated=${stats.updated} ignored=${stats.ignored} skipped=${stats.skipped} errors=${stats.errors}`);
console.log(JSON.stringify({ ...stats, pending, totalApplied: allApplied }));
