import { useEffect, useRef, useState } from 'react';

interface Props {
  initialName: string;
  busy: boolean;
  /** Wording for the primary action, e.g. "Add to song" or "Update chord". */
  saveLabel: string;
  onCancel: () => void;
  onSave: (name: string) => void;
}

export default function NameSheet({ initialName, busy, saveLabel, onCancel, onSave }: Props) {
  const [name, setName] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <form
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Name this chord"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(name);
        }}
      >
        <label className="sheet-label" htmlFor="chord-name">
          Chord name
        </label>
        <input
          id="chord-name"
          ref={inputRef}
          className="sheet-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="D Maj13"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="done"
        />
        <div className="sheet-actions">
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : saveLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
