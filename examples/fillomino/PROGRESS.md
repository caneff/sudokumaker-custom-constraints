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

Originally chosen as five frozen fixtures (slowest cold rep, 2 from the 1-9
range and 3 from the 1-12 range): cap9 seed18, cap9 seed10, cap12 seed5,
cap12 seed18, cap12 seed8. **Widened by an owner follow-up to #307** (below)
to every board reading >= 20000 ms cold -- the widest gap in the whole
40-board distribution sits right there (11100 ms to 21000 ms, a 9900 ms
gap, over 3x any other gap) -- for 19 fixtures total, 6 on the 1-9 range and
13 on the 1-12 range. Every one of the 19 independently proved unique by
CP-SAT, no timeout. Final 3-rep timing rows and the frozen files are in
`docs/research/fillomino-baseline/README.md` and
`docs/research/fillomino-baseline/fixtures/`.

## Widen run started (cutoff 20000 ms) -- 14 new candidates above cutoff
- 9x9-cap12-seed14: FROZEN -- 32 givens, batch cold 28900 ms, final cold 25900 ms, after-logical 0 ms
- 9x9-cap12-seed9: FROZEN -- 30 givens, batch cold 28800 ms, final cold 29100 ms, after-logical 28800 ms
- 9x9-cap12-seed17: FROZEN -- 28 givens, batch cold 28800 ms, final cold 24600 ms, after-logical 0 ms
- 9x9-cap12-seed11: FROZEN -- 30 givens, batch cold 28400 ms, final cold 24200 ms, after-logical 23200 ms
- 9x9-cap12-seed3: FROZEN -- 35 givens, batch cold 28200 ms, final cold 28100 ms, after-logical 0 ms
- 9x9-cap12-seed20: FROZEN -- 34 givens, batch cold 28100 ms, final cold 27500 ms, after-logical 0 ms
- 9x9-cap12-seed4: FROZEN -- 33 givens, batch cold 27800 ms, final cold 28000 ms, after-logical 0 ms
- 9x9-cap12-seed16: FROZEN -- 28 givens, batch cold 26400 ms, final cold 22700 ms, after-logical 0 ms
- 9x9-cap9-seed5: FROZEN -- 30 givens, batch cold 25900 ms, final cold 25200 ms, after-logical 3500 ms
- 9x9-cap12-seed10: FROZEN -- 34 givens, batch cold 25800 ms, final cold 25400 ms, after-logical 0 ms
- 9x9-cap9-seed3: FROZEN -- 29 givens, batch cold 24900 ms, final cold 24400 ms, after-logical 31100 ms
- 9x9-cap9-seed1: FROZEN -- 29 givens, batch cold 24500 ms, final cold 23600 ms, after-logical 17000 ms
- 9x9-cap9-seed20: FROZEN -- 30 givens, batch cold 21900 ms, final cold 21300 ms, after-logical 0 ms
- 9x9-cap12-seed13: FROZEN -- 30 givens, batch cold 21000 ms, final cold 18700 ms, after-logical 800 ms
## Widen run finished -- 14/14 new fixtures frozen



## #308 rung-2 timing sweep started 2026-09-03 00:01:34
### pass: rung 2 vs base, started 00:01:34
- fixture-9x9-cap12-seed10 vs base:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed10-base.txt) | 24800ms | 4200ms | 0.17 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed10-base.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: SHIP
- fixture-9x9-cap12-seed11 vs base:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed11-base.txt) | 23400ms | 4800ms | 0.21 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed11-base.txt) after-logical | 21700ms | 4200ms | 0.19 | PASS |
  two-row rule: SHIP
- fixture-9x9-cap12-seed13 vs base:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed13-base.txt) | 18900ms | 2900ms | 0.15 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed13-base.txt) after-logical | 800ms | 300ms | 0.38 | PASS |
  two-row rule: SHIP
- fixture-9x9-cap12-seed14 vs base:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed14-base.txt) | 25000ms | 8300ms | 0.33 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed14-base.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: SHIP
- fixture-9x9-cap12-seed16 vs base:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed16-base.txt) | 22900ms | 1300ms | 0.06 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed16-base.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: SHIP
- fixture-9x9-cap12-seed17 vs base:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed17-base.txt) | 24200ms | 6400ms | 0.26 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed17-base.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: SHIP
- fixture-9x9-cap12-seed18 vs base: NO ROWS --  error: recipe `time` failed on line 90 with exit code 1 
- fixture-9x9-cap12-seed20 vs base:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed20-base.txt) | 28500ms | 6000ms | 0.21 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed20-base.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: SHIP
- fixture-9x9-cap12-seed3 vs base:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed3-base.txt) | 27700ms | 2900ms | 0.10 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed3-base.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: SHIP
- fixture-9x9-cap12-seed4 vs base:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed4-base.txt) | 27200ms | 7300ms | 0.27 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed4-base.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: SHIP
- fixture-9x9-cap12-seed5 vs base:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed5-base.txt) | 28900ms | 4000ms | 0.14 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed5-base.txt) after-logical | 28800ms | 6600ms | 0.23 | PASS |
  two-row rule: SHIP
- fixture-9x9-cap12-seed8 vs base:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed8-base.txt) | 27600ms | 4800ms | 0.17 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed8-base.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: SHIP
- fixture-9x9-cap12-seed9 vs base:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed9-base.txt) | 27900ms | 5400ms | 0.19 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed9-base.txt) after-logical | 28400ms | 5400ms | 0.19 | PASS |
  two-row rule: SHIP
- fixture-9x9-cap9-seed1 vs base:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed1-base.txt) | 23300ms | 2300ms | 0.10 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed1-base.txt) after-logical | 16600ms | 2600ms | 0.16 | PASS |
  two-row rule: SHIP
