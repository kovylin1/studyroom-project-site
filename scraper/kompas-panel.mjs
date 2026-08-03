// kompas-panel.mjs — КОМПАС: кейсы сессий 3.5 и 4 → в панель /manager.
//
// Панель читает site/public/api/<key>-review.json в схеме РЕВИЗОРА. У КОМПАСа
// два генератора кейсов (прямые партнёры — direct-review.json, замер расхождений —
// diff-review.json); здесь они сводятся в один файл, чтобы у оператора была одна
// вкладка, а не две половины одного этапа.
//
// Сети нет, каталог не трогается.
//
// Запуск: node kompas-panel.mjs

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KOMPAS_DIR, ROOT, logger } from './lib/kompas-collect.mjs';

const log = logger('panel');
const OUT = path.join(ROOT, 'site', 'public', 'api', 'kompas-review.json');
const PARTS = [
  // сессии 3.5–4.5
  'direct-review.json', 'diff-review.json', 'gap-review.json', 'cards-review.json',
  'dupmerge-review.json', 'offsite-review.json',
  // сессия 5 (P0–P2): правки цен, валюты, добор программ
  'navitas-fix-review.json', 'oxfordintl-fix-review.json', 'currency-fix-review.json',
  'program-backfill-review.json', 'fee-mismatch-review.json', 'dupe-scan-review.json',
  // P4: стипендии — замер достоверности и сверка каталога с собранными офсайтами
  'scholarship-review.json', 'scholarship-diff-review.json', 'scholarship-clean-review.json',
  'sito-review.json',
];

const ORPHANS = path.join(KOMPAS_DIR, 'panel-orphan-decisions.json');

const readJson = async (f) => { try { return JSON.parse(await fs.readFile(f, 'utf8')); } catch { return null; } };

/**
 * Перенести решения оператора из уже собранной панели в свежую сборку.
 *
 * Панель — не производный файл: `/manager` коммитит решение прямо в
 * `site/public/api/kompas-review.json` через GitHub API, и другого их хранилища нет.
 * А сборщик до 2026-08-03 складывал панель заново из частей и ничего оттуда не читал,
 * то есть каждый пересчёт стирал всё, что оператор нащёлкал с прошлого раза
 * (замер: 1929 решений в панели против 1100 в частях — 829 под нож). Ровно та же дыра,
 * что чинили у `kompas-direct-cases.mjs` в `0492de90`.
 *
 * Решение из панели старше решения из части: часть пересобирается скриптом, а в панель
 * нажимает человек. Решения, которым в новой сборке не нашлось кейса, не выбрасываются
 * молча — они возвращаются отдельным списком и уезжают в файл.
 */
export function carryDecisions(built, prevItems) {
  const prev = new Map((prevItems ?? []).map((p) => [p.id, p]));
  const claimed = new Set();   // id прошлой панели, чьё решение нашло себе кейс
  let carried = 0, conflicts = 0;

  for (const it of built) {
    // Кейс мог сменить id: свёртка прайса 2026-08-03 заменила построчные кейсы
    // групповыми, и решение оператора лежит на id одной из свёрнутых строк.
    // Порядок проб: собственный id, потом id членов группы, потом их legacy-форма.
    const probes = [it.id, ...(it.members ?? []).flatMap((m) => [m.id, m.legacyId])].filter(Boolean);
    let hit = null;
    for (const key of probes) {
      const p = prev.get(key);
      if (p?.decision) { claimed.add(key); if (!hit) hit = p; }
    }
    if (!hit) continue;
    if (it.decision && it.decision !== hit.decision) conflicts += 1;
    if (!it.decision) carried += 1;
    it.decision = hit.decision;
    it.decidedAt = hit.decidedAt ?? it.decidedAt ?? null;
    it.applied = hit.applied ?? it.applied ?? false;
  }

  const orphans = (prevItems ?? []).filter((p) => p.decision && !claimed.has(p.id));
  return { carried, conflicts, orphans };
}

async function main() {
  const items = [];
  const sources = {};
  for (const p of PARTS) {
    const j = await readJson(path.join(KOMPAS_DIR, p));
    if (!j) { sources[p] = 'нет файла'; continue; }
    sources[p] = (j.items ?? []).length;
    items.push(...(j.items ?? []));
  }

  // Одинаковый id из двух частей означал бы, что решение оператора применится
  // дважды. Проверяем, а не надеемся.
  const seen = new Set(); const dupes = [];
  const unique = [];
  for (const it of items) {
    if (seen.has(it.id)) { dupes.push(it.id); continue; }
    seen.add(it.id); unique.push(it);
  }

  const prevPanel = await readJson(OUT);
  const { carried, conflicts, orphans } = carryDecisions(unique, prevPanel?.items);

  const order = { critical: 0, warning: 1, info: 2 };
  unique.sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3) || String(a.slug).localeCompare(String(b.slug)));

  const byIssue = {};
  for (const it of unique) byIssue[it.issue] = (byIssue[it.issue] ?? 0) + 1;

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify({
    generatedAt: new Date().toISOString(),
    scope: 'kompas',
    summary: {
      total: unique.length, byIssue, sources, duplicatesDropped: dupes.length,
      decided: unique.filter((i) => i.decision).length,
      decisionsCarriedFromPanel: carried, decisionConflicts: conflicts, orphanDecisions: orphans.length,
    },
    items: unique,
  }, null, 2) + '\n', 'utf8');

  // Решение, которому не нашлось кейса, не должно исчезнуть без следа: кейс мог
  // сменить id (свёртка прайса 2026-08-03) или уйти из выборки. Складываем рядом.
  if (orphans.length) {
    await fs.writeFile(ORPHANS, JSON.stringify({
      generatedAt: new Date().toISOString(),
      note: 'Решения оператора, которым в свежей сборке панели не нашлось кейса с тем же id. Не потеряны — разобрать вручную.',
      items: orphans,
    }, null, 2) + '\n', 'utf8');
  }

  log(`в панель ${unique.length} кейсов${dupes.length ? `, отброшено дублей ${dupes.length}` : ''}`);
  log(`решений: в частях ${unique.filter((i) => i.decision).length - carried}, перенесено из панели ${carried}` +
    `${conflicts ? `, расхождений ${conflicts} (взято из панели)` : ''}` +
    `${orphans.length ? `, осиротело ${orphans.length} → ${path.relative(ROOT, ORPHANS)}` : ''}`);
  console.log('PANEL DONE', JSON.stringify({ total: unique.length, sources }));
}

// Сборка запускается только при прямом вызове: файл импортируют тесты.
const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) main().catch((e) => { console.error(e); process.exit(1); });
