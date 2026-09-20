# The counter that counts itself (colleague report, 2026-09-20)

A colleague built a board on `CountDigitsGacComponent` where each arrow's bulb
counts the even digits along the arrow **including the bulb**, and reported that
SudokuMaker needed "a series of 5 contradictions" to deduce that R3C3 must be
even. Their link and its decoded document are beside this file (`link.txt`,
`board.json`); the second arrow was added to emphasise the weakness.

## The board

9x9, 2 givens (R4C6=1, R5C6=2 -- seeds, not a puzzle), one `CountDigits (GAC)`
constraint with two groups, digits `2 4 6 8`:

| counter | targets |
|---|---|
| R1C1 | **R1C1**, R2C2, R3C3 |
| R4C4 | **R4C4**, R5C5, R6C6, R7C7, R8C8 |

The counter is its own first target in both.

## Why we prune badly here

`update` accumulates `definite`/`possible` over `targetCells` and then filters
the counter against `[definite, possible]` as though the counter were an
independent cell. When the counter is one of its own targets its digit sits on
both sides of the equation and nothing couples them, so the pruning only arrives
through repeated fixpoint passes -- the contradictions the colleague counted.
The file header already admitted this ("only costs strength ... the walk here
reads one snapshot and does not chase it").

## The fix, and what it buys on this board

Accumulate the bounds over the targets **excluding** the counter (`definite'`,
`possible'`), then test each surviving counter value `v` on its own:

    c = (v in digits) ? 1 : 0        // the counter's contribution to its own count
    v is supportable  <=>  definite' <= v - c <= possible'

Strict generalisation: with the counter outside its targets, `c = 0` and
`definite' = definite`, so the present rule falls out. One code path.

Hand-computed on this board, from an empty grid (`definite' = 0`):

| group | today | with the fix |
|---|---|---|
| R1C1, 3 targets (`possible' = 2`) | 1,2,3 | **1,2** |
| R4C4, 5 targets (`possible' = 4`) | 1,2,3,4,5 | **1,2,3,4** |

Both gains are immediate and need no search. On the first arrow the surviving
pair also says exactly one of R2C2/R3C3 is even, which is the deduction the app
was reaching by contradiction.

Filed as #578.
