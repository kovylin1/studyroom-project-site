#!/usr/bin/env node
// kompas-scholarships-clean.mjs — применить ужесточённые фильтры имён к УЖЕ собранным
// выгрузкам стипендий, без повторного обхода сети.
//
// Зачем. Просмотр выборки вузов с origin:'hub-headings' (163 вуза, 1223 записи) показал
// 8% брака: предложения вместо названий («We offer scholarships»), обрывки абзацев
// («average financial assistance award of $8,092»), обобщённые разделы («External
// Scholarships»), склейки имени с описанием через «|». Правила разбора ужесточены
// (lib/kompas-scholarships-parse.mjs + тесты), но 1954 записи собраны СТАРЫМИ правилами,
// и повторный обход 823 вузов — это часы сети. Имя чинится без сети: оно уже в выгрузке.
//
// Что делает:
//   * прогоняет имя каждой записи через acceptName — тот же фильтр, что и сбор;
//   * запись, которую фильтр не принял, УДАЛЯЕТСЯ ИЗ ВЫГРУЗКИ (не из каталога — каталога
//     эти записи ещё не касались; правило «ничего не удаляем» защищает данные владельца,
//     а это наш собственный брак разбора, и он врёт оператору в панели);
//   * имя, которое фильтр почистил (склейка через «|», хвостовая точка), переписывается;
//   * после переименования снимаются появившиеся повторы.
//
// Суммы НЕ трогаем: «до …» и «/мес» восстанавливаются только из полного текста страницы,
// а в выгрузке лежит обрезанное описание. Их чинит повторный обход — задача отдельная.
//
// Откат: sources/kompas/scholarship-clean-backup.json — полные снимки удалённых записей
// и прежних имён. Идемпотентно: повтор ничего не находит.
//
// Запуск: node kompas-scholarships-clean.mjs [--apply]

import fs from 'node:fs/promises';
import path from 'node:path';
import { KOMPAS_DIR, EXTRACTS_DIR, args, logger } from './lib/kompas-collect.mjs';
import { acceptName } from './lib/kompas-scholarships-parse.mjs';

const log = logger('sch-clean');
const APPLY = args.has('apply');
const DIR = path.join(EXTRACTS_DIR, 'scholarships');
const OUT_BACKUP = path.join(KOMPAS_DIR, 'scholarship-clean-backup.json');
const OUT_REVIEW = path.join(KOMPAS_DIR, 'scholarship-clean-review.json');

// Порог, с которого вуз попадает в панель поимённо: одна-две отброшенные записи — это
// обычный шум разбора, три и больше — значит разбор на этом сайте систематически мимо.
const CASE_MIN_REMOVED = 3;

const readJson = async (f) => JSON.parse(await fs.readFile(f, 'utf8'));
const now = new Date().toISOString();

