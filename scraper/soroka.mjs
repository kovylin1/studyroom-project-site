#!/usr/bin/env node
// soroka.mjs — СОРОКА: директор достоверных цифр.
// Проверяет числовые факты каталога: tuition программ, цены жилья,
// keyFacts-цифры, IELTS/GPA. Три прохода:
//   1. Кросс-сверка с extracts на диске ($0)
//   2. Санити-диапазоны по валюте/типу факта ($0)
//   3. Живая точечная проверка офсайта — ТОЛЬКО для спорных цифр (кап --max-live)
//
// Гибридное применение:
//   - авто-запись в каталог ТОЛЬКО official-подтверждённых цифр (confidence ≥ 0.85)
//   - всё остальное → кейсы в site/public/api/soroka-review.json (формат РЕВИЗОРА)
//   - полный отчёт → sources/audit/soroka-report.json
//
// Usage: node scraper/soroka.mjs [--slug=X] [--limit=N] [--dry-run] [--skip-live]
//                                [--max-live=N] [--concurrency=N]
// Каталог только обогащается — НИКОГДА ничего не удаляем.

import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { scoreFact, MIN_CONFIDENCE, passes } from './lib/confidence.mjs';
import {
  parseMoney, parseMoneyFirst, tuitionPlausible, accommodationPlausible,
  ieltsPlausible, toeflPlausible, gpaPlausible, extractKeyFactNumbers,
  keyFactPlausible, relDiff, CORROBORATE_TOL, MISMATCH_TOL,
} from './lib/numbers.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const CATALOG_DIR = path.join(PROJECT_ROOT, 'site', 'src', 'content', 'universities');
// Extracts разложены по двум корням: scraper/sources (official, qahe)
// и корневой sources (edvoy, studygroup, …) — ищем в обоих.
const SOURCES_ROOTS = [path.join(__dirname, 'sources'), path.join(PROJECT_ROOT, 'sources')];
const AUDIT_DIR = path.join(PROJECT_ROOT, 'sources', 'audit');
const REVIEW_OUT = path.join(PROJECT_ROOT, 'site', 'public', 'api', 'soroka-review.json');
const REPORT_OUT = path.join(AUDIT_DIR, 'soroka-report.json');
const APPLIED_OUT = path.join(AUDIT_DIR, 'soroka-applied.json');

// Каталоги extracts с programs[].tuition (если каталога нет на диске — молча пропускаем).
const EXTRACT_DIRS = ['edvoy-extracts', 'qahe-extracts', 'gedu-extracts', 'iapro-extracts', 'official-extracts'];

// Карта алиасов слагов (каталог → extract): вузы с расходящимися слагами
// (abertay ↔ abertay-university) тоже кросс-сверяются. Генерится build-slug-aliases.mjs.
let SLUG_ALIASES = {};
try {
  SLUG_ALIASES = JSON.parse(await fs.readFile(path.join(PROJECT_ROOT, 'scraper/sources/slug-aliases.json'), 'utf8')).aliases || {};
} catch { /* карты ещё нет — работаем без алиасов */ }
const AGG_DOMAINS = /edvoy|studygroup|kaplan|navitas|catseducation|qs\.com|topuniversities|collab|wikipedia/i;

const arg = (p) => (process.argv.find(a => a.startsWith(p)) || '').slice(p.length) || null;
const SLUG_FILTER = arg('--slug=');
const LIMIT = arg('--limit=') ? parseInt(arg('--limit='), 10) : Infinity;
const DRY_RUN = process.argv.includes('--dry-run');
const SKIP_LIVE = process.argv.includes('--skip-live');
const MAX_LIVE = parseInt(arg('--max-live=') || '25', 10);
const CONCURRENCY = parseInt(arg('--concurrency=') || '4', 10);

