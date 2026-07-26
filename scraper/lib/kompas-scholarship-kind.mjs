// kompas-scholarship-kind.mjs — разряд стипендии по происхождению.
//
// Логика жила внутри kompas-scholarship-audit.mjs. Вынесена сюда, потому что тем же
// разрядом помечает записи kompas-mark-scholarships.mjs: две копии классификатора
// разъехались бы, и в панели стояло бы одно число, а в каталоге — другая метка.
//
// Разряды:
//   linked            — есть ссылка: можно открыть и проверить глазами;
//   generic-external  — внешняя программа (Fulbright, Chevening, Erasmus+), проставленная
//                       одинаковой суммой многим вузам. Это не стипендия вуза;
//   cloned            — одно название с одинаковой суммой у CLONE_MIN и более карточек и
//                       без ссылки: признак сид-таблицы, а не сбора;
//   untraceable       — ни ссылки, ни источника, повторов нет: происхождение неизвестно.

// Порог «клона»: одно и то же название с одной и той же суммой у стольких карточек.
// 3 выбрано так, чтобы не ловить случайные совпадения вроде двух кампусов одного вуза.
export const CLONE_MIN = 3;

// Внешние программы, которые вуз не назначает: их сумма и правила общие для страны.
// Список закрытый и проверяемый — угадывать «похоже на внешнюю» по эвристике нельзя.
export const EXTERNAL = [
  /fulbright/i, /chevening/i, /erasmus\+/i, /commonwealth (shared )?scholarship/i,
  /daad/i, /gates cambridge/i, /rhodes scholarship/i, /marshall scholarship/i,
  /^stipendium hungaricum/i, /vanier/i, /^mext/i, /^bolashak/i,
];

export const KINDS = ['linked', 'generic-external', 'cloned', 'untraceable'];

const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/** Ключ клона: название + сумма. Разные суммы одного названия — разные стипендии. */
export const cloneKey = (s) => `${norm(s?.name)}|${norm(s?.amount)}`;

/**
 * Счётчик повторов по всему каталогу. Разряд «клон» по одной карточке не поставить:
 * своя стипендия вуза и штамп сид-таблицы выглядят одинаково, отличает их только то,
 * что штамп стоит у многих.
 */
export function buildCloneCounts(records) {
  const counts = new Map();
  for (const s of records) counts.set(cloneKey(s), (counts.get(cloneKey(s)) ?? 0) + 1);
  return counts;
}

/** Разряд одной записи. cloneCount — карта из buildCloneCounts по всему каталогу. */
export function classifyScholarship(s, cloneCount) {
  if (EXTERNAL.some((re) => re.test(s?.name ?? ''))) return 'generic-external';
  if (s?.url) return 'linked';
  if ((cloneCount?.get(cloneKey(s)) ?? 0) >= CLONE_MIN) return 'cloned';
  return 'untraceable';
}
