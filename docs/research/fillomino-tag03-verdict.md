# Fillomino "Tag 03" on the repo model (#867)

"Tag 03 - Fillomino" by CJK, 14 wide by 15 high, Logic Masters Deutschland
puzzle 00054B, from the 2020 advent calendar on mathebau.rocks. Logic Masters
states no reuse terms, so the board itself is not committed: 56 givens, read
from the puzzle's puzz.link link into the git-ignored `.scratch/`. The rules
allow unclued regions larger than any clue; the largest given is 9.

Run on 2026-10-22 with `generate.py unique <gen> 1200`: the reproducible
configuration (one worker, seed 0), 1200 s per solve, two runs side by side.

| Digits | Verdict | Wall clock |
|---|---|---|
| 1..9 | timed out, no verdict | 1200 s |
| 1..15 | timed out, no verdict | 1200 s |

A timeout is no verdict: it says neither unique nor not unique. The driver
refused both runs and logged the clue set; no other protocol was tried. The
digit range the puzzle needs is therefore not settled here. Whether the board
needs digits above 9 for unclued regions, and whether the model can prove a
board this size in a practical time, stay open.
