import { useCallback, useEffect, useState } from 'react';

/**
 * The opening: the mark draws itself, holds, then dissolves into the home
 * screen beneath it.
 *
 * Three phases rather than a boolean, because the crossfade needs both halves
 * to move at once — the app has to start fading *in* at the moment the splash
 * starts fading out, and it must not be unmounted until that fade has finished
 * or the home screen would appear abruptly at the end. `leaving` is that
 * overlap; `gone` is when the overlay can leave the tree.
 */
export type SplashPhase = 'hold' | 'leaving' | 'gone';

export const HOLD_MS = 1500;
export const FADE_MS = 520;
/* Reduced motion still gets the brand, just briefly and without the draw-on. */
export const HOLD_REDUCED_MS = 700;
export const FADE_REDUCED_MS = 220;

export const nextPhase = (phase: SplashPhase): SplashPhase =>
  phase === 'hold' ? 'leaving' : 'gone';

/** How long the current phase lasts. `gone` never advances, hence the 0. */
export function phaseMs(phase: SplashPhase, reduced: boolean): number {
  if (phase === 'gone') return 0;
  if (phase === 'hold') return reduced ? HOLD_REDUCED_MS : HOLD_MS;
  return reduced ? FADE_REDUCED_MS : FADE_MS;
}

const prefersReducedMotion = (): boolean => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/**
 * Runs once per page load. Skipping only ever short-circuits the hold: a tap
 * during the crossfade is already landing on the app underneath, and cutting
 * the fade at that point would flash.
 */
export function useSplash(): { phase: SplashPhase; skip: () => void } {
  const [reduced] = useState(prefersReducedMotion);
  const [phase, setPhase] = useState<SplashPhase>('hold');

  useEffect(() => {
    if (phase === 'gone') return;
    const t = setTimeout(() => setPhase(nextPhase(phase)), phaseMs(phase, reduced));
    return () => clearTimeout(t);
  }, [phase, reduced]);

  const skip = useCallback(() => {
    setPhase((p) => (p === 'hold' ? 'leaving' : p));
  }, []);

  return { phase, skip };
}
