// final-international-university.mjs — Final International University (final.edu.tr /
// www.final.edu.tr), Cyprus (Kyrenia).
//
// РАЗВЕДКА 28.09.2026. Обычные страницы вуза (`final.edu.tr/...ucretler-ve-odemeler`)
// отдают 403 под curl — WAF, как и было в задании; getBrowser (Playwright) страницу
// открывает (200, 34 КБ), но это анкета до JS-калькулятора, самих цифр там нет —
// таблица считается на клиенте. Реальные суммы лежат в отдельном приложении
// «Ücret Hesaplama Robotu»:
//   https://www.final.edu.tr/ucretrobotu/                          — форма (curl: 200!)
//   https://www.final.edu.tr/ucretrobotu/atotalpricingTCdev1son1.js — сам расчёт (curl: 200)
// Обе страницы этого поддомена/пути curl открывает без WAF — Playwright тут не
// понадобился, обошлись get().
//
// Форма даёт список программ (<option value="ID">НАЗВАНИЕ</option>), а js-файл —
// функцию priceCalc(): для каждой программы объявленная цена — переменная
// `natProgram` (например `natProgram = 580350;` для одной группы ID, `628050` —
// для Hukuk, `933333.3333` — для Diş Hekimliği, иначе `524700`). Это ГОДОВАЯ цена
// «Akademik Yılı» до вычета стипендии: при burs="Ücretli" (без стипендии) и
// indirim=0 («Hiçbiri» — без скидки) скрипт умножает natProgram на 1, то есть это
// и есть полная (не льготная) цена. К ней отдельно прибавляется 5% KDV (НДС) —
// налог, не часть объявленной платы за обучение, поэтому не добавляем. Kayıt Harcı
// (49 000 TL, регистрационный сбор) — не цена обучения, правило 2, не берём.
// Валюта на сайте только TRY (TL) — по заданию отдаём как есть, раннер такие
// строки отбросит по SCHEMA_CURRENCIES, это ожидаемо.
//
// Опции формы даны ЗАГЛАВНЫМИ турецкими буквами без диакритики карточки
// («PSİKOLOJİ (TÜRKÇE)»), а в карточке — «Psikoloji (Türkçe)» с точным написанием
// каждой программы (и там же дополнительный «Uluslararası Hukuk (İngilizce)»,
// которого в списке робота нет вовсе — калькулятор его не считает). Пары ID→точное
// название карточки собраны вручную построчно (сверено с
// site/src/content/universities/final-international-university.json, 28.09.2026):
// угадывать регистр/диакритику по общему правилу нельзя (İ/I путаются), поэтому
// таблица ниже — не эвристика, а перепись. Два ID (39, 40) — «(2 YILLIK)»,
// двухгодичный ассоциированный диплом, уровня «associate» в схеме нет, пропущены.
// Магистратура (Tezli/Tezsiz) в форме робота не встречается вовсе — гэп.
//
// СПИСОК ПРОГРАММ (добавлено 29.09.2026). Переиспользован разбор из A1-пересбора
// (kompas-collect-a1.mjs, 02.09.2026, SITES['final-international-university']):
// одна сводная страница https://www.final.edu.tr/tum-programlar со ссылками вида
// `f-<N>-<unit>/i-<N>-programlar/b-<N>-<slug>`, где `unit` (в самом адресе) и есть
// ступень: `fakultesi`/`yuksekokul` → bachelor, `enstitu` → уровень по тексту
// ссылки (trLevel: Doktora → phd, Yüksek Lisans/Tezli/Tezsiz → master), `meslek`
// (Meslek Yüksekokulu, 2 yıllık) → уровня в схеме нет, пропускаем. Названия здесь —
// ровно как на сайте (с диакритикой), в отличие от формы робота (см. выше, там
// заглавными без диакритики) — то есть точнее совпадают с карточкой.

import { get, text, anchors, sleep } from './_lib.mjs';

const SITE = 'https://www.final.edu.tr/';
const FORM_URL = 'https://www.final.edu.tr/ucretrobotu/';
const JS_URL = 'https://www.final.edu.tr/ucretrobotu/atotalpricingTCdev1son1.js';
const ALL_PROGRAMS_URL = 'https://www.final.edu.tr/tum-programlar';
const trLevel = (s) => (/doktora/i.test(s) ? 'phd' : /y[uü]ksek\s*lisans|tezli|tezsiz/i.test(s) ? 'master' : null);

