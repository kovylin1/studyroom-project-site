import { describe, expect, it } from 'vitest';
import { annualTuitionValues } from './tuition';

describe('annualTuitionValues', () => {
  const programs = [
    { slug: 'bachelor-business', tuitionBasis: undefined },
    { slug: 'bachelor-design', tuitionBasis: 'year' as const },
    { slug: 'bachelor-package', tuitionBasis: 'program' as const },
    { slug: 'bachelor-dubai', tuitionBasis: undefined, tuitionCurrency: 'AED' as const },
  ];

  it('оставляет суммы без признака основы — по умолчанию она годовая', () => {
    const values = annualTuitionValues(
      { currency: 'GBP' as const, byProgram: { 'bachelor-business': 12000, 'bachelor-design': 14000 } },
      programs,
    );
    expect(values.sort((a, b) => a - b)).toEqual([12000, 14000]);
  });

  it('выбрасывает цену за весь срок, иначе она завысила бы «от … в год»', () => {
    const values = annualTuitionValues(
      { currency: 'GBP' as const, byProgram: { 'bachelor-business': 12000, 'bachelor-package': 92443 } },
      programs,
    );
    expect(values).toEqual([12000]);
  });

  it('пересчитывает свою валюту программы в валюту карточки', () => {
    // 36 700 AED при курсах AED 131 и GBP 600 к тенге — это ~8 013 GBP,
    // без пересчёта число ушло бы в «от … в год» как 36 700 фунтов
    const values = annualTuitionValues(
      { currency: 'GBP' as const, byProgram: { 'bachelor-dubai': 36700 } },
      programs,
    );
    expect(Math.round(values[0])).toBe(Math.round(36700 * 131 / 600));
  });

  it('возвращает пусто, когда годовых цен нет вовсе', () => {
    expect(annualTuitionValues({ currency: 'GBP' as const, byProgram: { 'bachelor-package': 92443 } }, programs)).toEqual([]);
  });

  it('игнорирует нули: их вёрстка показывает как «цена уточняется»', () => {
    expect(annualTuitionValues({ currency: 'GBP' as const, byProgram: { 'bachelor-business': 0 } }, programs)).toEqual([]);
  });
});
