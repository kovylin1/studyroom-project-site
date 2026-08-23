#!/usr/bin/env node
// Добор программ агрегаторов в рабочую копию каталога (задача 1.9 / 3.5-f).
// Цель — полный состав: у kaplan в копии лежат все 4 725 программ, надо так же
// и по остальным источникам.
//
// Что заводится: строка выгрузки, которую матчер не нашёл в карточке
// (scraper/lib/program-match.mjs). Спорные (`ambiguous`) не трогаются — там
// после снятия приставки степени подходит больше одной программы карточки.
//
// Уровень: сперва из поля источника, затем — решение владельца 23.08 — из явной
// приставки степени в названии («MSc Data Science» → master). Это улика источника,
// а не догадка. Программа без распознанного уровня НЕ создаётся: правило владельца.
// `certificate` и `diploma` схема каталога не принимает (8 уровней), такие тоже
// уходят кейсами, а не подгоняются под чужой уровень.
//
// Цены здесь не пишутся: после добора надо прогнать kompas-fees-apply.mjs,
// он проставит их уже по новым программам.
//
// Запуск: node scraper/kompas-programs-backfill.mjs [--dry] [--sources=qs,edvoy,...]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildIndex, matchProgram, norm, levelFromTitle } from './lib/program-match.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EX = path.join(ROOT, 'sources/kompas/extracts');
const WORK = path.join(ROOT, 'sources/kompas/catalog-work');
const BACKUP = path.join(ROOT, 'sources/kompas/programs-backfill-backup.json');
const REPORT = path.join(ROOT, 'sources/kompas/programs-backfill-report.json');
const CASES = path.join(ROOT, 'sources/kompas/programs-backfill-cases.json');
const REPORT_MD = path.join(ROOT, 'sources/kompas/PROGRAMS-BACKFILL.md');
const TODAY = '2026-08-23';

const DRY = process.argv.includes('--dry');
const SOURCES = (process.argv.find((a) => a.startsWith('--sources=')) || '--sources=qs,edvoy,kaplan,studygroup,oxford-international,qahe,iapro')
  .slice(10).split(',').map((x) => x.trim()).filter(Boolean);

// уровни источников → уровни схемы каталога (site/src/schema/university.ts)
const LEVEL_MAP = {
  bachelor: 'bachelor', master: 'master', phd: 'phd', foundation: 'foundation',
  pathway: 'foundation', language: 'english-language', 'english-language': 'english-language',
  'high-school': 'high-school', 'sixth-form': 'sixth-form', 'short-course': 'short-course',
};

// Как источник называет уровень своей разметкой (поле sourceLevel у QS).
// null — уровень есть, но схема каталога его не принимает; такие уходят кейсами,
// а не подгоняются под соседний.
const SOURCE_LEVEL_MAP = {
  Bachelors: 'bachelor', Masters: 'master', PhD: 'phd',
  'High School': 'high-school', Pathway: 'foundation', 'English Course': 'english-language',
  Undergraduate: 'bachelor', Postgraduate: 'master', Foundation: 'foundation',
  Diploma: null, 'Graduate Diploma': null, 'Advanced Diploma': null,
  Certificate: null, 'Graduate Certificate': null,
};

const slugify = (s) => norm(s).replace(/ /g, '-').slice(0, 90).replace(/^-+|-+$/g, '');

/** Срок в годах из строки источника: «3 Years», «24 Months». Ничего не выдумываем. */
function durationYears(d) {
  if (typeof d === 'number' && d > 0 && d < 12) return d;
  const s = String(d || '').toLowerCase();
  let mm = s.match(/(\d+(?:\.\d+)?)\s*(year|yr)/);
  if (mm) { const v = parseFloat(mm[1]); if (v > 0 && v <= 10) return v; }
  mm = s.match(/(\d+)\s*month/);
  if (mm) { const v = parseInt(mm[1], 10) / 12; if (v > 0 && v <= 10) return Math.round(v * 100) / 100; }
  return undefined;
}

const cards = new Map(), idx = new Map();
for (const f of fs.readdirSync(WORK)) {
  if (!f.endsWith('.json')) continue;
  const slug = f.replace(/\.json$/, '');
  const card = JSON.parse(fs.readFileSync(path.join(WORK, f), 'utf8'));
  cards.set(slug, card);
  idx.set(slug, buildIndex(card.programs));
}

const cases = [];
const stats = { sources: SOURCES.join(','), rows: 0, unmatched: 0, ambiguous: 0,
  levelFromSource: 0, levelFromSourceLevel: 0, levelFromTitle: 0, noLevel: 0, levelUnsupported: 0,
  duplicatesInSource: 0, created: 0, cardsTouched: 0, withDuration: 0, withUrl: 0, urlShared: 0 };

// Без прототипа: среди слагов карточек попадаются имена вроде `constructor`,
// и на обычном объекте проверка `if (!added[slug])` их не ловит.
const added = Object.create(null); // slug карточки -> список слагов заведённых программ
const seenPerCard = new Map();    // slug карточки -> Set нормализованных названий этого прогона

