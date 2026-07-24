#!/usr/bin/env node
// kompas-backfill-programs.mjs — P2 (часть б): добор программ в каталог.
//
// Замер: у источников есть 15 679 программ, которых нет в каталоге (совпадения по
// названию не нашлось). Владелец: «каталог = то, что у источника» — добираем.
// Это добавление, ничего не удаляем и не перетираем.
//
// Дисциплина:
//   • уровень берём с источника и кладём в схему через LEVEL_MAP; если уровень
//     не опознан (null и пр.) — программу НЕ заводим (выдумывать уровень нельзя).
//   • длительность источник не даёт — выводим по уровню (таблица репозитория),
//     помечаем confidence 0.4 (соглашение, а не факт с сайта).
//   • цену добавляем только если валюта источника == валюте карточки, основа не
//     'level', аудитория не 'home' (те же правила, что в P2a).
//   • слаг уникален в пределах карточки; дубли по (нормназвание|уровень) не заводим.
//   • добавленное помечено kompasStatus='source-added' + source=<via> — для отката
//     и чтобы на сайте было видно происхождение.
//
// Идемпотентно: заведённые программы на следующем замере совпадут и уйдут из
// sourceOnly. Бэкап накопительный. Работает на КОПИИ catalog-work.
//
// Запуск: node kompas-backfill-programs.mjs [--apply]

import fs from 'node:fs/promises';
import path from 'node:path';
import { KOMPAS_DIR, args, logger } from './lib/kompas-collect.mjs';
import { WORK_DIR, readJson, loadSourceIndex, resolveAssignment, diffUniversity } from './lib/kompas-diff-core.mjs';
import { normTitle } from './lib/kompas-normalize.mjs';

const log = logger('backfill-progs');
const APPLY = args.has('apply');
const TODAY = new Date().toISOString().slice(0, 10);
const BACKUP_FILE = path.join(KOMPAS_DIR, 'program-backfill-backup.json');

// Уровни источников → уровни схемы каталога (site/src/schema/university.ts).
const LEVEL_MAP = {
  bachelor: 'bachelor', master: 'master', phd: 'phd', foundation: 'foundation',
  language: 'english-language', pathway: 'foundation',
  diploma: 'short-course', certificate: 'short-course',
  // прямые схемные значения на случай, если источник уже нормализован
  'english-language': 'english-language', 'sixth-form': 'sixth-form',
  'high-school': 'high-school', 'short-course': 'short-course',
};
// Длительность по уровню — та же таблица, что в merge-programs/session45.
const DURATION = {
  bachelor: 3, master: 1, phd: 3, foundation: 1,
  'english-language': 1, 'sixth-form': 2, 'high-school': 2, 'short-course': 0.5,
};

