// load-env.mjs — minimal scraper/.env loader (no dotenv dependency needed).
// Import for side effect: import '../lib/load-env.mjs' (from scraper/*.mjs: './lib/load-env.mjs').
// Existing process.env values always win (CI secrets are never overridden).
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const envFile = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
