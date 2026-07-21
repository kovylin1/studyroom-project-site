// photo-fingerprint.mjs — отпечатки изображений для ОРЛА (срез 3).
//
// Два независимых отпечатка:
//   sha1  — побайтовый: ловит точные копии файла;
//   dhash — перцептивный: ловит то же изображение в другом размере или пережатии.
//
// Только sha1 недостаточно: часть дублей в каталоге замаскирована ресайзом
// (в репозитории есть resize-photos.mjs), и побайтово они не совпадают.

import crypto from 'node:crypto';
import sharp from 'sharp';

const HASH_W = 9, HASH_H = 8; // 9x8 серых пикселей → 8x8 = 64 сравнения соседей

/** dHash: каждый пиксель сравнивается с соседом справа; ярче → 1. */
async function dhashOf(buf) {
  const px = await sharp(buf)
    .greyscale()
    .resize(HASH_W, HASH_H, { fit: 'fill' })
    .raw()
    .toBuffer();
  let bits = '';
  for (let y = 0; y < HASH_H; y++)
    for (let x = 0; x < HASH_W - 1; x++)
      bits += px[y * HASH_W + x] > px[y * HASH_W + x + 1] ? '1' : '0';
  let hex = '';
  for (let i = 0; i < bits.length; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

/**
 * Отпечаток изображения.
 * @param {Buffer} buf содержимое файла
 * @returns {Promise<{sha1:string, dhash:string|null, width:number|null, height:number|null, bytes:number}>}
 *   Нечитаемое изображение даёт dhash/width/height = null; sha1 считается всегда,
 *   он не зависит от декодирования.
 */
export async function fingerprint(buf) {
  const sha1 = crypto.createHash('sha1').update(buf).digest('hex');
  try {
    const meta = await sharp(buf).metadata();
    return {
      sha1,
      dhash: await dhashOf(buf),
      width: meta.width ?? null,
      height: meta.height ?? null,
      bytes: buf.length,
    };
  } catch {
    return { sha1, dhash: null, width: null, height: null, bytes: buf.length };
  }
}

/**
 * Расстояние Хэмминга между hex-отпечатками одинаковой длины.
 * Несравнимые (null или разная длина) → Infinity: лучше признать «не знаю»,
 * чем выдать ложную близость и склеить разные фото.
 */
export function hamming(a, b) {
  if (!a || !b || a.length !== b.length) return Infinity;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) { d += x & 1; x >>= 1; }
  }
  return d;
}
