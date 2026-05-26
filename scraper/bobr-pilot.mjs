#!/usr/bin/env node
// БОБР pilot — bring landing photos up to the glasgow-v2 standard for a small
// diverse set of unis, so the quality bar can be eyeballed before the full 760 run.
//
// Per uni:
//   1. Gather candidate images: Wikimedia Commons (name + "campus"), Wikipedia
//      lead image, existing local /photos/<slug>/ files, existing non-junk gallery URLs.
//   2. Download to a temp pool, read real dimensions (sharp), drop < MIN_WIDTH.
//   3. aHash (8x8) → drop near-duplicates (hamming <= DUP_DIST). No repeated shots.
//   4. Score: building/campus/aerial/interior positive; people/students/group negative
//      (people allowed only when a building signal is also present).
//   5. Assign: hero+gallery (top exterior/campus), campuses[].img (distinct per card),
//      accommodation[].img (residence-tagged, else distinct general). No repeats across slots.
//   6. Resize chosen → jpg q80 max 1600px → /photos/<slug>/bobr-N.jpg. Update JSON.
//      Junk CDN hotlinks (collabinternational etc.) are dropped entirely.
//   7. If nothing qualifies for a slot → leave img unset (template shows honest placeholder).
//
//   node bobr-pilot.mjs                 # run full pilot list
//   node bobr-pilot.mjs --slug glasgow  # single uni
//   node bobr-pilot.mjs --dry-run       # report only, no writes

import { readFile, writeFile, mkdir, readdir, access, rm } from 'node:fs/promises';
import { constants as FS } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { load as cheerioLoad } from 'cheerio';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CATALOG = resolve(ROOT, 'site/src/content/universities');
const PHOTOS = resolve(ROOT, 'site/public/photos');
const LOG = resolve(ROOT, 'sources/bobr.log');

const UA = 'studyroom-bobr/1.0 (https://studyroom-project-site.pages.dev; vassiliy.kovylin@gmail.com)';
const WM_API = 'https://commons.wikimedia.org/w/api.php';

const MIN_WIDTH = 800;        // drop anything narrower
const DUP_DIST = 6;           // aHash hamming distance treated as duplicate
const THUMB_W = 1600;         // request this width from Commons
const OUT_W = 1600;           // final stored width
const GALLERY_TARGET = 6;     // hero + up to 5 strip tiles
const REQ_DELAY = 200;

const PILOT = [
  'glasgow',            // UK partner, photos live in campuses[] but gallery empty
  'aalto-university',   // junk collab-CDN, no campus/accom — gap demo
  'aarhus-university',  // junk collab-CDN, Denmark
  'anglia-ruskin',      // junk collab-CDN, UK (real uni)
  '3a-france',          // wikimedia hotlinks, France, has campus+accom
  'arden',              // photoSets, 18 campuses — heavy dedup test
  'gisma',              // photoSets, Germany
  'arizona-state',      // US, large
  'alberta',            // Canada
  'adelaide',           // Australia (official-degree-scraper)
  'murdoch',            // Australia
  'bangor',             // UK
  'abertay',            // UK (Scotland)
  'avila',              // photoSets, US small
  'concordia-chicago',  // photoSets, US small
  'ue-germany',         // photoSets, Germany private
  'massey',             // New Zealand
  'lim-college',        // photoSets, US niche
];

const args = process.argv.slice(2);
const argSlug = takeArg('--slug');
const dryRun = args.includes('--dry-run');
const FILL = args.includes('--fill'); // aggressive fallback for gaps: city + thematic, never empty
function takeArg(n){ const i=args.indexOf(n); return i>=0&&i+1<args.length?args[i+1]:null; }
const sleep = (ms) => new Promise(r=>setTimeout(r,ms));
async function logLine(msg){ const l=`[bobr ${new Date().toISOString().slice(11,19)}] ${msg}`; console.log(l); try{ await writeFile(LOG,l+'\n',{flag:'a'}); }catch{} }
async function exists(p){ try{ await access(p,FS.F_OK); return true; }catch{ return false; } }

