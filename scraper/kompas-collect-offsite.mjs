#!/usr/bin/env node
// Сбор с офсайтов того, чего нет у QS: длительности курса и города вуза.
// Пишет ВЫГРУЗКУ (sources/kompas/offsite/<slug>.json), а не карточку каталога.
// Заведение карточки — отдельный шаг: там нужно свести выгрузку с программами QS
// (цена берётся у QS) и получить ответ оператора по программам без длительности.
//
// Разборщик у каждого вуза свой: замер (sources/kompas/QS-NEW-CARDS-MARKUP.md)
// показал, что общей разметки у сайтов нет.
//
// ПРАВИЛО: длительность, которой на странице нет, НЕ выводится из уровня и не
// считается из кредитов. Такая программа уезжает в выгрузку с durationYears: null
// и признаком durationSource: null — дальше её разбирает оператор в /manager.
//
// Usage:
//   node scraper/kompas-collect-offsite.mjs --slug=falmouth
//   node scraper/kompas-collect-offsite.mjs --slug=worcester --limit=20
//   node scraper/kompas-collect-offsite.mjs                     # все настроенные

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUTDIR = path.join(ROOT, 'sources/kompas/offsite');
const LOG = path.join(ROOT, 'sources/kompas/offsite-collect.log');

const arg = (p) => (process.argv.find((a) => a.startsWith(p)) || '').slice(p.length);
const ONLY = arg('--slug=') || null;
const LIMIT = parseInt(arg('--limit=') || '400', 10);

// Степень в тексте ссылки — тоже признак курса: у Falmouth адреса вида /courses/<слаг>
// покрывают не весь список.
const DEGREE_LINK = /\b(BA|BSc|BEng|BBA|LLB|MA|MSc|MEng|MBA|LLM|MRes|MFA|PhD|MPhil|DipHE|FdA|FdSc|Bachelor|Master|Foundation|Diploma|Certificate)\b/i;

const WORD_NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 };

const log = (m) => {
  const line = `[офсайт ${new Date().toISOString().slice(11, 19)}] ${m}`;
  process.stdout.write(line + '\n');
  try { fs.appendFileSync(LOG, line + '\n'); } catch {}
};

// «3 years», «three year», «18 months». Возвращает годы либо null.
export function yearsFrom(text) {
  const m = String(text || '').match(/\b(\d(?:\.\d)?|one|two|three|four|five|six|seven)[\s-]?(year|yr|month)s?\b/i);
  if (!m) return null;
  const n = WORD_NUM[m[1].toLowerCase()] ?? Number(m[1]);
  if (!Number.isFinite(n) || n <= 0 || n > 12) return null;
  return /month/i.test(m[2]) ? Number((n / 12).toFixed(2)) : n;
}

// «3 years / 4 years» у Falmouth — это курс без года практики и с ним.
// В карточку идёт базовый срок; второй остаётся в сыром виде для оператора.
export function baseYears(raw) {
  const all = [...String(raw || '').matchAll(/\b(\d(?:\.\d)?|one|two|three|four|five|six|seven)[\s-]?(year|yr|month)s?\b/gi)]
    .map((m) => {
      const n = WORD_NUM[m[1].toLowerCase()] ?? Number(m[1]);
      if (!Number.isFinite(n) || n <= 0 || n > 12) return null;
      return /month/i.test(m[2]) ? Number((n / 12).toFixed(2)) : n;
    })
    .filter((x) => x !== null);
  return all.length ? Math.min(...all) : null;
}

// Куки-баннер у Falmouth перехватывает и заголовок, и «Course duration»:
// в его таблице стоят сроки хранения куков («1 year 2 years 3 years»).
// Без этого клика собирается мусор — проверено на первом прогоне.
const COOKIE_BUTTONS = [
  '#onetrust-accept-btn-handler',
  'button#ccc-recommended-settings',
  'button:has-text("Accept all")',
  'button:has-text("Accept All")',
  'button:has-text("accept cookie policy")',
  'button:has-text("Accept")',
  'a:has-text("Accept all cookies")',
];

