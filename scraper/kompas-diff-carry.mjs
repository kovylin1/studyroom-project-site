#!/usr/bin/env node
// kompas-diff-carry.mjs — перенос принятых решений в заново снятую сверку.
//
// ЗАЧЕМ. `kompas-diff.mjs` пересобирает diff-review.json с нуля, и все decision
// в нём обнуляются. Идентификатор кейса содержит количество (`abertay||
// kompas_campus_missing||1`), а количество после добора меняется — значит и по
// id решение не находится. Без переноса каждый повторный замер стирал бы работу
// оператора; кейсы-сироты уже ловились раньше (panel-orphan-decisions.json).
//
// ПРАВИЛО. Сначала точное совпадение id, потом пара «вуз + разряд»: решение
// принималось по сути расхождения, а не по его величине. Если разряд у вуза
// исчез — решение объявляется сиротой и выписывается, а не теряется молча.
//
// Запуск: node kompas-diff-carry.mjs --prev=<файл> [--apply]

import fs from 'node:fs/promises';
import path from 'node:path';
import { KOMPAS_DIR, args, logger } from './lib/kompas-collect.mjs';

const log = logger('diff-carry');
const APPLY = args.has('apply');
const REVIEW = path.join(KOMPAS_DIR, 'diff-review.json');
const ORPHANS = path.join(KOMPAS_DIR, 'diff-carry-orphans.json');

const prevArg = process.argv.find((a) => a.startsWith('--prev='));
const PREV = prevArg ? prevArg.slice('--prev='.length) : path.join(KOMPAS_DIR, 'diff-review.prev.json');

export const keyOf = (it) => `${it.slug}||${it.issue}`;

/** Переносит решения из старых кейсов в новые. Мутирует `next`. */
export function carry(prevItems, nextItems) {
  const byId = new Map(); const byKey = new Map();
  for (const it of prevItems) {
    if (!it.decision) continue;
    byId.set(it.id, it);
    if (!byKey.has(keyOf(it))) byKey.set(keyOf(it), it);
  }
  const used = new Set();
  let exact = 0; let byPair = 0;

  for (const it of nextItems) {
    if (it.decision) continue;
    const hit = byId.get(it.id) ?? byKey.get(keyOf(it));
    if (!hit) continue;
    it.decision = hit.decision;
    it.decidedAt = hit.decidedAt;
    it.decisionNote = hit.decisionNote;
    if (hit.id !== it.id) { it.decisionCarriedFrom = hit.id; byPair++; } else exact++;
    used.add(hit.id);
  }

  const orphans = [...byId.values()].filter((it) => !used.has(it.id));
  return { exact, byPair, orphans };
}

async function main() {
  let prev;
  try { prev = JSON.parse(await fs.readFile(PREV, 'utf8')); }
  catch { log(`прошлой сверки ${path.basename(PREV)} нет — переносить нечего`); return; }
  const next = JSON.parse(await fs.readFile(REVIEW, 'utf8'));

  const { exact, byPair, orphans } = carry(prev.items ?? [], next.items ?? []);

  if (APPLY) {
    await fs.writeFile(REVIEW, JSON.stringify(next, null, 2) + '\n', 'utf8');
    await fs.writeFile(ORPHANS, JSON.stringify({
      generatedAt: new Date().toISOString(),
      note: 'Решения прошлой сверки, которым не нашлось кейса в новой: расхождение исчезло или разряд сменился.',
      count: orphans.length,
      items: orphans.map((o) => ({ id: o.id, slug: o.slug, issue: o.issue, decision: o.decision })),
    }, null, 2) + '\n', 'utf8');
  }

  const byIssue = {};
  for (const o of orphans) byIssue[o.issue] = (byIssue[o.issue] ?? 0) + 1;
  console.log(`ПЕРЕНЕСЕНО решений: по id ${exact}, по паре «вуз+разряд» ${byPair}; сирот ${orphans.length} ${JSON.stringify(byIssue)}`);
  console.log(APPLY ? 'ЗАПИСАНО в diff-review.json' : 'СУХОЙ ПРОГОН — для записи добавь --apply');
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) await main();
