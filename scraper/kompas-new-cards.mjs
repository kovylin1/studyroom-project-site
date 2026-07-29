// kompas-new-cards.mjs — КОМПАС 3.5: карточки прямых партнёров, которых нет в каталоге.
//
// Заводятся по прямой просьбе владельца 2026-07-23 («добавь новые карточки»).
// Это «список Б» сессии 1: партнёры из документа владельца, у которых карточки не было.
//
// ВАЖНО, чем это не нарушение правила «не фабриковать»: карточка собирается ТОЛЬКО из
// того, что реально снято с офсайта вуза (sources/kompas/extracts/direct/<slug>.json).
// Нет выгрузки — карточка не создаётся, вуз идёт в отчёт владельцу. Ничего не выдумываем:
// ни программ, ни цен, ни города. Поля, которых на сайте нет, остаются пустыми.
//
// Запуск: node kompas-new-cards.mjs [--apply]   (без --apply только показывает)

import fs from 'node:fs/promises';
import path from 'node:path';
import { KOMPAS_DIR, CATALOG_DIR, args, logger } from './lib/kompas-collect.mjs';

const log = logger('new-cards');
const APPLY = args.has('apply');
const DIR = path.join(KOMPAS_DIR, 'extracts', 'direct');

// Что заводим. name и country — из документа владельца, не выдуманы.
const NEW = [
  { slug: 'aurak', name: 'American University of Ras Al Khaimah', country: 'UAE', city: 'Ras Al Khaimah', raw: 'Aurak unit, Cyprus' },
  { slug: 'demiroglu-bilim-university', name: 'Demiroğlu Bilim University', country: 'Turkey', city: 'Istanbul', raw: 'Bilim Univ, Turkey' },
];

const LEVEL_RU = {
  bachelor: 'бакалавриат', master: 'магистратура', phd: 'докторантура',
  foundation: 'подготовка', diploma: 'диплом', certificate: 'сертификат',
  pathway: 'подготовительная программа', language: 'языковые курсы',
};

async function main() {
  const made = [];
  const skipped = [];

  for (const t of NEW) {
    let src;
    try { src = JSON.parse(await fs.readFile(path.join(DIR, `${t.slug}.json`), 'utf8')); }
    catch {
      // выгрузки нет — карточку НЕ придумываем
      skipped.push({ ...t, reason: 'нет выгрузки с офсайта' });
      continue;
    }
    const programs = (src.programs ?? []).filter((p) => p.title);
    if (!programs.length) { skipped.push({ ...t, reason: 'выгрузка пуста' }); continue; }

    const levels = [...new Set(programs.map((p) => p.level).filter(Boolean))];
    const priced = programs.filter((p) => p.tuition);
    const currency = priced[0]?.tuition?.currency ?? null;

    const card = {
      slug: t.slug,
      name: t.name,
      country: t.country,
      city: t.city,
      programs: programs.map((p) => ({
        slug: `${t.slug}-${p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)}`,
        title: p.title,
        ...(p.level ? { level: p.level } : {}),
        programType: 'degree',
        ...(p.duration ? { durationText: p.duration } : {}),
        ...(p.programUrl ? { programUrl: p.programUrl } : {}),
        language: 'en',
      })),
      sourceUrl: src.sourceUrl,
      confidence: 'partner',
      partnerSource: { type: 'direct', via: [] },
      language: 'en',
      lastChecked: new Date().toISOString().slice(0, 10),
      tuition: {
        ...(currency ? { currency } : {}),
        // цену на программу кладём только там, где она реально снята с сайта
        byProgram: Object.fromEntries(priced.map((p) => [
          `${t.slug}-${p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)}`,
          { amount: String(p.tuition.amount), currency: p.tuition.currency, ...(p.feeAudience ? { feeAudience: p.feeAudience } : {}) },
        ])),
      },
      deadlines: {},
      requirements: { language: {}, exams: [] },
      description: {
        keyFactsRu: [
          `${programs.length} ${programs.length === 1 ? 'программа' : programs.length < 5 ? 'программы' : 'программ'}`,
          ...(levels.length ? [`Программы: ${levels.map((l) => LEVEL_RU[l] ?? l).join(', ')}`] : []),
          `Расположение: ${t.city}, ${t.country}`,
          'Прямой партнёрский договор — без двойных комиссий и переплат',
        ],
      },
    };

    const out = path.join(CATALOG_DIR, `${t.slug}.json`);
    if (APPLY) await fs.writeFile(out, JSON.stringify(card, null, 2) + '\n', 'utf8');
    made.push({ slug: t.slug, programs: programs.length, priced: priced.length, source: src.sourceUrl });
    log(`${t.slug}: ${programs.length} программ, ${priced.length} с ценой${APPLY ? ' — записана' : ' (без --apply не записываю)'}`);
  }

  for (const s of skipped) log(`${s.slug}: ПРОПУЩЕН — ${s.reason}, карточку не фабрикую`);
  console.log(JSON.stringify({ made, skipped, applied: APPLY }, null, 2));
  console.log('NEW-CARDS DONE');
}

main().catch((e) => { console.error(e); process.exit(1); });
