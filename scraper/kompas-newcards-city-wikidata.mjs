// КОМПАС — добор города для новых карточек QS из Wikidata.
// В выгрузках QS города нет ни у одной записи. Там, где он не назван ни в имени
// записи, ни в описании, берём его из Wikidata — тем же источником, которым
// проект уже добирал officialUrl. Пишем только однозначное совпадение:
// сущность должна быть той же страны, что и запись QS.
//
// Запуск: node scraper/kompas-newcards-city-wikidata.mjs
// Выход: sources/kompas/newcards/city-wikidata.json (город + QID как улика).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'sources/kompas/newcards/city-wikidata.json');
const UA = 'studyroom-kompas/1.0 (catalog research)';

// Запросы к Wikidata: имя для поиска берём как у QS, но без хвостов вроде
// «- Foundation», по которым сущности в Wikidata нет.
const TARGETS = [
  { slug: 'kwantlen-polytechnic-university', q: 'Kwantlen Polytechnic University', country: 'Canada' },
  { slug: 'marshall-university', q: 'Marshall University', country: 'United States' },
  { slug: 'mercy-university', q: 'Mercy University', country: 'United States' },
  { slug: 'charles-darwin-university-international-college', q: 'Charles Darwin University', country: 'Australia' },
  { slug: 'university-of-tasmania-international-pathway-college', q: 'University of Tasmania', country: 'Australia' },
  { slug: 'anglican-schools-commission-asc-western-australia-victoria-and-new-south-wales', q: 'Anglican Schools Commission', country: 'Australia' },
  { slug: 'on-campus-ireland', q: 'OnCampus Ireland', country: 'Ireland' },
  { slug: 'university-bridge', q: 'University Bridge', country: 'United States' },
  { slug: 'oxford-international-education-group-english-schools', q: 'Oxford International Education Group', country: 'United Kingdom' },
  { slug: 'oxford-international-education-group-ielts-and-tesol', q: 'Oxford International Education Group', country: 'United Kingdom' },
  { slug: 'oxford-international-education-group-junior', q: 'Oxford International Education Group', country: 'United Kingdom' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cache = new Map();

// Wikidata отбивает пачку запросов подряд кодом 429, поэтому между вызовами
// пауза, а на отказ — три попытки с растущей задержкой. Ответы кешируются:
// три записи Oxford International спрашивают одну и ту же сущность.
async function api(params) {
  const url = `https://www.wikidata.org/w/api.php?${new URLSearchParams({ format: 'json', origin: '*', ...params })}`;
  if (cache.has(url)) return cache.get(url);
  let wait = 2000;
  for (let attempt = 1; ; attempt++) {
    await sleep(2500);
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (r.ok) {
      const json = await r.json();
      cache.set(url, json);
      return json;
    }
    if (r.status !== 429 || attempt === 3) throw new Error(`${r.status} ${url}`);
    await sleep(wait);
    wait *= 3;
  }
}

async function label(qid) {
  const d = await api({ action: 'wbgetentities', ids: qid, props: 'labels', languages: 'en' });
  return d.entities?.[qid]?.labels?.en?.value ?? null;
}

async function cityOf(name) {
  const s = await api({ action: 'wbsearchentities', search: name, language: 'en', type: 'item', limit: '5' });
  for (const hit of s.search ?? []) {
    const d = await api({ action: 'wbgetentities', ids: hit.id, props: 'claims|labels', languages: 'en' });
    const claims = d.entities?.[hit.id]?.claims ?? {};
    // P159 — местонахождение штаб-квартиры, P131 — входит в административную единицу.
    const pick = claims.P159?.[0]?.mainsnak?.datavalue?.value?.id
      ?? claims.P131?.[0]?.mainsnak?.datavalue?.value?.id
      ?? null;
    const countryQid = claims.P17?.[0]?.mainsnak?.datavalue?.value?.id ?? null;
    if (!pick) continue;
    return {
      qid: hit.id,
      entity: d.entities?.[hit.id]?.labels?.en?.value ?? hit.label,
      city: await label(pick),
      cityQid: pick,
      country: countryQid ? await label(countryQid) : null,
      via: claims.P159 ? 'P159 штаб-квартира' : 'P131 административная единица',
    };
  }
  return null;
}

const out = {};
for (const t of TARGETS) {
  try {
    const r = await cityOf(t.q);
    if (!r || !r.city) {
      out[t.slug] = { city: null, note: `Wikidata: у «${t.q}» нет ни P159, ни P131` };
      console.log(`—    ${t.slug}: не нашлось`);
      continue;
    }
    const countryOk = !r.country || r.country === t.country
      || (t.country === 'United States' && r.country === 'United States of America');
    out[t.slug] = countryOk
      ? { city: r.city, source: `Wikidata ${r.qid} (${r.entity}), ${r.via} → ${r.cityQid}` }
      : { city: null, note: `Wikidata дала другую страну: ${r.country} вместо ${t.country}` };
    console.log(`${countryOk ? 'ok  ' : 'СТОП'} ${t.slug}: ${r.city} [${r.qid} ${r.entity}, ${r.country}]`);
  } catch (e) {
    out[t.slug] = { city: null, note: `ошибка запроса: ${e.message}` };
    console.log(`ERR  ${t.slug}: ${e.message}`);
  }
}

fs.writeFileSync(OUT, JSON.stringify({ generatedAt: '2026-08-20', cities: out }, null, 1));
console.log(`\n→ ${path.relative(ROOT, OUT)}: нашлось ${Object.values(out).filter((v) => v.city).length} из ${TARGETS.length}`);
