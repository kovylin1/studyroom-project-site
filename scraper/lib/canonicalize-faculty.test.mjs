import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalizeFaculty, loadTaxonomy } from './canonicalize-faculty.mjs';

const tax = loadTaxonomy();
const cf = (f, t = '') => canonicalizeFaculty(f, t, tax);

test('крупнейшие бакеты сворачиваются в канон', () => {
  assert.equal(cf('Business & Management'), 'Бизнес');
  assert.equal(cf('Business'), 'Бизнес');
  assert.equal(cf('Arts & Design'), 'Искусство и дизайн');
  assert.equal(cf('Fine Arts'), 'Искусство и дизайн');
  assert.equal(cf('Engineering and Computer Science'), 'Инженерия и IT');
  assert.equal(cf('Computing & IT'), 'Инженерия и IT');
  assert.equal(cf('Science'), 'Наука');
  assert.equal(cf('Natural Sciences'), 'Наука');
  assert.equal(cf('Health & Medicine'), 'Здоровье и медицина');
  assert.equal(cf('Health Sciences'), 'Здоровье и медицина');
  assert.equal(cf('Humanities & Languages'), 'Гуманитарные и языки');
  assert.equal(cf('Social Sciences'), 'Социальные науки');
  assert.equal(cf('Law'), 'Право');
  assert.equal(cf('Education'), 'Образование');
  assert.equal(cf('Pathway Programmes'), 'Подготовка (Foundation)');
});

test('реальные названия школ/колледжей', () => {
  assert.equal(cf('W. P. Carey School of Business'), 'Бизнес');
  assert.equal(cf('Ira A. Fulton Schools of Engineering'), 'Инженерия и IT');
  assert.equal(cf('School of Nursing'), 'Здоровье и медицина');
  assert.equal(cf('School of Law'), 'Право');
  assert.equal(cf('School of Histories, Languages and Cultures'), 'Гуманитарные и языки');
  assert.equal(cf('Department of Economics'), 'Социальные науки');
});

test('Short Courses сохраняется', () => {
  assert.equal(cf('Short Courses'), 'Short Courses');
});

test('канон идемпотентен', () => {
  assert.equal(cf('Бизнес'), 'Бизнес');
  assert.equal(cf('Наука'), 'Наука');
  assert.equal(cf('Short Courses'), 'Short Courses');
});

test('пусто/мусор → инференс по названию программы', () => {
  assert.equal(cf('Прочее', 'Master of Nursing'), 'Здоровье и медицина');
  assert.equal(cf(null, 'BSc Computer Science'), 'Инженерия и IT');
  assert.equal(cf('', 'Bachelor of Laws'), 'Право');
});

test('широкий колледж → инференс по названию', () => {
  assert.equal(cf('College of Liberal Arts and Sciences', 'BSc Physics'), 'Наука');
});

test('неопределимое → null (не выдумываем)', () => {
  assert.equal(cf('Прочее', 'Something Unrelated Xyz'), null);
  assert.equal(cf(null, ''), null);
});
