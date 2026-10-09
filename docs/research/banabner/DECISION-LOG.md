# Banabner hunt decision log

The decision log the Banabner hunt (spec #758) keeps as it runs: what was
decided, what it rested on, what it cost. The finder is
`finders/banabner/banabner_finder.py`; its model is
`finders/banabner/banabner_model.py`.

## 2026-10-09 — #761 model finds grids; first-grid times

The joint model (exact-cover bananas, nabner tables, difference-4 whisper,
chocolate sides <= 4, the difference-4 catalogue on both sides) found a legal
grid on every seed tried. Four plain model solves, 1 CP-SAT worker each, seeds
0-3, 300 s cap, run side by side: 170, 183, 244 and 248 s, all `OPTIMAL`
(feasible, no objective). The first grid found (seed 0, 4 workers, 109 s) was
checked by hand and pinned as `finders/banabner/known_grid.json`.

Space covered by every search below: chocolate rectangle sides <= 4. That is a
proven fact of the rules (#761, the proof is in `MAX_CHOC_SIDE`'s comment), so
it is not a cap.

Consequence: `finders/banabner/test_hunt.py`, one 1-worker seed, takes 3-4
minutes and sits in the slow finder tier (`just test-finders-slow`), not in
`just check`.

## 2026-10-09 — #762 speedups: before and after

The speedups: a 5-cell banana holds only odd digits; at most 5 cells of a
house lie in 5-cell bananas; each even digit has a placement avoiding them;
and a lex-leader over the 8 board symmetries.

Commands, one per seed `S` in 0-3, the eight run side by side on an otherwise
lightly loaded box (1-minute load 5.4 at launch, 32 cores):

```
uv run finders/banabner/banabner_finder.py --out DIR --seeds S:S+1 --workers 1 --timeout 600 --no-speedups   # before (#761)
uv run finders/banabner/banabner_finder.py --out DIR --seeds S:S+1 --workers 1 --timeout 600                 # after (#762)
```

Wall clock per hunt, process start to exit, each run recording one grid that
`hunt` verified:

| seed | before (s) | after (s) |
|---|---|---|
| 0 | 195 | 226 |
| 1 | 293 | 156 |
| 2 | 310 | 365 |
| 3 | 217 | 361 |
| mean | 254 | 277 |

Reading: on four seeds the speedups did not shorten the time to a first grid;
the after mean is 9% higher, and the per-seed spread (156-365 s) is wider than
the difference, so four seeds do not separate the two. The lex-leader is not
expected to help a first-grid search: its value is in the catalogue search
(no grid found again as a rotation or reflection) and in an INFEASIBLE proof.
A comparison of grids found per hour, or of a proof, is what would test it.

The worker kept the speedups on by default, since #762 asks for them.
`--no-speedups` turns them off. This is a claim for the reviewer to re-run.
