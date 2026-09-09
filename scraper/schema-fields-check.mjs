#!/usr/bin/env node
// schema-fields-check.mjs — сторож против бага, который повторился четыре раза:
// поле пишется в карточку, отчёты его видят, сборка проходит — а на страницах пусто,
// потому что zod вырезает всё, чего нет в site/src/schema/university.ts.
// Так терялись kompasStatus (29.07), officialUrl (объявлен 02.09), partnerSource
// и programs[].verified (объявлены 08.09).
//
// Проверка текстовая: собираем имена полей из карточек каталога и требуем, чтобы
// каждое было объявлено в схеме. Сети нет, ничего не пишется.
// Ненулевой код возврата = в каталоге лежит поле, которого схема не знает.
// Запуск: node scraper/schema-fields-check.mjs [--dir=<каталог>]

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA = path.join(ROOT, 'site/src/schema/university.ts');
const LIVE = path.join(ROOT, 'site/src/content/universities');

// Пути-словари: ключи там — слаги программ, а не имена полей.
const RECORD_PATHS = new Set(['tuition.byProgram', 'deadlines']);

export function declaredNames(schemaText) {
  const names = new Set();
  // «поле: z.…» — в том числе вложенное в строку (city: z.object({ value: … })).
  // Значения-строки и массивы отсекаем: это код (message: `…`, path: ['tuition']),
  // а не объявления полей.
  for (const m of schemaText.matchAll(/([A-Za-z_$][\w$]*)\s*:(?!\s*[`'"\[\d])/g)) names.add(m[1]);
  for (const m of schemaText.matchAll(/^\s*([A-Za-z_$][\w$]*)\s*,\s*$/gm)) names.add(m[1]);
  return names;
}

export function collectFields(card) {
  const found = new Map(); // имя поля -> путь, где встретилось
  const walk = (node, pathStr) => {
    if (node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const v of node) walk(v, `${pathStr}[]`);
      return;
    }
    if (RECORD_PATHS.has(pathStr)) return;
    for (const [k, v] of Object.entries(node)) {
      const next = pathStr ? `${pathStr}.${k}` : k;
      if (!found.has(k)) found.set(k, next);
      walk(v, next);
    }
  };
  walk(card, '');
  return found;
}

async function main() {
  const dirArg = process.argv.find((a) => a.startsWith('--dir='));
  const dir = dirArg ? path.resolve(dirArg.slice('--dir='.length)) : LIVE;
  const declared = declaredNames(await fs.readFile(SCHEMA, 'utf8'));
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json'));
  const missing = new Map();
  for (const f of files) {
    const card = JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'));
    for (const [name, where] of collectFields(card)) {
      if (declared.has(name)) continue;
      const hit = missing.get(name) ?? { count: 0, where, cards: [] };
      hit.count += 1;
      if (hit.cards.length < 3) hit.cards.push(f.replace(/\.json$/, ''));
      missing.set(name, hit);
    }
  }
  console.log(`карточек ${files.length}, имён полей в схеме ${declared.size}`);
  if (!missing.size) {
    console.log('не объявленных в схеме полей нет');
    return;
  }
  console.log(`НЕ ОБЪЯВЛЕНО В СХЕМЕ — ${missing.size}:`);
  for (const [name, hit] of [...missing].sort((a, b) => b[1].count - a[1].count)) {
    console.log(`  ${name}  (${hit.count} карточек, путь ${hit.where}, напр. ${hit.cards.join(', ')})`);
  }
  console.log('\nЭти поля zod вырежет при чтении — до страниц они не доедут.');
  process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('schema-fields-check.mjs')) {
  await main();
}