const NOW = new Date().toISOString();
const round2 = (n) => Math.round(n * 100) / 100;
const log = (...a) => process.stderr.write(`[СОРОКА] ${new Date().toISOString().slice(11, 19)} ${a.join(' ')}\n`);

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';
async function fetchPage(url, timeoutMs = 9000) {
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: ac.signal, redirect: 'follow' });
    clearTimeout(timer);
    return { status: r.status, ok: r.ok, finalUrl: r.url, html: r.ok ? await r.text() : '' };
  } catch (e) {
    return { status: 0, ok: false, finalUrl: url, html: '', err: e.message };
  }
}

const normTitle = (s) => String(s || '').toLowerCase().normalize('NFKD')
  .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();

// Edvoy "Postgraduate" → уровень каталога (null = не судим).
function mapLevel(raw) {
  const t = String(raw || '').toLowerCase();
  if (/post|master|msc|mba/.test(t)) return 'master';
  if (/under|bachelor|bsc/.test(t)) return 'bachelor';
  if (/found|pathway/.test(t)) return 'foundation';
  if (/phd|doctor/.test(t)) return 'phd';
  return null;
}

// ── Загрузка extracts по слагу ────────────────────────────────────────────────

async function loadExtracts(slug) {
  const out = [];
  // Сначала пробуем точный слаг, затем алиасы (extract под другим именем).
  const candidates = [slug, ...(SLUG_ALIASES[slug] || [])];
  for (const dir of EXTRACT_DIRS) {
    const f = candidates
      .flatMap(c => SOURCES_ROOTS.map(r => path.join(r, dir, `${c}.json`)))
      .find(existsSync);
    if (!f) continue;
    try {
      const j = JSON.parse(await fs.readFile(f, 'utf8'));
      out.push({ source: dir.replace('-extracts', ''), tier: dir === 'official-extracts' ? 'official' : 'aggregator', data: j });
    } catch { /* битый extract — не валим проверку */ }
  }
  return out;
}

// ── Проверки одного вуза ─────────────────────────────────────────────────────

function checkTuition(u, extracts, cases, stats) {
  const currency = u.tuition?.currency;
  const byProgram = u.tuition?.byProgram || {};
  const programs = new Map((u.programs || []).map(p => [p.slug, p]));
  // индекс extract-программ по нормализованному названию
  const extIndex = [];
  for (const ex of extracts) {
    for (const p of ex.data?.programs || []) {
      const money = parseMoneyFirst(p.tuition);
      if (!money) continue;
      extIndex.push({ source: ex.source, tier: ex.tier, norm: normTitle(p.title), level: mapLevel(p.level), money });
    }
  }

  for (const [pSlug, amount] of Object.entries(byProgram)) {
    const prog = programs.get(pSlug);
    if (!prog || !Number.isFinite(amount)) continue;
    stats.facts++;

    // 2. санити-диапазон (0 — отдельный класс бага: «цена неизвестна» записана нулём)
    if (amount === 0) {
      stats.outliers++;
      cases.push({
        id: `${u.slug}||tuition_zero||${pSlug}`,
        slug: u.slug, name: u.name, issue: 'tuition_zero', severity: 'warning',
        detail: `Tuition «${prog.title}» = 0 ${currency} — цена не заполнена`,
        catalog: 0, official: null, program: pSlug,
        checkedAt: NOW, decision: null, decidedAt: null, applied: false,
      });
    } else if (tuitionPlausible(amount, currency, prog.level) === false) {
      stats.outliers++;
      cases.push({
        id: `${u.slug}||tuition_outlier||${pSlug}`,
        slug: u.slug, name: u.name, issue: 'tuition_outlier', severity: 'warning',
        detail: `Tuition «${prog.title}»: ${amount} ${currency} вне диапазона для ${currency}`,
        catalog: amount, official: null, program: pSlug,
        checkedAt: NOW, decision: null, decidedAt: null, applied: false,
      });
    }

    // 1. кросс-сверка
    const norm = normTitle(prog.title);
    // Только точное совпадение названия: Edvoy-уровни (Undergraduate/Postgraduate)
    // грубее каталожных (short-course, foundation…) — фильтр по уровню отбрасывал
    // валидные пары, а коллизия «один title, разные уровни» при exact-match редка.
    const matches = extIndex.filter(e => e.norm === norm);
    if (!matches.length) continue; // нет источников — нечего сверять
    for (const m of matches) {
      if (m.money.currency && currency && m.money.currency !== currency) {
        cases.push({
          id: `${u.slug}||tuition_currency||${pSlug}||${m.source}`,
          slug: u.slug, name: u.name, issue: 'tuition_currency_mismatch', severity: 'warning',
          detail: `«${prog.title}»: каталог в ${currency}, ${m.source} в ${m.money.currency} (${m.money.amount})`,
          catalog: amount, official: m.money.amount, program: pSlug,
          checkedAt: NOW, decision: null, decidedAt: null, applied: false,
        });
        continue;
      }
      const d = relDiff(amount, m.money.amount);
      if (d <= CORROBORATE_TOL) {
        stats.corroborated++;
        prog.confidence = round2(Math.max(prog.confidence || 0,
          scoreFact({ sourceTier: m.tier, quality: 1, corroborated: true, linkLive: false })));
        prog.checkedAt = NOW;
      } else if (d > MISMATCH_TOL) {
        stats.mismatches++;
        cases.push({
          id: `${u.slug}||tuition_mismatch||${pSlug}||${m.source}`,
          slug: u.slug, name: u.name, issue: 'tuition_mismatch', severity: 'warning',
          detail: `«${prog.title}»: каталог ${amount} ${currency}, ${m.source} ${m.money.amount} ${m.money.currency || currency} (${Math.round(d * 100)}%)`,
          catalog: amount, official: m.money.amount, program: pSlug, source: m.source,
          checkedAt: NOW, decision: null, decidedAt: null, applied: false,
        });
      }
    }
  }
}

