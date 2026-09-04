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

### pass: guard probe, 3 worst vs rung 1, started 2026-09-03 14:06:03
- fixture-9x9-cap12-seed14 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed14-rung1.txt) | 4200ms | 10800ms | 2.57 | FAIL |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed14-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: NO SHIP
- fixture-9x9-cap12-seed4 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed4-rung1.txt) | 4900ms | 8800ms | 1.80 | FAIL |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed4-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: NO SHIP
- fixture-9x9-cap9-seed3 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed3-rung1.txt) | 2700ms | 3700ms | 1.37 | FAIL |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed3-rung1.txt) after-logical | 4000ms | 5500ms | 1.38 | FAIL |
  two-row rule: NO SHIP
### pass: guard probe, 3 worst vs rung 1 finished 2026-09-03 14:12:33

### pass: guard + bitmask allows probe, 3 worst vs rung 1, started 2026-09-03 14:13:27
- fixture-9x9-cap12-seed14 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed14-rung1.txt) | 4400ms | 9200ms | 2.09 | FAIL |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed14-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: NO SHIP
- fixture-9x9-cap12-seed4 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed4-rung1.txt) | 4600ms | 7400ms | 1.61 | FAIL |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed4-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: NO SHIP
- fixture-9x9-cap9-seed3 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed3-rung1.txt) | 2800ms | 3500ms | 1.25 | FAIL |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed3-rung1.txt) after-logical | 4300ms | 5200ms | 1.21 | FAIL |
  two-row rule: NO SHIP
### pass: guard + bitmask allows probe, 3 worst vs rung 1 finished 2026-09-03 14:19:53

### #308 follow-up: the conditional component bound -- probe verdict

The guard is built and green (soundness 0 violations, strength gate both
halves, guarded and unguarded settle on the same candidates over 200 states),
but it does not buy the time back. Measured skip rate on states fuzzed around
the 19 frozen grids: 9-13% of the bound's seeds are skipped, and the flooded
cell count is unchanged -- a skipped seed almost always sits in a component
that some unsafe seed floods anyway. A local guarded-vs-unguarded bench over
all 19 fixture grids reads 1.03x (no change), and the three worst fixtures
re-timed in the live app confirm it:

| Fixture | rung 2 (#308) | + guard | + guard + bitmask `allows` |
| --- | --- | --- | --- |
| 9x9-cap12-seed14 cold | 2.13x | 2.57x | 2.09x |
| 9x9-cap12-seed4 cold | 1.89x | 1.80x | 1.61x |
| 9x9-cap9-seed3 cold | 1.52x | 1.37x | 1.25x |
| 9x9-cap9-seed3 after-logical | 1.32x | 1.38x | 1.21x |

All three still NO SHIP. The full 19-fixture sweep was not run: the target
(every fixture SHIP) is unreachable from here, so the sweep would only spend
the clock to restate it. Owner asked to stop and ask with the numbers rather
than commit.

### pass: ablation: bound capped at digit 6 vs rung 1, started 2026-09-03 14:49:25
- fixture-9x9-cap12-seed14 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed14-rung1.txt) | 4700ms | 5900ms | 1.26 | FAIL |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed14-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: NO SHIP
- fixture-9x9-cap12-seed4 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed4-rung1.txt) | 5400ms | 6000ms | 1.11 | FAIL |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed4-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: NO SHIP
### pass: ablation: bound capped at digit 6 vs rung 1 finished 2026-09-03 14:53:39

### pass: ablation: bound capped at 6, third worst plus two winners, started 2026-09-03 14:53:53
- fixture-9x9-cap9-seed3 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed3-rung1.txt) | 2900ms | 3900ms | 1.34 | FAIL |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed3-rung1.txt) after-logical | 4400ms | 6200ms | 1.41 | FAIL |
  two-row rule: NO SHIP
- fixture-9x9-cap9-seed5 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed5-rung1.txt) | 6800ms | 6300ms | 0.93 | FAIL |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed5-rung1.txt) after-logical | 1800ms | 1300ms | 0.72 | PASS |
  two-row rule: SHIP
- fixture-9x9-cap12-seed16 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed16-rung1.txt) | 3500ms | 3900ms | 1.11 | FAIL |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed16-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: NO SHIP
### pass: ablation: bound capped at 6, third worst plus two winners finished 2026-09-03 15:00:26

### pass: ablation: full bound + guard + bitmask, two winners, started 2026-09-03 15:00:42
- fixture-9x9-cap9-seed5 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed5-rung1.txt) | 6600ms | 200ms | 0.03 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed5-rung1.txt) after-logical | 1800ms | 0ms | 0.00 | PASS |
  two-row rule: SHIP
- fixture-9x9-cap12-seed16 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed16-rung1.txt) | 3400ms | 1400ms | 0.41 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed16-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: SHIP
### pass: ablation: full bound + guard + bitmask, two winners finished 2026-09-03 15:04:21

