// Bulk international-tuition tooling for the StudyRoom catalog.
//
//   node scraper/prices-bulk.mjs --template      → writes control/price-fees-template.csv
//                                                   (all unis with <10% priced; fee cols blank)
//   node scraper/prices-bulk.mjs --apply <csv>   → applies filled fees back into uni JSONs
//
// CSV columns: slug,name,country,currency,ug,pg,foundation,pathway
// Interns fill ug/pg/foundation/pathway (annual international fee, integer, in the row's
// currency) from the official website. Blank = skip that level. NEVER guess — leave blank.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const U = 'site/src/content/universities';
const mode = process.argv[2];

function loadAll() {
  return readdirSync(U).filter((f) => f.endsWith('.json')).map((f) => {
    try { return { f, d: JSON.parse(readFileSync(join(U, f), 'utf8')) }; } catch { return null; }
  }).filter(Boolean);
}

function csvCell(s) {
  s = String(s ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

if (mode === '--template') {
  const rows = [['slug', 'name', 'country', 'currency', 'ug', 'pg', 'foundation', 'pathway']];
  for (const { d } of loadAll()) {
    const progs = d.programs || [];
    if (progs.length < 5) continue;
    const bp = d.tuition?.byProgram || {};
    const pricedPct = Math.round((progs.filter((p) => bp[p.slug] > 0).length / progs.length) * 100);
    if (pricedPct >= 10) continue;
    rows.push([d.slug, d.name, d.country, d.tuition?.currency || 'GBP', '', '', '', '']);
  }
  const out = 'control/price-fees-template.csv';
  writeFileSync(out, rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n');
  console.log(`Template: ${rows.length - 1} unis → ${out}`);
} else if (mode === '--apply') {
  const csvPath = process.argv[3];
  if (!csvPath) { console.error('usage: --apply <csv>'); process.exit(1); }
  const lines = readFileSync(csvPath, 'utf8').split(/\r?\n/).filter(Boolean);
  const header = lines.shift().split(',');
  const col = (name) => header.indexOf(name);
  const byLevelKeys = { bachelor: 'ug', master: 'pg', phd: 'pg', foundation: 'foundation', pathway: 'pathway' };
  let unis = 0, prices = 0, skipped = 0;
  for (const line of lines) {
    // naive CSV split is fine — our cells have no embedded commas except quoted name
    const m = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"'));
    const slug = m[col('slug')];
    const fees = { ug: +m[col('ug')] || 0, pg: +m[col('pg')] || 0, foundation: +m[col('foundation')] || 0, pathway: +m[col('pathway')] || 0 };
    if (!slug || (!fees.ug && !fees.pg && !fees.foundation && !fees.pathway)) { skipped++; continue; }
    const p = join(U, slug + '.json');
    let d;
    try { d = JSON.parse(readFileSync(p, 'utf8')); } catch { console.warn('  no file:', slug); skipped++; continue; }
    d.tuition = d.tuition || { currency: 'GBP', byProgram: {} };
    d.tuition.byProgram = d.tuition.byProgram || {};
    let n = 0;
    for (const pr of d.programs || []) {
      const fee = fees[byLevelKeys[pr.level]];
      if (fee > 0 && !(d.tuition.byProgram[pr.slug] > 0)) { d.tuition.byProgram[pr.slug] = fee; n++; }
    }
    if (n) { d.lastChecked = '2026-06-15'; writeFileSync(p, JSON.stringify(d, null, 2) + '\n'); unis++; prices += n; }
  }
  console.log(`Applied: ${unis} unis, ${prices} prices (skipped ${skipped} blank/missing rows)`);
} else {
  console.log('usage: prices-bulk.mjs --template | --apply <csv>');
}
