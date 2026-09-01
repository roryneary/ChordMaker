# Chord Creator

Build a song sheet: tap out the chord shapes, paste the whole lyric in one go, drop chord
names onto the words they land on, then read it full-screen on a windy pitch or print it on
one A4 page.

Single user, no accounts, no backend. Everything lives in `localStorage` and works with no
signal.

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

## The chord library

`src/data/chordLibrary.ts` — 48 shapes in the bundle, about 1.5 kB. No fetch, no schema, no
server, and it works with no signal. Every count shown in the UI reads `LIBRARY.length`.

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

Six routes and a back-stack in `src/app/routes.ts` — no router library. The stack exists because
full screen must return to the screen you came from, not the landing page.

Landing → words → song → chord editor / full screen / ready. The shell gives desktop a sidebar
(which *is* the song list) and mobile a tab bar, and shows **neither** while editing a song or
reading full screen.

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

## Print

"Print for the case" is one A4 page: title, capo, a chord reference row, then the lyric with
chords over the words. `a4SheetLayout` is a pure, tested function that steps the type size down
until the lyric fits rather than spilling onto a second sheet, and reports `overflows` rather
than clipping silently.

## Not built

Sending a link to the band, a real chord speller (names are recognised against the library and
stay user-editable), left-handed mirroring, other instruments, and finger numbers in the dots —
though `Dot` already carries an optional `finger` field the reducer ignores.

**Capo does not change the diagrams.** They stay absolute and the capo is shown as a chip.
`rootFret` already means an absolute neck position, and making it capo-relative would silently
reinterpret every chord already saved.

A webfont in the exported SVG would have to be base64-embedded in an in-SVG `@font-face`;
anything linked externally taints the canvas and makes `toBlob` throw.
