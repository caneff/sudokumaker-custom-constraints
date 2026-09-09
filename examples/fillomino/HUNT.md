# Offline board hunting (#317)

Hunting hard fillomino boards in the live app measures hardness only at the
end, at minutes a board. This is the offline loop: score a clue set in Node in
milliseconds, strip offline, and let the app judge the survivors.

The loop's adversarial half — the hill-climb (`climb`), the ranking handoff
(`finalists`), the CP-SAT resampler and the `--times` rank correlation — was
deleted in #353 once its verdict was recorded. That verdict is below, under
"What the deleted half found"; what runs today is `score`, `board` and
`strip`.

**An offline score ranks candidate boards. It never ships as a claim** — the
app's own solver, driven by `app-solve.mjs` and `just time`, stays the record
(`docs/real-app-timing.md`). Everything below is ranking evidence plus the
app verdicts that back it.

## The pieces

| File | What it is |
| --- | --- |
| `hunt-lib.mjs` | The seams: the scorer and the offline strip. |
| `hunt-lib.test.mjs` | Their tests. 3x3/2x2 expectations come from `generate.py`'s `brute`, not from the scorer. |
| `hunt.mjs` | The CLI: `score`, `board`, `strip`. |
| `hunt_link.py` | A committed link read back into the clue set the scorer reads. |
| `hunt_offline.test.py` | Its test. |
| `hunt-cold-times.tsv` | The app's recorded cold times for the 19 frozen fixtures, copied from `README.md`'s rung 3 record. |

## The scorer

A plain propagate-and-branch search whose only propagator is the **shipped**
`FillominoComponent.js`, loaded the way `soundness-harness.mjs` loads it.
Branching picks the smallest candidate set, lowest cell index first, so a
score is deterministic. Hardness is **search nodes**, tie-broken by
**propagation passes**.

Two things it deliberately does not do:

- It stops after finding a second solution — "more than one" is the whole
  question a uniqueness check asks.
- A spent node budget scores `capped`, never a verdict. Same rule CP-SAT
  timeouts get in `generate.py`: a budget that ran out is not an answer.

## Does the scorer agree with the app? — the 19 frozen fixtures

    node examples/fillomino/hunt.mjs score examples/fillomino/timing-fixture-*-rung25.txt

The app-cold column is `hunt-cold-times.tsv`, read by hand: the `--times` flag
that used to join the two and print the rank correlation went with #353.

| Fixture (rung25) | Offline verdict | Nodes | Passes | App cold (ms) |
| --- | --- | ---: | ---: | ---: |
| cap12-seed10 | unique | 2715 | 3180 | 100 |
| cap12-seed11 | unique | 27888 | 36670 | 1000 |
| cap12-seed13 | unique | 1032 | 1512 | 100 |
| cap12-seed14 | unique | 50 | 104 | 100 |
| cap12-seed16 | unique | 0 | 9 | 0 |
| cap12-seed17 | unique | 115 | 147 | 0 |
| cap12-seed18 | unique | 11907 | 14723 | 400 |
| cap12-seed20 | unique | 242 | 367 | 0 |
| cap12-seed3 | unique | 456 | 728 | 100 |
| cap12-seed4 | unique | 7 | 20 | 100 |
| cap12-seed5 | unique | 125499 | 150530 | 300 |
| cap12-seed8 | unique | 0 | 7 | 0 |
| cap12-seed9 | unique | 4755 | 5234 | 100 |
| cap9-seed1 | unique | 34321 | 51306 | 500 |
| cap9-seed10 | unique | 110 | 205 | 1800 |
| cap9-seed18 | unique | 1760 | 2206 | 100 |
| cap9-seed20 | unique | 21 | 54 | 200 |
| cap9-seed3 | unique | 15516324 | 18375274 | 1000 |
| cap9-seed5 | unique | 2219 | 3337 | 100 |

