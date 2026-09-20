import { useCallback, useEffect, useState } from 'react';
import { CaretLeft, DownloadSimple } from '@phosphor-icons/react';
import ChordPlate from '../components/ChordPlate';
import { emptySpec, useChordSpec } from '../hooks/useChordSpec';
import { COMMON_NAMES, findLibraryChord, libraryChordToSpec } from '../data/chordLibrary';
import { chordChanged } from '../lib/chordEdits';
import { inferChordName } from '../lib/chordName';
import { chordFilename, chordToPngBlob, downloadBlob } from '../lib/exportPng';
import { MAX_ROOT_FRET, MIN_ROOT_FRET } from '../lib/layout';
import { ordinal, toRoman } from '../lib/numerals';
import { specToShape } from '../lib/shape';
import { useThemeValue } from '../theme/ThemeProvider';
import type { ChordSpec, StringNumber } from '../types/chord';

interface Props {
  /** The song this chord belongs to. Null only while it has no name yet. */
  songTitle: string | null;
  /** How many chords the song already has, so the bar can keep count. */
  chordCount: number;
  initial: ChordSpec | null;
  /** The chord as the song holds it, or null for a new one — what "unsaved" is measured against. */
  saved: ChordSpec | null;
  onSave: (spec: ChordSpec) => void;
  onCancel: () => void;
  onBrowseAll: () => void;
}

