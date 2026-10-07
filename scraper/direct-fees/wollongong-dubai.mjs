// wollongong-dubai.mjs — University of Wollongong in Dubai, uowdubai.ac.ae
//
// Разведка 29.09.2026.
// - Плоский curl 403 отдавал только голый `curl` без заголовков/UA — сайт за WAF
//   (похоже на Cloudflare/подобное), но с полным браузерным UA + Accept-Language
//   (ровно то, что уже шлёт `get()` из _lib.mjs) отвечает 200 без проблем. getBrowser
//   не понадобился — заявленный в задаче блок был вызван слабым UA, не JS-рендером.
// - Полный список программ живёт не на страницах-каталогах по уровням, а в мега-меню
//   сайта (оно одинаковое на любой странице): /degrees/bachelors, /degrees/masters,
//   /degrees/doctorate — у каждой «листовой» ссылки 4 сегмента пути
//   (/degrees/<уровень>/<факультет>/<slug>), у страниц-хабов факультетов — 3
//   (/degrees/bachelors/business-commerce) — их отбрасываем.
// - Отдельно, вне меню (не хаб, не листовая ссылка по этому правилу, но реальная
//   страница программы): /degrees/international-foundation-year (foundation),
//   /study-english (English language — «Global English Skills Program»,
//   ссылка на неё только со страницы /training/languages, не из меню),
//   4 Graduate Certificate под /training/short-courses/postgraduate-certificates/*
//   (short-course), /training/short-courses/certificate-proficiency (short-course).
//   /training/short-courses/executive-learning — список отдельных корпоративных
//   курсов без своих страниц и цен, это модули, не программы — в gaps.
//   /training/languages/private-tutoring — услуга, не программа — в gaps.
//   Graduate Diploma in Applied Artificial Intelligence / in Educational Studies —
//   диплом вне схемы уровней (foundation/bachelor/master/phd/english-language/
//   short-course) — в gaps, программу не отдаём (решение владельца).
// - Цены — на двух общих страницах-аккордеонах: /join-uowd/fees/bachelors-degree и
//   /join-uowd/fees/masters-degree. Каждая карточка аккордеона — одна степень/группа
//   мажоров, внутри — HTML-таблица(ы) с rowspan: одна цена в ячейке-«шапке» rowspan
//   часто относится сразу к НЕСКОЛЬКИМ строкам (вариантам длительности и/или мажорам
//   одной группы — проверено на Bachelor of Business: rowspan=14 на одну ячейку
//   покрывает все 7 мажоров группы, у всех одна и та же годовая цена). Поэтому вместо
//   построчного regex по <tr> — честная реконструкция грида таблицы с учётом rowspan/
//   colspan (tableGrid ниже), иначе большинство мажоров молча теряют цену.
// - Колонка с ценой называется по-разному и это same-page сигнал basis:
//   «Yearly Fees» → year (бакалавриат), «Total Fees» → program (PhD, Global Master
//   Luxury Management, Foundation Year, отдельная PhD-страница), «Subject Fees» →
//   большинство магистратур и все Graduate Certificate — это цена за ОДИН предмет,
//   не за год и не за программу целиком, в каталог не едет (basis: 'other'), но
//   отдаём в fees для отчёта — эти строки README прямо разрешает копить не применяя.
// - PhD в таблице аккордеона masters-degree даёт цифру БЕЗ кода валюты в самой ячейке
//   («248,062.50 / USD 67,592», rowspan съедает и «AED»... на самом деле там его и не
//   было — ячейка так и оформлена без AED). Сумма обязана читаться в raw буквально, а
//   тут только «USD» рядом с числом без ISO-кода перед основной суммой — поэтому PhD
//   и Foundation Year берём с их СОБСТВЕННЫХ страниц (/degrees/doctorate/business/
//   doctor-philosophy, /degrees/international-foundation-year), где ровно то же число
//   стоит с явным «AED» в тексте («Total Fees: AED 248,062.50 / USD 67,592»).
// - Четыре магистратуры есть только на странице цен (аккордеон), но НЕ в меню и не по
//   предсказуемым URL: /degrees/masters/business/master-management,
//   master-financial-management, global-master-luxury-management — все три отвечают
//   200, но отдают чужой контент (H1 «Business & Commerce» или вовсе H1 программы
//   Applied Finance (Investing) — мягкий 404 без кода 404, у сайта нет для них
//   отдельной страницы). Master of International Relations — то же самое, страницы
//   нет вовсе. Все четыре — Master of Management, Master of Financial Management,
//   Global Master Luxury Management, Master of International Relations — отдаём как
//   программы без programUrl (url — страница цен), название ровно как в аккордеоне.
// - Мажоры в таблицах названы короче, чем на отдельных страницах программ из меню
//   (сайт сам себе противоречит): «HR Management» в таблице vs «Human Resource
//   Management» на странице и в её заголовке меню — увязываем через маленький алиас
//   (см. MAJOR_ALIAS). «Civil»/«Mechanical»/... в таблице Bachelor of Engineering
//   vs «... (Honours) - Civil Engineering» в меню — увязываем частичным совпадением
//   внутри факультета (инженерия), не глобально, иначе «Marketing» из Business
//   ложно матчится на «Marketing Communication and Advertising» из Media.
//   Что не удалось увязать — программа всё равно попадает в список под своим именем
//   из таблицы цен, но без programUrl.
// - Не цена обучения: скидка «10,000 AED discount available» на странице Foundation
//   Year — не берём, берём полную AED 60,000. VAT 5% уже включён в показанные суммы
//   (в самой подписи), это не отдельный сбор, а часть цены — берём как есть.