## #308 follow-up: rung-2 ablation (owner option 3)

Floor is rung 1 as committed (4e20a24). Every variant carries the bitmask
`allows` micro-opt (`getCandidatesBitMask`, no DigitSet allocation per read).
Value is measured as candidates the variant removes and rung 1 keeps, at a
fixpoint, on two fuzzes: the strength test's 600 6x6 states, and 760 states
fuzzed around the 19 frozen 9x9 grids. "Prunes lost" is the same comparison
the other way -- candidates rung 1 removes and the variant keeps. Local bench
is component-only wall time over the 19 grids, 120 states each; it overstates
the live ratio because it excludes the app's own solver.

| Variant | extra prunes 6x6 / 9x9 | lost | seams | local | live cold vs rung 1 |
| --- | --- | --- | --- | --- | --- |
| rung 1 (floor) | 0 / 0 | 0 | pass | 1.00x | 1.00x |
| A frontier growth test, no bound | 0 / 0 | 0 | **silent-region assert fails** | 1.79x | not timed |
| B bound <= 2 | 777 / 2802 | 0 | **silent-region assert fails** | 1.87x | not timed |
| B bound <= 4 | 3785 / 13127 | 0 | **silent-region assert fails** | 2.16x | not timed |
| B bound <= 6 | 13732 / 31313 | 0 | pass | 2.39x | 1.26 / 1.11 / 1.34 / 0.93 / 1.11 |
| B bound <= 8 | 13732 / 53236 | 0 | pass | 2.59x | not timed (dominated) |
| C bound only when open >= 0.25 | 13504 / 95167 | 0 | **changes the fixpoint (228)** | 2.95x | out |
| C bound only when open >= 0.50 | 9546 / 90744 | 0 | **changes the fixpoint (4186)** | 2.82x | out |
| D bound, merge rules dropped | 13225 / 94582 | 1175 | **113 weaker than the baseline** | 2.04x | out |
| **rung 2 full + guard + bitmask** | **13732 / 95191** | **0** | **pass** | **2.97x** | **2.09 / 1.61 / 1.25 / 0.03 / 0.41** |

Live column order: cap12-seed14, cap12-seed4, cap9-seed3 (the three worst),
cap9-seed5, cap12-seed16 (two winners). The guard measured on its own: 2.97x
with it, 3.09x without, on the local bench; 2.04x vs 2.22x once the merge
rules are dropped; no separable live effect. Its identical-fixpoint assertion
is in update-strength.test.mjs.

### What the ablation says

**The parts are not separable.**

- **The frontier growth test adds nothing on its own.** Variant A removes
  exactly rung 1's 7352 candidates against the vendored baseline -- zero extra,
  on 1360 fuzzed states across both board sizes -- for 1.79x the component's
  time. Every extra prune rung 2 makes comes from the component bound.
- **But it cannot be dropped either.** Variant D (bound, merge rules dropped)
  goes 113 cells WEAKER than the vendored baseline and fails the strength
  gate's half one. The merge rules add no prune of their own; they repair a
  hole the bound opens. The rule set is not monotone -- a bound prune can wipe
  out the last door and suppress rung 1's one-door force -- and this is a real
  fixpoint difference, not the harness's 20-pass cap (400 passes: same 700).
- **Capping the bound by digit is a bad trade.** The bound's value rises with
  the digit -- prunes by digit on the 9x9 fuzz peak at 9 and stay high through
  12 (`{1:300, 2:3174, 3:4597, 4:6283, 5:8734, 6:9581, 7:10966, 8:10721,
  9:13425, 10:9626, 11:8501, 12:9283}`), the opposite of the guess that small
  digits carry the silent-region wins. Capping at 6 does shrink the worst
  losses (2.09x -> 1.26x, 1.61x -> 1.11x) but it throws the wins away:
  cap9-seed5 0.03x -> 0.93x, cap12-seed16 0.41x -> 1.11x, a win turned into a
  loss. Read across the set that is worse, not better.
- **The open-fraction gate is out on its own terms.** It changes the fixpoint
  (228 candidates at 0.25, 4186 at 0.50), which is the bar the owner set.
- **The bitmask read is free and worth keeping** wherever the bound ships:
  2.13x -> 2.09x, 1.89x -> 1.61x, 1.52x -> 1.25x on the three worst.

**Keep:** the full bound, the merge rules, the bitmask read. **Drop:** every
capped, gated and merge-less variant. The guard is a coin flip -- it is proved
identical at the fixpoint and buys 4% locally, nothing measurable live.

### pass: #308 ship sweep: rung 2 shipped vs rung 1, started 2026-09-03 17:47:03
- fixture-9x9-cap12-seed10 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed10-rung1.txt) | 8500ms | 4000ms | 0.47 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed10-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: SHIP
- fixture-9x9-cap12-seed11 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed11-rung1.txt) | 4300ms | 4200ms | 0.98 | FAIL |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed11-rung1.txt) after-logical | 3700ms | 3700ms | 1.00 | FAIL |
  two-row rule: NO SHIP
