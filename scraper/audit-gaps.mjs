#!/usr/bin/env node
// Final gap audit: scan all universities/*.json, classify gaps,
// produce sources/audit-report.md with prioritized cheap-fix recommendations.

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const UNI_DIR = path.join(PROJECT_ROOT, 'site/src/content/universities');
const OUT = path.join(PROJECT_ROOT, 'sources/audit-report.md');

const TARGET_PROGRAMS = 30;
const CRITICAL_PROGRAMS = 10;
const TARGET_CAMPUSES = 3;
const TARGET_ACCOM = 3;
const TARGET_PHOTOS_UNI = 4;

const files = (await fs.readdir(UNI_DIR)).filter(f => f.endsWith('.json'));
const unis = [];
for (const f of files) {
  try { unis.push(JSON.parse(await fs.readFile(path.join(UNI_DIR, f), 'utf8'))); }
  catch {}
}

const stats = {
  total: unis.length,
  programsCritical: 0, programsLow: 0, programsOK: 0,
  campusesMissing: 0, accomMissing: 0,
  noLogo: 0, noGallery: 0, galleryThin: 0,
  campusesNoPhoto: 0, accomNoPhoto: 0,
};

const gaps = [];
for (const u of unis) {
  const progN = (u.programs||[]).length;
  const campN = (u.campuses||[]).length;
  const accomN = (u.accommodation?.residences || []).length;
  const galleryN = (u.gallery||[]).length;
  const hasLogo = !!u.logoUrl;
  const campusesNoImg = (u.campuses||[]).filter(c => !c.img && !c.photo && !c.image).length;
  const accomNoImg = (u.accommodation?.residences||[]).filter(r => !r.img && !r.photo && !r.image).length;

  if (progN < CRITICAL_PROGRAMS) stats.programsCritical++;
  else if (progN < TARGET_PROGRAMS) stats.programsLow++;
  else stats.programsOK++;
  if (campN < TARGET_CAMPUSES) stats.campusesMissing++;
  if (accomN < TARGET_ACCOM) stats.accomMissing++;
  if (!hasLogo) stats.noLogo++;
  if (galleryN === 0) stats.noGallery++;
  if (galleryN < TARGET_PHOTOS_UNI) stats.galleryThin++;
  if (campusesNoImg > 0) stats.campusesNoPhoto++;
  if (accomNoImg > 0) stats.accomNoPhoto++;

  gaps.push({ slug: u.slug, name: u.name, country: u.country, progN, campN, accomN, galleryN, hasLogo, campusesNoImg, accomNoImg });
}

gaps.forEach(g => {
  g.score =
    (g.progN < CRITICAL_PROGRAMS ? 100 : (g.progN < TARGET_PROGRAMS ? 30 : 0)) +
    (g.campN < TARGET_CAMPUSES ? 20 : 0) +
    (g.accomN < TARGET_ACCOM ? 20 : 0) +
    (!g.hasLogo ? 15 : 0) +
    (g.galleryN < TARGET_PHOTOS_UNI ? 10 : 0);
});
gaps.sort((a,b) => b.score - a.score);

const lines = [];
lines.push('# Catalog gap audit — ' + new Date().toISOString().slice(0,10));
lines.push('');
lines.push('## Overall stats');
lines.push('');
lines.push('| Metric | Count | % |');
lines.push('|---|---|---|');
lines.push(`| Total universities | ${stats.total} | 100% |`);
lines.push(`| Programs OK (>=30) | ${stats.programsOK} | ${Math.round(stats.programsOK/stats.total*100)}% |`);
lines.push(`| Programs LOW (10-29) | ${stats.programsLow} | ${Math.round(stats.programsLow/stats.total*100)}% |`);
lines.push(`| Programs CRITICAL (<10) | ${stats.programsCritical} | ${Math.round(stats.programsCritical/stats.total*100)}% |`);
lines.push(`| Campuses MISSING (<3) | ${stats.campusesMissing} | ${Math.round(stats.campusesMissing/stats.total*100)}% |`);
lines.push(`| Accommodation MISSING (<3) | ${stats.accomMissing} | ${Math.round(stats.accomMissing/stats.total*100)}% |`);
lines.push(`| No logo | ${stats.noLogo} | ${Math.round(stats.noLogo/stats.total*100)}% |`);
lines.push(`| No gallery photos | ${stats.noGallery} | ${Math.round(stats.noGallery/stats.total*100)}% |`);
lines.push(`| Gallery thin (<4 photos) | ${stats.galleryThin} | ${Math.round(stats.galleryThin/stats.total*100)}% |`);
lines.push(`| Campuses without photos | ${stats.campusesNoPhoto} | ${Math.round(stats.campusesNoPhoto/stats.total*100)}% |`);
lines.push(`| Accommodation without photos | ${stats.accomNoPhoto} | ${Math.round(stats.accomNoPhoto/stats.total*100)}% |`);
lines.push('');

