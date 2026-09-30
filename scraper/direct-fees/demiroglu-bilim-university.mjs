// demiroglu-bilim-university.mjs — Demiroğlu Bilim University (demiroglu.bilim.edu.tr),
// Istanbul.
//
// РАЗВЕДКА 28.09.2026. Вся публичная цена вуза — одна страница и одна таблица:
//   https://demiroglu.bilim.edu.tr/ogrenci/burslar-ve-ucretler   (curl: 200)
// Заголовок таблицы прямым текстом: «2026-2027 EĞİTİM-ÖĞRETİM YILI EK YERLEŞTİRME
// ÜCRET VE KONTENJAN BİLGİLERİ» — это цены ДОПОЛНИТЕЛЬНОГО ЗАЧИСЛЕНИЯ (ek
// yerleştirme), а не общий прайс-лист, но другой страницы с ценами на сайте нет
// вовсе (проверены все ссылки и текст страницы — «ücret»/«burs» больше нигде).
//
// У каждой программы в таблице по 2–3 строки-тарифа:
//   «<Программа> (TAM BURSLU)»      — 100% стипендия, цена всегда «---», пусто;
//   «<Программа> (% 50 İNDİRİMLİ)»  — 50%-скидка, ЕДИНСТВЕННАЯ строка с числом
//                                      для одиннадцати программ карточки;
//   «<Программа> (ÜCRETLİ)»         — полная цена БЕЗ скидки, но она встречается
//                                      только у программ Sağlık Hizmetleri Meslek
//                                      Yüksekokulu (двухгодичный «Ön lisans» —
//                                      Anestezi, İlk ve Acil Yardım, …), а это
//                                      «associate», которого нет ни в схеме
//                                      каталога, ни среди программ карточки.
// Итог: для всех 11 программ карточки (Tıp, Psikoloji, Moleküler Biyoloji ve
// Genetik, İşletme, Yönetim Bilişim Sistemleri, Beslenme ve Diyetetik, Ebelik,
// Fizyoterapi ve Rehabilitasyon, Sağlık Yönetimi, Hemşirelik TR/EN) сайт публикует
// ТОЛЬКО 50%-скидочную цену — полной (list) цены для них нет нигде на сайте.
// Решение владельца 30.09.2026: скидочную цену не берём, программы остаются без цены,
// пометка — в gaps (раньше было «отдать её с пометкой про скидку»).
//
// Названия программ в таблице (ЗАГЛАВНЫМИ) совпадают с карточкой побуквенно
// (там тоже ЗАГЛАВНЫМИ — «TIP», «PSİKOLOJİ», «HEMŞİRELİK (TÜRKÇE)» …), кроме
// хвоста « BÖLÜMÜ»/«FAKÜLTESİ» и суффикса тарифа — их срезаем.
//
// СПИСОК ПРОГРАММ (добавлено 29.09.2026). Бакалавриат — ровно те же 11 строк, что
// и цена (таблица «% 50 İNDİRİMLİ» выше): у каждого факультета (Tıp Fakültesi,
// Fen-Edebiyat, İşletme ve Yönetim Bilimleri, Sağlık Bilimleri, Florence
// Nightingale Hemşirelik Yüksekokulu) нет отдельной страницы «bölümler» со
// списком — факультет и есть программа (Tıp Fakültesi → «Tıp» и т.п.), сверено
// содержимым страниц факультетов (в навигации только «Hakkında/İdari Kadro»,
// ссылок на программы нет). Sağlık Hizmetleri Meslek Yüksekokulu (Ön lisans,
// «ÜCRETLİ»-строки таблицы) — associate, уровня нет в схеме, не берём.
// Магистратура и докторантура — на страницах двух институтов (в HTML главной
// страницы каждого инстиута лежат прямые ссылки на «program-tanitimi» каждой
// программы, у halk-sagligi-anabilim-dali ссылка без хвоста «/program-tanitimi»,
// но ведёт на ту же карточку программы — берём как есть):
//   saglik-bilimleri-enstitusu  — 9 Yüksek Lisans + 2 Doktora (Hemşirelik, Tıbbi
//                                  Biyoloji ve Genetik)
//   sosyal-bilimler-enstitusu   — 3 Yüksek Lisans (Psikoloji, Uygulamalı
//                                  Psikoloji, Sağlık Kurumları Yöneticiliği)
// Итого сайт публикует 11 бакалавриат + 12 магистратура + 2 докторантура = 25
// программ; в карточке сейчас только 11 (все бакалавриат) — 14 магистерских/
// докторских программ уйдут в «на сайте есть, в карточке нет», это не ошибка.

import { get, text, anchors, tableRows, sleep } from './_lib.mjs';

const SITE = 'https://demiroglu.bilim.edu.tr/';
const URL = 'https://demiroglu.bilim.edu.tr/ogrenci/burslar-ve-ucretler';
const HEALTH_INST = 'https://demiroglu.bilim.edu.tr/akademik-birimler/saglik-bilimleri-enstitusu';
const SOCIAL_INST = 'https://demiroglu.bilim.edu.tr/akademik-birimler/sosyal-bilimler-enstitusu';