async function dismissCookies(page) {
  for (const sel of COOKIE_BUTTONS) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 500 })) { await el.click({ timeout: 2000 }); await page.waitForTimeout(500); break; }
    } catch { /* кнопки нет — идём дальше */ }
  }
  // Кнопку согласия зовут у всех по-своему, поэтому баннер ещё и вырезается из DOM:
  // иначе его заголовок становится заголовком курса, а таблица сроков хранения
  // куков («1 year 2 years 3 years») — длительностью курса.
  await page.evaluate(() => {
    const sels = ['#ccc', '#ccc-overlay', '#onetrust-consent-sdk', '#cookie-banner', '.cookie-banner',
      '[id*="cookie" i][class*="banner" i]', '[class*="cookie-consent" i]', '[aria-label*="cookie" i]'];
    for (const s of sels) document.querySelectorAll(s).forEach((el) => el.remove());
  }).catch(() => {});
  return true;
}

const LEVEL_BY_TITLE = [
  [/\b(PhD|DPhil|Doctor(?:ate|al)|MPhil)\b/i, 'phd'],
  [/\b(MA|MSc|MBA|MEng|LLM|MRes|MFA|Master)\b/i, 'master'],
  [/\b(Foundation|Int(?:egrated)? Foundation|Pre-degree)\b/i, 'foundation'],
  [/\b(BA|BSc|BEng|BBA|LLB|Bachelor|Hons)\b/i, 'bachelor'],
  [/\b(DipHE|FdA|FdSc|Diploma)\b/i, 'diploma'],
  [/\b(Certificate|Cert)\b/i, 'certificate'],
];
const levelFromTitle = (t) => (LEVEL_BY_TITLE.find(([re]) => re.test(t || '')) || [null, null])[1];

const SITES = {
  falmouth: {
    name: 'Falmouth University',
    // Списки курсов: бакалавриат и магистратура отдельными страницами.
    lists: ['https://www.falmouth.ac.uk/courses/undergraduate', 'https://www.falmouth.ac.uk/courses/postgraduate'],
    host: 'falmouth.ac.uk',
    courseLink: /^\/courses\/[a-z0-9-]{4,}/i,
    // Разделы списка живут по тем же адресам, что и курсы, но на них стоит
    // фильтр «Course duration» с вариантами — он читается как длительность курса.
    skipLink: /^\/courses\/(undergraduate|postgraduate|online|short-courses|degree-apprenticeships|foundation-year)\/?$/i,
    contact: 'https://www.falmouth.ac.uk/contact',
    // «Course duration 3 years / 4 years» лежит парой в блоке ключевых фактов.
    parse: async (page) => page.evaluate(() => {
      const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
      // Баннер согласия (#ccc) пересобирается после удаления, поэтому проще
      // не читать его вовсе: его заголовок иначе становится названием курса,
      // а таблица сроков хранения куков — длительностью.
      const banner = document.querySelector('#ccc');
      const outside = (el) => el && !(banner && banner.contains(el));
      const title = clean([...document.querySelectorAll('h1')].find(outside)?.innerText);
      let raw = null;
      for (const el of document.querySelectorAll('div, dt, li, span, p')) {
        if (el.children.length > 2 || !outside(el)) continue;
        const t = clean(el.innerText);
        if (!/^course duration\b/i.test(t)) continue;
        raw = t.replace(/^course duration\s*:?\s*/i, '') || clean(el.nextElementSibling?.innerText);
        if (raw) break;
      }
      const body = clean((document.querySelector('main') || document.body)?.innerText);
      const campus = (body.match(/\b(Penryn|Falmouth) Campus\b/) || [])[0] || null;
      return { title, raw, campus };
    }),
  },
  worcester: {
    name: 'University of Worcester',
    // Списка курсов нет ни в sitemap, ни на A-Z: адреса отдаёт поиск по уровню.
    lists: [
      'https://www.worc.ac.uk/study/find-a-course/home.aspx?level=52&term=',
      'https://www.worc.ac.uk/study/find-a-course/home.aspx?level=53&term=',
    ],
    host: 'worc.ac.uk',
    hostAlso: ['worcester.ac.uk'],
    courseLink: /^\/courses\/[a-z0-9-]{4,}/i,
    contact: 'https://www.worc.ac.uk/contact/',
    // Подписи «Duration» нет: срок стоит строкой «3 years full-time (part-time …)».
    parse: async (page) => page.evaluate(() => {
      const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
      const banner = document.querySelector('#ccc');
      const outside = (el) => el && !(banner && banner.contains(el));
      const title = clean([...document.querySelectorAll('h1')].find(outside)?.innerText);
      const body = clean((document.querySelector('main') || document.body)?.innerText);
      const m = body.match(/\b\d(?:\.\d)?\s*years?\s*full[- ]?time[^.]{0,60}/i)
        || body.match(/\b(one|two|three|four|five|six)\s*years?\s*full[- ]?time[^.]{0,60}/i);
      return { title, raw: m ? m[0] : null, campus: null };
    }),
  },
};

