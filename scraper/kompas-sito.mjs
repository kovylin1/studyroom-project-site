#!/usr/bin/env node
// kompas-sito.mjs — СИТО: просев catalog-only программ через офсайты вузов.
//
// Решение владельца 2026-07-29: «если такие программы есть у университета — оставляем,
// если нет — убираем». Уточнение (вопрос-ответ): убираем ТОЛЬКО там, где офсайт успешно
// обойдён; недоступные (WAF, сайт молчит, обход обрезан потолком страниц) — оставляем
// с меткой catalog-only.
//
// Фазы (одним запуском, друг за другом):
//   1. COLLECT — для каждого вуза с catalog-only программами прогнать
//      kompas-collect-direct.mjs --slug=X --skip-fresh (выгрузка в extracts/direct/).
//   2. PRUNE — где выгрузка ПОЛНАЯ (не capped, программ достаточно), снять catalog-only
//      программы, которых на офсайте нет. Бэкап + кейсы в панель.
//
// Работает на КОПИИ catalog-work. Живой каталог не трогает.
// Запуск: node kompas-sito.mjs [--dry] [--limit=N] [--min-offsite=8] [--skip-collect]
// Лог: sources/kompas/sito.log (пишется и в stdout).

import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { KOMPAS_DIR, EXTRACTS_DIR, args } from './lib/kompas-collect.mjs';
import { WORK_DIR, readJson } from './lib/kompas-diff-core.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRY = args.has('dry');
const LIMIT = args.num('limit', Infinity);
const MIN_OFFSITE = args.num('min-offsite', 8);
const SKIP_COLLECT = args.has('skip-collect');
const DIRECT_DIR = path.join(EXTRACTS_DIR, 'direct');
const LOG_FILE = path.join(KOMPAS_DIR, 'sito.log');
const today = new Date().toISOString().slice(0, 10);

const log = async (m) => {
  const line = `[sito ${new Date().toISOString().slice(11, 19)}] ${m}`;
  console.log(line);
  await fs.appendFile(LOG_FILE, line + '\n').catch(() => {});
};

const norm = (s) => (s || '').toLowerCase()
  .replace(/\((hons|honours)\)/g, ' ')
  .replace(/[^a-z0-9а-яё ]+/gi, ' ').replace(/\s+/g, ' ').trim();
const tokens = (s) => new Set(norm(s).split(' ').filter((w) => w.length > 2));
const jaccard = (a, b) => {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0; for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
};
const matches = (title, offsiteTitles, offsiteNorms) => {
  const n = norm(title);
  if (offsiteNorms.has(n)) return true;
  for (const o of offsiteNorms) if (o.includes(n) || n.includes(o)) return true;
  for (const t of offsiteTitles) if (jaccard(title, t) >= 0.6) return true;
  return false;
};

function runCollect(slug) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [
      path.join(__dirname, 'kompas-collect-direct.mjs'),
      `--slug=${slug}`, '--skip-fresh', '--fresh-hours=96',
    ], { cwd: __dirname, stdio: ['ignore', 'ignore', 'ignore'] });
    const t = setTimeout(() => { p.kill(); resolve('timeout'); }, 20 * 60 * 1000);
    p.on('close', (code) => { clearTimeout(t); resolve(code === 0 ? 'ok' : `exit ${code}`); });
    p.on('error', () => { clearTimeout(t); resolve('spawn-error'); });
  });
}

