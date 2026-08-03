// Тесты id кейсов прямых партнёров.
//
// Все примеры — настоящие строки прайса из `sources/kompas/direct-review.json`,
// на которых старая схема id схлопывала разные кейсы в один.
//
// Запуск: node --test scraper/kompas-direct-cases.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { feeCaseId, legacyFeeCaseId } from './kompas-direct-cases.mjs';

// Три строки Amity: подпись длиннее 40 символов и обрезается в одно и то же место,
// сумма и валюта совпадают. Различает их только текст ячейки.
const amity = (rawCell) => ({
  amount: 3000, currency: 'AED',
  label: 'School of Humanities, Arts and Applied Sciences',
  rawCell, feeUrl: 'https://amityuniversity.ae/fees',
});

test('старая схема схлопывала разные строки в один id', () => {
  assert.equal(
    legacyFeeCaseId('amity-university-dubai', amity('BA Journalism — 3000 AED')),
    legacyFeeCaseId('amity-university-dubai', amity('BA Psychology — 3000 AED')),
  );
});

test('новая схема их различает', () => {
  assert.notEqual(
    feeCaseId('amity-university-dubai', amity('BA Journalism — 3000 AED')),
    feeCaseId('amity-university-dubai', amity('BA Psychology — 3000 AED')),
  );
});

test('одинаковая строка даёт одинаковый id — иначе дедуп не сработает', () => {
  const row = amity('BA Journalism — 3000 AED');
  assert.equal(feeCaseId('amity-university-dubai', row), feeCaseId('amity-university-dubai', { ...row }));
});

test('читаемая часть id сохранена — кейс должен узнаваться глазами', () => {
  const id = feeCaseId('sp-jain-school-of-global-management-dubai', {
    amount: 700, currency: 'AUD', label: 'Sydney', rawCell: 'Application fee AUD 700', feeUrl: 'https://spjain.org/fees',
  });
  assert.ok(id.startsWith('sp-jain-school-of-global-management-dubai||direct_fee_unlinked||700-AUD-Sydney||'));
});

test('валюта и сумма входят в отпечаток', () => {
  const base = { label: 'Dubai', rawCell: 'AED 700', feeUrl: 'https://spjain.org/fees' };
  assert.notEqual(
    feeCaseId('sp-jain', { ...base, amount: 700, currency: 'AED' }),
    feeCaseId('sp-jain', { ...base, amount: 600, currency: 'AED' }),
  );
  assert.notEqual(
    feeCaseId('sp-jain', { ...base, amount: 700, currency: 'AED' }),
    feeCaseId('sp-jain', { ...base, amount: 700, currency: 'AUD' }),
  );
});

test('legacy-id строится по старым правилам — на нём держится перенос решений', () => {
  assert.equal(
    legacyFeeCaseId('bsbi', { amount: 300, currency: 'EUR', label: '. A flexible payment plan allows tuition fees to be paid monthly' }),
    'bsbi||direct_fee_unlinked||300-EUR-. A flexible payment plan allows tuition',
  );
});
