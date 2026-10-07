// american-university-of-ras-al-khaimah-aurak.mjs — AURAK, aurak.ac.ae
//
// Разведка 29.09.2026. Карточка была заведена 23.08.2026 из выгрузки QS (agregator),
// её programUrl у всех строк указывает на admissions.qs.com — сторонний сайт, не сам
// вуз (verifiedBySite: false). Разведка велась на собственном сайте aurak.ac.ae.
//
// Полный список программ — фиксированное меню сайта (одинаковое на каждой странице,
// секции «Undergraduate Degrees» / «Graduate Degrees» в /admissions/undergraduate-degrees
// и /admissions/graduate-degrees): 18 бакалаврских программ (Business & Management x7,
// Computer Science x2, Engineering x5, Media and Design x1 (Architecture — отдельно, у
// него своя страница в /undergraduate-degrees/media-and-design/), Media and
// Communication x1, Biotechnology x1, Social Science/Psychology x1), 5 магистерских
// (MEPM, MSc Sustainable & Renewable Energy, MEd Educational Leadership, MBA, EMBA) и
// один «Level 9 Micro-Credential in Energy Efficiency and Management» — по описанию на
// его собственной странице это отдельная короткая программа (1 семестр, 3 credit hours,
// собственные вступительные требования и цена), не модуль — берём как short-course.
// «Minor in Artificial Intelligence» в меню Engineering — это минор (довесок к другой
// степени, не отдельная программа с приёмом) — не отдаём, gaps.
//
// Цена: на каждой странице программы есть строка «Tuition Fees* <AED> AED / <USD> USD
// (per year)» — для бакалавриата это явная цена за учебный год (basis: 'year'), берём
// сумму AED. У всех проверенных магистерских программ (MBA, EMBA, MEd, MEPM, MSc
// Sustainable & Renewable Energy) та же строка стоит как «... (per CH)» — цена за
// credit hour, basis: 'credit', в каталог не едет, отдаём для отчёта. Сводная таблица
// /admissions/entry-criteria/tuition-fees дублирует то же самое ещё и per-semester
// flat-rate (при нагрузке 12–16 CH) — тоже basis: 'semester', не едет; program-страницы
// с basis: 'year' надёжнее и совпадают с уже стоявшей в карточке ценой (BSBA = 60 260
// AED — сверено, совпадает).
// У Micro-Credential цена дана одной суммой «Tuition Fees* 9,000 AED» без «per year»/
// «per CH» — при длительности программы в 1 семестр это явно цена за весь курс,
// basis: 'program'.
//
// На странице /admissions/entry-criteria/tuition-fees также есть ссылка на PDF
// «Cost of Attendance and Additional Expenses» (Architecture) — PDF не разбираем,
// в _lib.mjs нет парсера PDF, и на самой странице программы Architecture цена уже
// известна текстом («63,290 AED / 17,231 USD (per year)») — этого достаточно.
//
// Сайт отдаёт curl без блоков (200 сразу), браузер не понадобился.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { get, text, sleep } from './_lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE = 'https://aurak.ac.ae';

