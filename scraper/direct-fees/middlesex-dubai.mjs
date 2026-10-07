// middlesex-dubai.mjs — Middlesex University Dubai, mdx.ac.ae
//
// Разведка 29.09.2026. Курл проходит без блоков. Карточка (middlesex-dubai.json)
// содержит 346 записей — почти все с одинаковым фиктивным programUrl
// "https://www.mdx.ac.ae/" и, судя по всему, много мусора (например «Academic
// Calendar - MBA - September 2025», «Degree Certificates and Diploma
// Supplements» — не программы, это даты набора и раздел документов), это чужой,
// не наш баг, не трогаем каталог.
//
// Реальный полный список программ отдаёт headless CMS сайта — Strapi API на
// поддомене https://api.mdx.ac.ae/api/courses (без ключа, обычный GET,
// ?pagination[pageSize]=200 отдаёт все разом). Всего 73 курса — это и есть
// полный официальный список программ кампуса. У каждой записи только title и
// url (относительный путь вида courses/course-list/course-detail/<slug>),
// уровня в API нет — определяем его по префиксу заголовка:
//   International Foundation Programme            -> foundation
//   LLB / BA / BSc / BEng (Honours …)              -> bachelor
//   MSc / MA / MBA / Executive MBA / LLM           -> master
//   Postgraduate Certificate in Higher Education   -> нет уровня в схеме
//                                                      (это PGCert) -> gaps
//
// Цены. Страницы курсов (courses/course-list/course-detail/<slug>) не содержат
// собственного блока платы за обучение — там нет ни класса/id с «fee», ни
// таблицы. Единственный текст с AED на этих страницах — общий блог-виджет
// «похожие статьи», который на КАЖДОЙ странице (и на /studentfinance) одинаков
// и посвящён стоимости MBA. Но он называет два реальных значения для двух
// собственных программ MDX Dubai по имени и явно как «tuition fees»:
//   «the Middlesex University Dubai Daytime MBA lists tuition fees of
//    AED 84,872 inclusive of VAT»               -> MBA (Daytime Delivery)
//   «MDX Dubai also offers an Executive MBA, … tuition fees currently listed
//    at AED 117,548 inclusive of VAT»            -> Executive MBA
// Суммы читаются в raw буквально, basis: 'program' (текст не говорит «per
// year», годовая/семестровая разбивка не указана — делить/не делить нечего).
// Для остальных 71 курса цены на сайте не нашли — в gaps.
//
// Список программ запрашиваем строго из API (полный и официальный), а не из
// карточки — так и требует README при собственном списке кампуса.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { get, sleep } from './_lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE = 'https://www.mdx.ac.ae';
const API = 'https://api.mdx.ac.ae/api/courses';

function levelOf(title) {
  const t = title.trim();
  if (/^International Foundation Programme/i.test(t)) return 'foundation';
  if (/^(LLB|BA|BSc|BEng)\b/i.test(t)) return 'bachelor';
  if (/^(MSc|MA|MBA|LLM|Executive MBA)\b/i.test(t)) return 'master';
  return null; // Postgraduate Certificate и подобное — вне схемы уровней
}

// Известные прямые цены (см. разведку выше) — сопоставляем по названию курса.
const KNOWN_FEES = [
  {
    match: /^MBA \(Daytime Delivery\)$/i,
    amount: 84872, currency: 'AED', basis: 'program',
    raw: 'the Middlesex University Dubai Daytime MBA lists tuition fees of AED 84,872 inclusive of VAT',
  },
  {
    match: /^Executive MBA$/i,
    amount: 117548, currency: 'AED', basis: 'program',
    raw: 'MDX Dubai also offers an Executive MBA, with September 2026 tuition fees currently listed at AED 117,548 inclusive of VAT',
  },
];

export default {
  slug: 'middlesex-dubai',
  site: SITE,
  async collect({ log }) {
    const programs = [];
    const fees = [];
    const gaps = [];

    let page = 1;
    const all = [];
    for (;;) {
      const url = `${API}?pagination%5Bpage%5D=${page}&pagination%5BpageSize%5D=100`;
      let body;
      try {
        body = get(url);
      } catch (e) {
        gaps.push({ why: `API не открылся: ${e.message}`, url });
        break;
      }
      let json;
      try {
        json = JSON.parse(body);
      } catch (e) {
        gaps.push({ why: `API вернул не-JSON: ${e.message}`, url });
        break;
      }
      all.push(...(json.data || []));
      const pc = json?.meta?.pagination?.pageCount || 1;
      log(`courses API page ${page}/${pc}: ${json.data?.length || 0}`);
      if (page >= pc) break;
      page += 1;
      await sleep(500);
    }

    for (const item of all) {
      const a = item.attributes || {};
      const title = (a.title || '').replace(/\s+/g, ' ').trim();
      if (!title) continue;
      const rel = a.url || a.slug || '';
      const programUrl = rel ? `${SITE}/${rel.replace(/^\/+/, '')}` : null;
      const level = levelOf(title);
      if (!level) {
        gaps.push({ why: `нет уровня в схеме для «${title}» (Postgraduate Certificate/диплом)`, url: programUrl });
        continue;
      }
      programs.push({ title, level, url: programUrl });

      const known = KNOWN_FEES.find((k) => k.match.test(title));
      if (known) {
        fees.push({
          amount: known.amount, currency: known.currency, basis: known.basis,
          audience: null, scope: 'program', title, level,
          programUrl, url: `${SITE}/studentfinance`, raw: known.raw,
        });
      }
    }

    gaps.push({
      why: 'страницы курсов (courses/course-list/course-detail/<slug>) не публикуют собственную стоимость обучения — ни таблицы, ни блока с классом/id "fee"; общий сайт не даёт единую страницу с ценами по всем 73 программам',
      url: `${SITE}/studentfinance`,
    });

    return { programs, fees, gaps };
  },
};
