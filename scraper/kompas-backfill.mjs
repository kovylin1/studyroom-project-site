#!/usr/bin/env node
// kompas-backfill.mjs — P2: добор настоящих цен из источников на ПУСТЫЕ места.
//
// Что делает: для каждого партнёрского вуза сопоставляет программы карточки с
// объединением её источников (та же логика, что kompas-diff) и, где у программы
// каталога ЦЕНЫ НЕТ, а источник её даёт — записывает цену источника. Осторожно:
//   - валюту вуза НЕ меняем (флип валюты — решение человека, не скрипт);
//   - цену пишем ТОЛЬКО если валюта источника == валюта карточки (иначе в кейс);
//   - существующие цены НЕ перетираем (только пустые);
//   - программы НЕ добавляем (это отдельное решение по sourceOnly);
//   - у заполненной программы проставляем source/confidence/checkedAt — провенанс.
// Возвращает настоящие OI-цены (kent/dundee/bradford…), снятые в P0.3, из выгрузок.
//
// Работа на копии catalog-work (правило 5). Запуск: node kompas-backfill.mjs [--apply]

import fs from 'node:fs/promises';
import path from 'node:path';
import { KOMPAS_DIR, args, logger } from './lib/kompas-collect.mjs';
import { normProgram, normCatalogProgram, similarity, isSubsetPair, SIM_THRESHOLD } from './lib/kompas-normalize.mjs';

const log = logger('backfill');
const APPLY = args.has('apply');
const WORK = path.join(KOMPAS_DIR, 'catalog-work');
const EXTRACTS = path.join(KOMPAS_DIR, 'extracts');
const GEDU_DIR = path.join(KOMPAS_DIR, '..', '..', 'scraper', 'sources', 'gedu-extracts');
const now = new Date().toISOString();

const SOURCES = {
  kaplan: path.join(EXTRACTS, 'kaplan'),
  'oxford-international': path.join(EXTRACTS, 'oxford-international'),
  qahe: path.join(EXTRACTS, 'qahe'),
  studygroup: path.join(EXTRACTS, 'studygroup'),
  edvoy: path.join(EXTRACTS, 'edvoy'),
  gedu: GEDU_DIR,
  direct: path.join(EXTRACTS, 'direct'),
  iapro: path.join(EXTRACTS, 'iapro'),
};

const readJson = async (f) => { try { return JSON.parse(await fs.readFile(f, 'utf8')); } catch { return null; } };

