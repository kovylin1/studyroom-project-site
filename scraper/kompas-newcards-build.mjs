// КОМПАС — заведение карточек новых партнёров QS.
// Решение владельца 2026-08-20: всё, что портал отмечает партнёром, должно быть
// на сайте. Правило 31.07 «карточки заводит человек» снято владельцем именно
// для этой очереди — см. sources/kompas/OWNER-DECISIONS.md.
//
// Запуск: node scraper/kompas-newcards-build.mjs [--apply]
// Без --apply только считает и пишет черновики; живой каталог не трогает.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { inferLevel as inferProgramLevel } from './lib/program-level.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EX = path.join(ROOT, 'sources/kompas/extracts/qs');
const CATALOG = path.join(ROOT, 'site/src/content/universities');
const OUT = path.join(ROOT, 'sources/kompas/newcards');
const APPLY = process.argv.includes('--apply');
// --only=slug1,slug2 — завести только перечисленные карточки. Без фильтра --apply
// проходит по всей очереди, а очередь с 20.08 уже заведена: строка 207 вешает
// на занятый слаг суффикс -qs, и повторный прогон наплодил бы дубли.
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7)
  .split(',').map((x) => x.trim()).filter(Boolean);
const TODAY = '2026-08-20';

const log = (...a) => console.log(...a);

// ── Города. В выгрузках QS поля города нет ни у одной из 46 записей, поэтому
// значение берётся только там, где оно названо в самой записи — в имени или в
// описании вуза. Где не названо — кейс оператору, карточка не заводится.
const CITY = {
  'american-university-of-ras-al-khaimah-aurak': ['Ras Al Khaimah', 'имя записи QS'],
  'hague-university-of-applied-science-foundation': ['The Hague', 'описание QS: «located in and around The Hague»'],
  'icn-international-college-paris': ['Paris', 'имя записи QS'],
  'into-manchester-in-partnership-with-manchester-metropolitan-university': ['Manchester', 'имя записи QS'],
  'northumbria-university-london-campus-qahe': ['London, Newcastle', 'описание QS: «courses at the London Campus, and Pathway programmes at the City Campus in Newcastle»'],
  'northumbria-university-london-campus-qahe-lz1dz7he': ['London, Newcastle', 'описание QS: то же'],
  'oncampus-aston-foundation': ['Birmingham', 'описание QS: «situated in the centre of Birmingham»'],
  'oncampus-hull-foundation': ['Hull', 'имя записи QS'],
  'oncampus-southampton-pathway': ['Southampton', 'имя записи QS'],
  'oncampus-sunderland-foundation': ['Sunderland', 'имя записи QS'],
  'st-james-catholic-middle-school': ['Los Angeles', 'описание QS: «Amerigo Los Angeles Middle School»'],
  'swinburne-university-foundation': ['Melbourne', 'описание QS: «based in Melbourne»'],
  'tedi-london': ['London', 'имя записи QS'],
  'university-of-lethbridge-international-college-calgary-foundation': ['Calgary', 'имя записи QS'],
  'university-of-tasmania-melbourne-campus': ['Melbourne', 'имя записи QS'],
  'university-of-west-of-england-bristol-international-college-uwe-bristol-foundati': ['Bristol', 'имя записи QS'],
  'university-of-york-international-pathway-college-foundation': ['York', 'имя записи QS'],
  'westminster-international-university-in-tashkent': ['Tashkent', 'имя записи QS'],
  'wycombe-abbey-international-school': ['Changzhou', 'описание QS: «Wycombe Abbey International Changzhou campus»'],
  'wycombe-abbey-international-school-bangkok': ['Bangkok', 'имя записи QS'],
  'wycombe-abbey-international-school-hong-kong': ['Hong Kong', 'имя записи QS'],
  'ilac-international-language-academy-of-canada': ['Toronto, Vancouver', 'черновик 04.08: описание QS «campuses in Toronto and Vancouver»'],

  // Добор из Wikidata (scraper/kompas-newcards-city-wikidata.mjs, прогон 2026-08-20)
  // для записей, где QS город не называет. Взято только то, где сущность той же
  // страны и свойство даёт именно город.
  'kwantlen-polytechnic-university': ['Surrey', 'Wikidata Q3335261 (Kwantlen Polytechnic University), P131 → Q243554'],
  'marshall-university': ['Huntington', 'Wikidata Q1379613 (Marshall University), P159 штаб-квартира'],
  'mercy-university': ['Dobbs Ferry', 'Wikidata Q16951582 (Mercy University), P159 штаб-квартира'],
  'charles-darwin-university-international-college': ['Darwin', 'Wikidata Q1064071 (Charles Darwin University), P159 штаб-квартира'],
  'anglican-schools-commission-asc-western-australia-victoria-and-new-south-wales': ['Perth', 'Wikidata Q4763547 (Anglican Schools Commission), P159 штаб-квартира'],
  // Названы владельцем 23.08 — источник города не даёт, Wikidata не помогла.
  'university-of-tasmania-international-pathway-college': ['Hobart', 'решение владельца 23.08'],
  'university-bridge': ['Saskatoon', 'решение владельца 23.08'],
  'on-campus-ireland': ['Dublin', 'решение владельца 23.08'],
  'oxford-international-education-group-english-schools': ['Oxford', 'решение владельца 23.08'],
  'oxford-international-education-group-ielts-and-tesol': ['Oxford', 'решение владельца 23.08'],
  'oxford-international-education-group-junior': ['Oxford', 'решение владельца 23.08'],

  // Не взято намеренно: University of Tasmania → Wikidata отдаёт «Tasmania», это штат,
  // а не город; OnCampus Ireland, University Bridge и три записи Oxford International
  // — сущности нет либо она про другой объект (University Bridge оказался мостом
  // в Саскачеване). Эти шесть остаются кейсами оператору.
};

