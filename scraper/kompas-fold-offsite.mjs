#!/usr/bin/env node
// kompas-fold-offsite.mjs — КОМПАС 4.5: заполнить 5 пустых карточек Contract Hub
// программами, собранными с офсайтов (kompas-collect-direct.mjs --only-manual).
//
// Владелец 2026-07-24 выбрал РУЧНУЮ вычитку: сырой сбор дал 297 «программ», но
// добрая половина — биографии преподавателей, пункты меню и заголовки разделов
// (болезнь Study Group). Настоящие программы отделены ПО ПУТИ URL, а не по названию:
// путь надёжнее — /academics/programs/biology это программа, /academics/meet-our-faculty нет.
//
// Каждый предикат keepUrl выведен глазами из полного списка выгрузки (см. отчёт 4.5).
// Уровень и длительность источник не отдаёт — выводим из названия/пути по правилам
// схемы; такие программы получают confidence 0.4 и пометку в кейсе.
//
// Живой каталог НЕ трогаем: только sources/kompas/catalog-work.
// Fleming College Toronto НЕ трогаем — ждёт верный адрес от владельца.
//
// Запуск: node kompas-fold-offsite.mjs [--apply]

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { KOMPAS_DIR, args, logger } from './lib/kompas-collect.mjs';

const log = logger('fold');
const APPLY = args.has('apply');
const WORK = path.join(KOMPAS_DIR, 'catalog-work');
const DIRECT = path.join(KOMPAS_DIR, 'extracts', 'direct');
const MAP_FILE = path.join(KOMPAS_DIR, 'partner-source-map.json');
const TODAY = new Date().toISOString().slice(0, 10);

