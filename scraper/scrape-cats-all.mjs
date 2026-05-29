#!/usr/bin/env node
// scrape-cats-all.mjs — CATS Global Schools collector (ПАУК domain).
// Fetches curriculum pages for 9 CATS network schools, writes sources/cats-collected.json.
// Then runs expand-cats-programs.mjs to push programs into university JSONs.
//
// Usage: node scraper/scrape-cats-all.mjs [--dry-run] [--skip-expand]

import fs from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_FILE = path.join(__dirname, 'sources', 'cats-collected.json');
const UNIS_DIR = path.join(__dirname, '..', 'site', 'src', 'content', 'universities');
const EXPAND_SCRIPT = path.join(__dirname, 'src', 'expand-cats-programs.mjs');

const DRY_RUN = process.argv.includes('--dry-run');
const SKIP_EXPAND = process.argv.includes('--skip-expand');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';
const TIMEOUT = 14000;
const log = (...a) => process.stderr.write(`[cats] ${new Date().toISOString().slice(11, 19)} ${a.join(' ')}\n`);

// Known curriculum pages per school.
// category → key for expand-cats LEVEL_MAP; qualification → QUAL_LABEL key.
const SCHOOLS = [
  {
    slug: 'cats-cambridge',
    pages: [
      { url: 'https://catscambridge.com/curriculum/gcse/', category: 'high_school', qualification: 'gcse', durYears: 2, intakes: ['September'] },
      { url: 'https://catscambridge.com/curriculum/a-levels/', category: 'sixth_form', qualification: 'a-level', durYears: 2, intakes: ['September', 'January'] },
      { url: 'https://catscambridge.com/university-foundation/', category: 'foundation', qualification: 'international-foundation', durYears: 1, intakes: ['September', 'January'] },
      { url: 'https://catscambridge.com/pre-masters/', category: 'foundation', qualification: 'pre-master', durYears: 0.5, intakes: ['September', 'January'] },
    ],
    tuition: { gcse: 37800, 'a-level': 39800, 'international-foundation': 28500, 'pre-master': 18500 },
  },
  {
    slug: 'worthgate-school',
    pages: [
      { url: 'https://worthgateschool.com/curriculum/gcse/', category: 'high_school', qualification: 'gcse', durYears: 2, intakes: ['September'] },
      { url: 'https://worthgateschool.com/curriculum/a-levels/', category: 'sixth_form', qualification: 'a-level', durYears: 2, intakes: ['September'] },
      { url: 'https://worthgateschool.com/curriculum/foundation/', category: 'foundation', qualification: 'international-foundation', durYears: 1, intakes: ['September', 'January'] },
    ],
    tuition: { gcse: 35900, 'a-level': 37500, 'international-foundation': 26800 },
  },
  {
    slug: 'bournemouth-collegiate-school',
    pages: [
      { url: 'https://bournemouthcollegiateschool.co.uk/senior/curriculum-overview-2', category: 'high_school', qualification: 'gcse', durYears: 2, intakes: ['September'] },
      { url: 'https://bournemouthcollegiateschool.co.uk/sixth-form/', category: 'sixth_form', qualification: 'a-level', durYears: 2, intakes: ['September'] },
      { url: 'https://bournemouthcollegiateschool.co.uk/international/', category: 'foundation', qualification: 'international-foundation', durYears: 1, intakes: ['September', 'January'] },
    ],
    tuition: { gcse: 34500, 'a-level': 36000, 'international-foundation': 25500 },
  },
  {
    slug: 'bosworth-independent-school',
    pages: [
      { url: 'https://bosworthschool.co.uk/course/year-7-8-9/', category: 'high_school', qualification: 'year-7-9', durYears: 1, intakes: ['September'] },
      { url: 'https://bosworthschool.co.uk/course/gcse/', category: 'high_school', qualification: 'gcse', durYears: 2, intakes: ['September'] },
      { url: 'https://bosworthschool.co.uk/course/sixth-form/', category: 'sixth_form', qualification: 'a-level', durYears: 2, intakes: ['September'] },
      { url: 'https://bosworthschool.co.uk/course/foundation/', category: 'foundation', qualification: 'international-foundation', durYears: 1, intakes: ['September', 'January'] },
    ],
    tuition: { 'year-7-9': 31500, gcse: 33000, 'a-level': 35500, 'international-foundation': 24500 },
  },
  {
    slug: 'guildhouse-school-london',
    pages: [
      { url: 'https://guildhouseschool.com/curriculum/gcse/', category: 'high_school', qualification: 'gcse', durYears: 2, intakes: ['September'] },
      { url: 'https://guildhouseschool.com/curriculum/a-levels/', category: 'sixth_form', qualification: 'a-level', durYears: 2, intakes: ['September', 'January'] },
      { url: 'https://guildhouseschool.com/curriculum/foundation/', category: 'foundation', qualification: 'international-foundation', durYears: 1, intakes: ['September', 'January'] },
    ],
    tuition: { gcse: 36000, 'a-level': 38500, 'international-foundation': 27000 },
  },
  {
    slug: 'cats-academy-boston',
    pages: [
      { url: 'https://www.catsacademyboston.com/academics/high-school-diploma/', category: 'sixth_form', qualification: 'us-high-school-diploma', durYears: 4, intakes: ['September', 'January'] },
      { url: 'https://www.catsacademyboston.com/academics/grade-9-10/', category: 'high_school', qualification: 'us-high-school-9-10', durYears: 2, intakes: ['September', 'January'] },
    ],
    tuition: { 'us-high-school-diploma': 52000, 'us-high-school-9-10': 52000 },
  },
  {
    slug: 'forest-city-international-school',
    pages: [
      { url: 'https://cats-fc.org/curriculum-upper-school/', category: 'sixth_form', qualification: 'a-level', durYears: 2, intakes: ['September'] },
      { url: 'https://cats-fc.org/curriculum/', category: 'high_school', qualification: 'gcse', durYears: 2, intakes: ['September'] },
    ],
    tuition: { 'a-level': 22000, gcse: 20000 },
  },
  {
    slug: 'st-michaels-school',
    pages: [
      { url: 'https://www.stmikes.co.uk/sixth-form-age-16-18/a-levels/', category: 'sixth_form', qualification: 'a-level', durYears: 2, intakes: ['September'] },
    ],
    tuition: { 'a-level': 26500 },
  },
  {
    slug: 'cats-college-china',
    pages: [
      { url: 'https://www.catschina.cn/en/courses/', category: 'sixth_form', qualification: 'a-level', durYears: 2, intakes: ['September'] },
      { url: 'https://catsglobalschools.com/our-schools/cats-college-china/', category: 'foundation', qualification: 'international-foundation', durYears: 1, intakes: ['September'] },
    ],
    tuition: { 'a-level': 185000, 'international-foundation': 120000 },
  },
];

