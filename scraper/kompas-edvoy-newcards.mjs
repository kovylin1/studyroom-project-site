#!/usr/bin/env node
// Заведение карточек вузов edvoy, которых нет в каталоге.
//
// Решение владельца 2026-08-23: правило «если есть у агрегатора, должно быть и у нас»
// распространено с очереди QS на edvoy; языковые школы заводим наравне с вузами.
// См. sources/kompas/OWNER-DECISIONS.md.
//
// Пишет в РАБОЧУЮ КОПИЮ (sources/kompas/catalog-work), а не в живой каталог: подмена —
// задача 3.1. Сборщик карточек QS (kompas-newcards-build.mjs) писал в живой каталог,
// потому что до появления рабочей копии другого места не было.
//
// Карточка заводится ПУСТОЙ по составу, а выгрузка переносится из
// extracts/edvoy-newcards в extracts/edvoy под слагом карточки. Дальше работают
// обычные kompas-programs-backfill.mjs и kompas-fees-apply.mjs — те же, что и для
// всех остальных. Своей логики разбора программ и цен здесь нет намеренно:
// второй разборщик того же источника — это второй набор ответов на один вопрос.
//
// Город не выдумываем. Нет города — карточки нет, вуз уходит кейсом оператору.
//
// Запуск: node scraper/kompas-edvoy-newcards.mjs [--apply]
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { norm, stripGeneric } from './lib/kompas-catalog-match.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRAFTS = path.join(ROOT, 'sources/kompas/extracts/edvoy-newcards');
const EXTRACTS = path.join(ROOT, 'sources/kompas/extracts/edvoy');
const WORK = path.join(ROOT, 'sources/kompas/catalog-work');
const OUT_REVIEW = path.join(ROOT, 'sources/kompas/edvoy-newcards-review.json');
const OUT_REPORT = path.join(ROOT, 'sources/kompas/edvoy-newcards.json');
const TODAY = '2026-08-23';
const APPLY = process.argv.includes('--apply');

const slugify = (s) => String(s || '').toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 80)
  .replace(/-$/, '');

const taken = new Set();
const cards = [];
for (const f of fs.readdirSync(WORK)) {
  if (!f.endsWith('.json')) continue;
  const slug = f.replace(/\.json$/, '');
  taken.add(slug);
  try {
    const c = JSON.parse(fs.readFileSync(path.join(WORK, f), 'utf8'));
    cards.push({ slug, name: c.name || '', country: c.country || null });
  } catch { /* битый файл — не улика */ }
}

// Не всякий непривязанный вуз — новый. Матчер отказывается выбирать, когда под имя
// подходит больше одной карточки, и такой вуз попадает в черновики, хотя карточка есть
// (замер 23.08: 4 из 182 — Stafford House, UCL, Curtin Dubai, Medical University of
// the Americas). Завести им ещё одну — значит своими руками наплодить дублей.
// Ищем по всем написаниям имени, включая скобочный хвост: «University College London (UCL)».
const noParens = (s) => String(s || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
const inParens = (s) => (String(s || '').match(/\(([^)]{2,})\)/) || [])[1] || '';
const nameIndex = new Map();
for (const c of cards) {
  for (const v of [c.name, noParens(c.name), inParens(c.name)]) {
    for (const k of [norm(v), stripGeneric(v)]) {
      if (!k) continue;
      if (!nameIndex.has(k)) nameIndex.set(k, new Set());
      nameIndex.get(k).add(c.slug);
    }
  }
}
const cardsByName = (name) => {
  const out = new Set();
  for (const v of [name, noParens(name), inParens(name)]) {
    for (const k of [norm(v), stripGeneric(v)]) for (const s of (nameIndex.get(k) || [])) out.add(s);
  }
  return [...out];
};

