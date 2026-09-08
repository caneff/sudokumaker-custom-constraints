# The app's built-in Skyscraper constraint on our shipped board — DNF

**Question.** `examples/skyscraper/PUZZLE_LINK.txt` proves unique in the app in
about 8 s with our two-clue DP running on an interactive-outside frame. The app
also ships a **native** Skyscraper constraint (document type `503`), which
takes its clues as data rather than as cells a solver fills. On the identical
board, how fast is the built-in?

**Answer: it does not finish.** No first solution inside the app's 300 s limit,
cold or after the app's own logical pass. The *direction* of that result is a
tautology — see the nesting argument below — so what the run buys is the bound,
not the ranking. Ours proves the board unique in 8.3 s
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

## The deduction sets are nested, so the direction was never in doubt

One-sided reasoning is a **strict subset** of two-sided. Every line on our board
carries a cell at each end: the 20 clued ends are givens, and the other 16 are
blank cells the solver fills. Our component reads both, so on a line clued at
one end only it still runs the full peak-split join with the far clue's
candidates wide open — which subsumes exactly what one-sided propagation
derives, and then adds the far clue's own value on top. There is no deduction
the built-in makes here that our component does not.

Two things follow, and the second is the honest cost of this measurement.

**The two boards have the same solution set — proved, not spot-checked.** A
blank ring cell is constrained to equal the visible count along its line, which
is a function of cells that already exist. Defining a variable as a function of
existing variables adds no information, so our frame's 16 blank ends constrain
the interior not at all. The built-in board is therefore the *same puzzle*, with
the same unique solution, under a weaker propagator. That is a stronger claim
than the 0 ms solution-grid check above, which only shows our grid is *a*
solution under the app's rule.

**The DNF was predictable a priori, so it quantifies rather than discovers.**
A strictly weaker propagator on a board carved to minimality against the
stronger one was always going to lose; the only content in the number is that
the gap crosses the app's 300 s limit. Read it as a bound, not as a comparison
of two comparable solvers. Two rows of the same shape are already in
`examples/skyscraper/README.md` — the `MAXN` cap at 10x10, and the running cap
on the 9x9 local board — and this is a third instance of that one phenomenon.

Nothing here says the built-in is bad. It says a thin clue set — 20 clues and
7 givens — is exactly the regime where the extra strength is load-bearing, and
that our board sits past the point where one-sided propagation can close it.

## What the built-in is better at

One thing, and it is not deduction.

- **It is nearly free to ship.** The built-in link is 797 bytes against our
  14.6 KB, because ours carries the whole component source in the blob. And a
  recipient adds the built-in from the app's own editor UI, where ours needs
  pasted code in a custom constraint.

Not measured either way: per-call cost. Ours is 12 us at n=9 (README, Timing);
there is no number for the built-in, and on a board one-sided propagation can
close, a cheaper propagator called more often could win on wall clock.

### The house gate is not a weakness

`SkyscraperLineComponent` stands down unless the line is a house whose live
candidates union to exactly `{1..length}`. That is the DP's **premise**, not a
shortfall: the peak split is what makes the two ends independent, and it holds
only because a permutation has exactly one cell holding `maxDigit`. Off that
premise the peak is not necessarily the tallest, digits may repeat, and the
subset state means nothing. Standing down is the sound answer, and it costs
nothing here — type `503`'s clues are `{value, outerCell}` on the outer frame,
so they attach to grid rows and columns, which are houses by construction. The
gate can never fail on a line the built-in is able to constrain at all.

A non-house line is not unserved, either. `SkyscraperOneSidedComponent` takes
one clue at one end of an arbitrary drawn group and assumes nothing about it:
digits may repeat, any length, no clue needed at the far end. Its
`(position, tallest so far, visible count)` DP is a decision procedure for that
line and runs **with no gate at all**. The two components split the space
between them; neither is the other's fallback.

The app's separate `SkyscraperComponent(name, amount, cells)` does take an
arbitrary cell list, but `amount` is a fixed number — it is the class the
`original/` wrapper swaps in once a clue cell holds a value, and it deduces
nothing while the clue is blank. So it is not an interactive-clue answer
either.

`MAXN = 16` is likewise a guard, not a limit: it covers every board up to
16x16, and the largest here is 10x10.

## Where our 15 KB goes

Measured 2026-09-08 by decoding `PUZZLE_LINK.txt`, editing one thing out, and
re-encoding. The link was 14,990 bytes that day; "Both levers, pulled" below
records what it is now.

