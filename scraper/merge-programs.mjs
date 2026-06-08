#!/usr/bin/env node
// ПАУК merge engine — multi-source with precedence.
// Reads sources/*-extracts/<slug>.json in precedence order:
//   official-extracts (verifiedBySite=true, overrides) > aggregators (fill nulls only)
// Enriches (never replaces) site/src/content/universities/<slug>.json.
// Constraint: tuition.byProgram + deadlines keys must remain valid program slugs.
//
// Usage: node scraper/merge-programs.mjs [--dry-run] [--slug=<uni-slug>]

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCES_DIR = path.join(__dirname, 'sources');
const CATALOG_DIR = path.join(__dirname, '..', 'site', 'src', 'content', 'universities');

const DRY_RUN = process.argv.includes('--dry-run');
const SLUG_FILTER = (process.argv.find(a => a.startsWith('--slug=')) || '').replace('--slug=', '') || null;
const NOW = new Date().toISOString().slice(0, 10);

// Precedence: official first, then aggregators in collection order
const SOURCES = [
  { dir: 'official-extracts', name: 'official', isOfficial: true },
  { dir: 'edvoy-extracts', name: 'edvoy', isOfficial: false },
  { dir: 'iapro-extracts', name: 'iapro', isOfficial: false },
  { dir: 'qahe-extracts', name: 'qahe', isOfficial: false },
  { dir: 'gedu-extracts', name: 'gedu', isOfficial: false },
  { dir: 'studygroup-extracts', name: 'studygroup', isOfficial: false },
  { dir: 'kaplan-extracts', name: 'kaplan', isOfficial: false },
  { dir: 'navitas-extracts', name: 'navitas', isOfficial: false },
  { dir: 'oxfordintl-extracts', name: 'oxfordintl', isOfficial: false },
  { dir: 'qs-extracts', name: 'qs', isOfficial: false },
  { dir: 'cats-extracts', name: 'cats', isOfficial: false },
  { dir: 'volk-extracts', name: 'collab', isOfficial: false },
];

// Алиасы слагов (каталог → extract): вузы с расходящимися слагами
// (abertay ↔ abertay-university) тоже мёрджатся. Генерится build-slug-aliases.mjs.
let SLUG_ALIASES = {};
try {
  SLUG_ALIASES = JSON.parse(await fs.readFile(path.join(SOURCES_DIR, 'slug-aliases.json'), 'utf8')).aliases || {};
} catch { /* карты ещё нет — работаем без алиасов */ }

