import { type FormEvent, useEffect, useState } from 'react';
import { At, ChatCircleText } from '@phosphor-icons/react';
import { firebaseEnabled } from '../lib/firebase';
import {
  MAX_BODY,
  MAX_TITLE,
  authorLabel,
  mentionedHandles,
  postedWhen,
  replyCount,
  threadProblem,
} from '../lib/feedback';
import {
  THREADS_PAGE,
  fetchThreads,
  postFailure,
  resolveMentions,
  startThread,
} from '../lib/feedbackSync';
import { errorCode, syncErrorReason } from '../lib/syncStatus';
import type { FeedbackAuthor, FeedbackThread, Mention } from '../types/feedback';

interface Props {
  /** Signed in with a handle: who is posting. Null signed out. */
  author: FeedbackAuthor | null;
  /** Posts that @ this player and have not been looked at. */
  mentions: Mention[];
  onOpen: (threadId: string) => void;
  onSignIn: () => void;
}

/**
 * Feedback on the app, and the conversation about it.
 *
 * Signed-in only, reading as well as writing: a post goes out under a handle,
 * and everyone signed in can read it and reply. Like Shared songs it is no use
 * without a signal and says so rather than showing a stale list — this is a
 * conversation, and what is here is other people's.
 *
 * Whatever is waiting for you sits at the top, above the threads: it is the
 * reason most people open this screen after the first time.
 */
export default function Feedback({ author, mentions, onOpen, onSignIn }: Props) {
  const [list, setList] = useState<FeedbackThread[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [reason, setReason] = useState('');
  const [more, setMore] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const [writing, setWriting] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const available = firebaseEnabled && !!author;

  useEffect(() => {
    if (!available) return;
    let cancelled = false;
    fetchThreads().then(
      (found) => {
        if (cancelled) return;
        setList(found);
        setMore(found.length === THREADS_PAGE);
        setState('ready');
      },
      (err: unknown) => {
        if (cancelled) return;
        console.error('Could not load the feedback', err);
        setReason(syncErrorReason(errorCode(err)));
        setState('failed');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [available, attempt]);

  const loadMore = () => {
    const last = list[list.length - 1];
    if (!last) return;
    setMore(false);
    fetchThreads(last).then(
      (next) => {
        setList((have) => [...have, ...next.filter((t) => !have.some((h) => h.id === t.id))]);
        setMore(next.length === THREADS_PAGE);
      },
      () => setMore(true),
    );
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!author) return;
    const problem = threadProblem(title, body);
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
      const to = await resolveMentions(mentionedHandles(body), author);
      const id = await startThread(author, title, body, to);
      setTitle('');
      setBody('');
      setWriting(false);
      onOpen(id);
    } catch (err) {
      setError(postFailure(err));
    } finally {
      setBusy(false);
    }
  };

  const heading = (
    <>
      <h1 className="display-sm">Feedback</h1>
      <p className="library-sub">
        Something you would change, something that went wrong, an idea. Everyone signed in can
        read it and reply.
      </p>
    </>
  );

  if (!firebaseEnabled) {
    return (
      <div className="songs">
        {heading}
        <div className="songs-empty">
          <p>This build has no database, so there is nowhere to send feedback.</p>
        </div>
      </div>
    );
  }

  if (!author) {
    return (
      <div className="songs">
        {heading}
        <div className="songs-empty">
          <p>
            Feedback goes out under your name here, so it is for people signed in. Signing in
            also keeps your songs on every device.
          </p>
          <button type="button" className="btn-primary btn-block" onClick={onSignIn}>
            Sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="songs feedback">
      {heading}

      {mentions.length > 0 && (
        <section className="feedback-waiting" aria-label="Waiting for you">
          <p className="section-label">Waiting for you</p>
          <ul className="songs-list">
            {mentions.map((m) => (
              <li key={m.id}>
                <button type="button" className="card feedback-mention" onClick={() => onOpen(m.threadId)}>
                  <At size={16} weight="bold" />
                  <span>
                    <strong>
                      {authorLabel({ display: m.fromDisplay, handle: m.fromHandle })} mentioned
                      you in “{m.title}”
                    </strong>
                    <em>{m.excerpt}</em>
                  </span>
                  <time>{postedWhen(m.createdAt)}</time>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {writing ? (
        <form className="card feedback-compose" onSubmit={(e) => void submit(e)}>
          <label className="micro-label" htmlFor="feedback-title">
            What is it about?
          </label>
          <input
            id="feedback-title"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={MAX_TITLE}
            placeholder="The capo chip is easy to miss"
            autoFocus
          />
          <label className="micro-label" htmlFor="feedback-body">
            Say more
          </label>
          <textarea
            id="feedback-body"
            className="input feedback-text"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={MAX_BODY}
            rows={5}
          />
          <p className="field-note">
            Type @ and someone’s name to let them know, the next time they open the app.
          </p>
          {error && <p className="field-note is-error">{error}</p>}
          <span className="feedback-actions">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setWriting(false);
                setError(null);
              }}
            >
              Not now
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Posting…' : 'Post it'}
            </button>
          </span>
        </form>
      ) : (
        <button type="button" className="btn-primary feedback-start" onClick={() => setWriting(true)}>
          <ChatCircleText size={18} />
          Give some feedback
        </button>
      )}

      {state === 'failed' && (
        <div className="songs-empty">
          <p>Could not load the feedback: {reason}.</p>
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
      )}

      {state === 'loading' && list.length === 0 && <p className="field-note">Looking…</p>}

      {state === 'ready' && list.length === 0 && (
        <div className="songs-empty">
          <p>Nobody has said anything yet. Yours could be the first.</p>
        </div>
      )}

      {state !== 'failed' && list.length > 0 && (
        <ul className="songs-list">
          {list.map((t) => (
            <li key={t.id}>
              <button type="button" className="card feedback-row" onClick={() => onOpen(t.id)}>
                <span className="resume-titles">
                  <strong>{t.title}</strong>
                  <em>
                    {authorLabel(t)} · {replyCount(t)}
                    {t.postCount > 1 ? ` · last from @${t.lastBy}` : ''} · {postedWhen(t.updatedAt)}
                  </em>
                </span>
                {mentions.some((m) => m.threadId === t.id) && (
                  <span className="tag tag-alert">For you</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {more && state === 'ready' && (
        <button type="button" className="btn-secondary shared-more" onClick={loadMore}>
          Show more
        </button>
      )}
    </div>
  );
}
