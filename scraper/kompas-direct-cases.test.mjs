// Тесты id кейсов прямых партнёров.
//
// Все примеры — настоящие строки прайса из `sources/kompas/direct-review.json`,
// на которых старая схема id схлопывала разные кейсы в один.
//
// Запуск: node --test scraper/kompas-direct-cases.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { feeCaseId, legacyFeeCaseId, feeGroupId, foldFeeCases } from './kompas-direct-cases.mjs';

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

// ── свёртка строк одной суммы (урок 9: кейсы сводить, а не размножать) ──
// Настоящий случай galway: 2 500 EUR стоит против двух десятков бакалавриатов.

const row = (label, extra = {}) => ({
  id: feeCaseId('galway', { amount: 2500, currency: 'EUR', label, rawCell: label, feeUrl: 'https://galway.ie/fees' }),
  legacyId: legacyFeeCaseId('galway', { amount: 2500, currency: 'EUR', label }),
  groupId: feeGroupId('galway', { amount: 2500, currency: 'EUR' }),
  label,
  slug: 'galway', name: 'Galway', issue: 'direct_fee_unlinked', severity: 'info',
  official: 2500, currency: 'EUR', feeAudience: null,
  sourceUrl: 'https://galway.ie/fees', program: null, catalog: null,
  detail: 'построчный текст', decision: null, decidedAt: null, applied: false,
  ...extra,
});

test('одна сумма против разных подписей — один кейс, подписи внутри', () => {
  const folded = foldFeeCases([row('Bachelor of Science (Psychology)'), row('Bachelor of Arts (Music)')]);
  assert.equal(folded.length, 1);
  assert.equal(folded[0].rows, 2);
  assert.deepEqual(folded[0].labels, ['Bachelor of Science (Psychology)', 'Bachelor of Arts (Music)']);
  assert.match(folded[0].detail, /«Bachelor of Science \(Psychology\)»/);
  assert.match(folded[0].detail, /«Bachelor of Arts \(Music\)»/);
});

test('разные суммы и разные аудитории в один кейс не сливаются', () => {
  const other = { ...row('X'), groupId: feeGroupId('galway', { amount: 3181, currency: 'EUR' }), official: 3181 };
  const nonEu = { ...row('Y'), groupId: feeGroupId('galway', { amount: 2500, currency: 'EUR', feeAudience: 'non-EU' }), feeAudience: 'non-EU' };
  assert.equal(foldFeeCases([row('A'), other, nonEu]).length, 3);
});

test('длинный список подписей обрезается в тексте, но целиком лежит в labels', () => {
  const rows = Array.from({ length: 20 }, (_, i) => row(`Programme ${i}`));
  const [c] = foldFeeCases(rows, { labelsShown: 3 });
  assert.equal(c.labels.length, 20);
  assert.match(c.detail, /и ещё 17/);
});

test('кейсы других типов свёртка не трогает', () => {
  const zero = { id: 'x||direct_zero_programs||site', issue: 'direct_zero_programs' };
  const out = foldFeeCases([row('A'), zero, row('B')]);
  assert.equal(out.length, 2);
  assert.ok(out.includes(zero), 'чужой кейс проходит насквозь тем же объектом');
});

test('members сохраняют id и legacy-id каждой свёрнутой строки — по ним находится решение', () => {
  const a = row('Bachelor of Science (Psychology)');
  const b = row('Bachelor of Arts (Music)');
  const [c] = foldFeeCases([a, b]);
  assert.deepEqual(c.members.map((m) => m.id), [a.id, b.id]);
  assert.deepEqual(c.members.map((m) => m.legacyId), [a.legacyId, b.legacyId]);
});

test('id кейса после свёртки — это groupId, и он узнаётся глазами', () => {
  const [c] = foldFeeCases([row('A')]);
  assert.equal(c.id, 'galway||direct_fee_unlinked||2500-EUR-any');
  assert.equal(c.groupId, undefined, 'служебное поле в файл не уезжает');
});
