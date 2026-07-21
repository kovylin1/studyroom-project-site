#!/usr/bin/env node
// orel-apply.mjs — применение найденных фото.
//
// ГЛАВНОЕ ОГРАНИЧЕНИЕ: замена строго 1:1. Чужое фото исчезает только тогда,
// когда на его место встало проверенное. Число фото у вуза не уменьшается
// никогда, из каталога ничего не удаляется — меняется значение поля img
// и дописывается провенанс.
//
// Автозамена ТОЛЬКО при всех условиях сразу:
//   1. кандидат с Wikimedia, и у него заполнены И лицензия, И автор
//      (CC BY-SA требует атрибуции — без автора публиковать нельзя);
//   2. отпечаток не совпадает с фото другого вуза в реестре (это проверил
//      orel-hunt при отборе, здесь перепроверяем по свежему реестру);
//   3. файл кандидата реально лежит на диске.
// Всё остальное → кейс в site/public/api/orel-review.json для оператора.
//
// Офсайт как источник автозамены НЕ принимается (решение владельца 2026-07-21):
// пилот 3 глазами дал по офсайту 2 годных из 6 — мимо фильтров проходят люди
// на первом плане, ИИ-сток и векторная графика. Такие кандидаты идут в кейсы.
//
// Домены замены — только gallery и campuses. Карточки accommodation этот скрипт
// не трогает вообще: фото общежитий разбираются вместе с 1529 кейсами БОБРа.
//
// Usage: node scraper/orel-apply.mjs [--slug=<uni>] [--dry-run] [--auto-only]

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CATALOG = path.join(ROOT, 'site/src/content/universities');
const PUBLIC = path.join(ROOT, 'site/public');
const CANDIDATES = path.join(ROOT, 'sources/photo-candidates.json');
const REGISTRY = path.join(__dirname, 'sources/photo-registry.json');
const REVIEW_OUT = path.join(PUBLIC, 'api/orel-review.json');

const arg = (p) => (process.argv.find(a => a.startsWith(p)) || '').slice(p.length);
const SLUG_FILTER = arg('--slug=') || null;
const DRY_RUN = process.argv.includes('--dry-run');
const AUTO_ONLY = process.argv.includes('--auto-only');
// --no-auto: НИЧЕГО не применять автоматически, всё отправить оператору в панель.
// Нужен потому, что порог автозамены (Wikimedia + лицензия + автор) пропускает
// исторические снимки: у adelaide так прошло архивное фото 1905 года с конной
// процессией — провенанс идеальный, а на карточке вуза ему не место.
const NO_AUTO = process.argv.includes('--no-auto');

const NOW = new Date().toISOString();
const TODAY = NOW.slice(0, 10);
const log = (...a) => process.stderr.write(`[ОРЁЛ-apply] ${a.join(' ')}\n`);

// Порядок замены: сначала худшее. verified не трогаем никогда.
const REPLACE_ORDER = ['stock', 'shared', 'unknown'];

/**
 * Годен ли кандидат к АВТОМАТИЧЕСКОЙ замене.
 * @returns {{ok:true}|{ok:false,why:string}}
 */
export function autoEligible(cand, { onDisk, clashSlugs }) {
  if (cand.imgLicense === 'official-site') return { ok: false, why: 'источник — офсайт, нужен просмотр глазами' };
  if (!cand.imgLicense) return { ok: false, why: 'нет лицензии' };
  if (!cand.imgAuthor) return { ok: false, why: 'нет автора — CC BY-SA требует атрибуции' };
  if (!cand.imgSource) return { ok: false, why: 'нет ссылки на источник' };
  if (!onDisk) return { ok: false, why: 'файл кандидата не найден на диске' };
  if (clashSlugs?.length) return { ok: false, why: `такое же фото стоит у: ${clashSlugs.join(', ')}` };
  return { ok: true };
}

/** Ссылки на фото вуза в доменах, которые ОРЁЛ вправе менять. */
function slots(uni) {
  const out = [];
  (uni.gallery?.items ?? []).forEach((it, i) => out.push({ domain: 'gallery', i, item: it }));
  (uni.campuses ?? []).forEach((c, i) => out.push({ domain: 'campuses', i, item: c }));
  return out;
}

function applyTo(item, cand) {
  item.img = cand.img;
  item.imgKind = 'verified';
  item.imgSource = cand.imgSource;
  item.imgLicense = cand.imgLicense;
  if (cand.imgAuthor) item.imgAuthor = cand.imgAuthor;
  item.imgCheckedAt = TODAY;
}

