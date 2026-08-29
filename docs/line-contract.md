# The line contract

What an outside-clue component may assume about its line, how it learns the
rest from the app, and how the local and global variants of one example share
code. Decided on the map issue #187, ticket #191. Terms are in `CONTEXT.md`.

## Line kinds

A line is one of three kinds, ordered. A rule that needs one kind also fires on
every kind above it.

| Kind | Digits may | Learned from |
|-|-|-|
| **bare** | repeat, be absent, any length | nothing — the default |
| **house** | not repeat | `!puzzle.getCellsCanHaveRepeats(line)` |
| **full house** | not repeat, and every digit the line can hold is present once | house and the union of live candidates across the line has exactly `line.length` digits |

"Clued at both ends" is not a kind. It is a **pair** shape, owned by the global
main code (below).

## What a component may assume

- Nothing about the line's digits beyond its kind.
- The group order: `cells[0]` is the clue, the rest is the line nearest the
  clue first (gotcha 3).
- The digit range comes from `helpers.digits.minDigit` / `maxDigit`, never
  1–9. `puzzle.spec.digitCount` is the digit count.
- A one-cell line reads as a house (the app says so; no special case).
- A rule that needs the line's digit set to be `{1..n}` (hit-counts n-1,
  side sum) checks that set itself; full house alone does not promise it.

## How a component gates

- **Ask in `update`, never in main code.** `getCellsCanHaveRepeats` walks the
  exclusion groups registered so far; main code runs at register time and can
  miss the built-in houses, `update` runs at solve time and sees them all
  (gotcha 6, verified #189).
- **Query the line only**, never clue + line: a ring cell in the list flips the
  answer to `true`.
- **Cache on the instance.** Each `update` re-tests `instance.kind` until it
  reaches full house, then later calls read it. (A length test against
  `digitCount` does not work: hit-counts boards run `minDigit 0` for the clue
  ring and a cage removes 0 from the inner grid during solving, so the line's
  digit set only settles after the first `update`. Decided #193.) The app rebuilds every component on every edit, so a redrawn
  group gets a fresh instance and a fresh answer. Never cache in a file-level
  variable.
- **One component, gated rules.** Each rule starts with its gate
  (`if (instance.kind < HOUSE) …`). No per-kind component files, no
  `replaceComponent` swap (built-in targets only, gotcha).

## Ties

`const ALLOW_TIES = false` at the top of each component file that compares
digits along the line (running-start descent, skyscraper "taller"). Strict is
the default; the author flips the constant in the segment. No author input.
Expect the loose mode to prune less (precedent: ISS `FullRank.TIE_MODE`,
`docs/research/190-one-sided-clues-ties-non-house-lines.md` §7).

## Local and global variants

Each example ships two puzzle links from one component set:

- **local** — `main.js`: the author draws groups; it registers one **line
  component** per group, one end only, no assumption about the line.
- **global** — `main-global.js`: no groups; it builds every frame line from
  the grid and registers the line component on each, plus the global-only
  components.

Two files, no "groups present?" switch in one file (#194): each paste carries
only its own variant, and a layout check can hold `main.js` off frame building
and `main-global.js` off `input.groups`.

Components, and who registers them:

| Component | Sees | Local | Global |
|-|-|-|-|
| line component | one clue, one line | yes | yes |
| pair component | both clues of one line | — | yes |
| side component | every clue on one side | — | yes |
| frame component | every clue and line at once | — | slot only |

The line component is byte-identical in both variants. The frame component is
a named slot: an example fills it only with a deduction that clears the timing
bar (`docs/real-app-timing.md`).

Skyscraper's local variant ships with the running cap only (sound on a bare
line); the peak rule gates on full house; a one-sided DP is a later strength
ticket.

## Harness

`harness-lib.mjs` adds `getCellsCanHaveRepeats(cells)` and `spec.digitCount`
to the mock, answered from the case's kind. One shared `makeLine(kind, n)`
builds a bare line (random digits, any length), a house (distinct digits,
`n < digitCount`), or a full house (a permutation). Every example's soundness
harness fuzzes all three kinds.
