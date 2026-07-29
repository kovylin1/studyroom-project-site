// Сквозной тест: после любого --dry-run рабочее дерево должно остаться чистым.
//
// Долг из BACKLOG (найден 2026-07-20): `bobr.mjs --dry-run` создал новый файл
// вуза и изменил ещё 99, добавив ~91 000 строк программ — флаг не доходил до
// пишущих фаз. Проверять это глазами каждый раз бессмысленно, поэтому тест.
//
// Дерево сравнивается ПО СОДЕРЖИМОМУ (git status), а не по времени изменения:
// скрипт может переписать файл тем же текстом, и mtime соврёт.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const SCRAPER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRAPER, '..');

const gitState = () =>
  execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' });

/** Скрипты, у которых --dry-run обязан быть по-настоящему сухим. */
const DRY_SCRIPTS = [
  ['orel-apply.mjs', ['--dry-run']],
  ['orel-hunt.mjs', ['--dry-run', '--slug=acadia']],
];

for (const [script, args] of DRY_SCRIPTS) {
  test(`${script} ${args.join(' ')} не трогает рабочее дерево`, { timeout: 180000 }, () => {
    const before = gitState();
    try {
      execFileSync('node', [path.join(SCRAPER, script), ...args], { cwd: ROOT, stdio: 'pipe' });
    } catch (e) {
      // Падение скрипта — отдельная беда, но дерево всё равно обязано быть чистым.
      assert.equal(gitState(), before, `${script} упал И оставил следы: ${e.message}`);
      throw e;
    }
    assert.equal(gitState(), before, `${script} записал что-то в сухом прогоне`);
  });
}
