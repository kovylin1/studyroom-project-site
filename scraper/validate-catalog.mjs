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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UNI_DIR = path.resolve(__dirname, '..', 'site', 'src', 'content', 'universities');

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

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

async function validateFile(filePath, uniSlug) {
  let raw;
  try { raw = await fs.readFile(filePath, 'utf8'); }
  catch { return { ok: true, fixed: 0, errors: [] }; }

  let u;
  try { u = JSON.parse(raw); }
  catch (e) { return { ok: false, fixed: 0, errors: [`parse error: ${e.message}`] }; }

  const programs = u.programs || [];
  const errors = [];
  let fixed = 0;
  let dirty = false;

  const seenSlugs = new Set();

  for (let i = 0; i < programs.length; i++) {
    const p = programs[i];

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
