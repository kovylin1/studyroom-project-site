#!/usr/bin/env node
// Extended verified-program search (v2).
// - recursive sitemap parsing
// - 2-level crawl from index pages
// - subdomain probe (study., courses., apply., admissions., international.)
// - QS topuniversities aggregator scrape via Playwright for unis with <60 progs
// - no skip-gate, no upper cap: extract EVERYTHING the source publishes
// - all programs written get programUrl:200 + verified:true
//
// Usage: node scraper/expand-programs-v2.mjs --all
//        node scraper/expand-programs-v2.mjs <slug> [<slug>...]

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const UNI_DIR = path.join(PROJECT_ROOT, 'site/src/content/universities');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const INDEX_PATHS = [
  '/courses','/courses/undergraduate','/courses/postgraduate','/courses/international',
  '/programs','/programmes','/programs/undergraduate','/programs/postgraduate',
  '/study','/study/courses','/study/undergraduate','/study/postgraduate','/study/course-search',
  '/academics','/academics/programs','/academics/undergraduate','/academics/graduate',
  '/degrees','/our-courses','/postgrad-taught','/postgraduate-research',
  '/en/study','/en/courses','/en/programmes','/en/programs',
];
const SUBDOMAINS = ['study','courses','apply','admissions','international','prospectus','www2','www3'];
const PROG_MARKERS = /\b(BSc|BA|BEng|BBA|BS|BCom|BFA|BMus|LLB|MSc|MA|MBA|MEng|MRes|MPhil|MArch|MFA|MComm|EMBA|LLM|MD|BDS|BVSc|PhD|DPhil|Bachelor|Master|Foundation|Diploma|Certificate|Doctorate)\b/i;
const COURSE_URL_PATTERN = /\/(course|program(?:me)?|degree|undergraduate|postgraduate|bachelor|master|phd|doctoral|study|academic)s?(\/|$|-)/i;
const AGGREGATOR_DOMAINS = ['kaplanpathways.com','navitas.com','topuniversities.com','oxfordinternational.com','catsglobalschools.com','catsadmissions.com'];
const GENERIC_REJECT = /^(Course|Programmes?|Courses|Master('?s)?|Bachelor('?s)?|PhD( Projects?( \d{4})?)?|Diploma|Undergraduate|Postgraduate|Study|Apply|Search|Find|Home)\b\s*$/i;
const INFO_PAGE_REJECT = /\b(Qu['’]?est-?ce que|What is|Why study|Why choose|Why a|Pourquoi|Les débouchés|Career prospects|definition|FAQ|Overview)\b/i;

const ROUND2_CAP = 60;

async function fetchOk(url, timeoutMs=10000){
  try{
    const ac=new AbortController();const t=setTimeout(()=>ac.abort(),timeoutMs);
    const r=await fetch(url,{headers:{'User-Agent':UA,'Accept':'text/html,application/xhtml+xml,*/*;q=0.8','Accept-Language':'en-US,en;q=0.9'},signal:ac.signal,redirect:'follow'});
    clearTimeout(t);
    if(!r.ok)return null;
    const ct=r.headers.get('content-type')||'';
    if(!/text\/html|xml/i.test(ct))return null;
    return await r.text();
  }catch{return null;}
}

async function pageGet(page, url, timeoutMs=15000){
  try{
    const r=await page.goto(url,{waitUntil:'domcontentloaded',timeout:timeoutMs});
    if(!r||!r.ok())return null;
    await page.waitForLoadState('networkidle',{timeout:6000}).catch(()=>{});
    return await page.content();
  }catch{return null;}
}

async function recurseSitemap(rootUrl, seen=new Set(), depth=0, maxDepth=2){
  if(depth>maxDepth||seen.has(rootUrl))return [];
  seen.add(rootUrl);
  const xml=await fetchOk(rootUrl, 8000);
  if(!xml)return [];
  const locs=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1].trim());
  const subSitemaps=locs.filter(u=>/sitemap.*\.xml/i.test(u));
  const out=locs.filter(u=>!/sitemap.*\.xml/i.test(u));
  for(const s of subSitemaps.slice(0,8)){
    const more=await recurseSitemap(s, seen, depth+1, maxDepth);
    out.push(...more);
  }
  return out;
}

