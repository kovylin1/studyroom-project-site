// One-off backfill: fix program `level` and fill missing `faculty` across all
// existing catalogue JSON, using the same logic the live scraper now uses
// (infer-level + program-faculty-classifier). Run once after the pipeline fix:
//
//   npx tsx scraper/src/backfill-level-faculty.ts          # dry run (report only)
//   npx tsx scraper/src/backfill-level-faculty.ts --write  # apply changes
//
// LEVEL: re-inferred from the program title. Only changed when the title gives
// a confident, different answer. `programType: 'pathway'` programs are left
// untouched (their master+pathway tagging is intentional for the landing tabs).
// Program slugs are NOT regenerated, so tuition.byProgram / deadlines keys stay
// valid.
//
// FACULTY: filled only when missing/empty or "Прочее". Real faculty names that
// came from Kaplan's award map are preserved.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { inferLevelFromTitle } from './sources/infer-level.ts';
import { classifyFaculty } from './sources/program-faculty-classifier.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const CATALOG = resolve(HERE, '../../site/src/content/universities');
const WRITE = process.argv.includes('--write');
const FALLBACK_FACULTY = 'Прочее';

const files = readdirSync(CATALOG).filter((f) => f.endsWith('.json'));

let filesChanged = 0;
let levelChanges = 0;
let facultyFills = 0;
const levelMatrix: Record<string, number> = {};
const sample: string[] = [];

for (const file of files) {
  const path = resolve(CATALOG, file);
  const data = JSON.parse(readFileSync(path, 'utf8'));
  let dirty = false;

  for (const p of data.programs ?? []) {
    // LEVEL — skip pathway programs (intentional tagging). Only the two
    // bachelor<->master swaps the title resolves UNAMBIGUOUSLY are applied
    // (e.g. "BS Accountancy" mislabelled master -> bachelor; "MSc X"
    // mislabelled bachelor -> master). inferLevelFromTitle returns null for
    // ambiguous codes (Scottish "MA", integrated "MEng"), so those keep their
    // original, trustworthy level and are never corrupted. We do not touch
    // foundation / english-language / short-course here.
    if (p.programType !== 'pathway') {
      const inferred = inferLevelFromTitle(p.title ?? '');
      const safeSwap =
        (p.level === 'master' && inferred === 'bachelor') ||
        (p.level === 'bachelor' && inferred === 'master');
      if (safeSwap) {
        const key = `${p.level} -> ${inferred}`;
        levelMatrix[key] = (levelMatrix[key] ?? 0) + 1;
        if (sample.length < 25) sample.push(`${file}: "${p.title}" ${key}`);
        p.level = inferred;
        levelChanges++;
        dirty = true;
      }
    }

    // FACULTY — fill only holes.
    if (!p.faculty || p.faculty === FALLBACK_FACULTY) {
      const f = classifyFaculty(p.title ?? '');
      if (f && f !== p.faculty) {
        p.faculty = f;
        facultyFills++;
        dirty = true;
      }
    }
  }

  if (dirty) {
    filesChanged++;
    if (WRITE) writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf8');
  }
}

console.log(`Files: ${files.length} | changed: ${filesChanged} | mode: ${WRITE ? 'WRITE' : 'DRY-RUN'}`);
console.log(`\nLEVEL changes: ${levelChanges}`);
for (const [k, v] of Object.entries(levelMatrix).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(24)} ${v}`);
}
console.log('\nFACULTY fills (empty/Прочее -> bucket):', facultyFills);
console.log('\nSample level changes:');
for (const s of sample) console.log('  ' + s);