// pr id → точное название программы бакалавриата в карточке.
const TITLE_BY_ID = {
  1: 'Rehberlik ve Psikolojik Danışmanlık (Türkçe)',
  2: 'Okul Öncesi Öğretmenliği (Türkçe)',
  4: 'Türkçe Öğretmenliği (Türkçe)',
  5: 'İngilizce Öğretmenliği (İngilizce)',
  6: 'Özel Eğitim Öğretmenliği (Türkçe)',
  7: 'Bilgisayar Mühendisliği (İngilizce)',
  8: 'Elektrik ve Elektronik Mühendisliği (İngilizce)',
  9: 'İnşaat Mühendisliği (İngilizce)',
  10: 'Yazılım Mühendisliği (İngilizce)',
  13: 'Uluslararası Finans ve Bankacılık (İngilizce)',
  14: 'İşletme (İngilizce)',
  17: 'Mimarlık (İngilizce)',
  19: 'Psikoloji (Türkçe)',
  20: 'Psikoloji (İngilizce)',
  21: 'Hukuk (Türkçe)',
  24: 'Fizyoterapi ve Rehabilitasyon (Türkçe)',
  25: 'Beden Eğitimi ve Spor Öğretmenliği (Türkçe)',
  26: 'Antrenörlük Eğitimi (Türkçe)',
  27: 'Turizm İşletmeciliği (İngilizce)',
  28: 'Gastronomi ve Mutfak Sanatları (Türkçe)',
  38: 'Beslenme ve Diyetetik (İngilizce)',
  41: 'Siyaset Bilimi ve Uluslararası İlişkiler (İngilizce)',
  42: 'Diş Hekimliği (Türkçe)',
  // 39, 40 — 2 yıllık (associate), уровня нет в схеме, не включены.
};

const GROUP_580350 = new Set([24, 5, 2, 6, 19, 20, 1, 4, 28]);

export default {
  slug: 'final-international-university',
  site: SITE,
  async collect({ log }) {
    const gaps = [];
    const formHtml = get(FORM_URL);
    await sleep(500);
    const js = get(JS_URL);
    await sleep(500);

    // Список программ формы — сверка, что ID из TITLE_BY_ID ещё существуют на сайте.
    const idsOnSite = new Set([...formHtml.matchAll(/<option value="(\d+)">([^<]+)<\/option>/g)]
      .map((m) => Number(m[1])).filter((n) => n > 0));
    log(`программ в форме: ${idsOnSite.size}`);

    const fees = [];
    for (const [idStr, title] of Object.entries(TITLE_BY_ID)) {
      const id = Number(idStr);
      if (!idsOnSite.has(id)) { gaps.push({ why: `программа id=${id} (${title}) пропала из формы робота`, url: FORM_URL }); continue; }
      let amount;
      if (id === 21) amount = 628050;
      else if (id === 42) amount = 933333.3333;
      else if (GROUP_580350.has(id)) amount = 580350;
      else amount = 524700;
      // Строка исходника, где буквально стоит эта сумма — для raw.
      const lit = String(amount);
      const rawMatch = js.match(new RegExp(`natProgram\\s*=\\s*${lit.replace('.', '\\.')}\\s*;`));
      const raw = rawMatch ? rawMatch[0] : `natProgram = ${lit};`;
      fees.push({
        title, level: 'bachelor', scope: 'program',
        amount, currency: 'TRY', basis: 'year',
        audience: 'international', url: JS_URL, raw,
      });
    }
    log(`строк цены: ${fees.length}`);
    gaps.push({ why: 'вся цена только в TRY — сайт не публикует USD/EUR-эквивалент; валюта TRY схемой каталога не принимается', url: JS_URL });
    gaps.push({ why: 'магистратура (Tezli/Tezsiz) в калькуляторе не считается вовсе — цены нет ни для одной программы магистратуры', url: FORM_URL });

    // Список программ — сводная страница «tum-programlar» (см. комментарий выше).
    const listHtml = get(ALL_PROGRAMS_URL);
    await sleep(500);
    const programs = [];
    let associateSkipped = 0;
    for (const a of anchors(listHtml, ALL_PROGRAMS_URL)) {
      const m = a.href.match(/f-\d+-([a-z-]+)\/i-\d+-programlar\/b-\d+-/i);
      if (!m || !a.text) continue;
      const unit = m[1];
      const level = /meslek/i.test(unit) ? null
        : /enstitu/i.test(unit) ? trLevel(a.text)
          : /fakultesi|yuksekokul/i.test(unit) ? 'bachelor' : null;
      if (!level) { if (/meslek/i.test(unit)) associateSkipped++; continue; }
      programs.push({ title: a.text, level, url: a.href });
    }
    const dedup = new Map();
    for (const p of programs) dedup.set(`${p.title}||${p.level}`, p);
    const sitePrograms = [...dedup.values()];
    log(`программ на сайте: ${sitePrograms.length}, meslek (associate) пропущено: ${associateSkipped}`);
    if (associateSkipped) gaps.push({ why: `${associateSkipped} строк Meslek Yüksekokulu (2 yıllık, associate) — такого уровня нет в схеме каталога, пропущены`, url: ALL_PROGRAMS_URL });

    return { programs: sitePrograms, fees, gaps };
  },
};
