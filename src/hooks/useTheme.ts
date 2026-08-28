import { useCallback, useEffect, useState } from 'react';
import type { Palette, ThemeName } from '../theme/tokens';
import { PALETTE } from '../theme/tokens';

export const THEME_KEY = 'chord-builder:theme:v1';

/** 'system' stamps no attribute, which is what lets the OS preference decide. */
export type ThemeChoice = ThemeName | 'system';

const isChoice = (v: unknown): v is ThemeChoice =>
  v === 'light' || v === 'dark' || v === 'system';

function loadChoice(): ThemeChoice {
  try {
    const raw = window.localStorage.getItem(THEME_KEY);
    return isChoice(raw) ? raw : 'system';
  } catch {
    return 'system';
  }
}

const prefersDark = (): boolean => {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
};

export function resolveTheme(choice: ThemeChoice, systemDark: boolean): ThemeName {
  if (choice === 'system') return systemDark ? 'dark' : 'light';
  return choice;
}

/**
 * Writes the choice to <html data-theme> for CSS, and hands back the resolved
 * palette for the one thing CSS cannot reach: the serialised chord SVG.
 */
export function useTheme(): {
  choice: ThemeChoice;
  theme: ThemeName;
  palette: Palette;
  setChoice: (c: ThemeChoice) => void;
  toggle: () => void;
} {
  const [choice, setChoiceState] = useState<ThemeChoice>(loadChoice);
  const [systemDark, setSystemDark] = useState(prefersDark);

  // Tracked even while an explicit choice is active, so switching back to
  // 'system' resolves correctly without waiting for the next OS change.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (choice === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', choice);

    try {
      window.localStorage.setItem(THEME_KEY, choice);
    } catch {
      // Private mode: the session still themes, it just won't be remembered.
    }
  }, [choice]);

  const theme = resolveTheme(choice, systemDark);

  const setChoice = useCallback((c: ThemeChoice) => setChoiceState(c), []);
  const toggle = useCallback(
    () => setChoiceState(theme === 'dark' ? 'light' : 'dark'),
    [theme],
  );

  return { choice, theme, palette: PALETTE[theme], setChoice, toggle };
}
