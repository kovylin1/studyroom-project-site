// Тесты сведения QS с офсайтом. Каждый случай взят из реальной выгрузки:
// это те самые расхождения, на которых прогон сначала терял пары.
//
// Запуск: node --test scraper/kompas-merge-offsite.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readTitle, stripVariants, within1, scorePair, matchFuzzy, levelsFit, pickDuration, urlSlugText,
} from './kompas-merge-offsite.mjs';

const course = (title, url, extra = {}) => ({ title, url, level: null, durationYears: null, durationRaw: null, ...extra });

test('вариант курса снимается с названия QS и запоминается', () => {
  const r = readTitle('Animation BA (Hons) with Integrated Foundation');
  assert.equal(r.core, 'animation ba hons');
  assert.deepEqual([...r.variants], ['foundation']);

  const p = readTitle('Business Management BSc (Hons) with professional placement');
  assert.deepEqual([...p.variants], ['placement']);

  const t = readTitle('BA BUSINESS MANAGEMENT (HONS) TOP-UP');
  assert.deepEqual([...t.variants], ['top-up']);
});

test('срок из названия строки QS вынимается и из основы убирается', () => {
  assert.equal(readTitle('1 year A Level').statedYears, 1);
  assert.equal(readTitle('2 year A Level').statedYears, 2);
  assert.equal(readTitle('Animation BA (Hons) three year degree').statedYears, 3);
  assert.equal(readTitle('Animation BA (Hons) three year degree').core, 'animation ba hons');
  assert.equal(readTitle('GCSE Subjects').statedYears, null);
});

test('маркер не снимается, если от названия ничего не остаётся', () => {
  // Falmouth: /study/undergraduate/integrated-foundation-year — это самостоятельная
  // программа, а не «вариант с нулевым годом» чужого курса.
  const r = stripVariants('integrated foundation year');
  assert.equal(r.base, 'integrated foundation year');
  assert.equal(r.variants.size, 0);
});

test('из адреса берётся только последний сегмент', () => {
  assert.equal(urlSlugText('https://www.worc.ac.uk/courses/business-management-ba-hons'), 'business management ba hons');
  assert.equal(urlSlugText('https://www.falmouth.ac.uk/study/undergraduate/animation'), 'animation');
  assert.equal(urlSlugText('http://www.pku.org.uk/Study/Cross_Border_Master_s_i_Finance.htm'), 'Cross Border Master s i Finance');
});

test('одна правка Дамерау: вставка, замена и перестановка соседей', () => {
  assert.ok(within1('arts', 'art'));
  assert.ok(within1('flim', 'film'));   // опечатка QS в «Television & Flim Production»
  assert.ok(within1('games', 'game'));
  assert.ok(!within1('computer', 'computing'));
  assert.ok(!within1('finance', 'marketing'));
  assert.ok(!within1('art', 'part'));   // разные первые буквы не сближаем
});

test('название QS с кодом степени сходится с адресом страницы офсайта', () => {
  const read = readTitle('BA BUSINESS MANAGEMENT (HONS)');
  const base = scorePair(read, course('Business Management', 'https://www.worc.ac.uk/courses/business-management-ba-hons'));
  assert.equal(base.score, 1);

  // Та же строка не должна сесть на страницу top-up: это другая программа.
  const topup = scorePair(read, course('Business Management', 'https://www.worc.ac.uk/courses/business-management-ba-hons-top-up'));
  assert.ok(topup.score < 0.8, `top-up получил ${topup.score}`);
});

test('строка top-up садится на страницу top-up, а не на базовую', () => {
  const read = readTitle('BA BUSINESS MANAGEMENT (HONS) TOP-UP');
  const courses = [
    course('Business Management', 'https://www.worc.ac.uk/courses/business-management-ba-hons'),
    course('Business Management', 'https://www.worc.ac.uk/courses/business-management-ba-hons-top-up', { durationYears: 1 }),
  ];
  const m = matchFuzzy({ title: 'BA BUSINESS MANAGEMENT (HONS) TOP-UP', level: 'bachelor' }, courses);
  assert.ok(m.hit, 'пара не найдена');
  assert.match(m.hit.course.url, /top-up$/);
  assert.equal(m.hit.variantExact, true);
  assert.deepEqual([...read.variants], ['top-up']);
});

test('опечатка QS не рвёт пару', () => {
  const m = matchFuzzy(
    { title: 'Television & Flim Production BA (Hons)', level: 'bachelor' },
    [course('Television & Film Production BA(Hons)', 'https://www.falmouth.ac.uk/study/undergraduate/television', { durationYears: 3, level: 'bachelor' })],
  );
  assert.ok(m.hit, 'пара не найдена');
  assert.equal(m.hit.score, 1);
});

test('вариант без своей страницы садится на базовую, но срок помечается спорным', () => {
  const base = course('Animation BA(Hons)', 'https://www.falmouth.ac.uk/study/undergraduate/animation', {
    durationYears: 3, durationRaw: '3 years / 4 years', level: 'bachelor',
  });
  const m = matchFuzzy({ title: 'Animation BA (Hons) with Integrated Foundation', level: 'foundation' }, [base]);
  assert.ok(m.hit);
  assert.equal(m.hit.variantPageMissing, true);

  const d = pickDuration(m.read, m.hit);
  assert.equal(d.years, 3);
  assert.equal(d.basis, 'offsite-page');
  assert.equal(d.needsCheck, true, 'срок варианта не равен сроку базовой страницы');
  assert.match(d.evidence, /4 years/);
});

test('срок из названия QS сильнее страницы с двумя сроками сразу', () => {
  // MPW: на странице колледжа написано «one year courses and two year courses»,
  // одного значения там нет — берём то, что стоит в самой строке QS.
  const read = readTitle('2 year A Level');
  const d = pickDuration(read, { course: course('A Level — MPW London', 'https://www.mpw.ac.uk/locations/london/courses/a-level/') });
  assert.equal(d.years, 2);
  assert.equal(d.basis, 'qs-title');
  assert.equal(d.needsCheck, false);
});

test('нет срока ни там, ни там — кейс, а не выдуманное значение', () => {
  const read = readTitle('University Pathway Program');
  const d = pickDuration(read, { course: course('University Pathway Program', 'https://ilac.com/university-pathway/x', { durationEvidence: '8-56 weeks' }) });
  assert.equal(d.years, null);
  assert.equal(d.needsCheck, true);
  assert.equal(d.evidence, '8-56 weeks');
});

test('уровни сверяются только когда известны с обеих сторон', () => {
  assert.equal(levelsFit('bachelor', null, false), true);   // офсайт Worcester уровень почти не отдаёт
  assert.equal(levelsFit(null, 'master', false), true);
  assert.equal(levelsFit('bachelor', 'master', false), false);
  assert.equal(levelsFit('foundation', 'bachelor', true), true);  // вариант с нулевым годом
  assert.equal(levelsFit('foundation', 'bachelor', false), false);
  assert.equal(levelsFit('language', 'english-language', false), true);
  assert.equal(levelsFit('master', 'certificate', false), false);
});

test('совместные программы не садятся на одиночные', () => {
  // «BA ANIMATION and GAME ART» — не «Game Art»: страницы совместной программы
  // в выгрузке офсайта нет, и пары быть не должно.
  const m = matchFuzzy(
    { title: 'BA ANIMATION and GAME ART (HONS)', level: 'bachelor' },
    [course('Game Art', 'https://www.worc.ac.uk/courses/game-art-ba-hons', { durationYears: 3 })],
  );
  assert.equal(m.hit, null);
});
