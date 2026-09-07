# OR-Tools CP-SAT tuning notes (2026-09-07)

Question: can we speed up the CP-SAT solves the generators lean on (uniqueness
checks, sampling, strip loops) with a newer release or solver parameters?

## Release

`uv run --with ortools` resolves 9.15.6755 (PyPI, 2026-01-14), the newest
release available. No upgrade to take.

## Benchmark

Fillomino `unique()` shape (solve, forbid the grid on the cell vars, solve
again) on `examples/fillomino/gen.json`, 32-core box, 120 s cap per solve,
best of 3:

| config                              | wall     | note                                   |
|-------------------------------------|----------|----------------------------------------|
| num_workers=8 (current)             | 2.52 s   |                                        |
| num_workers=1                       | 4.98 s   |                                        |
| num_workers=16                      | 0.86 s   | 3x over current                        |
| workers=8, linearization_level=0    | 1.57 s   | rep spread 1.6–2.4 s, inside the noise  |
| workers=8, symmetry_level=0         | 1.65 s   | same                                   |
| workers=1, linearization_level=0    | 197 s    | both solves hit the cap: never do this |
| enumerate_all_solutions, stop at 2  | 1.33 s   | WRONG answer, see below                |

## Takeaways

- **Workers is the lever.** The fillomino/isofill models gain from the
  parallel portfolio; 8 -> 16 cut wall time 3x on this fixture. Keep the
  total across concurrent hunts under the core count.
- **Single-flag tweaks are noise.** `linearization_level=0` and
  `symmetry_level=0` looked 1.5x better on best-of-3 but the rep spread
  covers the gap. Not worth pinning.
- **`enumerate_all_solutions` is a trap for these models.** It disables
  presolve reductions and enumerates over every variable, so the region-id
  and flow bookkeeping vars produce a second "solution" with the same grid.
  It reported n=2 on a unique puzzle. Stay with forbid-on-cell-vars.
- **Strip loops can skip the first solve.** When `strip()` removes a given
  `p` with known value `v`, the full grid is already a solution. Ask CP-SAT
  for a grid with `x[p] != v` instead of "find any, then forbid it": one
  solve per clue instead of two, and no 81-literal disjunction. Applies to
  `examples/isofill/verify.py::strip` (fillomino strips in the app).
- **Source build with `-march=native`** is the only way to change the
  binary's own speed; PyPI wheels are generic x86-64. Typical gain is a few
  percent, not worth the build and the reproducibility loss.
