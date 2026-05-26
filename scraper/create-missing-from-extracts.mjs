#!/usr/bin/env node
// СОЗДАТЕЛЬ: extracts → НОВЫЕ universities/*.json (то, что finalize-all-extracts.mjs не делает).
// finalize только обогащает существующие; этот скрипт создаёт недостающие.
// Append-only по смыслу: НЕ трогает существующие файлы, только пишет новые слаги.
// Запуск: node scraper/create-missing-from-extracts.mjs [--dry]

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const UNI_DIR = path.join(ROOT, 'site/src/content/universities');
const LOG = path.join(ROOT, 'sources/create-missing.log');
const DRY = process.argv.includes('--dry');

const SOURCES = [
  { dir: 'sources/edvoy-extracts',          source: 'edvoy',      confidence: 'aggregator' },
  { dir: 'sources/studygroup-extracts',     source: 'studygroup', confidence: 'aggregator' },
  { dir: 'sources/collab-extracts',         source: 'collab',     confidence: 'aggregator' },
  { dir: 'sources/direct-partners-extracts',source: 'direct',     confidence: 'partner'    },
];

const log = async (m) => {
  const line = `[create ${new Date().toISOString().slice(11, 19)}] ${m}`;
  console.error(line);
  if (!DRY) await fs.appendFile(LOG, line + '\n').catch(() => {});
};

const norm = (s) => (s || '').toString().toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
const sani = (s) => (s || '').toString().toLowerCase()
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70).replace(/-+$/g, '');

function isUrl(u) {
  if (!u || typeof u !== 'string') return false;
  try { const x = new URL(u); return x.protocol === 'http:' || x.protocol === 'https:'; } catch { return false; }
}

const CURRENCY = {
  'united kingdom': 'GBP', uk: 'GBP', england: 'GBP', scotland: 'GBP', wales: 'GBP',
  'united states': 'USD', usa: 'USD', us: 'USD',
  canada: 'CAD', australia: 'AUD', 'new zealand': 'NZD',
  kazakhstan: 'KZT', russia: 'RUB',
};
function currencyFor(country) {
  const c = (country || '').toLowerCase().trim();
  if (CURRENCY[c]) return CURRENCY[c];
  // Eurozone-ish fallback
  const eur = ['germany', 'france', 'netherlands', 'spain', 'italy', 'ireland', 'austria', 'belgium', 'finland', 'portugal', 'greece', 'switzerland'];
  if (eur.includes(c)) return 'EUR';
  return 'USD';
}

function inferLevel(text) {
  const t = (text || '').toLowerCase();
  if (/phd|doctor/.test(t)) return 'phd';
  if (/master|postgrad|\bmsc\b|\bmba\b|\bmph\b|\bllm\b|\bma\b|\bms\b|march/.test(t)) return 'master';
  if (/found|prep|pathway|access/.test(t)) return 'foundation';
  if (/pre-?sessional|english language|\besl\b/.test(t)) return 'english-language';
  if (/dipl|cert|short course/.test(t)) return 'short-course';
  return 'bachelor';
}
const DURATION = { phd: 3, master: 1, foundation: 1, 'english-language': 1, 'short-course': 1, bachelor: 3, 'high-school': 2, 'sixth-form': 2 };

function buildPrograms(ext, uniSlug) {
  const out = [];
  const seenSlug = new Set();
  const seenTitle = new Set();
  for (const p of (ext.programs || [])) {
    const title = (p && (p.title || p.name) || '').toString().trim();
    if (!title || seenTitle.has(title.toLowerCase())) continue;
    let pSlug = uniSlug + '-' + sani(title);
    pSlug = pSlug.replace(/-+$/g, '');
    if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(pSlug) || seenSlug.has(pSlug)) {
      let i = 2, base = pSlug;
      while (seenSlug.has(pSlug)) pSlug = base + '-' + i++;
      if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(pSlug)) continue;
    }
    const level = (p.level && DURATION[p.level] ? p.level : inferLevel(title + ' ' + (p.programmeType || p.programType || '')));
    const prog = {
      slug: pSlug,
      title,
      durationYears: (typeof p.durationYears === 'number' && p.durationYears > 0) ? p.durationYears : (DURATION[level] || 3),
      level,
      programType: /found|pathway/i.test(title) ? 'pathway' : 'degree',
      intakes: Array.isArray(p.intakes) && p.intakes.length ? p.intakes.map(String) : (p.intake ? [String(p.intake)] : ['September']),
      language: 'en',
    };
    const u = p.programUrl || p.url;
    if (isUrl(u)) prog.programUrl = u;
    out.push(prog);
    seenSlug.add(pSlug);
    seenTitle.add(title.toLowerCase());
  }
  return out;
}

