import {
  type Firestore,
  deleteDoc,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';

/**
 * The handle a song travels under. Songs are shared as copies that outlive the
 * link that carried them, so whatever names the sender is baked into somebody
 * else's library permanently — which is why it is a handle and never the email
 * address. See ROADMAP.md §1.
 *
 * Two forms, deliberately: `display` is what the user typed, `handle` is that
 * lowercased, and only the second is ever a document id or an equality check.
 * "Rory" and "rory" must not be two accounts, but someone who capitalises their
 * own name should see it capitalised back.
 *
 * The claim itself is in `claimUsername`. Everything above it here is pure, so
 * the rules that decide whether a name is allowed are testable without a
 * network, an emulator, or a signed-in user.
 */

/** Mirrors the pattern in `firestore.rules` — change both together. */
export const HANDLE_RE = /^[a-z0-9][a-z0-9_.]{1,23}$/;

export const MIN_HANDLE = 2;
export const MAX_HANDLE = 24;

/**
 * Names nobody gets to hold. Impersonation risk rather than squatting: a song
 * that says "from support" should not be something a stranger can arrange.
 */
const RESERVED = new Set([
  'admin',
  'administrator',
  'chordcreator',
  'chord_creator',
  'help',
  'me',
  'moderator',
  'official',
  'root',
  'security',
  'staff',
  'support',
  'system',
  'team',
  'user',
]);

/**
 * The stored form of what the user typed. Lowercased, trimmed, and with any
 * leading `@` dropped — people type the sigil out of habit, and rejecting them
 * for it would be pedantry. Internal whitespace becomes `_` rather than being
 * stripped, so "Rory Neary" suggests `rory_neary` instead of the surprising
 * `roryneary`.
 */
export function normaliseHandle(input: string): string {
  return input
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_.]/g, '');
}

export type HandleProblem =
  | { ok: true }
  | { ok: false; reason: string };

/** Why a handle is refused, in words a person can act on. */
export function checkHandle(input: string): HandleProblem {
  const handle = normaliseHandle(input);
  if (!handle) return { ok: false, reason: 'Pick a name people will recognise.' };
  if (handle.length < MIN_HANDLE)
    return { ok: false, reason: `At least ${MIN_HANDLE} characters.` };
  if (handle.length > MAX_HANDLE)
    return { ok: false, reason: `At most ${MAX_HANDLE} characters.` };
  if (!/^[a-z0-9]/.test(handle))
    return { ok: false, reason: 'Start with a letter or a number.' };
  if (!HANDLE_RE.test(handle))
    return { ok: false, reason: 'Letters, numbers, dots and underscores only.' };
  if (RESERVED.has(handle)) return { ok: false, reason: 'That one is spoken for.' };
  return { ok: true };
}

/** A first suggestion from an email or a Google display name — never claimed silently. */
export function suggestHandle(from: string): string {
  const base = normaliseHandle(from.split('@')[0] ?? '');
  return checkHandle(base).ok ? base : '';
}

export interface UsernameDoc {
  uid: string;
  /** What the user typed, casing intact. The id carries the lowercased form. */
  display: string;
}

export async function handleIsFree(db: Firestore, handle: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'usernames', handle));
  return !snap.exists();
}

export async function lookupHandle(
  db: Firestore,
  handle: string,
): Promise<UsernameDoc | null> {
  const snap = await getDoc(doc(db, 'usernames', normaliseHandle(handle)));
  return snap.exists() ? (snap.data() as UsernameDoc) : null;
}

export class HandleTakenError extends Error {
  readonly handle: string;
  constructor(handle: string) {
    super(`@${handle} is already taken.`);
    this.name = 'HandleTakenError';
    this.handle = handle;
  }
}

/**
 * Claims a handle for a uid, and writes it onto the user's own profile so the
 * app can render it without a second lookup.
 *
 * In a transaction because a free-then-write pair is a race: two people can
 * both read "free" before either writes. The transaction re-reads inside the
 * commit, so the loser fails rather than overwriting — and the rules refuse
 * `update` on a claim outright, so even a bug here cannot take a name that is
 * already somebody's.
 */
export async function claimUsername(
  db: Firestore,
  uid: string,
  input: string,
): Promise<string> {
  const problem = checkHandle(input);
  if (!problem.ok) throw new Error(problem.reason);

  const handle = normaliseHandle(input);
  const display = input.trim().replace(/^@+/, '');

  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'usernames', handle);
    const existing = await tx.get(ref);
    if (existing.exists()) {
      // Re-claiming your own name is a no-op rather than an error: the sign-in
      // flow can offer the handle a user already holds without special-casing.
      if ((existing.data() as UsernameDoc).uid === uid) return;
      throw new HandleTakenError(handle);
    }
    tx.set(ref, { uid, display, claimedAt: serverTimestamp() });
    tx.set(
      doc(db, 'users', uid),
      { handle, display, updatedAt: serverTimestamp() },
      { merge: true },
    );
  });

  return handle;
}

/**
 * Releases a handle. Renaming is delete-then-claim, never an edit, so a claim
 * document's id and the uid inside it can never drift apart.
 *
 * Songs already shared keep working: `copiedFrom` stores the uid and treats the
 * handle as a display lookup, exactly so a rename does not orphan them.
 */
export async function releaseUsername(db: Firestore, handle: string): Promise<void> {
  await deleteDoc(doc(db, 'usernames', normaliseHandle(handle)));
}
