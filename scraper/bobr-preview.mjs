#!/usr/bin/env node
// Generate a single contact-sheet HTML for the BOBR pilot unis so photo quality,
// duplicates and people-ratio can be eyeballed fast — no Astro build, no deploy.
// Output: site/public/bobr-preview.html  (open via file://). Photo paths relative.

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG = resolve(ROOT, 'site/src/content/universities');
const OUT = resolve(ROOT, 'site/public/bobr-preview.html');

const ALL = process.argv.includes('--all');
const PILOT = ['glasgow','aalto-university','aarhus-university','anglia-ruskin','3a-france','arden','gisma','arizona-state','alberta','adelaide','murdoch','bangor','abertay','avila','concordia-chicago','ue-germany','massey','lim-college'];
const LIST = ALL
  ? (await readdir(CATALOG)).filter(f=>f.endsWith('.json')).map(f=>f.replace(/\.json$/,'')).sort()
  : PILOT;

// preview sits in site/public/, so "/photos/x" -> "photos/x"; external https kept.
const rel = (u) => !u ? '' : (/^https?:/i.test(u) ? u : u.replace(/^\//,''));
const esc = (s='') => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function tiles(label, items, kind){
  if(!items.length) return ''; // omit empty sections entirely — no green «пусто»
  const cells = items.map(it => {
    const img = rel(it.img);
    const cap = esc(it.title || it.caption || it.name || '');
    if(!img) return `<figure class="ph"><figcaption>${cap||'нет фото'}</figcaption></figure>`;
    return `<figure><img loading="lazy" src="${esc(img)}" alt=""><figcaption>${cap}</figcaption></figure>`;
  }).join('');
  return `<div class="slot"><div class="lab">${label} <b>(${items.length})</b></div><div class="grid ${kind}">${cells}</div></div>`;
}

const blocks = [];
let stats = { ok:0, gap:0 };
for(const slug of LIST){
  let u;
  try{ u = JSON.parse(await readFile(join(CATALOG, slug+'.json'),'utf8')); }
  catch{ blocks.push(`<section><h2>${slug}</h2><p style="color:#c00">JSON не найден</p></section>`); continue; }
  const g = u.gallery?.items ?? [];
  const camp = (u.campuses??[]).map(c => ({ img:c.img, title:c.title }));
  const acc = (u.accommodation??[]).map(a => ({ img:a.img, title:(a.name||'')+(a.price?` · ${a.price}`:'') }));
  const hero = g[0]?.img;
  const heroJunk = hero && /collabinternational/i.test(hero);
  if(hero) stats.ok++; else stats.gap++;
  blocks.push(`
  <section>
    <h2>${esc(u.name)} <span class="slug">${slug}</span> <span class="meta">${esc(u.country||u.location?.country||'')}</span>${heroJunk?' <span class="warn">JUNK CDN!</span>':''}</h2>
    <div class="hero-row">
      ${hero?`<figure class="hero"><img loading="lazy" src="${esc(rel(hero))}" alt=""><figcaption>HERO</figcaption></figure>`:`<figure class="hero ph"><figcaption>HERO — плейсхолдер</figcaption></figure>`}
      ${tiles('Галерея после hero', g.slice(1,5), 'sm')}
    </div>
    ${tiles('Кампусы', camp, 'sm')}
    ${tiles('Размещение', acc, 'sm')}
    ${(camp.length===0 && acc.length===0 && (u.photoSets?.general?.length)) ? tiles('Фотогалерея университета (вместо пустого раздела)', u.photoSets.general, 'sm') : ''}
  </section>`);
}

const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>БОБР — контакт-лист (${LIST.length} вузов)</title>
<style>
:root{--g:#00950f}
*{box-sizing:border-box}
body{font:15px/1.5 system-ui,'Segoe UI',Arial;margin:0;background:#f6f7f8;color:#111}
header{position:sticky;top:0;background:#fff;border-bottom:2px solid var(--g);padding:14px 20px;z-index:5}
header h1{margin:0;font-size:18px}
header p{margin:4px 0 0;color:#555;font-size:13px}
section{background:#fff;margin:16px;border:1px solid #e5e5e5;border-radius:12px;padding:16px}
h2{font-size:17px;margin:0 0 12px}
.slug{color:#888;font-weight:400;font-size:13px}
.meta{color:#00950f;font-size:12px;font-weight:700;text-transform:uppercase;margin-left:6px}
.warn{background:#c00;color:#fff;font-size:11px;padding:2px 8px;border-radius:999px}
.hero-row{display:grid;grid-template-columns:1fr 2fr;gap:14px;align-items:start;margin-bottom:12px}
@media(max-width:700px){.hero-row{grid-template-columns:1fr}}
.slot{margin:10px 0}
.lab{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#666;margin-bottom:6px}
.lab em{color:#b00;text-transform:none}
.grid{display:grid;gap:8px}
.grid.sm{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
figure{margin:0;border:1px solid #e5e5e5;border-radius:8px;overflow:hidden;background:#fafafa}
figure img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover}
figure.hero img{aspect-ratio:4/3}
figcaption{font-size:11px;color:#555;padding:4px 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ph{display:grid;place-items:center;min-height:110px;background:linear-gradient(135deg,#d0e8d2,#00950f);color:#fff;font-weight:700;font-size:12px;text-align:center;padding:8px}
.ph figcaption{color:#fff}
</style></head><body>
<header><h1>БОБР — контакт-лист фото (${LIST.length} вузов)</h1>
<p>Проверь: дубли, повторяющиеся люди, люди на весь кадр, виден ли сам универ. Зелёный блок = честный плейсхолдер (фото не нашлось). Сгенерировано ${new Date().toISOString().slice(0,16).replace('T',' ')}.</p></header>
${blocks.join('\n')}
</body></html>`;

await writeFile(OUT, html, 'utf8');
console.log('wrote', OUT);
console.log('open: file:///' + OUT.replace(/\\/g,'/').replace(/^\/?/,''));
