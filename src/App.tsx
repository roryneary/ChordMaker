import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppShell, { libraryIsStep } from './components/shell/AppShell';
import ChordEditor from './screens/ChordEditor';
import FullScreen from './screens/FullScreen';
import Landing from './screens/Landing';
import Library from './screens/Library';
import PlaylistAdd from './screens/PlaylistAdd';
import PlaylistScreen from './screens/PlaylistScreen';
import Playlists from './screens/Playlists';
import Ready from './screens/Ready';
import SongScreen from './screens/SongScreen';
import SharedLibrary from './screens/SharedLibrary';
import SharedSongScreen from './screens/SharedSongScreen';
import SignIn from './screens/SignIn';
import Songs from './screens/Songs';
import Splash from './screens/Splash';
import WordsEditor from './screens/WordsEditor';
import { type Route, openSongId, useRoute } from './app/routes';
import { useSplash } from './app/splash';
import { useSongs } from './hooks/useSongs';
import { useRecent } from './hooks/useRecent';
import { useAuth } from './hooks/useAuth';
import { useSharing } from './hooks/useSharing';
import { useSharedUpdates } from './hooks/useSharedUpdates';
import { membershipBySong } from './lib/playlists';
import { recentSongs } from './lib/recent';
import { firebaseEnabled } from './lib/firebase';
import { songFromShare } from './lib/sharedSong';
import type { SharedSong } from './types/sharedSong';
import { newId } from './lib/id';
import { chordFilename, chordToPngBlob, downloadBlob } from './lib/exportPng';
import { songFilename, songToPdfBlob } from './lib/exportPdf';
import { chordSheetFilename, songChordsToPngBlob } from './lib/exportChordSheet';
import { type ExportJob, copyPng, shareFile } from './lib/share';
import { ThemeProvider } from './theme/ThemeProvider';
import type { ChordSpec } from './types/chord';
import type { Song } from './types/song';

/** How many recent songs the home screen offers, and the sidebar under its nav. */
const RECENT_SHOWN = 4;

