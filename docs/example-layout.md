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
| `main-global.js` | The definition for the **global** link (paste target); builds frame lines from the grid, registers the line component plus the global-only components. Never reads `input.groups` (#194). It does not build the frame itself: it splices in the one shared reader (below) |
| `*Component.js` (at least one) | The pasted constraint snippet(s). One example, `house-gac`, ships none of its own: its one component lives in `examples/_shared/` on purpose, shared with every other board that registers the same filter, and `check_layout.py`'s `SHARED_COMPONENT` names it there instead of demanding a local copy that could drift |
| `build_link.py` | Builds `PUZZLE_LINK.txt` (and variants) from a generated board |
| `build_link.test.py` | Tests `build_link.py` |
| `soundness-harness.mjs` | The soundness fuzz — zero removed true candidates |
| `update-strength.test.mjs` | Never-weaker fuzz through `harness-lib.strengthSweep`; floor pinned at the commit that adds it, or frozen as a committed copy when the floor lands in the same squash-merged PR as the component (up-to-n's `.golden/UpToNComponent.floor.js`) |
| `OPTIMIZATION_LOG.md` | Table of speed attempts, kept or rejected, with why |
| `PUZZLE_LINK.txt` | The shipped board — the one link a reader opens |
| `PUZZLE_LINK_local.txt` | The local-lane board |
| `gen_local.json` | The board data behind `PUZZLE_LINK_local.txt` |

`main-global.js`, `PUZZLE_LINK_local.txt` and `gen_local.json` are required on
every example except one with no local/global duality: `isofill` and
`fillomino` (whole-grid constraints, no drawn groups at all) and `house-gac`
(a fixed-geometry filter over every row, column and box — no drawn group to
split a local lane from either, for a different reason) each ship `main.js`
alone, and so does `up-to-n`, which draws groups but has no global lane: its
clues are typed into them, so a board with no groups has none. Its
`PUZZLE_LINK.txt` is a drawn-groups board. `examples/_shared/check_layout.py`
holds this list as `NO_LOCAL_GLOBAL_SPLIT`.

## Which lane a link runs (#268)

Every split example says the same thing by the same file names:

- **`PUZZLE_LINK.txt` runs the global lane** — `main-global.js`, no drawn
  groups, the backend builds the lines itself. It is the board a reader opens
  and the board the gate timing row is measured on.
- **`PUZZLE_LINK_local.txt` runs the local lane** — `main.js`, one drawn group
  per line, recorded in `gen_local.json`.

There is no `global` tag: the bare name already means the global lane, so a
`PUZZLE_LINK_global.txt` names nothing and `check_layout.py` rejects it.

Which lines the local board draws is the example's own call. A rule that holds
on any line ships **bent paths**, so the bare-line rules have a board to play
(`build_size.py --paths`). A rule that needs a straight line — outside-sudoku's
window is a box extent along the line's direction, and a bent path has no
direction — ships the frame lines drawn instead, and its README says why.

## One rule, one example

A rule gets one example directory, with the local and global variants above.
A second directory for the same rule drifts from the first: `numbered-rooms`
and `numbered-rooms-lines` grew two components for one rule, and only one of
them was sound on a drawn line. `check_layout.py` holds the folded-away names
as `MERGED_AWAY` and fails if such a directory comes back (#238).

## Optional files

Run when present, skipped with a note when absent:

| File | Notes |
| --- | --- |
| `.golden/` | Regression goldens for the recovery/speed probes |
| `recovery-probe.mjs` (+ test) | Recovery probe and its test |
| `build_size.py` | Builds boards at other sizes, and re-encodes a committed one with `--rebuild <n>` — current component code, no fresh CP-SAT search (`framebuild.main`) |
| `verify.py` | Uniqueness proof (CP-SAT). Never auto-discovered — wire it in yourself or leave it out: skyscraper's is a few sub-second solves and is named in the `test` recipe, isofill's searches for minutes and waits for `just verify-isofill`, outside-sudoku's is slow and is run by hand from its README |
| any other `*.test.mjs` / `*.test.py` | Picked up by `just test`, no justfile edit needed. A test named in the justfile's `heavy` list runs under `just test-heavy` instead, so only `check-full` runs it |

## Link grammar

```
PUZZLE_LINK[_<size>][_<givens>g][_<tag>]*.txt
```

- `<size>` is `NxN` (e.g. `6x6`).
- `<givens>g` is a given count, e.g. `30g`.
- `<tag>` is zero or more of `clued`, `original`, `silent`, `local`,
  `annotated`, and present tags must chain in that fixed order —
  `PUZZLE_LINK_clued_original.txt` is valid, `PUZZLE_LINK_original_clued.txt`
  is not.
- Parts join with `_`. No hyphens, no seeds, no other free text.
- Links stay flat in the example dir — no `links/` subdir.
- A link file holds one URL and nothing else. Seed, date, and solve time go
  in the README or `OPTIMIZATION_LOG.md`, not the filename.

Examples: `PUZZLE_LINK.txt`, `PUZZLE_LINK_6x6.txt`, `PUZZLE_LINK_clued.txt`,
`PUZZLE_LINK_6x6_original.txt`, `PUZZLE_LINK_30g.txt`,
`PUZZLE_LINK_35g_silent.txt`, `PUZZLE_LINK_clued_original.txt`,
`PUZZLE_LINK_local.txt`, `PUZZLE_LINK_annotated.txt`.

`annotated`, like `clued` and `original`, names a hand-built twin of another
committed link's board rather than its own fresh CP-SAT search — see
`NO_GENERATOR_TAGS` in `check_layout.py`, and `examples/house-gac/README.md`
for the one link that carries it today: same board and givens as
`PUZZLE_LINK.txt`, its embedded code kept uncompressed (comments in,
blank lines out) for a reader inside the app's own code box.

`PUZZLE_LINK.txt` is the **shipped link** — the one a reader opens. Any other
`PUZZLE_LINK_*.txt` is a **variant link**.

`check_layout.py` decodes every `PUZZLE_LINK*.txt` too (`uv run --with
lzstring`, for the `lzstring` codec dependency) and gates the two mechanical
pre-share criteria: the link opens clean (no entered values on non-given
cells — except a `_clued` link, which fills the outside-clue ring on
purpose) and the comment starts with "Normal sudoku rules apply on the
inner grid" — except an example in `NO_RULES_PREFIX` (isofill and fillomino
are not sudoku, and their rules text must not mention sudoku), and a no-ring
board (below) or an example in `RINGLESS_SUDOKU` (house-gac's plain 9x9),
whose comment starts "Normal sudoku rules apply." instead. See
`docs/share-checklist.md` for the full pre-share list.

The **name** grammar above binds `PUZZLE_LINK*.txt` only, but the share
criteria bind every committed link: a `.txt` beside an example whose text
starts with `https://sudokumaker.app/?puzzle=` is decoded and checked too,
whatever it is called. That covers fillomino's 19 frozen fixture triples and
its hunt records — 50 links that used to sit outside the glob. A `.txt` that
is not a link (a golden, a note) is left alone.

It also checks each link's component set against the backend embedded in
that same link: a link ships exactly the components its backend registers.
The builder asserts this when it writes a link (`framebuild.check`), but a
committed link goes stale on its own — the builder's list changes and the
link is never regenerated (#287, #289, #290, #291). Regenerate the stale
link from its committed `gen_*.json` with the example's
`build_size.py --rebuild <n>`.

The frame's own two shared backends (`_shared/frame-rowcol.js`,
`_shared/frame-corners.js`) go stale the same way, and every framebuilt link
carries a copy of both: a real change to either means rebuilding all of them in
that commit. `check_frame_backends` compares each embedded copy against the
file in the tree and names the stale one; `check_houses` steps aside for a link
that carries the row/column backend, rather than counting missing rows at it.
Both backends need this sweep, and `frame-corners.js` needs it most: it
registers a built-in `PredefinedCandidatesComponent`, so its constraint ships no
component file and the component check above has no set to compare it against.

## When a board has to be a `"custom"` document

The outer ring is what needs it. A board with clue cells outside the grid needs
a `"custom"` document: the app validates a sudoku document's regions and sizes,
and a ring is neither. **A plain 9x9 does not need one** (owner ruling,
2026-09-19). Custom constraints and their component code register on a
`"sudoku"` document too -- the solver's handler for them
(`registerConstraintHandler(ConstraintType.Custom, ...)`) has no puzzle-kind
check.

Two things a plain 9x9 pays for choosing `"custom"` anyway:

- **Rows and columns stop being free.** `SudokuRules` is prepended only for
  `spec.type === Sudoku` (`bundle.claude.js:11455`), so the board has to carry
  a row/column backend of its own, plus the `RESEARCH_ROWCOL_BACKENDS`
  exemption below that lets a static decode see through it.
- **The technique set narrows.** A sudoku document gets
  `StandardLogicStepsGenerator`; a custom one gets `CustomLogicStepsGenerator`,
  which filters to `CustomPuzzleEnabledStepTypes`. A timing or AutoStep row
  taken on a custom board is therefore taken against a restricted set of
  techniques, which is worth saying out loud when the row is the evidence.

A **no-ring** board (`framebuild.no_ring_doc`, up-to-n's) is a bare n x n
`"custom"` document with no clue ring, and its shared backend is
`_shared/grid-rowcol.js`, which declares every whole row and column. A link
carrying it is what `check_layout.py` treats as no-ring: `check_frame_backends`
checks its copy for staleness and its digit range the same way, `check_houses`
steps aside for it, the filled-ring check does not apply (its edge cells are
the puzzle), and its comment opens with the no-ring sentence above. The live
editor opens a `"sudoku"` document as 9x9 whatever its width says, which is
why the header is not used (`docs/research/368-up-to-n-setup-throw.md`).

`check_houses` steps aside the same way for house-gac's board, which carries
docs/research/406-gac-demo's own non-frame "Rows & Columns" backend instead —
it declares its houses in a `postprocessJSON` function too, the same blind
spot a static decode has for the frame's backend. house-gac does not own or
rebuild that backend, so there is no `check_frame_backends`-style staleness
check for it; `check_layout.py`'s `RESEARCH_ROWCOL_BACKENDS` names the one
constraint, scoped to that one example, that `declares_rows_and_columns_in_js`
recognizes.

The same check requires a frame link to declare `minDigit`/`maxDigit`. The app
defaults a custom puzzle to 1..9 whatever the grid size (#461), and both
backends read `helpers.digits`: an undeclared range rests on that default. A
range that does not span the interior line makes every row and column silently
degrade from a named `HouseComponent` to a plain `DifferentDigitsComponent`,
and the corner pin lands on the wrong digit, so the check compares `maxDigit - minDigit + 1` against the interior line length
rather than only asking that both fields are there. `hit-counts` is the one
example exempt: it runs `minDigit: 0` so a clue can read 0 and keeps 0 out of
the interior with a look-and-say cage, so its lines are all-different by
design.

A `gen*.json` records the board, not the frame backends' code — those come from
the tree at build time (`framebuild.refresh_frame_backends`), so a copy kept in
a template is dead data that can only drift. `check_gen_frame_backends` requires
the field to be empty.

Two frame boards have no `gen_*.json` and so no `--rebuild`:
`running-start/PUZZLE_LINK.txt`, rebuilt whole by its own `build_link.py` with
no arguments, and `numbered-rooms/PUZZLE_LINK.txt`, which is hand-built and
takes `build_link.py --refresh` (that also pins its digit range and rewrites its
rules text — nothing else writes either; both values belong to that one board,
so `--refresh` rewrites it alone and refuses `--board`). Both go through
`framebuild.refresh_frame_backends`. numbered-rooms has three more hand-built
links derived from `PUZZLE_LINK.txt`, so `build_original.py` and
`build_clued.py` run after the refresh. After such a rebuild, re-check every link
in the live app and record what it said:
`docs/frame-link-verdicts.md` holds that sweep.

## Board naming

- `gen.json` — the shipped board.
- `gen_<token>.json` — a variant board, `<token>` equal to the paired link's
  own suffix (everything after `PUZZLE_LINK`): a size (`gen_6x6.json` pairs
  with `PUZZLE_LINK_6x6.txt`), a givens count (`gen_30g.json` pairs with
  `PUZZLE_LINK_30g.txt`), or a size/givens/tag combination
  (`gen_35g_silent.json` pairs with `PUZZLE_LINK_35g_silent.txt`).
- A generator may keep extra input files; they are inputs, not "the board."
- On the shared interactive-outside frame that pairing is stated once in code:
  `framebuild.board_files(spec, n, local)`. The 9x9 is plain-named on both
  lanes (`PUZZLE_LINK.txt` / `PUZZLE_LINK_local.txt`), every other size carries
  its `NxN` tag, and an example whose `PUZZLE_LINK.txt` is some other,
  hand-built board says so with `Spec.plain_global_9x9 = False`. A no-ring
  example has only the drawn-groups lane, so its names carry no lane tag: its
  9x9 is `PUZZLE_LINK.txt` and every other size `PUZZLE_LINK_<n>x<n>.txt`. A
  second board of one size takes a size tag on its own and is rebuilt through
  `framebuild.rebuild(..., files=...)` (up-to-n's `PUZZLE_LINK_9x9.txt`).
- The pairing runs both ways where a link is generated: `check_layout.py`
  flags a `gen*.json` with no matching link, and a link with no matching
  `gen*.json`, same as above. Three kinds of link are exempt from needing one
  back: a `_clued`/`_original` twin (`build_clued.py`/`build_original.py`
  re-encode an already-generated board with different wrapper code or extra
  clues, never their own fresh gen JSON), numbered-rooms' hand-made
  `PUZZLE_LINK.txt`, which its own README says no generator produces at all,
  and house-gac's `PUZZLE_LINK.txt`, whose board and givens come from another
  committed link (`docs/research/406-gac-demo/PUZZLE_LINK_without_gac.txt`),
  re-proved unique with CP-SAT rather than generated from a `gen*.json` this
  example owns. `check_layout.py` holds these last two by `(example, link
  name)` pair as `NO_GENERATOR_LINKS`.

## The `original/` baseline

Baseline code and links for `just time` comparisons live under an
`original/` subdir, which mirrors the example's own layout for the baseline
component. `_original` links pair with it. Keep an `original/` baseline only
where `just time` actually compares against it — not as a general changelog.

## The shared frame reader, and `#include`

Every `main-global.js` reads the same frame off the board, so it is written
once, in `examples/_shared/frame-lines.js`, and spliced into each paste target
by a directive line:

```
// #include ../_shared/frame-lines.js
```

The included file is a **paste segment**, not a module: plain function
declarations, no `import`/`export`, because the app runs the assembled text as
a bare script. It declares `frameLines(puzzle)` — every clued line as
`{ side, clue, line }`, the line read inward from its clue — and
`framePairs(lines)` — the opposite-end pairs, L with R and T with B, by
construction rather than by a scan for one line that is another reversed.
`framePairs` takes the whole `frameLines` list, in its order, and refuses
anything else: a filtered or odd-length list would otherwise pair two clues on
the same side, or the last entry with `undefined`.

The splice happens wherever the source is turned into something that runs:
`minify_js` / `minify_file` (`examples/_shared/minify.py`) for the link a
builder writes, and `assembleSource` (`examples/_shared/include.mjs`) for the
Node tests, harnesses and probes. A path resolves against the including file's
own directory; a missing file, a cycle, or a directive naming no path stops the
build. `loadAt` in `harness-lib.mjs` is the one reader that cannot splice --
it holds a file's text at a git commit, with no directory to resolve against --
so it refuses a source carrying a directive rather than eval it as a comment.

Because a paste target's body can arrive through a directive, anything that
judges what a file does reads the ASSEMBLED text, not the raw file:
`check_layout.check_lanes` minifies both paste targets before looking for
`getCellAt(` and `input.groups`, and `time_example.resolve_backend_file` builds
its ground truth from a checkout of git HEAD so an edited include cannot leak
into it.

## Extension rule

- `.js` — a snippet pasted into SudokuMaker. Harnesses and tests load it by
  reading the file and `eval`-ing it; it never runs directly under Node.
- `.mjs` — Node tooling: harnesses, probes, tests.
