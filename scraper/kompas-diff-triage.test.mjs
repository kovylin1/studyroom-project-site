// Тесты разбора кейсов сверки. Проверяется главное: решение по прецеденту ставится
// только там, где семантика кейса совпала с той, по которой прецедент принимался.
import test from 'node:test';
import assert from 'node:assert/strict';
import { decide, feeBasisOf, countFromDetail } from './kompas-diff-triage.mjs';

const card = (n) => ({ programs: Array.from({ length: n }, () => ({ kompasStatus: 'catalog-only' })) });

test('основа цены читается из текста кейса', () => {
  assert.equal(feeBasisOf('расхождение 21.2%, основа цены источника: campusLevelStated.'), 'campusLevelStated');
  assert.equal(feeBasisOf('расхождение 4%, основа цены источника: approxAnnual.'), 'approxAnnual');
  assert.equal(feeBasisOf('без пометки'), null);
});

test('кампусная цена не закрывается прецедентом 29.07', () => {
  const r = decide({ issue: 'kompas_fee_mismatch', detail: 'основа цены источника: campusLevelStated.' }, null);
  assert.equal(r.decision, null);
  assert.match(r.why, /campusLevelStated/);
});

test('программная цена закрывается прецедентом', () => {
  const r = decide({ issue: 'kompas_fee_mismatch', detail: 'основа цены источника: approxAnnual.' }, null);
  assert.equal(r.decision, 'update');
});

test('отсутствие цены у источника — ignore по прецеденту', () => {
  assert.equal(decide({ issue: 'kompas_fee_absent', detail: '' }, null).decision, 'ignore');
});

test('валюта закрывается только у вузов, разобранных вручную', () => {
  assert.equal(decide({ issue: 'kompas_fee_currency', slug: 'hult', detail: '' }, null).decision, 'ignore');
  const fresh = decide({ issue: 'kompas_fee_currency', slug: 'roehampton', detail: '' }, null);
  assert.equal(fresh.decision, null, 'новый вуз ручным разбором P0.4 не покрыт');
  assert.match(fresh.why, /P0\.4/);
});

test('лишние программы закрываются только при реально стоящей метке', () => {
  const item = { issue: 'kompas_programs_extra', detail: 'В карточке 5 программ, которых нет ни в одном назначенном источнике (qs).' };
  assert.equal(decide(item, card(5)).decision, 'resolved');
  assert.equal(decide(item, card(9)).decision, 'resolved', 'меток больше, чем в кейсе, — расхождение всё равно размечено');
  assert.equal(decide(item, card(4)).decision, null, 'меток меньше — обещать нельзя');
  assert.equal(decide(item, null).decision, null);
});

test('число программ берётся из текста кейса', () => {
  assert.equal(countFromDetail('В карточке 13 программ, которых нет', /В карточке (\d+) программ/), 13);
  assert.equal(countFromDetail('нет числа', /В карточке (\d+) программ/), null);
});

test('разряды, которые скрипт решать не вправе', () => {
  for (const issue of ['kompas_programs_missing', 'kompas_campus_missing', 'kompas_no_extract']) {
    const r = decide({ issue, detail: '' }, null);
    assert.equal(r.decision, null, issue);
    assert.ok(r.why, `${issue}: причина должна быть названа`);
  }
});
