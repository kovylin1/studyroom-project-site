#!/usr/bin/env node
// orel-hunt.mjs — МОТЫЛЁК: поиск настоящих фото вузов (ОРЁЛ, срез 3).
//
// Источники по приоритету: офсайт вуза → Wikimedia через Wikidata.
// В КАТАЛОГ НЕ ПИШЕТ — это его главное ограничение. Кандидаты уходят в
// sources/photo-candidates.json, файлы — в site/public/photos/<slug>/hunt-N.jpg.
// Применяет их отдельный скрипт orel-apply.mjs после просмотра глазами.
//
// Usage:
//   node scraper/orel-hunt.mjs --worklist=sources/orel-pilot.json
//   node scraper/orel-hunt.mjs --slug=glasgow
//   node scraper/orel-hunt.mjs --limit=30 [--dry-run] [--concurrency=4]

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';
import { resolveOfficialSite, AGG_DOMAINS } from './lib/official-site.mjs';
import { fingerprint, hamming } from './lib/photo-fingerprint.mjs';
import {
  wikidataSearch, wikidataEntityById, commonsFiles, commonsCategoryFiles,
  ThrottledError, wikiStats, wikiFetchBuffer, isWikimediaHost,
} from './lib/wikimedia.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const CATALOG_DIR = path.join(PROJECT_ROOT, 'site/src/content/universities');
const PHOTOS_DIR = path.join(PROJECT_ROOT, 'site/public/photos');
const REGISTRY = path.join(__dirname, 'sources/photo-registry.json');
const AUDIT = path.join(__dirname, 'sources/audit/orel-audit.json');
const CANDIDATES_OUT = path.join(PROJECT_ROOT, 'sources/photo-candidates.json');

const arg = (p) => (process.argv.find(a => a.startsWith(p)) || '').slice(p.length);
const LIMIT = parseInt(arg('--limit=') || 'Infinity', 10);
const SLUG_FILTER = arg('--slug=') || null;
const WORKLIST = arg('--worklist=') || null;
const CONCURRENCY = parseInt(arg('--concurrency=') || '4', 10);
const DRY_RUN = process.argv.includes('--dry-run');
// Офсайт как источник — только по явному требованию, см. комментарий у шага 2.
const WITH_OFFICIAL = process.argv.includes('--with-official');

const NOW = new Date().toISOString();
const TODAY = NOW.slice(0, 10);
const log = (...a) => process.stderr.write(`[МОТЫЛЁК] ${new Date().toISOString().slice(11, 19)} ${a.join(' ')}\n`);

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';
// Короткая сторона. Было 800 — замер кандидатов пилота 3 показал, что вокруг
// этой границы живёт мусор: glasgow отдал полосу 2000x857 весом 93 КБ.
// Карточка вуза и галерея показывают фото крупно, 900 — нижняя честная планка.
const MIN_SIDE = 900;
// Байт на пиксель. Отличает нормальный JPEG от пережатого до артефактов:
// у glasgow-SVG вышло 0.001, у пережатых офсайтовых кадров 0.056–0.098,
// у нормальных снимков Wikimedia 0.2–0.5. Порог взят по этому замеру.
const MIN_BPP = 0.10;
// Насыщенность цвета: ниже этого считаем снимок архивным чёрно-белым.
const MIN_SAT = 0.03;
const WANT_PER_UNI = 5;        // сколько подтверждённых фото хотим набрать
const DHASH_NEAR = 6;          // ближе этого расстояния считаем «та же картинка»
// ТОЛЬКО страницы про кампус. Главная и общие страницы отдают в og:image
// последнюю новость вуза — пилот 2026-07-21 принёс оттуда рекламную плашку
// «ranked #1» и иллюстрацию к медновости. Подробности: sources/audit/orel-pilot-eyeball.md
const SITE_PATHS = ['/campus', '/campuses', '/our-campus', '/about/campus',
  '/about/campuses', '/campus-life', '/visit', '/about/our-campus', '/facilities'];

// Не-фотографии отсекаем по имени файла: логотипы, гербы, карты, иконки.
const JUNK_NAME = /(logo|icon|favicon|sprite|crest|seal|coat[-_ ]?of[-_ ]?arms|\bmap\b|banner|badge|placeholder|avatar|button|arrow|spinner|loader|pixel|blank)/i;

// Портреты людей: галерея вуза — про здания и кампус, а не про лица.
// Ловится только то, что выдаёт себя адресом; портрет с нейтральным именем
// файла отсечь без просмотра невозможно — это забота визуальной проверки.
const PERSON_NAME = /(portrait|headshot|profile|staff|faculty[-_]member|testimonial|student[-_ ]?stor|alumni|graduate[-_ ]?stor|people|alumn)/i;