// Однофамильцы — главный источник тихого брака: «Lincoln University College» (Малайзия)
// по имени без родовых слов сходится с «Lincoln University» (Новая Зеландия), и выгрузка
// малайзийского вуза села бы на новозеландскую карточку. Поймано на прогоне 23.08.
// Страна должна совпасть; написания у источников разные, поэтому приводим к одному виду.
const COUNTRY_ALIAS = {
  uae: 'united arab emirates', usa: 'united states', us: 'united states',
  uk: 'united kingdom', 'great britain': 'united kingdom',
};
const normCountry = (c) => {
  const k = String(c || '').toLowerCase().replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim();
  return COUNTRY_ALIAS[k] || k;
};
const cardCountry = new Map(cards.map((c) => [c.slug, c.country]));

const drafts = [];
for (const f of fs.readdirSync(DRAFTS)) {
  if (!f.endsWith('.json')) continue;
  drafts.push(JSON.parse(fs.readFileSync(path.join(DRAFTS, f), 'utf8')));
}
// крупные первыми: если два черновика метят в один слаг, слаг без суффикса
// достаётся тому, у кого программ больше
drafts.sort((a, b) => (b.programs || []).length - (a.programs || []).length);

const stats = { drafts: drafts.length, created: 0, noCity: 0, noPrograms: 0,
  cardExists: 0, linkedToExisting: 0, slugSuffixed: 0, programsCarried: 0 };
const cases = [];
const made = [];

for (const d of drafts) {
  const name = String(d.name || '').trim();
  const programs = d.programs || [];
  if (!name) continue;
  if (!programs.length) {
    stats.noPrograms++;
    cases.push({ edpRefId: d.edpRefId, name, country: d.country || null, programs: 0,
      reason: 'no-programs', note: 'у источника ни одной программы — заводить нечем' });
    continue;
  }
  // Карточка уже есть, просто матчер её не выбрал. Новую не заводим: вместо дубля
  // привязываем выгрузку к существующей — но только если своей выгрузки edvoy у неё
  // ещё нет, чтобы не затереть чужую работу.
  const already = cardsByName(name).filter((slug) => {
    const a = normCountry(cardCountry.get(slug));
    const b = normCountry(d.country);
    return !a || !b || a === b;   // страну знаем с обеих сторон — она обязана совпасть
  });
  const rejectedByCountry = cardsByName(name).length - already.length;
  if (rejectedByCountry) {
    cases.push({ edpRefId: d.edpRefId, name, country: d.country || null, programs: programs.length,
      reason: 'country-mismatch', cards: cardsByName(name),
      note: 'карточка с тем же именем есть, но в другой стране — однофамилец, привязывать нельзя' });
  }
  if (already.length) {
    stats.cardExists++;
    const free = already.length === 1 && !fs.existsSync(path.join(EXTRACTS, already[0] + '.json'));
    if (free) {
      stats.linkedToExisting++;
      made.push({ slug: already[0], name, country: d.country || null, city: d.city,
        programs: programs.length, edpRefId: d.edpRefId, linkedToExisting: true });
      stats.programsCarried += programs.length;
      if (APPLY) {
        const moved = { ...d, slug: already[0], catalogSlug: already[0], newCard: false, builtAt: TODAY };
        fs.writeFileSync(path.join(EXTRACTS, already[0] + '.json'), JSON.stringify(moved, null, 2) + '\n');
        fs.unlinkSync(path.join(DRAFTS, d.edpRefId + '.json'));
      }
    } else {
      cases.push({ edpRefId: d.edpRefId, name, country: d.country || null, programs: programs.length,
        reason: 'card-exists', cards: already,
        note: 'карточка в каталоге есть (' + already.join(', ') + '), но привязка не сложилась — привязать вручную' });
    }
    continue;
  }

  // Город нужен только НОВОЙ карточке. У существующей он уже есть, поэтому проверка
  // города стоит после поиска карточки: иначе вуз с готовой карточкой уходил в кейсы
  // «нет города» и выгрузка к нему не привязывалась (так было с Royal Holloway и ещё тремя).
  if (!d.city) {
    stats.noCity++;
    cases.push({ edpRefId: d.edpRefId, name, country: d.country || null,
      programs: programs.length, reason: 'no-city',
      note: 'источник города не назвал — карточка не заводится, город не выдумываем' });
    continue;
  }

  let slug = slugify(name) || slugify(d.edpRefId);
  if (taken.has(slug)) { slug = slug + '-edvoy'; stats.slugSuffixed++; }
  let i = 2;
  while (taken.has(slug)) { slug = slug.replace(/-\d+$/, '') + '-' + i; i++; }
  taken.add(slug);

  const card = {
    slug,
    name,
    country: d.country || null,
    city: d.city,
    // Состав и цены проставят общие kompas-programs-backfill.mjs и kompas-fees-apply.mjs
    // по перенесённой выгрузке. Здесь их нет намеренно.
    programs: [],
    tuition: { currency: null, byProgram: {} },
    deadlines: {},
    requirements: { exams: [] },
    scholarships: [],
    lastChecked: TODAY,
    sourceUrl: d.sourceUrl || `https://edge.edvoy.com/institutions/${d.edpRefId}`,
    sourceHash: crypto.createHash('sha1').update(`${d.edpRefId}|${programs.length}`).digest('hex').slice(0, 16),
    confidence: 'aggregator',
    language: 'en',
    _kompas: {
      builtAt: TODAY,
      source: 'edvoy',
      edpRefId: d.edpRefId,
      city: { value: d.city, source: 'edvoy address.city' },
      rule: 'решение владельца 23.08: правило «есть у агрегатора — есть у нас» распространено на edvoy',
      programsExpected: programs.length,
    },
  };

  made.push({ slug, name, country: card.country, city: card.city, programs: programs.length,
    edpRefId: d.edpRefId, draftFile: d.edpRefId + '.json' });
  stats.created++;
  stats.programsCarried += programs.length;

  if (APPLY) {
    fs.writeFileSync(path.join(WORK, slug + '.json'), JSON.stringify(card, null, 2));
    // Выгрузка переезжает в общую папку под слагом карточки и становится обычной
    // привязанной выгрузкой: дальше её видят и добор программ, и движок цен, и сверка.
    const moved = { ...d, slug, catalogSlug: slug, newCard: false, builtAt: TODAY };
    fs.writeFileSync(path.join(EXTRACTS, slug + '.json'), JSON.stringify(moved, null, 2) + '\n');
    fs.unlinkSync(path.join(DRAFTS, d.edpRefId + '.json'));
  }
}