function buildScholarships(ext) {
  if (!Array.isArray(ext.scholarships)) return [];
  const seen = new Set(); const out = [];
  for (const s of ext.scholarships) {
    if (!s || !s.name) continue;
    const k = String(s.name).toLowerCase();
    if (seen.has(k)) continue; seen.add(k);
    const o = { name: String(s.name) };
    if (s.amount && String(s.amount).trim()) o.amount = String(s.amount).trim();
    if (s.description && String(s.description).trim()) o.description = String(s.description).trim();
    if (isUrl(s.url)) o.url = s.url;
    out.push(o);
  }
  return out;
}

function buildAccommodation(ext) {
  let items = [];
  if (Array.isArray(ext.accommodation)) items = ext.accommodation;
  else if (ext.accommodation && Array.isArray(ext.accommodation.residences)) items = ext.accommodation.residences;
  const seen = new Set(); const out = [];
  for (const x of items) {
    if (!x || !x.name) continue;
    const k = String(x.name).toLowerCase();
    if (seen.has(k)) continue; seen.add(k);
    const o = { name: String(x.name) };
    const text = x.text || x.description;
    if (text && String(text).trim()) o.text = String(text).trim();
    if (x.price && String(x.price).trim()) o.price = String(x.price).trim();
    if (isUrl(x.img)) o.img = x.img;
    out.push(o);
  }
  return out;
}

function buildCampuses(ext) {
  if (!Array.isArray(ext.campuses)) return [];
  const seen = new Set(); const out = [];
  for (const c of ext.campuses) {
    const title = typeof c === 'string' ? c : (c && (c.title || c.name) || '');
    if (!title) continue;
    const k = String(title).toLowerCase();
    if (seen.has(k)) continue; seen.add(k);
    const o = { title: String(title) };
    if (typeof c === 'object') {
      const text = c.text || c.description;
      if (text && String(text).trim()) o.text = String(text).trim();
      if (c.sub && String(c.sub).trim()) o.sub = String(c.sub).trim();
      if (isUrl(c.img)) o.img = c.img;
    }
    out.push(o);
  }
  return out;
}

function buildGallery(ext, name) {
  if (!Array.isArray(ext.gallery) || !ext.gallery.length) return undefined;
  const seen = new Set(); const items = [];
  for (const g of ext.gallery) {
    const url = typeof g === 'string' ? g : (g && (g.img || g.url) || '');
    if (!url || seen.has(url)) continue; seen.add(url);
    items.push({ img: url, caption: name });
    if (items.length >= 50) break;
  }
  return items.length ? { items } : undefined;
}

function buildDescription(ext) {
  const paragraphs = [];
  const keyFacts = [];
  if (typeof ext.description === 'string' && ext.description.trim()) paragraphs.push(ext.description.trim());
  else if (ext.description && Array.isArray(ext.description.paragraphs)) {
    for (const p of ext.description.paragraphs) if (p && String(p).trim()) paragraphs.push(String(p).trim());
  }
  if (Array.isArray(ext.highlights)) for (const h of ext.highlights) if (h && String(h).trim()) keyFacts.push(String(h).trim());
  if (Array.isArray(ext.keyFacts)) for (const k of ext.keyFacts) if (k && String(k).trim()) keyFacts.push(String(k).trim());
  if (!paragraphs.length && !keyFacts.length) return undefined;
  const d = {};
  if (paragraphs.length) d.paragraphs = paragraphs.slice(0, 8);
  if (keyFacts.length) d.keyFacts = keyFacts.slice(0, 12);
  return d;
}

async function loadDir(rel) {
  const dir = path.join(ROOT, rel);
  try {
    const files = (await fs.readdir(dir)).filter(f => f.endsWith('.json') && !f.startsWith('_'));
    const out = [];
    for (const f of files) {
      try { out.push({ file: f, data: JSON.parse(await fs.readFile(path.join(dir, f), 'utf8')) }); } catch {}
    }
    return out;
  } catch { return []; }
}

