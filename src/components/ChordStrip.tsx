import { useMemo } from 'react';
import type { SavedChord } from '../types/song';
import { renderChordSVG } from '../lib/renderChordSVG';

interface Props {
  chords: SavedChord[];
  editingId: string | null;
  onEdit: (chord: SavedChord) => void;
  onDownload: (chord: SavedChord) => void;
  onRemove: (chord: SavedChord) => void;
}

function Thumb({ spec }: { spec: SavedChord['spec'] }) {
  const svg = useMemo(() => renderChordSVG(spec, { mode: 'screen' }), [spec]);
  return <div className="strip-art" dangerouslySetInnerHTML={{ __html: svg }} />;
}

export default function ChordStrip({ chords, editingId, onEdit, onDownload, onRemove }: Props) {
  if (chords.length === 0) {
    return (
      <p className="strip-empty">
        No chords yet. Build one on the fretboard below, then tap <strong>Add chord</strong>.
      </p>
    );
  }

  return (
    <ul className="strip" aria-label="Chords in this song">
      {chords.map((c) => {
        const label = c.spec.name.trim() || 'Unnamed chord';
        const editing = c.id === editingId;
        return (
          <li key={c.id} className={`strip-item${editing ? ' is-editing' : ''}`}>
            <button
              type="button"
              className="strip-thumb"
              onClick={() => onEdit(c)}
              aria-label={`Edit ${label}`}
              aria-pressed={editing}
            >
              <Thumb spec={c.spec} />
            </button>
            <div className="strip-actions">
              <button
                type="button"
                className="btn btn-small"
                onClick={() => onDownload(c)}
                aria-label={`Download ${label} as PNG`}
              >
                PNG
              </button>
              <button
                type="button"
                className="btn btn-small"
                onClick={() => onRemove(c)}
                aria-label={`Remove ${label} from song`}
              >
                &times;
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
