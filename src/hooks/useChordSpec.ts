import { useCallback, useReducer, useState } from 'react';
import type { Barre, ChordSpec, StringMarker, StringNumber } from '../types/chord';
import { FRET_COUNT, MAX_ROOT_FRET, MIN_ROOT_FRET, STRING_COUNT } from '../lib/layout';

export const emptySpec = (): ChordSpec => ({
  name: '',
  rootFret: 1,
  fretCount: FRET_COUNT,
  markers: Array.from({ length: STRING_COUNT }, () => 'none' as StringMarker),
  dots: [],
  barres: [],
});

export type Action =
  | { type: 'TOGGLE_DOT'; string: StringNumber; fret: number }
  | { type: 'CYCLE_MARKER'; string: StringNumber }
  | { type: 'SET_ROOT_FRET'; rootFret: number }
  | { type: 'COMPLETE_BARRE'; fret: number; a: StringNumber; b: StringNumber }
  | { type: 'REMOVE_BARRE'; fret: number; string: StringNumber }
  | { type: 'SET_NAME'; name: string }
  | { type: 'LOAD'; spec: ChordSpec }
  | { type: 'CLEAR' };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const covers = (b: Barre, s: number) => s <= b.fromString && s >= b.toString;

/** Invariant 4: a barre must not span `s`. Trim it, or drop it if it cannot survive. */
function excludeString(barres: Barre[], s: number): Barre[] {
  const out: Barre[] = [];
  for (const b of barres) {
    if (!covers(b, s)) {
      out.push(b);
      continue;
    }
    // Keep whichever side is still at least two strings wide.
    if (s < b.fromString && b.fromString - (s + 1) >= 1) {
      out.push({ ...b, toString: (s + 1) as StringNumber });
    } else if (s > b.toString && s - 1 - b.toString >= 1) {
      out.push({ ...b, fromString: (s - 1) as StringNumber });
    }
    // Otherwise the barre is gone. A one-string remnant is not a barre.
  }
  return out;
}

interface ClearOpts {
  /** Keep barres on other frets: a dot may sit on a barred string above the bar. */
  keepBarres?: boolean;
  /** Clear only a dot on this fret, rather than every dot on the string. */
  onlyFret?: number;
}

/** Invariants 1-3: clear anything else occupying `s`. */
function clearString(spec: ChordSpec, s: StringNumber, opts: ClearOpts = {}): ChordSpec {
  const markers = spec.markers.slice();
  markers[s - 1] = 'none';
  return {
    ...spec,
    markers,
    dots: spec.dots.filter(
      (d) => d.string !== s || (opts.onlyFret !== undefined && d.fret !== opts.onlyFret),
    ),
    barres: opts.keepBarres ? spec.barres : excludeString(spec.barres, s),
  };
}

const NEXT_MARKER: Record<StringMarker, StringMarker> = {
  none: 'open',
  open: 'muted',
  muted: 'none',
};

export function chordReducer(spec: ChordSpec, action: Action): ChordSpec {
  switch (action.type) {
    case 'TOGGLE_DOT': {
      const { string: s, fret } = action;
      if (fret < 1 || fret > spec.fretCount) return spec;

      // A tap on barre-covered ground removes the barre.
      const hitBarre = spec.barres.find((b) => b.fret === fret && covers(b, s));
      if (hitBarre) {
        return { ...spec, barres: spec.barres.filter((b) => b !== hitBarre) };
      }

      const existing = spec.dots.find((d) => d.string === s);
      if (existing && existing.fret === fret) {
        return { ...spec, dots: spec.dots.filter((d) => d !== existing) };
      }

      const cleared = clearString(spec, s, { keepBarres: true });
      return { ...cleared, dots: [...cleared.dots, { string: s, fret }] };
    }

    case 'CYCLE_MARKER': {
      const s = action.string;
      const next = NEXT_MARKER[spec.markers[s - 1] ?? 'none'];
      const cleared = clearString(spec, s); // also strips dot + barre coverage
      const markers = cleared.markers.slice();
      markers[s - 1] = next;
      return { ...cleared, markers };
    }

    case 'SET_ROOT_FRET':
      // Dots keep their relative fret, so the shape slides up the neck.
      return { ...spec, rootFret: clamp(Math.round(action.rootFret), MIN_ROOT_FRET, MAX_ROOT_FRET) };

    case 'COMPLETE_BARRE': {
      const { fret } = action;
      if (fret < 1 || fret > spec.fretCount) return spec;
      const from = Math.max(action.a, action.b) as StringNumber; // leftmost, lower pitch
      const to = Math.min(action.a, action.b) as StringNumber;

      // Invariant 5: a span of one is a dot, not a barre.
      if (from === to) return chordReducer(spec, { type: 'TOGGLE_DOT', string: from, fret });

      let next: ChordSpec = spec;
      for (let s = to; s <= from; s++) {
        next = clearString(next, s as StringNumber, { onlyFret: fret });
      }
      return { ...next, barres: [...next.barres, { fret, fromString: from, toString: to }] };
    }

    case 'REMOVE_BARRE':
      return {
        ...spec,
        barres: spec.barres.filter(
          (b) => !(b.fret === action.fret && covers(b, action.string)),
        ),
      };

    case 'SET_NAME':
      return { ...spec, name: action.name };

    case 'LOAD':
      return action.spec;

    case 'CLEAR':
      return emptySpec();

    default:
      return spec;
  }
}

export interface PendingBarre {
  fret: number;
  string: StringNumber;
}

export function isEmptySpec(spec: ChordSpec): boolean {
  return (
    spec.dots.length === 0 &&
    spec.barres.length === 0 &&
    spec.markers.every((m) => m === 'none')
  );
}

/**
 * Barre-mode UI state sits beside the spec, not inside it: it is not artwork.
 */
export function useChordSpec(initial: ChordSpec = emptySpec()) {
  const [spec, dispatch] = useReducer(chordReducer, initial);
  const [barreMode, setBarreMode] = useState(false);
  const [pendingBarre, setPendingBarre] = useState<PendingBarre | null>(null);

  const exitBarreMode = useCallback(() => {
    setBarreMode(false);
    setPendingBarre(null);
  }, []);

  const toggleBarreMode = useCallback(() => {
    setBarreMode((on) => !on);
    setPendingBarre(null);
  }, []);

  /** One entry point for every grid tap, so barre mode cannot leak into components. */
  const tapCell = useCallback(
    (s: StringNumber, fret: number) => {
      if (!barreMode) {
        dispatch({ type: 'TOGGLE_DOT', string: s, fret });
        return;
      }
      if (!pendingBarre) {
        setPendingBarre({ fret, string: s });
        return;
      }
      if (pendingBarre.fret === fret && pendingBarre.string === s) {
        setPendingBarre(null); // tapping the anchor cancels it
        return;
      }
      if (pendingBarre.fret !== fret) {
        setPendingBarre({ fret, string: s }); // different row: move the anchor
        return;
      }
      dispatch({ type: 'COMPLETE_BARRE', fret, a: pendingBarre.string, b: s });
      exitBarreMode();
    },
    [barreMode, pendingBarre, exitBarreMode],
  );

  const tapMarker = useCallback((s: StringNumber) => {
    dispatch({ type: 'CYCLE_MARKER', string: s });
  }, []);

  return {
    spec,
    dispatch,
    barreMode,
    pendingBarre,
    toggleBarreMode,
    exitBarreMode,
    tapCell,
    tapMarker,
  };
}
