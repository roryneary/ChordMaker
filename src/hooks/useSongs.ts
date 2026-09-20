import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { ChordSpec } from '../types/chord';
import type { SavedChord, Song } from '../types/song';
import type { Playlist } from '../types/playlist';
import type { MyChord } from '../types/myChord';
import type { SharedSong } from '../types/sharedSong';
import { lineageOf } from '../lib/sharedSong';
import { isBlankSong } from '../lib/songSummary';
import { chordChanged } from '../lib/chordEdits';
import { cleanChordName, collapseByShape, keepOffer, newMyChord } from '../lib/myChords';
import { newId } from '../lib/id';
import { prunePlacements, pruneToChords, retokenise } from '../lib/lyric';
import {
  type SongStore,
  loadStore,
  newSong,
  parseMyChord,
  parseSong,
  saveStore,
} from '../lib/storage';
import { firebaseEnabled } from '../lib/firebase';
import { deleteRemoteSong, fetchRemoteSongs, writeSong } from '../lib/songSync';
import {
  deleteRemotePlaylist,
  fetchRemotePlaylists,
  writePlaylist,
} from '../lib/playlistSync';
import { deleteRemoteMyChord, fetchRemoteMyChords, writeMyChord } from '../lib/chordSync';
import {
  cleanPlaylistName,
  moveItem,
  newItem,
  newPlaylist,
  parsePlaylist,
  playlistNameTaken,
  withoutSong,
} from '../lib/playlists';
import {
  lastSyncedUid,
  mergeOnSignIn,
  rememberSyncedUid,
  stashLibrary,
  takeStash,
} from '../lib/accountSync';
import {
  type SyncView,
  errorCode,
  initialSync,
  syncLabel,
  syncPhase,
  syncReducer,
} from '../lib/syncStatus';

export type SongsAction =
  /** The account's library has arrived. The merge happens here, in the reducer,
      against the store as it is *now* — not against whatever the hook captured
      before it started fetching. */
  | {
      type: 'HYDRATE';
      remote: Song[];
      allowPush: boolean;
      restored?: Song[];
      /** Absent leaves the playlists alone; the hook always sends them. */
      remotePlaylists?: Playlist[];
      restoredPlaylists?: Playlist[];
      /** The same again for My chords. */
      remoteChords?: MyChord[];
      restoredChords?: MyChord[];
    }
  /** The account confirmed a write (`updatedAt`) or a delete (`null`). */
  | { type: 'SYNCED'; id: string; updatedAt: number | null }
  | { type: 'PLAYLIST_SYNCED'; id: string; updatedAt: number | null }
  | { type: 'MY_CHORD_SYNCED'; id: string; updatedAt: number | null }
  /* My chords. None of these touches a song, and no song action touches them:
     a song holds its own copy of every shape it uses. */
  /** Keeps a shape. Nothing happens if it cannot be kept: see `keepOffer`. */
  | { type: 'KEEP_CHORD'; spec: ChordSpec; id?: string }
  | { type: 'UPDATE_MY_CHORD'; id: string; spec: ChordSpec }
  | { type: 'DELETE_MY_CHORD'; id: string }
  | { type: 'CREATE_SONG'; title: string; id?: string }
  | { type: 'OPEN_SONG'; id: string | null }
  | { type: 'DELETE_SONG'; id: string }
  /** The song has been walked away from. Deletes it if there is nothing in it. */
  | { type: 'DISCARD_IF_BLANK'; id: string }
  | { type: 'SET_TITLE'; id: string; title: string }
  | { type: 'SET_META'; id: string; key?: string; feel?: string }
  | { type: 'SET_CAPO'; id: string; capo: number | null }
  | { type: 'SET_LYRIC'; id: string; lyric: string }
  | { type: 'ADD_CHORD'; id: string; spec: ChordSpec; chordId?: string }
  | { type: 'UPDATE_CHORD'; id: string; chordId: string; spec: ChordSpec }
  | { type: 'REMOVE_CHORD'; id: string; chordId: string }
  | { type: 'REORDER_CHORD'; id: string; chordId: string; to: number }
  | { type: 'PLACE_CHORD'; id: string; wordId: string; chordId: string | null }
  /** Keeps a shared song: `song` is the recipient's own copy, id already minted
      (`songFromShare`), so the caller can go straight to it. */
  | { type: 'ADOPT_SONG'; song: Song }
  /** "Replace mine": the sender's newer version, over the copy taken from them. */
  | { type: 'REPLACE_FROM_SHARE'; id: string; shared: SharedSong }
  /** "Keep mine": this copy has gone its own way and is not asked again. */
  | { type: 'STOP_FOLLOWING'; id: string }
  /**
   * The shared copy was written. `sentUpdatedAt` is the stamp of the song that
   * went up, or null when only the listing changed and no content was sent.
   */
  | {
      type: 'SONG_SHARED';
      id: string;
      shareId: string;
      version: number;
      listed: boolean;
      sentUpdatedAt: number | null;
    }
  | { type: 'SONG_UNSHARED'; id: string }
  | { type: 'CREATE_PLAYLIST'; name: string; id?: string; songIds?: string[] }
  | { type: 'RENAME_PLAYLIST'; id: string; name: string }
  | { type: 'DELETE_PLAYLIST'; id: string }
  | { type: 'ADD_TO_PLAYLIST'; id: string; songIds: string[] }
  | { type: 'REMOVE_FROM_PLAYLIST'; id: string; itemId: string }
  | { type: 'MOVE_PLAYLIST_ITEM'; id: string; itemId: string; to: number };

