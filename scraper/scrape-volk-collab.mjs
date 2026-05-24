#!/usr/bin/env node
// ВОЛК — collabinternational.com scraper
// Discovers ~80-100 unis from sitemap, scrapes per-uni pages for programs/scholarships/fees/description

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
const log = (...a) => console.error('[volk]', new Date().toISOString().slice(11,19), ...a);

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
    if (p.length < 8) return false;
    if (/^\/business-ad-/.test(p)) return false;
    return /^\/[a-z][a-z0-9-]+$/.test(p);
  });
}

async function scrapeUni(url) {
  const html = await fetchOk(url);
  if (!html) return null;
  const $ = cheerio.load(html);
  const title = $('h1').first().text().trim() || $('title').first().text().split('|')[0].split('-')[0].trim();
  if (!title) return null;
  const slug = slugify(title);

  const bodyText = $('body').text();
  const countryMatch = bodyText.match(/\b(United Kingdom|UK|USA|United States|Canada|Australia|Germany|France|Spain|Italy|Ireland|Netherlands|Turkey|Hungary|Finland|Denmark|Sweden|Norway|Czech Republic|Czechia|Poland|Lithuania|Cyprus|Switzerland|Malaysia|UAE)\b/i);
  const country = countryMatch ? countryMatch[0] : '';
  const cityMatch = bodyText.match(/\b(London|Manchester|Birmingham|Dublin|Amsterdam|Berlin|Munich|Paris|Madrid|Barcelona|Rome|Milan|Helsinki|Copenhagen|Budapest|Prague|Warsaw|Istanbul|Ankara|Boston|New York|Toronto|Vancouver|Sydney|Melbourne)\b/);
  const city = cityMatch ? cityMatch[0] : '';

  const programs = [];
  const seenProg = new Set();
  $('a, h2, h3, h4, li, div').each((_, el) => {
    const t = $(el).text().trim().split('\n')[0].trim();
    if (!t || t.length < 8 || t.length > 200) return;
    if (!/(BSc|BA|BEng|BBA|BS|BCom|BFA|LLB|MSc|MA|MBA|MEng|MRes|MPhil|MArch|MFA|EMBA|LLM|PhD|DPhil|Bachelor|Master|Foundation|Diploma|Certificate|Doctorate)\b/i.test(t)) return;
    if (/why-study|how-to-apply|requirements|click-here|read more/i.test(t)) return;
    const key = t.toLowerCase();
    if (seenProg.has(key)) return;
    seenProg.add(key);
    programs.push({ title: t });
  });

  const scholarships = [];
  $('h2, h3, h4').each((_, el) => {
    const t = $(el).text().trim();
    if (/scholarship|bursary|grant|funding/i.test(t) && t.length > 8 && t.length < 200) {
      const desc = $(el).nextAll().slice(0,2).text().trim().slice(0,400);
      scholarships.push({ name: t, description: desc });
    }
  });

  const description = $('p').first().text().trim().slice(0, 1500);

  const logo = $('header img, .logo img, img[alt*="logo" i]').first().attr('src') || '';
  const logoAbs = logo ? (() => { try { return new URL(logo, url).toString(); } catch { return logo; } })() : '';

  const gallery = [];
  $('img').each((_, el) => {
    const src = $(el).attr('src');
    if (!src || src.startsWith('data:') || /logo|icon|avatar|favicon/i.test(src)) return;
    try { gallery.push(new URL(src, url).toString()); } catch {}
  });

  return {
    slug,
    name: title,
    country, city,
    sourceUrl: url,
    programs: programs.slice(0, 60),
    scholarships,
    description,
    logoUrl: logoAbs || undefined,
    gallery: [...new Set(gallery)].slice(0, 20),
    scrapedAt: new Date().toISOString(),
  };
}

const urls = await getUniUrls();
log(`found ${urls.length} uni URLs from sitemap`);
await fs.writeFile(path.join(OUT_DIR, '_urls.txt'), urls.join('\n'));

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
        process.stderr.write(`[volk] ${data.slug}: ${data.programs.length} programs\n`);
      } else { fail++; }
    } catch (e) { fail++; process.stderr.write(`[volk] err: ${e.message}\n`); }
  }
}
await Promise.all(Array.from({length: CONCURRENCY}, () => worker()));
log(`DONE: ok=${ok}, fail=${fail}, totalPrograms=${totalProg}`);
console.log(JSON.stringify({ ok, fail, totalProg }));