- fixture-9x9-cap12-seed13 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed13-rung1.txt) | 3700ms | 2600ms | 0.70 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed13-rung1.txt) after-logical | 200ms | 300ms | 1.50 | FAIL |
  two-row rule: NO SHIP
- fixture-9x9-cap12-seed14 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed14-rung1.txt) | 3300ms | 6900ms | 2.09 | FAIL |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed14-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: NO SHIP
- fixture-9x9-cap12-seed16 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed16-rung1.txt) | 2500ms | 1100ms | 0.44 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed16-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: SHIP
- fixture-9x9-cap12-seed17 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed17-rung1.txt) | 4900ms | 5300ms | 1.08 | FAIL |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed17-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: NO SHIP
- fixture-9x9-cap12-seed18 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed18-rung1.txt) | 5900ms | 6100ms | 1.03 | FAIL |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed18-rung1.txt) after-logical | 5900ms | 5900ms | 1.00 | FAIL |
  two-row rule: NO SHIP
- fixture-9x9-cap12-seed20 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed20-rung1.txt) | 7100ms | 5100ms | 0.72 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed20-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: SHIP
- fixture-9x9-cap12-seed3 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed3-rung1.txt) | 6200ms | 2300ms | 0.37 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed3-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: SHIP
- fixture-9x9-cap12-seed4 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed4-rung1.txt) | 3600ms | 5900ms | 1.64 | FAIL |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed4-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: NO SHIP
- fixture-9x9-cap12-seed5 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed5-rung1.txt) | 5500ms | 3500ms | 0.64 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed5-rung1.txt) after-logical | 5800ms | 5900ms | 1.02 | FAIL |
  two-row rule: SHIP
- fixture-9x9-cap12-seed8 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed8-rung1.txt) | 3400ms | 4200ms | 1.24 | FAIL |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed8-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: NO SHIP
- fixture-9x9-cap12-seed9 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed9-rung1.txt) | 8400ms | 4900ms | 0.58 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed9-rung1.txt) after-logical | 8400ms | 4800ms | 0.57 | PASS |
  two-row rule: SHIP
- fixture-9x9-cap9-seed1 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed1-rung1.txt) | 3700ms | 1800ms | 0.49 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed1-rung1.txt) after-logical | 2000ms | 2300ms | 1.15 | FAIL |
  two-row rule: NO SHIP
- fixture-9x9-cap9-seed10 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed10-rung1.txt) | 6800ms | 3600ms | 0.53 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed10-rung1.txt) after-logical | 100ms | 0ms | 0.00 | PASS |
  two-row rule: SHIP
- fixture-9x9-cap9-seed18 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed18-rung1.txt) | 6700ms | 7300ms | 1.09 | FAIL |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed18-rung1.txt) after-logical | 4000ms | 4400ms | 1.10 | FAIL |
  two-row rule: NO SHIP
- fixture-9x9-cap9-seed20 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed20-rung1.txt) | 4700ms | 2400ms | 0.51 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed20-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: SHIP
- fixture-9x9-cap9-seed3 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed3-rung1.txt) | 2000ms | 2700ms | 1.35 | FAIL |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed3-rung1.txt) after-logical | 3100ms | 4000ms | 1.29 | FAIL |
  two-row rule: NO SHIP
- fixture-9x9-cap9-seed5 vs rung1:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed5-rung1.txt) | 5200ms | 200ms | 0.04 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed5-rung1.txt) after-logical | 1300ms | 0ms | 0.00 | PASS |
  two-row rule: SHIP
### pass: #308 ship sweep: rung 2 shipped vs rung 1 finished 2026-09-03 18:25:23

### pass: #308 ship sweep: rung 2 shipped vs vendored baseline, started 2026-09-03 18:25:23
- fixture-9x9-cap12-seed10 vs base:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed10-base.txt) | 24500ms | 4200ms | 0.17 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed10-base.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: SHIP
- fixture-9x9-cap12-seed11 vs base:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed11-base.txt) | 24400ms | 4500ms | 0.18 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed11-base.txt) after-logical | 21900ms | 3900ms | 0.18 | PASS |
  two-row rule: SHIP
- fixture-9x9-cap12-seed13 vs base:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed13-base.txt) | 17800ms | 2800ms | 0.16 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed13-base.txt) after-logical | 800ms | 300ms | 0.38 | PASS |
  two-row rule: SHIP
