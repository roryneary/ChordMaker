import { describe, expect, it } from 'vitest';
import { chordReducer, emptySpec } from '../../hooks/useChordSpec';
import { emptySong, parseSong, serializeSong, songReducer } from '../../hooks/useSong';
import { COLUMNS, MARGIN, PAGE_H, PAGE_W, pdfGridLayout } from '../exportPdf';
import { sanitizeFilename } from '../exportPng';
import { COLUMNS as PNG_COLUMNS, MARGIN as PNG_MARGIN, SHEET_W, songPngLayout } from '../exportSongPng';
import { VB_H, VB_W } from '../layout';

const specWithDot = () =>
  chordReducer({ ...emptySpec(), name: 'C' }, { type: 'TOGGLE_DOT', string: 5, fret: 3 });

describe('songReducer', () => {
  it('sets the title', () => {
    expect(songReducer(emptySong(), { type: 'SET_TITLE', title: 'Blackbird' }).title).toBe(
      'Blackbird',
    );
  });

  it('adds, updates, removes and clears chords', () => {
    let s = songReducer(emptySong(), { type: 'ADD_CHORD', spec: specWithDot(), id: 'a' });
    s = songReducer(s, { type: 'ADD_CHORD', spec: emptySpec(), id: 'b' });
    expect(s.chords.map((c) => c.id)).toEqual(['a', 'b']);

    const renamed = { ...emptySpec(), name: 'Bm' };
    s = songReducer(s, { type: 'UPDATE_CHORD', id: 'b', spec: renamed });
    expect(s.chords).toHaveLength(2);
    expect(s.chords[1].spec.name).toBe('Bm');

    s = songReducer(s, { type: 'REMOVE_CHORD', id: 'a' });
    expect(s.chords.map((c) => c.id)).toEqual(['b']);

    s = songReducer(s, { type: 'CLEAR_SONG' });
    expect(s).toEqual(emptySong());
  });

  it('assigns a unique id when none is given', () => {
    let s = songReducer(emptySong(), { type: 'ADD_CHORD', spec: emptySpec() });
    s = songReducer(s, { type: 'ADD_CHORD', spec: emptySpec() });
    expect(s.chords[0].id).not.toBe(s.chords[1].id);
  });
});

describe('persistence', () => {
  it('round-trips a song', () => {
    let s = songReducer(emptySong(), { type: 'SET_TITLE', title: 'Yesterday' });
    s = songReducer(s, { type: 'ADD_CHORD', spec: specWithDot(), id: 'x' });
    expect(parseSong(serializeSong(s))).toEqual(s);
  });

  it('falls back to an empty song on garbage or unknown versions', () => {
    expect(parseSong(null)).toEqual(emptySong());
    expect(parseSong('not json')).toEqual(emptySong());
    expect(parseSong(JSON.stringify({ v: 2, title: 'x', chords: [] }))).toEqual(emptySong());
  });

  it('drops malformed chords but keeps the good ones', () => {
    const raw = JSON.stringify({
      v: 1,
      title: 't',
      chords: [{ id: 'ok', spec: specWithDot() }, { id: 'bad', spec: { name: 1 } }, 'junk'],
    });
    expect(parseSong(raw).chords.map((c) => c.id)).toEqual(['ok']);
  });
});

describe('LOAD action', () => {
  it('replaces the editor spec wholesale', () => {
    const loaded = specWithDot();
    expect(chordReducer(emptySpec(), { type: 'LOAD', spec: loaded })).toBe(loaded);
  });
});

describe('pdfGridLayout', () => {
  it('puts one chord on the first page under the title band', () => {
    const [r] = pdfGridLayout(1);
    expect(r.page).toBe(0);
    expect(r.x).toBe(MARGIN);
    expect(r.y).toBeGreaterThan(MARGIN);
  });

  it('keeps the chord aspect ratio', () => {
    const [r] = pdfGridLayout(1);
    expect(r.h / r.w).toBeCloseTo(VB_H / VB_W, 5);
  });

  it('fills rows left to right and paginates without overlap', () => {
    const rects = pdfGridLayout(10);
    expect(rects.slice(0, COLUMNS).every((r) => r.y === rects[0].y)).toBe(true);
    expect(rects[COLUMNS].y).toBeGreaterThan(rects[0].y);

    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(MARGIN);
      expect(r.x + r.w).toBeLessThanOrEqual(PAGE_W - MARGIN + 1e-6);
      expect(r.y).toBeGreaterThanOrEqual(MARGIN);
      expect(r.y + r.h).toBeLessThanOrEqual(PAGE_H - MARGIN + 1e-6);
    }
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        if (a.page !== b.page) continue;
        const overlap =
          a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap).toBe(false);
      }
    }
    expect(rects[rects.length - 1].page).toBeGreaterThan(0);
    expect(rects.map((r) => r.page)).toEqual([...rects.map((r) => r.page)].sort());
  });
});

describe('songPngLayout', () => {
  it('handles zero chords without a division error', () => {
    const layout = songPngLayout(0);
    expect(layout.rects).toHaveLength(0);
    expect(layout.height).toBeGreaterThan(0);
  });

  it('keeps the chord aspect ratio', () => {
    const layout = songPngLayout(1);
    const [r] = layout.rects;
    expect(r.h / r.w).toBeCloseTo(VB_H / VB_W, 5);
  });

  it('fills rows left to right, grows the sheet downward, never sideways off it', () => {
    const layout = songPngLayout(10);
    const { rects } = layout;
    expect(rects.slice(0, PNG_COLUMNS).every((r) => r.y === rects[0].y)).toBe(true);
    expect(rects[PNG_COLUMNS].y).toBeGreaterThan(rects[0].y);
    expect(layout.width).toBe(SHEET_W);

    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(PNG_MARGIN);
      expect(r.x + r.w).toBeLessThanOrEqual(SHEET_W - PNG_MARGIN + 1e-6);
      expect(r.y + r.h).toBeLessThanOrEqual(layout.height - PNG_MARGIN + 1e-6);
    }
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap).toBe(false);
      }
    }
  });
});

describe('sanitizeFilename', () => {
  it('strips illegal characters and falls back', () => {
    expect(sanitizeFilename('Hey / Jude: "Live"?', 'song')).toBe('Hey Jude Live');
    expect(sanitizeFilename('   ', 'song')).toBe('song');
  });
});
