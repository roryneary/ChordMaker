import { useCallback, useEffect, useRef, useState } from 'react';
import ChordPlate from './components/ChordPlate';
import ChordStrip from './components/ChordStrip';
import NameSheet from './components/NameSheet';
import SongBar from './components/SongBar';
import SongStart from './components/SongStart';
import Toolbar from './components/Toolbar';
import { isEmptySpec, useChordSpec } from './hooks/useChordSpec';
import { useSong } from './hooks/useSong';
import { songFilename, songToPdfBlob } from './lib/exportPdf';
import { chordFilename, chordToPngBlob, downloadBlob } from './lib/exportPng';
import { songPngFilename, songToPngBlob } from './lib/exportSongPng';
import type { SavedChord } from './types/song';

export default function App() {
  const {
    spec,
    dispatch,
    barreMode,
    pendingBarre,
    toggleBarreMode,
    exitBarreMode,
    tapCell,
    tapMarker,
  } = useChordSpec();
  const { song, dispatchSong } = useSong();

  // A song that was restored from storage skips the start screen.
  const [started, setStarted] = useState(
    () => song.title.trim() !== '' || song.chords.length > 0,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [exportKind, setExportKind] = useState<'pdf' | 'png' | null>(null);
  const busy = exportKind !== null;
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const resetEditor = useCallback(() => {
    dispatch({ type: 'CLEAR' });
    exitBarreMode();
    setEditingId(null);
  }, [dispatch, exitBarreMode]);

  const handleCreateSong = useCallback(
    (title: string) => {
      dispatchSong({ type: 'CLEAR_SONG' });
      dispatchSong({ type: 'SET_TITLE', title });
      resetEditor();
      setStarted(true);
    },
    [dispatchSong, resetEditor],
  );

  const handleNewSong = useCallback(() => {
    if (
      song.chords.length > 0 &&
      !window.confirm(`Start a new song? "${song.title.trim() || 'This song'}" and its chords will be cleared.`)
    ) {
      return;
    }
    dispatchSong({ type: 'CLEAR_SONG' });
    resetEditor();
    setStarted(false);
  }, [song, dispatchSong, resetEditor]);

  const handleSave = useCallback(
    (name: string) => {
      const named = { ...spec, name };
      const label = name.trim() || 'chord';
      if (editingId) {
        dispatchSong({ type: 'UPDATE_CHORD', id: editingId, spec: named });
        showToast(`Updated ${label}`);
      } else {
        dispatchSong({ type: 'ADD_CHORD', spec: named });
        showToast(`Added ${label}`);
      }
      setSheetOpen(false);
      resetEditor();
    },
    [spec, editingId, dispatchSong, showToast, resetEditor],
  );

  const handleEdit = useCallback(
    (chord: SavedChord) => {
      dispatch({ type: 'LOAD', spec: chord.spec });
      exitBarreMode();
      setEditingId(chord.id);
    },
    [dispatch, exitBarreMode],
  );

  const handleDownloadPng = useCallback(
    async (chord: SavedChord) => {
      try {
        const blob = await chordToPngBlob(chord.spec);
        const filename = chordFilename(chord.spec.name);
        downloadBlob(blob, filename);
        showToast(`Saved ${filename}`);
      } catch (err) {
        console.error(err);
        showToast('Could not save the PNG.');
      }
    },
    [showToast],
  );

  const handleRemove = useCallback(
    (chord: SavedChord) => {
      dispatchSong({ type: 'REMOVE_CHORD', id: chord.id });
      if (chord.id === editingId) resetEditor();
    },
    [dispatchSong, editingId, resetEditor],
  );

  const handleDownloadPdf = useCallback(async () => {
    setExportKind('pdf');
    try {
      const blob = await songToPdfBlob(song);
      const filename = songFilename(song.title);
      downloadBlob(blob, filename);
      showToast(`Saved ${filename}`);
    } catch (err) {
      console.error(err);
      showToast('Could not build the PDF.');
    } finally {
      setExportKind(null);
    }
  }, [song, showToast]);

  const handleDownloadSongPng = useCallback(async () => {
    setExportKind('png');
    try {
      const blob = await songToPngBlob(song);
      const filename = songPngFilename(song.title);
      downloadBlob(blob, filename);
      showToast(`Saved ${filename}`);
    } catch (err) {
      console.error(err);
      showToast('Could not build the image.');
    } finally {
      setExportKind(null);
    }
  }, [song, showToast]);

  if (!started) {
    return (
      <div className="app">
        <header className="app-header">
          <h1>Chord diagram builder</h1>
        </header>
        <main className="app-main app-main-start">
          <SongStart onCreate={handleCreateSong} />
        </main>
      </div>
    );
  }

  const canExport = !isEmptySpec(spec);

  return (
    <div className="app">
      <header className="app-header">
        <SongBar
          title={song.title}
          chordCount={song.chords.length}
          exportingPdf={exportKind === 'pdf'}
          exportingPng={exportKind === 'png'}
          onTitle={(title) => dispatchSong({ type: 'SET_TITLE', title })}
          onDownloadPdf={handleDownloadPdf}
          onDownloadPng={handleDownloadSongPng}
          onNewSong={handleNewSong}
        />
        <ChordStrip
          chords={song.chords}
          editingId={editingId}
          onEdit={handleEdit}
          onDownload={handleDownloadPng}
          onRemove={handleRemove}
        />
      </header>

      <main className="app-main">
        <ChordPlate
          spec={spec}
          pendingBarre={pendingBarre}
          barreMode={barreMode}
          onTapCell={tapCell}
          onTapMarker={tapMarker}
        />
      </main>

      <div className="footer">
        <div className={`toast${toast ? ' is-visible' : ''}`} role="status" aria-live="polite">
          {toast}
        </div>
        <Toolbar
          rootFret={spec.rootFret}
          barreMode={barreMode}
          canExport={canExport}
          exportLabel={editingId ? 'Update chord' : 'Add chord'}
          onRootFret={(n) => dispatch({ type: 'SET_ROOT_FRET', rootFret: n })}
          onToggleBarre={toggleBarreMode}
          onClear={resetEditor}
          onExport={() => setSheetOpen(true)}
        />
      </div>

      {sheetOpen && (
        <NameSheet
          initialName={spec.name}
          busy={busy}
          saveLabel={editingId ? 'Update chord' : 'Add to song'}
          onCancel={() => setSheetOpen(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
