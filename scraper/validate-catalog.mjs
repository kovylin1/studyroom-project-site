#!/usr/bin/env node
// validate-catalog.mjs — pre-build data gate.
// Scans all universities/*.json, auto-fixes invalid program slugs,
// reports unfixable issues, exits 1 only if data is truly broken.
//
// Usage: node scraper/validate-catalog.mjs [--fix] [--slug=<uni>]
//   --fix   write fixes back to disk (default: true)
//   --slug  only check one university

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const UNI_DIR = path.resolve(PROJECT_ROOT, 'site', 'src', 'content', 'universities');

// SAFETY NET helper: pull the last-committed programs[] for a uni from git HEAD.
// Used when an upstream step (revizor-apply / shmel no-op / bad merge) leaves a
// university with zero programs — which would break the Astro build (programs.min(1)).
function restoreProgramsFromGit(uniSlug) {
  const relPath = `site/src/content/universities/${uniSlug}.json`;
  try {
    const raw = execFileSync('git', ['show', `HEAD:${relPath}`], {
      cwd: PROJECT_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    });
    const prev = JSON.parse(raw);
    return Array.isArray(prev.programs) && prev.programs.length ? prev.programs : null;
  } catch {
    return null;
  }
}

const FIX = !process.argv.includes('--no-fix');
const arg = (p) => (process.argv.find(a => a.startsWith(p)) || '').slice(p.length);
const SLUG_FILTER = arg('--slug=') || null;

const log = (...a) => process.stderr.write(`[validate] ${a.join(' ')}\n`);

function slugify(s) {
  return (s || '').toLowerCase().normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

async function validateFile(filePath, uniSlug) {
  let raw;
  try { raw = await fs.readFile(filePath, 'utf8'); }
  catch { return { ok: true, fixed: 0, errors: [] }; }

  let u;
  try { u = JSON.parse(raw); }
  catch (e) { return { ok: false, fixed: 0, errors: [`parse error: ${e.message}`] }; }

  let programs = u.programs || [];
  const errors = [];
  let fixed = 0;
  let dirty = false;

  // SAFETY NET: a university with zero programs breaks the Astro build (programs.min(1)).
  // This is the deterministic gate right before build — it catches an emptied entry no
  // matter which upstream step caused it. Restore the last-committed programs from git
  // HEAD and flag them brokenLink so the page renders without publishing dead links.
  if (programs.length === 0) {
    const restored = restoreProgramsFromGit(uniSlug);
    if (restored) {
      u.programs = restored.map(p => ({ ...p, brokenLink: true }));
      programs = u.programs;
      fixed += programs.length;
      dirty = true;
      log(`RESTORE ${uniSlug}: empty programs → restored ${programs.length} from git HEAD (flagged brokenLink)`);
    } else {
      errors.push(`programs: empty and could not restore from git HEAD (build requires >=1)`);
    }
  }

  const seenSlugs = new Set();

  for (let i = 0; i < programs.length; i++) {
    const p = programs[i];
    const oldSlug = p.slug;

    // Missing slug
    if (!p.slug) {
      const generated = slugify(`${uniSlug}-${p.title || ''}-${p.level || ''}`);
      if (generated) {
        log(`FIX ${uniSlug}[${i}]: missing slug → "${generated}"`);
        p.slug = generated;
        fixed++;
        dirty = true;
      } else {
        errors.push(`programs[${i}]: no slug and cannot generate one (title="${p.title}")`);
      }
    }

    // Invalid slug
    if (p.slug && !SLUG_RE.test(p.slug)) {
      const fixed_slug = slugify(p.slug);
      if (fixed_slug) {
        log(`FIX ${uniSlug}[${i}]: bad slug "${p.slug}" → "${fixed_slug}"`);
        p.slug = fixed_slug;
        fixed++;
        dirty = true;
      } else {
        const fallback = `${slugify(uniSlug) || 'uni'}-program-${i}`;
        log(`FIX ${uniSlug}[${i}]: bad slug "${p.slug}", slugify gave empty → fallback "${fallback}"`);
        p.slug = fallback;
        fixed++;
        dirty = true;
      }
    }

    // Duplicate slug within this uni
    if (p.slug && seenSlugs.has(p.slug)) {
      let n = 2, deduped = `${p.slug}-${n}`;
      while (seenSlugs.has(deduped)) deduped = `${p.slug}-${++n}`;
      log(`FIX ${uniSlug}[${i}]: duplicate slug "${p.slug}" → "${deduped}"`);
      p.slug = deduped;
      fixed++;
      dirty = true;
    }

    if (p.slug) seenSlugs.add(p.slug);

    // If we renamed the slug, migrate its tuition.byProgram / deadlines entries so the
    // pricing/deadline data follows the program instead of being pruned as an orphan below.
    if (oldSlug && p.slug && oldSlug !== p.slug) {
      if (u.tuition?.byProgram && oldSlug in u.tuition.byProgram) {
        u.tuition.byProgram[p.slug] = u.tuition.byProgram[oldSlug];
        delete u.tuition.byProgram[oldSlug];
        dirty = true;
      }
      if (u.deadlines && oldSlug in u.deadlines) {
        u.deadlines[p.slug] = u.deadlines[oldSlug];
        delete u.deadlines[oldSlug];
        dirty = true;
      }
    }
  }

  // Prune orphaned references: tuition.byProgram / deadlines keyed by a program slug that
  // no longer exists (e.g. shmel refreshed the program set, or revizor deleted a program).
  // The Astro schema's superRefine rejects these, so this is the pre-build gate that keeps
  // both maps consistent with the current programs.
  const validSlugs = new Set((u.programs || []).map(p => p.slug).filter(Boolean));
  for (const [label, map] of [['tuition.byProgram', u.tuition?.byProgram], ['deadlines', u.deadlines]]) {
    if (!map || typeof map !== 'object') continue;
    for (const key of Object.keys(map)) {
      if (!validSlugs.has(key)) {
        log(`PRUNE ${uniSlug}: ${label}["${key}"] → no matching program`);
        delete map[key];
        fixed++;
        dirty = true;
      }
    }
  }

  if (dirty && FIX) {
    await fs.writeFile(filePath, JSON.stringify(u, null, 2) + '\n');
  }

  return { ok: errors.length === 0, fixed, errors };
}

// ── main ──
const files = (await fs.readdir(UNI_DIR)).filter(f => f.endsWith('.json'));
const toCheck = SLUG_FILTER
  ? files.filter(f => f === `${SLUG_FILTER}.json`)
  : files;

log(`scanning ${toCheck.length} universities (fix=${FIX})`);

let totalFixed = 0;
const allErrors = [];

for (const f of toCheck) {
  const uniSlug = f.replace('.json', '');
  const result = await validateFile(path.join(UNI_DIR, f), uniSlug);
  totalFixed += result.fixed;
  for (const e of result.errors) allErrors.push(`${uniSlug}: ${e}`);
}

if (allErrors.length) {
  log(`ERRORS (unfixable):\n${allErrors.map(e => '  ' + e).join('\n')}`);
}

log(`done: ${totalFixed} fixed, ${allErrors.length} unfixable errors`);
console.log(JSON.stringify({ fixed: totalFixed, errors: allErrors.length, details: allErrors }));
process.exit(allErrors.length ? 1 : 0);
