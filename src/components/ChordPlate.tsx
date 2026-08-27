import { useMemo } from 'react';
import type { ChordSpec, StringNumber } from '../types/chord';
import type { PendingBarre } from '../hooks/useChordSpec';
import { STRING_COUNT, cellRectPct, markerRectPct } from '../lib/layout';
import { renderChordSVG } from '../lib/renderChordSVG';

interface Props {
  spec: ChordSpec;
  pendingBarre: PendingBarre | null;
  barreMode: boolean;
  onTapCell: (s: StringNumber, fret: number) => void;
  onTapMarker: (s: StringNumber) => void;
}

const MARKER_WORD: Record<string, string> = {
  none: 'not set',
  open: 'open',
  muted: 'muted',
};

const STRINGS = Array.from({ length: STRING_COUNT }, (_, i) => (i + 1) as StringNumber);

export default function ChordPlate({
  spec,
  pendingBarre,
  barreMode,
  onTapCell,
  onTapMarker,
}: Props) {
  // The artwork is drawn by exactly one function; the overlay never draws.
  const svg = useMemo(() => renderChordSVG(spec, { mode: 'screen' }), [spec]);

  const frets = Array.from({ length: spec.fretCount }, (_, i) => i + 1);

  const occupied = (s: StringNumber, fret: number) =>
    spec.dots.some((d) => d.string === s && d.fret === fret) ||
    spec.barres.some((b) => b.fret === fret && s <= b.fromString && s >= b.toString);

  return (
    <div className="plate">
      <div className="plate-art" dangerouslySetInnerHTML={{ __html: svg }} />

      <div className="overlay" role="group" aria-label="Fretboard">
        {/* Markers first, so a grid cell wins any overlap in hit-testing. */}
        {STRINGS.map((s) => {
          const r = markerRectPct(s);
          const state = spec.markers[s - 1] ?? 'none';
          return (
            <button
              key={`m${s}`}
              type="button"
              className="hit hit-marker"
              // Bottom-anchored so the 44px minimum target grows up into the
              // title band instead of down over fret 1.
              style={{
                left: `${r.left}%`,
                width: `${r.width}%`,
                bottom: `${100 - (r.top + r.height)}%`,
                height: `max(${r.height}%, 44px)`,
              }}
              aria-label={`String ${s} marker, currently ${MARKER_WORD[state]}`}
              onClick={() => onTapMarker(s)}
            />
          );
        })}

        {STRINGS.map((s) =>
          frets.map((f) => {
            const r = cellRectPct(s, f);
            const isAnchor =
              pendingBarre !== null && pendingBarre.string === s && pendingBarre.fret === f;
            return (
              <button
                key={`c${s}-${f}`}
                type="button"
                className={`hit hit-cell${isAnchor ? ' is-anchor' : ''}`}
                style={{
                  left: `${r.left}%`,
                  top: `${r.top}%`,
                  width: `${r.width}%`,
                  height: `${r.height}%`,
                }}
                aria-label={`String ${s}, fret ${spec.rootFret + f - 1}${
                  barreMode ? ' (barre)' : ''
                }`}
                aria-pressed={occupied(s, f)}
                onClick={() => onTapCell(s, f)}
              />
            );
          }),
        )}
      </div>
    </div>
  );
}