/** Кандидат годен, если это фотография места, а не графика, миниатюра или портрет. */
function acceptable(fp, url) {
  if (JUNK_NAME.test(url)) return { ok: false, why: 'имя намекает на графику' };
  if (PERSON_NAME.test(url)) return { ok: false, why: 'похоже на портрет человека' };
  if (!fp.width || !fp.height) return { ok: false, why: 'не декодируется' };
  if (Math.min(fp.width, fp.height) < MIN_SIDE) return { ok: false, why: `мелкое ${fp.width}x${fp.height}` };
  const bpp = fp.bytes / (fp.width * fp.height);
  if (bpp < MIN_BPP) return { ok: false, why: `пережато ${bpp.toFixed(3)} байт/пиксель` };
  // Чёрно-белое = архив. У adelaide так прошло фото 1905 года: крупное,
  // не пережатое, с лицензией и автором — формально безупречное. Порог 0.03
  // взят по замеру 76 кандидатов: ниже него ровно 2 снимка (0.0000 и 0.0004),
  // следующий идёт с 0.0477, и ни один вуз при этом не теряется.
  // sat === null (цвет не измерился) НЕ отбраковываем: «не знаю» не равно «плохо».
  if (fp.sat !== null && fp.sat !== undefined && fp.sat < MIN_SAT) {
    return { ok: false, why: `чёрно-белое, похоже на архив (насыщенность ${fp.sat.toFixed(4)})` };
  }
  const ratio = fp.width / fp.height;
  // Галерея и шапка карточки горизонтальные: вертикальный кадр ломает вёрстку.
  if (ratio < 0.9) return { ok: false, why: `вертикальное ${fp.width}x${fp.height}` };
  if (ratio > 3.5) return { ok: false, why: `полоска ${ratio.toFixed(2)}` };
  return { ok: true };
}

async function fetchText(url, ms = 12000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA }, signal: ac.signal, redirect: 'follow' });
    if (!r.ok) return null;
    const ct = r.headers.get('content-type') || '';
    if (!ct.includes('html')) return null;
    return await r.text();
  } catch { return null; } finally { clearTimeout(t); }
}

async function fetchBuf(url, ms = 20000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA }, signal: ac.signal, redirect: 'follow' });
    if (!r.ok) return null;
    const ct = r.headers.get('content-type') || '';
    // image/svg+xml проходил проверку «начинается с image/», и векторная графика
    // попадала в галерею под именем .jpg: у glasgow так пролез логотип-SVG,
    // причём sharp его отрисовал и отпечаток выглядел как у фотографии 1792x1792.
    if (!ct.startsWith('image/') || ct.includes('svg')) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length <= 200) return null;
    // Заголовок надёжнее content-type: сервер может соврать про тип.
    const head = buf.subarray(0, 5).toString('latin1');
    if (head.startsWith('<?xml') || head.startsWith('<svg')) return null;
    return buf;
  } catch { return null; } finally { clearTimeout(t); }
}

// AGG_DOMAINS — регулярка, а не список: .some() на ней молча падал в catch
// и объявлял агрегатором каждый сайт подряд.
const isAggHost = (u) => {
  try { return AGG_DOMAINS.test(new URL(u).hostname); }
  catch { return true; }
};

/** Ссылки на картинки со страницы: og:image в первую очередь, затем крупные <img>. */
function imageUrlsFrom(html, pageUrl) {
  const $ = cheerio.load(html);
  const out = [];
  const push = (raw) => {
    if (!raw) return;
    try { out.push(new URL(raw, pageUrl).href); } catch { /* мусорная ссылка */ }
  };
  $('meta[property="og:image"], meta[name="og:image"], meta[property="twitter:image"]').each((_, el) => push($(el).attr('content')));
  $('img').each((_, el) => {
    const $el = $(el);
    // srcset даёт самый крупный вариант — берём последний источник.
    const srcset = $el.attr('srcset');
    if (srcset) push(srcset.split(',').pop().trim().split(/\s+/)[0]);
    push($el.attr('src') || $el.attr('data-src'));
  });
  return [...new Set(out)].filter(u => /^https?:/.test(u) && !JUNK_NAME.test(u));
}

