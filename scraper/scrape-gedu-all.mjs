#!/usr/bin/env node
// scrape-gedu-all.mjs — GEDU Global meta-collector.
//
// GEDU.global is a HOLDING GROUP, not a course catalog: its own WP REST exposes
// only 1 `course` + 9 "Study in <country>" pages. The real programs/fees/photos/
// campus data live on each member-brand's OWN site. This collector enumerates the
// member brands and harvests four domains from each:
//   ПАУК   — programs (title/level/duration/intake)
//   СОРОКА — fees (feePerYear + currency)
//   ОРЁЛ   — photos (og:image + content images)
//   БОБР   — campus / accommodation text
//
// Strategy per brand (hybrid):
//   1. WP REST custom post type (programme/course) when the site exposes it.
//   2. else sitemap.xml -> course URLs -> per-page fetch (Playwright fallback
//      for Cloudflare / JS-rendered sites).
//
// Output:
//   scraper/sources/gedu-extracts/<catalogSlug>.json   (merge-programs format + photos/campus/accommodation)
//   site/src/content/universities/<catalogSlug>.json    (NEW brands only, when --create-cards and >=1 program)
//
// Usage:
//   node scraper/scrape-gedu-all.mjs [--brand=mla-college] [--limit=N] [--create-cards] [--no-playwright]
//
// Catalog-safe: never overwrites an existing uni card; extracts are additive.

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, 'sources', 'gedu-extracts');
const CARDS_DIR = path.join(__dirname, '..', 'site', 'src', 'content', 'universities');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const PAGE_TIMEOUT = 15000;

const arg = (k) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : null; };
const flag = (k) => process.argv.includes(`--${k}`);
const ONLY_BRAND = arg('brand');
const LIMIT = arg('limit') ? parseInt(arg('limit'), 10) : 60;       // courses per brand
const CREATE_CARDS = flag('create-cards');
const CARDS_ONLY = flag('cards-only'); // rebuild cards from existing extracts, no scraping
const USE_PLAYWRIGHT = !flag('no-playwright') && !flag('cards-only');
const log = (...a) => process.stderr.write(`[gedu] ${new Date().toISOString().slice(11, 19)} ${a.join(' ')}\n`);

// ---- member-brand registry (discovered from gedu.global homepage, 2026-06-09) ----
// catalogSlug: existing studyroom slug (enrich) or new slug (created when --create-cards).
// feeCurrency: enum-supported currency for tuition; null => do not emit fees (avoid mislabelling).
const BRANDS = [
  { domain: 'globalbanking.ac.uk', name: 'Global Banking School', catalogSlug: 'global-banking-school',           country: 'United Kingdom',        city: 'London',     feeCurrency: 'GBP', isNew: false },
  { domain: 'gbs.edu.mt',          name: 'GBS Malta',             catalogSlug: 'gbs-malta',                        country: 'Malta',                 city: 'Valletta',   feeCurrency: 'EUR', isNew: false },
  { domain: 'gbs.ac.ae',           name: 'GBS Dubai',             catalogSlug: 'gbs-dubai',                        country: 'United Arab Emirates',  city: 'Dubai',      feeCurrency: null,  isNew: false }, // AED not in tuition enum
  { domain: 'schiller.edu',        name: 'Schiller International University', catalogSlug: 'schiller-international-university', country: 'United States', city: 'Tampa', feeCurrency: 'USD', isNew: false },
  { domain: 'mla.ac.uk',           name: 'MLA College',           catalogSlug: 'mla-college',                      country: 'United Kingdom',        city: 'Plymouth',   feeCurrency: 'GBP', isNew: true,  restCpt: 'programme' },
  { domain: 'englishpath.com',     name: 'EnglishPath',           catalogSlug: 'englishpath',                      country: 'United Kingdom',        city: 'Manchester', feeCurrency: 'GBP', isNew: true },
  { domain: 'apac.edu.au',         name: 'APAC',                  catalogSlug: 'apac',                             country: 'Australia',             city: 'Sydney',     feeCurrency: 'AUD', isNew: true },
  { domain: 'ema.education',       name: 'EMA',                   catalogSlug: 'ema',                              country: 'France',                city: 'Paris',      feeCurrency: 'EUR', isNew: true },
];

