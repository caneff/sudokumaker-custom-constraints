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

Our `update` does stand down unless the line is a house whose live candidates
union to exactly `{1..length}`, but that costs us nothing against this
comparison and is **not** an axis the built-in wins. Type `503`'s clues are
`{value, outerCell}` on the outer frame, so they attach to grid rows and
columns — which are houses by construction. The premise our gate checks can
never fail on a line the built-in is able to constrain at all. The gate exists
to make the *local* backend safe, where an author draws an arbitrary path; the
built-in cannot be pointed at one.

The app's separate `SkyscraperComponent(name, amount, cells)` does take an
arbitrary cell list, but `amount` is a fixed number — it is the class the
`original/` wrapper swaps in once a clue cell holds a value, and it deduces
nothing while the clue is blank. So it is not an interactive-clue answer
either.

`MAXN = 16` is likewise a guard, not a limit: it covers every board up to
16x16, and the largest here is 10x10.
