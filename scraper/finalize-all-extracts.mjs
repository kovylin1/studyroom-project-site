#!/usr/bin/env node
// Финализатор: merge всех extracts (edvoy + collab + studygroup) в universities/
// Append-only, ничего не удаляет. Map работает из template (city+country).

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { scoreFact, qualityOfScholarship, passes, MIN_CONFIDENCE } from './lib/confidence.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const UNI_DIR = path.join(PROJECT_ROOT, 'site/src/content/universities');
const AUDIT_DIR = path.join(PROJECT_ROOT, 'sources/audit');
const TODAY = new Date().toISOString().slice(0, 10);
// edvoy/studygroup/collab — все агрегаторы (0.35); строгий гейт уводит их в аудит
const TIER_BY_SOURCE = { direct: 'official', collab: 'aggregator', edvoy: 'aggregator', studygroup: 'aggregator' };
const schAudit = []; // стипендии < MIN_CONFIDENCE — в аудит, не в каталог
const EDVOY_DIR = path.join(PROJECT_ROOT, 'sources/edvoy-extracts');
const COLLAB_DIR = path.join(PROJECT_ROOT, 'sources/collab-extracts');
const SG_DIR = path.join(PROJECT_ROOT, 'sources/studygroup-extracts');
const LOG = path.join(PROJECT_ROOT, 'sources/finalize.log');

const log = async (msg) => {
  const line = `[final ${new Date().toISOString().slice(11,19)}] ${msg}`;
  console.error(line);
  await fs.appendFile(LOG, line + '\n').catch(()=>{});
};

function norm(s){return (s||'').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'').slice(0,40);}
function similar(a, b){return norm(a)===norm(b) || (norm(a).length>4 && norm(b).length>4 && (norm(a).includes(norm(b))||norm(b).includes(norm(a))));}

function inferLevel(text){
  const t=(text||'').toLowerCase();
  if(/phd|doctor/.test(t))return 'phd';
  if(/master|postgrad|msc|mba|mph|llm|march/.test(t))return 'master';
  if(/found|prep|pathway|access/.test(t))return 'foundation';
  if(/dipl|cert|english/.test(t))return 'short-course';
  return 'bachelor';
}

