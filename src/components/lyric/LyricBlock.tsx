import type { Placements, Word } from '../../types/song';
import { groupByLine, lineCount } from '../../lib/lyric';
import ChordedLine, { type LyricSizes } from './ChordedLine';

interface Props {
  lyric: string;
  words: Word[];
  placements: Placements;
  nameOf: (chordId: string) => string | null;
  sizes: LyricSizes;
  /** Renders at most this many lines; the rest are counted for the caller. */
  maxLines?: number;
  onWordClick?: (wordId: string) => void;
  selectedWordId?: string | null;
}

/** Every line of the lyric, with blank lines kept as the gaps they are. */
export default function LyricBlock({
  lyric,
  words,
  placements,
  nameOf,
  sizes,
  maxLines,
  onWordClick,
  selectedWordId,
}: Props) {
  const lines = groupByLine(words, lineCount(lyric));
  const shown = maxLines === undefined ? lines : lines.slice(0, maxLines);

  return (
    <>
      {shown.map((lineWords, i) =>
        lineWords.length === 0 ? (
          // The lyric's blank line: a gap on the sheet, not an empty row.
          <div key={`gap-${i}`} className="lyric-gap" aria-hidden="true" />
        ) : (
          <ChordedLine
            key={`line-${i}`}
            words={lineWords}
            placements={placements}
            nameOf={nameOf}
            sizes={sizes}
            onWordClick={onWordClick}
            selectedWordId={selectedWordId}
          />
        ),
      )}
    </>
  );
}