function checkAccommodation(u, cases, stats) {
  for (const item of u.accommodation || []) {
    const money = parseMoneyFirst(item.price) || parseMoneyFirst(item.text);
    if (!money) continue;
    stats.facts++;
    const cur = money.currency || u.tuition?.currency;
    const sane = accommodationPlausible(money.amount, cur, money.per);
    if (sane === false) {
      stats.outliers++;
      cases.push({
        id: `${u.slug}||accommodation_outlier||${normTitle(item.name).slice(0, 40)}`,
        slug: u.slug, name: u.name, issue: 'accommodation_price_outlier', severity: 'warning',
        detail: `Жильё «${item.name}»: ${money.amount} ${cur}${money.per ? '/' + money.per : ''} вне диапазона`,
        catalog: money.amount, official: null,
        checkedAt: NOW, decision: null, decidedAt: null, applied: false,
      });
    } else if (sane === true && item.confidence === undefined) {
      // метаданные верификации (не меняет отображаемые данные)
      item.confidence = round2(scoreFact({
        sourceTier: item.source && !AGG_DOMAINS.test(item.source) ? 'official' : 'aggregator',
        quality: 1, corroborated: false, linkLive: false,
      }));
      item.checkedAt = NOW;
    }
  }
}

function checkKeyFacts(u, cases, stats) {
  const facts = [...(u.description?.keyFacts || []), ...(u.description?.keyFactsRu || [])];
  for (const f of facts) {
    for (const kf of extractKeyFactNumbers(f)) {
      stats.facts++;
      if (keyFactPlausible(kf) === false) {
        stats.outliers++;
        cases.push({
          id: `${u.slug}||keyfact||${kf.kind}||${kf.value}`,
          slug: u.slug, name: u.name, issue: 'keyfact_outlier', severity: 'info',
          detail: `keyFact ${kf.kind}=${kf.value} неправдоподобен: «${String(f).slice(0, 80)}»`,
          catalog: kf.value, official: null,
          checkedAt: NOW, decision: null, decidedAt: null, applied: false,
        });
      }
    }
  }
}

