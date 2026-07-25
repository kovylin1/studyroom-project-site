#!/usr/bin/env node
// kompas-scholarship-audit.mjs — КОМПАС P4, пункт 9: замер достоверности стипендий.
//
// План числил стипендии просто «дырой»: их не собирает ни один агрегатор, единственный
// источник — офсайты. Замер показал, что дыра хуже: стипендии в каталоге ЕСТЬ (1765 записей
// у 477 карточек), но НИ У ОДНОЙ нет ни `source`, ни `verifiedBySite`, а у 79% нет и ссылки.
// То есть проверить их нечем — это ровно та же недостоверность, что фабрикованные цены
// Navitas (P0.1), только незамеченная, потому что «поле заполнено».
//
// Скрипт НИЧЕГО не удаляет и не правит (правило 4): он размечает по происхождению и
// отдаёт кейсы оператору. Снятие/замена — решение владельца, как было с ценами.
//
// Разряды:
//   linked            — есть ссылка: можно открыть и проверить глазами;
//   generic-external  — внешняя программа (Fulbright, Chevening, Erasmus+), проставленная
//                       одинаковой суммой многим вузам. Это не стипендия вуза;
//   cloned            — одно название с одинаковой суммой у нескольких карточек и без
//                       ссылки: признак сид-таблицы, а не сбора;
//   untraceable       — ни ссылки, ни источника, повторов нет: происхождение неизвестно.
//
// Запуск: node kompas-scholarship-audit.mjs

import fs from 'node:fs/promises';
import path from 'node:path';
import { KOMPAS_DIR, logger } from './lib/kompas-collect.mjs';

const log = logger('sch-audit');
const WORK = path.join(KOMPAS_DIR, 'catalog-work');
const OUT_REPORT = path.join(KOMPAS_DIR, 'scholarship-report.json');
const OUT_REVIEW = path.join(KOMPAS_DIR, 'scholarship-review.json');

// Порог «клона»: одно и то же название с одной и той же суммой у стольких карточек.
// 3 выбрано так, чтобы не ловить случайные совпадения вроде двух кампусов одного вуза.
const CLONE_MIN = 3;

// Внешние программы, которые вуз не назначает: их сумма и правила общие для страны.
// Список закрытый и проверяемый — угадывать «похоже на внешнюю» по эвристике нельзя.
const EXTERNAL = [
  /fulbright/i, /chevening/i, /erasmus\+/i, /commonwealth (shared )?scholarship/i,
  /daad/i, /gates cambridge/i, /rhodes scholarship/i, /marshall scholarship/i,
  /^stipendium hungaricum/i, /vanier/i, /^mext/i, /^bolashak/i,
];

const readJson = async (f) => JSON.parse(await fs.readFile(f, 'utf8'));
const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

