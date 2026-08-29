# Every committed puzzle link must be share-ready: a cell holds a value only
# when it is a given. A non-given value ships as an entered digit, so the
# recipient opens a board with the solution and the hidden clues already typed
# in. The bug has landed three times now (framebuild, isofill, the running-start
# template), so the gate checks the shipped links, not just the builders.
#
#   uv run --with lzstring examples/_shared/check_links.py

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from link_codec import decode_puzzle

ROOT = pathlib.Path(__file__).parent.parent

# The clued twins fill all 36 outside clues on purpose — that is what the name
# means, and app-solve.mjs reads them with --ring-clues.
EXEMPT = "_clued"

# Must match framebuild.RULES_PREFIX. Duplicated (not imported) so this check
# does not pull in ortools — framebuild.py imports it at module load, and
# check_links.py runs with just `--with lzstring`.
RULES_PREFIX = "Normal sudoku rules apply on the inner grid. "


def main():
    bad = 0
    for f in sorted(ROOT.glob("*/PUZZLE_LINK*.txt")):
        puzzle = decode_puzzle(f.read_text().strip())["puzzle"]
        rel = str(f.relative_to(ROOT.parent))
        # The clued twins fill all 36 outside clues on purpose — that is what
        # the name means, and app-solve.mjs reads them with --ring-clues. The
        # entered-values check does not apply to them; the prefix check still
        # does.
        if EXEMPT not in f.name:
            cells = puzzle["cells"]
            entered = [c for c in cells if "value" in c and not c.get("given")]
            if entered:
                bad += 1
                print(f"FAIL {rel}: {len(entered)} entered values")
        if not puzzle.get("comment", "").startswith(RULES_PREFIX):
            bad += 1
            print(f"FAIL {rel}: comment missing rules prefix")
    print(f"{'FAILED' if bad else 'ok'} — {bad} link problem(s)")
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
