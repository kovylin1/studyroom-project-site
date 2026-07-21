// wikimedia.mjs — единственная дверь в API Wikidata и Wikimedia Commons.
//
// ЗАЧЕМ ОТДЕЛЬНЫЙ МОДУЛЬ. МОТЫЛЁК слал ~41 запрос на вуз при пяти вузах
// параллельно и получал HTTP 429 «You are making too many requests» на
// 32 запроса из 40 (замер 2026-07-21, Retry-After 19 секунд). Отказ по лимиту
// ловился общим `catch { return null }` и становился неотличим от «файла нет»,
// поэтому прогоны показывали «ничего не найдено», а не «нас притормозили».
// Штраф накопительный и живёт минутами — из-за этого откат кода не возвращал
// прежний результат: код был ни при чём, счётчик держался на стороне Wikimedia.
//
// Три правила, которые модуль обеспечивает:
//   1. Запросы к Wikimedia идут по одному, с паузой между ними.
//   2. HTTP 429 — это НЕ пустой ответ. Ждём Retry-After и повторяем; если
//      попытки кончились, бросаем ThrottledError, чтобы вызывающий не выдал
//      лимит за отсутствие данных.
//   3. Метаданные файлов берём пачкой: MediaWiki отдаёт до 50 титулов за
//      один запрос, значит 41 запрос превращается в один.

/** Отказ по лимиту. Отдельный тип, чтобы не путать с «данных нет». */
export class ThrottledError extends Error {
  constructor(url, retryAfter) {
    super(`Wikimedia притормозила запрос (429, Retry-After ${retryAfter}с): ${url}`);
    this.name = 'ThrottledError';
    this.retryAfter = retryAfter;
  }
}

// Wikimedia просит представляться честно и указывать контакт.
// https://foundation.wikimedia.org/wiki/Policy:User-Agent_policy
export const WIKI_UA =
  'StudyRoomCatalogBot/1.0 (https://github.com/kovylin1/studyroom-project-site; vassiliy.kovylin@gmail.com)';

export const MIN_INTERVAL_MS = 1100;  // не чаще примерно одного запроса в секунду
const MAX_RETRIES = 4;
const MAX_TITLES_PER_CALL = 50;       // предел MediaWiki для несоставных запросов

/** Счётчики прогона: сколько раз нас тормозили и сколько ждали. Для отчёта. */
export const wikiStats = { requests: 0, throttled: 0, waitedMs: 0, failed: 0 };

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Общая очередь на весь процесс: параллельные вузы не должны складывать
// свои запросы в одну пачку — именно это и вызывало 429.
let chain = Promise.resolve();
let lastAt = 0;

function schedule(task) {
  const run = chain.then(async () => {
    const gap = Date.now() - lastAt;
    if (gap < MIN_INTERVAL_MS) await sleep(MIN_INTERVAL_MS - gap);
    try { return await task(); } finally { lastAt = Date.now(); }
  });
  // Очередь не должна рваться из-за одной неудачи.
  chain = run.then(() => {}, () => {});
  return run;
}

/**
 * Запрос к API Wikimedia с очередью и уважением Retry-After.
 * @returns {Promise<object>} разобранный JSON
 * @throws {ThrottledError} если лимит не отпустил за MAX_RETRIES попыток
 */
export async function wikiFetchJson(url, { fetchImpl = fetch, retries = MAX_RETRIES } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await schedule(async () => {
      wikiStats.requests++;
      return fetchImpl(url, { headers: { 'user-agent': WIKI_UA, accept: 'application/json' } });
    });

    if (res.status === 429) {
      wikiStats.throttled++;
      // Заголовка может не быть — тогда наращиваем паузу сами.
      const hinted = parseInt(res.headers?.get?.('retry-after') || '', 10);
      // Ноль — законное значение «повторяй сразу», а не «заголовка нет».
      const waitS = Number.isFinite(hinted) && hinted >= 0 ? hinted : Math.min(60, 2 ** attempt * 5);
      if (attempt === retries) throw new ThrottledError(url, waitS);
      wikiStats.waitedMs += waitS * 1000;
      await sleep(waitS * 1000);
      continue;
    }

    if (!res.ok) { wikiStats.failed++; return null; }

    const text = await res.text();
    // Сервис отдаёт человеческий текст вместо JSON и на других отказах —
    // молча парсить его нельзя, иначе снова получим «пусто» вместо диагноза.
    if (!text.trimStart().startsWith('{')) { wikiStats.failed++; return null; }
    try { return JSON.parse(text); } catch { wikiStats.failed++; return null; }
  }
  return null;
}

/** Титулы, разбитые на пачки по пределу MediaWiki. */
export function chunkTitles(titles, size = MAX_TITLES_PER_CALL) {
  const uniq = [...new Set(titles.filter(Boolean))];
  const out = [];
  for (let i = 0; i < uniq.length; i += size) out.push(uniq.slice(i, i + size));
  return out;
}

const strip = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

/**
 * Разбор ответа imageinfo в провенанс. Без лицензии файл не берём:
 * CC BY-SA требует атрибуции, а выдумывать автора нельзя.
 * @returns {Array<{title,url,descriptionUrl,license,author}>}
 */
export function parseImageInfo(json) {
  const out = [];
  for (const page of Object.values(json?.query?.pages || {})) {
    const ii = page?.imageinfo?.[0];
    if (!ii) continue;
    const meta = ii.extmetadata || {};
    const license = strip(meta.LicenseShortName?.value);
    if (!license) continue;
    out.push({
      title: page.title,
      url: ii.thumburl || ii.url,
      descriptionUrl: ii.descriptionurl,
      license,
      author: strip(meta.Artist?.value) || null,
    });
  }
  return out;
}

const COMMONS = 'https://commons.wikimedia.org/w/api.php';

/** Метаданные пачки файлов Commons: до 50 титулов за один запрос. */
export async function commonsFiles(titles, opts = {}) {
  const out = [];
  for (const batch of chunkTitles(titles)) {
    const url = `${COMMONS}?action=query&format=json&formatversion=2&prop=imageinfo`
      + `&iiprop=url|extmetadata&iiurlwidth=1600&titles=${encodeURIComponent(batch.join('|'))}`;
    const j = await wikiFetchJson(url, opts);
    if (j) out.push(...parseImageInfo(j));
  }
  return out;
}

/**
 * Файлы Commons-категории вместе с метаданными — ОДНИМ запросом.
 * generator=categorymembers избавляет от отдельного обхода списка.
 */
export async function commonsCategoryFiles(category, { limit = 40, ...opts } = {}) {
  const url = `${COMMONS}?action=query&format=json&formatversion=2`
    + `&generator=categorymembers&gcmtype=file&gcmlimit=${limit}`
    + `&gcmtitle=${encodeURIComponent('Category:' + category)}`
    + `&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1600`;
  const j = await wikiFetchJson(url, opts);
  return j ? parseImageInfo(j) : [];
}

const WIKIDATA = 'https://www.wikidata.org/w/api.php';

export async function wikidataSearch(name, opts = {}) {
  const url = `${WIKIDATA}?action=wbsearchentities&format=json&language=en&limit=8&search=${encodeURIComponent(name)}`;
  const j = await wikiFetchJson(url, opts);
  return j?.search || [];
}

export async function wikidataEntityById(id, opts = {}) {
  const j = await wikiFetchJson(`https://www.wikidata.org/wiki/Special:EntityData/${id}.json`, opts);
  return j?.entities?.[id] || null;
}
