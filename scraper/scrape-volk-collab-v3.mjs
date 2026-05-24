#!/usr/bin/env node
// ВОЛК v3 — completeness over precision: extract EVERYTHING from each collab uni page

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(PROJECT_ROOT, 'sources/collab-extracts');
await fs.mkdir(OUT_DIR, { recursive: true });

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0';
const SITE = 'https://www.collabinternational.com';
const log = (...a) => console.error('[volk3]', new Date().toISOString().slice(11,19), ...a);

async function fetchOk(url, timeoutMs=10000) {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    const r = await fetch(url, { headers: {'User-Agent':UA}, signal: ac.signal, redirect: 'follow' });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.text();
  } catch { return null; }
}

function slugify(s) {
  return (s||'').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70);
}

async function getUniUrls() {
  const xml = await fetchOk(SITE + '/sitemap.xml');
  if (!xml) return [];
  return [...xml.matchAll(/<loc>(https?:\/\/[^<]+)<\/loc>/g)].map(m=>m[1]).filter(u => {
    const p = u.replace(SITE,'').replace(/\/$/,'');
    if (!/^\/[a-z][a-z0-9-]+$/.test(p)) return false;
    if (/^\/(study-|studying-|veterinary-|scholarship-|ielts-|student-visa|our-offices|contact|about|blog|ar|en|sitemap|business-ad)/.test(p)) return false;
    return p.length >= 8;
  });
}

const PROG_MARKER = /(BA|BSc|BEng|BBA|BS|BCom|BFA|LLB|MSc|MA|MBA|MEng|MRes|MPhil|MArch|MFA|LLM|PhD|DPhil|Bachelor|Master|Foundation|Diploma|Certificate|Doctorate|Pathway|Pre-Master|Pre Master)/i;
const SKIP_PATTERNS = /\b(form|select|choose|click|read more|apply now|contact us|email|phone)\b/i;

function harvestPrograms($) {
  const found = [];
  const seen = new Set();
  $('strong, b, h2, h3, h4').each((_, hdr) => {
    const ht = $(hdr).text().trim().toLowerCase();
    if (!/(undergraduate|graduate|postgraduate|master|foundation|preparatory|phd|doctoral|short|english|pathway|professional|associate|diploma|programs?|courses?|degrees?)/i.test(ht)) return;
    if (ht.length > 120) return;
    let scan = $(hdr).parent();
    for (let i = 0; i < 6; i++) {
      scan = scan.next();
      if (!scan.length) break;
      if (scan[0].tagName === 'ul' || scan[0].tagName === 'ol') {
        scan.find('li').each((_, li) => {
          const t = $(li).text().trim().replace(/\s+/g,' ');
          if (t.length < 4 || t.length > 250) return;
          const k = t.toLowerCase();
          if (seen.has(k)) return; seen.add(k);
          found.push({ title: t, source: 'header-ul' });
        });
        break;
      }
    }
  });
  $('li').each((_, li) => {
    const t = $(li).text().trim().replace(/\s+/g,' ');
    if (t.length < 6 || t.length > 250) return;
    if (!PROG_MARKER.test(t)) return;
    if (SKIP_PATTERNS.test(t)) return;
    const k = t.toLowerCase();
    if (seen.has(k)) return; seen.add(k);
    found.push({ title: t, source: 'broad-li' });
  });
  $('table tr').each((_, tr) => {
    const cells = $(tr).find('td').toArray().map(td => $(td).text().trim());
    if (!cells.length) return;
    const first = cells[0];
    if (!first || first.length < 4 || first.length > 200) return;
    if (!PROG_MARKER.test(first)) return;
    const k = first.toLowerCase();
    if (seen.has(k)) return; seen.add(k);
    const fee = cells.find(c => /^\$|\€|\£|USD|EUR|GBP|fee|tuition/i.test(c)) || '';
    found.push({ title: first, fee, source: 'table' });
  });
  return found;
}

function harvestSections($) {
  const out = [];
  $('h2, h3, h4').each((_, hdr) => {
    const ht = $(hdr).text().trim();
    if (!ht || ht.length > 150) return;
    let para = '';
    let scan = $(hdr).parent();
    for (let i = 0; i < 3; i++) {
      scan = scan.next();
      if (!scan.length) break;
      if (scan[0].tagName === 'p' || scan[0].tagName === 'div') {
        const t = scan.text().trim();
        if (t.length > 30) { para = t.slice(0, 600); break; }
      }
    }
    if (para) out.push({ heading: ht, content: para });
  });
  return out.slice(0, 30);
}

