import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const U = 'site/src/content/universities';
const files = readdirSync(U).filter((f) => f.endsWith('.json'));

function host(url) {
  if (!url) return 'none';
  const m = String(url).match(/https?:\/\/([^/]+)/i);
  if (!m) return 'other';
  const h = m[1].replace(/^www\./, '').toLowerCase();
  if (h.includes('kaplanpathways')) return 'kaplan';
  if (h.includes('edvoy')) return 'edvoy';
  if (h.includes('studygroup')) return 'studygroup';
  if (h.includes('wikipedia')) return 'wikipedia';
  if (h.includes('navitas')) return 'navitas';
  if (h.includes('qs.com') || h.includes('topuniversities')) return 'qs';
  return 'other/official';
}

const rows = [];
for (const f of files) {
  let d;
  try { d = JSON.parse(readFileSync(join(U, f), 'utf8')); } catch { continue; }
  const slug = f.replace('.json', '');
  const progs = d.programs || [];
  const bp = d.tuition?.byProgram || {};
  const priced = progs.filter((p) => bp[p.slug] > 0).length;
  const pricedPct = progs.length ? Math.round((priced / progs.length) * 100) : 0;
  const facs = new Set(progs.map((p) => p.faculty).filter(Boolean));
  rows.push({
    slug,
    agg: host(d.sourceUrl),
    conf: d.confidence || '-',
    progs: progs.length,
    pricedPct,
    distinctFac: facs.size,
    camp: (d.campuses || []).length,
    accom: (d.accommodation || []).length,
  });
}

const N = rows.length;
console.log(`TOTAL unis: ${N}\n`);

// 1) Faculty cap impact: distinctFac > 6 means cap(6) was hiding faculties+programs
const capped = rows.filter((r) => r.distinctFac > 6).sort((a, b) => b.distinctFac - a.distinctFac);
console.log(`=== FACULTY CAP (was slice 0,6) — unis with >6 distinct faculties (programs were hidden pre-fix): ${capped.length} ===`);
for (const r of capped.slice(0, 20)) console.log(`  ${r.slug} | ${r.distinctFac} fac | ${r.progs} progs | ${r.agg}`);
if (capped.length > 20) console.log(`  …+${capped.length - 20} more`);

// 2) Price coverage
const noPrice = rows.filter((r) => r.progs > 0 && r.pricedPct === 0);
const lowPrice = rows.filter((r) => r.progs >= 5 && r.pricedPct > 0 && r.pricedPct < 25);
console.log(`\n=== PRICES === 0% priced: ${noPrice.length} unis | <25% priced (≥5 progs): ${lowPrice.length} unis`);
console.log('  worst 0%-priced (by #progs):');
for (const r of noPrice.sort((a, b) => b.progs - a.progs).slice(0, 12)) console.log(`    ${r.slug} | ${r.progs} progs | ${r.agg} | conf=${r.conf}`);

// 3) Campuses / accommodation
const noCamp = rows.filter((r) => r.camp === 0);
const noAccom = rows.filter((r) => r.accom === 0);
console.log(`\n=== CAMPUSES/ACCOM === 0 campuses: ${noCamp.length} unis | 0 accommodation: ${noAccom.length} unis`);

// 4) By aggregator: averages
console.log(`\n=== BY AGGREGATOR (avg priced%, avg distinctFac, %with 0 campuses) ===`);
const byAgg = {};
for (const r of rows) {
  (byAgg[r.agg] ||= []).push(r);
}
for (const [agg, list] of Object.entries(byAgg).sort((a, b) => b[1].length - a[1].length)) {
  const n = list.length;
  const avgPrice = Math.round(list.reduce((s, r) => s + r.pricedPct, 0) / n);
  const avgFac = (list.reduce((s, r) => s + r.distinctFac, 0) / n).toFixed(1);
  const pctNoCamp = Math.round((list.filter((r) => r.camp === 0).length / n) * 100);
  const pctLowPrice = Math.round((list.filter((r) => r.progs >= 5 && r.pricedPct < 25).length / n) * 100);
  console.log(`  ${agg.padEnd(16)} | n=${String(n).padStart(3)} | avgPriced=${String(avgPrice).padStart(3)}% | lowPrice=${String(pctLowPrice).padStart(3)}% | avgFac=${avgFac} | noCamp=${pctNoCamp}%`);
}
