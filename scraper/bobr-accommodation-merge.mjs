#!/usr/bin/env node
// БОБЁР: merge ПЧЕЛА (Edvoy) extracts into universities/ + scrape accommodation from uni sites
//
// Stage 1: ПЧЕЛА merge — for each sources/edvoy-extracts/{slug}.json,
//   match to universities/{slug}.json by name; merge missing campuses, scholarships,
//   logoUrl, gallery, accommodation, and missing programs.
// Stage 2: accommodation scrape — for each uni still lacking accommodation,
//   fetch common /accommodation, /housing, /halls paths and extract residence cards.
//
// Usage: node scraper/bobr-accommodation-merge.mjs
//        node scraper/bobr-accommodation-merge.mjs --no-scrape   (merge only)

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';
import { scoreFact, qualityOfResidence, qualityOfScholarship, passes, MIN_CONFIDENCE } from './lib/confidence.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const UNI_DIR = path.join(PROJECT_ROOT, 'site/src/content/universities');
const EDVOY_DIR = path.join(PROJECT_ROOT, 'sources/edvoy-extracts');
const AUDIT_DIR = path.join(PROJECT_ROOT, 'sources/audit');
const TODAY = new Date().toISOString().slice(0, 10);
const auditRejected = []; // факты < MIN_CONFIDENCE — в аудит, не в каталог

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';
const ACCOM_PATHS = ['/accommodation','/housing','/halls','/student-life/accommodation','/student-life/housing','/living','/student-housing','/halls-of-residence','/residences','/student/accommodation'];
const log = (...a) => console.error('[bobr]', new Date().toISOString().slice(11,19), ...a);

function norm(s) { return (s||'').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'').slice(0,40); }
function similar(a, b) { return norm(a) === norm(b) || (norm(a).length>4 && norm(b).length>4 && (norm(a).includes(norm(b)) || norm(b).includes(norm(a)))); }

async function fetchOk(url, timeoutMs=8000) {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'text/html,*/*;q=0.8' }, signal: ac.signal, redirect: 'follow' });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.text();
  } catch { return null; }
}

async function loadAllUnis() {
  const files = (await fs.readdir(UNI_DIR)).filter(f => f.endsWith('.json'));
  const unis = [];
  for (const f of files) {
    try { unis.push({ file: f, slug: f.replace('.json',''), data: JSON.parse(await fs.readFile(path.join(UNI_DIR, f), 'utf8')) }); }
    catch (e) { log('parse err', f, e.message); }
  }
  return unis;
}

async function loadEdvoyExtracts() {
  let files;
  try { files = (await fs.readdir(EDVOY_DIR)).filter(f => f.endsWith('.json') && !f.startsWith('_')); }
  catch { return []; }
  const out = [];
  for (const f of files) {
    try { out.push(JSON.parse(await fs.readFile(path.join(EDVOY_DIR, f), 'utf8'))); }
    catch {}
  }
  return out;
}

function inferLevel(title, fromEdvoy) {
  if (fromEdvoy) {
    const f = fromEdvoy.toLowerCase();
    if (f.includes('phd') || f.includes('doctor')) return 'phd';
    if (f.includes('master') || f.includes('postgrad')) return 'master';
    if (f.includes('found')) return 'foundation';
    if (f.includes('bach') || f.includes('undergrad')) return 'bachelor';
    if (f.includes('cert') || f.includes('dipl')) return 'short-course';
  }
  const t = title.toLowerCase();
  if (/\b(phd|dphil|doctorate|doctoral)\b/.test(t)) return 'phd';
  if (/\b(msc|mba|emba|meng|mres|mphil|llm|march|mfa|mcomm)\b/.test(t) || /\bmaster\b/.test(t)) return 'master';
  if (/\b(foundation|pathway|access)\b/.test(t)) return 'foundation';
  if (/\b(diploma|certificate)\b/.test(t)) return 'short-course';
  return 'bachelor';
}
function inferDuration(level, title) {
  if (level === 'master') return /\bpart.time\b/i.test(title) ? 2 : 1;
  if (level === 'phd') return 3;
  if (level === 'foundation' || level === 'short-course') return 1;
  return 3;
}
function inferType(title) {
  if (/\b(foundation|pathway|access)\b/i.test(title)) return 'pathway';
  return 'degree';
}

