import { describe, expect, it } from 'vitest';
import { isChordLine, isChordToken, wordsOnly } from '../chordLines';
import { groupByLine, lineCount, tokenise } from '../lyric';

const line = (text: string) => text.split(/\s+/).filter(Boolean).map((t) => ({ text: t }));

const linesOf = (lyric: string) => groupByLine(tokenise(lyric), lineCount(lyric));
const textOf = (lines: ReturnType<typeof linesOf>) => lines.map((l) => l.map((w) => w.text).join(' '));

describe('isChordToken', () => {
  it.each(['G', 'Em', 'F#m7', 'Cmaj7', 'Dsus4', 'Bb', 'G/B', 'Asus2', 'E7b9', 'Aadd9', 'C7sus4', '(D)', 'Bbm', 'C/D'])(
    'reads %s as a chord',
    (t) => expect(isChordToken(t)).toBe(true),
  );

  it.each(['And', 'Be', 'Go', 'Dance', 'I', 'the', 'Am.', 'H', 'Ebony'])('reads %s as a word', (t) =>
    expect(isChordToken(t)).toBe(false),
  );
});

describe('isChordLine', () => {
  it('reads a line of chords, with the filler a chord line carries', () => {
    expect(isChordLine(line('G C D G'))).toBe(true);
    expect(isChordLine(line('| Am | F | C | G | x2'))).toBe(true);
    expect(isChordLine(line('N.C. E7'))).toBe(true);
  });

  it('reads any line with more than one slash as chords', () => {
    expect(isChordLine(line('G / Bm7 / Am7 / C/D'))).toBe(true);
    expect(isChordLine(line('G / / /'))).toBe(true);
    // Something it would not otherwise recognise, but the slashes settle it.
    expect(isChordLine(line('Intro: G / D / Em'))).toBe(true);
    expect(isChordLine(line('Am/G / F'))).toBe(true);
  });

  it('does not read a lyric line as chords', () => {
    expect(isChordLine(line('Am I the only one'))).toBe(false);
    expect(isChordLine(line('A man walks in'))).toBe(false);
    expect(isChordLine(line('Be my baby'))).toBe(false);
    expect(isChordLine(line('this and/or that'))).toBe(false);
  });

  it('needs a real chord, not only filler', () => {
    expect(isChordLine(line('x2'))).toBe(false);
    expect(isChordLine(line('| |'))).toBe(false);
    expect(isChordLine([])).toBe(false);
  });

  it('reads a lone "A" as a chord — the ambiguity it accepts', () => {
    expect(isChordLine(line('A'))).toBe(true);
  });
});

describe('wordsOnly', () => {
  it('takes the chord lines out and keeps the words and verse gaps', () => {
    const lyric = ['G / C / G', 'walking home', 'C D G', 'in the rain', '', 'Em C', 'second verse'].join('\n');
    expect(textOf(wordsOnly(linesOf(lyric)))).toEqual(['walking home', 'in the rain', '', 'second verse']);
  });

  it('closes up the gap an intro line leaves, and trims gaps at either end', () => {
    const lyric = ['', 'G C D G', '', '', 'first line', '', 'Em / D / C', '', 'last line', '', 'G'].join('\n');
    expect(textOf(wordsOnly(linesOf(lyric)))).toEqual(['first line', '', 'last line']);
  });

  it('leaves a lyric with no chord lines as it was, bar the edges', () => {
    const lyric = ['one', '', 'two'].join('\n');
    expect(textOf(wordsOnly(linesOf(lyric)))).toEqual(['one', '', 'two']);
  });
});