async function main() {
  const report = JSON.parse(await fs.readFile(CANDIDATES, 'utf8'));
  const registry = JSON.parse(await fs.readFile(REGISTRY, 'utf8'));

  // Кто ещё использует такой же отпечаток. Пересчитываем по свежему реестру:
  // в срезе 3 проверка по путям из СТАРОГО замера уже один раз чуть не выдала
  // ложный вывод, поэтому здесь читаем реестр заново, а не доверяем orel-hunt.
  const slugsBySha = new Map();
  for (const rec of registry) {
    if (!rec.sha1) continue;
    if (!slugsBySha.has(rec.sha1)) slugsBySha.set(rec.sha1, new Set());
    for (const u of rec.usedBy) slugsBySha.get(rec.sha1).add(u.slug);
  }

  const bySlug = new Map();
  for (const c of report.candidates) {
    if (SLUG_FILTER && c.slug !== SLUG_FILTER) continue;
    if (!bySlug.has(c.slug)) bySlug.set(c.slug, []);
    bySlug.get(c.slug).push(c);
  }

  const cases = [];
  const stats = { applied: 0, appended: 0, unisChanged: 0, cases: 0, skipped: 0 };

  for (const [slug, cands] of [...bySlug].sort()) {
    const file = path.join(CATALOG, `${slug}.json`);
    let uni;
    try { uni = JSON.parse(await fs.readFile(file, 'utf8')); }
    catch { log(`${slug}: файла каталога нет, пропуск`); continue; }

    // Заменяемые места, худшие первыми. verified исключён.
    const free = slots(uni)
      .filter(s => REPLACE_ORDER.includes(s.item.imgKind || 'unknown'))
      .sort((a, b) => REPLACE_ORDER.indexOf(a.item.imgKind || 'unknown')
        - REPLACE_ORDER.indexOf(b.item.imgKind || 'unknown'));

    let touched = false;
    for (const cand of cands) {
      const onDisk = await fs.access(path.join(PUBLIC, cand.img.replace(/^\//, '')))
        .then(() => true).catch(() => false);
      const others = [...(slugsBySha.get(cand.sha1) || [])].filter(s => s !== slug);
      const verdict = NO_AUTO
        ? { ok: false, why: 'режим «только кейсы» — решает оператор' }
        : autoEligible(cand, { onDisk, clashSlugs: others });

      if (!verdict.ok) {
        stats.skipped++;
        if (!AUTO_ONLY) {
          // Формат кейса — тот же, что у СОРОКИ и БОБРа: панель уже умеет его читать.
          cases.push({
            id: `${slug}||orel_needs_eyes||photo||${cand.img}`,
            slug, name: uni.name || slug,
            issue: 'orel_needs_eyes', severity: 'info',
            detail: verdict.why,
            domain: 'photo',
            candidate: {
              img: cand.img, imgSource: cand.imgSource, imgLicense: cand.imgLicense,
              imgAuthor: cand.imgAuthor, width: cand.width, height: cand.height,
            },
            checkedAt: NOW, decision: null, decidedAt: null, applied: false,
          });
          stats.cases++;
        }
        continue;
      }

      const slot = free.shift();
      if (slot) {
        applyTo(slot.item, cand);
        stats.applied++;
      } else {
        // Кандидатов больше, чем непроверенных фото — лишнее ДОБАВЛЯЕМ,
        // а не выбрасываем: терять найденное фото незачем.
        uni.gallery = uni.gallery || {};
        uni.gallery.items = uni.gallery.items || [];
        const item = { img: cand.img, caption: uni.name || slug };
        applyTo(item, cand);
        uni.gallery.items.push(item);
        stats.appended++;
      }
      touched = true;
    }

    if (touched) {
      stats.unisChanged++;
      if (!DRY_RUN) await fs.writeFile(file, JSON.stringify(uni, null, 2) + '\n');
    }
  }

  if (DRY_RUN) {
    log(`СУХОЙ ПРОГОН — ничего не записано. ${JSON.stringify(stats)}`);
    return;
  }

  await fs.mkdir(path.dirname(REVIEW_OUT), { recursive: true });
  // Решения оператора живут в этом же файле — принятые сохраняем.
  // Точечный прогон (--slug) НЕ должен сужать общий список: этим уже отличилась
  // СОРОКА, поэтому чужие кейсы переносим целиком.
  let kept = [];
  try {
    const prev = JSON.parse(await fs.readFile(REVIEW_OUT, 'utf8'));
    kept = (prev.items || []).filter(c =>
      c.decision !== null || (SLUG_FILTER && c.slug !== SLUG_FILTER));
  } catch { /* первого прогона ещё не было */ }
  const keptIds = new Set(kept.map(c => c.id));
  const items = [...kept, ...cases.filter(c => !keptIds.has(c.id))];

  await fs.writeFile(REVIEW_OUT, JSON.stringify({
    generatedAt: NOW, scope: SLUG_FILTER || 'all',
    summary: stats, items,
  }, null, 1) + '\n');

  log(`готово. заменено ${stats.applied}, добавлено ${stats.appended}, вузов ${stats.unisChanged}, кейсов ${items.length}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(e => { log('ФАТАЛЬНО:', e.message); process.exit(1); });
}
