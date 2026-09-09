#!/usr/bin/env node
// kompas-diff-triage.mjs — разбор кейсов сверки (diff-review.json), пересчитанной
// после сбора QS 2026-08-01. Кейсов 1361, решений не стояло ни одного.
//
// Что делает: ставит decision там, где решение уже принято владельцем раньше И
// семантика кейса та же самая. Где семантика другая — НЕ решает, а выносит в отчёт.
// Каталог не трогается: решение в панели ≠ его применение (применяют отдельные скрипты).
//
// Прецеденты (kompas-close-cases.mjs, решения владельца 2026-07-29):
//   kompas_fee_absent   → ignore  «у источника цены нет — на сайте честное „Уточняется“»
//   kompas_fee_mismatch → update  «в каталог записана цена источника»
//
// Почему прецедент по цене НЕ раскатывается на новые кейсы: 321 из 326 расхождений
// пришли от QS, а QS цены ПРОГРАММЫ не показывает — только стоимость обучения кампуса
// для уровня (`feeBasis: campusLevelStated`). Прецедент 29.07 принимался, когда источники
// давали программную цену. Подменить программную цену кампусной — это подмена смысла,
// а не обновление числа, поэтому такие кейсы уходят владельцу одним вопросом.
//
// Запуск: node kompas-diff-triage.mjs [--apply]

import fs from 'node:fs/promises';
import path from 'node:path';
import { KOMPAS_DIR, ROOT, args, logger } from './lib/kompas-collect.mjs';

const log = logger('triage');
const APPLY = args.has('apply');
const REVIEW = path.join(KOMPAS_DIR, 'diff-review.json');
const REPORT = path.join(KOMPAS_DIR, 'DIFF-TRIAGE.md');
const UNI_DIR = path.join(ROOT, 'site', 'src', 'content', 'universities');

// Вузы, чьё расхождение валюты разобрано вручную в P0.4 (список — из таблицы решений
// в kompas-fix-currency.mjs). Вне этого списка кейс валюты не закрывается.
export const CURRENCY_REVIEWED = new Set([
  'apu-malaysia', 'arden', 'bhms', 'chester', 'curtin-singapore', 'de-montfort-dubai',
  'global-banking-school', 'heriot-watt-malaysia', 'hult', 'middlesex-dubai',
  'murdoch-dubai', 'niagara-falls', 'schiller-international-university',
]);

/** Основа цены источника лежит в тексте кейса — так её пишет сверка. */
export function feeBasisOf(detail) {
  const m = /основа цены источника:\s*([A-Za-z]+)/.exec(String(detail ?? ''));
  return m ? m[1] : null;
}

/** Сколько программ в кейсе «лишних»/«недостающих» — число стоит в самом тексте. */
export function countFromDetail(detail, re) {
  const m = re.exec(String(detail ?? ''));
  return m ? Number(m[1]) : null;
}

/**
 * Решение по кейсу. `card` — карточка вуза (или null, если её нет на диске).
 * Возвращает {decision, note} либо {decision: null, why} — почему решать нельзя.
 *
 * Ровно один разряд решается «по факту»: `kompas_programs_extra` закрывается не
 * прецедентом, а проверкой, что метка `catalog-only` на программах карточки реально
 * стоит. Без проверки это было бы обещание, а не решение.
 */
