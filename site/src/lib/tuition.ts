import type { Program, Tuition } from '../schema/university';
import { CURRENCY_TO_KZT, DEFAULT_KZT_RATE } from '../content/studyroom/static';

/**
 * Суммы из tuition.byProgram, которые ДЕЙСТВИТЕЛЬНО годовые и приведены к валюте
 * карточки (КОМПАС 3.3-a и 3.5-a).
 *
 * Вёрстка подписывает любую сумму как цену за год: «от … ₸/год» на карточке
 * каталога, «/год» в строке программы. У части программ (частные колледжи —
 * SRH, EU Business School, LCI, LaSalle, Kwantlen) источник даёт цену за весь
 * срок, она помечена program.tuitionBasis === 'program'. Если пустить такую
 * сумму в «от … в год», ценник вуза вырастет в 2–4 раза на пустом месте —
 * поэтому все места, где считается min/max, обязаны ходить через эту функцию.
 *
 * Второе: у программы может быть своя валюта (program.tuitionCurrency) — местная
 * валюта кампуса при карточке в USD. Складывать такие числа с ценами карточки
 * нельзя, поэтому здесь они пересчитываются в валюту карточки по тем же
 * приблизительным курсам к тенге, которыми считает витрина.
 */
export function annualTuitionValues(
  tuition: Pick<Tuition, 'byProgram' | 'currency'>,
  programs: readonly Pick<Program, 'slug' | 'tuitionBasis' | 'tuitionCurrency'>[],
): number[] {
  const wholeTerm = new Set(
    programs.filter((p) => p.tuitionBasis === 'program').map((p) => p.slug),
  );
  const ownCurrency = new Map(
    programs.filter((p) => p.tuitionCurrency).map((p) => [p.slug, p.tuitionCurrency as string]),
  );
  const baseRate = CURRENCY_TO_KZT[tuition.currency] ?? DEFAULT_KZT_RATE;
  return Object.entries(tuition.byProgram)
    .filter(([slug, value]) => value > 0 && !wholeTerm.has(slug))
    .map(([slug, value]) => {
      const own = ownCurrency.get(slug);
      if (!own || own === tuition.currency) return value;
      const rate = CURRENCY_TO_KZT[own] ?? DEFAULT_KZT_RATE;
      return value * rate / baseRate;
    });
}
