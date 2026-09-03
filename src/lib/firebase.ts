import { type FirebaseApp, initializeApp } from 'firebase/app';
import { type Auth, connectAuthEmulator, getAuth } from 'firebase/auth';
import { type Firestore, connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

/**
 * The remote half of the store, sitting beside `storage.ts` — one is the local
 * copy, the other the backup and exchange layer.
 *
 * **Nothing here throws on import, and nothing here runs until it is asked to.**
 * A checkout with no `.env` is a supported state: the app's premise is that it
 * works with no account and no signal, so an absent Firebase config has to
 * leave every screen working on localStorage rather than white-screening the
 * app before it renders. Callers ask `firebaseEnabled` first and degrade;
 * `getFirebaseDb()` throws only if something asks for a database that was
 * never configured, which is a programming error rather than a user state.
 *
 * There is no `getStorage` on purpose. Everything the app persists is small
 * JSON — a song is well under 20 kB against Firestore's 1 MiB document limit —
 * and the PNG and PDF are generated in the browser at the moment you export
 * them. A stored export would only ever be a stale copy of something a second
 * of work regenerates. See ROADMAP.md, "Database support".
 */

const CONFIG_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

/** Which pieces of config are missing — for a diagnostic, not a crash. */
export const missingFirebaseConfig: readonly string[] = CONFIG_KEYS.filter(
  (key) => !import.meta.env[key],
);

/** False in an unconfigured checkout, and on any preview built without the vars. */
export const firebaseEnabled = missingFirebaseConfig.length === 0;

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  // Carried because the console hands you the whole object and a partial copy
  // invites a confusing "did I paste it wrong". Nothing reads it — see above.
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
let authRef: Auth | null = null;
let dbRef: Firestore | null = null;

/* Lazy rather than eager: initialising at module scope would run on every page
   load, including the offline ones this app exists for, and would pull the SDK
   into the first chunk for a player who never signs in. */
function ensureApp(): FirebaseApp {
  if (!firebaseEnabled) {
    throw new Error(
      `Firebase is not configured: missing ${missingFirebaseConfig.join(', ')}. ` +
        'Copy .env.example to .env, or check firebaseEnabled before calling this.',
    );
  }
  if (!app) {
    app = initializeApp(firebaseConfig);
    if (import.meta.env.VITE_USE_EMULATORS === 'true') {
      connectAuthEmulator(getAuth(app), 'http://127.0.0.1:9099', { disableWarnings: true });
      connectFirestoreEmulator(getFirestore(app), '127.0.0.1', 8080);
    }
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  if (!authRef) authRef = getAuth(ensureApp());
  return authRef;
}

export function getFirebaseDb(): Firestore {
  if (!dbRef) dbRef = getFirestore(ensureApp());
  return dbRef;
}
