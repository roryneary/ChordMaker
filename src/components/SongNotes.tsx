import { useState } from 'react';
import { Plus, Trash } from '@phosphor-icons/react';
import { MAX_NOTE_CHARS, NOTE_KINDS, NOTE_KIND_LABEL } from '../lib/notes';
import type { NoteKind, SongNote, Word } from '../types/song';

export interface NoteHandlers {
  onAdd: (note: SongNote) => void;
  onUpdate: (noteId: string, text: string, kind?: NoteKind) => void;
  onRemove: (noteId: string) => void;
}

/** The kind, as a small select: a strumming pattern typed as a general note is easily moved. */
function KindPicker({ kind, onChange }: { kind: NoteKind; onChange: (kind: NoteKind) => void }) {
  return (
    <select
      className="note-kind"
      value={kind}
      onChange={(e) => onChange(e.target.value as NoteKind)}
      aria-label="What kind of note"
    >
      {NOTE_KINDS.map((k) => (
        <option key={k} value={k}>
          {NOTE_KIND_LABEL[k]}
        </option>
      ))}
    </select>
  );
}

/**
 * One note, edited in place. Committed when the box loses focus rather than per
 * keystroke — a note is a sentence, not a title, and a write per letter of it
 * would tell everyone holding a copy about every letter. Rubbing it out and
 * leaving removes it.
 */
export function NoteField({
  note,
  on,
  where,
}: {
  note: SongNote;
  on: NoteHandlers;
  /** "on “ring”", for a note tied to a word. */
  where?: string;
}) {
  const [text, setText] = useState(note.text);
  return (
    <div className={`note note-${note.kind}`}>
      <div className="note-head">
        <KindPicker kind={note.kind} onChange={(kind) => on.onUpdate(note.id, text, kind)} />
        {where && <em className="note-where">{where}</em>}
        <span className="spacer" />
        <button
          type="button"
          className="icon-btn note-remove"
          onClick={() => on.onRemove(note.id)}
          aria-label="Remove this note"
        >
          <Trash size={15} />
        </button>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => on.onUpdate(note.id, text)}
        maxLength={MAX_NOTE_CHARS}
        rows={Math.min(8, Math.max(2, text.split('\n').length))}
        spellCheck={note.kind === 'general'}
        aria-label={NOTE_KIND_LABEL[note.kind]}
      />
    </div>
  );
}

/**
 * A note not yet written. Nothing is stored until there is text in it, so
 * tapping "add" and thinking better of it leaves nothing behind.
 */
export function NoteDraft({
  kind: initialKind,
  wordId,
  onAdd,
  onDone,
  newId,
}: {
  kind: NoteKind;
  wordId?: string;
  onAdd: NoteHandlers['onAdd'];
  onDone: () => void;
  newId: () => string;
}) {
  const [kind, setKind] = useState(initialKind);
  const [text, setText] = useState('');
  const commit = () => {
    if (text.trim()) onAdd({ id: newId(), kind, text, ...(wordId ? { wordId } : {}) });
    onDone();
  };
  return (
    <div className={`note note-${kind} is-draft`}>
      <div className="note-head">
        <KindPicker kind={kind} onChange={setKind} />
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        maxLength={MAX_NOTE_CHARS}
        rows={3}
        autoFocus
        spellCheck={kind === 'general'}
        placeholder={
          kind === 'strum'
            ? 'D  DU  UDU'
            : kind === 'picking'
              ? 'T 3 2 3  T 3 2 3'
              : wordId
                ? 'What to do from here'
                : 'How to play it'
        }
        aria-label={`New ${NOTE_KIND_LABEL[kind].toLowerCase()} note`}
      />
    </div>
  );
}

interface Props {
  notes: SongNote[] | undefined;
  words: Word[];
  on: NoteHandlers;
  newId: () => string;
}

/**
 * The song screen's notes: how to play it, strumming and picking patterns, and
 * the notes on words, listed with the word they are on so they can be found
 * and changed without hunting through the lyric.
 */
export default function SongNotes({ notes, words, on, newId }: Props) {
  const [drafting, setDrafting] = useState<NoteKind | null>(null);
  const textOf = (wordId: string) => words.find((w) => w.id === wordId)?.text ?? '';
  const all = notes ?? [];

  return (
    <div className="song-notes">
      {all.map((note) => (
        <NoteField
          /* Keyed on the text too: a note changed from outside (the sender's
             new version replacing this one) starts its box afresh. */
          key={`${note.id}:${note.text}`}
          note={note}
          on={on}
          where={note.wordId ? `on “${textOf(note.wordId)}”` : undefined}
        />
      ))}
      {drafting && (
        <NoteDraft kind={drafting} onAdd={on.onAdd} onDone={() => setDrafting(null)} newId={newId} />
      )}
      {!drafting && (
        <div className="note-adds">
          {NOTE_KINDS.map((kind) => (
            <button key={kind} type="button" className="btn-ghost" onClick={() => setDrafting(kind)}>
              <Plus size={14} />
              {kind === 'general' ? 'A note' : NOTE_KIND_LABEL[kind]}
            </button>
          ))}
        </div>
      )}
      {all.length === 0 && !drafting && (
        <p className="note-hint">
          Anything you would tell someone playing it. Tap a word in the song to put a note on that
          part.
        </p>
      )}
    </div>
  );
}
