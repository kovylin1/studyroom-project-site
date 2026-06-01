// Единый confidence-гейт для авто-обновлений каталога (кнопка «Исправить»).
//
// Любой автоматически найденный факт (программа, цена, IELTS, …) получает оценку
// уверенности 0..1 из конкретных сигналов. На прод попадает только то, что
// набрало >= MIN_CONFIDENCE; остальное не перезаписывает хорошие данные и уходит
// в аудит/ревью (правило каталога: обогащать, не резать).

export const MIN_CONFIDENCE = 0.85;

// Нормализованное расстояние Левенштейна → схожесть 0..1 (1 = идентичны).
export function similarity(a, b) {
  a = String(a || '').toLowerCase().trim();
  b = String(b || '').toLowerCase().trim();
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  if (a === b) return 1;
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => i);
  for (let j = 1; j <= n; j++) {
    let prev = dp[0];
    dp[0] = j;
    for (let i = 1; i <= m; i++) {
      const tmp = dp[i];
      dp[i] = Math.min(
        dp[i] + 1,
        dp[i - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      prev = tmp;
    }
  }
  return 1 - dp[m] / Math.max(m, n);
}

const JUNK_RE = /\b(click|apply now|read more|find out|view all|learn more|more info|see all|enquire)\b|[›»]/i;

// Качество заголовка программы 0..1: насколько он похож на настоящее название
// квалификации, а не на навигационный/рекламный мусор со страницы.
export function qualityOfTitle(title, level) {
  if (!level) return 0;            // не распознан уровень → не программа
  const t = String(title || '').trim();
  if (JUNK_RE.test(t)) return 0.1; // навигация/CTA, а не программа
  let q = 0.7;                     // базис: прошёл guessLevel
  const words = t.split(/\s+/).filter(Boolean).length;
  if (words >= 2 && words <= 12) q += 0.3;
  else q -= 0.2;
  if (t.length < 6 || t.length > 120) q -= 0.3;
  return Math.max(0, Math.min(1, q));
}

// Скоринг найденной программы.
//  sourceTier:   'official' | 'aggregator' | 'inferred'
//  titleQuality: 0..1 (qualityOfTitle)
//  corroborated: совпадает с уже имеющейся записью каталога (точный матч)
//  linkLive:     целевой URL программы отдаёт 200
export function scoreProgram({ sourceTier = 'inferred', titleQuality = 0, corroborated = false, linkLive = false }) {
  let s = sourceTier === 'official' ? 0.55 : sourceTier === 'aggregator' ? 0.35 : 0.15;
  s += titleQuality * 0.30;
  if (corroborated) s += 0.15;
  if (linkLive) s += 0.10;
  return Math.max(0, Math.min(1, s));
}

export function passes(confidence) {
  return typeof confidence === 'number' && confidence >= MIN_CONFIDENCE;
}