function mergeEdvoy(uni, ev) {
  let changed = 0;
  if (Array.isArray(ev.campuses) && ev.campuses.length) {
    if (!Array.isArray(uni.campuses)) uni.campuses = [];
    const existing = new Set(uni.campuses.map(c => (c.title || c.name || '').toLowerCase()));
    for (const c of ev.campuses) {
      const t = (typeof c === 'string') ? c : (c.name || c.title || '');
      if (!t || existing.has(t.toLowerCase())) continue;
      const desc = (typeof c === 'object' && (c.edpCampusContent?.description || c.description)) || '';
      uni.campuses.push({ title: t, text: desc, sub: '' });
      existing.add(t.toLowerCase());
      changed++;
    }
  }
  if (Array.isArray(ev.scholarships) && ev.scholarships.length) {
    if (!Array.isArray(uni.scholarships)) uni.scholarships = [];
    const existing = new Set(uni.scholarships.map(s => (s.name || '').toLowerCase()));
    for (const s of ev.scholarships) {
      const name = s.name || s.title || s;
      if (!name || existing.has(name.toLowerCase())) continue;
      // Edvoy = aggregator (0.35); строгий гейт ≥0.85 уводит почти всё в аудит
      const confidence = Math.round(scoreFact({
        sourceTier: 'aggregator', quality: qualityOfScholarship(name), corroborated: false, linkLive: false,
      }) * 100) / 100;
      if (!passes(confidence)) { auditRejected.push({ slug: uni.slug, kind: 'scholarship', name, source: 'edvoy', confidence }); continue; }
      // схема: amount/description — z.string().min(1).optional() → пустые строки НЕ писать
      const sch = { name, source: 'edvoy', confidence, checkedAt: TODAY };
      if (s.description) sch.description = s.description;
      if (s.amount) sch.amount = s.amount;
      uni.scholarships.push(sch);
      existing.add(name.toLowerCase());
      changed++;
    }
  }
  if (ev.logoUrl && !uni.logoUrl) { uni.logoUrl = ev.logoUrl; changed++; }
  if (Array.isArray(ev.gallery) && ev.gallery.length) {
    // схема: gallery = { items: [{ img, caption? }] }, НЕ плоский массив строк
    if (!uni.gallery || !Array.isArray(uni.gallery.items)) uni.gallery = { items: [] };
    const existing = new Set(uni.gallery.items.map(it => it.img));
    for (const g of ev.gallery) {
      const url = typeof g === 'string' ? g : (g.url || g.src || g.img || '');
      if (!url || existing.has(url)) continue;
      uni.gallery.items.push({ img: url });
      existing.add(url);
      changed++;
    }
  }
  if (Array.isArray(ev.programs) && ev.programs.length) {
    const existingTitles = new Set((uni.programs||[]).map(p => (p.title||'').toLowerCase()));
    const existingSlugs = new Set((uni.programs||[]).map(p => p.slug));
    let added = 0;
    for (const p of ev.programs) {
      const title = p.title || p.name || '';
      if (!title || existingTitles.has(title.toLowerCase())) continue;
      const slug = uni.slug + '-' + title.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,60).replace(/^-+|-+$/g,'');
      if (existingSlugs.has(slug)) continue;
      const level = inferLevel(title, p.courseLevel);
      // схема: programUrl = z.string().url().optional() → пустую строку НЕ писать
      const prog = {
        slug, title,
        durationYears: inferDuration(level, title),
        level,
        programType: inferType(title),
        intakes: ['September'],
        language: uni.language || 'en',
        source: 'edvoy',
      };
      const purl = p.programUrl || p.url || ev.sourceUrl || '';
      if (purl) prog.programUrl = purl;
      uni.programs.push(prog);
      existingTitles.add(title.toLowerCase());
      existingSlugs.add(slug);
      added++;
    }
    if (added) changed += added;
  }
  if (ev.description && !uni.description) {
    uni.description = { paragraphs: [ev.description] };
    changed++;
  }
  return changed;
}

async function findRealSiteRoot(uni) {
  const AGG = ['kaplanpathways.com','navitas.com','topuniversities.com','oxfordinternational.com','catsglobalschools.com'];
  const cands = [uni.officialUrl, uni.sourceUrl, ...(uni.programs||[]).map(p=>p.programUrl).filter(Boolean)];
  for (const u of cands) {
    if (!u) continue;
    try { const o = new URL(u).origin; if (AGG.some(d => o.includes(d))) continue; return o; } catch {}
  }
  return null;
}