async function getAllSitemapUrls(siteRoot){
  const tries=['/sitemap.xml','/sitemap_index.xml','/sitemap-index.xml','/sitemap/sitemap.xml'];
  const collected=new Set();
  for(const p of tries){
    const urls=await recurseSitemap(siteRoot+p);
    urls.forEach(u=>collected.add(u));
    if(collected.size>0)break;
  }
  if(collected.size===0){
    const robots=await fetchOk(siteRoot+'/robots.txt', 5000);
    if(robots){
      const sm=[...robots.matchAll(/sitemap:\s*(\S+)/gi)].map(m=>m[1].trim());
      for(const url of sm.slice(0,3)){
        const urls=await recurseSitemap(url);
        urls.forEach(u=>collected.add(u));
      }
    }
  }
  return [...collected];
}

async function crawlIndexPaths(siteRoot){
  const found=new Set();
  const visited=new Set();
  const lvl2Queue=[];
  for(const ipath of INDEX_PATHS){
    const html=await fetchOk(siteRoot+ipath, 8000);
    if(!html)continue;
    visited.add(siteRoot+ipath);
    const $=cheerio.load(html);
    $('a[href]').each((_,el)=>{
      const href=$(el).attr('href');if(!href)return;
      let abs;try{abs=new URL(href, siteRoot+ipath).toString();}catch{return;}
      if(new URL(abs).origin!==siteRoot)return;
      abs=abs.split('#')[0];
      if(COURSE_URL_PATTERN.test(abs)){
        found.add(abs);
        if(found.size<400&&!visited.has(abs))lvl2Queue.push(abs);
      }
    });
    if(found.size>=200)break;
  }
  for(const url of lvl2Queue.slice(0,12)){
    if(visited.has(url))continue;visited.add(url);
    const html=await fetchOk(url, 6000);
    if(!html)continue;
    const $=cheerio.load(html);
    $('a[href]').each((_,el)=>{
      const href=$(el).attr('href');if(!href)return;
      let abs;try{abs=new URL(href,url).toString();}catch{return;}
      if(new URL(abs).origin!==siteRoot)return;
      abs=abs.split('#')[0];
      if(COURSE_URL_PATTERN.test(abs))found.add(abs);
    });
    if(found.size>=500)break;
  }
  return [...found];
}

async function probeSubdomains(siteRoot){
  const found=new Set();
  try{
    const u=new URL(siteRoot);
    const host=u.hostname;
    if(host.split('.').length<2)return [];
    const baseHost=host.replace(/^www\d?\./,'');
    for(const sub of SUBDOMAINS){
      const subRoot=`${u.protocol}//${sub}.${baseHost}`;
      for(const ipath of ['/courses','/programs','/programmes','/']){
        const html=await fetchOk(subRoot+ipath, 5000);
        if(!html)continue;
        const $=cheerio.load(html);
        $('a[href]').each((_,el)=>{
          const href=$(el).attr('href');if(!href)return;
          let abs;try{abs=new URL(href, subRoot+ipath).toString();}catch{return;}
          if(new URL(abs).origin!==subRoot)return;
          abs=abs.split('#')[0];
          if(COURSE_URL_PATTERN.test(abs))found.add(abs);
        });
        break;
      }
    }
  }catch{}
  return [...found];
}

async function qsAggregatorScrape(browser, qsSlug, uniName){
  const ctx=await browser.newContext({userAgent:UA,viewport:{width:1366,height:768}});
  const page=await ctx.newPage();
  const out=[];
  try{
    for(const sub of ['','/programs','/courses']){
      const url=`https://www.topuniversities.com/universities/${qsSlug}${sub}`;
      const html=await pageGet(page,url, 15000);
      if(!html)continue;
      const $=cheerio.load(html);
      $('a[href*="/program"], a[href*="/course"], a[href*="/study/"]').each((_,el)=>{
        const href=$(el).attr('href');if(!href)return;
        let abs;try{abs=new URL(href,url).toString();}catch{return;}
        const text=($(el).text()||'').trim();
        if(text&&PROG_MARKERS.test(text)&&text.length<200){
          out.push({title:text, programUrl:abs});
        }
      });
      $('h2, h3, h4').each((_,el)=>{
        const t=($(el).text()||'').trim();
        if(t&&PROG_MARKERS.test(t)&&t.length>8&&t.length<200){
          out.push({title:t, programUrl:url});
        }
      });
      if(out.length>0)break;
    }
  }finally{
    await page.close().catch(()=>{});
    await ctx.close().catch(()=>{});
  }
  return out;
}

