import {
  BagSimple,
  GridFour,
  MusicNotesSimple,
  PlusCircle,
} from '@phosphor-icons/react';
import type { Route } from '../../app/routes';

interface Props {
  route: Route;
  onGo: (route: Route) => void;
  onStart: () => void;
}

const ITEMS = [
  { key: 'songs', label: 'Songs', Icon: MusicNotesSimple },
  { key: 'start', label: 'Start', Icon: PlusCircle },
  { key: 'chords', label: 'Chords', Icon: GridFour },
  { key: 'bag', label: 'Gig bag', Icon: BagSimple },
] as const;

/**
 * Browsing screens only. It is deliberately absent while editing a song —
 * you are not navigating then, and it competes with the screen's primary action.
 */
export default function TabBar({ route, onGo, onStart }: Props) {
  const activeKey =
    route.name === 'library' ? 'chords' : route.name === 'landing' ? 'songs' : '';

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
              if (key === 'start') onStart();
              else if (key === 'chords') onGo({ name: 'library' });
              else onGo({ name: 'landing' });
            }}
          >
            <Icon size={21} weight={active ? 'fill' : 'regular'} />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