**All 19 agree with the app: `unique`.** Eighteen of them under the default
200,000-node budget. The nineteenth, cap9-seed3, spends that budget and scores
`capped` — no verdict — and needs `--node-cap 20000000` to close: 15,516,324
nodes, 25.5 minutes. The app closes the same board in a second. See "Where the
scorer is weaker than the app" below.

**Spearman's rho between offline nodes and the app's recorded cold times, as
measured before the flag was deleted: 0.599 over all 19** (cap9-seed3 at its true 15,516,324; it ranks top either
way, so the capped run gives the same rho). Positive and useful for ranking, well short of a proxy.
Two reasons not to read more into it: twelve of the recorded times are 0 ms or
100 ms, which is the app's timer resolution and not a measurement, and the app
solves with its own search order, which is not this one.

## Where the scorer is weaker than the app

The offline search branches on the smallest candidate set, lowest cell index
first, with no restarts, no learning and no randomisation. The app's solver has
its own search. On cap9-seed3 that gap is four orders of magnitude: 15.5 million
nodes and 25 minutes here against about a second there.

That is a limit on the scorer as an ORACLE, not on the scorer as a RANKER —
and ranking is the job. A board the offline search finds hard is a board worth
paying app minutes on; a board it finds trivial is not.

## Offline strip

`stripOffline` runs the same greedy walk `app-strip.mjs` runs in the live app —
`seededShuffle` order, one pass, a removal kept only when the board still
closes — with the app swapped out for the scorer. It starts from the full grid,
so the clue set it produces is its own, not the fixture's.

    node examples/fillomino/hunt.mjs strip <link|board.json> <out.json> [seed]

Two fixture grids stripped at seed 7, then built into links and put to the
app's own solver (`app-solve.mjs`, app v2026.08.14-d47fc4b):

