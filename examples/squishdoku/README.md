# Squishdoku

Two squishdoku boards whose templates tell the solver every house the rules
force. Neither is normal sudoku, so the rules text opens on the board
(`rules_prefix = "none"`).

| Board | Where | Houses beyond the boxes |
| --- | --- | --- |
| Squishdoku, 7x7 | this directory | 13: 4 crosses, 8 bowties, 1 central cross |
| Embedded Squishdoku, 9x9 | `embedded/` | 43, in classes A-O |

**Squishdoku**: a 7x7 grid with digits 1-9. Nine 3x3 boxes overlap on rows and
columns 3 and 5 and each hold 1-9 once. Rows and columns hold no repeats.

**Embedded Squishdoku**: a 9x9 Latin square (rows and columns hold 1-9, no 3x3
boxes of its own) with the 7x7 squish on r2c2-r8c8, a solid border round it.

The findings behind the houses, with the CP-SAT sweep that found them, are in
`docs/research/2026-10-20-squishdoku-implied-houses/README.md` (frozen).

## Files

| File | Holds |
| --- | --- |
| `PUZZLE_LINK.txt`, `embedded/PUZZLE_LINK.txt` | The empty templates, the links a reader opens |
| `PUZZLE_LINK_13g.txt`, `embedded/PUZZLE_LINK_14g.txt` | One generated unique puzzle per board (13 and 14 givens); the `just time` boards |
| `gen_13g.json`, `embedded/gen_14g.json` | The record behind each: seed, solution grid, givens |
| `main.js`, `embedded/main.js` | The backend of each template: builds the houses from the geometry and registers them as `HouseComponent`s |
| `build_link.py` | Rebuilds every link from the files above |
| `squish_board.py` | The rules as a CP-SAT model, the puzzle generator, the house proofs |
| `registered-houses.mjs` | Runs a backend under Node and prints the houses it registers |
| `forced_houses.test.py`, `embedded_forced_houses.test.py` | The proofs, below |

## No component, so no soundness harness

Both backends register built-in `HouseComponent`s and nothing else
(`houses_only = true` in `example.toml`; `docs/example-layout.md`). There is no
`update` to fuzz. The soundness invariant holds if every registered house is
one the rules force, and the tests prove exactly that: for every house, every
pair of its cells that does not already share a row, column or box is asked of
CP-SAT as "can these be equal?", and the answer must be no.

- `forced_houses.test.py` (7x7, 13 houses, about 2 s) runs in `just check`.
- `embedded_forced_houses.test.py` (9x9, 43 houses, about 18 s) is on the heavy
  list in `tests/all.sh` and runs in `just check-full`.

A test that registers a house the rules do not force fails; the 7x7 test
checks that by feeding it a made-up house.

## Rebuild

```
uv run examples/squishdoku/build_link.py                    # every link, from the files above
uv run examples/squishdoku/build_link.py --generate squish --seed 1
uv run examples/squishdoku/build_link.py --generate embedded --seed 1
```

A template is the committed `PUZZLE_LINK.txt` with its backend swapped for
`main.js`. A puzzle link is that template plus the givens of its
`gen_<n>g.json`, proved to have exactly one solution before it is written.
`--generate` removes givens greedily from a random solution while the solution
stays unique and writes the result as `gen_<n>g.json`, `<n>` the givens left.
The same seed can give a different puzzle: the search runs CP-SAT's portfolio.
The record, not the seed, is the source.

## Timing

`just time squishdoku --board PUZZLE_LINK_13g.txt` and
`just time squishdoku --board embedded/PUZZLE_LINK_14g.txt`, 3 reps, the
recorded app, non-deterministic solve off. A houses-only example has no
component to swap, so `just time` prints baseline rows only:

| Date | App | Board | Baseline | Candidate | Ratio | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-10-20 | v2026.10.05-a3aef4c | squishdoku (PUZZLE_LINK_13g.txt) | 0ms | — | — | BASELINE |
| 2026-10-20 | v2026.10.05-a3aef4c | squishdoku (PUZZLE_LINK_13g.txt) after-logical | 0ms | — | — | BASELINE |
| 2026-10-20 | v2026.10.05-a3aef4c | squishdoku (embedded/PUZZLE_LINK_14g.txt) | 0ms | — | — | BASELINE |
| 2026-10-20 | v2026.10.05-a3aef4c | squishdoku (embedded/PUZZLE_LINK_14g.txt) after-logical | 0ms | — | — | BASELINE |

**The solve-time rule is waived for this example** (Chris, 2026-10-20): the app
reads 0 ms on every variant of these boards, so the 0.9x bar cannot be met and
a ratio of 0 ms to 0 ms is `NO TIME`. The rows above are recorded as measured.
The evidence that the houses pay is the Node comparison in
`docs/research/2026-10-20-squishdoku-implied-houses/README.md`, findAll in the
bundle (a ranking tool, not the number on record):

| Board | Variant | Logic steps | Solved by logic alone | Median findAll |
| --- | --- | --- | --- | --- |
| 7x7, 30 boards | rows, columns, boxes | 1210 | 24 / 30 | 6.0 ms |
| 7x7, 30 boards | the 13 houses | 1048 | 25 / 30 | 3.5 ms |
| 9x9, 20 boards | rows, columns, boxes | 829 | 5 / 20 | 148 ms |
| 9x9, 20 boards | all 43 houses | 1270 | 15 / 20 | 57 ms |

On the 9x9, more logic steps means the logical solver got further before it
stalled, not that it worked harder. The 9x9 boards came from a scratch
generator that is not committed.
