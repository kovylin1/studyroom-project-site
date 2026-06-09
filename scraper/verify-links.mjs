// verify-links.mjs — $0 liveness/staleness map across all 808 unis.
// Checks each uni sourceUrl + up to 2 programUrls. Flags dead (>=400),
// network errors, and redirect-to-homepage (final path collapses to "/").
// Output: control/link-check.json  + console summary.
import fs from 'node:fs';

const DIR = 'site/src/content/universities/';
const OUT = 'control/link-check.json';
const CONC = 24;
const TIMEOUT = 15000;

const files = fs.readdirSync(DIR).filter(f => f.endsWith('.json'));

function homepageCollapse(orig, final) {
  try {
    const o = new URL(orig), f = new URL(final);
    const oPath = o.pathname.replace(/\/+$/, '');
    const fPath = f.pathname.replace(/\/+$/, '');
    // original had a real path but final landed on bare host root
    return oPath.length > 1 && (fPath === '' || fPath === '/');
  } catch { return false; }
}

async function check(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    let r = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: ctrl.signal,
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; StudyRoomLinkCheck/1.0)' } });
    if (r.status === 405 || r.status === 501) {
      r = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal,
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; StudyRoomLinkCheck/1.0)' } });
    }
    clearTimeout(t);
    const final = r.url || url;
    return { status: r.status, final, dead: r.status >= 400, collapse: homepageCollapse(url, final) };
  } catch (e) {
    clearTimeout(t);
    return { status: 0, final: url, dead: true, collapse: false, err: String(e.name || e).slice(0, 40) };
  }
}

// Build task list: {slug, kind, url}
const tasks = [];
const meta = {};
for (const f of files) {
  let j; try { j = JSON.parse(fs.readFileSync(DIR + f, 'utf8')); } catch { continue; }
  const slug = j.slug || f.replace('.json', '');
  meta[slug] = { conf: j.confidence, src: j.sourceUrl };
  if (j.sourceUrl) tasks.push({ slug, kind: 'source', url: j.sourceUrl });
  const progs = (j.programs || []).filter(p => p.programUrl).slice(0, 2);
  for (const p of progs) tasks.push({ slug, kind: 'program', url: p.programUrl });
}

console.log(`tasks: ${tasks.length} urls across ${files.length} unis`);
const results = [];
let i = 0, done = 0;
async function worker() {
  while (i < tasks.length) {
    const idx = i++;
    const tk = tasks[idx];
    const res = await check(tk.url);
    results.push({ ...tk, ...res });
    if (++done % 500 === 0) console.log(`  ${done}/${tasks.length}`);
  }
}
await Promise.all(Array.from({ length: CONC }, worker));

// Aggregate per-uni
const byUni = {};
for (const r of results) {
  const u = byUni[r.slug] ||= { dead: 0, collapse: 0, ok: 0, total: 0 };
  u.total++;
  if (r.dead) u.dead++; else if (r.collapse) u.collapse++; else u.ok++;
}
const flagged = Object.entries(byUni)
  .filter(([, u]) => u.dead > 0 || u.collapse > 0)
  .map(([slug, u]) => ({ slug, ...u, conf: meta[slug]?.conf }))
  .sort((a, b) => (b.dead + b.collapse) - (a.dead + a.collapse));

fs.mkdirSync('control', { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ when: new Date().toISOString(), totals: {
  urls: results.length,
  dead: results.filter(r => r.dead).length,
  collapse: results.filter(r => r.collapse).length,
}, flagged, results }, null, 2));

const deadUrls = results.filter(r => r.dead).length;
const collUrls = results.filter(r => r.collapse).length;
console.log('--- LINK CHECK DONE ---');
console.log(`urls checked: ${results.length} | dead: ${deadUrls} | homepage-collapse: ${collUrls}`);
console.log(`unis with >=1 broken link: ${flagged.length}/${files.length}`);
console.log(`wrote ${OUT}`);
