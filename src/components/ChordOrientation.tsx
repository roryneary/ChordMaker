import { usePrefs } from '../hooks/usePrefs';

/**
 * Upright or sideways, as two named choices. It was a checkbox, "Chords on
 * their side", which only said what one of the two looked like; this names
 * both, so you can see which you have and what the other is called.
 */
export default function ChordOrientation() {
  const { prefs, setPref } = usePrefs();
  const choice = (sideways: boolean, label: string) => (
    <button
      type="button"
      className={prefs.sideways === sideways ? 'is-on' : undefined}
      aria-pressed={prefs.sideways === sideways}
      onClick={() => setPref('sideways', sideways)}
    >
      {label}
    </button>
  );
  return (
    <div className="seg chord-orientation" role="group" aria-label="Chord orientation">
      {choice(false, 'Upright')}
      {choice(true, 'Sideways')}
    </div>
  );
}
