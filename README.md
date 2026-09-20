# Chord Creator

Build a song sheet: tap out the chord shapes, paste the whole lyric in one go, drop chord
names onto the words they land on, then read it full-screen on a windy pitch or print it on
one A4 page.

Songs live in `localStorage` and the app works with no signal. Accounts exist on top of that
rather than in front of it: you can build a whole sheet without ever signing in, and signing in
is what earns a name to share songs under and, in time, a copy on every device you play from.

```
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests
npm run build    # typecheck + production build
npm run lint
```

## How it holds together

**One function draws every chord.** `renderChordSVG(spec, opts)` returns an SVG string, and
the editor, the read-only diagrams and the PDF all consume it. Every style in that string is
a **presentation attribute** — a serialised SVG carries none of the document's CSS, so a class
name or a `var(--color-text)` would export as unstyled or black-on-black. The design's
`color-mix(… 34%, transparent)` ink strengths become `stroke-opacity`, which renders the same
and survives the trip through canvas.

That is also why the renderer takes a resolved `ink` hex rather than reading the theme itself:
`src/theme/tokens.ts` holds the same values as `src/styles/tokens.css`, so CSS and canvas share
one source of truth without the artwork depending on layout having happened.

**Every drawing number lives in `src/lib/layout.ts`**, on the design's grid — `viewBox
0 0 100 122`, strings at x 10…90, frets every 18 units. The SVG has a fixed viewBox and
`width: 100%`, so the interaction overlay positions its buttons as percentages via
`cellRectPct` / `markerRectPct`. There is no `getBoundingClientRect` maths anywhere.

**A diagram is a five-fret window, and `rootFret` says where that window starts.** Dots hold a
fret *relative* to the window, so moving the window slides the whole shape up the neck without
redrawing it — the Position stepper in the editor does nothing but dispatch `NUDGE_ROOT_FRET`
(a delta, not an absolute: React batches a burst of taps, so a component computing
`rootFret + 1` would lose every step but one). At the first position the nut bar says "open";
anywhere else there is no nut, so a roman numeral says which fret the window starts on. It is
also spelled out in the SVG's `aria-label`, since a screen reader reads "VII" as three letters.

**The numeral sits to the right of the grid, on the centre line of the fret it names**, and
the viewBox is the same `122 × 122` for every chord. That column is reserved whether or not a
numeral is drawn, and that part is not cosmetic: every container sizes a diagram by its
**width** — a tile, the editor plate, a fixed column in the PDF — so a box that grew only when
it carried a numeral rendered its fretboard 19% smaller than the nut-position chord in the
next tile along. Reserving the column costs an open chord a little empty space and keeps every
fretboard in the app identical, which is what matters on a stand. The screen containers are
sized from `VB_W` so the fretboard itself did not shrink when the column was added.

`LABEL_X` clears `stringX(1) + DOT_R`, not merely the grid line: most chords up the neck are
barres, so a numeral tucked against the grid disappears under the bar end. Its width cannot be
measured at runtime — the export path renders through canvas with no DOM — so `layout.test.ts`
guards the arithmetic instead. Because the box never changes shape, nothing downstream asks
how wide a particular chord is: the overlay, the PNG and the PDF all just use `VB_W`.

**The overlay is real `<button>` elements**, not SVG hit-testing — keyboard support, screen
reader labels and focus rings come for free. Press-and-drag lays a barre; a tap places a dot.

**All chord invariants live in the reducer** (`src/hooks/useChordSpec.ts`), never in
components. String numbering follows guitar convention: 1 = high E, 6 = low E, and string 6
draws **leftmost**. Left-to-right conversion happens only in `layout.ts`, guarded by a test.

## Chords stay attached to words

The lyric is one raw string with its line breaks preserved verbatim; a blank line is a gap on
the sheet. Chords attach to **words**, not offsets — word indices break when you insert a word
earlier in a line, and character offsets break on any edit at all.

So `src/lib/lyric.ts` mints an id per word at paste time, and `retokenise` re-matches an edited
lyric against the old words with an LCS so those ids survive. That is what makes the promise on
the words editor true: chords you have already placed stay put when you edit the words.

The one edit the app makes for you is **Remove blank lines** (`removeBlankLines`), for a paste
that arrives double-spaced. It tells noise from structure by the shortest gap: if every line is
followed by a blank, that much comes out of every gap and whatever is left is a verse break,
kept as one line. It only ever deletes whole blank lines, so the word sequence is untouched and
the LCS carries every id across.

## The chord library

`src/data/chordLibrary.ts` — 48 shapes in the bundle, about 1.5 kB. No fetch, no schema, no
server, and it works with no signal. Every count of the built-in shapes reads `LIBRARY.length`;
the sidebar's number beside "Chord library" adds My chords to it, because the library holds both.

Shapes use the design's compact notation (`x32010`), converted to `ChordSpec` by
`src/lib/shape.ts`. `ChordSpec` stays canonical because the string cannot express more than one
barre, a fret past 9, or a string left unset.

**Barre detection** is ported from the design's `ChordDiagram`: a barre needs two strings at the
lowest fret spanning at least four positions. That span rule is what stops A (`x02220`) drawing
as a barre while F (`133211`) and Bm (`x24432`) correctly do.

One deliberate deviation: a barre is also rejected when a string **inside** the span is open or
muted. A finger laid across the neck frets everything it crosses, so without this Bm7 (`x20202`)
and F#m7 (`202220`) draw a bar over strings the player is letting ring.

## Screens

A handful of routes and a back-stack in `src/app/routes.ts` — no router library. The stack exists
because full screen must return to the screen you came from, not the landing page.

**Everyone lands on the home screen, and it is two screens**, told apart by whether there is a
song on the device. With none it is a welcome: what the app makes, the one way to start, a way to
see a song someone else has shared, and sign-in — because someone with forty songs on another
device arrives looking exactly like someone with none. With songs it is the few opened last.

"Opened last" is not `updatedAt`. Opening a song to play it is not an edit, and stamping it as one
would send a write to the account per reading and tell everyone holding a copy of a shared song
that it had changed. So the ids are kept beside the store, on this device (`lib/recent.ts`,
`useRecent`); an id with no song behind it is skipped, so nothing has to keep the two in step, and
with nothing opened yet the list falls back to the latest edits. The sidebar's "Recent" is the
same list.

**There is one way to start a song**: landing → song → chord editor / words / full screen / ready.
There were two, "A song to play" (landing → words) and "Just the chords" (landing → song), which
made the same song and differed only in which screen came next — a new player was asked to choose
a workflow before seeing either. The song screen serves both: the title of a song with nothing in
it is focused as the screen opens, so a lesson where a tutor is calling out chords is still name,
capo, Add, and "Paste the words in" is one tap away for someone who has the words first. The
editor has one Save, which returns to the song — a second "Save, add another" button that
cleared the plate in place was removed because two saves on one screen confused more than the
round trip cost. Back (the arrow at the top, or the button beside Save) leaves
without saving, and asks first if the chord has changed (`chordChanged` in `lib/chordEdits.ts`).

**Full screen pins the chord shapes above the words.** The strip sits between the bar and
`.fs-words`, which is the one that scrolls — being outside the scroller is the whole mechanism,
there is no sticky positioning and nothing measures anything. It rests on `.shell` having a
fixed `height: 100dvh` rather than a minimum: give the shell an open-ended height and every
screen's own scroller sizes to its content instead, so the page scrolls as a whole and the
strip goes with it. It is one row that scrolls
sideways rather than wrapping, because every row it wrapped onto would come out of the words;
the diagrams are small (64 px, 88 px on desktop) on the grounds that mid-song you are checking
a shape you already know. The PDF's chord reference row is the same idea on paper.

**A chord can exist without a song, in My chords — and only there.** This reverses what stood
here, "there is no such thing as a chord without a song". That was the cure for a real fault:
"Just one chord" used to open the editor with no song and save to a store of its own
(`USER_CHORDS_KEY`, mirrored to `users/{uid}/chords`) that no screen ever read back, a second
persistence path that went nowhere. The diagnosis was right and the cure too strong — the fault
was the missing screen, and the Chords tab is that screen. See "My chords" below. The retired
store is still gone: `loadStore` folds anything left in that key into one song titled "Loose
chords" and removes the key, and `#/chord/new/new` still goes home rather than to the new editor
(`#/library/chord/new`), so an old bookmark does not start making chords.

