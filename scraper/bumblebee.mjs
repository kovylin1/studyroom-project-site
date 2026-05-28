#!/usr/bin/env node
// БАМБЛБИ — критический аудитор + автофикс
// Находит unis с фатальными проблемами и запускает целевые re-runs.
//
// CRITICAL  — programs.length === 0  → re-run pauk --slug
// HIGH      — campuses и accommodation оба пусты → re-run bobr --slug
// MEDIUM    — gallery пустая или description пустой
//
// Флаги:
//   --dry-run          Только репорт, ничего не запускать
//   --only-critical    Фиксить только CRITICAL
//   --limit N          Не более N unis за один прогон (по умолчанию 20)
//   --slug SLUG        Диагностика/фикс одного университета

import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG_DIR = resolve(__dirname, '../site/src/content/universities');
const SOURCES_DIR = resolve(__dirname, 'sources');
const REPORT_FILE = resolve(SOURCES_DIR, 'bumblebee-report.json');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const ONLY_CRITICAL = args.includes('--only-critical');
const SLUG_ARG = args.includes('--slug') ? args[args.indexOf('--slug') + 1] : null;
const LIMIT_IDX = args.indexOf('--limit');
const LIMIT = LIMIT_IDX >= 0 ? Number(args[LIMIT_IDX + 1]) || 20 : 20;

const log = (...a) => console.log('[bumblebee]', new Date().toISOString().slice(11, 19), ...a);

function scoreUni(uni) {
  const issues = [];

  if (!uni.programs || uni.programs.length === 0)
    issues.push({ level: 'critical', field: 'programs', msg: 'Нет программ' });

  const hasCampuses = Array.isArray(uni.campuses) && uni.campuses.length > 0;
  const hasAccom = Array.isArray(uni.accommodation) && uni.accommodation.length > 0;
  if (!hasCampuses && !hasAccom)
    issues.push({ level: 'high', field: 'campuses', msg: 'Нет кампусов и жилья' });

  const hasGallery = uni.gallery?.items?.length > 0;
  if (!hasGallery)
    issues.push({ level: 'medium', field: 'gallery', msg: 'Нет фотогалереи' });

  const hasDesc = uni.description?.paragraphs?.length > 0;
  if (!hasDesc)
    issues.push({ level: 'medium', field: 'description', msg: 'Нет описания' });

  if (!uni.sourceUrl)
    issues.push({ level: 'high', field: 'sourceUrl', msg: 'Нет sourceUrl' });

  const severity = issues.find((i) => i.level === 'critical')
    ? 'critical'
    : issues.find((i) => i.level === 'high')
    ? 'high'
    : issues.length > 0
    ? 'medium'
    : 'ok';

  return { slug: uni.slug, name: uni.name, severity, issues };
}

function runScript(scriptPath, scriptArgs = []) {
  return new Promise((res) => {
    const proc = spawn('node', [scriptPath, ...scriptArgs], { cwd: __dirname, stdio: 'inherit' });
    proc.on('close', (code) => res(code === 0));
  });
}

async function fixEntry(entry) {
  const fixed = [];
  if (entry.issues.some((i) => i.level === 'critical')) {
    log(`  ПАУК → ${entry.slug}`);
    const ok = await runScript('pauk.mjs', ['--slug', entry.slug, '--skip-shmel', '--skip-collectors']);
    if (ok) fixed.push('programs');
  }
  if (!ONLY_CRITICAL && entry.issues.some((i) => i.field === 'campuses')) {
    log(`  БОБР → ${entry.slug}`);
    const ok = await runScript('bobr.mjs', ['--slug', entry.slug, '--skip-photos']);
    if (ok) fixed.push('campuses');
  }
  if (!ONLY_CRITICAL && entry.issues.some((i) => i.field === 'gallery')) {
    log(`  ОРЁЛ → ${entry.slug}`);
    const ok = await runScript('orel.mjs', ['--slug', entry.slug]);
    if (ok) fixed.push('gallery');
  }
  return fixed;
}

async function main() {
  log('Старт', DRY_RUN ? '(dry-run)' : '');

  const files = (await readdir(CATALOG_DIR)).filter((f) => f.endsWith('.json'));
  const toScan = SLUG_ARG ? files.filter((f) => f === SLUG_ARG + '.json') : files;

  const entries = [];
  for (const f of toScan) {
    try {
      const raw = await readFile(resolve(CATALOG_DIR, f), 'utf8');
      entries.push(scoreUni(JSON.parse(raw)));
    } catch {
      log('parse error, пропуск:', f);
    }
  }

  const ORDER = { critical: 0, high: 1, medium: 2, ok: 3 };
  entries.sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);

  const summary = {
    critical: entries.filter((e) => e.severity === 'critical').length,
    high: entries.filter((e) => e.severity === 'high').length,
    medium: entries.filter((e) => e.severity === 'medium').length,
    ok: entries.filter((e) => e.severity === 'ok').length,
    total: entries.length,
  };
  log(`critical:${summary.critical} high:${summary.high} medium:${summary.medium} ok:${summary.ok}`);

  const fixResults = [];
  if (!DRY_RUN) {
    const toFix = entries
      .filter((e) => e.severity !== 'ok')
      .filter((e) => !ONLY_CRITICAL || e.severity === 'critical')
      .slice(0, LIMIT);

    log(`Фиксим ${toFix.length} unis (лимит ${LIMIT})`);
    for (const entry of toFix) {
      log(`[${entry.severity.toUpperCase()}] ${entry.slug}`);
      const fixed = await fixEntry(entry);
      fixResults.push({ slug: entry.slug, severity: entry.severity, fixed });
    }
  }

  await mkdir(SOURCES_DIR, { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(),
    dryRun: DRY_RUN,
    summary,
    fixResults,
    issues: entries.filter((e) => e.severity !== 'ok'),
  };
  await writeFile(REPORT_FILE, JSON.stringify(report, null, 2) + '\n', 'utf8');
  log(`Репорт: ${REPORT_FILE}`);
  log('Готово.');
}

main().catch((e) => { console.error('[bumblebee] fatal:', e); process.exit(1); });