const slugify = (s) => (s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').slice(0, 90).replace(/^-+|-+$/g, '');

// Национальная валюта по стране — для guard против ошибки атрибуции источника
// (урок 10: edvoy отдал «Arizona State University London» с ценами в GBP под
// карточку ASU в США). Программа с ценой в валюте, чуждой стране карточки и не
// международной (USD/EUR), — красный флаг: либо чужое заведение, либо чужой кампус.
// Такую НЕ заводим, уводим в кейс. Местная валюта страны при этом законна
// (чешский вуз в CZK — свои программы, а не мислейбл).
const NAT = {
  Australia: 'AUD', Austria: 'EUR', Belgium: 'EUR', Canada: 'CAD', China: 'CNY',
  Cyprus: 'EUR', 'Czech Republic': 'CZK', Denmark: 'DKK', Finland: 'EUR', France: 'EUR',
  Germany: 'EUR', Hungary: 'HUF', Indonesia: 'IDR', Ireland: 'EUR', Italy: 'EUR',
  Japan: 'JPY', Latvia: 'EUR', Lithuania: 'EUR', Malaysia: 'MYR', Malta: 'EUR',
  Netherlands: 'EUR', 'New Zealand': 'NZD', Poland: 'PLN', Portugal: 'EUR',
  'Saint Kitts and Nevis': 'XCD', Singapore: 'SGD', 'South Korea': 'KRW', Spain: 'EUR',
  'Sri Lanka': 'LKR', Switzerland: 'CHF', Turkey: 'TRY', UAE: 'AED',
  'United Arab Emirates': 'AED', USA: 'USD', 'United States': 'USD', 'United Kingdom': 'GBP',
};
// Международные валюты ценообразования, допустимые для любой страны.
const INTL = new Set(['USD', 'EUR']);
function countryForeign(fee, card) {
  if (!fee) return false;
  const cc = card.tuition?.currency ?? null;
  const nat = NAT[card.country];
  if (fee.currency === cc) return false;
  if (nat && fee.currency === nat) return false;
  if (INTL.has(fee.currency)) return false;
  return true;   // валюта чужой страны — подозрение на ошибку атрибуции
}

async function main() {
  if (!APPLY) log('СУХОЙ ПРОГОН: только считаю. Для записи добавь --apply');
  const map = await readJson(path.join(KOMPAS_DIR, 'partner-source-map.json')) ?? {};
  const { index } = await loadSourceIndex();
  const files = (await fs.readdir(WORK_DIR)).filter((f) => f.endsWith('.json'));

  const addedLog = {};   // slug -> [programSlug,...] заведённые ЭТИМ прогоном
  let addedProgs = 0, addedFees = 0, unisTouched = 0;
  const skip = { noLevel: 0, dup: 0, foreignCur: 0 };
  const foreignCases = {};   // slug -> [{title, cur, via}] чуждая валюта, в кейс
  const top = [];

  for (const f of files) {
    const slug = f.replace(/\.json$/, '');
    const card = await readJson(path.join(WORK_DIR, f));
    if (!card) continue;
    const { ps, ready } = resolveAssignment(card, slug, map);
    if (ps.type === 'none') continue;
    const entries = (index.get(slug) ?? []).filter((e) => ready.includes(e.src));
    if (!entries.length) continue;

    const d = diffUniversity(card, entries);
    if (!d.sourceOnly.length) continue;

    const cardCur = card.tuition?.currency ?? null;
    if (!card.tuition) card.tuition = { currency: cardCur, byProgram: {} };
    if (!card.tuition.byProgram) card.tuition.byProgram = {};
    const bp = card.tuition.byProgram;

    const usedSlugs = new Set((card.programs ?? []).map((p) => p.slug));
    const usedKeys = new Set((card.programs ?? []).map((p) => `${normTitle(p.title)}|${LEVEL_MAP[p.level] ?? p.level ?? ''}`));
    const nowAdded = [];

    for (const sp of d.sourceOnly) {
      const level = LEVEL_MAP[sp.level];
      if (!level) { skip.noLevel++; continue; }   // уровень не опознан — не выдумываем
      if (countryForeign(sp.fee, card)) {         // валюта чужой страны — риск мислейбла (урок 10)
        skip.foreignCur++;
        (foreignCases[slug] ??= []).push({ title: sp.title, cur: sp.fee.currency, via: sp.via });
        continue;
      }
      const key = `${sp.norm}|${level}`;
      if (usedKeys.has(key)) { skip.dup++; continue; }
      usedKeys.add(key);

      let base = slugify(`${slug}-${sp.title}`) || `${slug}-p`;
      let s = base; let n = 1;
      while (usedSlugs.has(s)) s = `${base}-${++n}`;
      usedSlugs.add(s);

      const prog = {
        slug: s,
        title: sp.title,
        durationYears: DURATION[level] ?? 1,
        level,
        language: 'en',
        programType: level === 'foundation' ? 'pathway' : 'degree',
        source: sp.via,
        confidence: 0.4,
        kompasStatus: 'source-added',
        kompasCheckedAt: TODAY,
      };
      if (APPLY) {
        (card.programs ??= []).push(prog);
        // цена — по тем же правилам, что P2a
        const fee = sp.fee;
        if (fee && cardCur && fee.currency === cardCur && fee.basis !== 'level' && fee.audience !== 'home') {
          bp[s] = fee.amount; addedFees++;
        } else if (fee && !(cardCur && fee.currency === cardCur)) {
          // цена есть, но в другой валюте — не кладём (учтётся замером как feeMissing/diffCur)
        }
      } else if (sp.fee && cardCur && sp.fee.currency === cardCur && sp.fee.basis !== 'level' && sp.fee.audience !== 'home') {
        addedFees++;
      }
      nowAdded.push(s);
      addedProgs++;
    }

    if (nowAdded.length) {
      addedLog[slug] = nowAdded;
      unisTouched++;
      top.push({ slug, name: card.name, added: nowAdded.length });
      if (APPLY) await fs.writeFile(path.join(WORK_DIR, f), JSON.stringify(card, null, 2) + '\n', 'utf8');
    }
  }

  top.sort((a, b) => b.added - a.added);

  if (APPLY) {
    const prev = (await readJson(BACKUP_FILE))?.added ?? {};
    for (const [s, arr] of Object.entries(addedLog)) prev[s] = [...new Set([...(prev[s] ?? []), ...arr])];
    const total = Object.values(prev).reduce((a, arr) => a + arr.length, 0);
    await fs.writeFile(BACKUP_FILE, JSON.stringify({
      generatedAt: new Date().toISOString(),
      note: 'P2b: программы, заведённые из источника (kompasStatus=source-added). Откат: удалить эти программы и их ключи из tuition.byProgram.',
      summary: { unis: Object.keys(prev).length, programs: total },
      added: prev,
    }, null, 2) + '\n', 'utf8');

    // Кейсы по чуждой валюте: программы источника, не заведённые из-за подозрения
    // на ошибку атрибуции (валюта чужой страны). Владелец решает поштучно.
    const cases = Object.entries(foreignCases).map(([s, arr]) => ({
      id: `${s}||kompas_program_foreign_currency||${arr.length}`,
      slug: s, name: s,
      issue: 'kompas_program_foreign_currency',
      severity: 'warning',
      detail: `${arr.length} программ источника НЕ заведены: цена в валюте, чуждой стране вуза — подозрение на ошибку атрибуции источника (чужой кампус/заведение, урок 10). Примеры: ${arr.slice(0, 5).map((x) => `«${x.title}» ${x.cur} (${x.via})`).join('; ')}. Проверить, тот ли это вуз, прежде чем заводить.`,
      catalog: null, official: arr.length, program: null, sourceUrl: null,
      checkedAt: new Date().toISOString(), decision: null, decidedAt: null, applied: false,
    }));
    await fs.writeFile(path.join(KOMPAS_DIR, 'program-backfill-review.json'),
      JSON.stringify({ generatedAt: new Date().toISOString(), scope: 'kompas-backfill-programs', summary: { added: addedProgs, addedFees, skippedForeign: skip.foreignCur }, items: cases }, null, 2) + '\n', 'utf8');
  }

  console.table(top.slice(0, 15));
  console.log(`ЗАВЕДЕНО программ ${addedProgs} у ${unisTouched} вузов, из них с ценой ${addedFees}`);
  console.log(`ПРОПУЩЕНО: без уровня ${skip.noLevel}, дубль по названию+уровню ${skip.dup}, чуждая валюта (риск мислейбла) ${skip.foreignCur}`);
  console.log(APPLY ? 'ПРИМЕНЕНО к catalog-work + бэкап program-backfill-backup.json' : 'СУХОЙ ПРОГОН — для записи добавь --apply');
}

main().catch((e) => { console.error(e); process.exit(1); });
