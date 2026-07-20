#!/usr/bin/env node
// backfill-from-extracts.mjs — Модуль 2: заполнить ПУСТЫЕ цены каталога из экстрактов
// (kaplan/gedu — единственные с ценой). Матч программ по normalize(title+level), fallback
// по токен-сету. Только пустые tuition.byProgram. Без фабрикации, без перетирания. $0 LLM.
// Валюта берётся только если совпадает с валютой вуза (иначе пропуск). Usage: [--dry]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CAT = path.join(__dirname, '..', 'site', 'src', 'content', 'universities');
const SRC = path.join(__dirname, 'sources');
const DRY = process.argv.includes('--dry');
const SOURCES = ['kaplan', 'gedu']; // только они несут feePerYear

const norm = (t, l) => `${t || ''}`.toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim() + '|' + (l || '');
const tokens = t => new Set(`${t || ''}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(w => w.length > 2));
const jaccard = (a, b) => { let i = 0; for (const x of a) if (b.has(x)) i++; return i / (a.size + b.size - i || 1); };

// extract-программы по слагу вуза
const exBySlug = new Map(); // slug → [{title, level, fee, ccy, tok}]
for (const s of SOURCES) {
  const dir = path.join(SRC, `${s}-extracts`);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
    let o; try { o = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { continue; }
    const arr = (o.programs || []).filter(p => p.feePerYear > 0).map(p => ({ key: norm(p.title, p.level), tok: tokens(p.title), fee: Math.round(p.feePerYear), ccy: p.currency || o.currency }));
    if (arr.length) exBySlug.set(o.slug, (exBySlug.get(o.slug) || []).concat(arr));
  }
}

let filled = 0, unisTouched = 0, noMatch = 0;
for (const [slug, ex] of exBySlug) {
  const fp = path.join(CAT, slug + '.json');
  if (!fs.existsSync(fp)) continue;
  const o = JSON.parse(fs.readFileSync(fp, 'utf8'));
  if (!o.tuition) continue;
  const uniCcy = o.tuition.currency;
  o.tuition.byProgram ??= {};
  const exact = new Map(); ex.forEach(e => { if (!exact.has(e.key)) exact.set(e.key, e); });
  let local = 0;
  for (const p of o.programs || []) {
    if (p.slug in o.tuition.byProgram) continue;       // уже есть цена — не трогаем
    let m = exact.get(norm(p.title, p.level));
    if (!m) { const pt = tokens(p.title); let best = 0; for (const e of ex) { const j = jaccard(pt, e.tok); if (j > best && j >= 0.6) { best = j; m = e; } } }
    if (!m) { noMatch++; continue; }
    if (m.ccy && m.ccy !== uniCcy) continue;            // валюта не совпала — пропуск
    o.tuition.byProgram[p.slug] = m.fee;
    p.source ??= 'kaplan/gedu';
    filled++; local++;
  }
  if (local && !DRY) fs.writeFileSync(fp, JSON.stringify(o, null, 2) + '\n');
  if (local) unisTouched++;
}

console.log((DRY ? '=== DRY ===' : '=== ПРИМЕНЕНО ==='));
console.log(`цен заполнено: ${filled}`);
console.log(`вузов затронуто: ${unisTouched}`);
console.log(`программ без матча в экстрактах: ${noMatch}`);
