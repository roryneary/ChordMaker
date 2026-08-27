import { useEffect, useRef, useState } from 'react';

interface Props {
  onCreate: (title: string) => void;
}

/** Step one: every chord belongs to a song, so the song comes first. */
export default function SongStart({ onCreate }: Props) {
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const trimmed = title.trim();

  return (
    <form
      className="start"
      onSubmit={(e) => {
        e.preventDefault();
        if (trimmed) onCreate(trimmed);
      }}
    >
      <h2 className="start-title">New song</h2>
      <p className="start-hint">Name the song, then add each of its chords.</p>
      <label className="sheet-label" htmlFor="song-title">
        Song title
      </label>
      <input
        id="song-title"
        ref={inputRef}
        className="sheet-input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Blackbird"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="go"
      />
      <button type="submit" className="btn btn-primary" disabled={!trimmed}>
        Create song
      </button>
    </form>
  );
}
