// official-site.mjs — SSOT «какой у вуза настоящий адрес».
// До этого модуля логика была продублирована: soroka.mjs::officialRoot (рабочая)
// и bobr-verifier.mjs (брала u.sourceUrl напрямую — а там у 237 вузов edge.edvoy.com,
// то есть проверка шла по странице агрегатора). Теперь одна общая.

// Домены агрегаторов/партнёрских сетей: их страницы НЕ являются офсайтом вуза.
// catseducation оставлен ради обратной совместимости с прежним списком СОРОКИ;
// catsglobalschools/oxfordinternational/intostudy добавлены по замеру каталога.
export const AGG_DOMAINS =
  /edvoy|studygroup|kaplan|navitas|catseducation|catsglobalschools|oxfordinternational|intostudy|qs\.com|topuniversities|collab|wikipedia/i;

function cleanHttpUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let host;
  try { host = new URL(raw).hostname; } catch { return null; }
  if (AGG_DOMAINS.test(host)) return null;
  return raw.replace(/\/+$/, '');
}

/**
 * @param {object} uni      — распарсенный JSON вуза из site/src/content/universities
 * @param {Array<{source:string,data:object}>} extracts — выгрузки источников (может быть [])
 * @returns {string|null}   — база офсайта без хвостового слеша, либо null (не угадываем)
 */
export function resolveOfficialSite(uni, extracts = []) {
  if (!uni) return null;

  const fromField = cleanHttpUrl(uni.officialUrl);
  if (fromField) return fromField;

  const edvoy = (extracts || []).find(e => e && e.source === 'edvoy');
  const fromEdvoy = cleanHttpUrl(edvoy?.data?.website);
  if (fromEdvoy) return fromEdvoy;

  return cleanHttpUrl(uni.sourceUrl);
}
