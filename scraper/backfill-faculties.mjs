// Разовый прогон канон-таксономии факультетов по всему каталогу.
// Идемпотентен: повторный прогон не меняет уже канонизированные значения.
// Флаги: --dry-run (ничего не пишет, только отчёт).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalizeFaculty, loadTaxonomy } from './lib/canonicalize-faculty.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, '..', 'site', 'src', 'content', 'universities');
const DRY = process.argv.includes('--dry-run');
const tax = loadTaxonomy();

let files = 0, programs = 0, changed = 0, nulled = 0, filesChanged = 0;
const after = {};

for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.json'))) {
  const fp = path.join(DIR, f);
  let c;
  try { c = JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { continue; }
  files++;
  let dirty = false;
  for (const p of c.programs || []) {
    programs++;
    const nf = canonicalizeFaculty(p.faculty, p.title, tax);
    const key = nf == null ? '(none)' : nf;
    after[key] = (after[key] || 0) + 1;
    if (nf == null) {
      if (p.faculty != null) { if (!DRY) delete p.faculty; changed++; nulled++; dirty = true; }
    } else if (p.faculty !== nf) {
      if (!DRY) p.faculty = nf;
      changed++;
      dirty = true;
    }
  }
  if (dirty) { filesChanged++; if (!DRY) fs.writeFileSync(fp, JSON.stringify(c, null, 2) + '\n'); }
}

console.log(JSON.stringify({ dry: DRY, files, programs, changed, nulled, filesChanged, distinctAfter: Object.keys(after).length }));
console.log('AFTER distribution:');
for (const [k, v] of Object.entries(after).sort((a, b) => b[1] - a[1])) {
  console.log(String(v).padStart(6) + '  ' + k);
}