- fixture-9x9-cap12-seed14 vs base:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed14-base.txt) | 24200ms | 6900ms | 0.29 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed14-base.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: SHIP
- fixture-9x9-cap12-seed16 vs base:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed16-base.txt) | 21400ms | 1100ms | 0.05 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed16-base.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: SHIP
- fixture-9x9-cap12-seed17 vs base:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed17-base.txt) | 23800ms | 5500ms | 0.23 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed17-base.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: SHIP
- fixture-9x9-cap12-seed18 vs base:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed18-base.txt) | 25500ms | 6200ms | 0.24 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed18-base.txt) after-logical | 23800ms | 6200ms | 0.26 | PASS |
  two-row rule: SHIP
- fixture-9x9-cap12-seed20 vs base:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed20-base.txt) | 27800ms | 5400ms | 0.19 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed20-base.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: SHIP

## #308 ship: what the owner picked, and what was cut

Decision after the ablation above: ship rung 2 whole -- the component bound,
the merge rules that repair its strength hole, and the bitmask read. Cut:

- **The guard is deleted.** It was built, proved sound, and asserted identical
  at the fixpoint, and it skipped 9-13% of the bound's seeds and none of its
  floods -- 1.03x on the local bench, nothing separable in the app. A gate that
  guards nothing is code to read at 3am. Its identical-fixpoint assertion is
  kept, re-anchored to the shipped component at `ac20771`, as the seam #312
  works against.
- **The full re-sweep is cut short.** #312 (rung 2.5, bound-cost
  optimizations, fixpoint-identical) re-times all 19 fixtures right after this
  ticket, so the vs-baseline pass was stopped at 8 of 19 rather than produce
  rows that were stale on arrival. The vs-rung-1 pass finished, 19 of 19. The
  README's timing record is marked interim and names #312 as its successor.

## #312: rung 2.5 -- cutting the component bound's cost

Bar: every optimization leaves the fixpoint BYTE-IDENTICAL to rung 2 as
shipped (`ac20771`). The seam is the fixpoint-floor assertion #308 left in
`update-strength.test.mjs`, run both directions.

### The screen before the live clock

Each candidate was built and screened on a local bench first --
component-only wall time to a fixpoint over the 19 frozen fixture grids, 120
states each (2280 states), with a fixpoint diff against `ac20771` on every one
of them. The bench is a scratch script, not committed; it exists to keep the
live clock (roughly two minutes a board) for candidates that have a mechanism.

| # | Optimization | Fixpoint diffs / 2280 | Local vs rung 2 | Verdict |
| --- | --- | --- | --- | --- |
| 1 | Bound at quiescence | 0 | **1.30x** | dropped on the screen |
| 2 | Dirty components | 0 | **0.66x** | kept, taken to the panel |
| 3 | k-bounded floods + safe marks | 0 | 1.00x | dropped on the screen |
| 4 | Bitboard flood | not built | — | no slice left to attack |

### 1. Bound at quiescence -- dropped, the schedule has no slack

Built: `update` runs the island-indexed rules to a standstill, fires the bound
only at the quiet point, and loops while the bound keeps changing something.
It is fixpoint-identical (0 diffs over 2280 states) -- the loop stops on the
same predicate the solver's own repeat-until-quiet loop stops on -- and it is
**slower**, 1.30x.

Counting passes per state says why:

| | island passes | bound passes |
| --- | --- | --- |
| rung 2 as shipped | 3.05 | 3.05 |
| bound at quiescence | 5.49 | 3.18 |

The premise was that the bound rides along on island passes that have nothing
left to do. It does not: the island rules already quiesce inside about one
pass, so deferring the bound buys **no bound passes at all** (3.05 -> 3.18,
slightly worse) and pays for a confirming island pass at every quiet point
(3.05 -> 5.49). Nothing on the live clock could rescue that, so it was dropped
without spending the panel on it.

### 2. Dirty components -- kept

`code[i]` is cell i's allowed-digit bitmask (the digit it holds, or its
candidates), read once per cell per pass instead of once per (cell, digit)
pair, and diffed against `prev`, the row the last completed pass finished on.
A component all of whose cells and bordering cells read the same code as last
time IS last time's component and last time's verdict already stands, so only
the changed cells and their neighbours seed a flood. First pass: `prev` is all
-1 and every cell seeds one, exactly as before.

**Why a snapshot and not a dirty flag.** The solver gives no backtrack signal.
A flag set on our own prunes goes stale the moment the search restores a
candidate; a diff against the previous pass's codes cannot. `prev` is written
only after the last yield, so a pass the solver abandons half-way leaves the
older snapshot in place and the next pass reads a superset of what moved.

The per-cell row also collapses the bound's puzzle reads: 12 digits x 81 cells
of `allows` calls (a `hasValue` plus a `getCandidatesBitMask` each) become 81
reads and an array-and-bit test per visit. That is the bitboard idea's cheap
half, and it arrives for free -- the snapshot the dirty test needs IS the row.

Cost, measured as the bound's share on top of the island rules alone (the same
component with the bound cut out, 1.74x rung 1 on this bench):