export function decide(item, card, ctx = {}) {
  switch (item.issue) {
    case 'kompas_fee_absent':
      return { decision: 'ignore', note: 'Прецедент владельца 2026-07-29: у источника цены нет — на сайте честное «Уточняется».' };

    case 'kompas_fee_currency':
      // P0.4 прямо запрещает массовый фикс «по источнику»: валюта в схеме одна на карточку
      // и решает её страна вуза, а не источник. Каждый случай там сверялся руками, и вывод
      // был «каталог прав» — источник показывает пересчёт, offshore-кампус прайсит в валюте
      // родителя, международный прайс в USD легитимен. Настоящим багом оказался один (bhms,
      // уже исправлен). Поэтому закрываем только те вузы, что тот разбор реально покрыл.
      if (CURRENCY_REVIEWED.has(item.slug)) {
        return { decision: 'ignore', note: 'Разобрано вручную в P0.4 (kompas-fix-currency.mjs): валюта каталога верна, источник показывает пересчёт или прайс кампуса в валюте родителя.' };
      }
      return { decision: null, why: 'вуз появился после сбора QS и ручным разбором валюты (P0.4) не покрыт' };

    case 'kompas_fee_mismatch':
    case 'kompas_fee_mismatch_rest': {
      const basis = feeBasisOf(item.detail);
      if (basis && basis !== 'campusLevelStated') {
        return { decision: 'update', note: `Прецедент владельца 2026-07-29: в каталог пишется цена источника (основа ${basis} — программная).` };
      }
      return { decision: null, why: 'цена источника кампусная (campusLevelStated), прецедент 29.07 её не покрывает' };
    }

    case 'kompas_programs_extra': {
      if (!card) return { decision: null, why: 'карточки нет на диске' };
      const need = countFromDetail(item.detail, /В карточке (\d+) программ/);
      const marked = (card.programs ?? []).filter((p) => p.kompasStatus === 'catalog-only').length;
      if (need != null && marked >= need) {
        return { decision: 'resolved', note: `Метка «catalog-only» стоит на ${marked} программах карточки (P1, механизм сессии 5) — расхождение размечено, удалять программы правило 4 запрещает.` };
      }
      // P1 метил каталог, когда QS был заблокирован, и QS-вузов не касался. Теперь QS
      // собран — метка на этих карточках просто ещё не проставлена, решать нечего.
      return { decision: null, why: 'метка catalog-only на карточке не проставлена — нужен повторный прогон P1 (при нём QS был заблокирован)' };
    }

    case 'kompas_source_empty':
      return { decision: 'ignore', note: 'Источник по своей природе не отдаёт программы (Navitas — нет типа записи «курс», CATS — школы). Сверять не с чем, чинить нечего.' };

    case 'kompas_programs_missing':
      return { decision: null, why: 'добор программ с агрегатора (P2) — механический шаг, но он меняет живой каталог' };

    // Что осталось «недостающим» после добора кампусов — это не пропуски, а
    // разобранные случаи: то же место под именем агрегатора, дубль уже стоящего
    // кампуса, «Online Campus» и абзацы описания, заехавшие в поле кампусов.
    // Разбор лежит в campus-backfill-review.json; оставлять кейс открытым после
    // него значит показывать оператору вопрос, ответ на который уже есть.
    case 'kompas_campus_missing': {
      const v = ctx.campusVerdicts?.[item.slug];
      if (!v) return { decision: null, why: 'добор кампусов по этому вузу не прогонялся' };
      const kinds = Object.entries(v.skipped ?? {}).map(([k, n]) => `${k} ${n}`).join(', ');
      return {
        decision: 'ignore',
        note: `Разобрано добором кампусов: настоящих пропусков нет, дописано ${v.added}. Остальные названия — ${kinds || 'ничего'}. Примеры: ${(v.examples ?? []).join('; ') || '—'}.`,
      };
    }

    // «Источник собран, а выгрузки по вузу нет» значит разное в зависимости от
    // источника. У QS сбор доказано полный: портал сам объявил 512 вузов, снято
    // 512 (2026-08-01). Значит вариантов ровно два: либо выгрузка есть, но не
    // привязалась (тогда карточка стоит в подсказках непривязанных записей —
    // `pendingTargets` из kompas-qs-relink), либо вуза в списке QS попросту нет,
    // и тогда пробел не в сборе, а в разметке партнёрства. Второе — не вопрос
    // к владельцу, а факт: сверять не с чем и не будет с чем.
    case 'kompas_no_extract': {
      const via = String(item.id ?? '').split('||')[2] ?? '';
      const sources = via.split('+').filter(Boolean);
      if (sources.length !== 1 || sources[0] !== 'qs') {
        return { decision: null, why: 'выгрузка источника не села на карточку — баг привязки, диагноз в QS-UNLINKED-REPORT.md' };
      }
      if (ctx.qsPending?.has(item.slug)) {
        return { decision: null, why: 'выгрузка QS на эту карточку похожа, но привязка не подтверждена — кейс kompas_qs_link' };
      }
      return {
        decision: 'ignore',
        note: 'QS собран целиком: портал объявил 512 вузов, снято 512 (2026-08-01). Ни одна непривязанная выгрузка QS на эту карточку не указывает — значит вуза в списке QS нет. Пробел не в сборе, а в разметке партнёрства; сверять не с чем.',
      };
    }

    default:
      return { decision: null, why: 'нужен исполнитель или решение владельца' };
  }
}

