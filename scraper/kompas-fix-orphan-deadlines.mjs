#!/usr/bin/env node
// kompas-fix-orphan-deadlines.mjs — снять дедлайны, ссылающиеся на несуществующие программы.
//
// Схема сайта требует, чтобы каждый ключ `deadlines` был слагом программы карточки;
// проверяет это ТОЛЬКО сборка сайта, гейт каталога — нет. 20.09.2026 снятие 447
// чужих программ (kompas-fix-foreign-programs.mjs) оставило их дедлайны на месте,
// и деплой упал: «deadlines reference unknown program slug». Скрипт проходит по
// всему каталогу и убирает такие ключи — где бы они ни завелись.
//
// Запуск: node scraper/kompas-fix-orphan-deadlines.mjs           # отчёт
//         node scraper/kompas-fix-orphan-deadlines.mjs --apply   # запись

import fs from 'node:fs';
import path from 'node:path';

const LIVE = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'site', 'src', 'content', 'universities');
const APPLY = process.argv.includes('--apply');

let cards = 0; let orphans = 0;
for (const f of fs.readdirSync(LIVE)) {
  if (!f.endsWith('.json')) continue;
  const file = path.join(LIVE, f);
  const raw = fs.readFileSync(file, 'utf8');
  const card = JSON.parse(raw);
  if (!card.deadlines || typeof card.deadlines !== 'object' || Array.isArray(card.deadlines)) continue;
  const slugs = new Set((card.programs || []).map((p) => p.slug));
  const bad = Object.keys(card.deadlines).filter((k) => !slugs.has(k));
  if (!bad.length) continue;
  cards++; orphans += bad.length;
  console.log(`${card.slug || f}: дедлайнов без программы ${bad.length} из ${Object.keys(card.deadlines).length}`);
  if (APPLY) {
    for (const k of bad) delete card.deadlines[k];
    let out = JSON.stringify(card, null, 2) + '\n';
    if (raw.includes('\r\n')) out = out.replace(/\n/g, '\r\n');
    fs.writeFileSync(file, out);
  }
}
console.log(`${APPLY ? 'ЗАПИСАНО' : 'сухой прогон'}: карточек ${cards}, снято дедлайнов ${orphans}`);
