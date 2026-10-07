// amity-university-dubai.mjs — Amity University Dubai, amityuniversity.ae
//
// Разведка 2026-09-29. В карточке programUrl у всех программ вёл на сторонний
// агрегатор edge.edvoy.com — это не публикация вуза, используем только его
// собственный сайт amityuniversity.ae (курл проходит без блоков).
//
// Полный список программ берём со страницы-хаба /degrees: там перечислены все
// уровни (Bachelor's Degrees, Master's Degrees, Foundation Programme) со ссылками
// на страницы факультетов (3 сегмента пути, «хабы» — не программы) и на страницы
// самих программ (4 сегмента пути — их и берём). Итог: 19 бакалаврских + 4
// магистерских + 1 foundation = 24 программы.
//
// Не программы (в gaps, не в programs):
//   - General Education Programme (/degree/general-education-programme) — не
//     отдельная программа с приёмом, а общеобразовательный блок (21 credit hour,
//     7 курсов), который добавляется ко всем специализациям.
//   - Diplomas & Short Courses (/degree/diplomas-short-courses) — сайт прямо
//     говорит, что это выносится на отдельный сайт «Amity Training»
//     (amitytraining.ae) и даёт только список категорий обучения без названий
//     конкретных курсов и без уровня по нашей схеме (diploma/certificate).
//
// Цены — три отдельные страницы-таблицы (не по программам):
//   /join-amity/fees/bachelors-degree, /join-amity/fees/masters-degrees,
//   /join-amity/fees/foundation-programmes.
// Бакалавриат и магистратура: колонка «Fee Per Credit (AED/USD)» — то есть цена
// за кредит-час (basis: 'credit', в каталог не идёт, но отдаём для отчёта).
// Foundation: колонка «Total Fees (AED/USD)» — цена за весь курс (basis: 'program').
// В обеих валютах (AED и USD) сумма прямо написана в ячейке — отдаём обе строки.
//
// Строки таблицы называют программы короче, чем их официальные заголовки
// (например, «Business Administration Bachelor of Law (Honours)» вместо полного
// «Bachelor of Business Administration Bachelor of Law (Honours)», а строка
// «Bachelor of Science in Computer Science» покрывает сразу два profile — AI и
// Cybersecurity, у которых на сайте разные страницы, но одна и та же цена за
// кредит). Сопоставление названий строк с программами — вручную (ALIASES ниже),
// таблицы малы (18 + 4 + 1 строк) и стабильны.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { get, text, tableRows, sleep } from './_lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE = 'https://amityuniversity.ae';

// Строка таблицы Fees -> заголовок(и) программы как на её собственной странице.
const ALIASES = {
  'bachelor of architecture': ['Bachelor of Architecture'],
  'bachelor of business administration': ['Bachelor of Business Administration'],
  'business administration bachelor of law (honours)': ['Bachelor of Business Administration Bachelor of Law (Honours)'],
  'bachelor of commerce in accounting': ['Bachelor of Commerce in Accounting'],
  'bachelor of fashion design': ['Bachelor of Fashion Design'],
  'bachelor of finance': ['Bachelor of Finance'],
  'bachelor of fine arts in animation and film production': ['Bachelor of Fine Arts in Animation and Film Production'],
  'bachelor of fine arts in digital media and communications': ['Bachelor of Fine Arts in Digital Media and Communications'],
  'bachelor of hotel management and tourism': ['Bachelor of Hotel Management and Tourism'],
  'bachelor of interior design': ['Bachelor of Interior Design'],
  'bachelor of science in aerospace engineering': ['Bachelor of Science in Aerospace Engineering'],
  'bachelor of science in biotechnology': ['Bachelor of Science in Biotechnology'],
  'bachelor of science in civil engineering': ['Bachelor of Science in Civil Engineering'],
  'bachelor of science in computer science': [
    'Bachelor of Science in Computer Science - Artificial Intelligence',
    'Bachelor of Science in Computer Science - Cybersecurity',
  ],
  'bachelor of science in electrical engineering': ['Bachelor of Science in Electrical Engineering'],
  'bachelor of science in forensic sciences': ['Bachelor of Science in Forensic Sciences'],
  'bachelor of science in information technology': ['Bachelor of Science in Information Technology'],
  'bachelor of science in mechanical engineering': ['Bachelor of Science in Mechanical Engineering'],
  'bachelor of science in psychology': ['Bachelor of Science in Psychology'],
  'executive master of business administration (emba)': ['Executive Master of Business Administration (EMBA)'],
  'master of business administration (mba)': ['Master of Business Administration (MBA)'],
  'master of science in forensic sciences': ['Master of Science in Forensic Sciences'],
  'master of science in psychology': ['Master of Science in Psychology'],
  'amity university foundation programme': ['Amity University Foundation Programme'],
};

