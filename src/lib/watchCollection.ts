import { type CollectionReference, type DocumentData, onSnapshot } from 'firebase/firestore';

/**
 * Listens to one of the account's collections and hands back the whole of it,
 * parsed, every time anything in it changes — on this device or another. This
 * is what makes a chord kept on the phone appear on the laptop without anyone
 * reloading anything.
 *
 * **Only what the server has vouched for is passed on.** With no signal the SDK
 * still answers, from whatever it has cached — which, with nothing cached, is
 * an empty collection. The merge reads a missing entry as one deleted on
 * another device (`mergeOnSignIn`, `known`), so passing that on would empty the
 * library the first time the app opened underground. Cached answers are
 * skipped; the next one from the server says what is really there.
 *
 * An answer that includes this device's own unsent writes is passed on: those
 * ids are on the store's unconfirmed lists, where local always wins.
 *
 * `onError` ends the listening — the SDK does not resume after one. Returns the
 * function that stops it.
 */
export function watchCollection<T>(
  ref: CollectionReference,
  parse: (data: DocumentData & { id: string }) => T | null,
  onList: (list: T[]) => void,
  onError: (err: unknown) => void,
): () => void {
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.metadata.fromCache) return;
      const list: T[] = [];
      for (const d of snap.docs) {
        // The doc id is the entry's id, and the parsers read it from the
        // fields — the two must agree, so the doc's own id is passed in.
        const entry = parse({ ...d.data(), id: d.id });
        if (entry !== null) list.push(entry);
      }
      onList(list);
    },
    onError,
  );
}
