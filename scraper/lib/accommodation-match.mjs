// accommodation-match.mjs — «подтверждает ли страница вуза эту карточку?».
// Чистая функция: на вход карточка + HTML, на выход вердикт. Ничего не пишет,
// ничего не выдумывает, найденную на сайте цену только ВОЗВРАЩАЕТ (решение —
// за оператором в панели).

const PRICE_WINDOW = 400;   // символов после названия, где ищем цену
const PRICE_TOLERANCE = 0.02; // ±2% — округления и разные способы подачи

/** Схлопывает регистр, пунктуацию и пробелы: «The Heights (BCU On-Campus)» → «the heights bcu on campus» */
export function normalizeName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** HTML → плоский нормализованный текст (теги и сущности выброшены) */
function htmlToText(html) {
  return normalizeName(
    String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;|&#\d+;/gi, ' ')
  );
}

/** «от £168/нед» → 168; «от CA$1,150/мес» → 1150; мусор → null */
export function parseCatalogPrice(price) {
  if (price == null) return null;
  const m = String(price).replace(/[\s, ]/g, '').match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

/**
 * Ищет первое число-цену в окне после названия. Смотрит ТОЛЬКО в окне —
 * иначе поймает любую цифру со страницы (сборы, годы, телефоны).
 */
export function extractPriceNear(html, normalizedName) {
  const text = htmlToText(html);
  const at = text.indexOf(normalizedName);
  if (at < 0) return null;
  const window = text.slice(at + normalizedName.length, at + normalizedName.length + PRICE_WINDOW);
  // «from 168 per week», «au 330 per week», «ca 1 150 per month» —
  // после htmlToText символы валют и запятые выброшены, остаются числа.
  // Первая альтернатива ловит разряды через пробел (1 150), вторая — обычные числа.
  const m = window.match(/\b(\d{1,3}(?:\s\d{3})+|\d{2,5}(?:\.\d+)?)\b/);
  if (!m) return null;
  return Number(m[1].replace(/\s/g, ''));
}

/**
 * @param {{name?:string, price?:string}} card — карточка accommodation/campus из каталога
 * @param {string} html — HTML страницы офсайта
 * @returns {{verdict:'confirmed'|'price-mismatch'|'price-unconfirmed'|'not-found',
 *            foundPrice:number|null, catalogPrice:number|null}}
 */
export function matchCard(card, html) {
  const nameKey = normalizeName(card && (card.name || card.title));
  const none = { verdict: 'not-found', foundPrice: null, catalogPrice: null };
  if (!nameKey || nameKey.length < 4) return none;

  const text = htmlToText(html);
  if (!text || !text.includes(nameKey)) return none;

  const catalogPrice = parseCatalogPrice(card.price);
  if (catalogPrice == null) {
    return { verdict: 'confirmed', foundPrice: null, catalogPrice: null };
  }

  const foundPrice = extractPriceNear(html, nameKey);
  if (foundPrice == null) {
    return { verdict: 'price-unconfirmed', foundPrice: null, catalogPrice };
  }

  const within = Math.abs(foundPrice - catalogPrice) <= catalogPrice * PRICE_TOLERANCE;
  return {
    verdict: within ? 'confirmed' : 'price-mismatch',
    foundPrice,
    catalogPrice,
  };
}
