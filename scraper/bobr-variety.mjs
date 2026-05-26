// Ensure variety: no photo repeats within a uni page. Keeps the uni's own unique
// photos; replaces any DUPLICATE or missing card with a DIFFERENT (approximate)
// library photo — accommodation → rooms, campuses/gallery → campuses. Library
// photos rotate via global cursors so different unis get different shots.
//   node bobr-variety.mjs   (needs site/public/photos/_lib built by bobr-buildlib.mjs)
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG = resolve(ROOT, 'site/src/content/universities');
const LIB = resolve(ROOT, 'site/public/photos/_lib');

const libFiles = await readdir(LIB).catch(()=>[]);
const ROOMS = libFiles.filter(f=>/^room-\d+\.jpg$/.test(f)).map(f=>`/photos/_lib/${f}`);
const CAMPUS = libFiles.filter(f=>/^campus-\d+\.jpg$/.test(f)).map(f=>`/photos/_lib/${f}`);
if (!ROOMS.length || !CAMPUS.length) { console.error('library empty — run bobr-buildlib.mjs first'); process.exit(1); }
console.log(`library: ${ROOMS.length} rooms, ${CAMPUS.length} campus`);

let roomCur = 0, campCur = 0;
// next library photo not already on this page
const nextFrom = (lib, curRef, seen) => {
  for (let i = 0; i < lib.length; i++) {
    const p = lib[(curRef.v + i) % lib.length];
    if (!seen.has(p)) { curRef.v = (curRef.v + i + 1) % lib.length; return p; }
  }
  curRef.v = (curRef.v + 1) % lib.length; return lib[curRef.v]; // all seen (tiny lib) — accept
};

let touched = 0;
const files = (await readdir(CATALOG)).filter(f=>f.endsWith('.json'));
const roomRef = { v: 0 }, campRef = { v: 0 };
for (const f of files) {
  const path = join(CATALOG, f);
  const u = JSON.parse(await readFile(path, 'utf8'));
  let changed = false;
  const seen = new Set();

  // gallery: keep, but drop internal duplicates
  if (u.gallery?.items?.length) {
    const dedup = [];
    for (const it of u.gallery.items) { if (it.img && !seen.has(it.img)) { seen.add(it.img); dedup.push(it); } else if (it.img) changed = true; }
    if (dedup.length !== u.gallery.items.length) u.gallery = { items: dedup };
  }
  // photoSets.general (uni-gallery) also counts as shown
  for (const it of (u.photoSets?.general ?? [])) if (it.img) seen.add(it.img);

  // campuses: keep unique real photos; replace duplicates/missing with a fresh campus pic
  for (const c of (u.campuses ?? [])) {
    if (c.img && !seen.has(c.img)) { seen.add(c.img); continue; }
    const pic = nextFrom(CAMPUS, campRef, seen); c.img = pic; seen.add(pic); changed = true;
  }
  // accommodation: keep unique real photo; otherwise approximate ROOM (different each card)
  for (const a of (u.accommodation ?? [])) {
    if (a.img && !seen.has(a.img)) { seen.add(a.img); continue; }
    const pic = nextFrom(ROOMS, roomRef, seen); a.img = pic; seen.add(pic); changed = true;
  }

  if (changed) { await writeFile(path, JSON.stringify(u, null, 2) + '\n', 'utf8'); touched++; }
}
console.log(`variety done: touched=${touched}/${files.length}`);