for (const src of SOURCES) {
  const dir = path.join(EX, src);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (d.notAnInstitution || d.noPrograms || d.excludedFromDiff) continue;
    const slug = d.catalogSlug || d.slug;
    const card = cards.get(slug);
    if (!card) continue;
    if (!Array.isArray(card.programs)) card.programs = [];
    if (!seenPerCard.has(slug)) seenPerCard.set(slug, new Set());
    const seen = seenPerCard.get(slug);
    // сколько строк выгрузки делят одну ссылку — см. запись programUrl ниже
    const urlCount = new Map();
    for (const ep of (d.programs || [])) {
      if (ep.programUrl) urlCount.set(ep.programUrl, (urlCount.get(ep.programUrl) || 0) + 1);
    }

    for (const ep of (d.programs || [])) {
      stats.rows++;
      const hit = matchProgram(idx.get(slug), ep);
      if (hit.program) continue;
      if (hit.how === 'ambiguous') { stats.ambiguous++; continue; }
      stats.unmatched++;

      const key = norm(ep.title);
      if (!key) continue;
      if (seen.has(key)) { stats.duplicatesInSource++; continue; }

      let level = null, from = null;
      const raw = ep.level ? String(ep.level).toLowerCase() : null;
      // У QS 8 551 строка идёт с пустым level, но с заполненным sourceLevel
      // («Bachelors», «Masters», «High School»). Это поле источника, а не догадка —
      // читаем его вторым после level.
      const rawSrc = ep.sourceLevel ? SOURCE_LEVEL_MAP[String(ep.sourceLevel).trim()] : undefined;
      if (raw && LEVEL_MAP[raw]) { level = LEVEL_MAP[raw]; from = 'source'; stats.levelFromSource++; }
      else if (rawSrc) { level = rawSrc; from = 'sourceLevel'; stats.levelFromSourceLevel++; }
      else if (raw && !LEVEL_MAP[raw]) {
        stats.levelUnsupported++;
        cases.push({ source: src, catalogSlug: slug, title: ep.title, sourceLevel: raw,
          reason: 'level-unsupported',
          note: 'уровень источника не принимает схема каталога — под чужой не подгоняем' });
        continue;
      } else if (ep.sourceLevel && rawSrc === null) {
        stats.levelUnsupported++;
        cases.push({ source: src, catalogSlug: slug, title: ep.title, sourceLevel: ep.sourceLevel,
          reason: 'level-unsupported',
          note: 'уровень источника не принимает схема каталога — под чужой не подгоняем' });
        continue;
      } else {
        const guess = levelFromTitle(ep.title);
        if (guess) { level = guess; from = 'title'; stats.levelFromTitle++; }
      }
      if (!level) {
        stats.noLevel++;
        cases.push({ source: src, catalogSlug: slug, title: ep.title, reason: 'no-level',
          note: 'уровня нет ни у источника, ни в названии — программа не создаётся' });
        continue;
      }

      // слаг уникальный внутри карточки
      let ps = slugify(ep.title) || ('program-' + (card.programs.length + 1));
      if (card.programs.some((p) => p.slug === ps)) {
        let i = 2;
        while (card.programs.some((p) => p.slug === ps + '-' + i)) i++;
        ps = ps + '-' + i;
      }
      const prog = { slug: ps, title: ep.title, level,
        source: src, verifiedBySite: false, confidence: 0.6,
        kompasStatus: 'source-added', kompasCheckedAt: TODAY };
      const dy = durationYears(ep.duration);
      if (dy) { prog.durationYears = dy; stats.withDuration++; }
      // Ссылку записываем, только если внутри выгрузки она ведёт к одной программе.
      // У QS это общая ссылка на портал (35 238 строк из 35 259 делят её): записав
      // такую новой программе, мы сажаем на неё всю выгрузку вуза при следующем
      // сопоставлении. Один раз уже наступили — покрытие нарисовалось схлопыванием.
      if (ep.programUrl && /^https?:\/\//.test(ep.programUrl) && urlCount.get(ep.programUrl) === 1) {
        prog.programUrl = ep.programUrl;
        stats.withUrl++;
      } else if (ep.programUrl) stats.urlShared++;
      if (level === 'foundation') prog.programType = 'pathway';

      card.programs.push(prog);
      seen.add(key);
      if (!added[slug]) { added[slug] = []; stats.cardsTouched++; }
      added[slug].push({ slug: ps, title: ep.title, level, levelFrom: from, source: src });
      stats.created++;
      // индекс обновляем сразу, иначе следующая строка того же названия заведётся снова
      idx.set(slug, buildIndex(card.programs));
    }
  }
}

if (!DRY) {
  for (const slug of Object.keys(added)) {
    fs.writeFileSync(path.join(WORK, slug + '.json'), JSON.stringify(cards.get(slug), null, 2));
  }
  fs.writeFileSync(BACKUP, JSON.stringify({ appliedAt: TODAY, added }, null, 1));
}
fs.writeFileSync(REPORT, JSON.stringify({ dry: DRY, sources: SOURCES, stats }, null, 1));
fs.writeFileSync(CASES, JSON.stringify(cases, null, 1));

const byReason = {};
for (const c of cases) byReason[c.reason] = (byReason[c.reason] || 0) + 1;
let md = '# Добор программ агрегаторов\n\n' + (DRY ? '**Прогон вхолостую (--dry).**\n\n' : '');
md += 'Источники: `' + SOURCES.join('`, `') + '`.\n\n| Показатель | Значение |\n|---|---:|\n';
for (const k of Object.keys(stats)) md += '| ' + k + ' | ' + stats[k] + ' |\n';
md += '\n## Не заведено\n\n| Причина | Штук |\n|---|---:|\n';
for (const k of Object.keys(byReason).sort((a, b) => byReason[b] - byReason[a])) md += '| `' + k + '` | ' + byReason[k] + ' |\n';
md += '\nПодробности: `programs-backfill-cases.json`, откат: `programs-backfill-backup.json`.\n';
fs.writeFileSync(REPORT_MD, md);
console.log(JSON.stringify(stats, null, 1));
console.log('кейсы:', JSON.stringify(byReason));