- fixture-9x9-cap9-seed10 vs base:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed10-base.txt) | 24100ms | 3900ms | 0.16 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed10-base.txt) after-logical | 200ms | 0ms | 0.00 | PASS |
  two-row rule: SHIP

### pass: rung 2 vs rung 1, started 2026-09-03 12:23:50
- fixture-9x9-cap12-seed10 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed10-rung1.txt) | 11200ms | 5200ms | 0.46 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed10-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: SHIP
- fixture-9x9-cap12-seed11 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed11-rung1.txt) | 5400ms | 5900ms | 1.09 | FAIL |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed11-rung1.txt) after-logical | 4700ms | 4900ms | 1.04 | FAIL |
  two-row rule: NO SHIP
- fixture-9x9-cap12-seed13 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed13-rung1.txt) | 4700ms | 3200ms | 0.68 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed13-rung1.txt) after-logical | 200ms | 400ms | 2.00 | FAIL |
  two-row rule: NO SHIP
- fixture-9x9-cap12-seed14 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed14-rung1.txt) | 4500ms | 9600ms | 2.13 | FAIL |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed14-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: NO SHIP
- fixture-9x9-cap12-seed16 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed16-rung1.txt) | 3100ms | 1500ms | 0.48 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed16-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: SHIP
- fixture-9x9-cap12-seed17 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed17-rung1.txt) | 6600ms | 7400ms | 1.12 | FAIL |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed17-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: NO SHIP
- fixture-9x9-cap12-seed18 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed18-rung1.txt) | 8000ms | 7700ms | 0.96 | FAIL |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed18-rung1.txt) after-logical | 8000ms | 6600ms | 0.82 | PASS |
  two-row rule: SHIP
- fixture-9x9-cap12-seed20 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed20-rung1.txt) | 7500ms | 5400ms | 0.72 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed20-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: SHIP
- fixture-9x9-cap12-seed3 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed3-rung1.txt) | 6100ms | 2900ms | 0.48 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed3-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: SHIP
- fixture-9x9-cap12-seed4 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed4-rung1.txt) | 3700ms | 7000ms | 1.89 | FAIL |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed4-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: NO SHIP
- fixture-9x9-cap12-seed5 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed5-rung1.txt) | 5800ms | 3900ms | 0.67 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed5-rung1.txt) after-logical | 6000ms | 6300ms | 1.05 | FAIL |
  two-row rule: SHIP
- fixture-9x9-cap12-seed8 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed8-rung1.txt) | 3500ms | 4500ms | 1.29 | FAIL |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed8-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: NO SHIP
- fixture-9x9-cap12-seed9 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed9-rung1.txt) | 8800ms | 5200ms | 0.59 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed9-rung1.txt) after-logical | 8500ms | 5300ms | 0.62 | PASS |
  two-row rule: SHIP
- fixture-9x9-cap9-seed1 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed1-rung1.txt) | 3500ms | 2100ms | 0.60 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed1-rung1.txt) after-logical | 2000ms | 3000ms | 1.50 | FAIL |
  two-row rule: NO SHIP
- fixture-9x9-cap9-seed10 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed10-rung1.txt) | 7900ms | 4100ms | 0.52 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed10-rung1.txt) after-logical | 100ms | 0ms | 0.00 | PASS |
  two-row rule: SHIP
- fixture-9x9-cap9-seed18 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed18-rung1.txt) | 6800ms | 7500ms | 1.10 | FAIL |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed18-rung1.txt) after-logical | 4100ms | 4800ms | 1.17 | FAIL |
  two-row rule: NO SHIP
- fixture-9x9-cap9-seed20 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed20-rung1.txt) | 4900ms | 2900ms | 0.59 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed20-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: SHIP
- fixture-9x9-cap9-seed3 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed3-rung1.txt) | 2100ms | 3200ms | 1.52 | FAIL |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed3-rung1.txt) after-logical | 3400ms | 4500ms | 1.32 | FAIL |
  two-row rule: NO SHIP
- fixture-9x9-cap9-seed5 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed5-rung1.txt) | 5300ms | 200ms | 0.04 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed5-rung1.txt) after-logical | 1200ms | 0ms | 0.00 | PASS |
  two-row rule: SHIP
### pass: rung 2 vs rung 1 finished 2026-09-03 13:03:49

### pass: rung 2 vs base, remainder, started 2026-09-03 13:03:49
- fixture-9x9-cap12-seed18 vs base:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed18-base.txt) | 24700ms | 6700ms | 0.27 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed18-base.txt) after-logical | 24600ms | 7000ms | 0.28 | PASS |
  two-row rule: SHIP
- fixture-9x9-cap9-seed18 vs base:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed18-base.txt) | 25700ms | 8100ms | 0.32 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed18-base.txt) after-logical | 15300ms | 4700ms | 0.31 | PASS |
  two-row rule: SHIP
- fixture-9x9-cap9-seed20 vs base:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed20-base.txt) | 22000ms | 3400ms | 0.15 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed20-base.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: SHIP
- fixture-9x9-cap9-seed3 vs base:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed3-base.txt) | 26400ms | 3600ms | 0.14 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed3-base.txt) after-logical | 34000ms | 5500ms | 0.16 | PASS |
  two-row rule: SHIP
- fixture-9x9-cap9-seed5 vs base:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed5-base.txt) | 29500ms | 200ms | 0.01 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed5-base.txt) after-logical | 3900ms | 0ms | 0.00 | PASS |
  two-row rule: SHIP
### pass: rung 2 vs base finished 2026-09-03 13:23:56
## #308 sweep COMPLETE 2026-09-03 13:23:56
