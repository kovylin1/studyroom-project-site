#!/usr/bin/env node
// ВОЛК v2 — collabinternational.com (targeted parsing)
// Programs live in <p><strong>X Programs</strong></p><ul><li>... pattern

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
const log = (...a) => console.error('[volk2]', new Date().toISOString().slice(11,19), ...a);

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
  const urls = [...xml.matchAll(/<loc>(https?:\/\/[^<]+)<\/loc>/g)].map(m => m[1]);
  return urls.filter(u => {
    const p = u.replace(SITE,'').replace(/\/$/,'');
    if (!p.startsWith('/')) return false;
    if (/^\/(study-|studying-|veterinary-|scholarship-|ielts-|student-visa|our-offices|contact|about|blog|ar|en|sitemap)/.test(p)) return false;
    if (/^\/business-ad-/.test(p)) return false;
    if (p.length < 8) return false;
    return /^\/[a-z][a-z0-9-]+$/.test(p);
  });
}

const PROGRAM_SECTION = /(undergraduate|graduate|postgraduate|master|foundation|preparatory|phd|doctoral|short|english|pathway|professional|associate|diploma)\s+programs?/i;

function extractPrograms($) {
  const found = [];
  const seen = new Set();
  $('strong, h2, h3, h4').each((_, hdr) => {
    const ht = $(hdr).text().trim();
    if (!PROGRAM_SECTION.test(ht)) return;
    const lvl = ht.toLowerCase();
    const level = lvl.includes('master') || lvl.includes('postgrad') ? 'master'
      : lvl.includes('phd') || lvl.includes('doctor') ? 'phd'
      : lvl.includes('foundation') || lvl.includes('prep') ? 'foundation'
      : lvl.includes('english') ? 'english-language'
      : lvl.includes('diploma') ? 'short-course'
      : 'bachelor';
    let scan = $(hdr).parent();
    let lis = [];
    for (let i = 0; i < 5; i++) {
      scan = scan.next();
      if (!scan.length) break;
      const tag = scan[0].tagName;
      if (tag === 'ul' || tag === 'ol') {
        scan.find('li').each((_, li) => lis.push($(li).text().trim()));
        break;
      }
    }
    for (const text of lis) {
      if (!text || text.length < 4 || text.length > 200) continue;
      const cleaned = text.replace(/\s+/g,' ').trim();
      if (/\b(offers|provides|includes|features|allows|enables|the university|its programs)\b/i.test(cleaned)) continue;
      const key = cleaned.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({ title: cleaned, level });
    }
  });
  return found;
}

async function scrapeUni(url) {
  const html = await fetchOk(url);
  if (!html) return null;
  const $ = cheerio.load(html);
  const title = $('h1').first().text().trim().split('\n')[0].trim() ||
                ($('title').first().text().split('|')[0].split('-')[0].trim());
  if (!title) return null;
  const slug = slugify(title);

  let country = '';
  $('a, .breadcrumb a, nav a').each((_, el) => {
    if (country) return;
    const t = $(el).text().trim();
    const m = t.match(/^(United Kingdom|UK|USA|United States|Canada|Australia|Germany|France|Spain|Italy|Ireland|Netherlands|Turkey|Hungary|Finland|Denmark|Sweden|Norway|Czech Republic|Czechia|Poland|Lithuania|Cyprus|Switzerland|Malaysia|UAE)$/i);
    if (m) country = m[1];
  });
  if (!country) {
    const intro = $('h2, h3').first().text() + ' ' + $('.intro,.summary,header p').text();
    const m = intro.match(/\b(United Kingdom|UK|USA|United States|Canada|Australia|Germany|France|Spain|Italy|Ireland|Netherlands|Turkey|Hungary|Finland|Denmark|Sweden|Norway|Czech Republic|Czechia|Poland|Lithuania|Cyprus|Switzerland|Malaysia|UAE)\b/i);
    if (m) country = m[1];
  }

  const cityMatch = $('h2, h3').first().text().match(/\b(London|Manchester|Birmingham|Dublin|Amsterdam|Berlin|Munich|Paris|Madrid|Barcelona|Rome|Milan|Helsinki|Copenhagen|Budapest|Prague|Warsaw|Istanbul|Ankara|Boston|New York|Toronto|Vancouver|Sydney|Melbourne|Cambridge|Oxford|Bristol|Glasgow|Edinburgh)\b/);
  const city = cityMatch ? cityMatch[0] : '';

  const programs = extractPrograms($);

  let description = '';
  $('p').each((_, p) => {
    if (description) return;
    const t = $(p).text().trim();
    if (t.length > 80 && t.length < 2000) description = t.slice(0, 1500);
  });

  const logo = $('header img, .logo img, img[alt*="logo" i]').first().attr('src') || '';
  const logoAbs = logo ? (() => { try { return new URL(logo, url).toString(); } catch { return logo; } })() : '';

  const gallery = [];
  $('main img, article img, .content img, section img').each((_, el) => {
    const src = $(el).attr('src');
    if (!src || src.startsWith('data:') || /logo|icon|avatar|favicon|sprite/i.test(src)) return;
    try { gallery.push(new URL(src, url).toString()); } catch {}
  });

  const scholarships = [];
  $('strong, h2, h3, h4').each((_, hdr) => {
    const ht = $(hdr).text().trim();
    if (!/scholarship|bursary|grant|funding/i.test(ht) || ht.length > 100) return;
    let scan = $(hdr).parent();
    for (let i = 0; i < 4; i++) {
      scan = scan.next();
      if (!scan.length) break;
      if (scan[0].tagName === 'ul' || scan[0].tagName === 'ol') {
        scan.find('li').each((_, li) => {
          const t = $(li).text().trim();
          if (t && t.length > 5 && t.length < 250) scholarships.push({ name: t });
        });
        break;
      } else if (scan[0].tagName === 'p') {
        const t = scan.text().trim();
        if (t.length > 30 && t.length < 400) scholarships.push({ name: ht, description: t });
      }
    }
  });

  return {
    slug, name: title, country, city,
    sourceUrl: url,
    programs: programs.slice(0, 80),
    scholarships: scholarships.slice(0, 10),
    description,
    logoUrl: logoAbs || undefined,
    gallery: [...new Set(gallery)].slice(0, 20),
    scrapedAt: new Date().toISOString(),
  };
}

const urls = await getUniUrls();
log(`found ${urls.length} uni URLs`);
const CONCURRENCY = 5;
let idx = 0, ok = 0, fail = 0, totalProg = 0;
async function worker() {
  while (idx < urls.length) {
    const i = idx++;
    const url = urls[i];
    try {
      const data = await scrapeUni(url);
      if (data && data.slug) {
        await fs.writeFile(path.join(OUT_DIR, data.slug + '.json'), JSON.stringify(data, null, 2));
        ok++; totalProg += data.programs.length;
        process.stderr.write(`[volk2] ${data.slug}: ${data.programs.length} progs\n`);
      } else { fail++; }
    } catch (e) { fail++; process.stderr.write(`[volk2] err: ${e.message}\n`); }
  }
}
await Promise.all(Array.from({length: CONCURRENCY}, () => worker()));
log(`DONE: ok=${ok}, fail=${fail}, totalPrograms=${totalProg}`);
console.log(JSON.stringify({ ok, fail, totalProg }));
