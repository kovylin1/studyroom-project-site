#!/usr/bin/env node
// orel-preview.mjs — HTML «было → стало» для просмотра кандидатов ГЛАЗАМИ.
//
// Зачем: цифра «найдено N кандидатов» ничего не говорит о качестве. В пилоте 1
// отчёт «55 кандидатов у 17 вузов» выглядел успехом, а глазами оказалось 6 брака
// из 7 — рекламная плашка, слово из букв скрэббла, портреты людей. В пилоте 3
// так же нашлись SVG-логотип под именем .jpg и ИИ-портрет с офсайта вуза.
// Ни один фильтр по имени файла и пропорциям этого не ловит.
//
// В КАТАЛОГ НЕ ПИШЕТ. Только читает и собирает страницу.
//
// Usage:
//   node scraper/orel-preview.mjs
//   node scraper/orel-preview.mjs --out=site/public/orel-preview.html

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CATALOG = path.join(ROOT, 'site/src/content/universities');
const CANDIDATES = path.join(ROOT, 'sources/photo-candidates.json');

const arg = (p) => (process.argv.find(a => a.startsWith(p)) || '').slice(p.length);
const OUT = path.resolve(ROOT, arg('--out=') || 'site/public/orel-preview.html');

const esc = (s = '') => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Страница лежит в site/public/, поэтому «/photos/x» → «photos/x»; внешние ссылки как есть.
const rel = (u) => (!u ? '' : (/^https?:/i.test(u) ? u : u.replace(/^\//, '')));

/** Все фото вуза из доменов, которые ОРЁЛ вправе менять, с их метками. */
function currentPhotos(uni) {
  const out = [];
  for (const it of uni.gallery?.items ?? []) {
    out.push({ img: it.img, kind: it.imgKind || 'unknown', caption: it.caption || '', domain: 'gallery' });
  }
  for (const c of uni.campuses ?? []) {
    out.push({ img: c.img, kind: c.imgKind || 'unknown', caption: c.title || '', domain: 'campuses' });
  }
  return out;
}

function photoCell(p) {
  const badge = `<span class="k k-${esc(p.kind)}">${esc(p.kind)}</span>`;
  if (!p.img) return `<figure class="miss"><figcaption>нет ссылки ${badge}</figcaption></figure>`;
  return `<figure><img loading="lazy" src="${esc(rel(p.img))}" alt="">`
    + `<figcaption>${badge} ${esc(p.caption).slice(0, 60)}</figcaption></figure>`;
}

function candCell(c) {
  // Провенанс показываем целиком: без автора и лицензии кандидат не годен к автозамене.
  const lic = c.imgLicense === 'official-site' ? 'офсайт' : esc(c.imgLicense || '—');
  const who = c.imgAuthor ? esc(c.imgAuthor).slice(0, 40) : '<i>автор неизвестен</i>';
  const src = c.imgSource ? `<a href="${esc(c.imgSource)}" target="_blank" rel="noopener">источник</a>` : '—';
  return `<figure><img loading="lazy" src="${esc(rel(c.img))}" alt="">`
    + `<figcaption><b>${lic}</b> · ${who} · ${src}<br><span class="dim">${c.width}×${c.height}</span></figcaption></figure>`;
}

async function main() {
  let report;
  try { report = JSON.parse(await fs.readFile(CANDIDATES, 'utf8')); }
  catch { console.error('Нет sources/photo-candidates.json — сначала прогоните orel-hunt.mjs'); process.exit(1); }

  const bySlug = new Map();
  for (const c of report.candidates) {
    if (!bySlug.has(c.slug)) bySlug.set(c.slug, []);
    bySlug.get(c.slug).push(c);
  }

  const sections = [];
  for (const [slug, cands] of [...bySlug].sort()) {
    let uni;
    try { uni = JSON.parse(await fs.readFile(path.join(CATALOG, `${slug}.json`), 'utf8')); }
    catch { continue; }
    const now = currentPhotos(uni);
    const replaceable = now.filter(p => p.kind === 'stock' || p.kind === 'shared' || p.kind === 'unknown');
    sections.push(`
<section>
  <h2>${esc(slug)} <span class="dim">${esc(uni.name || '')}</span></h2>
  <p class="dim">сейчас фото: ${now.length}, из них заменяемых: ${replaceable.length} · кандидатов: ${cands.length}</p>
  <div class="pair">
    <div class="col"><div class="lab">БЫЛО — что стоит сейчас</div><div class="grid">${now.map(photoCell).join('')}</div></div>
    <div class="col"><div class="lab">СТАЛО БЫ — кандидаты</div><div class="grid">${cands.map(candCell).join('')}</div></div>
  </div>
</section>`);
  }

  const net = report.network || {};
  const html = `<!doctype html><meta charset="utf-8"><title>ОРЁЛ — кандидаты на замену фото</title>
<style>
 body{font:14px/1.45 system-ui,sans-serif;margin:0;padding:24px;background:#f6f7f9;color:#111}
 h1{margin:0 0 4px} h2{margin:0 0 2px;font-size:17px}
 .dim{color:#666;font-weight:400}
 .warn{background:#fff3cd;border:1px solid #ffe08a;padding:10px 14px;border-radius:8px;margin:12px 0}
 section{background:#fff;border:1px solid #e3e5e9;border-radius:10px;padding:14px 16px;margin:14px 0}
 .pair{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:10px}
 .lab{font-weight:600;margin-bottom:6px;font-size:13px}
 .col:last-child .lab{color:#0a6}
 .grid{display:flex;flex-wrap:wrap;gap:8px}
 figure{margin:0;width:190px}
 figure img{width:190px;height:128px;object-fit:cover;border-radius:6px;background:#eee;display:block}
 figcaption{font-size:11px;color:#555;margin-top:3px;word-break:break-word}
 .miss{width:190px;height:128px;display:flex;align-items:center;justify-content:center;
       border:1px dashed #bbb;border-radius:6px;font-size:11px;color:#999}
 .k{display:inline-block;padding:0 5px;border-radius:4px;font-size:10px;color:#fff}
 .k-stock{background:#c0392b}.k-shared{background:#d68910}.k-unknown{background:#7f8c8d}.k-verified{background:#0a8}
</style>
<h1>ОРЁЛ — кандидаты на замену фото</h1>
<p class="dim">прогон ${esc(report.generatedAt || '')} · вузов запрошено ${report.requested} ·
кандидатов ${report.candidates.length} у ${bySlug.size} вузов ·
сеть: запросов ${net.requests ?? '?'}, торможений ${net.throttled ?? '?'}</p>
${net.throttled ? `<p class="warn"><b>Лимит Wikimedia срабатывал ${net.throttled} раз.</b>
Покрытие этого прогона занижено — не считайте его окончательным.</p>` : ''}
<p class="warn">Замена делается строго 1:1 и только после вашего одобрения. Из каталога
ничего не удаляется: чужое фото исчезает лишь тогда, когда на его место встало проверенное.</p>
${sections.join('\n')}
`;

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, html);
  console.log(`готово: ${path.relative(ROOT, OUT)} — ${report.candidates.length} кандидатов у ${bySlug.size} вузов`);
}

main().catch(e => { console.error('ФАТАЛЬНО:', e.message); process.exit(1); });
