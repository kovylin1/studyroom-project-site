import test from 'node:test';
import assert from 'node:assert/strict';
import { qualificationFamilies, inferLevel } from './program-level.mjs';

const fams = (t) => qualificationFamilies(t).sort();

test('MBA не распадается на BA — из-за этого 99 программ стояли бакалавриатом', () => {
  assert.deepEqual(fams('M.B.A.Big Data'), ['master']);
  assert.deepEqual(fams('M.B.A.Business Administration - Aviation Management'), ['master']);
  assert.deepEqual(fams('MBA Finance'), ['master']);
  assert.deepEqual(fams('Executive MBA'), ['master']);
});

test('название с двумя квалификациями — модуль молчит, а не выбирает первую по списку', () => {
  assert.deepEqual(fams('PhD/MA by ResearchAfrican Studies'), ['master', 'phd']);
  assert.deepEqual(fams('MA PhD Journalism'), ['master', 'phd']);
  assert.deepEqual(fams('Education Masters by History PhD'), ['master', 'phd']);
  assert.deepEqual(fams('BEng (Hons) Medical Engineering Technologies MEng Medical Engineering Technologies'), []);
  assert.equal(inferLevel('PhD/MA by ResearchGerman Studies'), null);
});

test('однозначные названия читаются', () => {
  assert.equal(inferLevel('BEng (Hons) Robotics Engineering (with Foundation year)'), 'bachelor');
  assert.equal(inferLevel('BA (Hons) International Relations and Global Security top-up'), 'bachelor');
  assert.equal(inferLevel('MA Anthropology & Museum Practice'), 'master');
  assert.equal(inferLevel('M.A.Creative Writing'), 'master');
  assert.equal(inferLevel('MSc Digital Cybercrime'), 'master');
  assert.equal(inferLevel('LLM International Law'), 'master');
  assert.equal(inferLevel('LLB Law'), 'bachelor');
  assert.equal(inferLevel('Doctorate in Education'), 'phd');
  assert.equal(inferLevel('DBA Doctorate in Business Administration'), 'phd');
  assert.equal(inferLevel('Professional Doctorate in Elite Performance (Sport)'), 'phd');
  assert.equal(inferLevel('BConst (Hons) Bachelor of Construction (Honours)'), 'bachelor');
});

test('квалификация, которой в схеме каталога нет, приравнена к ближайшей', () => {
  // JD — профессиональная докторская степень по названию; из восьми уровней схемы
  // ближе всего phd. Решение спорное, поэтому вынесено в отчёт применятеля.
  assert.equal(inferLevel('Law (JD) Juris Doctorate'), 'phd');
});

test('интегрированные степени не переводятся в магистратуру', () => {
  // MSci и MEng — первое высшее с бакалаврским входом. Источник зовёт их
  // undergraduate, и уровень bachelor в каталоге верен: спорить не с чем.
  assert.deepEqual(fams('MSciBiochemistry with Industrial Placement'), []);
  assert.deepEqual(fams('MSci Physics and Philosophy'), []);
  assert.deepEqual(fams('MEngPetroleum Engineering'), []);
  assert.deepEqual(fams('MEng Civil Engineering'), []);
  // а слитная запись настоящей магистратуры читается по-прежнему
  assert.deepEqual(fams('M.Sc.Applied Neuropsychology'), ['master']);
  assert.deepEqual(fams('MSc Astrophysics'), ['master']);
});

test('обычные слова не принимаются за аббревиатуры', () => {
  assert.deepEqual(fams('Marketing Management'), []);
  assert.deepEqual(fams('Data Science and Analytics'), []);
  assert.deepEqual(fams('Business Administration'), []);
  assert.deepEqual(fams('Mathematics'), []);
  assert.deepEqual(fams('Bed Management in Hospitals'), []);
  assert.deepEqual(fams('Bachelor of Arts in History'), ['bachelor']);
});

test('пустое и мусорное на вход не роняет', () => {
  assert.deepEqual(fams(undefined), []);
  assert.deepEqual(fams(null), []);
  assert.deepEqual(fams(''), []);
  assert.equal(inferLevel(''), null);
});
