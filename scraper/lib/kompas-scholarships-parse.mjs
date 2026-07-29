// kompas-scholarships-parse.mjs — разбор страниц стипендий с офсайтов вузов.
//
// Вынесено из kompas-collect-scholarships.mjs: скрипт запускает main() при импорте,
// и покрыть его разборщики тестами было нельзя. Ошибки здесь стоят дорого — каждая
// уходит прямо в карточку вуза как «проверенная офсайтом» сумма, — поэтому правила
// ниже описаны вместе с тем, на какой странице каждое из них было куплено.
// Тесты: kompas-scholarships-parse.test.mjs.

import { decodeEntities, parseMoney } from './kompas-collect.mjs';

// Слова, по которым узнаётся страница о финансировании. Держим узко: «award» и «support»
// без этих слов дают полсайта (награды сотрудникам, поддержка ИТ).
export const PAGE_HINT = /scholarship|bursar|financial[- ]aid|fees?[- ]and[- ]funding|funding|grants?\b|stipend/i;
// Название стипендии. Обязательное условие — сама стипендия названа: заголовок вроде
// «How to apply» стипендией не является, сколько бы фунтов ни стояло рядом.
export const NAME_HINT = /scholarship|bursary|bursaries|award|grant|fellowship|discount|waiver/i;
// Явные формулировки полного покрытия: сумма не названа, но она известна и проверяема.
export const FULL_HINT = /\bfull[- ](tuition|fee|funding|scholarship)\b|\b100%\s*(of\s*)?(tuition|fees?)\b|\bfull[- ]ride\b/i;
// Заголовки РАЗДЕЛА, а не стипендии: «Scholarships and Bursaries» — это название страницы
// Abertay, под которым лежат 39 настоящих стипендий. Записать его самой стипендией значит
// завести в каталоге пустышку — ровно то, чем сейчас забиты 1234 записи.
export const SECTION_TITLE = /^(our |available |international |student |uk |eu )?(scholarships?|bursaries|bursary|awards?|grants?|funding|financing|financial aid)( (and|&) (scholarships?|bursaries|awards?|grants?|funding|financing|discounts))?( for .*)?$/i;
// Заголовки-инструкции: «How do I apply for the scholarship?», «Advice on Applying for
// Scholarships» — это разделы справки, а не стипендии. Поймано на Bangor: из 19 записей
// пилота четыре были такими.
export const NOT_A_NAME = /^(how|what|when|where|who|why|do i|can i|advice|guidance|information|help|faqs?|applying|apply|eligibility|terms|contact|this|these|other|more|all|maintaining|managing|understanding|about)\b|\?$|\bnot available\b/i;

// --- правила, добавленные после просмотра выборки origin:'hub-headings' 2026-07-26 ---
// Заголовки страницы-раздела грязнее отдельных страниц: из 1223 записей 163 вузов
// 97 (8%) оказались не стипендиями. Каждое правило ниже закрывает свой разряд брака,
// найденный глазами.

