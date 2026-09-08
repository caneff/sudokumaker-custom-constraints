# Renbanana: maximizing features (#380)

Variety of candidates under an objective function, in the shape of the Zombo
generator. Uniqueness is out of scope here — every grid below is a legal
digit fill under *some* legal shading, nothing more.

Two hunts have run so far, both on `--objective circles`. Every grid was
re-checked from its JSON with `renbanana_cpsat.py verify`; all report LEGAL.
Pictures for all eleven, in one page: `candidates.html`.

## Leaderboard

`circles` scores a grid by summing the value of every circled digit, where a
circle may sit on a cell whose digit equals the size of its own chocolate
group. It is a digit-layer objective, so stage 1 stays pure feasibility and
stage 3 maximizes it on each fixed shading.

| run | file | seed | circles | choc cells | groups | largest | circleable |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| forced 2x4 | `candidates-2x4/cand_00.json` | 2 | **17** | 34 | 18 | 8 | 6 |
| free | `candidates/cand_03.json` | 7 | 16 | 29 | 20 | 3 | 10 |
| forced 2x4 | `candidates-2x4/cand_01.json` | 4 | 16 | 32 | 18 | 8 | 6 |
| free | `candidates/cand_02.json` | 5 | 15 | 31 | 19 | 4 | 7 |
| free | `candidates/cand_07.json` | 11 | 15 | 33 | 18 | 6 | 6 |
| free | `candidates/cand_04.json` | 8 | 14 | 30 | 20 | 4 | 7 |
| free | `candidates/cand_05.json` | 9 | 13 | 29 | 20 | 4 | 8 |
| free | `candidates/cand_01.json` | 4 | 12 | 30 | 20 | 4 | 7 |
| free | `candidates/cand_06.json` | 10 | 12 | 30 | 19 | 3 | 7 |
| forced 2x4 | `candidates-2x4/cand_02.json` | 10 | 11 | 34 | 16 | 8 | 3 |
| free | `candidates/cand_00.json` | 2 | 9 | 33 | 18 | 4 | 5 |

No upper bound has been computed for `circles`; the shading-layer bound
machinery in `bound` only covers `chocolate` and `variety`.

## Yield

| run | seeds | shadings | digit-feasible | rate | diversity rejected | wall clock |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| free | 12 | 299 | 8 | 2.7% | 0 | 769 s |
| forced 2x4 | 12 | 410 | 3 | 0.7% | 0 | 1321 s |

Both runs used `--limit 120 --workers 8 --min-distance 12`. The diversity
filter never rejected anything in either run: distinct shadings that survive
to a digit fill are already far apart, so the Hamming-or-shape-multiset test
is not currently binding.

The free run's 2.7% matches the ~3% recorded in `FEASIBILITY.md`. The cost of
a candidate is roughly 96 s free and 440 s with the 2x4 forced.

## What the free run showed: circle score and circle quality pull apart

Every free candidate is dominated by 1x1 and 1x2 chocolate groups — typically
nine to thirteen singletons plus five to seven dominoes. The largest rectangle
anywhere in the free pool is a single 2x3. No 3x3, no 2x4, no 1x7 appeared by
chance in 299 shadings.

So the top free score of 16 is 16 because the grid holds twenty tiny groups,
not because it holds good ones. A circled 1 or 2 tells a solver almost
nothing. The plain `circles` objective rewards group *count*, and group count
is maximized by shattering the chocolate into singletons. This is the same
tension `RECTANGLE-CATALOGUE.md` predicted: a puzzle wanting large circles
fights the shading.

## Forcing a shape is the fix, and it is cheap enough

`--require-shape 2x4` makes stage 1 place at least one maximal 2x4 chocolate
component, either orientation. It is a hard constraint on the shading, not a
term in the objective, so it cannot be traded away.

The result answers the question directly: a 2x4 is placeable alongside a full
digit fill, and forcing it *raised* the ceiling rather than lowering it — 17
beats the free run's 16. Both top forced candidates carry a genuine 8-circle
on the 2x4, which is the kind of clue the free pool never produced.

The price is yield, not feasibility: 0.7% instead of 2.7%, about 4.5x the
search per candidate. Twelve seeds returned 3 of a target 8; the other nine
seeds each burned their full 120 s budget without a fill.

`candidates-2x4/cand_02.json` is worth a look despite its low score — it
carries a 1x5 alongside the 2x4, so two large groups do coexist. Its score is
low *because* those two groups eat sixteen cells that would otherwise be
scoring singletons.

## Chocolate maximization is a dead end

Recorded here so it is not re-run. Maximizing total chocolate pins every
shading at the shading-layer ceiling of 50 cells, and a ceiling shading need
not admit any digit fill. In the calibration run, **86 shadings in the 44-50
cell band were all proved INFEASIBLE at the digit layer** — proofs, not
timeouts. The 50-cell bound is therefore unattainable, and the whole
high-chocolate band is dead once digits are required. For reference, the
candidates that do exist sit at 29-34 chocolate cells.

The same trap applies to any shading-layer objective: `chocolate` and
`variety` are maximized in stage 1, which knows nothing about digits, so the
optimum it finds is usually unfillable. `--caps` exists to walk the objective
back down to where grids live.

## Not yet run

- `3x3` forced. The catalogue says it is placeable; it has never appeared by
  chance in either pool.
- The `variety` and `circleable` objectives as their own hunts.
- An upper bound for `circles`.
