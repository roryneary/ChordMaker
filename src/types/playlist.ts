/**
 * One entry in a playlist. It has an id of its own, rather than the playlist
 * holding bare song ids, so the same song can appear twice in a set — an opener
 * reprised as the closer — and the two can be moved and removed independently.
 */
export interface PlaylistItem {
  id: string;
  songId: string;
}

/**
 * A playlist is one document, items and all (ROADMAP.md §0). The order of
 * `items` is the running order; there is no `position` field to keep in step
 * with it, so a reorder is one write of one document.
 */
export interface Playlist {
  id: string;
  name: string;
  items: PlaylistItem[];
  createdAt: number;
  updatedAt: number;
}
