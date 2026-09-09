// КОМПАС — оркестратор категории 1, прогон 2026-08-21.
//
// Решение владельца 21.08: «если есть в QS, должно быть и у нас»; повторяющиеся
// карточки SRH слить в одну. Заведение 45 карточек ждёт подтверждения городов —
// схема требует город, а QS его не отдаёт ни по одной из записей; выдумывать
// город нельзя (урок Navitas, см. BACKLOG).
//
// Этапы:
//   1. Добор программ (задача 1.9) — kompas-backfill-programs.mjs --apply.
//      Пишет в РАБОЧУЮ КОПИЮ catalog-work, не в живой каталог.
//   2. Слияние дублей SRH: `srh-international-college` (Хайдельберг, 18 программ)
//      вливается в `srh-germany` (Берлин, 82) — имя у карточек одно и то же.
//      После слияния к ней крепится выгрузка «SRH Universities» (84 программы).
//   3. Пересверка + перенос решений панели.
//
// Логи — logs/cat1-*.log. Каталог правится только на этапе 2 и только слиянием;
// откат — sources/kompas/srh-merge-backup.json.

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOGS = path.join(ROOT, 'logs');
const CATALOG = path.join(ROOT, 'site/src/content/universities');
const WORK = path.join(ROOT, 'sources/kompas/catalog-work');
const EX = path.join(ROOT, 'sources/kompas/extracts/qs');
const K = path.join(ROOT, 'sources/kompas');

fs.mkdirSync(LOGS, { recursive: true });
const say = (m) => { const l = `[cat1] ${m}\n`; process.stdout.write(l); fs.appendFileSync(path.join(LOGS, 'cat1-orchestrator.log'), l); };

function run(script, args, logName) {
  return new Promise((resolve) => {
    const out = fs.createWriteStream(path.join(LOGS, logName));
    const p = spawn(process.execPath, [path.join(ROOT, 'scraper', script), ...args], { cwd: ROOT });
    p.stdout.pipe(out); p.stderr.pipe(out);
    let tail = '';
    p.stdout.on('data', (d) => { tail = (tail + d).slice(-2000); });
    p.stderr.on('data', (d) => { tail = (tail + d).slice(-2000); });
    p.on('close', (code) => resolve({ code, tail }));
  });
}

const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const writeJson = (f, j) => fs.writeFileSync(f, JSON.stringify(j, null, 2));

// ─────────────────────────────────────────────────────── этап 1: добор программ
async function stage1() {
  say('этап 1 — добор программ (1.9)');
  const { code, tail } = await run('kompas-backfill-programs.mjs', ['--apply'], 'cat1-backfill-programs.log');
  say(`этап 1 завершён, код ${code}`);
  say(tail.trim().split('\n').slice(-3).join(' | '));
  return code === 0;
}

// ───────────────────────────────────────────────────────── этап 2: слияние SRH
// Карточки-дубли различаются только городом, имя одно: «SRH International College».
// Выживает та, где больше программ и к которой уже привязана выгрузка QS.
const KEEP = 'srh-germany';
const DROP = 'srh-international-college';

function mergeCards(keepCard, dropCard) {
  const key = (p) => String(p.slug || p.title || '').toLowerCase().trim();
  const have = new Set((keepCard.programs || []).map(key));
  const added = [];
  for (const p of dropCard.programs || []) {
    if (have.has(key(p))) continue;
    have.add(key(p));
    added.push({ ...p, mergedFrom: DROP });
  }
  keepCard.programs = [...(keepCard.programs || []), ...added];

  const ckey = (c) => String(c.title || c.sub || c).toLowerCase().trim();
  const haveC = new Set((keepCard.campuses || []).map(ckey));
  for (const c of dropCard.campuses || []) if (!haveC.has(ckey(c))) { haveC.add(ckey(c)); (keepCard.campuses ||= []).push(c); }

  // город становится составным — так каталог уже пишет мультикампусные карточки
  const cities = String(keepCard.city || '').split(',').map((s) => s.trim()).filter(Boolean);
  for (const c of String(dropCard.city || '').split(',').map((s) => s.trim()).filter(Boolean)) {
    if (!cities.includes(c)) cities.push(c);
  }
  if (cities.length) keepCard.city = cities.join(', ');

  // непустые поля, которых нет у выжившей карточки, переносим
  for (const [k, v] of Object.entries(dropCard)) {
    if (k === 'programs' || k === 'campuses' || k === 'city' || k === 'slug' || k === 'name') continue;
    const cur = keepCard[k];
    const empty = cur === undefined || cur === null || cur === '' || (Array.isArray(cur) && !cur.length);
    if (empty && v !== undefined && v !== null && v !== '') keepCard[k] = v;
  }
  return added.length;
}