async function main() {
  const now = new Date().toISOString();

  // Проход 1: собираем все записи, чтобы узнать повторы. Разряд «клон» без общего
  // взгляда на каталог не поставить — по одной карточке клон неотличим от своей стипендии.
  const all = [];
  const cards = [];
  for (const f of (await fs.readdir(WORK)).filter((x) => x.endsWith('.json'))) {
    const d = await readJson(path.join(WORK, f));
    const slug = f.replace(/\.json$/, '');
    cards.push({ slug, name: d.name, country: d.country, count: (d.scholarships ?? []).length });
    for (const s of d.scholarships ?? []) all.push({ slug, name: d.name, s });
  }

  const cloneKey = (s) => `${norm(s.name)}|${norm(s.amount)}`;
  const cloneCount = new Map();
  for (const r of all) cloneCount.set(cloneKey(r.s), (cloneCount.get(cloneKey(r.s)) ?? 0) + 1);

  const classify = (s) => {
    if (EXTERNAL.some((re) => re.test(s.name ?? ''))) return 'generic-external';
    if (s.url) return 'linked';
    if ((cloneCount.get(cloneKey(s)) ?? 0) >= CLONE_MIN) return 'cloned';
    return 'untraceable';
  };

  const byKind = { linked: 0, 'generic-external': 0, cloned: 0, untraceable: 0 };
  const perCard = new Map();
  for (const r of all) {
    const kind = classify(r.s);
    byKind[kind]++;
    if (!perCard.has(r.slug)) perCard.set(r.slug, { slug: r.slug, name: r.name, kinds: {}, examples: [] });
    const p = perCard.get(r.slug);
    p.kinds[kind] = (p.kinds[kind] ?? 0) + 1;
    if (kind !== 'linked' && p.examples.length < 4) p.examples.push(`«${r.s.name}» ${r.s.amount ?? 'без суммы'}`);
  }

  // Кейс заводим только там, где есть что решать: непроверяемые записи. Карточка, где
  // все стипендии со ссылками, оператора не беспокоит.
  const cases = [];
  for (const p of [...perCard.values()].sort((a, b) => a.slug.localeCompare(b.slug))) {
    const bad = (p.kinds.cloned ?? 0) + (p.kinds.untraceable ?? 0) + (p.kinds['generic-external'] ?? 0);
    if (!bad) continue;
    const total = Object.values(p.kinds).reduce((a, b) => a + b, 0);
    const parts = [];
    if (p.kinds.cloned) parts.push(`${p.kinds.cloned} клонов сид-таблицы`);
    if (p.kinds.untraceable) parts.push(`${p.kinds.untraceable} без ссылки и источника`);
    if (p.kinds['generic-external']) parts.push(`${p.kinds['generic-external']} внешних программ (не стипендия вуза)`);
    cases.push({
      id: `${p.slug}||kompas_scholarship_untraceable||${bad}`,
      slug: p.slug, name: p.name,
      issue: 'kompas_scholarship_untraceable',
      severity: bad === total ? 'critical' : 'warning',
      detail: `Стипендий в карточке ${total}, проверить нечем ${bad}: ${parts.join(', ')}. Ни у одной записи каталога нет полей source/verifiedBySite, у ${p.kinds.linked ?? 0} есть хотя бы ссылка. Примеры: ${p.examples.join('; ')}. Решение: снять непроверяемые или собрать заново с офсайта.`,
      catalog: total, official: null, program: null, sourceUrl: null,
      checkedAt: now, decision: null, decidedAt: null, applied: false,
    });
  }

  // Свод по каталогу: вузов без стипендий вовсе — это недобор, а не недостоверность.
  const empty = cards.filter((c) => !c.count).length;
  cases.push({
    id: `__kompas__||kompas_scholarship_absent||${empty}`,
    slug: '__kompas__', name: 'Каталог целиком',
    issue: 'kompas_scholarship_absent',
    severity: 'warning',
    detail: `У ${empty} карточек из ${cards.length} стипендий нет ни одной. Ни один агрегатор стипендии не отдаёт — единственный источник это офсайты вузов (сбор: kompas-collect-scholarships.mjs).`,
    catalog: empty, official: null, program: null, sourceUrl: null,
    checkedAt: now, decision: null, decidedAt: null, applied: false,
  });

  const topClones = [...cloneCount.entries()].filter(([, n]) => n >= CLONE_MIN)
    .sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, n]) => ({ key: k, cards: n }));

  await fs.writeFile(OUT_REPORT, JSON.stringify({
    generatedAt: now,
    summary: {
      cards: cards.length, cardsWithScholarships: cards.length - empty, cardsWithout: empty,
      records: all.length, byKind,
      withSource: all.filter((r) => r.s.source).length,
      withVerifiedBySite: all.filter((r) => r.s.verifiedBySite != null).length,
      withUrl: all.filter((r) => r.s.url).length,
    },
    topClones,
  }, null, 2) + '\n', 'utf8');

  await fs.writeFile(OUT_REVIEW, JSON.stringify({
    generatedAt: now, scope: 'kompas-scholarships',
    summary: { total: cases.length, byIssue: { kompas_scholarship_untraceable: cases.length - 1, kompas_scholarship_absent: 1 } },
    items: cases,
  }, null, 2) + '\n', 'utf8');

  log(`записей ${all.length}: со ссылкой ${byKind.linked}, клонов ${byKind.cloned}, внешних ${byKind['generic-external']}, без следов ${byKind.untraceable}`);
  log(`с полем source: ${all.filter((r) => r.s.source).length}, с verifiedBySite: ${all.filter((r) => r.s.verifiedBySite != null).length}`);
  log(`карточек без стипендий вовсе: ${empty} из ${cards.length}`);
  console.log('SCHOLARSHIP AUDIT DONE', JSON.stringify({ records: all.length, byKind, cases: cases.length }));
}

main().catch((e) => { console.error(e); process.exit(1); });