**Songs and Playlists are two destinations, in both navs** (`#/songs`, `#/playlists`). The
sidebar shows the last few songs and the tab bar shows none, so Songs is the only way to an
older song on a phone. It used to be called the gig bag, with playlists planned as a section
inside it; the name needed explaining and the section would have buried the thing the app was
missing, so each got its own screen and is called what it is.

The shell gives desktop a sidebar and mobile a tab bar, and shows **neither** while editing a
song or reading full screen. The library is a *step* when opened from the editor and a
*destination* when opened from a browsing screen — `libraryIsStep` decides, and with it who
owns the way out. One playlist is a browsing screen and keeps the tabs; adding songs to it is a
step with one action of its own, and gets none.

## My chords

The Chords tab holds the built-in shapes and, above them, **My chords**: shapes the player made
and chose to keep, outside any song. It is where one chord is made to send to someone — which
used to mean making a song to hold it — and what the editor's "Browse all" picks from.

**A song's chords are still the song's own.** Picking from My chords copies the `spec` into the
song exactly as picking a built-in shape does; `SavedChord` records no origin and must not start
to. Editing or deleting a kept chord never reaches into a song, and the delete sheet says so.
That is what keeps a song one self-contained document, which sharing, both exporters and the
offline read all rest on. The price, accepted: a better fingering found later does not
propagate. If that ever hurts, the answer is a deliberate "replace this shape in my other songs"
that lists them and asks — never a live link.