// ---- scoring (building vs people) -------------------------------------------
const BUILDING_RE = /campus|building|hall|library|quad|aerial|entrance|facade|exterior|tower|chapel|cathedral|college|university|courtyard|architecture|lecture|interior|atrium|residence|dormitory|dorm|accommodation|house|village|hostel|gate|square|main/i;
const PEOPLE_RE = /student|people|group|graduation|portrait|headshot|socialis|socializ|cheering|orientation|smiling|posing|crowd|class of|lecture hall full/i;
const SKIP_RE = /logo|seal|coat[-_ ]of[-_ ]arms|crest|\.svg|\.pdf|map\b|location\b|diagram|chart|graph|signature|icon|flag/i;
const ACCOM_RE = /residence|dormitory|dorm|accommodation|hall of|student village|student house|halls\b|housing/i;

// Interior/detail subjects that aren't "the university itself" — staircases,
// signs, statues, plaques, close-ups. Pushed well down so galleries show buildings.
const DETAIL_RE = /stair|staircase|\bsign\b|signage|plaque|statue|sculpture|\bbust\b|mural|fresco|fountain|\bbench\b|escalator|elevator|\bdoor\b|\bwindow\b|close[-\s]?up|\bdetail|memorial(?!\s+(building|hall|library))|artwork|painting|ceiling|corridor|hallway/i;
function scoreTitle(title){
  const t=(title||'').toLowerCase();
  let s=0;
  if(BUILDING_RE.test(t)) s+=20;
  if(/aerial|main[-_ ]building|main[-_ ]quad|facade|exterior|courtyard|campus view|skyline/.test(t)) s+=15;
  if(DETAIL_RE.test(t)) s-=35;                 // interior detail / object → not the university
  const people=PEOPLE_RE.test(t);
  if(people && !BUILDING_RE.test(t)) s-=40;   // people-only → push out
  else if(people) s-=10;                       // people + building ok-ish
  if(/night/.test(t)) s-=3;
  return s;
}

// ---- candidate sourcing ------------------------------------------------------
const STOP = new Set(['the','and','of','university','college','school','institute','national','international','community','state','central','centre','center','academy','group','inc','global']);
function uniTokens(u){
  return new Set([u.name, u.city||u.location?.city||''].join(' ').toLowerCase()
    .replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(t=>t.length>=4 && !STOP.has(t)));
}
function titleMatches(title, tokens){
  if(!tokens.size) return false; const t=title.toLowerCase();
  for(const tok of tokens) if(t.includes(tok)) return true; return false;
}
async function wmGet(params){
  const url=WM_API+'?'+new URLSearchParams({format:'json',formatversion:'2',origin:'*',...params});
  let lastErr;
  for(let attempt=0; attempt<4; attempt++){
    const ac=new AbortController(); const t=setTimeout(()=>ac.abort(),12000); // hard timeout — no hangs
    try{
      const r=await fetch(url,{headers:{'user-agent':UA,accept:'application/json'},signal:ac.signal});
      clearTimeout(t);
      if(r.status===429 || r.status>=500){ lastErr=new Error('WM HTTP '+r.status); await sleep(800*(attempt+1)); continue; }
      if(!r.ok) throw new Error('WM HTTP '+r.status);
      return r.json();
    }catch(e){ clearTimeout(t); lastErr=e; await sleep(500*(attempt+1)); }
  }
  throw lastErr;
}

