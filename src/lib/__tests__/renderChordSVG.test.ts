import { describe, expect, it } from 'vitest';
import { renderChordSVG } from '../renderChordSVG';
import { chordFilename } from '../exportPng';
import { chordReducer, emptySpec } from '../../hooks/useChordSpec';
import { VB_H, VB_W } from '../layout';

const withDot = () => chordReducer(emptySpec(), { type: 'TOGGLE_DOT', string: 5, fret: 3 });
const atFret = (n: number) =>
  renderChordSVG(chordReducer(withDot(), { type: 'SET_ROOT_FRET', rootFret: n }), {
    mode: 'screen',
  });

describe('renderChordSVG', () => {
  it('emits a self-contained root element', () => {
    const svg = renderChordSVG(withDot(), { mode: 'screen' });
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain(`viewBox="0 0 ${VB_W} ${VB_H}"`);
    expect(svg.slice(0, svg.indexOf('>'))).toContain('width="100%"');
    expect(svg.slice(0, svg.indexOf('>'))).not.toContain('height=');
  });

  it('opens with an opaque white ground', () => {
    const svg = renderChordSVG(withDot(), { mode: 'screen' });
    const body = svg.slice(svg.indexOf('>') + 1);
    expect(body.startsWith(`<rect x="0" y="0" width="${VB_W}" height="${VB_H}" fill="#FFFFFF"/>`)).toBe(
      true,
    );
  });

  it('sizes the export explicitly', () => {
    const head = renderChordSVG(withDot(), { mode: 'export', scale: 3 });
    expect(head.slice(0, head.indexOf('>'))).toContain('width="960"');
    expect(head.slice(0, head.indexOf('>'))).toContain('height="1110"');
  });

  it('carries no class names, CSS variables or external references', () => {
    const svg = renderChordSVG({ ...withDot(), name: 'D Min7' }, { mode: 'export', scale: 3 });
    expect(svg).not.toContain('class=');
    expect(svg).not.toContain('var(--');
    expect(svg).not.toContain('xlink');
    // The namespace is the only URL allowed anywhere in the markup.
    expect(svg.match(/https?:\/\/[^"']+/g)).toEqual(['http://www.w3.org/2000/svg']);
  });

  it('draws a nut bar only at the first position, but always the label', () => {
    expect(atFret(1)).toContain('height="9" fill="#16150F"');
    expect(atFret(1)).toContain('>1fr<');
    expect(atFret(7)).not.toContain('height="9" fill="#16150F"');
    expect(atFret(7)).toContain('>7fr<');
  });

  it('draws a six-string barre as one capsule, not six dots', () => {
    const spec = chordReducer(emptySpec(), { type: 'COMPLETE_BARRE', fret: 1, a: 6, b: 1 });
    const svg = renderChordSVG(spec, { mode: 'screen' });
    expect(svg.match(/<circle/g)).toBeNull();
    expect(svg.match(/rx="14"/g)).toHaveLength(1);
  });

  it('escapes the chord name', () => {
    const svg = renderChordSVG({ ...withDot(), name: 'A&B <7>' }, { mode: 'screen' });
    expect(svg).toContain('A&amp;B &lt;7&gt;');
  });

  it('slides the shape up the neck without redrawing it', () => {
    // Strip the two things that are allowed to differ: the nut bar and the label.
    const shape = (svg: string) =>
      svg
        .replace(/<rect x="28" y="91.5"[^>]*\/>/, '')
        .replace(/>\d+fr</, '>Nfr<')
        .replace(/<line x1="28" y1="96" x2="248"[^>]*\/>/, '');
    expect(shape(atFret(7))).toBe(shape(atFret(1)));
  });
});

describe('chordFilename', () => {
  it('keeps sensible names and strips illegal characters', () => {
    expect(chordFilename('D Maj13')).toBe('D Maj13.png');
    expect(chordFilename('D♯ Maj13')).toBe('D♯ Maj13.png');
    expect(chordFilename('A/C: *bass?')).toBe('AC bass.png');
    expect(chordFilename('C\\D<E>F|G"H')).toBe('CDEFGH.png');
    expect(chordFilename('   ')).toBe('chord.png');
    expect(chordFilename('x'.repeat(200))).toBe(`${'x'.repeat(60)}.png`);
  });
});
