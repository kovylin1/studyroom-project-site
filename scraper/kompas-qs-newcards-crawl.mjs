#!/usr/bin/env node
// Замер офсайтов семи вузов, по которым карточки в каталоге нет: находит страницы
// курсов и смотрит, КАКИМ СПОСОБОМ на них выражены длительность и город.
// Это замер, а не сбор: каталог не трогается, карточки не заводятся, цены не переносятся.
//
// Порядок из плана КОМПАСа: сперва меряем разметку, потом пишем разборщик.
// Здесь же считается доля страниц, где длительности нет ВООБЩЕ, — по ним
// длительность не выводится из уровня, а уходит кейсом в /manager.
//
// Почему браузер, а не fetch: у Worcester и WIUT список курсов рисует скрипт,
// в отданном HTML нет ни ссылок, ни заголовка. Замер первым заходом
// (`kompas-qs-newcards-markup-probe.mjs`) это и показал.
//
// Ссылка на курс опознаётся по ТЕКСТУ ссылки: в нём почти всегда стоит степень
// («Animation BA (Hons)»). Это работает одинаково на всех семи сайтах, в отличие
// от путей, которые у каждого свои.
//
// Usage:
//   node scraper/kompas-qs-newcards-crawl.mjs                    # все семь
//   node scraper/kompas-qs-newcards-crawl.mjs --slug=kpu --max=20
//
// Выход: sources/kompas/qs-newcards-crawl/<slug>.json + summary.json
//        лог — sources/kompas/qs-newcards-crawl.log

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUTDIR = path.join(ROOT, 'sources/kompas/qs-newcards-crawl');
const LOG = path.join(ROOT, 'sources/kompas/qs-newcards-crawl.log');

const arg = (p) => (process.argv.find((a) => a.startsWith(p)) || '').slice(p.length);
const ONLY = arg('--slug=') || null;
const MAX_COURSES = parseInt(arg('--max=') || '12', 10);
const MAX_LISTS = parseInt(arg('--lists=') || '6', 10);

const SITES = [
  { slug: 'falmouth', name: 'Falmouth University', hosts: ['falmouth.ac.uk'],
    seeds: ['https://www.falmouth.ac.uk/courses/undergraduate', 'https://www.falmouth.ac.uk/study/postgraduate'] },
  // Списка курсов у Worcester нет ни в sitemap, ни на странице A-Z: их отдаёт
  // поиск home.aspx по уровню (52 — бакалавриат, 53 — магистратура).
  // Сами страницы курсов живут на /courses/<слаг>.
  { slug: 'worcester', name: 'University of Worcester', hosts: ['worcester.ac.uk', 'worc.ac.uk'],
    seeds: ['https://www.worc.ac.uk/study/find-a-course/home.aspx?level=52&term=', 'https://www.worc.ac.uk/study/find-a-course/home.aspx?level=53&term='],
    courseLink: /^\/courses\/[a-z0-9-]{4,}/i },
  { slug: 'kpu', name: 'Kwantlen Polytechnic University', hosts: ['kpu.ca'],
    seeds: ['https://calendar.kpu.ca/programs-az/', 'https://www.kpu.ca/programs'] },
  { slug: 'marshall', name: 'Marshall University', hosts: ['marshall.edu'],
    seeds: ['https://catalog.marshall.edu/undergraduate/', 'https://catalog.marshall.edu/graduate/'] },
  { slug: 'mercy', name: 'Mercy University', hosts: ['mercy.edu'],
    seeds: ['https://www.mercy.edu/academics/programs'] },
  { slug: 'wiut', name: 'Westminster International University in Tashkent', hosts: ['wiut.uz'],
    seeds: ['https://www.wiut.uz/undergraduate', 'https://www.wiut.uz/postgraduate'] },
  { slug: 'phbs', name: 'Peking University HSBC Business School', hosts: ['phbs.pku.edu.cn'],
    seeds: ['https://english.phbs.pku.edu.cn/Academics.htm'] },
];

