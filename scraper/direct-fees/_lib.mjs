// _lib.mjs — общее для парсеров цен прямых партнёров (scraper/direct-fees/<slug>.mjs).
//
// Здесь только транспорт и разбор HTML. Решать, что считать ценой, должен парсер
// своего домена: общий проход по этим сайтам уже провалился (A1, 02.09.2026).

import { execFileSync } from 'node:child_process';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

const NAMED = {
  amp: '&', nbsp: ' ', quot: '"', apos: "'", lt: '<', gt: '>', ndash: '–', mdash: '—',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', euro: '€', pound: '£', hellip: '…',
  uuml: 'ü', Uuml: 'Ü', ouml: 'ö', Ouml: 'Ö', ccedil: 'ç', Ccedil: 'Ç', auml: 'ä', Auml: 'Ä',
  eacute: 'é', egrave: 'è', agrave: 'à', scaron: 'š', Scaron: 'Š', zcaron: 'ž', ccaron: 'č',
};

/** Раскодировать HTML-энтити. */
export const decode = (s) => String(s ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&([a-z]+);/gi, (m, n) => NAMED[n] ?? m);

/** Видимый текст куска HTML, пробелы схлопнуты. */
export const text = (html) => decode(String(html ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<[^>]+>/g, ' '))
  .replace(/\s+/g, ' ').trim();

/** Абсолютный адрес ссылки или null. */
export const abs = (href, base) => { try { return new URL(decode(href), base).href; } catch { return null; } };

/** Все ссылки страницы: [{ href, text }]. */
export const anchors = (html, base) => [...String(html).matchAll(/<a\b[^>]*?href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
  .map((m) => ({ href: abs(m[1], base), text: text(m[2]) }))
  .filter((a) => a.href);

/** Строки таблиц страницы: [[ячейка, ячейка, …], …], ячейки — видимый текст. */
export const tableRows = (html) => [...String(html).matchAll(/<tr\b[\s\S]*?<\/tr>/gi)]
  .map((m) => [...m[0].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) => text(c[1])))
  .filter((r) => r.length);

/**
 * GET через curl: отдаёт тело или бросает. curl, а не fetch — у части сайтов
 * TLS/WAF по-разному встречают node и браузерный стек, curl проходит чаще.
 */
export function get(url, { timeout = 45 } = {}) {
  return execFileSync('curl', ['-sS', '-L', '--compressed', '--max-time', String(timeout),
    '-A', UA, '-H', 'Accept-Language: en-US,en;q=0.9', url],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
}

/** Код ответа и конечный адрес без тела — для разведки. */
export function head(url) {
  const out = execFileSync('curl', ['-sS', '-L', '-o', '/dev/null', '--max-time', '30', '-A', UA,
    '-w', '%{http_code} %{url_effective}', url], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const [code, ...rest] = out.trim().split(' ');
  return { code: Number(code), url: rest.join(' ') };
}

let browser = null;
/**
 * Страница настоящим браузером (Playwright/Chromium) — для WAF и страниц,
 * где цены дорисовывает JS. Медленно, звать только когда curl не справился.
 */
export async function getBrowser(url, { waitMs = 2500 } = {}) {
  if (!browser) {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ headless: true });
  }
  const page = await browser.newPage({ userAgent: UA });
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(waitMs);
    return await page.content();
  } finally {
    await page.close();
  }
}
export async function closeBrowser() { if (browser) { await browser.close(); browser = null; } }

/** Пауза между запросами к одному домену. */
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
