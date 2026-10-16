import type { SongVideo } from '../types/song';

/* The account's limits. firestore.rules checks the count; what is inside each
   entry is beyond what rules can look at, so the lengths are the app's to keep,
   as a note's are. */
export const MAX_VIDEOS = 20;
export const MAX_VIDEO_URL_CHARS = 200;
export const MAX_VIDEO_LABEL_CHARS = 100;

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/** "90", "90s", "1m30s", "1h2m3s" → seconds. Null for anything else, or zero. */
function seconds(t: string | null): number | null {
  if (!t) return null;
  if (/^\d+s?$/.test(t)) return parseInt(t, 10) || null;
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(t);
  if (!m || !t) return null;
  const total = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return total || null;
}

/**
 * The video a YouTube link names, and where in it the link starts. Null for
 * anything that is not a link to one YouTube video. Takes what people paste:
 * the share button's youtu.be, a watch page, Shorts, the phone site, YouTube
 * Music, or any of those without the https://.
 */
export function readYouTube(text: string): { videoId: string; start: number | null } | null {
  const raw = text.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^(www|m|music)\./, '');
  const path = url.pathname.split('/').filter(Boolean);

  let videoId: string | undefined;
  if (host === 'youtu.be') videoId = path[0];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (path[0] === 'watch') videoId = url.searchParams.get('v') ?? undefined;
    else if (['shorts', 'embed', 'live', 'v'].includes(path[0])) videoId = path[1];
  }
  if (!videoId || !YOUTUBE_ID.test(videoId)) return null;
  return { videoId, start: seconds(url.searchParams.get('t') ?? url.searchParams.get('start')) };
}

/**
 * One way of writing each link, so the same video pasted twice is seen to be
 * the same, and every link opens the same way — a watch page, which a phone
 * hands to the YouTube app. A start time is kept: "from 1:30, where the solo
 * is" is often the whole point of the link.
 */
export function youTubeUrl(text: string): string | null {
  const v = readYouTube(text);
  if (!v) return null;
  return `https://www.youtube.com/watch?v=${v.videoId}${v.start ? `&t=${v.start}s` : ''}`;
}

/** The still YouTube serves for a video, for the row that opens it. */
export function thumbnailOf(url: string): string | null {
  const v = readYouTube(url);
  return v ? `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg` : null;
}

/** "from 1:30" for a link that starts part way in; null for one from the top. */
export function startLabel(url: string): string | null {
  const start = readYouTube(url)?.start;
  if (!start) return null;
  const h = Math.floor(start / 3600);
  const m = Math.floor((start % 3600) / 60);
  const s = String(start % 60).padStart(2, '0');
  return `from ${h ? `${h}:${String(m).padStart(2, '0')}` : m}:${s}`;
}

/**
 * Tolerant, like the rest of `parseSong`: an entry that is not a YouTube link
 * is dropped, not the song, and a blank label reads as none.
 */
export function parseVideos(x: unknown): SongVideo[] {
  if (!Array.isArray(x)) return [];
  const out: SongVideo[] = [];
  for (const raw of x) {
    if (typeof raw !== 'object' || raw === null) continue;
    const v = raw as Partial<SongVideo>;
    if (typeof v.id !== 'string' || typeof v.url !== 'string') continue;
    const url = youTubeUrl(v.url);
    if (!url) continue;
    const label = typeof v.label === 'string' ? v.label.trim() : '';
    out.push({ id: v.id, url, ...(label ? { label } : {}) });
  }
  return out;
}
