// node --test scraper/lib/navitas-seeder.test.mjs
//
// Сидер Navitas — два свойства, из-за отсутствия которых он раздал живому каталогу
// фабрикованные цены и был способен стереть 3208 программ выгрузок при повторном прогоне:
//   1) цены из литеральной таблицы feeBand в каталог не попадают;
//   2) карточка богаче сида не перезаписывается без --force, настоящие цены переносятся.

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUniversity, planWrite } from './navitas-seeder.mjs';

const UNI = {
  slug: 'test-uni',
  name: 'Test University',
  city: 'Testville',
  navitasUrl: 'https://example.com/',
  officialUrl: 'https://example.ac.uk/',
  coursesUrl: 'https://example.com/courses/',
  ielts: 5.5,
  feeBand: { foundation: 14500, 'bachelor-business': 15800 },
  pathwayPrograms: { 'Foundation Studies': [['International Foundation Year — Business', 'foundation', 1, 'foundation']] },
  bachelorPrograms: { 'Business': [['BA (Hons) Business Management', 'bachelor', 3, 'bachelor-business']] },
};

const OPTS = {
  country: 'United Kingdom',
  currency: 'GBP',
  primaryIntake: '2027-09-15T00:00:00.000Z',
  secondaryIntake: '2027-01-20T00:00:00.000Z',
  defaultIntakes: ['September'],
  scholarship: { name: 'Bursary' },
};

test('по умолчанию цен из литеральной таблицы в карточке нет', () => {
  const u = buildUniversity(UNI, OPTS);
  assert.deepEqual(u.tuition.byProgram, {});
  assert.equal(u.programs.length, 2, 'программы при этом остаются');
  assert.equal(Object.keys(u.deadlines).length, 2, 'дедлайны тоже: их сид знает');
});

test('feeProvenance=source-confirmed раздаёт цены — но только по явному объявлению', () => {
  const u = buildUniversity(UNI, { ...OPTS, feeProvenance: 'source-confirmed' });
  assert.equal(u.tuition.byProgram['test-uni-international-foundation-year-business'], 14500);
  assert.equal(u.tuition.byProgram['test-uni-ba-hons-business-management'], 15800);
});

test('незнакомый feeProvenance — падение, а не тихая раздача цен', () => {
  assert.throws(() => buildUniversity(UNI, { ...OPTS, feeProvenance: 'whatever' }), /feeProvenance/);
});

test('новая карточка пишется как есть', () => {
  const built = buildUniversity(UNI, OPTS);
  const plan = planWrite(built, null);
  assert.equal(plan.action, 'write');
});

test('карточка богаче сида не перезаписывается', () => {
  const built = buildUniversity(UNI, OPTS);
  const existing = {
    programs: Array.from({ length: 300 }, (_, i) => ({ slug: `p${i}`, title: `P${i}` })),
    tuition: { currency: 'GBP', byProgram: { p0: 18570 } },
  };
  const plan = planWrite(built, existing);
  assert.equal(plan.action, 'skip');
  assert.match(plan.reason, /300/);
});

test('--force перезаписывает, но настоящие цены уцелевших программ переносит', () => {
  const built = buildUniversity(UNI, OPTS);
  const keep = built.programs[0].slug;
  const existing = {
    programs: [...built.programs, { slug: 'gone', title: 'Gone' }, { slug: 'gone2', title: 'Gone 2' }],
    tuition: { currency: 'GBP', byProgram: { [keep]: 18570, gone: 19000 } },
    photoSets: { general: [{ img: 'a.jpg' }] },
  };
  const plan = planWrite(built, existing, { force: true });
  assert.equal(plan.action, 'write');
  assert.equal(plan.university.tuition.byProgram[keep], 18570, 'цена уцелевшей программы перенесена');
  assert.equal(plan.university.tuition.byProgram.gone, undefined, 'цена исчезнувшей программы не тащится');
  assert.deepEqual(plan.university.photoSets, existing.photoSets, 'фотонаборы сохранены');
});

test('перенос цен работает и без force, когда сид не беднее каталога', () => {
  const built = buildUniversity(UNI, OPTS);
  const keep = built.programs[1].slug;
  const existing = { programs: [built.programs[0]], tuition: { currency: 'GBP', byProgram: { [keep]: 21450 } } };
  const plan = planWrite(built, existing);
  assert.equal(plan.action, 'write');
  assert.equal(plan.university.tuition.byProgram[keep], 21450);
});

test('нулевые и отрицательные цены из каталога не переносятся', () => {
  const built = buildUniversity(UNI, OPTS);
  const existing = {
    programs: built.programs,
    tuition: { currency: 'GBP', byProgram: { [built.programs[0].slug]: 0, [built.programs[1].slug]: -5 } },
  };
  const plan = planWrite(built, existing);
  assert.deepEqual(plan.university.tuition.byProgram, {});
});
