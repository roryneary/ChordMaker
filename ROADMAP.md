# Roadmap

Features to come back to. Newest thinking at the top of each list; move an item to
**Done** with the commit that closed it, or delete it if it stops being wanted.

## Next

### 0. One app: absorbing StreetPerformer

The goal is to use one app. StreetPerformer (`C:\Projects\Windsurf\StreetPerformer`) is the one
in daily use. **Wanted from it: playlists**, and the library and reading view that make them
useful. **Not wanted: history, song ratings, sessions** — which are about half its code,
including one 2,600-line component, so leaving them behind makes this a small job, not a port.

The two apps are closer than they look: the same stack (React, TypeScript, Vite, Firestore,
Netlify) and the same song path, `users/{uid}/songs/{songId}`. They differ where it matters.
StreetPerformer reads straight from Firestore and is unusable with no signal; here `localStorage`
is the read path. Its chords are text typed by hand into a lyric blob plus a comma-separated list
of names; here they are real shapes attached to words. It has two lyric blobs per song
("practice" with chords, "public" without) and `artist`, `learningStatus`, links and attachments
on the song; this app has `key`, `feel` and the three-state `capo`.

**The diagnosis, 2026-09-19:** this app is not the one in daily use because its library and
playlists are poor next to StreetPerformer's — one flat list, no search, no artist, no delete, and
until now no playlists at all. What makes StreetPerformer's good, read from its code: a findable
library (search over title and artist that survives a reload, sort, remembered choices); rows you
can act on; songs and playlists linked both ways (pills on a song row that open the playlist at
that song, and returning to your place afterwards); an add-songs step that shows what is already
in; reordering that never loses the row you moved; and a delete that first names every playlist
the song will leave. What it lacks: next/previous while reading, anything offline, and it pays
O(songs × playlists) Firestore reads per library visit for those pills.

Playlists have landed (see Done). What is left, in order:

