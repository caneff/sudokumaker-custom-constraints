# QQRR opener verdict (#593)

Eleven runs of `finders/qqrr/qqrr_cpsat.py` against `finders/qqrr/opener.json`
(runs 1–9) and two hand-built variants of it (runs 10–11), each under
`job-run --name qqrr-opener-<label>`, sequential (one solver process live at
a time), `--workers 16 --timeout 600`:

```
uv run finders/qqrr/qqrr_cpsat.py [<opener-variant>.json] --corner <tl|tr|bl|br|none> \
  [--hypotheses] --workers 16 --timeout 600 --progress <path>.log
```

Eight per the map #591 protocol (hypotheses on then off, by corner for the
QQRR 5), plus a diagnostic (run 9: hypotheses on, no corner) to separate the
corner pin from the hypotheses as the source of the on-runs' infeasibility,
plus a hypothesis-group split (runs 10–11) to separate the entered digits
from the uncircled marks as the source of that infeasibility.

**Deviations from the map's protocol, both controller-authorized, not the
worker's own choice.** The map calls for the eight numbered runs at 4 in
parallel / 6 workers when the box is quiet, else sequential at 16; the
parallel launch and a first sequential attempt at 16 were both denied by this
session's permission classifier ("Interfere With Workloads"), reported
verbatim to the controller (qqrr-17), which relayed Chris's ruling: run
sequential at 16 workers throughout, one solver process live at a time — that
ruling is what every run below actually used. The controller also ordered
run 9 and runs 10–11, past the map's eight, to localize the infeasibility
that runs 1–4 found.

Real clues, every run — always fixed, `--hypotheses` or not, per
`checker.load_opener`'s `window_clues`/`cell_clues` (circled symbols only):
QR 10 at window top-left (row 6, col 6); QR band 58–64 at window (row 4, col
4); QR band 51–56 at window (row 2, col 5); QQRR 33 at cell (row 0, col 4);
QQRR 5 at the corner under test (tl/tr/bl/br), or absent on the diagnostic
run. The two QR bands read "assumption" in `OPENER_NOTES.md`'s status column,
but the link circles them, so the checker treats them as clues like QR 10 —
not as hypotheses. Hypotheses, fixed only on the `--hypotheses` runs, per
`window_hypotheses`/`digit_hypotheses`: the three uncircled QR marks — 9 at
(row 3, col 2), 8 at (row 4, col 1), 1 at (row 3, col 1) — and the 13 entered
digits from `OPENER_NOTES.md`'s grid (`test_checker.py` asserts this count).
Plain sudoku underneath.

## Runs

| # | corner | hypotheses | status | wall clock |
|---|---|---|---|---|
| 1 | tl | on | infeasible | 0.0s |
| 2 | tr | on | infeasible | 0.0s |
| 3 | bl | on | infeasible | 0.0s |
| 4 | br | on | infeasible | 0.0s |
| 5 | tl | off | multiple (≥2 solutions, capped at 2) | 3.8s |
| 6 | tr | off | multiple (≥2 solutions, capped at 2) | 6.5s |
| 7 | bl | off | multiple (≥2 solutions, capped at 2) | 5.5s |
| 8 | br | off | multiple (≥2 solutions, capped at 2) | 9.8s |
| 9 | none | on | infeasible | 0.0s |

No run approached the 600s ceiling; every result is a proven verdict, not a
timeout.

## Grid and rank tables, hypotheses-off runs

### Corner tl, solution 1

```
8 4 7 9 5 1 3 2 6
9 6 3 2 7 4 1 8 5
1 2 5 6 3 8 9 7 4
2 1 6 4 8 3 5 9 7
3 5 4 7 9 6 8 1 2
7 8 9 5 1 2 6 4 3
6 7 8 3 4 9 2 5 1
5 3 1 8 2 7 4 6 9
4 9 2 1 6 5 7 3 8
```

window ranks (by top-left cell)
```
54 25 48 59 31  4 16 11
61 36 17 13 43 22  7 55
 1  9 34 37 21 56 64 45
 8  5 39 27 53 19 35 63
20 33 26 49 61 41 50  2
47 57 60 29  3 12 38 23
40 46 52 18 28 58 10 30
32 15  6 51 14 44 24 42
```