function checkRequirements(u, cases, stats) {
  const lang = u.requirements?.language || {};
  const checks = [
    ['ielts', lang.ielts, ieltsPlausible],
    ['toefl', lang.toefl, toeflPlausible],
    ['gpa', u.requirements?.gpa, gpaPlausible],
  ];
  for (const [kind, v, fn] of checks) {
    if (v === undefined || v === null) continue;
    stats.facts++;
    if (!fn(v)) {
      stats.outliers++;
      cases.push({
        id: `${u.slug}||req||${kind}`,
        slug: u.slug, name: u.name, issue: `${kind}_implausible`, severity: 'warning',
        detail: `${kind.toUpperCase()} = ${v} неправдоподобен`,
        catalog: v, official: null,
        checkedAt: NOW, decision: null, decidedAt: null, applied: false,
      });
    }
  }
}

// ── Живая проверка офсайта (только спорные tuition) ──────────────────────────

function officialRoot(u, extracts) {
  const edvoy = extracts.find(e => e.source === 'edvoy');
  const site = edvoy?.data?.website;
  if (site) return site;
  try {
    if (u.sourceUrl && !AGG_DOMAINS.test(new URL(u.sourceUrl).hostname)) return u.sourceUrl;
  } catch { /* ignore */ }
  return null;
}

const FEE_LINK_RE = /\b(fees?|tuition|funding|costs?|finance)\b/i;
const FEE_PATHS = ['', '/fees', '/tuition-fees', '/fees-and-funding', '/study/fees', '/international/fees'];

