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

const clamp = (n) => Math.max(0, Math.min(1, n));

const JUNK_RE = /\b(click|apply now|read more|find out|view all|learn more|more info|see all|enquire|cookie|subscribe|newsletter|sign up|log in|menu)\b|[›»]/i;

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

// Универсальный скоринг любого факта (программа, стипендия, кампус, размещение).
//  sourceTier:   'official' | 'aggregator' | 'inferred'
//  quality:      0..1 — насколько строка похожа на настоящее имя, а не на мусор
//  corroborated: совпадает с уже имеющейся записью каталога
//  linkLive:     страница-источник отдаёт 200 (живой источник)
export function scoreFact({ sourceTier = 'inferred', quality = 0, corroborated = false, linkLive = false }) {
  let s = sourceTier === 'official' ? 0.55 : sourceTier === 'aggregator' ? 0.35 : 0.15;
  s += quality * 0.30;
  if (corroborated) s += 0.15;
  if (linkLive) s += 0.10;
  return clamp(s);
}

// Скоринг найденной программы (тонкая обёртка над scoreFact для совместимости).
export function scoreProgram({ sourceTier = 'inferred', titleQuality = 0, corroborated = false, linkLive = false }) {
  return scoreFact({ sourceTier, quality: titleQuality, corroborated, linkLive });
}

// ---- специализированные quality-скореры (0..1) ----

const SCHOLARSHIP_KW = /\b(scholarship|scholarships|bursary|bursaries|award|awards|grant|grants|fellowship|stipend|waiver|funding|merit|excellence)\b/i;
const SCHOLARSHIP_GENERIC = /^(scholarships?|bursaries|awards|funding|financial aid|fees? (and|&) funding)$/i;

// Качество названия стипендии: настоящее имя гранта против обрывка/секции страницы.
export function qualityOfScholarship(name) {
  const t = String(name || '').trim();
  if (!t) return 0;
  if (JUNK_RE.test(t)) return 0.1;
  if (SCHOLARSHIP_GENERIC.test(t)) return 0.2; // секция, не конкретная стипендия
  const words = t.split(/\s+/).filter(Boolean).length;
  let q = SCHOLARSHIP_KW.test(t) ? 0.7 : 0.4;
  if (words >= 2 && words <= 14) q += 0.3; else q -= 0.2;
  if (t.length < 4 || t.length > 140) q -= 0.3;
  return clamp(q);
}

const CAMPUS_KW = /(campus|college|university|institute|building|centre|center|library|park|complex|school|faculty|hall)/i;
const CAMPUS_GENERIC = /^(our )?(campus(es)?|locations?|facilities|where we are|find us|visit( us)?|about( us)?)$/i;

// Качество названия кампуса: именованный кампус против заголовка-секции.
export function qualityOfCampus(title) {
  const t = String(title || '').trim();
  if (!t) return 0;
  if (JUNK_RE.test(t)) return 0.1;
  if (CAMPUS_GENERIC.test(t)) return 0.2;
  const words = t.split(/\s+/).filter(Boolean).length;
  let q = CAMPUS_KW.test(t) ? 0.7 : 0.45;
  if (words >= 1 && words <= 8) q += 0.3; else q -= 0.3;
  if (t.length < 5 || t.length > 100) q -= 0.3;
  return clamp(q);
}

const RESIDENCE_KW = /(hall|halls|residence|residences|house|tower|court|village|college|apartment|lodge|dorm|manor|studios?)/i;
const RESIDENCE_GENERIC = /^(accommodation|housing|halls|residences?|living|student (accommodation|housing))$/i;

// Качество названия резиденции/общежития: именованная резиденция против секции.
export function qualityOfResidence(name) {
  const t = String(name || '').trim();
  if (!t) return 0;
  if (JUNK_RE.test(t)) return 0.1;
  if (RESIDENCE_GENERIC.test(t)) return 0.2;
  const words = t.split(/\s+/).filter(Boolean).length;
  let q = RESIDENCE_KW.test(t) ? 0.7 : 0.4;
  if (words >= 1 && words <= 8) q += 0.3; else q -= 0.3;
  if (t.length < 5 || t.length > 120) q -= 0.3;
  return clamp(q);
}

export function passes(confidence) {
  return typeof confidence === 'number' && confidence >= MIN_CONFIDENCE;
}
