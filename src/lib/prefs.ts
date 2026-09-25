/**
 * How this player wants the app drawn: which hand they play with, whether the
 * chord boxes lie on their side, and how big the words are when reading.
 *
 * None of this is in a song. A chord is stored one way for everybody — string 6
 * is string 6 — and these only change how it is *shown*, so a left-hander can
 * write a song and a right-hander can play it from the same copy. That is also
 * why they belong to the player and follow them between devices (the account's
 * profile document, `users/{uid}.prefs`), rather than living with the songs.
 */
export interface Prefs {
  leftHanded: boolean;
  sideways: boolean;
  /** A multiple of the reading view's drawn size; one of `TEXT_SCALES`. */
  textScale: number;
  /** When a person last changed any of these. 0 means never: the defaults. */
  updatedAt: number;
}

/**
 * Steps, not a slider: you adjust this with a guitar on your knee. 1 is the size
 * the reading view was drawn at. The small end is for getting a whole song on a
 * phone at once — a page you can see the shape of beats one you have to scroll.
 */
export const TEXT_SCALES = [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.12, 1.25, 1.4] as const;

export const DEFAULT_PREFS: Prefs = {
  leftHanded: false,
  sideways: false,
  textScale: 1,
  updatedAt: 0,
};

/** The nearest step, so a stored or remote value can never fall between them. */
export function nearestScale(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PREFS.textScale;
  let best: number = TEXT_SCALES[0];
  for (const step of TEXT_SCALES) {
    if (Math.abs(step - value) < Math.abs(best - value)) best = step;
  }
  return best;
}

/** One step up or down from `current`, stopping at either end. */
export function stepScale(current: number, by: 1 | -1): number {
  const i = TEXT_SCALES.indexOf(nearestScale(current) as (typeof TEXT_SCALES)[number]);
  const next = Math.max(0, Math.min(TEXT_SCALES.length - 1, i + by));
  return TEXT_SCALES[next];
}

/** Tolerant: whatever is missing or malformed reads as the default. */
export function parsePrefs(raw: unknown): Prefs {
  if (!raw || typeof raw !== 'object') return DEFAULT_PREFS;
  const r = raw as Record<string, unknown>;
  return {
    leftHanded: r.leftHanded === true,
    sideways: r.sideways === true,
    textScale: typeof r.textScale === 'number' ? nearestScale(r.textScale) : DEFAULT_PREFS.textScale,
    updatedAt: typeof r.updatedAt === 'number' && Number.isFinite(r.updatedAt) ? r.updatedAt : 0,
  };
}

/**
 * Which of two copies to keep: the one changed last. A tie keeps `local`, so a
 * copy that came back from the account unchanged is not a change.
 */
export function newerPrefs(local: Prefs, remote: Prefs): Prefs {
  return remote.updatedAt > local.updatedAt ? remote : local;
}

export function samePrefs(a: Prefs, b: Prefs): boolean {
  return (
    a.leftHanded === b.leftHanded &&
    a.sideways === b.sideways &&
    a.textScale === b.textScale &&
    a.updatedAt === b.updatedAt
  );
}

/** A change, stamped. The same prefs back when nothing actually changed. */
export function withPref<K extends keyof Omit<Prefs, 'updatedAt'>>(
  prefs: Prefs,
  key: K,
  value: Prefs[K],
  now: number,
): Prefs {
  if (prefs[key] === value) return prefs;
  return { ...prefs, [key]: value, updatedAt: Math.max(now, prefs.updatedAt + 1) };
}

/**
 * The reading view's word and chord sizes, in px, at a text scale. Here rather
 * than in FullScreen so the settings sample is drawn at exactly the size a song
 * will be. The chord holds the ~0.55 ratio to the words, but never drops below
 * 10px, so at the smallest steps a name is still read at a glance.
 */
export function readingSizes(desktop: boolean, scale: number): { word: number; chord: number } {
  const base = desktop ? { word: 27, chord: 15 } : { word: 23, chord: 14 };
  return { word: base.word * scale, chord: Math.max(10, base.chord * scale) };
}