lines.push('## Cheap-fix recipes (minimum token cost)');
lines.push('');
lines.push('### Programs gap (CRITICAL <10, LOW 10-29)');
lines.push('- Re-run ПАУК v2: `node scraper/expand-programs-v2.mjs --file=<slugs.txt>` (0 LLM tokens, deep crawl)');
lines.push('- For SPA-blocked unis: `node scraper/expand-programs-playwright.mjs --file=<slugs.txt>`');
lines.push('- For QS partners: add subject-specific aggregator scrape');
lines.push('- Cost: $0 LLM, ~30s/uni runtime');
lines.push('');
lines.push('### Campuses gap (<3)');
lines.push('- Edvoy merge already ran; for remaining gaps scrape uni `/about/campuses`, `/our-campuses`, `/locations`');
lines.push('- Need new `bobr-campuses.mjs` mirroring accommodation logic (CAMPUS_PATHS array)');
lines.push('- Cost: ~$1 to write + $0 to run');
lines.push('');
lines.push('### Accommodation gap (<3)');
lines.push('- БОБЁР already scraped — gaps mean uni site has no `/accommodation` page or non-standard layout');
lines.push('- Manual fallback: add more paths (`/student-life`, `/halls`, `/residential-life`) and re-run');
lines.push('- Cost: $0 (re-run with more paths)');
lines.push('');
lines.push('### Photos — university (no logo, no gallery, thin)');
lines.push('- Existing scripts:');
lines.push('  - `node scraper/discover-photos.mjs` (Wikimedia Commons, primary)');
lines.push('  - `node scraper/discover-photos-fallback.mjs` (officialUrl OG / hero, secondary)');
lines.push('  - `node scraper/discover-photos-wikipedia.mjs` (Wikipedia infobox, tertiary)');
lines.push('  - `node scraper/discover-logos.mjs` (apple-touch-icon + og:logo + favicon)');
lines.push('- Cost: $0 LLM, ~1-2h runtime for all 447');
lines.push('');
lines.push('### Photos — campuses / accommodation (per-location)');
lines.push('- No existing script targets these. Need new `bobr-photos-locations.mjs`:');
lines.push('  - Per campus / residence: Wikimedia Commons search `<name> + <city>`');
lines.push('  - Fallback: DuckDuckGo image search HTML (no API key)');
lines.push('- Cost: ~$2 to write + $0 to run');
lines.push('');

lines.push('## Worst 50 universities (by composite gap score)');
lines.push('');
lines.push('| Slug | Country | Progs | Camp | Accom | Gallery | Logo | Score |');
lines.push('|---|---|---|---|---|---|---|---|');
for (const g of gaps.slice(0, 50)) {
  lines.push(`| ${g.slug} | ${g.country} | ${g.progN} | ${g.campN} | ${g.accomN} | ${g.galleryN} | ${g.hasLogo ? 'Y' : 'N'} | ${g.score} |`);
}
lines.push('');

lines.push('## All universities (compact list, by score)');
lines.push('');
lines.push('| Slug | Progs | Camp | Accom | Photos | Score |');
lines.push('|---|---|---|---|---|---|');
for (const g of gaps) {
  lines.push(`| ${g.slug} | ${g.progN} | ${g.campN} | ${g.accomN} | ${g.galleryN}${g.hasLogo?'+L':''} | ${g.score} |`);
}

await fs.writeFile(OUT, lines.join('\n'));
console.error('[audit] report written:', OUT);
console.error('[audit] stats:', JSON.stringify(stats));
