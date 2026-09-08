#!/usr/bin/env node
// Заведение карточек партнёров oxford-international, которых нет в каталоге.
//
// Решение владельца 2026-09-08: правило «есть у агрегатора — есть и у нас»
// (23.08 для QS и edvoy) распространено на oxford-international. Сверка
// kompas-live-vs-aggregators.mjs показала 7 выгрузок OI без карточки.
//
// Устройство скопировано с kompas-edvoy-newcards.mjs намеренно: карточка заводится
// ПУСТОЙ по составу, выгрузка привязывается к её слагу, а программы и цены
// проставят общие kompas-programs-backfill.mjs и kompas-fees-apply.mjs. Своего
// разборщика программ здесь нет — второй разборщик того же источника даёт второй
// набор ответов на один вопрос.
//
// ГОРОД И СТРАНУ НЕ ВЫДУМЫВАЕМ. В выгрузках OI нет ни того, ни другого, поэтому:
//   1. страна — ТОЛЬКО по валюте выгрузки (одна валюта = одна страна, карта ниже);
//   2. город — из Wikidata по самому вузу (P159 штаб-квартира, иначе P131 админ.
//      единица), тем же способом, каким проект уже добирал город карточкам QS;
//   3. не нашлось — город, названный в поле campus или в имени записи, и он обязан
//      подтвердиться в Wikidata как поселение той же страны;
//   4. страна Wikidata обязана совпасть со страной по валюте, иначе это однофамилец;
//   5. не нашлось города — карточка НЕ заводится, вуз уходит кейсом оператору.
//
// Запуск: node scraper/kompas-oi-newcards.mjs [--apply]
// Без --apply ничего не пишет: только отчёт sources/kompas/oi-newcards-review.json.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXTRACTS = path.join(ROOT, 'sources/kompas/extracts/oxford-international');
const WORK = path.join(ROOT, 'sources/kompas/catalog-work');
const OUT_REVIEW = path.join(ROOT, 'sources/kompas/oi-newcards-review.json');
const TODAY = '2026-09-08';
const APPLY = process.argv.includes('--apply');
const UA = 'studyroom-kompas/1.0 (catalog research)';

// Валюта выгрузки → страна. Только однозначные: у EUR стран много, такую выгрузку
// сюда не пускаем — пусть уходит кейсом, чем карточка в наугад выбранной стране.
const CURRENCY_COUNTRY = {
  GBP: 'United Kingdom', CAD: 'Canada', AUD: 'Australia', NZD: 'New Zealand',
  USD: 'United States', AED: 'United Arab Emirates', MYR: 'Malaysia',
  SGD: 'Singapore', CHF: 'Switzerland',
};
const COUNTRY_ALIAS = {
  'United States of America': 'United States',
  'Kingdom of the Netherlands': 'Netherlands',
};

const slugify = (s) => String(s || '').toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 80)
  .replace(/-$/, '');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cache = new Map();

async function api(params) {
  const url = `https://www.wikidata.org/w/api.php?${new URLSearchParams({ format: 'json', origin: '*', ...params })}`;
  if (cache.has(url)) return cache.get(url);
  let wait = 5000;
  for (let attempt = 1; ; attempt++) {
    await sleep(2500);
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (r.ok) {
      const json = await r.json();
      cache.set(url, json);
      return json;
    }
    if (r.status !== 429 || attempt === 6) throw new Error(`${r.status} ${url}`);
    await sleep(wait);
    wait = Math.min(wait * 2, 60000);
  }
}

async function label(qid) {
  const d = await api({ action: 'wbgetentities', ids: qid, props: 'labels', languages: 'en' });
  return d.entities?.[qid]?.labels?.en?.value ?? null;
}

// ── Город, названный самим источником.
// Поле `campus` у OI почти всегда называет город прямым текстом: «OI Greenwich
// Campus, London», «UHE Melbourne Campus», «OI Oxford Centre». Это НЕ выдумывание:
// город назван в выгрузке, мы только вычищаем родовые слова и проверяем остаток
// по Wikidata — сущность обязана быть населённым пунктом (есть население P1082)
// нужной страны (P17). Не подтвердилось — кандидат отбрасывается.
const GENERIC = new Set(['oi', 'uhe', 'campus', 'centre', 'center', 'college', 'school',
  'university', 'universities', 'academy', 'institute', 'of', 'the', 'and', 'applied',
  'sciences', 'science', 'arts', 'art', 'design', 'business', 'international',
  'education', 'higher', 'group', 'main', 'city', 'north', 'south', 'east', 'west']);