cell ranks
```
 5 30 21 28 33  8  9 16  1
31 75 60 73 79 42 34 38 14
10 35 44 55 54 71 39 51 32
 2 17 37 65 66 59 76 81 26
13 36 49 68 62 74 57 43 11
18 58 64 61 46 50 70 47  7
27 72 77 80 40 41 53 67 19
24 69 45 48 56 63 78 52 22
 3 23  6 12 29 15 25 20  4
```

### Corner tl, solution 2

```
7 8 3 9 2 5 4 6 1
9 6 5 1 7 4 8 3 2
1 2 4 3 6 8 5 7 9
2 1 6 4 3 7 9 8 5
5 4 7 8 9 1 3 2 6
8 3 9 2 5 6 7 1 4
4 9 8 6 1 3 2 5 7
6 5 2 7 8 9 1 4 3
3 7 1 5 4 2 6 9 8
```

window ranks (by top-left cell)
```
47 52 20 60 12 31 25 36
62 39 29  7 44 27 51 16
 1  9 22 18 42 54 35 49
 8  6 38 23 19 48 63 53
32 26 46 56 59  2 15 13
50 21 61 11 33 41 43  4
28 64 55 37  3 17 10 34
40 30 14 45 57 58  5 24
```

cell ranks
```
 5 26 30 16 33 12 20 17  3
27 72 75 42 52 55 64 60 23
10 34 48 44 54 70 62 74 14
 1 15 36 58 56 69 76 66 28
11 35 53 67 59 41 50 80 31
21 65 61 71 78 51 43 39  6
29 73 57 79 38 46 68 49  7
18 63 81 77 47 45 40 37 22
 4 24 19 13 25 32  9  8  2
```

### Corner tr, solution 1

```
4 7 6 9 5 2 3 8 1
9 8 5 3 1 7 6 4 2
1 2 3 6 4 8 9 7 5
2 1 9 7 6 3 8 5 4
6 4 8 5 9 1 7 2 3
3 5 7 2 8 4 1 6 9
8 9 1 4 7 5 2 3 6
5 6 2 8 3 9 4 1 7
7 3 4 1 2 6 5 9 8
```

window ranks (by top-left cell)
```
26 48 42 61 29 12 20 50
64 53 31 15  5 49 40 24
 1  9 18 39 28 56 62 46
 8  7 62 47 37 19 54 32
38 27 54 35 59  4 44 11
16 34 43 14 52 22  3 41
57 58  2 25 45 30 10 17
33 36 13 51 21 60 23  6
```

cell ranks
```
 3 18 28 26 33 20 11 15  5
19 61 73 70 53 43 55 59 29
 8 35 49 65 39 50 74 69 17
 2 14 37 58 68 63 78 80 27
 9 36 54 81 72 46 40 76 21
24 67 62 77 66 52 34 48 10
13 57 45 47 56 75 41 44 25
31 79 51 42 60 71 64 38  6
 4 22 23 12 30 16 32  7  1
```

### Corner tr, solution 2

```
5 6 4 9 7 3 1 8 2
9 7 8 5 1 2 6 3 4
1 2 3 6 4 8 5 7 9
2 1 7 3 5 4 9 6 8
8 3 6 7 9 1 4 2 5
4 9 5 2 8 6 7 1 3
6 5 9 8 3 7 2 4 1
7 8 1 4 2 9 3 5 6
3 4 2 1 6 5 8 9 7
```

window ranks (by top-left cell)
```
32 38 28 63 45 15  7 52
62 47 55 29  2 12 36 16
 1  9 19 37 25 56 34 50
 8  6 46 17 31 26 61 42
54 20 40 49 58  5 24 11
27 60 30 13 57 41 43  3
39 35 64 53 21 44 10 22
48 51  4 23 14 59 18 32
```

