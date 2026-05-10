import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCES_FILE = resolve(__dirname, '../../sources/universities.list.md');

export interface RegistryRow {
  slug: string;
  name: string;
  country: string;
  city: string;
  tier: 'partner' | 'official' | 'aggregator';
  officialUrl: string;
  aggregatorUrls: string[];
  notes: string;
}

export async function readRegistry(): Promise<RegistryRow[]> {
  const raw = await readFile(SOURCES_FILE, 'utf8');
  const rows: RegistryRow[] = [];
  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').map((c) => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
    if (cells.length < 8) continue;
    const [slug, name, country, city, tier, officialUrl, aggregatorBlob, notes] = cells;
    if (slug === 'slug' || slug.startsWith('---')) continue;
    if (tier !== 'partner' && tier !== 'official' && tier !== 'aggregator') continue;

    rows.push({
      slug,
      name,
      country,
      city,
      tier,
      officialUrl,
      aggregatorUrls: aggregatorBlob
        ? aggregatorBlob.split(',').map((u) => u.trim()).filter(Boolean)
        : [],
      notes: notes ?? '',
    });
  }

  return rows;
}