function cityCandidates(str) {
  const out = [];
  for (const chunk of String(str || '').split(/[,;/()]+/)) {
    const words = chunk.trim().split(/\s+/).filter(Boolean);
    // весь кусок целиком («Milton Keynes»), затем отдельные незаезженные слова
    const kept = words.filter((w) => !GENERIC.has(w.toLowerCase().replace(/[^a-z]/gi, '')));
    if (kept.length && kept.length <= 3) out.push(kept.join(' '));
    for (const w of kept) if (/^[A-Z][a-z]{2,}$/.test(w)) out.push(w);
  }
  return [...new Set(out.map((s) => s.trim()).filter((s) => s.length >= 3))];
}

// Кандидат — населённый пункт названной страны? У поселения в Wikidata есть
// население (P1082) и страна (P17). У колледжа с тем же именем населения нет,
// поэтому проверка отсеивает «Whitecliffe» и прочие имена учреждений.
async function confirmCity(candidate, country) {
  const s = await api({ action: 'wbsearchentities', search: candidate, language: 'en', type: 'item', limit: '8' });
  for (const hit of s.search ?? []) {
    const d = await api({ action: 'wbgetentities', ids: hit.id, props: 'claims|labels', languages: 'en' });
    const claims = d.entities?.[hit.id]?.claims ?? {};
    if (!claims.P1082) continue;                       // без населения это не поселение
    const cQid = claims.P17?.[0]?.mainsnak?.datavalue?.value?.id ?? null;
    if (!cQid) continue;
    const raw = await label(cQid);
    const c = raw ? (COUNTRY_ALIAS[raw] || raw) : null;
    if (c !== country) continue;                        // тот же город, но не та страна
    return { city: d.entities?.[hit.id]?.labels?.en?.value ?? hit.label, qid: hit.id, country: c };
  }
  return null;
}

async function cityOf(name) {
  const s = await api({ action: 'wbsearchentities', search: name, language: 'en', type: 'item', limit: '8' });
  for (const hit of s.search ?? []) {
    const d = await api({ action: 'wbgetentities', ids: hit.id, props: 'claims|labels', languages: 'en' });
    const claims = d.entities?.[hit.id]?.claims ?? {};
    const pick = claims.P159?.[0]?.mainsnak?.datavalue?.value?.id
      ?? claims.P131?.[0]?.mainsnak?.datavalue?.value?.id
      ?? null;
    const countryQid = claims.P17?.[0]?.mainsnak?.datavalue?.value?.id ?? null;
    if (!pick) continue;
    const country = countryQid ? await label(countryQid) : null;
    return {
      qid: hit.id,
      entity: d.entities?.[hit.id]?.labels?.en?.value ?? hit.label,
      city: await label(pick),
      cityQid: pick,
      country: country ? (COUNTRY_ALIAS[country] || country) : null,
      via: claims.P159 ? 'P159 штаб-квартира' : 'P131 административная единица',
    };
  }
  return null;
}

// ── что заводить: выгрузки OI, у которых нет карточки в рабочей копии
const taken = new Set(fs.readdirSync(WORK).filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, '')));

const drafts = [];
for (const f of fs.readdirSync(EXTRACTS)) {
  if (!f.endsWith('.json')) continue;
  const d = JSON.parse(fs.readFileSync(path.join(EXTRACTS, f), 'utf8'));
  const linked = d.catalogSlug || d.slug;
  if (linked && taken.has(linked)) continue;      // карточка есть — не наш случай
  drafts.push({ file: f, ...d });
}

const stats = { drafts: drafts.length, created: 0, noPrograms: 0, noCountry: 0,
  noCity: 0, countryMismatch: 0, programsCarried: 0 };
const cases = [];
const made = [];