**Keeping is explicit, and a copy in the other direction.** Deriving the library from every
chord in every song was considered and dropped: a derived entry cannot be deleted (it comes back
while any song holds it), and a song kept from someone else would pour its shapes in as yours.
There are two ways in. **Make a chord** in the Chords tab, where Save *is* keeping. And in a
song's editor, a **"Keep in My chords" tick-box over the one Save** — a box, not a second button;
two saves on one screen were tried and confused. It starts ticked for a new chord and *unticked*
for one already in the song, or every chord touched in a shared song would pour in; opening a
chord, ticking the box and saving is how a shape made before this existed is kept. That save must
not count as an edit, so `UPDATE_CHORD` returns the same song when nothing changed — otherwise
`updatedAt` moves, the song syncs again, and everyone holding a copy is told it changed.

**One entry per shape**, and a built-in shape is never listed again as yours. Sameness is
`shapeKey` in `lib/myChords.ts`: per string, the absolute fret it is stopped at, or open, muted
or unset. Absolute, so the window does not matter; per string, so a barre and the same strings
fretted one by one are one chord. It is deliberately not `specToShape`, which is null for two
barres or a fret past nine: B drawn with two barres would have fallen to some second scheme, B
drawn with dots would not, and the first would not have been recognised as built in. The rule is
the reducer's (`KEEP_CHORD`, `UPDATE_MY_CHORD`); the editor asks `keepOffer` first so it can say
*why* — "one of the built-in shapes", "already in My chords, as …" — in a row that is always
there, because a shape passes through Em on its way to something else and a box that came and
went would shove Save about. From the Chords tab a shape that cannot be kept cannot be saved,
rather than Save silently doing nothing.