// Предложение вместо названия: «We offer scholarships», «If you have questions about the
// … program, contact» (ashland). Точка посреди строки — тоже признак текста, а не имени.
export const SENTENCE_LIKE = /\b(if you|please|contact us|we offer|we provide|you can|you will|you may|is given|makes a|are eligible|to access|click here|find out|learn more)\b/i;
// Обрывок абзаца: настоящее название стипендии со строчной буквы не начинается.
// «average financial assistance award of $8,092» (carmel-catholic), «not included in the
// tuition discount» (california-miramar), «to access the Scholarship Directive.» (ac-badem).
export const LOWERCASE_START = /^[a-zа-яё]/;
// Точка посреди строки — признак предложения, но НЕ в сокращениях: «Dr. Leonard Reeves
// Entrance Award», «Mr. and Mrs. Richard G. Balelo Sr. Memorial Scholarship» — настоящие
// именные стипендии, и грубое правило «[a-z]. [A-Z]» их выбрасывало (поймано проверкой
// ужесточения на всём собранном корпусе, до применения).
const ABBREV = /^(dr|mr|mrs|ms|miss|prof|st|jr|sr|rev|hon|inc|ltd|co|no|vs|etc|[a-z])$/i;
export function looksLikeSentence(name) {
  for (const m of String(name).matchAll(/([A-Za-z]+)\.\s+[A-Z]/g)) {
    if (!ABBREV.test(m[1])) return true;
  }
  return false;
}
// Обобщённый раздел: «External Scholarships», «UNDERGRADUATE SCHOLARSHIPS»,
// «HIGH SCHOOL SCHOLARSHIPS», «Student Loans and Grants», «Progression Scholarships».
export const GENERIC_SECTION = /^(internal|external|undergraduate|postgraduate|graduate|progression|high school|student|other|further|more)\s+(scholarships?|bursaries|grants?|awards?|loans?)( (and|&) (scholarships?|bursaries|grants?|awards?|loans?))?$/i;
// Раздел перечислением через запятую — SECTION_TITLE ловит только «X and Y»:
// «Scholarships, Grants, & Loans», «University scholarships, bursaries and discounts».
export const LISTED_SECTION = /^[\w\s'’-]*scholarships?,\s.*\b(bursar|grant|award|loan|discount)/i;
// Заголовок страницы: «Scholarships available», «Scholarships explained»,
// «Scholarships at Stover», «Scholarships that support your journey».
export const SCHOLARSHIPS_PAGE = /^scholarships?\s+(at|for|in|on|explained|that|awarded|available|overview)\b/i;
// Подписи полей на странице раздела: «Scope of scholarship», «Duration of scholarship»,
// «Scholarship decisions», «Statement of Scholarship». Слово «scholarship» в них есть,
// стипендии за ними — нет. Поймано на Aalto и Adelphi в пилоте 25 вузов.
export const FIELD_LABEL = /^(scope|duration|decision|statement|value|amount|type|types|criteria|deadline|deadlines|payment|status|number|overview|summary|details?|submit|download|fall|spring|winter|summer)\b|\b(of|for) scholarships?$|^scholarship (decisions?|process|types?|values?|amounts?|conditions?)\b|frequently asked/i;

export const clean = (s) => decodeEntities(String(s ?? '')).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

export const MONEY_RE = /(?:£|€|A\$|C\$|NZ\$|\$|\b(?:GBP|USD|EUR|AUD|CAD|NZD|SGD|AED|CHF)\b)\s?[\d][\d,.\s]{2,}/g;
// Сумма рядом с этими словами — НЕ размер стипендии. Поймано на Bangor: страница
// «Bangor Bursaries» начинается таблицей «Taxable Household Income | Award», где первое
// число — £25,000 порога дохода, а сама стипендия £1,000. Правило «первая сумма на
// странице» записало бы в каталог порог как размер выплаты.
export const MONEY_TRAP = /household income|taxable|income of|earnings|salary|threshold|or less|or below|less than|income below|tuition fees? (are|of|from)|cost of living|deposit/i;
// …а рядом с этими — да. Требуем явную подпись: «нет подписи — нет цены» (правило сбора
// цен сессии 3.5, здесь оно ровно так же уместно).
export const MONEY_LABEL = /award|worth|value|bursary of|scholarship of|receive|discount|reduction|up to|covers?|payment|towards|per year|per annum|a year/i;

/**
 * Сумма стипендии вместе с оговорками, а не голое число.
 *
 * На странице Abertay IB30+ стоят и «up to £28,000» (за четыре года), и «£7,000 per year».
 * Обе цифры верные, но «GBP 28,000» без «до» и без срока читается как годовая выплата —
 * это враньё на карточке. Поэтому «up to» слева и «per year» справа переносим в строку.
 */
export function amountFrom(text) {
  const fallback = () => (FULL_HINT.test(text.slice(0, 2000)) ? 'full tuition' : null);
  for (const m of text.matchAll(MONEY_RE)) {
    const p = parseMoney(m[0]);
    if (!p || !p.currency) continue;
    const before = text.slice(Math.max(0, m.index - 70), m.index);
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 70);
    if (MONEY_TRAP.test(before) || MONEY_TRAP.test(after)) continue;
    if (!MONEY_LABEL.test(before) && !MONEY_LABEL.test(after)) continue;
    // «maximum award is $1,000» и «maximum value of £5,000» — та же оговорка «до», что
    // и «up to», но прежняя формулировка правила её не видела: у Herzing выплата
    // «до $1,000» уезжала в карточку как ровно $1,000 (найдено просмотром hub-headings).
    const upTo = /\b(up to|as much as|maximum(\s+\w+){0,2}\s+(of|is|:)?)\b[^.]*$/i.test(before);
    const perYear = /^\s*(per|a|each|\/)\s*(year|annum|session)|^\s*(annually|per annum)/i.test(after);
    // Помесячная выплата без пометки читается как весь размер стипендии: у Herzing
    // «$60 per month за программу» стояло в выгрузке просто «USD 60».
    const perMonth = /^\s*(per|a|each|\/)\s*month|^\s*monthly/i.test(after);
    const period = perYear ? '/год' : (perMonth ? '/мес' : '');
    return `${upTo ? 'до ' : ''}${p.currency} ${p.amount.toLocaleString('en-US')}${period}`;
  }
  return fallback();
}

