// Prune scraped NON-PROGRAM entries from the catalogue (news posts, info/admin
// sub-pages, SEO listicles, bare credential strings) that some feeds dragged in
// alongside real degrees — e.g. UEA had 86 "phd" rows, most of them pages like
// "Applying for a PhD" or "PhD researcher wins ... Award", not programmes.
//
// HIGH-PRECISION only: every rule targets an unambiguous non-degree signal so
// real titles ("BSc Biochemistry", "PhD in Economics", "Doctor of Philosophy
// (PhD)", "Master of Aviation") are never matched. Run dry first, review the
// emitted report, then --write.
//
//   npx tsx scraper/src/prune-non-programs.ts            # dry run + report
//   npx tsx scraper/src/prune-non-programs.ts --write    # apply deletions

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const CATALOG = resolve(HERE, '../../site/src/content/universities');
const WRITE = process.argv.includes('--write');
const REPORT = resolve(HERE, '../prune-report.txt');

type Rule = { reason: string; test: (t: string) => boolean };

const RULES: Rule[] = [
  // SEO / news / FAQ pages framed as a question.
  { reason: 'question', test: (t) => t.includes('?') },
  // News headlines: someone wins/is appointed/shortlisted/nominated.
  {
    reason: 'news',
    test: (t) => /\b(wins|won|appointed to|shortlisted for|nominated for|named (the )?winner|secures funding|awarded a grant)\b/i.test(t),
  },
  // Generic info/process pages about doing a PhD (not a named degree).
  {
    reason: 'phd-info-page',
    test: (t) =>
      /^(applying for a phd|starting your phd|phd supervision|phd training|phd professional development|phd and research degrees|phd and fellowship|phd research$|phd studentships|phd programmes?$|phd opportunities|postgraduate research and phd|masters and phd|programmes? of research$|how to apply for a phd|funding (your|for a) phd)/i.test(
        t.trim(),
      ),
  },
  // Admin sub-pages of a programme: "<admin label> - <programme>".
  {
    reason: 'admin-subpage',
    test: (t) =>
      /^(information for applicants|information for placement supervisors|programme staff|programme team|mission,? vision and values|teaching and curriculum|research|overview|entry requirements|fees and funding|how to apply|programme structure|contact us|meet the team)\s+-\s+/i.test(
        t.trim(),
      ),
  },
  // SEO listicles ("Top Universities for...", "Scholarship Opportunities for...").
  {
    reason: 'seo-listicle',
    test: (t) =>
      /\b(top universities for|popular .*programs? (in|for)|application periods and deadlines|scholarship opportunities for|periods and deadlines for|best universities (in|for))\b/i.test(t),
  },
  // French SEO landing pages ("Qu'est-ce qu'un Master...", "Le Master ... à Paris").
  {
    reason: 'fr-seo',
    test: (t) =>
      /^(qu['’]est-ce|pourquoi (faire|choisir)|comment (devenir|faire))/i.test(t.trim()) ||
      /^(le master|la licence|le bachelor)\b.*\b(à|en)\s+(paris|bordeaux|rennes|toulouse|lyon|lille|nantes|marseille)\b/i.test(t.trim()),
  },
  // Bare credential strings, not a programme.
  {
    reason: 'credential-string',
    test: (t) => /^(high school diploma|secondary school (diploma|certificate)|bachelor['’]?s degree \(\d|master['’]?s degree \(\d|a-?levels?$)/i.test(t.trim()),
  },
];

function classifyJunk(title: string): string | null {
  const t = (title ?? '').trim();
  if (!t) return null;
  for (const r of RULES) if (r.test(t)) return r.reason;
  return null;
}

const files = readdirSync(CATALOG).filter((f) => f.endsWith('.json'));
const reasonCounts: Record<string, number> = {};
const perUni: Record<string, number> = {};
const lines: string[] = [];
const wouldEmpty: string[] = [];
let totalFlagged = 0;
let totalPrograms = 0;
let filesChanged = 0;

for (const file of files) {
  const path = resolve(CATALOG, file);
  const data = JSON.parse(readFileSync(path, 'utf8'));
  const progs = data.programs ?? [];
  totalPrograms += progs.length;
  const keep: any[] = [];
  let flaggedHere = 0;
  for (const p of progs) {
    let reason = classifyJunk(p.title ?? '');
    // A "High School Diploma" row is junk on a university page but is the real,
    // sole programme of an actual high school — never strip it when the entry is
    // genuinely tagged at high-school level.
    if (reason === 'credential-string' && p.level === 'high-school') reason = null;
    if (reason) {
      reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
      totalFlagged++;
      flaggedHere++;
      lines.push(`${file}\t${reason}\t${p.level ?? '?'}\t${p.title}`);
    } else {
      keep.push(p);
    }
  }
  // Never empty a university — the schema requires >=1 program. If every entry
  // looks like junk the university itself is suspect (e.g. a high-school or an
  // SEO page masquerading as a uni); leave it untouched and report separately.
  if (flaggedHere && keep.length === 0) {
    wouldEmpty.push(`${file} (all ${progs.length} entries flagged)`);
    continue;
  }

  if (flaggedHere) perUni[file] = flaggedHere;

  // Drop slug-keyed tuition/deadline entries orphaned by removed programs —
  // the schema's superRefine rejects byProgram/deadlines keys that no longer
  // map to a real program. Done unconditionally so any pre-existing orphans
  // are swept too.
  const keptSlugs = new Set(keep.map((p) => p.slug));
  let orphansRemoved = 0;
  for (const map of [data.tuition?.byProgram, data.deadlines]) {
    if (!map || typeof map !== 'object') continue;
    for (const slug of Object.keys(map)) {
      if (!keptSlugs.has(slug)) {
        delete map[slug];
        orphansRemoved++;
      }
    }
  }

  if (WRITE && (flaggedHere || orphansRemoved)) {
    data.programs = keep;
    writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf8');
    filesChanged++;
  }
}

writeFileSync(REPORT, lines.sort().join('\n') + '\n', 'utf8');

console.log(`Mode: ${WRITE ? 'WRITE' : 'DRY-RUN'}`);
console.log(`Programs scanned: ${totalPrograms} | flagged as non-program: ${totalFlagged} (${((100 * totalFlagged) / totalPrograms).toFixed(2)}%)`);
console.log(`Files affected: ${Object.keys(perUni).length}${WRITE ? ` | written: ${filesChanged}` : ''}`);
console.log('\nBy reason:');
for (const [k, v] of Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])) console.log('  ' + k.padEnd(20) + v);
console.log('\nTop affected unis:');
for (const [k, v] of Object.entries(perUni).sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log('  ' + k.padEnd(28) + v);
console.log(`\nFull list -> ${REPORT}`);
if (wouldEmpty.length) {
  console.log(`\nSKIPPED (would leave 0 programs — review whether these are real unis):`);
  for (const w of wouldEmpty) console.log('  ' + w);
}
