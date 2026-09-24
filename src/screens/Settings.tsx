import { ArrowLeft } from '@phosphor-icons/react';
import ChordDiagram from '../components/ChordDiagram';
import TextSize from '../components/TextSize';
import { usePrefs } from '../hooks/usePrefs';
import { shapeToSpec } from '../lib/shape';

interface Props {
  signedIn: boolean;
  onBack?: () => void;
  onSignIn: () => void;
}

/* Drawn at the size of a tile, with the two things orientation changes most:
   open and muted strings above the nut, and a barre. */
const PREVIEW = [shapeToSpec('C', 'x32010'), shapeToSpec('F', '133211')];

/**
 * How this player wants things drawn. Nothing here touches a song: a chord is
 * stored the same way for everybody, and these only change how it is shown to
 * *you* — so a left-hander can write a song out and a right-hander can play
 * from the same copy, each seeing it their own way round.
 */
export default function Settings({ signedIn, onBack, onSignIn }: Props) {
  const { prefs, setPref } = usePrefs();
  return (
    <div className="settings">
      {onBack && (
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Back">
          <ArrowLeft size={20} />
        </button>
      )}
      <h1 className="display-sm">How you play</h1>
      <p className="library-sub">
        {signedIn
          ? 'These follow you to every device you sign in on. Songs are not changed.'
          : 'Kept on this device. Songs are not changed.'}
      </p>

      <ul className="settings-list">
        <li>
          <label>
            <input
              type="checkbox"
              checked={prefs.leftHanded}
              onChange={(e) => setPref('leftHanded', e.target.checked)}
            />
            <span>
              <strong>Left-handed</strong>
              <em>Chords are drawn the way round you hold the guitar.</em>
            </span>
          </label>
        </li>
        <li>
          <label>
            <input
              type="checkbox"
              checked={prefs.sideways}
              onChange={(e) => setPref('sideways', e.target.checked)}
            />
            <span>
              <strong>Chords on their side</strong>
              <em>The neck runs across, like tab, with the thinnest string on top.</em>
            </span>
          </label>
        </li>
        <li className="settings-size">
          <span>
            <strong>Text size when playing</strong>
            <em>Smaller gets more of the song on the screen at once.</em>
          </span>
          <TextSize />
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

      {!signedIn && (
        <button type="button" className="btn-ghost settings-signin" onClick={onSignIn}>
          Sign in to keep these on every device
        </button>
      )}
    </div>
  );
}
