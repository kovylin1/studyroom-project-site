#!/usr/bin/env node
// СОВА v2 — direct partners with broader paths + subdomain probe + per-uni overrides

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(PROJECT_ROOT, 'sources/direct-partners-extracts');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0';
const log = (...a) => console.error('[sova2]', new Date().toISOString().slice(11,19), ...a);

const OVERRIDES = {
  'abu-dhabi-university': { paths: ['/colleges-and-departments','/programs','/undergraduate','/graduate'] },
  'american-university-of-ras-al-khaimah': { paths: ['/academics/colleges','/programs','/study/undergraduate','/study/graduate'] },
  'anglo-american-university': { paths: ['/study','/programs','/bachelor','/master','/study-options'] },
  'beykent-university': { paths: ['/en/academic','/akademik','/en/programs','/en/faculty'] },
  'california-state-university-dominguez-hills': { paths: ['/academics/programs','/academics/colleges','/academics/majors'] },
  'curtin-university-dubai': { paths: ['/courses','/programs','/our-courses','/study'] },
  'final-international-university': { paths: ['/academics','/en/academic','/en/programs','/en/faculty'] },
  'gedu-global-education': { paths: ['/courses','/programs','/study','/qualifications'] },
  'inti-international-university': { paths: ['/courses','/study','/programmes','/undergraduate','/postgraduate'] },
  'istanbul-bilim-university': { paths: ['/akademik','/en/academic','/en/programs','/programs','/faculty'] },
  'lane-college': { paths: ['/academics','/academics/programs','/academics/majors','/programs-of-study'] },
  'milton-friedman-university': { paths: ['/en/courses','/en/programs','/en/study','/en','/courses','/programs'] },
  'northland-institute': { paths: ['/programs','/academics','/courses','/study'] },
  'srh-university-heidelberg': { paths: ['/en/courses','/en/programs','/courses','/master','/bachelor','/study-programmes'] },
  'transport-and-telecommunication-institute': { paths: ['/en/study','/en/programmes','/study-programmes','/en/programmes','/programmes'] },
  'university-of-european-management': { paths: ['/programy-studiow','/study','/en/study','/programs','/en/programs'] },
  'university-of-new-york-in-prague': { paths: ['/study','/programs','/undergraduate','/graduate','/study-at-unyp'] },
  'university-of-wollongong-in-dubai': { paths: ['/programs','/courses','/study','/study-at-uowd'] },
  'woosong-university': { paths: ['/en/academic-programs','/en/academics','/eng/academics','/en/program','/academics'] },
  'xi-an-jiaotong-liverpool-university': { paths: ['/study','/study/study-with-us','/study/undergraduate','/study/postgraduate','/academic-departments'] },
};

const PROG_MARKER = /(BSc|BA|BEng|BBA|BS|BCom|BFA|LLB|MSc|MA|MBA|MEng|MRes|MPhil|MArch|MFA|EMBA|LLM|PhD|DPhil|Bachelor|Master|Foundation|Diploma|Certificate|Doctorate|Pathway|Pre-Master)/i;
const COURSE_PATH_BROAD = /\/(course|program(?:me)?|degree|major|undergrad|postgrad|bachelor|master|study|academ|qualif|disciplin|department|faculty)s?(\/|$|-)/i;

async function fetchOk(url, timeoutMs=8000) {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    const r = await fetch(url, { headers: {'User-Agent':UA}, signal: ac.signal, redirect: 'follow' });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.text();
  } catch { return null; }
}