// Уровень берётся только из явной разметки QS. Ничего не выводим из названия.
const LEVEL = {
  Bachelors: 'bachelor',
  Masters: 'master',
  PhD: 'phd',
  'High School': 'high-school',
  Pathway: 'foundation',
  'English Course': 'english-language',
  Diploma: null,
  'Graduate Diploma': null,
  Certificate: null,
  'Graduate Certificate': null,
  'Advanced Diploma': null,
};

const CURRENCIES = ['USD', 'EUR', 'GBP', 'KZT', 'RUB', 'CAD', 'AUD', 'NZD', 'CHF', 'AED', 'HKD', 'THB', 'CNY', 'BHD', 'MYR', 'SGD'];
const SYM2CUR = {
  '£': 'GBP', '€': 'EUR', 'CA$': 'CAD', 'A$': 'AUD', 'NZ$': 'NZD', 'US$': 'USD',
  AED: 'AED', 'HK$': 'HKD', THB: 'THB', 'CN¥': 'CNY', CHF: 'CHF', SGD: 'SGD', MYR: 'MYR',
};

// «Max: £19,950.00 Min: £17,950.00» → {currency, min, max}
function yearlyRange(s) {
  if (!s) return null;
  const m = /Max:\s*([^\d]*?)\s*([\d,.]+)/.exec(s);
  const n = /Min:\s*([^\d]*?)\s*([\d,.]+)/.exec(s);
  if (!m || !n) return null;
  const sym = m[1].trim();
  const currency = SYM2CUR[sym] || (/^[A-Z]{3}$/.test(sym) ? sym : null);
  const num = (x) => Number(String(x).replace(/,/g, ''));
  return { currency, max: num(m[2]), min: num(n[2]) };
}

// Те же правила, что у ворот каталога: карта одна на всех — lib/program-level.mjs.
// Своя копия здесь и была той причиной, по которой заведение карточек ставило
// «M.B.A.Business Administration» бакалавриатом, а гейт потом это ловил.
const inferLevel = (t) => inferProgramLevel(t);

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
    .replace(/-$/, '');
}