async function main() {
  const review = JSON.parse(await fs.readFile(REVIEW, 'utf8'));
  // Карточки, на которые указывают ещё не подтверждённые привязки QS.
  let qsPending = new Set();
  try {
    const rl = JSON.parse(await fs.readFile(path.join(KOMPAS_DIR, 'qs-relink-review.json'), 'utf8'));
    qsPending = new Set(rl.pendingTargets ?? []);
  } catch { log('qs-relink-review.json не найден — кейсы kompas_no_extract остаются открытыми'); }
  let campusVerdicts = {};
  try {
    const cb = JSON.parse(await fs.readFile(path.join(KOMPAS_DIR, 'campus-backfill-review.json'), 'utf8'));
    campusVerdicts = cb.verdicts ?? {};
  } catch { log('campus-backfill-review.json не найден — кейсы kompas_campus_missing остаются открытыми'); }
  const ctx = { qsPending, campusVerdicts };
  const cards = new Map();
  for (const f of await fs.readdir(UNI_DIR)) {
    if (!f.endsWith('.json')) continue;
    cards.set(f.replace(/\.json$/, ''), JSON.parse(await fs.readFile(path.join(UNI_DIR, f), 'utf8')));
  }

  const now = new Date().toISOString();
  const closed = {}, left = {};
  let touched = 0, already = 0;

  for (const it of review.items) {
    if (it.decision) { already++; continue; }
    const r = decide(it, cards.get(it.slug) ?? null, ctx);
    if (!r.decision) {
      (left[it.issue] ??= {});
      left[it.issue][r.why] = (left[it.issue][r.why] ?? 0) + 1;
      continue;
    }
    it.decision = r.decision;
    it.decidedAt = now;
    it.decisionNote = r.note;
    touched++;
  }

  // Таблица «закрыто» строится по ИТОГОВОМУ состоянию файла, а не по этому прогону:
  // скрипт идемпотентен, и на повторном запуске отчёт иначе оказался бы пустым.
  for (const it of review.items) {
    if (!it.decision) continue;
    closed[`${it.issue} → ${it.decision}`] = (closed[`${it.issue} → ${it.decision}`] ?? 0) + 1;
  }

  const total = review.items.length;
  const lines = [
    '# Разбор кейсов сверки — итог',
    '',
    `Кейсов в \`diff-review.json\`: **${total}**. С решением: **${touched + already}** ` +
    `(этим прогоном ${touched}, раньше ${already}). Осталось за человеком или за отдельным ` +
    `исполнителем: **${total - touched - already}**.`,
    '',
    '## Закрыто',
    '',
    '| Разряд → решение | Кейсов |',
    '|---|---:|',
    ...Object.entries(closed).sort((a, b) => b[1] - a[1]).map(([k, n]) => `| ${k} | ${n} |`),
    '',
    '## Не закрыто — почему',
    '',
    '| Разряд | Причина | Кейсов |',
    '|---|---|---:|',
    ...Object.entries(left).flatMap(([issue, whys]) =>
      Object.entries(whys).sort((a, b) => b[1] - a[1]).map(([why, n]) => `| ${issue} | ${why} | ${n} |`)),
    '',
  ];

  if (APPLY) {
    await fs.writeFile(REVIEW, JSON.stringify(review, null, 2) + '\n', 'utf8');
    await fs.writeFile(REPORT, lines.join('\n'), 'utf8');
  }
  console.log(lines.join('\n'));
  log(`решено ${touched}, уже имели решение ${already}, осталось ${total - touched - already}${APPLY ? ' — ЗАПИСАНО' : ' — СУХОЙ ПРОГОН'}`);
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) await main();
