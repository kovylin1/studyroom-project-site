#!/usr/bin/env node
// kompas-gaps.mjs — КОМПАС: разбор 45 вузов, у которых источник собран, а выгрузки нет.
//
// Замер сессии 4 показал 45 таких вузов и назвал это «нашим пробелом сбора».
// Проверка показала, что это НЕ одна причина, а четыре, и три из них
// перезапуском коллектора не чинятся:
//
//  1. collectable — вуз есть в списке агрегатора, выгрузки просто нет → добрать;
//  2. merged      — StudyGroup слил карточку «… Direct Entry» в основную;
//                   отдельного файла и не должно быть, это дубль каталога;
//  3. stale-mark  — вуза нет в ЖИВОМ списке агрегатора: метка partnerSource
//                   поставлена по устаревшим заметкам;
//  4. not-a-uni   — у StudyGroup это учебный центр, а не вуз-партнёр.
//
// Сети нет, каталог не трогается.
// Выход: sources/kompas/gap-report.json + gap-review.json (кейсы в панель)

import fs from 'node:fs/promises';
import path from 'node:path';
import { KOMPAS_DIR, logger } from './lib/kompas-collect.mjs';

const log = logger('gaps');
const readJson = async (f) => JSON.parse(await fs.readFile(f, 'utf8'));

