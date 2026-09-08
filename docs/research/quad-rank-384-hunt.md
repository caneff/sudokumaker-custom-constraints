# Quad rank #384: hunting the shipped board

Work in progress for [#384](https://github.com/caneff/sudokumaker-custom-constraints/issues/384).
Branch `proto/quad-rank-338`. App build `v2026.08.14-d47fc4b`, replayed from the
checked-in HAR; non-deterministic solve off. **Stopped mid-hunt on owner
instruction**; the open decision is at the bottom.

The band #326 set, all four required: zero givens, CP-SAT unique, app cold
solve **<= 10s**, and **>= 20,000** offline search nodes under C5.

## Method

Walk **down** from the hard end. `proto/HARD_328_g1.json` is 16 clues, zero
givens, unique, and uncracked by C5 at 3,000,000 nodes. Adding a clue can only
make a unique board easier and cannot break uniqueness, so rungs are built by
adding true-rank clues on the same grid — `proto/ladder384.mjs`, deterministic
per (clue count, sample) so a rerun reproduces the same boards.

Six samples at each of 17-21 clues, `QR_NODE_CAP=100000`, C5. Raw rows in
`proto/ladder384.jsonl`. **Zero true values lost on every board measured.**

```sh
QR_COMPONENT=QuadRankComponent5.js QR_NODE_CAP=100000 QR_BASE=proto/HARD_328_g1.json \
  QR_COUNTS=17,18,19,20,21 QR_SAMPLES=6 node proto/ladder384.mjs > proto/ladder384.jsonl
```

## The ladder

| clues | samples that finish under the 100k cap | node range of those |
|---|---|---|
| 17 | 0 of 6 | — |
| 18 | 0 of 6 | — |
| 19 | 1 of 6 | 77,117 |
| 20 | 4 of 6 | 17,537 - 78,716 |
| 21 | 6 of 6 | 366 - 41,422 |
| 22 (single probe) | 1 of 1 | 142 |

**Difficulty falls with clue count, as the ISS bench predicted — but placement
dominates inside a rung.** At 21 clues the same grid gives 366 nodes and 41,422
nodes depending only on which windows are clued. So the band is real, it lives
at **19-21 clues**, and clue choice matters more there than clue count.

Two 19-clue and two 20-clue samples found the solution but capped before
proving uniqueness. Those are out: the app would grind the same way.

## The three finalists

| board | clues | offline nodes (C5) | CP-SAT uniqueness | app cold, 1 rep |
|---|---|---|---|---|
| `proto/qr384_a.json` | 19 | 77,117 | unique, 3.2s | **not measured** — the browser died mid-run |
| `proto/qr384_b.json` | 20 | 35,021 | unique, 5.7s | first 10.9s + unique 1.3s = **12.2s** |
| `proto/qr384_c.json` | 20 | 55,618 | unique, 2.2s | first 13.9s + unique 2.0s = **15.9s** |

Links: `proto/LINK_qr384_{a,b,c}.txt`, built by `build_board.py` under C5.
One rep each, recon only — no medians, and **no after-logical row**, so the
two-row protocol in `docs/real-app-timing.md` is not satisfied for any of them.

`qr384_a`'s run ended in `page.waitForTimeout: Target page, context or browser
has been closed`. That is an infrastructure failure, **not** a 300s timeout
reading, and it is recorded as unmeasured rather than guessed at.

## The open decision

**The band may be empty as specified.** The two boards that were measured both
clear the >= 20,000 node floor and both miss the <= 10s app ceiling — 12.2s and
15.9s. Interpolating the two points, the crossover sits near **25,000-30,000
nodes**, and the only sampled board under that (`20 clues, sample 0`, 17,537
nodes) falls below the floor.

So the two halves of the band nearly exclude each other, and one of three
things has to give:

1. **Widen the app ceiling** to ~15s. `qr384_b` ships as-is.
2. **Lower the node floor** to ~15,000 and re-measure the 17,537-node board,
   which should land near 6-7s.
3. **Sample harder inside the gap** — more clue placements at 20-21 clues aimed
   at 25,000-30,000 nodes, hoping a board sits in the overlap.

Owner ruling required; nothing further was run.