function degreeAnchors(html, base) {
  return [...String(html).matchAll(/<a\b[^>]*?href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => {
      let href; try { href = new URL(m[1], base).href; } catch { return null; }
      return { href, text: text(m[2]) };
    })
    .filter((a) => a && a.href.startsWith(`${SITE}/degree/`));
}

/** Программы — только «листовые» страницы /degree/<уровень>/<школа>/<программа> (4 сегмента). */
function collectPrograms(html) {
  const LEVELS = { 'bachelors-degree': 'bachelor', 'masters-degrees': 'master', 'foundation-programmes': 'foundation' };
  const seen = new Map();
  for (const a of degreeAnchors(html, SITE)) {
    const parts = a.href.replace(`${SITE}/`, '').split('/').filter(Boolean); // ['degree', level, school, program]
    if (parts.length !== 4) continue;
    const level = LEVELS[parts[1]];
    if (!level) continue;
    if (!seen.has(a.href)) seen.set(a.href, { title: a.text, level, url: a.href });
  }
  return [...seen.values()];
}

function extractAmounts(raw) {
  const out = [];
  for (const m of raw.matchAll(/(AED|USD)\s*([\d,]+)|([\d,]+)\s*(AED|USD)/gi)) {
    const currency = (m[1] || m[4]).toUpperCase();
    const amount = Number((m[2] || m[3]).replace(/,/g, ''));
    if (Number.isFinite(amount) && amount > 0) out.push({ currency, amount });
  }
  return out;
}

export default {
  slug: 'amity-university-dubai',
  site: SITE,
  async collect({ log }) {
    const gaps = [];
    const hub = get(`${SITE}/degrees`);
    const programs = collectPrograms(hub);
    log(`программ на хабе: ${programs.length}`);
    await sleep(500);

    const byTitle = new Map(programs.map((p) => [p.title, p]));

    gaps.push({
      why: 'General Education Programme — не отдельная программа с приёмом, а общеобразовательный блок (21 credit hour / 7 курсов), добавляемый ко всем специализациям',
      url: `${SITE}/degree/general-education-programme`,
    });
    gaps.push({
      why: 'Diplomas & Short Courses — сайт отправляет на отдельный ресурс Amity Training (amitytraining.ae) и даёт только список категорий обучения без названий конкретных курсов и без уровня по нашей схеме',
      url: `${SITE}/degree/diplomas-short-courses`,
    });

    const fees = [];
    const feePages = [
      { url: `${SITE}/join-amity/fees/bachelors-degree`, basis: 'credit', labelRe: /fee per credit/i, valueCol: -1 },
      { url: `${SITE}/join-amity/fees/masters-degrees`, basis: 'credit', labelRe: /fee per credit/i, valueCol: -1 },
      { url: `${SITE}/join-amity/fees/foundation-programmes`, basis: 'program', labelRe: /total fees/i, valueCol: 1 },
    ];

    for (const page of feePages) {
      let html;
      try {
        html = get(page.url);
      } catch (e) {
        gaps.push({ why: `страница цен не открылась: ${e.message}`, url: page.url });
        await sleep(500);
        continue;
      }
      const rows = tableRows(html);
      const header = rows[0] || [];
      const feeColIdx = page.valueCol === -1 ? header.length - 1 : page.valueCol;
      let matched = 0;
      for (const row of rows.slice(1)) {
        const name = (row[0] || '').trim();
        // «Security Deposit» открывает следующий блок той же HTML-таблицы (депозит,
        // не цена обучения) — там названия программ повторяются с суммой депозита,
        // дальше не читаем.
        if (/^security deposit$/i.test(name)) break;
        const key = name.toLowerCase();
        const titles = ALIASES[key];
        if (!titles) continue; // реквизиты банка и т.п. — мимо
        const valueCell = row[feeColIdx] || '';
        const amounts = extractAmounts(valueCell);
        if (!amounts.length) continue;
        for (const progTitle of titles) {
          const prog = byTitle.get(progTitle);
          if (!prog) continue;
          for (const { currency, amount } of amounts) {
            fees.push({
              amount, currency, basis: page.basis, audience: null,
              scope: 'program', title: prog.title, level: prog.level,
              programUrl: prog.url, url: page.url,
              raw: `${name} — ${header[feeColIdx] || ''}: ${valueCell}`,
            });
            matched += 1;
          }
        }
      }
      log(`${page.url}: ${matched} строк цены`);
      await sleep(500);
    }

    return { programs, fees, gaps };
  },
};
