import type { FeedbackPost, FeedbackThread, Mention } from '../types/feedback';

/**
 * The pure half of feedback: what may be posted, which names in a post are
 * @-ed, and how a post is drawn. `feedbackSync.ts` is the half that talks to
 * the database. The limits are mirrored in `firestore.rules` — change both.
 */

export const MAX_TITLE = 120;
export const MAX_BODY = 4000;
/**
 * At most this many people @-ed in one post. The rules check each notice
 * against the post it points at, and every such check is a document read the
 * rules are only allowed so many of per write.
 */
export const MAX_MENTIONS = 5;
/** How much of a post a notice carries. */
export const EXCERPT_CHARS = 140;
/** The rules allow a little more than `EXCERPT_CHARS`, for the ellipsis. */
export const MAX_EXCERPT = 200;

/**
 * An @ and a handle, where the @ starts a word: "@rory", "(@rory)", but not the
 * middle of an email address. The handle part is `HANDLE_RE` in
 * `lib/username.ts` without its length cap, which is checked on the way out.
 */
const MENTION_RE = /(^|[^a-z0-9_.@])@([a-z0-9][a-z0-9_.]*)/gi;

/**
 * A handle may contain dots, and a sentence may end in one: "thanks @rory."
 * The sentence is far more likely, so a trailing dot is punctuation, and a
 * handle that ends in a dot cannot be @-ed. It can still read and reply.
 */
const trimHandle = (raw: string) => raw.replace(/\.+$/, '').toLowerCase();

const isHandle = (h: string) => h.length >= 2 && h.length <= 24;

/** The handles @-ed in a post, lowercased, each once, in the order they appear. */
export function mentionedHandles(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(MENTION_RE)) {
    const handle = trimHandle(m[2]);
    if (isHandle(handle) && !out.includes(handle)) out.push(handle);
  }
  return out;
}

export type BodyPart = { text: string } | { text: string; handle: string };

/**
 * A post cut into plain runs and mentions, so the mentions can be drawn apart.
 * Joining every part's `text` gives back the post exactly.
 */
export function splitMentions(text: string): BodyPart[] {
  const parts: BodyPart[] = [];
  let at = 0;
  for (const m of text.matchAll(MENTION_RE)) {
    const handle = trimHandle(m[2]);
    if (!isHandle(handle)) continue;
    const start = (m.index ?? 0) + m[1].length;
    // The @ and the handle as typed, without the dot that ended the sentence.
    const typed = `@${m[2].slice(0, handle.length)}`;
    if (start > at) parts.push({ text: text.slice(at, start) });
    parts.push({ text: typed, handle });
    at = start + typed.length;
  }
  if (at < text.length) parts.push({ text: text.slice(at) });
  return parts;
}

/**
 * The text to put in the reply box when replying to someone: an @ for them at
 * the front, unless they are @-ed already.
 */
export function replyingTo(draft: string, handle: string): string {
  if (mentionedHandles(draft).includes(handle)) return draft;
  const rest = draft.replace(/^\s+/, '');
  return rest ? `@${handle} ${rest}` : `@${handle} `;
}

/** Why a new thread cannot be posted as it is, or null when it can. */
export function threadProblem(title: string, body: string): string | null {
  if (!title.trim()) return 'Give it a line that says what it is about.';
  if (title.trim().length > MAX_TITLE) return `Keep the first line under ${MAX_TITLE} characters.`;
  return postProblem(body);
}

/** Why a post cannot be posted as it is, or null when it can. */
export function postProblem(body: string): string | null {
  if (!body.trim()) return 'There is nothing written yet.';
  if (body.trim().length > MAX_BODY) return `That is longer than ${MAX_BODY} characters.`;
  if (mentionedHandles(body).length > MAX_MENTIONS) {
    return `At most ${MAX_MENTIONS} people can be @-ed in one post.`;
  }
  return null;
}

