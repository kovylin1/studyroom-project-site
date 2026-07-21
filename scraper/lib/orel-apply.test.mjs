import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoEligible } from '../orel-apply.mjs';

const wikimedia = {
  img: '/photos/acadia/hunt-1.jpg',
  imgSource: 'https://commons.wikimedia.org/wiki/File:Acadia.jpg',
  imgLicense: 'CC BY 2.0',
  imgAuthor: 'Ivan Petrov',
};
const ctx = { onDisk: true, clashSlugs: [] };

test('кандидат с Wikimedia, лицензией и автором проходит автозамену', () => {
  assert.deepEqual(autoEligible(wikimedia, ctx), { ok: true });
});

test('офсайт не проходит автозамену — только через глаза оператора', () => {
  const r = autoEligible({ ...wikimedia, imgLicense: 'official-site' }, ctx);
  assert.equal(r.ok, false);
  assert.match(r.why, /офсайт/);
});

test('без автора не публикуем — CC BY-SA требует атрибуции', () => {
  const r = autoEligible({ ...wikimedia, imgAuthor: null }, ctx);
  assert.equal(r.ok, false);
  assert.match(r.why, /автор/);
});

test('без лицензии не публикуем', () => {
  assert.equal(autoEligible({ ...wikimedia, imgLicense: null }, ctx).ok, false);
});

test('фото, которое уже стоит у другого вуза, — это тот самый сток, не берём', () => {
  const r = autoEligible(wikimedia, { onDisk: true, clashSlugs: ['glasgow', 'bristol'] });
  assert.equal(r.ok, false);
  assert.match(r.why, /glasgow/);
});

test('файла нет на диске — замена невозможна, даже если провенанс полный', () => {
  const r = autoEligible(wikimedia, { onDisk: false, clashSlugs: [] });
  assert.equal(r.ok, false);
  assert.match(r.why, /диск/);
});
