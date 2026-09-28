// inti-international-university.mjs — INTI International University & Colleges, newinti.edu.my
//
// Разведка 28.09.2026. Курл проходит без блоков. У каждой программы своя страница
// https://newinti.edu.my/programme/<slug>/, на ней сворачиваемый блок «Fees» —
// таблица <table class="ProgTable"> с шапкой «Campus | Local Students | International
// Students» и строкой(ами) кампуса вида «Approx. RM 98,128». Числа местных и
// иностранных студентов на увиденных страницах совпадают (SST 6% упомянут отдельно,
// в саму цену не включён). Рядом в карточке товара — плашка длительности «4 Years»
// и «From RM 98,128»: одно число на весь курс, а не за год, поэтому basis: 'program'.
// Отдельной страницы со сводным прайс-листом на сайте нет (проверено — /fees/ = 404,
// в меню ссылок на fees нет), только на страницах программ.
// У ~55 программ карточки (магистратура, PhD, foundation, часть дипломов) программной
// ссылки в карточке нет вовсе (сайт их не даёт единым списком с youtube-путём) —
// такие остаются пробелом: страницы фиксированных program-URL не найдены.
// Список программ, которые запрашиваем, берём из самой карточки каталога (только так
// экономим бюджет запросов — общий листинг «все бакалаврские» отдаёт полторы сотни
// программ, из которых карточке нужны лишь совпадающие по URL).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { get, text, sleep } from './_lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARD = path.join(__dirname, '../../site/src/content/universities/inti-international-university.json');

function ownProgramUrls() {
  const card = JSON.parse(fs.readFileSync(CARD, 'utf8').replace(/^﻿/, ''));
  const urls = new Map(); // url -> { title, level }
  for (const p of card.programs || []) {
    if (p.programUrl && /\/programme\/[^/]+\/?$/.test(p.programUrl) && !urls.has(p.programUrl)) {
      urls.set(p.programUrl, { title: p.title, level: p.level });
    }
  }
  return urls;
}

function feesTable(html) {
  const m = html.match(/id=['"]acc_fees['"][\s\S]*?<table class="ProgTable">([\s\S]*?)<\/table>/);
  if (!m) return null;
  return [...m[1].matchAll(/<tr\b[\s\S]*?<\/tr>/gi)]
    .map((r) => [...r[0].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) => text(c[1])))
    .filter((r) => r.length >= 3);
}

export default {
  slug: 'inti-international-university',
  site: 'https://newinti.edu.my',
  async collect({ log }) {
    const urls = ownProgramUrls();
    const fees = [];
    const gaps = [];
    let i = 0;
    for (const [url, meta] of urls) {
      i += 1;
      let html;
      try {
        html = get(url);
      } catch (e) {
        gaps.push({ why: `страница не открылась: ${e.message}`, url });
        await sleep(500);
        continue;
      }
      const rows = feesTable(html);
      if (!rows || !rows.length) {
        gaps.push({ why: 'на странице программы нет таблицы Fees', url });
        await sleep(500);
        continue;
      }
      const body = rows.filter((r) => !/local students/i.test(r[1] ?? ''));
      if (!body.length) {
        gaps.push({ why: 'таблица Fees без строк кампуса', url });
        await sleep(500);
        continue;
      }
      for (const row of body) {
        const [campus, local, intl] = row;
        for (const [audience, cell] of [['domestic', local], ['international', intl]]) {
          const digits = String(cell ?? '').replace(/[^\d]/g, '');
          if (!digits) continue;
          const amount = Number(digits);
          if (!amount) continue;
          fees.push({
            amount, currency: 'MYR', basis: 'program', audience, scope: 'program',
            title: meta.title, level: meta.level, programUrl: url, url,
            raw: `${campus}: ${cell}`,
          });
        }
      }
      if (i % 20 === 0) log(`${i}/${urls.size} страниц программ`);
      await sleep(500);
    }
    if (!fees.length) gaps.push({ why: 'ни одна страница программы не отдала цену', url: 'https://newinti.edu.my' });
    return { programs: [], fees, gaps };
  },
};