(async () => {
  if (!DRY) await fs.writeFile(LOG, '');
  await log(`=== CREATE START ${DRY ? '(DRY)' : ''} ===`);

  // disk set: normalized slug + normalized name
  const diskFiles = (await fs.readdir(UNI_DIR)).filter(f => f.endsWith('.json'));
  const disk = new Set();
  for (const f of diskFiles) {
    disk.add(norm(f.replace(/\.json$/, '')));
    try { const u = JSON.parse(await fs.readFile(path.join(UNI_DIR, f), 'utf8')); if (u.name) disk.add(norm(u.name)); } catch {}
  }
  await log(`on disk: ${diskFiles.length}`);

  const created = new Set();   // dedup within this run (normalized)
  let nCreated = 0, nSkipDup = 0, nSkipNoProg = 0, nSkipNoUrl = 0, nSkipBad = 0;
  const madeSlugs = [];

  for (const { dir, source, confidence } of SOURCES) {
    const exts = await loadDir(dir);
    for (const { file, data: ext } of exts) {
      const name = (ext && ext.name || '').toString().trim();
      const country = (ext && ext.country || '');
      if (!name || typeof country !== 'string' || country.trim().length < 2) { nSkipBad++; continue; }

      const baseSlug = sani(ext.slug || name);
      if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(baseSlug)) { nSkipBad++; continue; }

      const key = norm(baseSlug);
      const keyName = norm(name);
      if (disk.has(key) || disk.has(keyName) || created.has(key) || created.has(keyName)) { nSkipDup++; continue; }

      const sourceUrl = [ext.sourceUrl, ext.website, ext.officialUrl, ext.url].find(isUrl);
      if (!sourceUrl) { nSkipNoUrl++; await log(`GAP no-url: ${baseSlug}`); continue; }

      const programs = buildPrograms(ext, baseSlug);
      if (!programs.length) { nSkipNoProg++; await log(`GAP no-programs: ${baseSlug}`); continue; }

      const city = (ext.city && String(ext.city).trim()) ||
        ((Array.isArray(ext.campuses) && ext.campuses[0] && (ext.campuses[0].title || ext.campuses[0].name)) ? String(ext.campuses[0].title || ext.campuses[0].name).trim() : '') ||
        country.trim();

      const uni = {
        slug: baseSlug,
        name,
        country: country.trim(),
        city,
        programs,
        tuition: { currency: currencyFor(country), byProgram: {} },
        deadlines: {},
        requirements: { exams: [] },
        scholarships: buildScholarships(ext),
        lastChecked: new Date().toISOString(),
        sourceUrl,
        sourceHash: 'sha256:' + crypto.createHash('sha256').update(baseSlug + '|' + source).digest('hex').slice(0, 16),
        confidence,
        language: 'en',
      };
      const accom = buildAccommodation(ext); if (accom.length) uni.accommodation = accom;
      const camps = buildCampuses(ext); if (camps.length) uni.campuses = camps;
      const gal = buildGallery(ext, name); if (gal) uni.gallery = gal;
      const desc = buildDescription(ext); if (desc) uni.description = desc;
      if (ext.logoUrl && String(ext.logoUrl).trim()) uni.logoUrl = String(ext.logoUrl).trim();

      created.add(key); created.add(keyName);
      madeSlugs.push(`${baseSlug} (${programs.length}p, ${source})`);
      if (!DRY) await fs.writeFile(path.join(UNI_DIR, baseSlug + '.json'), JSON.stringify(uni, null, 2) + '\n');
      nCreated++;
    }
  }

  await log(`RESULT: created=${nCreated} skipDup=${nSkipDup} skipNoProg=${nSkipNoProg} skipNoUrl=${nSkipNoUrl} skipBad=${nSkipBad}`);
  await log('--- created slugs ---');
  for (const s of madeSlugs) await log('  + ' + s);
  await log(`=== CREATE DONE ${DRY ? '(DRY — nothing written)' : ''} ===`);
  console.log(JSON.stringify({ created: nCreated, skipDup: nSkipDup, skipNoProg: nSkipNoProg, skipNoUrl: nSkipNoUrl, skipBad: nSkipBad }));
})();