/**
 * A chord's name is what the sheet prints over the word — a nameless one draws
 * as an em dash on the song screen and as a gap on the printed sheet, so it is
 * refused here rather than saved and rendered as a hole.
 */
export const named = (spec: ChordSpec) => spec.name.trim().length > 0;

const trimName = (spec: ChordSpec): ChordSpec =>
  spec.name === spec.name.trim() ? spec : { ...spec, name: spec.name.trim() };

/** Records that `id` has a change the account has not confirmed. See SongStore.unsynced. */
const mark = (unsynced: string[], id: string): string[] =>
  unsynced.includes(id) ? unsynced : [...unsynced, id];

/** The song with no `shared` on it — the key gone, not set to `undefined`. */
function unshared(song: Song): Song {
  const next = { ...song };
  delete next.shared;
  return next;
}

/** Applies `change` to one song and stamps it, leaving the rest of the store alone. */
function editSong(
  store: SongStore,
  id: string,
  change: (song: Song) => Song,
): SongStore {
  let touched = false;
  const songs = store.songs.map((s) => {
    if (s.id !== id) return s;
    const next = change(s);
    if (next === s) return s;
    touched = true;
    /* Strictly later than the last stamp, even for two edits in one
       millisecond: SYNCED compares stamps to tell "the write that just landed"
       from "an edit made while it was in flight", and a tie would clear the
       flag on a version the account never received. */
    return { ...next, updatedAt: Math.max(Date.now(), s.updatedAt + 1) };
  });
  return touched ? { ...store, songs, unsynced: mark(store.unsynced, id) } : store;
}

/** `editSong`, for a playlist: same stamp rule, its own unconfirmed list. */
function editPlaylist(
  store: SongStore,
  id: string,
  change: (playlist: Playlist) => Playlist,
): SongStore {
  let touched = false;
  const playlists = store.playlists.map((p) => {
    if (p.id !== id) return p;
    const next = change(p);
    if (next === p) return p;
    touched = true;
    return { ...next, updatedAt: Math.max(Date.now(), p.updatedAt + 1) };
  });
  return touched
    ? { ...store, playlists, unsyncedPlaylists: mark(store.unsyncedPlaylists, id) }
    : store;
}

type Hydrate = Extract<SongsAction, { type: 'HYDRATE' }>;