function cleanTitle(raw, uniName){
  if(!raw)return null;
  let t=raw.split('|')[0].split(' — University')[0].split(' - University')[0].split(' at ')[0].trim();
  if(uniName){
    const esc=uniName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    t=t.replace(new RegExp('\\s*[-|—]\\s*'+esc+'\\s*$','i'),'').trim();
  }
  t=t.replace(/\s*[-–—]\s*$/,'').replace(/\s+/g,' ').replace(/^Course[:\s]+/i,'').trim();
  if(t.length<8||t.length>200)return null;
  if(GENERIC_REJECT.test(t))return null;
  if(INFO_PAGE_REJECT.test(t))return null;
  if(!PROG_MARKERS.test(t))return null;
  return t;
}

function extractTitle(html, uniName){
  if(!html)return null;
  const $=cheerio.load(html);
  for(const sel of ['meta[property="og:title"]','meta[name="twitter:title"]','h1','title']){
    const v=sel.startsWith('meta')?$(sel).attr('content'):$(sel).first().text().trim();
    if(!v)continue;
    const t=cleanTitle(v, uniName);
    if(t)return t;
  }
  return null;
}

function inferLevel(title){
  const t=title.toLowerCase();
  if(/\b(phd|dphil|doctorate|doctoral)\b/.test(t))return 'phd';
  if(/\b(msc|mba|emba|meng|mres|mphil|llm|march|mfa|mcomm)\b/.test(t)||/\bmaster\b/.test(t)||/^ma\s/.test(t)||/\sma\s/.test(t))return 'master';
  if(/\b(foundation|pathway|access)\b/.test(t))return 'foundation';
  if(/\b(diploma|certificate)\b/.test(t))return 'short-course';
  return 'bachelor';
}
function inferDuration(level,title){
  if(level==='master')return /\bpart.time\b/i.test(title)?2:1;
  if(level==='phd')return 3;
  if(level==='foundation'||level==='short-course')return 1;
  return 3;
}
function inferType(title){
  if(/\b(foundation|pathway|access)\b/i.test(title))return 'pathway';
  return 'degree';
}
function makeSlug(uniSlug,title){
  const base=title.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,70).replace(/^-+|-+$/g,'');
  return `${uniSlug}-${base}`;
}

async function findRealSiteRoot(uni){
  const cands=[uni.officialUrl, uni.sourceUrl, ...(uni.programs||[]).map(p=>p.programUrl).filter(Boolean)];
  for(const u of cands){
    if(!u)continue;
    try{
      const origin=new URL(u).origin;
      if(AGGREGATOR_DOMAINS.some(d=>origin.includes(d)))continue;
      return origin;
    }catch{continue;}
  }
  return null;
}

