import { describe, expect, it } from 'vitest';
import { isBlankSong, playOrEdit, songSubLine } from '../songSummary';
import { newSong } from '../storage';
import { tokenise } from '../lyric';
import { emptySpec } from '../../hooks/useChordSpec';

/**
 * The one line under a song's name, wherever songs are listed — the card on
 * Songs and the home screen, the playlist row, the add-songs row. What it says,
 * and in what order, is the only thing telling two songs of the same name apart.
 */

const chord = (name: string) => ({ id: name, spec: { ...emptySpec(), name } });

describe("the line under a song's name", () => {
  it('leads with who plays it', () => {
    const song = { ...newSong('Angel'), artist: 'Jimi Hendrix', chords: [chord('E')], capo: 2 };
    expect(songSubLine(song)).toBe('Jimi Hendrix · 1 chord in · capo on the 2nd');
  });

  it('starts at the count when nobody has been named', () => {
    expect(songSubLine({ ...newSong('Angel'), chords: [chord('E'), chord('A')] })).toBe(
      '2 chords in',
    );
  });

  it('says a name on its own for a song with nothing else in it yet', () => {
    expect(songSubLine({ ...newSong('Angel'), artist: 'Jimi Hendrix' })).toBe('Jimi Hendrix');
    expect(songSubLine(newSong('Angel'))).toBe('Nothing in it yet');
  });

  it('does not draw an empty name as a gap in the line', () => {
    expect(songSubLine({ ...newSong('Angel'), artist: '  ', chords: [chord('E')] })).toBe(
      '1 chord in',
    );
  });
});

describe('a song with nothing in it', () => {
  it('counts a typed artist as something in it, so backing out does not bin it', () => {
    expect(isBlankSong(newSong(''))).toBe(true);
    expect(isBlankSong({ ...newSong(''), artist: 'Jimi Hendrix' })).toBe(false);
    expect(isBlankSong({ ...newSong(''), artist: '  ' })).toBe(true);
    expect(isBlankSong(newSong('Angel'))).toBe(false);
  });
});

describe('where opening a song goes', () => {
  it('plays anything with words or chords on it', () => {
    const lyric = 'Hey Joe';
    expect(playOrEdit({ ...newSong('Hey Joe'), lyric, words: tokenise(lyric) })).toBe('play');
    expect(playOrEdit({ ...newSong('Angel'), chords: [chord('E')] })).toBe('play');
  });

  /* A name alone is nothing to read: the song needs filling in. */
  it('edits a song with nothing to read on it yet', () => {
    expect(playOrEdit(newSong('Angel'))).toBe('edit');
    expect(playOrEdit({ ...newSong('Angel'), artist: 'Jimi Hendrix', capo: 2 })).toBe('edit');
  });
});