async function main() {
  if (!APPLY) log('СУХОЙ ПРОГОН: только считаю. Для записи добавь --apply');

  const files = (await fs.readdir(DIR)).filter((f) => f.endsWith('.json'));
  // Бэкап пишется в обёртке { generatedAt, note, summary, universities }, поэтому и
  // читать надо universities: без этого повторный прогон видел пустую карту и панель
  // теряла все поимённые кейсы (поймано повторным прогоном, а не рассуждением).
  const backup = (await readJson(OUT_BACKUP).catch(() => null))?.universities ?? {};
  const perUni = [];
  const byOrigin = {};
  let removed = 0; let renamed = 0; let dedup = 0; let kept = 0;

  for (const f of files) {
    const slug = f.replace(/\.json$/, '');
    const ex = await readJson(path.join(DIR, f));
    const list = ex.scholarships ?? [];
    if (!list.length) continue;

    const out = []; const dropped = []; const renames = []; const seen = new Set();
    for (const s of list) {
      const name = acceptName(s.name);
      if (!name) { dropped.push(s); continue; }
      if (name !== s.name) renames.push({ was: s.name, now: name });
      const key = name.toLowerCase();
      if (seen.has(key)) { dropped.push({ ...s, _reason: 'повтор после чистки имени' }); dedup++; continue; }
      seen.add(key);
      out.push(name === s.name ? s : { ...s, name });
    }

    kept += out.length;
    byOrigin[ex.origin ?? 'unknown'] ??= { records: 0, removed: 0 };
    byOrigin[ex.origin ?? 'unknown'].records += list.length;
    byOrigin[ex.origin ?? 'unknown'].removed += dropped.length;

    if (!dropped.length && !renames.length) continue;
    removed += dropped.length;
    renamed += renames.length;

    perUni.push({ slug, origin: ex.origin ?? null, before: list.length, after: out.length, removed: dropped.length, renamed: renames.length,
      droppedNames: dropped.map((d) => d.name), renames });

    // Бэкап только первый раз: повторный прогон не должен подменить снимок «до» тем,
    // что уже почищено (то же правило, что у слияния дублей).
    backup[slug] ??= { cleanedAt: now, origin: ex.origin ?? null, before: list.length, after: out.length, dropped, renames };

    if (APPLY) {
      ex.scholarships = out;
      ex.cleanedAt = now;
      await fs.writeFile(path.join(DIR, f), JSON.stringify(ex, null, 2) + '\n', 'utf8');
    }
  }

  // Кейсы в панель: свод + вузы, где разбор мимо систематически.
  const cases = [];
  const addCase = (slug, name, issue, severity, detail, extra = {}) => cases.push({
    id: `${slug}||${issue}||session6-schol-clean`,
    slug, name, issue, severity, detail,
    catalog: null, official: null, program: null, sourceUrl: null, ...extra,
    checkedAt: now, decision: null, decidedAt: null, applied: false,
  });

  // Кейсы строим по НАКОПЛЕННОМУ бэкапу, а не по дельте этого прогона: чистка
  // идемпотентна, и на повторе дельта пустая — панель молча потеряла бы 11 кейсов
  // и отчиталась «отброшено 0», хотя записи отброшены и лежат в бэкапе.
  const ever = Object.entries(backup).map(([slug, b]) => ({
    slug, origin: b.origin ?? null, before: b.before ?? 0, after: b.after ?? 0,
    removed: (b.dropped ?? []).length, renamed: (b.renames ?? []).length,
    droppedNames: (b.dropped ?? []).map((d) => d.name),
  }));
  const everRemoved = ever.reduce((a, u) => a + u.removed, 0);
  const everRenamed = ever.reduce((a, u) => a + u.renamed, 0);
  const everBefore = ever.reduce((a, u) => a + u.before, 0);
  const everOrigin = {};
  for (const u of ever) {
    everOrigin[u.origin ?? 'unknown'] ??= { records: 0, removed: 0 };
    everOrigin[u.origin ?? 'unknown'].records += u.before;
    everOrigin[u.origin ?? 'unknown'].removed += u.removed;
  }

  addCase('__kompas__', 'Каталог целиком', 'kompas_scholarship_parse_junk', 'warning',
    `Просмотр выборки собранных стипендий показал брак разбора. Затронуто ${ever.length} вузов: из их ${everBefore} записей отброшено ${everRemoved} — предложения вместо названий («We offer scholarships»), обрывки абзацев («average financial assistance award of $8,092»), обобщённые разделы («External Scholarships»). По происхождению (только затронутые вузы, не весь корпус): ${Object.entries(everOrigin).map(([k, v]) => `${k} ${v.removed}/${v.records}`).join(', ')}; по корпусу целиком это ${everRemoved} из ${everRemoved + kept}. Заголовки страницы-раздела грязнее отдельных страниц, как и ожидалось. Имён почищено от склейки с описанием ${everRenamed}. В выгрузках осталось ${kept} записей. Правила разбора ужесточены и покрыты тестами; суммы НЕ чинились — «до …» и «/мес» восстанавливаются только повторным обходом сети.`,
    { catalog: everBefore, official: everRemoved });

  for (const u of ever.filter((u) => u.removed >= CASE_MIN_REMOVED).sort((a, b) => b.removed - a.removed)) {
    addCase(u.slug, u.slug, 'kompas_scholarship_parse_junk_uni', 'info',
      `Из ${u.before} собранных записей отброшено ${u.removed} — разбор страницы (${u.origin}) давал не стипендии: ${u.droppedNames.slice(0, 5).map((n) => `«${n}»`).join('; ')}${u.droppedNames.length > 5 ? ` … и ещё ${u.droppedNames.length - 5}` : ''}. Осталось ${u.after}. Откат — scholarship-clean-backup.json.`,
      { catalog: u.before, official: u.after });
  }

  if (APPLY) {
    await fs.writeFile(OUT_BACKUP, JSON.stringify({
      generatedAt: now,
      note: 'Записи, отброшенные ужесточёнными фильтрами имён, и прежние имена переименованных. Откат: вернуть dropped в extracts/scholarships/<slug>.json и переименовать обратно по renames.',
      // Сводка — по накопленному бэкапу, не по дельте прогона: на повторе дельта нулевая.
      summary: { universities: ever.length, removed: everRemoved, renamed: everRenamed, keptNow: kept, lastRunRemoved: removed, lastRunDedup: dedup },
      universities: backup,
    }, null, 2) + '\n', 'utf8');
    await fs.writeFile(OUT_REVIEW, JSON.stringify({
      generatedAt: now, scope: 'kompas-scholarship-clean',
      summary: { total: cases.length }, items: cases,
    }, null, 2) + '\n', 'utf8');
  }

  console.table(perUni.sort((a, b) => b.removed - a.removed).slice(0, 12).map(({ slug, origin, before, after, removed: r, renamed: n }) => ({ slug, origin, before, after, removed: r, renamed: n })));
  console.log(`вузов затронуто ${perUni.length}; отброшено ${removed}, переименовано ${renamed}, повторов снято ${dedup}; осталось ${kept}`);
  console.log(`по происхождению: ${Object.entries(byOrigin).map(([k, v]) => `${k} ${v.removed}/${v.records}`).join(', ')}`);
  console.log(APPLY ? `ПРИМЕНЕНО + бэкап ${path.basename(OUT_BACKUP)}, кейсов ${cases.length}` : 'СУХОЙ ПРОГОН — для записи добавь --apply');
}

main().catch((e) => { console.error(e); process.exit(1); });
