import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const U = 'site/src/content/universities';
// Exact slugs of the QA-flagged unis (University of X, not branch campuses).
const slugs = [
  'arizona-state', 'oregon', 'pace', 'simmons', 'asu-london', 'nottingham-trent',
  'alberta', 'liverpool', 'essex', 'uwe-bristol', 'birmingham', 'york', 'westminster',
  'cranfield', 'city-london', 'glasgow', 'nottingham', 'queen-mary-london',
];

const rows = [];
for (const slug of slugs) {
  let d;
  try { d = JSON.parse(readFileSync(join(U, slug + '.json'), 'utf8')); }
  catch { rows.push({ slug, ERR: 'missing' }); continue; }
  const progs = d.programs || [];
  const bp = d.tuition?.byProgram || {};
  const priced = progs.filter((p) => bp[p.slug] > 0).length;
  const pricedPct = progs.length ? Math.round((priced / progs.length) * 100) : 0;
  const nc = (d.campuses || []).length;
  const na = (d.accommodation || []).length;
  const thinCampus = nc < 2;
  const thinAccom = na < 1;
  const pricePoor = pricedPct < 25;
  rows.push({ slug, progs: progs.length, priced, pricedPct, campuses: nc, accom: na,
    needPrice: pricePoor, needCampus: thinCampus, needAccom: thinAccom });
}

rows.sort((a, b) => (a.pricedPct ?? 0) - (b.pricedPct ?? 0));
console.log('slug | progs | priced(%) | camp | accom | NEED');
for (const r of rows) {
  if (r.ERR) { console.log(`${r.slug} | MISSING`); continue; }
  const need = [r.needPrice && 'PRICE', r.needCampus && 'CAMPUS', r.needAccom && 'ACCOM'].filter(Boolean).join(',') || 'ok';
  console.log(`${r.slug} | ${r.progs} | ${r.priced} (${r.pricedPct}%) | ${r.campuses} | ${r.accom} | ${need}`);
}
const work = rows.filter((r) => !r.ERR && (r.needPrice || r.needCampus || r.needAccom));
writeFileSync('control/qa-cd-worklist.json', JSON.stringify(work, null, 2));
console.log(`\nWORKLIST: ${work.length} unis need work → control/qa-cd-worklist.json`);
