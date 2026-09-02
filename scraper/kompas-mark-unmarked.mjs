#!/usr/bin/env node
// kompas-mark-unmarked.mjs — разметка карточек, приехавших без `partnerSource`.
//
// Долг переноса 3.1 (23.08.2026): применятель скопировал 181 карточку из рабочей копии
// в живой каталог целиком, но поля `partnerSource` у них не было ни там, ни там — их
// заводил edvoy-коллектор, который метку не ставил. В итоге перенос закрыл одну дыру
// и открыл другую: 181 карточка из 1070 стоит без источника.
//
// Метка выводится не догадкой, а из `sourceUrl` карточки и правила членства в
// `scraper/sources/partner-registry.json`. Ставится только агрегаторам с правилом
// `partners: "all"` — там членство следует из самого факта присутствия в выгрузке.
// Для агрегаторов со списком (`partners: "list"`) присутствие в выгрузке членства
// НЕ доказывает, такие карточки скрипт не трогает и выписывает в отчёт.
//
// Пишет в ОБЕ копии каталога сразу (живую и рабочую), иначе они разъедутся и
// следующий `kompas-apply-workcopy` затрёт правку.
//
// Запуск:
//   node scraper/kompas-mark-unmarked.mjs            — только замер, ничего не пишет
//   node scraper/kompas-mark-unmarked.mjs --apply    — записать
//   node scraper/kompas-mark-unmarked.mjs --rollback=<папка бэкапа>

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LIVE = path.join(ROOT, 'site/src/content/universities');
const WORK = path.join(ROOT, 'sources/kompas/catalog-work');
const REGISTRY = path.join(ROOT, 'scraper/sources/partner-registry.json');
const BACKUPS = path.join(ROOT, 'backups');

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const ROLLBACK = (argv.find((a) => a.startsWith('--rollback=')) || '').split('=')[1];

// ---------- откат ----------
if (ROLLBACK) {
  const dir = path.isAbsolute(ROLLBACK) ? ROLLBACK : path.join(BACKUPS, ROLLBACK);
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  let n = 0;
  for (const rec of manifest.files) {
    const src = path.join(dir, rec.backup);
    if (fs.existsSync(src)) { fs.copyFileSync(src, path.join(ROOT, rec.target)); n++; }
  }
  console.log(`Откат из ${dir}: восстановлено ${n} файлов.`);
  process.exit(0);
}

// ---------- правила членства ----------
const registry = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
// хост выгрузки → id агрегатора. Хосты взяты из sourceUrl карточек каталога.
const HOST_TO_AGG = {
  'edge.edvoy.com': 'edvoy',
  'edvoy.com': 'edvoy',
  'admissions.qs.com': 'qs',
  'topuniversities.com': 'qs',
  'kaplanpathways.com': 'kaplan',
  'catsglobalschools.com': 'cats',
  'qa.com': 'qahe',
  'oxfordinternational.com': 'oxford-international',
  'studygroup.com': 'studygroup',
  'navitas.com': 'navitas',
  'gedu.global': 'gedu',
};
const ruleOf = new Map(registry.aggregators.map((a) => [a.key, a.rule]));

// ---------- разбор каталога ----------
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return null; } };

const plan = [];      // что размечаем
const skipped = [];   // почему не размечаем
for (const f of fs.readdirSync(LIVE).filter((x) => x.endsWith('.json'))) {
  const slug = f.replace('.json', '');
  const j = JSON.parse(fs.readFileSync(path.join(LIVE, f), 'utf8'));
  if (j.partnerSource) continue;                       // уже размечена
  const h = host(j.sourceUrl);
  const agg = h && HOST_TO_AGG[h];
  if (!agg) { skipped.push([slug, `источник не опознан: ${j.sourceUrl || 'нет sourceUrl'}`]); continue; }
  const rule = ruleOf.get(agg);
  if (rule !== 'all') { skipped.push([slug, `${agg}: членство по списку, присутствие в выгрузке его не доказывает`]); continue; }
  plan.push({ slug, agg, programs: (j.programs || []).length });
}

const byAgg = {};
for (const p of plan) byAgg[p.agg] = (byAgg[p.agg] || 0) + 1;
console.log(`Карточек без partnerSource: ${plan.length + skipped.length}`);
console.log(`  размечаем: ${plan.length} ${JSON.stringify(byAgg)}`);
console.log(`  пропускаем: ${skipped.length}`);
for (const [s, why] of skipped.slice(0, 20)) console.log(`    ${s} — ${why}`);

if (!APPLY) {
  console.log('\nЭто замер. Записать: --apply');
  process.exit(0);
}

// ---------- запись с бэкапом ----------
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const bdir = path.join(BACKUPS, `mark-unmarked_${stamp}`);
fs.mkdirSync(bdir, { recursive: true });
const manifest = { createdAt: new Date().toISOString(), script: 'kompas-mark-unmarked.mjs', files: [] };

let written = 0, missingInWork = 0;
for (const item of plan) {
  for (const [copy, dir] of [['live', LIVE], ['work', WORK]]) {
    const target = path.join(dir, item.slug + '.json');
    if (!fs.existsSync(target)) { if (copy === 'work') missingInWork++; continue; }
    const rel = path.relative(ROOT, target).replace(/\\/g, '/');
    const bname = `${copy}__${item.slug}.json`;
    fs.copyFileSync(target, path.join(bdir, bname));
    manifest.files.push({ target: rel, backup: bname });

    const j = JSON.parse(fs.readFileSync(target, 'utf8'));
    if (j.partnerSource) continue;                    // идемпотентность
    j.partnerSource = { type: 'aggregator', via: [item.agg] };
    fs.writeFileSync(target, JSON.stringify(j, null, 2) + '\n');
    written++;
  }
}
fs.writeFileSync(path.join(bdir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`\nЗаписано файлов: ${written} (обе копии). В рабочей копии не нашлось: ${missingInWork}.`);
console.log(`Бэкап: ${path.relative(ROOT, bdir)}`);
console.log(`Откат: node scraper/kompas-mark-unmarked.mjs --rollback=${path.basename(bdir)}`);