const PROGRAMS = [
  // Business & Management (bachelor)
  { title: 'Bachelor of Science in Business Administration (BSBA) General', level: 'bachelor', url: `${SITE}/undergraduate-degrees/business-management/bachelor-of-science-in-business-administration` },
  { title: 'BSBA Major in Accounting', level: 'bachelor', url: `${SITE}/undergraduate-degrees/business-management/bachelor-of-science-in-business-administration-major-in-accounting` },
  { title: 'BSBA Major in Finance and Financial Technologies', level: 'bachelor', url: `${SITE}/undergraduate-degrees/business-management/bachelor-of-science-in-business-administration-majoring-in-finance` },
  { title: 'BSBA Major in Digital Marketing Management', level: 'bachelor', url: `${SITE}/undergraduate-degrees/business-management/bachelor-of-science-in-business-administration-major-in-marketing` },
  { title: 'BSBA Major in Human Resource Management', level: 'bachelor', url: `${SITE}/undergraduate-degrees/business-management/bachelor-of-science-in-business-administration-major-in-human-resource-management` },
  { title: 'BSBA Major in Hospitality & Tourism Management', level: 'bachelor', url: `${SITE}/undergraduate-degrees/business-management/bachelor-of-science-in-business-administration-major-in-hospitality-tourism-management` },
  { title: 'BSBA Major in Business Analytics', level: 'bachelor', url: `${SITE}/undergraduate-degrees/business-management/bachelor-of-science-in-business-administration-major-in-business-analytics` },
  // Computer Science (bachelor)
  { title: 'Bachelor of Science in Computer Science', level: 'bachelor', url: `${SITE}/undergraduate-degrees/computer-science/bachelor-of-science-in-computer-science` },
  { title: 'Bachelor of Science in Artificial Intelligence', level: 'bachelor', url: `${SITE}/undergraduate-degrees/computer-science/bachelor-of-science-in-artificial-intelligence` },
  // Engineering (bachelor)
  { title: 'Bachelor of Science in Computer Engineering', level: 'bachelor', url: `${SITE}/undergraduate-degrees/engineering/bachelor-of-science-in-computer-engineering` },
  { title: 'Bachelor of Science in Civil Engineering', level: 'bachelor', url: `${SITE}/undergraduate-degrees/engineering/bachelor-of-science-in-civil-and-infrastructure-engineering` },
  { title: 'Bachelor of Science in Chemical Engineering', level: 'bachelor', url: `${SITE}/undergraduate-degrees/engineering/bachelor-of-science-in-chemical-engineering` },
  { title: 'Bachelor of Science in Electrical and Electronics Engineering', level: 'bachelor', url: `${SITE}/undergraduate-degrees/engineering/bachelor-of-science-in-electrical-and-electronics-engineering` },
  { title: 'Bachelor of Science in Mechanical Engineering', level: 'bachelor', url: `${SITE}/undergraduate-degrees/engineering/bachelor-of-science-in-mechanical-engineering` },
  // Media and Design (bachelor)
  { title: 'Bachelor of Architecture', level: 'bachelor', url: `${SITE}/undergraduate-degrees/media-and-design/bachelor-of-architecture` },
  { title: 'Bachelor of Arts in Media and Communication', level: 'bachelor', url: `${SITE}/undergraduate-degrees/media-and-design/bachelor-of-arts-in-media-and-communication` },
  // Biotechnology (bachelor)
  { title: 'Bachelor of Science in Biotechnology', level: 'bachelor', url: `${SITE}/undergraduate-degrees/biotechnology/bachelor-of-science-in-biotechnology` },
  // Social Science (bachelor)
  { title: 'Bachelor of Science in Psychology', level: 'bachelor', url: `${SITE}/undergraduate-degrees/social-science/bachelor-of-science-in-psychology` },
  // Graduate — Engineering (master)
  { title: 'Master of Science in Engineering Project Management', level: 'master', url: `${SITE}/graduate-degrees/engineering/master-of-science-in-engineering-project-management` },
  { title: 'Master of Science in Sustainable and Renewable Energy', level: 'master', url: `${SITE}/graduate-degrees/engineering/master-of-science-in-sustainable-and-renewable-energy` },
  { title: 'Level 9 Micro-Credential in Energy Efficiency and Management', level: 'short-course', url: `${SITE}/graduate-degrees/engineering/micro-credential-programs` },
  // Graduate — Education (master)
  { title: 'Master of Education: Educational Leadership', level: 'master', url: `${SITE}/graduate-degrees/education/master-of-education-educational-leadership` },
  // Graduate — Business (master)
  { title: 'Master of Business Administration (MBA)', level: 'master', url: `${SITE}/graduate-degrees/business/master-of-business-administration-mba` },
  { title: 'Executive Master of Business Administration', level: 'master', url: `${SITE}/graduate-degrees/business/executive-master-of-business-administration` },
];