/** M02. One shape, defined on the fretboard or taken from the library. */
export default function ChordEditor({
  songTitle,
  chordCount,
  initial,
  saved,
  onSave,
  onCancel,
  onBrowseAll,
}: Props) {
  const { spec, dispatch, barreMode, pendingBarre, tapMarker } = useChordSpec(
    initial ?? emptySpec(),
  );
  const { palette } = useThemeValue();

  // The just-placed finger, cleared on the next interaction.
  const [active, setActive] = useState<StringNumber | null>(null);
  // Null means "follow the shape"; a string means the user has taken over.
  const [typedName, setTypedName] = useState<string | null>(initial?.name || null);
  const [savingImage, setSavingImage] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);

  const inferred = inferChordName(spec);
  const name = typedName ?? inferred ?? '';
  const shape = specToShape(spec);

  useEffect(() => {
    if (initial) dispatch({ type: 'LOAD', spec: initial });
  }, [initial, dispatch]);

  const tapCell = useCallback(
    (s: StringNumber, fret: number) => {
      dispatch({ type: 'TOGGLE_DOT', string: s, fret });
      setActive(s);
    },
    [dispatch],
  );

  const layBarre = useCallback(
    (fret: number, a: StringNumber, b: StringNumber) => {
      dispatch({ type: 'COMPLETE_BARRE', fret, a, b });
      setActive(null);
    },
    [dispatch],
  );

  const cycleMarker = useCallback(
    (s: StringNumber) => {
      tapMarker(s);
      setActive(null);
    },
    [tapMarker],
  );

  /* The window moves, the shape does not — dots keep their relative fret. The
     halo is cleared because it marks the finger you just put down, and that is
     no longer news once the whole grid has moved under it. */
  const nudgePosition = useCallback(
    (by: number) => {
      dispatch({ type: 'NUDGE_ROOT_FRET', by });
      setActive(null);
    },
    [dispatch],
  );

  const pickFromLibrary = useCallback(
    (chordName: string) => {
      const chord = findLibraryChord(chordName);
      if (!chord) return;
      dispatch({ type: 'LOAD', spec: libraryChordToSpec(chord) });
      setTypedName(null);
      setActive(null);
    },
    [dispatch],
  );

  const atNut = spec.rootFret === MIN_ROOT_FRET;
  const empty = !spec.dots.length && !spec.barres.length;
  /* The name is what prints over the word, so a shape cannot be saved without
     one. Most shapes name themselves — this only bites on the ones we cannot
     recognise, which are exactly the ones the player has to label. */
  const unnamed = !name.trim();

  /* Both ways back come through here. Leaving an untouched chord is instant;
     leaving edits asks first, because a shape is fiddly to put back together. */
  const leave = () => {
    if (chordChanged({ ...spec, name }, saved ?? emptySpec())) setConfirmingLeave(true);
    else onCancel();
  };

  useEffect(() => {
    if (!confirmingLeave) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setConfirmingLeave(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [confirmingLeave]);

  /** One shape as a picture — black on white, whatever the theme on screen. */
  const saveImage = () => {
    const saved = name.trim();
    setSavingImage(true);
    chordToPngBlob({ ...spec, name: saved })
      .then((blob) => downloadBlob(blob, chordFilename(saved)))
      .catch((err) => console.error(err))
      .finally(() => setSavingImage(false));
  };

  const where = songTitle ? `Adding to ${songTitle}` : 'Adding a chord';

  return (
    <div className="editor">
      <div className="editor-bar">
        <button type="button" className="icon-btn accent" onClick={leave} aria-label="Back">
          <CaretLeft size={20} />
        </button>
        <span className="editor-context">
          {chordCount > 0 ? `${where} · ${chordCount} in` : where}
        </span>
        <button
          type="button"
          className="icon-btn"
          onClick={saveImage}
          disabled={empty || unnamed || savingImage}
          aria-label="Save this chord as an image"
          title="Save as an image"
        >
          <DownloadSimple size={20} />
        </button>
      </div>

      <div className="editor-body">
        <h1 className="display-sm">Which shape?</h1>
        <p className="editor-hint">
          Tap where your fingers go. Hold and drag if it's a barre.
        </p>

        <div className="editor-plate">
          <ChordPlate
            spec={spec}
            pendingBarre={pendingBarre}
            barreMode={barreMode}
            ink={palette.text}
            active={active}
            onTapCell={tapCell}
            onTapMarker={cycleMarker}
            onBarre={layBarre}
          />
        </div>

        {/* Where the five-fret window sits on the neck. "Open" rather than "I"
            at the nut: that is what the nut bar on the diagram means, and it
            explains why no numeral is drawn there. */}
        <div className="position-row">
          <span className="position-label">Position</span>
          <div className="position-stepper">
            <button
              type="button"
              className="position-step"
              onClick={() => nudgePosition(-1)}
              disabled={spec.rootFret <= MIN_ROOT_FRET}
              aria-label="Move down one fret"
            >
              &minus;
            </button>
            <span
              className="position-value"
              aria-live="polite"
              aria-label={atNut ? 'Open position' : `Position, ${ordinal(spec.rootFret)} fret`}
            >
              {atNut ? 'Open' : toRoman(spec.rootFret)}
            </span>
            <button
              type="button"
              className="position-step"
              onClick={() => nudgePosition(1)}
              disabled={spec.rootFret >= MAX_ROOT_FRET}
              aria-label="Move up one fret"
            >
              +
            </button>
          </div>
        </div>

        <label className="sr-only" htmlFor="chord-name">
          Chord name
        </label>
        <input
          id="chord-name"
          className="editor-name"
          value={name}
          onChange={(e) => setTypedName(e.target.value)}
          placeholder={empty ? '—' : 'Name it'}
          aria-label="Chord name"
          autoComplete="off"
          spellCheck={false}
        />
        {inferred && typedName === null ? (
          <p className="editor-guess">We think this one is {inferred}.</p>
        ) : (
          !empty && unnamed && (
            <p className="editor-guess">Give it a name and it&apos;s yours to keep.</p>
          )
        )}

        <hr className="rule" />

        <p className="editor-prompt">
          Or take one from the library — these four get you through most nights.
        </p>

        <div className="chips">
          {COMMON_NAMES.map((n) => {
            const chord = findLibraryChord(n);
            const selected = chord != null && chord.shape === shape;
            return (
              <button
                key={n}
                type="button"
                className={`chip${selected ? ' is-selected' : ''}`}
                onClick={() => pickFromLibrary(n)}
                aria-pressed={selected}
              >
                {n}
              </button>
            );
          })}
          <button type="button" className="chip chip-all" onClick={onBrowseAll}>
            All 48
          </button>
        </div>
      </div>

      <div className="editor-action editor-actions">
        <button type="button" className="btn-secondary btn-block" onClick={leave}>
          Back
        </button>
        <button
          type="button"
          className="btn-primary btn-block"
          disabled={empty || unnamed}
          onClick={() => onSave({ ...spec, name: name.trim() })}
        >
          Save
        </button>
      </div>

      {confirmingLeave && (
        <>
          <button
            type="button"
            className="scrim"
            aria-label="Keep editing"
            onClick={() => setConfirmingLeave(false)}
          />
          <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="leave-title">
            <i className="grab" />
            <h2 id="leave-title">Leave without saving?</h2>
            <p className="editor-hint">
              {saved ? 'Your changes to this chord will be lost.' : 'This chord will not be added.'}
            </p>
            <div className="editor-actions">
              <button type="button" className="btn-secondary btn-block" onClick={onCancel}>
                Discard
              </button>
              <button
                type="button"
                className="btn-primary btn-block"
                onClick={() => setConfirmingLeave(false)}
                autoFocus
              >
                Keep editing
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
