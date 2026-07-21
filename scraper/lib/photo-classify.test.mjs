import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyPhoto, STOCK_MIN_UNIS } from './photo-classify.mjs';

test('провенанс с офсайта делает фото verified', () => {
  assert.equal(classifyPhoto({
    path: '/photos/glasgow/hunt-1.jpg', slug: 'glasgow', unisUsing: 1,
    provenance: { source: 'https://gla.ac.uk/about', license: 'official-site' },
  }), 'verified');
});

test('провенанс Wikimedia тоже verified', () => {
  assert.equal(classifyPhoto({
    path: '/photos/glasgow/hunt-2.jpg', slug: 'glasgow', unisUsing: 1,
    provenance: { source: 'https://commons.wikimedia.org/wiki/File:X.jpg', license: 'CC BY-SA 4.0', author: 'Ivan' },
  }), 'verified');
});

test('неполный провенанс не даёт verified', () => {
  assert.equal(classifyPhoto({
    path: '/photos/glasgow/1.jpg', slug: 'glasgow', unisUsing: 1,
    provenance: { source: 'https://gla.ac.uk/about' },
  }), 'unknown');
});

test('файл из общей библиотеки — stock, даже если вуз один', () => {
  assert.equal(classifyPhoto({
    path: '/photos/_lib/room-11.jpg', slug: 'glasgow', unisUsing: 1, provenance: null,
  }), 'stock');
});

test('картинка у многих вузов — stock', () => {
  assert.equal(classifyPhoto({
    path: '/photos/ac-badem-university/bobr-4.jpg', slug: 'glasgow',
    unisUsing: STOCK_MIN_UNIS, provenance: null,
  }), 'stock');
});

test('картинка у нескольких вузов, но ниже порога — shared', () => {
  assert.equal(classifyPhoto({
    path: '/photos/glasgow/1.jpg', slug: 'glasgow',
    unisUsing: STOCK_MIN_UNIS - 1, provenance: null,
  }), 'shared');
});

test('своё фото без провенанса — unknown, а не verified', () => {
  assert.equal(classifyPhoto({
    path: '/photos/glasgow/1.jpg', slug: 'glasgow', unisUsing: 1, provenance: null,
  }), 'unknown');
});

test('провенанс перевешивает шаринг: подтверждённое фото остаётся verified', () => {
  assert.equal(classifyPhoto({
    path: '/photos/glasgow/1.jpg', slug: 'glasgow', unisUsing: 9,
    provenance: { source: 'https://gla.ac.uk/campus', license: 'official-site' },
  }), 'verified');
});

test('внешняя ссылка без провенанса — unknown', () => {
  assert.equal(classifyPhoto({
    path: 'https://upload.wikimedia.org/x.jpg', slug: 'glasgow', unisUsing: 1, provenance: null,
  }), 'unknown');
});
