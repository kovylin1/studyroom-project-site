#!/usr/bin/env node
// discover-logos.mjs — находит лого вузов с их официального сайта и проставляет
// поле logoUrl (как у aberystwyth: прямая ссылка на иконку офсайта).
//
// Источник (в порядке приоритета):
//   1. <link rel="apple-touch-icon">  — самый крупный по sizes (как aber.ac.uk)
//   2. <link rel="icon"> / "shortcut icon" — предпочитаем .png и крупные
//   3. og:image (только если похоже на лого: содержит logo/icon/brand в URL)
//   4. probe /apple-touch-icon.png, затем /favicon.ico
//
// НЕ трогает вузы, у которых logoUrl уже есть. Валидирует, что ссылка отдаёт
// картинку (HTTP 200 + content-type image) перед записью.
//
// Usage:
//   node scraper/discover-logos.mjs                 # все без logoUrl
//   node scraper/discover-logos.mjs --slug=abertay  # один вуз
//   node scraper/discover-logos.mjs --limit=20      # первые N
//   node scraper/discover-logos.mjs --dry-run       # без записи
//   node scraper/discover-logos.mjs --force         # переписать существующие

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const UNI_DIR = path.join(PROJECT_ROOT, 'site/src/content/universities');

const arg = (p) => (process.argv.find(a => a.startsWith(p)) || '').slice(p.length) || null;
const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');
const SLUG = arg('--slug=');
const LIMIT = arg('--limit=') ? parseInt(arg('--limit='), 10) : Infinity;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0';
const CONCURRENCY = 10;

const log = (...a) => process.stderr.write(`[logos] ${a.join(' ')}\n`);

// Домены агрегаторов — их origin НЕ берём как официальный сайт.
const AGGREGATOR_DOMAINS = [
  'edvoy.com', 'collabinternational.com', 'studygroup.com', 'studygroup.co.uk',
  'navitas.com', 'kaplanpathways.com', 'kaplan.co.uk', 'qahighereducation.com',
  'oxfordinternational.com', 'iapro.com', 'iapro.co.uk', 'gedu.global',
  'topuniversities.com', 'catsglobalschools.com', 'wikipedia.org',
];

function getOfficialRoot(uni) {
  const cands = [uni.officialUrl, uni.sourceUrl, ...(uni.programs || []).map(p => p.programUrl)].filter(Boolean);
  for (const u of cands) {
    try {
      const url = new URL(u);
      if (!AGGREGATOR_DOMAINS.some(d => url.host.includes(d))) return url.origin;
    } catch { /* skip */ }
  }
  return null;
}

// Индекс по extracts: для вузов без офсайта в каталоге достаём официальный
// домен (поле website) и запасной logoUrl (лого агрегатора) по имени вуза.
const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const EXTRACT_DIRS = [
  path.join(PROJECT_ROOT, 'sources/edvoy-extracts'),
  path.join(PROJECT_ROOT, 'sources/collab-extracts'),
  path.join(PROJECT_ROOT, 'sources/studygroup-extracts'),
  path.join(PROJECT_ROOT, 'sources/direct-partners-extracts'),
  path.join(__dirname, 'sources/official-extracts'),
  path.join(__dirname, 'sources/kaplan-extracts'),
  path.join(__dirname, 'sources/qahe-extracts'),
];

async function buildExtractIndex() {
  const map = new Map(); // norm(name) -> { website, logoUrl }
  for (const dir of EXTRACT_DIRS) {
    let files;
    try { files = await fs.readdir(dir); } catch { continue; }
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      let j;
      try { j = JSON.parse(await fs.readFile(path.join(dir, f), 'utf8')); } catch { continue; }
      const key = norm(j.name);
      if (!key) continue;
      const website = j.website && /^https?:\/\//.test(j.website) ? j.website : null;
      const prev = map.get(key);
      // Предпочитаем запись с website; logoUrl сохраняем как запасной.
      if (!prev) map.set(key, { website, logoUrl: j.logoUrl || null });
      else {
        if (!prev.website && website) prev.website = website;
        if (!prev.logoUrl && j.logoUrl) prev.logoUrl = j.logoUrl;
      }
    }
  }
  return map;
}

async function fetchText(url, ms = 9000) {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms);
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: ac.signal, redirect: 'follow' });
    clearTimeout(t);
    return { status: r.status, ok: r.ok, html: r.ok ? await r.text() : '', finalUrl: r.url };
  } catch { return { status: 0, ok: false, html: '', finalUrl: url }; }
}

// Проверяем, что URL реально отдаёт картинку.
async function isImage(url, ms = 8000) {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms);
    const r = await fetch(url, { method: 'GET', headers: { 'User-Agent': UA, Range: 'bytes=0-0' }, signal: ac.signal, redirect: 'follow' });
    clearTimeout(t);
    if (!r.ok && r.status !== 206) return false;
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    return ct.startsWith('image/') || /\.(png|jpg|jpeg|svg|ico|webp)(\?|$)/i.test(url);
  } catch { return false; }
}