| Board | Clues | Offline | App verdict | App cold |
| --- | ---: | --- | --- | ---: |
| `hunt-strip-cap9-seed20` (from cap9-seed20's grid) | 31 | unique, 54 nodes | **unique** | 100 ms |
| `hunt-strip-cap12-seed13` (from cap12-seed13's grid) | 30 | unique, 16 nodes | **unique** | 0 ms |

A strip trial runs under a lower node budget than a scoring run (20,000). A
trial that runs out KEEPS the clue, so a low budget can only leave a board with
more clues than it needed — never fewer, and never a board that stops closing.

## What the deleted half found

`climb` and `finalists` were deleted in #353. What follows is the record they
returned, kept because it is the evidence the loop worked, not a set of
commands to re-run.

**The hill-climb.** One step freed a connected patch of K cells, asked CP-SAT
for a different filling of that patch with the rest pinned, stripped the
mutant grid and scored it. A mutant replaced its seed only when it still had
exactly one solution AND outranked the seed — more solutions, none, or a spent
node budget all dropped it, whatever they scored. The patch was connected on
purpose: six cells scattered over a 9x9 leave the pinned rest so tight that
CP-SAT's only completion is the grid it started from, and the first run of the
loop logged 23 dead draws out of 24. Both sides went through the same strip,
so a comparison read the board and not the clue count.

The run of record climbed the mid-pack fixture cap12-seed13 (1032 nodes as the
fixture ships, 3156 after the climb's own strip), `--free 10 --iters 12
--restarts 2 --seed 11`:

| | Nodes | Passes | Clues |
| --- | ---: | ---: | ---: |
| Seed, stripped | 3156 | 3455 | — |
| Best mutant (`hunt-climb-cap12-seed13-best.json`) | **17467** | 19712 | 28 |

24 draws, 3 kept, 4 of them dead (the freed patch had no other filling). The
winner is the first kept draw, `rngSeed` 11000033. Every draw appended one
JSON line to `hunt-climb-cap12-seed13.jsonl`, kept or not, with the seed
board's label, the `rngSeed`, the freed cells and the scores before and after
— a dead draw as `"resample": "none"`, so the log accounts for every draw.

**CP-SAT proves the winner unique**, in 4.6 s, no timeout:

    uv run --with ortools examples/fillomino/generate.py unique \
        examples/fillomino/hunt-climb-cap12-seed13-best.json
    unique

**And the app agreed it is harder.** `hunt-finalist-1.txt` is that board built
through `build_link.py`; `app-solve.mjs`, 3 reps, non-deterministic solve off,
app v2026.08.14-d47fc4b:

| Board | App verdict | App cold (median of 3) |
| --- | --- | ---: |
| cap12-seed13 as the fixture ships | unique | 100 ms |
| `hunt-finalist-1.txt` (the climbed board) | **unique** | **700 ms** |

A 5.5x rise offline landed as a 7x rise on the app's own clock. One board is
not a calibration, but it is the loop working end to end.

**`finalists`** ranked boards by offline score and wrote `hunt-finalist-<i>`
JSON plus link files for the top n, through `build_link.py` — the same builder
`PUZZLE_LINK.txt` goes through. From there the surviving tools take over:
`app-solve.mjs` for the verdict, `just time` for the two-row timing,
`generate.py unique` for the CP-SAT proof. That handoff is two commands by
hand, which is why the wrapper went.

## Committed artifacts

| File | What it is |
| --- | --- |
| `hunt-strip-cap9-seed20.json` / `.txt` | Offline strip of cap9-seed20's grid, and its link. App: unique, 100 ms. |
| `hunt-strip-cap12-seed13.json` / `.txt` | Offline strip of cap12-seed13's grid, and its link. App: unique, 0 ms. |
| `hunt-seed-cap12-seed13.json` | The climb's seed board. |
| `hunt-climb-cap12-seed13.jsonl` | The climb's reproduction log, all 24 draws. |
| `hunt-climb-cap12-seed13-best.json` | The board it found. CP-SAT: unique. |
| `hunt-finalist-1.txt` | That board as a link. App: unique, 700 ms. |

None of these is a shipped board — `PUZZLE_LINK.txt` and the frozen fixture
set are untouched. They are the evidence for the loop, and they outlive the
tools that made them.

The three `.txt` links above were **rebuilt** after `052e3af` added the
separation sentence to the rules text, so a recipient reads the whole rule.
Decoding old against new shows `comment` as the only key that moved: same
board, same clue set, same component code, so the app timings recorded here
still stand. The frozen `timing-fixture-*.txt` files are deliberately *not*
rebuilt — a frozen fixture is frozen (#307).

## When the hunt outruns the app (#310)

Shipping the example's own instance ran the loop for real: a 300-board
offline hunt (150 cap9 + 150 cap12), ranked, and the top two boards per range
sent to `finalists`. The two cap9 finalists were live-app duds relative to a
separate 18-seed blind live-strip batch's own two outliers — offline score
is a ranker, not a universal yardstick across search strategies, exactly as
this file already says. The two **cap12** finalists (offline scores 18573 and
18229, comparable to several boards elsewhere in this file that the app
closes in well under a second) both **timed out live** — the app's own solve
cap, no verdict either way, on the first rep. Per the standing rule, a
timeout is not evidence of hardness; it is evidence of nothing, and the
board is dropped, not shipped.

The lesson is not "the offline scorer is broken" — it agrees with the app on
all 19 frozen fixtures (above) — it is that the scorer and the app's own
solver diverge enough, on some boards, that a score in the range that means
"comfortably closes" for most boards can mean "the app cannot finish it" for
others. The hunt's own top-ranked candidates are not automatically safer bets
than a board found by simpler means. In the end, the shipped instance
(`PUZZLE_LINK.txt`) came from neither the offline hunt nor the hill-climb: it
is one of the two outliers from the blind 18-seed live-strip calibration
batch that predates #317 — the live app's own strip order, run without any
offline pre-ranking, found the hardest board that still closes. Full record
in `PROGRESS.md`'s `#310` section.