/** The start of a post, on one line, cut at a word. */
export function excerpt(body: string, max = EXCERPT_CHARS): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s.,;:!?-]+$/, '')}…`;
}

/** The notice's id: one per person per post, so posting twice cannot ping twice. */
export const mentionId = (postId: string, uid: string) => `${postId}_${uid}`;

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/**
 * When something was posted, as a person says it: "just now", "5 min ago",
 * "3 h ago", then the day. The month is spelled out by hand for the reason
 * `buildDay` in `lib/version.ts` gives. This one is in local time: it answers
 * "how long ago", not "which build".
 */
export function postedWhen(at: number, now: number = Date.now()): string {
  const ago = Math.max(0, now - at);
  const min = Math.floor(ago / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} h ago`;
  const then = new Date(at);
  const day = `${then.getDate()} ${MONTHS[then.getMonth()]}`;
  return then.getFullYear() === new Date(now).getFullYear() ? day : `${day} ${then.getFullYear()}`;
}

/** "3 replies", from the post count, which includes the opening post. */
export function replyCount(thread: Pick<FeedbackThread, 'postCount'>): string {
  const replies = Math.max(0, thread.postCount - 1);
  if (replies === 0) return 'No replies yet';
  return `${replies} ${replies === 1 ? 'reply' : 'replies'}`;
}

/** "@Rory", the way `senderLabel` names a sender. */
export const authorLabel = (a: { display?: string; handle: string }) =>
  `@${a.display?.trim() || a.handle}`;

/* Reading what the database holds. Each one is null for anything it cannot
   read, rather than throwing: a malformed document is somebody else's, and one
   bad thread must not blank the list. */

const str = (x: unknown): x is string => typeof x === 'string';
const num = (x: unknown, fallback: number) =>
  typeof x === 'number' && Number.isFinite(x) ? x : fallback;

export function parseThread(id: string, x: unknown): FeedbackThread | null {
  if (typeof x !== 'object' || x === null) return null;
  const raw = x as Record<string, unknown>;
  if (!str(raw.authorUid) || !str(raw.handle) || !str(raw.title)) return null;
  const display = str(raw.display) ? raw.display : raw.handle;
  const createdAt = num(raw.createdAt, 0);
  return {
    id,
    authorUid: raw.authorUid,
    handle: raw.handle,
    display,
    title: raw.title,
    postCount: Math.max(1, num(raw.postCount, 1)),
    lastPostId: str(raw.lastPostId) ? raw.lastPostId : '',
    lastBy: str(raw.lastBy) ? raw.lastBy : display,
    createdAt,
    updatedAt: num(raw.updatedAt, createdAt),
  };
}

export function parsePost(threadId: string, id: string, x: unknown): FeedbackPost | null {
  if (typeof x !== 'object' || x === null) return null;
  const raw = x as Record<string, unknown>;
  if (!str(raw.authorUid) || !str(raw.handle) || !str(raw.body)) return null;
  return {
    id,
    threadId,
    authorUid: raw.authorUid,
    handle: raw.handle,
    display: str(raw.display) ? raw.display : raw.handle,
    body: raw.body,
    mentions: Array.isArray(raw.mentions) ? raw.mentions.filter(str) : [],
    createdAt: num(raw.createdAt, 0),
  };
}

export function parseMention(id: string, x: unknown): Mention | null {
  if (typeof x !== 'object' || x === null) return null;
  const raw = x as Record<string, unknown>;
  if (!str(raw.toUid) || !str(raw.fromUid) || !str(raw.threadId) || !str(raw.postId)) return null;
  const fromHandle = str(raw.fromHandle) ? raw.fromHandle : '';
  return {
    id,
    toUid: raw.toUid,
    fromUid: raw.fromUid,
    fromHandle,
    fromDisplay: str(raw.fromDisplay) ? raw.fromDisplay : fromHandle,
    threadId: raw.threadId,
    postId: raw.postId,
    title: str(raw.title) ? raw.title : '',
    excerpt: str(raw.excerpt) ? raw.excerpt : '',
    createdAt: num(raw.createdAt, 0),
  };
}

/** Newest first, the order they are listed in. */
export const byNewest = <T extends { createdAt: number }>(a: T, b: T) => b.createdAt - a.createdAt;
