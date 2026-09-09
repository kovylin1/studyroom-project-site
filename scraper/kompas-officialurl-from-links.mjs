#!/usr/bin/env node
// kompas-officialurl-from-links.mjs — добор officialUrl из ссылок самой карточки.
//
// Зачем: у 199 карточек resolveOfficialSite() отдаёт null — в sourceUrl стоит агрегатор,
// officialUrl пуст. Без адреса вуз не участвует ни в сборе стипендий, ни в сверке с сайтом.
// Wikidata (discover-official-sites.mjs) по ним уже отработала и упёрлась: в worklist
// 196 записей с причинами «no-wikidata-entity» / «no-verified-site».
//
// Но у части карточек адрес лежит внутри них самих: программы собирались с офсайта, и в
// programUrl стоит домен вуза (у Бирмингема таких ссылок 372). Это НЕ угадывание — это
// уже проверенные ссылки, по которым брались данные.
//
// Правило отбора (иначе легко подцепить чужой домен):
//   * домен не из списка агрегаторов/соцсетей;
//   * ссылок на него в карточке не меньше MIN_HITS (по умолчанию 3);
//   * домен — самый частый среди «своих» в карточке.
// Не прошло — в отчёт, карточка не трогается.
//
// Сеть НЕ используется. Пишется одно поле officialUrl, программы и цены не трогаются.
//
// Запуск: node kompas-officialurl-from-links.mjs [--apply] [--min-hits=3]

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AGG_DOMAINS } from './lib/official-site.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const UNI_DIR = path.join(ROOT, 'site', 'src', 'content', 'universities');
const REPORT = path.join(ROOT, 'sources', 'kompas', 'OFFICIALURL-FROM-LINKS.md');

const APPLY = process.argv.includes('--apply');
const MIN_HITS = Number((process.argv.find((a) => a.startsWith('--min-hits=')) ?? '').split('=')[1] || 3);

// Соцсети и каталоги-посредники — не офсайт вуза, даже если ссылок на них много.
const NOT_OWN = /facebook|instagram|youtube|linkedin|twitter|x\.com|tiktok|google|maps\.app|wikipedia|wikimedia|shorterlink|bit\.ly|studyportals|hotcourses|idp\.com|unipage|4icu/i;

/** Хост ссылки, если он может быть собственным сайтом вуза. Иначе null. */
export function ownHost(url) {
  if (!url || typeof url !== 'string') return null;
  let h;
  try { h = new URL(url).hostname; } catch { return null; }
  if (AGG_DOMAINS.test(h) || NOT_OWN.test(h)) return null;
  return h;
}

/** Все ссылки карточки, из которых вообще может выясниться адрес вуза. */
export function linksOf(card) {
  const out = [];
  for (const p of card.programs ?? []) out.push(p.programUrl);
  for (const s of card.scholarships ?? []) out.push(s.url, s.link);
  for (const a of card.accommodation ?? []) out.push(a.url);
  for (const c of card.campuses ?? []) out.push(c.url);
  return out.filter(Boolean);
}

/** Домен-кандидат: самый частый «свой» хост, если ссылок на него хватает. */
export function pickHost(card, minHits = MIN_HITS) {
  const hits = {};
  for (const u of linksOf(card)) {
    const h = ownHost(u);
    if (h) hits[h] = (hits[h] ?? 0) + 1;
  }
  const ranked = Object.entries(hits).sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return { host: null, hits: 0, why: 'своих ссылок в карточке нет' };
  const [host, n] = ranked[0];
  if (n < minHits) return { host: null, hits: n, why: `ссылок на ${host} всего ${n}, порог ${minHits}` };
  return { host, hits: n, others: ranked.slice(1, 3) };
}

async function main() {
  const files = (await fs.readdir(UNI_DIR)).filter((f) => f.endsWith('.json'));
  const fixed = [], left = [];

  for (const f of files) {
    const fp = path.join(UNI_DIR, f);
    const card = JSON.parse(await fs.readFile(fp, 'utf8'));
    if (ownHost(card.officialUrl) || ownHost(card.sourceUrl)) continue;   // адрес уже есть

    const pick = pickHost(card);
    if (!pick.host) { left.push([card.slug, pick.why]); continue; }

    const url = `https://${pick.host}`;
    fixed.push([card.slug, url, pick.hits]);
    if (APPLY) {
      card.officialUrl = url;
      await fs.writeFile(fp, JSON.stringify(card, null, 2) + '\n', 'utf8');
    }
  }

  const md = [
    '# Добор officialUrl из ссылок карточки',
    '',
    `Карточек без адреса офсайта: **${fixed.length + left.length}**. Адрес взят из собственных ссылок: **${fixed.length}**. ` +
    `Осталось без адреса: **${left.length}** — по ним ни Wikidata, ни свои ссылки не помогли, нужен поиск или человек.`,
    '', '## Проставлено', '', '| Вуз | Адрес | Ссылок в карточке |', '|---|---|---:|',
    ...fixed.sort((a, b) => b[2] - a[2]).map(([s, u, n]) => `| ${s} | ${u} | ${n} |`),
    '', '## Не удалось', '', '| Вуз | Почему |', '|---|---|',
    ...left.map(([s, w]) => `| ${s} | ${w} |`), '',
  ].join('\n');

  if (APPLY) await fs.writeFile(REPORT, md, 'utf8');
  console.log(`officialUrl: проставлено ${fixed.length}, осталось без адреса ${left.length}${APPLY ? ' — ЗАПИСАНО' : ' — СУХОЙ ПРОГОН'}`);
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) await main();