function Router() {
  const { route, stack, go, replace, back, canGoBack } = useRoute();
  const auth = useAuth();
  const { store, songs, playlists, myChords, current, dispatch, sync } = useSongs(
    auth.account?.uid ?? null,
  );
  const { sharingFor } = useSharing(auth.account, dispatch);
  const { updateFor } = useSharedUpdates(songs, 'songId' in route ? route.songId : null);
  const [busy, setBusy] = useState<ExportJob | null>(null);
  /* The playlist entry to pick out on arrival, when the way in was a song's
     pill. Not in the route: it describes one arrival, and a hash carrying it
     would pick the row out again on every reload and every Back. */
  const [arriveAt, setArriveAt] = useState<string | null>(null);
  const arrived = useCallback(() => setArriveAt(null), []);
  /* A shape taken from the library, waiting for the editor we came from to
     pick it up. Cleared as soon as the editor is finished with. */
  const [picked, setPicked] = useState<ChordSpec | null>(null);
  /* Both editors clear it on the way out by their own buttons, but the sidebar
     is a way out too, and a shape left waiting would turn up in the next chord
     opened — in either editor, now there are two. */
  const pickInPlay =
    route.name === 'chordEditor' || route.name === 'myChord' || route.name === 'library';
  // Reset while rendering rather than in an effect: nothing draws the stale one.
  if (!pickInPlay && picked) setPicked(null);

  // The route names the song; the store's currentId has to follow it, or the
  // sidebar would highlight one song while the pane shows another.
  const routedSongId = 'songId' in route ? route.songId : null;
  useEffect(() => {
    if (routedSongId && routedSongId !== store.currentId) {
      dispatch({ type: 'OPEN_SONG', id: routedSongId });
    }
  }, [routedSongId, store.currentId, dispatch]);

  /* Opening a song, to write it or to play it, is what makes it recent. Kept
     beside the store rather than in the song: see `lib/recent.ts`. */
  const { recent, opened } = useRecent();
  useEffect(() => {
    if (routedSongId) opened(routedSongId);
  }, [routedSongId, opened]);
  const recentlyOpened = useMemo(() => recentSongs(songs, recent, RECENT_SHOWN), [songs, recent]);

  /* An account without a handle is a half-finished sign-in: nothing can be
     shared from it, because a shared song names its sender. So the claim step
     follows the user until it is done, wherever they landed. */
  useEffect(() => {
    if (auth.needsHandle && route.name !== 'signIn') go({ name: 'signIn' });
  }, [auth.needsHandle, route.name, go]);

  /* The song being deleted from its own screen. The route still names it once
     it is gone, and a song route with no song falls back to whichever song is
     current — so without this, deleting a song would quietly show you another
     one. Watched rather than done on the tap, because a shared song's delete
     waits on the database and may be refused, in which case we stay put. */
  const [leavingId, setLeavingId] = useState<string | null>(null);
  useEffect(() => {
    // Never cleared: once the route has moved on it can no longer match.
    if (!leavingId || routedSongId !== leavingId) return;
    if (!songs.some((s) => s.id === leavingId)) replace({ name: 'songs' });
  }, [leavingId, songs, routedSongId, replace]);

  /* Walking out of a song that still has nothing in it throws it away — the
     rule is the reducer's (DISCARD_IF_BLANK); this only says when. */
  const openId = openSongId(stack);
  const wasOpen = useRef<string | null>(null);
  useEffect(() => {
    const left = wasOpen.current;
    wasOpen.current = openId;
    if (left && left !== openId) dispatch({ type: 'DISCARD_IF_BLANK', id: left });
  }, [openId, dispatch]);

  const songFor = (id: string | null): Song | null => songs.find((s) => s.id === id) ?? null;

  /** Chord names live on the chord, so a placement only carries its id. */
  const namerFor = useCallback(
    (song: Song) => (chordId: string) =>
      song.chords.find((c) => c.id === chordId)?.spec.name.trim() || null,
    [],
  );

  /**
   * The one way to start. It lands on the song screen, not the words editor:
   * that screen focuses the title of a song with nothing in it and offers both
   * halves — the add-chord tile and "Paste the words in" — so it serves the
   * player with the words in hand and the one whose tutor is calling out
   * chords, without asking either to say which they are first. There were two
   * ways in, differing only in which screen came next.
   */
  const startSong = useCallback(() => {
    // The id is minted here rather than in the reducer so we can navigate to
    // the song we just created.
    const id = newId();
    dispatch({ type: 'CREATE_SONG', title: '', id });
    go({ name: 'song', songId: id });
  }, [dispatch, go]);

  /**
   * "Keep this song". The copy is made here and is theirs from this line on —
   * a new id, in this library, with or without an account. `replace`, so Back
   * from their new song does not return to an offer they have already taken.
   */
  const keepShared = useCallback(
    (shared: SharedSong) => {
      const id = newId();
      dispatch({ type: 'ADOPT_SONG', song: songFromShare(shared, id) });
      replace({ name: 'song', songId: id });
    },
    [dispatch, replace],
  );

  /** One export at a time, its failure logged rather than thrown at the screen. */
  const run = useCallback((job: ExportJob, work: () => Promise<void>) => {
    setBusy(job);
    work()
      .catch((err) => console.error(err))
      .finally(() => setBusy(null));
  }, []);

  const print = useCallback(
    (song: Song) =>
      run('print', async () => {
        const blob = await songToPdfBlob(song, namerFor(song));
        downloadBlob(blob, songFilename(song.title));
      }),
    [run, namerFor],
  );

  const saveChordsImage = useCallback(
    (song: Song) =>
      run('image', async () => {
        downloadBlob(await songChordsToPngBlob(song), chordSheetFilename(song.title));
      }),
    [run],
  );

  /** The phone's share sheet, which is the short way into a chat. */
  const shareChords = useCallback(
    (song: Song) =>
      run('share', async () => {
        const blob = await songChordsToPngBlob(song);
        const file = new File([blob], chordSheetFilename(song.title), { type: 'image/png' });
        const outcome = await shareFile(file, song.title.trim() || 'Chords');
        // Refused after all: the picture is made, so hand it over the other way.
        if (outcome === 'unsupported') downloadBlob(blob, file.name);
      }),
    [run],
  );

  /* The same three, for one shape: what the Chords tab offers on a chord. */
  const saveChordImage = useCallback(
    (spec: ChordSpec) =>
      run('image', async () => {
        downloadBlob(await chordToPngBlob(spec), chordFilename(spec.name));
      }),
    [run],
  );
  const shareChord = useCallback(
    (spec: ChordSpec) =>
      run('share', async () => {
        const blob = await chordToPngBlob(spec);
        const file = new File([blob], chordFilename(spec.name), { type: 'image/png' });
        const outcome = await shareFile(file, spec.name.trim() || 'Chord');
        if (outcome === 'unsupported') downloadBlob(blob, file.name);
      }),
    [run],
  );
  const copyChord = useCallback(
    // The promise, not the picture — see copyPng for why that matters to Safari.
    (spec: ChordSpec) => run('copy', () => copyPng(chordToPngBlob(spec))),
    [run],
  );

  const copyChords = useCallback(
    // The promise, not the picture — see copyPng for why that matters to Safari.
    (song: Song) => run('copy', () => copyPng(songChordsToPngBlob(song))),
    [run],
  );

  const landing = (
    <Landing
      recent={recentlyOpened}
      songCount={songs.length}
      onStart={startSong}
      onResume={(songId) => go({ name: 'song', songId })}
      onAllSongs={() => go({ name: 'songs' })}
      onFindShared={() => go({ name: 'shared' })}
      /* Offered to someone with no songs here, who may have plenty elsewhere. */
      onSignIn={firebaseEnabled && !auth.user ? () => go({ name: 'signIn' }) : undefined}
    />
  );

  /* Also what a playlist route falls back to, as `landing` is for a song's:
     the playlist was deleted, or the link names one this device never had. */
  const allPlaylists = (
    <Playlists
      playlists={playlists}
      songs={songs}
      onOpen={(playlistId) => {
        setArriveAt(null);
        go({ name: 'playlist', playlistId });
      }}
      onCreate={(name) => {
        // Minted here, like a song's, so we can go straight into it.
        const id = newId();
        dispatch({ type: 'CREATE_PLAYLIST', name, id });
        setArriveAt(null);
        go({ name: 'playlist', playlistId: id });
      }}
    />
  );

  /* Also what a `myChord` route falls back to, as `allPlaylists` is for a
     playlist's: the chord was deleted, or the link names one never kept here. */
  const library = () => {
    // A step when there is an editor underneath to hand a shape back to;
    // otherwise a place, where chords are made, opened and sent. That includes
    // the desktop sidebar's way in from a song screen: only an editor
    // underneath withholds it, since that would be one editor on another.
    const from = stack[stack.length - 2];
    const forEditor = from?.name === 'chordEditor' || from?.name === 'myChord';
    return (
      <Library
        mine={myChords}
        /* Back belongs to the library-as-step. Reached from the Chords tab
           it is a destination, the tab bar is the way out, and a Back
           button there only ever lands you on the home page. */
        onBack={libraryIsStep(from) && canGoBack ? back : undefined}
        onPick={
          forEditor
            ? (spec) => {
                setPicked(spec);
                back();
              }
            : undefined
        }
        place={
          forEditor
            ? undefined
            : {
                onMake: () => go({ name: 'myChord', chordId: null }),
                onEditMine: (chordId) => go({ name: 'myChord', chordId }),
                onDeleteMine: (chordId) => dispatch({ type: 'DELETE_MY_CHORD', id: chordId }),
                busy,
                onShare: shareChord,
                onSaveImage: saveChordImage,
                onCopy: copyChord,
              }
        }
      />
    );
  };

  const screen = () => {
    switch (route.name) {
      case 'landing':
        return landing;

      case 'songs':
        return (
          <Songs
            songs={songs}
            playlists={playlists}
            onOpen={(songId) => go({ name: 'song', songId })}
            onOpenPlaylist={({ playlistId, itemId }) => {
              setArriveAt(itemId);
              go({ name: 'playlist', playlistId });
            }}
            onAddToPlaylist={(id, songId) =>
              dispatch({ type: 'ADD_TO_PLAYLIST', id, songIds: [songId] })
            }
            onCreatePlaylist={(name, songId) =>
              dispatch({ type: 'CREATE_PLAYLIST', name, songIds: [songId] })
            }
            onStart={startSong}
            onFindShared={() => go({ name: 'shared' })}
            updateFor={updateFor}
            sharingFor={sharingFor}
            onSignIn={() => go({ name: 'signIn' })}
          />
        );

      case 'playlists':
        return allPlaylists;

      case 'playlist': {
        const playlist = playlists.find((p) => p.id === route.playlistId);
        // Deleted, or a link to one this device has never had.
        if (!playlist) return allPlaylists;
        return (
          <PlaylistScreen
            key={playlist.id}
            playlist={playlist}
            playlists={playlists}
            songs={songs}
            arriveAt={arriveAt}
            onArrived={arrived}
            onBack={canGoBack ? back : undefined}
            onOpenSong={(songId) => go({ name: 'song', songId })}
            onAddSongs={() => go({ name: 'playlistAdd', playlistId: playlist.id })}
            onRename={(name) => dispatch({ type: 'RENAME_PLAYLIST', id: playlist.id, name })}
            onDelete={() => {
              dispatch({ type: 'DELETE_PLAYLIST', id: playlist.id });
              replace({ name: 'playlists' });
            }}
            onMove={(itemId, to) =>
              dispatch({ type: 'MOVE_PLAYLIST_ITEM', id: playlist.id, itemId, to })
            }
            onRemove={(itemId) =>
              dispatch({ type: 'REMOVE_FROM_PLAYLIST', id: playlist.id, itemId })
            }
          />
        );
      }

      case 'playlistAdd': {
        const playlist = playlists.find((p) => p.id === route.playlistId);
        if (!playlist) return allPlaylists;
        return (
          <PlaylistAdd
            playlist={playlist}
            songs={songs}
            onAdd={(songIds) => {
              dispatch({ type: 'ADD_TO_PLAYLIST', id: playlist.id, songIds });
              back();
            }}
            onBack={back}
          />
        );
      }

      case 'signIn':
        return (
          <SignIn
            needsHandle={auth.needsHandle}
            account={auth.account}
            sync={sync}
            onSignOut={auth.signOut}
            songCount={songs.length}
            /* `replace`: Back from Songs should not land on the account again. */
            onOpenSongs={() => replace({ name: 'songs' })}
            suggestFrom={auth.user?.displayName ?? auth.user?.email ?? null}
            onClaim={auth.claimHandle}
            onDone={back}
            onCancel={back}
          />
        );

      case 'library':
        return library();

      case 'myChord': {
        const editing = myChords.find((c) => c.id === route.chordId) ?? null;
        // Deleted, or a link to one this device has never had.
        if (route.chordId && !editing) return library();
        const toLibrary = () => {
          setPicked(null);
          // `replace`, which pops onto the library underneath when there is one.
          replace({ name: 'library' });
        };
        return (
          <ChordEditor
            key={`mine:${route.chordId ?? 'new'}`}
            where={editing ? 'One of my chords' : 'A chord of your own'}
            initial={picked ?? editing?.spec ?? null}
            saved={editing?.spec ?? null}
            mine={myChords}
            target={{ kind: 'mine', id: editing?.id ?? null }}
            onBrowseAll={() => go({ name: 'library' })}
            onCancel={toLibrary}
            onSave={(spec) => {
              if (editing) dispatch({ type: 'UPDATE_MY_CHORD', id: editing.id, spec });
              else dispatch({ type: 'KEEP_CHORD', spec });
              toLibrary();
            }}
          />
        );
      }

      case 'chordEditor': {
        const song = songFor(route.songId);
        if (!song) return landing;
        const editing = song.chords.find((c) => c.id === route.chordId) ?? null;
        const title = song.title.trim();
        const adding = title ? `Adding to ${title}` : 'Adding a chord';
        return (
          <ChordEditor
            /* Keyed, as the one above is: both sit at the same place in the
               tree, and a hop between them by hash would carry one chord's
               typed name into the other. */
            key={`song:${song.id}:${route.chordId ?? 'new'}`}
            where={song.chords.length > 0 ? `${adding} · ${song.chords.length} in` : adding}
            initial={picked ?? editing?.spec ?? null}
            saved={editing?.spec ?? null}
            mine={myChords}
            target={{ kind: 'song', keepByDefault: !editing }}
            onBrowseAll={() => go({ name: 'library' })}
            onCancel={() => {
              setPicked(null);
              replace({ name: 'song', songId: song.id });
            }}
            onSave={(spec, keep) => {
              setPicked(null);
              if (editing) {
                dispatch({ type: 'UPDATE_CHORD', id: song.id, chordId: editing.id, spec });
              } else {
                dispatch({ type: 'ADD_CHORD', id: song.id, spec });
              }
              // A copy, the other way: the song's chord and the kept one are
              // separate from here on. The reducer refuses what cannot be kept.
              if (keep) dispatch({ type: 'KEEP_CHORD', spec });
              replace({ name: 'song', songId: song.id });
            }}
          />
        );
      }

      case 'words': {
        const song = songFor(route.songId) ?? current;
        if (!song) return landing;
        return (
          <WordsEditor
            song={song}
            nameOf={namerFor(song)}
            sync={sync}
            onChange={(lyric) => dispatch({ type: 'SET_LYRIC', id: song.id, lyric })}
            onTitle={(title) => dispatch({ type: 'SET_TITLE', id: song.id, title })}
            /* Finishing the words is a step forward when the song is new, so
               the editor stays underneath and its Back arrow can reach it. Come
               here from the song itself and it is a return trip instead. */
            onDone={() => {
              const under = stack[stack.length - 2];
              if (under?.name === 'song' && under.songId === song.id) back();
              else go({ name: 'song', songId: song.id });
            }}
            onBack={back}
          />
        );
      }

      case 'fullScreen': {
        const song = songFor(route.songId) ?? current;
        if (!song) return landing;
        // Exit returns to the previous screen, not to the landing page.
        return <FullScreen song={song} nameOf={namerFor(song)} onExit={back} />;
      }

      case 'ready': {
        const song = songFor(route.songId) ?? current;
        if (!song) return landing;
        return (
          <Ready
            song={song}
            nameOf={namerFor(song)}
            busy={busy}
            onPrint={() => print(song)}
            onShareChords={() => shareChords(song)}
            onSaveChordsImage={() => saveChordsImage(song)}
            onCopyChords={() => copyChords(song)}
            sharing={{ ...sharingFor(song), onSignIn: () => go({ name: 'signIn' }) }}
            onClose={back}
          />
        );
      }

      case 'sharedSong':
        return (
          <SharedSongScreen
            key={route.shareId}
            shareId={route.shareId}
            songs={songs}
            onKeep={keepShared}
            onOpenSong={(songId) => replace({ name: 'song', songId })}
            onBack={back}
          />
        );

      case 'shared':
        return (
          <SharedLibrary
            signedIn={auth.signedIn}
            songs={songs}
            onOpen={(shareId) => go({ name: 'sharedSong', shareId })}
            onSignIn={() => go({ name: 'signIn' })}
          />
        );

      case 'song': {
        const song = songFor(route.songId) ?? current;
        if (!song) return landing;
        return (
          <SongScreen
            song={song}
            nameOf={namerFor(song)}
            sync={sync}
            onBack={back}
            onAddChord={() => go({ name: 'chordEditor', songId: song.id, chordId: null })}
            onEditChord={(chordId) => go({ name: 'chordEditor', songId: song.id, chordId })}
            onEditWords={() => go({ name: 'words', songId: song.id })}
            onFullScreen={() => go({ name: 'fullScreen', songId: song.id })}
            onReady={() => go({ name: 'ready', songId: song.id })}
            onCapo={(capo) => dispatch({ type: 'SET_CAPO', id: song.id, capo })}
            onTitle={(title) => dispatch({ type: 'SET_TITLE', id: song.id, title })}
            onPlace={(wordId, chordId) =>
              dispatch({ type: 'PLACE_CHORD', id: song.id, wordId, chordId })
            }
            update={updateFor(song)}
            onReplaceMine={(shared) =>
              dispatch({ type: 'REPLACE_FROM_SHARE', id: song.id, shared })
            }
            /* Mine goes its own way first, then theirs arrives beside it. The
               player stays where they are: they chose to keep this one, and
               the new one is at the top of Songs when they want it. */
            onKeepMine={(shared) => {
              dispatch({ type: 'STOP_FOLLOWING', id: song.id });
              dispatch({ type: 'ADOPT_SONG', song: songFromShare(shared, newId()) });
            }}
            sharing={sharingFor(song)}
            memberships={membershipBySong(playlists).get(song.id) ?? []}
            onDelete={() => {
              setLeavingId(song.id);
              sharingFor(song).onDelete();
            }}
          />
        );
      }
    }
  };

  const onGo = useCallback((next: Route) => go(next), [go]);

  return (
    <AppShell
      account={auth.account}
      sync={sync}
      onAccount={() => go({ name: 'signIn' })}
      onSignOut={auth.signOut}
      route={route}
      previous={stack[stack.length - 2]}
      songs={songs}
      recent={recentlyOpened}
      playlistCount={playlists.length}
      myChordCount={myChords.length}
      currentId={store.currentId}
      onGo={onGo}
      onStart={startSong}
    >
      {screen()}
    </AppShell>
  );
}

export default function App() {
  const { phase, skip } = useSplash();

  return (
    <ThemeProvider>
      {/* The app is mounted and laid out from the first frame, behind the
          splash rather than after it: a crossfade needs both halves moving at
          once, and a home screen that only began rendering when the splash
          left would arrive a beat late. */}
      <div className={`app-root${phase === 'hold' ? ' is-veiled' : ''}`}>
        <Router />
      </div>
      {phase !== 'gone' && <Splash leaving={phase !== 'hold'} onSkip={skip} />}
    </ThemeProvider>
  );
}
