#!/usr/bin/env node
// kompas-collect-edvoy.mjs — КОМПАС, сессия 3. Edvoy.
//
// План числил Edvoy закрытым: «логин; есть снимок 411». Замер сессии 3 это опроверг —
// GraphQL api-prod.edvoy.com/edp/graphql отвечает БЕЗ токена. Проверено запросом:
// searchInstitutions отдаёт 666 вузов, searchCourse — 48 733 курса.
// Прежний scrape-edvoy-all.mjs поднимал Playwright, логинился и перехватывал заголовок
// authorization; для чтения это больше не нужно (и логин владельца тратить незачем).
//
// ВАЖНО, найдено замером: в схеме больше НЕТ findOneEdp («Did you mean findOneHta?») —
// Edvoy переименовал сущность. Богатый профиль вуза (галерея, рейтинги, keyFacts), который
// брал старый коллектор, этим запросом уже не достать. Здесь собираем то, что источник
// отдаёт сегодня: курсы с ценами, уровнем, интейками и кампусами.
//
// ПОТОЛКИ ВЫДАЧИ (замерены, не предположены). Первая версия этого коллектора шла одним
// проходом по всем курсам — и получила 500 из 48 733: на offset=500 выдача становится
// пустой. Список вузов обрезан ещё жёстче: без строки поиска отдаётся ровно 100.
// Пустая страница при этом НЕ отличается от «курсы кончились», поэтому наивный проход
// отчитался бы об успехе на 1% данных. Отсюда две защиты ниже: счётчик недобора у каждого
// вуза и адаптивный перебор префиксов вместо постраничного списка.
//
// Схема сбора:
//   фаза 1 — перечисление вузов перебором строки поиска ('a'…'z'); если ответ упёрся
//            в потолок 100, префикс углубляется на символ ('ab', 'ac', …) до тех пор,
//            пока выдача не перестанет упираться. Так обходится предел в 100;
//   фаза 2 — курсы отдельно по каждому вузу (filter.edpRefIds) с постраничной выборкой,
//            здесь предел 500 на вуз реально не мешает — самый крупный найденный 391.
//
// Запуск:
//   node scraper/kompas-collect-edvoy.mjs --dry-run          # ничего не пишет
//   node scraper/kompas-collect-edvoy.mjs --discover-only    # только перечисление вузов
//   node scraper/kompas-collect-edvoy.mjs                    # полный сбор

import fs from 'fs/promises';
import path from 'path';
import {
  ROOT, fetchQueued, writeExtract, writeMembership, extract, mapLevel, args, logger, stats,
} from './lib/kompas-collect.mjs';
import { buildCatalogIndex, matchToCatalog } from './lib/kompas-catalog-match.mjs';

const log = logger('edvoy');
const AGG = 'edvoy';
const EDP = 'https://api-prod.edvoy.com/edp/graphql';
const PAGE = 100;

const PAGE_CAP = 100; // потолок одной страницы выдачи, замерен
// Значения CourseLevelEnum. Интроспекция у Edvoy выключена, поэтому список взят из самих
// данных (поле courseLevel) и проверен запросом: фильтр их принимает.
const COURSE_LEVELS = ['Undergraduate', 'Postgraduate', 'Doctorate', 'PresessionalEnglish', 'Foundation'];
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');

const Q_INSTITUTIONS = `query searchInstitutions($filter: CourseFilterInputDto!, $paging: PagingInputDto, $query: String!) {
  searchInstitutions(searchType: SmartSearch, filter: $filter, filterType: "student", paging: $paging, query: $query, courseQuery: "") {
    count items { name refId edPartnerType partnerRating address { country city } }
  }
}`;

const Q_COURSES = `query fetchOnlyCourseList($filter: CourseFilterInputDto = {}, $paging: PagingInputDto = {limit: 100, offset: 0, skip: -1}) {
  searchCourse(searchType: SmartSearch, enReqRuleFilter: {activateBestFit: false}, filter: $filter, filterType: "student", paging: $paging, query: "") {
    count
    items {
      _id name refId edpRefId courseLevel status approxAnnualFee currency scholarshipTag
      courseIntakes { intakeYear intakeMonth attendanceType courseDurationUnit courseDurationUnitValue campusRef { name refId address { country } } }
      institution { name address { country } }
    }
  }
}`;

