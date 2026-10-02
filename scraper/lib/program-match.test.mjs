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

// --- четвёртая ступень: канонический ключ (прямые партнёры, 30.09.2026) ---
import { canonTitle } from './program-match.mjs';

const DIRECT = buildIndex([
  { title: 'BA Media Design', level: 'bachelor' },
  { title: 'MA Media Design', level: 'master' },
  { title: 'BS Finance', level: 'bachelor' },
  { title: 'Bachelor of Computer Science and Technology', level: 'bachelor' },
  { title: 'Civil Engineering MSc', level: 'master' },
  { title: 'Bachelor of Engineering (Hons) - Mechatronic Engineering', level: 'bachelor' },
  { title: 'Master of HR Management', level: 'master' },
  { title: 'MEng Engineering and Sustainable Technology Management - Mobility and Automotive Industry', level: 'master' },
  { title: 'BA Advertising and Brand Design', level: 'bachelor' },
  { title: 'Bachelor of Commerce (BCom) - Accounting', level: 'bachelor' },
  { title: 'MS Cybersecurity Operations (STEM)', level: 'master' },
  { title: 'Global Master of Luxury Management', level: 'master' },
]);
const hit = (title, level) => matchProgram(DIRECT, { title, level }, { canon: true });

test('канон: степень в конце и в начале — одна программа', () => {
  assert.equal(hit('Media Design BA', 'bachelor').program.title, 'BA Media Design');
  assert.equal(hit('Media Design MA', 'master').program.title, 'MA Media Design');
  assert.equal(hit('Finance BS', 'bachelor').how, 'canon');
  assert.equal(hit('Computer Science and Technology BEng (Hons)', 'bachelor').program.title,
    'Bachelor of Computer Science and Technology');
});

test('канон: Honours/Hons, HR, точки в степени, &, «Focus on», школа через «|»', () => {
  assert.ok(hit('Bachelor of Engineering (Honours) - Mechatronic Engineering', 'bachelor').program);
  assert.ok(hit('Master of Human Resource Management', 'master').program);
  assert.ok(hit('M.Eng. Engineering and Sustainable Technology Management - Focus on Mobility & Automotive Industry', 'master').program);
  assert.ok(hit('Berlin School of Design and Communication | B.A. Advertising & Brand Design', 'bachelor').program);
  assert.ok(hit('Bachelor of Commerce (Accounting)', 'bachelor').program);
  assert.ok(hit('Cybersecurity Operations (MS)', 'master').program);
  assert.ok(hit('Global Master Luxury Management', 'master').program);
});

test('канон: чужой уровень не привязывается', () => {
  assert.equal(hit('Civil Engineering PhD', 'phd').program, null);
  assert.equal(hit('Civil Engineering BEng (Hons)', 'bachelor').program, null);
  assert.equal(hit('Finance MS', 'master').program, null);
});

test('канон: без уровня с обеих сторон не привязывает', () => {
  assert.equal(hit('Media Design', null).program, null);
});

test('канон выключен по умолчанию — агрегаторы считают как раньше', () => {
  assert.equal(matchProgram(DIRECT, { title: 'Finance BS', level: 'bachelor' }).how, 'none');
});

test('canonTitle снимает степень и отдаёт её уровень', () => {
  assert.deepEqual(canonTitle('Actuarial Science BSc (Hons)'), { key: 'actuarial science', level: 'bachelor' });
  assert.deepEqual(canonTitle('MBA with a specialism in AI (ODL)'), { key: 'ai', level: 'master' });
});

test('канон: BFA полностью, Degree/Major, хвост XJTLU', () => {
  const i = buildIndex([
    { title: 'BFA Acting', level: 'bachelor' },
    { title: 'BA Biology (STEM)', level: 'bachelor' },
    { title: 'Bachelor of Intelligent Robotics Engineering', level: 'bachelor' },
  ]);
  const m = (title) => matchProgram(i, { title, level: 'bachelor' }, { canon: true }).program;
  assert.ok(m('Bachelor of Fine Arts in Acting'));
  assert.ok(m('Biology Major (BA)'));
  assert.ok(m('Intelligent Robotics Engineering with Contemporary Entrepreneurialism BEng (Hons)'));
});

test('канон: Webster «with an Emphasis in», AI, Communications, GCRT', () => {
  const i = buildIndex([
    { title: 'BS Computer Science - Cybersecurity (STEM)', level: 'bachelor' },
    { title: 'MS Cybersecurity - Artificial Intelligence (STEM)', level: 'master' },
    { title: 'BA Sports Communication', level: 'bachelor' },
    { title: 'Graduate Certificate in Project Management', level: 'short-course' },
  ]);
  const m = (title, level) => matchProgram(i, { title, level }, { canon: true }).program;
  assert.ok(m('Computer Science with an Emphasis in Cybersecurity (BS)', 'bachelor'));
  assert.ok(m('Cybersecurity with an Emphasis in AI (MS)', 'master'));
  assert.ok(m('Bachelor of Arts in Sports Communications', 'bachelor'));
  assert.ok(m('Project Management (GCRT)', 'short-course'));
  assert.ok(!m('Computer Science with an Emphasis in Cybersecurity (BS)', 'master'));
});