const readJson = async (f) => JSON.parse(await fs.readFile(f, 'utf8'));
const writeJson = async (f, o) => { if (APPLY) await fs.writeFile(f, JSON.stringify(o, null, 2) + '\n', 'utf8'); };
const slugify = (s) => (s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').slice(0, 80).replace(/^-+|-+$/g, '');
const hashOf = (o) => crypto.createHash('sha1').update(JSON.stringify(o)).digest('hex').slice(0, 16);
const pathOf = (u) => { try { return new URL(u).pathname.replace(/\/$/, ''); } catch { return u || ''; } };

const DURATION = { bachelor: 3, master: 1, phd: 3, foundation: 1, 'english-language': 1, 'short-course': 0.5 };

// Уровень по названию и пути. Схема каталога знает только 8 значений, поэтому
// diploma/certificate уходят в short-course, а language — в english-language.
function inferLevel(title, url) {
  const t = `${title} ${url}`.toLowerCase();
  if (/\b(dba|doctor of|phd|doctoral|doctorate)\b/.test(t)) return 'phd';
  if (/\b(msed|m\.?ed|mba|msc|m\.?sc|m\.?a\b|master|postgraduate|pg-?cert|pg-?dip|graduate-cert|graduate-program|acca \+|acca-mba|mba-|msc )\b/.test(t)) return 'master';
  if (/\b(foundation|pre-?master|pathway|integrated-foundation)\b/.test(t)) return 'foundation';
  if (/\b(certificate|cert\b|aat|diploma|microcredential)\b/.test(t)) return 'short-course';
  // english-language — ТОЛЬКО настоящие языковые курсы. «English Literature» и
  // «Speech & Language Disabilities» — это бакалаврские программы, а не ESL.
  if (/\b(esl|pre-?sessional|elicos|english language|language course)\b/.test(t)) return 'english-language';
  return 'bachelor';
}

// keepUrl: предикат «это настоящая программа», выведен глазами по каждой выгрузке.
const CARDS = {
  'niagara-college-toronto': {
    keepUrl: (p) => /^\/programs\/(graduate-certificate|undergraduate-diploma|certificate)\/[^/]+$/.test(p),
  },
  'toronto-school-of-management': {
    // настоящие — листья под /programs/<раздел>/<программа>; демо-курсы под /courses/ и
    // /course-category/ («Sample course», «Study test», «Masters Course in Adobe Photoshop») — мусор.
    keepUrl: (p) => /^\/programs\/(business|technology|hospitality-tourism|accounting)\/[^/]+$/.test(p),
  },
  'university-of-gloucestershire': {
    // индивидуальные программы — только под /courses/course/; /study/subjects/ это разделы-факультеты.
    keepUrl: (p) => /^\/courses\/course\/[^/]+$/.test(p),
  },
  'elmira-college': {
    // мажоры — /academics/programs/<одно-слово>; концентрации (глубже) и служебные страницы отсекаем.
    keepUrl: (p) => /^\/academics\/programs\/[^/]+$/.test(p) && !/\/(overview|programs|undeclared)$/.test(p),
  },
  'london-school-of-business-and-finance': {
    // держим листовые страницы степеней/квалификаций; биографии /faculty, справку ACCA
    // (exam-tips, past-papers, отдельные экзамены F2–P7) и индексы разделов отбрасываем.
    keepUrl: (p) => {
      if (!p.startsWith('/programmes/') && !/\/aat\/aat-level-2-/.test(p)) return false;
      if (/\/faculty(\/|$)/.test(p)) return false;
      // отдельные экзамены и справка ACCA — не программы; комбо ACCA+MBA/MSc оставляем
      if (/\/acca-courses\//.test(p) && !/mba/.test(p)) return false;
      if (/\/acca-courses$/.test(p)) return false; // индекс раздела ACCA, не программа
      // индексы разделов
      if (/^\/programmes\/(undergraduate|postgraduate|professional|executive)$/.test(p)) return false;
      if (/^\/programmes$/.test(p)) return false;
      if (/\/(course-structure-assessment|postgraduate-certificates)$/.test(p)) return false;
      if (/\/programmes\/professional(\/aat)?$/.test(p)) return false;
      if (/\/aat\/(packages|aat-syllabus)$/.test(p)) return false;
      if (/\/programmes\/executive$/.test(p)) return false;
      return true;
    },
  },
};

const COUNTRY = {
  'niagara-college-toronto': ['Canada', 'CAD', 'Toronto'],
  'toronto-school-of-management': ['Canada', 'CAD', 'Toronto'],
  'university-of-gloucestershire': ['United Kingdom', 'GBP', 'Cheltenham'],
  'elmira-college': ['United States', 'USD', 'Elmira, NY'],
  'london-school-of-business-and-finance': ['United Kingdom', 'GBP', 'London'],
};

const cases = [];
const addCase = (slug, name, issue, sev, detail) => cases.push({
  id: `${slug}||${issue}||session4.5-fold`, slug, name, issue, severity: sev, detail,
  catalog: null, official: null, program: null, sourceUrl: null,
  checkedAt: new Date().toISOString(), decision: null, decidedAt: null, applied: false,
});

async function foldCard(slug, MAP) {
  const ex = await readJson(path.join(DIRECT, `${slug}.json`));
  const [country, currency, city] = COUNTRY[slug];
  const kept = (ex.programs ?? []).filter((p) => CARDS[slug].keepUrl(pathOf(p.programUrl)));

  const seen = new Set();
  const byProgram = {};
  const programs = [];
  let priced = 0;
  for (const p of kept) {
    const level = inferLevel(p.title, p.programUrl || '');
    let s = slugify(`${slug}-${p.title}`) || `${slug}-p${programs.length}`;
    let n = 1; let fin = s; while (seen.has(fin)) fin = `${s}-${++n}`; seen.add(fin);
    programs.push({
      slug: fin,
      title: p.title,
      durationYears: DURATION[level] ?? 1,
      level,
      language: 'en',
      programType: level === 'foundation' ? 'pathway' : 'degree',
      programUrl: p.programUrl,
      source: 'official',
      verifiedBySite: true,
      confidence: 0.4, // уровень и длительность выведены, не сняты с источника
      checkedAt: new Date().toISOString(),
    });
    // Цену переносим только если валюта карточки та же и сумма правдоподобна.
    if (p.tuition && p.tuition.currency === currency && Number.isFinite(p.tuition.amount)) {
      byProgram[fin] = p.tuition.amount; priced++;
    }
  }

  if (!programs.length) { log(`${slug}: после фильтра 0 программ — карточку не трогаю`); return null; }

  const card = await readJson(path.join(WORK, `${slug}.json`));
  card.programs = programs;
  card.tuition = { currency, byProgram };
  card.city = card.city || city;
  card.country = card.country || country;
  card.sourceUrl = ex.sourceUrl || card.sourceUrl;
  card.officialUrl = ex.sourceUrl || card.officialUrl;
  card.sourceHash = hashOf(programs.map((p) => p.title));
  card.confidence = 'official'; // данные сняты с офсайта вуза
  card.lastChecked = TODAY;
  delete card.kompasStatus; // больше не «programs-not-collected»
  const via = new Set([...(card.partnerSource?.via ?? []), 'direct']);
  card.partnerSource = { type: card.partnerSource?.type ?? 'aggregator', via: [...via] };
  await writeJson(path.join(WORK, `${slug}.json`), card);
  MAP[slug] = { type: card.partnerSource.type, via: card.partnerSource.via };

  addCase(slug, card.name, 'kompas_card_filled_offsite', 'warning',
    `Карточка заполнена с офсайта (${ex.sourceUrl}) в сессии 4.5: из ${ex.programs.length} собранных строк оставлено ${programs.length} настоящих программ (остальное — биографии преподавателей, пункты меню, заголовки разделов, отсеяны по пути URL). Цен ${priced}. Уровень и длительность выведены из названия, не сняты с источника (confidence 0.4) — проверить перед выпуском на живой сайт.`);
  log(`${slug}: ${ex.programs.length} собрано → ${programs.length} настоящих (${priced} с ценой)`);
  return { slug, collected: ex.programs.length, kept: programs.length, priced };
}

async function main() {
  if (!APPLY) log('СУХОЙ ПРОГОН: ничего не пишу. Для записи добавь --apply');
  const MAP = await readJson(MAP_FILE);
  const done = [];
  for (const slug of Object.keys(CARDS)) {
    const r = await foldCard(slug, MAP);
    if (r) done.push(r);
  }
  await writeJson(MAP_FILE, MAP);
  await writeJson(path.join(KOMPAS_DIR, 'offsite-review.json'), {
    generatedAt: new Date().toISOString(), scope: 'kompas-offsite-fold', summary: { total: cases.length }, items: cases,
  });
  console.log(JSON.stringify({ applied: APPLY, cards: done, totalKept: done.reduce((a, r) => a + r.kept, 0) }, null, 2));
  console.log('FOLD-OFFSITE DONE');
}

main().catch((e) => { console.error(e); process.exit(1); });