/** The playlists' half of a sign-in. Nothing, if the account sent none to merge. */
function hydratePlaylists(store: SongStore, action: Hydrate): Partial<SongStore> {
  // They take the same merge as songs, by the same rule. They keep the order
  // they are in rather than sorting by stamp: reordering a set should not also
  // shuffle the list of sets.
  if (!action.remotePlaylists) return {};
  const lists = mergeOnSignIn(
    store.playlists,
    action.remotePlaylists,
    action.allowPush,
    store.unsyncedPlaylists,
  );
  const haveList = new Set(lists.merged.map((p) => p.id));
  const restoredLists = (action.restoredPlaylists ?? []).filter((p) => !haveList.has(p.id));
  const order = new Map(store.playlists.map((p, i) => [p.id, i] as const));
  const last = Number.MAX_SAFE_INTEGER;
  const playlists = [...lists.merged, ...restoredLists].sort(
    (a, b) => (order.get(a.id) ?? last) - (order.get(b.id) ?? last) || a.createdAt - b.createdAt,
  );
  return {
    playlists,
    unsyncedPlaylists: [
      ...lists.toPush.map((p) => p.id),
      ...lists.toDelete,
      ...restoredLists.map((p) => p.id),
    ],
  };
}

/**
 * My chords' half. The same merge, and then one step the others do not need.
 * Accounts merge by id, and My chords is one entry per *shape*: the same shape
 * kept on a phone and on a laptop arrives here as two. `collapseByShape` keeps
 * the older, and the other is listed as unconfirmed with nothing behind it,
 * which is how a delete is spelled. Both devices pick the same winner, so they
 * end up agreeing rather than deleting each other's.
 */
function hydrateChords(store: SongStore, action: Hydrate): Partial<SongStore> {
  if (!action.remoteChords) return {};
  const mine = mergeOnSignIn(
    store.chords,
    action.remoteChords,
    action.allowPush,
    store.unsyncedChords,
  );
  const have = new Set(mine.merged.map((c) => c.id));
  const restored = (action.restoredChords ?? []).filter((c) => !have.has(c.id));
  const { kept, dropped } = collapseByShape([...mine.merged, ...restored]);
  const held = new Set(kept.map((c) => c.id));
  const toSend = [...mine.toPush, ...restored].map((c) => c.id).filter((id) => held.has(id));
  return {
    // Newest first: there is no order of the player's own to keep.
    chords: [...kept].sort((a, b) => b.createdAt - a.createdAt),
    unsyncedChords: [...new Set([...toSend, ...mine.toDelete, ...dropped])],
  };
}

/** `editPlaylist`, for one of My chords. */
function editMyChord(
  store: SongStore,
  id: string,
  change: (chord: MyChord) => MyChord,
): SongStore {
  let touched = false;
  const chords = store.chords.map((c) => {
    if (c.id !== id) return c;
    const next = change(c);
    if (next === c) return c;
    touched = true;
    return { ...next, updatedAt: Math.max(Date.now(), c.updatedAt + 1) };
  });
  return touched ? { ...store, chords, unsyncedChords: mark(store.unsyncedChords, id) } : store;
}

