#!/usr/bin/env node
// kompas-scholarships-apply.mjs — применение решений владельца 2026-07-29 по стипендиям.
//
// Правила владельца:
//  (1) непроверяемые (untraceable/cloned) — убрать; агрегаторы стипендий не несут
//      (проверено по выгрузкам), значит подтвердить их нечем;
//  (2) generic-external (Fulbright и т.п.) — не стипендии вуза, убрать;
//  (3) записи, которые офсайт подтвердил (matched) или почти подтвердил (nearMiss,
//      защита от снятия живой стипендии из-за другого написания) — ОСТАВИТЬ;
//  (4) linked (есть ссылка) — оставить: источник указан, запись проверяема;
//  (5) собранное с офсайтов (extracts/scholarships, чищено clean-скриптом) — ДОБАВИТЬ
//      с url/source/verifiedBySite.
//
// Работает на КОПИИ catalog-work. Бэкап: scholarship-apply-backup.json (снимок
// массива scholarships каждого изменённого вуза). Идемпотентно: повторный прогон
// ничего не меняет (удалённые уже сняты, добавляемые совпадают по имени).
//
// Запуск: node kompas-scholarships-apply.mjs [--apply]

import fs from 'node:fs/promises';
import path from 'node:path';
import { KOMPAS_DIR, args, logger } from './lib/kompas-collect.mjs';
import { WORK_DIR, readJson } from './lib/kompas-diff-core.mjs';

const log = logger('sch-apply');
const APPLY = args.has('apply');
const today = new Date().toISOString().slice(0, 10);
const EXTRACTS = path.join(KOMPAS_DIR, 'extracts', 'scholarships');
const BACKUP_FILE = path.join(KOMPAS_DIR, 'scholarship-apply-backup.json');
const REPORT_FILE = path.join(KOMPAS_DIR, 'scholarship-apply-report.json');

const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9а-яё ]+/gi, ' ').replace(/\s+/g, ' ').trim();

async function main() {
  if (!APPLY) log('СУХОЙ ПРОГОН: только считаю. Для записи добавь --apply');

  // Сверка с офсайтами: кого подтвердил / почти подтвердил
  const diff = await readJson(path.join(KOMPAS_DIR, 'scholarship-diff-report.json'));
  const confirmed = new Map(); // slug -> Set(norm names, подтверждённые/почти)
  for (const u of diff?.universities ?? []) {
    const keep = new Set();
    // в diff-отчёте catalog/offsite — СТРОКИ (названия), не объекты
    for (const m of u.matched ?? []) keep.add(norm(typeof m.catalog === 'string' ? m.catalog : m.catalog?.name));
    for (const nm of u.nearMisses ?? []) keep.add(norm(typeof nm.catalog === 'string' ? nm.catalog : nm.catalog?.name));
    confirmed.set(u.slug, keep);
  }

  // Собранное с офсайтов
  const extractFiles = (await fs.readdir(EXTRACTS).catch(() => [])).filter((f) => f.endsWith('.json'));
  const offsite = new Map(); // slug -> records[]
  for (const f of extractFiles) {
    const e = await readJson(path.join(EXTRACTS, f));
    if (e?.slug && Array.isArray(e.scholarships)) offsite.set(e.slug, e);
  }

  const backup = {};
  const report = { generatedAt: new Date().toISOString(), removed: {}, added: 0, kept: 0, unisTouched: 0, removedTotal: 0 };
  const files = (await fs.readdir(WORK_DIR)).filter((f) => f.endsWith('.json'));

  for (const f of files) {
    const slug = f.replace(/\.json$/, '');
    const fp = path.join(WORK_DIR, f);
    const card = await readJson(fp);
    if (!card) continue;
    const before = Array.isArray(card.scholarships) ? card.scholarships : [];
    const confirmedNames = confirmed.get(slug) ?? new Set();
    let changed = false;

    // Снятие неподтверждённого
    const kept = [];
    for (const s of before) {
      const st = s.kompasStatus;
      const isConfirmed = confirmedNames.has(norm(s.name));
      const hasLink = st === 'linked' || !!s.url;
      if (isConfirmed || hasLink || !st) { kept.push(s); continue; } // без метки не трогаем (скрипт разметки туда не доходил)
      if (['untraceable', 'cloned', 'generic-external'].includes(st)) {
        report.removed[st] = (report.removed[st] || 0) + 1;
        report.removedTotal++;
        changed = true;
        continue;
      }
      kept.push(s);
    }

    // Добор с офсайта
    const have = new Set(kept.map((s) => norm(s.name)));
    const ex = offsite.get(slug);
    if (ex) {
      for (const r of ex.scholarships) {
        if (!r.name || have.has(norm(r.name))) continue;
        const rec = {
          name: r.name,
          ...(r.amount ? { amount: String(r.amount) } : {}),
          ...(r.url && /^https?:\/\//.test(r.url) ? { url: r.url } : {}),
          source: 'official-site',
          verifiedBySite: true,
          ...(ex.scrapedAt ? { checkedAt: ex.scrapedAt.slice(0, 10) } : {}),
          kompasStatus: 'linked',
          kompasCheckedAt: today,
        };
        kept.push(rec);
        have.add(norm(r.name));
        report.added++;
        changed = true;
      }
    }

    if (changed) {
      report.unisTouched++;
      backup[slug] = before;
      card.scholarships = kept;
      if (APPLY) await fs.writeFile(fp, JSON.stringify(card, null, 2) + '\n');
    }
    report.kept += kept.length;
  }

  if (APPLY) {
    await fs.writeFile(BACKUP_FILE, JSON.stringify({ generatedAt: report.generatedAt, note: 'снимки scholarships ДО применения; откат — вернуть массив вузу', unis: backup }, null, 2) + '\n');
    await fs.writeFile(REPORT_FILE, JSON.stringify(report, null, 2) + '\n');
  }
  console.log(`снято: ${report.removedTotal} ${JSON.stringify(report.removed)}`);
  console.log(`добавлено с офсайтов: ${report.added}; осталось всего: ${report.kept}; вузов затронуто: ${report.unisTouched}`);
  console.log(APPLY ? `ПРИМЕНЕНО. Бэкап: ${path.basename(BACKUP_FILE)}` : 'СУХОЙ ПРОГОН — ничего не записано.');
}

main().catch((e) => { console.error(e); process.exit(1); });