// Степень в тексте ссылки или в заголовке — признак страницы курса.
const DEGREE = /\b(BA|BSc|BEng|BBA|BComm|LLB|MA|MSc|MEng|MBA|LLM|PhD|MPhil|DipHE|FdA|FdSc|Bachelor|Master(?:'s)?|Doctoral|Doctorate|Associate|Diploma|Certificate|Foundation)\b/i;
const LIST_HINT = /(course|programme|program|degree|study|academics|majors?)/i;
const DURATION_LABEL = /(duration|course length|programme length|program length|length of (?:course|study|programme|program)|time to complete|study length)/i;
const DURATION_TEXT = /\b(\d(?:\.\d)?|one|two|three|four|five|six|seven)[\s-]?(year|yr|month|semester|term)s?\b/i;
const WORD_NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 };

const log = (m) => {
  const line = `[замер ${new Date().toISOString().slice(11, 19)}] ${m}`;
  process.stdout.write(line + '\n');
  try { fs.appendFileSync(LOG, line + '\n'); } catch {}
};

function yearsFromText(text) {
  const m = String(text || '').match(DURATION_TEXT);
  if (!m) return null;
  const n = WORD_NUM[m[1].toLowerCase()] ?? Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = m[2].toLowerCase();
  if (unit === 'year' || unit === 'yr') return n;
  if (unit === 'month') return Number((n / 12).toFixed(2));
  return Number((n / 2).toFixed(2)); // semester / term
}

function parseIso(v) {
  const m = String(v).match(/^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/);
  if (!m || !m.slice(1).some(Boolean)) return null;
  const [y, mo, w, d] = m.slice(1).map((x) => (x ? Number(x) : 0));
  const years = y + mo / 12 + (w * 7) / 365 + d / 365;
  return years > 0 ? Number(years.toFixed(2)) : null;
}

// Всё, что снимается со страницы, снимается ОДНИМ заходом в браузер.
async function scrapeSignals(page) {
  return page.evaluate(() => {
    const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
    // У Courseleaf (KPU, Marshall) первый h1 — шапка сайта, название программы
    // лежит в блоке содержимого. Берём его, если он есть.
    const titleEl = document.querySelector('#content h1, .page-title, main h1, article h1') || document.querySelector('h1');
    const out = { h1: clean(titleEl?.innerText), jsonLd: [], pairs: [], address: null, ldLocality: null, text: '' };

    for (const el of document.querySelectorAll('script[type="application/ld+json"]')) {
      out.jsonLd.push(el.textContent.slice(0, 20000));
    }

    const LABEL = /(duration|course length|programme length|program length|length of (course|study|programme|program)|time to complete|study length)/i;
    const nodes = document.querySelectorAll('dt, th, li, p, span, div, strong, b, h3, h4');
    for (const el of nodes) {
      if (el.children.length > 3) continue;
      const t = clean(el.innerText);
      if (!t || t.length > 90 || !LABEL.test(t)) continue;
      const next = clean(el.nextElementSibling?.innerText) || clean(el.parentElement?.innerText);
      out.pairs.push({ label: t.slice(0, 70), value: (next || '').slice(0, 160), tag: el.tagName });
      if (out.pairs.length >= 8) break;
    }

    const addr = document.querySelector('[itemprop="addressLocality"]') || document.querySelector('address');
    out.address = clean(addr?.innerText).slice(0, 200) || null;
    out.text = clean(document.body?.innerText).slice(0, 60000);
    return out;
  });
}

function classifyDuration(sig) {
  for (const raw of sig.jsonLd) {
    let data;
    try { data = JSON.parse(raw); } catch { continue; }
    const stack = [data];
    while (stack.length) {
      const node = stack.pop();
      if (!node || typeof node !== 'object') continue;
      if (Array.isArray(node)) { stack.push(...node); continue; }
      for (const key of ['timeToComplete', 'duration', 'timeRequired', 'educationalProgramDuration']) {
        const v = node[key];
        if (typeof v === 'string') {
          const years = parseIso(v) ?? yearsFromText(v);
          if (years) return { how: 'json-ld', field: key, raw: v, years };
        }
      }
      stack.push(...Object.values(node));
    }
  }
  for (const p of sig.pairs) {
    const years = yearsFromText(p.value) ?? yearsFromText(p.label);
    if (years) return { how: `пара «${p.tag}» ${p.label}`, field: p.label, raw: p.value.slice(0, 120), years };
  }
  const inline = sig.text.match(new RegExp(`${DURATION_LABEL.source}[^.]{0,70}`, 'i'));
  if (inline) {
    const years = yearsFromText(inline[0]);
    if (years) return { how: 'строкой в тексте', field: null, raw: inline[0].slice(0, 140), years };
  }
  const ft = sig.text.match(/\b(\d|one|two|three|four|five|six)[\s-]?years?\b[^.]{0,25}(full[- ]?time|part[- ]?time)/i);
  if (ft) return { how: 'N years full-time без подписи', field: null, raw: ft[0].slice(0, 120), years: yearsFromText(ft[0]) };
  const credits = sig.text.match(/\b(\d{2,3})\s*(credit hours?|semester hours?|credits)\b/i);
  if (credits) return { how: 'только кредиты, срока нет', field: null, raw: credits[0], years: null };
  return { how: 'нет', field: null, raw: null, years: null };
}

function classifyCity(sig) {
  for (const raw of sig.jsonLd) {
    const m = raw.match(/"addressLocality"\s*:\s*"([^"]+)"/i);
    if (m) return { how: 'json-ld addressLocality', value: m[1] };
  }
  if (sig.address) return { how: 'элемент address', value: sig.address };
  return { how: 'нет', value: null };
}

