# #613: Up to N rule correction, the evidence behind the PR

Ticket #613 (spec #589) corrected Up to N to "the digits strictly before the
first N". This note keeps the raw measurements and the two one-off scripts the
PR's claims rest on. The summary rows are in `examples/up-to-n/README.md`,
§ Timing.

## Every recorded clue shifts by exactly N

`reclue.py` (below) recomputed every clue in the four gen JSONs from the
recorded grid: the 4x4, the 6x6, the minimal 9x9 and the shipped 9x9, with
16, 24, 36 and 36 lines. Before writing anything it asserts that old - new == N
on every line, and every line passed. It then re-encoded each link from its
recorded board, with no CP-SAT search. The shown clues after the correction:

```
gen.json      B1 11, B4 0, B7 24, L3 10, L4 29, L6 17, L7 26, R0 2, R1 33, R2 33,
              R5 22, R7 11, R8 9, T1 32, T3 0, T5 30, T7 13, T8 19
gen_9x9.json  B4 0, B7 24, L3 10, L4 29, R0 2, R1 33, R2 33, R5 22, R7 11, T1 32,
              T3 0, T5 30, T8 19
gen_4x4.json  R1 4, R2 5, T3 0
gen_6x6.json  B0 16, L1 4, L3 9, L4 12, R5 0, T2 7
```

## Timing, 2026-09-26, app v2026.08.14-d47fc4b

`just time up-to-n` on the corrected tree prints baseline rows only, because
the candidate is byte-equal to the regenerated link:

```
| 2026-09-26 | v2026.08.14-d47fc4b | up-to-n | 16400ms | — | — | BASELINE |
| 2026-09-26 | v2026.08.14-d47fc4b | up-to-n after-logical | 12000ms | — | — | BASELINE |
```

The comparison is link vs link. `link_vs_link.py` (below) times the committed
`PUZZLE_LINK.txt` before the correction (1c43b3b~1) against the one after,
both stripped. Each round runs one rep of each link, in alternating order,
with non-deterministic solve off. Raw reps, in ms:

| mode | before | after | median ratio |
|---|---|---|---|
| cold | 17200, 16200, 15400 | 15800, 15700, 15900 | 15800 / 16200 = 0.98x |
| after-logical | 13200, 12000, 12000 | 13100, 12000, 11900 | 12000 / 12000 = 1.00x |

`docs/real-app-timing.md` describes link vs link for a change where only the
board moved. Here the component and the board moved together. Swapping the new
component into the old board would time a different puzzle, since its clues
were read under the old rule, so a same-board swap has no valid baseline.

## The shipped 9x9 through the solver bundle

`end-to-end.test.mjs` skips the 9x9 for time. It was run once by hand through
`bundle-solve-lib.mjs`'s `solveDocument` on the corrected `PUZZLE_LINK.txt`:
1 solution, equal to `gen.json`'s grid, in 87,476 ms.

## Scripts

`reclue.py`, run from the repo root with `uv run`:

```python
# One-off for #613: recompute each committed board's recorded clues under the
# corrected rule and re-encode its link from the recorded board. No search.
import pathlib, sys
from dataclasses import replace
HERE = pathlib.Path("examples/up-to-n").resolve()
sys.path.insert(0, str(HERE.parent / "_shared")); sys.path.insert(0, str(HERE))
import link_codec
from build_size import SPEC, target_digit
from framebuild import build_doc, check, load_board, save_board

for link_name, gen_name in [("PUZZLE_LINK.txt", "gen.json"), ("PUZZLE_LINK_9x9.txt", "gen_9x9.json"),
                            ("PUZZLE_LINK_4x4.txt", "gen_4x4.json"), ("PUZZLE_LINK_6x6.txt", "gen_6x6.json")]:
    board = load_board(HERE / gen_name)
    clue = {}
    for k, cells in board.lines.items():
        v = SPEC.clue_fn([board.grid[r][c] for r, c in cells], cells, board.box)
        assert board.clue[k] - v == target_digit(cells), (gen_name, k)
        clue[k] = v
    board = replace(board, clue=clue)
    doc = build_doc(SPEC, board, local=True)
    link = link_codec.encode_link(doc)
    check(SPEC, link, doc, board, local=True)
    save_board(board, HERE / gen_name)
    (HERE / link_name).write_text(link + "\n")
    print(gen_name, "shown", sorted((k, clue[k]) for k in board.active))
```

`link_vs_link.py`, run from the repo root with `uv run`, with `.scratch/old_link.txt` = `git show 1c43b3b~1:examples/up-to-n/PUZZLE_LINK.txt`:

```python
# One-off for #613: the committed PUZZLE_LINK.txt before and after the rule
# correction, stripped, timed interleaved one rep per link per round
# (docs/real-app-timing.md, "Link vs link" and "Interleave").
import pathlib, statistics, sys
sys.path.insert(0, "examples/_shared")
from probe_link import empty_link_file
from time_example import app_solve, parse_app_solve_output
S = pathlib.Path(".scratch")
links = {"old": S / "old_link.txt", "new": pathlib.Path("examples/up-to-n/PUZZLE_LINK.txt")}
probes = {}
for k, p in links.items():
    probes[k] = S / f"{k}_probe.txt"; empty_link_file(p, probes[k], "strip")
ms = {(k, a): [] for k in links for a in (False, True)}
for rnd in range(3):
    for after in (False, True):
        for k in (("old", "new") if rnd % 2 == 0 else ("new", "old")):
            r = parse_app_solve_output(probes[k], app_solve(probes[k], 1, after_logical=after))
            ms[k, after].append(r["median"]); print(rnd, k, "after" if after else "cold", r["median"], flush=True)
for after in (False, True):
    o, n = statistics.median(ms["old", after]), statistics.median(ms["new", after])
    print("after-logical" if after else "cold", "old", o, "new", n, "ratio", round(n / o, 2), ms["old", after], ms["new", after])
```
