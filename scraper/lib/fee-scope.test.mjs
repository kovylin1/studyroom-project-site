// Тесты правила «цена программы важнее цены кампуса» (3.29).
import test from 'node:test';
import assert from 'node:assert/strict';
import { feeScope, preferProgramScope, CAMPUS_LEVEL_BASIS } from './fee-scope.mjs';

const campus = (t) => ({ t, scope: 'campus', source: 'qs' });
const program = (t, source = 'edvoy') => ({ t, scope: 'program', source });

test('кампусная основа узнаётся у строки выгрузки', () => {
  assert.equal(feeScope({ feeBasis: CAMPUS_LEVEL_BASIS }), 'campus');
  assert.equal(feeScope({ tuitionBasis: CAMPUS_LEVEL_BASIS }), 'campus');
  assert.equal(feeScope({ feeBasis: 'approxAnnual' }), 'program');
  assert.equal(feeScope({}), 'program');
  assert.equal(feeScope(null), 'program');
});

test('дешёвая кампусная сумма уступает дорогой программной', () => {
  const out = preferProgramScope([campus(13401), program(22450)]);
  assert.deepEqual(out.map((c) => c.t), [22450]);
});

test('кампусная берётся, когда программной нет вовсе', () => {
  const out = preferProgramScope([campus(16236), campus(17284)]);
  assert.equal(out.length, 2, 'выбор между кампусными остаётся минимуму');
});

test('среди программных цен правило минимума не трогается', () => {
  const list = [program(19950), program(17500, 'kaplan'), campus(13401)];
  const out = preferProgramScope(list);
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((c) => c.source).sort(), ['edvoy', 'kaplan']);
});

test('пустой список и один кандидат не ломаются', () => {
  assert.deepEqual(preferProgramScope([]), []);
  assert.deepEqual(preferProgramScope(undefined), []);
  assert.deepEqual(preferProgramScope([campus(100)]).map((c) => c.t), [100]);
});

test('порядок кандидатов сохраняется — минимум считает вызывающий', () => {
  const out = preferProgramScope([program(30000), campus(1), program(20000, 'qahe')]);
  assert.deepEqual(out.map((c) => c.t), [30000, 20000]);
});
