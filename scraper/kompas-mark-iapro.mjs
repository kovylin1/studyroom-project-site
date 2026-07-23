#!/usr/bin/env node
// kompas-mark-iapro.mjs — КОМПАС: проставить метку партнёрства IAPro.
//
// Блокер сессии 1: «11 партнёров, вкладка Marketing Hub», а имён нигде не было.
// Имена сняты с портала (kompas-iapro-partners.mjs) и сведены в
// sources/kompas/membership/iapro.json. Здесь они попадают в разметку.
//
// Трогаем ТОЛЬКО рабочую копию и карту разметки. Живой каталог не при делах
// (правило 5): он меняется целиком в сессии 5.
//
// Запуск: node kompas-mark-iapro.mjs [--dry-run]

import fs from 'node:fs/promises';
import path from 'node:path';
import { KOMPAS_DIR, args, logger } from './lib/kompas-collect.mjs';

const log = logger('mark');
const DRY = args.has('dry-run');
const MAP = path.join(KOMPAS_DIR, 'partner-source-map.json');
const WORK = path.join(KOMPAS_DIR, 'catalog-work');

const readJson = async (f) => JSON.parse(await fs.readFile(f, 'utf8'));

async function main() {
  const mem = await readJson(path.join(KOMPAS_DIR, 'membership', 'iapro.json'));
  const map = await readJson(MAP);

  const slugs = [];
  const unresolved = [];
  for (const p of mem.marketingHub.partners) {
    if (p.catalog?.slug) slugs.push({ slug: p.catalog.slug, name: p.name });
    else unresolved.push({ name: p.name, why: p.catalog?.how ?? 'нет карточки', candidates: p.catalog?.candidates ?? [] });
  }

  let touchedMap = 0; let touchedCards = 0;
  for (const { slug, name } of slugs) {
    const cur = map[slug] ?? { type: 'none', via: [] };
    const via = new Set(cur.via ?? []);
    if (via.has('iapro')) continue;
    via.add('iapro');
    // Прямого партнёра в агрегаторского не переписываем: тип источника — решение
    // владельца (правило 1), IAPro лишь добавляется в список агрегаторов.
    map[slug] = { ...cur, type: cur.type === 'direct' ? 'direct' : 'aggregator', via: [...via] };
    touchedMap++;

    const file = path.join(WORK, `${slug}.json`);
    try {
      const card = await readJson(file);
      card.partnerSource = { ...(card.partnerSource ?? {}), type: map[slug].type, via: map[slug].via };
      if (!DRY) await fs.writeFile(file, JSON.stringify(card, null, 2) + '\n', 'utf8');
      touchedCards++;
    } catch { log(`  нет карточки в рабочей копии: ${slug} (${name})`); }
  }

  if (!DRY) await fs.writeFile(MAP, JSON.stringify(map, null, 2) + '\n', 'utf8');

  log(`${DRY ? '(сухой прогон) ' : ''}размечено через iapro: карта ${touchedMap}, карточек ${touchedCards}`);
  for (const u of unresolved) {
    log(`  НЕ РАЗМЕЧЕН: ${u.name} — ${u.why}${u.candidates.length ? `; кандидаты: ${u.candidates.join(', ')}` : ''}`);
  }
  log(`Contract Hub сверх списка владельца: ${mem.contractHubOnly.count} учреждений — разметку по ним НЕ ставлю, нужно решение (правило 2)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
