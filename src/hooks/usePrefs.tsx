import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { getFirebaseDb } from '../lib/firebase';
import { DEFAULT_PREFS, type Prefs, newerPrefs, parsePrefs, withPref } from '../lib/prefs';

export const PREFS_KEY = 'chord-builder:prefs:v1';

type Settable = keyof Omit<Prefs, 'updatedAt'>;

interface PrefsValue {
  prefs: Prefs;
  setPref: <K extends Settable>(key: K, value: Prefs[K]) => void;
}

const PrefsContext = createContext<PrefsValue>({ prefs: DEFAULT_PREFS, setPref: () => {} });

function loadPrefs(): Prefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    return raw ? parsePrefs(JSON.parse(raw)) : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

/**
 * Prefs are not work: a write that fails is not worth a status line, and the
 * next change sends the whole thing again anyway.
 */
function sendPrefs(uid: string, prefs: Prefs) {
  setDoc(doc(getFirebaseDb(), 'users', uid), { prefs }, { merge: true }).catch((err) =>
    console.warn('Prefs not saved to the account', err),
  );
}

interface Props {
  /** Set once the account is finished (it has a handle), or the rules refuse the write. */
  uid: string | null;
  /** `useAuth().remotePrefs`: `undefined` until read, then whatever the profile holds. */
  remote: unknown;
  children: ReactNode;
}

/**
 * One copy of the player's prefs for the whole app — `useThemeValue`'s shape,
 * for the same reason: a hook holding state per component would give each
 * diagram its own copy.
 *
 * `localStorage` is what is read, as with songs, so a signed-out player keeps
 * theirs and nothing waits on a signal. Signed in, the profile document is a
 * mirror: when it is read the newer of the two copies is kept, and if that is
 * this device's, it goes up.
 */
export function PrefsProvider({ uid, remote, children }: Props) {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  /* What the two effects and `setPref` compare against: the state as last
     committed, or as `setPref` has just made it, whichever is later. */
  const latest = useRef(prefs);

  useEffect(() => {
    latest.current = prefs;
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // Private mode: this session still has them.
    }
  }, [prefs]);

  useEffect(() => {
    if (!uid || remote === undefined) return;
    const theirs = parsePrefs(remote);
    const kept = newerPrefs(latest.current, theirs);
    if (kept === theirs) setPrefs(theirs);
    else if (kept.updatedAt > theirs.updatedAt) sendPrefs(uid, kept);
  }, [uid, remote]);

  const setPref = useCallback(
    <K extends Settable>(key: K, value: Prefs[K]) => {
      const next = withPref(latest.current, key, value, Date.now());
      if (next === latest.current) return;
      latest.current = next;
      setPrefs(next);
      if (uid) sendPrefs(uid, next);
    },
    [uid],
  );

  const value = useMemo(() => ({ prefs, setPref }), [prefs, setPref]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export const usePrefs = (): PrefsValue => useContext(PrefsContext);
