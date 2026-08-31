# Share checklist

What a puzzle link must satisfy before it goes to another person. The
audience is a solver who opens the link — they never see this repo, but they
do see the rules text and the component source embedded in the link blob.

**Free gate first:** `just check` passes clean — layout, soundness at zero
violations, never-weaker floor, lint, link grammar. The criteria below are
the part the gate does not test.

## 1. The link opens clean

Decode `PUZZLE_LINK.txt` and confirm every non-given cell is `{}` — no
solution digits, no hidden clues stored as entered values. A miss here ships
a board with the answer already typed in.

## 2. Uniqueness is proven on the shipped board

`verify.py` ran on the exact `gen.json` behind the shipped link — not an
earlier variant — and the README records the run. `just test` skips
`verify.py`, so a stale board can carry a stale proof.

## 3. Rules text stands alone

A solver with no repo context can solve from the rules text alone: state the
custom rule the way a solver reads it, with no repo jargon and no component
names. It starts with "Normal sudoku rules apply on the inner grid" — except
isofill, which is not sudoku and skips the line.

## 4. The clue set is curated

The ring stays mostly blank unless you chose otherwise. The givens count is
sane for the size.

## 5. The shipped component reads well

The recipient can read the source inside the link, so it carries:

- one top-level comment with a brief overview of the design, and
- at most one short comment per step of the algorithm — helpful, not a
  restatement of the code.

`CODING_STANDARDS.md` already bans history comments; this criterion is about
the overview and step comments being *present*.

## Future automation

Criteria 1 and 3 are mechanical: fold the decode check and the rules-prefix
check (with an isofill-style exemption list) into
`examples/_shared/check_layout.py`, and they become part of the free gate.
Criteria 2, 4, and 5 need judgment and stay a checklist.
