import type { Program, Tuition } from '../schema/university';

/**
 * Суммы из tuition.byProgram, которые ДЕЙСТВИТЕЛЬНО годовые (КОМПАС 3.3-a).
 *
 * Вёрстка подписывает любую сумму как цену за год: «от … ₸/год» на карточке
 * каталога, «/год» в строке программы. У части программ (частные колледжи —
 * SRH, EU Business School, LCI, LaSalle, Kwantlen) источник даёт цену за весь
 * срок, она помечена program.tuitionBasis === 'program'. Если пустить такую
 * сумму в «от … в год», ценник вуза вырастет в 2–4 раза на пустом месте —
 * поэтому все места, где считается min/max, обязаны ходить через эту функцию.
 */
export function annualTuitionValues(
  tuition: Pick<Tuition, 'byProgram'>,
  programs: readonly Pick<Program, 'slug' | 'tuitionBasis'>[],
): number[] {
  const wholeTerm = new Set(
    programs.filter((p) => p.tuitionBasis === 'program').map((p) => p.slug),
  );
  return Object.entries(tuition.byProgram)
    .filter(([slug, value]) => value > 0 && !wholeTerm.has(slug))
    .map(([, value]) => value);
}
