import {
  EmailAuthProvider,
  GoogleAuthProvider,
  type User,
  createUserWithEmailAndPassword,
  linkWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  updateProfile,
} from 'firebase/auth';
import { getFirebaseAuth } from './firebase';

/**
 * Sign-in, kept to two routes: Google for the tap-once case, email and password
 * for anyone who will not use it.
 *
 * Nothing here decides *whether* the app needs an account — the app is usable
 * signed out and sign-in is what unlocks backup and sharing (ROADMAP.md §3).
 * These are the verbs; the screens decide when to offer them.
 *
 * Every function turns Firebase's error codes into a sentence, because
 * `auth/invalid-credential` on a sign-in form is not something to show anyone.
 */

const google = new GoogleAuthProvider();

/** Firebase's codes, in words. Anything unlisted keeps its own message. */
const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'That email and password do not match.',
  'auth/invalid-email': 'That does not look like an email address.',
  'auth/email-already-in-use': 'There is already an account with that email.',
  'auth/weak-password': 'Use at least six characters.',
  'auth/too-many-requests': 'Too many tries. Wait a minute and try again.',
  'auth/network-request-failed': 'No connection — sign-in needs one.',
  'auth/popup-blocked': 'The sign-in window was blocked. Allow popups and retry.',
  'auth/unauthorized-domain':
    'This domain is not on the Firebase authorised list yet.',
};

/** Popups are closed by people, constantly. Not an error worth showing. */
const SILENT = new Set([
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
]);

export class AuthCancelled extends Error {}

export function authMessage(err: unknown): string {
  const code = (err as { code?: string })?.code;
  if (code && SILENT.has(code)) throw new AuthCancelled();
  if (code && MESSAGES[code]) return MESSAGES[code];
  return err instanceof Error ? err.message : 'Something went wrong signing in.';
}

/**
 * Popup first, redirect as the fallback. Popups are the better experience —
 * the app keeps its state and there is no round trip — but embedded browsers
 * (the in-app one Instagram and Facebook links open in, notably) block them
 * outright, and a musician following a link from a group chat is exactly the
 * person this has to work for.
 */
export async function signInWithGoogle(): Promise<User> {
  const auth = getFirebaseAuth();
  try {
    const cred = await signInWithPopup(auth, google);
    return cred.user;
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, google);
      // The redirect never returns here — the page navigates away.
      return new Promise<User>(() => {});
    }
    throw err;
  }
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
  return cred.user;
}

export async function registerWithEmail(
  email: string,
  password: string,
  displayName?: string,
): Promise<User> {
  const cred = await createUserWithEmailAndPassword(
    getFirebaseAuth(),
    email.trim(),
    password,
  );
  if (displayName?.trim()) {
    await updateProfile(cred.user, { displayName: displayName.trim() });
  }
  return cred.user;
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
}

/**
 * Adds a password to an account that signed up with Google. Without this,
 * someone who used Google on their phone and later types the same email into
 * the password form is told the address is taken, with no way forward.
 */
export async function addPassword(password: string): Promise<void> {
  const user = getFirebaseAuth().currentUser;
  if (!user?.email) throw new Error('Sign in first.');
  await linkWithCredential(user, EmailAuthProvider.credential(user.email, password));
}

export const signOut = (): Promise<void> => fbSignOut(getFirebaseAuth());
