// modul-university-vienna.mjs — Modul University Vienna, modul.ac.at (Austria, EUR).
//
// Разведка 29.09.2026:
// - Полный список программ — навигация страницы https://www.modul.ac.at/programs:
//   16 ссылок вида /programs/<category>/<slug>, сгруппированных по Foundation
//   Programs (2), Bachelor Programs (7), Master Programs (4 MSc + MBA отдельной
//   строкой /programs/master-of-business-administration), PHD (1,
//   /programs/phd-in-business-and-socioeconomic-sciences). Ссылки на сами
//   категории (/programs/bachelor-programs и т.п.) — не программы, отфильтрованы.
//   Другие адреса из общего sitemap (masters-programs/digital-marketing,
//   .../data-science и т.п.) — не отдельные программы: у них h1 «Master Programs»
//   (общий, не своя страница) и в навигации сайта их нет — это не сработавшие
//   якоря специализаций, пропущены.
// - Цены — одна страница https://www.modul.ac.at/study-at-mu/tuition-fees,
//   4 таблицы (Foundation/Bachelor/Master/PHD) со столбцами Program | Semesters |
//   Fees / Semester, например «BSc in Applied Data Science | 6 | €9000». Сайт
//   называет сумму платой за семестр, а не за год и не за курс целиком — basis
//   'semester', в каталог не едет (см. README), но нужна для отчёта: другой
//   суммы (за год/за программу целиком) на сайте нет, только план оплаты (полная
//   единовременная оплата — скидка 3%, без итоговой суммы прописью).
//   Название программы в таблице совпадает с текстом ссылки в /programs один в
//   один (после нормализации пробелов/пунктуации) — так сопоставляем строку цены
//   со страницей программы.

import { get, text, anchors, sleep } from './_lib.mjs';

const PROGRAMS_URL = 'https://www.modul.ac.at/programs';
const FEES_URL = 'https://www.modul.ac.at/study-at-mu/tuition-fees';

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function levelOf(href) {
  if (/\/foundation-programs\//.test(href)) return 'foundation';
  if (/\/bachelor-programs\//.test(href)) return 'bachelor';
  if (/\/masters-programs\//.test(href) || /master-of-business-administration/.test(href)) return 'master';
  if (/phd-in-business-and-socioeconomic-sciences/.test(href)) return 'phd';
  return null;
}

export default {
  slug: 'modul-university-vienna',
  site: 'https://modul.ac.at',
  async collect({ log }) {
    const programsHtml = get(PROGRAMS_URL);
    await sleep(500);
    const links = anchors(programsHtml, PROGRAMS_URL)
      .filter((a) => /^https:\/\/www\.modul\.ac\.at\/programs\/[a-z-]+\/[a-z-]+$/.test(a.href)
        || /^https:\/\/www\.modul\.ac\.at\/programs\/(master-of-business-administration|phd-in-business-and-socioeconomic-sciences)$/.test(a.href));
    const uniq = new Map();
    for (const a of links) if (!uniq.has(a.href)) uniq.set(a.href, a.text);
    log(`programme links on /programs: ${uniq.size}`);

    const programs = [];
    const gaps = [];
    for (const [url, title] of uniq) {
      const lvl = levelOf(url);
      if (!lvl) { gaps.push({ why: 'не удалось определить уровень по адресу ссылки', url }); continue; }
      programs.push({ title, level: lvl, url });
    }

    const feesHtml = get(FEES_URL);
    await sleep(500);
    const tables = [...feesHtml.matchAll(/<table\b[\s\S]*?<\/table>/gi)].map((m) => m[0]);
    const fees = [];
    for (const table of tables) {
      const rows = [...table.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)]
        .map((m) => [...m[0].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) => text(c[1])))
        .filter((r) => r.length >= 3 && !/^program$/i.test(r[0]));
      for (const [progTitle, semesters, feeCell] of rows) {
        const m = feeCell.match(/€\s*([\d,.]+)/);
        if (!m) { gaps.push({ why: `строка тарифа без суммы: ${progTitle} / ${feeCell}` }); continue; }
        const amount = Number(m[1].replace(/[^\d]/g, ''));
        const match = programs.find((p) => norm(p.title) === norm(progTitle));
        if (!match) { gaps.push({ why: `строка тарифа «${progTitle}» не нашла программы в /programs` }); continue; }
        fees.push({
          amount, currency: 'EUR', basis: 'semester', audience: null, scope: 'program',
          title: match.title, level: match.level, programUrl: match.url, url: FEES_URL,
          raw: `${progTitle} ${semesters} ${feeCell}`.trim(),
        });
      }
    }
    return { programs, fees, gaps };
  },
};