// A gallery url is "junk" if it's an external host that is not a Wikimedia/Wikipedia
// asset — i.e. competitor CDNs (collabinternational etc.) or random stock.
function isJunkUrl(url){
  return /^https?:/i.test(url) && !/wikimedia|wikipedia/i.test(url);
}
async function commonsCandidates(u){
  const tokens=uniTokens(u); if(!tokens.size) return [];
  const titles=[]; const seen=new Set();
  for(const q of [`"${u.name}" campus`, `"${u.name}"`]){
    try{
      const d=await wmGet({action:'query',list:'search',srsearch:q,srnamespace:'6',srlimit:'30',srprop:'snippet'});
      for(const r of d?.query?.search??[]){
        if(seen.has(r.title)||SKIP_RE.test(r.title)) continue;
        if(!titleMatches(r.title,tokens)) continue;
        seen.add(r.title); titles.push(r.title);
      }
    }catch(e){ await logLine(`  WM search fail ${u.slug}: ${e.message}`); }
    await sleep(REQ_DELAY);
    if(titles.length>=40) break;
  }
  if(!titles.length) return [];
  const out=[];
  for(let i=0;i<titles.length;i+=50){
    const chunk=titles.slice(i,i+50);
    try{
      const d=await wmGet({action:'query',prop:'imageinfo',iiprop:'url|mime|size',iiurlwidth:String(THUMB_W),titles:chunk.join('|')});
      for(const pg of d?.query?.pages??[]){
        const info=pg.imageinfo?.[0]; if(!info) continue;
        if(!/^image\/(jpeg|png)$/i.test(info.mime||'')) continue;
        if((info.size||0)<30000) continue;
        out.push({url:info.thumburl||info.url, title:pg.title, src:'commons'});
      }
    }catch(e){ await logLine(`  WM imageinfo fail ${u.slug}: ${e.message}`); }
    await sleep(REQ_DELAY);
  }
  return out;
}
// Accommodation-specific photos: residence halls, dorm rooms, student housing.
// Tagged accom=true so they fill the «Размещение» cards instead of leftover
// generic campus buildings. Falls back to thematic student-room shots.
async function accomCandidates(u){
  const tokens=uniTokens(u);
  const out=[]; const seen=new Set();
  const collect=async(qs, requireToken)=>{
    for(const q of qs){
      try{
        const d=await wmGet({action:'query',list:'search',srsearch:q,srnamespace:'6',srlimit:'15',srprop:'snippet'});
        for(const r of d?.query?.search??[]){
          if(seen.has(r.title)||SKIP_RE.test(r.title)) continue;
          if(!ACCOM_RE.test(r.title) && !/room|bedroom|interior|en[-\s]?suite|studio|flat|apartment/i.test(r.title)) continue;
          if(requireToken && tokens.size && !titleMatches(r.title,tokens)) continue;
          seen.add(r.title);
        }
      }catch{}
      await sleep(REQ_DELAY);
    }
  };
  // uni-specific residence/dorm photos only. No generic thematic fallback — those
  // would repeat across hundreds of unis; accom falls back to the uni's own
  // (unique) buildings via takeGeneral instead.
  if(tokens.size) await collect([`"${u.name}" residence hall`,`"${u.name}" dormitory`,`"${u.name}" student accommodation`,`"${u.name}" hall of residence`], true);
  const titles=[...seen];
  if(!titles.length) return [];
  for(let i=0;i<titles.length;i+=50){
    try{
      const d=await wmGet({action:'query',prop:'imageinfo',iiprop:'url|mime|size',iiurlwidth:String(THUMB_W),titles:titles.slice(i,i+50).join('|')});
      for(const pg of d?.query?.pages??[]){
        const info=pg.imageinfo?.[0]; if(!info) continue;
        if(!/^image\/(jpeg|png)$/i.test(info.mime||'')) continue;
        if((info.size||0)<30000) continue;
        out.push({url:info.thumburl||info.url,title:pg.title,src:'accom'});
      }
    }catch{}
    await sleep(REQ_DELAY);
  }
  return out;
}
async function wikipediaLead(u){
  for(const lang of ['en']){
    try{
      const r=await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(u.name)}`,{headers:{'user-agent':UA}});
      if(!r.ok) continue;
      const j=await r.json();
      const img=j?.originalimage?.source||j?.thumbnail?.source;
      if(img && !SKIP_RE.test(img)) return [{url:img,title:`${u.name} (Wikipedia)`,src:'wikipedia'}];
    }catch{}
  }
  return [];
}
// Broader Commons search used only when the strict-name pool is thin. Drops the
// uni-name token requirement and instead requires a building/campus keyword in
// the title — relevant-ish ("similar") shots rather than a hard miss. Last resort
// before a true placeholder.
async function broadCommons(u){
  const city=(u.city||u.location?.city||'').trim();
  const qs=[`${u.name} campus building`, city?`"${city}" university campus`:null, `${u.name} ${u.country||''}`].filter(Boolean);
  const out=[]; const seen=new Set();
  for(const q of qs){
    try{
      const d=await wmGet({action:'query',list:'search',srsearch:q,srnamespace:'6',srlimit:'20',srprop:'snippet'});
      for(const r of d?.query?.search??[]){
        if(seen.has(r.title)||SKIP_RE.test(r.title)) continue;
        if(!BUILDING_RE.test(r.title)) continue;          // must look like a building/campus
        if(PEOPLE_RE.test(r.title)&&!BUILDING_RE.test(r.title)) continue;
        seen.add(r.title);
      }
    }catch{}
    await sleep(REQ_DELAY);
  }
  const titles=[...seen];
  if(!titles.length) return [];
  const res=[];
  for(let i=0;i<titles.length;i+=50){
    try{
      const d=await wmGet({action:'query',prop:'imageinfo',iiprop:'url|mime|size',iiurlwidth:String(THUMB_W),titles:titles.slice(i,i+50).join('|')});
      for(const pg of d?.query?.pages??[]){
        const info=pg.imageinfo?.[0]; if(!info) continue;
        if(!/^image\/(jpeg|png)$/i.test(info.mime||'')) continue;
        if((info.size||0)<30000) continue;
        res.push({url:info.thumburl||info.url,title:pg.title,src:'broad'});
      }
    }catch{}
    await sleep(REQ_DELAY);
  }
  return res;
}
// og:image / large hero image off the university's own official site.
async function officialOg(u){
  const site=u.officialUrl||u.sourceUrl;
  if(!site||/kaplanpathways|navitas|topuniversities|collabinternational|oxfordinternational|catsglobalschools/i.test(site)) return [];
  try{
    const ac=new AbortController(); const t=setTimeout(()=>ac.abort(),8000);
    const r=await fetch(site,{headers:{'user-agent':UA},signal:ac.signal,redirect:'follow'}); clearTimeout(t);
    if(!r.ok) return [];
    const $=cheerioLoad(await r.text());
    const cands=[];
    $('meta[property="og:image"], meta[name="twitter:image"]').each((_,el)=>{ const c=$(el).attr('content'); if(c) cands.push(c); });
    const out=[]; const seen=new Set();
    for(let src of cands){
      try{ src=new URL(src, site).href; }catch{ continue; }
      if(seen.has(src)||SKIP_RE.test(src)) continue; seen.add(src);
      out.push({url:src,title:`${u.name} (офсайт)`,src:'official'});
    }
    return out;
  }catch{ return []; }
}
// City-relevant photos (approximate): the uni's city campuses/buildings/skyline.
async function cityCandidates(u){
  const city=(u.city||u.location?.city||'').trim(); if(!city) return [];
  const country=(u.country||u.location?.country||'').trim();
  const qs=[`"${city}" university campus`,`"${city}" college building`,`${city} ${country} university`,`"${city}" city`];
  const seen=new Set();
  for(const q of qs){
    try{
      const d=await wmGet({action:'query',list:'search',srsearch:q,srnamespace:'6',srlimit:'15',srprop:'snippet'});
      for(const r of d?.query?.search??[]){
        if(seen.has(r.title)||SKIP_RE.test(r.title)||DETAIL_RE.test(r.title)) continue;
        if(!BUILDING_RE.test(r.title) && !/skyline|city|street|view/i.test(r.title)) continue;
        if(PEOPLE_RE.test(r.title)&&!BUILDING_RE.test(r.title)) continue;
        seen.add(r.title);
      }
    }catch{}
    await sleep(REQ_DELAY);
  }
  return resolveTitles([...seen],'city');
}

// Shared resolver: titles -> imageinfo thumbnails tagged with a source.
async function resolveTitles(titles, src){
  const out=[];
  for(let i=0;i<titles.length;i+=50){
    try{
      const d=await wmGet({action:'query',prop:'imageinfo',iiprop:'url|mime|size',iiurlwidth:String(THUMB_W),titles:titles.slice(i,i+50).join('|')});
      for(const pg of d?.query?.pages??[]){
        const info=pg.imageinfo?.[0]; if(!info) continue;
        if(!/^image\/(jpeg|png)$/i.test(info.mime||'')) continue;
        if((info.size||0)<30000) continue;
        out.push({url:info.thumburl||info.url,title:pg.title,src});
      }
    }catch{}
    await sleep(REQ_DELAY);
  }
  return out;
}

// Global thematic pool — generic education imagery (campuses, students, libraries,
// activities). Built once, shared across all gap unis with global dedup so the
// same generic photo never repeats on two universities.
let _thematicTitles=null;
async function thematicTitles(){
  if(_thematicTitles) return _thematicTitles;
  const qs=['university campus aerial view','college campus quad','university library reading room interior',
    'university lecture hall','students studying university','students walking campus','university building exterior modern',
    'students classroom university','university graduation ceremony students','student union building','university science laboratory students','campus autumn students'];
  const seen=new Set();
  for(const q of qs){
    try{
      const d=await wmGet({action:'query',list:'search',srsearch:q,srnamespace:'6',srlimit:'40',srprop:'snippet'});
      for(const r of d?.query?.search??[]){ if(!seen.has(r.title)&&!SKIP_RE.test(r.title)&&!DETAIL_RE.test(r.title)) seen.add(r.title); }
    }catch{}
    await sleep(REQ_DELAY);
  }
  _thematicTitles=[...seen];
  return _thematicTitles;
}

async function localCandidates(u){
  const dir=join(PHOTOS,u.slug); const out=[];
  try{
    for(const f of await readdir(dir)){
      if(/^bobr-/.test(f)) continue; // skip our own previous output
      if(/\.(jpe?g|png|webp)$/i.test(f)) out.push({local:join(dir,f),title:`${u.name} ${f}`,src:'local'});
    }
  }catch{}
  return out;
}
function existingGalleryUrls(u){
  const items=u.gallery?.items??[];
  return items
    .filter(it=>it.img && /^https?:/.test(it.img) && /wikimedia|wikipedia/i.test(it.img)) // keep only good external
    .map(it=>({url:it.img,title:it.caption||u.name,src:'existing'}));
}

// ---- download + hash ---------------------------------------------------------
async function fetchBuf(url){
  const ac=new AbortController(); const t=setTimeout(()=>ac.abort(),15000); // hard timeout
  try{
    const r=await fetch(url,{headers:{'user-agent':UA,accept:'image/*'},signal:ac.signal});
    if(!r.ok) throw new Error('HTTP '+r.status);
    return Buffer.from(await r.arrayBuffer());
  } finally { clearTimeout(t); }
}
async function aHash(buf){
  const raw=await sharp(buf).grayscale().resize(8,8,{fit:'fill'}).raw().toBuffer();
  let avg=0; for(const b of raw) avg+=b; avg/=raw.length;
  let h=0n; for(let i=0;i<64;i++) h=(h<<1n)|(raw[i]>=avg?1n:0n);
  return h;
}
function hamming(a,b){ let x=a^b,c=0; while(x){ c+=Number(x&1n); x>>=1n; } return c; }

const SRC_BONUS={local:5,wikipedia:8,commons:0,existing:0,official:4,broad:-8};
// Ingest a candidate list into `pool`, downloading, filtering by width and
// rejecting near-duplicates against everything already pooled (cross-source dedup).
async function ingest(candidates, pool, hashes){
  for(const c of candidates){
    let buf;
    try{ buf = c.local ? await readFile(c.local) : await fetchBuf(c.url); }catch{ continue; }
    let meta;
    try{ meta = await sharp(buf).metadata(); }catch{ continue; }
    if((meta.width||0) < MIN_WIDTH) continue;
    let h;
    try{ h = await aHash(buf); }catch{ continue; }
    if(hashes.some(prev=>hamming(prev,h)<=DUP_DIST)) continue;
    hashes.push(h);
    const isAccom=c.src==='accom'||ACCOM_RE.test(c.title||'');
    // Prefer landscape (building exteriors); penalise tall portraits (often
    // staircases/statues/detail shots). Room photos exempt — they can be portrait.
    const ar = meta.width&&meta.height ? meta.width/meta.height : 1;
    const aspectBonus = isAccom ? 0 : (ar>=1.25 ? 10 : (ar<0.8 ? -18 : 0));
    pool.push({...c, buf, w:meta.width, h:meta.height, score:scoreTitle(c.title)+(SRC_BONUS[c.src]??0)+aspectBonus, accom:isAccom});
  }
}
// Global thematic pool (downloaded+hashed once, shared). Each photo used on at
// most one uni (item.used) → no repeats across the gap unis.
let _thematicPool=null;
async function getThematicPool(){
  if(_thematicPool) return _thematicPool;
  const resolved=await resolveTitles(await thematicTitles(),'thematic');
  const pool=[];
  for(const c of resolved){
    let buf; try{ buf=await fetchBuf(c.url); }catch{ continue; }
    let meta; try{ meta=await sharp(buf).metadata(); }catch{ continue; }
    if((meta.width||0)<MIN_WIDTH) continue;
    let hash; try{ hash=await aHash(buf); }catch{ continue; }
    if(pool.some(p=>hamming(p.hash,hash)<=DUP_DIST)) continue;
    const ar=meta.width/meta.height; const aspectBonus=ar>=1.25?10:(ar<0.8?-18:0);
    pool.push({url:c.url,title:c.title,buf,w:meta.width,ht:meta.height,hash,score:scoreTitle(c.title)+aspectBonus,used:false});
  }
  pool.sort((a,b)=>b.score-a.score);
  _thematicPool=pool;
  await logLine(`thematic pool built: ${pool.length} photos`);
  return _thematicPool;
}

async function buildPool(u){
  const pool=[]; const hashes=[];
  // primary: prefer richer, more uni-specific sources first
  await ingest([
    ...existingGalleryUrls(u),
    ...(await localCandidates(u)),
    ...(await commonsCandidates(u)),
    ...(await wikipediaLead(u)),
  ], pool, hashes);
  // dedicated accommodation photos (residence halls / rooms) so the «Размещение»
  // cards show housing, not leftover campus buildings.
  if((u.accommodation?.length??0) > 0){
    await ingest(await accomCandidates(u), pool, hashes);
  }
  // how many distinct photos this uni actually needs across all slots
  const need = 1 + Math.min(4, 4) + (u.campuses?.length??0) + (u.accommodation?.length??0);
  if(pool.length < Math.min(need, 8)){
    // augment with broader / approximate sources until we have enough
    await ingest(await officialOg(u), pool, hashes);
    await ingest(await broadCommons(u), pool, hashes);
  }
  // --fill: never leave a uni empty. Add city-relevant, then draw from the
  // global thematic pool (campuses/students/libraries/activities), deduped
  // across all unis so the same generic shot never repeats.
  if(FILL && pool.length < 8){ await ingest(await cityCandidates(u), pool, hashes); }
  if(FILL && pool.length < 10){
    const tp = await getThematicPool();
    // pass 1: globally-unused thematic only (no repeats across unis)
    for(const t of tp){
      if(pool.length>=10) break;
      if(t.used) continue;
      if(hashes.some(x=>hamming(x,t.hash)<=DUP_DIST)) continue;
      t.used=true; hashes.push(t.hash);
      pool.push({url:t.url,title:t.title,src:'thematic',buf:t.buf,w:t.w,h:t.ht,score:t.score,accom:false});
    }
    // pass 2 (last resort): still too thin → allow reuse so the uni is NEVER empty
    if(pool.length < 4){
      for(const t of tp){
        if(pool.length>=6) break;
        if(hashes.some(x=>hamming(x,t.hash)<=DUP_DIST)) continue;
        hashes.push(t.hash);
        pool.push({url:t.url,title:t.title,src:'thematic-reuse',buf:t.buf,w:t.w,h:t.ht,score:t.score,accom:false});
      }
    }
  }
  pool.sort((a,b)=>b.score-a.score);
  return pool;
}

async function saveResized(u, item, idx){
  const dir=join(PHOTOS,u.slug); await mkdir(dir,{recursive:true});
  const out=join(dir,`bobr-${idx}.jpg`);
  const buf=await sharp(item.buf).rotate().resize({width:OUT_W,withoutEnlargement:true}).jpeg({quality:80,mozjpeg:true}).toBuffer();
  await writeFile(out,buf);
  return `/photos/${u.slug}/bobr-${idx}.jpg`;
}

async function processUni(slug){
  const path=join(CATALOG,slug+'.json');
  if(!(await exists(path))){ await logLine(`SKIP ${slug}: no JSON`); return null; }
  const u=JSON.parse(await readFile(path,'utf8'));
  const pool=await buildPool(u);
  if(!pool.length){
    // No replacement found — but NEVER leave competitor/stock junk in place.
    const items=u.gallery?.items??[];
    const cleaned=items.filter(it=>it.img && !isJunkUrl(it.img));
    let stripped=0;
    if(cleaned.length!==items.length){ stripped=items.length-cleaned.length; if(!dryRun){ u.gallery={items:cleaned}; await writeFile(path,JSON.stringify(u,null,2)+'\n','utf8'); } }
    await logLine(`GAP ${slug}: 0 qualifying photos (placeholder)${stripped?`, stripped ${stripped} junk`:''}`);
    return {slug,gallery:0,camp:0,accom:0,pool:0};
  }

  const campuses=u.campuses??[];
  const accom=u.accommodation??[];
  const remaining=[...pool]; // best-first
  let idx=1;
  const out=async(item)=> dryRun ? '(dry)' : await saveResized(u,item,idx++);
  const takeGeneral=()=>{ if(!remaining.length) return null; let i=remaining.findIndex(p=>!p.accom); if(i<0)i=0; return remaining.splice(i,1)[0]; };
  const takeAccom=()=>{ if(!remaining.length) return null; let i=remaining.findIndex(p=>p.accom); if(i<0)i=0; return remaining.splice(i,1)[0]; };

  const heroPic=takeGeneral();
  const campusPics=campuses.map(()=>takeGeneral());
  const accomAssigned=accom.map(()=>takeAccom());
  const stripPics=[]; for(let i=0;i<4 && remaining.length;i++){ const p=takeGeneral(); if(p) stripPics.push(p); }

  const galleryItems=[];
  for(const g of [heroPic,...stripPics]){ if(g) galleryItems.push({img:await out(g),caption:`${u.name}`}); }
  let campSet=0; for(let i=0;i<campuses.length;i++){ if(campusPics[i]){ campuses[i].img=await out(campusPics[i]); campSet++; } }
  let accSet=0; for(let i=0;i<accom.length;i++){ if(accomAssigned[i]){ accom[i].img=await out(accomAssigned[i]); accSet++; } }

  // When there is no living section at all (no campuses AND no accommodation),
  // fill a small extra university photo gallery from leftover distinct photos so
  // the page isn't empty there. No repeats (these come from `remaining`).
  let extraGallery=null;
  if(campuses.length===0 && accom.length===0){
    const extra=[];
    for(let i=0;i<6 && remaining.length;i++){ const p=takeGeneral(); if(p) extra.push({img:await out(p),caption:`${u.name}`}); }
    if(extra.length) extraGallery=extra;
  }

  if(!dryRun){
    u.gallery={items:galleryItems};
    if(campuses.length) u.campuses=campuses;
    if(accom.length) u.accommodation=accom;
    if(extraGallery) u.photoSets={...(u.photoSets||{}), general:extraGallery};
    await writeFile(path,JSON.stringify(u,null,2)+'\n','utf8');
  }
  const bySrc={}; pool.forEach(p=>bySrc[p.src]=(bySrc[p.src]||0)+1);
  await logLine(`OK ${slug}: gallery=${galleryItems.length} camp-img=${campSet}/${campuses.length} accom-img=${accSet}/${accom.length}${extraGallery?` uni-gal=${extraGallery.length}`:''} pool=${pool.length} [${Object.entries(bySrc).map(([k,v])=>k+':'+v).join(' ')}]`);
  return {slug,gallery:galleryItems.length,camp:campSet,accom:accSet,uniGal:extraGallery?.length??0,campTotal:campuses.length,accomTotal:accom.length,pool:pool.length};
}

async function main(){
  await mkdir(dirname(LOG),{recursive:true});
  const all=args.includes('--all');
  const fromFile=takeArg('--from-file');
  let list;
  if(argSlug) list=[argSlug];
  else if(fromFile) list=(await readFile(fromFile,'utf8')).split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  else if(all) list=(await readdir(CATALOG)).filter(f=>f.endsWith('.json')).map(f=>f.replace(/\.json$/,'')).sort();
  else list=PILOT;
  // conc=1 for gap recovery / from-file (Commons rate-limits hard under parallelism)
  const CONC = (all && !fromFile) ? 2 : 1;
  await logLine(`START ${all?'FULL':'pilot'} — ${list.length} unis, conc=${CONC}${dryRun?' (dry-run)':''}`);
  const results=[];
  let done=0, ok=0, gap=0, fail=0;
  const queue=[...list];
  async function worker(){
    while(queue.length){
      const slug=queue.shift(); if(slug===undefined) break;
      try{
        const r=await processUni(slug);
        if(r){ results.push(r); if(r.pool>0) ok++; else gap++; }
      }catch(e){ fail++; await logLine(`FAIL ${slug}: ${e.message}`); }
      done++;
      if((all||fromFile) && done % 25 === 0) await logLine(`... progress ${done}/${list.length} (ok=${ok} gap=${gap} fail=${fail})`);
    }
  }
  await Promise.all(Array.from({length:CONC},()=>worker()));
  if(!all && !fromFile){
    await logLine('--- SUMMARY ---');
    for(const r of results) await logLine(`  ${r.slug.padEnd(20)} g=${r.gallery} camp=${r.camp}/${r.campTotal??0} accom=${r.accom}/${r.accomTotal??0} pool=${r.pool}`);
  }
  await logLine(`DONE ${all?'FULL':'pilot'}: ${done}/${list.length} processed (ok=${ok} gap=${gap} fail=${fail})`);
}
main().catch(async e=>{ await logLine('FATAL '+e.stack); process.exit(1); });
