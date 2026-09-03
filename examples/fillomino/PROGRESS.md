# #307 fixture-freeze batch progress

Scratch progress log for the 20-seed x 2-range app-strip batch (#283's
recipe): each line is one board sampled, stripped greedily under the
vendored baseline (log-free variant) in the live app, then timed one cold
rep. This file is not the final record -- the frozen fixtures and their
timing rows land in `docs/research/fillomino-baseline/README.md`; this is
just a running log so progress survives a lost notification.

## Batch run started 2026-09-02 15:10:17
- 9x9-cap9-seed101: 38 givens, cold 700 ms, 147s wall
## Batch run finished 2026-09-02 15:12:44

## Batch run started 2026-09-02 15:12:49
- 9x9-cap12-seed102: 28 givens, cold 11900 ms, 694s wall
## Batch run finished 2026-09-02 15:24:23

## Batch run started 2026-09-02 15:24:36
- 9x9-cap9-seed1: 29 givens, cold 24500 ms, 788s wall
- 9x9-cap9-seed2: 32 givens, cold 700 ms, 153s wall
- 9x9-cap9-seed3: 29 givens, cold 24900 ms, 623s wall
- 9x9-cap9-seed4: 33 givens, cold 100 ms, 131s wall
- 9x9-cap9-seed5: 30 givens, cold 25900 ms, 349s wall
- 9x9-cap9-seed6: 31 givens, cold 5100 ms, 274s wall
- 9x9-cap9-seed7: 31 givens, cold 11100 ms, 242s wall
- 9x9-cap9-seed8: 31 givens, cold 700 ms, 132s wall
- 9x9-cap9-seed9: 31 givens, cold 300 ms, 136s wall
- 9x9-cap9-seed10: 32 givens, cold 26900 ms, 224s wall
- 9x9-cap9-seed11: 34 givens, cold 1700 ms, 133s wall
- 9x9-cap9-seed12: 32 givens, cold 200 ms, 136s wall
- 9x9-cap9-seed13: 33 givens, cold 200 ms, 138s wall
- 9x9-cap9-seed14: 32 givens, cold 10300 ms, 252s wall
- 9x9-cap9-seed15: 32 givens, cold 1900 ms, 133s wall
- 9x9-cap9-seed16: 33 givens, cold 6900 ms, 238s wall
- 9x9-cap9-seed17: 29 givens, cold 1400 ms, 180s wall
- 9x9-cap9-seed18: 28 givens, cold 27100 ms, 863s wall
- 9x9-cap9-seed19: 29 givens, cold 3400 ms, 168s wall
- 9x9-cap9-seed20: 30 givens, cold 21900 ms, 921s wall
- 9x9-cap12-seed1: 28 givens, cold 5100 ms, 162s wall
- 9x9-cap12-seed2: 29 givens, cold 10000 ms, 208s wall
- 9x9-cap12-seed3: 35 givens, cold 28200 ms, 1824s wall
- 9x9-cap12-seed4: 33 givens, cold 27800 ms, 657s wall
- 9x9-cap12-seed5: 35 givens, cold 30200 ms, 1527s wall
- 9x9-cap12-seed6: 35 givens, cold 1000 ms, 135s wall
- 9x9-cap12-seed7: 27 givens, cold 500 ms, 148s wall
- 9x9-cap12-seed8: 32 givens, cold 29700 ms, 1088s wall
- 9x9-cap12-seed9: 30 givens, cold 28800 ms, 641s wall
- 9x9-cap12-seed10: 34 givens, cold 25800 ms, 1480s wall
- 9x9-cap12-seed11: 30 givens, cold 28400 ms, 715s wall
- 9x9-cap12-seed12: 28 givens, cold 11000 ms, 321s wall
- 9x9-cap12-seed13: 30 givens, cold 21000 ms, 675s wall
- 9x9-cap12-seed14: 32 givens, cold 28900 ms, 480s wall
- 9x9-cap12-seed15: 30 givens, cold 1500 ms, 135s wall
- 9x9-cap12-seed16: 28 givens, cold 26400 ms, 1313s wall
- 9x9-cap12-seed17: 28 givens, cold 28800 ms, 441s wall
- 9x9-cap12-seed18: 29 givens, cold 30200 ms, 653s wall
- 9x9-cap12-seed19: 28 givens, cold 4400 ms, 460s wall
- 9x9-cap12-seed20: 34 givens, cold 28100 ms, 1585s wall
## Batch run finished 2026-09-02 21:12:20

## Summary

Seeds 101 and 102 (the first two runs above) were smoke tests of the
wide-digit (cap-12) support added to `app-strip.mjs` for this ticket, not
part of the real batch. The real batch is seeds 1-20 on each of 9x9-digits-1-9
and 9x9-digits-1-12 (40 boards, 0 strip failures). No board hit a strip
failure or an app-strip timeout.

Chosen as the five frozen fixtures (slowest cold rep, 2 from the 1-9 range
and 3 from the 1-12 range, each independently proved unique by CP-SAT with no
timeout): cap9 seed18 (28 givens, 27100 ms), cap9 seed10 (32 givens,
26900 ms), cap12 seed5 (35 givens, 30200 ms), cap12 seed18 (29 givens,
30200 ms), cap12 seed8 (32 givens, 29700 ms). Final 3-rep timing rows and the
frozen files are in `docs/research/fillomino-baseline/README.md` and
`docs/research/fillomino-baseline/fixtures/`.
