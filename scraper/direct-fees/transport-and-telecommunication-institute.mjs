// transport-and-telecommunication-institute.mjs — tsi.lv (Riga, Latvia, EUR).
//
// Разведка 28.09.2026:
// - Программы — отдельный тип записей WordPress, список в
//   https://tsi.lv/study_programmes-sitemap.xml; английские страницы без /lv/ и /ru/
//   префикса — https://tsi.lv/study_programmes/<slug>/ (18 штук на 28.09.2026).
// - На каждой странице программы есть поле «Study Level» (Bachelor's / Master's /
//   Doctoral) и блок «Tuition & study formats» с ценой по формату обучения:
//   «Full-time €3300 /year 🇪🇺🇺🇦 €3900 /year 🌏︎», «Part-time €2300 /year 🇪🇺🇺🇦»,
//   «Blended Learning €2500 /year 🇪🇺🇺🇦🌏︎» (пример — Computer Sciences).
//   Флаг ЕС/Украины — audience 'eu', глобус — audience 'international'; если у формата
//   оба значка сразу (одна цена на всех) — отдаём обе строки с одинаковой суммой.
//   Основа всегда 'year' — сайт сам пишет «/year».
// - Заголовок программы (h1, «Computer Science») короче названия в карточке
//   («Bachelor in Computer Science») — совпадают через третью, «без приставки степени»
//   ступень program-match.mjs (уровень известен с обеих сторон через Study Level → level).
// - Не найдено: цены для double-degree страниц с колонкой доп. партнёра (UWE Bristol и
//   т.п.) — там часто только формат «Full-time» с одной ценой, без EU/international
//   разбивки; берём как есть, audience не проставляем, если значка нет вовсе.
// - Три страницы (digital-economy-and-business, telematics-and-logistics,
//   transport-and-logistics — все master/phd) вообще без блока «Tuition & study
//   formats»: там простая HTML-таблица «Tuition Fee 2026/2027 Acad. Year» —
//   строка «Duration», строка «Tuition fee EUR/year» — без EU/international, audience
//   не проставлен.

import { get, text, tableRows, sleep } from './_lib.mjs';

const SITEMAP = 'https://tsi.lv/study_programmes-sitemap.xml';
const PAGE_RE = /^https:\/\/tsi\.lv\/study_programmes\/[a-z0-9-]+\/$/;

const LEVEL_WORDS = [[/doctoral|phd/i, 'phd'], [/master/i, 'master'], [/bachelor/i, 'bachelor']];
const MODE_LABELS = ['Full-time', 'Part-time', 'Blended Learning', 'Online', 'Weekend', 'Evening', 'Distance Learning'];

const GLOBE = /[\u{1F30D}-\u{1F30F}]/u;
const FLAG = /[\u{1F1E6}-\u{1F1FF}]/u;

function studyLevel(pageText) {
  const m = pageText.match(/Study Level\s*([A-Za-z' ]+?)(?:Study Form|Language|$)/);
  const label = m ? m[1] : '';
  for (const [re, level] of LEVEL_WORDS) if (re.test(label)) return level;
  return null;
}

/** Строки цены из блока «Tuition & study formats». */
function tuitionFees(pageText, url) {
  const i = pageText.search(/tuition\s*(&|and)\s*study formats/i);
  if (i === -1) return [];
  const seg = pageText.slice(i, i + 600);
  const labelHits = MODE_LABELS.map((l) => ({ l, idx: seg.indexOf(l) })).filter((h) => h.idx !== -1);
  const out = [];
  for (const m of seg.matchAll(/€\s?([\d,]+)\s*\/\s*year\s*([^\d€]{0,16})/g)) {
    const amount = Number(m[1].replace(/,/g, ''));
    const marker = m[2];
    const mode = labelHits.filter((h) => h.idx <= m.index).sort((a, b) => b.idx - a.idx)[0]?.l ?? null;
    const raw = `${mode ?? ''} €${m[1]} /year ${marker}`.trim();
    const audiences = [];
    if (FLAG.test(marker)) audiences.push('eu');
    if (GLOBE.test(marker)) audiences.push('international');
    if (!audiences.length) audiences.push(null);
    for (const audience of audiences) out.push({ amount, currency: 'EUR', basis: 'year', audience, raw, mode });
  }
  return out;
}

/** Запасной разбор: HTML-таблица «Tuition Fee … Acad. Year» без блока-виджета. */
function tuitionTable(html, url) {
  const rows = tableRows(html);
  const header = rows.find((r) => r.some((c) => /full time|part time/i.test(c)));
  const feeRow = rows.find((r) => /tuition fee/i.test(r[0] || ''));
  if (!header || !feeRow) return [];
  const out = [];
  for (let i = 1; i < feeRow.length; i++) {
    const m = feeRow[i].match(/([\d,]+)\s*EUR/i);
    if (!m) continue;
    const mode = header[i] || null;
    out.push({
      amount: Number(m[1].replace(/,/g, '')), currency: 'EUR', basis: 'year', audience: null,
      raw: `${mode ?? ''}: ${feeRow[i]}`.trim(), mode,
    });
  }
  return out;
}

export default {
  slug: 'transport-and-telecommunication-institute',
  site: 'https://tsi.lv',
  async collect({ log }) {
    const smXml = get(SITEMAP);
    await sleep(500);
    const urls = [...smXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter((u) => PAGE_RE.test(u));
    log(`programme pages: ${urls.length}`);

    const programs = [];
    const fees = [];
    const gaps = [];
    for (const url of urls) {
      let html;
      try {
        html = get(url);
      } catch (e) {
        gaps.push({ why: `страница не открылась (${String(e.message || e).split('\n')[0]})`, url });
        await sleep(500);
        continue;
      }
      await sleep(500);
      const pageText = text(html);
      const h1m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      const title = h1m ? text(h1m[1]) : null;
      if (!title) { gaps.push({ why: 'на странице нет h1 — не понять название программы', url }); continue; }
      const level = studyLevel(pageText);
      programs.push({ title, level, url });
      let found = tuitionFees(pageText, url);
      if (!found.length) found = tuitionTable(html, url);
      if (!found.length) { gaps.push({ why: 'ни блока «Tuition & study formats», ни таблицы «Tuition Fee … Acad. Year» на странице нет', url }); continue; }
      for (const f of found) {
        fees.push({ ...f, scope: 'program', title, level, programUrl: url, url });
      }
    }
    return { programs, fees, gaps };
  },
};