/**
 * Wikidata → сущность вуза. Две независимые проверки тождества:
 *   (а) адрес офсайта в Wikidata (P856) совпадает с нашим — сильная проверка,
 *       переживает любые расхождения в написании названия;
 *   (б) точное совпадение label — запасная, когда офсайт неизвестен.
 * Плюс P31 обязан быть учебным заведением — иначе auburn уводит на спортклуб
 * (эта защита взята из discover-official-sites.mjs, проверена на 59 адресах).
 */
async function wikidataEntity(name, officialUrl) {
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch { return null; } };
  const ourHost = host(officialUrl);
  // Ведущий артикль срезаем: у нас в каталоге «The University of Melbourne»,
  // в Wikidata метка «University of Melbourne». Совпадение по названию не
  // срабатывало, а офсайт у этого вуза null, поэтому запасная проверка по
  // адресу тоже молчала — вуз выпадал целиком. Замер: таких 18, без кандидатов
  // из них 14 (Melbourne, UNSW, Sydney, Akron и другие).
  const norm = (s) => String(s || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').replace(/^the /, '').trim();
  // Ищем БЕЗ ведущего артикля: по запросу «The University of Sydney» Wikidata
  // отдаёт статьи про кохлеарные импланты, а сам вуз в восьмёрку не попадает.
  // Сверку тождества ниже это не ослабляет — она по-прежнему строгая.
  const query = String(name || '').replace(/^\s*the\s+/i, '');
  for (const hit of await wikidataSearch(query)) {
    // Дешёвая проверка ПЕРВОЙ, до запроса карточки сущности: и однофамильцев
    // отсекает, и не создаёт лишней нагрузки на Wikidata.
    const labelMatches = norm(hit.label) === norm(name);
    if (!labelMatches && !ourHost) continue;

    const ent = await wikidataEntityById(hit.id);
    if (!ent) continue;

    // Q3918 университет, Q38723 вуз, Q189004 колледж, Q9826 школа, Q2385804 учебное заведение
    const EDU = ['Q3918', 'Q38723', 'Q189004', 'Q9826', 'Q2385804', 'Q875538', 'Q4671277'];
    const p31 = (ent.claims?.P31 || []).map(c => c.mainsnak?.datavalue?.value?.id);
    if (!p31.some(id => EDU.includes(id))) continue;

    // Проверки независимы: достаточно любой.
    if (labelMatches) return ent;
    const theirHost = host(ent.claims?.P856?.[0]?.mainsnak?.datavalue?.value);
    if (ourHost && theirHost && ourHost === theirHost) return ent;
  }
  return null;
}

/**
 * Кандидаты из Wikimedia. Раньше здесь уходил 41 отдельный запрос на вуз,
 * и Wikimedia отвечала 429 на большинство из них; ответ терялся в catch и
 * выглядел как «фото нет». Теперь категория и метаданные берутся пачками —
 * два запроса вместо сорока одного.
 */
async function wikimediaCandidates(uni, officialUrl) {
  const ent = await wikidataEntity(uni.name, officialUrl);
  if (!ent) return [];

  const files = [];
  // P18 — главное изображение сущности, почти всегда здание. Оно первое.
  const p18 = ent.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
  if (p18) files.push(...await commonsFiles(['File:' + p18]));

  const cat = ent.claims?.P373?.[0]?.mainsnak?.datavalue?.value;
  if (cat) files.push(...await commonsCategoryFiles(cat, { limit: 40 }));

  const seen = new Set();
  return files
    .filter(f => f.url && !seen.has(f.title) && seen.add(f.title))
    .map(f => ({ url: f.url, source: f.descriptionUrl, license: f.license, author: f.author }));
}

