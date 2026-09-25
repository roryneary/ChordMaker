/**
 * Feedback on the app: a thread anyone signed in can start, and everyone signed
 * in can read and reply to. See README, "Feedback".
 *
 * Unlike a song, none of this is the player's own, and none of it is on the
 * device: it is a conversation, other people's words, and it is read from the
 * database as it is now. Nothing here goes near the song store.
 */

/** Who wrote something. The rules check the handle is really theirs. */
export interface FeedbackAuthor {
  uid: string;
  /** The claimed handle, lowercased. */
  handle: string;
  /** The handle as they typed it, for display. */
  display: string;
}

/**
 * `feedback/{id}`. The words are not here: the opening post is the first of the
 * thread's posts, so an @ in it works exactly as one in a reply does.
 */
export interface FeedbackThread {
  id: string;
  authorUid: string;
  handle: string;
  display: string;
  title: string;
  /** The opening post counts: a thread nobody has answered has one. */
  postCount: number;
  /** The newest post's id. The rules use it to tie a post to its thread. */
  lastPostId: string;
  /** Who wrote the newest post, as displayed. */
  lastBy: string;
  createdAt: number;
  /** When the newest post was written: the list is in this order. */
  updatedAt: number;
}

/** `feedback/{threadId}/posts/{id}`. Never edited, so it carries one stamp. */
export interface FeedbackPost {
  id: string;
  threadId: string;
  authorUid: string;
  handle: string;
  display: string;
  body: string;
  /** The uids @-ed in `body`, as they were when it was posted. */
  mentions: string[];
  createdAt: number;
}

/** Someone @-ed in a post, by uid, with the handle it was typed as. */
export interface MentionTarget {
  uid: string;
  handle: string;
}

/**
 * `mentions/{postId}_{toUid}`: somebody @-ed you, waiting until you look. It is
 * deleted when you open the thread — it is a notice, not a record, and the post
 * it points at is the record.
 */
export interface Mention {
  id: string;
  toUid: string;
  fromUid: string;
  fromHandle: string;
  fromDisplay: string;
  threadId: string;
  postId: string;
  /** The thread's title, so the notice can say where without a second read. */
  title: string;
  /** The start of the post. */
  excerpt: string;
  createdAt: number;
}
