// generate-verify.mjs — reads revizor-flags.json + gaps worklist,
// writes site/public/api/verify.json for the manager UI.

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');
const FLAGS_FILE = resolve(PROJECT_ROOT, 'scraper/sources/revizor-flags.json');
const WORKLIST_FILE = resolve(PROJECT_ROOT, 'scraper/sources/shmel-worklist.json');
const CATALOG_DIR = resolve(__dirname, '../src/content/universities');
const OUT_FILE = resolve(__dirname, '../public/api/verify.json');

async function main() {
  let flags = { critical: [], warnings: [] };
  try { flags = JSON.parse(await readFile(FLAGS_FILE, 'utf8')); } catch {}

  let worklist = { byPriority: null };
  try { worklist = JSON.parse(await readFile(WORKLIST_FILE, 'utf8')); } catch {}

  // Group by slug
  const bySlug = new Map();
  const ensure = (slug) => {
    if (!bySlug.has(slug)) bySlug.set(slug, { dead: 0, mismatch: 0, errors: 0, sampled: 0 });
    return bySlug.get(slug);
  };
  for (const c of flags.critical || []) { const r = ensure(c.slug); r.dead++; r.sampled++; }
  for (const w of flags.warnings || []) { const r = ensure(w.slug); if (w.issue?.includes('mismatch')) r.mismatch++; r.sampled++; }

  // Load uni names
  const nameMap = new Map();
  for (const f of (await readdir(CATALOG_DIR)).filter(f => f.endsWith('.json'))) {
    try { const u = JSON.parse(await readFile(resolve(CATALOG_DIR, f), 'utf8')); nameMap.set(u.slug, u.name); } catch {}
  }

  const reports = [...bySlug.entries()].map(([slug, r]) => {
    const alive = Math.max(0, r.sampled - r.dead - r.errors);
    return { slug, name: nameMap.get(slug) || slug, freshnessPct: r.sampled > 0 ? Math.round(alive / r.sampled * 100) : 100, alive, sampled: r.sampled, dead: r.dead, mismatch: r.mismatch, errors: r.errors };
  }).sort((a, b) => a.freshnessPct - b.freshnessPct);

  const totalSampled = reports.reduce((s, r) => s + r.sampled, 0);
  const totalAlive = reports.reduce((s, r) => s + r.alive, 0);
  const overallFreshnessPct = totalSampled > 0 ? Math.round(totalAlive / totalSampled * 100) : 100;

  await mkdir(resolve(__dirname, '../public/api'), { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify({ generatedAt: new Date().toISOString(), totalSampled, overallFreshnessPct, gapSummary: worklist.byPriority || null, reports }, null, 2) + '\n', 'utf8');
  console.log('[verify] wrote', reports.length, 'unis,', overallFreshnessPct + '% fresh');
}

main().catch(e => { console.error('[verify] fatal:', e); process.exit(1); });
