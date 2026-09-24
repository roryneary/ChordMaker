import { useCallback, useMemo, useRef, useState } from 'react';
import type { ChordSpec, StringNumber } from '../types/chord';
import type { PendingBarre } from '../hooks/useChordSpec';
import { type RectPct, STRING_COUNT, cellRectPct, markerRectPct } from '../lib/layout';
import { renderChordSVG } from '../lib/renderChordSVG';
import { useOrient } from '../hooks/usePrefs';

interface Props {
  spec: ChordSpec;
  pendingBarre: PendingBarre | null;
  barreMode: boolean;
  /** Resolved from the theme — the SVG cannot read a CSS variable. */
  ink: string;
  /** The just-placed finger, drawn with a halo until the next interaction. */
  active?: StringNumber | null;
  onTapCell: (s: StringNumber, fret: number) => void;
  onTapMarker: (s: StringNumber) => void;
  /**
   * Supply this to enable press-and-drag barres. A drag across two or more
   * strings on one fret lays a barre; anything shorter falls through to
   * onTapCell, so a tap still just places a dot.
   */
  onBarre?: (fret: number, a: StringNumber, b: StringNumber) => void;
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
  ink,
  active = null,
  onTapCell,
  onTapMarker,
  onBarre,
}: Props) {
  /* The drag in progress. This is state, not a ref, because the preview
     highlight is rendered from it — a ref read during render can show a stale
     frame. */
  const [drag, setDrag] = useState<{
    from: { s: StringNumber; fret: number };
    to: { s: StringNumber; fret: number };
  } | null>(null);
  /* Touch synthesises a click on the element the gesture STARTED on, so after a
     drag lays a barre the anchor cell would also toggle a dot on top of it. */
  const justDragged = useRef(false);

  /* Touch implicitly captures the pointer to the element it started on, so
     pointerenter never fires on the cells being dragged over. Hit-testing the
     coordinates works for mouse and touch alike. */
  const cellAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y);
    const cell = el?.closest<HTMLElement>('[data-string][data-fret]');
    if (!cell) return null;
    return {
      s: Number(cell.dataset.string) as StringNumber,
      fret: Number(cell.dataset.fret),
    };
  };

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!onBarre) return;
      /* Cleared here, not in the click handler: a mouse drag that ends on a
         different cell fires its click on the overlay rather than on either
         button, so a flag left standing would swallow the NEXT real tap. */
      justDragged.current = false;
      const at = cellAt(e.clientX, e.clientY);
      if (at) setDrag({ from: at, to: at });
    },
    [onBarre],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!onBarre) return;
      const at = cellAt(e.clientX, e.clientY);
      setDrag((d) => {
        // A barre lies along one fret, so vertical wander is ignored.
        if (!d || !at || at.fret !== d.from.fret || at.s === d.to.s) return d;
        return { ...d, to: at };
      });
    },
    [onBarre],
  );

  const endDrag = useCallback(() => {
    if (drag && onBarre && drag.to.s !== drag.from.s) {
      justDragged.current = true;
      onBarre(drag.from.fret, drag.from.s, drag.to.s);
    }
    setDrag(null);
  }, [drag, onBarre]);

  const handleCellClick = useCallback(
    (s: StringNumber, fret: number) => {
      // A span of one string is a dot, not a barre, so that click still counts.
      if (justDragged.current) {
        justDragged.current = false;
        return;
      }
      onTapCell(s, fret);
    },
    [onTapCell],
  );

  /* Drawn the player's way round, as every diagram is: a left-hander taps out
     a chord on their own mirror image and it is stored exactly as a
     right-hander's would be. The buttons are placed by the same mapping. */
  const orient = useOrient();
  const { leftHanded, sideways } = orient;

  // The artwork is drawn by exactly one function; the overlay never draws.
  const svg = useMemo(
    () => renderChordSVG(spec, { mode: 'screen', ink, active, orient }),
    [spec, ink, active, orient],
  );

  /* A marker slot is small, so its button is at least 44px — and it grows away
     from the fretboard, never over fret 1: up when upright, out past the nut's
     far side when the neck runs across. */
  const markerStyle = (r: RectPct): React.CSSProperties => {
    if (!sideways) {
      return {
        left: `${r.left}%`,
        width: `${r.width}%`,
        bottom: `${100 - (r.top + r.height)}%`,
        height: `max(${r.height}%, 44px)`,
      };
    }
    const across = { top: `${r.top}%`, height: `${r.height}%`, width: `max(${r.width}%, 44px)` };
    return leftHanded
      ? { ...across, left: `${r.left}%` }
      : { ...across, right: `${100 - (r.left + r.width)}%` };
  };

  const frets = Array.from({ length: spec.fretCount }, (_, i) => i + 1);

  /** Highlights the strings a drag currently spans, so the barre is visible. */
  const inDrag = (s: StringNumber, fret: number) => {
    if (!drag || drag.from.s === drag.to.s || fret !== drag.from.fret) return false;
    const [lo, hi] = [Math.min(drag.from.s, drag.to.s), Math.max(drag.from.s, drag.to.s)];
    return s >= lo && s <= hi;
  };

  const occupied = (s: StringNumber, fret: number) =>
    spec.dots.some((d) => d.string === s && d.fret === fret) ||
    spec.barres.some((b) => b.fret === fret && s <= b.fromString && s >= b.toString);

  return (
    <div className="plate">
      <div className="plate-art" dangerouslySetInnerHTML={{ __html: svg }} />

      <div
        className="overlay"
        role="group"
        aria-label="Fretboard"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {/* Markers first, so a grid cell wins any overlap in hit-testing. */}
        {STRINGS.map((s) => {
          const r = markerRectPct(s, orient);
          const state = spec.markers[s - 1] ?? 'none';
          return (
            <button
              key={`m${s}`}
              type="button"
              className="hit hit-marker"
              style={markerStyle(r)}
              aria-label={`String ${s} marker, currently ${MARKER_WORD[state]}`}
              onClick={() => onTapMarker(s)}
            />
          );
        })}

        {STRINGS.map((s) =>
          frets.map((f) => {
            const r = cellRectPct(s, f, orient);
            const isAnchor =
              pendingBarre !== null && pendingBarre.string === s && pendingBarre.fret === f;
            return (
              <button
                key={`c${s}-${f}`}
                type="button"
                data-string={s}
                data-fret={f}
                className={`hit hit-cell${isAnchor || inDrag(s, f) ? ' is-anchor' : ''}`}
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
                onClick={() => handleCellClick(s, f)}
              />
            );
          }),
        )}
      </div>
    </div>
  );
}