import { get, text, sleep } from './_lib.mjs';

const BASE = 'https://www.uowdubai.ac.ae';

const norm = (s) => String(s || '').toLowerCase().replace(/&amp;/gi, 'and')
  .replace(/[’'`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

// Сайт сам путается в написании некоторых мажоров между таблицей цен и заголовками
// страниц/меню — без этого «HR Management» из таблицы никогда не найдёт
// «Human Resource Management» в меню.
const aliasNeedle = (s) => norm(s).replace(/\bhr\b/g, 'human resource');

// Известные опечатки/расхождения самого сайта между заголовком аккордеона цен и
// реальным названием программы в меню — увязываем вручную, иначе прямое совпадение
// не найдётся (например «Master of Human Resourse Management» — опечатка сайта).
const CARD_TITLE_ALIAS = {
  'master of human resourse management': 'master of human resource management',
};

function suffixInParens(title) {
  const m = String(title).match(/\(([^()]+)\)\s*$/);
  return m ? norm(m[1]) : null;
}

/** Прямое совпадение заголовка карточки цены с программой из меню (без мажора). */
function findDirect(navPrograms, cardTitle, level) {
  const needle = CARD_TITLE_ALIAS[norm(cardTitle)] || norm(cardTitle);
  const pool = navPrograms.filter((p) => p.level === level);
  const exact = pool.find((p) => norm(p.title) === needle);
  if (exact) return exact;
  const hits = pool.filter((p) => norm(p.title).includes(needle) || needle.includes(norm(p.title)));
  return hits.length === 1 ? hits[0] : null;
}

/** Совпадение мажора (короткое имя из таблицы цен) с программой из меню. */
function findByMajor(navPrograms, major, segment, level) {
  const needle = aliasNeedle(major);
  let pool = navPrograms.filter((p) => p.level === level);
  if (segment) pool = pool.filter((p) => p.url && p.url.includes(`/${segment}/`));
  const bySuffix = pool.find((p) => suffixInParens(p.title) === needle);
  if (bySuffix) return bySuffix;
  const hits = pool.filter((p) => norm(p.title).includes(needle));
  return hits.length === 1 ? hits[0] : null;
}

// Факультетский сегмент URL — только для карточек аккордеона, где один и тот же
// короткий мажор («Marketing», «Management») встречается в НЕСКОЛЬКИХ факультетах
// разом и без сужения пула даёт неоднозначное совпадение.
const SEGMENT_BY_CARD = {
  'Bachelor of Business': 'business',
  'Bachelor of Computer Science': 'computer-science',
  'Bachelor of Engineering (Honours)': 'engineering',
  'Bachelor of Communication and Media': 'media',
  'Bachelor of Psychological Science': 'social-science',
};

// Реконструкция HTML-таблицы в грид с учётом rowspan/colspan — иначе большинство
// строк, у которых ячейка мажора/цены «съедена» rowspan соседней строки, останутся
// без данных вовсе.
function tableGrid(tableHtml) {
  const theadM = tableHtml.match(/<thead[\s\S]*?<\/thead>/i);
  const headHtml = theadM ? theadM[0] : '';
  const bodyHtml = theadM ? tableHtml.slice(theadM.index + theadM[0].length) : tableHtml;
  const headers = [...headHtml.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((m) => text(m[1]));
  const trs = [...bodyHtml.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].map((m) => m[0]);
  const pending = [];
  const rows = [];
  for (const tr of trs) {
    const cells = [...tr.matchAll(/<t[dh]\b([^>]*)>([\s\S]*?)<\/t[dh]>/gi)].map((m) => ({
      value: text(m[2]),
      rowspan: Number((m[1].match(/rowspan\s*=\s*"?(\d+)"?/i) || [])[1] || 1),
      colspan: Number((m[1].match(/colspan\s*=\s*"?(\d+)"?/i) || [])[1] || 1),
    }));
    const row = [];
    let ri = 0; let col = 0;
    while (col < headers.length) {
      if (pending[col] && pending[col].remaining > 0) {
        row[col] = pending[col].value; pending[col].remaining -= 1; col += 1; continue;
      }
      const cell = cells[ri]; ri += 1;
      if (!cell) break;
      for (let c = 0; c < cell.colspan; c += 1) {
        row[col + c] = cell.value;
        if (cell.rowspan > 1) pending[col + c] = { value: cell.value, remaining: cell.rowspan - 1 };
      }
      col += cell.colspan;
    }
    rows.push(row);
  }
  return { headers, rows };
}

const feeAmount = (cellText) => {
  const m = String(cellText || '').match(/AED\s*([\d,]+(?:\.\d+)?)/);
  return m ? Number(m[1].replace(/,/g, '')) : null;
};

/** Карточки аккордеона страницы цен: [{ title, html }]. */
function accordionCards(html) {
  const start = html.indexOf('<div class="tab-content');
  if (start === -1) return [];
  const parts = html.slice(start).split('<div class="card">').slice(1);
  const cards = [];
  for (const p of parts) {
    const m = p.match(/<a[^>]*>([\s\S]*?)<i class="fas fa-plus"/);
    if (!m) continue;
    cards.push({ title: text(m[1]), html: p });
  }
  return cards;
}

/** Таблицы карточки с их подписью (последний <p> перед таблицей, если есть). */
function tablesWithLabels(cardHtml) {
  const out = [];
  const re = /<table[\s\S]*?<\/table>/g;
  let m; let lastEnd = 0;
  while ((m = re.exec(cardHtml))) {
    const between = cardHtml.slice(lastEnd, m.index);
    const ps = [...between.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];
    out.push({ subLabel: ps.length ? text(ps[ps.length - 1][1]) : null, html: m[0] });
    lastEnd = m.index + m[0].length;
  }
  return out;
}

/** Полный список программ из мега-меню сайта: [{ title, url, level }]. */
function parseNavPrograms(html) {
  const anchors = [...html.matchAll(/<a\b[^>]*?href\s*=\s*"([^"#]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => ({ href: m[1], t: text(m[2]) }));
  const LEVEL_BY_SEG = { bachelors: 'bachelor', masters: 'master', doctorate: 'phd' };
  const out = []; const seen = new Set();
  for (const a of anchors) {
    if (!a.t || !a.href.startsWith('/degrees/')) continue;
    const segs = a.href.split('/').filter(Boolean);
    if (segs.length !== 4 || segs[0] !== 'degrees' || !LEVEL_BY_SEG[segs[1]]) continue;
    const url = BASE + a.href;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ title: a.t, url, level: LEVEL_BY_SEG[segs[1]] });
  }
  // Программы вне мега-меню, но с собственной страницей — добавляем вручную.
  out.push(
    { title: 'NCUK - International Foundation Year', url: `${BASE}/degrees/international-foundation-year`, level: 'foundation' },
    { title: 'Global English Skills Program', url: `${BASE}/study-english`, level: 'english-language' },
    { title: 'Graduate Certificate in Applied Artificial Intelligence', url: `${BASE}/training/short-courses/postgraduate-certificates/graduate-certificate-applied-artificial-intelligence`, level: 'short-course' },
    { title: 'Graduate Certificate in Business', url: `${BASE}/training/short-courses/postgraduate-certificates/graduate-certificate-business`, level: 'short-course' },
    { title: 'Graduate Certificate in Human Resource Management', url: `${BASE}/training/short-courses/postgraduate-certificates/graduate-certificate-human-resource-management`, level: 'short-course' },
    { title: 'Graduate Certificate in Marketing', url: `${BASE}/training/short-courses/postgraduate-certificates/graduate-certificate-marketing`, level: 'short-course' },
    { title: 'Certificate of Proficiency', url: `${BASE}/training/short-courses/certificate-proficiency`, level: 'short-course' },
  );
  return out;
}

// Карточки аккордеона masters-degree, которым нужен уровень отличный от 'master'
// (по умолчанию), либо которые нужно пропустить целиком.
const MASTER_CARD_LEVEL = {
  'Graduate Diploma in Artificial Intelligence': null, // диплом — вне схемы уровней
  'Graduate Diploma in Educational Studies': null, // диплом — вне схемы уровней
  'Graduate Certificate': 'short-course',
  'Graduate Foundation Course': null, // не однозначно foundation/short-course, без страницы — в gaps
  'Certificate of Proficiency': 'short-course',
  'Doctor of Philosophy (PhD)': 'phd', // берём с его собственной страницы (ниже), тут только пропускаем как «уже учтено»
};

/** «Total Fees» / шапка-цена на отдельной странице программы (PhD, Foundation Year). */
function totalFeesBox(html) {
  const m = html.match(/Total Fees\s*<\/h5>\s*<p>\s*(?:<p>)?\s*<strong>([\s\S]*?)<\/strong>/i);
  if (!m) return null;
  const raw = text(m[1]);
  const amount = feeAmount(raw);
  return amount == null ? null : { amount, raw };
}

export default {
  slug: 'wollongong-dubai',
  site: BASE,
  async collect({ log }) {
    const programs = [];
    const fees = [];
    const gaps = [];

    const navHtml = get(`${BASE}/degrees/bachelors`);
    await sleep(500);
    const navPrograms = parseNavPrograms(navHtml);
    for (const p of navPrograms) programs.push({ title: p.title, level: p.level, url: p.url });
    log(`меню: ${navPrograms.length} программ со своей страницей`);

    gaps.push({ why: 'Executive Learning — список отдельных корпоративных курсов без своих страниц и цен, это модули/курсы, не самостоятельные программы', url: `${BASE}/training/short-courses/executive-learning` });
    gaps.push({ why: 'Private Tutoring — услуга (индивидуальные занятия), не программа', url: `${BASE}/training/languages/private-tutoring` });
    gaps.push({ why: 'Graduate Diploma in Applied Artificial Intelligence — диплом вне схемы уровней каталога', url: `${BASE}/degrees/masters/computer-science/graduate-diploma-applied-artificial-intelligence` });
    gaps.push({ why: 'Graduate Diploma in Educational Studies — диплом вне схемы уровней каталога', url: `${BASE}/degrees/masters/education/graduate-diploma-educational-studies` });
    gaps.push({ why: 'Graduate Foundation Course — постдипломный мостик к магистратуре без собственной страницы, уровень по схеме каталога не определить однозначно (foundation обычно значит довузовский год); только цена за 1 предмет AED 2,205, не за программу целиком', url: `${BASE}/join-uowd/fees/masters-degree` });

    // --- Цены: бакалавриат ---
    const bHtml = get(`${BASE}/join-uowd/fees/bachelors-degree`);
    await sleep(500);
    for (const card of accordionCards(bHtml)) {
      for (const t of tablesWithLabels(card.html)) {
        const { headers, rows } = tableGrid(t.html);
        const feeColIdx = headers.findIndex((h) => /fee/i.test(h));
        if (feeColIdx === -1) continue;
        const basis = /yearly|annual/i.test(headers[feeColIdx]) ? 'year' : (/total/i.test(headers[feeColIdx]) ? 'program' : 'other');
        const majorColIdx = headers.findIndex((h) => /^(major|specialisation)s?$/i.test((h || '').trim()));
        const perGroup = new Map();
        for (const row of rows) {
          const amount = feeAmount(row[feeColIdx]);
          if (amount == null) continue;
          const major = majorColIdx >= 0 ? row[majorColIdx] : null;
          const key = major || '__single__';
          if (!perGroup.has(key)) perGroup.set(key, { major, amount, raw: row[feeColIdx] });
        }
        for (const { major, amount, raw } of perGroup.values()) {
          const segment = SEGMENT_BY_CARD[card.title] || null;
          const matched = major ? findByMajor(navPrograms, major, segment, 'bachelor') : findDirect(navPrograms, card.title, 'bachelor');
          const title = matched ? matched.title : (major ? `${card.title} (${major})` : card.title);
          fees.push({
            amount, currency: 'AED', basis, audience: null, scope: 'program',
            title, level: 'bachelor', programUrl: matched ? matched.url : undefined,
            url: `${BASE}/join-uowd/fees/bachelors-degree`, raw: `${title}: ${raw}`,
          });
        }
      }
    }
    log(`бакалавриат: ${fees.length} строк цены`);

    // --- Цены: магистратура + PhD (своя таблица) + Graduate Certificate + Certificate of Proficiency ---
    const mHtml = get(`${BASE}/join-uowd/fees/masters-degree`);
    await sleep(500);
    let masterRows = 0;
    for (const card of accordionCards(mHtml)) {
      if (Object.prototype.hasOwnProperty.call(MASTER_CARD_LEVEL, card.title)) {
        const lvl = MASTER_CARD_LEVEL[card.title];
        if (lvl === null || card.title === 'Doctor of Philosophy (PhD)') continue; // диплом/без-страницы/PhD — обработаны отдельно
      }
      const level = Object.prototype.hasOwnProperty.call(MASTER_CARD_LEVEL, card.title) ? MASTER_CARD_LEVEL[card.title] : 'master';
      for (const t of tablesWithLabels(card.html)) {
        const { headers, rows } = tableGrid(t.html);
        const feeColIdx = headers.findIndex((h) => /fee/i.test(h));
        if (feeColIdx === -1) continue;
        const basis = /total/i.test(headers[feeColIdx]) ? 'program' : (/yearly|annual/i.test(headers[feeColIdx]) ? 'year' : 'other');
        const majorColIdx = headers.findIndex((h) => /^(major|specialisation|programs?)$/i.test((h || '').trim()));
        const perGroup = new Map();
        for (const row of rows) {
          const amount = feeAmount(row[feeColIdx]);
          if (amount == null) continue;
          const major = majorColIdx >= 0 ? row[majorColIdx] : null;
          const key = major || '__single__';
          if (!perGroup.has(key)) perGroup.set(key, { major, amount, raw: row[feeColIdx] });
        }
        for (const { major, amount, raw } of perGroup.values()) {
          const matched = major ? findByMajor(navPrograms, major, null, level) : findDirect(navPrograms, card.title, level);
          const title = matched ? matched.title : (major ? `${card.title} (${major})` : card.title);
          fees.push({
            amount, currency: 'AED', basis, audience: null, scope: 'program',
            title, level, programUrl: matched ? matched.url : undefined,
            url: `${BASE}/join-uowd/fees/masters-degree`, raw: `${title}: ${raw}`,
          });
          masterRows += 1;
          // Программы, у которых нет собственной страницы (найдены только в этой
          // таблице цен) — добавляем в общий список программ, иначе их не будет нигде.
          if (!matched) {
            const already = programs.some((p) => p.title === title && p.level === level);
            if (!already) programs.push({ title, level, url: undefined });
          }
        }
      }
    }
    log(`магистратура/сертификаты: ${masterRows} строк цены`);

    // --- PhD и Foundation Year — со своих страниц, там сумма читается с «AED» явно ---
    const phdHtml = get(`${BASE}/degrees/doctorate/business/doctor-philosophy`);
    await sleep(500);
    const phdFee = totalFeesBox(phdHtml);
    if (phdFee) {
      fees.push({
        amount: phdFee.amount, currency: 'AED', basis: 'program', audience: null, scope: 'program',
        title: 'Doctor of Philosophy (PhD)', level: 'phd',
        programUrl: `${BASE}/degrees/doctorate/business/doctor-philosophy`,
        url: `${BASE}/degrees/doctorate/business/doctor-philosophy`, raw: `Total Fees: ${phdFee.raw}`,
      });
    } else {
      gaps.push({ why: 'на странице PhD не нашёлся блок Total Fees', url: `${BASE}/degrees/doctorate/business/doctor-philosophy` });
    }

    const foundHtml = get(`${BASE}/degrees/international-foundation-year`);
    await sleep(500);
    const foundFee = totalFeesBox(foundHtml);
    if (foundFee) {
      fees.push({
        amount: foundFee.amount, currency: 'AED', basis: 'program', audience: null, scope: 'program',
        title: 'NCUK - International Foundation Year', level: 'foundation',
        programUrl: `${BASE}/degrees/international-foundation-year`,
        url: `${BASE}/degrees/international-foundation-year`, raw: `Total Fees: ${foundFee.raw}`,
      });
    } else {
      gaps.push({ why: 'на странице International Foundation Year не нашёлся блок Total Fees', url: `${BASE}/degrees/international-foundation-year` });
    }

    // --- Global Master Luxury Management (Total Fees, есть в аккордее masters-degree) ---
    // уже обработан общим циклом выше (basis 'program' по заголовку «Total Fees»,
    // без programUrl — своей страницы у него нет, см. разведку).

    // --- English — Global English Skills Program, полная цена очного варианта ---
    const engHtml = get(`${BASE}/study-english`);
    await sleep(500);
    const feeListM = engHtml.match(/Course fees:<\/h3>\s*<ul>([\s\S]*?)<\/ul>/i);
    if (feeListM) {
      const fullTimeM = feeListM[1].match(/Global English Skills Full Time Program\s*AED\s*([\d,]+(?:\.\d+)?)[^<]*/i);
      if (fullTimeM) {
        fees.push({
          amount: Number(fullTimeM[1].replace(/,/g, '')), currency: 'AED', basis: 'program', audience: null,
          scope: 'program', title: 'Global English Skills Program', level: 'english-language',
          programUrl: `${BASE}/study-english`, url: `${BASE}/study-english`, raw: text(fullTimeM[0]),
        });
      }
      gaps.push({ why: 'Global English Skills также продаётся модулями (AED 8,000 за 8 недель, AED 4,000 за 4 недели) — берём только полную очную программу (12 недель, AED 11,760), модульные варианты не отдельная программа', url: `${BASE}/study-english` });
    } else {
      gaps.push({ why: 'на странице /study-english не нашёлся список Course fees', url: `${BASE}/study-english` });
    }

    return { programs, fees, gaps };
  },
};
