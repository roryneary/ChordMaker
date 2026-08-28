import { useCallback, useEffect, useState } from 'react';
import { CaretLeft } from '@phosphor-icons/react';
import ChordPlate from '../components/ChordPlate';
import { emptySpec, useChordSpec } from '../hooks/useChordSpec';
import { COMMON_NAMES, findLibraryChord, libraryChordToSpec } from '../data/chordLibrary';
import { inferChordName } from '../lib/chordName';
import { specToShape } from '../lib/shape';
import { useThemeValue } from '../theme/ThemeProvider';
import type { ChordSpec, StringNumber } from '../types/chord';

interface Props {
  /** The song this chord is being added to, if any. */
  songTitle: string | null;
  initial: ChordSpec | null;
  onSave: (spec: ChordSpec) => void;
  onCancel: () => void;
  onBrowseAll: () => void;
}

/** M02. One shape, defined on the fretboard or taken from the library. */
export default function ChordEditor({
  songTitle,
  initial,
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

  const empty = !spec.dots.length && !spec.barres.length;

  return (
    <div className="editor">
      <div className="editor-bar">
        <button type="button" className="icon-btn accent" onClick={onCancel} aria-label="Back">
          <CaretLeft size={20} />
        </button>
        <span className="editor-context">
          {songTitle ? `Adding to ${songTitle}` : 'Working out a chord'}
        </span>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Skip
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
        {inferred && typedName === null && (
          <p className="editor-guess">We think this one is {inferred}.</p>
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

      <div className="editor-action">
        <button
          type="button"
          className="btn-primary btn-block"
          disabled={empty}
          onClick={() => onSave({ ...spec, name: name.trim() })}
        >
          That's the one
        </button>
      </div>
    </div>
  );
}
