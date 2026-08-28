import type { Placements, Word } from '../../types/song';

export interface LyricSizes {
  /** px */
  word: number;
  /** px — roughly 0.55 x the word size across the design. */
  chord: number;
}

interface Props {
  words: Word[];
  placements: Placements;
  /** Resolves a placement's chord id to the name to print above the word. */
  nameOf: (chordId: string) => string | null;
  sizes: LyricSizes;
  onWordClick?: (wordId: string) => void;
  selectedWordId?: string | null;
}

/**
 * One line of lyric with its chords sitting over the words they land on.
 *
 * Each word is a two-row column. The empty chord slot renders a non-breaking
 * space at the SAME font-size and line-height as a real chord — that is what
 * keeps the word baselines level across the line. Do not collapse empty slots
 * and do not position the chords absolutely.
 */
export default function ChordedLine({
  words,
  placements,
  nameOf,
  sizes,
  onWordClick,
  selectedWordId = null,
}: Props) {
  const hasChords = words.some((w) => placements[w.id]);

  // A bare line — nothing placed on it yet — is one text node at reduced
  // opacity, with no chord row at all. The dimming is the signal.
  if (!hasChords && !onWordClick) {
    return (
      <p className="lyric-line lyric-bare" style={{ fontSize: sizes.word }}>
        {words.map((w) => w.text).join(' ')}
      </p>
    );
  }

  return (
    <p className={`lyric-line${hasChords ? '' : ' lyric-bare'}`}>
      {words.map((word) => {
        const chordId = placements[word.id];
        const name = chordId ? nameOf(chordId) : null;
        const selected = word.id === selectedWordId;
        const Tag = onWordClick ? 'button' : 'span';
        return (
          <Tag
            key={word.id}
            {...(onWordClick
              ? {
                  type: 'button' as const,
                  onClick: () => onWordClick(word.id),
                  'aria-label': name
                    ? `${word.text}, chord ${name}`
                    : `${word.text}, no chord`,
                }
              : {})}
            className={`word${selected ? ' is-selected' : ''}${name ? ' has-chord' : ''}`}
          >
            <span className="word-chord" style={{ fontSize: sizes.chord }}>
              {name ?? ' '}
            </span>
            <span className="word-text" style={{ fontSize: sizes.word }}>
              {word.text}
            </span>
          </Tag>
        );
      })}
    </p>
  );
}