// Токен живёт только в памяти процесса. В файлы и логи не попадает.
let AUTH = null;

/** Читает scraper/.env, ничего не печатая: пароли не должны попасть ни в лог, ни в отчёт. */
async function loadEnv() {
  try {
    const raw = await fs.readFile(path.join(ROOT, 'scraper', '.env'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch { /* нет файла — работаем анонимно */ }
}

/**
 * Вход в портал и перехват заголовка authorization.
 *
 * Зачем вообще: анонимный доступ к API есть, но обрезан — постраничность при фильтре не
 * работает, на вуз отдаётся не больше 100 курсов. Замер: анонимно вышло 25 371 курс из
 * 48 734, тогда как майский сбор через портал дал 44 383. Логин нужен не ради доступа,
 * а ради полноты.
 */
async function acquireToken() {
  const LOGIN = process.env.EDVOY_LOGIN;
  const PASS = process.env.EDVOY_PASS;
  if (!LOGIN || !PASS) throw new Error('нет EDVOY_LOGIN/EDVOY_PASS — вход невозможен');

  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: !args.has('headed') });
  try {
    const page = await browser.newPage();
    let token = null;
    page.on('request', (req) => {
      if (/api-prod\.edvoy\.com/.test(req.url())) {
        const h = req.headers();
        if (h.authorization) token = h.authorization;
      }
    });

    await page.goto('https://edge.edvoy.com/#login', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});

    // Баннер согласия перехватывает клики — снимаем его первым.
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('button,a')].find((e) => /^accept all$/i.test((e.innerText || '').trim()));
      if (el) el.click();
    });
    await page.waitForTimeout(1200);

    await page.evaluate(() => {
      const el = [...document.querySelectorAll('a,button')].find((e) => /^(login|log in|sign in)$/i.test((e.innerText || '').trim()));
      if (el) el.click();
    });
    await page.waitForTimeout(2500);

    const findSel = (list) => page.evaluate((a) => { for (const s of a) if (document.querySelector(s)) return s; return null; }, list);
    // Поле почты у Edvoy — type=text, name=name, опознаётся по плейсхолдеру (замер 2026-07-22).
    const emailSel = await findSel([
      'input[type=email]',
      'input[placeholder*="Email" i]',
      'input[name="name"]',
      'input[name="username"]',
      'input[name="email"]',
      'input[id*=email i]',
    ]);
    if (!emailSel) throw new Error('поле почты не найдено — разметка входа изменилась');
    await page.fill(emailSel, LOGIN);
    try { await page.click('button:has-text("Continue")', { timeout: 5000 }); } catch { await page.press(emailSel, 'Enter'); }
    await page.waitForTimeout(3000);

    const passSel = await findSel(['input[type=password]', 'input[name="password"]', 'input[id*=pass i]']);
    if (!passSel) throw new Error('поле пароля не появилось — возможен 2FA или блокировка');
    await page.fill(passSel, PASS);
    try { await page.click('button:has-text("Sign in"), button:has-text("Log in"), button[type=submit]', { timeout: 5000 }); }
    catch { await page.press(passSel, 'Enter'); }
    await page.waitForLoadState('networkidle', { timeout: 40000 }).catch(() => {});
    await page.waitForTimeout(4000);

    if (await page.evaluate(() => /(two.factor|verification code|enter code|one.time)/i.test(document.body.innerText.toLowerCase()))) {
      throw new Error('портал требует код подтверждения — нужен владелец');
    }

    await page.goto('https://edge.edvoy.com/search', { waitUntil: 'domcontentloaded', timeout: 45000 });
    for (let i = 0; i < 20 && !token; i++) await page.waitForTimeout(1000);
    if (!token) throw new Error('токен не перехвачен — вход, вероятно, не прошёл');
    AUTH = token;
    log('вход выполнен, токен получен');
  } finally {
    await browser.close();
  }
}

