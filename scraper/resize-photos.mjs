// One-shot: resize any photo >2MB in site/public/photos/{slug}/ to max 1920px wide,
// JPEG quality 82, keeping aspect ratio. Outputs .jpg even for png/webp originals.
import { readdir, stat, unlink } from 'node:fs/promises';
import { resolve, dirname, basename, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const PHOTOS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'site/public/photos');
const SLUGS = ['oxford','kent','dundee','ulster','bradford','abertay','bangor','de-montfort','greenwich'];
const MAX_BYTES = 2 * 1024 * 1024;

async function processFile(filePath) {
  const s = await stat(filePath);
  if (s.size <= MAX_BYTES) return;
  const dir = dirname(filePath);
  const ext = extname(filePath);
  const stem = basename(filePath, ext);
  const outPath = join(dir, stem + '.jpg');
  const buf = await sharp(filePath).rotate().resize({ width: 1920, withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  // Write to tmp then swap to avoid clobbering during read
  const tmpPath = outPath + '.tmp';
  const { writeFile, rename } = await import('node:fs/promises');
  await writeFile(tmpPath, buf);
  if (ext.toLowerCase() !== '.jpg' && ext.toLowerCase() !== '.jpeg') {
    await unlink(filePath); // remove the old .png/.webp
  }
  await rename(tmpPath, outPath);
  console.log('  ' + stem + ext + ' ' + (s.size/1e6).toFixed(1) + 'MB -> ' + (buf.length/1e6).toFixed(1) + 'MB');
}

for (const slug of SLUGS) {
  const slugDir = join(PHOTOS_DIR, slug);
  console.log('=== ' + slug + ' ===');
  let files;
  try { files = await readdir(slugDir); } catch { continue; }
  for (const f of files) {
    if (!/\.(jpe?g|png|webp)$/i.test(f)) continue;
    try { await processFile(join(slugDir, f)); } catch (e) { console.warn('  [fail] ' + f + ': ' + e.message); }
  }
}
console.log('Done.');
