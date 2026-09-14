# #435: real-app timing after walking only unfilled house cells

`HouseGacComponent.js` now strips each placed cell's digit from the rest of
the house first, then walks only the free cells' subsets (16-32 groups on a
mid-search 4-5-free-cell house, instead of 511). No deduction added or
removed -- see the file's own header for the argument -- so this is the
gate-change bar (`docs/real-app-timing.md`): ship at <= 1.1x on both rows.

## Method

Same splice method as #421 (`docs/research/421-frame-link-timing.md`), not
committed:

- **numbered-rooms, outside-sudoku** (house_gac unset): the shared filter
  spliced onto the committed `PUZZLE_LINK.txt` as one more constraint
  (`framebuild.house_gac_constraint(9)`), written to a scratch
  `PUZZLE_LINK_house_gac_candidate.txt`. `just time <example> [--ring-clues]`
  and the same with `--board PUZZLE_LINK_house_gac_candidate.txt`; both print
  baseline-only rows (component code untouched), so the ratio is the two
  baselines compared by hand.
- **hit-counts, running-start** (already ship `house_gac`): the committed
  `PUZZLE_LINK.txt`'s own House GAC constraint has its component code
  swapped for the new `HouseGacComponent.js` (`link_swap.swap_component_code`),
  written the same way. `just time <example>` (old code, as shipped) vs
  `just time <example> --board PUZZLE_LINK_house_gac_candidate.txt` (new
  code, same board).

One run at a time; `uptime`/`free -g` checked before starting (load average
0.7-0.9, 22G free).

## Results

| example | mode | before | after | ratio |
| --- | --- | --- | --- | --- |
| numbered-rooms | cold | 1800ms | 1800ms | 1.000x |
| numbered-rooms | after-logical | 1500ms | 1400ms | 0.933x |
| outside-sudoku | cold | 500ms | 500ms | 1.000x |
| outside-sudoku | after-logical | 300ms | 300ms | 1.000x |
| hit-counts | cold | 6400ms | 5900ms | 0.922x |
| hit-counts | after-logical | 3800ms | 3600ms | 0.947x |
| running-start | cold | 1000ms | 800ms | 0.800x |
| running-start | after-logical | 0ms | 0ms | n/a (both 0) |

## Verdicts

- **numbered-rooms:** the #421 regression (1.176x cold) is gone -- 1.000x
  cold, 0.933x after-logical. Both inside 1.1x, neither reaches 0.9x, so the
  two-row ship rule still does not clear and `house_gac` stays unset for it
  (unchanged from #421's decision; not worth opting in on a board this fast
  either way).
- **outside-sudoku:** unchanged at 1.000x/1.000x -- board solves too fast for
  the per-call cost to register either way. `house_gac` stays unset.
- **hit-counts, running-start (already shipped):** both rows stay inside
  1.1x -- comfortably so, both improve slightly -- so the #421 ship decision
  holds under the faster filter. `PUZZLE_LINK.txt` regenerated for both
  (`build_size.py --rebuild 9` for hit-counts,
  `build_link.py`'s `build_from_template()` for running-start) so the shipped
  link carries the new component code.

## Driver output

Raw `just time` stdout for all eight rows above, verbatim, in run order.

```
$ just time numbered-rooms --ring-clues
uv run examples/_shared/time_example.py numbered-rooms --ring-clues
| 2026-09-13 | v2026.08.14-d47fc4b | numbered-rooms | 1800ms | — | — | BASELINE |
| 2026-09-13 | v2026.08.14-d47fc4b | numbered-rooms after-logical | 1500ms | — | — | BASELINE |

$ just time numbered-rooms --ring-clues --board PUZZLE_LINK_house_gac_candidate.txt
uv run examples/_shared/time_example.py numbered-rooms --ring-clues --board PUZZLE_LINK_house_gac_candidate.txt
| 2026-09-13 | v2026.08.14-d47fc4b | numbered-rooms (PUZZLE_LINK_house_gac_candidate.txt) | 1800ms | — | — | BASELINE |
| 2026-09-13 | v2026.08.14-d47fc4b | numbered-rooms (PUZZLE_LINK_house_gac_candidate.txt) after-logical | 1400ms | — | — | BASELINE |

$ just time outside-sudoku
uv run examples/_shared/time_example.py outside-sudoku
| 2026-09-13 | v2026.08.14-d47fc4b | outside-sudoku | 500ms | — | — | BASELINE |
| 2026-09-13 | v2026.08.14-d47fc4b | outside-sudoku after-logical | 300ms | — | — | BASELINE |

$ just time outside-sudoku --board PUZZLE_LINK_house_gac_candidate.txt
uv run examples/_shared/time_example.py outside-sudoku --board PUZZLE_LINK_house_gac_candidate.txt
| 2026-09-13 | v2026.08.14-d47fc4b | outside-sudoku (PUZZLE_LINK_house_gac_candidate.txt) | 500ms | — | — | BASELINE |
| 2026-09-13 | v2026.08.14-d47fc4b | outside-sudoku (PUZZLE_LINK_house_gac_candidate.txt) after-logical | 300ms | — | — | BASELINE |

$ just time hit-counts
uv run examples/_shared/time_example.py hit-counts
| 2026-09-13 | v2026.08.14-d47fc4b | hit-counts | 6400ms | — | — | BASELINE |
| 2026-09-13 | v2026.08.14-d47fc4b | hit-counts after-logical | 3800ms | — | — | BASELINE |

$ just time hit-counts --board PUZZLE_LINK_house_gac_candidate.txt
uv run examples/_shared/time_example.py hit-counts --board PUZZLE_LINK_house_gac_candidate.txt
| 2026-09-13 | v2026.08.14-d47fc4b | hit-counts (PUZZLE_LINK_house_gac_candidate.txt) | 5900ms | — | — | BASELINE |
| 2026-09-13 | v2026.08.14-d47fc4b | hit-counts (PUZZLE_LINK_house_gac_candidate.txt) after-logical | 3600ms | — | — | BASELINE |

$ just time running-start
uv run examples/_shared/time_example.py running-start
| 2026-09-13 | v2026.08.14-d47fc4b | running-start | 1000ms | — | — | BASELINE |
| 2026-09-13 | v2026.08.14-d47fc4b | running-start after-logical | 0ms | — | — | BASELINE |

$ just time running-start --board PUZZLE_LINK_house_gac_candidate.txt
uv run examples/_shared/time_example.py running-start --board PUZZLE_LINK_house_gac_candidate.txt
| 2026-09-13 | v2026.08.14-d47fc4b | running-start (PUZZLE_LINK_house_gac_candidate.txt) | 800ms | — | — | BASELINE |
| 2026-09-13 | v2026.08.14-d47fc4b | running-start (PUZZLE_LINK_house_gac_candidate.txt) after-logical | 0ms | — | — | BASELINE |
```

Every row above the driver actually ran (no fixture skipped); the scratch
`PUZZLE_LINK_house_gac_candidate.txt` files were deleted after this run
(not committed, per the #421 method), so re-verifying means re-splicing:
`docs/research/408-house-gac/house_gac_links.py`'s shape via
`framebuild.house_gac_constraint(9)` for numbered-rooms/outside-sudoku, and
`link_swap.swap_component_code` on the committed link's House GAC
constraint for hit-counts/running-start.

## Decision

No `Spec.house_gac` opt-in changes. hit-counts and running-start's committed
links are regenerated against the new `HouseGacComponent.js`; numbered-rooms
and outside-sudoku are untouched (they never shipped the filter, and still
don't clear the bar to opt in).
