#!/usr/bin/env node
// РЕВИЗОР — automated quality auditor (read-only)

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const UNI_DIR = path.join(PROJECT_ROOT, 'site/src/content/universities');
const OUT_MD = path.join(PROJECT_ROOT, 'sources/revizor-report.md');
const OUT_JSON = path.join(PROJECT_ROOT, 'sources/revizor-flags.json');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0';
const PROG_MARKERS = /\b(BSc|BA|BEng|BBA|BS|BCom|BFA|BMus|LLB|MSc|MA|MBA|MEng|MRes|MPhil|MArch|MFA|MComm|EMBA|LLM|MD|BDS|BVSc|PhD|DPhil|Bachelor|Master|Foundation|Diploma|Certificate|Doctorate)\b/i;
const SAMPLE_PER_UNI = 3;
const CONCURRENCY = 8;
const log = (...a) => console.error('[revizor]', new Date().toISOString().slice(11,19), ...a);

async function fetchOk(url, timeoutMs=6000) {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: ac.signal, redirect: 'follow' });
    clearTimeout(t);
    return { status: r.status, ok: r.ok, html: r.ok ? await r.text() : '' };
  } catch (e) { return { status: 0, ok: false, html: '', err: e.message }; }
}

function extractTitle(html) {
  if (!html) return '';
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i);
  if (og) return og[1].trim();
  const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1) return h1[1].trim();
  const title = html.match(/<title>([^<]+)<\/title>/i);
  return title ? title[1].trim() : '';
}

const files = (await fs.readdir(UNI_DIR)).filter(f => f.endsWith('.json'));
log(`auditing ${files.length} unis`);

const flags = { critical: [], warnings: [] };
const stats = { unisChecked: 0, programsSampled: 0, urls200: 0, urls404: 0, urlsTimeout: 0, titleMismatch: 0, noProgramUrl: 0 };
let idx = 0;
const items = files.map(f => ({ file: f, slug: f.replace('.json','') }));

async function worker() {
  while (idx < items.length) {
    const i = idx++;
    const it = items[i];
    try {
      const u = JSON.parse(await fs.readFile(path.join(UNI_DIR, it.file), 'utf8'));
      stats.unisChecked++;
      const programs = u.programs || [];
      if (!programs.length) {
        flags.warnings.push({ slug: u.slug, issue: 'no programs at all' });
        continue;
      }
      const indices = Array.from({length: programs.length}, (_, i) => i).sort(() => Math.random()-0.5).slice(0, SAMPLE_PER_UNI);
      const sampled = indices.map(pi => programs[pi]);
      let noUrlCount = 0;
      for (const prog of sampled) {
        stats.programsSampled++;
        if (!prog.programUrl) { stats.noProgramUrl++; noUrlCount++; continue; }
        const r = await fetchOk(prog.programUrl, 6000);
        if (r.status === 0) { stats.urlsTimeout++; continue; }
        if (r.status === 404) {
          stats.urls404++;
          flags.critical.push({ slug: u.slug, issue: 'broken programUrl', program: prog.title, url: prog.programUrl });
          continue;
        }
        if (!r.ok) continue;
        stats.urls200++;
        const pageTitle = extractTitle(r.html);
        if (pageTitle && !PROG_MARKERS.test(pageTitle) && pageTitle.toLowerCase().indexOf(prog.title.slice(0,15).toLowerCase()) === -1) {
          stats.titleMismatch++;
          flags.warnings.push({ slug: u.slug, issue: 'title mismatch', program: prog.title, pageTitle, url: prog.programUrl });
        }
      }
      if (noUrlCount === sampled.length && sampled.length > 0) {
        flags.warnings.push({ slug: u.slug, issue: `all sampled programs lack programUrl (unverifiable)`, count: noUrlCount });
      }
    } catch (e) { process.stderr.write(`[revizor] ${it.slug}: err ${e.message}\n`); }
  }
}
await Promise.all(Array.from({length: CONCURRENCY}, () => worker()));

const criticalCount = flags.critical.length;
const warningsCount = flags.warnings.length;
const verdict = criticalCount === 0 ? 'PASS' : 'CRITICAL';

const lines = [];
lines.push('# Revizor audit — ' + new Date().toISOString().slice(0,19));
lines.push('');
lines.push(`**Verdict: ${verdict}**`);
lines.push('');
lines.push('## Stats');
lines.push('');
lines.push('| Metric | Value |');
lines.push('|---|---|');
for (const [k,v] of Object.entries(stats)) lines.push(`| ${k} | ${v} |`);
lines.push('');
lines.push(`Critical findings: ${criticalCount}, warnings: ${warningsCount}`);
lines.push('');
lines.push('## CRITICAL (broken links — must fix)');
lines.push('');
for (const c of flags.critical.slice(0, 100)) lines.push(`- **${c.slug}**: ${c.issue} — ${c.program} → ${c.url}`);
if (flags.critical.length > 100) lines.push(`- ...and ${flags.critical.length - 100} more`);
lines.push('');
lines.push('## Warnings (review)');
lines.push('');
for (const w of flags.warnings.slice(0, 200)) lines.push(`- ${w.slug}: ${w.issue}${w.program ? ' — '+w.program : ''}${w.pageTitle ? ' (page: '+w.pageTitle.slice(0,80)+')' : ''}${w.count ? ' (count: '+w.count+')' : ''}`);
if (flags.warnings.length > 200) lines.push(`- ...and ${flags.warnings.length - 200} more`);

await fs.writeFile(OUT_MD, lines.join('\n'));
await fs.writeFile(OUT_JSON, JSON.stringify(flags, null, 2));
log(`DONE: verdict=${verdict}, critical=${criticalCount}, warnings=${warningsCount}`);
console.log(JSON.stringify({ verdict, stats, criticalCount, warningsCount }));
