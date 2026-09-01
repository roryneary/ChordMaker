# ChordBuilder

Read `README.md` before changing anything — it explains why the code is shaped the way it
is, and several of its constraints are load-bearing (SVG presentation attributes, word ids
surviving lyric edits, the flat chord list, capo not moving the diagrams).

`ROADMAP.md` is the backlog: the features still to build, and the reasoning behind each.

**Read `ROADMAP.md` before answering any question about what to build next** — "what features
do we need to work on", "what's outstanding", "what's next", "what should I do now", or any
other phrasing of the same question. Answer from that file, not from a fresh reading of the
code, and say which section the items came from. Update it when work lands, when a decision
changes, or when a new feature is agreed.

```
npm run dev      # http://localhost:5173
npm test         # unit tests
npm run build    # typecheck + production build
npm run lint
```

Tests live beside the logic in `src/lib/__tests__`. Invariants belong in the reducers
(`useChordSpec`, `useSongs`) and pure functions in `src/lib`, not in components — that is
what the tests cover.
