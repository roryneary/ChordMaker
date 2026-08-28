import { CaretDown } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';

interface Props {
  capo: number | null;
  /** Omit to render the read-only statement used on the reading screens. */
  onChange?: (capo: number | null) => void;
  /** The filled treatment used on the finished-song and full-screen views. */
  variant?: 'chip' | 'statement';
}

export const MAX_CAPO = 7;

export function ordinal(n: number): string {
  const suffix = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (suffix[(v - 20) % 10] ?? suffix[v] ?? suffix[0]);
}

export const capoLabel = (capo: number | null): string =>
  capo ? `Capo on the ${ordinal(capo)}` : 'No capo';

/**
 * A control on the editing screens, a statement on the reading ones. The small
 * accent bar reads as a capo laid across the neck.
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
      <span className={`capo capo-${variant}`}>
        <i className="capo-bar" />
        {capoLabel(capo)}
      </span>
    );
  }

  return (
    <div className="capo-wrap" ref={wrap}>
      <button
        type="button"
        className="capo capo-chip"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <i className="capo-bar" />
        {capoLabel(capo)}
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
          {Array.from({ length: MAX_CAPO }, (_, i) => i + 1).map((fret) => (
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