function programBody(html) {
  const t = text(html);
  const i = t.search(/Home (Undergraduate|Graduate) Degrees/);
  return i >= 0 ? t.slice(i) : t;
}

function extractTuition(body) {
  // «Tuition Fees* 60,260 AED / 16,406 USD (per year)» — бакалавриат.
  // «Tuition Fees* 2,520 AED / 686 USD (per CH)» — магистратура (не едет).
  // «Tuition Fees* 9,000 AED» — Micro-Credential, без «per …».
  const m = body.match(/Tuition Fees\*?\s*([\d,]+)\s*AED(?:\s*\/\s*([\d,]+)\s*USD)?\s*(?:\(per\s*([A-Za-z]+)\))?/);
  if (!m) return null;
  const amount = Number(m[1].replace(/,/g, ''));
  const per = (m[3] || '').toLowerCase();
  const basis = per === 'year' ? 'year' : per === 'ch' ? 'credit' : null; // null = flat (Micro-Credential)
  return { amount, basis, raw: m[0].trim() };
}

export default {
  slug: 'american-university-of-ras-al-khaimah-aurak',
  site: SITE,
  async collect({ log }) {
    const programs = [];
    const fees = [];
    const gaps = [];

    for (const p of PROGRAMS) {
      programs.push({ title: p.title, level: p.level, url: p.url });
      let html;
      try {
        html = get(p.url);
      } catch (e) {
        gaps.push({ why: `страница не открылась: ${e.message}`, url: p.url });
        await sleep(500);
        continue;
      }
      const body = programBody(html);
      const t = extractTuition(body);
      if (!t) {
        gaps.push({ why: 'на странице не нашлась строка Tuition Fees*', url: p.url });
        await sleep(500);
        continue;
      }
      if (t.basis === 'year') {
        fees.push({
          amount: t.amount, currency: 'AED', basis: 'year', audience: null,
          scope: 'program', title: p.title, level: p.level,
          programUrl: p.url, url: p.url, raw: t.raw,
        });
        log(`${p.title}: ${t.amount} AED/year`);
      } else if (t.basis === 'credit') {
        // Магистратура AURAK — тариф за credit hour, не за год/программу целиком.
        // В каталог не едет (basis: 'credit'), отдаём для отчёта.
        fees.push({
          amount: t.amount, currency: 'AED', basis: 'credit', audience: null,
          scope: 'program', title: p.title, level: p.level,
          programUrl: p.url, url: p.url, raw: t.raw,
        });
        log(`${p.title}: ${t.amount} AED/CH (credit, не едет)`);
      } else {
        // Micro-Credential: одна сумма без «per …» — цена за весь курс (1 семестр).
        fees.push({
          amount: t.amount, currency: 'AED', basis: 'program', audience: null,
          scope: 'program', title: p.title, level: p.level,
          programUrl: p.url, url: p.url, raw: t.raw,
        });
        log(`${p.title}: ${t.amount} AED (program)`);
      }
      await sleep(500);
    }

    gaps.push({ why: '«Minor in Artificial Intelligence» — минор (довесок к другой степени, не отдельная программа с приёмом), пропущен', url: `${SITE}/undergraduate-degrees/engineering/minor-in-artificial-intelligence` });
    gaps.push({ why: 'English Language Training — курсы подготовки к IELTS/TOEFL через CEPE, не программа со своей страницей приёма', url: `${SITE}/admissions/english-language-training` });
    gaps.push({ why: 'Cost of Attendance breakdown для Architecture — только в PDF, не разбираем (нет парсера PDF в _lib.mjs), цена за год для Architecture уже взята с её страницы', url: `${SITE}/storage/public_documents/files/aurak/Cost%20of%20Attendance%20and%20Additional%20Expenses.pdf` });

    return { programs, fees, gaps };
  },
};
