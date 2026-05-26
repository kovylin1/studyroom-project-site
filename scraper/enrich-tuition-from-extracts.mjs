#!/usr/bin/env node
// ENRICH: заполняет tuition.byProgram + currency, durationYears, intakes
// у НОВЫХ 44 вузов из данных, которые УЖЕ лежат в extracts (program.tuition="25800 GBP",
// program.duration="12 Months", program.intake=[...]). 0 LLM-токенов.
// Трогает ТОЛЬКО переданные слаги (по умолчанию — мои 44 из последнего коммита).
// Запуск: node scraper/enrich-tuition-from-extracts.mjs [--dry] [--slugs=a,b,c]

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const UNI_DIR = path.join(ROOT, 'site/src/content/universities');
const LOG = path.join(ROOT, 'sources/enrich-tuition.log');
const DRY = process.argv.includes('--dry');
const slugArg = process.argv.find((a) => a.startsWith('--slugs='));
const EXT_DIRS = ['sources/edvoy-extracts', 'sources/studygroup-extracts', 'sources/collab-extracts', 'sources/direct-partners-extracts'];
const CCY_ENUM = new Set(['USD', 'EUR', 'GBP', 'KZT', 'RUB', 'CAD', 'AUD', 'NZD']);

const log = async (m) => {
  const line = `[enrich ${new Date().toISOString().slice(11, 19)}] ${m}`;
  console.error(line);
  if (!DRY) await fs.appendFile(LOG, line + '\n').catch(() => {});
};

const sani = (s) => (s || '').toString().toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70).replace(/-+$/g, '');

// "25800 GBP" | "25,800 GBP" | "GBP 25800" | "$25800" → {amount:25800, ccy:'GBP'}
function parseTuition(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.trim();
  const sym = { '£': 'GBP', '$': 'USD', '€': 'EUR' };
  let ccy = null;
  const code = s.match(/\b(USD|EUR|GBP|KZT|RUB|CAD|AUD|NZD)\b/i);
  if (code) ccy = code[1].toUpperCase();
  else for (const k of Object.keys(sym)) if (s.includes(k)) { ccy = sym[k]; break; }
  if (!ccy || !CCY_ENUM.has(ccy)) return null;
  const num = s.replace(/[^\d.,]/g, '').replace(/,/g, '');
  const amount = parseFloat(num);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return { amount: Math.round(amount), ccy };
}

// "12 Months" | "48 Months" | "3 Years" | "2 Year, 3 Year" → years (number)
function parseDuration(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const m = raw.match(/(\d+(?:\.\d+)?)\s*(month|year)/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const years = /month/i.test(m[2]) ? Math.round((n / 12) * 10) / 10 : n;
  return years > 0 ? years : null;
}

async function loadAllExtracts() {
  const byBaseSlug = new Map(); // baseSlug(==site slug) → extract
  for (const rel of EXT_DIRS) {
    let files;
    try { files = (await fs.readdir(path.join(ROOT, rel))).filter((f) => f.endsWith('.json') && !f.startsWith('_')); }
    catch { continue; }
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
  await log(`=== ENRICH START ${DRY ? '(DRY)' : ''} ===`);

  let slugs;
  if (slugArg) slugs = slugArg.split('=')[1].split(',').map((s) => s.trim()).filter(Boolean);
  else {
    // default: files added in HEAD commit
    const { execSync } = await import('child_process');
    const out = execSync('git show --name-only --pretty="" HEAD -- site/src/content/universities', { cwd: ROOT, encoding: 'utf8' });
    slugs = out.trim().split(/\r?\n/).filter(Boolean).map((p) => path.basename(p, '.json'));
  }
  await log(`target slugs: ${slugs.length}`);

  const extracts = await loadAllExtracts();
  let touched = 0, tuitionUnis = 0, totalPrices = 0, durFixed = 0, intakesSet = 0, noExt = 0, noPrice = 0;

  for (const slug of slugs) {
    const file = path.join(UNI_DIR, slug + '.json');
    let uni;
    try { uni = JSON.parse(await fs.readFile(file, 'utf8')); } catch { await log(`skip (no file): ${slug}`); continue; }
    const ext = extracts.get(slug);
    if (!ext || !Array.isArray(ext.programs)) { noExt++; await log(`no-extract: ${slug}`); continue; }

    // map extract program by title → parsed tuition/duration/intake
    const extByTitle = new Map();
    for (const p of ext.programs) {
      const t = (p && (p.title || p.name) || '').toString().trim().toLowerCase();
      if (t && !extByTitle.has(t)) extByTitle.set(t, p);
    }

    const priced = []; // {progSlug, amount, ccy}
    let localDur = 0, localIntakes = 0;
    for (const prog of uni.programs) {
      const ep = extByTitle.get((prog.title || '').toLowerCase());
      if (!ep) continue;
      const dur = parseDuration(ep.duration);
      if (dur && dur !== prog.durationYears) { prog.durationYears = dur; localDur++; }
      const ins = Array.isArray(ep.intake) ? ep.intake : (Array.isArray(ep.intakes) ? ep.intakes : (ep.intake ? [ep.intake] : null));
      if (ins && ins.length) {
        const clean = [...new Set(ins.map((x) => String(x).trim()).filter(Boolean))];
        if (clean.length) { prog.intakes = clean; localIntakes++; }
      }
      const tt = parseTuition(ep.tuition);
      if (tt) priced.push({ progSlug: prog.slug, amount: tt.amount, ccy: tt.ccy });
    }

    // dominant currency
    if (priced.length) {
      const counts = {};
      for (const p of priced) counts[p.ccy] = (counts[p.ccy] || 0) + 1;
      const ccy = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
      const byProgram = {};
      for (const p of priced) if (p.ccy === ccy) byProgram[p.progSlug] = p.amount;
      if (Object.keys(byProgram).length) {
        uni.tuition = { currency: ccy, byProgram };
        tuitionUnis++;
        totalPrices += Object.keys(byProgram).length;
      }
    } else noPrice++;

    durFixed += localDur; intakesSet += localIntakes;
    if (!DRY) await fs.writeFile(file, JSON.stringify(uni, null, 2) + '\n');
    touched++;
    await log(`+ ${slug}: prices=${priced.length} dur=${localDur} intakes=${localIntakes} cur=${uni.tuition.currency}`);
  }

  await log(`RESULT: touched=${touched} unisWithPrices=${tuitionUnis} totalPrices=${totalPrices} durFixed=${durFixed} intakesSet=${intakesSet} noExtract=${noExt} noPrice=${noPrice}`);
  await log(`=== ENRICH DONE ${DRY ? '(DRY)' : ''} ===`);
  console.log(JSON.stringify({ touched, tuitionUnis, totalPrices, durFixed, intakesSet, noExt, noPrice }));
})();
