import { useCallback, useEffect, useState } from 'react';
import AppShell, { libraryIsStep } from './components/shell/AppShell';
import ChordEditor from './screens/ChordEditor';
import FullScreen from './screens/FullScreen';
import Landing from './screens/Landing';
import Library from './screens/Library';
import Ready from './screens/Ready';
import SongScreen from './screens/SongScreen';
import Splash from './screens/Splash';
import WordsEditor from './screens/WordsEditor';
import { type Route, useRoute } from './app/routes';
import { useSplash } from './app/splash';
import { named, useSongs } from './hooks/useSongs';
import { findLibraryChord, libraryChordToSpec } from './data/chordLibrary';
import { newId } from './lib/id';
import { downloadBlob } from './lib/exportPng';
import { songFilename, songToPdfBlob } from './lib/exportPdf';
import { loadUserChords, saveUserChords } from './lib/storage';
import { ThemeProvider } from './theme/ThemeProvider';
import type { ChordSpec } from './types/chord';
import type { Song } from './types/song';

function Router() {
  const { route, stack, go, replace, back, reset, canGoBack } = useRoute();
  const { store, songs, current, dispatch } = useSongs();
  const [printing, setPrinting] = useState(false);
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

  const songFor = (id: string | null): Song | null => songs.find((s) => s.id === id) ?? null;

  /** Chord names live on the chord, so a placement only carries its id. */
  const namerFor = useCallback(
    (song: Song) => (chordId: string) =>
      song.chords.find((c) => c.id === chordId)?.spec.name.trim() || null,
    [],
  );

  /** "Just one chord" belongs to no song — it goes to the user's own shapes. */
  const saveLooseChord = useCallback((spec: ChordSpec) => {
    // Same rule as the songs reducer: nothing nameless gets stored.
    if (!named(spec)) return;
    const trimmed = { ...spec, name: spec.name.trim() };
    saveUserChords([...loadUserChords(), { id: newId(), spec: trimmed }]);
  }, []);

  const startSong = useCallback(() => {
    // The id is minted here rather than in the reducer so we can navigate to
    // the song we just created.
    const id = newId();
    dispatch({ type: 'CREATE_SONG', title: '', id });
    go({ name: 'words', songId: id });
  }, [dispatch, go]);

  const print = useCallback(
    async (song: Song) => {
      setPrinting(true);
      try {
        const blob = await songToPdfBlob(song, namerFor(song));
        downloadBlob(blob, songFilename(song.title));
      } catch (err) {
        console.error(err);
      } finally {
        setPrinting(false);
      }
    },
    [namerFor],
  );

  const landing = (
    <Landing
      songs={songs}
      onNewSong={startSong}
      onOneChord={() => go({ name: 'chordEditor', songId: null, chordId: null })}
      onResume={(songId) => go({ name: 'song', songId })}
    />
  );

  const screen = () => {
    switch (route.name) {
      case 'landing':
        return landing;

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
        const editing = song?.chords.find((c) => c.id === route.chordId) ?? null;
        return (
          <ChordEditor
            songTitle={song?.title.trim() || null}
            initial={picked ?? editing?.spec ?? null}
            onBrowseAll={() => go({ name: 'library' })}
            onCancel={() => {
              setPicked(null);
              if (song) replace({ name: 'song', songId: song.id });
              else reset();
            }}
            onSave={(spec) => {
              setPicked(null);
              if (!song) {
                saveLooseChord(spec);
                reset();
                return;
              }
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
            printing={printing}
            onPrint={() => print(song)}
            onClose={back}
          />
        );
      }

      case 'song': {
        const song = songFor(route.songId) ?? current;
        if (!song) return landing;
        return (
          <SongScreen
            song={song}
            nameOf={namerFor(song)}
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
          />
        );
      }
    }
  };

  const onGo = useCallback((next: Route) => go(next), [go]);

  return (
    <AppShell
      route={route}
      previous={stack[stack.length - 2]}
      songs={songs}
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
