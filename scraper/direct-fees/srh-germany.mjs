// srh-germany.mjs — «SRH International College», srh-international-college.de
//
// Разведка 29.09.2026. Карточка называется в каталоге srh-germany, но по факту
// её программы (Foundation Year …, Pre-Master Programme …, обе локации Berlin +
// Heidelberg) — это собственный список SRH International College (пайплайн-колледж
// группы Navitas, готовит к поступлению в SRH и другие немецкие вузы), а не общий
// «srh-hochschulen.de» (это корпоративный портал-холдинг SRH без каталога программ —
// на нём просто список вузов группы: EBS, Fernhochschule, SRH Haarlem, SRH
// University) и не srh-university.de (это отдельные карточки srh-university/
// srh-hochschule-berlin — Heidelberg/Berlin кампусы, см. их парсеры). Собственный
// сайт International College: srh-international-college.de, разделы /study/
// foundation/{business,creative-studies,engineering-it}/, /study/intensive-english-
// foundation/, /study/pre-masters/{business,computing,engineering-it-management}/ —
// 7 программ, все уровня 'foundation' по схеме каталога (нет отдельного уровня для
// pre-master/pathway).
//
// Цены — единой строкой на /admission/fees/, не по каждой странице программы:
//   Foundation fee: €11,800 (2 semesters) — общая для 3 Foundation-программ;
//   Intensive English Foundation fee: €15,450 (1 семестр англ. + 2 Foundation) —
//     для одноимённой программы;
//   Pre-Master's fee: €5,950 (1 semester) — общая для 3 Pre-Master's-программ.
// Явно названы категории программ (не абстрактный «уровень»), поэтому это
// scope: 'program' на каждую программу своей категории, а не scope: 'level'
// (иначе Foundation-цена и Pre-Master's-цена конфликтовали бы на одном level:
// 'foundation'). Сумма буквально видна на странице (raw).
// Бывший каталог мешал сюда общий список бакалавриата/магистратуры SRH-групп с
// заглушкой-ссылкой srh-hochschulen.de — на реальном сайте International College
// таких страниц нет (это программы кампусов, см. srh-university.mjs / srh-
// hochschule-berlin.mjs), поэтому в сверке они уйдут в «card not on site».

import { get, text, sleep } from './_lib.mjs';

const BASE = 'https://www.srh-international-college.de';

const OWN_PROGRAMS = [
  { path: '/study/foundation/business/', title: 'Foundation in Business', level: 'foundation', feeGroup: 'foundation' },
  { path: '/study/foundation/creative-studies/', title: 'Foundation in Creative Studies', level: 'foundation', feeGroup: 'foundation' },
  { path: '/study/foundation/engineering-it/', title: 'Foundation in Engineering & IT', level: 'foundation', feeGroup: 'foundation' },
  { path: '/study/intensive-english-foundation/', title: 'Intensive English Foundation', level: 'foundation', feeGroup: 'english' },
  { path: '/study/pre-masters/business/', title: "Pre-Master's in Business", level: 'foundation', feeGroup: 'premaster' },
  { path: '/study/pre-masters/computing/', title: "Pre-Master's in Computing", level: 'foundation', feeGroup: 'premaster' },
  { path: '/study/pre-masters/engineering-it-management/', title: "Pre-Master's in Engineering and IT Management", level: 'foundation', feeGroup: 'premaster' },
];

export default {
  slug: 'srh-germany',
  site: 'https://www.srh-international-college.de',
  async collect({ log }) {
    const gaps = [];
    const programs = [];
    for (const p of OWN_PROGRAMS) {
      const url = `${BASE}${p.path}`;
      try {
        get(url); // проверяем, что страница жива
      } catch (e) {
        gaps.push({ why: `страница программы не открылась: ${e.message}`, url });
        await sleep(500);
        continue;
      }
      programs.push({ title: p.title, level: p.level, url });
      await sleep(500);
    }
    log(`собственный сайт: ${programs.length} программ`);

    const fees = [];
    const feesUrl = `${BASE}/admission/fees/`;
    let feesHtml;
    try {
      feesHtml = get(feesUrl);
    } catch (e) {
      gaps.push({ why: `страница цен не открылась: ${e.message}`, url: feesUrl });
      feesHtml = null;
    }
    if (feesHtml) {
      const t = text(feesHtml);
      const rows = {
        foundation: t.match(/Foundation fee:\s*€\s*([\d,]+)\s*\(([^)]+)\)/i),
        english: t.match(/Intensive English Foundation fee\s*:?\s*€\s*([\d,]+)\s*\(([^)]+)\)/i),
        premaster: t.match(/Pre-Master.s fee:\s*€\s*([\d,]+)\s*\(([^)]+)\)/i),
      };
      for (const p of OWN_PROGRAMS) {
        const m = rows[p.feeGroup];
        if (!m) { gaps.push({ why: `в таблице цен не нашлась строка для группы «${p.feeGroup}»`, url: feesUrl }); continue; }
        fees.push({
          amount: Number(m[1].replace(/,/g, '')), currency: 'EUR', basis: 'program', audience: null,
          scope: 'program', title: p.title, level: p.level,
          programUrl: `${BASE}${p.path}`, url: feesUrl, raw: m[0],
        });
      }
    }

    return { programs, fees, gaps };
  },
};
