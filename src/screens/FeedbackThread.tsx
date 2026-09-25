import { type FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowBendUpLeft, ArrowLeft } from '@phosphor-icons/react';
import { firebaseEnabled } from '../lib/firebase';
import {
  MAX_BODY,
  authorLabel,
  mentionedHandles,
  postProblem,
  postedWhen,
  replyingTo,
  splitMentions,
} from '../lib/feedback';
import { postFailure, reply, resolveMentions, watchThread } from '../lib/feedbackSync';
import { errorCode, syncErrorReason } from '../lib/syncStatus';
import type { FeedbackAuthor, FeedbackPost, FeedbackThread, Mention } from '../types/feedback';

interface Props {
  threadId: string;
  /** Who is replying. Null signed out, when the thread cannot be read at all. */
  author: FeedbackAuthor | null;
  /** Everything waiting for this player: this thread's are cleared on arrival. */
  mentions: Mention[];
  onSeen: (threadId: string) => void;
  onSignIn: () => void;
  onBack: () => void;
}

/** A post's words, with every @ drawn as a name rather than as text. */
function PostBody({ body }: { body: string }) {
  return (
    <p className="feedback-body">
      {splitMentions(body).map((part, i) =>
        'handle' in part ? (
          <span key={i} className="feedback-at">
            {part.text}
          </span>
        ) : (
          part.text
        ),
      )}
    </p>
  );
}

/**
 * One piece of feedback and the conversation under it, kept live while it is
 * open. Opening it is what clears the notices that brought you here; a post
 * that @-s you stays picked out after that, because that comes from the post
 * itself, not from the notice.
 */
export default function FeedbackThreadScreen({
  threadId,
  author,
  mentions,
  onSeen,
  onSignIn,
  onBack,
}: Props) {
  const [thread, setThread] = useState<FeedbackThread | null>(null);
  const [posts, setPosts] = useState<FeedbackPost[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'gone' | 'failed'>('loading');
  const [reason, setReason] = useState('');
  const [attempt, setAttempt] = useState(0);

  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  /* The post a notice brought you to, scrolled to once when it arrives. Taken
     on arrival: the notice itself is deleted a moment later. */
  const [arrivedFor] = useState(
    () => mentions.find((m) => m.threadId === threadId)?.postId ?? null,
  );
  const arriveAt = useRef(arrivedFor);

  const available = firebaseEnabled && !!author;

  useEffect(() => {
    if (!available) return;
    let gotThread = false;
    let gotPosts = false;
    const settle = () => {
      if (gotThread && gotPosts) setState((s) => (s === 'gone' ? s : 'ready'));
    };
    return watchThread(
      threadId,
      (next) => {
        gotThread = true;
        setThread(next);
        if (!next) setState('gone');
        settle();
      },
      (next) => {
        gotPosts = true;
        setPosts(next);
        settle();
      },
      (err) => {
        console.error('Could not load the feedback', err);
        setReason(syncErrorReason(errorCode(err)));
        setState('failed');
      },
    );
  }, [available, threadId, attempt]);

  /* Here, so what brought you here has been seen — including a notice that
     arrives while you are reading. */
  useEffect(() => {
    if (mentions.some((m) => m.threadId === threadId)) onSeen(threadId);
  }, [mentions, threadId, onSeen]);

  useEffect(() => {
    const id = arriveAt.current;
    if (!id || !posts.some((p) => p.id === id)) return;
    document.getElementById(`post-${id}`)?.scrollIntoView({ block: 'center' });
    arriveAt.current = null;
  }, [posts]);

  const replyTo = (handle: string) => {
    setDraft((d) => replyingTo(d, handle));
    const el = box.current;
    if (el) {
      el.focus();
      // After the new text is in, so the caret lands at its end.
      requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length));
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!author || !thread) return;
    const problem = postProblem(draft);
    if (problem) {
      setError(problem);
      return;
    }
    if (!navigator.onLine) {
      setError('There is no signal, so it cannot be posted yet. What you wrote is still here.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const to = await resolveMentions(mentionedHandles(draft), author);
      await reply(author, thread, draft, to);
      setDraft('');
    } catch (err) {
      setError(postFailure(err));
    } finally {
      setBusy(false);
    }
  };

  const back = (
    <button type="button" className="icon-btn" onClick={onBack} aria-label="Back">
      <ArrowLeft size={20} />
    </button>
  );

  if (!available) {
    return (
      <div className="songs feedback">
        {back}
        <h1 className="display-sm">Feedback</h1>
        <div className="songs-empty">
          {firebaseEnabled ? (
            <>
              <p>Feedback is for people signed in.</p>
              <button type="button" className="btn-primary btn-block" onClick={onSignIn}>
                Sign in
              </button>
            </>
          ) : (
            <p>This build has no database, so there is no feedback to read.</p>
          )}
        </div>
      </div>
    );
  }

  if (state === 'gone') {
    return (
      <div className="songs feedback">
        {back}
        <h1 className="display-sm">Not here</h1>
        <div className="songs-empty">
          <p>This feedback is not here any more.</p>
        </div>
      </div>
    );
  }

  if (state === 'failed') {
    return (
      <div className="songs feedback">
        {back}
        <h1 className="display-sm">Feedback</h1>
        <div className="songs-empty">
          <p>Could not load it: {reason}.</p>
          <button
            type="button"
            className="btn-secondary btn-block"
            onClick={() => {
              setState('loading');
              setAttempt((n) => n + 1);
            }}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="songs feedback">
      {back}
      <h1 className="display-sm feedback-title">{thread?.title ?? ''}</h1>
      {state === 'loading' && <p className="field-note">Looking…</p>}

      <ol className="feedback-posts">
        {posts.map((post, i) => {
          const mine = post.authorUid === author.uid;
          const forMe = !mine && post.mentions.includes(author.uid);
          return (
            <li
              key={post.id}
              id={`post-${post.id}`}
              className={`card feedback-post${forMe ? ' is-for-me' : ''}`}
            >
              <header className="feedback-post-head">
                <strong>{authorLabel(post)}</strong>
                {i === 0 && <span className="tag">Started this</span>}
                {forMe && <span className="tag tag-alert">Mentions you</span>}
                <time>{postedWhen(post.createdAt)}</time>
              </header>
              <PostBody body={post.body} />
              {!mine && (
                <button
                  type="button"
                  className="btn-ghost feedback-reply-to"
                  onClick={() => replyTo(post.handle)}
                >
                  <ArrowBendUpLeft size={14} />
                  Reply to {authorLabel(post)}
                </button>
              )}
            </li>
          );
        })}
      </ol>

      {state === 'ready' && thread && (
        <form className="feedback-compose feedback-reply" onSubmit={(e) => void submit(e)}>
          <label className="micro-label" htmlFor="feedback-reply">
            Reply
          </label>
          <textarea
            id="feedback-reply"
            ref={box}
            className="input feedback-text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={MAX_BODY}
            rows={3}
          />
          <p className="field-note">
            Type @ and someone’s name to let them know, the next time they open the app.
          </p>
          {error && <p className="field-note is-error">{error}</p>}
          <span className="feedback-actions">
            <button type="submit" className="btn-primary" disabled={busy || !draft.trim()}>
              {busy ? 'Posting…' : 'Post reply'}
            </button>
          </span>
        </form>
      )}
    </div>
  );
}
