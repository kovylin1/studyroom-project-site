#!/usr/bin/env node
// ОРЁЛ — photo quality pass: filter stock/junk photos + dedupe

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const UNI_DIR = path.join(PROJECT_ROOT, 'site/src/content/universities');

const log = (...a) => console.error('[orel]', new Date().toISOString().slice(11,19), ...a);

const STOCK_HOSTS = /shutterstock|gettyimages|istock|stock\.adobe|123rf|alamy|depositphotos|dreamstime/i;
const PEOPLE_GENERIC = /[/_-](smiling|group-?of|happy-?students|people-?talking|woman-?laptop|man-?reading|graduation-?ceremony|hand-?shake|business-?meeting|generic|placeholder|stock-)[/_-]/i;

const files = (await fs.readdir(UNI_DIR)).filter(f => f.endsWith('.json'));
log(`scanning ${files.length} unis`);

let touched = 0, removedTotal = 0, dedupedTotal = 0;

for (const f of files) {
  const p = path.join(UNI_DIR, f);
  const u = JSON.parse(await fs.readFile(p, 'utf8'));
  let items = null;
  if (Array.isArray(u.gallery)) items = u.gallery.map(x => typeof x === 'string' ? { img: x, caption: u.name||'' } : x);
  else if (u.gallery?.items) items = u.gallery.items;
  else continue;
  if (!items.length) continue;

  const before = items.length;
  let filtered = items.filter(it => {
    const url = it.img || '';
    if (!url) return false;
    if (STOCK_HOSTS.test(url)) return false;
    if (PEOPLE_GENERIC.test(url)) return false;
    return true;
  });
  const removed = before - filtered.length;

  const seenKeys = new Set();
  const deduped = [];
  for (const it of filtered) {
    let key;
    try {
      const u2 = new URL(it.img);
      const last = u2.pathname.split('/').pop() || u2.pathname;
      key = u2.hostname + ':' + last.toLowerCase();
    } catch { key = it.img.toLowerCase(); }
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    deduped.push(it);
  }
  const dedupedDelta = filtered.length - deduped.length;

  if (removed + dedupedDelta > 0) {
    u.gallery = { items: deduped };
    await fs.writeFile(p, JSON.stringify(u, null, 2) + '\n');
    touched++;
    removedTotal += removed;
    dedupedTotal += dedupedDelta;
    process.stderr.write(`[orel] ${u.slug}: -${removed} stock, -${dedupedDelta} dupes (${before}→${deduped.length})\n`);
  }
}

log(`DONE: touched=${touched}, stock-removed=${removedTotal}, deduped=${dedupedTotal}`);
console.log(JSON.stringify({ touched, removedTotal, dedupedTotal }));
