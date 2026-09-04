# Share checklist

What a puzzle link must satisfy before it goes to another person. The
audience is a solver who opens the link — they never see this repo, but they
do see the rules text and the component source embedded in the link blob.

**Free gate first:** `just check` passes clean — layout, soundness at zero
violations, never-weaker floor, lint, link grammar, and the two checks below.
The criteria after them are the part the gate does not test.

`examples/_shared/check_layout.py` decodes every committed link in an example
— the shipped `PUZZLE_LINK*.txt` boards and any other link `.txt` beside them
(fillomino's frozen timing fixtures and hunt records), sniffed by content — and
checks:

- **The link opens clean.** Every non-given cell is `{}` — no solution
  digits, no hidden clues stored as entered values. A miss here ships a
  board with the answer already typed in.
- **The ring is not filled end to end.** A board whose every outer-ring cell
  holds something hands the solver every outside clue. A `_clued` link is
  exempt — filling them all is what that name means. This is criterion 3's
  mechanical floor, not the whole of it.
- **Rules text carries the sudoku prefix.** The comment starts with "Normal
  sudoku rules apply on the inner grid" — except isofill, which is not
  sudoku and skips the line.

## 1. Uniqueness is proven on the shipped board

`verify.py` ran on the exact `gen.json` behind the shipped link — not an
earlier variant — and the README records the run. `just test` skips
`verify.py`, so a stale board can carry a stale proof.

## 2. Rules text stands alone

A solver with no repo context can solve from the rules text alone: state the
custom rule the way a solver reads it, with no repo jargon and no component
names. (The gate above already checks the opening sentence; this is about
the rest of the text.)

## 3. The clue set is curated

The ring stays mostly blank unless you chose otherwise — the gate above only
catches a ring filled *completely*, so a ring at 39 of 40 still needs your
eye. The givens count is sane for the size. On a board whose shown clues are
carved to CP-SAT
minimality — drop any one and the solution stops being unique — "mostly blank"
means "no unnecessary clue": read the criterion against the recorded carve,
not against a target count.

## 4. The shipped component reads well

The recipient can read the source inside the link, so it carries:

- one top-level comment with a brief overview of the design, and
- at most one short comment per step of the algorithm — helpful, not a
  restatement of the code.

`CODING_STANDARDS.md` already bans history comments; this criterion is about
the overview and step comments being *present*.