export function buildCards({ rows, readExtract, existing }) {
  const groups = new Map();
  for (const r of rows) {
    const ex = readExtract(r.slug);
    const key = slugify(ex.name);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ row: r, ex });
  }

  const cards = [];
  const cases = [];

  for (const [key, parts] of groups) {
    const first = parts[0].ex;
    const slugs = parts.map((p) => p.row.slug);
    const range = yearlyRange(first.yearlyFeesStated);
    const cityKey = slugs.find((s) => CITY[s]);
    const cityRec = cityKey ? CITY[cityKey] : null;

    const programs = [];
    const byProgram = {};
    let noLevel = 0;
    const levelConflicts = [];
    let priceOutOfRange = 0;
    let priceKept = 0;
    const seen = new Set();

    for (const p of parts) {
      for (const pr of p.ex.programs || []) {
        let level = LEVEL[pr.sourceLevel] || null;
        if (!level) {
          noLevel++;
          continue;
        }
        // QS иногда сам себе противоречит: строка помечена «Bachelors», а в названии
        // стоит «Master of Business Administration». Обе улики — от источника, но
        // название конкретнее, поэтому берётся оно, а расхождение уходит кейсом.
        // Правила разбора те же, что у ворот каталога (scraper/audit-catalog.mjs).
        const byTitle = inferLevel(pr.title);
        if (byTitle && ['bachelor', 'master', 'phd'].includes(level) && byTitle !== level) {
          levelConflicts.push(`«${pr.title}»: QS говорит ${level}, название — ${byTitle}`);
          level = byTitle;
        }
        let s = slugify(pr.title);
        if (!s) continue;
        while (seen.has(s)) s += '-2';
        seen.add(s);
        const prog = {
          slug: s,
          title: pr.title,
          level,
          source: 'qs-apply',
          verifiedBySite: false,
          confidence: 0.6,
          kompasStatus: 'source-added',
          kompasCheckedAt: TODAY,
        };
        // Срок QS не отдаёт ни у одной программы — поле осталось пустым осознанно
        // (решение 2026-08-20, durationYears необязателен).
        if (pr.programUrl) prog.programUrl = pr.programUrl;
        // Ворота каталога (scraper/audit-catalog.mjs, GARBAGE:junk-title) считают
        // «Pre-Sessional English» и «Academic Preparation» мусором, пока у программы
        // не проставлен programType: 'pathway'. У QS это и есть Pathway / English
        // Course, так что метка берётся из разметки источника, а не додумывается.
        if (level === 'foundation' || level === 'english-language') prog.programType = 'pathway';
        programs.push(prog);

        // Цена пишется, только если сходится с годовым диапазоном записи.
        // У KPU кампусная сумма 92 443 CAD при годовом потолке 23 666 — это цена
        // за весь срок, и подставлять её как годовую нельзя.
        if (pr.tuition != null && range && pr.currency === range.currency &&
            pr.tuition >= range.min * 0.95 && pr.tuition <= range.max * 1.05) {
          byProgram[s] = Math.round(pr.tuition);
          priceKept++;
        } else if (pr.tuition != null) {
          priceOutOfRange++;
        }
      }
    }

    const currency = range && CURRENCIES.includes(range.currency) ? range.currency : null;
    const cardSlug = existing.has(key) ? `${key}-qs` : key;

    const missing = [];
    if (!cityRec) missing.push('city');
    if (!programs.length) missing.push('programs');
    if (!currency) missing.push('currency');

    cards.push({
      slug: cardSlug,
      name: first.name,
      country: first.country,
      city: cityRec ? cityRec[0] : null,
      programs,
      tuition: { currency, byProgram },
      deadlines: {},
      requirements: { exams: [] },
      scholarships: [],
      lastChecked: TODAY,
      sourceUrl: first.sourceUrl,
      sourceHash: crypto.createHash('sha1').update(`${slugs.join('|')}${programs.length}`).digest('hex').slice(0, 16),
      confidence: 'aggregator',
      language: 'en',
      _kompas: {
        draft: missing.length > 0,
        builtAt: TODAY,
        qsRecords: slugs,
        city: cityRec ? { value: cityRec[0], source: cityRec[1] } : null,
        priceFrom: `qs-apply, сверено с годовым диапазоном записи (${first.yearlyFeesStated || '—'})`,
        durationFrom: 'нет: QS срок не отдаёт',
        priceKept,
        missing,
      },
    });

    if (levelConflicts.length) {
      cases.push({ slug: cardSlug, issue: 'newcard_level_conflict', n: levelConflicts.length,
        detail: `QS противоречит сам себе, уровень взят из названия: ${levelConflicts.join('; ')}` });
    }
    if (noLevel) {
      cases.push({ slug: cardSlug, issue: 'newcard_level_unmapped', n: noLevel,
        detail: 'Уровень QS не ложится на схему (Diploma/Certificate и подобные) — программы не заведены.' });
    }
    if (priceOutOfRange) {
      cases.push({ slug: cardSlug, issue: 'newcard_price_out_of_range', n: priceOutOfRange,
        detail: `Цена не сходится с годовым диапазоном записи (${first.yearlyFeesStated || '—'}) — не записана.` });
    }
    if (!cityRec) {
      cases.push({ slug: cardSlug, issue: 'newcard_city_unknown', n: 1,
        detail: 'Города нет ни в имени записи QS, ни в описании. Нужен оператор.' });
    }
    if (!currency) {
      cases.push({ slug: cardSlug, issue: 'newcard_currency_unknown', n: 1,
        detail: `Валюта не разобралась из «${first.yearlyFeesStated || '—'}».` });
    }
  }

  return { cards, cases };
}

export { yearlyRange, slugify, CITY, LEVEL };

