#!/usr/bin/env node
// Добор города для черновиков карточек edvoy из Wikidata.
//
// Тем же путём, которым проект уже добирал город для очереди QS
// (kompas-newcards-city-wikidata.mjs), только не по захардкоженному списку,
// а по всем черновикам, у которых источник города не назвал.
//
// Пишем ТОЛЬКО однозначное совпадение: сущность Wikidata должна быть той же страны,
// что и запись edvoy, и город берётся из свойства «расположен в» (P131) либо
// «штаб-квартира» (P159). Не сошлось — город не выдумываем, вуз остаётся кейсом.
//
// Запуск: node scraper/kompas-edvoy-city-wikidata.mjs [--apply]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRAFTS = path.join(ROOT, 'sources/kompas/extracts/edvoy-newcards');
const OUT = path.join(ROOT, 'sources/kompas/edvoy-city-wikidata.json');
const APPLY = process.argv.includes('--apply');
const UA = 'studyroom-kompas/1.0 (catalog research)';
const API = 'https://www.wikidata.org/w/api.php';

const COUNTRY_ALIAS = {
  uae: 'united arab emirates', usa: 'united states', us: 'united states',
  uk: 'united kingdom', 'great britain': 'united kingdom',
  'united states of america': 'united states',
};
const normCountry = (c) => {
  const k = String(c || '').toLowerCase().replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim();
  return COUNTRY_ALIAS[k] || k;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(params) {
  // origin=* — браузерный параметр CORS; на сервере он лишь роняет нас в анонимный
  // кеш, который под нагрузкой отвечает отказом. Замер 23.08: с ним половина запросов
  // не дошла, без него проходят все.
  const url = API + '?' + new URLSearchParams({ format: 'json', ...params });
  for (let i = 0; i < 4; i++) {
    const r = await fetch(url, { headers: { 'user-agent': UA } });
    if (r.ok) return r.json();
    await sleep(2000 * (i + 1));
  }
  throw new Error('Wikidata не отвечает: ' + url.slice(0, 120));
}

const labelCache = new Map();
async function labelOf(qid) {
  if (!qid) return null;
  if (labelCache.has(qid)) return labelCache.get(qid);
  const j = await api({ action: 'wbgetentities', ids: qid, props: 'labels', languages: 'en' });
  const v = j.entities?.[qid]?.labels?.en?.value || null;
  labelCache.set(qid, v);
  return v;
}

const claimQid = (ent, prop) => {
  const c = (ent.claims || {})[prop];
  const id = c && c[0]?.mainsnak?.datavalue?.value?.id;
  return id || null;
};

/** Имя для поиска: чистим то, обо что Wikidata спотыкается. */
const searchName = (name) => String(name)
  .replace(/\(([^)]+)\)/g, ' $1 ')       // «University(MEPhI)» → «University MEPhI»
  .replace(/\s+/g, ' ')
  .trim();

async function findCity(name, country) {
  const q = searchName(name);
  const s = await api({ action: 'wbsearchentities', search: q, language: 'en', type: 'item', limit: '5' });
  const ids = (s.search || []).map((x) => x.id);
  if (!ids.length) return { city: null, why: 'Wikidata сущности не нашла' };
  const g = await api({ action: 'wbgetentities', ids: ids.join('|'), props: 'claims|labels', languages: 'en' });
  const want = normCountry(country);
  for (const id of ids) {
    const ent = g.entities?.[id];
    if (!ent) continue;
    const cQid = claimQid(ent, 'P17');
    if (!cQid) continue;
    const cLabel = await labelOf(cQid);
    if (want && normCountry(cLabel) !== want) continue;   // страна обязана совпасть
    // P159 («штаб-квартира») называет город, P131 («расположен в») — ближайшую
    // административную единицу, а она бывает мельче города: у UWE это Stoke Gifford,
    // приход внутри Бристоля. Поэтому сперва P159.
    for (const prop of ['P159', 'P131']) {
      const cityQid = claimQid(ent, prop);
      if (!cityQid) continue;
      const cityLabel = await labelOf(cityQid);
      if (!cityLabel) continue;
      return { city: cityLabel, qid: id, prop, entity: ent.labels?.en?.value || null,
        why: `Wikidata ${id} (${ent.labels?.en?.value || '—'}), ${prop} → ${cityQid}` };
    }
  }
  return { city: null, why: 'подходящей сущности той же страны с указанным городом нет' };
}

const drafts = [];
for (const f of fs.readdirSync(DRAFTS)) {
  if (!f.endsWith('.json')) continue;
  const j = JSON.parse(fs.readFileSync(path.join(DRAFTS, f), 'utf8'));
  if (!j.city) drafts.push({ file: f, d: j });
}

const found = [], missed = [];
for (const { file, d } of drafts) {
  let res;
  try { res = await findCity(d.name, d.country); }
  catch (e) { res = { city: null, why: 'ошибка запроса: ' + e.message }; }
  const row = { edpRefId: d.edpRefId, name: d.name, country: d.country || null,
    programs: (d.programs || []).length, city: res.city, evidence: res.why };
  if (res.city) {
    found.push(row);
    if (APPLY) {
      d.city = res.city;
      d.cityFrom = res.why;
      fs.writeFileSync(path.join(DRAFTS, file), JSON.stringify(d, null, 2) + '\n');
    }
  } else missed.push(row);
  console.log((res.city ? 'ГОРОД ' : 'нет   ') + (res.city || '').padEnd(18), d.name, '|', res.why);
  await sleep(1200);   // Wikidata просит не частить
}

fs.writeFileSync(OUT, JSON.stringify({ apply: APPLY, checkedAt: '2026-08-23',
  found: found.length, missed: missed.length, rows: [...found, ...missed] }, null, 1));
console.log(`\nгород найден у ${found.length} из ${drafts.length}${APPLY ? ', записан в черновики' : ' (прогон вхолостую)'}`);
