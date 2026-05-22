// Visual check: for each of 9 new unis, navigate to live page, scroll through
// hero + #living section, screenshot, and report broken images.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, 'visual-check-out');
await mkdir(OUT_DIR, { recursive: true });

const SLUGS = ['oxford', 'kent', 'dundee', 'ulster', 'bradford', 'abertay', 'bangor', 'de-montfort', 'greenwich'];
const BASE = 'https://studyroom-project-site.pages.dev';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

// Collect broken image events
const broken = [];
page.on('response', (r) => {
  const url = r.url();
  if (url.startsWith(BASE + '/photos/') && r.status() >= 400) {
    broken.push({ url, status: r.status() });
  }
});
page.on('pageerror', (e) => console.warn('  [pageerror]', e.message));

const report = [];
for (const slug of SLUGS) {
  broken.length = 0;
  const url = BASE + '/' + slug + '/';
  console.log('\n=== ' + slug + ' ===');
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

  // Hero screenshot (above the fold)
  await page.screenshot({ path: resolve(OUT_DIR, slug + '-1-hero.png'), clip: { x: 0, y: 0, width: 1440, height: 900 } });

  // Scroll to #living section if present
  const livingExists = await page.locator('#living').count();
  if (livingExists > 0) {
    await page.locator('#living').scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await page.screenshot({ path: resolve(OUT_DIR, slug + '-2-living.png'), fullPage: false });
  }

  // Inspect rendered <img> tags + background-image divs inside #living
  const livingPhotos = livingExists > 0 ? await page.evaluate(() => {
    const sec = document.getElementById('living');
    if (!sec) return null;
    const accomBg = Array.from(sec.querySelectorAll('.accom__img')).map(el => ({ kind: 'accom', bg: el.style.backgroundImage }));
    const campusBg = Array.from(sec.querySelectorAll('.camp__img')).map(el => ({ kind: 'campus', bg: el.style.backgroundImage }));
    const accomPlaceholders = sec.querySelectorAll('.accom__placeholder').length;
    const campusPlaceholders = sec.querySelectorAll('.camp__placeholder').length;
    return { accomBg, campusBg, accomPlaceholders, campusPlaceholders };
  }) : null;

  const heroBg = await page.evaluate(() => {
    const el = document.querySelector('.hero-bg, .hero__bg, [class*="hero"] [style*="background-image"]') || document.querySelector('[style*="background-image"]');
    return el ? el.getAttribute('style') : null;
  });

  const galleryImgs = await page.evaluate(() => Array.from(document.querySelectorAll('img[src*="/photos/"], [style*="/photos/"]')).map(el => ({ src: el.getAttribute('src') || el.getAttribute('style'), tag: el.tagName.toLowerCase() })));

  const r = {
    slug,
    pageStatus: 200,
    livingFound: livingExists > 0,
    accomWithImg: livingPhotos?.accomBg.length || 0,
    accomPlaceholders: livingPhotos?.accomPlaceholders || 0,
    campusWithImg: livingPhotos?.campusBg.length || 0,
    campusPlaceholders: livingPhotos?.campusPlaceholders || 0,
    galleryImgRefs: galleryImgs.length,
    broken: [...broken],
  };
  report.push(r);
  console.log(JSON.stringify({ ...r, broken: broken.length }, null, 0));
}

await browser.close();
console.log('\n=== SUMMARY ===');
console.log('| slug | accom imgs | accom placeholders | campus imgs | campus placeholders | broken |');
console.log('|------|-----------:|-------------------:|------------:|--------------------:|-------:|');
for (const r of report) {
  console.log('| ' + r.slug + ' | ' + r.accomWithImg + ' | ' + r.accomPlaceholders + ' | ' + r.campusWithImg + ' | ' + r.campusPlaceholders + ' | ' + r.broken.length + ' |');
}
const totalBroken = report.reduce((s, r) => s + r.broken.length, 0);
console.log('\nTotal broken image responses: ' + totalBroken);
if (totalBroken > 0) {
  console.log('Broken URLs:');
  for (const r of report) for (const b of r.broken) console.log('  [' + r.slug + '] ' + b.status + ' ' + b.url);
}