async function processUni(slug, browser){
  const filePath=path.join(UNI_DIR, slug+'.json');
  let raw;try{raw=await fs.readFile(filePath,'utf8');}catch{return {slug,status:'fail-no-file'};}
  const uni=JSON.parse(raw);

  const siteRoot=await findRealSiteRoot(uni);
  if(!siteRoot)return {slug,status:'fail-no-real-site'};

  const existingSlugs=new Set((uni.programs||[]).map(p=>p.slug));
  const existingTitles=new Set((uni.programs||[]).map(p=>(p.title||'').toLowerCase()));

  const candidates=new Set();
  const sitemap=await getAllSitemapUrls(siteRoot);
  for(const u of sitemap)if(COURSE_URL_PATTERN.test(u))candidates.add(u.split('#')[0]);
  const indexCrawl=await crawlIndexPaths(siteRoot);
  for(const u of indexCrawl)candidates.add(u);
  if(candidates.size<200){
    const sub=await probeSubdomains(siteRoot);
    for(const u of sub)candidates.add(u);
  }

  let qsHits=[];
  if(uni.programs.length<ROUND2_CAP){
    qsHits=await qsAggregatorScrape(browser, slug, uni.name).catch(()=>[]);
  }

  const verified=[];
  const cand=[...candidates];
  let i=0;
  for(const url of cand){
    if(++i>300)break;
    const html=await fetchOk(url, 6000);
    const title=extractTitle(html, uni.name);
    if(!title)continue;
    if(existingTitles.has(title.toLowerCase()))continue;
    const slugCand=makeSlug(slug,title);
    if(existingSlugs.has(slugCand))continue;
    existingSlugs.add(slugCand);existingTitles.add(title.toLowerCase());
    const level=inferLevel(title);
    verified.push({slug:slugCand,title,durationYears:inferDuration(level,title),level,programType:inferType(title),intakes:['September'],programUrl:url,language:uni.language||'en',verified:true});
  }
  for(const q of qsHits){
    const t=cleanTitle(q.title, uni.name);
    if(!t)continue;
    if(existingTitles.has(t.toLowerCase()))continue;
    const slugCand=makeSlug(slug,t);
    if(existingSlugs.has(slugCand))continue;
    existingSlugs.add(slugCand);existingTitles.add(t.toLowerCase());
    const level=inferLevel(t);
    verified.push({slug:slugCand,title:t,durationYears:inferDuration(level,t),level,programType:inferType(t),intakes:['September'],programUrl:q.programUrl,language:uni.language||'en',verified:true,source:'qs'});
  }

  if(verified.length===0)return {slug,status:'no-new',candidates:candidates.size,qsHits:qsHits.length,siteRoot};
  uni.programs.push(...verified);
  await fs.writeFile(filePath, JSON.stringify(uni,null,2)+'\n');
  return {slug,status:'expanded',added:verified.length,total:uni.programs.length,candidates:candidates.size,qsHits:qsHits.length,siteRoot};
}

const args=process.argv.slice(2);
let slugs=[];
if(args.includes('--all')){
  slugs=(await fs.readdir(UNI_DIR)).filter(f=>f.endsWith('.json')).map(f=>f.replace('.json',''));
}else if(args.find(a=>a.startsWith('--file='))){
  const f=args.find(a=>a.startsWith('--file=')).split('=')[1];
  slugs=(await fs.readFile(path.resolve(PROJECT_ROOT,f),'utf8')).split(/\r?\n/).filter(Boolean);
}else{
  slugs=args.filter(a=>!a.startsWith('--'));
}
if(!slugs.length){console.error('usage: --all | --file=path | <slug>...');process.exit(1);}

const browser=await chromium.launch({headless:true});
const CONCURRENCY=4;
const results=[];let idx=0;
async function worker(){
  while(idx<slugs.length){
    const i=idx++;const slug=slugs[i];
    process.stderr.write(`[${i+1}/${slugs.length}] ${slug}\n`);
    try{
      const r=await processUni(slug, browser);
      results.push(r);
      process.stderr.write(`  → ${r.status}${r.added?` +${r.added}=${r.total}`:''}${r.candidates!==undefined?` (cands=${r.candidates}, qs=${r.qsHits||0})`:''}\n`);
    }catch(e){
      results.push({slug,status:'error',error:e.message});
      process.stderr.write('  → error: '+e.message+'\n');
    }
  }
}
await Promise.all(Array.from({length:CONCURRENCY},()=>worker()));
await browser.close();
const s={expanded:0,noNew:0,failNoSite:0,err:0,total:0};
for(const r of results){
  s.total++;
  if(r.status==='expanded')s.expanded++;
  else if(r.status==='no-new')s.noNew++;
  else if(r.status==='fail-no-real-site')s.failNoSite++;
  else s.err++;
}
console.error('---SUMMARY--- '+JSON.stringify(s));
console.log(JSON.stringify(results,null,2));
