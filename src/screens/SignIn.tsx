import { type FormEvent, useState } from 'react';
import { ArrowLeft, GoogleLogo } from '@phosphor-icons/react';
import { ChordCreatorLockup } from '../components/Brand';
import {
  AuthCancelled,
  authMessage,
  registerWithEmail,
  resetPassword,
  signInWithEmail,
  signInWithGoogle,
} from '../lib/auth';
import { HandleTakenError, checkHandle, normaliseHandle, suggestHandle } from '../lib/username';

interface Props {
  /** Set once Firebase reports a user; the screen then asks for the handle. */
  needsHandle: boolean;
  suggestFrom?: string | null;
  onClaim: (handle: string) => Promise<string>;
  onDone: () => void;
  onCancel: () => void;
}

type Mode = 'in' | 'up';

/**
 * Sign-in, and then the handle — one screen in two steps rather than two
 * screens, because they are one errand. An account without a handle is not
 * finished: nothing can be shared from it, since a shared song names its
 * sender and that name has to be something other than an email address.
 *
 * The password field is not a second-class citizen here. Google is the fast
 * path, but "sign in with Google" alone excludes people, and this is an app
 * you might set up on a phone in a rehearsal room.
 */
export default function SignIn({ needsHandle, suggestFrom, onClaim, onDone, onCancel }: Props) {
  const [mode, setMode] = useState<Mode>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  /* Null until they touch the field, so the suggestion can appear when the
     user object arrives without an effect racing the typing — and so clearing
     the box stays cleared rather than refilling itself. */
  const [typed, setTyped] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  /* Seeded from the email or Google name, never claimed silently: the handle
     is how they are named to other people, so it is theirs to accept. */
  const handle = typed ?? (suggestFrom ? suggestHandle(suggestFrom) : '');

  /** Runs an auth call, turning its failure into a sentence rather than a code. */
  const attempt = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await fn();
    } catch (err) {
      // A closed popup is a decision, not a failure — say nothing.
      try {
        setError(authMessage(err));
      } catch (cancelled) {
        if (!(cancelled instanceof AuthCancelled)) throw cancelled;
      }
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void attempt(() =>
      mode === 'in' ? signInWithEmail(email, password) : registerWithEmail(email, password),
    );
  };

  const claim = (e: FormEvent) => {
    e.preventDefault();
    const problem = checkHandle(handle);
    if (!problem.ok) {
      setError(problem.reason);
      return;
    }
    setBusy(true);
    setError(null);
    onClaim(handle)
      .then(onDone)
      .catch((err) =>
        setError(
          err instanceof HandleTakenError
            ? `${normaliseHandle(handle)} is taken. Try another.`
            : (err as Error).message,
        ),
      )
      .finally(() => setBusy(false));
  };

  if (needsHandle) {
    const preview = normaliseHandle(handle);
    return (
      <div className="signin">
        <div className="brand brand-sm">
          <ChordCreatorLockup size={26} />
        </div>
        <h1 className="display-sm">What should we call you?</h1>
        <p className="signin-sub">
          This is the name on songs you share. Your band will see it — your email
          address stays private.
        </p>

        <form className="signin-form" onSubmit={claim}>
          <label className="micro-label" htmlFor="handle">
            Your name here
          </label>
          <input
            id="handle"
            className="input"
            value={handle}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="rory"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
          />
          {preview && !error && <p className="signin-hint">Shared songs will say “from {preview}”.</p>}
          {error && <p className="signin-error">{error}</p>}

          <button type="submit" className="btn-primary btn-block" disabled={busy || !preview}>
            {busy ? 'Claiming…' : 'That is me'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="signin">
      <button type="button" className="icon-btn" onClick={onCancel} aria-label="Back">
        <ArrowLeft size={20} />
      </button>

      <div className="brand brand-sm">
        <ChordCreatorLockup size={26} />
      </div>
      <h1 className="display-sm">
        {mode === 'in' ? 'Welcome back.' : 'Make an account.'}
      </h1>
      <p className="signin-sub">
        Your songs, on every device you play from — and a name to share them under.
      </p>

      <button
        type="button"
        className="btn-secondary btn-block signin-google"
        onClick={() => void attempt(signInWithGoogle)}
        disabled={busy}
      >
        <GoogleLogo size={18} weight="bold" />
        Continue with Google
      </button>

      <div className="signin-or">
        <span>or</span>
      </div>

      <form className="signin-form" onSubmit={submit}>
        <label className="micro-label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          className="input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />

        <label className="micro-label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          className="input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
          required
        />

        {error && <p className="signin-error">{error}</p>}
        {note && <p className="signin-hint">{note}</p>}

        <button type="submit" className="btn-primary btn-block" disabled={busy}>
          {busy ? 'One moment…' : mode === 'in' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <div className="signin-foot">
        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            setMode(mode === 'in' ? 'up' : 'in');
            setError(null);
          }}
        >
          {mode === 'in' ? 'Make an account' : 'I already have one'}
        </button>
        {mode === 'in' && (
          <button
            type="button"
            className="btn-ghost"
            disabled={busy || !email.trim()}
            onClick={() =>
              void attempt(async () => {
                await resetPassword(email);
                setNote('Check your email for a reset link.');
              })
            }
          >
            Forgotten it
          </button>
        )}
      </div>
    </div>
  );
}
