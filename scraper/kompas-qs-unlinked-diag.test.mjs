// Тесты разрядки предложений из kompas-qs-unlinked-diag.
//
// Разряд решает, поверит ли владелец привязке, поэтому все примеры ниже — НАСТОЯЩИЕ пары
// из прогона 2026-08-02, включая тот брак, который нашёлся просмотром глазами и ради
// которого разрядка и заведена.
//
// Запуск: node --test scraper/kompas-qs-unlinked-diag.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { stripBadge, similarity, tierOf } from './kompas-qs-unlinked-diag.mjs';

test('бейдж уровня снимается с хвоста имени', () => {
  assert.equal(stripBadge('University of Worcester (Undergraduate)'), 'University of Worcester');
  assert.equal(stripBadge('Stony Brook University (Undergraduate)'), 'Stony Brook University');
  assert.equal(stripBadge('University of Essex (Online) (CertHE & Postgraduate)'), 'University of Essex');
  assert.equal(stripBadge('Les Roches (Postgraduate)'), 'Les Roches');
});

test('скобка, которая НЕ бейдж, остаётся на месте', () => {
  // Тут скобка — часть имени, а не разряд партнёрства. Срежем её — потеряем кампус
  // и «EU Business School (Munich)» сольётся с барселонским.
  assert.equal(stripBadge('EU Business School (Munich)'), 'EU Business School (Munich)');
  assert.equal(stripBadge('East Asia Institute of Management (EAIM)'), 'East Asia Institute of Management (EAIM)');
  assert.equal(stripBadge('Rochester Institute of Technology (RIT) Dubai'), 'Rochester Institute of Technology (RIT) Dubai');
});

test('две записи QS с разными бейджами дают одно базовое имя', () => {
  assert.equal(
    stripBadge('Texas A&M University - Corpus Christi (Undergraduate)'),
    stripBadge('Texas A&M University - Corpus Christi (Postgraduate)'),
  );
});

test('схожесть не зависит от родовых слов и порядка', () => {
  assert.equal(similarity('University of Illinois at Chicago', 'University of Illinois Chicago'), 1);
  assert.ok(similarity('Universidad CEU Cardenal Herrera', 'Cardenal Herrera CEU') >= 0.75);
  assert.equal(similarity('', 'что угодно'), 0);
});

test('разряд «надёжно» — только при 0.75+ И той же стране', () => {
  assert.equal(tierOf({ score: 1, sameCountry: true }), 'надёжно');
  assert.equal(tierOf({ score: 0.75, sameCountry: true }), 'надёжно');
  assert.equal(tierOf({ score: 0.74, sameCountry: true }), 'нужен глаз');
  assert.equal(tierOf(null), null);
});

test('другая страна не попадает в «надёжно» даже при полном совпадении имени', () => {
  // Настоящий брак прогона: «Istituto Marangoni Paris» (Франция) садился на
  // `marangoni-milan` (Италия). Одна сеть, разные кампусы — разные карточки.
  assert.equal(tierOf({ score: 1, sameCountry: false }), 'другая страна');
  assert.equal(tierOf({ score: 0.5, sameCountry: false }), 'другая страна');
});

test('однофамильцы не дотягивают до «надёжно»', () => {
  // «University of Auckland» → `auckland-institute-of-studies`: схожесть есть,
  // заведения разные. Разряд обязан оставить это на просмотр глазами.
  const s = similarity('University of Auckland', 'Auckland Institute Of Studies');
  assert.ok(s < 0.75, `схожесть ${s} не должна дотягивать до надёжной`);
  assert.equal(tierOf({ score: s, sameCountry: true }), 'нужен глаз');

  // «The American Business School of Paris» → «American University — Kogod School of Business».
  const k = similarity('The American Business School of Paris', 'American University — Kogod School of Business');
  assert.ok(k < 0.75, `схожесть ${k} не должна дотягивать до надёжной`);
});
