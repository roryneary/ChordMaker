import { describe, expect, it } from 'vitest';
import { renderChordSVG } from '../renderChordSVG';
import { chordFilename, exportPalette } from '../exportPng';
import { chordReducer, emptySpec } from '../../hooks/useChordSpec';
import { VB_H, VB_W, VB_W_LABELLED } from '../layout';

const INK = '#292b31';
const screen = { mode: 'screen', ink: INK } as const;

const withDot = () => chordReducer(emptySpec(), { type: 'TOGGLE_DOT', string: 5, fret: 3 });
const atFret = (n: number) =>
  renderChordSVG(chordReducer(withDot(), { type: 'SET_ROOT_FRET', rootFret: n }), screen);

describe('renderChordSVG', () => {
  it('emits a self-contained root element', () => {
    const svg = renderChordSVG(withDot(), screen);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain(`viewBox="0 0 ${VB_W} ${VB_H}"`);
    expect(svg.slice(0, svg.indexOf('>'))).toContain('width="100%"');
    expect(svg.slice(0, svg.indexOf('>'))).not.toContain('height=');
  });

  it('stays transparent on screen and opaque on export', () => {
    expect(renderChordSVG(withDot(), screen)).not.toContain('fill="#FFFFFF"');
    const exported = renderChordSVG(withDot(), { mode: 'export', ...exportPalette });
    const body = exported.slice(exported.indexOf('>') + 1);
    expect(
      body.startsWith(`<rect x="0" y="0" width="${VB_W}" height="${VB_H}" fill="#FFFFFF"/>`),
    ).toBe(true);
  });

  it('sizes the export explicitly', () => {
    const head = renderChordSVG(withDot(), { mode: 'export', scale: 3, ink: INK });
    expect(head.slice(0, head.indexOf('>'))).toContain('width="300"');
    expect(head.slice(0, head.indexOf('>'))).toContain('height="366"');
  });

  /* The rule the whole export path rests on: a serialised SVG carries none of
     the document's CSS, so anything symbolic here exports unstyled. */
  it('carries no class names, CSS variables or external references', () => {
    const svg = renderChordSVG({ ...withDot(), name: 'D Min7' }, { mode: 'export', scale: 3, ink: INK });
    expect(svg).not.toContain('class=');
    expect(svg).not.toContain('var(--');
    expect(svg).not.toContain('color-mix');
    expect(svg).not.toContain('xlink');
    // The namespace is the only URL allowed anywhere in the markup.
    expect(svg.match(/https?:\/\/[^"']+/g)).toEqual(['http://www.w3.org/2000/svg']);
  });

  it('takes every colour from the palette it was given', () => {
    const svg = renderChordSVG(withDot(), { mode: 'screen', ink: '#abcdef' });
    expect(svg).toContain('#abcdef');
    expect(svg).not.toContain(INK);
  });

  it('draws a nut bar at the first position and a label above it', () => {
    expect(atFret(1)).toContain('height="3.6"');
    expect(atFret(1)).not.toContain('fr<');
    // Up the neck there is no nut, so the label says where we are — and the
    // box widens to make room for it.
    expect(atFret(7)).not.toContain('height="3.6"');
    expect(atFret(7)).toContain('>7fr<');
    expect(atFret(7)).toContain(`viewBox="0 0 ${VB_W_LABELLED} ${VB_H}"`);
  });

  it('leaves the chord name to the DOM, but still labels the image', () => {
    const svg = renderChordSVG({ ...withDot(), name: 'Am' }, screen);
    expect(svg).toContain('aria-label="Am chord diagram"');
    // The name is not drawn — it is DOM text beside the diagram.
    expect(svg).not.toContain('>Am<');
  });

  it('escapes the chord name in its accessible label', () => {
    const svg = renderChordSVG({ ...withDot(), name: 'A&B <7>' }, screen);
    expect(svg).toContain('A&amp;B &lt;7&gt;');
  });

  it('draws a six-string barre as one capsule, not six dots', () => {
    const spec = chordReducer(emptySpec(), { type: 'COMPLETE_BARRE', fret: 1, a: 6, b: 1 });
    const svg = renderChordSVG(spec, screen);
    expect(svg.match(/<circle/g)).toBeNull();
    expect(svg.match(/rx="6.6"/g)).toHaveLength(1);
  });

  it('haloes the just-placed finger and nothing else', () => {
    const plain = renderChordSVG(withDot(), screen);
    const active = renderChordSVG(withDot(), { ...screen, active: 5 });
    expect(plain).not.toContain('r="11"');
    expect(active.match(/r="11"/g)).toHaveLength(1);
    expect(active).toContain('r="7.2"');
  });

  /* Learned the hard way in the design prototype: templated text nodes failed
     to lay out and all 144 markers rendered zero-width, which makes x32010
     musically ambiguous. They must be shapes. */
  it('draws open and muted markers as shapes, never as text', () => {
    let spec = chordReducer(emptySpec(), { type: 'CYCLE_MARKER', string: 5 }); // open
    spec = chordReducer(spec, { type: 'CYCLE_MARKER', string: 6 });
    spec = chordReducer(spec, { type: 'CYCLE_MARKER', string: 6 }); // muted
    const svg = renderChordSVG(spec, screen);

    expect(svg).toContain('r="3.5"');              // the open ring
    expect(svg.match(/<line x1="[\d.]+" y1="8"/g)).toHaveLength(1); // the mute cross
    expect(svg).not.toContain('>x<');
    expect(svg).not.toContain('>o<');
  });

  it('slides the shape up the neck without redrawing it', () => {
    // Strip the three things that are allowed to differ: the nut bar, the
    // label, and the top fret line that replaces the nut.
    const shape = (svg: string) =>
      svg
        .replace(/<rect x="8.6"[^>]*\/>/, '')
        .replace(/<text[^>]*>\d+fr<\/text>/, '')
        .replace(/<line x1="10" y1="24" x2="90" y2="24"\/>/, '')
        .replace(/viewBox="0 0 \d+ 122"/, 'viewBox');
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
