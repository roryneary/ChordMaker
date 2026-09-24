import type { NoteKind, SongNote, Word } from '../types/song';

/* The account's limits (firestore.rules checks the count; a list's items are
   beyond what rules can look inside, so the length is the app's to keep). */
export const MAX_NOTES = 100;
export const MAX_NOTE_CHARS = 2_000;

export const NOTE_KINDS: readonly NoteKind[] = ['general', 'strum', 'picking'];

export const NOTE_KIND_LABEL: Record<NoteKind, string> = {
  general: 'How to play it',
  strum: 'Strumming',
  picking: 'Picking',
};

const isKind = (x: unknown): x is NoteKind => NOTE_KINDS.includes(x as NoteKind);

/** Tolerant, like the rest of `parseSong`: a malformed or empty note is dropped, not the song. */
export function parseNotes(x: unknown): SongNote[] {
  if (!Array.isArray(x)) return [];
  const out: SongNote[] = [];
  for (const raw of x) {
    if (typeof raw !== 'object' || raw === null) continue;
    const n = raw as Partial<SongNote>;
    if (typeof n.id !== 'string' || typeof n.text !== 'string' || !n.text.trim()) continue;
    out.push({
      id: n.id,
      kind: isKind(n.kind) ? n.kind : 'general',
      text: n.text,
      ...(typeof n.wordId === 'string' ? { wordId: n.wordId } : {}),
    });
  }
  return out;
}

/**
 * After a lyric edit: a note whose word is gone keeps its text and becomes one
 * about the whole song. Unlike a chord placement, which is only a pointer and
 * is dropped, a note is something somebody wrote. Hands back the same list when
 * every word survived.
 */
export function pruneNoteWords(notes: SongNote[], words: Word[]): SongNote[] {
  const live = new Set(words.map((w) => w.id));
  let changed = false;
  const out = notes.map((n) => {
    if (n.wordId === undefined || live.has(n.wordId)) return n;
    changed = true;
    const loose = { ...n };
    delete loose.wordId;
    return loose;
  });
  return changed ? out : notes;
}

/** The notes on each word, in the order they were written. */
export function notesByWord(notes: SongNote[] | undefined): Map<string, SongNote[]> {
  const by = new Map<string, SongNote[]>();
  for (const n of notes ?? []) {
    if (n.wordId === undefined) continue;
    const list = by.get(n.wordId);
    if (list) list.push(n);
    else by.set(n.wordId, [n]);
  }
  return by;
}

/** The notes about the whole song, general first, then strumming, then picking. */
export function songWideNotes(notes: SongNote[] | undefined): SongNote[] {
  return NOTE_KINDS.flatMap((kind) =>
    (notes ?? []).filter((n) => n.wordId === undefined && n.kind === kind),
  );
}