async function loadIndex() {
  const index = new Map();
  for (const [src, dir] of Object.entries(SOURCES)) {
    let files = [];
    try { files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json')); } catch { continue; }
    for (const f of files) {
      const data = await readJson(path.join(dir, f));
      if (!data) continue;
      const slug = data.catalogSlug ?? data.slug ?? f.replace(/\.json$/, '');
      if (!index.has(slug)) index.set(slug, []);
      index.get(slug).push({ src, data });
    }
  }
  return index;
}

function unionPrograms(entries) {
  const out = []; const byNorm = new Map();
  for (const { src, data } of entries) {
    for (const raw of data.programs ?? []) {
      const p = normProgram(raw, src, data.currency);
      if (!p.norm) continue;
      const seen = byNorm.get(p.norm);
      if (!seen) { byNorm.set(p.norm, p); out.push(p); continue; }
      if (!seen.fee && p.fee) seen.fee = p.fee;
      if (!seen.level && p.level) seen.level = p.level;
      seen.via = seen.via === p.via ? seen.via : `${seen.via}+${p.via}`;
    }
  }
  return out;
}

function pairPrograms(catalog, source) {
  const pairs = [];
  const srcByNorm = new Map();
  for (const p of source) if (!srcByNorm.has(p.norm)) srcByNorm.set(p.norm, p);
  const usedSrc = new Set(); const restCat = [];
  for (const c of catalog) {
    const hit = srcByNorm.get(c.norm);
    if (hit && !usedSrc.has(hit)) { pairs.push({ cat: c, src: hit }); usedSrc.add(hit); }
    else restCat.push(c);
  }
  const restSrc = source.filter((p) => !usedSrc.has(p));
  for (const c of restCat) {
    let best = null; let bestScore = 0;
    for (const s of restSrc) {
      if (usedSrc.has(s)) continue;
      if (isSubsetPair(c.title, s.title)) continue;
      const score = similarity(c.title, s.title);
      if (score > bestScore) { bestScore = score; best = s; }
    }
    if (best && bestScore >= SIM_THRESHOLD) { pairs.push({ cat: c, src: best }); usedSrc.add(best); }
  }
  return pairs;
}

async function main() {
  if (!APPLY) log('СУХОЙ ПРОГОН: только считаю. Для записи добавь --apply');
  const index = await loadIndex();
  const files = (await fs.readdir(WORK)).filter((f) => f.endsWith('.json'));

  const rows = []; const cases = [];
  let totalFilled = 0, totalDiffCur = 0, totalImplausible = 0, unisTouched = 0;

  for (const f of files) {
    const slug = f.replace(/\.json$/, '');
    const card = await readJson(path.join(WORK, f));
    if (!card) continue;
    const ps = card.partnerSource ?? { type: 'none', via: [] };
    if (ps.type === 'none') continue;
    const assigned = ps.type === 'direct' ? ['direct', ...(ps.via ?? [])] : (ps.via ?? []);
    const entries = (index.get(slug) ?? []).filter((e) => assigned.includes(e.src));
    if (!entries.length) continue;

    card.tuition = card.tuition ?? { currency: null, byProgram: {} };
    card.tuition.byProgram = card.tuition.byProgram ?? {};
    const bySlug = new Map((card.programs ?? []).map((p) => [p.slug, p]));

    const srcPrograms = unionPrograms(entries);
    const catPrograms = (card.programs ?? []).map((p) => normCatalogProgram(p, card));
    const pairs = pairPrograms(catPrograms, srcPrograms);

    // Валюта карточки. Если её нет — берём валюту большинства цен источника.
    let cur = card.tuition.currency;
    if (!cur) {
      const cnt = {};
      for (const { src } of pairs) if (src.fee) cnt[src.fee.currency] = (cnt[src.fee.currency] ?? 0) + 1;
      cur = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      if (cur && APPLY) card.tuition.currency = cur;
    }
    if (!cur) continue;

    let filled = 0, diffCur = 0, implausible = 0;
    for (const { cat, src } of pairs) {
      if (!src.fee || cat.fee) continue;                 // источник без цены или в каталоге уже есть
      if (src.fee.currency !== cur) { diffCur++; continue; } // валюта не та — в кейс, не пишем
      const amount = Math.round(src.fee.amount);
      // Коридор правдоподобия годовой платы: ниже — сбор за заявку/депозит, выше —
      // «весь курс» или опечатка. Такое не пишем скриптом, оставляем на панель.
      if (amount < 500 || amount > 200000) { implausible++; continue; }
      if (!(amount > 0)) continue;
      card.tuition.byProgram[cat.slug] = amount;
      const prog = bySlug.get(cat.slug);
      if (prog) { prog.source = prog.source || src.via; prog.confidence = prog.confidence ?? 0.7; prog.checkedAt = now; }
      filled++;
    }

    if (filled || diffCur || implausible) {
      totalFilled += filled; totalDiffCur += diffCur; totalImplausible += implausible;
      if (filled) unisTouched++;
      rows.push({ slug, filled, diffCur, implausible, cur });
      if (diffCur) cases.push({
        id: `${slug}||kompas_fee_currency_unfilled||${diffCur}`,
        slug, name: card.name, issue: 'kompas_fee_currency_unfilled', severity: 'info',
        detail: `${diffCur} цен источника НЕ записаны: валюта источника ≠ валюта карточки (${cur}). Смена валюты — решение человека, не добор.`,
        catalog: diffCur, official: null, program: null, sourceUrl: null,
        checkedAt: now, decision: null, decidedAt: null, applied: false,
      });
      if (filled && APPLY) {
        card.lastChecked = now.slice(0, 10);
        await fs.writeFile(path.join(WORK, f), JSON.stringify(card, null, 2) + '\n', 'utf8');
      }
    }
  }

  if (APPLY) await fs.writeFile(path.join(KOMPAS_DIR, 'backfill-review.json'),
    JSON.stringify({ generatedAt: now, scope: 'kompas-backfill', summary: { filled: totalFilled, currencySkipped: totalDiffCur, unis: unisTouched }, items: cases }, null, 2) + '\n', 'utf8');

  rows.sort((a, b) => b.filled - a.filled);
  console.log('Топ доборов:'); console.table(rows.slice(0, 20));
  console.log(`ИТОГО: заполнено цен ${totalFilled} в ${unisTouched} вузах; пропущено по валюте ${totalDiffCur}`);
  console.log(APPLY ? 'ПРИМЕНЕНО к catalog-work + кейсы' : 'СУХОЙ ПРОГОН — для записи добавь --apply');
}

main().catch((e) => { console.error(e); process.exit(1); });