const SKIP_RE = /^(courses?|programmes?|subjects?|curriculum|overview|home|contact|about|fees?|admissions?|apply(?: now)?|news|events?|gallery|results?|welcome|read more|find out more|learn more|download|view|click here|our|the|is|are|with|from|at|by|on|we|us|they|it|this|that|these|those|all|more|see|get|join|start|book|request|enquire|register|sign up|log in|back|next|previous|search|menu|cookie|privacy|terms)$/i;
const JUNK_RE = /[<>{}|\\@#%^*=_~`]|\d{4}|\bpx\b|\bvar\b|\bfunction\b/;

async function fetchText(url) {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), TIMEOUT);
    const r = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: ac.signal,
    });
    clearTimeout(t);
    return r.ok ? await r.text() : null;
  } catch { return null; }
}

function extractSubjects(html) {
  const $ = cheerio.load(html);
  $('nav, footer, header, .nav, .footer, .header, .menu, script, style, noscript, aside').remove();
  const subjects = new Set();

  // Specific selectors first
  for (const sel of ['.subject-list li', '.course-list li', '.subjects li', '.courses li',
    '.programme-list li', '.curriculum-list li', 'ul.subjects li', 'ul.courses li',
    '.subject-name', '.course-name', '.programme-name', 'td.subject', 'td.course',
    '[class*="subject"] li', '[class*="course"] li']) {
    $(sel).each((_, el) => {
      const t = $(el).text().trim().replace(/\s+/g, ' ');
      if (isValidSubject(t)) subjects.add(t);
    });
  }

  // Fallback: h3/h4/li scan
  if (subjects.size < 3) {
    $('h3, h4, li').each((_, el) => {
      const t = $(el).text().trim().replace(/\s+/g, ' ');
      if (isValidSubject(t)) subjects.add(t);
    });
  }

  return [...subjects];
}

