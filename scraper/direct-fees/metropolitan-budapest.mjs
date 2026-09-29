// metropolitan-budapest.mjs — Budapest Metropolitan University, metropolitan.hu (EUR).
//
// Разведка 29.09.2026:
// - Полный список программ с собственной страницей — sitemap https://metropolitan.hu/sitemap.xml,
//   адреса вида https://metropolitan.hu/en/kepzesek/<slug> (28 штук; «kepzesek» —
//   венгерское «программы», сохранено в адресе даже у английской версии). Страница
//   /en/kepzesek (каталог-фильтр) отдаёт без JS только первые ~12 карточек — сайту
//   верить как списку нельзя, использован sitemap.
// - На каждой странице программы — блок с полями: «Course level» (Bachelor (BA, BSc) /
//   Master class (MA,MSc)), «Tuition fee 3990 EUR/semester for EU-students (includes
//   the Member States of the EU, EEA and Turkey) 4990 EUR/semester for non-EU
//   students. Two semesters tutition fee payment required.» — сумма за семестр
//   (basis 'semester', в каталог не едет, см. README), но не за год и не за курс
//   целиком — другой цифры сайт не даёт.
// - Отдельно от каталога, только на главной странице (https://metropolitan.hu/en) —
//   текстовые описания подготовительных программ без своей страницы и без цены:
//   «English Preparatory Programme» (english-language), «Professional Foundation
//   Semester for Business Programs» (foundation), «Pre-Master program» — два
//   направления, Business и Communication, упомянуты как один текст без отдельных
//   страниц (foundation — готовят к магистратуре, но сами не дают степени), «Art
//   foundation program» (foundation, «2 semesters», готовит к BA факультета
//   искусств). Ни для одной суммы в EUR на главной странице нет — gaps.
// - PhD-программ на сайте нет (в каталоге sitemap таких адресов нет, подтверждено
//   поиском по /phd|doctor/) — картой это тоже не заявлено.

import { get, text, sleep } from './_lib.mjs';

const SITEMAP = 'https://metropolitan.hu/sitemap.xml';
const HOME_URL = 'https://metropolitan.hu/en';
const PAGE_RE = /^https:\/\/metropolitan\.hu\/en\/kepzesek\/[a-z0-9-]+$/;

function levelOf(pageText) {
  const m = pageText.match(/Course level\s*([^\n]{0,40})/i);
  const label = m ? m[1] : '';
  if (/bachelor/i.test(label)) return 'bachelor';
  if (/master/i.test(label)) return 'master';
  if (/phd|doctor/i.test(label)) return 'phd';
  if (/foundation/i.test(label)) return 'foundation';
  return null;
}

function tuitionFees(pageText) {
  const out = [];
  const re = /([\d,.]+)\s*EUR\s*\/\s*semester\s*for\s*(non-)?EU[- ]?students/gi;
  for (const m of pageText.matchAll(re)) {
    const amount = Number(m[1].replace(/[^\d]/g, ''));
    if (!amount) continue;
    const audience = m[2] ? 'international' : 'eu';
    out.push({ amount, currency: 'EUR', basis: 'semester', audience, raw: m[0] });
  }
  return out;
}

// Программы, которые сайт описывает только на главной, без собственной страницы и без цены.
const HOME_ONLY_PROGRAMS = [
  { title: 'English Preparatory Programme', level: 'english-language', why: 'на главной нет суммы в EUR, только описание программы' },
  { title: 'Professional Foundation Semester for Business Programs', level: 'foundation', why: 'на главной нет суммы в EUR, только описание программы' },
  { title: 'Pre-Master program', level: 'foundation', why: 'на главной нет суммы в EUR, только описание программы (направления Business и Communication одним текстом)' },
  { title: 'Art foundation program', level: 'foundation', why: 'на главной нет суммы в EUR, только описание программы' },
];

export default {
  slug: 'metropolitan-budapest',
  site: 'https://metropolitan.hu',
  async collect({ log }) {
    const smXml = get(SITEMAP);
    await sleep(500);
    const urls = [...new Set([...smXml.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map((m) => m[1])
      .filter((u) => PAGE_RE.test(u)))];
    log(`programme pages: ${urls.length}`);

    const programs = [];
    const fees = [];
    const gaps = [];
    for (const url of urls) {
      let html;
      try {
        html = get(url);
      } catch (e) {
        gaps.push({ why: `страница не открылась (${String(e.message || e).split('\n')[0]})`, url });
        await sleep(500);
        continue;
      }
      await sleep(500);
      const h1m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      const title = h1m ? text(h1m[1]) : null;
      if (!title) { gaps.push({ why: 'на странице нет h1 — не понять название программы', url }); continue; }
      const pageText = text(html);
      const level = levelOf(pageText);
      if (!level) { gaps.push({ why: 'не удалось определить уровень («Course level» не распознан)', url, title }); continue; }
      programs.push({ title, level, url });
      const found = tuitionFees(pageText);
      if (!found.length) { gaps.push({ why: 'на странице нет «Tuition fee … EUR/semester»', url }); continue; }
      for (const f of found) fees.push({ ...f, scope: 'program', title, level, programUrl: url, url });
    }

    for (const p of HOME_ONLY_PROGRAMS) {
      programs.push({ title: p.title, level: p.level, url: HOME_URL });
      gaps.push({ why: p.why, url: HOME_URL, title: p.title });
    }

    return { programs, fees, gaps };
  },
};
