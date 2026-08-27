interface Props {
  title: string;
  chordCount: number;
  exportingPdf: boolean;
  exportingPng: boolean;
  onTitle: (title: string) => void;
  onDownloadPdf: () => void;
  onDownloadPng: () => void;
  onNewSong: () => void;
}

/** Builder header: which song this is, plus the whole-song actions.
    The title gets its own full-width row so a real song name is never
    squeezed by the buttons next to it. */
export default function SongBar({
  title,
  chordCount,
  exportingPdf,
  exportingPng,
  onTitle,
  onDownloadPdf,
  onDownloadPng,
  onNewSong,
}: Props) {
  const busy = exportingPdf || exportingPng;
  const noChords = chordCount === 0;

  return (
    <div className="song-header">
      <label className="sr-only" htmlFor="song-title">
        Song title
      </label>
      <input
        id="song-title"
        className="song-title"
        value={title}
        onChange={(e) => onTitle(e.target.value)}
        placeholder="Song title"
        autoComplete="off"
        spellCheck={false}
      />
      <div className="song-actions">
        <button
          type="button"
          className="btn btn-small"
          onClick={onDownloadPng}
          disabled={noChords || busy}
          title={noChords ? 'Add a chord first' : 'Download the whole song as one image'}
        >
          {exportingPng ? 'Building…' : 'PNG'}
        </button>
        <button
          type="button"
          className="btn btn-small"
          onClick={onDownloadPdf}
          disabled={noChords || busy}
          title={noChords ? 'Add a chord first' : 'Download the whole song as a PDF'}
        >
          {exportingPdf ? 'Building…' : 'PDF'}
        </button>
        <button type="button" className="btn btn-small" onClick={onNewSong} disabled={busy}>
          New song
        </button>
      </div>
    </div>
  );
}