| | component vs island-rules-only | bound's share |
| --- | --- | --- |
| rung 2 as shipped | 1.81x | 81% on top |
| + dirty components | 1.20x | 20% on top |

Seams: fixpoint floor green both directions (200 states); 0 diffs over the
bench's 2280 states; soundness fuzz 0 violations; `compareStrength` unchanged
at 0 weaker / 21084 stronger.

A new check comes with it: **the reused instance** (400 states). One instance
is driven over a run of unrelated states and each has to settle exactly where a
fresh instance settles it. That is the hazard the cache introduces and the one
the floor assertion cannot see -- the floor builds a fresh instance per state.

### 3. k-bounded floods -- dropped, no signal

Built on top of #2: the flood stops the moment it holds `k` cells or reaches a
cell already known to sit in a component of `k` or more, and marks everything
it touched safe so a later seed skips it. Fixpoint-identical, and **1.00x**
(0.999 over 2280 states) -- no measurable gain.

Why: with dirty components the floods are already small, and the saving is a
wash even on a fully dirty pass. Stopping early does not remove work, it moves
it -- the cells walked away from seed their own floods, which pay a neighbour
scan each to reach a safe cell. Against that it costs about fifteen lines and
one real ordering hazard: the safe mark has to be read BEFORE the visited
stamp, or a flood reads the far half of a component an earlier flood walked
away from as a short component of its own and prunes it. The first cut got
that wrong and the strength gate caught it (21084 stronger cells -> 2011, and
states dying). Correct, unmeasurable, and a trap to read at 3am: dropped.

### 4. Bitboards -- not built, and why not

The ticket admits a bitboard flood only if 1-3 leave fixtures failing. They do
(see the panel below), but a bitboard flood cannot be the answer: after #2 the
bound is 20% on top of the island rules, i.e. about 17% of the component's
time, and the per-(cell, digit) puzzle reads it would have removed are already
gone with the `code` row. The cost that is left is the island-indexed merge
rules, which #308 measured at 1.74-1.79x rung 1 on their own and proved cannot
be dropped without going weaker than the vendored baseline. That is a rung-3
question about the merge rules' scope, not a bound-cost question.

### pass: #312 panel: rung 2.5 (dirty components) vs rung 1
started 2026-09-03 19:14:56
- cap12-seed14:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed14-rung1.txt) | 3700ms | 6800ms | 1.84 | FAIL |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed14-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: NO SHIP
- cap12-seed4:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed4-rung1.txt) | 4300ms | 6100ms | 1.42 | FAIL |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed4-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: NO SHIP
- cap9-seed3:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed3-rung1.txt) | 2300ms | 2500ms | 1.09 | FAIL |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed3-rung1.txt) after-logical | 3500ms | 3600ms | 1.03 | FAIL |
  two-row rule: NO SHIP
- cap9-seed5:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed5-rung1.txt) | 5200ms | 100ms | 0.02 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed5-rung1.txt) after-logical | 1300ms | 0ms | 0.00 | PASS |
  two-row rule: SHIP
- cap12-seed16:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed16-rung1.txt) | 2700ms | 1100ms | 0.41 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed16-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: SHIP
- cap12-seed8:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed8-rung1.txt) | 3800ms | 4400ms | 1.16 | FAIL |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed8-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: NO SHIP
- cap12-seed5:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed5-rung1.txt) | 6200ms | 3400ms | 0.55 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed5-rung1.txt) after-logical | 6400ms | 6200ms | 0.97 | FAIL |
  two-row rule: SHIP
finished 2026-09-03 19:28:25

Panel verdict: **7 boards, 3 SHIP**, the same three rung 2 shipped. Every loss
shrank and none flipped -- cold, against #308's rows on the same boards:
cap12-seed14 2.09x -> 1.84x, cap12-seed4 1.64x -> 1.42x, cap9-seed3 1.35x ->
1.09x (after-logical 1.29x -> 1.03x), cap12-seed8 1.24x -> 1.16x; the wins hold
at 0.02x, 0.41x and 0.55x.

### pass: #312 ceiling probe: the merge rules with the bound REMOVED, vs rung 1
- cap12-seed14:
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed14-rung1.txt) | 3800ms | 4500ms | 1.18 | FAIL |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed14-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: NO SHIP

**This is what settles the ticket's fourth optimization.** The component with
the component bound deleted outright -- the merge rules and rung 1 alone --
still reads **1.18x cold** on cap12-seed14, over the 1.1x bar. That is the
ceiling every bound-cost optimization is chasing, and it is on the wrong side
of the gate. No cheaper bound, bitboard or otherwise, can ship that board; the
cost that is left belongs to the island-indexed merge rules. The second board
of this probe was not run once the first answered the question.

## #312 ship: what landed

