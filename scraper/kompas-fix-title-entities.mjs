#!/usr/bin/env node
// kompas-fix-title-entities.mjs — раскодировать HTML-сущности в названиях программ.
//
// Замер kompas-junk-titles-diag.mjs (02.09.2026): 344 названия у 131 карточки
// доехали до каталога с неразобранными сущностями и так и показываются
// посетителю: «Arts culinaires sucrés &amp; Entrepreneuriat»,
// «Queen Ethelburga&#x27;s Primary School», «Prof. Dr. Fatma G&#252;ler YILDIRIM».
// Это брак разбора на стороне сборщиков: HTML сняли, а сущности не развернули.
//
// Правится ТОЛЬКО поле title. Слаг программы не трогается — на него завязаны
// tuition.byProgram и deadlines, и переименование их бы осиротило.
//
// Ничего не выдумывается: сущность разворачивается в тот символ, который она
// и означает. Если после разворота название пустеет — строка не трогается.
//
// Правит живой каталог и рабочую копию сразу (правило 3 плана).
//
// Запуск: node kompas-fix-title-entities.mjs [--apply]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = [
  path.join(ROOT, 'site/src/content/universities'),
  path.join(ROOT, 'sources/kompas/catalog-work'),
];
const BACKUP = path.join(ROOT, 'sources/kompas/title-entities-backup.json');
const APPLY = process.argv.includes('--apply');

const NAMED = {
  amp: '&', nbsp: ' ', quot: '"', apos: "'", lt: '<', gt: '>',
  laquo: '«', raquo: '»', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’',
  ndash: '–', mdash: '—', hellip: '…', deg: '°', eacute: 'é', egrave: 'è',
};

const decode = (s) => s
  .replace(/&#x([0-9a-fA-F]+);/g, (_, c) => String.fromCodePoint(parseInt(c, 16)))
  .replace(/&#(\d+);/g, (_, c) => String.fromCodePoint(+c))
  .replace(/&([a-zA-Z]+);/g, (m, n) => (n.toLowerCase() in NAMED ? NAMED[n.toLowerCase()] : m));

const HAS_ENTITY = /&#\d+;|&#x[0-9a-fA-F]+;|&[a-zA-Z]+;/;

const changes = [];
let filesTouched = 0;

for (const dir of DIRS) {
  if (!fs.existsSync(dir)) { console.log(`нет каталога: ${dir}`); continue; }
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const file = path.join(dir, f);
    let card;
    try { card = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { continue; }
    let dirty = false;
    for (const p of card.programs || []) {
      const title = String(p.title || '');
      if (!HAS_ENTITY.test(title)) continue;
      const next = decode(title).replace(/\s+/g, ' ').trim();
      if (!next || next === title) continue;
      changes.push({ dir: path.basename(dir), slug: card.slug || f, program: p.slug, from: title, to: next });
      p.title = next;
      dirty = true;
    }
    if (dirty) {
      filesTouched++;
      if (APPLY) fs.writeFileSync(file, JSON.stringify(card, null, 2) + '\n');
    }
  }
}

if (APPLY) fs.writeFileSync(BACKUP, JSON.stringify({ ranAt: new Date().toISOString(), changes }, null, 2) + '\n');

console.log(`${APPLY ? 'ЗАПИСАНО' : 'СУХОЙ ПРОГОН'}: названий поправлено ${changes.length}, карточек ${filesTouched}`);
for (const c of changes.slice(0, 8)) console.log(`  ${c.slug}: «${c.from.slice(0, 60)}» → «${c.to.slice(0, 60)}»`);
if (APPLY) console.log(`откат: ${BACKUP.slice(ROOT.length + 1)}`);
