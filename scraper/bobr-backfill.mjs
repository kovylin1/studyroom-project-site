// Guarantee no empty photo slots: every campus & accommodation card gets an img,
// and the gallery is padded toward 5 — all by REUSING the uni's already-downloaded
// photos (no network). Distinct photos are preferred; reuse only when a uni has
// fewer photos than slots. Run after the photo pipeline.
//   node bobr-backfill.mjs
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CATALOG = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'site/src/content/universities');
const distinct = (arr) => [...new Set(arr.filter(Boolean))];

let touched = 0, noPhoto = 0;
const files = (await readdir(CATALOG)).filter(f => f.endsWith('.json'));
for (const f of files) {
  const path = join(CATALOG, f);
  const u = JSON.parse(await readFile(path, 'utf8'));
  const gallery = u.gallery?.items ?? [];
  const campuses = u.campuses ?? [];
  const accom = u.accommodation ?? [];
  const general = u.photoSets?.general ?? [];

  // every photo this uni already owns (gallery + uni-gallery + any card imgs)
  const all = distinct([
    ...gallery.map(x => x.img),
    ...general.map(x => x.img),
    ...campuses.map(c => c.img),
    ...accom.map(a => a.img),
  ]);
  if (all.length === 0) { noPhoto++; continue; }

  // photos not already shown on a card → assign these to empty cards first
  const onCards = new Set([...campuses.map(c => c.img), ...accom.map(a => a.img)].filter(Boolean));
  const free = all.filter(p => !onCards.has(p));
  let cyc = 0;
  const next = () => free.length ? free.shift() : all[cyc++ % all.length];

  let changed = false;
  for (const c of campuses) if (!c.img) { c.img = next(); changed = true; }
  for (const a of accom) if (!a.img) { a.img = next(); changed = true; }

  // pad gallery toward 5 with distinct photos (no duplicates added)
  const gset = new Set(gallery.map(x => x.img));
  for (const p of all) {
    if (gallery.length >= 5) break;
    if (!gset.has(p)) { gallery.push({ img: p, caption: u.name }); gset.add(p); changed = true; }
  }

  if (changed) {
    u.gallery = { items: gallery };
    if (campuses.length) u.campuses = campuses;
    if (accom.length) u.accommodation = accom;
    await writeFile(path, JSON.stringify(u, null, 2) + '\n', 'utf8');
    touched++;
  }
}
console.log(`backfill done: touched=${touched}/${files.length}, still-no-photo=${noPhoto}`);
