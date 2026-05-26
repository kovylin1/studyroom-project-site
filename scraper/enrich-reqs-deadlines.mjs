#!/usr/bin/env node
// ENRICH #2: requirements.exams (из keyFacts EnglishRequirement) + deadlines (РАСЧЁТНЫЕ из intake).
// 0 LLM-токенов. Трогает только переданные слаги.
// ВНИМАНИЕ: deadlines синтетические (intake month − 2 мес, день 1) — реальных дат в Edvoy нет.
// Запуск: node scraper/enrich-reqs-deadlines.mjs --slugs=a,b,c [--dry]

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const UNI_DIR = path.join(ROOT, 'site/src/content/universities');
const LOG = path.join(ROOT, 'sources/enrich-reqs-deadlines.log');
const DRY = process.argv.includes('--dry');
const slugArg = process.argv.find((a) => a.startsWith('--slugs='));
const EXT_DIRS = ['sources/edvoy-extracts', 'sources/studygroup-extracts', 'sources/collab-extracts', 'sources/direct-partners-extracts'];

const log = async (m) => {
  const line = `[reqdl ${new Date().toISOString().slice(11, 19)}] ${m}`;
  console.error(line);
  if (!DRY) await fs.appendFile(LOG, line + '\n').catch(() => {});
};
const sani = (s) => (s || '').toString().toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70).replace(/-+$/g, '');

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

// "September 2026" | "Sep 2026" | "January 2027" → {m:0-11, y}
function parseIntake(s) {
  if (!s || typeof s !== 'string') return null;
  const mm = s.toLowerCase().match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(\d{4})/);
  if (!mm) return null;
  return { m: MONTHS[mm[1]], y: parseInt(mm[2], 10) };
}

// earliest intake among a program's intakes → ISO application deadline (intake − 2 months, day 1, UTC)
function deadlineFromIntakes(intakes) {
  if (!Array.isArray(intakes)) return null;
  const parsed = intakes.map(parseIntake).filter(Boolean).sort((a, b) => (a.y - b.y) || (a.m - b.m));
  if (!parsed.length) return null;
  const { m, y } = parsed[0];
  let dm = m - 2, dy = y;
  if (dm < 0) { dm += 12; dy -= 1; }
  return new Date(Date.UTC(dy, dm, 1)).toISOString();
}

// "IELTS, TOEFL" | "IELTS, TOEFL, PTE" → ["IELTS","TOEFL","PTE"]
function parseExams(val) {
  if (!val || typeof val !== 'string') return [];
  return [...new Set(val.split(/[,/;]/).map((x) => x.trim()).filter(Boolean))];
}

async function loadAllExtracts() {
  const byBaseSlug = new Map();
  for (const rel of EXT_DIRS) {
    let files;
    try { files = (await fs.readdir(path.join(ROOT, rel))).filter((f) => f.endsWith('.json') && !f.startsWith('_')); } catch { continue; }
    for (const f of files) {
      let ext;
      try { ext = JSON.parse(await fs.readFile(path.join(ROOT, rel, f), 'utf8')); } catch { continue; }
      const baseSlug = sani(ext.slug || ext.name);
      if (baseSlug && !byBaseSlug.has(baseSlug)) byBaseSlug.set(baseSlug, ext);
    }
  }
  return byBaseSlug;
}

(async () => {
  if (!DRY) await fs.writeFile(LOG, '');
  await log(`=== REQ+DEADLINE START ${DRY ? '(DRY)' : ''} ===`);

  let slugs;
  if (slugArg) slugs = slugArg.split('=')[1].split(',').map((s) => s.trim()).filter(Boolean);
  else {
    const { execSync } = await import('child_process');
    const out = execSync('git show --name-only --pretty="" HEAD -- site/src/content/universities', { cwd: ROOT, encoding: 'utf8' });
    slugs = out.trim().split(/\r?\n/).filter(Boolean).map((p) => path.basename(p, '.json'));
  }
  await log(`target slugs: ${slugs.length}`);

  const extracts = await loadAllExtracts();
  let touched = 0, examsSet = 0, dlUnis = 0, totalDl = 0, noExams = 0, noDl = 0;

  for (const slug of slugs) {
    const file = path.join(UNI_DIR, slug + '.json');
    let uni;
    try { uni = JSON.parse(await fs.readFile(file, 'utf8')); } catch { continue; }
    const ext = extracts.get(slug);

    // requirements.exams from EnglishRequirement keyFact
    let exams = [];
    if (ext && Array.isArray(ext.keyFacts)) {
      const kf = ext.keyFacts.find((k) => /english/i.test(k.key || '') || /english/i.test(k.name || ''));
      if (kf) exams = parseExams(kf.value);
    }
    if (exams.length) {
      uni.requirements = uni.requirements || {};
      uni.requirements.exams = exams;
      examsSet++;
    } else noExams++;

    // deadlines: per-program, derived from that program's intakes
    const deadlines = {};
    for (const p of uni.programs) {
      const dl = deadlineFromIntakes(p.intakes);
      if (dl) deadlines[p.slug] = dl;
    }
    if (Object.keys(deadlines).length) {
      uni.deadlines = deadlines;
      dlUnis++;
      totalDl += Object.keys(deadlines).length;
    } else noDl++;

    if (!DRY) await fs.writeFile(file, JSON.stringify(uni, null, 2) + '\n');
    touched++;
    await log(`+ ${slug}: exams=[${exams.join(',')}] deadlines=${Object.keys(deadlines).length}`);
  }

  await log(`RESULT: touched=${touched} examsSet=${examsSet} unisWithDeadlines=${dlUnis} totalDeadlines=${totalDl} noExams=${noExams} noDeadlines=${noDl}`);
  await log(`=== DONE ${DRY ? '(DRY)' : ''} ===`);
  console.log(JSON.stringify({ touched, examsSet, dlUnis, totalDl, noExams, noDl }));
})();
