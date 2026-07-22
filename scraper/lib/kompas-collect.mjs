// kompas-collect.mjs — общая часть коллекторов КОМПАСа (сессия 2).
//
// Правила плана, которые здесь закодированы:
//  - живой каталог НЕ трогаем: всё пишется в sources/kompas/{extracts,membership} (правило 5);
//  - --dry-run не пишет в дерево ВООБЩЕ (урок среза 3, баг bobr.mjs --dry-run);
//  - частичный прогон не затирает чужие файлы: пишем по одному файлу на вуз (урок orel-hunt);
//  - запросы идут через общую очередь с уважением Retry-After (урок 429 в ОРЛЕ).

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.join(__dirname, '..', '..');
export const KOMPAS_DIR = path.join(ROOT, 'sources', 'kompas');
export const EXTRACTS_DIR = path.join(KOMPAS_DIR, 'extracts');
export const MEMBERSHIP_DIR = path.join(KOMPAS_DIR, 'membership');
export const CATALOG_DIR = path.join(ROOT, 'site', 'src', 'content', 'universities');

export const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// ---------------------------------------------------------------- очередь ----
// Один запрос за раз с паузой MIN_GAP. Дешевле, чем разбираться с 429 задним
// числом: в ОРЛЕ штраф Wikimedia жил минутами и притворялся «данных нет».
const MIN_GAP_MS = Number(process.env.KOMPAS_GAP_MS || 700);
const MAX_RETRY = 3;

export const stats = { requests: 0, throttled: 0, failed: 0, bytes: 0 };

let chain = Promise.resolve();
let lastAt = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runFetch(url, { accept = 'text/html', method = 'GET', body = null, headers = {} } = {}) {
  for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
    const gap = MIN_GAP_MS - (Date.now() - lastAt);
    if (gap > 0) await sleep(gap);
    lastAt = Date.now();
    stats.requests++;
    let res;
    try {
      res = await fetch(url, { method, body, headers: { 'User-Agent': UA, Accept: accept, ...headers }, redirect: 'follow' });
    } catch (e) {
      if (attempt === MAX_RETRY) { stats.failed++; throw new Error(`network ${e.message} :: ${url}`); }
      await sleep(1500 * (attempt + 1));
      continue;
    }
    if (res.status === 429 || res.status === 503) {
      stats.throttled++;
      const ra = Number(res.headers.get('retry-after')) || 20;
      if (attempt === MAX_RETRY) { stats.failed++; throw new ThrottledError(`HTTP ${res.status} after ${MAX_RETRY} retries :: ${url}`); }
      await sleep((ra + 1) * 1000);
      continue;
    }
    if (!res.ok) {
      if (res.status >= 500 && attempt < MAX_RETRY) { await sleep(1500 * (attempt + 1)); continue; }
      stats.failed++;
      throw new HttpError(res.status, url);
    }
    const text = await res.text();
    stats.bytes += text.length;
    return { text, url: res.url, status: res.status };
  }
  throw new Error(`unreachable :: ${url}`);
}

export class ThrottledError extends Error {}
export class HttpError extends Error {
  constructor(status, url) { super(`HTTP ${status} :: ${url}`); this.status = status; this.url = url; }
}

/** Запрос через общую очередь. Возвращает {text,url,status}. */
export function fetchQueued(url, opts) {
  const job = chain.then(() => runFetch(url, opts), () => runFetch(url, opts));
  chain = job.catch(() => {});
  return job;
}

export async function fetchJson(url, opts) {
  const { text } = await fetchQueued(url, { accept: 'application/json', ...opts });
  return JSON.parse(text);
}

export async function fetchHtml(url, opts) {
  const { text } = await fetchQueued(url, opts);
  return text;
}

// ------------------------------------------------------------------ текст ----
const ENTITIES = {
  '&amp;': '&', '&nbsp;': ' ', '&quot;': '"', '&#039;': "'", '&#39;': "'", '&apos;': "'",
  '&rsquo;': '’', '&lsquo;': '‘', '&ldquo;': '“', '&rdquo;': '”',
  '&#8217;': '’', '&#8216;': '‘', '&#8220;': '“', '&#8221;': '”',
  '&ndash;': '–', '&mdash;': '—', '&#8211;': '–', '&#8212;': '—',
  '&pound;': '£', '&#163;': '£', '&euro;': '€', '&hellip;': '…',
};

export function decodeEntities(s) {
  if (!s) return '';
  return String(s)
    .replace(/&[a-z]+;|&#\d+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/** HTML -> плоский текст с разделителем '|' между узлами (удобно для таблиц «поле | значение»). */
export function htmlToCells(html) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ''),
  )
    .split('')
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/** Значение из плоского списка ячеек по метке: ['Study Level','Undergraduate'] -> 'Undergraduate'. */
export function cellAfter(cells, label, { within = 3 } = {}) {
  const i = cells.findIndex((c) => c.toLowerCase() === label.toLowerCase());
  if (i === -1) return null;
  for (let j = i + 1; j <= i + within && j < cells.length; j++) {
    const v = cells[j];
    if (!v || v.toLowerCase() === label.toLowerCase()) continue;
    if (/^(from|to)$/i.test(v)) continue; // «Tuition fee | From | £17,000 GBP»
    return v;
  }
  return null;
}