function normalize(s) {
  return (s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

function slugify(s) {
  return (s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);
}

const LEVEL_MAP = {
  bachelor: 'bachelor', bachelors: 'bachelor', undergraduate: 'bachelor', ug: 'bachelor',
  'bachelor of science': 'bachelor', 'bachelor of arts': 'bachelor', 'bachelor of engineering': 'bachelor',
  master: 'master', masters: 'master', postgraduate: 'master', pg: 'master', mba: 'master',
  'master of science': 'master', 'master of arts': 'master', 'master of business administration': 'master',
  phd: 'phd', doctorate: 'phd', doctoral: 'phd', 'doctor of philosophy': 'phd',
  foundation: 'foundation', pathway: 'foundation',
  'international foundation': 'foundation', 'international year one': 'foundation',
  'english language': 'english-language', english: 'english-language', esol: 'english-language',
  'sixth form': 'sixth-form', 'a level': 'sixth-form',
  'high school': 'high-school',
  'short course': 'short-course', certificate: 'short-course',
};

function mapLevel(raw) {
  if (!raw) return null;
  const key = normalize(raw);
  if (LEVEL_MAP[key]) return LEVEL_MAP[key];
  for (const [k, v] of Object.entries(LEVEL_MAP)) {
    if (key.startsWith(k)) return v;
  }
  return null;
}

function defaultDurationYears(level) {
  switch (level) {
    case 'bachelor': return 3;
    case 'master': return 1;
    case 'phd': return 3;
    case 'foundation': return 1;
    case 'english-language': return 1;
    case 'sixth-form': return 2;
    case 'high-school': return 2;
    case 'short-course': return 0.5;
    default: return 1;
  }
}

function parseDurationYears(dur, level) {
  if (typeof dur === 'number' && dur > 0) return dur;
  if (!dur) return defaultDurationYears(level);
  const m = String(dur).match(/(\d+(?:\.\d+)?)\s*(year|month)/i);
  if (!m) return defaultDurationYears(level);
  const n = parseFloat(m[1]);
  if (/month/i.test(m[2])) return Math.max(0.25, Math.round((n / 12) * 4) / 4);
  return n;
}

function dedupKey(title, level) {
  return `${normalize(title)}|${(level || '').toLowerCase()}`;
}

function applyExtract(byKey, extract, sourceName, isOfficial, uniSlug) {
  let added = 0, enriched = 0;

  for (const ep of extract.programs || []) {
    const level = mapLevel(ep.level) || ep.level;
    if (!level) continue;
    const key = dedupKey(ep.title, level);

    if (byKey.has(key)) {
      const p = byKey.get(key);
      if (isOfficial) {
        // Official overrides aggregator data for matching programs
        if (ep.programUrl) p.programUrl = ep.programUrl;
        p.verifiedBySite = true;
        p.source = 'official';
        p.checkedAt = ep.checkedAt || NOW;
        enriched++;
      } else {
        // Aggregator: fill only missing provenance
        let changed = false;
        if (!p.source) { p.source = sourceName; changed = true; }
        if (p.verifiedBySite == null) { p.verifiedBySite = false; changed = true; }
        if (!p.checkedAt) { p.checkedAt = NOW; changed = true; }
        if (changed) enriched++;
      }
    } else {
      // New program from this source
      const durationYears = parseDurationYears(ep.duration ?? ep.durationYears, level);
      let baseSlug = slugify(ep.slug || `${uniSlug}-${ep.title}-${level}`);
      if (!baseSlug) baseSlug = slugify(`${uniSlug}-${level}`) || slugify(uniSlug) || 'program';
      const existingSlugs = new Set([...byKey.values()].map(p => p.slug));
      let finalSlug = baseSlug;
      let n = 2;
      while (existingSlugs.has(finalSlug)) finalSlug = `${baseSlug}-${n++}`;
      // dedup suffix is always baseSlug + digit — both already valid chars

      const newProg = {
        slug: finalSlug,
        title: ep.title,
        durationYears,
        level,
        source: isOfficial ? 'official' : sourceName,
        verifiedBySite: isOfficial,
        checkedAt: ep.checkedAt || NOW,
      };
      if (ep.programUrl) newProg.programUrl = ep.programUrl;
      const intakes = ep.intake ?? ep.intakes;
      if (Array.isArray(intakes) && intakes.length > 0) newProg.intakes = intakes;

      byKey.set(key, newProg);
      added++;
    }
  }
  return { added, enriched };
}

async function mergeAllSourcesForSlug(slug) {
  const catalogPath = path.join(CATALOG_DIR, `${slug}.json`);
  const catalog = JSON.parse(await fs.readFile(catalogPath, 'utf8'));

  // Index existing catalog programs
  const byKey = new Map();
  for (const p of catalog.programs || []) byKey.set(dedupKey(p.title, p.level), p);

  let totalAdded = 0, totalEnriched = 0;
  const sourcesUsed = [];

  for (const src of SOURCES) {
    // Точный слаг, затем алиасы (extract под другим именем).
    // Array.isArray — guard от прототипных коллизий слага (вуз «constructor»).
    const aliasList = SLUG_ALIASES[slug];
    const candidates = [slug, ...(Array.isArray(aliasList) ? aliasList : [])];
    let extract = null;
    for (const c of candidates) {
      try { extract = JSON.parse(await fs.readFile(path.join(SOURCES_DIR, src.dir, `${c}.json`), 'utf8')); break; }
      catch { /* нет такого файла — пробуем следующего кандидата */ }
    }
    if (!extract) continue;
    const { added, enriched } = applyExtract(byKey, extract, src.name, src.isOfficial, slug);
    if (added + enriched > 0) sourcesUsed.push({ source: src.name, added, enriched });
    totalAdded += added;
    totalEnriched += enriched;
  }

  if (totalAdded + totalEnriched === 0) return { added: 0, enriched: 0, sourcesUsed };

  // Rebuild programs: preserve original order, append new at end
  const origKeys = new Set((catalog.programs || []).map(p => dedupKey(p.title, p.level)));
  const programs = (catalog.programs || []).map(p => byKey.get(dedupKey(p.title, p.level)) || p);
  for (const [k, p] of byKey) {
    if (!origKeys.has(k)) programs.push(p);
  }

  // Final-pass: ensure every slug is schema-valid (^[a-z0-9-]+$) and unique
  const seenSlugs = new Set();
  for (let i = 0; i < programs.length; i++) {
    const p = programs[i];
    if (!p.slug || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(p.slug)) {
      p.slug = slugify(p.slug || `${slug}-${p.title}-${p.level}`) || `${slugify(slug) || 'uni'}-program-${i}`;
    }
    let safe = p.slug, dn = 2;
    while (seenSlugs.has(safe)) safe = `${p.slug}-${dn++}`;
    seenSlugs.add(safe);
    p.slug = safe;
  }

  catalog.programs = programs;

  // Sync: drop orphaned tuition/deadline keys
  const programSlugs = new Set(programs.map(p => p.slug));
  if (catalog.tuition?.byProgram) {
    for (const k of Object.keys(catalog.tuition.byProgram)) {
      if (!programSlugs.has(k)) delete catalog.tuition.byProgram[k];
    }
  }
  if (catalog.deadlines) {
    for (const k of Object.keys(catalog.deadlines)) {
      if (!programSlugs.has(k)) delete catalog.deadlines[k];
    }
  }

  if (!DRY_RUN) {
    await fs.writeFile(catalogPath, JSON.stringify(catalog, null, 2) + '\n');
  }
  return { added: totalAdded, enriched: totalEnriched, sourcesUsed };
}

// ---- main: collect all slugs that have at least one extract ----
const slugSet = new Set();
for (const src of SOURCES) {
  try {
    const files = await fs.readdir(path.join(SOURCES_DIR, src.dir));
    for (const f of files) {
      if (f.endsWith('.json')) {
        const slug = f.replace(/\.json$/, '');
        if (!SLUG_FILTER || slug === SLUG_FILTER) slugSet.add(slug);
      }
    }
  } catch { /* dir doesn't exist */ }
}

if (slugSet.size === 0) {
  console.log(JSON.stringify({ status: 'no-extracts', message: 'no sources/*-extracts/ directories found' }));
  process.exit(0);
}

let totalAdded = 0, totalEnriched = 0, matched = 0, skipped = 0;
const errors = [];

for (const slug of slugSet) {
  const catalogPath = path.join(CATALOG_DIR, `${slug}.json`);
  try { await fs.access(catalogPath); }
  catch { skipped++; continue; }

  try {
    const r = await mergeAllSourcesForSlug(slug);
    totalAdded += r.added;
    totalEnriched += r.enriched;
    matched++;
  } catch (e) {
    errors.push(`${slug}: ${e.message}`);
  }
}

for (const e of errors) console.error(e);
console.log(JSON.stringify({ dryRun: DRY_RUN, matched, skipped, totalAdded, totalEnriched, errors: errors.length }));
process.exit(errors.length ? 1 : 0);
