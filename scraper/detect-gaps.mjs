#!/usr/bin/env node
// detect-gaps.mjs — ПАУК gap detector.
// Reads catalog JSONs, scores each uni by data quality, outputs shmel-worklist.json.
// Gap signals: low program count, stale lastChecked, missing provenance, source conflicts.
// Usage: node scraper/detect-gaps.mjs [--min-programs=N] [--output=path]

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_DIR = path.join(__dirname, '..', 'site', 'src', 'content', 'universities');
const SOURCES_DIR = path.join(__dirname, 'sources');
const DEFAULT_OUT = path.join(SOURCES_DIR, 'shmel-worklist.json');

const arg = (prefix) => (process.argv.find(a => a.startsWith(prefix)) || '').slice(prefix.length);
const MIN_PROGRAMS = parseInt(arg('--min-programs=') || '8', 10);
const OUTPUT = arg('--output=') || DEFAULT_OUT;

const NOW = Date.now();
const DAY_MS = 86_400_000;

function daysAgo(iso) {
  if (!iso) return Infinity;
  const t = Date.parse(iso);
  return isNaN(t) ? Infinity : (NOW - t) / DAY_MS;
}

function assess(u) {
  const programs = u.programs || [];
  const n = programs.length;
  const staleDays = Math.round(daysAgo(u.lastChecked));
  const sources = [...new Set(programs.map(p => p.source).filter(Boolean))];
  const verified = programs.filter(p => p.verifiedBySite === true).length;
  const withSource = programs.filter(p => p.source).length;

  const reasons = [];
  let priority = 'low';

  if (n === 0) {
    reasons.push('no programs');
    priority = 'critical';
  } else if (n < 3) {
    reasons.push(`only ${n} program(s)`);
    priority = 'critical';
  } else if (n < MIN_PROGRAMS) {
    reasons.push(`${n} programs (threshold ${MIN_PROGRAMS})`);
    if (priority !== 'critical') priority = 'high';
  }

  if (staleDays > 180) {
    reasons.push(`stale: lastChecked ${staleDays}d ago`);
    if (priority === 'low') priority = 'high';
  } else if (staleDays > 90) {
    reasons.push(`aging: ${staleDays}d ago`);
    if (priority === 'low') priority = 'medium';
  }

  if (n > 0 && verified === 0) {
    reasons.push('no verifiedBySite');
    if (priority === 'low') priority = 'medium';
  }
  if (n > 0 && withSource === 0) {
    reasons.push('no source provenance');
    if (priority === 'low') priority = 'medium';
  }
  if (sources.length === 1 && n >= MIN_PROGRAMS) {
    reasons.push(`single source: ${sources[0]}`);
    if (priority === 'low') priority = 'medium';
  }

  const base = { critical: 100, high: 60, medium: 30, low: 0 }[priority];
  const score = Math.round(
    base + Math.min(staleDays / 10, 20) + Math.max(0, MIN_PROGRAMS - n) + (n > 0 && verified === 0 ? 5 : 0),
  );

  return { slug: u.slug, name: u.name, sourceUrl: u.sourceUrl, programs: n, verified, sources, staleDays, priority, reasons, score };
}

const files = (await fs.readdir(CATALOG_DIR)).filter(f => f.endsWith('.json'));
const items = [];
for (const f of files) {
  const u = JSON.parse(await fs.readFile(path.join(CATALOG_DIR, f), 'utf8'));
  const e = assess(u);
  if (e.priority !== 'low') items.push(e);
}
items.sort((a, b) => b.score - a.score);

const byPriority = { critical: 0, high: 0, medium: 0 };
for (const it of items) byPriority[it.priority] = (byPriority[it.priority] || 0) + 1;

await fs.mkdir(SOURCES_DIR, { recursive: true });
await fs.writeFile(OUTPUT, JSON.stringify({
  generated: new Date().toISOString(), minPrograms: MIN_PROGRAMS,
  total: items.length, byPriority, items,
}, null, 2) + '\n');

console.log(JSON.stringify({ total: items.length, byPriority, output: OUTPUT }));
