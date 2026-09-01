import { useEffect } from 'react';
import { ChordCreatorMark } from '../components/Brand';

interface Props {
  /** True once the crossfade has started; the app is fading up underneath. */
  leaving: boolean;
  onSkip: () => void;
}

/**
 * Covers the app while it opens, then dissolves. It is decoration, so it is
 * hidden from screen readers entirely — the home screen underneath is the real
 * content and is already in the tree — and any key or pointer cuts it short,
 * because nobody wants to watch this twice.
 */
export default function Splash({ leaving, onSkip }: Props) {
  useEffect(() => {
    const skip = () => onSkip();
    window.addEventListener('keydown', skip);
    window.addEventListener('pointerdown', skip);
    return () => {
      window.removeEventListener('keydown', skip);
      window.removeEventListener('pointerdown', skip);
    };
  }, [onSkip]);

  return (
    <div className={`splash${leaving ? ' is-leaving' : ''}`} aria-hidden="true">
      <span className="splash-glow" />
      <span className="splash-lockup">
        <ChordCreatorMark className="splash-mark" size={96} label={null} />
        <span className="splash-word">
          chord<em>creator</em>
        </span>
        <span className="splash-tag">Chords, words, one page.</span>
      </span>
    </div>
  );
}