**It is in the song store, like playlists** (`SongStore.chords`, `unsyncedChords`), for the
plumbing and not for any tie to songs — no song action touches it and none of its actions touches
a song. One document per chord at `users/{uid}/chords/{chordId}` (`lib/chordSync.ts`), with the
same unconfirmed list, merge and stash. Two things are its own:

- **Sign-in merges by id and the rule is by shape**, so the same shape kept offline on a phone and
  a laptop arrives as two. `HYDRATE` runs `collapseByShape`: the older wins, then the lower id — no
  tie, so both devices drop the same one — and the loser is listed as unconfirmed with nothing
  behind it, which is how a delete is spelled.
- **That Firestore path had a tenant.** The retired store's documents may still be there, bare
  `{ id, spec }`. `parseMyChord` will not read a chord without its two stamps — strict on purpose,
  unlike `parseSong` and `parsePlaylist`, and tested so nobody evens it up — so they are skipped
  instead of coming back as duplicates of the "Loose chords" song. They are not cleared on the way
  past: "delete what I cannot read" is a rule an older build would apply to a newer build's chords.
  `validChord` in `firestore.rules` requires the stamps too, and is the one place a chord's own
  fields are checked at all — a song's chords are a list, and rules cannot look inside a list.

**Sending a chord is sending a picture of it.** Any chord in the Chords tab, yours or built in,
opens a sheet with the three rows the Ready sheet offers for a song: send, save as a picture,
copy. A chord the recipient could *keep* would be a new kind of shared document with rules of its
own; not built.

The Chords tab is two screens, as it always was. Under an editor it is a step: a tap hands the
shape back (the shape, not the name — two voicings of G are both "G"), and there is no Make,
which would be one editor on top of another. Otherwise it is a place. The route for a chord of
your own, `myChord`, is looked through by `openSongId` like the library is, so that reaching it
with a blank song underneath can never get that song thrown away.

## Playlists

A playlist is an ordered list of songs you already have, and **one document, items and all**:
`{ id, name, items: { id, songId }[] }`. The order of `items` is the running order — there is no
`position` field to keep in step with it — so a reorder is one write. Items carry their own id so
the same song can be in a set twice and the two entries moved and removed independently.
StreetPerformer, which this replaces, kept items in a subcollection: a reorder rewrote every item,
and finding which playlists a song was in cost a query per playlist per song.

**Playlists live in the song store, not a store of their own** (`SongStore.playlists`), and that
is load-bearing. `DELETE_SONG` takes the song out of every playlist *in the same reducer step*;
with two stores the second could only follow the first, and a reload between them would leave a
playlist naming a song nobody can open. They sync exactly as songs do — their own
`unsyncedPlaylists` list, the same `mergeOnSignIn`, the same stash when a different account signs
in — to `users/{uid}/playlists/{playlistId}`, which the existing owner rule already covers. A
store saved before playlists existed reads as having none: no version bump, the `capo` precedent.

An entry whose song is missing is **skipped when drawn, not pruned** (`resolveItems`). The sweep
covers deletes on this device, but a playlist can still arrive from the account naming a song
another device deleted, and rewriting it on sight would turn a read into a write.

**Each song row says which playlists it is in**, as pills (`membershipBySong`, one pass over data
already in memory). A pill opens its playlist with that song picked out and scrolled into view;
a row you move gets the same treatment, so a reorder never loses the row you moved. Which row to
pick out is held in `App.tsx`, not in the route — it describes one arrival, and a hash carrying it
would pick the row out again on every reload and every Back. This is also why `SongCard` is a box
with a button in it rather than one big button: a pill is a control, and a button cannot hold one.

Names are unique ignoring case, and never empty — a blank pill, or two alike, is a pill nobody can
read. The reducer refuses both; the screens say why before it comes to that. The reducer *allows*
the same song twice; the add screens do not offer it, because the likelier tap is a mistake, and
show a song already in the playlist ticked and locked rather than hiding it.