for (const d of drafts) {
  const name = String(d.name || '').trim();
  const programs = d.programs || [];
  if (!name) continue;

  if (!programs.length) {
    stats.noPrograms++;
    cases.push({ slug: d.slug, name, programs: 0, reason: 'no-programs',
      note: 'у источника ни одной программы — заводить нечем' });
    continue;
  }

  const currency = d.currency || programs.find((p) => p.currency)?.currency || null;
  const country = CURRENCY_COUNTRY[currency] || null;

  // СТРАНА — только по валюте выгрузки, и это жёстко. Прогон 08.09 показал, зачем:
  // у Whitecliffe (Новая Зеландия) OI ставит EUR, а Wikidata по этому имени отдаёт
  // сущность со штаб-квартирой в Берлине. Без опоры на валюту карточка уехала бы
  // в Германию. Валюта неоднозначна — вуз уходит кейсом, а не в наугад выбранную страну.
  if (!country) {
    stats.noCountry++;
    cases.push({ slug: d.slug, name, programs: programs.length, currency, reason: 'no-country',
      note: 'страну по валюте выгрузки однозначно не вывести — карточка не заводится' });
    continue;
  }

  // ГОРОД. Лестница, от самого надёжного к запасному:
  //   1. местоположение самого вуза в Wikidata (P159/P131) — страна обязана совпасть;
  //   2. город, названный в поле campus выгрузки, подтверждённый как поселение
  //      этой страны;
  //   3. город, названный в имени записи, та же проверка.
  // Порядок именно такой. Сначала campus стоять не может: у Coquitlam College поле
  // campus называет «Vancouver College» — чужой кампус, и карточка уезжала в Ванкувер
  // вместо Кокуитлама.
  let city = null, cityEvidence = null;
  try {
    const wd = await cityOf(name);
    if (wd && wd.city && wd.country && wd.country !== country) {
      stats.countryMismatch++;
      cases.push({ slug: d.slug, name, programs: programs.length, reason: 'country-mismatch',
        country, wikidataCountry: wd.country, entity: wd.entity,
        note: 'Wikidata нашла вуз в другой стране — однофамилец, привязывать нельзя' });
      continue;
    }
    if (wd && wd.city && wd.country === country) {
      city = wd.city;
      cityEvidence = `Wikidata ${wd.qid} (${wd.entity}), ${wd.via} → ${wd.cityQid}`;
    }
    if (!city) {
      const fromCampus = cityCandidates([...new Set(programs.map((p) => p.campus).filter(Boolean))].join(', '));
      const fromName = cityCandidates(name);
      for (const [cands, where] of [[fromCampus, 'поле campus'], [fromName, 'имя записи']]) {
        for (const cand of cands) {
          const hit = await confirmCity(cand, country);
          if (hit) {
            city = hit.city;
            cityEvidence = `${where} выгрузки OI «${cand}», подтверждено Wikidata ${hit.qid} (поселение ${country})`;
            break;
          }
        }
        if (city) break;
      }
    }
  } catch (e) {
    stats.noCity++;
    cases.push({ slug: d.slug, name, programs: programs.length, reason: 'wikidata-error', note: e.message });
    continue;
  }
  if (!city) {
    stats.noCity++;
    cases.push({ slug: d.slug, name, programs: programs.length, country, reason: 'no-city',
      note: `город не назван ни в campus, ни в имени, ни в Wikidata — не выдумываем` });
    continue;
  }
  const wd = { city, country, qid: null, entity: name, via: cityEvidence, cityQid: null };

  let slug = slugify(name) || slugify(d.slug);
  if (taken.has(slug)) slug = slug + '-oi';
  let i = 2;
  while (taken.has(slug)) { slug = slug.replace(/-\d+$/, '') + '-' + i; i++; }
  taken.add(slug);

  const card = {
    slug,
    name,
    country,
    city,
    programs: [],
    tuition: { currency: null, byProgram: {} },
    deadlines: {},
    requirements: { exams: [] },
    scholarships: [],
    lastChecked: TODAY,
    sourceUrl: d.sourceUrl || `https://www.oxfordinternational.com/partner/${d.slug}/`,
    sourceHash: crypto.createHash('sha1').update(`${d.slug}|${programs.length}`).digest('hex').slice(0, 16),
    confidence: 'aggregator',
    language: 'en',
    _kompas: {
      builtAt: TODAY,
      source: 'oxford-international',
      aggregatorSlug: d.slug,
      city: { value: city, source: cityEvidence },
      country: { value: country, source: `валюта выгрузки ${currency}` },
      rule: 'решение владельца 08.09: правило «есть у агрегатора — есть у нас» распространено на oxford-international',
      programsExpected: programs.length,
    },
  };

  made.push({ slug, name, country, city, programs: programs.length,
    aggregatorSlug: d.slug, evidence: cityEvidence });
  stats.created++;
  stats.programsCarried += programs.length;

  if (APPLY) {
    fs.writeFileSync(path.join(WORK, slug + '.json'), JSON.stringify(card, null, 2) + '\n');
    const moved = { ...d, catalogSlug: slug, matchMethod: 'oi-newcard', newCard: true, builtAt: TODAY };
    delete moved.file;
    if (d.file !== slug + '.json') {
      fs.writeFileSync(path.join(EXTRACTS, slug + '.json'), JSON.stringify(moved, null, 2) + '\n');
      fs.unlinkSync(path.join(EXTRACTS, d.file));
    } else {
      fs.writeFileSync(path.join(EXTRACTS, d.file), JSON.stringify(moved, null, 2) + '\n');
    }
  }
}

fs.writeFileSync(OUT_REVIEW, JSON.stringify({ generatedAt: TODAY, applied: APPLY, stats, made, cases }, null, 1) + '\n');
console.log(JSON.stringify(stats, null, 1));
console.log('кейсы:', JSON.stringify(cases.reduce((a, c) => (a[c.reason] = (a[c.reason] || 0) + 1, a), {})));
console.log(APPLY ? 'ЗАПИСАНО в рабочую копию' : 'сухой прогон — ничего не записано');
console.log('→ ' + path.relative(ROOT, OUT_REVIEW));
