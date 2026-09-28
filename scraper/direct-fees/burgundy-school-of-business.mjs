// burgundy-school-of-business.mjs — bsb-education.com (France, EUR).
//
// Разведка 28.09.2026:
// - Список программ живёт на французской сводной странице
//   https://www.bsb-education.com/fr/formation/trouver-ma-formation — те же карточки,
//   что уже разбирает scraper/kompas-collect-a1.mjs (см. его 'burgundy-school-of-business',
//   строки ~184-210): ссылка /fr/formation/<slug>, подпись «Bachelor … Bac +N» отличает
//   настоящую программу от раздела. Отсюда же и title в карточке каталога — переиспользуем
//   ровно ту же логику разбора, чтобы наши fee.title совпали с card.programs[].title дословно.
// - Цена не на сводной странице, а на странице самой программы. У французской версии
//   /fr/formation/<slug> есть английский двойник /en/programme/<slug> (тот же последний
//   сегмент пути почти всегда) с понятным блоком-вопросом «What are the tuition fees for …?» —
//   разбираем именно его, суммы в EUR.
// - Формат внутри блока плавает: одна общая цена за курс («MBA … are €35,500»,
//   «MSc … are €16,500» / «…€28,100» для двух стартов), явная годовая («DBA … €15,000
//   per year»), и погодовая для бакалавриата/Grande École («Entry into Bachelor 1: €9,500 —
//   Bachelor 2: €9,800 — Bachelor 3: €9,000», «Master 1: €15,000, then 15,600€ for Master 2»).
//   Basis назначается по формулировке блока: «per year» или разбивка по курсам/годам → year,
//   иначе — program (общая цена курса). Сайт нигде не делит EU / non-EU — audience не проставлен.
// - Не найдено: цены для программ на альтернансе (Bachelor Business Development,
//   Bachelor Data & Web) — там обучение оплачивает работодатель, собственной цены нет
//   (это не 0 и не цена — в gaps). Часть french-слагов не совпадает с английским URL один
//   в один (напр. bachelor-marketing-communication vs en/programme/bachelor-marketing-du-luxe…) —
//   такие уходят в gaps по 404.

import { get, text, anchors, sleep } from './_lib.mjs';

const FR_LIST = 'https://www.bsb-education.com/fr/formation/trouver-ma-formation';

function levelFromDegree(degree) {
  return /^(dba|doctorate)$/i.test(degree) ? 'phd'
    : /^(mast|msc|mba|ms)/i.test(degree) ? 'master' : 'bachelor';
}

/** Список программ — та же логика, что в kompas-collect-a1.mjs, чтобы title совпал с карточкой. */
function collectPrograms(listHtml) {
  const out = [];
  for (const a of anchors(listHtml, FR_LIST)) {
    if (!/\/formation\/[a-z0-9-]+$/.test(a.href)) continue;
    const m = a.text.match(/^(Bachelor|Mast[eè]re|Master|MSc|MBA|DBA|Doctorate)\s+(.*?)\s+Bac\s*\+\s*(\d)/i);
    if (!m) continue;
    const degree = m[1];
    const words = `${degree} ${m[2]}`.replace(/\s+/g, ' ').trim().split(' ');
    const title = (words[1] && words[0].toLowerCase() === words[1].toLowerCase()
      ? words.slice(1) : words).join(' ');
    const level = levelFromDegree(degree);
    out.push({ title, level, url: a.href, frUrl: a.href });
  }
  return out;
}

const STOP_MARKERS = ['Find all the details', '💡', 'Funding Solutions', 'Additional information',
  'FAQ –', 'FAQ —', 'Ready to', 'Objectives of the programme', 'BSB —', 'BSB carries out'];

/**
 * Вырезает блок с ценой курса. Якорь — «the tuition fees for …»: он общий и для
 * вопроса-подзаголовка («What are the tuition fees for the Bachelor…?»), и для
 * обычного абзаца без вопроса («…the tuition fees for the Global Doctorate … are
 * €15,000 per year», встречается на странице DBA). null, если якоря нет вовсе.
 */
function tuitionBlock(pageText) {
  const q = pageText.search(/the tuition fees for/i);
  if (q === -1) return null;
  let w = pageText.slice(q, q + 700);
  let cut = w.length;
  for (const s of STOP_MARKERS) { const i = w.indexOf(s); if (i > 0 && i < cut) cut = i; }
  return w.slice(0, cut);
}