**Kept:** dirty components (with the per-cell `code` row it needs, which also
collapses the bound's puzzle reads from 12 x 81 to 81 per pass).
**Dropped:** bound at quiescence, k-bounded floods, bitboards.

Seams at ship: `just check` green; soundness fuzz 0 violations; strength gate
0 weaker / 21084 stronger, unchanged from rung 2; fixpoint floor green both
directions against `ac20771`; the new reused-instance check green over 400
states.

The target -- all seven panel boards SHIP -- was **not** reached, and the
ceiling probe above says it is not reachable from the bound. #310 runs the full
19-fixture sweep on this code as the final shipped-code record.

# #309 — rung 3, cut starve with the dominator filter

## pass: rung 3 vs rung 2.5, all 19 frozen fixtures
The `-rung25.txt` boards are the frozen fixtures with the rung-2.5 component
(`730aec5`) swapped in, built with `build_link.py --board ... --component`;
`just time --board` then times the working-tree rung 3 against them.

started 2026-09-03 19:56:48
- timing-fixture-9x9-cap12-seed10-rung25.txt:
  uv run --with lzstring examples/_shared/time_example.py fillomino --board timing-fixture-9x9-cap12-seed10-rung25.txt
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed10-rung25.txt) | 3800ms | 100ms | 0.03 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed10-rung25.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: SHIP
  done 2026-09-03 19:58:22
- timing-fixture-9x9-cap12-seed11-rung25.txt:
  uv run --with lzstring examples/_shared/time_example.py fillomino --board timing-fixture-9x9-cap12-seed11-rung25.txt
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed11-rung25.txt) | 4200ms | 1000ms | 0.24 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed11-rung25.txt) after-logical | 3800ms | 700ms | 0.18 | PASS |
  two-row rule: SHIP
  done 2026-09-03 20:00:15
- timing-fixture-9x9-cap12-seed13-rung25.txt:
  uv run --with lzstring examples/_shared/time_example.py fillomino --board timing-fixture-9x9-cap12-seed13-rung25.txt
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed13-rung25.txt) | 2600ms | 100ms | 0.04 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed13-rung25.txt) after-logical | 300ms | 0ms | 0.00 | PASS |
  two-row rule: SHIP
  done 2026-09-03 20:01:48
- timing-fixture-9x9-cap12-seed14-rung25.txt:
  uv run --with lzstring examples/_shared/time_example.py fillomino --board timing-fixture-9x9-cap12-seed14-rung25.txt
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed14-rung25.txt) | 6700ms | 100ms | 0.01 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed14-rung25.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: SHIP
  done 2026-09-03 20:03:31
- timing-fixture-9x9-cap12-seed16-rung25.txt:
  uv run --with lzstring examples/_shared/time_example.py fillomino --board timing-fixture-9x9-cap12-seed16-rung25.txt
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed16-rung25.txt) | 1100ms | 0ms | 0.00 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed16-rung25.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: SHIP
  done 2026-09-03 20:04:54
- timing-fixture-9x9-cap12-seed17-rung25.txt:
  uv run --with lzstring examples/_shared/time_example.py fillomino --board timing-fixture-9x9-cap12-seed17-rung25.txt
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed17-rung25.txt) | 5400ms | 0ms | 0.00 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed17-rung25.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: SHIP
  done 2026-09-03 20:06:33
- timing-fixture-9x9-cap12-seed18-rung25.txt:
  uv run --with lzstring examples/_shared/time_example.py fillomino --board timing-fixture-9x9-cap12-seed18-rung25.txt
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed18-rung25.txt) | 6200ms | 400ms | 0.06 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed18-rung25.txt) after-logical | 6200ms | 0ms | 0.00 | PASS |
  two-row rule: SHIP
  done 2026-09-03 20:08:38
- timing-fixture-9x9-cap12-seed20-rung25.txt:
  uv run --with lzstring examples/_shared/time_example.py fillomino --board timing-fixture-9x9-cap12-seed20-rung25.txt
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed20-rung25.txt) | 5000ms | 0ms | 0.00 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed20-rung25.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: SHIP
  done 2026-09-03 20:10:13
- timing-fixture-9x9-cap12-seed3-rung25.txt:
  uv run --with lzstring examples/_shared/time_example.py fillomino --board timing-fixture-9x9-cap12-seed3-rung25.txt
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed3-rung25.txt) | 2300ms | 100ms | 0.04 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed3-rung25.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: SHIP
  done 2026-09-03 20:11:45
- timing-fixture-9x9-cap12-seed4-rung25.txt:
  uv run --with lzstring examples/_shared/time_example.py fillomino --board timing-fixture-9x9-cap12-seed4-rung25.txt
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed4-rung25.txt) | 6300ms | 100ms | 0.02 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed4-rung25.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: SHIP
  done 2026-09-03 20:13:27
