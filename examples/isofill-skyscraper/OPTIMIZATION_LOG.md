# ISOFILL Skyscrapers — optimization log

Every speed-up tried for this example, kept or rejected, with the numbers that
decided it. This example owns no component of its own: a change to
`IsofillComponent.js` or `SkyscraperOneSidedComponent.js` is logged in
`examples/isofill/OPTIMIZATION_LOG.md` or `examples/skyscraper/OPTIMIZATION_LOG.md`.
The rows here are the generator's: what it takes to carve and prove a board.

| Variant | Kept / rejected | Numbers | Caveat | Commit |
|---|---|---|---|---|
| Pin each digit's flow root to its first cell in reading order (`_shared/isofill_model.py`) | Kept | One 9x9 ring board's uniqueness proof, one worker: 17.8 s free root → 2.0 s pinned. `just verify-isofill`, portfolio: gen_24g 187 s → 42 s, gen.json 12 s → 3 s | Old times are the isofill README's recorded ones, not re-run side by side | b26832b |
| Depth labelling in place of the flow (each non-root cell has a neighbour of its digit one step shallower), root pinned | Rejected | Bare 9x9 grid found in 8.1 s where the flow, root free or pinned, found none in 40 s, but the 36-clue board found no solution in 40 s either way | Scratch probe, one grid, one worker | — |
| Carve limit 3 s a solve (`Spec.carve_limit`) | Kept | At the 10 s limit the carve shipped a board proving in 8.2 s + 9.5 s, and one run's final check timed out. At 3 s: 2.9 s + 2.3 s | Same seed, two grids (the sampler's portfolio does not reproduce a grid from its seed) | b26832b |
