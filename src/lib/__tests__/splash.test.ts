import { describe, expect, it } from 'vitest';
import {
  FADE_MS,
  FADE_REDUCED_MS,
  HOLD_MS,
  HOLD_REDUCED_MS,
  nextPhase,
  phaseMs,
} from '../../app/splash';

describe('the opening sequence', () => {
  it('runs hold, then the crossfade, then leaves the tree', () => {
    expect(nextPhase('hold')).toBe('leaving');
    expect(nextPhase('leaving')).toBe('gone');
  });

  /* Advancing past 'gone' would remount the splash on a running app. */
  it('stays gone', () => {
    expect(nextPhase('gone')).toBe('gone');
    expect(phaseMs('gone', false)).toBe(0);
  });

  it('shortens every phase for reduced motion', () => {
    expect(phaseMs('hold', true)).toBeLessThan(phaseMs('hold', false));
    expect(phaseMs('leaving', true)).toBeLessThan(phaseMs('leaving', false));
    expect(phaseMs('hold', false)).toBe(HOLD_MS);
    expect(phaseMs('hold', true)).toBe(HOLD_REDUCED_MS);
    expect(phaseMs('leaving', false)).toBe(FADE_MS);
    expect(phaseMs('leaving', true)).toBe(FADE_REDUCED_MS);
  });
});
