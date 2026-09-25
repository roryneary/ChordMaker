import {
  GridFour,
  House,
  MusicNotes,
  Playlist,
  UserCircle,
} from '@phosphor-icons/react';
import type { Route } from '../../app/routes';
import type { Account } from '../../hooks/useAuth';

interface Props {
  account: Account | null;
  route: Route;
  onGo: (route: Route) => void;
  /** Feedback posts that @ this player: a dot on the account tab, where feedback lives. */
  mentionCount: number;
}

/* Each tab is named for what is behind it. There was a "Gig bag" here, which
   was the song list under a name that had to be explained; it is "Songs" now,
   and playlists have a tab of their own rather than a section inside it.

   Ordered by what is yours: your songs, then your playlists, then the fixed
   library, then you. "Start" was a tab here and is not one now — it was the
   only action among five destinations, and both Home and Songs open a new
   song (Songs from its "New song" button, whether or not the list is empty),
   so the bar lost a tab rather than the app losing a door. */
const ITEMS = [
  { key: 'home', label: 'Home', Icon: House },
  { key: 'songs', label: 'Songs', Icon: MusicNotes },
  { key: 'playlists', label: 'Playlists', Icon: Playlist },
  { key: 'chords', label: 'Chords', Icon: GridFour },
] as const;

/**
 * Browsing screens only. It is deliberately absent while editing a song —
 * you are not navigating then, and it competes with the screen's primary action.
 *
 * The account tab is the mobile equivalent of the sidebar's chip at the foot
 * of the desktop nav — without it there was no way to reach sign-in on a
 * phone at all, only the sidebar had the door in.
 */
export default function TabBar({ account, route, onGo, mentionCount }: Props) {
  const activeKey =
    route.name === 'library'
      ? 'chords'
      : route.name === 'landing'
        ? 'home'
        : /* Shared songs has no tab of its own and is reached from Songs,
             so that is the tab it sits under. */
          route.name === 'songs' || route.name === 'shared'
          ? 'songs'
          : route.name === 'playlists' || route.name === 'playlist'
            ? 'playlists'
            : /* Feedback is reached from the account screen on a phone:
                 there is no room for a sixth tab. */
              route.name === 'signIn' ||
                route.name === 'settings' ||
                route.name === 'feedback' ||
                route.name === 'feedbackThread'
              ? 'account'
              : '';

  return (
    <nav className="tab-bar" aria-label="Main">
      {ITEMS.map(({ key, label, Icon }) => {
        const active = key === activeKey;
        return (
          <button
            key={key}
            type="button"
            className={`tab-item${active ? ' is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
            onClick={() => {
              if (key === 'chords') onGo({ name: 'library' });
              else if (key === 'songs') onGo({ name: 'songs' });
              else if (key === 'playlists') onGo({ name: 'playlists' });
              else onGo({ name: 'landing' });
            }}
          >
            <Icon size={21} weight={active ? 'fill' : 'regular'} />
            <span>{label}</span>
          </button>
        );
      })}
      <button
        type="button"
        className={`tab-item${activeKey === 'account' ? ' is-active' : ''}`}
        aria-current={activeKey === 'account' ? 'page' : undefined}
        aria-label={
          mentionCount > 0 ? `Account, ${mentionCount} waiting for you in feedback` : undefined
        }
        onClick={() => onGo({ name: 'signIn' })}
      >
        <span className="tab-icon">
          <UserCircle size={21} weight={account?.handle ? 'fill' : 'regular'} />
          {mentionCount > 0 && <span className="tab-dot" />}
        </span>
        <span>{account?.handle ? 'Account' : 'Sign in'}</span>
      </button>
    </nav>
  );
}
