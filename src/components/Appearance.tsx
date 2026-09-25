import type { ThemeChoice } from '../hooks/useTheme';
import { useThemeValue } from '../theme/ThemeProvider';

const CHOICES: [ThemeChoice, string][] = [
  ['system', 'Auto'],
  ['light', 'Light'],
  ['dark', 'Dark'],
];

/** Light, dark, or whatever the device is set to — the theme `useTheme` already keeps. */
export default function Appearance() {
  const { choice, setChoice } = useThemeValue();
  return (
    <div className="seg appearance" role="group" aria-label="Appearance">
      {CHOICES.map(([value, label]) => (
        <button
          key={value}
          type="button"
          className={choice === value ? 'is-on' : undefined}
          aria-pressed={choice === value}
          onClick={() => setChoice(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
