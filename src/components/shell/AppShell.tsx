import type { ReactNode } from 'react';
import type { Route } from '../../app/routes';
import type { Song } from '../../types/song';
import type { Account } from '../../hooks/useAuth';
import type { SyncView } from '../../lib/syncStatus';
import Sidebar from './Sidebar';
import TabBar from './TabBar';
import { useIsDesktop } from './useBreakpoint';

interface Props {
  /** Null when signed out, or when Firebase is not configured at all. */
  account: Account | null;
  sync: SyncView;
  onAccount: () => void;
  onSignOut: () => Promise<void>;
  route: Route;
  /** The screen beneath this one, which decides whether the library is a
      destination or a step inside an editing flow. */
  previous?: Route;
  songs: Song[];
  /** The few opened last, for the sidebar's "Recent" — the home screen's list. */
  recent: Song[];
  playlistCount: number;
  myChordCount: number;
  /** Feedback posts that @ this player, not yet looked at. */
  mentionCount: number;
  currentId: string | null;
  onGo: (route: Route) => void;
  /** Opening a song, which plays it — see `openSong` in App.tsx. */
  onOpenSong: (songId: string) => void;
  children: ReactNode;
}

/**
 * Which chrome a screen gets, if any.
 *
 * The tab bar shows on browsing screens only; editing screens and full screen
 * get none. Full screen gets none on desktop either — it is for reading while
 * you play, so it keeps no navigation at all.
 *
 * The library is both things depending on how you got there. Opened from the
 * tab bar it is a destination. Opened from the chord editor's "All 48" it is a
 * step in building a song, and a tab bar there is an invitation to walk out of
 * the song mid-edit — so it gets the screen's own Back button instead.
 */
/**
 * Whether the library is a step inside an editing flow rather than a place you
 * navigated to. It decides both the chrome and who owns the way out: a step
 * leaves by its own Back button, a destination by the tab bar or the sidebar.
 */
/** Screens you go *to*: the tab bar's own destinations, one playlist, and the
    songs other people have shared, and the feedback. One shared song is not
    among them: it is where a link lands, with one thing to do and a Back of its
    own. One thread of feedback is not either: it has a reply box, and a tab
    bar under it on a phone is a way to walk off with the reply half-written. */
const BROWSING: ReadonlyArray<Route['name']> = [
  'landing',
  'songs',
  'playlists',
  'playlist',
  'shared',
  'settings',
  'feedback',
];

export function libraryIsStep(previous?: Route): boolean {
  // Getting to the library from a browsing screen is going somewhere, not
  // pausing half-way through a song.
  return !!previous && !BROWSING.includes(previous.name);
}

export function chromeFor(
  route: Route,
  isDesktop: boolean,
  previous?: Route,
): 'sidebar' | 'tabs' | 'none' {
  if (route.name === 'fullScreen') return 'none';
  /* Sign-in carries its own way out, and the claim step must not be walked
     away from by a sidebar click while the account is still half-made. */
  if (route.name === 'signIn') return 'none';
  if (isDesktop) return 'sidebar';
  /* One playlist keeps the tabs: it is a list you are reading, like the songs.
     Adding songs to it is a step with a Done of its own, so it gets none. */
  if (BROWSING.includes(route.name)) return 'tabs';
  if (route.name === 'library') return libraryIsStep(previous) ? 'none' : 'tabs';
  return 'none';
}

export default function AppShell({
  account,
  sync,
  onAccount,
  onSignOut,
  route,
  previous,
  songs,
  recent,
  playlistCount,
  myChordCount,
  mentionCount,
  currentId,
  onGo,
  onOpenSong,
  children,
}: Props) {
  const isDesktop = useIsDesktop();
  const chrome = chromeFor(route, isDesktop, previous);

  return (
    <div className={`shell shell-${chrome}`}>
      {chrome === 'sidebar' && (
        <Sidebar
          account={account}
          sync={sync}
          onAccount={onAccount}
          onSignOut={onSignOut}
          route={route}
          songs={songs}
          recent={recent}
          playlistCount={playlistCount}
          myChordCount={myChordCount}
          mentionCount={mentionCount}
          currentId={currentId}
          onGo={onGo}
          onOpenSong={onOpenSong}
        />
      )}
      <main className="shell-main">{children}</main>
      {chrome === 'tabs' && (
        <TabBar account={account} route={route} onGo={onGo} mentionCount={mentionCount} />
      )}
    </div>
  );
}
