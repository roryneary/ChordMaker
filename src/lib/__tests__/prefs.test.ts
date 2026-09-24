import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PREFS,
  TEXT_SCALES,
  nearestScale,
  newerPrefs,
  parsePrefs,
  stepScale,
  withPref,
} from '../prefs';

describe("the player's prefs", () => {
  it('reads anything malformed as the defaults', () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('left')).toEqual(DEFAULT_PREFS);
    expect(parsePrefs({ leftHanded: 'yes', sideways: 1, textScale: 'big' })).toEqual(DEFAULT_PREFS);
  });

  it('keeps what is well formed', () => {
    expect(parsePrefs({ leftHanded: true, sideways: true, textScale: 0.6, updatedAt: 5 })).toEqual({
      leftHanded: true,
      sideways: true,
      textScale: 0.6,
      updatedAt: 5,
    });
  });

  it('never lets a size fall between the steps', () => {
    expect(parsePrefs({ textScale: 0.63 }).textScale).toBe(0.6);
    expect(nearestScale(0.1)).toBe(TEXT_SCALES[0]);
    expect(nearestScale(9)).toBe(TEXT_SCALES[TEXT_SCALES.length - 1]);
    expect(nearestScale(Number.NaN)).toBe(1);
  });

  /* "Much smaller than is currently the case": the old smallest was 0.78. */
  it('goes to half the drawn size', () => {
    expect(TEXT_SCALES[0]).toBe(0.5);
    expect(TEXT_SCALES).toContain(1);
  });

  it('steps one at a time and stops at either end', () => {
    expect(stepScale(1, -1)).toBe(0.9);
    expect(stepScale(1, 1)).toBe(1.12);
    expect(stepScale(0.5, -1)).toBe(0.5);
    expect(stepScale(1.4, 1)).toBe(1.4);
  });

  it('stamps a change, and hands back the same prefs for no change', () => {
    const changed = withPref(DEFAULT_PREFS, 'leftHanded', true, 100);
    expect(changed).toEqual({ ...DEFAULT_PREFS, leftHanded: true, updatedAt: 100 });
    expect(withPref(changed, 'leftHanded', true, 200)).toBe(changed);
  });

  it('moves the stamp forward even when the clock does not', () => {
    const at = { ...DEFAULT_PREFS, updatedAt: 500 };
    expect(withPref(at, 'sideways', true, 400).updatedAt).toBe(501);
  });

  it('keeps the copy changed last, and this one on a tie', () => {
    const local = { ...DEFAULT_PREFS, leftHanded: true, updatedAt: 10 };
    const remote = { ...DEFAULT_PREFS, sideways: true, updatedAt: 20 };
    expect(newerPrefs(local, remote)).toBe(remote);
    expect(newerPrefs(remote, local)).toBe(remote);
    expect(newerPrefs(local, { ...remote, updatedAt: 10 })).toBe(local);
  });

  /* A new account's profile has no prefs: what this device already chose wins. */
  it('lets a choice made signed out beat an account that never chose', () => {
    const local = withPref(DEFAULT_PREFS, 'textScale', 0.7, 50);
    expect(newerPrefs(local, parsePrefs(null))).toBe(local);
  });
});
