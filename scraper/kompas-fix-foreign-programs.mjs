#!/usr/bin/env node
// kompas-fix-foreign-programs.mjs — снять с карточки программы ДРУГОГО вуза.
//
// Откуда взялись. Майский матчер Kaplan требовал лишь вхождения слов названия вуза
// в имя института фида: «Bristol» входит в «University of the West of England,
// Bristol», «chester» — в «Pace University, Westchester», «Hartford Campus»
// Коннектикутского университета сел на University of Hartford. Так на карточках
// оказались сотни программ чужих вузов — со ссылками на чужой сайт и с чужими
// ценами. Сверка 18.09 показала их как «программы, ведущие на сайт другого вуза»
// (nottingham → ntu.ac.uk 199, bristol → uwe.ac.uk 118 …).
//
// Что снимаем: только пары, где домен ссылки принадлежит ДРУГОМУ учебному
// заведению, а не родне карточки (ISC-центры, дубайские кампусы, дубли карточек
// — это слияние, решение владельца, здесь не трогаем). Список пар — явный,
// каждая с причиной. Вместе с программой уходят её цена и прочие попрограммные
// записи (*.byProgram).
//
// Запуск: node scraper/kompas-fix-foreign-programs.mjs           # отчёт
//         node scraper/kompas-fix-foreign-programs.mjs --apply   # запись в живой каталог

import fs from 'node:fs';
import path from 'node:path';

const LIVE = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'site', 'src', 'content', 'universities');
const APPLY = process.argv.includes('--apply');

const FOREIGN = [
  { slug: 'nottingham', domain: 'ntu.ac.uk', reason: 'Nottingham Trent University — другой вуз; однофамилец по городу' },
  { slug: 'bristol', domain: 'uwe.ac.uk', reason: 'UWE Bristol — другой вуз; майский матчер Kaplan нашёл «Bristol» в имени UWE' },
  { slug: 'hartford', domain: 'uconn.edu', reason: 'University of Connecticut, Hartford Campus — другой вуз; матчер взял слово «Hartford»' },
  { slug: 'chester', domain: 'pace.edu', reason: 'Pace University, Westchester — другой вуз; матчер нашёл «chester» внутри «Westchester»' },
  { slug: 'liverpool', domain: 'xjtlu.edu.cn', reason: "Xi'an Jiaotong-Liverpool University — отдельный вуз в Китае, не кампус Ливерпуля" },
];

const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return null; } };
const onDomain = (u, d) => { const h = host(u); return !!h && (h === d || h.endsWith('.' + d)); };

let totalRemoved = 0;
for (const rule of FOREIGN) {
  const file = path.join(LIVE, rule.slug + '.json');
  const raw = fs.readFileSync(file, 'utf8');
  const crlf = raw.includes('\r\n');
  const card = JSON.parse(raw);
  const drop = (card.programs || []).filter((p) => onDomain(p.programUrl || '', rule.domain));
  const dropSlugs = new Set(drop.map((p) => p.slug));
  const bySource = drop.reduce((o, p) => (o[p.source || 'без источника'] = (o[p.source || 'без источника'] || 0) + 1, o), {});
  let pricesDropped = 0;
  if (APPLY && drop.length) {
    card.programs = card.programs.filter((p) => !dropSlugs.has(p.slug));
    for (const [k, v] of Object.entries(card)) {
      if (v && typeof v === 'object' && v.byProgram && typeof v.byProgram === 'object') {
        for (const s of dropSlugs) if (s in v.byProgram) { delete v.byProgram[s]; if (k === 'tuition') pricesDropped++; }
      }
    }
    // `deadlines` лежит прямо на карточке и тоже ключуется слагом программы; схема
    // сайта требует, чтобы программа существовала (урок 20.09: деплой упал на
    // «deadlines reference unknown program slug» — гейт каталога этого не ловит).
    if (card.deadlines && typeof card.deadlines === 'object') for (const s of dropSlugs) delete card.deadlines[s];
    let out = JSON.stringify(card, null, 2) + '\n';
    if (crlf) out = out.replace(/\n/g, '\r\n');
    fs.writeFileSync(file, out);
  } else {
    pricesDropped = [...dropSlugs].filter((s) => card.tuition?.byProgram?.[s] != null).length;
  }
  totalRemoved += drop.length;
  console.log(`${rule.slug.padEnd(12)} ${rule.domain.padEnd(14)} снять ${String(drop.length).padStart(3)} программ (${JSON.stringify(bySource)}), цен ${pricesDropped}; осталось ${(card.programs || []).length - (APPLY ? 0 : drop.length)} — ${rule.reason}`);
}
console.log(`${APPLY ? 'ЗАПИСАНО' : 'сухой прогон'}: снято программ ${totalRemoved}`);
