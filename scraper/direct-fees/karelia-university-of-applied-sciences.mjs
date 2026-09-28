// karelia-university-of-applied-sciences.mjs — karelia.fi (Joensuu, Finland, EUR).
//
// Разведка 28.09.2026:
// - Всё на одной странице https://www.karelia.fi/en/tuition-fees/, разделе «As of
//   1.1.2023 at Karelia UAS the tuition fee for non-EU/EEA students are following»:
//   по программе на строку — «International Business 9 000 € / academic year»,
//   «Industrial Management 9 000 € / academic year», «Information and Communication
//   Technology 10 000 € / academic year» (все bachelor's), «Sustainability Management
//   10 500 € / academic year» (master's). Audience прямо назван non-EU/EEA →
//   'international'; EU/EEA/Швейцария и финские граждане освобождены от платы вовсе —
//   у них цены нет (это не 0, отдельной строки для EU не будет).
// - «Early-bird priced tuition fee … -20%» — скидка за раннюю оплату, не берём (правило 3).
// - Название на странице голое («International Business»), в карточке — полное
//   («Bachelor of Business Administration (BBA), International Business» /
//   «Insinööri (AMK), Industrial Management - Karelia-ammattikorkeakoulu»), общей
//   приставки степени нет, поэтому обычное сопоставление по названию (в т.ч. tier-3
//   «без приставки») не сработает. У карточки, однако, есть programUrl на англоязычные
//   страницы этих двух программ (.../education/bachelor-s-degrees/international-business
//   и .../industrial-management) — используем их как programUrl строки цены, тогда
//   program-match.mjs сопоставит по ссылке (tier-1), название неважно.
// - Card уже знает «BBA in International Business» (edvoy, 9000 EUR) — цена совпадает,
//   ничего нового туда не добавится. «Information and Communication Technology» и
//   «Sustainability Management» в карточке программ нет — эти строки уйдут в
//   несопоставленные, это не ошибка парсера, а пробел карточки.

import { get, text, sleep } from './_lib.mjs';

const URL = 'https://www.karelia.fi/en/tuition-fees/';
const BASE_PROGRAMS = 'https://www.karelia.fi/en/courses-for-exchange-students/en/education/bachelor-s-degrees/';

// Известные из карточки соответствия «голое имя со страницы» → programUrl.
const KNOWN = {
  'International Business': { level: 'bachelor', programUrl: `${BASE_PROGRAMS}international-business` },
  'Industrial Management': { level: 'bachelor', programUrl: `${BASE_PROGRAMS}industrial-management` },
};

export default {
  slug: 'karelia-university-of-applied-sciences',
  site: 'https://www.karelia.fi',
  async collect({ log }) {
    const html = get(URL);
    await sleep(500);
    const pageText = text(html);
    const i = pageText.search(/tuition fee for non-eu\/eea students are following/i);
    if (i === -1) return { programs: [], fees: [], gaps: [{ why: 'не нашёлся абзац с ценами non-EU/EEA', url: URL }] };
    const j = pageText.indexOf('Early-bird priced tuition fee', i);
    const block = pageText.slice(i, j > i ? j : i + 900);
    log(`block: ${block.slice(0, 200)}`);

    const fees = [];
    const gaps = [];
    for (const m of block.matchAll(/[-‐-―]?\s*([A-Za-z][A-Za-z &]+?)\s+([\d][\d\s]*)\s*€\s*\/\s*academic year/g)) {
      const name = m[1].trim();
      const amount = Number(m[2].replace(/\s+/g, ''));
      const known = KNOWN[name];
      const level = known?.level ?? (/master/i.test(block.slice(Math.max(0, m.index - 60), m.index)) ? 'master' : 'bachelor');
      fees.push({
        amount, currency: 'EUR', basis: 'year', audience: 'international', scope: 'program',
        title: name, level, programUrl: known?.programUrl, url: URL, raw: m[0].trim(),
      });
    }
    if (!fees.length) gaps.push({ why: 'абзац найден, но строки формата «Название X 000 € / academic year» не распознались', url: URL });
    return { programs: [], fees, gaps };
  },
};
