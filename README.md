# Chord Diagram Builder

Tap out a guitar chord shape on a fretboard grid and export it as a PNG that looks like a
page from a printed chord dictionary: black ink, white paper, no chrome.

Single user, no accounts, no backend, no persistence beyond the current session.

```
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests
npm run build    # typecheck + production build
```

## How it holds together

**One function draws the chord.** `renderChordSVG(spec, opts)` returns an SVG string, and
both the on-screen editor and the PNG export consume it. The editor draws no lines, dots or
markers of its own, which is what guarantees the download matches the preview. Every style
in that string is a presentation attribute — a serialised SVG carries none of the document's
CSS with it, so a class name or `var(--ink)` would export as unstyled or black-on-black.

**Every drawing number lives in `src/lib/layout.ts`.** The SVG has a fixed `viewBox` and
`width: 100%`, so the interaction overlay positions its buttons as percentages of that box
via `cellRectPct` / `markerRectPct`. There is no `getBoundingClientRect` maths anywhere.
Measured drift between a button's centre and the artwork it covers is 0.02px at 320, 390 and
768px wide.

**The overlay is real `<button>` elements**, not SVG hit-testing — keyboard support, screen
reader labels and focus rings come for free.

**All invariants live in the reducer** (`src/hooks/useChordSpec.ts`), never in components.
Barre-mode UI state sits beside the spec rather than inside it, because it is not artwork.

String numbering follows guitar convention: 1 = high E, 6 = low E, and string 6 draws
**leftmost**. Left-to-right conversion happens only in `layout.ts`, guarded by a test.

## Barre + dots

§3 invariant 2 originally said a string cannot carry both a dot and barre coverage, which
meant **common barre chords could not be drawn**: F major is a 6→1 barre at fret 1 *plus*
dots on strings 5, 4 and 3.

The rule is now scoped to the fret: a string cannot carry a dot and barre coverage **at the
same fret**, but a dot on another fret sits on a barred string exactly as a chord dictionary
draws it. `clearString` takes two options for this — `keepBarres` (a dot leaves barres on
other frets alone; a tap at the barre's own fret still deletes it, via the existing
`hitBarre` path) and `onlyFret` (a new barre clears just the dots on its own fret). Muting
or opening a string still truncates a barre through it, which is physically right.

Not yet enforced: a dot *below* a barre on the same string is accepted, though the barre
stops the string closer to the bridge and the dot could not sound.

## Not built (v1)

Finger numbers in dots, note names, the spelling line, chord detection, left-handed
mirroring, other instruments, saved libraries, sharing, SVG export. Two seams are left open
for later: `renderChordSVG` takes its fret and string counts from `spec`/`layout` rather than
literals, and `Dot` already carries an optional `finger` field the reducer ignores.

A webfont in the exported SVG would have to be base64-embedded in an in-SVG `@font-face`;
anything linked externally taints the canvas and makes `toBlob` throw. The chord name uses a
Georgia system stack instead.