const PROG_MARKERS = /\b(BSc|BA|BEng|BBA|MSc|MA|MBA|MEng|MRes|LLB|LLM|PhD|Bachelor|Master|Foundation|Diploma|Certificate|Pre-?Master|Pre-?Sessional|Doctor)\b/i;

function slugify(s) {
  return (s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/&[a-z]+;/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function clean(s) { return (s || '').replace(/<[^>]+>/g, '').replace(/&#0?38;|&amp;/g, '&').replace(/&[a-z0-9#]+;/g, ' ').replace(/\s+/g, ' ').trim(); }

function guessLevel(title) {
  const t = ` ${title.toLowerCase()} `;
  if (/\b(phd|doctor|doctorate|dba)\b/.test(t)) return 'phd';
  if (/\b(msc|mba|meng|mres|llm|ma\b|master|pre.?master)\b/.test(t)) return 'master';
  if (/\b(bsc|ba\b|beng|bba|llb|bachelor|honours|hons)\b/.test(t)) return 'bachelor';
  if (/\b(foundation|year one|year 0|pathway)\b/.test(t)) return 'foundation';
  if (/\b(english|esol|ielts|pre.?sessional|language)\b/.test(t)) return 'english-language';
  if (/\b(diploma|certificate|short course|cpd)\b/.test(t)) return 'short-course';
  return null;
}
const DUR_DEFAULT = { phd: 3, master: 1, bachelor: 3, foundation: 1, 'english-language': 0.5, 'short-course': 0.5 };
function guessDuration(text, level) {
  const m = (text || '').match(/(\d+(?:\.\d+)?)\s*(year|yr|month|week)/i);
  if (m) { const n = parseFloat(m[1]); const u = m[2].toLowerCase();
    if (u.startsWith('year') || u === 'yr') return n;
    if (u.startsWith('month')) return Math.max(0.1, +(n / 12).toFixed(2));
    if (u.startsWith('week')) return Math.max(0.1, +(n / 52).toFixed(2)); }
  return DUR_DEFAULT[level] || 1;
}
const CUR_SIGN = { '£': 'GBP', '€': 'EUR', '$': 'USD', 'A$': 'AUD' };
function extractFee(text, feeCurrency) {
  if (!feeCurrency) return null;
  // look for an amount near fee/tuition keywords
  const re = /(?:tuition|tuition\s+fee|fee[s]?|cost|price|per\s+year|annual)[^£€$\d]{0,40}([£€$])\s?([\d][\d,]{2,7})/i;
  const m = (text || '').match(re);
  if (!m) return null;
  if (CUR_SIGN[m[1]] !== feeCurrency) return null; // currency sign must match brand currency
  const n = parseInt(m[2].replace(/,/g, ''), 10);
  return n >= 1000 && n <= 200000 ? n : null;
}
function extractOgImage(html) {
  const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  return m ? m[1] : null;
}
function extractImages(html, base, max = 8) {
  const out = new Set();
  for (const m of html.matchAll(/<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?)["']/gi)) {
    try { const u = new URL(m[1], base).href;
      if (!/logo|icon|sprite|placeholder|avatar|favicon|\.svg/i.test(u)) out.add(u);
    } catch {}
    if (out.size >= max) break;
  }
  return [...out];
}
function extractCampusAccommodation(html) {
  const paras = [];
  for (const m of html.matchAll(/<p[^>]*>([\s\S]{40,500}?)<\/p>/gi)) {
    const t = clean(m[1]);
    if (t.length >= 40) paras.push(t);
  }
  const campus = paras.filter(p => /\bcampus|library|facilit|located in|city centre|building\b/i.test(p)).slice(0, 3);
  const accommodation = paras.filter(p => /\baccommodation|housing|residence|halls|dormitor|student living\b/i.test(p)).slice(0, 3);
  return { campus, accommodation };
}

async function fetchText(url, browser) {
  // try plain fetch first
  try {
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), PAGE_TIMEOUT);
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml' }, redirect: 'follow', signal: ac.signal });
    clearTimeout(t);
    if (r.ok) { const html = await r.text(); if (html.length > 800 && !/just a moment|cf-browser-verification|enable javascript/i.test(html.slice(0, 2000))) return { html, finalUrl: r.url }; }
  } catch {}
  // Playwright fallback (Cloudflare / JS)
  if (browser) {
    try {
      const page = await browser.newPage({ userAgent: UA });
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(1200);
      const html = await page.content(); const finalUrl = page.url();
      await page.close();
      return { html, finalUrl };
    } catch {}
  }
  return null;
}

async function discoverViaSitemap(domain, browser) {
  const urls = new Set();
  const maps = ['/sitemap.xml', '/wp-sitemap.xml', '/sitemap_index.xml', '/sitemap-index.xml', '/page-sitemap.xml', '/course-sitemap.xml', '/courses-sitemap.xml', '/programme-sitemap.xml'];
  const queue = maps.map(m => `https://${domain}${m}`);
  const seenMaps = new Set();
  while (queue.length && urls.size < 400) {
    const u = queue.shift(); if (seenMaps.has(u)) continue; seenMaps.add(u);
    const res = await fetchText(u, browser); if (!res) continue;
    for (const m of res.html.matchAll(/<loc>([^<]+)<\/loc>/gi)) {
      const loc = m[1].trim();
      if (/sitemap.*\.xml$/i.test(loc) && seenMaps.size < 30) { queue.push(loc); continue; }
      if (/\/(course|courses|programme|programmes|program|programs|study|degree)s?\//i.test(loc)) urls.add(loc);
    }
  }
  return [...urls];
}

async function discoverViaListing(domain, browser) {
  const urls = new Set();
  for (const sub of ['/courses/', '/courses', '/programmes/', '/our-courses/', '/study/', '/programs/', '/course-listing-page/']) {
    const res = await fetchText(`https://${domain}${sub}`, browser); if (!res) continue;
    for (const m of res.html.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)) {
      try { const u = new URL(m[1], `https://${domain}`);
        if (u.hostname.includes(domain.replace(/^www\./, '')) && /\/(course|programme|program|degree)s?\//i.test(u.pathname) && u.pathname.split('/').filter(Boolean).length >= 2)
          urls.add(u.href.split('#')[0].split('?')[0]);
      } catch {}
    }
    if (urls.size > 0) break;
  }
  return [...urls];
}

async function harvestViaRest(brand, browser) {
  const cpt = brand.restCpt;
  const programs = []; const photos = new Set();
  let page = 1, pages = 1;
  do {
    const res = await fetchText(`https://${brand.domain}/wp-json/wp/v2/${cpt}?per_page=100&page=${page}&_embed=1`, browser);
    if (!res) break;
    let data; try { data = JSON.parse(res.html.replace(/^[^[{]*/, '')); } catch { break; }
    if (!Array.isArray(data) || !data.length) break;
    for (const it of data) {
      const title = clean(it.title?.rendered || '');
      if (!title) continue;
      const body = clean(it.content?.rendered || '') + ' ' + clean(it.excerpt?.rendered || '');
      const level = guessLevel(title) || guessLevel(body) || 'short-course';
      const fee = extractFee(body, brand.feeCurrency);
      programs.push({ title, level, duration: guessDuration(body, level), intake: [], programUrl: it.link || `https://${brand.domain}`, feePerYear: fee, currency: fee ? brand.feeCurrency : null });
      const img = it._embedded?.['wp:featuredmedia']?.[0]?.source_url; if (img) photos.add(img);
    }
    pages = parseInt(res.headers?.['x-wp-totalpages'] || '1', 10) || 1; // header not captured here; bounded by data length
    page++;
    if (data.length < 100) break;
  } while (page <= pages && page <= 6);
  return { programs, photos: [...photos], campus: [], accommodation: [] };
}

async function harvestViaPages(brand, browser) {
  let urls = await discoverViaSitemap(brand.domain, browser);
  if (!urls.length) urls = await discoverViaListing(brand.domain, browser);
  urls = [...new Set(urls)].slice(0, LIMIT);
  log(`  ${brand.catalogSlug}: ${urls.length} course URLs`);
  const programs = []; const photos = new Set(); let campus = []; let accommodation = [];
  const seenTitle = new Set();
  for (let i = 0; i < urls.length; i++) {
    const res = await fetchText(urls[i], browser); if (!res) continue;
    const html = res.html;
    const titleRaw = (html.match(/<h1[^>]*>([\s\S]{3,200}?)<\/h1>/i) || [])[1] || (html.match(/<title>([^<]+)<\/title>/i) || [])[1] || '';
    const title = clean(titleRaw).replace(/\s*[|\-–]\s*[^|\-–]*$/, '').trim() || clean(titleRaw);
    if (!title || title.length < 4 || !PROG_MARKERS.test(title) || seenTitle.has(title)) {
      // still mine media/campus from listing-ish pages but skip as program
    } else {
      seenTitle.add(title);
      const level = guessLevel(title) || 'short-course';
      const fee = extractFee(html, brand.feeCurrency);
      programs.push({ title, level, duration: guessDuration(html, level), intake: [], programUrl: res.finalUrl || urls[i], feePerYear: fee, currency: fee ? brand.feeCurrency : null });
    }
    const og = extractOgImage(html); if (og) photos.add(og);
    for (const im of extractImages(html, urls[i])) photos.add(im);
    if (campus.length < 3 || accommodation.length < 3) {
      const ca = extractCampusAccommodation(html);
      campus = [...new Set([...campus, ...ca.campus])].slice(0, 3);
      accommodation = [...new Set([...accommodation, ...ca.accommodation])].slice(0, 3);
    }
    if (photos.size >= 16) {/* enough for ОРЁЛ */}
  }
  return { programs, photos: [...photos].slice(0, 16), campus, accommodation };
}

async function buildCard(brand, extract) {
  // Minimal valid universitySchema card for a NEW brand. Auto-data → confidence 'aggregator'.
  const now = new Date().toISOString();
  const seen = new Set();
  const programs = extract.programs.map((p, i) => {
    let s = slugify(`${brand.catalogSlug}-${p.title}-${p.level}`) || `${brand.catalogSlug}-program-${i}`;
    while (seen.has(s)) s = `${s}-2`; seen.add(s);
    const prog = { slug: s, title: p.title, durationYears: p.duration > 0 ? p.duration : 1, level: p.level, language: 'en', intakes: p.intake?.length ? p.intake : undefined, programType: 'degree', source: 'gedu', confidence: 0.55, checkedAt: now };
    if (p.programUrl && /^https?:\/\//.test(p.programUrl)) prog.programUrl = p.programUrl;
    return prog;
  }).filter(p => p.title);
  if (!programs.length) return null;
  const byProgram = {};
  for (let i = 0; i < programs.length; i++) {
    const f = extract.programs[i]?.feePerYear;
    if (typeof f === 'number' && f > 0 && brand.feeCurrency) byProgram[programs[i].slug] = f;
  }
  const card = {
    slug: brand.catalogSlug,
    name: brand.name,
    country: brand.country,
    city: brand.city,
    programs,
    tuition: { currency: brand.feeCurrency || 'USD', byProgram },
    deadlines: {},
    requirements: { exams: [] },
    scholarships: [],
    lastChecked: now,
    sourceUrl: `https://${brand.domain}`,
    sourceHash: `gedu-${brand.catalogSlug}-${now.slice(0, 10)}`,
    confidence: 'aggregator',
    language: 'en',
  };
  if (extract.photos?.length) card.gallery = { items: extract.photos.slice(0, 10).map(img => ({ img })) };
  if (extract.accommodation?.length) card.accommodation = extract.accommodation.map(text => ({ name: brand.name + ' accommodation', text, source: 'gedu', confidence: 0.5 }));
  if (extract.campus?.length) card.campuses = extract.campus.map(text => ({ title: brand.city, text, source: 'gedu', confidence: 0.5 }));
  return card;
}

// ---- main ----
await fs.mkdir(OUT_DIR, { recursive: true });
let browser = null;
if (USE_PLAYWRIGHT) {
  try { const { chromium } = await import('playwright'); browser = await chromium.launch({ headless: true }); log('Playwright ready'); }
  catch (e) { log('WARN: Playwright unavailable -> fetch-only', e.message?.slice(0, 80)); }
}

const targets = BRANDS.filter(b => !ONLY_BRAND || b.catalogSlug === ONLY_BRAND);
const summary = [];
for (const brand of targets) {
  log(`brand: ${brand.name} (${brand.domain}) isNew=${brand.isNew}${CARDS_ONLY ? ' [cards-only]' : ''}`);
  let extract;
  if (CARDS_ONLY) {
    try { extract = JSON.parse(await fs.readFile(path.join(OUT_DIR, `${brand.catalogSlug}.json`), 'utf8')); }
    catch { log(`  no extract on disk -> skip ${brand.catalogSlug}`); continue; }
  } else {
    let data;
    try {
      data = brand.restCpt ? await harvestViaRest(brand, browser) : await harvestViaPages(brand, browser);
      if (brand.restCpt && data.programs.length === 0) { log(`  REST empty -> pages fallback`); data = await harvestViaPages(brand, browser); }
    } catch (e) { log(`  ERROR ${brand.catalogSlug}: ${e.message}`); data = { programs: [], photos: [], campus: [], accommodation: [] }; }
    extract = {
      slug: brand.catalogSlug, name: brand.name, source: 'gedu', sourceUrl: `https://${brand.domain}`,
      scrapedAt: new Date().toISOString(), currency: brand.feeCurrency || null,
      programs: data.programs, photos: data.photos, campus: data.campus, accommodation: data.accommodation,
    };
    await fs.writeFile(path.join(OUT_DIR, `${brand.catalogSlug}.json`), JSON.stringify(extract, null, 2) + '\n');
  }
  const data = extract;

  let cardCreated = false;
  if (brand.isNew && CREATE_CARDS && data.programs.length) {
    const cardPath = path.join(CARDS_DIR, `${brand.catalogSlug}.json`);
    let exists = false; try { await fs.access(cardPath); exists = true; } catch {}
    if (exists) { log(`  card exists -> NOT overwriting ${brand.catalogSlug}.json`); }
    else { const card = await buildCard(brand, extract); if (card) { await fs.writeFile(cardPath, JSON.stringify(card, null, 2) + '\n'); cardCreated = true; } }
  }
  const fees = data.programs.filter(p => typeof p.feePerYear === 'number').length;
  summary.push({ brand: brand.catalogSlug, isNew: brand.isNew, programs: data.programs.length, fees, photos: data.photos.length, campus: data.campus.length, accom: data.accommodation.length, cardCreated });
  log(`  -> programs=${data.programs.length} fees=${fees} photos=${data.photos.length} campus=${data.campus.length} accom=${data.accommodation.length} card=${cardCreated}`);
}

if (browser) await browser.close();
console.log(JSON.stringify({ ok: true, brands: summary.length,
  totalPrograms: summary.reduce((s, r) => s + r.programs, 0),
  totalFees: summary.reduce((s, r) => s + r.fees, 0),
  cardsCreated: summary.filter(r => r.cardCreated).length, summary }, null, 2));
process.exit(0);
