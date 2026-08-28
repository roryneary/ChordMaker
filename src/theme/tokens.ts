/**
 * The same token values the stylesheet carries, as JavaScript.
 *
 * `renderChordSVG` must emit presentation attributes — a serialised SVG carries
 * none of the document's CSS, so a `var(--color-text)` would export as unstyled
 * or black-on-black. It therefore needs resolved hex, and reading it back out of
 * the DOM with `getComputedStyle` would make the artwork depend on layout having
 * happened. Both sides read from here instead, so there is still one source of
 * truth; `src/styles/tokens.css` mirrors these values and must be kept in step.
 */

export type ThemeName = 'light' | 'dark';

/** Nocturne's ramps, generated on one shared perceptual lightness scale. */
export const NEUTRAL = {
  100: '#f3f5fe',
  200: '#e4e7f5',
  300: '#cfd3e5',
  400: '#b2b6ca',
  500: '#9397ab',
  600: '#75798c',
  700: '#595d6c',
  800: '#3f424d',
  900: '#292b31',
} as const;

export const ACCENT = {
  100: '#f5f4ff',
  200: '#e7e5fe',
  300: '#d2cefd',
  400: '#b5abfc',
  500: '#968ae0',
  600: '#796cbf',
  700: '#5d5294',
  800: '#423a6a',
  900: '#2b2741',
} as const;

export interface Palette {
  bg: string;
  surface: string;
  text: string;
  accent: string;
  /** Tinted roles: selected rows, tags, chips, the nudge callout, capo statements. */
  tintBg: string;
  tintText: string;
  tintStrong: string;
}

export const PALETTE: Record<ThemeName, Palette> = {
  // Light is this design's default.
  light: {
    bg: NEUTRAL[100],
    surface: '#f8f9fe', // color-mix(neutral-100 72%, white)
    text: NEUTRAL[900],
    // accent-600, not the base accent: #9184d9 fails contrast on a pale ground.
    accent: ACCENT[600],
    // accent-400, NOT accent-200. Because the ramps share one lightness scale,
    // accent-200 on a neutral-100 ground measures 1.00:1 — the tint vanishes
    // completely. Tints stay at least two steps from the palest ground.
    tintBg: ACCENT[400],
    tintText: ACCENT[700],
    tintStrong: ACCENT[700],
  },
  dark: {
    bg: '#161826',
    surface: '#232532',
    text: '#e9e9ed',
    accent: '#9184d9',
    tintBg: ACCENT[900],
    tintText: ACCENT[200],
    tintStrong: ACCENT[300],
  },
};

/**
 * Print and download are black ink on white paper regardless of the theme on
 * screen — a chord dictionary page, not a screenshot of the app.
 */
export const EXPORT_INK = '#16150F';
export const EXPORT_PAPER = '#FFFFFF';
