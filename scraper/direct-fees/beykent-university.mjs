// beykent-university.mjs — Beykent University (beykent.edu.tr), Turkey.
//
// РАЗВЕДКА 28.09.2026. Цены не в тексте страницы, а в JS-датасете калькулятора
// для иностранных студентов:
//   https://www.beykent.edu.tr/uluslararasi/uluslararasi-ogrenciler/uluslararasi-ogrenci-ucret-jesaplama-araci
// (curl отдаёт 200, WAF не мешает). В HTML лежит `const ucretVerisi = [...]` —
// 214 объектов вида {f: "Lisans", p: "Psikoloji (TR)", b: "USD", e: 2500, h: 1600}:
//   f — ступень (Ön lisans / Lisans / Yüksek Lisans / Doktora),
//   p — название программы (турецкий), суффикс (TR)/(EN) — язык обучения,
//   b — валюта (везде USD),
//   e — «Eğitim Ücreti» (плата за обучение) — это и есть цена курса,
//   h — «Hazırlık Ücreti» (плата за подготовительный год английского) — НЕ берём,
//       это отдельная услуга, а не цена самой программы.
// Со страницы (текст над таблицей): «Ön lisans ve lisans programlarında öğrenim
// ücretleri yıllık, lisansüstü programlarda ise program bazlı uygulanmaktadır» —
// т.е. у бакалавриата (и «Ön lisans») цена ГОДОВАЯ, у магистратуры/докторантуры —
// ЗА ВЕСЬ КУРС (basis: 'program'). Ниже добавлено: подготовительный год у всех
// программ, кроме медицины и стоматологии, стоит как сама программа (h == e) —
// подтверждает, что e — не годовая-с-депозитом, а именно объявленная цена.
//
// ЧЕГО НЕТ. «Ön lisans» (двухгодичный ассоциированный диплом) — уровня «associate»
// в схеме каталога нет вовсе, эти 30+ строк пропускаем целиком (см. gaps).
// У карточки нет медицины/стоматологии (сайт даёт цену, но программы этих
// факультетов A1-пересбор 02.09.2026 не завёл — на странице факультета не было
// ссылок), поэтому «Tıp»/«Diş Hekimliği» тоже уйдут в «не сопоставлено», это не
// ошибка парсера. Скидок/грантов на странице калькулятора нет — цена одна.
//
// СОПОСТАВЛЕНИЕ НАЗВАНИЙ. У бакалавриата карточка хранит английский вариант как
// «<Название> (İngilizce)», сайт — как «<Название>(EN)»/«<Название> (EN)»: меняем
// суффикс на карточный. Турецкий вариант в карточке — без суффикса вовсе: суффикс
// «(TR)» просто срезаем. У магистратуры карточка добавляет «ABD» (Anabilim Dalı) —
// сайт различает «(Tezli)»/«(Tezsiz)»/«(İngilizce)» (тезная/без тезиса, английская);
// это разные вещи, карточка одну программу на обе ветки не делит, поэтому обе
// ветки сводим к одному «<Название> ABD» — угадывает лишь часть (там, где решение
// владельца не добавляло «(MBA)»/«(MA)» к имени), остальное уйдёт в unmatched.

import { get, text, sleep } from './_lib.mjs';

const SITE = 'https://www.beykent.edu.tr/';
const CALC_URL = 'https://www.beykent.edu.tr/uluslararasi/uluslararasi-ogrenciler/uluslararasi-ogrenci-ucret-jesaplama-araci';

const LEVELS = { 'Lisans': 'bachelor', 'Yüksek Lisans': 'master', 'Doktora': 'phd' };
const BASIS = { bachelor: 'year', master: 'program', phd: 'program' };

function cleanBachelorTitle(p) {
  const m = p.match(/^(.*?)\s*\((TR|EN)\)\s*$/i);
  if (!m) return p.trim();
  const base = m[1].trim();
  return m[2].toUpperCase() === 'EN' ? `${base} (İngilizce)` : base;
}

function cleanGradTitle(p) {
  // «Bilgisayar Mühendisliği (Tezli)» / «(Tezsiz)» / «(İngilizce)» → базовое имя + ABD.
  const base = p.replace(/\s*\((Tezli|Tezsiz|İngilizce|Doktora)\)\s*/gi, ' ').replace(/\s+/g, ' ').trim();
  return `${base} ABD`;
}

export default {
  slug: 'beykent-university',
  site: SITE,
  async collect({ log }) {
    const gaps = [];
    const html = get(CALC_URL);
    await sleep(500);
    const re = /\{f:\s*"([^"]+)",\s*p:\s*"([^"]+)",\s*b:\s*"([^"]+)",\s*e:\s*([\d.]+),\s*h:\s*([\d.]+)\}/g;
    const fees = [];
    let assoc = 0;
    for (const m of html.matchAll(re)) {
      const [raw, fLevel, pName, currency, eStr] = m;
      const level = LEVELS[fLevel] ?? null;
      if (!level) { assoc++; continue; } // Ön lisans — уровня в схеме нет.
      const pDecoded = text(pName);
      const title = level === 'bachelor' ? cleanBachelorTitle(pDecoded) : cleanGradTitle(pDecoded);
      fees.push({
        title, level, scope: 'program',
        amount: Number(eStr), currency, basis: BASIS[level],
        audience: 'international', url: CALC_URL, raw: raw,
      });
    }
    log(`строк цены: ${fees.length}, Ön lisans пропущено: ${assoc}`);
    if (assoc) gaps.push({ why: `${assoc} строк «Ön lisans» (ассоциированная степень) — такого уровня нет в схеме каталога, пропущены`, url: CALC_URL });
    gaps.push({ why: 'Tıp (медицина) и Diş Hekimliği (стоматология) есть в калькуляторе (11000 USD), но этих факультетов нет в карточке — цена осталась непривязанной', url: CALC_URL });
    return { programs: [], fees, gaps };
  },
};