async function scrapeAccommodation(uni) {
  // схема и сайт ждут МАССИВ; поддерживаем легаси-форму {residences}
  const existing = Array.isArray(uni.accommodation) ? uni.accommodation : (uni.accommodation?.residences || []);
  if (existing.length > 0) return 0;
  const siteRoot = await findRealSiteRoot(uni);
  if (!siteRoot) return 0;
  const residences = [];
  for (const p of ACCOM_PATHS) {
    const html = await fetchOk(siteRoot + p);
    if (!html) continue; // страница отдала 200 → источник живой
    const $ = cheerio.load(html);
    $('h2, h3, h4').each((_, el) => {
      const t = $(el).text().trim();
      if (!t || t.length < 6 || t.length > 120) return;
      if (!/(hall|residence|house|tower|court|village|college|apartment|accommodation)/i.test(t)) return;
      const next = $(el).nextAll().slice(0, 2).text().trim().slice(0, 250);
      residences.push({ name: t, description: next });
    });
    if (residences.length >= 3) break;
  }
  if (!residences.length) return 0;
  const seen = new Set();
  const accepted = [];
  for (const r of residences) {
    const k = r.name.toLowerCase();
    if (seen.has(k)) continue; seen.add(k);
    const confidence = Math.round(scoreFact({
      sourceTier: 'official', quality: qualityOfResidence(r.name), corroborated: false, linkLive: true,
    }) * 100) / 100;
    if (!passes(confidence)) { auditRejected.push({ slug: uni.slug, kind: 'accommodation', name: r.name, confidence }); continue; }
    accepted.push({ name: r.name, text: r.description || '', source: 'official-site', verifiedBySite: true, confidence, checkedAt: TODAY });
  }
  if (!accepted.length) return 0;
  uni.accommodation = accepted.slice(0, 10); // МАССИВ
  return accepted.length;
}

// ---- main ----
const noScrape = process.argv.includes('--no-scrape');

log('loading unis + edvoy extracts');
const unis = await loadAllUnis();
const edvoy = await loadEdvoyExtracts();
log(`unis: ${unis.length}, edvoy extracts: ${edvoy.length}`);

let mergeMatched = 0, mergeNoMatch = 0, mergeFieldChanges = 0, newUniCreated = 0;
const unmatched = [];
for (const ev of edvoy) {
  const evName = ev.name || '';
  let match = unis.find(u => similar(u.data.name, evName) || similar(u.slug, ev.slug));
  if (!match) { mergeNoMatch++; unmatched.push(ev); continue; }
  const changed = mergeEdvoy(match.data, ev);
  if (changed) {
    await fs.writeFile(path.join(UNI_DIR, match.file), JSON.stringify(match.data, null, 2) + '\n');
    mergeFieldChanges += changed;
    mergeMatched++;
  }
}
log(`STAGE 1 merge: matched=${mergeMatched}, no-match=${mergeNoMatch}, field-changes=${mergeFieldChanges}`);

