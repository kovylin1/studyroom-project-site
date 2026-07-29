// photo-classify.mjs — классификатор происхождения фото (ОРЁЛ, срез 3).
// Чистая функция: ни сети, ни диска, поэтому тестируется целиком.
//
// Порядок правил важен: провенанс сильнее шаринга. Фото, подтверждённое
// офсайтом, остаётся verified, даже если та же картинка стоит у других вузов
// (общий снимок городского кампуса — законный случай).

/** Начиная со скольких вузов общая картинка считается стоком. Порог проверяется на пилоте. */
export const STOCK_MIN_UNIS = 5;

const LIB_PREFIX = '/photos/_lib/';

/**
 * @param {object} f
 * @param {string} f.path путь или URL картинки
 * @param {string} f.slug вуз, в карточке которого она стоит
 * @param {number} f.unisUsing сколько РАЗНЫХ вузов используют это изображение (по содержимому)
 * @param {{source?:string, license?:string, author?:string}|null} f.provenance
 * @returns {'verified'|'stock'|'shared'|'unknown'}
 */
export function classifyPhoto(f) {
  // Подтверждением считается только полный провенанс: откуда взято И на каких правах.
  if (f.provenance?.source && f.provenance?.license) return 'verified';
  if (typeof f.path === 'string' && f.path.startsWith(LIB_PREFIX)) return 'stock';
  if (f.unisUsing >= STOCK_MIN_UNIS) return 'stock';
  if (f.unisUsing > 1) return 'shared';
  return 'unknown';
}
