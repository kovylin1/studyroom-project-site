#!/usr/bin/env node
// Замер разметки офсайтов: где на странице курса лежит длительность и где — город.
// Правило проекта: сперва посмотреть разметку глазами, потом писать разборщик.
// Скрипт НИЧЕГО не разбирает по-настоящему — он снимает страницу и показывает,
// какими способами длительность на ней выражена. Каталог не трогает.
//
// Usage:
//   node scraper/kompas-qs-newcards-markup-probe.mjs            # все домены
//   node scraper/kompas-qs-newcards-markup-probe.mjs --slug=falmouth
//
// Выход: sources/kompas/qs-newcards-markup/<slug>-{list,course}.html (сырьё для глаз)
//        sources/kompas/qs-newcards-markup/report.json (сводка)

import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUTDIR = path.join(ROOT, 'sources/kompas/qs-newcards-markup');
const UA = 'Mozilla/5.0 (compatible; studyroom-markup-probe/1.0; +https://studyroom-project-site.pages.dev)';
const arg = (p) => (process.argv.find((a) => a.startsWith(p)) || '').slice(p.length);
const ONLY = arg('--slug=') || null;

// Стартовые страницы поиска курсов. Список курсов у каждого вуза свой,
// поэтому кроме корня пробуем несколько типовых путей.
// Пути и вид ссылки на курс сняты с самих сайтов первым заходом замера
// (сохранённые списки лежат в sources/kompas/qs-newcards-markup/<slug>-list.html).
const SITES = [
  { slug: 'falmouth', name: 'Falmouth University', origin: 'https://www.falmouth.ac.uk', paths: ['/courses/undergraduate', '/study/undergraduate'], link: /^\/courses\/undergraduate\/[a-z0-9-]{4,}/i },
  { slug: 'worcester', name: 'University of Worcester', origin: 'https://www.worcester.ac.uk', paths: ['/study/find-a-course/a-z-of-courses.aspx'], link: /^\/courses\/[a-z0-9-]{4,}/i },
  { slug: 'kpu', name: 'Kwantlen Polytechnic University', origin: 'https://calendar.kpu.ca', paths: ['/programs-az/arts/', '/programs-az/'], link: /^\/programs-az\/[a-z-]+\/[a-z0-9-]{4,}/i },
  { slug: 'marshall', name: 'Marshall University', origin: 'https://catalog.marshall.edu', paths: ['/undergraduate/programs-az/', '/undergraduate/', '/'], link: /^\/undergraduate\/[a-z0-9-]+\/[a-z0-9-]{4,}/i },
  { slug: 'mercy', name: 'Mercy University', origin: 'https://www.mercy.edu', paths: ['/academics/programs', '/academics'], link: /^\/academics\/programs\/[a-z0-9-]{4,}/i },
  { slug: 'wiut', name: 'Westminster International University in Tashkent', origin: 'https://www.wiut.uz', paths: ['/undergraduate', '/study'], link: /^\/(undergraduate|postgraduate)\/[a-z0-9-]{3,}/i },
  { slug: 'tedi-london', name: 'TEDI-London', origin: 'https://tedi-london.ac.uk', paths: ['/courses/', '/'], link: /^\/courses\/(undergraduate|postgraduate)\/[a-z0-9-]{4,}/i },
  { slug: 'phbs', name: 'Peking University HSBC Business School', origin: 'https://english.phbs.pku.edu.cn', paths: ['/Academics.htm', '/'], link: /^\/Academics\/[A-Za-z0-9_-]{3,}\.htm/ },
];

const COURSE_LINK = /\/(course|courses|programme|programmes|program|programs|degree|degrees|study|majors?|subject)s?\//i;
const DURATION_NEAR = /(duration|length of (?:course|study|programme|program)|course length|study mode|time to complete|программ|срок)/i;
const YEARS_TEXT = /\b(\d(?:\.\d)?|one|two|three|four|five|six)[\s-]?(?:year|yr)s?\b|\b(\d{1,2})[\s-]?months?\b/i;

async function get(url, ms = 20000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, redirect: 'follow', signal: ac.signal });
    const html = await r.text();
    return { ok: r.ok, status: r.status, url: r.url, html };
  } catch (e) {
    return { ok: false, status: 0, url, html: '', error: e.message };
  } finally { clearTimeout(t); }
}

