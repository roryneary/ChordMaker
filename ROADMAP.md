# Roadmap

Features to come back to. Newest thinking at the top of each list; move an item to
**Done** with the commit that closed it, or delete it if it stops being wanted.

## Next

These three are one project, not three. Sharing is the design question that decides the
other two — the answer fixes the schema, which fixes what auth has to identify. Do them in
that order: **decide the sharing model, then the data model, then the sign-in that carries it.**

The constraint that governs all of it: the app currently promises it "works with no signal",
and the reading screen is meant for a windy pitch. Whatever goes in must stay **local-first
with sync** — `localStorage` remains the read path and the server is the backup/exchange
layer. A rewrite to fetch-on-load would trade the app's best property for a feature list.

### 1. How users share songs between themselves

The open questions, as asked:

- **New songs, or one shared song?** Copy semantics (receiving forks a fresh song with its
  own id) versus shared ownership (one row, several people editing it).
- **Should songs have an owner?** `Song` has no owner field today — adding one is the schema
  change that makes any of this expressible.
- **Once a user has a song, can they make it their own?** i.e. is a received song editable in
  place, read-only, or editable-after-fork.

Worth weighing: a song's structure is single-writer by design. Chords attach to word ids that
`retokenise` re-mints on every lyric edit (`src/lib/lyric.ts`), so two people editing one
lyric concurrently is a merge problem the current model has no answer to. **Copy-on-share is
the cheap, honest version** — receiving a song mints a new id and you own your copy outright,
with a `copiedFrom` field to keep the lineage visible. Live shared editing is a much larger
project and should be a separate decision, not a side effect of this one.

Also undecided: how a song travels. A link (needs the backend below), or a URL-encoded
payload / exported file (works with no accounts at all, and is worth prototyping first
because it tests the copy semantics without any of the infrastructure).

### 2. Database support

- Songs are the only thing worth storing; user chords (`USER_CHORDS_KEY`) come along with them.
- Ids are already minted client-side by `newId()`, so records can be created offline and
  reconciled later — no server sequence to design around.
- `src/lib/storage.ts` already has a versioned store and a v1 → v2 migration, so there is a
  precedent to follow for the account migration.
- **The migration that must not be got wrong:** an existing user's `localStorage` songs have
  to survive their first sign-in and become theirs. Silently starting them with an empty
  library would lose real work.
- `useSongs` persists via a `saveStore` effect on every store change — that effect is the
  seam where sync goes. The reducer itself should not need to know a server exists.

### 3. Authentication

- Follows from the above: auth exists to answer "whose song is this", so its shape depends on
  whether songs get owners and how sharing addresses a recipient.
- Today the README's premise is "single user, no accounts, no backend" — landing this changes
  that promise and the README needs rewriting with it.
- Keep the app usable signed-out. Someone who just wants to tap out a chord sheet on a pitch
  should not hit a login wall first; sign-in should be what unlocks backup and sharing.

## Later

Carried over from the README's "Not built" section — deliberately deferred, not forgotten:

- **Send a link to the band.** Needs a backend or a URL-encoded song payload; currently
  everything is `localStorage` and offline.
- **A real chord speller.** Names are matched against `chordLibrary` and stay user-editable.
- **Left-handed mirroring.** `layout.ts` is the only place that converts string number to
  x position, so the flip has one home.
- **Other instruments.** Would generalise the 6-string assumption in `layout.ts` and `shape.ts`.
- **Finger numbers in the dots.** `Dot` already carries an optional `finger` the reducer ignores.

## Decided against

- **Capo changing the diagrams.** `rootFret` means an absolute neck position; making it
  capo-relative would silently reinterpret every chord already saved.

## Done

- **The brand landed, and the app opens with it.** The placeholder Guitar icon and the words
  "Chord Creator" were standing in for a mark that now exists: the arcs from the brand pack are
  in `src/components/Brand.tsx`, the sidebar and the home screen share one lockup, and the
  favicon, apple-touch icon and head markup are the real assets. The arcs take their colour
  from `--color-text` / `--color-accent` rather than the brand's hex — the tokens resolve to
  the brand's own light and dark pairs, so one component is correct in both themes and there is
  no second copy of the palette to drift. On desktop the home screen's lockup is hidden,
  because the sidebar is already showing it a row away.
  The opening is a splash that draws the mark, holds, then crossfades into the home screen
  (`src/app/splash.ts`). Still open: whether it should be shown on every load or only the
  first of a session — right now it is every load, on the grounds that it is short, skippable
  by any key or tap, and briefer still under reduced motion.

- **The capo has to be chosen, and "Looks right" checks before it agrees.** The chip read
  "No capo" from the moment a song was created, so it looked like a settled answer rather
  than a question — players did not notice the capo was theirs to set at all, and a capo
  moves every chord on the sheet. `Song.capo` now has a third state: absent, meaning nobody
  has been asked, distinct from an explicit `null`. Unanswered, it renders as a dashed
  "Set the capo", and the song screen will not go through to Ready without an answer.
  The same sheet warns about a song with **no chords** but lets it through — words on their
  own are a legitimate thing to print, so that one is a check, not a gate.
  The migration is the quiet part and is already done: `parseSong` keeps a stored `null`
  instead of collapsing it, so every song saved before this reads as already decided and
  nobody is nagged about work they finished months ago. No store version bump — `undefined`
  simply drops out of the JSON, which is exactly "never answered".

- **Fret position on the diagram, and a control to set it.** `rootFret` and `SET_ROOT_FRET`
  had existed since the first commit, but nothing in the UI dispatched the action — only
  library shapes that `rootFretFor` slid up the neck ever left the first position, so a
  player could not tap out a barre chord at the seventh fret at all. The editor now has a
  Position stepper, and the old `7fr` label is a roman numeral, which is how a printed chart
  says it, sitting to the right of the grid on the centre line of the fret it names. Its
  column is reserved on every diagram: containers size a diagram by its width, so a box
  widened only for up-the-neck chords drew a visibly smaller fretboard than the nut chord
  beside it. One fixed box also removed `viewBoxWidth` and the per-chord width the overlay
  and both exporters had been threading.
  Note the knock-on: above roughly the fifth position
  `specToShape` cannot express the shape (the notation stops at fret 9), so name inference
  goes quiet and the player names the chord themselves. That is correct — the 48-shape
  library does not contain those chords — but it is the thing to look at first if name
  guessing ever seems broken.