cell ranks
```
 2 22 24 21 33 27  7 12  5
23 64 68 62 49 45 37 52 30
11 34 46 77 41 38 54 66 15
 1 17 36 57 67 60 78 65 29
13 35 51 73 56 42 40 81 26
31 76 58 70 74 48 47 39  6
20 61 80 63 55 79 71 44  8
25 69 43 50 75 59 72 53 18
 4 28 10  9 19 14 32 16  2
```

### Corner bl, solution 1

```
3 5 7 9 2 4 8 1 6
9 6 8 3 5 1 4 7 2
1 2 4 7 6 8 5 3 9
2 1 3 8 4 7 9 6 5
5 4 6 2 9 3 7 8 1
7 8 9 6 1 5 3 2 4
8 9 5 1 7 6 2 4 3
6 7 2 4 3 9 1 5 8
4 3 1 5 8 2 6 9 7
```

window ranks (by top-left cell)
```
17 34 50 59 13 28 52  6
62 41 53 16 30  3 26 44
 1  9 25 46 42 55 32 20
 8  2 19 54 27 49 64 39
33 24 38 14 60 18 47 51
48 57 63 36  5 31 15 12
56 61 29  7 45 37 10 22
40 43 10 22 21 58  4 35
```

cell ranks
```
 2 15 24 30 33 14 22  7  1
16 55 65 73 79 39 42 48 10
 9 35 47 74 54 44 45 60 28
 3 17 37 59 69 67 76 63 18
11 36 41 57 75 61 72 81 25
23 64 58 66 40 50 56 70 31
29 71 78 51 34 49 62 53 13
32 77 80 43 52 68 46 38 21
 5 26 27 12 20 19  8  6  4
```

### Corner bl, solution 2

```
4 8 3 9 2 5 7 6 1
9 6 7 3 4 1 5 2 8
1 2 5 6 7 8 4 3 9
2 1 8 4 3 6 9 7 5
5 3 6 8 9 7 1 4 2
7 9 4 5 1 2 6 8 3
3 4 1 7 8 9 2 5 6
8 5 9 2 6 4 3 1 7
6 7 2 1 5 3 8 9 4
```

window ranks (by top-left cell)
```
29 52 20 59 11 35 47 37
62 39 45 16 23  4 31 14
 1  9 34 40 49 54 27 21
 8  7 53 26 19 43 64 46
32 18 42 56 63 44  3 24
50 61 28 30  2 13 41 51
17 22  5 48 57 60 10 33
55 36 58 12 38 25 15  6
```

cell ranks
```
 3 19 30 15 33 10 22 27  4
20 64 76 61 80 38 45 72 24
 8 34 46 71 57 41 47 65 12
 2 14 36 67 68 74 78 63 16
 9 35 55 77 62 60 48 54 26
21 66 59 70 51 53 49 44 17
28 75 52 42 43 39 56 69 29
13 58 40 50 73 79 81 37  7
 5 31 23 32 11 25 18  6  1
```

### Corner br, solution 1

```
4 7 8 9 6 3 1 2 5
6 9 5 7 1 2 4 8 3
1 2 3 5 4 8 6 7 9
2 1 4 3 8 7 9 5 6
5 8 6 1 9 4 7 3 2
9 3 7 2 5 6 8 1 4
7 5 9 6 3 1 2 4 8
3 4 2 8 7 9 5 6 1
8 6 1 4 2 5 3 9 7
```

window ranks (by top-left cell)
```
25 47 57 64 38 15  2 13
42 60 33 43  2 11 27 52
 1  9 19 29 28 54 40 50
 8  6 23 21 56 49 62 31
34 53 36  7 59 24 45 17
58 20 44 12 30 41 51  5
46 35 63 39 16  4 10 26
18 22 14 55 48 61 32 37
```

cell ranks
```
 4 18 25 30 33 23  6  8  1
17 61 72 77 53 45 37 40 12
 9 34 51 65 48 39 56 62 28
 2 15 36 58 64 63 75 69 27
11 35 52 42 41 76 73 80 20
22 66 74 44 54 79 60 49  7
31 78 59 70 57 43 47 50 10
24 71 67 81 68 38 46 55 19
 2 14 16 13 29 26 32 21  5
```