/**
 * Название стипендии из сырого заголовка — или null, если это не стипендия.
 *
 * Один фильтр на оба ведра (отдельные страницы и заголовки раздела): раздельные копии
 * разъехались бы, а мусор попадает в оба.
 */
export function acceptName(raw) {
  // Вертикальная черта склеивает имя с описанием: «Merit-Based International Scholarship
  // | Up to 30% tuition reduction» (gbsb-global). Берём часть до неё — сумма и так
  // разбирается отдельно, а в названии она превращает одну стипендию в две разных.
  let name = String(raw ?? '').split('|')[0];
  // Хвостовая точка и двоеточие — от вёрстки, не от названия: «Early Bird Discount.»
  name = name.replace(/[:.\s]+$/, '').trim();
  if (!name) return null;
  if (name.length > 100) return null;          // заголовок новости, а не название стипендии
  if (SECTION_TITLE.test(name) || NOT_A_NAME.test(name) || FIELD_LABEL.test(name)) return null;
  if (LOWERCASE_START.test(name) || SENTENCE_LIKE.test(name) || looksLikeSentence(name)) return null;
  if (GENERIC_SECTION.test(name) || LISTED_SECTION.test(name) || SCHOLARSHIPS_PAGE.test(name)) return null;
  return name;
}

/** Хост без www — чтобы «сам сайт вуза» не разъезжался на www/не-www. */
export const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return null; } };
export const sameSite = (u, base) => {
  const a = host(u); const b = host(base);
  if (!a || !b) return false;
  return a === b || a.endsWith('.' + b) || b.endsWith('.' + a);
};

/**
 * Адреса страницы. Берём АТРИБУТ href, а не пару <a>…</a>: разбор парой терял две трети
 * ссылок (на главной Abertay — 65 из 192), потому что во вложенной разметке меню текст
 * ссылки длиннее любого разумного предела, и нужная
 * `/study-apply/money-fees-and-funding/scholarships/` просто не находилась.
 */
export function links(html, baseUrl) {
  const out = []; const seen = new Set();
  for (const m of html.matchAll(/\bhref=["']([^"'#\s]+)["']/gi)) {
    let href;
    try { href = new URL(decodeEntities(m[1]), baseUrl).toString(); } catch { continue; }
    if (!/^https?:/i.test(href)) continue;
    if (/\.(png|jpe?g|gif|svg|ico|css|js|woff2?|ttf|pdf|zip|xml)(\?|$)/i.test(href)) continue;
    href = href.split('#')[0];
    if (seen.has(href)) continue;
    seen.add(href);
    out.push({ href, text: '' });
  }
  return out;
}