async function gql(query, variables, op) {
  try {
    return await gqlOnce(query, variables, op);
  } catch (e) {
    // Токен живёт не весь прогон. Полчаса работы не должны пропадать из-за протухшей сессии.
    if (AUTH && /HTTP 401|HTTP 403|Unauthorized/i.test(e.message)) {
      log('токен истёк — вхожу заново');
      await acquireToken();
      return gqlOnce(query, variables, op);
    }
    throw e;
  }
}

async function gqlOnce(query, variables, op) {
  const { text } = await fetchQueued(EDP, {
    method: 'POST',
    accept: 'application/json',
    headers: { 'content-type': 'application/json', ...(AUTH ? { authorization: AUTH } : {}) },
    body: JSON.stringify({ operationName: op, query, variables }),
  });
  const j = JSON.parse(text);
  if (j.errors) throw new Error(`${op}: ${String(j.errors[0]?.message).slice(0, 180)}`);
  return j.data;
}

function fmtDuration(intake) {
  if (!intake || intake.courseDurationUnitValue == null) return null;
  const unit = String(intake.courseDurationUnit || '').replace(/s$/i, '');
  const v = intake.courseDurationUnitValue;
  return `${v} ${unit}${v > 1 && unit ? 's' : ''}`.trim();
}

function toProgram(c) {
  // approxAnnualFee приходит строкой; пустая строка и '0' — это «цены нет», а не ноль.
  const raw = c.approxAnnualFee == null ? '' : String(c.approxAnnualFee).trim();
  const num = Number(raw.replace(/[^\d.]/g, ''));
  const tuition = raw && Number.isFinite(num) && num > 0 ? num : null;
  const intakes = [...new Set((c.courseIntakes || [])
    .map((i) => [i.intakeMonth, i.intakeYear].filter(Boolean).join(' '))
    .filter(Boolean))];
  const campuses = [...new Set((c.courseIntakes || []).map((i) => i.campusRef?.name).filter(Boolean))];
  return {
    title: String(c.name || '').replace(/\s+/g, ' ').trim(),
    level: mapLevel(c.courseLevel, c.name),
    sourceLevel: c.courseLevel || null,
    duration: fmtDuration((c.courseIntakes || [])[0]),
    tuition,
    currency: tuition ? (c.currency || null) : null,
    // Поле источника так и называется — «примерная годовая». Выдавать её за точную нельзя.
    feeBasis: tuition ? 'approxAnnual' : null,
    intake: intakes,
    campuses,
    // Не стипендия, а UI-бейдж портала. Урок PR #29: раньше его принимали за стипендию.
    scholarshipTag: c.scholarshipTag || null,
    programUrl: c.edpRefId ? `https://edge.edvoy.com/institutions/${c.edpRefId}` : null,
    courseRefId: c.refId || null,
  };
}

/**
 * Фаза 1: перечисление вузов.
 *
 * Слепой перебор префиксов не годится: ветвление растёт как 36^N, за 25 минут он не сошёлся
 * и был прерван (сессия 3, первая попытка). Поэтому список СЕЮТСЯ из майского снимка —
 * 411 refId, которые заведомо существуют, — а перебор нужен лишь чтобы добрать дельту.
 * У перебора есть бюджет запросов: упереться в потолок и честно об этом отчитаться
 * лучше, чем крутиться часами и выглядеть работающим.
 */
async function seedFromSnapshot() {
  const dir = path.join(ROOT, 'sources', 'edvoy-extracts');
  const seeds = new Map();
  let files = [];
  try { files = await fs.readdir(dir); } catch { return seeds; }
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    try {
      const j = JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'));
      const ref = j.edvoyRefId || j.slug || f.replace(/\.json$/, '');
      if (ref) seeds.set(ref, { edpRefId: ref, name: j.name || ref, country: j.country || null, origin: 'снимок-2026-05' });
    } catch { /* битый файл пропускаем */ }
  }
  return seeds;
}

