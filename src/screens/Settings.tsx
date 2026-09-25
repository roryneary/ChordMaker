import { ArrowLeft } from '@phosphor-icons/react';
import ChordDiagram from '../components/ChordDiagram';
import ChordOrientation from '../components/ChordOrientation';
import TextSize from '../components/TextSize';
import LyricBlock from '../components/lyric/LyricBlock';
import { useIsDesktop } from '../components/shell/useBreakpoint';
import { usePrefs } from '../hooks/usePrefs';
import { tokenise } from '../lib/lyric';
import { readingSizes } from '../lib/prefs';
import { shapeToSpec } from '../lib/shape';
import type { Placements } from '../types/song';

interface Props {
  signedIn: boolean;
  onBack?: () => void;
  onSignIn: () => void;
}

/* Drawn at the size of a tile, with the two things orientation changes most:
   open and muted strings above the nut, and a barre. */
const PREVIEW = [shapeToSpec('C', 'x32010'), shapeToSpec('F', '133211')];

/* A verse everyone can hear, chorded, so "90%" is a size you can see rather
   than a number: the text size is only ever used for reading a song. */
const SAMPLE_LYRIC = [
  'There is a house in New Orleans',
  'They call the Rising Sun',
  "And it's been the ruin of many a poor boy",
  "And, God, I know I'm one",
].join('\n');
const SAMPLE_WORDS = tokenise(SAMPLE_LYRIC);
/** [line, word index in that line, chord] — the chord names stand in as ids. */
const SAMPLE_CHORDS: [number, number, string][] = [
  [0, 1, 'Am'], [0, 3, 'C'], [0, 5, 'D'], [0, 6, 'F'],
  [1, 1, 'Am'], [1, 3, 'C'], [1, 4, 'E'],
  [2, 2, 'Am'], [2, 4, 'C'], [2, 6, 'D'], [2, 9, 'F'],
  [3, 1, 'Am'], [3, 3, 'E'], [3, 5, 'Am'],
];
const SAMPLE_PLACEMENTS: Placements = Object.fromEntries(
  SAMPLE_CHORDS.flatMap(([line, at, chord]) => {
    const word = SAMPLE_WORDS.filter((w) => w.line === line)[at];
    return word ? [[word.id, chord]] : [];
  }),
);
const sampleName = (chordId: string) => chordId;

/**
 * The player's own settings: how chords are drawn and how big a song reads.
 * Nothing here touches a song: a chord is stored the same way for everybody,
 * and these only change how it is shown to *you* — so a left-hander can write
 * a song out and a right-hander can play from the same copy, each seeing it
 * their own way round.
 */
export default function Settings({ signedIn, onBack, onSignIn }: Props) {
  const { prefs, setPref } = usePrefs();
  const isDesktop = useIsDesktop();
  return (
    <div className="settings">
      {onBack && (
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Back">
          <ArrowLeft size={20} />
        </button>
      )}
      <h1 className="display-sm">Settings</h1>
      <p className="library-sub">
        {signedIn
          ? 'Yours: they follow you to every device you sign in on. Songs are not changed.'
          : 'Yours, kept on this device. Songs are not changed.'}
      </p>

      <ul className="settings-list">
        <li className="settings-row">
          <span>
            <strong>Chord orientation</strong>
            <em>Sideways runs the neck across, like tab, with the thinnest string on top.</em>
          </span>
          <ChordOrientation />
        </li>
        <li>
          <label>
            <input
              type="checkbox"
              checked={prefs.leftHanded}
              onChange={(e) => setPref('leftHanded', e.target.checked)}
            />
            <span>
              <strong>Mirror the chords</strong>
              <em>For playing left-handed: every chord box is flipped left to right.</em>
            </span>
          </label>
        </li>
      </ul>

      <div className="settings-preview" aria-label="How chords will look">
        {PREVIEW.map((spec) => (
          <figure key={spec.name}>
            <ChordDiagram spec={spec} width={96} />
            <figcaption>{spec.name}</figcaption>
          </figure>
        ))}
      </div>

      <ul className="settings-list">
        <li className="settings-row">
          <span>
            <strong>Text size when playing</strong>
            <em>Smaller gets more of the song on the screen at once.</em>
          </span>
          <TextSize />
        </li>
      </ul>
      {/* Drawn with the reading view's own sizes, so this is what a song looks like. */}
      <div
        className="settings-sample"
        aria-label="How a song will read"
        style={{ gap: Math.round((isDesktop ? 24 : 20) * prefs.textScale) }}
      >
        <LyricBlock
          lyric={SAMPLE_LYRIC}
          words={SAMPLE_WORDS}
          placements={SAMPLE_PLACEMENTS}
          nameOf={sampleName}
          sizes={readingSizes(isDesktop, prefs.textScale)}
        />
      </div>

      {!signedIn && (
        <button type="button" className="btn-ghost settings-signin" onClick={onSignIn}>
          Sign in to keep these on every device
        </button>
      )}
    </div>
  );
}