// Как именно на странице выражена длительность: разметкой, парой «подпись → значение»
// или просто текстом. Это и есть предмет замера.
function measureDuration($, html) {
  const found = [];

  for (const el of $('script[type="application/ld+json"]').toArray()) {
    const raw = $(el).contents().text();
    if (/duration|timeToComplete|Course/i.test(raw)) {
      found.push({ how: 'JSON-LD', sample: raw.replace(/\s+/g, ' ').slice(0, 400) });
    }
  }

  for (const el of $('dt, th, .key, [class*="label"], [class*="key-fact"], [class*="keyfact"], strong, b').toArray()) {
    const label = $(el).text().replace(/\s+/g, ' ').trim();
    if (!label || label.length > 60 || !DURATION_NEAR.test(label)) continue;
    const sibling = $(el).next().text().replace(/\s+/g, ' ').trim()
      || $(el).parent().text().replace(/\s+/g, ' ').trim();
    found.push({ how: `пара «${el.tagName}» ${label}`, sample: sibling.slice(0, 160) });
  }

  for (const el of $('[data-duration], [itemprop="timeRequired"], meta[name*="duration" i]').toArray()) {
    found.push({ how: `атрибут ${el.tagName}`, sample: ($(el).attr('data-duration') || $(el).attr('content') || $(el).text()).slice(0, 120) });
  }

  if (!found.length) {
    const text = $('body').text().replace(/\s+/g, ' ');
    const m = text.match(new RegExp(`.{0,90}${DURATION_NEAR.source}.{0,90}`, 'i'));
    if (m) found.push({ how: 'только текстом', sample: m[0].trim().slice(0, 200) });
    else {
      const y = text.match(new RegExp(`.{0,70}${YEARS_TEXT.source}.{0,70}`, 'i'));
      if (y) found.push({ how: 'только «N years» в тексте без подписи', sample: y[0].trim().slice(0, 180) });
    }
  }
  return found.slice(0, 6);
}

// Город: адрес в подвале, schema.org PostalAddress, ссылка «contact».
function measureCity($) {
  const out = [];
  for (const el of $('script[type="application/ld+json"]').toArray()) {
    const raw = $(el).contents().text();
    if (/PostalAddress|addressLocality/i.test(raw)) {
      const m = raw.match(/"addressLocality"\s*:\s*"([^"]+)"/i);
      out.push({ how: 'JSON-LD PostalAddress', sample: m ? m[1] : raw.replace(/\s+/g, ' ').slice(0, 200) });
    }
  }
  for (const el of $('[itemprop="addressLocality"], address, footer address, [class*="address"]').toArray()) {
    const t = $(el).text().replace(/\s+/g, ' ').trim();
    if (t && t.length < 220) out.push({ how: `элемент ${el.tagName}`, sample: t });
    if (out.length > 4) break;
  }
  return out.slice(0, 4);
}

fs.mkdirSync(OUTDIR, { recursive: true });
const report = [];

for (const site of SITES) {
  if (ONLY && site.slug !== ONLY) continue;
  const entry = { slug: site.slug, name: site.name, origin: site.origin, listUrl: null, courseUrl: null, notes: [] };

  let listRes = null;
  for (const p of [...site.paths, '/']) {
    const r = await get(site.origin + p);
    if (r.ok && r.html.length > 1000) { listRes = r; break; }
    entry.notes.push(`${p} → ${r.status}${r.error ? ' ' + r.error : ''}`);
  }
  if (!listRes) { entry.notes.push('список курсов не открылся'); report.push(entry); console.log(`${site.slug}: список не открылся`); continue; }

  entry.listUrl = listRes.url;
  fs.writeFileSync(path.join(OUTDIR, `${site.slug}-list.html`), listRes.html);

  const $list = cheerio.load(listRes.html);
  const links = new Set();
  for (const a of $list('a[href]').toArray()) {
    let href = $list(a).attr('href');
    if (!href || href.startsWith('#') || /^(mailto|tel|javascript)/i.test(href)) continue;
    try { href = new URL(href, listRes.url).toString(); } catch { continue; }
    if (new URL(href).origin !== new URL(listRes.url).origin) continue;
    const pathname = new URL(href).pathname;
    const matcher = site.link || COURSE_LINK;
    if (!matcher.test(pathname)) continue;
    if (pathname.split('/').filter(Boolean).length < 2) continue;
    links.add(href.split('#')[0]);
  }
  entry.courseLinkCount = links.size;

  let courseRes = null;
  for (const href of [...links].slice(0, 6)) {
    const r = await get(href);
    if (!r.ok || r.html.length < 1500) continue;
    const $$ = cheerio.load(r.html);
    const dur = measureDuration($$, r.html);
    if (dur.length) { courseRes = { r, dur, $$ }; break; }
    if (!courseRes) courseRes = { r, dur, $$ };
  }
  if (!courseRes) { entry.notes.push('страницу курса открыть не удалось'); report.push(entry); console.log(`${site.slug}: страница курса не открылась (ссылок-кандидатов ${links.size})`); continue; }

  entry.courseUrl = courseRes.r.url;
  fs.writeFileSync(path.join(OUTDIR, `${site.slug}-course.html`), courseRes.r.html);
  entry.duration = courseRes.dur;
  entry.city = measureCity(courseRes.$$);
  entry.title = courseRes.$$('h1').first().text().replace(/\s+/g, ' ').trim().slice(0, 120) || null;
  report.push(entry);

  console.log(`\n=== ${site.slug} — ${entry.title || '(без h1)'} ]`);
  console.log(`  курс: ${entry.courseUrl}  (ссылок-кандидатов ${links.size})`);
  for (const d of entry.duration) console.log(`  длит. [${d.how}]: ${d.sample}`);
  for (const c of entry.city) console.log(`  город [${c.how}]: ${c.sample.slice(0, 140)}`);
}

fs.writeFileSync(path.join(OUTDIR, 'report.json'), JSON.stringify(report, null, 2));
console.log(`\nсырьё и сводка: ${path.relative(ROOT, OUTDIR)}`);
