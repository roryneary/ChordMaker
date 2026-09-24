import type { Placements, SongNote, Word } from '../../types/song';

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
  /** The notes on words (`notesByWord`). Words carrying one are marked. */
  notes?: Map<string, SongNote[]>;
  /** Also print those notes under the line — the reading view, where they are read mid-song. */
  notesInline?: boolean;
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
  notes,
  notesInline = false,
}: Props) {
  const hasChords = words.some((w) => placements[w.id]);
  const lineNotes = notes ? words.flatMap((w) => notes.get(w.id) ?? []) : [];

  /* Under the line, not beside the word: a word is a few letters wide and a
     note is a sentence. Small, and in the pattern face for a pattern. */
  const under =
    notesInline && lineNotes.length > 0 ? (
      <div className="line-notes" style={{ fontSize: Math.max(11, sizes.word * 0.62) }}>
        {lineNotes.map((n) => (
          <p key={n.id} className={`line-note note-${n.kind}`}>
            {n.text}
          </p>
        ))}
      </div>
    ) : null;

  // A bare line — nothing placed on it yet — is one text node at reduced
  // opacity, with no chord row at all. The dimming is the signal. A word with
  // a note on it needs a box of its own to carry the mark, so not then.
  if (!hasChords && !onWordClick && lineNotes.length === 0) {
    return (
      <p className="lyric-line lyric-bare" style={{ fontSize: sizes.word }}>
        {words.map((w) => w.text).join(' ')}
      </p>
    );
  }

  const line = (
    <p className={`lyric-line${hasChords ? '' : ' lyric-bare'}`}>
      {words.map((word) => {
        const chordId = placements[word.id];
        const name = chordId ? nameOf(chordId) : null;
        const selected = word.id === selectedWordId;
        const noted = !!notes?.get(word.id)?.length;
        const Tag = onWordClick ? 'button' : 'span';
        return (
          <Tag
            key={word.id}
            {...(onWordClick
              ? {
                  type: 'button' as const,
                  onClick: () => onWordClick(word.id),
                  'aria-label': `${word.text}, ${name ? `chord ${name}` : 'no chord'}${
                    noted ? ', has a note' : ''
                  }`,
                }
              : {})}
            className={`word${selected ? ' is-selected' : ''}${name ? ' has-chord' : ''}${
              noted ? ' has-note' : ''
            }`}
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

  return under ? (
    <div className="lyric-noted">
      {line}
      {under}
    </div>
  ) : (
    line
  );
}