**"Looks right" is a claim, so it is checked before it is accepted.** `Song.capo` has three
states, not two: a fret, an explicit `null` meaning "no capo", and **absent** meaning nobody
has been asked. Defaulting to `null` made the chip read as a settled answer, so players never
noticed the capo was theirs to set — and a capo moves every chord on the sheet. An unanswered
capo therefore renders as a dashed "Set the capo", and the song screen will not go through to
Ready until it has an answer, offered as chips in the check sheet (the chip's own menu is
absolutely positioned and would be clipped by the sheet's scroll).

A song with **no chords** is warned about in that same sheet but let through: words on their
own are a legitimate thing to print. The check is latched at the moment it opens, so answering
the capo does not pull the question out from under the finger that answered it.

Songs saved before the third state existed carry `capo: null` and read as already decided —
`parseSong` keeps a stored `null` rather than collapsing it, which is the whole migration.

## The mark, and the opening

The brand pack's mark is two nested C arcs. `src/components/Brand.tsx` carries the canonical
path data — copy it, never redraw it — and the lockup applies the brand's two ratios (gap
0.42× the mark, type 0.75×) from one `size` prop, so it scales correctly wherever it appears.
The wordmark is live text rather than artwork, so it stays crisp and selectable.

**The arcs read `--color-text` and `--color-accent` instead of the brand's literal hex**,
because the two agree exactly: the token pair resolves to #292b31/#796cbf on light and
#e9e9ed/#9184d9 on dark, which are the brand's own light and dark pairs. The base violet fails
contrast on a pale ground, and the token already drops to accent-600 there — so following the
theme is what keeps the mark on-brand, not what breaks it. Nothing outside `Brand.tsx` and the
`.cc-*` rules may colour an arc.

Opening the app plays the mark drawing itself, then dissolves into the home screen.
`src/app/splash.ts` has three phases, not a boolean, because a crossfade needs both halves
moving at once: the app is mounted and laid out behind the splash from the first frame, and
`leaving` is the overlap where the overlay fades out as the app fades in. Unmounting on a
boolean would snap the home screen in at the end of the fade instead. Any key or pointer cuts
the hold short, and reduced motion drops the draw-on and shortens every phase — the CSS and
`phaseMs` carry the same numbers, so changing one means changing both.

## Print and share

"Print for the stand" is one A4 page: title, capo, a chord reference row, then the lyric with
chords over the words. `a4SheetLayout` is a pure, tested function that steps the type size down
until the lyric fits rather than spilling onto a second sheet, and reports `overflows` rather
than clipping silently. A song with no words prints as a one-page chord sheet, with no extra code.

**The picture of the chords** (`src/lib/exportChordSheet.ts`) is every shape in a song as one
PNG with the title and capo over it — the thing you post in the band's chat after a lesson. It is
a picture rather than the PDF because a chat shows a picture inline and makes you open a PDF.
Portrait and a fixed 1080 px wide, three across, so it reads in the chat's own preview without
zooming. `chordSheetLayout` is pure and tested. Two things in it are not obvious:

- A very long chord list gets **more columns, never a taller picture**. Mobile Safari refuses a
  canvas past a few thousand pixels on a side and `toBlob` then returns nothing at all.
- Each chord name is centred **over the strings, not over the box**. The box reserves a column on
  the right for the position numeral, so the middle of the box is not the middle of the fretboard.

The title and names are drawn with the canvas's own `fillText`. That never taints the canvas,
webfont or not; the restriction in "Not built" below is on fonts linked from *inside* an SVG.

