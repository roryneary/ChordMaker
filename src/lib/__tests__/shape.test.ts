import { describe, expect, it } from 'vitest';
import { readShape, shapeToSpec, specToShape } from '../shape';
import { LIBRARY, libraryChordToSpec } from '../../data/chordLibrary';
import { emptySpec } from '../../hooks/useChordSpec';

const barreOf = (shape: string) => readShape(shape).barreFret;

describe('barre detection', () => {
  /* The cases the design handoff names explicitly. The >= 4 span rule is what
     separates them: without it A major draws as a barre, which is wrong. */
  it('needs two strings at the lowest fret spanning at least four', () => {
    expect(barreOf('133211')).toBe(1); // F   — spans 5
    expect(barreOf('x24432')).toBe(2); // Bm  — spans 4
    expect(barreOf('x02220')).toBeNull(); // A — three strings, spans 2
  });

  it('is not fooled by a single string at the lowest fret', () => {
    expect(barreOf('x32010')).toBeNull(); // C
    expect(barreOf('022100')).toBeNull(); // E
  });

  /* The deliberate deviation from the ported algorithm. A finger laid across
     the neck frets every string it crosses, so an open string inside the span
     disproves the barre — otherwise the diagram draws a bar straight over
     strings the player is letting ring. */
  it('rejects a span broken by an open or muted string', () => {
    expect(barreOf('x20202')).toBeNull(); // Bm7  — open D and B inside the span
    expect(barreOf('202220')).toBeNull(); // F#m7 — open A inside the span
  });

  it('still finds a barre when every string inside the span is fretted', () => {
    expect(barreOf('355333')).toBe(3); // Gm7
    expect(barreOf('x13331')).toBe(1); // Bb
  });
});

describe('shapeToSpec', () => {
  it('maps low-E-first notation onto guitar string numbers', () => {
    // C = x32010: muted low E (string 6), open high e (string 1).
    const spec = shapeToSpec('C', 'x32010');
    expect(spec.markers[5]).toBe('muted'); // markers[0] is string 1
    expect(spec.markers[0]).toBe('open');
    expect(spec.dots).toContainEqual({ string: 5, fret: 3 });
    expect(spec.dots).toContainEqual({ string: 4, fret: 2 });
    expect(spec.dots).toContainEqual({ string: 2, fret: 1 });
  });

  it('excludes barred strings from the individual dots', () => {
    // F = 133211: a 6->1 barre at fret 1, plus dots on strings 5, 4 and 3.
    const spec = shapeToSpec('F', '133211');
    expect(spec.barres).toEqual([{ fret: 1, fromString: 6, toString: 1 }]);
    expect(spec.dots.map((d) => d.string).sort()).toEqual([3, 4, 5]);
    expect(spec.dots.every((d) => d.fret !== 1)).toBe(true);
  });

  it('slides the window up the neck when the shape will not fit at the nut', () => {
    const spec = shapeToSpec('D', 'xx7779');
    expect(spec.rootFret).toBe(7);
    expect(spec.dots).toContainEqual({ string: 4, fret: 1 });
    expect(spec.dots).toContainEqual({ string: 1, fret: 3 });
  });
});

describe('specToShape', () => {
  it('round-trips every shape in the library', () => {
    for (const chord of LIBRARY) {
      expect(specToShape(libraryChordToSpec(chord))).toBe(chord.shape);
    }
  });

  it('writes absolute frets, so a shape up the neck still round-trips', () => {
    const spec = shapeToSpec('D', 'xx7779');
    expect(spec.rootFret).toBe(7); // drawn in a window, not at the nut
    expect(specToShape(spec)).toBe('xx7779');
  });

  it('returns null for anything the notation cannot say', () => {
    // A string left unset.
    expect(specToShape(emptySpec())).toBeNull();
    // A fret past 9.
    expect(specToShape({ ...shapeToSpec('D', 'xx7779'), rootFret: 12 })).toBeNull();
  });
});

describe('the library', () => {
  it('holds forty-eight shapes, which is the count the UI shows', () => {
    expect(LIBRARY).toHaveLength(48);
  });

  it('has no duplicate names and only well-formed shapes', () => {
    expect(new Set(LIBRARY.map((c) => c.name)).size).toBe(LIBRARY.length);
    for (const chord of LIBRARY) {
      expect(chord.shape).toMatch(/^[x0-9]{6}$/);
    }
  });

  /* Every string must say something — fretted, barred, open or muted. A typo
     that leaves one silent renders a diagram that is musically ambiguous: the
     player cannot tell whether to play the string or not. */
  it('accounts for all six strings on every chord', () => {
    for (const chord of LIBRARY) {
      const spec = libraryChordToSpec(chord);
      const spoken = new Set<number>();
      for (const d of spec.dots) spoken.add(d.string);
      for (const b of spec.barres) {
        for (let s = b.toString; s <= b.fromString; s++) spoken.add(s);
      }
      spec.markers.forEach((m, i) => {
        if (m !== 'none') spoken.add(i + 1);
      });
      expect({ name: chord.name, strings: spoken.size }).toEqual({
        name: chord.name,
        strings: 6,
      });
    }
  });
});