function sizeScore(sizes) {
  if (!sizes) return 0;
  const m = String(sizes).match(/(\d+)x(\d+)/i);
  return m ? parseInt(m[1], 10) : 0;
}

// Собираем кандидатов из HTML в порядке приоритета.
function collectCandidates(html, baseUrl) {
  const $ = cheerio.load(html);
  const abs = (href) => { try { return new URL(href, baseUrl).href; } catch { return null; } };
  const apple = [];
  const icons = [];

  $('link[rel]').each((_, el) => {
    const rel = ($(el).attr('rel') || '').toLowerCase();
    const href = $(el).attr('href');
    if (!href) return;
    const u = abs(href);
    if (!u) return;
    if (rel.includes('apple-touch-icon')) apple.push({ u, score: sizeScore($(el).attr('sizes')) || 152 });
    else if (rel.includes('icon')) icons.push({ u, score: sizeScore($(el).attr('sizes')) + (/\.png(\?|$)/i.test(u) ? 50 : 0) });
  });

  const og = $('meta[property="og:image"]').attr('content') || $('meta[name="og:image"]').attr('content');
  const ogU = og ? abs(og) : null;

  apple.sort((a, b) => b.score - a.score);
  icons.sort((a, b) => b.score - a.score);

  const out = [...apple.map(x => x.u), ...icons.map(x => x.u)];
  // og:image — только если выглядит как лого (иначе это hero-фото)
  if (ogU && /logo|icon|brand|favicon|mark/i.test(ogU)) out.push(ogU);
  return [...new Set(out)];
}

async function discoverLogo(root) {
  const home = await fetchText(root);
  let candidates = [];
  if (home.ok) candidates = collectCandidates(home.html, home.finalUrl || root);
  // Фолбэк-пробы стандартных путей
  candidates.push(new URL('/apple-touch-icon.png', root).href);
  candidates.push(new URL('/apple-touch-icon-precomposed.png', root).href);
  candidates.push(new URL('/favicon.ico', root).href);

  for (const c of [...new Set(candidates)]) {
    if (await isImage(c)) return c;
  }
  return null;
}

// ── main ────────────────────────────────────────────────────────────────────

let files = (await fs.readdir(UNI_DIR)).filter(f => f.endsWith('.json'));
if (SLUG) files = files.filter(f => f === `${SLUG}.json`);

const targets = [];
for (const f of files) {
  const u = JSON.parse(await fs.readFile(path.join(UNI_DIR, f), 'utf8'));
  if (u.logoUrl && !FORCE) continue;
  targets.push({ f, slug: f.replace('.json', '') });
}
const work = isFinite(LIMIT) ? targets.slice(0, LIMIT) : targets;
const EXTRACT_INDEX = await buildExtractIndex();
log(`targets without logo: ${targets.length}, processing ${work.length}, extract index: ${EXTRACT_INDEX.size}`);

const stats = { found: 0, fromExtractSite: 0, fromExtractLogo: 0, noSite: 0, noLogo: 0 };
let idx = 0;

async function worker() {
  while (idx < work.length) {
    const it = work[idx++];
    const fpath = path.join(UNI_DIR, it.f);
    let u;
    try { u = JSON.parse(await fs.readFile(fpath, 'utf8')); } catch { continue; }

    let root = getOfficialRoot(u);
    const ext = EXTRACT_INDEX.get(norm(u.name));
    let viaExtract = false;
    // Нет офсайта в каталоге — берём официальный домен из extracts (website).
    if (!root && ext?.website) {
      try { root = new URL(ext.website).origin; viaExtract = true; } catch { /* skip */ }
    }
    if (!root && !ext?.logoUrl) { stats.noSite++; log(`- ${it.slug}: no official site`); continue; }

    let logo = root ? await discoverLogo(root) : null;
    // Запасной вариант — готовый logoUrl агрегатора (edvoy/collab), но только
    // если это абсолютный http(s)-URL и реально картинка (НЕ относительный путь
    // вроде live/images/...svg, который на нашем сайте битый).
    if (!logo && ext?.logoUrl && /^https?:\/\//.test(ext.logoUrl) && await isImage(ext.logoUrl)) {
      logo = ext.logoUrl; stats.fromExtractLogo++;
    } else if (logo && viaExtract) stats.fromExtractSite++;

    if (!logo) { stats.noLogo++; log(`- ${it.slug}: no logo found (${root})`); continue; }
    stats.found++;
    log(`✓ ${it.slug}: ${logo}${viaExtract ? ' (via extract site)' : ''}`);
    if (!DRY_RUN) {
      u.logoUrl = logo;
      await fs.writeFile(fpath, JSON.stringify(u, null, 2) + '\n');
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
log(`DONE: found=${stats.found}, noSite=${stats.noSite}, noLogo=${stats.noLogo}, dryRun=${DRY_RUN}`);
console.log(JSON.stringify({ script: 'discover-logos', processed: work.length, ...stats, dryRun: DRY_RUN }));
