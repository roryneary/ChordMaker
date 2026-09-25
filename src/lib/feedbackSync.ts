import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  where,
  writeBatch,
} from 'firebase/firestore';
import type {
  FeedbackAuthor,
  FeedbackPost,
  FeedbackThread,
  Mention,
  MentionTarget,
} from '../types/feedback';
import { getFirebaseDb } from './firebase';
import {
  MAX_EXCERPT,
  byNewest,
  excerpt,
  mentionId,
  parseMention,
  parsePost,
  parseThread,
} from './feedback';
import { newId } from './id';
import { errorCode, syncErrorReason } from './syncStatus';
import { lookupHandle } from './username';

/**
 * The remote half of feedback. Three collections, and every write touching
 * more than one of them goes in one batch, because `firestore.rules` checks
 * each document against the others *as the batch leaves them*:
 *
 * - `feedback/{id}` names its newest post, and a post can only be written
 *   while the thread names it — so no post exists without its thread knowing.
 * - `mentions/{postId}_{uid}` can only be written for a uid the post itself
 *   lists, by the post's own author — so nobody can be pinged by a post that
 *   does not @ them, or in someone else's name.
 *
 * None of this goes through the song store or its unconfirmed list: like
 * sharing, posting is something the player asks for and waits on. Every
 * function rejects on failure and none of them catches.
 */

const threads = () => collection(getFirebaseDb(), 'feedback');
const threadDoc = (id: string) => doc(getFirebaseDb(), 'feedback', id);
const posts = (threadId: string) => collection(getFirebaseDb(), 'feedback', threadId, 'posts');
const postDoc = (threadId: string, id: string) =>
  doc(getFirebaseDb(), 'feedback', threadId, 'posts', id);
const mentionDoc = (id: string) => doc(getFirebaseDb(), 'mentions', id);

export const THREADS_PAGE = 30;

export class NobodyCalledError extends Error {
  readonly handles: string[];
  constructor(handles: string[]) {
    const named = handles.map((h) => `@${h}`).join(', ');
    super(
      handles.length === 1
        ? `Nobody here is called ${named}. Check the name, or take the @ off.`
        : `Nobody here is called ${named}. Check the names, or take the @ off.`,
    );
    this.name = 'NobodyCalledError';
    this.handles = handles;
  }
}

/** Why a post did not go, as a sentence. */
export function postFailure(err: unknown): string {
  if (err instanceof NobodyCalledError) return err.message;
  console.error('Could not post feedback', err);
  return `It was not posted: ${syncErrorReason(errorCode(err))}. What you wrote is still here.`;
}

/**
 * Who the @-ed handles belong to. Throws `NobodyCalledError` naming every one
 * that is not claimed, rather than posting and quietly telling nobody: someone
 * who typed an @ expects that person to hear about it. The poster's own handle
 * is dropped — there is no telling yourself.
 */
export async function resolveMentions(
  handles: string[],
  self: FeedbackAuthor,
): Promise<MentionTarget[]> {
  const others = handles.filter((h) => h !== self.handle);
  const found = await Promise.all(
    others.map(async (handle) => ({ handle, doc: await lookupHandle(getFirebaseDb(), handle) })),
  );
  const missing = found.filter((f) => !f.doc).map((f) => f.handle);
  if (missing.length) throw new NobodyCalledError(missing);
  const out: MentionTarget[] = [];
  for (const f of found) {
    // Two handles, one person, is possible after a rename; tell them once.
    if (f.doc && f.doc.uid !== self.uid && !out.some((t) => t.uid === f.doc!.uid)) {
      out.push({ uid: f.doc.uid, handle: f.handle });
    }
  }
  return out;
}

function writeMentions(
  batch: ReturnType<typeof writeBatch>,
  author: FeedbackAuthor,
  threadId: string,
  title: string,
  postId: string,
  body: string,
  to: MentionTarget[],
  now: number,
) {
  for (const target of to) {
    batch.set(mentionDoc(mentionId(postId, target.uid)), {
      toUid: target.uid,
      fromUid: author.uid,
      fromHandle: author.handle,
      fromDisplay: author.display,
      threadId,
      postId,
      title,
      excerpt: excerpt(body).slice(0, MAX_EXCERPT),
      createdAt: now,
    });
  }
}