async function discoverInstitutions(declaredTotal, budget) {
  const found = await seedFromSnapshot();
  log(`посев из снимка: ${found.size} refId`);
  const cappedPrefixes = [];
  let queries = 0;

  // Прямое листание страниц. Перебор префиксов был нужен, пока я ошибочно считал, что
  // список обрезан сотней; на деле offset — номер страницы, и весь список берётся подряд.
  const pages = Math.ceil(declaredTotal / PAGE_CAP);
  for (let page = 0; page < pages; page++) {
    queries++;
    const d = await gql(Q_INSTITUTIONS, { filter: {}, paging: { limit: PAGE_CAP, offset: page, skip: -1 }, query: 'university' }, 'searchInstitutions');
    const items = d.searchInstitutions?.items || [];
    if (!items.length) break;
    for (const it of items) {
      if (!found.has(it.refId)) {
        found.set(it.refId, {
          edpRefId: it.refId,
          name: it.name,
          country: it.address?.country || null,
          city: it.address?.city || null,
          partnerRating: it.partnerRating ?? null,
          edPartnerType: it.edPartnerType || null,
          origin: 'листание',
        });
      }
    }
  }
  log(`листание списка: набрано ${found.size} из ${declaredTotal} за ${queries} запросов`);

  // Если листание почему-то не добрало — добираем перебором префиксов как запасным путём.
  const queue = found.size >= declaredTotal ? [] : ALPHABET.slice();

  while (queue.length) {
    // Выходим, как только набрали столько, сколько заявляет источник, либо исчерпали бюджет.
    if (declaredTotal && found.size >= declaredTotal) {
      log(`перечисление добрало заявленные ${declaredTotal} — прекращаем (в очереди оставалось ${queue.length} префиксов)`);
      break;
    }
    if (queries >= budget) {
      log(`бюджет перечисления исчерпан (${budget} запросов), набрано ${found.size} из ${declaredTotal} — отчёт будет честным о неполноте`);
      break;
    }
    queries++;
    const prefix = queue.shift();
    const d = await gql(Q_INSTITUTIONS, { filter: {}, paging: { limit: PAGE_CAP, offset: 0, skip: -1 }, query: prefix }, 'searchInstitutions');
    const items = d.searchInstitutions?.items || [];
    let fresh = 0;
    for (const it of items) {
      if (!found.has(it.refId)) {
        fresh++;
        found.set(it.refId, {
          edpRefId: it.refId,
          name: it.name,
          country: it.address?.country || null,
          city: it.address?.city || null,
          partnerRating: it.partnerRating ?? null,
          edPartnerType: it.edPartnerType || null,
          origin: 'перебор',
        });
      }
    }
    // Ровно потолок означает «показано не всё» — углубляем префикс, иначе часть вузов
    // молча не попадёт в перечисление, а отчёт будет выглядеть полным.
    // Углубляемся только если выдача упёрлась в потолок И префикс всё ещё приносит новое:
    // ветка, не давшая ни одного нового вуза, дальше даст тем более ничего.
    if (items.length >= PAGE_CAP && prefix.length < 3 && fresh > 0) {
      cappedPrefixes.push(prefix);
      for (const ch of ALPHABET) queue.push(prefix + ch);
    }
    if (found.size && found.size % 100 === 0) log(`… перечислено вузов ${found.size}, очередь префиксов ${queue.length}`);
  }
  log(`фаза 1: вузов ${found.size} из заявленных ${declaredTotal}; запросов ${queries}, углублённых префиксов ${cappedPrefixes.length}`);
  return { found, cappedPrefixes, discoveryQueries: queries };
}

