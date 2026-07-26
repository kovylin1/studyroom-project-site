// Тесты разборщиков сбора стипендий с офсайтов.
//
// Каждый случай ниже — реальная страница, на которой разбор ошибался. Ошибка здесь
// не падает, а тихо уезжает в карточку вуза как «проверенная офсайтом» сумма, поэтому
// проверяем именно те правила, которые эти ошибки закрыли.
//
// Запуск: node --test lib/kompas-scholarships-parse.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  amountFrom, acceptName, parseScholarships, parseDetail, detailUrls, sameSite,
} from './kompas-scholarships-parse.mjs';

// ------------------------------------------------------------------ сумма --

test('порог дохода семьи не берётся за размер стипендии (Bangor Bursaries)', () => {
  // Страница «Bangor Bursaries» начинается таблицей «Taxable Household Income | Award».
  // Правило «первая сумма на странице» записывало £25,000 порога как размер выплаты.
  assert.equal(amountFrom('Taxable household income of £25,000 or less.'), null);
  assert.equal(amountFrom('Students with a household income below £25,000 may apply.'), null);
  // Изолирующий случай: здесь от порога спасает ТОЛЬКО «household income». Первые две
  // строки страховались ещё и «or less»/«income below», то есть молча прошли бы и без
  // главного правила — проверено мутацией.
  assert.equal(amountFrom('Bursaries are awarded on household income. Households under £25,000 receive support.'), null);
});

test('£25,000 порога отброшен, а £1,000 выплаты — взят', () => {
  const text = 'Taxable household income of £25,000 or less qualifies you to apply. '
    + 'Eligibility is assessed by the funding body for every academic year of your course. '
    + 'The award is worth £1,000 per year.';
  const got = amountFrom(text);
  assert.notEqual(got, 'GBP 25,000', 'порог дохода не должен попасть в сумму');
  assert.equal(got, 'GBP 1,000/год');
});

test('«up to» переносится в «до», иначе сумма за четыре года читается как годовая', () => {
  // Abertay IB30+: на странице и «up to £28,000» (за четыре года), и «£7,000 per year».
  assert.equal(amountFrom('The scholarship is worth up to £28,000 over four years.'), 'до GBP 28,000');
});

test('«per year» переносится в «/год»', () => {
  assert.equal(amountFrom('An award of £7,000 per year for the duration of your course.'), 'GBP 7,000/год');
  assert.equal(amountFrom('You will receive £3,000 per annum.'), 'GBP 3,000/год');
});

test('сумма без подписи не берётся: «нет подписи — нет цены»', () => {
  // «5,000» рядом может быть числом студентов, а не выплатой.
  assert.equal(amountFrom('Our campus is home to £12,000 of new lab equipment.'), null);
  assert.equal(amountFrom('Tuition fees are £15,000 for international students.'), null);
});

test('полное покрытие берём словами, когда числа нет', () => {
  assert.equal(amountFrom('This scholarship covers full tuition for the first year.'), 'full tuition');
  assert.equal(amountFrom('No numbers here at all.'), null);
});

test('валюта распознаётся и кодом, и знаком', () => {
  assert.equal(amountFrom('Award of €2,500 per year.'), 'EUR 2,500/год');
  assert.equal(amountFrom('Scholarship of CAD 5,000 towards tuition.'), 'CAD 5,000');
});

// ---------------------------------------------------------------- названия --

test('заголовок раздела — не стипендия', () => {
  // «Scholarships and Bursaries» — название страницы Abertay, под которым лежат 39
  // настоящих стипендий. Записать его самой стипендией значит завести пустышку.
  assert.equal(acceptName('Scholarships and Bursaries'), null);
  assert.equal(acceptName('Scholarships'), null);
  assert.equal(acceptName('International Scholarships for postgraduate students'), null);
});

test('подпись поля — не стипендия (Aalto, Adelphi)', () => {
  assert.equal(acceptName('Scope of scholarship'), null);
  assert.equal(acceptName('Duration of scholarship'), null);
  assert.equal(acceptName('Scholarship decisions'), null);
  assert.equal(acceptName('Value of scholarships'), null);
});

