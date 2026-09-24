import { TEXT_SCALES, stepScale } from '../lib/prefs';
import { usePrefs } from '../hooks/usePrefs';

/**
 * The reading view's text size, as A− / percent / A+. The percent is there
 * because nine steps is too many to tell apart by the look of a letter, and
 * the setting is the player's own, remembered on every device they sign in on.
 */
export default function TextSize() {
  const { prefs, setPref } = usePrefs();
  const scale = prefs.textScale;
  const smallest = scale <= TEXT_SCALES[0];
  const largest = scale >= TEXT_SCALES[TEXT_SCALES.length - 1];
  return (
    <div className="seg text-size" role="group" aria-label="Text size">
      <button
        type="button"
        disabled={smallest}
        onClick={() => setPref('textScale', stepScale(scale, -1))}
        aria-label="Smaller text"
      >
        A−
      </button>
      <span className="text-size-now" aria-live="polite">
        {Math.round(scale * 100)}%
      </span>
      <button
        type="button"
        disabled={largest}
        onClick={() => setPref('textScale', stepScale(scale, 1))}
        aria-label="Larger text"
      >
        A+
      </button>
    </div>
  );
}