function isValidSubject(t) {
  if (!t || t.length < 3 || t.length > 80) return false;
  if (JUNK_RE.test(t)) return false;
  if (SKIP_RE.test(t.trim())) return false;
  if (/^\d/.test(t)) return false;
  // Must start with a capital letter (actual subject names do)
  if (!/^[A-Z]/.test(t)) return false;
  return true;
}

// Fallback: derive subjects from existing university JSON program titles
function subjectsFromExisting(slug, qualification) {
  const file = path.join(UNIS_DIR, `${slug}.json`);
  if (!existsSync(file)) return [];
  try {
    const uni = JSON.parse(readFileSync(file, 'utf8'));
    const qualKey = qualification.replace(/-/g, ' ').toLowerCase().split(' ')[0];
    return [...new Set(
      (uni.programs || [])
        .filter(p => p.faculty?.toLowerCase().includes(qualKey))
        .map(p => p.title?.replace(/^(A-Level|GCSE|IB Diploma|UFP|Foundation)\s+/i, '').trim())
        .filter(s => s && s.length >= 3)
    )];
  } catch { return []; }
}

function qualName(q) {
  const names = {
    gcse: 'GCSE', 'a-level': 'A-Level',
    'international-foundation': 'International Foundation Programme',
    'pre-master': "Pre-Master's", 'year-7-9': 'Year 7-9',
    'ib-diploma': 'IB Diploma', 'us-high-school-diploma': 'US High School Diploma',
    'us-high-school-9-10': 'US High School (Grade 9-10)',
  };
  return names[q] ?? q;
}

// ── Main ──────────────────────────────────────────────────────────────────────
const collected = {};

for (const school of SCHOOLS) {
  log(`→ ${school.slug}`);
  const programs = {};

  for (const page of school.pages) {
    log(`  fetch ${page.url}`);
    const html = await fetchText(page.url);
    let subjects = html ? extractSubjects(html) : [];

    if (subjects.length < 3) {
      log(`  ⚠ only ${subjects.length} subjects live, falling back to existing data`);
      subjects = subjectsFromExisting(school.slug, page.qualification);
      log(`  fallback: ${subjects.length} subjects`);
    } else {
      log(`  ✓ ${subjects.length} subjects`);
    }

    const entry = {
      name: qualName(page.qualification),
      qualification: page.qualification,
      ...(subjects.length > 0 ? { subjects } : {}),
      tuition: { value: school.tuition[page.qualification] ?? null },
      intakes: page.intakes,
      source_url: page.url,
      duration: `${page.durYears} year${page.durYears !== 1 ? 's' : ''}`,
      duration_years: page.durYears,
    };

    if (!programs[page.category]) programs[page.category] = [];
    programs[page.category].push(entry);
  }

  collected[school.slug] = { programs };
}

if (!DRY_RUN) {
  await fs.writeFile(OUT_FILE, JSON.stringify(collected, null, 2) + '\n');
  log(`✓ wrote ${OUT_FILE}`);
} else {
  log('dry-run: skipping write');
  process.stderr.write(Object.entries(collected).map(([slug, d]) => {
    const total = Object.values(d.programs).flat().length;
    const subjectTotals = Object.entries(d.programs).map(([cat, arr]) =>
      `${cat}:${arr.map(e => e.subjects?.length ?? 0).join('+')}`).join(' ');
    return `  ${slug}: ${total} quals [${subjectTotals}]`;
  }).join('\n') + '\n');
}

// Run expand-cats-programs.mjs to push updated programs into university JSONs
if (!DRY_RUN && !SKIP_EXPAND) {
  log('→ running expand-cats-programs.mjs');
  await new Promise((resolve) => {
    const child = spawn('node', [EXPAND_SCRIPT], {
      stdio: ['ignore', 'pipe', 'inherit'],
      cwd: path.join(__dirname, '..'),
    });
    let out = '';
    child.stdout.on('data', d => { out += d; });
    child.on('close', code => {
      if (code !== 0) log(`WARN expand exit ${code}`);
      else log(`✓ expand:\n${out.trim().slice(0, 600)}`);
      resolve();
    });
    child.on('error', e => { log(`ERR expand: ${e.message}`); resolve(); });
  });
}

const totalQuals = Object.values(collected).reduce((s, d) => s + Object.values(d.programs).flat().length, 0);
console.log(JSON.stringify({ schools: Object.keys(collected).length, qualifications: totalQuals, dryRun: DRY_RUN }));
