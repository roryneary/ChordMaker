import { useCallback, useEffect, useMemo, useState } from 'react';
import { type User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { firebaseEnabled, getFirebaseAuth, getFirebaseDb } from '../lib/firebase';
import { claimUsername as claim, normaliseHandle } from '../lib/username';
import { signOut as doSignOut } from '../lib/auth';

/**
 * Who is signed in, and what they are called.
 *
 * Three states, and conflating any two of them produces a bug that is hard to
 * see: `loading` is "Firebase has not told us yet", which is not the same as
 * signed out — treating it as signed out flashes the sign-in screen at every
 * returning user on every load. And a signed-in user with no handle yet is not
 * finished signing in; that is what `needsHandle` is for.
 *
 * The whole hook degrades to a permanent signed-out state when Firebase is not
 * configured, so a checkout with no `.env` still runs (see lib/firebase.ts).
 */

export interface Account {
  uid: string;
  email: string | null;
  /** The claimed handle, lowercased. Absent until they pick one. */
  handle: string | null;
  /** The handle as typed, for display. */
  display: string | null;
  photoURL: string | null;
}

export interface AuthState {
  loading: boolean;
  user: User | null;
  account: Account | null;
  /** Signed in, but has not claimed a handle. The sign-in flow is not done. */
  needsHandle: boolean;
  signedIn: boolean;
  claimHandle: (input: string) => Promise<string>;
  signOut: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [loading, setLoading] = useState(firebaseEnabled);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<{ handle: string; display: string } | null>(null);

  useEffect(() => {
    if (!firebaseEnabled) return;
    return onAuthStateChanged(getFirebaseAuth(), (next) => {
      setUser(next);
      if (!next) setProfile(null);
      setLoading(false);
    });
  }, []);

  /* Watched rather than read once: claiming a handle writes this document, and
     a live subscription means the claim screen closes itself when it lands
     instead of the caller having to refetch and hope. */
  useEffect(() => {
    if (!firebaseEnabled || !user) return;
    return onSnapshot(
      doc(getFirebaseDb(), 'users', user.uid),
      (snap) => {
        const data = snap.data();
        setProfile(
          data?.handle ? { handle: data.handle as string, display: (data.display as string) ?? data.handle as string } : null,
        );
      },
      // A read that fails (offline, rules) must not strand the app on a
      // spinner — it just means we do not know the handle yet.
      () => setProfile(null),
    );
  }, [user]);

  const claimHandle = useCallback(
    async (input: string) => {
      if (!user) throw new Error('Sign in first.');
      const handle = await claim(getFirebaseDb(), user.uid, input);
      setProfile({ handle, display: input.trim().replace(/^@+/, '') });
      return handle;
    },
    [user],
  );

  const signOut = useCallback(async () => {
    await doSignOut();
    setProfile(null);
  }, []);

  const account = useMemo<Account | null>(
    () =>
      user
        ? {
            uid: user.uid,
            email: user.email,
            handle: profile?.handle ?? null,
            display: profile?.display ?? null,
            photoURL: user.photoURL,
          }
        : null,
    [user, profile],
  );

  return {
    loading,
    user,
    account,
    needsHandle: !!user && !profile,
    signedIn: !!user && !!profile,
    claimHandle,
    signOut,
  };
}

/** Does this uid already hold a handle? Used by the migration, not the UI. */
export async function handleOf(uid: string): Promise<string | null> {
  if (!firebaseEnabled) return null;
  const snap = await getDoc(doc(getFirebaseDb(), 'users', uid));
  const handle = snap.data()?.handle;
  return typeof handle === 'string' ? normaliseHandle(handle) : null;
}