The Ready sheet offers it three ways, and only the ways the device can honour (`src/lib/share.ts`
holds all the feature detection): **Send the chords** through the phone's share sheet, which is
the short way into WhatsApp; **Save the chords as a picture**; and **Copy the chords**. Copying
hands `ClipboardItem` the *promise* of the PNG rather than the PNG — Safari only allows a
clipboard write from inside the tap that asked for it, and awaiting the picture first falls
outside it. The chord editor can also save the one shape on the plate as a PNG.

## Accounts and the username

Sign-in is Google or email and password (`lib/auth.ts`), and it is deliberately not a wall —
the sidebar chip is the only way in, and every screen works without it.

The part worth understanding is the **handle**. A shared song is a copy that outlives the link
that carried it, so whatever names the sender is baked permanently into someone else's library
— which is why it is a handle and never the email address. An account without one is a
half-finished sign-in, so `App.tsx` keeps the claim step in front of the user until it is done.

Firestore has no unique constraint, so the claim is a document whose **id is the handle**
(`usernames/{handle} -> { uid }`): a document id can only exist once, and that is the whole
uniqueness mechanism. It is written in a transaction, because reading "free" and then writing
is a race two people can both win. `firestore.rules` re-validates the shape server-side, and
refuses `update` outright — renaming is delete-then-claim, so a claim's id and the uid inside
it can never drift apart. `lib/username.ts` holds the pure rules (normalising, the reserved
list, what a legal handle is) and they are tested; keep its pattern and the one in the rules
in step.

## Sharing a song

**A song is never opened up to a second person. It is copied out.** `users/{uid}/…` is
readable by that uid and nobody else, with no exceptions, and that one fact is what makes an
unshared song private. So sharing writes a *copy* to a top-level `shared/{shareId}`, and whoever
keeps it gets another copy under their own uid — a new id, theirs outright, edited in place,
local-first like any other song. Three documents, never the same one:

```
users/{me}/songs/{id}  ──share──►  shared/{shareId}  ──keep──►  users/{you}/songs/{newId}
   Song.shared                      the copy others read            Song.copiedFrom
```

There is **no merge anywhere**, and there cannot be one: `retokenise` mints word ids per copy,
so two edited copies of one song have nothing in common to merge on. That decides the rest.

- **The owner shares changes on purpose** ("Share the changes"), never on save. Half-finished
  edits do not leak, and recipients hear about a change once, not per typo. "Changed since
  shared" is `updatedAt > shared.at`, and the reducer sets `at` (`SONG_SHARED`) — recording the
  share is itself an edit, and must not read as a change; an edit made while the share was in
  flight must.
- **A recipient is always asked**: *Replace mine* (keeps the song's id, so playlists still hold
  it) or *Keep mine, and add the new one* (mine gets `follows: false` and is never asked again).
  The shared copy carries a `version` counter for this. **The word never reaches the UI** — a
  song has been changed or it has not; nobody thinks of it as having versions.
- **Whether there is anything new is asked, not stored.** `useSharedUpdates` does one `get` per
  followed song, once a session and when the song is opened, and holds the answers in memory. It
  is the database's answer as of a moment ago, so it stays out of the song store, and the reducer
  goes on not knowing a server exists.
- **Sharing is a call the player waits on**, like an export, not something queued through
  `unsynced`: it needs a signal and says why when it fails (`useSharing`). Only its *result*,
  `Song.shared`, rides the ordinary sync, so the owner's other devices know.

**A link is unlisted, not private — never call it private.** `shared/{id}` can be read by
anyone holding the id, signed in or not, so a bandmate opens a song without an account; and it
can be *listed* by nobody. The id is a `crypto.randomUUID()` with no fallback (`newShareId`),
because the link is the key. Anyone a link is forwarded to can read the song until the owner
stops sharing, which deletes the copy; copies already kept are their keepers' and stay.

