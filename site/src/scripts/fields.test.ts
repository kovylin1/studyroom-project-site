import { describe, it, expect } from 'vitest';
import { FIELDS, fieldsFor, fieldSearchTokens } from './fields';

describe('fieldsFor', () => {
  it('groups a marketing programme under business', () => {
    expect(fieldsFor('bachelor of marketing')).toContain('business');
  });

  it('maps computer science and information technology to the same field', () => {
    expect(fieldsFor('msc computer science')).toContain('cs');
    expect(fieldsFor('bsc information technology')).toContain('cs');
  });

  it('returns no fields when nothing matches', () => {
    expect(fieldsFor('basket weaving for beginners')).toEqual([]);
  });

  it('can place a title in more than one field', () => {
    const ids = fieldsFor('history of art');
    expect(ids).toContain('humanities'); // history
    expect(ids).toContain('arts');       // art
  });
});

describe('fieldSearchTokens', () => {
  it('injects the broad RU alias so "бизнес" matches a marketing card', () => {
    const tokens = fieldSearchTokens('bachelor of marketing');
    expect(tokens).toContain('бизнес');
  });

  it('returns nothing when no field matches', () => {
    expect(fieldSearchTokens('basket weaving')).toEqual([]);
  });

  it('injects English short-forms so "cs"/"mba" find the right field', () => {
    expect(fieldSearchTokens('bsc computer science')).toContain('cs');
    expect(fieldSearchTokens('bachelor of marketing')).toContain('mba');
  });
});

describe('FIELDS table integrity', () => {
  it('has unique ids', () => {
    const ids = FIELDS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses lowercase EN keywords (matched as substrings)', () => {
    for (const f of FIELDS) {
      for (const en of f.en) expect(en).toBe(en.toLowerCase());
    }
  });
});
