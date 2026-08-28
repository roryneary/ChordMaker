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