- timing-fixture-9x9-cap12-seed5-rung25.txt:
  uv run --with lzstring examples/_shared/time_example.py fillomino --board timing-fixture-9x9-cap12-seed5-rung25.txt
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed5-rung25.txt) | 3500ms | 300ms | 0.09 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed5-rung25.txt) after-logical | 6100ms | 0ms | 0.00 | PASS |
  two-row rule: SHIP
  done 2026-09-03 20:15:19
- timing-fixture-9x9-cap12-seed8-rung25.txt:
  uv run --with lzstring examples/_shared/time_example.py fillomino --board timing-fixture-9x9-cap12-seed8-rung25.txt
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed8-rung25.txt) | 4800ms | 0ms | 0.00 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed8-rung25.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: SHIP
  done 2026-09-03 20:16:56
- timing-fixture-9x9-cap12-seed9-rung25.txt:
  uv run --with lzstring examples/_shared/time_example.py fillomino --board timing-fixture-9x9-cap12-seed9-rung25.txt
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed9-rung25.txt) | 4900ms | 100ms | 0.02 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed9-rung25.txt) after-logical | 4900ms | 0ms | 0.00 | PASS |
  two-row rule: SHIP
  done 2026-09-03 20:18:48
- timing-fixture-9x9-cap9-seed1-rung25.txt:
  uv run --with lzstring examples/_shared/time_example.py fillomino --board timing-fixture-9x9-cap9-seed1-rung25.txt
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed1-rung25.txt) | 1800ms | 500ms | 0.28 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed1-rung25.txt) after-logical | 2300ms | 0ms | 0.00 | PASS |
  two-row rule: SHIP
  done 2026-09-03 20:20:26
- timing-fixture-9x9-cap9-seed10-rung25.txt:
  uv run --with lzstring examples/_shared/time_example.py fillomino --board timing-fixture-9x9-cap9-seed10-rung25.txt
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed10-rung25.txt) | 3200ms | 1800ms | 0.56 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed10-rung25.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: SHIP
  done 2026-09-03 20:21:59
- timing-fixture-9x9-cap9-seed18-rung25.txt:
  uv run --with lzstring examples/_shared/time_example.py fillomino --board timing-fixture-9x9-cap9-seed18-rung25.txt
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed18-rung25.txt) | 7100ms | 100ms | 0.01 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed18-rung25.txt) after-logical | 4400ms | 0ms | 0.00 | PASS |
  two-row rule: SHIP
  done 2026-09-03 20:23:59
- timing-fixture-9x9-cap9-seed20-rung25.txt:
  uv run --with lzstring examples/_shared/time_example.py fillomino --board timing-fixture-9x9-cap9-seed20-rung25.txt
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed20-rung25.txt) | 2400ms | 200ms | 0.08 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed20-rung25.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: SHIP
  done 2026-09-03 20:25:26
- timing-fixture-9x9-cap9-seed3-rung25.txt:
  uv run --with lzstring examples/_shared/time_example.py fillomino --board timing-fixture-9x9-cap9-seed3-rung25.txt
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed3-rung25.txt) | 2600ms | 1000ms | 0.38 | PASS |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed3-rung25.txt) after-logical | 4000ms | 0ms | 0.00 | PASS |
  two-row rule: SHIP
  done 2026-09-03 20:27:14
- timing-fixture-9x9-cap9-seed5-rung25.txt:
  uv run --with lzstring examples/_shared/time_example.py fillomino --board timing-fixture-9x9-cap9-seed5-rung25.txt
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed5-rung25.txt) | 100ms | 200ms | 2.00 | FAIL |
  | 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed5-rung25.txt) after-logical | 0ms | 0ms | — | NO TIME |
  two-row rule: NO SHIP
  done 2026-09-03 20:28:36
finished 2026-09-03 20:28:36

## cap9-seed5, re-run twice
=== rerun cap9-seed5 2026-09-03 20:28:59
uv run --with lzstring examples/_shared/time_example.py fillomino --board timing-fixture-9x9-cap9-seed5-rung25.txt
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed5-rung25.txt) | 100ms | 100ms | 1.00 | FAIL |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed5-rung25.txt) after-logical | 0ms | 0ms | — | NO TIME |
two-row rule: NO SHIP
=== rerun2
uv run --with lzstring examples/_shared/time_example.py fillomino --board timing-fixture-9x9-cap9-seed5-rung25.txt
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed5-rung25.txt) | 100ms | 100ms | 1.00 | FAIL |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed5-rung25.txt) after-logical | 0ms | 0ms | — | NO TIME |
two-row rule: NO SHIP
=== RERUN-DONE

Verdict: **19 boards, 18 SHIP.** Cold time over the 19 falls 74.0s -> 6.1s
(0.08x), median cold row 0.04x. cap9-seed5 is the one NO SHIP and is a
measurement-floor row, not a regression: rung 2.5 already finishes it in 100ms
and its after-logical row is 0ms both sides, so there is nothing left to win.
The first sweep read 200ms there, one tick of the app's 100ms readout; two
re-runs both read 100ms (1.00x). Ruled a pass under `docs/real-app-timing.md`
#197, "unchanged is the pass", by the ticket owner.

