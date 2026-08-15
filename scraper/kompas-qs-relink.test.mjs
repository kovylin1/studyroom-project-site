// Тесты привязки выгрузок QS. Главное: автоматом закрывается только полное
// совпадение имени в той же стране, всё остальное уходит человеку.
import test from 'node:test';
import assert from 'node:assert/strict';
import { decideLink } from './kompas-qs-relink.mjs';

const catalog = new Set(['uic', 'solent', 'cardenal-herrera-valencia', 'marangoni-milan']);

test('полное совпадение имени и страны — привязываем', () => {
  const r = decideLink({ suggestions: [{ slug: 'uic', score: 1, sameCountry: true }] }, catalog);
  assert.deepEqual([r.action, r.to], ['link', 'uic']);
});

test('0.75 — не механика, идёт человеку', () => {
  const r = decideLink({ suggestions: [{ slug: 'cardenal-herrera-valencia', score: 0.75, sameCountry: true }] }, catalog);
  assert.equal(r.action, 'ask');
  assert.equal(r.tier, 'надёжно');
});

test('другая страна не привязывается даже при совпадении имени', () => {
  const r = decideLink({ suggestions: [{ slug: 'marangoni-milan', score: 1, sameCountry: false }] }, catalog);
  assert.equal(r.action, 'none');
});

test('подсказка на карточку, которой в каталоге уже нет, не считается', () => {
  const r = decideLink({ suggestions: [{ slug: 'удалённая-карточка', score: 1, sameCountry: true }] }, catalog);
  assert.equal(r.action, 'none');
});

test('без подсказок — решать нечего', () => {
  assert.equal(decideLink({ suggestions: [] }, catalog).action, 'none');
});
