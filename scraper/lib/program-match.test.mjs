import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex, matchProgram, rowLevel, stripAward, levelFromTitle, unsupportedAwardInTitle } from './program-match.mjs';

const CARD = [
  { slug: 'ba-history', title: 'BA History', level: 'bachelor' },
  { slug: 'ma-history', title: 'MA History', level: 'master' },
  { slug: 'ba-psychology', title: 'BA Psychology', level: 'bachelor' },
  { slug: 'ba-in-psychology', title: 'BA in Psychology', level: 'bachelor' },
  { slug: 'master-of-commerce', title: 'Master of Commerce', level: 'master' },
  { slug: 'gradcert-commerce', title: 'Graduate Certificate in Commerce', level: 'master' },
];
const idx = buildIndex(CARD);

test('уровень строки читается из sourceLevel, а не только из level', () => {
  assert.equal(rowLevel({ title: 'History', sourceLevel: 'Bachelors' }).level, 'bachelor');
  assert.equal(rowLevel({ title: 'History', sourceLevel: 'Bachelors' }).from, 'sourceLevel');
});

test('поле level источника важнее его собственной разметки', () => {
  assert.equal(rowLevel({ title: 'X', level: 'phd', sourceLevel: 'Masters' }).level, 'phd');
});

test('годная разметка важнее непринимаемого схемой level', () => {
  // строка с level: diploma и sourceLevel: Masters — это магистратура, а не кейс
  assert.deepEqual(rowLevel({ title: 'X', level: 'diploma', sourceLevel: 'Masters' }),
    { level: 'master', from: 'sourceLevel' });
});

test('уровень, которого нет в схеме каталога, помечается unsupported, а не выдумывается', () => {
  assert.equal(rowLevel({ title: 'X', level: 'certificate' }).from, 'unsupported');
  assert.equal(rowLevel({ title: 'X', sourceLevel: 'Graduate Diploma' }).from, 'unsupported');
  assert.equal(rowLevel({ title: 'X', level: 'certificate' }).level, null);
});

test('разметка edvoy и studygroup размечена: Doctorate, ALevel, Undergraduate Degree', () => {
  assert.equal(rowLevel({ title: 'EngD Formulation Engineering', sourceLevel: 'Doctorate' }).level, 'phd');
  assert.equal(rowLevel({ title: 'A-Level', sourceLevel: 'ALevel' }).level, 'sixth-form');
  assert.equal(rowLevel({ title: 'GCSE Grade 9', sourceLevel: 'GCSEgradesAC' }).level, 'high-school');
  assert.equal(rowLevel({ title: 'X', sourceLevel: 'Undergraduate Degree' }).level, 'bachelor');
});

test('уровня нет нигде — так и говорим, а не угадываем', () => {
  assert.deepEqual(rowLevel({ title: 'Archives and Museums' }), { level: null, from: null });
});

test('спорность разводится уровнем строки: History при BA History и MA History', () => {
  const r = matchProgram(idx, { title: 'History', sourceLevel: 'Bachelors' });
  assert.equal(r.how, 'award-stripped');
  assert.equal(r.program.slug, 'ba-history');
});

test('без уровня та же строка остаётся спорной', () => {
  assert.equal(matchProgram(idx, { title: 'History' }).how, 'ambiguous');
});

test('строка чужого уровня не садится на программу: Masters не привязывается к BA', () => {
  const r = matchProgram(idx, { title: 'Psychology', sourceLevel: 'Masters' });
  assert.equal(r.program, null);
  assert.equal(r.how, 'none');
});

test('двойники карточки одного уровня остаются спорными — уровень их не разводит', () => {
  assert.equal(matchProgram(idx, { title: 'Psychology', sourceLevel: 'Bachelors' }).how, 'ambiguous');
});

test('Graduate Certificate не привязывается к Master по названию без приставки', () => {
  const r = matchProgram(idx, { title: 'Graduate Certificate in Public Policy' });
  assert.equal(r.program, null);
  assert.equal(r.how, 'none');
});

test('точное название работает и для квалификации вне схемы', () => {
  const r = matchProgram(idx, { title: 'Graduate Certificate in Commerce' });
  assert.equal(r.program.slug, 'gradcert-commerce');
  assert.equal(r.how, 'title');
});

test('приставка вне схемы узнаётся в названии', () => {
  assert.equal(unsupportedAwardInTitle('Graduate Diploma in Law'), true);
  assert.equal(unsupportedAwardInTitle('Diploma in Business'), true);
  assert.equal(unsupportedAwardInTitle('BA History'), false);
  // не приставка, а часть названия — трогать нельзя
  assert.equal(unsupportedAwardInTitle('Advanced Materials Certificate Studies'), false);
});

test('снятие приставки степени осталось прежним', () => {
  assert.equal(stripAward('BSc Business and Management'), 'business and management');
  assert.equal(stripAward('Bachelor of Science in Nursing'), 'nursing');
  assert.equal(stripAward('MSc'), '');
});

test('уровень из названия — только по явной приставке', () => {
  assert.equal(levelFromTitle('MSc Data Science'), 'master');
  assert.equal(levelFromTitle('Doctor of Philosophy in Physics'), 'phd');
  assert.equal(levelFromTitle('Doctor of Medicine'), null);
});
