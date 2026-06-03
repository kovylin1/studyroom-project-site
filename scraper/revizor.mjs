#!/usr/bin/env node
// revizor.mjs — двухфазный аудитор каталога.
//
// Фаза 1: находит "проблемных" (404 programUrl, нет программ)
// Фаза 2: для проблемных — заходит на официальный сайт, сравнивает данные
// Фаза 3: если проблемных нет — проверяет весь охват на актуальность
//
// Пишет:
//   sources/revizor-flags.json          — сырые флаги (broken links и т.д.)
//   site/public/api/revizor-review.json — pending decisions для manager UI
//
// Usage:
//   node scraper/revizor.mjs                          # manual: все 804 уни
//   node scraper/revizor.mjs --aggregator=cats        # auto: только уни агрегатора
//   node scraper/revizor.mjs --slugs=uni-a,uni-b      # конкретные slugs
//   node scraper/revizor.mjs --dry-run                # без записи файлов

import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const UNI_DIR = path.join(PROJECT_ROOT, 'site/src/content/universities');
const FLAGS_OUT = path.join(__dirname, 'sources/revizor-flags.json');
const REVIEW_OUT = path.join(PROJECT_ROOT, 'site/public/api/revizor-review.json');

const arg = (p) => (process.argv.find(a => a.startsWith(p)) || '').slice(p.length);
const DRY_RUN = process.argv.includes('--dry-run');
const AUTO_APPLY = process.argv.includes('--auto-apply');
const SLUGS_ARG = arg('--slugs=');
const AGGREGATOR = arg('--aggregator=');
const LIMIT = parseInt(arg('--limit=') || 'Infinity', 10);

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0';
const SAMPLE_PER_UNI = 3;
const CONCURRENCY = 8;
const NOW = new Date().toISOString();

const log = (...a) => process.stderr.write(`[revizor] ${NOW.slice(11, 19)} ${a.join(' ')}\n`);

// Домены агрегаторов для фильтрации охвата в auto-режиме
const AGGREGATOR_DOMAINS = {
  cats:               ['catsglobalschools.com', 'catscambridge.com', 'worthgateschool.com', 'bournemouthcollegiateschool.co.uk', 'bosworthschool.co.uk', 'guildhouseschool.com', 'catsacademyboston.com', 'cats-fc.org', 'stmikes.co.uk', 'catschina.cn'],
  edvoy:              ['edvoy.com'],
  kaplan:             ['kaplanpathways.com', 'kaplan.co.uk'],
  navitas:            ['navitas.com'],
  qahe:               ['qahighereducation.com'],
  studygroup:         ['studygroup.com', 'studygroup.co.uk'],
  'oxford-international': ['oxfordinternational.com'],
  iapro:              ['iapro.com', 'iapro.co.uk'],
  gedu:               ['gedu.global'],
  'qs-topuniversities': ['topuniversities.com'],
};

const PROG_MARKERS = /\b(BSc|BA|BEng|BBA|BS|BCom|BFA|BMus|LLB|MSc|MA|MBA|MEng|MRes|MPhil|MArch|MFA|LLM|MD|BDS|BVSc|PhD|DPhil|Bachelor|Master|Foundation|Diploma|Certificate|Doctorate)\b/i;
const FEE_RE = /([£$€])\s*([\d,]{4,7})(?:\s*(?:per year|per annum|\/year|pa\.?|annually))?/gi;
const IELTS_RE = /IELTS[^\d]*(\d(?:\.\d)?)/i;
const DEADLINE_RE = /(?:deadline|closing date|apply by)[^\d]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{4})/i;

// ── helpers ───────────────────────────────────────────────────────────────────

async function fetchOk(url, ms = 8000) {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms);
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: ac.signal, redirect: 'follow' });
    clearTimeout(t);
    return { status: r.status, ok: r.ok, html: r.ok ? await r.text() : '' };
  } catch (e) { return { status: 0, ok: false, html: '', err: e.message }; }
}

function extractTitle(html) {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i);
  if (og) return og[1].trim();
  const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1) return h1[1].trim();
  const t = html.match(/<title>([^<]+)<\/title>/i);
  return t ? t[1].trim() : '';
}

