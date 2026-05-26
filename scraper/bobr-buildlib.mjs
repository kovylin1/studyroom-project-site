// Build a shared photo LIBRARY of generic-but-varied imagery used to give every
// card a DIFFERENT (approximate) photo instead of repeating a uni's own shot:
//   site/public/photos/_lib/room-N.jpg     — student rooms / accommodation interiors
//   site/public/photos/_lib/campus-N.jpg   — campuses / buildings / student life
// Downloaded once, deduped (aHash), resized. Re-run with --force to rebuild.
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LIB = resolve(ROOT, 'site/public/photos/_lib');
const UA = 'studyroom-bobr/1.0 (https://studyroom-project-site.pages.dev; vassiliy.kovylin@gmail.com)';
const WM = 'https://commons.wikimedia.org/w/api.php';
const force = process.argv.includes('--force');
const MINW = 800, DUP = 6, OUTW = 1500, TARGET = 60;
const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));

const ROOM_Q = ['student dormitory room','university residence hall bedroom','student accommodation room interior','dorm room university','student studio apartment interior','university halls bedroom','student bedroom accommodation'];
const CAMPUS_Q = ['university campus','college campus quad','university building exterior','university library building','campus students walking','university courtyard','student union building','campus green lawn university'];
const SKIP=/logo|seal|crest|\.svg|\.pdf|map\b|diagram|icon|floor ?plan|plan of/i;

async function wm(params){
  for(let a=0;a<4;a++){ const ac=new AbortController();const t=setTimeout(()=>ac.abort(),12000);
    try{ const r=await fetch(WM+'?'+new URLSearchParams({format:'json',formatversion:'2',origin:'*',...params}),{headers:{'user-agent':UA},signal:ac.signal}); clearTimeout(t);
      if(r.status===429||r.status>=500){await sleep(900*(a+1));continue;} if(!r.ok)throw new Error('HTTP '+r.status); return r.json();
    }catch(e){clearTimeout(t); if(a===3)throw e; await sleep(600*(a+1));} }
}
async function titles(queries){
  const seen=new Set();
  for(const q of queries){
    try{ const d=await wm({action:'query',list:'search',srsearch:q,srnamespace:'6',srlimit:'40'});
      for(const r of d?.query?.search??[]) if(!SKIP.test(r.title)) seen.add(r.title);
    }catch{} await sleep(200);
  }
  return [...seen];
}
async function resolveUrls(ts){
  const out=[];
  for(let i=0;i<ts.length;i+=50){ try{ const d=await wm({action:'query',prop:'imageinfo',iiprop:'url|mime|size',iiurlwidth:'1500',titles:ts.slice(i,i+50).join('|')});
    for(const pg of d?.query?.pages??[]){ const inf=pg.imageinfo?.[0]; if(!inf)continue; if(!/^image\/(jpeg|png)$/i.test(inf.mime||''))continue; if((inf.size||0)<30000)continue; out.push(inf.thumburl||inf.url); }
  }catch{} await sleep(200);} return out;
}
async function aHash(buf){ const raw=await sharp(buf).grayscale().resize(8,8,{fit:'fill'}).raw().toBuffer(); let avg=0;for(const b of raw)avg+=b;avg/=raw.length; let h=0n;for(let i=0;i<64;i++)h=(h<<1n)|(raw[i]>=avg?1n:0n); return h; }
const ham=(a,b)=>{let x=a^b,c=0;while(x){c+=Number(x&1n);x>>=1n;}return c;};

async function buildSet(prefix, queries){
  const existing=(await readdir(LIB).catch(()=>[])).filter(f=>f.startsWith(prefix+'-'));
  if(existing.length>=TARGET*0.6 && !force){ console.log(`${prefix}: ${existing.length} already present, skip`); return existing.length; }
  const urls=await resolveUrls(await titles(queries));
  const hashes=[]; let n=0;
  for(const url of urls){
    if(n>=TARGET) break;
    let buf; try{ const ac=new AbortController();const t=setTimeout(()=>ac.abort(),15000); const r=await fetch(url,{headers:{'user-agent':UA},signal:ac.signal}); clearTimeout(t); if(!r.ok)continue; buf=Buffer.from(await r.arrayBuffer()); }catch{ continue; }
    let meta; try{ meta=await sharp(buf).metadata(); }catch{ continue; }
    if((meta.width||0)<MINW) continue;
    const ar=meta.width/meta.height; if(ar<0.9) continue; // prefer landscape-ish for cards
    let h; try{ h=await aHash(buf); }catch{ continue; }
    if(hashes.some(p=>ham(p,h)<=DUP)) continue; hashes.push(h);
    n++; const outp=join(LIB,`${prefix}-${n}.jpg`);
    try{ const ob=await sharp(buf).rotate().resize({width:OUTW,withoutEnlargement:true}).jpeg({quality:80,mozjpeg:true}).toBuffer(); await writeFile(outp,ob); }catch{ n--; }
  }
  console.log(`${prefix}: built ${n}`);
  return n;
}

await mkdir(LIB,{recursive:true});
await buildSet('room', ROOM_Q);
await buildSet('campus', CAMPUS_Q);
console.log('library ready at', LIB);
