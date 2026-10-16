import { describe, expect, it } from 'vitest';
import { MAX_VIDEOS, parseVideos, readYouTube, startLabel, thumbnailOf, youTubeUrl } from '../videos';
import { emptyStore, parseStore, serializeStore, type SongStore } from '../storage';
import { parseSharedSong, songFromShare, toSharePayload, tooBigToSave } from '../sharedSong';
import { isBlankSong } from '../songSummary';
import { songsReducer } from '../../hooks/useSongs';

/**
 * A video on a song is a YouTube link, pasted from wherever the player found
 * it. What is pasted varies a lot; what is stored is one form, so the same
 * video is seen to be the same and every link opens the same way.
 */

const ID = 'dQw4w9WgXcQ';
const WATCH = `https://www.youtube.com/watch?v=${ID}`;

describe('reading a pasted YouTube link', () => {
  it.each([
    [`https://www.youtube.com/watch?v=${ID}`],
    [`https://youtube.com/watch?v=${ID}&list=PL123&index=4`],
    [`https://m.youtube.com/watch?v=${ID}`],
    [`https://music.youtube.com/watch?v=${ID}`],
    [`https://youtu.be/${ID}`],
    [`https://youtu.be/${ID}?si=AbCdEf`],
    [`https://www.youtube.com/shorts/${ID}`],
    [`https://www.youtube.com/embed/${ID}`],
    [`https://www.youtube.com/live/${ID}`],
    [`youtu.be/${ID}`],
    [`  www.youtube.com/watch?v=${ID}  `],
  ])('reads %s as the watch page', (pasted) => {
    expect(youTubeUrl(pasted)).toBe(WATCH);
  });

  it('keeps where the link starts, however it is written', () => {
    expect(youTubeUrl(`https://youtu.be/${ID}?t=90`)).toBe(`${WATCH}&t=90s`);
    expect(youTubeUrl(`https://youtu.be/${ID}?t=90s`)).toBe(`${WATCH}&t=90s`);
    expect(youTubeUrl(`${WATCH}&t=1m30s`)).toBe(`${WATCH}&t=90s`);
    expect(youTubeUrl(`${WATCH}&t=1h2m3s`)).toBe(`${WATCH}&t=3723s`);
    expect(youTubeUrl(`https://www.youtube.com/embed/${ID}?start=45`)).toBe(`${WATCH}&t=45s`);
  });

  it('treats a start at zero, or one it cannot read, as from the top', () => {
    expect(youTubeUrl(`${WATCH}&t=0`)).toBe(WATCH);
    expect(youTubeUrl(`${WATCH}&t=soon`)).toBe(WATCH);
  });

  it.each([
    [''],
    ['not a link'],
    ['https://vimeo.com/123456'],
    ['https://www.youtube.com/'],
    ['https://www.youtube.com/@SomeChannel'],
    ['https://www.youtube.com/playlist?list=PL123'],
    ['https://www.youtube.com/watch?v=short'],
    [`https://notyoutube.com/watch?v=${ID}`],
  ])('refuses %s', (pasted) => {
    expect(readYouTube(pasted)).toBeNull();
  });
});

describe('what a stored link shows', () => {
  it('has YouTube’s still for the video', () => {
    expect(thumbnailOf(WATCH)).toBe(`https://i.ytimg.com/vi/${ID}/mqdefault.jpg`);
  });

  it('says where it starts, as a clock would', () => {
    expect(startLabel(WATCH)).toBeNull();
    expect(startLabel(`${WATCH}&t=90s`)).toBe('from 1:30');
    expect(startLabel(`${WATCH}&t=5s`)).toBe('from 0:05');
    expect(startLabel(`${WATCH}&t=3723s`)).toBe('from 1:02:03');
  });
});

describe('a stored list of videos', () => {
  it('reads what was saved, a missing label as none', () => {
    expect(
      parseVideos([
        { id: 'a', url: WATCH, label: 'The lesson' },
        { id: 'b', url: `${WATCH}&t=90s`, label: '   ' },
      ]),
    ).toEqual([
      { id: 'a', url: WATCH, label: 'The lesson' },
      { id: 'b', url: `${WATCH}&t=90s` },
    ]);
  });

  it('drops an entry that is not a YouTube link, not the rest', () => {
    expect(
      parseVideos([{ id: 'a', url: 'https://vimeo.com/1' }, { id: 'b' }, 'x', { id: 'c', url: WATCH }]),
    ).toEqual([{ id: 'c', url: WATCH }]);
  });

  it('reads anything that is not a list as none', () => {
    expect(parseVideos(undefined)).toEqual([]);
    expect(parseVideos({ id: 'a', url: WATCH })).toEqual([]);
  });
});

