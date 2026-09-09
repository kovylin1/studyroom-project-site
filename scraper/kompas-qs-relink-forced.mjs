// КОМПАС — привязка выгрузок QS к живым карточкам по решению владельца.
//
// Разбор привязки 02.08 поставил этим шести записям вердикт «карточки нет вовсе»
// (`absent`), хотя карточка есть и никем не занята — это тот же баг, что даёт
// кейсы `kompas_no_extract`. Пары подтверждены владельцем 2026-08-20.
// Автоматика их не брала: имя расходится сильнее порога («SRH Universities (India)»
// против `srh-germany`), а ошибка привязки тихо подмешала бы в карточку чужие
// программы — поэтому список задан явно, а не выведен по сходству.
//
// Запуск: node scraper/kompas-qs-relink-forced.mjs [--apply]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EX = path.join(ROOT, 'sources/kompas/extracts/qs');
const CATALOG = path.join(ROOT, 'site/src/content/universities');
const OUT = path.join(ROOT, 'sources/kompas/qs-relink-forced.json');
const APPLY = process.argv.includes('--apply');

const PAIRS = [
  ['university-of-west-of-england-uwe', 'uwe-bristol'],
  ['srh-universities-india', 'srh-germany'],
  ['luiss-university-libera-universita-internazionale-degli-studi-sociali-guido-carl', 'luiss'],
  ['glion', 'glion-switzerland'],
  ['ucl-centre-for-languages-and-international-education', 'ucl'],
  ['cesi-school-of-engineering', 'cesi'],
];

const rows = [];
let programs = 0;

for (const [qsSlug, cardSlug] of PAIRS) {
  const src = path.join(EX, `${qsSlug}.json`);
  const card = path.join(CATALOG, `${cardSlug}.json`);
  if (!fs.existsSync(src)) { rows.push({ qsSlug, cardSlug, ok: false, why: 'нет выгрузки QS' }); continue; }
  if (!fs.existsSync(card)) { rows.push({ qsSlug, cardSlug, ok: false, why: 'нет карточки в каталоге' }); continue; }

  const ex = JSON.parse(fs.readFileSync(src, 'utf8'));
  if (ex.catalogSlug && ex.catalogSlug !== cardSlug) {
    rows.push({ qsSlug, cardSlug, ok: false, why: `выгрузка уже привязана к ${ex.catalogSlug}` });
    continue;
  }

  const n = (ex.programs || []).length;
  programs += n;
  rows.push({ qsSlug, cardSlug, ok: true, programs: n, name: ex.name, was: ex.catalogSlug ?? null });

  if (APPLY) {
    ex.catalogSlug = cardSlug;
    ex.matchMethod = 'owner-decision-2026-08-20';
    fs.writeFileSync(src, JSON.stringify(ex, null, 1));
  }
}

for (const r of rows) {
  console.log(`${r.ok ? 'ok  ' : 'СТОП'} ${r.qsSlug.slice(0, 46).padEnd(48)}→ ${String(r.cardSlug).padEnd(20)}${r.ok ? `${r.programs}п` : r.why}`);
}
console.log(`\nпривязано пар: ${rows.filter((r) => r.ok).length} из ${PAIRS.length}, программ: ${programs}`);

fs.writeFileSync(OUT, JSON.stringify({ generatedAt: '2026-08-20', applied: APPLY, rows }, null, 1));
if (!APPLY) console.log('СУХОЙ ПРОГОН — для записи добавь --apply');
