// Тесты отбора кампусов. Проверяется главное: дописывается только настоящее
// новое место, а имя главного кампуса под маркой агрегатора — нет.
import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyCampus, placeTokens, looksLikeProse, closeWord } from './kompas-backfill-campuses.mjs';

const abertay = { name: 'Abertay University', city: 'Dundee', country: 'United Kingdom' };
const bangor = { name: 'Bangor University', city: 'Bangor', country: 'United Kingdom' };
const uab = { name: 'University of Alabama at Birmingham', city: 'Birmingham, AL', country: 'United States' };
const waikato = { name: 'University of Waikato', city: 'Hamilton', country: 'New Zealand' };
const otago = { name: 'University of Otago', city: 'Dunedin', country: 'New Zealand' };

test('имя вуза вместо кампуса — не кампус', () => {
  assert.equal(classifyCampus('Bangor University', bangor, ['Bangor Main Campus']).action, 'skip');
  assert.equal(classifyCampus('Abertay Campus', abertay, ['City Centre Campus']).kind, 'alias');
});

test('настоящий второй город дописывается', () => {
  assert.equal(classifyCampus('Wrexham Campus', bangor, ['Bangor Main Campus']).action, 'add');
  assert.equal(classifyCampus('Christchurch Campus', otago, []).action, 'add');
});

test('аббревиатура заведения снимается, место остаётся', () => {
  assert.deepEqual(placeTokens('ASU London Campus', { name: 'Arizona State University', city: 'Phoenix', country: 'United States' }), ['london']);
  assert.deepEqual(placeTokens('UNIC Cyprus Campus', { name: 'University of Nicosia', city: 'Nicosia', country: 'Cyprus' }), []);
});

test('опечатка в городе не заводит второй кампус', () => {
  assert.ok(closeWord('biringham', 'birmingham'));
  assert.equal(classifyCampus('Alabama Biringham Campus', uab, ['UAB Main Campus']).action, 'skip');
});

test('тот же город, что у имеющегося кампуса — дубль', () => {
  assert.equal(classifyCampus('Tauranga Campus', waikato, ['Hamilton Main Campus', 'Tauranga Campus (Bay of Plenty)']).kind, 'duplicate');
});

test('онлайн — не место', () => {
  assert.equal(classifyCampus('Online Campus', { name: 'University of Plymouth', city: 'Plymouth', country: 'United Kingdom' }, ['Plymouth Main Campus']).kind, 'not-place');
});

test('абзац описания опознаётся как брак разбора', () => {
  const prose = 'Delivered in English on our Paris campus, the Bachelor Applied Management and Economics is a three-year programme.';
  assert.ok(looksLikeProse(prose));
  assert.equal(classifyCampus(prose, { name: 'EMA', city: 'Paris', country: 'France' }, []).kind, 'prose');
  assert.equal(looksLikeProse('Queen’s Medical Centre'), false);
});