const NOW = new Date().toISOString();
fs.writeFileSync(OUT_REPORT, JSON.stringify({ apply: APPLY, stats, created: made, cases }, null, 1));

// кейсы оператору по тем, кого завести не вышло
const items = cases.map((c) => ({
  id: (c.edpRefId || slugify(c.name)) + '||kompas_card_edvoy_' + c.reason.replace(/-/g, '_') + '||' + c.programs,
  slug: c.edpRefId || slugify(c.name),
  name: c.name,
  issue: 'kompas_card_edvoy_' + c.reason.replace(/-/g, '_'),
  severity: 'warning',
  detail: c.note + '. Страна: ' + (c.country || '—') + ', программ у источника: ' + c.programs + '.',
  catalog: null, official: c.programs, program: null,
  sourceUrl: c.edpRefId ? 'https://edge.edvoy.com/institutions/' + c.edpRefId : null,
  checkedAt: NOW, decision: null, decidedAt: null, applied: false,
}));
fs.writeFileSync(OUT_REVIEW, JSON.stringify({
  generatedAt: NOW,
  scope: 'Заведение карточек edvoy: кого завести не вышло',
  summary: { drafts: stats.drafts, created: stats.created, cases: items.length },
  items,
}, null, 1));

console.log(JSON.stringify(stats, null, 1));
if (!APPLY) console.log('прогон вхолостую: ничего не записано, добавь --apply');
