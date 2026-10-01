// Проверка прямых партнёров по выгрузкам (шаг 2 передачи 30.09.2026), без сети.
// Читает отчёт сухого прогона `kompas-direct-fees.mjs --from-extracts --add-programs`
// (sources/kompas/direct-fees-report.json) и ставит каждому вузу флажки того,
// что надо посмотреть глазами. Вердикт ставит человек — скрипт только сужает круг.
//
//   node scraper/kompas-direct-fees.mjs --from-extracts --add-programs   (сухой, пишет отчёт)
//   node scraper/kompas-direct-review.mjs                                → sources/kompas/direct-review.json

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORT = path.join(ROOT, 'sources/kompas/direct-fees-report.json');
const EX = path.join(ROOT, 'sources/kompas/extracts/direct-fees');
const OUT = path.join(ROOT, 'sources/kompas/direct-review.json');

// Название, которое больше похоже на пункт меню или служебную страницу, чем на программу.
const JUNK = /^(apply|fees?|tuition|admissions?|scholarships?|contact|about|news|events?|home|faculty|faculties|programmes?|programs?|courses?|study|undergraduate|postgraduate|overview|read more|learn more)\b|https?:|\.php|\.html?$|^\/|\b(deadline|open day|webinar|accommodation|visa)\b|[一-鿿]/i;
const looksJunk = (t) => !t || t.length < 4 || t.length > 140 || JUNK.test(t) || /^[a-z0-9-]+$/.test(t);

const raw = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
const plans = Array.isArray(raw) ? raw : raw.plans || [];
const out = [];
for (const p of plans) {
  const ex = JSON.parse(fs.readFileSync(path.join(EX, `${p.slug}.json`), 'utf8'));
  const siteTitles = (ex.programs || []).map((x) => x.title);
  const dupSite = siteTitles.length - new Set(siteTitles.map((t) => String(t).toLowerCase())).size;
  const junkSite = siteTitles.filter(looksJunk);
  const noLevel = (ex.programs || []).filter((x) => !x.level).length;
  const flags = [];
  if (!siteTitles.length) flags.push('сайт не отдал список программ');
  if (junkSite.length) flags.push(`мусорных названий на сайте: ${junkSite.length}`);
  if (dupSite) flags.push(`повторов названий в выгрузке: ${dupSite}`);
  if (noLevel) flags.push(`без уровня: ${noLevel}`);
  if (p.cardPrograms && siteTitles.length && p.cardPrograms > 2 * siteTitles.length) flags.push(`в карточке в ${(p.cardPrograms / siteTitles.length).toFixed(1)} раза больше, чем на сайте`);
  if ((p.addedPrograms || 0) > 0.5 * Math.max(siteTitles.length, 1) && p.cardPrograms > 5) flags.push(`«новых» больше половины сайта: ${p.addedPrograms}`);
  if (p.implausible) flags.push(`цен вне диапазона: ${p.implausible}`);
  if ((p.rejected || []).length) {
    const why = {};
    for (const r of p.rejected) why[r.why || r.reason] = (why[r.why || r.reason] || 0) + 1;
    flags.push(`отбито цен: ${Object.entries(why).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  }
  out.push({
    slug: p.slug,
    site: siteTitles.length, card: p.cardPrograms, added: p.addedPrograms ?? null,
    cardNotOnSite: p.cardProgramsNotOnSite, feeRows: p.feeRows, newPrices: p.newPrices,
    gaps: (ex.gaps || []).length,
    flags,
    junkSample: junkSite.slice(0, 5),
    addedSample: (p.addedProgramsSample || []).slice(0, 8),
    cardNotOnSiteSample: (p.cardProgramsNotOnSiteSample || []).slice(0, 5),
  });
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');
for (const r of out) console.log(`${r.slug.padEnd(46)} сайт ${String(r.site).padStart(3)} карт ${String(r.card).padStart(3)} +${String(r.added).padStart(3)} цен+${String(r.newPrices).padStart(3)}  ${r.flags.join('; ')}`);
