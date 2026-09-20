import { useCallback, useEffect, useState } from 'react';
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
import { type Route, useRoute } from './app/routes';
import { useSplash } from './app/splash';
import { useSongs } from './hooks/useSongs';
import { useAuth } from './hooks/useAuth';
import { useSharing } from './hooks/useSharing';
import { useSharedUpdates } from './hooks/useSharedUpdates';
import { membershipBySong } from './lib/playlists';
import { songFromShare } from './lib/sharedSong';
import type { SharedSong } from './types/sharedSong';
import { findLibraryChord, libraryChordToSpec } from './data/chordLibrary';
import { newId } from './lib/id';
import { downloadBlob } from './lib/exportPng';
import { songFilename, songToPdfBlob } from './lib/exportPdf';
import { chordSheetFilename, songChordsToPngBlob } from './lib/exportChordSheet';
import { type ExportJob, copyPng, shareFile } from './lib/share';
import { ThemeProvider } from './theme/ThemeProvider';
import type { ChordSpec } from './types/chord';
import type { Song } from './types/song';

function Router() {
  const { route, stack, go, replace, back, canGoBack } = useRoute();
  const auth = useAuth();
  const { store, songs, playlists, current, dispatch, sync } = useSongs(
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

  // The route names the song; the store's currentId has to follow it, or the
  // sidebar would highlight one song while the pane shows another.
  const routedSongId = 'songId' in route ? route.songId : null;
  useEffect(() => {
    if (routedSongId && routedSongId !== store.currentId) {
      dispatch({ type: 'OPEN_SONG', id: routedSongId });
    }
  }, [routedSongId, store.currentId, dispatch]);

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

  const songFor = (id: string | null): Song | null => songs.find((s) => s.id === id) ?? null;

  /** Chord names live on the chord, so a placement only carries its id. */
  const namerFor = useCallback(
    (song: Song) => (chordId: string) =>
      song.chords.find((c) => c.id === chordId)?.spec.name.trim() || null,
    [],
  );

  const startSong = useCallback(() => {
    // The id is minted here rather than in the reducer so we can navigate to
    // the song we just created.
    const id = newId();
    dispatch({ type: 'CREATE_SONG', title: '', id });
    go({ name: 'words', songId: id });
  }, [dispatch, go]);

  /**
   * "Just the chords": the name, the capo and the shapes, as fast as a tutor
   * can call them out. It is a song from the first tap — there is no loose
   * chord to convert later — so it skips the words and lands on the song
   * screen, where those three things are. The words can wait.
   */
  const startChordsOnly = useCallback(() => {
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

  const copyChords = useCallback(
    // The promise, not the picture — see copyPng for why that matters to Safari.
    (song: Song) => run('copy', () => copyPng(songChordsToPngBlob(song))),
    [run],
  );

  const landing = (
    <Landing
      songs={songs}
      onNewSong={startSong}
      onJustChords={startChordsOnly}
      onResume={(songId) => go({ name: 'song', songId })}
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
            onNewSong={startSong}
            onJustChords={startChordsOnly}
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

      case 'library': {
        // Only offer selection when there is an editor underneath to return to.
        const from = stack[stack.length - 2];
        const forEditor = from?.name === 'chordEditor';
        return (
          <Library
            /* Back belongs to the library-as-step. Reached from the Chords tab
               it is a destination, the tab bar is the way out, and a Back
               button there only ever lands you on the home page. */
            onBack={libraryIsStep(from) && canGoBack ? back : undefined}
            onPick={
              forEditor
                ? (name) => {
                    const chord = findLibraryChord(name);
                    if (chord) setPicked(libraryChordToSpec(chord));
                    back();
                  }
                : undefined
            }
          />
        );
      }

      case 'chordEditor': {
        const song = songFor(route.songId);
        if (!song) return landing;
        const editing = song.chords.find((c) => c.id === route.chordId) ?? null;
        return (
          <ChordEditor
            songTitle={song.title.trim() || null}
            initial={picked ?? editing?.spec ?? null}
            saved={editing?.spec ?? null}
            chordCount={song.chords.length}
            onBrowseAll={() => go({ name: 'library' })}
            onCancel={() => {
              setPicked(null);
              replace({ name: 'song', songId: song.id });
            }}
            onSave={(spec) => {
              setPicked(null);
              if (editing) {
                dispatch({ type: 'UPDATE_CHORD', id: song.id, chordId: editing.id, spec });
              } else {
                dispatch({ type: 'ADD_CHORD', id: song.id, spec });
              }
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
      playlistCount={playlists.length}
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