1. **Make Songs findable.** The order was changed to put this *before* more playlist work: a
   playlist picker over a list you cannot search, with no artist, is as poor as the list itself.
   - `artist`, optional, following the `capo` precedent in `src/types/song.ts` — absent is a
     meaningful state, so no migration. Shown on the card and the playlist row. **It needs a
     line in `firestore.rules` too** (`validSong`'s field list), or every save is refused — the
     rules name a song's fields now. The same goes for every field in items 5 and 6.
   - Search over title and artist on the Songs screen, the query kept across reloads. `matchesQuery`
     in `src/lib/playlists.ts` is the start of it (title only, used by the add-songs step); it
     should move to a module of its own when it grows.
   - Sort: recently touched (today's only order), title, artist. Remembered.
   - ~~Delete a song~~ — landed 2026-09-20, see Done.
2. **Play a playlist.** Full screen reading that steps to the next and previous song in the set —
   further than StreetPerformer goes. This is the part of "sessions" worth keeping, without any of
   the recording. Tapping a song in a playlist opens the builder today, which is the wrong screen
   for someone about to play it; this is what fixes that.
3. **Import from StreetPerformer.** Probably the real adoption blocker: the repertoire lives
   there. It has no export, so this is a one-off read of its Firestore: songs, the `lyrics/v1`
   document per song, playlists and their items. Title, artist, capo and playlists map directly.
   The hard part is the lyric blob — chord lines typed above the words need detecting and
   attaching to the word beneath by column. Names that match the 48-shape library get real
   diagrams for free. Needs `artist` from step 1 to land first.
   **And it will meet the storage ceiling.** Measured on 2026-09-20: every word carries a
   36-character id, so a typical 250-word song is about 25 kB, not the "well under 20 kB" §2
   assumed. `localStorage` holds roughly 5 MB, which is about **200 songs** — and `saveStore`
   swallows the quota error, so past that, saves fail silently on the device. A whole
   repertoire arriving at once is where that bites first. Shorter word ids would roughly halve
   a song; they only have to be unique within it. Do that, and make a failed local save say so,
   before or with the import.
4. **Playlist niceties, when felt:** favourites pinned to the top; reordering the playlists
   themselves (they list in creation order); "add all from another playlist"; putting the same
   song in twice from the UI (the model allows it, the screens do not offer it).
5. **`learningStatus` and links**, as optional fields like `artist`. Deliberately not early.
6. **Attachments**, only if missed. They need Cloud Storage, which §2 below deliberately avoids.

Also worth doing when it is felt: a way to see or recover **stashed songs and playlists** without
signing back in as the account they belonged to.

### The sharing, database and sign-in project

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

- **The path is the owner of record, not a field.** With `users/{uid}/songs/{songId}` the
  document's location already says whose it is, and a stored `ownerId` beside it is a second
  copy of the same fact that can drift out of agreement with the path. "Add one only if songs
  ever need to be readable outside their owner's subtree" — they now do, so the *shared copy*
  carries `ownerUid`. The song itself still does not.
- **`copiedFrom` keeps the lineage visible** — the share it came from, and enough of the sender
  to render "from @rory" without a lookup that a signed-out reader cannot make. It stores the
  uid and treats the handle as display (§3: never key on the username). Optional, the `capo`
  precedent: absent is a meaningful state.
- **The sender is identified by a username, never an email.** `copiedFrom` travels with a song
  that cannot be recalled, so an email in it would leak to everyone downstream, forever. Only a
  claimed handle can share — the rules check it against `usernames/{handle}` — so `@rory`
  always means verified. (The earlier plan for an unclaimed, pre-auth local handle is dropped:
  sign-in landed first, so it was never needed.)

**Landed 2026-09-20: links, a browsable library, and updates.** README, "Sharing a song", has
the model and the reasoning; the short version is three documents that are never the same one —
the owner's song, a copy at `shared/{shareId}`, and the recipient's own copy.

This **supersedes "the share is a snapshot, not a subscription"**, which was the decision until
now, and un-parks "notification of updates". It is still copy-on-share and there is still no
merge; what changed is that the shared copy is a document with an address, so a recipient's copy
has something to check back against. What was decided along the way, each asked and answered:

- **How a song travels: a link to a Firestore document**, not a URL-encoded payload. A payload
  is inert once received; an address is what makes updates possible at all.
- **The owner shares changes deliberately**, with a button. Automatic-on-save was rejected:
  half-finished edits would go out, and recipients would be asked about every typo.
- **Recipients are always asked** — *Replace mine* or *Keep mine, and add the new one* — even
  for a copy they never touched. (The parked sketch said replace-if-untouched; "always ask" was
  preferred because it has no hidden rule about what "untouched" means.)
- **A link opens for anyone, account or not**, and "Keep this song" works signed out. The cost,
  accepted knowingly: a link-only share is **unlisted, not private** — whoever it is forwarded
  to can read it until the owner stops sharing. "Only these @handles" was considered and not
  taken; it would force every recipient through sign-up before seeing a chord.
- **The owner chooses per song** whether it also shows in the browsable library.
- **The word "version" stays out of the UI.** Internally a counter; on screen, "changed".
- **`users/{uid}` lost its wildcard rule in the same pass**: named collections, whitelisted
  fields, size limits at four times the longest real song. The rules must now be kept in step
  with `types/song.ts` and `types/playlist.ts` — see the notes on §0's items.

**Deployed 2026-09-20, and still to be checked by hand:**
- **The rules are live, but they have never been exercised.** `firebase deploy --only
  firestore:rules` reported the file already matched what was in the project, so this version
  has been live for some time; it compiled cleanly. That is not the same as having run. There
  is no Java on this machine, so the Firestore emulator could not start and `firestore.rules`
  is still reviewed by eye only. It replaces the rule every existing save depends on, so a
  mistake in `validSong` stops *all* songs saving, not just sharing. Check straight away:
  save an ordinary song and a playlist and watch the sync line; then walk the
  list in the plan — a write to `users/{me}/anything/x` refused, a signed-out `get` of a shared
  song allowed, any `list` of `shared` refused, a card for someone else's share refused,
  publishing under someone else's handle refused, a version jump of two refused.
- **No end-to-end run in a browser** with two accounts: share, open signed out, keep, sign in,
  share changes, replace / keep mine, stop sharing, find it in Shared songs.

Still open, deliberately:
- **Search is by the start of the title only.** It is what Firestore does unaided. Searching by
  handle, or mid-title, needs either client-side filtering of a bigger fetch or a search service.
- **Checking for changes downloads the whole shared song** per followed copy, once a session.
  Fine at tens of songs. If it stops being fine, a tiny `sharedVersions/{id}` document is the fix.
- **Rules cannot cap how many documents an account writes, and there is no App Check.** The
  field whitelists stop arbitrary data; they do not stop ten thousand valid songs, or a script
  signing up accounts. App Check, and a count enforced by a Cloud Function, are the answer if
  it is ever abused. A cost risk, not a privacy one.
- **A shared-computer gap, older than sharing:** signing out leaves the songs in `localStorage`,
  because the app works signed out. "Remove my songs from this device" at sign-out would close it.
- **A renamed handle** is picked up the next time the owner shares changes; until then the
  shared copy and its card carry the old one. Copies already kept show the name as it was.

### 2. Database support

**Decided: Firestore, hosted on Netlify, and no Cloud Storage.** Everything the app persists is
small JSON — a typical song is about 25 kB (see §0.3; "well under 20 kB" was the estimate, and it
was low) against Firestore's 1 MiB document limit — and the PNG
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

- Songs are the only thing worth storing. (Superseded: "user chords (`USER_CHORDS_KEY`) come along
  with them" — that store is retired, see Done.)
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
`accountSync.test.ts`): a brand-new account keeps every local song and pushes them all up; an
existing account's remote library wins on any id both sides already share, since two edited
copies of one song cannot be merged, the same call made for shared songs in §1. The one addition
beyond the original plan: `lastSyncedUid` (a small `localStorage` marker) stops a *second*
account signing in on the same device from silently inheriting the first account's unsynced
local work — without it, someone else's device would hand you their in-progress songs.

**Superseded — the loose chord store is retired, see Done.** What follows is kept for the
reasoning about `accountSync.ts`, which still holds. *The loose chord library syncs too.* `USER_CHORDS_KEY` — shapes built with no song
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

- **A real chord speller.** Names are matched against `chordLibrary` and stay user-editable.
- **Left-handed mirroring.** `layout.ts` is the only place that converts string number to
  x position, so the flip has one home.
- **Other instruments.** Would generalise the 6-string assumption in `layout.ts` and `shape.ts`.
- **Finger numbers in the dots.** `Dot` already carries an optional `finger` the reducer ignores.
- **One Firestore write per keystroke.** `useSongs` sends work the moment `unsynced` changes,
  with no debounce, so typing a title or editing a lyric is a write per character — a cost on the
  bill and a sync line that never settles. The reducer side is already right (`unsynced` is set
  atomically with the change), so the fix is entirely in the send effect: wait a beat before
  sending, and send whatever is unconfirmed then. `SavedLine`'s half-second damping hides the
  symptom in the UI; this is the cause. Noticed while adding that line; not started.

- **A service worker, so the offline promise is true of the app and not just the data.** The
  README says it "works with no signal", and the data does — but there is no service worker, so
  a cold load on a dead connection gets nothing at all. On localhost you never notice. If
  reading a chart on a windy pitch is the real use case, caching the shell is the piece that
  makes the claim honest. Noted when hosting moved to Netlify; not started.

## Decided against

- **A progress tag on the song card.** It read "Just chords", "Half done" or "Ready" from
  how many lyric lines had a chord dropped on them, which called a finished song unfinished:
  dropping chords on words is a nice to have, and a sheet with the shapes typed into the words
  by hand is complete. Nothing on a card judges a song now — `songSubLine` says what is in it.
  The "lines to chord" readouts on the sidebar and song screen were left alone: they count,
  they do not grade.

- **Capo changing the diagrams.** `rootFret` means an absolute neck position; making it
  capo-relative would silently reinterpret every chord already saved.

## Done

- **A "Saved" line where the writing happens, and still no Save button.** Autosave was invisible:
  the one honest sentence about it was on the sidebar chip and the Account screen, and `chromeFor`
  gives the song screen and the words editor no chrome on a phone — so for the whole time you were
  writing, nothing said the song was kept. `SavedLine` sits beside the title on both, phone and
  desktop. A Save button was rejected: it would commit nothing that has not already been committed,
  and it would teach people that leaving without pressing it loses work. `savedLabel` is a second
  wording beside `syncLabel` because the chip is about the *account* and signed out it makes an
  offer where a status belongs; in a song the line leads with the device and names the account only
  when the two differ. Saving is announced only after half a second, since there is a write per
  keystroke and the un-damped line flickers per character; a failure is never delayed.
  **Not yet checked in a browser** — particularly the phone header, where the line shares a
  cramped row with the title, and the failure state, which needs a refused write to see.

- **The chords stay in view in full screen.** Reading the sheet on a stand, the shapes were on
  the screen you had just left. They are now a pinned strip above the words: outside the
  scroller, so scrolling to the last verse leaves them where they are. One sideways-scrolling
  row rather than a wrapping grid — wrapped rows come out of the words — and no strip at all
  for a song with no chords. **Not yet checked in a browser**, particularly a phone on its side,
  which is the width where the strip costs the most.

- **Delete a song from its own screen.** The bin was only on the Songs list, which is not
  where you are when you decide a song was a mistake. "Delete this song" is now the last line
  of the song screen, phone and desktop, opening the same `DeleteSongSheet`. `App.tsx` watches
  for the song going (`leavingId`) and moves to Songs — a song route with no song falls back to
  whichever song is current, so without that a delete quietly showed you a different song. It
  is watched rather than done on the tap because a shared song's delete can be refused.
  **Not yet checked in a browser.**
  *Still missing:* **a chord cannot be removed from a song at all.** `REMOVE_CHORD` exists in
  the reducer and is tested, and nothing dispatches it.

- **Remove blank lines, in the words editor.** A paste from a lyrics site is often
  double-spaced — a blank after every line — and on the sheet every one of those is a gap. The
  words editor now counts the blank lines under the box and offers to take them out
  (`removeBlankLines` in `lib/lyric.ts`). On a double-spaced paste the single blanks go and the
  longer runs, which are the verse breaks, are kept as one line each; anywhere else there is
  nothing to tell the two apart by, so they all go, and a second press takes the verse breaks
  too. "Put them back" undoes it until the next edit, because setting a textarea from code
  empties the browser's own undo. No word moves, so every placed chord stays where it was.
  **Not yet checked in a browser.**

- **Delete a song, and "Make available globally" on every row.** §0.1's delete. A bin on each
  row of Songs opens `DeleteSongSheet`, which says what the delete reaches before it is pressed:
  that there is no undo, the playlists the song will leave *by name*, and — for a shared song —
  that its link dies and it leaves Shared songs. **Deleting a shared song takes the shared copy
  down first, and only deletes if that worked** (`onDelete` in `useSharing`). The alternative
  was considered and refused: once the song is gone nothing remembers its share id, so a copy
  left up is published for good with nobody able to remove it. Copies other people kept are
  theirs and are not touched. So a shared song cannot be deleted signed out, or with no signal;
  the sheet stays open and says why. The rules were changed to allow deleting a share that is
  already gone (stopped from another device), or that case could never delete at all.
  The same row got a **"Make available globally"** checkbox, because the way into the shared
  library had been a tick-box inside "Send a link to the band" — README, "Sharing a song".
  And the account screen's name chip, which looked like a button and did nothing, opens Songs.
  **Not yet checked in a browser:** any of it; deleting a shared song especially, since it is
  the one path that waits on the database.
  *Open question:* unticking "globally" leaves the link working, because it may have been sent
  to someone. For a song only ever shared by the tick-box, stopping altogether may be what
  the player means. One flag on `SharedRef` would tell the two apart.

- **Sharing songs.** See §1 above, which carries the decisions, what is unchecked and what is
  open, and README, "Sharing a song", for how it works. Closes "Send a link to the band".

- **Playlists, with pills on the songs; and the gig bag is gone.** §0's first item. One document
  per playlist at `users/{uid}/playlists/{playlistId}` holding `items: { id, songId }[]`, synced
  by the same unconfirmed-list, merge and stash as songs. One departure from the plan as written:
  there is **no `usePlaylists` hook** — playlists live in `SongStore` and `songsReducer`, because
  the plan's other requirement, that `DELETE_SONG` sweep every playlist *in the reducer*, cannot
  be met across two stores. Screens: Playlists, one playlist (rename in place, ↑/↓ with the moved
  row picked out, remove, delete with a confirm), and an add-songs step that shows what is already
  in. Every song row carries a pill per playlist it is in, opening that playlist at that song, and
  a "+ Playlist" that adds it to one or makes a new one around it. The pills were added on a "we
  can always take them out" basis: they are `memberships`/`onOpenPlaylist` on `SongCard`, and
  leaving those props off removes them.
  **"Gig bag" is retired** as a name and as a screen-of-sections: Songs and Playlists are separate
  destinations in both navs. The phone's tab bar is now six items, which fits at 360 px but is the
  limit — "Start" duplicates the home screen's two cards and is the one to drop if it feels tight.
  README, "Playlists", has the reasoning. **Checked by hand on 2026-09-19** in a headless browser,
  signed out: create from a song row, pill → playlist with the row lit, add step, reorder, rename,
  persistence. **Not yet checked:** a signed-in round trip to Firestore.

- **Everything is a song, captured fast, and sent as one picture.** "Just one chord" opened the
  editor with no song and saved to a loose-chord store that no screen ever read, while both "Gig
  bag" buttons went nowhere: two persistence paths, one of them a dead end. The real use is a
  lesson where a tutor calls out the chords, so the second way in is now **"Just the chords"** —
  a song from the first tap, landing on the song screen with the title focused, so it is name,
  capo, Add. The editor has a single Save that returns to the song ("Save, add another" was
  tried and removed: two save buttons were confusing). The words are added
  later to the same song; nothing is converted. The loose store (`useUserChords`, `chordSync.ts`)
  is deleted and its contents folded into a "Loose chords" song on first load.
  The Ready sheet can **send, save or copy one picture of every chord** with the title and capo
  over it, sized to read in a chat preview (`exportChordSheet.ts`), and the editor can save a
  single shape. The PDF already handled a song with no words, so the one-page chord sheet needed
  no code. **The gig bag is the song list**, reachable from both navs.

- **Sync that can be trusted, and says so.** The reason this app was not the one in daily use was
  the belief that it did not store songs in the database. The write path existed and was correct;
  what was missing was any way to know. Every Firestore call was fire-and-forget, nothing in the
  UI reported sync, and the chip said "saved" unconditionally. Now the store lists the ids the
  account has not confirmed and persists that list; every call is caught, reported and retryable;
  the sign-in merge runs in the reducer and lets an unconfirmed local edit beat the remote copy;
  and a second account no longer wipes the first one's songs from the device. README, "Whether
  it is really saved", has the reasoning. **Checked by hand on 2026-09-19:** signed in on localhost, a
  song document lands under `users/{uid}/songs` in `chordcreator-c7378`, with its shapes in the
  document's `chords` array — there is no separate chords collection, which is what made it look
  as if chords were not being stored. **Still to check:** the same on the Netlify site, which
  depends on the six build-time values being set there; the status line names the cause if not.

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
