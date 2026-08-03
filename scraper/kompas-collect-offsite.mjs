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
  // Месяцев бывает больше двенадцати («around 13 months» у Worcester), поэтому
  // предел у месяцев свой: до 72 (шесть лет). У лет предел прежний.
  const all = [...String(raw || '').matchAll(/\b(\d{1,2}(?:\.\d)?|one|two|three|four|five|six|seven)[\s-]?(year|yr|month)s?\b/gi)]
    .map((m) => {
      const n = WORD_NUM[m[1].toLowerCase()] ?? Number(m[1]);
      if (!Number.isFinite(n) || n <= 0) return null;
      if (/month/i.test(m[2])) return n > 72 ? null : Number((n / 12).toFixed(2));
      return n > 12 ? null : n;
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
    // Список лежит по /courses/…, а САМИ курсы — по /study/<уровень>/<слаг>.
    // Правило `^/courses/<слаг>` (первый заход) не ловило ни одного курса:
    // 43 записи первого прогона взялись по степени в тексте ссылки и притащили
    // мастер-классы из /events/ и раздел коротких курсов.
    courseLink: /^\/study\/(undergraduate|postgraduate|online)\/[a-z0-9-]/i,
    skipLink: /^\/study\/(undergraduate|postgraduate|online)\/?$/i,
    // Страницы-разделы («Games Courses», «Art and Design Master's Degrees») лежат
    // среди курсов и срока не несут — иначе они уедут в сведение как программы.
    hubTitle: /\b(courses|master'?s degrees|online study)$/i,
    // Drupal-пейджер «Load More» скрыт (`visually-hidden`, infinite scroll),
    // но его же адрес работает напрямую: ?page=,N по 20 карточек.
    pageUrl: (base, i) => (i === 0 ? base : `${base}?page=,${i}`),
    settleMs: 3500,
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
    // Листалка поиска — ссылки «1 2 3 …» с адресом &index=N, по 20 на страницу.
    pageUrl: (base, i) => `${base}&index=${i}`,
    settleMs: 1500,
    contact: 'https://www.worc.ac.uk/contact/',
    // Подписи «Duration» нет на страницах бакалавриата: срок стоит строкой
    // «3 years full-time (part-time …)». А на страницах магистратуры и MPhil/PhD
    // подпись как раз есть, но лежит ВНЕ `main` — из-за этого первый прогон
    // не взял срок у 75 страниц, хотя он там написан.
    hubUrl: /-home\/?$/i,
    parse: async (page) => page.evaluate(() => {
      const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
      const banner = document.querySelector('#ccc');
      const outside = (el) => el && !(banner && banner.contains(el));
      const title = clean([...document.querySelectorAll('h1')].find(outside)?.innerText);
      // 1) Подпись «Duration» где угодно в документе. Значение обязано содержать
      // год или месяц: рядом с подписью попадается и «Duration → Timetables».
      let raw = null;
      for (const el of document.querySelectorAll('dt, th, strong, b, h3, h4, span, div, li, p')) {
        if (el.children.length > 2 || !outside(el)) continue;
        const t = clean(el.innerText);
        if (!/^duration\b/i.test(t)) continue;
        const val = t.replace(/^duration\s*:?\s*/i, '') || clean(el.nextElementSibling?.innerText);
        if (val && /\b(year|month)s?\b/i.test(val)) { raw = val.slice(0, 160); break; }
      }
      // 2) Иначе — строка «3 years full-time» в тексте страницы.
      if (!raw) {
        const body = clean((document.querySelector('main') || document.body)?.innerText);
        const m = body.match(/\b\d(?:\.\d)?\s*years?\s*full[- ]?time[^.]{0,60}/i)
          || body.match(/\b(one|two|three|four|five|six)\s*years?\s*full[- ]?time[^.]{0,60}/i);
        raw = m ? m[0] : null;
      }
      return { title, raw, campus: null };
    }),
  },
  // --- Дальше три записи, у которых программ у QS единицы (PHBS 2, MPW 4, ILAC 1).
  // Обходить сайт целиком незачем и нельзя: программы и цены берутся у агрегатора,
  // офсайт нужен только под длительность и город. Поэтому вместо списка курсов —
  // `pages`: адреса ровно тех страниц, что отвечают строкам QS.
  phbs: {
    name: 'Peking University HSBC Business School',
    // Обе программы QS («Cross-Border MA in Finance», «Cross-Border MA Management») —
    // это Cross-Border MiF/MiM, их страницы живут на сайте британского кампуса ПУ.
    pages: [
      'http://www.pku.org.uk/Study/Cross_Border_Master_s_i_Finance.htm',
      'http://www.pku.org.uk/Study/Cross_Border_Master_s_in_Management.htm',
    ],
    host: 'pku.org.uk',
    hostAlso: ['phbs.pku.edu.cn'],
    contact: 'https://english.phbs.pku.edu.cn/About/Visit___Contact.htm',
    // Пара «Duration → Two years» в шапке программы; в тексте дублируется «two-year».
    parse: async (page) => page.evaluate(() => {
      const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
      const body = clean(document.body.innerText);
      const title = clean(document.title).replace(/-Peking University.*$/i, '').trim()
        || clean(document.querySelector('h1')?.innerText);
      const raw = (body.match(/\bDuration\s+((?:one|two|three|four|\d)[\s-]?years?)\b/i) || [])[1]
        || (body.match(/\b(?:is|as)\s+an?\s+((?:one|two|three|four|\d)[\s-]?year)\s+(?:full[- ]time\s+)?(?:post)?graduate\s+(?:degree|program)/i) || [])[1]
        || null;
      // Кампус у кросс-бордера двойной: год в Оксфордшире, год в Шэньчжэне.
      const campus = (body.match(/Year 1 in [^;.]{0,40}[;,] ?Year 2 in [A-Za-z, ]{0,40}/i) || [])[0]
        ?.replace(/\s+(Application|Start|Study)\b.*$/i, '').trim() || null;
      return { title, raw, campus };
    }),
  },
  mpw: {
    name: 'MPW',
    // Три колледжа в трёх городах; у QS одна запись на все три, город карточки выбирает
    // владелец. Страницы уровня курса (A Level / GCSE), а не отдельных предметов:
    // у QS строки тоже предметные не по одному («1 year A Level», «GCSE Subjects»).
    pages: [
      'https://www.mpw.ac.uk/locations/london/courses/a-level/',
      'https://www.mpw.ac.uk/locations/london/courses/gcse/',
      'https://www.mpw.ac.uk/locations/birmingham/courses/a-level/',
      'https://www.mpw.ac.uk/locations/birmingham/courses/gcse/',
      'https://www.mpw.ac.uk/locations/cambridge/courses/a-level/',
      'https://www.mpw.ac.uk/locations/cambridge/courses/gcse/',
    ],
    host: 'mpw.ac.uk',
    contact: 'https://www.mpw.ac.uk/contact/',
    // На странице СРАЗУ ДВА срока («one year courses and two year courses»), поэтому
    // одного значения тут нет и выдумывать его нельзя: отдаём улику, решает оператор.
    parse: async (page) => page.evaluate(() => {
      const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
      const body = clean((document.querySelector('main') || document.body).innerText);
      const h1 = clean(document.querySelector('h1')?.innerText);
      const city = (location.pathname.match(/\/locations\/([a-z-]+)\//i) || [])[1] || null;
      const sentence = (body.match(/[^.!?]{0,80}\b(?:one|two|1|2)[\s-]?years?\b[^.!?]{0,120}(?:courses?|programmes?|A level|GCSE)[^.!?]{0,60}/i) || [])[0] || null;
      const both = /\b(one|1)[\s-]?year\b/i.test(body) && /\b(two|2)[\s-]?year\b/i.test(body);
      return { title: city ? `${h1} — MPW ${city[0].toUpperCase()}${city.slice(1)}` : h1, raw: both ? null : sentence, evidence: sentence, campus: city, both };
    }),
  },
  ilac: {
    name: 'ILAC International Language Academy of Canada',
    // Единственная запись QS — «Young Adults 15 - 18 University Pathway Program».
    pages: [
      'https://ilac.com/university-pathway/university-pathway-program-young-adults/',
      'https://ilac.com/university-pathway-program-adults/',
    ],
    host: 'ilac.com',
    contact: 'https://ilac.com/contact/',
    // Сайт прямо пишет, что срока у программы нет: он зависит от входного уровня
    // английского (8–56 недель). Значит durationYears тут не берётся ниоткуда.
    parse: async (page) => page.evaluate(() => {
      const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
      const body = clean((document.querySelector('main') || document.body).innerText);
      const title = clean(document.querySelector('h1')?.innerText);
      const varies = /duration varies|varies based on your starting|estimated length of your program/i.test(body);
      const table = (body.match(/The estimated length of your program will be:[^]{0,320}/i) || [])[0] || null;
      const campus = /Vancouver/i.test(body) && /Toronto/i.test(body) ? 'Toronto + Vancouver' : null;
      return { title, raw: null, evidence: table, campus, varies };
    }),
  },
};

// Снимает адреса курсов с ОТКРЫТОЙ страницы списка в общую копилку.
// Возвращает, сколько адресов прибавилось, — по этому и решаем, листать ли дальше.
function harvest(anchors, site, hosts, urls) {
  let added = 0;
  for (const a of anchors) {
    let u;
    try { u = new URL(a.href); } catch { continue; }
    if (!hosts.some((h) => u.hostname.endsWith(h))) continue;
    if (!site.courseLink.test(u.pathname)) continue;
    if (site.skipLink && site.skipLink.test(u.pathname)) continue;
    if (u.pathname.split('/').filter(Boolean).length < 2) continue;
    const clean = u.origin + u.pathname;
    if (urls.has(clean)) continue;
    urls.set(clean, a.text);
    added += 1;
  }
  return added;
}

// Листает список адресом (у обоих сайтов кнопка «дальше» — обычная ссылка) и
// снимает адреса С КАЖДОЙ страницы: у Falmouth переход на ?page=,N ЗАМЕНЯЕТ
// карточки, а не дописывает их, поэтому собирать только после листания нельзя.
const MAX_PAGES = 30;

async function crawlList(page, slug, site, hosts, urls, base) {
  for (let i = 0; i < MAX_PAGES; i += 1) {
    const url = site.pageUrl ? site.pageUrl(base, i) : base;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      if (i === 0) await dismissCookies(page);
      await page.waitForTimeout(site.settleMs || 2500);
    } catch (e) {
      log(`${slug}: страница списка ${url} не открылась — ${e.message.slice(0, 60)}`);
      break;
    }
    const anchors = await page.$$eval('a[href]', (as) => as.map((a) => ({ href: a.href, text: (a.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 120) })));
    const added = harvest(anchors, site, hosts, urls);
    if (added === 0) break; // страница не дала ничего нового — список кончился
    if (!site.pageUrl) break;
  }
}

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

  if (site.pages) {
    // Список не обходим: страницы заданы поимённо под строки QS.
    for (const u of site.pages) urls.set(u, null);
    log(`${slug}: страниц задано поимённо — ${urls.size}`);
  }
  for (const list of site.lists || []) {
    // Список отдаёт по 20 карточек, остальное — следующими страницами.
    // Без листания у Falmouth бралось 43 адреса вместо 121, у Worcester 52 вместо 266.
    await crawlList(page, slug, site, hosts, urls, list);
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
    const title = got.title || linkText || null;
    // Раздел списка, а не программа: в сведение с QS такие не идут.
    const isHub = Boolean((site.hubTitle && site.hubTitle.test(title || ''))
      || (site.hubUrl && site.hubUrl.test(new URL(url).pathname)));
    courses.push({
      url,
      title,
      ...(isHub ? { kind: 'hub' } : {}),
      level: levelFromTitle(got.title || linkText),
      durationYears: years,
      durationRaw: got.raw,
      durationSource: years ? 'страница курса' : null,
      campus: got.campus,
      // Улика — то, что на странице сказано про срок, когда одного значения нет
      // (у MPW сразу два варианта, у ILAC срок зависит от входного уровня).
      ...(got.evidence ? { durationEvidence: got.evidence.slice(0, 400) } : {}),
      ...(got.both ? { note: 'на странице два срока сразу — один год и два; выбор оператору' } : {}),
      ...(got.varies ? { note: 'срок программы не фиксирован: зависит от входного уровня английского' } : {}),
    });
    if (n % 25 === 0) log(`${slug}: ${n} / ${Math.min(urls.size, LIMIT)}`);
  }

  const city = await collectCity(page, site);
  const real = courses.filter((c) => c.kind !== 'hub');
  const withYears = real.filter((c) => c.durationYears).length;
  const out = {
    slug, name: site.name, collectedAt: new Date().toISOString().slice(0, 10),
    coursesFound: urls.size, coursesParsed: courses.length,
    hubPages: courses.length - real.length,
    withDuration: withYears, withoutDuration: real.length - withYears,
    cityEvidence: city.evidence, courses,
  };
  fs.writeFileSync(path.join(OUTDIR, `${slug}.json`), JSON.stringify(out, null, 2));
  log(`${slug}: готово — программ ${real.length} (+${courses.length - real.length} разделов), длительность взялась у ${withYears}, без неё ${real.length - withYears}`);
  await ctx.close();
}

await browser.close();
log('сбор закончен');