test('заголовок-инструкция — не стипендия (Bangor)', () => {
  assert.equal(acceptName('How do I apply?'), null);
  assert.equal(acceptName('How to apply for a scholarship'), null);
  assert.equal(acceptName('Advice on Applying for Scholarships'), null);
  assert.equal(acceptName('This scholarship is not available for 2026/27'), null);
});

test('заголовок новости — не стипендия', () => {
  const headline = 'University researchers win a £10 million Leverhulme grant to study climate '
    + 'migration across the Pacific region over the next decade';
  assert.equal(acceptName(headline), null, 'длинный заголовок новости отсекается по длине');
});

test('настоящее название проходит и чистится от хвостового двоеточия', () => {
  assert.equal(acceptName('Abertay International Scholarship'), 'Abertay International Scholarship');
  assert.equal(acceptName('Vice-Chancellor’s Scholarship:  '), 'Vice-Chancellor’s Scholarship');
  assert.equal(acceptName('Bangor Bursary for Care Leavers'), 'Bangor Bursary for Care Leavers');
});

// ------------------------------------------------------------ страницы --

test('разбор раздела: заголовок берётся, сумма — из текста до следующего заголовка', () => {
  const html = `
    <h2>Vice-Chancellor's Excellence Scholarship</h2>
    <p>An award of £4,000 per year for high-achieving applicants.</p>
    <h2>Sports Scholarship</h2>
    <p>Worth £1,500 towards training costs.</p>`;
  const out = parseScholarships(html, 'https://uni.ac.uk/funding');
  assert.equal(out.length, 2);
  assert.equal(out[0].name, "Vice-Chancellor's Excellence Scholarship");
  assert.equal(out[0].amount, 'GBP 4,000/год', 'сумма соседней стипендии не должна приклеиться');
  assert.equal(out[1].amount, 'GBP 1,500');
  assert.equal(out[0].source, 'official-site');
  assert.equal(out[0].url, 'https://uni.ac.uk/funding');
});

test('разбор отдельной страницы: имя из h1', () => {
  const html = '<h1>Abertay International Scholarship</h1><p>The award is worth £3,000 per year.</p>';
  const got = parseDetail(html, 'https://abertay.ac.uk/x/scholarship');
  assert.equal(got.name, 'Abertay International Scholarship');
  assert.equal(got.amount, 'GBP 3,000/год');
  assert.equal(got.verifiedBySite, true);
});

test('страница без стипендии в h1 не даёт записи', () => {
  assert.equal(parseDetail('<h1>Contact us</h1><p>Call the office.</p>', 'https://uni.ac.uk/x'), null);
  assert.equal(parseDetail('<p>нет заголовка вовсе</p>', 'https://uni.ac.uk/x'), null);
});

test('отдельные страницы: редирект с url= разворачивается, чужой домен отсекается', () => {
  const html = `
    <a href="https://search.abertay.ac.uk/s/redirect?url=https%3A%2F%2Fwww.abertay.ac.uk%2Ffunding%2Fib30-scholarship%2F">IB30+</a>
    <a href="https://www.chevening.org/scholarship/">Chevening</a>
    <a href="/funding/">раздел целиком</a>`;
  const got = detailUrls(html, 'https://www.abertay.ac.uk', 'https://www.abertay.ac.uk/funding/');
  assert.deepEqual(got, ['https://www.abertay.ac.uk/funding/ib30-scholarship/']);
});

test('свой домен узнаётся с www и без, чужой — нет', () => {
  assert.ok(sameSite('https://abertay.ac.uk/x', 'https://www.abertay.ac.uk'));
  assert.ok(sameSite('https://search.abertay.ac.uk/x', 'https://www.abertay.ac.uk'));
  assert.ok(!sameSite('https://www.chevening.org/x', 'https://www.abertay.ac.uk'));
});