fs.mkdirSync(OUTDIR, { recursive: true });
const browser = await chromium.launch();
const summary = [];

for (const site of SITES) {
  if (ONLY && site.slug !== ONLY) continue;
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36' });
  const page = await ctx.newPage();
  const seenUrl = new Set();
  const courseLinks = new Map(); // url -> текст ссылки
  const listQueue = [...site.seeds];
  const visitedLists = [];
  let pagesOpened = 0;

  log(`${site.slug}: старт`);

  // 1. Обход списков — ищем ссылки, в тексте которых стоит степень.
  while (listQueue.length && visitedLists.length < MAX_LISTS && courseLinks.size < MAX_COURSES * 3) {
    const url = listQueue.shift();
    if (seenUrl.has(url)) continue;
    seenUrl.add(url);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(2000);
      pagesOpened += 1;
    } catch (e) { log(`${site.slug}: список ${url} не открылся — ${e.message.slice(0, 60)}`); continue; }
    visitedLists.push(page.url());

    const anchors = await page.$$eval('a[href]', (as) => as.map((a) => ({
      href: a.href, text: (a.innerText || a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
    })));
    for (const a of anchors) {
      let u;
      try { u = new URL(a.href); } catch { continue; }
      if (!site.hosts.some((h) => u.hostname.endsWith(h))) continue;
      if (/\.(pdf|jpe?g|png|docx?|xlsx?|zip)$/i.test(u.pathname)) continue;
      const clean = u.origin + u.pathname + (u.search && /level|term|id/i.test(u.search) ? u.search : '');
      const looksLikeCourse = site.courseLink ? site.courseLink.test(u.pathname) : DEGREE.test(a.text);
      if (looksLikeCourse && u.pathname.split('/').filter(Boolean).length >= 1) {
        if (!courseLinks.has(clean)) courseLinks.set(clean, a.text);
      } else if (LIST_HINT.test(u.pathname) && !seenUrl.has(clean) && listQueue.length < 40) {
        listQueue.push(clean);
      }
    }
  }

  // 2. Открываем сами страницы курсов и смотрим разметку.
  const courses = [];
  for (const [url, linkText] of [...courseLinks].slice(0, MAX_COURSES)) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(1800);
      pagesOpened += 1;
    } catch { continue; }
    const sig = await scrapeSignals(page);
    if (!sig.h1 && !DEGREE.test(linkText)) continue;
    courses.push({
      url: page.url(), linkText, h1: sig.h1.slice(0, 140),
      duration: classifyDuration(sig), city: classifyCity(sig),
      pairsSeen: sig.pairs.slice(0, 3),
    });
  }

  const byHow = courses.reduce((acc, c) => ((acc[c.duration.how] = (acc[c.duration.how] || 0) + 1), acc), {});
  const withYears = courses.filter((c) => c.duration.years).length;
  const entry = {
    slug: site.slug, name: site.name, pagesOpened,
    listsVisited: visitedLists, courseLinksFound: courseLinks.size,
    coursePages: courses.length, withYears,
    share: courses.length ? Number((withYears / courses.length).toFixed(2)) : 0,
    byHow, cityHints: [...new Set(courses.map((c) => c.city.value).filter(Boolean))].slice(0, 3),
    courses,
  };
  fs.writeFileSync(path.join(OUTDIR, `${site.slug}.json`), JSON.stringify(entry, null, 2));
  summary.push({ ...entry, courses: undefined, listsVisited: undefined });
  log(`${site.slug}: ссылок на курсы ${courseLinks.size}, открыто ${courses.length}, длительность взялась у ${withYears} — ${JSON.stringify(byHow)}`);
  await ctx.close();
}

await browser.close();
fs.writeFileSync(path.join(OUTDIR, 'summary.json'), JSON.stringify(summary, null, 2));
log(`готово. сводка: ${path.relative(ROOT, path.join(OUTDIR, 'summary.json'))}`);
