# The app's built-in Skyscraper constraint on our shipped board — DNF

**Question.** `examples/skyscraper/PUZZLE_LINK.txt` proves unique in the app in
about 8 s with our two-clue DP running on an interactive-outside frame. The app
also ships a **native** Skyscraper constraint (document type `503`), which
takes its clues as data rather than as cells a solver fills. On the identical
board, how fast is the built-in?

**Answer: it does not finish.** No first solution inside the app's 300 s limit,
cold or after the app's own logical pass. Ours proves the board unique in 8.3 s
cold and needs no search at all after the logic pass.

| date | app version | board | ours | built-in `503` | verdict |
|---|---|---|---|---|---|
| 2026-09-08 | v2026.08.14-d47fc4b | skyscraper (`PUZZLE_LINK.txt`) | 8300ms (first 6200, unique 2100), 3/3 reps | no first solve in 300s | capability |
| 2026-09-08 | v2026.08.14-d47fc4b | skyscraper after-logical | 0ms, 3/3 reps | no first solve in 300s | capability |

This is a **capability row**, not a ratio — the same shape as the `MAXN` row and
the 9x9-local row already in `examples/skyscraper/README.md`. One arm never
produced a number, so no ratio exists and none was invented
(`docs/real-app-timing.md`).

## The board is the same board, and the rule is the same rule

Both checks matter, because a contradiction and a slow solve look identical
from a timeout.

- **Same clue set.** The `503` constraint's `outerCell` indices address the
  11x11 outer frame even on a 9x9 board, so they map onto our L/R/T/B labels
  directly: `T{c} = c+1`, `B{c} = 111+c`, `L{r} = 11(r+1)`, `R{r} = 11(r+1)+10`.
  Under that map the built-in link carries exactly `gen.json`'s 20 active clues
  at exactly their positions, plus `gen.json`'s 7 interior givens.
- **Same semantics.** Filling all 81 cells with `gen.json`'s solution grid as
  givens and clicking the same solve button returns `unique` in 0 ms: the app's
  native rule accepts our solution. So the DNF is search cost, not
  unsatisfiability.

## Why the built-in loses on this board

The two are not doing the same job. Our component reads **both end clues of one
line at once** and runs an exact subset DP over the peak split, so it is a
decision procedure for the line: it removes every digit no full arrangement can
use, and it deduces the clues from the line as well as the line from the clues.
The built-in enforces one clue against one line and prunes far less, so the
app's solver has to search the space our component collapses. Twenty clues and
seven givens is a thin clue set — that is the regime where the difference bites.

Nothing here says the built-in is bad; it says our board was carved to
CP-SAT minimality against a much stronger propagator, and a weaker one cannot
close it inside the app's limit.

## Reproducing

The built-in link (797 bytes, no component code) is
`docs/research/skyscraper-builtin-503.txt`.

```sh
node examples/_shared/app-solve.mjs docs/research/skyscraper-builtin-503.txt 1
node examples/_shared/app-solve.mjs docs/research/skyscraper-builtin-503.txt 1 --after-logical
node examples/_shared/app-solve.mjs examples/skyscraper/PUZZLE_LINK.txt 3 --ring-clues
node examples/_shared/app-solve.mjs examples/skyscraper/PUZZLE_LINK.txt 3 --ring-clues --after-logical
```

The link was built by decoding a hand-made built-in-constraint puzzle, moving
its one misplaced top clue from `T1` to `T0`, and adding `gen.json`'s 7 interior
givens — the hand-made original had neither. It is **not** a shipped board and
does not live in the example directory: it carries no custom component and no
rules text, so `check_layout.py` has nothing to say about it.
