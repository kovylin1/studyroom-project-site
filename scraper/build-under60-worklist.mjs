#!/usr/bin/env node
// Build a worklist of under-N universities that have a RECOVERABLE official site,
// so expand-programs-verified.mjs can crawl their real catalog.
//
// Usage: node scraper/build-under60-worklist.mjs --min=1 --max=9 --out=sources/under60-wave1.json
//
// Resolution order for the official URL (aggregators are rejected):
//   1. matching edvoy-extract `website`
//   2. an existing non-aggregator programUrl host
//   3. a non-aggregator sourceUrl
// Unis with no resolvable official site are written to <out>.no-site.json for review.

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const UNI_DIR = path.join(ROOT, 'site/src/content/universities');
const EDVOY_DIR = path.join(ROOT, 'sources/edvoy-extracts');

const AGG = ['edvoy.com','collabinternational.com','studygroup.com','wikipedia.org',
  'kaplanpathways.com','navitas.com','topuniversities.com','catsglobalschools.com',
  'catsadmissions.com','oxfordinternational.com','kingseducation.com','globalbanking.ac.uk'];
const isAgg = h => AGG.some(d => h.includes(d));

const args = process.argv.slice(2);
const getArg = (k, d) => { const a = args.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const MIN = Number(getArg('min', '1'));
const MAX = Number(getArg('max', '9'));
const OUT = path.resolve(getArg('out', 'sources/under60-wave1.json'));

function originOf(u) { try { return new URL(u).origin; } catch { return null; } }
function hostOf(u) { try { return new URL(u).host; } catch { return null; } }
async function readJson(p) { try { return JSON.parse(await fs.readFile(p, 'utf8')); } catch { return null; } }

// edvoy slug -> official origin
const edWeb = {};
for (const fn of await fs.readdir(EDVOY_DIR)) {
  if (!fn.endsWith('.json')) continue;
  const j = await readJson(path.join(EDVOY_DIR, fn));
  if (j?.website) { const h = hostOf(j.website); if (h && !isAgg(h)) edWeb[fn.replace('.json','')] = originOf(j.website); }
}

const worklist = [];
const noSite = [];
for (const fn of await fs.readdir(UNI_DIR)) {
  if (!fn.endsWith('.json')) continue;
  const slug = fn.replace('.json','');
  const j = await readJson(path.join(UNI_DIR, fn));
  if (!j) continue;
  const n = Array.isArray(j.programs) ? j.programs.length : 0;
  if (n < MIN || n > MAX) continue;

  let officialUrl = null, via = null;
  if (edWeb[slug]) { officialUrl = edWeb[slug]; via = 'edvoy-website'; }
  if (!officialUrl) {
    for (const u of (j.programs || []).map(p => p.programUrl).filter(Boolean)) {
      const h = hostOf(u); if (h && !isAgg(h)) { officialUrl = originOf(u); via = 'programUrl'; break; }
    }
  }
  if (!officialUrl && j.sourceUrl) {
    const h = hostOf(j.sourceUrl); if (h && !isAgg(h)) { officialUrl = originOf(j.sourceUrl); via = 'sourceUrl'; }
  }

  if (officialUrl) worklist.push({ slug, officialUrl, via, before: n });
  else noSite.push({ slug, name: j.name, country: j.country, before: n, sourceUrl: j.sourceUrl });
}

await fs.writeFile(OUT, JSON.stringify(worklist, null, 2) + '\n');
await fs.writeFile(OUT.replace(/\.json$/, '.no-site.json'), JSON.stringify(noSite, null, 2) + '\n');

const byVia = worklist.reduce((m, w) => (m[w.via] = (m[w.via]||0)+1, m), {});
console.log(`range ${MIN}-${MAX} programs`);
console.log(`worklist: ${worklist.length} -> ${OUT}`);
console.log(`  by source:`, JSON.stringify(byVia));
console.log(`no official site: ${noSite.length} -> ${OUT.replace(/\.json$/, '.no-site.json')}`);
