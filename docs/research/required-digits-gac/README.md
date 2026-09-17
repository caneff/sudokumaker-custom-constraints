# RequiredDigitsGacComponent

A full-strength, drop-in replacement for the app's built-in RequiredDigits
rule (`RequiredDigitsComponent(name, values, cells)`): Hall's condition on
the value side instead of the built-in's greedy strike-off (see
`RequiredDigitsGacComponent.js`'s own header for the rule and the soundness
argument).

## Files

| File | What it is |
|---|---|
| `RequiredDigitsGacComponent.js` | The replacement itself. |
| `BuiltinRequiredDigitsComponent.js` | The built-in's own rule, ported verbatim from the bundle body, for the offline strength/cost comparisons below. Not for use in a puzzle — the app already has this one. |
| `soundness-harness.mjs` | Soundness (28,000 states, 0 violations), strength against the built-in, and completeness against a brute-force SDR oracle. |
| `bench-required-digits.mjs` | Per-call cost against the built-in, 20,000 states per shape, 3 reps. |
| `RequiredDigitsWrapperComponent.js`, `RequiredDigitsWrapperComponentBuiltin.js`, `main-required-digits-global.js`, `PUZZLE_LINK_required_digits*.txt` | The real-app timing rig (#534), below. |

## Offline: soundness and cost

```
node docs/research/required-digits-gac/soundness-harness.mjs
node docs/research/required-digits-gac/bench-required-digits.mjs
```

Soundness: 28,000 states, 0 violations, exact agreement with a brute-force
SDR oracle on every instance small enough to check. Strength against the
built-in is widest where the group is sparse: 275 removals against 20 on 9
cells with 4 required digits. Cost: 0.2–0.6 us/call on outside-clue shapes
(1–2 required digits, a 2–3 cell window), 3.1 us against the built-in's 1.3
us on a full 9-cell group.

## Real-app timing (#534)

The offline cost row above is our own GAC+DFS mock, not the app's own
solver (`docs/real-app-timing.md`). Timing it there needs a board that
registers a RequiredDigits-shaped component — no example did.
`RequiredDigitsWrapperComponent.js` is the host: it watches an Outside Sudoku
clue, idling while it is blank, and once filled swaps itself
(`puzzle.replaceComponent`, docs/gotchas.md #1) for a required-digits rule
over the clue's window — window-sized with its own copy of
`examples/outside-sudoku/OutsideSudokuComponent.js`'s `windowLength`. Two
swap targets, same host shape otherwise:

- `RequiredDigitsWrapperComponent.js` → `customComponents.RequiredDigitsGacComponent`
- `RequiredDigitsWrapperComponentBuiltin.js` → the real built-in `RequiredDigitsComponent`

This is not a second implementation for Outside Sudoku itself —
`OutsideSudokuComponent.js` already enforces the same rule in three bitmask
reads and stays the shipped component; see
`examples/outside-sudoku/OPTIMIZATION_LOG.md`. It exists only to give
RequiredDigitsGacComponent a real-app timing row.

### Building the boards

```
uv run examples/outside-sudoku/build_required_digits.py
```

Takes the shipped `examples/outside-sudoku/PUZZLE_LINK.txt` and replaces its
"Custom Outside Sudoku" constraint's backend and components — nothing else
— writing, into this directory:

- `PUZZLE_LINK_required_digits.txt` — the wrapper, GAC as the swap target
- `PUZZLE_LINK_required_digits_original.txt` — the wrapper, the built-in as the swap target

`examples/outside-sudoku/build_required_digits.test.py` (part of `just
test`) checks the rebuild is byte-identical and leaves the shipped links
untouched. This script stays in `examples/outside-sudoku/`, not here, because
`docs/research/` refuses a new `.py` file (`check_research_python`, #469).
These two links stay in `docs/research/`, not as `examples/outside-sudoku/`'s
own boards, because they are not that example's board:
`examples/_shared/check_layout.py` requires a shipped component to be one
the backend itself registers, true of a real example and not of a board
built only to compare a wrapper's two swap targets (`RequiredDigitsGacComponent`
here is reachable only through the wrapper's own `customComponents.Name`,
never `new`'d by the backend).

### Reproduce

Not timed through `just time`'s automation
(`examples/_shared/time_example.py`): that driver resolves an example's
backend against `main.js`/`main-global.js` inside the example directory,
and `main-required-digits-global.js` deliberately matches neither name, so
it is never mistaken for the real Outside Sudoku backend. Timed directly,
the way Numbered Rooms' own wrapper-vs-ours row is (`docs/real-app-timing.md`,
"link vs link"):

```sh
uv run examples/_shared/probe_link.py empty \
  docs/research/required-digits-gac/PUZZLE_LINK_required_digits.txt /tmp/rd_gac.txt
uv run examples/_shared/probe_link.py empty \
  docs/research/required-digits-gac/PUZZLE_LINK_required_digits_original.txt /tmp/rd_orig.txt
node examples/_shared/app-solve.mjs /tmp/rd_gac.txt 3 --ring-clues
node examples/_shared/app-solve.mjs /tmp/rd_orig.txt 3 --ring-clues
node examples/_shared/app-solve.mjs /tmp/rd_gac.txt 3 --ring-clues --after-logical
node examples/_shared/app-solve.mjs /tmp/rd_orig.txt 3 --ring-clues --after-logical
```

### Recorded rows (2026-09-17, v2026.08.14-d47fc4b, 3 reps, non-deterministic solve off)

| board | mode | median |
|---|---|---|
| PUZZLE_LINK_required_digits.txt (GAC) | cold | 400ms |
| PUZZLE_LINK_required_digits_original.txt (built-in) | cold | 400ms |
| PUZZLE_LINK_required_digits.txt (GAC) | after-logical | 300ms |
| PUZZLE_LINK_required_digits_original.txt (built-in) | after-logical | 300ms |

No measurable difference at this timer's resolution, on this board. Two-row
rule (`docs/real-app-timing.md`): neither row clears 0.9x, so this is not a
"ships" result either way — read as "no cost regression, and no proven win
here" for RequiredDigitsGacComponent's real-app cost, consistent with the
offline bench: 0.2–0.6 us/call on this exact clue-window shape is small
enough that a board this shallow cannot surface it against a 100ms solver
timer. `examples/outside-sudoku/OPTIMIZATION_LOG.md` notes the same limit
for this board's own component history ("closed almost without searching").

**Caveat, checked against the unmodified board.** Both rows' per-rep verdict
reads "Found 10,000 solutions" (the app's counting cap), not "unique
solution" — `probe_link.py empty` keeps every ring cell (given or not), which
should be enough information to pin the grid down, per
`examples/outside-sudoku/build_size.py`'s own uniqueness check on the
committed board. Confirmed this is not something this wrapper introduced:
the unmodified shipped `examples/outside-sudoku/PUZZLE_LINK.txt`, put through
the identical `probe_link.py empty` + `app-solve.mjs --ring-clues` steps,
reads the same "Found 10,000 solutions" verdict, at the same ~500ms — the
number `just time outside-sudoku --ring-clues`'s own BASELINE row already
carries (README, `## Timing`), which does not itself surface the verdict
text (only the median). Both the GAC and built-in wrapper variants reach the
same search cap the unmodified board already does under this probe, so the
comparison is still apples-to-apples; it is a property of the probe/board
combination, not of either RequiredDigits variant, and is worth its own
follow-up ticket (whether `examples/_shared/time_example.py` should refuse a
non-unique probe the way it refuses a timeout) rather than fixing here.
