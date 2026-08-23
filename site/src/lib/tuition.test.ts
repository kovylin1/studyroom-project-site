import { describe, expect, it } from 'vitest';
import { annualTuitionValues } from './tuition';

describe('annualTuitionValues', () => {
  const programs = [
    { slug: 'bachelor-business', tuitionBasis: undefined },
    { slug: 'bachelor-design', tuitionBasis: 'year' as const },
    { slug: 'bachelor-package', tuitionBasis: 'program' as const },
  ];

  it('оставляет суммы без признака основы — по умолчанию она годовая', () => {
    const values = annualTuitionValues(
      { byProgram: { 'bachelor-business': 12000, 'bachelor-design': 14000 } },
      programs,
    );
    expect(values.sort((a, b) => a - b)).toEqual([12000, 14000]);
  });

  it('выбрасывает цену за весь срок, иначе она завысила бы «от … в год»', () => {
    const values = annualTuitionValues(
      { byProgram: { 'bachelor-business': 12000, 'bachelor-package': 92443 } },
      programs,
    );
    expect(values).toEqual([12000]);
  });

  it('возвращает пусто, когда годовых цен нет вовсе', () => {
    expect(annualTuitionValues({ byProgram: { 'bachelor-package': 92443 } }, programs)).toEqual([]);
  });

  it('игнорирует нули: их вёрстка показывает как «цена уточняется»', () => {
    expect(annualTuitionValues({ byProgram: { 'bachelor-business': 0 } }, programs)).toEqual([]);
  });
});
