import { useMemo, useState } from 'react';
import { CaretLeft, MagnifyingGlass } from '@phosphor-icons/react';
import ChordDiagram from '../components/ChordDiagram';
import {
  GROUP_LABELS,
  LIBRARY,
  type ChordGroup,
  libraryChordToSpec,
} from '../data/chordLibrary';

interface Props {
  /** Offered only when there is an editor to hand the chord back to. */
  onPick?: (name: string) => void;
  /** Always present in practice; a deep link still has the landing page under it. */
  onBack?: () => void;
}

const GROUPS = Object.keys(GROUP_LABELS) as ChordGroup[];

/** Browse the built-in shapes. Everything here is bundled — it works offline. */
export default function Library({ onPick, onBack }: Props) {
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return LIBRARY.filter((c) => !q || c.name.toLowerCase().includes(q));
  }, [query]);

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
            {LIBRARY.length} shapes, in the bag. No signal needed.
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

      {GROUPS.map((group) => {
        const inGroup = matches.filter((c) => c.group === group);
        if (!inGroup.length) return null;
        return (
          <section key={group}>
            <p className="section-label">{GROUP_LABELS[group]}</p>
            <ul className="chord-grid">
              {inGroup.map((chord) => {
                const body = (
                  <>
                    <strong>{chord.name}</strong>
                    <ChordDiagram spec={libraryChordToSpec(chord)} />
                  </>
                );
                return (
                  <li key={chord.name}>
                    {/* Without somewhere to hand the chord back to, these are
                        reference, not controls — so they are not buttons. */}
                    {onPick ? (
                      <button
                        type="button"
                        className="card chord-cell"
                        onClick={() => onPick(chord.name)}
                      >
                        {body}
                      </button>
                    ) : (
                      <div className="card chord-cell is-static">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {matches.length === 0 && (
        <p className="library-empty">Nothing matches “{query.trim()}”.</p>
      )}
    </div>
  );
}