async function liveCheckUni(u, extracts, uniCases, applied) {
  const root = officialRoot(u, extracts);
  if (!root) return { status: 'no-official-site' };
  const base = root.replace(/\/+$/, '');
  const tokens = [];
  const visited = new Set();
  const queue = FEE_PATHS.map(p => base + p);

  const main = await fetchPage(base);
  if (main.ok) {
    // добираем fee-ссылки с главной (до 4)
    const baseUrl = (() => { try { return new URL(main.finalUrl || base); } catch { return null; } })();
    if (baseUrl) {
      for (const m of main.html.matchAll(/href=["']([^"'#?][^"']*?)["']/gi)) {
        try {
          const link = new URL(m[1], baseUrl);
          if (link.hostname === baseUrl.hostname && FEE_LINK_RE.test(link.pathname)) queue.push(link.href);
        } catch { /* skip */ }
      }
    }
  }

  for (const url of queue.slice(0, 8)) {
    if (visited.has(url)) continue;
    visited.add(url);
    const page = url === base && main.ok ? main : await fetchPage(url);
    if (!page.ok) continue;
    const text = page.html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ');
    for (const t of parseMoney(text)) tokens.push({ ...t, url: page.finalUrl || url });
  }
  if (!tokens.length) return { status: 'no-money-found' };

  let resolved = 0;
  for (const c of uniCases) {
    // tuition_zero — у нуля нет известного значения для корроборации, поэтому
    // отдельная ветка: собираем правдоподобные токены офсайта и заполняем цену,
    // только если одно значение встретилось на ≥2 URL (иначе → подсказка оператору).
    if (c.issue === 'tuition_zero') {
      const currency = u.tuition?.currency;
      const prog = (u.programs || []).find(p => p.slug === c.program);
      const plaus = tokens.filter(t =>
        (!t.currency || t.currency === currency) &&
        tuitionPlausible(t.amount, currency, prog?.level));
      if (!plaus.length) continue;
      const groups = [];
      for (const t of plaus) {
        const g = groups.find(g => relDiff(g.amount, t.amount) <= CORROBORATE_TOL);
        if (g) g.urls.add(t.url); else groups.push({ amount: t.amount, urls: new Set([t.url]) });
      }
      groups.sort((a, b) => b.urls.size - a.urls.size);
      const best = groups[0];
      const corroborated = best.urls.size >= 2;
      const confidence = round2(scoreFact({ sourceTier: 'official', quality: 1, corroborated, linkLive: true }));
      if (corroborated && passes(confidence) && c.program) {
        u.tuition.byProgram[c.program] = best.amount;
        applied.push({ slug: u.slug, program: c.program, from: 0, to: best.amount, confidence, url: [...best.urls][0], at: NOW });
        if (prog) { prog.source = [...best.urls][0]; prog.verifiedBySite = true; prog.confidence = confidence; prog.checkedAt = NOW; }
        c.official = best.amount;
        c.decision = 'auto-official'; c.decidedAt = NOW; c.applied = true; resolved++;
      } else {
        // не корроборировано → кандидат оператору в панель (decision остаётся null)
        c.official = best.amount;
        c.detail = (c.detail || '') + ` — офсайт: ~${best.amount} ${currency || ''} (не корроборировано, проверить)`;
      }
      continue;
    }
    if (c.issue !== 'tuition_mismatch' && c.issue !== 'tuition_outlier') continue;
    const currency = u.tuition?.currency;
    const candidates = [c.catalog, c.official].filter(Number.isFinite);
    let winner = null;
    for (const cand of candidates) {
      const hit = tokens.find(t => (!t.currency || t.currency === currency) && relDiff(t.amount, cand) <= CORROBORATE_TOL);
      if (hit) { winner = { value: cand, evidence: hit }; break; }
    }
    if (!winner) continue;
    const confidence = round2(scoreFact({
      sourceTier: 'official', quality: 1,
      corroborated: winner.value === c.official, linkLive: true,
    }));
    if (!passes(confidence)) continue;

    const prog = (u.programs || []).find(p => p.slug === c.program);
    if (winner.value !== c.catalog && c.program) {
      u.tuition.byProgram[c.program] = winner.value; // официальная цифра побеждает
      applied.push({ slug: u.slug, program: c.program, from: c.catalog, to: winner.value, confidence, url: winner.evidence.url, at: NOW });
    }
    if (prog) {
      prog.source = winner.evidence.url;
      prog.verifiedBySite = true;
      prog.confidence = confidence;
      prog.checkedAt = NOW;
    }
    c.decision = 'auto-official';
    c.decidedAt = NOW;
    c.applied = winner.value !== c.catalog;
    resolved++;
  }
  return { status: 'ok', tokens: tokens.length, resolved };
}

// ── main ─────────────────────────────────────────────────────────────────────

let files = (await fs.readdir(CATALOG_DIR)).filter(f => f.endsWith('.json'));
if (SLUG_FILTER) files = files.filter(f => f === `${SLUG_FILTER}.json`);
files = files.slice(0, LIMIT);
log(`checking ${files.length} unis — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}${SKIP_LIVE ? ', no web' : ''}`);

const allCases = [];
const applied = [];
const stats = { unis: files.length, facts: 0, corroborated: 0, outliers: 0, mismatches: 0, liveChecked: 0, liveResolved: 0 };
const dirty = new Map(); // slug → объект каталога с обновлёнными метаданными

let i = 0;
async function worker() {
  while (i < files.length) {
    const f = files[i++];
    const slug = f.replace(/\.json$/, '');
    let u;
    try { u = JSON.parse(await fs.readFile(path.join(CATALOG_DIR, f), 'utf8')); }
    catch { log(`SKIP ${slug}: unreadable`); continue; }
    const before = JSON.stringify({ p: u.programs, a: u.accommodation, t: u.tuition });
    const extracts = await loadExtracts(slug);
    const uniCases = [];
    checkTuition(u, extracts, uniCases, stats);
    checkAccommodation(u, uniCases, stats);
    checkKeyFacts(u, uniCases, stats);
    checkRequirements(u, uniCases, stats);
    u.__extracts = extracts; // для live-фазы (вычищается перед записью)
    u.__cases = uniCases;
    if (uniCases.length || JSON.stringify({ p: u.programs, a: u.accommodation, t: u.tuition }) !== before) dirty.set(slug, u);
    allCases.push(...uniCases);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

// Live-фаза: только вузы со спорным tuition, кап MAX_LIVE
if (!SKIP_LIVE) {
  const disputed = [...dirty.values()]
    .filter(u => (u.__cases || []).some(c => c.issue === 'tuition_mismatch' || c.issue === 'tuition_outlier' || c.issue === 'tuition_zero'))
    .slice(0, MAX_LIVE);
  log(`live pass: ${disputed.length} unis (cap ${MAX_LIVE})`);
  let j = 0;
  async function liveWorker() {
    while (j < disputed.length) {
      const u = disputed[j++];
      const r = await liveCheckUni(u, u.__extracts, u.__cases, applied);
      stats.liveChecked++;
      stats.liveResolved += r.resolved || 0;
      log(`  ${u.slug}: ${r.status}${r.resolved ? ` (+${r.resolved} resolved)` : ''}`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, 4) }, liveWorker));
}

// ── Запись результатов ────────────────────────────────────────────────────────

if (!DRY_RUN) {
  // каталог: обновлённые confidence/checkedAt/авто-применённые цифры
  for (const [slug, u] of dirty) {
    delete u.__extracts;
    delete u.__cases;
    await fs.writeFile(path.join(CATALOG_DIR, `${slug}.json`), JSON.stringify(u, null, 2) + '\n');
  }

  // review-файл: merge-preserve решений (паттерн РЕВИЗОРА)
  let existing = { items: [] };
  try { if (existsSync(REVIEW_OUT)) existing = JSON.parse(await fs.readFile(REVIEW_OUT, 'utf8')); } catch { /* ignore */ }
  const prevById = new Map((existing.items || []).map(it => [it.id, it]));
  const pendingCases = allCases.filter(c => c.decision === null).map(c => {
    const prev = prevById.get(c.id);
    return prev && prev.decision !== null
      ? { ...c, decision: prev.decision, decidedAt: prev.decidedAt, applied: prev.applied }
      : c;
  });
  // Scoped-ран (--slug/--limit) перепроверяет только свои вузы —
  // кейсы остальных сохраняем, иначе точечный запуск стирает общий список.
  const scopeSlugs = new Set(files.map(f => f.replace(/\.json$/, '')));
  const keptItems = (existing.items || []).filter(it => !scopeSlugs.has(it.slug));
  const items = [...keptItems, ...pendingCases];
  const review = {
    generatedAt: NOW,
    scope: SLUG_FILTER || 'all',
    summary: {
      total: items.length,
      pending: items.filter(c => c.decision === null).length,
      autoResolved: allCases.filter(c => c.decision === 'auto-official').length,
    },
    items,
  };
  await fs.mkdir(path.dirname(REVIEW_OUT), { recursive: true });
  await fs.writeFile(REVIEW_OUT, JSON.stringify(review, null, 2) + '\n');

  await fs.mkdir(AUDIT_DIR, { recursive: true });
  await fs.writeFile(REPORT_OUT, JSON.stringify({ generatedAt: NOW, stats, cases: allCases }, null, 2) + '\n');
  if (applied.length) {
    let prevApplied = [];
    try { if (existsSync(APPLIED_OUT)) prevApplied = JSON.parse(await fs.readFile(APPLIED_OUT, 'utf8')); } catch { /* ignore */ }
    await fs.writeFile(APPLIED_OUT, JSON.stringify([...prevApplied, ...applied], null, 2) + '\n');
  }
  log(`✓ wrote review (${allCases.length} cases), report, ${dirty.size} catalog files touched`);
} else {
  log(`DRY RUN: ${allCases.length} cases, ${dirty.size} files would be touched, ${applied.length} auto-applies`);
}

console.log(JSON.stringify({
  script: 'soroka', dryRun: DRY_RUN, ...stats,
  cases: allCases.length, autoApplied: applied.length,
}));
process.exit(0);