| variant | link bytes | delta |
|---|---|---|
| shipped | 14,990 | — |
| drop the three decoration polylines (type `2000`) | 12,904 | **−2,086 (−14%)** |
| drop `SkyscraperSideComponent` | 13,017 | −1,973 |
| strip leading indentation from the shipped code | 14,765 | −225 |
| strip every comment from the shipped code | 10,536 | −4,454 (−30%) |
| no component code at all | 4,594 | −10,396 (−69%) |
| the built-in `503` link, for scale | 797 | |

Two floors worth knowing. **Code is 69% of the link** — 15,659 chars of source
across the two components and the backend, of which 6,750 chars (43%) are
comments. And **the frame document alone is 4,594 bytes**, 5.8x the built-in's
entire link, before a single byte of code. An interactive-outside frame is an
11x11 board with 121 cells, 31 givens and three polyline constraints; that is
the price of clue cells a solver can fill, and no amount of minification touches
it.

The three type `2000` constraints are pure decoration — white lines hiding the
outside cells' borders, outlines around the clue cells, the grid's outer border —
and gridfind drops them when it solves. They cost 6,724 chars of JSON because
each outside cell is its own five-point closed square. Merging adjacent squares
into runs would recover most of the 2,086 bytes and change nothing a solver or a
reader ever sees. That is the one size lever here that costs nothing.

`SkyscraperSideComponent` is not a lever: "exactly one 1 per side" is a real
deduction the board is carved against, not packaging.

## Both levers, pulled (#385)

The table above is the board as it stood on the measurement day. #385 took the
two rows it named and the shipped link is now **9,729 bytes, down 5,260 (35%)**.

- **The decoration is merged.** `frame.cosmetics` still states the picture one
  closed square per cell, then `frame.merge` reduces the layer to the set of
  unit segments it covers and walks that set back out as long polylines. 337
  points became 154, and 6,730 chars of JSON became 3,309. The rendered board
  is pixel-identical at 4x4, 6x6, 9x9 and 10x10.
- **Every comment is stripped.** This reverses #383, on the owner's call: the
  size is wanted back now, and how a reuser gets the commentary is a separate
  question. The source files keep their full `//!` blocks; only the copy baked
  into a link loses them. 15,803 chars of embedded code became 9,053.

Across all 43 committed links the two together take 440,245 bytes to 351,503,
a fifth of the total. The floor the table names is untouched: the frame
document is still 4,594 bytes before a single byte of code, because an
interactive-outside frame is a 121-cell board with clue cells a solver can
fill, and no amount of minification reaches that.

### How the picture was checked

Ink equality is provable from the link -- `frame.merge` is a function of the
segment set alone -- but Part 1's constraint is what a solver *sees*, so it was
also judged from a picture. Method, so a later change can redo it:

1. Open each committed link in the live app with headless Chromium
   (Playwright), viewport 1400x1200 at device scale 3, and let it settle.
2. Screenshot the `svg.SudokuSvg` element alone, not the page, so app chrome
   and scroll position cannot move a pixel.
3. Do that on the links as committed before the change and again after, and
   compare the two PNGs byte for byte.

Run on skyscraper's four board sizes -- `PUZZLE_LINK_4x4.txt`,
`PUZZLE_LINK_6x6.txt`, `PUZZLE_LINK.txt` (9x9) and `PUZZLE_LINK_10x10.txt`.
**All four pairs came back byte-identical PNGs: 0 differing pixels, max channel
delta 0.** No internal ring border shows, no corner filler is boxed, and
adjacent boxed clue cells keep the border between them. The screenshots
themselves were scratch artifacts and are gone; the method above is the record.

### Numbered rooms is the exception to the merge

The byte totals above are whole-corpus and hide one family. Four links --
`examples/numbered-rooms/PUZZLE_LINK.txt`, `_clued.txt`, `_original.txt` and
`_clued_original.txt` -- carry **218 hand-authored decoration points apiece**,
and the merge does not reach them. Their decoration is not `frame.cosmetics`
output: the outlines box six cells the board has no given for, and the third
layer is named "Grid Outer Border (to hide outside cell outline endpoints)"
rather than "Grid Outer Border". Regenerating them would change the picture,
and Part 1's hard constraint -- the rendered board must not move -- outranks
the size lever. So those four kept their decoration and only their code was
rebuilt, and two of them (the two `_original` twins, whose vendored wrapper
carries no comments to strip) came out byte-identical to their previous
revision. That is the correct outcome, not a skipped rebuild.
