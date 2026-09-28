// xi-an-jiaotong-liverpool-university.mjs — XJTLU, xjtlu.edu.cn
//
// Разведка 28.09.2026. Курл проходит без блоков, три страницы с ценами нашлись по
// ссылкам «Fees and Scholarships» / «Programme Fees» в шапке сайта:
//   - /en/admissions/global/fees-and-scholarships — бакалавриат, ветка «International,
//     China's Hong Kong, Macao and Taiwan» (под Undergraduate Admissions): «International
//     Students: RMB 99,000 per academic year» — одна сумма на всех международных
//     бакалавров, без разбивки по программе → scope: 'level', level: 'bachelor'.
//     (Есть ещё ветка Chinese Mainland для местных студентов — цену не публикует
//     в этом же виде, поэтому местных не берём.)
//   - /en/admissions/master/fees-and-scholarships — таблица «Programme | Duration |
//     Fee (RMB)» на ~70 именованных магистерских программ, сумма фиксирована на весь
//     срок обучения (18/24/36 месяцев) → scope: 'program', basis: 'program'. В карточке
//     каталога реальных магистерских программ нет (только служебные ссылки «Master's
//     Programmes» / «Postgraduate Research Scholarships»), поэтому эти строки, скорее
//     всего, останутся несопоставленными — это ограничение состава карточки, не парсера.
//   - /en/admissions/doctoral/programme-fees — «PhD: RMB 99,000 per year (full-time)»
//     и «EdD: RMB 80,000 per year» → scope: 'level', level: 'phd', basis: 'year'
//     (доктор философии и доктор образования — оба входят в один уровень каталога).
// Валюта на сайте — RMB (женьминьби), в схему каталога кладём как CNY.
// У бакалаврских программ карточки programUrl у всех один и тот же (общая страница
// /study/undergraduate), поэтому сопоставление по ссылке не работает — это ожидаемо,
// уровневая цена сядет на все бакалаврские программы разом через сопоставление по уровню.

import { get, text, tableRows, sleep } from './_lib.mjs';

const PAGES = {
  bachelor: 'https://www.xjtlu.edu.cn/en/admissions/global/fees-and-scholarships',
  master: 'https://www.xjtlu.edu.cn/en/admissions/master/fees-and-scholarships',
  doctoral: 'https://www.xjtlu.edu.cn/en/admissions/doctoral/programme-fees',
};

export default {
  slug: 'xi-an-jiaotong-liverpool-university',
  site: 'https://www.xjtlu.edu.cn',
  async collect({ log }) {
    const fees = [];
    const programs = [];
    const gaps = [];

    // Бакалавриат — уровневая цена для международных студентов.
    const ugHtml = get(PAGES.bachelor);
    const ugText = text(ugHtml);
    const ugMatch = ugText.match(/International Students:\s*RMB\s*([\d,]+)\s*per academic year/i);
    if (ugMatch) {
      fees.push({
        amount: Number(ugMatch[1].replace(/,/g, '')), currency: 'CNY', basis: 'year',
        audience: 'international', scope: 'level', level: 'bachelor',
        url: PAGES.bachelor, raw: ugMatch[0],
      });
    } else {
      gaps.push({ why: 'не нашли фразу "International Students: RMB … per academic year" на странице бакалавриата', url: PAGES.bachelor });
    }
    await sleep(500);
    log('bachelor done');

    // Магистратура — построчно по программам, сумма за весь срок.
    const pgHtml = get(PAGES.master);
    const rows = tableRows(pgHtml).filter((r) => r.length === 3 && /^[\d,]+$/.test(r[2]));
    if (!rows.length) {
      gaps.push({ why: 'таблица «Programme | Duration | Fee (RMB)» не найдена', url: PAGES.master });
    }
    for (const [name, duration, amountStr] of rows) {
      const amount = Number(amountStr.replace(/,/g, ''));
      if (!amount) continue;
      programs.push({ title: name, level: 'master', url: PAGES.master });
      fees.push({
        amount, currency: 'CNY', basis: 'program', audience: null, scope: 'program',
        title: name, level: 'master', url: PAGES.master,
        raw: `${name} — ${duration} — RMB ${amountStr}`,
      });
    }
    await sleep(500);
    log(`master done, ${rows.length} programmes`);

    // Докторантура — уровневая цена, отдельно PhD и EdD (обе — 'phd' по схеме).
    const phdHtml = get(PAGES.doctoral);
    const phdText = text(phdHtml);
    const phdMatch = phdText.match(/tuition fee payable on postgraduate research programmes is\s*RMB\s*([\d,]+)\s*per year/i);
    if (phdMatch) {
      fees.push({
        amount: Number(phdMatch[1].replace(/,/g, '')), currency: 'CNY', basis: 'year',
        audience: null, scope: 'level', level: 'phd',
        url: PAGES.doctoral, raw: phdMatch[0],
      });
    }
    const eddMatch = phdText.match(/tuition fee payable for the EdD programme is\s*RMB\s*([\d,]+)\s*per year/i);
    if (eddMatch) {
      fees.push({
        amount: Number(eddMatch[1].replace(/,/g, '')), currency: 'CNY', basis: 'year',
        audience: null, scope: 'level', level: 'phd',
        url: PAGES.doctoral, raw: eddMatch[0],
      });
    }
    if (!phdMatch && !eddMatch) gaps.push({ why: 'не нашли сумму PhD/EdD на странице докторантуры', url: PAGES.doctoral });

    return { programs, fees, gaps };
  },
};