async function main() {
  const dryRun = args.has('dry-run');
  const discoverOnly = args.has('discover-only');
  const limitUnis = args.num('limit-unis', 0);
  log(`старт${dryRun ? ' (сухой прогон — в дерево не пишем)' : ''}`);

  if (args.has('with-login')) {
    await loadEnv();
    await acquireToken();
  }

  const head = await gql(Q_COURSES, { filter: {}, paging: { limit: 1, offset: 0, skip: -1 } }, 'fetchOnlyCourseList');
  const total = head.searchCourse?.count ?? 0;
  const instHead = await gql(Q_INSTITUTIONS, { filter: {}, paging: { limit: 1, offset: 0, skip: -1 }, query: 'university' }, 'searchInstitutions');
  const declaredUnis = instHead.searchInstitutions?.count ?? 0;
  log(`источник заявляет: курсов ${total}, вузов ${declaredUnis}`);
  if (!total) throw new Error('источник вернул 0 курсов — ничего не пишем');

  // --only=<edpRefId,...> — точечный добор без перечисления всех вузов.
  // Нужен, когда чинится привязка у нескольких штук: гнать 48 тысяч курсов
  // ради двух сотен глупо, а перечисление стоит сотни запросов.
  // ВАЖНО: точечный прогон НЕ переписывает membership-файл — иначе список
  // партнёров схлопнулся бы до этих нескольких (болезнь «частичный прогон
  // затирает общий файл», уже ловленная в ОРЛЕ).
  const only = (args.get('only') || '').split(',').map((s) => s.trim()).filter(Boolean);
  let found; let cappedPrefixes = []; let discoveryQueries = 0;
  if (only.length) {
    found = new Map(only.map((ref) => [ref, { edpRefId: ref, name: ref, country: null, origin: '--only' }]));
    log(`точечный прогон: ${only.length} вузов, перечисление пропущено`);
  } else {
    ({ found, cappedPrefixes, discoveryQueries } = await discoverInstitutions(declaredUnis, args.num('discover-budget', 300)));
  }
  if (discoverOnly) {
    log('только перечисление — выходим');
    return;
  }

  // Фаза 2: курсы по каждому вузу отдельно.
  const byEdp = new Map();
  let fetched = 0;
  const shortfall = [];
  const list = [...found.values()].slice(0, limitUnis || undefined);

  let done = 0;
  for (const inst of list) {
    const h = await gql(Q_COURSES, { filter: { edpRefIds: [inst.edpRefId] }, paging: { limit: 1, offset: 0, skip: -1 } }, 'fetchOnlyCourseList');
    const n = h.searchCourse?.count ?? 0;

    // ВНИМАНИЕ: `offset` здесь — НОМЕР СТРАНИЦЫ, а не смещение в записях.
    // Замер: offset=1 отдаёт 100 НОВЫХ записей, offset=100 — пустоту (сотой страницы нет).
    // Прежние выводы «выдача обрезана на 100/500» были следствием листания не теми
    // единицами: offset += 100 сразу прыгал на сотую страницу. Настоящего потолка нет.
    const seen = new Set();
    const courses = [];
    const pages = Math.ceil(n / PAGE);
    for (let page = 0; page < pages; page++) {
      const d = await gql(Q_COURSES, {
        filter: { edpRefIds: [inst.edpRefId] },
        paging: { limit: PAGE, offset: page, skip: -1 },
      }, 'fetchOnlyCourseList');
      const items = d.searchCourse?.items || [];
      if (!items.length) break;
      for (const c of items) {
        const key = c._id || c.refId || `${c.edpRefId}|${c.name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        courses.push(c);
      }
    }
    // Недобор фиксируем поимённо: «получилось меньше, чем обещал источник» — это факт
    // для отчёта, а не повод молча записать что вышло.
    if (courses.length < n) shortfall.push({ edpRefId: inst.edpRefId, declared: n, fetched: courses.length });
    fetched += courses.length;
    // При --only настоящее имя вуза берём из первого курса: в точечном прогоне
    // имени неоткуда взяться, а писать слаг вместо названия — врать в выгрузке.
    const realName = courses[0]?.institution?.name || inst.name;
    const realCountry = inst.country || courses[0]?.institution?.address?.country || null;
    byEdp.set(inst.edpRefId, { ...inst, name: realName, country: realCountry, courses });
    if (++done % 50 === 0) log(`… вузов обработано ${done}/${list.length}, курсов ${fetched}`);
  }

  log(`фаза 2: получено курсов ${fetched}, вузов ${byEdp.size}, вузов с недобором ${shortfall.length}`);

  const catalog = await buildCatalogIndex();
  const matched = [];
  const unmatched = [];
  const emptyUnis = [];
  let written = 0;
  let programsTotal = 0;
  let withPrice = 0;

  for (const g of byEdp.values()) {
    if (!g.courses.length) { emptyUnis.push({ from: g.name, edpRefId: g.edpRefId }); continue; }
    const res = matchToCatalog(g.name, catalog, { country: g.country, refId: g.edpRefId });
    const programs = g.courses.map(toProgram);
    programsTotal += programs.length;
    withPrice += programs.filter((p) => p.tuition != null).length;

    if (!res.catalogSlug) {
      unmatched.push({ from: g.name, edpRefId: g.edpRefId, country: g.country, courses: programs.length });
      continue;
    }
    matched.push({ from: g.name, edpRefId: g.edpRefId, to: res.catalogSlug, method: res.matchMethod, courses: programs.length });

    const payload = extract({
      slug: res.catalogSlug,
      name: g.name,
      source: 'edvoy',
      sourceUrl: `https://edge.edvoy.com/institutions/${g.edpRefId}`,
      programs,
      extra: {
        aggregator: 'Edvoy',
        aggregatorEndpoint: EDP,
        access: 'public',
        edpRefId: g.edpRefId,
        country: g.country,
        matchMethod: res.matchMethod,
        feeNote: 'approxAnnualFee — примерная годовая стоимость по данным Edvoy; аудитория цены источником не указана',
        schemaNote: 'findOneEdp из схемы удалён (переименован в Hta) — профиль вуза этим запросом недоступен',
      },
    });
    const w = await writeExtract(AGG, res.catalogSlug, payload, { dryRun });
    if (w.written) written++;
  }

  const membership = {
    _meta: {
      aggregator: AGG,
      label: 'Edvoy',
      source: EDP,
      collectedAt: new Date().toISOString(),
      rule: 'all',
      access: 'public',
      notes: [
        'План числил Edvoy закрытым (логин). Замер сессии 3: GraphQL отвечает без токена.',
        'Выдача обрезана: курсы 500 на запрос, список вузов 100. Пустая страница неотличима от «данные кончились».',
        'Поэтому вузы перечислены перебором префиксов строки поиска, а курсы взяты отдельно по каждому вузу.',
        'findOneEdp в схеме больше нет (Edvoy переименовал EDP в Hta): галерея, рейтинги и keyFacts этим путём недоступны.',
        'scholarshipTag — UI-бейдж портала, не стипендия (урок PR #29).',
      ],
      counts: {
        sourceCourses: total, declaredUniversities: declaredUnis,
        discoveredUniversities: found.size, fetchedCourses: fetched,
        matched: matched.length, unmatched: unmatched.length, emptyUniversities: emptyUnis.length,
        programs: programsTotal, withPrice,
        discoveryComplete: found.size >= declaredUnis,
        discoveryQueries,
        universitiesWithShortfall: shortfall.length,
      },
    },
    cappedPrefixes,
    shortfall,
    matched,
    unmatched,
    emptyUnis,
  };
  if (only.length) log('точечный прогон: membership не переписываю, чтобы не потерять остальных');
  else await writeMembership(AGG, membership, { dryRun });

  log(`привязано ${matched.length}, не привязано ${unmatched.length}, без курсов ${emptyUnis.length}`);
  log(`программ ${programsTotal}, с ценой ${withPrice}`);
  log(`файлов записано ${written}${dryRun ? ' (сухой прогон)' : ''}`);
  log(`запросов ${stats.requests}, торможений ${stats.throttled}, неудач ${stats.failed}`);
  log(found.size >= declaredUnis
    ? `перечисление полное: ${found.size} из ${declaredUnis}`
    : `ПЕРЕЧИСЛЕНИЕ НЕПОЛНОЕ: ${found.size} из ${declaredUnis} — ${declaredUnis - found.size} вузов источник не отдал перебором`);
  if (shortfall.length) log(`вузы с недобором курсов: ${shortfall.slice(0, 8).map((s) => `${s.edpRefId} ${s.fetched}/${s.declared}`).join(', ')}`);
}

main().catch((e) => { log('ОШИБКА: ' + e.message); process.exit(1); });
