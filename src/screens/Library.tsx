import { useMemo, useState } from 'react';
import { CaretLeft, MagnifyingGlass, Plus } from '@phosphor-icons/react';
import ChordDiagram from '../components/ChordDiagram';
import ChordSheet from '../components/ChordSheet';
import {
  GROUP_LABELS,
  LIBRARY,
  type ChordGroup,
  libraryChordToSpec,
} from '../data/chordLibrary';
import { matchesChordQuery } from '../lib/myChords';
import type { ExportJob } from '../lib/share';
import type { ChordSpec } from '../types/chord';
import type { MyChord } from '../types/myChord';

interface Props {
  /** My chords: the shapes the player has kept. Shown above the built-in ones. */
  mine: MyChord[];
  /**
   * Offered only when there is an editor to hand the chord back to. It hands
   * back the shape, not the name: a name was enough while every chord here was
   * built in and unique by it, and two voicings of G are both "G".
   */
  onPick?: (spec: ChordSpec) => void;
  /** Always present in practice; a deep link still has the landing page under it. */
  onBack?: () => void;
  /**
   * The Chords tab as a place, rather than a step in building a song: make a
   * chord, open one, send it. Absent as a step — a chord made from inside a
   * song's editor would be a second editor on top of the first.
   */
  place?: {
    onMake: () => void;
    onEditMine: (chordId: string) => void;
    onDeleteMine: (chordId: string) => void;
    busy: ExportJob | null;
    onShare: (spec: ChordSpec) => void;
    onSaveImage: (spec: ChordSpec) => void;
    onCopy: (spec: ChordSpec) => void;
  };
}

const GROUPS = Object.keys(GROUP_LABELS) as ChordGroup[];

/** Which chord's sheet is open. By id or name, so a deleted chord closes its own sheet. */
type Open = { mine: string } | { builtIn: string } | null;

/**
 * The Chords tab: My chords, then the built-in shapes. The built-in ones are
 * bundled and My chords are in the store, so all of it works offline.
 *
 * It is two screens in one, as it always was. Reached from a chord editor it
 * is a step — tap a shape and it goes back to the editor. Reached from the tab
 * bar it is a place, and a tap opens the chord: see `ChordSheet`.
 */
export default function Library({ mine, onPick, onBack, place }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Open>(null);

  const matches = useMemo(() => LIBRARY.filter((c) => matchesChordQuery(c.name, query)), [query]);
  const myMatches = useMemo(
    () => mine.filter((c) => matchesChordQuery(c.spec.name, query)),
    [mine, query],
  );

  const openSpec: ChordSpec | null = !open
    ? null
    : 'mine' in open
      ? (mine.find((c) => c.id === open.mine)?.spec ?? null)
      : (() => {
          const chord = LIBRARY.find((c) => c.name === open.builtIn);
          return chord ? libraryChordToSpec(chord) : null;
        })();

  /* A cell is a control when a tap does something: picks (as a step), or opens
     the chord (as a place). A deep link with neither is reference only. */
  const cell = (key: string, spec: ChordSpec, target: NonNullable<Open>) => {
    const body = (
      <>
        <strong>{spec.name.trim() || '—'}</strong>
        <ChordDiagram spec={spec} />
      </>
    );
    const act = onPick ? () => onPick(spec) : place ? () => setOpen(target) : null;
    return (
      <li key={key}>
        {act ? (
          <button type="button" className="card chord-cell" onClick={act}>
            {body}
          </button>
        ) : (
          <div className="card chord-cell is-static">{body}</div>
        )}
      </li>
    );
  };

  const counts = `${LIBRARY.length} built in${mine.length ? ` · ${mine.length} of your own` : ''}`;

  return (
    <div className="library">
      <div className="library-head">
        {onBack && (
          <button type="button" className="icon-btn accent" onClick={onBack} aria-label="Back">
            <CaretLeft size={20} />
          </button>
        )}
        <div>
          <h1 className="display-sm">Chord library</h1>
          <p className="library-sub">
            {counts}. No signal needed.
            {onPick && ' Tap one to use it.'}
          </p>
        </div>
      </div>

      <div className="search">
        <MagnifyingGlass size={16} />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a chord"
          aria-label="Find a chord"
        />
      </div>

      {/* As a step with nothing kept there is nothing to say about My chords;
          as a place the section is always here, because it is where Make is. */}
      {(place || mine.length > 0) && (!query.trim() || myMatches.length > 0) && (
        <section>
          <div className="library-mine-head">
            <p className="section-label">My chords</p>
            {place && (
              <button type="button" className="btn-primary library-make" onClick={place.onMake}>
                <Plus size={14} weight="bold" />
                Make a chord
              </button>
            )}
          </div>
          {mine.length === 0 ? (
            <p className="library-mine-empty">
              Shapes you make are kept here, to use in any song or send to someone as a picture.
            </p>
          ) : (
            <ul className="chord-grid">
              {myMatches.map((c) => cell(c.id, c.spec, { mine: c.id }))}
            </ul>
          )}
        </section>
      )}

      {GROUPS.map((group) => {
        const inGroup = matches.filter((c) => c.group === group);
        if (!inGroup.length) return null;
        return (
          <section key={group}>
            <p className="section-label">{GROUP_LABELS[group]}</p>
            <ul className="chord-grid">
              {inGroup.map((chord) =>
                cell(chord.name, libraryChordToSpec(chord), { builtIn: chord.name }),
              )}
            </ul>
          </section>
        );
      })}

      {matches.length === 0 && myMatches.length === 0 && (
        <p className="library-empty">Nothing matches “{query.trim()}”.</p>
      )}

      {place && open && openSpec && (
        <ChordSheet
          spec={openSpec}
          busy={place.busy}
          onShare={() => place.onShare(openSpec)}
          onSaveImage={() => place.onSaveImage(openSpec)}
          onCopy={() => place.onCopy(openSpec)}
          mine={
            'mine' in open
              ? {
                  onEdit: () => place.onEditMine(open.mine),
                  onDelete: () => {
                    place.onDeleteMine(open.mine);
                    setOpen(null);
                  },
                }
              : undefined
          }
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
