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
import { KOMPAS_DIR, ROOT, logger } from './lib/kompas-collect.mjs';

const log = logger('panel');
const OUT = path.join(ROOT, 'site', 'public', 'api', 'kompas-review.json');
const PARTS = ['direct-review.json', 'diff-review.json', 'gap-review.json', 'cards-review.json', 'dupmerge-review.json'];

const readJson = async (f) => { try { return JSON.parse(await fs.readFile(f, 'utf8')); } catch { return null; } };

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

  const order = { critical: 0, warning: 1, info: 2 };
  unique.sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3) || String(a.slug).localeCompare(String(b.slug)));

  const byIssue = {};
  for (const it of unique) byIssue[it.issue] = (byIssue[it.issue] ?? 0) + 1;

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify({
    generatedAt: new Date().toISOString(),
    scope: 'kompas',
    summary: { total: unique.length, byIssue, sources, duplicatesDropped: dupes.length },
    items: unique,
  }, null, 2) + '\n', 'utf8');

  log(`в панель ${unique.length} кейсов${dupes.length ? `, отброшено дублей ${dupes.length}` : ''}`);
  console.log('PANEL DONE', JSON.stringify({ total: unique.length, sources }));
}

main().catch((e) => { console.error(e); process.exit(1); });