**Deleting a shared song takes the shared copy down first, and only deletes if that worked**
(`onDelete` in `useSharing`; the sheet is `DeleteSongSheet`). Once the song is gone nothing
here remembers its share id, so a copy left up would be published for good with nobody able to
remove it. The cost is that a shared song cannot be deleted signed out or with no signal — the
sheet stays open and says why — which is the right way round for the one action with no undo.
Copies other people kept are theirs and are never touched. The rules allow deleting a share
that is already gone, so a song whose owner stopped sharing from another device can still go.

**The browsable library reads cards, not songs.** A song is mostly its word list — every word
carries a 36-character id — so a typical one is ~25 kB and a page of thirty would be most of a
megabyte. A song the owner chooses to show also gets a 1–2 kB card at `sharedIndex/{shareId}`,
written in the same batch as the song so the two cannot drift; "listed" *is* the card existing.
**The way in is a checkbox on every song's row, "Make available globally"** (`SongCard`'s
`global`). It began as a tick-box inside the "Send a link to the band" sheet, where nobody
wanting to publish a song would think to look. Ticking it shares a never-shared song straight
into the library, or adds one already shared by link. Unticking takes it out of the library *and
only that* — the link may have been sent to someone, so it still opens, the row says "Shared by
link", and stopping altogether is in the song's share sheet. The same box, by the same name, is
in that sheet. Search is a prefix match on the title, because that is the text search Firestore does unaided.
Shared songs has no tab — six is what fits at 360 px — and is reached from Songs and the sidebar.
`#/shared`, because `#/library` is the chord library.

**The rules name every field, and must be kept in step with the types.** `users/{uid}` used to
be one wildcard, which let anyone signed in keep any data under their own uid on this project's
bill. Now `firestore.rules` names the collections and whitelists the fields of a song and a
playlist. The price: **add a field to `Song` or `Playlist` and not to the rules, and every save
is refused.** The sync line says so, but only once it has happened. Size limits live there too,
mirrored in `lib/sharedSong.ts` so the words editor can say "too long" first: the rule of thumb
is four times the longest real song (Bat Out of Hell, ~4,500 characters), so 20,000.

## Whether it is really saved

`localStorage` is what the app reads and writes; an account mirrors it to
`users/{uid}/songs/{songId}`. The part worth understanding is how the app knows the mirror is
true, because for a while it did not: every Firestore call was fire-and-forget, a refused write
became an unhandled rejection, and the sidebar said "Songs saved to your account" regardless. A
broken sync was indistinguishable from a working one.

**The store lists what the account has not confirmed** (`SongStore.unsynced`; playlists and My
chords each have a list of their own beside it, and the sync line counts all three). The reducer adds
an id whenever it creates, edits or deletes a song — atomically with the change, which an effect
marking ids after the render could not do — and only the account's own answer takes it off
(`SYNCED`, which compares `updatedAt` so an edit made while a write was in flight stays listed).
The list is persisted with the songs, so an edit made with no signal is still known to be unsaved
tomorrow. `useSongs` sends what is on the list; it no longer diffs renders to guess.

That list is also what makes the sign-in merge safe to run on every page load. "Remote wins" on
an id both sides have — except for ids on the list, where the remote copy is known to be the
stale one: local wins and goes back up, and an unconfirmed delete stays deleted instead of being
resurrected. Without it, editing a song on a dead connection and reopening the app later
silently reverted the edit. The merge runs **inside the reducer** (`HYDRATE`), against the store
as it is at that moment, so a song made while the account was still loading cannot be lost to
the gap.

**A different account signing in on the same device** replaces the library here with its own —
it has to, the songs are not theirs to see. That used to simply overwrite it, so signing in with
Google after using email (two uids, one person) emptied the device. The stranded songs are now
stashed under the uid they belonged to and handed back when that account next signs in here.

`src/lib/syncStatus.ts` turns all of this into one honest sentence under the handle — saving,
saved, no signal, or *not saved, and why*, with a way to try again — on the sidebar chip and on
the phone's Account screen. Refused writes are retried on the next change, when the signal
returns, and on request; never in a loop.

