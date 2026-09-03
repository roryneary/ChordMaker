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

**Decided: copy-on-share.** Songs are owned. Sharing hands over a copy, and the recipient owns
that copy outright — their own id, editable in place, theirs to keep. The sender's copy is
untouched and the two never rejoin.

The reasoning that settled it: a song's structure is single-writer by design. Chords attach to
word ids that `retokenise` re-mints on every lyric edit (`src/lib/lyric.ts`), so two people
editing one lyric concurrently is a merge problem the current model has no answer to. Live
shared editing is a much larger project and remains a separate decision, not a side effect
of this one.

What follows from it:

- **The share is a snapshot, not a subscription.** Fix a typo after sending and the band does
  not see it; you send again and they get a second song. That is the honest cost of the model
  and the UI should not imply otherwise — no "shared with 4 people" list that suggests a live
  link. If propagating edits ever matters more than simplicity, that is the point to revisit
  this, not to patch around it.
- **The path is the owner of record, not a field.** With `users/{uid}/songs/{songId}` the
  document's location already says whose it is, and a stored `ownerId` beside it is a second
  copy of the same fact that can drift out of agreement with the path. Add one only if songs
  ever need to be readable outside their owner's subtree.
- **`copiedFrom` keeps the lineage visible** — the source song id, and enough of the sender to
  render "from Rory" without a lookup that a signed-out reader cannot make. Both new fields go
  in optional, following the `capo` precedent in `src/types/song.ts`: absent is a meaningful
  state, and every song already saved has to read correctly without them.

**Notification of updates is parked, not rejected.** Asked and deferred: if the sender edits after
sharing, could the recipient be told? It is possible, but only in a Firestore world — a URL payload
is inert once received, with no address to check back against. It would need shares to be published
documents (`shares/{shareId}` with a `version`) living outside the owner's subtree, and the hard part
is not the badge but what "take the update" does to a copy the recipient has already edited: no merge
is possible, so the answer is replace-if-untouched, otherwise offer it as a second song. The one
cheap hedge taken now is that `copiedFrom` is an object, not a bare song id, so `shareId` and
`version` can be added later without migrating songs already shared.

**The sender is identified by a username, never an email.** `copiedFrom` travels inside a payload
that cannot be recalled, so an email in it leaks to everyone downstream, forever. The handle comes
early — before auth — because songs shared in the meantime would otherwise carry nothing and could
never be backfilled. Pre-auth it is a local display handle only: chosen at the first share rather
than at first launch, kept in `localStorage`, unclaimed and unverified because there is no uid to
bind it to. It renders as plain text ("from Rory"); the `@` prefix is earned at claim time, so
`@rory` always means verified. See §3 for the claim.

Still undecided: **how a song travels.** A link (needs the backend below), or a URL-encoded
payload / exported file (works with no accounts at all). The payload is worth prototyping
first because it tests the copy semantics — new id, lineage, recipient owns it — without any
of the infrastructure, so getting the semantics wrong costs a prototype rather than a schema.
It also closes "Send a link to the band" in **Later**.

### 2. Database support

**Decided: Firestore, hosted on Netlify, and no Cloud Storage.** Everything the app persists is
small JSON — a song is well under 20 kB against Firestore's 1 MiB document limit — and the PNG
and PDF are generated client-side at the moment you export them, so a stored export would only
be a stale copy of something a second of work regenerates. Storage earns its place only if
user-uploaded audio, photos or avatars ever arrive; none are planned.

The plumbing is in place ahead of the sync layer: `netlify.toml`, `.env.example` and
`src/lib/firebase.ts`, which initialises lazily and never throws on import, so an unconfigured
checkout still runs entirely on `localStorage`. Nothing imports it yet, so the SDK is not in the
bundle.

The project itself now exists: `chordcreator-c7378`, Firestore in Standard edition as the
`(default)` database, started in production mode. `getFirestore(app)` binds to `(default)`
specifically, so a named database would need plumbing the current code does not have. The six
`VITE_FIREBASE_*` values are in a local `.env`; they still have to be set in Netlify's site
settings, because Vite bakes them in at build time and a deploy without them silently runs
localStorage-only.

Two shape recommendations for when it is written: **one document per song**, not a subcollection
of chords — chords and placements are always read and written with the song, and `retokenise`
re-mints word ids on every lyric edit, so partial writes buy nothing. And `users/{uid}/songs/
{songId}`, which copy-on-share above settles, and which makes the security rule one line:
`allow read, write: if request.auth != null && request.auth.uid == uid`.

Before the first sign-in ships: Firebase Auth checks the calling domain against its **Authorized
domains** list, and Netlify deploy previews get generated hostnames that will not be on it.

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

