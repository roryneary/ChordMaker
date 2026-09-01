import { describe, expect, it } from 'vitest';
import { renderChordSVG } from '../renderChordSVG';
import { chordFilename, exportPalette } from '../exportPng';
import { chordReducer, emptySpec } from '../../hooks/useChordSpec';
import { ACTIVE_ALPHA, DOT_ALPHA, MAX_ROOT_FRET, VB_H, VB_W } from '../layout';

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
    expect(head.slice(0, head.indexOf('>'))).toContain(`width="${VB_W * 3}"`);
    expect(head.slice(0, head.indexOf('>'))).toContain(`height="${VB_H * 3}"`);
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

  it('draws a nut bar at the first position and a numeral away from it', () => {
    expect(atFret(1)).toContain('height="3.6"');
    // No numeral at the nut: the bar already says "open position".
    expect(atFret(1)).not.toContain('<text');
    expect(atFret(1)).toContain(`viewBox="0 0 ${VB_W} ${VB_H}"`);
    // Up the neck there is no nut, so the numeral says where we are, beside the
    // fret it names. The box is the SAME either way, so the two fretboards
    // render at identical size in adjacent tiles.
    expect(atFret(7)).not.toContain('height="3.6"');
    expect(atFret(7)).toContain('>VII<');
    expect(atFret(7)).toContain(`viewBox="0 0 ${VB_W} ${VB_H}"`);
  });

  it('writes the position as a roman numeral the length of the neck', () => {
    expect(atFret(4)).toContain('>IV<');
    expect(atFret(9)).toContain('>IX<');
    expect(atFret(MAX_ROOT_FRET)).toContain('>XVII<');
  });

  it('spells the position out in the accessible label, since "VII" reads as letters', () => {
    expect(renderChordSVG({ ...withDot(), name: 'B', rootFret: 7 }, screen)).toContain(
      'aria-label="B chord diagram, 7th fret"',
    );
    // Nothing is said at the nut: that is where a chord is unless told otherwise.
    expect(renderChordSVG({ ...withDot(), name: 'B' }, screen)).toContain(
      'aria-label="B chord diagram"',
    );
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

  /* The finger you have just put down must not read as provisional: it was
     drawn at half the ink of a settled dot, so a placement only looked
     committed once the next tap took the halo off it. */
  it('never draws the just-placed finger fainter than a settled one', () => {
    expect(ACTIVE_ALPHA).toBeGreaterThanOrEqual(DOT_ALPHA);
    const active = renderChordSVG(withDot(), { ...screen, active: 5 });
    const dot = active.slice(active.indexOf('<circle'));
    const alpha = dot.match(/fill-opacity="([\d.]+)"/);
    expect(Number(alpha ? alpha[1] : 1)).toBeGreaterThanOrEqual(DOT_ALPHA);
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
    // Strip everything that is allowed to differ: the nut bar, the numeral and
    // its spoken twin in the label, and the top fret line replacing the nut.
    const shape = (svg: string) =>
      svg
        .replace(/<rect x="8.6"[^>]*\/>/, '')
        .replace(/<text[^>]*>[IVX]+<\/text>/, '')
        .replace(/, \d+\w\w fret"/, '"')
        .replace(/<line x1="10" y1="24" x2="90" y2="24"\/>/, '');
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
