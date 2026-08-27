import { MAX_ROOT_FRET, MIN_ROOT_FRET } from '../lib/layout';

interface Props {
  rootFret: number;
  barreMode: boolean;
  canExport: boolean;
  exportLabel: string;
  onRootFret: (n: number) => void;
  onToggleBarre: () => void;
  onClear: () => void;
  onExport: () => void;
}

export default function Toolbar({
  rootFret,
  barreMode,
  canExport,
  exportLabel,
  onRootFret,
  onToggleBarre,
  onClear,
  onExport,
}: Props) {
  return (
    <div className="toolbar">
      {/* Position is a setting, centred and sized to its content. Barre is a
          mode, kept on its own row with extra space above it, so the two
          never read as one control cluster. */}
      <div className="toolbar-row toolbar-row-position">
        <div className="stepper" role="group" aria-label="Root fret">
          <button
            type="button"
            className="btn btn-step"
            onClick={() => onRootFret(rootFret - 1)}
            disabled={rootFret <= MIN_ROOT_FRET}
            aria-label="Move down one fret"
          >
            &minus;
          </button>
          <span className="stepper-value" aria-live="polite">
            {rootFret}fr
          </span>
          <button
            type="button"
            className="btn btn-step"
            onClick={() => onRootFret(rootFret + 1)}
            disabled={rootFret >= MAX_ROOT_FRET}
            aria-label="Move up one fret"
          >
            +
          </button>
        </div>
      </div>

      <div className="toolbar-row toolbar-row-mode">
        <button
          type="button"
          className={`btn btn-toggle${barreMode ? ' is-on' : ''}`}
          onClick={onToggleBarre}
          aria-pressed={barreMode}
        >
          Barre
        </button>
      </div>

      <p className={`hint${barreMode ? '' : ' is-hidden'}`} aria-live="polite">
        {barreMode ? 'Tap the two ends of the barre.' : ''}
      </p>

      <div className="toolbar-row">
        <button type="button" className="btn" onClick={onClear}>
          Clear
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onExport}
          disabled={!canExport}
          title={canExport ? undefined : 'Add at least one note first'}
        >
          {exportLabel}
        </button>
      </div>
    </div>
  );
}
