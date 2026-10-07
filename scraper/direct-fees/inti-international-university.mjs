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
//
// Разведка 29.09.2026 (список программ). Полный каталог программ ИМЕННО этого кампуса —
// https://newinti.edu.my/find-a-programme/: это WooCommerce-листинг (150 карточек по
// всем четырём кампусам INTI разом), у каждой карточки `<li class="… product_cat-<тема>
// campus-<кампус-1> campus-<кампус-2> … certifications-<уровень> …">`. Класс
// `campus-inti-international-university` — ровно наш кампус (IIU, campus id 24 в JS-карте
// campus_list той же страницы, что и в общем товарном классе — сверено на карточках),
// у него 94 карточки. `certifications-<уровень>`: degree → bachelor, masters → master,
// phd → phd, foundation → foundation; diploma (11 карточек) — квалификация вне схемы
// каталога, в gaps, программой не отдаём (решение владельца про diploma/associate/
// certificate). Две карточки класса `certifications-` не имеют вовсе, зато несут
// `product_cat-inti-english-language-programs` (IELTS Training Course, Intensive English
// Programme) — им level: 'english-language' по категории, не по certifications-классу.
// Итого 45 bachelor + 22 master + 10 phd + 4 foundation + 2 english-language = 83
// программы. Короткие курсы (Micro-Credential Programme, Professional Development
// Programme) в этом листинге не участвуют вовсе — это отдельные страницы-хабы, не
// WooCommerce-товары, своего списка подстраниц не показывают — не берём, не выдумываем.
// Название программы (h1 страницы товара) читаем на той же странице, где потом ищем
// таблицу Fees — второго прохода не требуется.

import { get, text, sleep } from './_lib.mjs';

const LIST_URL = 'https://newinti.edu.my/find-a-programme/';
const CAMPUS_CLASS = 'campus-inti-international-university';
const CERT_LEVEL = { degree: 'bachelor', masters: 'master', phd: 'phd', foundation: 'foundation' };
const LI_RE = /<li class="([^"]*?product[^"]*?)"[^>]*>[\s\S]*?<a href="(https:\/\/newinti\.edu\.my\/programme\/[^"]+)"/g;

/** Программы этого кампуса со страницы-каталога: url → level (только годные уровни). */
function ownProgramUrls(html, gaps) {
  const out = new Map();
  for (const m of html.matchAll(LI_RE)) {
    const cls = m[1];
    if (!cls.includes(CAMPUS_CLASS)) continue;
    const url = m[2];
    if (out.has(url)) continue;
    const certMatch = cls.match(/certifications-([a-z0-9-]+)/);
    const cert = certMatch ? certMatch[1] : null;
    let level = cert ? CERT_LEVEL[cert] : undefined;
    if (level === undefined && !cert && /product_cat-inti-english-language-programs/.test(cls)) level = 'english-language';
    if (level) { out.set(url, level); continue; }
    if (cert === 'diploma') gaps.push({ why: 'Diploma — квалификация вне схемы каталога (foundation/bachelor/master/phd/english-language/short-course)', url });
    else gaps.push({ why: `карточка каталога без распознанного уровня (класс: ${cls.slice(0, 120)})`, url });
  }
  return out;
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
    const gaps = [];
    let listHtml;
    try {
      listHtml = get(LIST_URL);
    } catch (e) {
      return { programs: [], fees: [], gaps: [{ why: `каталог программ не открылся: ${e.message}`, url: LIST_URL }] };
    }
    await sleep(500);
    const urls = ownProgramUrls(listHtml, gaps);
    log(`find-a-programme: ${urls.size} программ кампуса INTI International University`);

    const programs = [];
    const fees = [];
    let i = 0;
    for (const [url, level] of urls) {
      i += 1;
      let html;
      try {
        html = get(url);
      } catch (e) {
        gaps.push({ why: `страница не открылась: ${e.message}`, url });
        await sleep(500);
        continue;
      }
      const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      const title = h1 ? text(h1[1]) : null;
      if (!title) { gaps.push({ why: 'на странице программы нет h1', url }); await sleep(500); continue; }
      programs.push({ title, level, url });

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
            title, level, programUrl: url, url,
            raw: `${campus}: ${cell}`,
          });
        }
      }
      if (i % 20 === 0) log(`${i}/${urls.size} страниц программ`);
      await sleep(500);
    }
    if (!fees.length) gaps.push({ why: 'ни одна страница программы не отдала цену', url: 'https://newinti.edu.my' });
    return { programs, fees, gaps };
  },
};
