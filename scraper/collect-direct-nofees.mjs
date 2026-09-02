#!/usr/bin/env node
// collect-direct-nofees.mjs — задача A1: цены прямых партнёров, у которых их нет.
//
// Разрешение владельца на офсайт-сбор получено 02.09.2026: «у прямых партнёров нет
// достоверной инфы, так что надо посмотреть на офф сайте». Правило 1 КОМПАСа
// (программы и цены только с агрегаторов) снято ТОЛЬКО для этого списка.
//
// Замер 02.09: из 32 прямых партнёров у 15 ноль цен, ещё у 4 почти ноль.
// Агрегаторы этих вузов не показывают — брать цену больше неоткуда.
//
// Что делает: гоняет kompas-collect-direct.mjs по одному слагу за раз.
// Живой каталог НЕ трогается: сборщик пишет в sources/kompas/extracts/direct/.
// Применение собранного — отдельным шагом, после просмотра глазами.
//
// Запуск: node collect-direct-nofees.mjs [--max-pages=N]

import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const REPORT = join(ROOT, 'sources/kompas/direct-nofees-collect.json');

// Слаги отобраны замером «прямой партнёр, цен < 15 % программ» (02.09.2026).
const SLUGS = [
  'sp-jain-school-of-global-management-dubai',
  'inti-international-university',
  'anglo-american-university',
  'xi-an-jiaotong-liverpool-university',
  'transport-and-telecommunication-institute',
  'cyprus-international-university',
  'lane-college',
  'milton-friedman-university',
  'beykent-university',
  'gedu-global-education',
  'california-state-university-dominguez-hills',
  'final-international-university',
  'northland-institute',
  'university-of-european-management',
  'woosong-university',
  'burgundy-school-of-business',
  'curtin-university-dubai',
  'srh-university',
  'karelia-university-of-applied-sciences',
];

const maxPages = (process.argv.find((a) => a.startsWith('--max-pages=')) || '--max-pages=40').split('=')[1];
const log = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);

const results = [];
for (const slug of SLUGS) {
  log(`--- ${slug}`);
  const started = Date.now();
  const out = await new Promise((done) => {
    const chunks = [];
    const child = spawn(process.execPath, ['kompas-collect-direct.mjs', `--slug=${slug}`, `--max-pages=${maxPages}`], {
      cwd: HERE,
    });
    child.stdout.on('data', (d) => chunks.push(d));
    child.stderr.on('data', (d) => chunks.push(d));
    // Вуз за защитой не должен вешать очередь: 12 минут — и дальше.
    const killer = setTimeout(() => child.kill(), 12 * 60 * 1000);
    child.on('close', (code) => {
      clearTimeout(killer);
      done({ code, text: Buffer.concat(chunks).toString('utf8') });
    });
  });
  const tail = out.text.trim().split('\n').slice(-6).join('\n');
  console.log(tail);
  results.push({ slug, exitCode: out.code, seconds: Math.round((Date.now() - started) / 1000), tail });
  await writeFile(REPORT, JSON.stringify({ ranAt: new Date().toISOString(), results }, null, 2));
}

const ok = results.filter((r) => r.exitCode === 0).length;
log(`ГОТОВО: ${ok} из ${SLUGS.length} прошли без ошибки. Отчёт: ${REPORT.slice(ROOT.length + 1)}`);
