import { CaretDown } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { ordinal } from '../lib/numerals';

interface Props {
  capo: Capo;
  /** Omit to render the read-only statement used on the reading screens. */
  onChange?: (capo: number | null) => void;
  /** The filled treatment used on the finished-song and full-screen views. */
  variant?: 'chip' | 'statement';
}

/** A fret, an explicit "no capo", or nobody has been asked. See types/song.ts. */
export type Capo = number | null | undefined;

export const MAX_CAPO = 7;

/** The frets offered, in menu order. Also drives the check sheet's chips. */
export const CAPO_FRETS = Array.from({ length: MAX_CAPO }, (_, i) => i + 1);

export const capoChosen = (capo: Capo): capo is number | null => capo !== undefined;

/** Reads as a statement of fact, so it suits the reading screens and the print meta. */
export const capoLabel = (capo: Capo): string => {
  if (!capoChosen(capo)) return 'Capo not set';
  return capo ? `Capo on the ${ordinal(capo)}` : 'No capo';
};

/**
 * A control on the editing screens, a statement on the reading ones. The small
 * accent bar reads as a capo laid across the neck.
 *
 * An unanswered capo is the one case where the two voices differ: the control
 * asks for the choice outright, because reading "Capo not set" on a chip that
 * looks like every other filled chip is how it stopped looking like a question
 * in the first place.
 */
export default function CapoChip({ capo, onChange, variant = 'chip' }: Props) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!onChange) {
    return (
      <span className={`capo capo-${variant}${capoChosen(capo) ? '' : ' is-unset'}`}>
        <i className="capo-bar" />
        {capoLabel(capo)}
      </span>
    );
  }

  return (
    <div className="capo-wrap" ref={wrap}>
      <button
        type="button"
        className={`capo capo-chip${capoChosen(capo) ? '' : ' is-unset'}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <i className="capo-bar" />
        {capoChosen(capo) ? capoLabel(capo) : 'Set the capo'}
        <CaretDown size={12} />
      </button>

      {open && (
        <ul className="capo-menu" role="listbox" aria-label="Capo position">
          <li>
            <button
              type="button"
              role="option"
              aria-selected={capo === null}
              className={capo === null ? 'is-on' : undefined}
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              No capo
            </button>
          </li>
          {CAPO_FRETS.map((fret) => (
            <li key={fret}>
              <button
                type="button"
                role="option"
                aria-selected={capo === fret}
                className={capo === fret ? 'is-on' : undefined}
                onClick={() => {
                  onChange(fret);
                  setOpen(false);
                }}
              >
                {ordinal(fret)} fret
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
