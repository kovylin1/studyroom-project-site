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
// Правило владельца («если видна только скидочная цена — отдать её с пометкой
// про скидку») — берём «% 50 İNDİRİMLİ» построчно, gap объясняет, что это скидка.
//
// Названия программ в таблице (ЗАГЛАВНЫМИ) совпадают с карточкой побуквенно
// (там тоже ЗАГЛАВНЫМИ — «TIP», «PSİKOLOJİ», «HEMŞİRELİK (TÜRKÇE)» …), кроме
// хвоста « BÖLÜMÜ»/«FAKÜLTESİ» и суффикса тарифа — их срезаем.

import { get, tableRows, sleep } from './_lib.mjs';

const SITE = 'https://demiroglu.bilim.edu.tr/';
const URL = 'https://demiroglu.bilim.edu.tr/ogrenci/burslar-ve-ucretler';

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
    let discountRows = 0, fullRows = 0, zeroRows = 0;
    for (const r of rows) {
      if (r.length < 4) continue;
      const [, program, , ucret] = r;
      if (!/İNDİRİML|BURSLU|ÜCRETL/i.test(program)) continue;
      const amountMatch = ucret.match(/([\d.]+)\s*TL/);
      if (!amountMatch) { zeroRows++; continue; } // «TAM BURSLU» — цены нет («---»).
      const amount = Number(amountMatch[1].replace(/\./g, ''));
      const isDiscount = /İ?NDİR[İI]ML/i.test(program);
      const isFull = /ÜCRETL[İI]/i.test(program);
      if (isFull) fullRows++; // относится только к Ön lisans-программам МYO — не в карточке, но фиксируем для отчёта.
      if (isDiscount) discountRows++;
      const title = cleanTitle(program);
      fees.push({
        title, level: 'bachelor', scope: 'program',
        amount, currency: 'TRY', basis: 'year',
        audience: 'international', url: URL, raw: r.join(' | '),
        // не в формате README, но полезно для лога: isDiscount помечает скидочные строки.
      });
    }
    log(`строк с ценой: ${fees.length} (скидочных: ${discountRows}, полных: ${fullRows}, без цены: ${zeroRows})`);
    return {
      programs: [],
      fees,
      gaps: [
        { why: 'для программ карточки на сайте есть только 50%-скидочная цена «ek yerleştirme»: 100%-стипендийная строка везде «---», полной (list) цены нет нигде на сайте', url: URL },
        { why: 'таблица — это цены дополнительного зачисления (ek yerleştirme) 2026-2027, не общий годовой прайс-лист; другой страницы с ценами на сайте не найдено', url: URL },
        { why: 'валюта только TRY — USD/EUR-эквивалента сайт не публикует, хотя карточка изначально настроена на USD', url: URL },
      ],
    };
  },
};
