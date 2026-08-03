// Перенос решений оператора при пересборке панели.
//
// Панель — хранилище, а не производный файл: /manager коммитит решение прямо в
// site/public/api/kompas-review.json. Сборщик собирал её заново из частей и стирал
// всё нащёлканное (замер 2026-08-03: 829 решений под нож). Тесты держат заплату.
//
// Запуск: node --test scraper/kompas-panel.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { carryDecisions } from './kompas-panel.mjs';

const item = (id, extra = {}) => ({ id, slug: 'x', issue: 'i', decision: null, decidedAt: null, applied: false, ...extra });

test('решение из панели переносится в свежую сборку', () => {
  const built = [item('a'), item('b')];
  const r = carryDecisions(built, [item('a', { decision: 'ignore', decidedAt: '2026-08-01', applied: true })]);
  assert.equal(r.carried, 1);
  assert.equal(built[0].decision, 'ignore');
  assert.equal(built[0].decidedAt, '2026-08-01');
  assert.equal(built[0].applied, true);
  assert.equal(built[1].decision, null, 'нерешённый кейс остаётся нерешённым');
});

test('решение из панели старше решения из части', () => {
  const built = [item('a', { decision: 'update' })];
  const r = carryDecisions(built, [item('a', { decision: 'delete' })]);
  assert.equal(built[0].decision, 'delete');
  assert.equal(r.conflicts, 1);
  assert.equal(r.carried, 0, 'это не перенос на пустое место, а расхождение');
});

test('совпавшие решения расхождением не считаются', () => {
  const built = [item('a', { decision: 'ignore' })];
  const r = carryDecisions(built, [item('a', { decision: 'ignore' })]);
  assert.equal(r.conflicts, 0);
  assert.equal(r.carried, 0);
});

test('решение без кейса возвращается как осиротевшее, а не пропадает', () => {
  const r = carryDecisions([item('a')], [item('gone', { decision: 'delete' }), item('b')]);
  assert.equal(r.orphans.length, 1);
  assert.equal(r.orphans[0].id, 'gone');
});

test('пустая или отсутствующая прошлая панель не роняет сборку', () => {
  assert.deepEqual(carryDecisions([item('a')], undefined), { carried: 0, conflicts: 0, orphans: [] });
  assert.deepEqual(carryDecisions([item('a')], []), { carried: 0, conflicts: 0, orphans: [] });
});

test('нерешённые кейсы прошлой панели осиротевшими не считаются', () => {
  const r = carryDecisions([item('a')], [item('gone')]);
  assert.equal(r.orphans.length, 0);
});

// ── смена id при свёртке прайса ──
// Кейс стал групповым, решение оператора лежит на id одной из свёрнутых строк.

const group = (extra = {}) => item('galway||direct_fee_unlinked||2500-EUR-any', {
  members: [
    { id: 'galway||direct_fee_unlinked||2500-EUR-Psychology||aa11', legacyId: 'galway||direct_fee_unlinked||2500-EUR-Psychology' },
    { id: 'galway||direct_fee_unlinked||2500-EUR-Music||bb22', legacyId: 'galway||direct_fee_unlinked||2500-EUR-Music' },
  ],
  ...extra,
});

test('решение находится по id свёрнутой строки', () => {
  const built = [group()];
  const r = carryDecisions(built, [item('galway||direct_fee_unlinked||2500-EUR-Music||bb22', { decision: 'resolved' })]);
  assert.equal(built[0].decision, 'resolved');
  assert.equal(r.carried, 1);
  assert.equal(r.orphans.length, 0, 'решение нашло кейс — сиротой не считается');
});

test('решение находится и по legacy-id свёрнутой строки', () => {
  const built = [group()];
  const r = carryDecisions(built, [item('galway||direct_fee_unlinked||2500-EUR-Psychology', { decision: 'ignore' })]);
  assert.equal(built[0].decision, 'ignore');
  assert.equal(r.orphans.length, 0);
});

test('несколько решений на одну группу гасятся в одно, все считаются найденными', () => {
  const built = [group()];
  const r = carryDecisions(built, [
    item('galway||direct_fee_unlinked||2500-EUR-Psychology||aa11', { decision: 'resolved' }),
    item('galway||direct_fee_unlinked||2500-EUR-Music||bb22', { decision: 'resolved' }),
  ]);
  assert.equal(built[0].decision, 'resolved');
  assert.equal(r.carried, 1);
  assert.equal(r.orphans.length, 0);
});

test('решение по чужому id всё равно осиротеет', () => {
  const r = carryDecisions([group()], [item('someone-else||x', { decision: 'delete' })]);
  assert.equal(r.orphans.length, 1);
});
