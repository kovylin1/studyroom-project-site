import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchCard, extractPriceNear, normalizeName } from './accommodation-match.mjs';

const HTML_ARU = `
  <html><body>
    <h1>Accommodation</h1>
    <div class="hall"><h2>Sedley Court</h2><p>En-suite rooms from £168 per week.</p></div>
    <div class="hall"><h2>Swinhoe Court</h2><p>Studios from £215 per week.</p></div>
    <p>Our homestay partners can help you find a host family.</p>
  </body></html>`;

test('точное название найдено + цена совпала → confirmed', () => {
  const r = matchCard({ name: 'Sedley Court', price: 'от £168/нед' }, HTML_ARU);
  assert.equal(r.verdict, 'confirmed');
  assert.equal(r.foundPrice, 168);
});

test('название найдено, цена другая → price-mismatch с найденным значением', () => {
  const r = matchCard({ name: 'Swinhoe Court', price: 'от £165/нед' }, HTML_ARU);
  assert.equal(r.verdict, 'price-mismatch');
  assert.equal(r.foundPrice, 215);
  assert.equal(r.catalogPrice, 165);
});

test('название найдено, цены на странице нет → price-unconfirmed', () => {
  const html = '<h2>Bishop Complex</h2><p>Classic halls of residence.</p>';
  const r = matchCard({ name: 'Bishop Complex', price: 'от £155/нед' }, html);
  assert.equal(r.verdict, 'price-unconfirmed');
  assert.equal(r.foundPrice, null);
});

test('карточка без цены, название найдено → confirmed', () => {
  const r = matchCard({ name: 'Sedley Court' }, HTML_ARU);
  assert.equal(r.verdict, 'confirmed');
});

test('ложная подстрока не проходит: «Homestay через Navitas» ≠ упоминание homestay', () => {
  const r = matchCard({ name: 'Homestay через Navitas', price: 'от £180/нед' }, HTML_ARU);
  assert.equal(r.verdict, 'not-found');
});

test('названия нет на странице → not-found', () => {
  const r = matchCard({ name: 'Mary Seacole Halls' }, HTML_ARU);
  assert.equal(r.verdict, 'not-found');
});

test('пустой HTML → not-found, без исключений', () => {
  assert.equal(matchCard({ name: 'Sedley Court' }, '').verdict, 'not-found');
  assert.equal(matchCard({ name: 'Sedley Court' }, null).verdict, 'not-found');
});

test('карточка без name → not-found (нечего искать)', () => {
  assert.equal(matchCard({}, HTML_ARU).verdict, 'not-found');
});

test('normalizeName схлопывает регистр, пунктуацию и пробелы', () => {
  assert.equal(normalizeName('  Sedley   Court!  '), 'sedley court');
  assert.equal(normalizeName('The Heights (BCU On-Campus)'), 'the heights bcu on campus');
});

test('extractPriceNear берёт первое число в окне, а не любое на странице', () => {
  const html = 'Fees page. <h2>Tindal Hall</h2> from £145 per week. Elsewhere £999 per week.';
  assert.equal(extractPriceNear(html, 'tindal hall'), 145);
});

test('extractPriceNear понимает разные валюты и разделители', () => {
  assert.equal(extractPriceNear('<h2>Acme Hall</h2> from AU$330 per week', 'acme hall'), 330);
  assert.equal(extractPriceNear('<h2>Acme Hall</h2> CA$1,150 per month', 'acme hall'), 1150);
});

test('допуск ±2% считается совпадением (округления сайтов)', () => {
  const html = '<h2>Acme Hall</h2> from £170 per week';
  assert.equal(matchCard({ name: 'Acme Hall', price: 'от £168/нед' }, html).verdict, 'confirmed');
});
