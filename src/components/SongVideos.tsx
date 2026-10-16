import { useState } from 'react';
import { Plus, Trash, YoutubeLogo } from '@phosphor-icons/react';
import {
  MAX_VIDEOS,
  MAX_VIDEO_LABEL_CHARS,
  startLabel,
  thumbnailOf,
  youTubeUrl,
} from '../lib/videos';
import type { SongVideo } from '../types/song';

export interface VideoHandlers {
  onAdd: (url: string, label?: string) => void;
  onLabel: (videoId: string, label: string) => void;
  onRemove: (videoId: string) => void;
}

/**
 * YouTube's still, when it loads. Offline, or for a video since taken down,
 * there is none, and the row is the logo and the words alone.
 */
function Thumb({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  const src = thumbnailOf(url);
  return (
    <span className="video-thumb">
      {src && !failed ? (
        <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <YoutubeLogo size={26} weight="fill" />
      )}
    </span>
  );
}

/**
 * A link out, not a player: a phone hands a watch page to the YouTube app,
 * which is where somebody learning a song wants to be — it slows down, loops
 * and remembers the place. Opened in a new tab so the song is still here.
 */
export function VideoLink({ video }: { video: SongVideo }) {
  const from = startLabel(video.url);
  return (
    <a className="video-link" href={video.url} target="_blank" rel="noopener noreferrer">
      <Thumb url={video.url} />
      <span>
        <strong>{video.label || 'Watch on YouTube'}</strong>
        {from && <em>{from}</em>}
      </span>
    </a>
  );
}

/** One video, its label edited in place and kept when the box is left, as a note is. */
function VideoRow({ video, on }: { video: SongVideo; on: VideoHandlers }) {
  const [label, setLabel] = useState(video.label ?? '');
  const from = startLabel(video.url);
  return (
    <div className="video-row">
      <a
        className="video-thumb-link"
        href={video.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Watch ${video.label || 'this video'} on YouTube`}
      >
        <Thumb url={video.url} />
      </a>
      <span className="video-row-text">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => on.onLabel(video.id, label)}
          maxLength={MAX_VIDEO_LABEL_CHARS}
          placeholder="Say what it shows"
          aria-label="What this video shows"
          autoComplete="off"
        />
        <em>{from ? `YouTube · ${from}` : 'YouTube'}</em>
      </span>
      <button
        type="button"
        className="icon-btn note-remove"
        onClick={() => on.onRemove(video.id)}
        aria-label="Remove this video"
      >
        <Trash size={15} />
      </button>
    </div>
  );
}

interface Props {
  videos: SongVideo[] | undefined;
  on: VideoHandlers;
}

/**
 * The song screen's videos: somebody playing it, to see how it goes. A link is
 * pasted and added; nothing is stored until it reads as a YouTube video, and
 * the box says so rather than adding something that will not open.
 */
export default function SongVideos({ videos, on }: Props) {
  const all = videos ?? [];
  const [text, setText] = useState('');
  const [wrong, setWrong] = useState(false);
  const full = all.length >= MAX_VIDEOS;

  const add = () => {
    const url = youTubeUrl(text);
    if (!url) {
      setWrong(true);
      return;
    }
    // Already here is not an error worth a sentence: the box just empties.
    if (!all.some((v) => v.url === url)) on.onAdd(url);
    setText('');
    setWrong(false);
  };

  return (
    <div className="song-videos">
      {all.map((video) => (
        /* Keyed on the label too: one changed from outside (the sender's new
           version replacing this one) starts its box afresh. */
        <VideoRow key={`${video.id}:${video.label ?? ''}`} video={video} on={on} />
      ))}
      {!full && (
        <form
          className="video-add"
          /* The browser's own check refuses "youtu.be/…" with no https://,
             which is how a link is often pasted; `youTubeUrl` reads it fine. */
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <input
            type="url"
            inputMode="url"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setWrong(false);
            }}
            placeholder="Paste a YouTube link"
            aria-label="A YouTube link"
            aria-invalid={wrong}
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" className="btn-ghost" disabled={!text.trim()}>
            <Plus size={14} />
            Add
          </button>
        </form>
      )}
      {wrong && (
        <p className="note-hint is-error" role="alert">
          That is not a link to a YouTube video.
        </p>
      )}
      {all.length === 0 && !wrong && (
        <p className="note-hint">
          A lesson, or the band playing it — whatever shows how it goes.
        </p>
      )}
    </div>
  );
}