### Corner br, solution 2

```
4 3 8 9 7 1 5 2 6
6 9 7 2 5 4 8 1 3
1 2 5 3 6 8 7 9 4
2 1 3 8 4 6 9 7 5
5 8 6 1 9 7 4 3 2
7 4 9 5 3 2 6 8 1
9 6 4 7 1 3 2 5 8
3 7 2 6 8 5 1 4 9
8 5 1 4 2 9 3 6 7
```

window ranks (by top-left cell)
```
23 21 57 61 43  6 30 12
41 61 46 11 33 26 52  4
 1  9 31 18 40 56 50 58
 8  3 20 53 24 42 64 49
35 55 36  7 63 47 22 17
48 27 59 32 15 14 38 51
60 37 25 44  2 16 10 34
19 45 13 39 54 29  5 28
```

cell ranks
```
 4 19 18 30 33  9 12 21  1
20 58 56 76 79 46 51 42  6
 8 34 50 70 53 64 61 48 10
 2 17 36 63 55 68 75 73 31
13 35 43 40 49 59 69 81 27
23 65 74 45 52 80 71 57 15
26 72 62 77 44 38 54 67 28
32 78 66 60 47 41 39 37 22
 3 16 25 14 24 29  7 11  5
```

## Readout

**Which corners survive.** All four (tl, tr, bl, br) survive clues-only:
each is `multiple`, not infeasible, at 3.8–9.8s. The three real QR clues (10,
58–64, 51–56) plus QQRR 33 plus any one QQRR-5 corner all coexist happily;
hypotheses-on rejects every corner alike (runs 1–4, all infeasible at 0.0s),
so the corner assumption carries no discriminating power over this
opener — nothing here narrows the QQRR 5 to one corner. It's the hypothesis
groups (the 13 digits, the three uncircled marks), not the clue set, that
close off every corner equally.

**Whether the entered digits can all stand.** Not established which group is
at fault — see the split below (runs 10–11): every hypotheses-on run bundled
the 13 digits and the three uncircled marks together, so runs 1–4 and 9 only
show that the two groups combined, against the five real clues, have no
solution; they don't say which group, or whether it takes both together.

**How open the opener is.** Wide open on clues alone: every corner exhibits a
second solution in 3.8–9.8s, well under the 600s ceiling — `multiple` is
proven by the second solution CP-SAT actually returned, not inferred from
the run staying short of the timeout. The five real clues (QR 10, QR
58–64, QR 51–56, QQRR 33, QQRR 5 at any one corner) underconstrain the grid
by a wide margin — the opener needs more real clues, or a resolved and
*consistent* hypothesis set, before a unique-grid finder run is worth
mounting.

## The hypothesis-group split (runs 10–11)

Two `.scratch/opener-*.json` variants of `finders/qqrr/opener.json`, each run
once, hypotheses-on, no corner, against the five real clues:

- **digits-only** (`opener-digits-only.json`): the three uncircled QR-mark
  symbols (9, 8, 1) removed from the "QR Ranks" symbol list; the 13 entered
  digits left in place.
- **marks-only** (`opener-marks-only.json`): every non-given cell `value`
  removed; the three uncircled marks left in place.

| # | variant | status | wall clock |
|---|---|---|---|
| 10 | digits-only | infeasible | 0.0s |
| 11 | marks-only | infeasible | 0.0s |

**Both are infeasible alone.** The 13 entered digits conflict with the five
real clues on their own, with no uncircled marks in play; the three
uncircled marks conflict with the five real clues on their own, with no
entered digits in play. Neither group needs the other to break the opener —
this isn't a fight between the two groups, each one individually contradicts
QR 10 / QR 58–64 / QR 51–56 / QQRR 33 / QQRR 5. At least one entered digit
and at least one uncircled mark is wrong, or the rule as coded diverges from
the one intended, independent of which group is blamed.

## Raw progress files

`.scratch/{on,off}-{tl,tr,bl,br}.log`, `.scratch/on-none.log` — gitignored,
not shipped.
