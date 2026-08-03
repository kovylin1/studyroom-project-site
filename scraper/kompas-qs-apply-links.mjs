// kompas-qs-apply-links.mjs — применяет привязки QS разряда «надёжно» и разбирает,
// что за 46 записей остались без карточки.
//
// Решение владельца 2026-08-03: разряд «надёжно» применить; «без карточки — заводить,
// если они новые». Второе с оговоркой «если новые», поэтому здесь стоит проверка:
// среди 46 есть и не-заведения («Indian Internal Applications» — раздел портала),
// и подготовительные отделения уже заведённых вузов («INTO Manchester in partnership
// with Manchester Metropolitan University» при живом `manchester-met`).
// Замер schema-first: schema сайта требует city и durationYears, а QS не отдаёт ни того,
// ни другого. Выдумывать их нельзя — это ровно фабрикация Navitas, которую чиним рядом.
// Поэтому карточки НЕ заводятся, а список выходит разобранным по родам, с указанием,
// чего не хватает.
//
// Пишет: sources/kompas/membership/qs.json (catalogSlug у привязанных),
//        sources/kompas/QS-NEW-CARDS.md (разбор 46).
// Каталог не трогает.
//
// Запуск: node scraper/kompas-qs-apply-links.mjs [--dry-run]

import fs from 'fs/promises';
import path from 'path';
import { KOMPAS_DIR } from './lib/kompas-collect.mjs';
import { norm, stripGeneric } from './lib/kompas-catalog-match.mjs';

const DRY = process.argv.includes('--dry-run');
const WORK_DIR = path.join(KOMPAS_DIR, 'catalog-work');
const MEMBERSHIP = path.join(KOMPAS_DIR, 'membership', 'qs.json');
const DIAG = path.join(KOMPAS_DIR, 'qs-unlinked.json');
const OUT_MD = path.join(KOMPAS_DIR, 'QS-NEW-CARDS.md');

// Записи портала, которые не являются учебным заведением. Проверено глазами по списку:
// это разделы интерфейса и объединения школ, а не вузы.
const NOT_AN_INSTITUTION = /^(indian internal applications|.*schools commission.*)$/i;

// Подготовительное отделение при вузе: у QS это отдельная запись, в каталоге —
// либо та же карточка, либо отдельная карточка центра.
const ARM = /\b(foundation|international college|pathway|in partnership with|study centre|study center)\b/i;

const readJson = async (f) => JSON.parse(await fs.readFile(f, 'utf8'));

/** Полное вхождение имени карточки в имя записи QS: «INTO Manchester … Manchester Metropolitan University». */
function findParent(qsName, catalog) {
  const hay = ` ${stripGeneric(qsName)} `;
  const hits = catalog
    .filter((c) => {
      const needle = stripGeneric(c.name);
      return needle.length >= 8 && hay.includes(` ${needle} `);
    })
    .sort((a, b) => stripGeneric(b.name).length - stripGeneric(a.name).length);
  return hits[0] || null;
}

