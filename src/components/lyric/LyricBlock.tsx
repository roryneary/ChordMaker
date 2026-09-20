import type { Placements, Word } from '../../types/song';
import { firstLinesWithContent, groupByLine, lineCount } from '../../lib/lyric';
import ChordedLine, { type LyricSizes } from './ChordedLine';

interface Props {
  lyric: string;
  words: Word[];
  placements: Placements;
  nameOf: (chordId: string) => string | null;
  sizes: LyricSizes;
  /**
   * Stops after this many lines *with words on them* — a blank line does not
   * spend the budget, only end it early if it falls right after the last one
   * shown. Counted this way because the caller's own "N more lines below"
   * count (SongScreen) already only counts lines with words; slicing on raw
   * line index instead let a lyric that opens with a blank line — extremely
   * common in anything pasted from a lyrics site — burn the whole preview on
   * gaps and show nothing.
   */
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
  const shown = maxLines === undefined ? lines : firstLinesWithContent(lines, maxLines);

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
