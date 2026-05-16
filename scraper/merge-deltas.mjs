// Merge each photo-manifests-delta/{slug}.json into photo-manifests/{slug}.json.
// For accommodation, match by name; for campuses, match by title; set new url (overrides existing).
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MAIN_DIR = resolve(__dirname, 'photo-manifests');
const DELTA_DIR = resolve(__dirname, 'photo-manifests-delta');

const deltas = (await readdir(DELTA_DIR)).filter((f) => f.endsWith('.json'));
for (const f of deltas) {
  const slug = f.replace(/\.json$/, '');
  const main = JSON.parse(await readFile(resolve(MAIN_DIR, f), 'utf8'));
  const delta = JSON.parse(await readFile(resolve(DELTA_DIR, f), 'utf8'));

  let aChanged = 0, cChanged = 0;
  if (Array.isArray(delta.accommodation)) {
    for (const dItem of delta.accommodation) {
      const target = main.accommodation?.find((a) => a.name === dItem.name);
      if (!target) { console.warn('  [warn] ' + slug + ' accom not found: ' + dItem.name); continue; }
      target.url = dItem.url;
      delete target.warn;
      aChanged += 1;
    }
  }
  if (Array.isArray(delta.campuses)) {
    for (const dItem of delta.campuses) {
      const target = main.campuses?.find((c) => c.title === dItem.title);
      if (!target) { console.warn('  [warn] ' + slug + ' campus not found: ' + dItem.title); continue; }
      target.url = dItem.url;
      cChanged += 1;
    }
  }
  await writeFile(resolve(MAIN_DIR, f), JSON.stringify(main, null, 2) + '\n', 'utf8');
  console.log(slug + ': ' + aChanged + ' accom, ' + cChanged + ' campus URLs updated');
}
