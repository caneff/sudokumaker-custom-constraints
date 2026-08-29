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

# Links built before RULES_PREFIX existed and not yet regenerated. Tracked in
# #217 — remove an entry here only after regenerating that link and
# confirming its comment now carries the prefix. Do not add new entries.
#
# The three numbered-rooms sized links (4x4/6x6/9x9) stay: regenerating them
# with the current build_size.py embeds the current main.js backend (grown
# from 448 to 1098 chars since commit f93e9fd added local/global mode) instead
# of the one the shipped link carries — more than the comment would change, so
# they were left as-is. Fixing them needs a rebuild-from-frame path like
# skyscraper's build_original.py (re-encode from gen_<n>x<n>.json without a
# fresh CP-SAT search), which numbered-rooms does not have yet.
PREFIX_DEBT = {
    "examples/numbered-rooms/PUZZLE_LINK_4x4.txt",
    "examples/numbered-rooms/PUZZLE_LINK_6x6.txt",
    "examples/numbered-rooms/PUZZLE_LINK_9x9.txt",
}


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
        if rel not in PREFIX_DEBT and not puzzle.get("comment", "").startswith(
            RULES_PREFIX
        ):
            bad += 1
            print(f"FAIL {rel}: comment missing rules prefix")
    print(f"{'FAILED' if bad else 'ok'} — {bad} link problem(s)")
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
