// Rotate a uni's gallery so a different photo becomes the hero.
//   node bobr-rehero.mjs <slug> [times]
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CATALOG = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'site/src/content/universities');
const slug = process.argv[2];
const times = parseInt(process.argv[3] ?? '1', 10) || 1;
if (!slug) { console.error('usage: node bobr-rehero.mjs <slug> [times]'); process.exit(2); }

const path = join(CATALOG, slug + '.json');
const u = JSON.parse(await readFile(path, 'utf8'));
const items = u.gallery?.items ?? [];
if (items.length < 2) { console.error(`${slug}: only ${items.length} gallery items — nothing to rotate`); process.exit(1); }
for (let i = 0; i < times; i++) items.push(items.shift()); // move first to end
u.gallery = { items };
await writeFile(path, JSON.stringify(u, null, 2) + '\n', 'utf8');
console.log(`${slug}: hero is now ${items[0].img} (rotated ${times})`);
