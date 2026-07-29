import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  wikiFetchJson, ThrottledError, chunkTitles, parseImageInfo, wikiStats,
} from './wikimedia.mjs';

/** Поддельный ответ fetch: только то, что читает модуль. */
const reply = (status, body, headers = {}) => ({
  status, ok: status >= 200 && status < 300,
  headers: { get: (k) => headers[k.toLowerCase()] ?? null },
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
});

test('429 не выдаётся за пустой ответ — повторяем и добиваемся данных', async () => {
  const seen = [];
  let n = 0;
  const fetchImpl = async (url) => {
    seen.push(url);
    return ++n === 1 ? reply(429, 'You are making too many requests', { 'retry-after': '0' })
      : reply(200, { ok: true });
  };
  const j = await wikiFetchJson('https://commons.wikimedia.org/x', { fetchImpl });
  assert.deepEqual(j, { ok: true });
  assert.equal(seen.length, 2, 'после 429 запрос должен повториться');
});

test('когда лимит не отпускает, бросается ThrottledError, а не null', async () => {
  const fetchImpl = async () => reply(429, 'too many', { 'retry-after': '0' });
  await assert.rejects(
    () => wikiFetchJson('https://commons.wikimedia.org/y', { fetchImpl, retries: 2 }),
    (e) => e instanceof ThrottledError && e.retryAfter === 0,
  );
});

test('текст вместо JSON не роняет разбор и не притворяется данными', async () => {
  const fetchImpl = async () => reply(200, 'You are making too many requests to the API.');
  assert.equal(await wikiFetchJson('https://commons.wikimedia.org/z', { fetchImpl }), null);
});

test('счётчик отмечает факт торможения — прогон не отчитается «всё чисто»', async () => {
  const before = wikiStats.throttled;
  let n = 0;
  const fetchImpl = async () => (++n === 1 ? reply(429, 'x', { 'retry-after': '0' }) : reply(200, {}));
  await wikiFetchJson('https://commons.wikimedia.org/w', { fetchImpl });
  assert.equal(wikiStats.throttled, before + 1);
});

test('титулы бьются пачками по 50 и дедуплицируются', () => {
  const titles = Array.from({ length: 120 }, (_, i) => `File:${i}.jpg`);
  const chunks = chunkTitles(titles);
  assert.deepEqual(chunks.map(c => c.length), [50, 50, 20]);
  assert.deepEqual(chunkTitles(['File:A.jpg', 'File:A.jpg', null]), [['File:A.jpg']]);
});

test('файл без лицензии отбрасывается — атрибуцию выдумывать нельзя', () => {
  const parsed = parseImageInfo({
    query: { pages: [
      { title: 'File:Good.jpg', imageinfo: [{ thumburl: 'https://u/good.jpg', descriptionurl: 'https://d/good',
        extmetadata: { LicenseShortName: { value: 'CC BY-SA 3.0' }, Artist: { value: '<a href="#">Ivan</a>' } } }] },
      { title: 'File:NoLicense.jpg', imageinfo: [{ url: 'https://u/bad.jpg', extmetadata: {} }] },
      { title: 'File:Missing.jpg' },
    ] },
  });
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].title, 'File:Good.jpg');
  assert.equal(parsed[0].license, 'CC BY-SA 3.0');
  assert.equal(parsed[0].author, 'Ivan', 'разметка из Artist должна быть снята');
});

test('автор отсутствует — файл берём, но автора не подменяем', () => {
  const parsed = parseImageInfo({
    query: { pages: [{ title: 'File:X.jpg', imageinfo: [{ url: 'https://u/x.jpg',
      extmetadata: { LicenseShortName: { value: 'CC0' } } }] }] },
  });
  assert.equal(parsed[0].author, null);
});