async function collectCity(page, site) {
  if (!site.contact) return { city: null, evidence: null };
  try {
    await page.goto(site.contact, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await dismissCookies(page);
    await page.waitForTimeout(1500);
  } catch { return { city: null, evidence: null }; }
  const text = await page.evaluate(() => {
    const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const addr = document.querySelector('address');
    return clean(addr?.innerText) || clean(document.body?.innerText).slice(0, 4000);
  });
  return { city: null, evidence: { url: page.url(), text: text.slice(0, 400) } };
}

fs.mkdirSync(OUTDIR, { recursive: true });
const browser = await chromium.launch();

for (const [slug, site] of Object.entries(SITES)) {
  if (ONLY && slug !== ONLY) continue;
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36' });
  const page = await ctx.newPage();
  const hosts = [site.host, ...(site.hostAlso || [])];
  const urls = new Map();

  for (const list of site.lists) {
    try {
      await page.goto(list, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await dismissCookies(page);
      await page.waitForTimeout(2500);
    } catch (e) { log(`${slug}: список ${list} не открылся — ${e.message.slice(0, 60)}`); continue; }
    const anchors = await page.$$eval('a[href]', (as) => as.map((a) => ({ href: a.href, text: (a.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 120) })));
    for (const a of anchors) {
      let u;
      try { u = new URL(a.href); } catch { continue; }
      if (!hosts.some((h) => u.hostname.endsWith(h))) continue;
      // Ссылка на курс — либо по виду адреса, либо по степени в тексте ссылки.
      if (!site.courseLink.test(u.pathname) && !DEGREE_LINK.test(a.text)) continue;
      if (u.pathname.split('/').filter(Boolean).length < 2) continue;
      if (site.skipLink && site.skipLink.test(u.pathname)) continue;
      const clean = u.origin + u.pathname;
      if (!urls.has(clean)) urls.set(clean, a.text);
    }
    log(`${slug}: ${list} → всего адресов курсов ${urls.size}`);
  }

  const courses = [];
  let n = 0;
  for (const [url, linkText] of [...urls].slice(0, LIMIT)) {
    n += 1;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await dismissCookies(page);
      await page.waitForTimeout(1200);
    } catch { courses.push({ url, title: linkText || null, durationYears: null, durationRaw: null, durationSource: null, note: 'страница не открылась' }); continue; }
    const got = await site.parse(page);
    const years = got.raw ? baseYears(got.raw) : null;
    courses.push({
      url,
      title: got.title || linkText || null,
      level: levelFromTitle(got.title || linkText),
      durationYears: years,
      durationRaw: got.raw,
      durationSource: years ? 'страница курса' : null,
      campus: got.campus,
    });
    if (n % 25 === 0) log(`${slug}: ${n} / ${Math.min(urls.size, LIMIT)}`);
  }

  const city = await collectCity(page, site);
  const withYears = courses.filter((c) => c.durationYears).length;
  const out = {
    slug, name: site.name, collectedAt: new Date().toISOString().slice(0, 10),
    coursesFound: urls.size, coursesParsed: courses.length,
    withDuration: withYears, withoutDuration: courses.length - withYears,
    cityEvidence: city.evidence, courses,
  };
  fs.writeFileSync(path.join(OUTDIR, `${slug}.json`), JSON.stringify(out, null, 2));
  log(`${slug}: готово — курсов ${courses.length}, длительность взялась у ${withYears}, без неё ${courses.length - withYears}`);
  await ctx.close();
}

await browser.close();
log('сбор закончен');