function stage2() {
  say('этап 2 — слияние дублей SRH');
  const keepF = path.join(CATALOG, `${KEEP}.json`);
  const dropF = path.join(CATALOG, `${DROP}.json`);
  if (!fs.existsSync(dropF)) { say('  дубль уже слит, пропуск'); return; }

  const keep = readJson(keepF);
  const drop = readJson(dropF);
  fs.writeFileSync(path.join(K, 'srh-merge-backup.json'), JSON.stringify({
    mergedAt: '2026-08-21', keep: KEEP, drop: DROP, keepBefore: keep, dropBefore: drop,
  }, null, 1));

  const added = mergeCards(keep, drop);
  writeJson(keepF, keep);
  fs.unlinkSync(dropF);
  say(`  ${DROP} → ${KEEP}: +${added} программ, город «${keep.city}», карточка-дубль удалена`);

  // та же операция в рабочей копии, иначе сверка увидит разное
  const wKeep = path.join(WORK, `${KEEP}.json`);
  const wDrop = path.join(WORK, `${DROP}.json`);
  if (fs.existsSync(wKeep) && fs.existsSync(wDrop)) {
    const k2 = readJson(wKeep); const d2 = readJson(wDrop);
    const n = mergeCards(k2, d2);
    writeJson(wKeep, k2); fs.unlinkSync(wDrop);
    say(`  рабочая копия: +${n} программ`);
  }

  // выгрузки, смотревшие на удалённую карточку, переводим на выжившую
  let moved = 0;
  for (const f of fs.readdirSync(EX).filter((x) => x.endsWith('.json'))) {
    const p = path.join(EX, f); const e = readJson(p);
    if (e.catalogSlug === DROP) { e.catalogSlug = KEEP; e.catalogSlugSource = 'srh-merge-2026-08-21'; fs.writeFileSync(p, JSON.stringify(e, null, 1)); moved++; }
  }
  say(`  перенаправлено выгрузок: ${moved}`);

  // «SRH Universities» — 84 программы, ждала разбора дубля
  const srhU = path.join(EX, 'srh-universities.json');
  if (fs.existsSync(srhU)) {
    const e = readJson(srhU);
    if (!e.catalogSlug) {
      e.catalogSlug = KEEP;
      e.catalogSlugSource = 'srh-merge-2026-08-21';
      fs.writeFileSync(srhU, JSON.stringify(e, null, 1));
      say(`  «SRH Universities» (${(e.programs || []).length} программ) → ${KEEP}`);
    }
  }
}

// ────────────────────────────────────────────────── этап 3: пересверка и решения
async function stage3() {
  say('этап 3 — пересверка');
  const prev = path.join(K, 'diff-review.before-cat1-stage3.json');
  fs.copyFileSync(path.join(K, 'diff-review.json'), prev);

  let r = await run('kompas-diff.mjs', [], 'cat1-diff.log');
  say(`  сверка код ${r.code}: ${r.tail.trim().split('\n').slice(-1)[0]}`);
  if (r.code !== 0) return false;

  r = await run('kompas-diff-carry.mjs', [`--prev=${path.relative(ROOT, prev)}`, '--apply'], 'cat1-diff-carry.log');
  say(`  перенос решений код ${r.code}: ${r.tail.trim().split('\n').slice(-2).join(' | ')}`);
  return r.code === 0;
}

// ───────────────────────────────────────────────────────────────────────── main
(async () => {
  say('старт');
  const ok1 = await stage1();
  if (!ok1) { say('этап 1 упал — останавливаюсь, каталог не тронут'); process.exit(1); }
  stage2();
  const ok3 = await stage3();
  say(ok3 ? 'готово' : 'этап 3 упал');
  process.exit(ok3 ? 0 : 1);
})();