async function scrapeUni(url) {
  const html = await fetchOk(url);
  if (!html) return null;
  const $ = cheerio.load(html);
  const title = $('h1').first().text().trim().split('\n')[0].trim() || $('title').first().text().split('|')[0].split('-')[0].trim();
  if (!title) return null;
  const slug = slugify(title);

  let country = '';
  $('a, .breadcrumb a, nav a').each((_, el) => {
    if (country) return;
    const t = $(el).text().trim();
    const m = t.match(/^(United Kingdom|UK|USA|United States|Canada|Australia|Germany|France|Spain|Italy|Ireland|Netherlands|Turkey|Hungary|Finland|Denmark|Sweden|Norway|Czech Republic|Czechia|Poland|Lithuania|Cyprus|Switzerland|Malaysia|UAE)$/i);
    if (m) country = m[1];
  });

  const cityMatch = $('h2, h3').first().text().match(/\b(London|Manchester|Birmingham|Dublin|Amsterdam|Berlin|Munich|Paris|Madrid|Barcelona|Rome|Milan|Helsinki|Copenhagen|Budapest|Prague|Warsaw|Istanbul|Ankara|Boston|New York|Toronto|Vancouver|Sydney|Melbourne|Cambridge|Oxford|Bristol|Glasgow|Edinburgh)\b/);
  const city = cityMatch ? cityMatch[0] : '';

  const programs = harvestPrograms($);
  const sections = harvestSections($);

  const paragraphs = [];
  $('p').each((_, p) => {
    if (paragraphs.length >= 5) return;
    const t = $(p).text().trim();
    if (t.length > 60 && t.length < 2000) paragraphs.push(t);
  });
  const description = paragraphs.join('\n\n').slice(0, 4000);

  const logo = $('header img, .logo img, img[alt*="logo" i]').first().attr('src') || '';
  const logoAbs = logo ? (() => { try { return new URL(logo, url).toString(); } catch { return logo; } })() : '';

  const gallery = [];
  $('img').each((_, el) => {
    const src = $(el).attr('src');
    if (!src || src.startsWith('data:') || /logo|icon|avatar|favicon|sprite/i.test(src)) return;
    try { gallery.push(new URL(src, url).toString()); } catch {}
  });

  const scholarships = [];
  $('strong, b, h2, h3, h4').each((_, hdr) => {
    const ht = $(hdr).text().trim();
    if (!/scholarship|bursary|grant|funding/i.test(ht) || ht.length > 150) return;
    let scan = $(hdr).parent();
    for (let i = 0; i < 4; i++) {
      scan = scan.next();
      if (!scan.length) break;
      if (scan[0].tagName === 'ul' || scan[0].tagName === 'ol') {
        scan.find('li').each((_, li) => {
          const t = $(li).text().trim();
          if (t && t.length > 5 && t.length < 300) scholarships.push({ name: t });
        });
        break;
      } else if (scan[0].tagName === 'p') {
        const t = scan.text().trim();
        if (t.length > 20 && t.length < 600) scholarships.push({ name: ht, description: t });
      }
    }
  });

  const fees = [];
  $('table tr').each((_, tr) => {
    const cells = $(tr).find('td').toArray().map(td => $(td).text().trim());
    if (cells.some(c => /[\$\€\£]|USD|EUR|GBP|fee|tuition/i.test(c))) {
      fees.push(cells.join(' | '));
    }
  });

  return {
    slug, name: title, country, city,
    sourceUrl: url,
    programs: programs.slice(0, 100),
    scholarships: scholarships.slice(0, 15),
    fees: fees.slice(0, 30),
    sections,
    description,
    logoUrl: logoAbs || undefined,
    gallery: [...new Set(gallery)].slice(0, 30),
    scrapedAt: new Date().toISOString(),
  };
}

const urls = await getUniUrls();
log(`found ${urls.length} uni URLs`);
const CONCURRENCY = 6;
let idx = 0, ok = 0, fail = 0, totalProg = 0;
async function worker() {
  while (idx < urls.length) {
    const i = idx++;
    try {
      const data = await scrapeUni(urls[i]);
      if (data && data.slug) {
        await fs.writeFile(path.join(OUT_DIR, data.slug + '.json'), JSON.stringify(data, null, 2));
        ok++; totalProg += data.programs.length;
        process.stderr.write(`[volk3] ${data.slug}: ${data.programs.length}p, ${data.sections.length}s, ${data.gallery.length}img\n`);
      } else { fail++; }
    } catch (e) { fail++; }
  }
}
await Promise.all(Array.from({length: CONCURRENCY}, () => worker()));
log(`DONE: ok=${ok}, fail=${fail}, totalPrograms=${totalProg}`);
console.log(JSON.stringify({ ok, fail, totalProg }));
