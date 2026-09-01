import { describe, expect, it } from 'vitest';
import { ordinal, toRoman } from '../numerals';
import { MAX_ROOT_FRET, MIN_ROOT_FRET } from '../layout';

describe('toRoman', () => {
  it('covers the whole neck', () => {
    const neck = Array.from(
      { length: MAX_ROOT_FRET - MIN_ROOT_FRET + 1 },
      (_, i) => i + MIN_ROOT_FRET,
    );
    expect(neck.map(toRoman)).toEqual([
      'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX',
      'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII',
    ]);
  });

  it('subtracts rather than repeating four times', () => {
    expect(toRoman(4)).toBe('IV');
    expect(toRoman(9)).toBe('IX');
    expect(toRoman(14)).toBe('XIV');
  });
});

describe('ordinal', () => {
  it('picks the suffix by the last digit, except in the teens', () => {
    expect([1, 2, 3, 4, 7].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '7th']);
    expect([11, 12, 13].map(ordinal)).toEqual(['11th', '12th', '13th']);
    expect([21, 22].map(ordinal)).toEqual(['21st', '22nd']);
  });
});