async function loadJsonDir(dir) {
  try {
    const files = (await fs.readdir(dir)).filter(f => f.endsWith('.json') && !f.startsWith('_'));
    const out = [];
    for (const f of files) {
      try { out.push(JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'))); } catch {}
    }
    return out;
  } catch { return []; }
}

function pushUnique(arr, items, keyFn) {
  if (!Array.isArray(arr)) arr = [];
  const seen = new Set(arr.map(keyFn));
  for (const it of items) {
    const k = keyFn(it);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    arr.push(it);
  }
  return arr;
}

function mergeFromExtract(uni, ext) {
  let changes = 0;
  const uniSlug = uni.slug;

  if (Array.isArray(ext.programs) && ext.programs.length) {
    const seenTitles = new Set(uni.programs.map(p => (p.title||'').toLowerCase()));
    const seenSlugs = new Set(uni.programs.map(p => p.slug));
    for (const p of ext.programs) {
      const title = p.title || '';
      if (!title || seenTitles.has(title.toLowerCase())) continue;
      const pSlug = uniSlug + '-' + title.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,60).replace(/^-+|-+$/g,'');
      if (seenSlugs.has(pSlug)) continue;
      const level = p.level || inferLevel(title + ' ' + (p.programmeType||''));
      uni.programs.push({
        slug: pSlug, title,
        durationYears: 3,
        level,
        programType: /found|pathway/i.test(title) ? 'pathway' : 'degree',
        intakes: p.intake ? [p.intake] : (p.intakes || ['September']),
        programUrl: p.programUrl || ext.sourceUrl || '',
        language: uni.language || 'en',
        verified: !!p.verified,
        source: ext.source || '',
      });
      seenTitles.add(title.toLowerCase());
      seenSlugs.add(pSlug);
      changes++;
    }
  }

  if (Array.isArray(ext.scholarships) && ext.scholarships.length) {
    if (!Array.isArray(uni.scholarships)) uni.scholarships = [];
    const tier = TIER_BY_SOURCE[ext.source] || 'aggregator';
    const accepted = [];
    for (const s of ext.scholarships) {
      if (!s || !s.name) continue;
      // confidence: доверие источника + качество имени (строго, без live-проверки)
      const confidence = Math.round(scoreFact({
        sourceTier: tier, quality: qualityOfScholarship(s.name), corroborated: false, linkLive: false,
      }) * 100) / 100;
      if (!passes(confidence)) { schAudit.push({ slug: uniSlug, kind: 'scholarship', name: String(s.name), source: ext.source, confidence }); continue; }
      const out = { name: s.name, source: ext.source, confidence, checkedAt: TODAY };
      if (s.description && s.description.trim()) out.description = s.description;
      if (s.amount && s.amount.trim()) out.amount = s.amount;
      accepted.push(out);
    }
    if (accepted.length) {
      uni.scholarships = pushUnique(uni.scholarships, accepted, s => (s.name||'').toLowerCase());
      changes++;
    }
  }

  if (Array.isArray(ext.campuses) && ext.campuses.length) {
    if (!Array.isArray(uni.campuses)) uni.campuses = [];
    uni.campuses = pushUnique(uni.campuses,
      ext.campuses.map(c => {
        if (typeof c === 'string') return { title: c };
        return { title: c.title || c.name || '', text: c.text || c.description || '', sub: c.sub || '' };
      }).filter(c => c.title),
      c => c.title.toLowerCase()
    );
    changes++;
  }

  if (ext.accommodation) {
    if (!Array.isArray(uni.accommodation)) uni.accommodation = [];
    let items = [];
    if (Array.isArray(ext.accommodation)) items = ext.accommodation;
    else if (ext.accommodation.residences) items = ext.accommodation.residences;
    items = items.filter(x => x && x.name).map(x => {
      const out = { name: x.name };
      if (x.text && x.text.trim()) out.text = x.text;
      if (x.description && x.description.trim()) out.text = x.description;
      return out;
    });
    if (items.length) {
      uni.accommodation = pushUnique(uni.accommodation, items, r => (r.name||'').toLowerCase());
      changes++;
    }
  }

  if (ext.logoUrl && !uni.logoUrl) { uni.logoUrl = ext.logoUrl; changes++; }

  if (Array.isArray(ext.gallery) && ext.gallery.length) {
    const existing = (uni.gallery?.items || []).map(g => g.img);
    const seen = new Set(existing);
    const newItems = [];
    for (const g of ext.gallery) {
      const url = typeof g === 'string' ? g : (g.img || g.url || '');
      if (!url || seen.has(url)) continue;
      seen.add(url);
      newItems.push({ img: url, caption: uni.name || '' });
    }
    if (newItems.length) {
      uni.gallery = { items: [...(uni.gallery?.items || []), ...newItems].slice(0, 50) };
      changes++;
    }
  }

  if (ext.description && (!uni.description || !uni.description.paragraphs?.length)) {
    const txt = typeof ext.description === 'string' ? ext.description : (ext.description.paragraphs?.[0] || '');
    if (txt) { uni.description = { paragraphs: [txt] }; changes++; }
  }

  return changes;
}

async function run(cmd, args) {
  return new Promise(resolve => {
    const p = spawn(cmd, args, { cwd: PROJECT_ROOT, shell: true });
    let stdout = '', stderr = '';
    p.stdout.on('data', d => stdout += d);
    p.stderr.on('data', d => stderr += d);
    p.on('close', code => resolve({ code, stdout, stderr }));
  });
}

await fs.writeFile(LOG, '');
await log('=== FINALIZE START ===');

const unisFiles = (await fs.readdir(UNI_DIR)).filter(f => f.endsWith('.json'));
const unisMap = new Map();
for (const f of unisFiles) {
  const u = JSON.parse(await fs.readFile(path.join(UNI_DIR, f), 'utf8'));
  unisMap.set(f, u);
}

const edvoy = await loadJsonDir(EDVOY_DIR);
const collab = await loadJsonDir(COLLAB_DIR);
const sg = await loadJsonDir(SG_DIR);
await log(`extracts loaded: edvoy=${edvoy.length}, collab=${collab.length}, sg=${sg.length}`);

let totalMatched = 0, totalChanges = 0;
const allExtracts = [...edvoy.map(e=>({...e,source:'edvoy'})), ...collab.map(e=>({...e,source:'collab'})), ...sg.map(e=>({...e,source:'studygroup'}))];

for (const ext of allExtracts) {
  let matchedFile = null;
  for (const [f, u] of unisMap) {
    if (similar(u.name, ext.name) || similar(u.slug, ext.slug)) {
      matchedFile = f; break;
    }
  }
  if (!matchedFile) continue;
  const uni = unisMap.get(matchedFile);
  const changes = mergeFromExtract(uni, ext);
  if (changes) totalChanges += changes;
  totalMatched++;
}

let writtenCount = 0;
for (const [f, u] of unisMap) {
  await fs.writeFile(path.join(UNI_DIR, f), JSON.stringify(u, null, 2) + '\n');
  writtenCount++;
}
await log(`MERGE DONE: matched=${totalMatched}, changes=${totalChanges}, written=${writtenCount}, scholarships-rejected(<${MIN_CONFIDENCE})=${schAudit.length}`);
if (schAudit.length) {
  await fs.mkdir(AUDIT_DIR, { recursive: true });
  await fs.writeFile(path.join(AUDIT_DIR, 'scholarships-finalize-lowconf.json'),
    JSON.stringify({ minConfidence: MIN_CONFIDENCE, generatedAt: TODAY, source: 'finalize', rejected: schAudit }, null, 2) + '\n');
}

await log('--- AUDIT ---');
const audit = await run('node', ['scraper/audit-gaps.mjs']);
await log(`audit exit=${audit.code}, stats=${(audit.stderr||'').slice(-300)}`);

await log('=== FINALIZE DONE — NO DEPLOY (waiting for user approval) ===');
console.log(JSON.stringify({ matched: totalMatched, changes: totalChanges }));
