# build_required_digits.py --out: rebuilding into a temp directory must
# reproduce both shipped links (docs/research/required-digits-gac/) byte-
# identically, and must leave the shipped files themselves untouched.
#
#   uv run examples/outside-sudoku/build_required_digits.test.py

import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE))

from build_required_digits import RESEARCH_DIR, build

NAMES = ["PUZZLE_LINK_required_digits.txt", "PUZZLE_LINK_required_digits_original.txt"]

if __name__ == "__main__":
    # read the shipped links, and their mtimes, before the rebuild runs.
    # Content alone can't witness "untouched": a rebuild that (incorrectly)
    # also writes RESEARCH_DIR reproduces byte-identical content by
    # construction, so only the mtime moving would show it.
    shipped = {name: (RESEARCH_DIR / name).read_bytes() for name in NAMES}
    shipped_mtime = {name: (RESEARCH_DIR / name).stat().st_mtime_ns for name in NAMES}

    with tempfile.TemporaryDirectory() as tmp:
        out_dir = pathlib.Path(tmp)
        build(out_dir)
        for name in NAMES:
            got = (out_dir / name).read_bytes()
            assert got == shipped[name], f"{name} does not reproduce byte-identically"

    # --out must not have touched the shipped files themselves
    for name in NAMES:
        assert (RESEARCH_DIR / name).stat().st_mtime_ns == shipped_mtime[name], (
            f"{name} was touched by --out"
        )

    print("ok")