async function main() {
  const registry = JSON.parse(await fs.readFile(REGISTRY, 'utf8'));
  const audit = JSON.parse(await fs.readFile(AUDIT, 'utf8'));

  // Отпечатки ЧУЖИХ фото: то, что уже стоит у других вузов, втягивать заново нельзя.
  const knownBySlug = new Map();  // slug -> Set(sha1)
  const allDhash = [];            // { sha1, dhash, slugs:Set }
  for (const rec of registry) {
    if (!rec.sha1) continue;
    const slugs = new Set(rec.usedBy.map(u => u.slug));
    for (const s of slugs) {
      if (!knownBySlug.has(s)) knownBySlug.set(s, new Set());
      knownBySlug.get(s).add(rec.sha1);
    }
    if (rec.dhash) allDhash.push({ sha1: rec.sha1, dhash: rec.dhash, slugs });
  }

  let slugs;
  if (WORKLIST) slugs = JSON.parse(await fs.readFile(path.resolve(PROJECT_ROOT, WORKLIST), 'utf8'));
  else if (SLUG_FILTER) slugs = [SLUG_FILTER];
  else slugs = audit.gaps.map(g => g.slug);
  if (Number.isFinite(LIMIT)) slugs = slugs.slice(0, LIMIT);
  log(`вузов к обходу: ${slugs.length}${DRY_RUN ? ' (сухой прогон)' : ''}`);

  const candidates = [];
  // Отпечатки принятых В ЭТОМ ПРОГОНЕ. Реестр знает только то, что уже лежит
  // в каталоге, поэтому два вуза в одном прогоне могли получить одну картинку
  // из общей Commons-категории — и мы бы своими руками завели новый сток.
  const takenThisRun = [];
  const stats = { withCandidates: 0, noOfficialSite: 0, nothingFound: 0, rejected: 0, throttledUnis: 0 };

  const runOne = async (slug) => {
    let uni;
    try { uni = JSON.parse(await fs.readFile(path.join(CATALOG_DIR, `${slug}.json`), 'utf8')); }
    catch { return; }

    const official = resolveOfficialSite(uni);
    const found = [];
    const seenHere = [];

    /** Общая проверка кандидата: годен, не чужой, не повтор внутри прогона. */
    const consider = async (url, meta) => {
      if (found.length >= WANT_PER_UNI) return;
      // Картинки Wikimedia качаем через ту же очередь, что и её API: иначе
      // upload.wikimedia.org отвечает 429, а обычный fetchBuf выдаёт это за
      // «картинки нет». Ровно этот недочёт срезал покрытие пилота 4 с 5 до 4.
      const buf = isWikimediaHost(url) ? await wikiFetchBuffer(url) : await fetchBuf(url);
      if (!buf) return;
      const fp = await fingerprint(buf);
      const verdict = acceptable(fp, url);
      if (!verdict.ok) { stats.rejected++; return; }
      // Уже есть у ЭТОГО вуза — не дублируем.
      if (knownBySlug.get(slug)?.has(fp.sha1)) return;
      // Стоит у ДРУГОГО вуза — это тот самый сток, который мы вычищаем.
      const clash = allDhash.find(d =>
        (d.sha1 === fp.sha1 || hamming(d.dhash, fp.dhash) <= DHASH_NEAR) &&
        [...d.slugs].some(s => s !== slug));
      if (clash) { stats.rejected++; return; }
      // Повтор внутри этого вуза.
      if (seenHere.some(d => hamming(d, fp.dhash) <= DHASH_NEAR)) return;
      // Повтор с ДРУГИМ вузом этого же прогона — иначе сами создадим новый сток.
      if (takenThisRun.some(t => t.slug !== slug && hamming(t.dhash, fp.dhash) <= DHASH_NEAR)) {
        stats.rejected++;
        return;
      }
      seenHere.push(fp.dhash);
      takenThisRun.push({ slug, dhash: fp.dhash });
      found.push({ buf, fp, url, ...meta });
    };

    // 1. Wikimedia — ОСНОВНОЙ источник. В Commons-категорию вуза загружают
    //    именно снимки зданий; офсайт же оптимизирован под новости.
    //    Порядок выбран не из теории, а по результату пилота (6 брака из 7).
    let wiki = [];
    try {
      wiki = await wikimediaCandidates(uni, official);
    } catch (e) {
      // Лимит — не «фото нет». Считаем отдельно, иначе отчёт соврёт.
      if (e instanceof ThrottledError) { stats.throttledUnis++; log(`${slug}: ЛИМИТ Wikimedia, пропуск`); }
      else throw e;
    }
    for (const c of wiki) {
      if (found.length >= WANT_PER_UNI) break;
      await consider(c.url, { imgSource: c.source, imgLicense: c.license, imgAuthor: c.author });
    }

    // 2. Офсайт добором — ВЫКЛЮЧЕН по умолчанию (решение владельца 2026-07-21).
    //    Замер пилота 3 глазами: Wikimedia 4 годных из 5, офсайт 2 из 6, при этом
    //    офсайт давал 26 кандидатов из 31 — то есть худший источник тащил объём.
    //    Мимо фильтров проходят люди на первом плане, ИИ-сток (fresenius публикует
    //    сгенерированные портреты у себя) и векторная графика. Отличить это от
    //    здания без просмотра нельзя. Включается флагом --with-official.
    if (WITH_OFFICIAL && found.length < WANT_PER_UNI) {
      if (official && !isAggHost(official)) {
        for (const p of SITE_PATHS) {
          if (found.length >= WANT_PER_UNI) break;
          const pageUrl = new URL(p, official).href;
          const html = await fetchText(pageUrl);
          if (!html) continue;
          for (const img of imageUrlsFrom(html, pageUrl).slice(0, 15)) {
            if (found.length >= WANT_PER_UNI) break;
            await consider(img, { imgSource: pageUrl, imgLicense: 'official-site', imgAuthor: null });
          }
        }
      } else {
        stats.noOfficialSite++;
      }
    }

    if (!found.length) { stats.nothingFound++; log(`${slug}: пусто`); return; }
    stats.withCandidates++;

    for (let i = 0; i < found.length; i++) {
      const f = found[i];
      const rel = `/photos/${slug}/hunt-${i + 1}.jpg`;
      if (!DRY_RUN) {
        await fs.mkdir(path.join(PHOTOS_DIR, slug), { recursive: true });
        await fs.writeFile(path.join(PROJECT_ROOT, 'site/public', rel), f.buf);
      }
      candidates.push({
        slug, img: rel, fetchedFrom: f.url,
        imgSource: f.imgSource, imgLicense: f.imgLicense, imgAuthor: f.imgAuthor,
        imgCheckedAt: TODAY,
        sha1: f.fp.sha1, dhash: f.fp.dhash, width: f.fp.width, height: f.fp.height,
      });
    }
    log(`${slug}: кандидатов ${found.length}`);
  };

  // Пул фиксированной ширины: вузы обрабатываются параллельно, но не все разом.
  const queue = [...slugs];
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (queue.length) {
      const s = queue.shift();
      try { await runOne(s); } catch (e) { log(`${s}: ОШИБКА ${e.message}`); }
    }
  }));

  // Состояние сети — часть отчёта. Без него «нашли мало» не отличить от
  // «нас тормозили», а именно на этом прошлый заход потерял три прогона.
  const net = { ...wikiStats, waitedSec: Math.round(wikiStats.waitedMs / 1000) };
  log(`Wikimedia: запросов ${net.requests}, торможений ${net.throttled}, ждали ${net.waitedSec}с, неудачных ответов ${net.failed}`);
  if (net.throttled) log(`ВНИМАНИЕ: лимит срабатывал ${net.throttled} раз — покрытие могло пострадать, не считайте его окончательным`);

  const report = { generatedAt: NOW, dryRun: DRY_RUN, requested: slugs.length, stats, network: net, candidates };
  if (DRY_RUN) {
    log(`СУХОЙ ПРОГОН — файлы и список не пишем. ${JSON.stringify(stats)}`);
    return;
  }
  await fs.mkdir(path.dirname(CANDIDATES_OUT), { recursive: true });

  // ТОЧЕЧНЫЙ прогон не имеет права стирать чужие результаты. Догон по 16 вузам
  // уже снёс 1225 кандидатов массового прогона — спасла только резервная копия,
  // сделанная руками. Та же болезнь была у СОРОКИ, поэтому лечим в коде:
  // обойдённые вузы обновляем, всех прочих переносим как есть.
  const scoped = Boolean(WORKLIST || SLUG_FILTER || Number.isFinite(LIMIT));
  if (scoped) {
    const touched = new Set(slugs);
    let prev = [];
    try {
      prev = JSON.parse(await fs.readFile(CANDIDATES_OUT, 'utf8')).candidates || [];
    } catch { /* первого прогона ещё не было */ }
    const kept = prev.filter(c => !touched.has(c.slug));
    if (kept.length) {
      report.candidates = [...kept, ...candidates];
      report.stats.withCandidates = new Set(report.candidates.map(c => c.slug)).size;
      report.scope = `частичный: ${slugs.length} вузов, перенесено чужих кандидатов ${kept.length}`;
      log(`частичный прогон: перенесено ${kept.length} кандидатов по вузам вне списка`);
    }
  }

  await fs.writeFile(CANDIDATES_OUT, JSON.stringify(report, null, 1) + '\n');
  log(`готово. кандидатов ${candidates.length} у ${stats.withCandidates} вузов из ${slugs.length}. ${JSON.stringify(stats)}`);
}

// Экспорт ради замеров: пробник импортирует НАСТОЯЩИЕ функции, а не их копию —
// копия расходится с оригиналом ровно там, где ищешь ошибку.
export { wikidataEntity, wikimediaCandidates, acceptable };

// main() запускается только при прямом вызове из командной строки.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(e => { log('ФАТАЛЬНО:', e.message); process.exit(1); });
}
