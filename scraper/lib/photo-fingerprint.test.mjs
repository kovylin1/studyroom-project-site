import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { fingerprint, hamming } from './photo-fingerprint.mjs';

// Детерминированные картинки в памяти — тест не зависит от файлов проекта.
const solid = (r, g, b, w = 400, h = 300) =>
  sharp({ create: { width: w, height: h, channels: 3, background: { r, g, b } } }).jpeg().toBuffer();

// Монотонный градиент для этих тестов не годится: у него, как и у однотонной
// заливки, каждый пиксель темнее соседа справа — dHash обоих состоит из одних
// нулей. Берём «галочку»: яркость падает к центру и снова растёт. Такая форма
// даёт половину единиц и половину нулей, переживает уменьшение и имеет
// осмысленную противоположность (перевёрнутую галочку).
const vshape = async (invert = false, w = 400, h = 300) => {
  const px = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 3;
    let v = (Math.abs(x - w / 2) * 2 * 255 / w) | 0;
    if (invert) v = 255 - v;
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  return sharp(px, { raw: { width: w, height: h, channels: 3 } }).jpeg().toBuffer();
};

test('одинаковые байты дают одинаковый sha1', async () => {
  const buf = await solid(10, 20, 30);
  const a = await fingerprint(buf);
  const b = await fingerprint(buf);
  assert.equal(a.sha1, b.sha1);
  assert.equal(a.width, 400);
  assert.equal(a.height, 300);
});

test('ресайз меняет sha1, но dhash остаётся близким', async () => {
  const big = await vshape(false, 400, 300);
  const small = await sharp(big).resize(200, 150).jpeg().toBuffer();
  const a = await fingerprint(big);
  const b = await fingerprint(small);
  assert.notEqual(a.sha1, b.sha1, 'ресайз обязан менять побайтовый хэш');
  assert.ok(hamming(a.dhash, b.dhash) <= 6, `ожидалось близкое dhash, получено ${hamming(a.dhash, b.dhash)}`);
});

test('dhash непустой — иначе предыдущий тест проходил бы вхолостую', async () => {
  const { dhash } = await fingerprint(await vshape(false, 400, 300));
  assert.notEqual(dhash, '0000000000000000', 'у осмысленной картинки не может быть нулевой отпечаток');
});

test('противоположные изображения дают далёкие dhash', async () => {
  const a = await fingerprint(await vshape(false, 400, 300));
  const b = await fingerprint(await vshape(true, 400, 300));
  assert.ok(hamming(a.dhash, b.dhash) > 10, `ожидалось далёкое dhash, получено ${hamming(a.dhash, b.dhash)}`);
});

test('hamming считает расстояние по битам', () => {
  assert.equal(hamming('00', '00'), 0);
  assert.equal(hamming('00', '01'), 1);
  assert.equal(hamming('00', 'ff'), 8);
  assert.equal(hamming('0000000000000000', 'ffffffffffffffff'), 64);
});

test('несравнимые отпечатки дают Infinity, а не ложную близость', () => {
  assert.equal(hamming(null, '00'), Infinity);
  assert.equal(hamming('00', 'abcd'), Infinity);
});

test('битый буфер не роняет процесс', async () => {
  const r = await fingerprint(Buffer.from('это не картинка'));
  assert.equal(r.dhash, null);
  assert.equal(r.width, null);
  assert.ok(r.sha1, 'sha1 считается всегда — он не зависит от декодирования');
});

test('насыщенность: серый квадрат даёт 0, цветной — заметно больше', async () => {
  const { saturation } = await import('./photo-fingerprint.mjs');
  const sharp = (await import('sharp')).default;
  const grey = await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 120, g: 120, b: 120 } } }).jpeg().toBuffer();
  const red = await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 220, g: 20, b: 20 } } }).jpeg().toBuffer();
  assert.ok(await saturation(grey) < 0.03, 'серое должно быть ниже порога архива');
  assert.ok(await saturation(red) > 0.5, 'красное должно быть заведомо цветным');
});

test('отпечаток несёт насыщенность, а нечитаемое даёт sat = null', async () => {
  const { fingerprint } = await import('./photo-fingerprint.mjs');
  const sharp = (await import('sharp')).default;
  const img = await sharp({ create: { width: 40, height: 40, channels: 3, background: { r: 10, g: 200, b: 90 } } }).png().toBuffer();
  const fp = await fingerprint(img);
  assert.ok(typeof fp.sat === 'number' && fp.sat > 0.5);
  const bad = await fingerprint(Buffer.from('это не картинка'));
  assert.equal(bad.sat, null, 'не декодировалось — «не знаю», а не 0');
});