async function main() {
  const diff = await readJson(path.join(KOMPAS_DIR, 'diff-report.json'));
  const gaps = diff.universities.filter((u) => u.status === 'no-extract');
  const now = new Date().toISOString();

  const mem = {};
  // iapro добавлен в сессии 4.5: без него любой вуз, размеченный только через IAPro,
  // автоматически считался «меткой по устаревшим заметкам», хотя партнёрство как раз
  // подтверждено — портал просто не отдаёт по нему программ.
  for (const s of ['edvoy', 'studygroup', 'oxford-international', 'kaplan', 'qahe', 'iapro']) {
    try { mem[s] = await readJson(path.join(KOMPAS_DIR, 'membership', `${s}.json`)); } catch { mem[s] = null; }
  }
  // Бренды, которые ProgrammeFinder вообще знает. Партнёр, которого в этом списке нет,
  // — это «источник программ не отдаёт», а не «метка устарела».
  let iaproBrands = new Set();
  try {
    const c = await readJson(path.join(KOMPAS_DIR, 'membership', 'iapro-courses.json'));
    iaproBrands = new Set((c.brands ?? []).map((b) => b.label));
  } catch { /* дампа нет — тогда просто не уточняем */ }
  const readCard = async (slug) => {
    try { return await readJson(path.join(KOMPAS_DIR, 'catalog-work', `${slug}.json`)); } catch { return null; }
  };

  const sg = mem.studygroup ?? {};
  // «&» → «and» до срезки символов: слаги каталога пишут «texas-aandm-…», а наивная
  // срезка давала «texas-a-m-…» и имя источника переставало совпадать со слагом дыры.
  const slugify = (s) => String(s).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const mergedInto = new Map();     // слаг-дубль → слаг, в который слили
  for (const m of sg.mergedSlugs ?? []) {
    for (const from of m.from ?? []) mergedInto.set(slugify(from), m.slug);
  }
  // Целевой слаг берём У ИСТОЧНИКА, а не отрезанием «-direct-entry» от слага дубля.
  // Догадка врала: у «long-island-university-brooklyn-direct-entry» она давала
  // «long-island-university-brooklyn», карточки с таким слагом в каталоге нет вовсе,
  // а настоящая — «liu-brooklyn» (89 программ). Оператор шёл сливать в пустоту.
  for (const m of sg.matched ?? []) {
    if (m.from && m.to) mergedInto.set(slugify(m.from), m.to);
  }
  const sgCentres = new Set((sg.skippedNotUniversity ?? []).map((x) => (typeof x === 'string' ? x : x.name ?? x.from ?? '')));

  const inList = (src, slug) => {
    const m = mem[src];
    if (!m) return false;
    return JSON.stringify(m).includes(`"${slug}"`);
  };

  // Присутствие в списке источника ещё не значит «есть что собрать»: Edvoy держит
  // бренд в реестре и отдаёт по нему НОЛЬ курсов. Сессия 5, точечный прогон
  // `--only=australian-vocational-training-academy,trine-university` — 0 курсов у обоих.
  // Без этой проверки такой вуз годами числился «недобором коллектора», и прогон за
  // прогоном ничего не менял.
  const edvoyEmpty = new Set((mem.edvoy?.emptyUnis ?? []).map((x) => x.edpRefId ?? x.from));
  // Тот же список знает и вторую вещь: бренд источника может быть привязан к ДРУГОЙ
  // карточке каталога. Тогда выгрузки под этим слагом не будет никогда — не потому что
  // сбор не дошёл, а потому что в каталоге на один вуз две карточки.
  const edvoyBoundElsewhere = new Map();
  for (const m of mem.edvoy?.matched ?? []) {
    if (m.edpRefId && m.to && m.edpRefId !== m.to) edvoyBoundElsewhere.set(m.edpRefId, { to: m.to, courses: m.courses ?? 0 });
  }

  const rows = []; const cases = [];
  for (const g of gaps) {
    const hit = g.ready.filter((s) => inList(s, g.slug));
    let kind; let detail; let via = g.ready.join(', ');

    const card = await readCard(g.slug);
    if (card?.kompasStatus === 'programs-not-collected') {
      kind = 'awaiting-collection';
      detail = `Карточка заведена в сессии 4.5 по решению владельца: договор с учреждением есть, а программ у источника НЕТ ВОВСЕ. Это не пробел разметки и не недобор коллектора — нужен сбор с офсайта вуза. До него карточка не проходит схему (programs.min(1)) и в живой каталог не поедет.`;
    } else if (edvoyBoundElsewhere.has(g.slug)) {
      const b = edvoyBoundElsewhere.get(g.slug);
      kind = 'dupe-card';
      detail = `Бренд источника (edvoy, ${b.courses} курсов) привязан к другой карточке каталога — «${b.to}». Выгрузки под этим слагом не будет: это не недобор, а две карточки на один вуз. Нужно решение: слить или развести.`;
    } else if (edvoyEmpty.has(g.slug)) {
      kind = 'source-no-programs';
      detail = `Вуз есть в реестре Edvoy, но курсов источник по нему НЕ отдаёт вовсе (проверено точечным прогоном сессии 5: 0 курсов). Прогон коллектора это не чинит — нужен второй источник или сбор с офсайта.`;
    } else if (hit.length && !(g.ready.length === 1 && g.ready[0] === 'iapro' && !iaproBrands.has(g.name))) {
      kind = 'collectable';
      detail = `Вуз есть в списке источника (${hit.join(', ')}), а выгрузки нет — недобор коллектора. Чинится прогоном, решение владельца не нужно.`;
    } else if (g.ready.length === 1 && g.ready[0] === 'iapro') {
      kind = 'source-no-programs';
      detail = `Партнёрство IAPro подтверждено (вуз в реестре), но в ProgrammeFinder такого бренда нет — источник по нему программ не отдаёт. Метка верна, сверять нечем; нужен второй источник или сбор с офсайта.`;
    } else if (/-direct-entry$/.test(g.slug) || mergedInto.has(g.slug)) {
      kind = 'merged';
      const into = mergedInto.get(g.slug) ?? g.slug.replace(/-direct-entry$/, '');
      const target = await readCard(into);
      const where = target
        ? `карточка «${into}» в каталоге есть, программ в ней ${(target.programs ?? []).length}`
        : `карточки «${into}» в каталоге НЕТ — цель слияния надо назначить руками`;
      detail = `StudyGroup слил эту запись в карточку «${into}»: у источника это не отдельный вуз, а вариант поступления. Отдельной выгрузки быть и не должно — зато в каталоге две карточки на один вуз (${where}).`;
    } else if (g.ready.includes('studygroup') && sgCentres.size) {
      kind = 'not-a-uni';
      detail = `У StudyGroup это учебный центр, а не вуз-партнёр: в списке вузов его нет. Метка «партнёр через studygroup» на карточке вуза выглядит ошибкой.`;
    } else {
      kind = 'stale-mark';
      detail = `В ЖИВОМ списке источника (${via}) этого вуза нет. Метка partnerSource поставлена по заметкам, а не по сегодняшнему составу партнёров. Нужно решение: снять метку или назначить другой источник.`;
    }

    rows.push({ slug: g.slug, name: g.name, kind, ready: g.ready, catalogPrograms: g.catalogPrograms });
    cases.push({
      id: `${g.slug}||kompas_gap_${kind.replace(/-/g, '_')}||${via}`,
      slug: g.slug, name: g.name,
      issue: `kompas_gap_${kind.replace(/-/g, '_')}`,
      severity: kind === 'collectable' ? 'info' : 'warning',
      detail: `${detail} В карточке ${g.catalogPrograms} программ.`,
      catalog: g.catalogPrograms, official: null, program: null, sourceUrl: null,
      checkedAt: now, decision: null, decidedAt: null, applied: false,
    });
  }

  const byKind = {};
  for (const r of rows) byKind[r.kind] = (byKind[r.kind] ?? 0) + 1;

  await fs.writeFile(path.join(KOMPAS_DIR, 'gap-report.json'),
    JSON.stringify({ generatedAt: now, summary: { total: rows.length, byKind }, universities: rows }, null, 2) + '\n', 'utf8');
  await fs.writeFile(path.join(KOMPAS_DIR, 'gap-review.json'),
    JSON.stringify({ generatedAt: now, scope: 'kompas-gaps', summary: { total: cases.length, byIssue: byKind }, items: cases }, null, 2) + '\n', 'utf8');

  log(`разобрано ${rows.length}: ${Object.entries(byKind).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  for (const k of Object.keys(byKind)) {
    log(`  ${k}: ${rows.filter((r) => r.kind === k).map((r) => r.slug).join(', ')}`);
  }
  console.log('GAPS DONE');
}

main().catch((e) => { console.error(e); process.exit(1); });