/** A new thread, its opening post, and a notice for everyone it @-s. Returns its id. */
export async function startThread(
  author: FeedbackAuthor,
  title: string,
  body: string,
  to: MentionTarget[],
): Promise<string> {
  const threadId = newId();
  const postId = newId();
  const now = Date.now();
  const cleanTitle = title.trim();
  const cleanBody = body.trim();

  const batch = writeBatch(getFirebaseDb());
  batch.set(threadDoc(threadId), {
    authorUid: author.uid,
    handle: author.handle,
    display: author.display,
    title: cleanTitle,
    postCount: 1,
    lastPostId: postId,
    lastBy: author.display,
    createdAt: now,
    updatedAt: now,
  });
  batch.set(postDoc(threadId, postId), {
    authorUid: author.uid,
    handle: author.handle,
    display: author.display,
    body: cleanBody,
    mentions: to.map((t) => t.uid),
    createdAt: now,
  });
  writeMentions(batch, author, threadId, cleanTitle, postId, cleanBody, to, now);
  await batch.commit();
  return threadId;
}

/**
 * A reply. The count goes up by `increment` rather than by a number this
 * device worked out, so two people replying at once both count.
 */
export async function reply(
  author: FeedbackAuthor,
  thread: FeedbackThread,
  body: string,
  to: MentionTarget[],
): Promise<void> {
  const postId = newId();
  const now = Date.now();
  const cleanBody = body.trim();

  const batch = writeBatch(getFirebaseDb());
  batch.update(threadDoc(thread.id), {
    postCount: increment(1),
    lastPostId: postId,
    lastBy: author.display,
    updatedAt: now,
  });
  batch.set(postDoc(thread.id, postId), {
    authorUid: author.uid,
    handle: author.handle,
    display: author.display,
    body: cleanBody,
    mentions: to.map((t) => t.uid),
    createdAt: now,
  });
  writeMentions(batch, author, thread.id, thread.title, postId, cleanBody, to, now);
  await batch.commit();
}

/** The threads, most recently posted in first. `after` is the last of the page before. */
export async function fetchThreads(after?: FeedbackThread): Promise<FeedbackThread[]> {
  const snap = await getDocs(
    after
      ? query(threads(), orderBy('updatedAt', 'desc'), startAfter(after.updatedAt), limit(THREADS_PAGE))
      : query(threads(), orderBy('updatedAt', 'desc'), limit(THREADS_PAGE)),
  );
  return snap.docs
    .map((d) => parseThread(d.id, d.data()))
    .filter((t): t is FeedbackThread => t !== null);
}

export async function fetchThread(id: string): Promise<FeedbackThread | null> {
  const snap = await getDoc(threadDoc(id));
  return snap.exists() ? parseThread(snap.id, snap.data()) : null;
}

/**
 * A thread and its posts, oldest post first, kept up to date while it is open:
 * it is a conversation, and a reply arriving while you read is the point.
 * Returns the unsubscribe.
 */
export function watchThread(
  id: string,
  onThread: (thread: FeedbackThread | null) => void,
  onPosts: (posts: FeedbackPost[]) => void,
  onError: (err: unknown) => void,
): () => void {
  const stopThread = onSnapshot(
    threadDoc(id),
    (snap) => onThread(snap.exists() ? parseThread(snap.id, snap.data()) : null),
    onError,
  );
  const stopPosts = onSnapshot(
    query(posts(id), orderBy('createdAt', 'asc')),
    (snap) =>
      onPosts(
        snap.docs
          .map((d) => parsePost(id, d.id, d.data()))
          .filter((p): p is FeedbackPost => p !== null),
      ),
    onError,
  );
  return () => {
    stopThread();
    stopPosts();
  };
}

/**
 * Everything waiting for this person, newest first. One equality filter and
 * the order is put right here, so it needs no index of its own; there are only
 * ever as many as have not been looked at. Returns the unsubscribe.
 */
export function watchMentions(
  uid: string,
  onChange: (mentions: Mention[]) => void,
  onError: (err: unknown) => void,
): () => void {
  return onSnapshot(
    query(collection(getFirebaseDb(), 'mentions'), where('toUid', '==', uid)),
    (snap) =>
      onChange(
        snap.docs
          .map((d) => parseMention(d.id, d.data()))
          .filter((m): m is Mention => m !== null)
          .sort(byNewest),
      ),
    onError,
  );
}

/** Looked at: the notices go. The posts they pointed at are the record. */
export async function clearMentions(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const batch = writeBatch(getFirebaseDb());
  for (const id of ids) batch.delete(mentionDoc(id));
  await batch.commit();
}