**Landed: sign-in and the username claim.** Google plus email/password (`src/lib/auth.ts`), a
`useAuth` hook holding the three states that matter — loading, signed out, signed in without a
handle — and a two-step `SignIn` screen that will not let an account stay half-made. The claim
is `usernames/{handle} -> { uid }` in a transaction, with `firestore.rules` re-validating it.
The pure handle rules are in `src/lib/username.ts` and tested.

**Landed: rules deployed, both providers enabled, and songs sync per-user.** All four console
steps above are done — rules are live, Google and email/password are on, `chordcreator.netlify.app`
is an Authorized domain, and Netlify carries the six build-time vars.

Songs sync too: `src/lib/songSync.ts` writes one document per song to
`users/{uid}/songs/{songId}`, and `useSongs` mirrors local edits up by diffing `store.songs`
against the previous render by *reference* — `editSong` already returns the same song and array
objects for anything an action did not touch, so the diff is free rather than a deep comparison.
`localStorage` stays what the UI actually reads and writes; Firestore is a mirror, not a second
read path, which is what keeps the reducer itself ignorant that a server exists.

The migration ROADMAP.md warned about — done via `mergeOnSignIn` (tested in
`songSync.test.ts`): a brand-new account keeps every local song and pushes them all up; an
existing account's remote library wins on any id both sides already share, since two edited
copies of one song cannot be merged, the same call made for shared songs in §1. The one addition
beyond the original plan: `lastSyncedUid` (a small `localStorage` marker) stops a *second*
account signing in on the same device from silently inheriting the first account's unsynced
local work — without it, someone else's device would hand you their in-progress songs.

**The loose chord library syncs too.** `USER_CHORDS_KEY` — shapes built with no song
open — now mirrors to `users/{uid}/chords/{chordId}` through `chordSync.ts`, on the same
`mergeOnSignIn` rule. That rule and the cross-account guard (`lastSyncedUid`) moved out of
`songSync.ts` into `src/lib/accountSync.ts` so both `useSongs` and the new `useUserChords`
share one copy rather than two copies that could drift. Closes the gap ROADMAP.md §2 flagged:
"user chords ... come along with them."

**Known gap, not yet solved:** no live cross-device sync within a session — a song edited on a
phone will not appear on a laptop already open until the laptop's own next sign-in-time hydrate.
Landing that would mean an `onSnapshot` listener, and it was left out because it reintroduces the
exact echo problem `mergeOnSignIn` was built to avoid: a remote update arriving mid-edit needs
telling apart from an edit this device just made, or the two would fight. Worth doing once it is
actually felt, not before.

- Follows from the above: auth exists to answer "whose song is this", so its shape depends on
  whether songs get owners and how sharing addresses a recipient.
- Today the README's premise is "single user, no accounts, no backend" — landing this changes
  that promise and the README needs rewriting with it.
- Keep the app usable signed-out. Someone who just wants to tap out a chord sheet on a pitch
  should not hit a login wall first; sign-in should be what unlocks backup and sharing.
- **Claiming the username chosen in §1.** Firestore has no unique constraint, so the handle is
  claimed by writing `usernames/{name} -> { uid }` in a transaction — the document id is the
  index, and a doc id can only exist once. Normalise on claim (lowercase, trimmed, character
  whitelist, a reserved list), and keep any display casing as a separate field. Sign-in
  pre-fills the local handle the user already picked, so the usual case is one confirmation
  tap; a collision is the only case that asks them to choose again, which is why the unclaimed
  handle never renders with an `@`.
- **Never key data on the username.** People rename. `copiedFrom` stores the uid and treats the
  handle as a display lookup, or every rename orphans the lineage of songs already shared.
- A public directory is enumerable, which is what makes unsolicited sends possible. If in-app
  sending to a handle ever lands, a song from a stranger belongs in a pending tray, not
  straight in the library.

## Later

Carried over from the README's "Not built" section — deliberately deferred, not forgotten:

- **Send a link to the band.** Needs a backend or a URL-encoded song payload; currently
  everything is `localStorage` and offline.
- **A real chord speller.** Names are matched against `chordLibrary` and stay user-editable.
- **Left-handed mirroring.** `layout.ts` is the only place that converts string number to
  x position, so the flip has one home.
- **Other instruments.** Would generalise the 6-string assumption in `layout.ts` and `shape.ts`.
- **Finger numbers in the dots.** `Dot` already carries an optional `finger` the reducer ignores.
- **A service worker, so the offline promise is true of the app and not just the data.** The
  README says it "works with no signal", and the data does — but there is no service worker, so
  a cold load on a dead connection gets nothing at all. On localhost you never notice. If
  reading a chart on a windy pitch is the real use case, caching the shell is the piece that
  makes the claim honest. Noted when hosting moved to Netlify; not started.

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