// Срезать тариф в скобках и хвостовое «BÖLÜMÜ»/«FAKÜLTESİ» — оставить голое имя программы.
function cleanTitle(cell) {
  return cell
    .replace(/\s*\((?:TAM\s*BURSLU\S*|%?\s*\d+\s*İ?NDİR[İI]ML[İI]|ÜCRETL[İI])\)\s*$/i, '')
    .replace(/\s+(BÖLÜMÜ|BOLUMU)\s*$/i, '')
    .trim();
}

export default {
  slug: 'demiroglu-bilim-university',
  site: SITE,
  async collect({ log }) {
    const html = get(URL);
    await sleep(500);
    const rows = tableRows(html);
    // rows[0] — заголовок таблицы (одна ячейка), rows[1] — шапка колонок.
    const fees = [];
    const bachelorTitles = new Map(); // title (lower) -> title, дедуп бакалавриата.
    let discountRows = 0, fullRows = 0, zeroRows = 0;
    for (const r of rows) {
      if (r.length < 4) continue;
      const [unit, program, , ucret] = r;
      if (!/İNDİRİML|BURSLU|ÜCRETL/i.test(program)) continue;
      const isDiscount = /İ?NDİR[İI]ML/i.test(program);
      const isFull = /ÜCRETL[İI]/i.test(program);
      // «MESLEK YÜKSEKOKULU» (MYO) — Ön lisans (associate), не бакалавриат, хотя
      // тоже даёт «İNDİRİMLİ»-строку; отличаем по колонке факультета/школы.
      const isMYO = /MESLEK\s+Y[ÜU]KSEKOKULU/i.test(unit);
      if (isDiscount && !isMYO) {
        const title = cleanTitle(program);
        bachelorTitles.set(title.toLowerCase(), title);
      }
      const amountMatch = ucret.match(/([\d.]+)\s*TL/);
      if (!amountMatch) { zeroRows++; continue; } // «TAM BURSLU» — цены нет («---»).
      const amount = Number(amountMatch[1].replace(/\./g, ''));
      if (isFull) fullRows++; // относится только к Ön lisans-программам МYO — не в карточке, но фиксируем для отчёта.
      if (isDiscount) discountRows++;
      // Решение владельца 30.09.2026: скидочную цену НЕ отдаём — программы остаются
      // без цены, причина в gaps. Полные (ÜCRETLİ) строки — только у Ön lisans, их тоже
      // нет в схеме. Счётчики выше оставлены для лога.
      if (isDiscount) continue;
      const title = cleanTitle(program);
      fees.push({
        title, level: 'bachelor', scope: 'program',
        amount, currency: 'TRY', basis: 'year',
        audience: 'international', url: URL, raw: r.join(' | '),
        // не в формате README, но полезно для лога: isDiscount помечает скидочные строки.
      });
    }
    log(`строк с ценой: ${fees.length} (скидочных: ${discountRows}, полных: ${fullRows}, без цены: ${zeroRows})`);

    // Список программ. Бакалавриат — из таблицы цены (11 строк, см. комментарий выше).
    const programs = [...bachelorTitles.values()].map((title) => ({ title, level: 'bachelor', url: URL }));

    // Магистратура/докторантура — со страниц двух институтов, ссылки на «program-tanitimi».
    for (const [instUrl, unit] of [[HEALTH_INST, 'saglik-bilimleri-enstitusu'], [SOCIAL_INST, 'sosyal-bilimler-enstitusu']]) {
      const instHtml = get(instUrl);
      await sleep(500);
      for (const a of anchors(instHtml, instUrl)) {
        if (!a.href.includes(`/akademik-birimler/${unit}/programlar/`)) continue;
        const level = /doktora/i.test(a.href) ? 'phd' : /y[üu]ksek.?lisans/i.test(a.href) ? 'master' : null;
        if (!level || !a.text) continue;
        programs.push({ title: a.text, level, url: a.href });
      }
    }
    log(`программ на сайте: ${programs.length} (бакалавриат ${bachelorTitles.size}, остальное — институты)`);

    return {
      programs,
      fees,
      gaps: [
        { why: 'БЕЗ ЦЕНЫ по решению владельца 30.09.2026: для программ карточки на сайте есть только 50%-скидочная цена «ek yerleştirme»: 100%-стипендийная строка везде «---», полной (list) цены нет нигде на сайте', url: URL },
        { why: 'таблица — это цены дополнительного зачисления (ek yerleştirme) 2026-2027, не общий годовой прайс-лист; другой страницы с ценами на сайте не найдено', url: URL },
        { why: 'валюта только TRY — USD/EUR-эквивалента сайт не публикует, хотя карточка изначально настроена на USD', url: URL },
        { why: 'Sağlık Hizmetleri Meslek Yüksekokulu — Ön lisans (associate), уровня нет в схеме каталога, эти программы (Anestezi, İlk ve Acil Yardım и др.) пропущены целиком', url: URL },
      ],
    };
  },
};