function extractFees(html) {
  const seen = new Set();
  const amounts = [];
  let m;
  FEE_RE.lastIndex = 0;
  while ((m = FEE_RE.exec(html)) !== null) {
    const value = parseInt(m[2].replace(/,/g, ''));
    if (value < 3000 || value > 95000) continue;
    const key = `${m[1]}${value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const currency = m[1] === '£' ? 'GBP' : m[1] === '$' ? 'USD' : 'EUR';
    amounts.push({ currency, value });
  }
  return amounts;
}

function extractPrograms(html) {
  const $ = cheerio.load(html);
  $('nav, footer, header, script, style').remove();
  const programs = new Set();
  $('h2, h3, h4, .course-title, .programme-title, [class*="course"] h3, [class*="programme"] h3').each((_, el) => {
    const t = $(el).text().trim().replace(/\s+/g, ' ');
    if (t.length > 10 && t.length < 150 && PROG_MARKERS.test(t)) programs.add(t);
  });
  return [...programs];
}

function extractIelts(html) {
  const m = IELTS_RE.exec(html);
  return m ? parseFloat(m[1]) : null;
}

function getOfficialUrl(uni) {
  const cands = [uni.officialUrl, uni.sourceUrl, ...(uni.programs || []).map(p => p.programUrl)].filter(Boolean);
  const aggDomains = Object.values(AGGREGATOR_DOMAINS).flat();
  for (const u of cands) {
    try {
      const origin = new URL(u).origin;
      if (!aggDomains.some(d => origin.includes(d))) return origin;
    } catch {}
  }
  return null;
}

async function scrapeOfficialSite(uni) {
  const root = getOfficialUrl(uni);
  if (!root) return null;

  const paths = ['', '/courses', '/programmes', '/study', '/study-with-us', '/fees', '/undergraduate', '/postgraduate', '/international'];
  let programs = [], fees = [], ielts = null;
  let checkedAt = NOW;

  for (const p of paths.slice(0, 5)) {
    const r = await fetchOk(root + p, 10000);
    if (!r.ok) continue;
    programs = [...new Set([...programs, ...extractPrograms(r.html)])];
    fees = [...fees, ...extractFees(r.html)];
    if (!ielts) ielts = extractIelts(r.html);
    if (programs.length >= 5 && fees.length >= 1) break;
  }

  return { root, programs, fees, ielts, checkedAt };
}

// ── load files ────────────────────────────────────────────────────────────────

let allFiles = (await fs.readdir(UNI_DIR)).filter(f => f.endsWith('.json'));

// Фильтр по режиму
if (SLUGS_ARG) {
  const slugSet = new Set(SLUGS_ARG.split(',').map(s => s.trim()));
  allFiles = allFiles.filter(f => slugSet.has(f.replace('.json', '')));
} else if (AGGREGATOR) {
  const domains = AGGREGATOR_DOMAINS[AGGREGATOR] || [];
  if (!domains.length) { log(`WARN: unknown aggregator "${AGGREGATOR}", running on all`); }
  else {
    const unis = await Promise.all(allFiles.map(async f => {
      const u = JSON.parse(await fs.readFile(path.join(UNI_DIR, f), 'utf8'));
      return { f, u };
    }));
    allFiles = unis
      .filter(({ u }) => {
        const urls = [u.officialUrl, u.sourceUrl, ...(u.programs || []).map(p => p.programUrl)].filter(Boolean);
        return urls.some(url => domains.some(d => url.includes(d)));
      })
      .map(({ f }) => f);
  }
}

if (isFinite(LIMIT)) allFiles = allFiles.slice(0, LIMIT);
log(`auditing ${allFiles.length} unis`);

// ── Phase 1: HTTP check ───────────────────────────────────────────────────────

const flags = { critical: [], warnings: [] };
const stats = { unisChecked: 0, programsSampled: 0, urls200: 0, urls404: 0, urlsTimeout: 0, noProgramUrl: 0 };
const problematicSlugs = new Set();
let idx = 0;
const items = allFiles.map(f => ({ file: f, slug: f.replace('.json', '') }));

async function phase1Worker() {
  while (idx < items.length) {
    const it = items[idx++];
    try {
      const u = JSON.parse(await fs.readFile(path.join(UNI_DIR, it.file), 'utf8'));
      stats.unisChecked++;
      const programs = u.programs || [];
      if (!programs.length) {
        flags.warnings.push({ slug: u.slug, issue: 'no programs at all' });
        problematicSlugs.add(u.slug);
        continue;
      }
      // Детерминированный равномерный сэмпл: раньше programs.sort(()=>Math.random()-0.5)
      // мутировал u.programs на месте И давал нестабильные 404-флаги между запусками.
      // Берём элементы с постоянным шагом — стабильно и покрывает разные факультеты.
      const step = Math.max(1, Math.floor(programs.length / SAMPLE_PER_UNI));
      const sampled = [];
      for (let i = 0; i < programs.length && sampled.length < SAMPLE_PER_UNI; i += step) {
        sampled.push(programs[i]);
      }
      let noUrlCount = 0;
      for (const prog of sampled) {
        stats.programsSampled++;
        if (!prog.programUrl) { stats.noProgramUrl++; noUrlCount++; continue; }
        const r = await fetchOk(prog.programUrl, 6000);
        if (r.status === 0) { stats.urlsTimeout++; continue; }
        if (r.status === 404) {
          stats.urls404++;
          flags.critical.push({ slug: u.slug, issue: 'broken programUrl', program: prog.title, url: prog.programUrl });
          problematicSlugs.add(u.slug);
          continue;
        }
        stats.urls200++;
      }
      if (noUrlCount === sampled.length) {
        flags.warnings.push({ slug: u.slug, issue: 'all sampled programs lack programUrl', count: noUrlCount });
        problematicSlugs.add(u.slug);
      }
    } catch (e) { log(`ERR ${it.slug}: ${e.message}`); }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, () => phase1Worker()));
log(`phase1 done: ${problematicSlugs.size} problematic, ${flags.critical.length} critical`);

// ── Phase 2 / 3: official site comparison ────────────────────────────────────

const reviewItems = [];
const slugsToScrape = problematicSlugs.size > 0 ? [...problematicSlugs] : allFiles.map(f => f.replace('.json', ''));

log(`phase2/3: scraping official sites for ${slugsToScrape.length} unis`);

for (const slug of slugsToScrape) {
  const uniPath = path.join(UNI_DIR, `${slug}.json`);
  if (!existsSync(uniPath)) continue;
  let u;
  try { u = JSON.parse(await fs.readFile(uniPath, 'utf8')); } catch { continue; }

  const official = await scrapeOfficialSite(u);
  if (!official) continue;

  const catalogPrograms = (u.programs || []).map(p => p.title);

  // Программы на сайте, которых нет в каталоге → action: add (автоматически)
  const newOnSite = official.programs.filter(title =>
    !catalogPrograms.some(ct => ct.toLowerCase().includes(title.slice(0, 20).toLowerCase()))
  );

  // Программы в каталоге, которых нет на сайте → needsReview (решение пользователя)
  const missingOnSite = official.programs.length >= 3
    ? catalogPrograms.filter(title =>
        !official.programs.some(ot => ot.toLowerCase().includes(title.slice(0, 20).toLowerCase()))
      ).slice(0, 10)
    : [];

  // Расхождение tuition
  const catalogFee = u.tuition ? Object.values(u.tuition.byProgram || {}).find(v => v > 0) : null;
  const officialFee = official.fees[0] || null;
  const tuitionMismatch = catalogFee && officialFee &&
    officialFee.currency === (u.tuition?.currency || 'GBP') &&
    Math.abs(officialFee.value - catalogFee) / catalogFee > 0.1; // >10% расхождение

  // IELTS расхождение
  const catalogIelts = u.requirements?.language?.ielts;
  const ieltsChanged = official.ielts && catalogIelts && Math.abs(official.ielts - catalogIelts) >= 0.5;

  if (missingOnSite.length > 0) {
    reviewItems.push({
      id: `${slug}||missing_on_site`,
      slug,
      name: u.name,
      issue: 'missing_on_site',
      severity: 'warning',
      detail: `${missingOnSite.length} программ каталога не найдены на официальном сайте`,
      programs: missingOnSite.map(title => {
        const p = (u.programs || []).find(p => p.title === title);
        return { title, slug: p?.slug };
      }),
      officialUrl: official.root,
      checkedAt: official.checkedAt,
      decision: null,
      decidedAt: null,
      applied: false,
    });
  }

  if (tuitionMismatch) {
    reviewItems.push({
      id: `${slug}||tuition_mismatch`,
      slug,
      name: u.name,
      issue: 'tuition_mismatch',
      severity: 'warning',
      detail: `Tuition в каталоге: ${u.tuition?.currency} ${catalogFee}, на сайте: ${officialFee.currency} ${officialFee.value}`,
      catalog: { value: catalogFee, currency: u.tuition?.currency || 'GBP' },
      official: officialFee,
      officialUrl: official.root,
      checkedAt: official.checkedAt,
      decision: null,
      decidedAt: null,
      applied: false,
    });
  }

  if (ieltsChanged) {
    reviewItems.push({
      id: `${slug}||ielts_changed`,
      slug,
      name: u.name,
      issue: 'ielts_changed',
      severity: 'warning',
      detail: `IELTS в каталоге: ${catalogIelts}, на сайте: ${official.ielts}`,
      catalog: catalogIelts,
      official: official.ielts,
      officialUrl: official.root,
      checkedAt: official.checkedAt,
      decision: null,
      decidedAt: null,
      applied: false,
    });
  }

  // Broken URL items из phase 1
  for (const c of flags.critical.filter(f => f.slug === slug)) {
    reviewItems.push({
      id: `${slug}||broken_url||${c.program?.slice(0, 40)}`,
      slug,
      name: u.name,
      issue: 'broken_url',
      severity: 'critical',
      detail: `404: ${c.url}`,
      programs: [{ title: c.program, url: c.url }],
      officialUrl: official.root,
      checkedAt: official.checkedAt,
      decision: null,
      decidedAt: null,
      applied: false,
    });
  }
}

// ── Merge with existing review (preserve decisions) ───────────────────────────

let existingReview = { items: [] };
try {
  if (existsSync(REVIEW_OUT)) existingReview = JSON.parse(await fs.readFile(REVIEW_OUT, 'utf8'));
} catch {}

const existingById = new Map((existingReview.items || []).map(i => [i.id, i]));
// В режиме --auto-apply авто-решаем broken_url без ревью
if (AUTO_APPLY) {
  for (const item of reviewItems) {
    if (item.issue === 'broken_url') {
      item.decision = 'delete';
      item.decidedAt = NOW;
    }
  }
  log(`auto-apply: marked ${reviewItems.filter(i => i.decision === 'delete').length} broken_url items for deletion`);
}

const mergedItems = reviewItems.map(item => {
  const prev = existingById.get(item.id);
  if (prev && prev.decision !== null) {
    return { ...item, decision: prev.decision, decidedAt: prev.decidedAt, applied: prev.applied };
  }
  return item;
});

const pending = mergedItems.filter(i => i.decision === null).length;
const ignored = mergedItems.filter(i => i.decision === 'ignore').length;
const applied = mergedItems.filter(i => i.applied).length;

const review = {
  generatedAt: NOW,
  mode: SLUGS_ARG || AGGREGATOR ? 'auto' : 'manual',
  scope: SLUGS_ARG || AGGREGATOR || 'all',
  summary: { total: mergedItems.length, pending, ignored, applied },
  items: mergedItems,
};

// ── Write outputs ─────────────────────────────────────────────────────────────

const verdict = flags.critical.length === 0 ? 'PASS' : 'CRITICAL';

if (!DRY_RUN) {
  await fs.writeFile(FLAGS_OUT, JSON.stringify(flags, null, 2));
  await fs.mkdir(path.dirname(REVIEW_OUT), { recursive: true });
  await fs.writeFile(REVIEW_OUT, JSON.stringify(review, null, 2) + '\n');
  log(`✓ wrote flags + review (${mergedItems.length} items, ${pending} pending)`);
} else {
  log(`dry-run: ${mergedItems.length} review items, ${pending} pending`);
}

log(`DONE: verdict=${verdict}, critical=${flags.critical.length}, review=${mergedItems.length}`);
console.log(JSON.stringify({ verdict, stats, criticalCount: flags.critical.length, reviewItems: mergedItems.length, pending }));
