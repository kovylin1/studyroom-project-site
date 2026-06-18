import { describe, it, expect } from 'vitest';
import { inferLevelFromTitle } from './infer-level.ts';

describe('inferLevelFromTitle', () => {
  it('reads US bachelor codes as bachelor (the ASU bug)', () => {
    expect(inferLevelFromTitle('BS Accountancy')).toBe('bachelor');
    expect(inferLevelFromTitle('BA Economics')).toBe('bachelor');
    expect(inferLevelFromTitle('BSE Aerospace Engineering')).toBe('bachelor');
    expect(inferLevelFromTitle('BBA Marketing')).toBe('bachelor');
    expect(inferLevelFromTitle('BCom, Finance')).toBe('bachelor');
  });

  it('reads UK + US master codes as master', () => {
    expect(inferLevelFromTitle('MSc Data Science')).toBe('master');
    expect(inferLevelFromTitle('MS in Business Analytics')).toBe('master');
    expect(inferLevelFromTitle('MBA')).toBe('master');
    expect(inferLevelFromTitle('LLM International Law')).toBe('master');
    expect(inferLevelFromTitle("Master's in Optometry")).toBe('master');
    expect(inferLevelFromTitle('Master of Public Health')).toBe('master');
  });

  it('handles curly apostrophes and HTML entities in "master\'s"', () => {
    expect(inferLevelFromTitle('Master’s in Engineering')).toBe('master');
    expect(inferLevelFromTitle('Master&#8217;s in Engineering')).toBe('master');
  });

  it('does NOT guess for ambiguous codes — Scottish undergraduate MA stays unresolved', () => {
    // "MA" is a master in England/US but an UNDERGRADUATE degree at Scottish
    // ancient universities. Title alone can't tell — defer to numeric metadata.
    expect(inferLevelFromTitle('MA History')).toBeNull();
    expect(inferLevelFromTitle('MA Psychology')).toBeNull();
    expect(inferLevelFromTitle('Accountancy (MA)')).toBeNull();
  });

  it('does NOT guess for integrated undergraduate masters', () => {
    expect(inferLevelFromTitle('MEng Civil Engineering')).toBeNull();
    expect(inferLevelFromTitle('MArch Architecture')).toBeNull();
  });

  it('reads PhD and foundation', () => {
    expect(inferLevelFromTitle('PhD in Physics')).toBe('phd');
    expect(inferLevelFromTitle('International Foundation Year')).toBe('foundation');
    expect(inferLevelFromTitle("Pre-Master's Programme")).toBe('foundation');
  });

  it('returns null for titles with no degree signal', () => {
    expect(inferLevelFromTitle('Computer Science')).toBeNull();
    expect(inferLevelFromTitle('')).toBeNull();
  });
});