async function main() {
  const diag = await readJson(DIAG);
  const membership = await readJson(MEMBERSHIP);

  const files = (await fs.readdir(WORK_DIR)).filter((f) => f.endsWith('.json'));
  const catalog = [];
  for (const f of files) {
    try {
      const c = await readJson(path.join(WORK_DIR, f));
      catalog.push({ slug: c.slug || f.replace(/\.json$/, ''), name: c.name || '', country: c.country || null });
    } catch { /* битый файл пропускаем */ }
  }

  // ---- 1. Привязки разряда «надёжно» ----------------------------------------
  const reliable = diag.rows.filter((r) => r.tier === 'надёжно' && r.suggestions.length);
  const byQsSlug = new Map(membership.institutions.map((i) => [i.slug, i]));
  const applied = [];
  const collisions = new Map();

  for (const r of reliable) {
    const s = r.suggestions[0];
    const rec = byQsSlug.get(r.qsSlug);
    if (!rec) continue;
    if (!DRY) {
      rec.catalogSlug = s.slug;
      rec.matchMethod = 'owner-approved/similarity-0.75+';
      rec.matchScore = s.score;
    }
    applied.push({ qs: r.qsName, slug: s.slug, score: s.score, programs: r.programs });
    if (!collisions.has(s.slug)) collisions.set(s.slug, []);
    collisions.get(s.slug).push(r.qsName);
  }

  const merged = [...collisions.entries()].filter(([, v]) => v.length > 1);

  if (!DRY) {
    membership._meta = {
      ...(membership._meta || {}),
      ownerLinksAppliedAt: new Date().toISOString(),
      ownerLinksApplied: applied.length,
    };
    await fs.writeFile(MEMBERSHIP, JSON.stringify(membership, null, 2) + '\n', 'utf8');
  }

  // ---- 2. Разбор 46 без карточки --------------------------------------------
  const absent = diag.rows.filter((r) => !r.catalogSlug && !r.suggestions.length);
  const rows = absent.map((r) => {
    if (NOT_AN_INSTITUTION.test(r.qsName)) return { ...r, kind: 'не заведение' };
    const parent = findParent(r.qsName, catalog);
    if (parent) return { ...r, kind: 'отделение существующей карточки', parent };
    if (ARM.test(r.qsName)) return { ...r, kind: 'отделение, головной карточки нет' };
    return { ...r, kind: 'новый вуз' };
  });

  const group = (k) => rows.filter((r) => r.kind === k).sort((a, b) => b.programs - a.programs);
  const prog = (list) => list.reduce((s, r) => s + r.programs, 0);

  const md = ['# QS — 46 записей без карточки: что из них заводить', ''];
  md.push(`**Дата:** ${new Date().toISOString().slice(0, 10)} · каталог не тронут, карточки не заведены.`);
  md.push('');
  md.push('Владелец 2026-08-03: «заводить, если они новые». Проверка показала, что новые не все.');
  md.push('');
  md.push('| Род | Записей | Программ |');
  md.push('|---|---:|---:|');
  for (const k of ['новый вуз', 'отделение существующей карточки', 'отделение, головной карточки нет', 'не заведение']) {
    md.push(`| ${k} | ${group(k).length} | ${prog(group(k))} |`);
  }
  md.push('');
  md.push('## Почему карточки всё-таки не заведены');
  md.push('');
  md.push('Схема сайта требует `city` (непустой) и `durationYears` у каждой программы.');
  md.push('QS не отдаёт ни того, ни другого: город пуст у всех 512 записей, `campusesStated`');
  md.push('содержит «1 Campus», у программ есть только `sourceLevel` без длительности.');
  md.push('Проставить их от себя — это ровно та фабрикация, из-за которой у 10 британских');
  md.push('вузов Navitas стоят выдуманные цены. Нужен источник города и длительности:');
  md.push('офсайт вуза либо ручной ввод владельцем. Всё остальное для заведения готово.');
  md.push('');

  for (const k of ['новый вуз', 'отделение существующей карточки', 'отделение, головной карточки нет', 'не заведение']) {
    const list = group(k);
    if (!list.length) continue;
    md.push(`## ${k} — ${list.length}`);
    md.push('');
    md.push(k === 'отделение существующей карточки'
      ? '| Имя у QS | Программ | Страна | Головная карточка |'
      : '| Имя у QS | Программ | Страна | Провайдер |');
    md.push('|---|---:|---|---|');
    for (const r of list) {
      const tail = k === 'отделение существующей карточки'
        ? `\`${r.parent.slug}\` — ${r.parent.name}`
        : (r.provider || '—');
      md.push(`| ${r.qsName} | ${r.programs} | ${r.country} | ${tail} |`);
    }
    md.push('');
  }

  if (!DRY) await fs.writeFile(OUT_MD, md.join('\n'), 'utf8');

  process.stderr.write(
    `[qs-links] ${DRY ? 'СУХОЙ ПРОГОН: ' : ''}привязано ${applied.length} (программ ${applied.reduce((s, a) => s + a.programs, 0)}), ` +
    `карточек с двумя записями QS ${merged.length}. ` +
    `Без карточки ${rows.length}: новых ${group('новый вуз').length}, ` +
    `отделений существующих ${group('отделение существующей карточки').length}, ` +
    `отделений без головной ${group('отделение, головной карточки нет').length}, ` +
    `не заведений ${group('не заведение').length}.\n`,
  );
  if (merged.length) {
    process.stderr.write(`[qs-links] объединять программы, не затирать: ${merged.map(([s, v]) => `${s}(${v.length})`).join(', ')}\n`);
  }
}

main().catch((e) => { process.stderr.write(`[qs-links] упал: ${e.stack}\n`); process.exit(1); });