/**
 * Кандидаты в стипендии со страницы.
 *
 * Разбираем по ЗАГОЛОВКАМ (h2–h4, а также ячейки-ссылки списков): у страниц о
 * финансировании это единственная общая структура. Сумму ищем в тексте ДО следующего
 * заголовка — так «£4,000» из соседней стипендии не приклеится к предыдущей.
 */
export function parseScholarships(html, pageUrl) {
  const blocks = [];
  const re = /<(h2|h3|h4|dt|strong)\b[^>]*>([\s\S]{0,300}?)<\/\1>/gi;
  let prev = null;
  for (const m of html.matchAll(re)) {
    const title = clean(m[2]);
    if (prev) prev.body = html.slice(prev.end, m.index);
    if (title.length >= 6 && title.length <= 140 && NAME_HINT.test(title)) {
      prev = { title, end: m.index + m[0].length, body: '' };
      blocks.push(prev);
    } else {
      prev = null;
    }
  }
  if (prev) prev.body = html.slice(prev.end, prev.end + 4000);

  const seen = new Set();
  const out = [];
  for (const b of blocks) {
    const key = b.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const text = clean(b.body).slice(0, 600);
    // Сумма — только явная. parseMoney без валюты вернёт {currency:null}: такое не
    // берём, «5,000» без знака валюты может быть числом студентов.
    const amount = amountFrom(text);
    out.push({
      name: b.title,
      ...(amount ? { amount } : {}),
      ...(text ? { description: text.slice(0, 300) } : {}),
      url: pageUrl,
      source: 'official-site',
      verifiedBySite: true,
    });
  }
  return out;
}

/**
 * Адреса ОТДЕЛЬНЫХ страниц стипендий, найденные на странице-разделе.
 *
 * У Abertay раздел «Scholarships and Bursaries» не перечисляет стипендии текстом: это
 * поисковая выдача (39 штук), где каждая ссылка ведёт через редирект search.abertay.ac.uk
 * с настоящим адресом в параметре `url=`. Заголовков стипендий на самой странице нет
 * вовсе — разбор по h2/h3 честно возвращал одну запись «Scholarships and Bursaries».
 * Поэтому: разворачиваем редиректы с `url=` и берём ссылки, которые ведут ВГЛУБЬ раздела.
 */
export function detailUrls(html, base, hubUrl) {
  const hubDepth = (() => { try { return new URL(hubUrl).pathname.split('/').filter(Boolean).length; } catch { return 0; } })();
  const out = new Set();
  for (const l of links(html, base)) {
    let u = l.href;
    try {
      const inner = new URL(u).searchParams.get('url');
      if (inner && sameSite(inner, base)) u = inner.split('#')[0];
    } catch { /* адрес не разобрался — берём как есть */ }
    if (!sameSite(u, base)) continue;
    let p;
    try { p = new URL(u); } catch { continue; }
    if (p.search) continue;                       // ?pageNumber=2 — та же страница-раздел
    const segs = p.pathname.split('/').filter(Boolean);
    if (segs.length <= hubDepth) continue;        // не глубже раздела — это не карточка стипендии
    if (!NAME_HINT.test(segs[segs.length - 1])) continue;
    out.add(p.toString());
  }
  return [...out];
}

/** Название и сумма с ОТДЕЛЬНОЙ страницы стипендии: имя — из h1, сумма — из текста. */
export function parseDetail(html, url) {
  const h1 = html.match(/<h1\b[^>]*>([\s\S]{0,300}?)<\/h1>/i);
  const name = clean(h1?.[1] ?? '');
  if (!name || name.length < 6 || name.length > 140) return null;
  if (!NAME_HINT.test(name)) return null;
  const body = clean(html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' '));
  const amount = amountFrom(body);
  return {
    name,
    ...(amount ? { amount } : {}),
    url,
    source: 'official-site',
    verifiedBySite: true,
  };
}