async function scrapeUni(browser, ext) {
  const site = new URL(ext.officialUrl).origin;
  const candidates = new Set();
  const pathsToTry = OVERRIDES[ext.slug]?.paths || [
    '/courses','/programs','/programmes','/study','/academics','/degrees','/study/courses','/en/programs','/en/courses','/en/study',
    '/faculties','/department','/qualifications','/our-courses','/study-with-us','/study-options',
  ];
  const xml = await fetchOk(site + '/sitemap.xml', 8000);
  if (xml) [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].forEach(m => {
    if (COURSE_PATH_BROAD.test(m[1])) candidates.add(m[1].split('#')[0]);
  });
  try {
    const u = new URL(site);
    const baseHost = u.hostname.replace(/^www\d?\./,'');
    for (const sub of ['study','courses','admissions','apply','international','prospectus']) {
      const subSite = u.protocol + '//' + sub + '.' + baseHost;
      const h = await fetchOk(subSite, 5000);
      if (h) {
        const $ = cheerio.load(h);
        $('a[href]').each((_, el) => {
          try {
            const a = new URL($(el).attr('href'), subSite).toString();
            if (new URL(a).origin === subSite && COURSE_PATH_BROAD.test(a)) candidates.add(a.split('#')[0]);
          } catch {}
        });
      }
    }
  } catch {}
  const ctx = await browser.newContext({ userAgent: UA, viewport: {width: 1366, height: 768} });
  const page = await ctx.newPage();
  try {
    for (const p of pathsToTry) {
      try {
        const r = await page.goto(site + p, { waitUntil: 'domcontentloaded', timeout: 12000 });
        if (!r || !r.ok()) continue;
        await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(()=>{});
        const html = await page.content();
        const $ = cheerio.load(html);
        $('a[href]').each((_, el) => {
          const href = $(el).attr('href');
          if (!href) return;
          try {
            const abs = new URL(href, site + p).toString();
            if (new URL(abs).origin === site && COURSE_PATH_BROAD.test(abs)) candidates.add(abs.split('#')[0]);
          } catch {}
        });
        if (candidates.size > 80) break;
      } catch {}
    }
    const programs = [];
    const seen = new Set((ext.programs||[]).map(p => (p.title||'').toLowerCase()));
    const list = [...candidates].slice(0, 100);
    for (const url of list) {
      try {
        const r = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
        if (!r || !r.ok()) continue;
        const html = await page.content();
        const $ = cheerio.load(html);
        let title = $('meta[property="og:title"]').attr('content') || $('h1').first().text().trim() || $('title').first().text().trim();
        if (!title) continue;
        title = title.split('|')[0].split(' - ' + ext.name)[0].trim().replace(/\s+/g,' ');
        if (title.length < 8 || title.length > 200) continue;
        if (!PROG_MARKER.test(title)) continue;
        const k = title.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        programs.push({ title, programUrl: url, verified: true });
      } catch {}
    }
    return programs;
  } finally {
    await page.close().catch(()=>{});
    await ctx.close().catch(()=>{});
  }
}

const files = (await fs.readdir(OUT_DIR)).filter(f => f.endsWith('.json') && !f.startsWith('_'));
const targets = [];
for (const f of files) {
  const ext = JSON.parse(await fs.readFile(path.join(OUT_DIR, f), 'utf8'));
  const realProgs = (ext.programs||[]).filter(p => p.verified).length;
  if (realProgs < 3 && ext.officialUrl) targets.push(ext);
}
log(`v2 targets: ${targets.length} thin partners`);

const browser = await chromium.launch({ headless: true });
let totalNew = 0;
for (const ext of targets) {
  try {
    const newProgs = await scrapeUni(browser, ext);
    if (newProgs.length) {
      ext.programs = [...(ext.programs||[]).filter(p => p.verified), ...newProgs];
      ext.scrapedAtV2 = new Date().toISOString();
      await fs.writeFile(path.join(OUT_DIR, ext.slug + '.json'), JSON.stringify(ext, null, 2));
      totalNew += newProgs.length;
      log(`${ext.slug}: +${newProgs.length} (now ${ext.programs.length})`);
    } else {
      log(`${ext.slug}: still 0`);
    }
  } catch (e) {
    log(`${ext.slug}: err ${e.message}`);
  }
}
await browser.close();
log(`DONE: +${totalNew} programs total`);
console.log(JSON.stringify({ targets: targets.length, totalNew }));
