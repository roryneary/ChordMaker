import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { Palette, ThemeName } from './tokens';
import { PALETTE } from './tokens';
import { type ThemeChoice, useTheme } from '../hooks/useTheme';

interface ThemeValue {
  choice: ThemeChoice;
  theme: ThemeName;
  palette: Palette;
  setChoice: (c: ThemeChoice) => void;
  toggle: () => void;
}

/**
 * One theme state for the whole app. `useTheme` owns real state, so calling it
 * per component would give each its own copy and they would drift apart.
 *
 * The palette is here because the chord SVG cannot read a CSS variable — see
 * theme/tokens.ts. Everything else should style from the --color-* tokens.
 */
const ThemeContext = createContext<ThemeValue>({
  choice: 'system',
  theme: 'light',
  palette: PALETTE.light,
  setChoice: () => {},
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const value = useTheme();
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useThemeValue = (): ThemeValue => useContext(ThemeContext);
/** Shorthand for the one thing most components want. */
export const useInk = (): string => useContext(ThemeContext).palette.text;
