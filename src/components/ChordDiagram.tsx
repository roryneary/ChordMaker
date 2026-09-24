import { useMemo } from 'react';
import type { ChordSpec, StringNumber } from '../types/chord';
import { renderChordSVG } from '../lib/renderChordSVG';
import { useInk } from '../theme/ThemeProvider';
import { useOrient } from '../hooks/usePrefs';

interface Props {
  spec: ChordSpec;
  /** The just-placed finger, drawn with a halo. */
  active?: StringNumber | null;
  /** Width of the diagram; it keeps its own aspect from there. */
  width?: number | string;
  className?: string;
}

/**
 * The read-only diagram, used everywhere a chord is shown but not edited:
 * chord cells, the resume card, the library. The editable one is ChordPlate,
 * which adds the button overlay on top of this same artwork.
 */
export default function ChordDiagram({ spec, active = null, width, className }: Props) {
  const ink = useInk();
  // The player's way round (lib/prefs.ts), so every tile, strip and card follows it.
  const orient = useOrient();
  const svg = useMemo(
    () => renderChordSVG(spec, { mode: 'screen', ink, active, orient }),
    [spec, ink, active, orient],
  );
  return (
    <div
      className={className ? `diagram ${className}` : 'diagram'}
      style={width === undefined ? undefined : { width }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