async function main() {
  await log(`СТАРТ. dry=${DRY} limit=${LIMIT} minOffsite=${MIN_OFFSITE} skipCollect=${SKIP_COLLECT}`);

  // Ворклист: вузы с catalog-only программами
  const files = (await fs.readdir(WORK_DIR)).filter((f) => f.endsWith('.json'));
  const worklist = [];
  for (const f of files) {
    const card = await readJson(path.join(WORK_DIR, f));
    if (!card?.programs) continue;
    const marked = card.programs.filter((p) => p.kompasStatus === 'catalog-only');
    if (marked.length) worklist.push({ slug: f.replace(/\.json$/, ''), marked: marked.length, total: card.programs.length });
  }
  worklist.sort((a, b) => b.marked - a.marked);
  const todo = worklist.slice(0, LIMIT);
  await log(`вузов с catalog-only: ${worklist.length}, в работе: ${todo.length}, программ под вопросом: ${worklist.reduce((s, u) => s + u.marked, 0)}`);

  // Фаза 1: сбор с офсайтов
  if (!SKIP_COLLECT) {
    let i = 0;
    for (const u of todo) {
      i++;
      const res = await runCollect(u.slug);
      if (i % 10 === 0 || res !== 'ok') await log(`collect ${i}/${todo.length} ${u.slug}: ${res}`);
    }
    await log('сбор завершён');
  }

  // Фаза 2: просев
  const backup = {};
  const cases = [];
  const rep = { generatedAt: new Date().toISOString(), verified: 0, unverified: 0, removed: 0, kept: 0, unisChanged: 0 };

  for (const u of todo) {
    const fp = path.join(WORK_DIR, `${u.slug}.json`);
    const card = await readJson(fp);
    if (!card) continue;
    const ex = await readJson(path.join(DIRECT_DIR, `${u.slug}.json`));
    const offsitePrograms = ex?.programs ?? [];
    const complete = ex && !ex.capped && offsitePrograms.length >= MIN_OFFSITE;

    if (!complete) {
      rep.unverified++;
      cases.push({
        id: `sito_unverified_${u.slug}`, slug: u.slug, name: card.name,
        issue: 'sito_offsite_unverified', severity: 'info',
        detail: `Офсайт не дал полной выгрузки (${ex ? (ex.capped ? 'обход обрезан потолком страниц' : `программ снято ${offsitePrograms.length} < ${MIN_OFFSITE}`) : 'выгрузки нет — сайт не отдался'}). ${u.marked} catalog-only программ ОСТАВЛЕНЫ с меткой (решение владельца: без проверки не убирать).`,
        checkedAt: today,
      });
      continue;
    }

    rep.verified++;
    const offsiteTitles = offsitePrograms.map((p) => p.title).filter(Boolean);
    const offsiteNorms = new Set(offsiteTitles.map(norm));
    const removed = [];
    const keptPrograms = [];
    for (const p of card.programs) {
      if (p.kompasStatus !== 'catalog-only') { keptPrograms.push(p); continue; }
      if (matches(p.title, offsiteTitles, offsiteNorms)) {
        // офсайт подтвердил — метка снимается
        delete p.kompasStatus; delete p.kompasCheckedAt;
        p.verifiedBySite = true; p.checkedAt = today;
        keptPrograms.push(p); rep.kept++;
      } else {
        removed.push(p); rep.removed++;
      }
    }
    if (removed.length) {
      rep.unisChanged++;
      backup[u.slug] = { programs: removed, tuition: {} };
      for (const p of removed) {
        if (card.tuition?.byProgram && p.slug in card.tuition.byProgram) {
          backup[u.slug].tuition[p.slug] = card.tuition.byProgram[p.slug];
          delete card.tuition.byProgram[p.slug];
        }
      }
      card.programs = keptPrograms;
      cases.push({
        id: `sito_removed_${u.slug}`, slug: u.slug, name: card.name,
        issue: 'sito_programs_removed', severity: 'warning',
        detail: `Офсайт обойдён полностью (${offsitePrograms.length} программ снято с сайта вуза). Убрано ${removed.length} catalog-only программ, которых там нет: ${removed.slice(0, 5).map((p) => p.title).join(' · ')}${removed.length > 5 ? ` … и ещё ${removed.length - 5}` : ''}. Откат: sito-backup.json.`,
        checkedAt: today,
      });
      if (!DRY) await fs.writeFile(fp, JSON.stringify(card, null, 2) + '\n');
    } else if (card.programs.some((p) => p.verifiedBySite && p.checkedAt === today)) {
      if (!DRY) await fs.writeFile(fp, JSON.stringify(card, null, 2) + '\n');
    }
  }

  if (!DRY) {
    await fs.writeFile(path.join(KOMPAS_DIR, 'sito-backup.json'), JSON.stringify({ generatedAt: rep.generatedAt, note: 'снятые программы и их цены; откат — вернуть в programs/tuition.byProgram', unis: backup }, null, 2) + '\n');
    await fs.writeFile(path.join(KOMPAS_DIR, 'sito-review.json'), JSON.stringify({ generatedAt: rep.generatedAt, items: cases }, null, 2) + '\n');
    await fs.writeFile(path.join(KOMPAS_DIR, 'sito-report.json'), JSON.stringify(rep, null, 2) + '\n');
  }
  await log(`ИТОГ: офсайт полный у ${rep.verified}, неполный/недоступен у ${rep.unverified}; подтверждено программ ${rep.kept}, снято ${rep.removed} у ${rep.unisChanged} вузов. ${DRY ? 'DRY — без записи.' : 'Записано + бэкап.'}`);
  await log('ГОТОВО');
}

main().catch(async (e) => { await log(`FATAL: ${e.message}`); process.exit(1); });