// STAGE 1.5: create new uni JSONs for unmatched Edvoy partners
log(`STAGE 1.5: creating new uni files from ${unmatched.length} unmatched Edvoy partners`);
const existingSlugs = new Set(unis.map(u => u.slug));
for (const ev of unmatched) {
  // Build slug from name
  let slug = (ev.name||'').toLowerCase().normalize('NFKD').replace(/['‘’]/g,'').replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60);
  if (!slug || existingSlugs.has(slug)) {
    // disambiguate
    let i = 2;
    while (existingSlugs.has(slug + '-' + i)) i++;
    slug = slug + '-' + i;
  }
  existingSlugs.add(slug);

  // Build programs from ev.programs
  const programs = [];
  const seenSlugs = new Set();
  for (const p of (ev.programs||[])) {
    const title = p.title || p.name || '';
    if (!title) continue;
    const pSlug = slug + '-' + title.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,60).replace(/^-+|-+$/g,'');
    if (seenSlugs.has(pSlug)) continue;
    seenSlugs.add(pSlug);
    const level = inferLevel(title, p.courseLevel);
    const prog = {
      slug: pSlug, title,
      durationYears: inferDuration(level, title),
      level,
      programType: inferType(title),
      intakes: ['September'],
      language: 'en',
      source: 'edvoy',
    };
    const purl = p.programUrl || p.url || ev.sourceUrl || '';
    if (purl) prog.programUrl = purl;
    programs.push(prog);
  }

  // Build campuses from ev.campuses
  const campuses = [];
  for (const c of (ev.campuses||[])) {
    const t = (typeof c === 'string') ? c : (c.name || c.title || '');
    if (!t) continue;
    const desc = (typeof c === 'object' && (c.edpCampusContent?.description || c.description)) || '';
    campuses.push({ title: t, text: desc, sub: '' });
  }

  const newUni = {
    slug,
    name: ev.name,
    country: ev.country || '',
    city: ev.city || '',
    programs,
    sourceUrl: ev.sourceUrl || 'https://edge.edvoy.com/',
    sourceHash: 'sha256:edvoy-' + Date.now().toString(36),
    confidence: 'aggregator',
    language: 'en',
    lastChecked: new Date().toISOString().slice(0,10),
  };
  if (campuses.length) newUni.campuses = campuses;
  if (ev.scholarships?.length) {
    const accepted = [];
    for (const s of ev.scholarships) {
      const name = s.name||s.title||s;
      if (!name) continue;
      const confidence = Math.round(scoreFact({
        sourceTier: 'aggregator', quality: qualityOfScholarship(name), corroborated: false, linkLive: false,
      }) * 100) / 100;
      if (!passes(confidence)) { auditRejected.push({ slug, kind: 'scholarship', name, source: 'edvoy', confidence }); continue; }
      const sch = { name, source: 'edvoy', confidence, checkedAt: TODAY };
      if (s.description) sch.description = s.description;
      if (s.amount) sch.amount = s.amount;
      accepted.push(sch);
    }
    if (accepted.length) newUni.scholarships = accepted;
  }
  if (ev.logoUrl) newUni.logoUrl = ev.logoUrl;
  if (ev.gallery?.length) {
    // схема: gallery = { items: [{ img }] }
    const items = ev.gallery.slice(0,30)
      .map(g => ({ img: typeof g === 'string' ? g : (g.url || g.src || g.img || '') }))
      .filter(it => it.img);
    if (items.length) newUni.gallery = { items };
  }
  if (ev.description) newUni.description = { paragraphs: [ev.description] };

  await fs.writeFile(path.join(UNI_DIR, slug + '.json'), JSON.stringify(newUni, null, 2) + '\n');
  newUniCreated++;
}
log(`STAGE 1.5 new unis created: ${newUniCreated}`);

let accomAdded = 0;
if (!noScrape) {
  const unisReload = await loadAllUnis();
  const CONCURRENCY = 5;
  let idx = 0;
  async function worker() {
    while (idx < unisReload.length) {
      const i = idx++;
      const u = unisReload[i];
      try {
        const n = await scrapeAccommodation(u.data);
        if (n > 0) {
          await fs.writeFile(path.join(UNI_DIR, u.file), JSON.stringify(u.data, null, 2) + '\n');
          accomAdded++;
          process.stderr.write(`[bobr-accom] ${u.slug}: +${n} residences\n`);
        }
      } catch (e) { process.stderr.write(`[bobr-accom] ${u.slug}: err ${e.message}\n`); }
    }
  }
  await Promise.all(Array.from({length: CONCURRENCY}, () => worker()));
  log(`STAGE 2 accommodation: unis with new accom = ${accomAdded}`);
}

if (auditRejected.length) {
  await fs.mkdir(AUDIT_DIR, { recursive: true });
  await fs.writeFile(path.join(AUDIT_DIR, 'bobr-merge-lowconf.json'),
    JSON.stringify({ minConfidence: MIN_CONFIDENCE, generatedAt: TODAY, rejected: auditRejected }, null, 2) + '\n');
}
const rejAccom = auditRejected.filter(r => r.kind === 'accommodation').length;
const rejSch = auditRejected.filter(r => r.kind === 'scholarship').length;
log(`БОБЁР DONE — rejected(<${MIN_CONFIDENCE}): accom=${rejAccom} scholarships=${rejSch}`);
console.log(JSON.stringify({ mergeMatched, mergeNoMatch, mergeFieldChanges, newUniCreated, accomAdded, rejectedAccom: rejAccom, rejectedScholarships: rejSch }, null, 2));
