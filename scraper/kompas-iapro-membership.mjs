#!/usr/bin/env node
// kompas-iapro-membership.mjs — КОМПАС: реестр партнёров IAPro из снимка портала.
//
// Вход: sources/kompas/portal-probe/iapro-nav.json (снят kompas-iapro-partners.mjs).
// Выход: sources/kompas/membership/iapro.json — 11 партнёров Marketing Hub
//        (список владельца) + все учреждения из Contract Hub, сопоставленные
//        со слагами каталога.
//
// Почему две группы, а не одна: документ владельца говорит «11 партнёров, вкладка
// Marketing Hub», и по правилу 2 плана явный список решает. Но в Contract Hub
// договоров больше — это факт, который владелец должен увидеть, а не решение,
// которое я приму сам.
//
// Сети нет, каталог не трогается.

import fs from 'fs/promises';
import path from 'path';
import { KOMPAS_DIR, logger } from './lib/kompas-collect.mjs';

const log = logger('iapro-m');
const NAV = path.join(KOMPAS_DIR, 'portal-probe', 'iapro-nav.json');
const WORK = path.join(KOMPAS_DIR, 'catalog-work');
const OUT = path.join(KOMPAS_DIR, 'membership', 'iapro.json');

const norm = (s) => String(s ?? '').toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/\b(the|of|for|university|universities|college|institute|school|applied|sciences)\b/g, ' ')
  .replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

async function main() {
  const nav = JSON.parse(await fs.readFile(NAV, 'utf8'));

  // --- Marketing Hub: колонка «University Name» в таблице лендингов.
  const hubNames = new Set();
  for (const s of nav.filter((x) => x.step.startsWith('marketing-hub'))) {
    for (const m of s.text.matchAll(/INTBD (.+?) Lead Capture\s*\n\s*\n?\s*(.+?)\s*\n/g)) {
      hubNames.add(m[2].trim());
    }
  }

  // --- Contract Hub: пары «учреждение → номер договора».
  const contracts = new Map();
  for (const s of nav.filter((x) => x.step.startsWith('contract-hub'))) {
    for (const m of s.text.matchAll(/\n(\d{1,2}(?:st|nd|rd|th) \w+ \d{4})\s*\n\s*\n?([^\n]+)\n([^\n]*)\n/g)) {
      const name = m[2].trim();
      if (!name || /^(Search|Explore|Items per page)/.test(name)) continue;
      if (!contracts.has(name)) contracts.set(name, []);
      contracts.get(name).push({ contract: m[3].trim(), created: m[1].trim() });
    }
  }

  // Коды брендов расшифровываются номером договора: «Bulk CCU 25/06/2026» → CCU.
  const codeOf = new Map();
  for (const [name, list] of contracts) {
    for (const c of list) {
      // Граница слова тут не работает: в «TIC_27/09/2023» подчёркивание — тоже
      // словесный символ, и \b после «TIC» не срабатывает. Три кода из одиннадцати
      // так и остались нерасшифрованными в первом прогоне.
      const m = c.contract.match(/(?:^|[\s_/-])([A-Z]{3,5})(?=[\s_/-]|$)/);
      if (m && !codeOf.has(m[1])) codeOf.set(m[1], name);
    }
  }

  // --- сопоставление со слагами каталога
  const cards = [];
  for (const f of (await fs.readdir(WORK)).filter((x) => x.endsWith('.json'))) {
    const j = JSON.parse(await fs.readFile(path.join(WORK, f), 'utf8'));
    cards.push({ slug: j.slug ?? f.replace(/\.json$/, ''), name: j.name ?? '', norm: norm(j.name) });
  }
  const match = (name) => {
    const n = norm(name);
    if (!n) return null;
    const exact = cards.find((c) => c.norm === n);
    if (exact) return { slug: exact.slug, name: exact.name, how: 'exact' };
    const part = cards.filter((c) => c.norm && (c.norm.includes(n) || n.includes(c.norm)));
    if (part.length === 1) return { slug: part[0].slug, name: part[0].name, how: 'partial' };
    if (part.length > 1) return { slug: null, name: null, how: 'ambiguous', candidates: part.slice(0, 5).map((c) => c.slug) };
    return null;
  };

  // Названия Marketing Hub бывают кодами («IBS»), бывают полными — разворачиваем
  // коды через Contract Hub, иначе резолвер ищет вуз по трёхбуквенной аббревиатуре.
  const partners = [...hubNames].map((raw) => {
    const full = /^[A-Z]{2,5}$/.test(raw) ? (codeOf.get(raw) ?? raw) : raw;
    return { source: raw, name: full, resolvedFromCode: full !== raw, catalog: match(full) };
  });

  const others = [...contracts.entries()]
    .filter(([name]) => !partners.some((p) => norm(p.name) === norm(name)))
    .map(([name, list]) => ({ name, contracts: list, catalog: match(name) }));

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify({
    generatedAt: new Date().toISOString(),
    aggregator: 'iapro',
    portal: 'https://iapro.my.site.com/agentportals/',
    ownerRule: '11 партнёров, вкладка Marketing Hub',
    marketingHub: { declared: 11, found: partners.length, partners },
    contractHubOnly: { count: others.length, institutions: others },
  }, null, 2) + '\n', 'utf8');

  const ok = partners.filter((p) => p.catalog?.slug).length;
  log(`Marketing Hub: ${partners.length} партнёров (заявлено 11), в каталоге нашлось ${ok}`);
  const mark = (c) => c?.slug
    ?? (c?.how === 'ambiguous' ? `— НЕСКОЛЬКО КАРТОЧЕК: ${c.candidates.join(', ')} —` : '— НЕТ КАРТОЧКИ —');
  for (const p of partners) log(`  ${mark(p.catalog)} :: ${p.name}${p.resolvedFromCode ? ` (код ${p.source})` : ''}`);
  log(`Contract Hub сверх списка: ${others.length} учреждений`);
  for (const o of others) log(`  ${o.catalog?.slug ?? '— нет карточки —'} :: ${o.name}`);
}

main().catch((e) => { log('ОШИБКА: ' + e.message); process.exit(1); });
