// One-shot: download Kaplan partner logos to site/public/logos/{slug}.png
// Re-run safely; existing files are overwritten with the latest version.
//
//   node download-logos.mjs            # download all
//   node download-logos.mjs --slug bristol  # one only
//
// URLs were extracted from https://www.kaplanpathways.com/where-to-study/uk-universities/
// (the partner cards on the index page). Mapping is hand-curated because the
// Kaplan paths don't follow a perfect slug convention.

import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '../site/public/logos');

const LOGOS = {
  'asu-london':         'https://www.kaplanpathways.com/tachyon/sites/4/2025/11/logo-raster-uni-asu-london.png',
  'bournemouth':        'https://www.kaplanpathways.com/tachyon/sites/4/2023/03/logo-raster-uni-bournemouth.png',
  'city-london':        'https://www.kaplanpathways.com/tachyon/sites/4/2025/03/logo-raster-uni-city.png',
  'cranfield':          'https://www.kaplanpathways.com/tachyon/sites/4/2023/03/logo-raster-uni-cranfield.png',
  'nottingham-trent':   'https://www.kaplanpathways.com/tachyon/sites/4/2023/03/logo-raster-uni-nottingham-trent.png',
  'queen-mary-london':  'https://www.kaplanpathways.com/tachyon/sites/4/2023/03/logo-raster-uni-queen-mary.png',
  'birmingham':         'https://www.kaplanpathways.com/tachyon/sites/4/2023/03/logo-raster-uni-birmingham.png',
  'brighton':           'https://www.kaplanpathways.com/tachyon/sites/4/2023/03/logo-raster-uni-brighton.png',
  'bristol':            'https://www.kaplanpathways.com/tachyon/sites/4/2024/11/logo-raster-uni-bristol.png',
  'essex':              'https://www.kaplanpathways.com/tachyon/sites/4/2023/03/logo-raster-uni-essex.png',
  'glasgow':            'https://www.kaplanpathways.com/tachyon/sites/4/2023/03/logo-raster-uni-glasgow.png',
  'liverpool':          'https://www.kaplanpathways.com/tachyon/sites/4/2023/03/logo-raster-uni-liverpool.png',
  'nottingham':         'https://www.kaplanpathways.com/tachyon/sites/4/2023/05/logo-raster-uni-nottingham.png',
  'westminster':        'https://www.kaplanpathways.com/tachyon/sites/4/2023/03/logo-uni-raster-westminster.png',
  'york':               'https://www.kaplanpathways.com/tachyon/sites/4/2023/03/logo-raster-uni-york.png',
  'uwe-bristol':        'https://www.kaplanpathways.com/tachyon/sites/4/2023/03/logo-uni-raster-uwe-bristol.png',
};

async function downloadOne(slug, url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'StudyRoom-Scraper/0.3 (+https://studyroom.kz)',
      Accept: 'image/png,image/*',
    },
  });
  if (!response.ok) {
    throw new Error('HTTP ' + response.status + ' for ' + url);
  }
  const buf = Buffer.from(await response.arrayBuffer());
  const outPath = resolve(OUT_DIR, slug + '.png');
  await writeFile(outPath, buf);
  return { slug, bytes: buf.length, outPath };
}

function parseArgs(argv) {
  let only = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--slug') only = argv[++i] ?? null;
  }
  return { only };
}

async function main() {
  const { only } = parseArgs(process.argv.slice(2));
  await mkdir(OUT_DIR, { recursive: true });

  const targets = only ? { [only]: LOGOS[only] } : LOGOS;
  const slugs = Object.keys(targets).filter((s) => targets[s]);
  if (slugs.length === 0) {
    console.error('No matching slug. Known: ' + Object.keys(LOGOS).join(', '));
    process.exit(2);
  }

  let ok = 0;
  let failed = 0;
  for (const slug of slugs) {
    try {
      const r = await downloadOne(slug, targets[slug]);
      console.log('[ok]   ' + r.slug + '  (' + r.bytes + ' bytes)');
      ok += 1;
    } catch (err) {
      console.error('[fail] ' + slug + '  ' + err.message);
      failed += 1;
    }
  }
  console.log('\nDone: ' + ok + ' ok, ' + failed + ' failed.');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