Uniqueness spot-check on the rung-3 code, cap12-seed14 (the board rung 2.5
could never ship): the app reads `[unique]` in 100ms against rung 2.5's
6700ms.

Seams at ship: `just check` green; soundness fuzz 0 violations over 40000
states plus a directed cut-starve check; strength gate 0 weaker / 23432
stronger against the vendored baseline; fixpoint floor 0 weaker than `ac20771`
and 856 stronger; reused-instance check green over 400 states.

## #310: strip, prove, link, README

### Blind batch, 18 boards (9x9 digits 1-9, shipped component)

Ticket's ~20-seed batch, seeds 1-20, stripped under the **shipped** component
(rung 3, `43ee72e`) in the live app via `app-strip.mjs` -- run started
2026-09-03 20:46, one board every ~2 minutes now that the finished component
does most of the work itself. Givens per seed: 1:26, 2:30, 3:28, 4:33, 5:32,
6:33, 7:32, 8:32, 9:29, 10:30, 11:34, 12:31, 13:33, 14:33, 15:28, 16:30,
17:28, 18:35. Owner instruction (msg `dae76b43fb26`, "cut the blind batch
short") stopped the run after seed 18 finished, before seed 19 started --
seeds 19-20 were never run. This 18-board record stays as calibration, per
the owner's follow-up, not as the shipped candidate.

### Offline hunt (#317), 300 boards (150 cap9 + 150 cap12)

Per the owner's "scorer-first" instruction once #317 landed (`a89a29b`):
CP-SAT-sampled seeds 101-250 on each of 9x9 digits 1-9 and 9x9 digits 1-12,
offline-stripped and scored with `hunt.mjs strip` (the shipped component as
the propagator, not CP-SAT, not the live app). 283 of 300 scored a verdict;
17 hit a 25s per-board timeout (sample or strip) and were skipped, logged as
`SAMPLE-TIMEOUT`/`STRIP-TIMEOUT` in `hunt/scores.tsv` (not committed --
scratch). Top offline score: 19496 nodes (cap9 seed246). Full table in
`hunt/scores.tsv` during the run; not committed, per HUNT.md's own convention
of keeping curated artifacts, not the bulk scan.

**The offline hunt's own top candidates did not win.** Re-scoring the blind
batch's two 5+ second outliers (seed3, seed15 -- the app-strip trial readouts
that stood out in the 18-board batch) through the same offline scorer:
seed3 scores **151442 nodes**, seed15 **83192 nodes** -- both 4-8x every
offline-hunted candidate. The live app's own strip order (seeded by
`app-strip.mjs`'s per-seed shuffle) found harder boards than 300 fresh
CP-SAT samples stripped offline did. Hill-climbing seed3 offline
(`hunt.mjs climb`, `--free 10 --iters 12 --restarts 2 --seed 21`) could not
beat it either: climb re-strips the seed board with its own offline order
before mutating, which lands on a much weaker rebaseline (3525 nodes, not
151442) -- its best mutant reached 17630 nodes, still an order of magnitude
under the original live-stripped board. Kept as `hunt/climb/seed3.jsonl` +
`seed3-best.json`, not committed -- evidence the loop ran, not a stronger
board.

### Finalists timed live, `app-solve.mjs`

Four boards to the app: the two blind-batch outliers (seed3, seed15) and the
top offline-hunt board per range (cap12 seed235: 37 givens, cap12 seed120: 36
givens -- the offline hunt's cap9 top candidates score below seed3/seed15 by
a wide enough margin they were not worth an app rep).

| Board | Givens | Offline nodes | App verdict (1 rep) |
| --- | ---: | ---: | --- |
| seed3 | 28 | 151442 | unique, 6800ms |
| seed15 | 28 | 83192 | unique, 6900ms |
| cap12 seed235 | 37 | 18573 | **timeout** |
| cap12 seed120 | 36 | 18229 | **timeout** |

Both cap12 finalists hit the app's own solve cap with no verdict -- dropped,
per the standing rule that a timeout is never read as a proof of anything,
hard or easy. Neither grid nor clue set is kept.

Three-rep medians on the two survivors, non-deterministic solve off,
app v2026.08.14-d47fc4b:

| Board | Cold (median of 3) | After-logical (median of 3) |
| --- | ---: | ---: |
| seed3 | **8400ms** | 0ms |
| seed15 | 6600ms | -- (not run; seed3 already ahead) |

**seed3 ships.** 28 givens, 8400ms cold, 0ms after-logical (the app's own
logic pass finishes it before any search). CP-SAT proves it unique in 5.4s,
no timeout (`generate.py unique`). This becomes the example's `gen.json` /
`PUZZLE_LINK.txt`, replacing the 6x6 puzz.link demo board rung 1 shipped
with.