export function songsReducer(store: SongStore, action: SongsAction): SongStore {
  switch (action.type) {
    case 'HYDRATE': {
      const { merged, toPush, toDelete } = mergeOnSignIn(
        store.songs,
        action.remote,
        action.allowPush,
        store.unsynced,
      );
      // Work set aside the last time a different account used this device.
      // It only fills gaps: anything the account already holds wins, as ever.
      const have = new Set(merged.map((s) => s.id));
      const restored = (action.restored ?? []).filter((s) => !have.has(s.id));

      // Newest first. The account hands songs back in document-id order, which
      // is no order at all, and the Songs screen lists them as they are held.
      const songs = [...merged, ...restored].sort((a, b) => b.updatedAt - a.updatedAt);

      // Keeps the open song open if the merge still has it; falls back rather
      // than pointing at nothing, same as OPEN_SONG's own guard.
      const currentId = songs.some((s) => s.id === store.currentId)
        ? store.currentId
        : (songs[0]?.id ?? null);

      // Exactly what still has to go up. Anything else the old list named is
      // either confirmed by the fetch or belongs to a library now set aside.
      const unsynced = [...toPush.map((s) => s.id), ...toDelete, ...restored.map((s) => s.id)];

      // Each of the other two collections is merged only if the account sent
      // it, and is otherwise left exactly as it was.
      return {
        ...store,
        songs,
        currentId,
        unsynced,
        ...hydratePlaylists(store, action),
        ...hydrateChords(store, action),
      };
    }

    case 'MY_CHORD_SYNCED': {
      if (!store.unsyncedChords.includes(action.id)) return store;
      const chord = store.chords.find((c) => c.id === action.id);
      // Edited again while that write was in flight: still unconfirmed.
      if ((chord?.updatedAt ?? null) !== action.updatedAt) return store;
      return { ...store, unsyncedChords: store.unsyncedChords.filter((id) => id !== action.id) };
    }

    case 'KEEP_CHORD': {
      /* One entry per shape, and never one of the built-in shapes again: the
         rule is here, so no way of keeping a chord can get round it. The
         screens ask `keepOffer` first and say why; this is the backstop. */
      if (!named(action.spec) || keepOffer(store.chords, action.spec) !== 'offer') return store;
      const chord = newMyChord(action.spec, action.id);
      return {
        ...store,
        chords: [chord, ...store.chords],
        unsyncedChords: mark(store.unsyncedChords, chord.id),
      };
    }

    case 'UPDATE_MY_CHORD': {
      // Renaming is always fine. Reshaping it into a built-in, or into another
      // entry, would break the rule `KEEP_CHORD` keeps, so it is refused.
      if (!named(action.spec)) return store;
      if (keepOffer(store.chords, action.spec, action.id) !== 'offer') return store;
      const spec = { ...action.spec, name: cleanChordName(action.spec.name) };
      return editMyChord(store, action.id, (c) =>
        chordChanged(spec, c.spec) ? { ...c, spec } : c,
      );
    }

    case 'DELETE_MY_CHORD': {
      if (!store.chords.some((c) => c.id === action.id)) return store;
      // Songs that use the shape hold their own copy of it, and keep it.
      return {
        ...store,
        chords: store.chords.filter((c) => c.id !== action.id),
        unsyncedChords: mark(store.unsyncedChords, action.id),
      };
    }

    case 'PLAYLIST_SYNCED': {
      if (!store.unsyncedPlaylists.includes(action.id)) return store;
      const playlist = store.playlists.find((p) => p.id === action.id);
      if ((playlist?.updatedAt ?? null) !== action.updatedAt) return store;
      return {
        ...store,
        unsyncedPlaylists: store.unsyncedPlaylists.filter((id) => id !== action.id),
      };
    }

    case 'SYNCED': {
      if (!store.unsynced.includes(action.id)) return store;
      const song = store.songs.find((s) => s.id === action.id);
      // Edited again while that write was in flight: still unconfirmed.
      if ((song?.updatedAt ?? null) !== action.updatedAt) return store;
      return { ...store, unsynced: store.unsynced.filter((id) => id !== action.id) };
    }

    case 'CREATE_SONG': {
      const song = { ...newSong(action.title), ...(action.id ? { id: action.id } : {}) };
      return {
        ...store,
        songs: [song, ...store.songs],
        currentId: song.id,
        unsynced: mark(store.unsynced, song.id),
      };
    }

    case 'OPEN_SONG':
      return { ...store, currentId: action.id };

    case 'DELETE_SONG': {
      if (!store.songs.some((s) => s.id === action.id)) return store;
      const songs = store.songs.filter((s) => s.id !== action.id);
      const currentId =
        store.currentId === action.id ? (songs[0]?.id ?? null) : store.currentId;
      /* The song leaves every playlist in the same step. Done here and not by
         the screen that asked, so no path to a delete can forget it — a
         playlist naming a song that is gone is an entry nobody can open. */
      let swept: SongStore = store;
      for (const p of store.playlists) {
        swept = editPlaylist(swept, p.id, (list) => {
          const items = withoutSong(list.items, action.id);
          return items === list.items ? list : { ...list, items };
        });
      }
      // Stays listed with no song behind it: that is what an unconfirmed
      // delete looks like, and what stops the account's copy resurrecting it.
      return { ...swept, songs, currentId, unsynced: mark(store.unsynced, action.id) };
    }

    case 'DISCARD_IF_BLANK': {
      /* A start card makes its song on the tap, so tapping one to see what it
         does and backing out would leave an "Untitled" with nothing in it. Not
         a shared one — its shared copy is a separate document this cannot
         remove — and not one somebody has put in a playlist, blank or not. */
      const song = store.songs.find((s) => s.id === action.id);
      if (!song || !isBlankSong(song) || song.shared) return store;
      if (store.playlists.some((p) => p.items.some((i) => i.songId === song.id))) return store;
      return songsReducer(store, { type: 'DELETE_SONG', id: song.id });
    }

    case 'SET_TITLE':
      return editSong(store, action.id, (s) => ({ ...s, title: action.title }));

    case 'SET_META':
      return editSong(store, action.id, (s) => ({
        ...s,
        key: action.key ?? s.key,
        feel: action.feel ?? s.feel,
      }));

    case 'SET_CAPO':
      return editSong(store, action.id, (s) => ({ ...s, capo: action.capo }));

    case 'SET_LYRIC':
      return editSong(store, action.id, (s) => {
        if (s.lyric === action.lyric) return s;
        // Ids carry across the edit wherever the text still lines up, which is
        // what keeps already-placed chords attached to their words.
        const words = retokenise(s.words, action.lyric);
        return {
          ...s,
          lyric: action.lyric,
          words,
          placements: prunePlacements(s.placements, words),
        };
      });

    case 'ADD_CHORD': {
      if (!named(action.spec)) return store;
      const spec = trimName(action.spec);
      return editSong(store, action.id, (s) => {
        const chord: SavedChord = { id: action.chordId ?? newId(), spec };
        return { ...s, chords: [...s.chords, chord] };
      });
    }

    case 'UPDATE_CHORD': {
      if (!named(action.spec)) return store;
      const spec = trimName(action.spec);
      return editSong(store, action.id, (s) => {
        /* Saved as it was is no edit. It matters now that a chord is opened
           just to tick "Keep in My chords": a new song object would move
           `updatedAt`, send the song up again, and tell everyone holding a
           copy of a shared one that it had changed. */
        const held = s.chords.find((c) => c.id === action.chordId);
        if (!held || !chordChanged(spec, held.spec)) return s;
        return {
          ...s,
          chords: s.chords.map((c) => (c.id === action.chordId ? { ...c, spec } : c)),
        };
      });
    }

    case 'REMOVE_CHORD':
      return editSong(store, action.id, (s) => {
        const chords = s.chords.filter((c) => c.id !== action.chordId);
        // A placement pointing at a chord that no longer exists would render as
        // a blank slot, so they go with it.
        return {
          ...s,
          chords,
          placements: pruneToChords(
            s.placements,
            chords.map((c) => c.id),
          ),
        };
      });

    case 'REORDER_CHORD':
      return editSong(store, action.id, (s) => {
        const from = s.chords.findIndex((c) => c.id === action.chordId);
        if (from === -1) return s;
        const chords = s.chords.slice();
        const [moved] = chords.splice(from, 1);
        chords.splice(Math.max(0, Math.min(action.to, chords.length)), 0, moved);
        return { ...s, chords };
      });

    case 'PLACE_CHORD':
      return editSong(store, action.id, (s) => {
        const placements = { ...s.placements };
        if (action.chordId === null) delete placements[action.wordId];
        else placements[action.wordId] = action.chordId;
        return { ...s, placements };
      });

    case 'ADOPT_SONG': {
      if (store.songs.some((s) => s.id === action.song.id)) return store;
      /* Whatever arrives, the copy starts unshared: `shared` says *this
         library's* song has a link out, and a song taken a moment ago has not. */
      const song = unshared(action.song);
      return {
        ...store,
        songs: [song, ...store.songs],
        currentId: song.id,
        unsynced: mark(store.unsynced, song.id),
      };
    }

    case 'REPLACE_FROM_SHARE':
      return editSong(store, action.id, (s) => {
        // Only over the copy that was taken from it. Anything else is a bug in
        // the caller, and overwriting the wrong song is not a recoverable one.
        if (s.copiedFrom?.shareId !== action.shared.id) return s;
        /* Built up rather than spread over `s`: the payload leaves `capo` off
           when nobody has answered, and a spread would keep the old answer.
           The id stays, so every playlist holding this song still does. */
        return {
          id: s.id,
          ...action.shared.song,
          ...(s.shared ? { shared: s.shared } : {}),
          copiedFrom: lineageOf(action.shared),
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        };
      });

    case 'STOP_FOLLOWING':
      return editSong(store, action.id, (s) =>
        !s.copiedFrom || s.copiedFrom.follows === false
          ? s
          : { ...s, copiedFrom: { ...s.copiedFrom, follows: false } },
      );

    case 'SONG_SHARED': {
      const song = store.songs.find((s) => s.id === action.id);
      if (!song) return store;
      /* Recording the share is an edit — it has to reach the account, so the
         owner's other devices know — and an edit moves `updatedAt`. So `at`
         moves with it, or every share would read as "changed since" at once.
         But only if what went up is what is here now: an edit made while the
         write was in flight is a real change, and `at` stays behind it. */
      const stamp = Math.max(Date.now(), song.updatedAt + 1);
      const upToDate =
        action.sentUpdatedAt === null
          ? !!song.shared && song.updatedAt <= song.shared.at
          : song.updatedAt === action.sentUpdatedAt;
      const at = upToDate ? stamp : (action.sentUpdatedAt ?? song.shared?.at ?? 0);
      const shared = { shareId: action.shareId, version: action.version, at, listed: action.listed };
      return {
        ...store,
        songs: store.songs.map((s) => (s === song ? { ...s, shared, updatedAt: stamp } : s)),
        unsynced: mark(store.unsynced, song.id),
      };
    }

    case 'SONG_UNSHARED':
      return editSong(store, action.id, (s) => (s.shared ? unshared(s) : s));

    case 'CREATE_PLAYLIST': {
      // A nameless playlist is a blank pill on every song in it, and a second
      // one by the same name is a pill nobody can tell from the first.
      const name = cleanPlaylistName(action.name);
      if (!name || playlistNameTaken(store.playlists, name)) return store;
      const held = new Set(store.songs.map((s) => s.id));
      const playlist = {
        ...newPlaylist(name, (action.songIds ?? []).filter((id) => held.has(id))),
        ...(action.id ? { id: action.id } : {}),
      };
      return {
        ...store,
        playlists: [...store.playlists, playlist],
        unsyncedPlaylists: mark(store.unsyncedPlaylists, playlist.id),
      };
    }

    case 'RENAME_PLAYLIST': {
      const name = cleanPlaylistName(action.name);
      if (!name || playlistNameTaken(store.playlists, name, action.id)) return store;
      return editPlaylist(store, action.id, (p) => (p.name === name ? p : { ...p, name }));
    }

    case 'DELETE_PLAYLIST': {
      if (!store.playlists.some((p) => p.id === action.id)) return store;
      // The songs in it are untouched: a playlist points at songs, it does not own them.
      return {
        ...store,
        playlists: store.playlists.filter((p) => p.id !== action.id),
        unsyncedPlaylists: mark(store.unsyncedPlaylists, action.id),
      };
    }

    case 'ADD_TO_PLAYLIST': {
      // Only songs that exist. The same song twice is allowed — that is what
      // item ids are for — so whether to offer it is the screen's decision.
      const held = new Set(store.songs.map((s) => s.id));
      const adding = action.songIds.filter((id) => held.has(id));
      if (!adding.length) return store;
      return editPlaylist(store, action.id, (p) => ({
        ...p,
        items: [...p.items, ...adding.map(newItem)],
      }));
    }

    case 'REMOVE_FROM_PLAYLIST':
      return editPlaylist(store, action.id, (p) =>
        p.items.some((i) => i.id === action.itemId)
          ? { ...p, items: p.items.filter((i) => i.id !== action.itemId) }
          : p,
      );

    case 'MOVE_PLAYLIST_ITEM':
      return editPlaylist(store, action.id, (p) => {
        const items = moveItem(p.items, action.itemId, action.to);
        return items === p.items ? p : { ...p, items };
      });

    default:
      return store;
  }
}

const isOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine);

/**
 * `uid` is null signed out. Signed in, `localStorage` is still what the UI
 * reads and writes through the reducer — nothing here changes that. A sign-in
 * pulls the account's library down and merges it in (`mergeOnSignIn`, in
 * accountSync.ts), and every local change thereafter is mirrored up.
 *
 * What goes up is driven by `store.unsynced`, not by diffing renders: the
 * reducer lists every id it changes, this sends them, and only the account's
 * own confirmation takes an id off the list. So a write that fails, or never
 * gets an answer because the tab closed, is still on the list at the next
 * load — and is retried then, instead of being silently reverted by "remote
 * wins". Nothing here is fire-and-forget: every call is caught and reported
 * through `sync`, which is what lets the UI say whether it actually worked.
 */
export function useSongs(uid: string | null) {
  const [store, dispatch] = useReducer(songsReducer, undefined, loadStore);
  const [sync, syncDispatch] = useReducer(syncReducer, undefined, () =>
    initialSync(firebaseEnabled, isOnline()),
  );
  /** Bumped to re-run the effects below: by Retry, and by the signal returning. */
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    saveStore(store);
  }, [store]);

  /* For the async continuations below, which outlive the render that started
     them and must not act on the songs, or the account, as they were then. */
  const latest = useRef({ store, uid });
  useEffect(() => {
    latest.current = { store, uid };
  });

  /* What has been sent and not answered, and what was refused — each keyed by
     id against the `updatedAt` that was sent (null for a delete). The same
     stamp in `inflight` means "already on its way"; in `failed` it means "do
     not hammer the database with a write it has just refused". A newer stamp
     is a different piece of work and goes regardless. */
  const inflight = useRef(new Map<string, number | null>());
  const failed = useRef(new Map<string, number | null>());

  const account = firebaseEnabled ? uid : null;

  useEffect(() => {
    inflight.current.clear();
    failed.current.clear();
    syncDispatch({ type: 'account', uid: account });
  }, [account]);

  useEffect(() => {
    const changed = () => {
      const online = isOnline();
      syncDispatch({ type: 'online', online });
      if (online) {
        failed.current.clear();
        setAttempt((n) => n + 1);
      }
    };
    window.addEventListener('online', changed);
    window.addEventListener('offline', changed);
    return () => {
      window.removeEventListener('online', changed);
      window.removeEventListener('offline', changed);
    };
  }, []);

  const hydrated = sync.hydrated && sync.uid === account;

  useEffect(() => {
    if (!account || hydrated) return;
    const uid = account;
    let cancelled = false;

    syncDispatch({ type: 'hydrateStarted', uid });
    void (async () => {
      try {
        const [remote, remotePlaylists, remoteChords] = await Promise.all([
          fetchRemoteSongs(uid),
          fetchRemotePlaylists(uid),
          fetchRemoteMyChords(uid),
        ]);
        if (cancelled) return;

        const previous = lastSyncedUid();
        const allowPush = previous === null || previous === uid;
        if (!allowPush) {
          // Someone else's library is on this device. It is about to be
          // replaced by this account's, so set it aside rather than lose it.
          const here = latest.current.store;
          stashLibrary(previous, mergeOnSignIn(here.songs, remote, false).stranded);
          stashLibrary(
            previous,
            mergeOnSignIn(here.playlists, remotePlaylists, false).stranded,
            'playlists',
          );
          stashLibrary(
            previous,
            mergeOnSignIn(here.chords, remoteChords, false).stranded,
            'chords',
          );
        }
        const restored = takeStash(uid)
          .map(parseSong)
          .filter((song): song is Song => song !== null);
        const restoredPlaylists = takeStash(uid, 'playlists')
          .map(parsePlaylist)
          .filter((p): p is Playlist => p !== null);
        const restoredChords = takeStash(uid, 'chords')
          .map(parseMyChord)
          .filter((c): c is MyChord => c !== null);

        rememberSyncedUid(uid);
        dispatch({
          type: 'HYDRATE',
          remote,
          allowPush,
          restored,
          remotePlaylists,
          restoredPlaylists,
          remoteChords,
          restoredChords,
        });
        syncDispatch({ type: 'hydrateSucceeded', uid });
      } catch (err) {
        if (cancelled) return;
        console.error('Could not load songs from the account', err);
        syncDispatch({ type: 'hydrateFailed', uid, code: errorCode(err) });
      }
    })();

    return () => {
      cancelled = true;
    };
    // Once per sign-in, and again only when asked to (`attempt`) after a
    // failure. `hydrated` is read, not watched: it turning true must not
    // re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, attempt]);

  useEffect(() => {
    // Nothing goes up before the merge: an edit sent ahead of it would
    // overwrite a newer copy the account holds, which the merge exists to weigh.
    if (!account || !hydrated) return;
    const uid = account;

    /* One piece of work per unconfirmed id, whichever collection it is in.
       `key` is what `inflight` and `failed` file it under — prefixed for a
       playlist or a chord so the kinds cannot be mistaken for each other. */
    interface Job {
      key: string;
      stamp: number | null;
      label: string;
      send: () => Promise<void>;
      confirm: () => void;
    }
    const songs = new Map(store.songs.map((s) => [s.id, s] as const));
    const playlists = new Map(store.playlists.map((p) => [p.id, p] as const));
    const chords = new Map(store.chords.map((c) => [c.id, c] as const));
    const jobs: Job[] = [
      ...store.unsynced.map((id): Job => {
        const song = songs.get(id);
        const stamp = song?.updatedAt ?? null;
        return {
          key: id,
          stamp,
          label: song?.title ?? id,
          send: () => (song ? writeSong(uid, song) : deleteRemoteSong(uid, id)),
          confirm: () => dispatch({ type: 'SYNCED', id, updatedAt: stamp }),
        };
      }),
      ...store.unsyncedPlaylists.map((id): Job => {
        const playlist = playlists.get(id);
        const stamp = playlist?.updatedAt ?? null;
        return {
          key: `playlist:${id}`,
          stamp,
          label: playlist?.name ?? id,
          send: () => (playlist ? writePlaylist(uid, playlist) : deleteRemotePlaylist(uid, id)),
          confirm: () => dispatch({ type: 'PLAYLIST_SYNCED', id, updatedAt: stamp }),
        };
      }),
      ...store.unsyncedChords.map((id): Job => {
        const chord = chords.get(id);
        const stamp = chord?.updatedAt ?? null;
        return {
          key: `chord:${id}`,
          stamp,
          label: chord?.spec.name ?? id,
          send: () => (chord ? writeMyChord(uid, chord) : deleteRemoteMyChord(uid, id)),
          confirm: () => dispatch({ type: 'MY_CHORD_SYNCED', id, updatedAt: stamp }),
        };
      }),
    ];

    const work = jobs.filter((job) => inflight.current.get(job.key) !== job.stamp);
    const fresh = work.filter(
      (job) => !failed.current.has(job.key) || failed.current.get(job.key) !== job.stamp,
    );
    // Only refused writes left, and nobody has asked to try again.
    if (!fresh.length) return;

    // Something new is going up anyway, so the refused ones ride along.
    for (const { key, stamp, label, send, confirm } of work) {
      inflight.current.set(key, stamp);
      failed.current.delete(key);
      syncDispatch({ type: 'writeStarted', uid });

      const settle = () => {
        if (inflight.current.get(key) === stamp) inflight.current.delete(key);
      };
      send().then(
        () => {
          settle();
          syncDispatch({ type: 'writeSucceeded', uid });
          // Signed out, or someone else signed in, while it was in flight:
          // the list now describes a different library.
          if (latest.current.uid === uid) confirm();
        },
        (err: unknown) => {
          settle();
          failed.current.set(key, stamp);
          console.error(`Could not save "${label}" to the account`, err);
          syncDispatch({ type: 'writeFailed', uid, code: errorCode(err) });
        },
      );
    }
  }, [
    account,
    hydrated,
    store.songs,
    store.unsynced,
    store.playlists,
    store.unsyncedPlaylists,
    store.chords,
    store.unsyncedChords,
    attempt,
  ]);

  const retry = useCallback(() => {
    failed.current.clear();
    if (account) syncDispatch({ type: 'retry', uid: account });
    setAttempt((n) => n + 1);
  }, [account]);

  const current = useMemo(
    () => store.songs.find((s) => s.id === store.currentId) ?? null,
    [store],
  );

  const unsyncedCount =
    store.unsynced.length + store.unsyncedPlaylists.length + store.unsyncedChords.length;
  const syncView = useMemo<SyncView>(() => {
    const phase = syncPhase(sync, unsyncedCount);
    return {
      phase,
      label: syncLabel(phase, sync.error, unsyncedCount),
      unsynced: unsyncedCount,
      retry,
    };
  }, [sync, unsyncedCount, retry]);

  return {
    store,
    songs: store.songs,
    playlists: store.playlists,
    myChords: store.chords,
    current,
    dispatch,
    sync: syncView,
  };
}
