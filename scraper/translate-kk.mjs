#!/usr/bin/env node
// ТІЛ — Phase 2 bulk Kazakh translation of university prose.
// Reads each site/src/content/universities/*.json, translates description.paragraphs
// and description.keyFacts to literary Kazakh via Claude API, writes paragraphsKk /
// keyFactsKk back into the same file. Resumable (skips files already done), idempotent,
// schema-faithful (1:1 array lengths, proper nouns/acronyms preserved).
//
// Usage:  ANTHROPIC_API_KEY=sk-... node scraper/translate-kk.mjs [--limit=N] [--model=claude-sonnet-4-6]
// Resume: just re-run — files that already have both *Kk arrays are skipped.
//
// Env:
//   ANTHROPIC_API_KEY  (required)
//   TIL_MODEL          (optional, default claude-sonnet-4-6)
//   TIL_CONCURRENCY    (optional, default 4)

import { readFile, writeFile, readdir, appendFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const __dir = dirname(fileURLToPath(import.meta.url));
const CATALOG = resolve(__dir, '..', 'site/src/content/universities');
const LOGFILE = resolve(__dir, '..', 'sources/til-kk.log');

const MODEL = process.env.TIL_MODEL || 'claude-sonnet-4-6';
const CONCURRENCY = Number(process.env.TIL_CONCURRENCY || 4);
const LIMIT = (() => {
  const a = process.argv.find((x) => x.startsWith('--limit='));
  return a ? Number(a.split('=')[1]) : Infinity;
})();

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('FATAL: ANTHROPIC_API_KEY is not set. Aborting.');
  process.exit(1);
}
const client = new Anthropic();

async function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try { await appendFile(LOGFILE, line + '\n'); } catch {}
}

const SYSTEM = `You are a professional translator into literary Kazakh (қазақ тілі).
You translate university marketing/description prose for a study-abroad catalogue.
Rules:
- Produce natural, fluent literary Kazakh — never a word-for-word calque.
- Keep proper nouns untranslated: university names, city names, "StudyRoom", college/programme names.
- Keep acronyms and technical terms untranslated: IELTS, TOEFL, UCAS, SAT, GPA, QS, IB, A-level, Foundation, Pre-Master's, Russell Group, AACSB, BSc, MSc, etc.
- Keep numbers, currencies (£, $, €, ₸) and dates exactly as in the source.
- The source may be in English or Russian — translate the meaning into Kazakh either way.
- Preserve array length and order: output arrays MUST have exactly the same number of items as the input arrays, each item translating the corresponding input item.
Respond with STRICT JSON only, no prose, no markdown fences:
{"paragraphsKk": [...], "keyFactsKk": [...]}
If an input array is empty or absent, return an empty array for it.`;

function extractJson(text) {
  // Strip accidental code fences, grab the first {...} block.
  const t = text.replace(/```json\s*|```\s*/g, '').trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('no JSON object in response');
  return JSON.parse(t.slice(start, end + 1));
}

async function translateFile(file) {
  const path = join(CATALOG, file);
  const raw = await readFile(path, 'utf8');
  const data = JSON.parse(raw);
  const d = data.description;
  if (!d) return { file, status: 'skip-no-desc' };

  const srcParagraphs = Array.isArray(d.paragraphs) ? d.paragraphs : [];
  const srcKeyFacts = Array.isArray(d.keyFacts) ? d.keyFacts : [];
  if (srcParagraphs.length === 0 && srcKeyFacts.length === 0) return { file, status: 'skip-empty' };

  const needPara = srcParagraphs.length > 0 && !(Array.isArray(d.paragraphsKk) && d.paragraphsKk.length === srcParagraphs.length);
  const needFacts = srcKeyFacts.length > 0 && !(Array.isArray(d.keyFactsKk) && d.keyFactsKk.length === srcKeyFacts.length);
  if (!needPara && !needFacts) return { file, status: 'skip-done' };

  const userMsg = JSON.stringify({ paragraphs: srcParagraphs, keyFacts: srcKeyFacts });

  let attempt = 0;
  while (true) {
    attempt++;
    try {
      const resp = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: SYSTEM,
        messages: [{ role: 'user', content: `Translate to Kazakh. Source JSON:\n${userMsg}` }],
      });
      const text = resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
      const out = extractJson(text);
      const pKk = Array.isArray(out.paragraphsKk) ? out.paragraphsKk : [];
      const fKk = Array.isArray(out.keyFactsKk) ? out.keyFactsKk : [];

      // Length sanity: must match source 1:1 (when source non-empty).
      if (srcParagraphs.length && pKk.length !== srcParagraphs.length)
        throw new Error(`paragraphs length ${pKk.length} != ${srcParagraphs.length}`);
      if (srcKeyFacts.length && fKk.length !== srcKeyFacts.length)
        throw new Error(`keyFacts length ${fKk.length} != ${srcKeyFacts.length}`);
      if (pKk.some((s) => typeof s !== 'string' || !s.trim()) || fKk.some((s) => typeof s !== 'string' || !s.trim()))
        throw new Error('empty/non-string item in output');

      if (srcParagraphs.length) data.description.paragraphsKk = pKk;
      if (srcKeyFacts.length) data.description.keyFactsKk = fKk;

      // Preserve trailing newline if the original had one; 2-space indent; no BOM.
      const endNl = raw.endsWith('\n') ? '\n' : '';
      await writeFile(path, JSON.stringify(data, null, 2) + endNl, 'utf8');
      return { file, status: 'ok', p: pKk.length, f: fKk.length };
    } catch (err) {
      const msg = String(err?.message || err);
      const rateLimited = err?.status === 429 || /rate|overloaded|529|503/i.test(msg);
      if (attempt < 5 && (rateLimited || /length|JSON|no JSON|empty\/non-string/.test(msg))) {
        const backoff = rateLimited ? Math.min(60000, 2000 * 2 ** attempt) : 800 * attempt;
        await log(`RETRY ${file} (attempt ${attempt}): ${msg} — waiting ${backoff}ms`);
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      return { file, status: 'error', error: msg };
    }
  }
}

async function pool(items, size, worker) {
  const results = [];
  let i = 0;
  const runners = Array.from({ length: size }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
  return results;
}

async function main() {
  const all = (await readdir(CATALOG)).filter((f) => f.endsWith('.json')).sort();
  await log(`START til-kk: ${all.length} files, model=${MODEL}, concurrency=${CONCURRENCY}, limit=${LIMIT}`);

  let done = 0, ok = 0, skipped = 0, errors = 0, processed = 0;
  const work = all.slice(0); // resume handled per-file (skip-done)

  await pool(work, CONCURRENCY, async (file) => {
    if (processed >= LIMIT) return { file, status: 'skip-limit' };
    const res = await translateFile(file);
    done++;
    if (res.status === 'ok') { ok++; processed++; }
    else if (res.status === 'error') { errors++; await log(`ERROR ${file}: ${res.error}`); }
    else skipped++;
    if (res.status === 'ok' && ok % 25 === 0) await log(`progress: ${ok} translated, ${skipped} skipped, ${errors} errors (${done}/${all.length} seen)`);
    return res;
  });

  await log(`DONE til-kk: translated=${ok}, skipped=${skipped}, errors=${errors}, total=${all.length}`);
  if (errors > 0) await log(`NOTE: ${errors} files errored — re-run to retry them (resumable).`);
}

main().catch(async (e) => { await log(`FATAL: ${e?.stack || e}`); process.exit(1); });
