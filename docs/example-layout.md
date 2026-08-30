# Example layout

Every example lives in its own dir under `examples/` (`_shared/` is not an
example). `examples/_shared/check_layout.py` walks `examples/*/`, skips
`_shared`, and checks every example against this page. `just check` runs it,
so a missing required file or a bad link name fails the gate.

## Required files

| File | Holds |
| --- | --- |
| `README.md` | What the example builds, how to regenerate it, the `## Timing` row |
| `main.js` | The SudokuMaker constraint definition for the **local** link (paste target); registers the line component per drawn group |
| `main-global.js` | The definition for the **global** link (paste target); builds frame lines from the grid, registers the line component plus the global-only components. Never reads `input.groups` (#194) |
| `*Component.js` (at least one) | The pasted constraint snippet(s) |
| `build_link.py` | Builds `PUZZLE_LINK.txt` (and variants) from a generated board |
| `build_link.test.py` | Tests `build_link.py` |
| `soundness-harness.mjs` | The soundness fuzz — zero removed true candidates |
| `update-strength.test.mjs` | Never-weaker fuzz; floor pinned at the commit that adds it |
| `OPTIMIZATION_LOG.md` | Table of speed attempts, kept or rejected, with why |
| `PUZZLE_LINK.txt` | The shipped board — the one link a reader opens |

`main-global.js` is required on every example except one with no local/global
duality: `isofill` (a whole-grid constraint, no drawn groups at all) and
`numbered-rooms-lines` (a single, drawn-only variant pending its fold into
`numbered-rooms`) ship `main.js` alone. `examples/_shared/check_layout.py`
holds this list as `NO_LOCAL_GLOBAL_SPLIT`.

## Optional files

Run when present, skipped with a note when absent:

| File | Notes |
| --- | --- |
| `.golden/` | Regression goldens for the recovery/speed probes |
| `recovery-probe.mjs` (+ test) | Recovery probe and its test |
| `build_size.py` | Builds boards at other sizes |
| `verify.py` | Uniqueness proof (slow CP-SAT); not run by `just test`, only by hand via `just verify-isofill` or the example's own recipe |
| any other `*.test.mjs` / `*.test.py` | Picked up by `just test`, no justfile edit needed |

## Link grammar

```
PUZZLE_LINK[_<size>][_<givens>g][_<tag>]*.txt
```

- `<size>` is `NxN` (e.g. `6x6`).
- `<givens>g` is a given count, e.g. `30g`.
- `<tag>` is zero or more of `clued`, `original`, `silent`, `local`,
  `global`, and
  present tags must chain in that fixed order — `PUZZLE_LINK_clued_original.txt`
  is valid, `PUZZLE_LINK_original_clued.txt` is not.
- Parts join with `_`. No hyphens, no seeds, no other free text.
- Links stay flat in the example dir — no `links/` subdir.
- A link file holds one URL and nothing else. Seed, date, and solve time go
  in the README or `OPTIMIZATION_LOG.md`, not the filename.

Examples: `PUZZLE_LINK.txt`, `PUZZLE_LINK_6x6.txt`, `PUZZLE_LINK_clued.txt`,
`PUZZLE_LINK_6x6_original.txt`, `PUZZLE_LINK_30g.txt`,
`PUZZLE_LINK_35g_silent.txt`, `PUZZLE_LINK_clued_original.txt`,
`PUZZLE_LINK_local.txt`.

`PUZZLE_LINK.txt` is the **shipped link** — the one a reader opens. Any other
`PUZZLE_LINK_*.txt` is a **variant link**.

## Board naming

- `gen.json` — the shipped board.
- `gen_<token>.json` — a variant board, `<token>` equal to the paired link's
  own suffix (everything after `PUZZLE_LINK`): a size (`gen_6x6.json` pairs
  with `PUZZLE_LINK_6x6.txt`), a givens count (`gen_30g.json` pairs with
  `PUZZLE_LINK_30g.txt`), or a size/givens/tag combination
  (`gen_35g_silent.json` pairs with `PUZZLE_LINK_35g_silent.txt`).
- A generator may keep extra input files; they are inputs, not "the board."

## The `original/` baseline

Baseline code and links for `just time` comparisons live under an
`original/` subdir, which mirrors the example's own layout for the baseline
component. `_original` links pair with it. Keep an `original/` baseline only
where `just time` actually compares against it — not as a general changelog.

## Extension rule

- `.js` — a snippet pasted into SudokuMaker. Harnesses and tests load it by
  reading the file and `eval`-ing it; it never runs directly under Node.
- `.mjs` — Node tooling: harnesses, probes, tests.