/** Суммы EUR из блока + основа (year — если явно «per year» или разбивка по годам/курсам). */
function amountsFromBlock(block) {
  const perYear = /per year|each year/i.test(block);
  const byYear = /entry (in|into) (bachelor|master)\s*\d?/i.test(block)
    || /\b(bachelor|master)\s*(year\s*)?[123]\b/i.test(block) || /\byear\s*[123]\s*entry\b/i.test(block);
  const basis = perYear || byYear ? 'year' : 'program';
  // Суммы в порядке появления в блоке.
  const amounts = [...block.matchAll(/€\s?([\d][\d,\.]*)|([\d][\d,\.]*)\s?€/g)]
    .map((m) => (m[1] || m[2]).replace(/[,\.]/g, ''));
  // Разбивка по курсам («Entry into Bachelor 1: €9,500 — Bachelor 2: €9,800 — Bachelor 3: €9,000»):
  // цена программы — первый курс. Вход сразу на третий курс — другой маршрут, и по правилу
  // минимума его сумма занижала бы цену всей программы (28.09.2026).
  // Без разбивки первой стоит основная цена: дальше в блоке идут вторичные варианты —
  // «CIVS … full time are €16,000. For the CIVS part-time … €13,000», и минимум
  // выбирал бы заочную (28.09.2026).
  const keep = amounts.slice(0, 1);
  return keep.map((a) => ({ amount: Number(a), basis }));
}

export default {
  slug: 'burgundy-school-of-business',
  site: 'https://www.bsb-education.com',
  async collect({ log }) {
    const listHtml = get(FR_LIST);
    await sleep(500);
    const programs = collectPrograms(listHtml);
    log(`programs on fr list: ${programs.length}`);

    const fees = [];
    const gaps = [];
    // Значимые слова названия — чтобы понять, про ту ли программу английская страница.
    const GENERIC = new Set(['bachelor', 'master', 'mastere', 'mastère', 'science', 'msc', 'mba', 'dba',
      'specialise', 'spécialisé', 'management', 'business', 'programme', 'program']);
    const words = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .split(/[^a-z]+/).filter((w) => w.length > 3 && !GENERIC.has(w));
    for (const p of programs) {
      // Альтернанс: обучение оплачивает работодатель, сумма в блоке — сбор, а не цена (28.09.2026).
      if (/altern|apprentice/i.test(p.title)) { gaps.push({ why: 'альтернанс — обучение оплачивает работодатель, цены нет', url: p.frUrl }); continue; }
      const enUrl = p.frUrl.replace('/fr/formation/', '/en/programme/');
      let html;
      try {
        html = get(enUrl);
      } catch (e) {
        gaps.push({ why: `страница не открылась (${String(e.message || e).split('\n')[0]})`, url: enUrl });
        await sleep(500);
        continue;
      }
      await sleep(500);
      const pageText = text(html);
      const block = tuitionBlock(pageText);
      if (!block) { gaps.push({ why: 'на странице программы нет блока «What are the tuition fees»', url: enUrl }); continue; }
      // Английский слаг иногда ведёт на страницу ДРУГОЙ программы (Bachelor Wine Tourism →
      // International Sustainable Management). Блок называет программу сам: если ни одно
      // значимое слово нашего названия в нём не встречается, а слова другой программы
      // списка встречаются — это чужая цена.
      const head = block.slice(0, 160).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const own = words(p.title);
      const ownHit = own.some((w) => head.includes(w));
      const other = programs.find((q) => q !== p && words(q.title).length
        && words(q.title).every((w) => head.includes(w)) && !words(q.title).every((w) => own.includes(w)));
      if (own.length && !ownHit && other) {
        gaps.push({ why: `английская страница про другую программу («${other.title}»)`, url: enUrl });
        continue;
      }
      const found = amountsFromBlock(block);
      if (!found.length) { gaps.push({ why: 'блок про tuition fees есть, но сумма в EUR не распозналась', url: enUrl }); continue; }
      for (const f of found) {
        fees.push({
          amount: f.amount, currency: 'EUR', basis: f.basis, audience: null,
          scope: 'program', title: p.title, level: p.level,
          programUrl: enUrl, url: enUrl, raw: block,
        });
      }
    }
    return { programs, fees, gaps };
  },
};