/* --- On a song ------------------------------------------------------------- */

function song(): { store: SongStore; id: string } {
  const store = songsReducer(emptyStore(), { type: 'CREATE_SONG', title: 'Low Tide' });
  return { store, id: store.currentId! };
}

const add = (store: SongStore, id: string, videoId: string, url: string, label?: string) =>
  songsReducer(store, { type: 'ADD_VIDEO', id, videoId, url, label });

describe('videos on a song', () => {
  it('adds a pasted link in its one form, with its label', () => {
    const { store, id } = song();
    const next = add(store, id, 'v1', `https://youtu.be/${ID}?si=x`, '  The lesson ');
    expect(next.songs[0].videos).toEqual([{ id: 'v1', url: WATCH, label: 'The lesson' }]);
    expect(next.unsynced).toContain(id);
  });

  it('adds nothing for a link that is not YouTube’s, or one already there', () => {
    const { store, id } = song();
    expect(add(store, id, 'v1', 'https://vimeo.com/1')).toBe(store);
    const once = add(store, id, 'v1', WATCH);
    expect(add(once, id, 'v2', `https://youtu.be/${ID}`)).toBe(once);
    // The same video from another point is another link.
    expect(add(once, id, 'v2', `${WATCH}&t=90`).songs[0].videos).toHaveLength(2);
  });

  it(`stops at ${MAX_VIDEOS}`, () => {
    const made = song();
    const { id } = made;
    let { store } = made;
    for (let i = 0; i < MAX_VIDEOS + 3; i++) store = add(store, id, `v${i}`, `${WATCH}&t=${i + 1}`);
    expect(store.songs[0].videos).toHaveLength(MAX_VIDEOS);
  });

  it('labels one, and a blank label is none', () => {
    const { store, id } = song();
    const one = add(store, id, 'v1', WATCH, 'Old');
    const named = songsReducer(one, { type: 'LABEL_VIDEO', id, videoId: 'v1', label: 'Intro riff' });
    expect(named.songs[0].videos).toEqual([{ id: 'v1', url: WATCH, label: 'Intro riff' }]);
    const blank = songsReducer(named, { type: 'LABEL_VIDEO', id, videoId: 'v1', label: '  ' });
    expect(blank.songs[0].videos).toEqual([{ id: 'v1', url: WATCH }]);
    // Unchanged is no edit.
    expect(songsReducer(named, { type: 'LABEL_VIDEO', id, videoId: 'v1', label: 'Intro riff ' })).toBe(named);
  });

  it('removes one, and the last leaves no key behind', () => {
    const { store, id } = song();
    const one = add(store, id, 'v1', WATCH);
    const gone = songsReducer(one, { type: 'REMOVE_VIDEO', id, videoId: 'v1' });
    expect('videos' in gone.songs[0]).toBe(false);
  });

  it('survives a reload', () => {
    const { store, id } = song();
    const one = add(store, id, 'v1', WATCH, 'The lesson');
    expect(parseStore(serializeStore(one))!.songs[0].videos).toEqual(one.songs[0].videos);
  });

  it('counts, so backing out of a song with only a video does not bin it', () => {
    const { store, id } = song();
    const bare = songsReducer(store, { type: 'SET_TITLE', id, title: '' });
    expect(isBlankSong(bare.songs[0])).toBe(true);
    expect(isBlankSong(add(bare, id, 'v1', WATCH).songs[0])).toBe(false);
  });
});

describe('videos on a shared song', () => {
  it('travel with it, and arrive on the copy', () => {
    const { store, id } = song();
    const one = add(store, id, 'v1', WATCH, 'The lesson');
    const payload = toSharePayload(one.songs[0]);
    expect(payload.videos).toEqual([{ id: 'v1', url: WATCH, label: 'The lesson' }]);
    const shared = parseSharedSong('s1', { ownerUid: 'u', handle: 'rory', version: 1, song: payload });
    expect(songFromShare(shared!, 'copy').videos).toEqual(payload.videos);
  });

  it('leave no key on a song with none', () => {
    expect('videos' in toSharePayload(song().store.songs[0])).toBe(false);
  });

  it('are counted against what the account will take', () => {
    const s = song().store.songs[0];
    const many = Array.from({ length: MAX_VIDEOS + 1 }, (_, i) => ({ id: `v${i}`, url: WATCH }));
    expect(tooBigToSave({ ...s, videos: many })).toMatch(/more videos/);
    expect(tooBigToSave({ ...s, videos: many.slice(0, MAX_VIDEOS) })).toBeNull();
  });
});