function main() {
  const queue = JSON.parse(fs.readFileSync(path.join(ROOT, 'sources/kompas/newcards-queue.json'), 'utf8'));
  // Черновики сессии 03–04.08: у них срок снят с офсайта, поэтому они лучше
  // того, что можно собрать из одного QS. ILAC здесь нет намеренно: его черновик
  // пустой (0 программ — тогда программы без срока отбрасывались), а после
  // решения 2026-08-20 его единственная строка QS заводится как есть.
  const HAVE_DRAFT = new Set([
    'falmouth-university', 'university-of-worcester-undergraduate',
    'university-of-worcester-postgraduate', 'mpw',
    'peking-university-hsbc-business-school',
  ]);
  const rows = queue.rows.filter((r) => r.fate === 'new' && !HAVE_DRAFT.has(r.slug));
  const existing = new Set(
    fs.readdirSync(CATALOG).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', '')),
  );

  const { cards, cases } = buildCards({
    rows,
    readExtract: (slug) => JSON.parse(fs.readFileSync(path.join(EX, `${slug}.json`), 'utf8')),
    existing,
  });

  fs.mkdirSync(OUT, { recursive: true });
  for (const c of cards) fs.writeFileSync(path.join(OUT, `${c.slug}.draft.json`), JSON.stringify(c, null, 1));
  fs.writeFileSync(path.join(OUT, 'build-cases.json'), JSON.stringify({ generatedAt: TODAY, cases }, null, 1));

  const ready = cards.filter((c) => !c._kompas.missing.length);
  const draft = cards.filter((c) => c._kompas.missing.length);
  for (const c of cards) {
    log(`${c._kompas.missing.length ? 'ЧЕРНОВИК' : 'ГОТОВА  '} ${c.slug.padEnd(52)}${String(c.programs.length).padStart(4)}п  цена ${c._kompas.priceKept}${c._kompas.missing.length ? '  нет: ' + c._kompas.missing.join(',') : ''}`);
  }
  log(`кейсов оператору: ${cases.length}`);

  // Черновики сессий 03–04.08 заводятся как есть: срок у них снят с офсайта,
  // цена сверена вручную. Worcester приходит одним файлом на обе записи QS.
  const READY_DRAFTS = ['falmouth-university', 'university-of-worcester', 'mpw',
    'peking-university-hsbc-business-school'];
  const fromDrafts = [];
  for (const name of READY_DRAFTS) {
    const p = path.join(OUT, `${name}.draft.json`);
    if (!fs.existsSync(p)) { log(`нет черновика: ${name}`); continue; }
    const c = JSON.parse(fs.readFileSync(p, 'utf8'));
    const bad = [];
    if (!c.city) bad.push('city');
    if (!c.programs?.length) bad.push('programs');
    if (!c.tuition?.currency) bad.push('currency');
    if (bad.length) { log(`черновик ${name} не полон: ${bad.join(',')}`); continue; }
    fromDrafts.push(c);
    log(`ЧЕРНОВИК ГОТОВ ${c.slug.padEnd(46)}${String(c.programs.length).padStart(4)}п`);
  }

  log('');
  log(`из QS: ${cards.length} карточек | готовы ${ready.length} | не хватает полей у ${draft.length}`);
  log(`из черновиков 03–04.08: ${fromDrafts.length} карточек, ${fromDrafts.reduce((s, c) => s + c.programs.length, 0)} программ`);
  log(`ВСЕГО К ЗАВЕДЕНИЮ: ${ready.length + fromDrafts.length} карточек, ${ready.reduce((s, c) => s + c.programs.length, 0) + fromDrafts.reduce((s, c) => s + c.programs.length, 0)} программ`);

  if (APPLY) {
    const written = [];
    for (const c of [...ready, ...fromDrafts]) {
      const { _kompas, ...clean } = c;
      if (ONLY.length && !ONLY.includes(clean.slug)) continue;
      const dest = path.join(CATALOG, `${clean.slug}.json`);
      if (fs.existsSync(dest)) { log(`ПРОПУСК ${clean.slug}: карточка уже есть, не перезаписываю`); continue; }
      fs.writeFileSync(dest, `${JSON.stringify(clean, null, 2)}\n`);
      written.push(clean.slug);
    }
    fs.writeFileSync(path.join(OUT, 'applied.json'),
      JSON.stringify({ appliedAt: TODAY, slugs: written }, null, 1));
    log(`ЗАВЕДЕНО В КАТАЛОГ: ${written.length} (откат — удалить файлы из applied.json)`);
  } else {
    log('СУХОЙ ПРОГОН — для заведения добавь --apply');
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
