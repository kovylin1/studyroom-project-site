// site/src/i18n/keys.test.ts
import { describe, it, expect } from 'vitest';
import { ui } from './ui';

describe('i18n key parity', () => {
  const ruKeys = Object.keys(ui.ru).sort();
  for (const loc of ['en', 'kk'] as const) {
    it(`${loc} has every ru key`, () => {
      const missing = ruKeys.filter((k) => !(k in ui[loc]));
      expect(missing, `missing in ${loc}: ${missing.join(', ')}`).toEqual([]);
    });
  }
});