**There is no Save button, and there is a "Saved" line instead.** Every change is committed
before a button could be pressed, so the button would commit nothing — and a button that looks
like the thing keeping your work teaches you to fear leaving without pressing it, which on a
phone, where Back is one tap, is the opposite of what is true. What was actually missing was the
reassurance: that honest sentence lived only on the account chip, and `chromeFor` gives the song
screen and the words editor **no chrome at all on a phone**, so for the whole time you are
writing there was nothing on screen saying the song was kept. `SavedLine` puts it beside the
title on both, which is where every autosaving editor puts it.

It says a **different** sentence there (`savedLabel`, beside `syncLabel`, both pure and tested).
The chip is about the account, so signed out it reads "Keep your songs on every device" — an
offer, which is the wrong thing to answer "is this kept?" with. In a song the line leads with the
device, which `localStorage` has already done, and mentions the account only where the two
differ: plain "Saved" is reserved for both places holding it.

**Saving is announced only once it has lasted half a second.** There is a Firestore write per
keystroke, so the phase flips to `syncing` and back at typing speed, and said out loud that is a
header flickering "Saving…"/"Saved" per character — which reads as a machine in trouble. A write
that lands inside the window is never mentioned; a stall is. Nothing is over-claimed by the wait,
because the sentence leads with the device either way, and `error` is never delayed: a save that
did not happen is the one thing here worth interrupting anyone for.

## Hosting and the Firebase config

Netlify builds and serves it. [`netlify.toml`](netlify.toml) holds the build command, the
publish directory and a pinned Node version, in the repo rather than in the site UI so the
build cannot be misconfigured by a click. It also carries the usual SPA redirect, which this
app does not actually need — routes live in the URL hash, so the server only ever sees a
request for `/` and there is no deep path to 404. It is insurance against routing ever moving
to real paths.

`src/lib/firebase.ts` is the remote half of the store, sitting beside `storage.ts`. The web
config arrives through `VITE_FIREBASE_*` env vars — copy `.env.example` to `.env` locally, and
set the same keys in Netlify. Those values are **not secret**: the web config identifies the
project and is compiled into the bundle by design, and Firestore rules plus Auth are what
secure the data. Netlify's secrets scanner will still fail the build for finding them in the
output, which is what `SECRETS_SCAN_OMIT_KEYS` answers.

**Nothing in that module throws on import, and nothing initialises until it is asked to.** A
checkout with no `.env` is a supported state: the app's premise is that it works with no
account and no signal, so an absent config has to leave every screen working on `localStorage`
rather than white-screening the app before it renders. Callers check `firebaseEnabled` and
degrade. Being lazy also keeps the SDK out of the first chunk for a player who never signs in:
`hooks/useAuth.ts` imports the module, but nothing it exports runs until a screen asks for the
auth or the database.

There is **no Cloud Storage**, deliberately. Everything persisted is small JSON: a typical song
is about 25 kB, and the longest the rules allow under half of Firestore's 1 MiB document limit, and the PNG and PDF are generated in the
browser at the moment you export them. A stored export would only ever be a stale copy of
something a second of work regenerates.

One deployment gotcha worth knowing before the first sign-in lands: Firebase Auth checks the
calling domain against its **Authorized domains** list, and Netlify deploy previews get
generated hostnames that will not be on it. Sign-in works in production and fails on previews
until those domains are added.

## Not built

A real chord speller (names are recognised against the library and
stay user-editable), left-handed mirroring, other instruments, and finger numbers in the dots —
though `Dot` already carries an optional `finger` field the reducer ignores.

**Capo does not change the diagrams.** They stay absolute and the capo is shown as a chip.
`rootFret` already means an absolute neck position, and making it capo-relative would silently
reinterpret every chord already saved.

A webfont in the exported SVG would have to be base64-embedded in an in-SVG `@font-face`;
anything linked externally taints the canvas and makes `toBlob` throw.