/**
 * ВСЕ значения метки до следующей известной метки таблицы.
 * Нужно потому, что у части полей значений несколько: «Start Dates | January | September | Campus».
 * Поймано глазами на карточке Kent — cellAfter брал только January и терял September.
 */
export function cellsAfterAll(cells, label, stopLabels) {
  const i = cells.findIndex((c) => c.toLowerCase() === label.toLowerCase());
  if (i === -1) return [];
  const stop = new Set(stopLabels.map((s) => s.toLowerCase()));
  const out = [];
  for (let j = i + 1; j < cells.length; j++) {
    const v = cells[j];
    if (stop.has(v.toLowerCase())) break;
    if (/^(from|to)$/i.test(v)) continue;
    out.push(v);
    if (out.length > 24) break; // защита от «убежавшего» списка (после Campus идут 250 стран)
  }
  return out;
}

// ---------------------------------------------------------------- деньги ----
const CUR_SYMBOL = { '£': 'GBP', $: 'USD', '€': 'EUR', 'A$': 'AUD', 'C$': 'CAD', 'NZ$': 'NZD' };

/** '£17,000 GBP' -> {amount:17000, currency:'GBP'}; ничего не выдумывает — null, если числа нет. */
export function parseMoney(s) {
  if (!s) return null;
  const t = decodeEntities(String(s));
  const num = t.match(/([\d][\d,\s]{2,})(?:\.\d+)?/);
  if (!num) return null;
  const amount = Number(num[1].replace(/[,\s]/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const iso = t.match(/\b(GBP|USD|EUR|AUD|CAD|NZD|SGD|AED|CHF|SEK|MYR)\b/i);
  let currency = iso ? iso[1].toUpperCase() : null;
  if (!currency) {
    for (const [sym, cur] of Object.entries(CUR_SYMBOL)) if (t.includes(sym)) { currency = cur; break; }
  }
  return currency ? { amount, currency } : { amount, currency: null };
}

// ---------------------------------------------------------------- уровни ----
// Схема каталога: foundation | bachelor | master | phd | pathway | diploma | certificate | language
const LEVEL_RULES = [
  [/\b(phd|doctora|dphil|doctor of philosophy)\b/i, 'phd'],
  [/\b(pre-?master|pre master)\b/i, 'foundation'],
  [/\b(international year one|foundation|iyo|year zero)\b/i, 'foundation'],
  [/\b(m\.?sc|m\.?a\b|mba|m\.?eng|llm|mres|mphil|master|postgraduate|pg\b)\b/i, 'master'],
  [/\b(b\.?sc|b\.?a\b|b\.?eng|llb|bba|bachelor|undergraduate|ug\b|hons)\b/i, 'bachelor'],
  [/\b(diploma|hnd|hnc)\b/i, 'diploma'],
  [/\b(certificate|cert\b)\b/i, 'certificate'],
  [/\b(english|ielts|language|elicos)\b/i, 'language'],
  [/\b(pathway|progression)\b/i, 'pathway'],
];

/** Уровень по названию/подсказкам. null, если не опознан — фабриковать нельзя. */
export function mapLevel(...hints) {
  const t = hints.filter(Boolean).join(' ');
  for (const [re, lvl] of LEVEL_RULES) if (re.test(t)) return lvl;
  return null;
}

// ------------------------------------------------------------------ вывод ----
export async function writeExtract(aggKey, slug, payload, { dryRun = false } = {}) {
  if (dryRun) return { written: false, path: null };
  const dir = path.join(EXTRACTS_DIR, aggKey);
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${slug}.json`);
  await fs.writeFile(file, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  return { written: true, path: file };
}

export async function writeMembership(aggKey, payload, { dryRun = false } = {}) {
  if (dryRun) return { written: false, path: null };
  await fs.mkdir(MEMBERSHIP_DIR, { recursive: true });
  const file = path.join(MEMBERSHIP_DIR, `${aggKey}.json`);
  await fs.writeFile(file, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  return { written: true, path: file };
}

export function extract({ slug, name, source, sourceUrl, programs, currency = null, extra = {} }) {
  const out = {
    slug,
    name,
    source,
    sourceUrl,
    scrapedAt: new Date().toISOString(),
    ...(currency ? { currency } : {}),
    ...extra,
    programs,
  };
  return out;
}

export const args = {
  has: (flag) => process.argv.includes(`--${flag}`),
  get: (name, dflt = null) => {
    const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.split('=').slice(1).join('=') : dflt;
  },
  num: (name, dflt) => {
    const v = args.get(name);
    return v === null ? dflt : Number(v);
  },
};

export function logger(tag) {
  return (...a) => process.stderr.write(`[${tag}] ${new Date().toISOString().slice(11, 19)} ${a.join(' ')}\n`);
}
