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


def main():
    bad = 0
    for f in sorted(ROOT.glob("*/PUZZLE_LINK*.txt")):
        if EXEMPT in f.name:
            continue
        cells = decode_puzzle(f.read_text().strip())["puzzle"]["cells"]
        entered = [c for c in cells if "value" in c and not c.get("given")]
        if entered:
            bad += 1
            print(f"FAIL {f.relative_to(ROOT.parent)}: {len(entered)} entered values")
    print(f"{'FAILED' if bad else 'ok'} — {bad} link(s) ship entered values")
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
