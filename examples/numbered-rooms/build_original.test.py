# build_original.py --out: rebuilding into a temp directory must reproduce
# PUZZLE_LINK_original.txt byte-identically, and must leave the shipped link
# itself untouched.
#
#   uv run --with lzstring examples/numbered-rooms/build_original.test.py

import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE))

from build_original import build

if __name__ == "__main__":
    # read the shipped link before the rebuild runs, so the untouched check
    # below can't be satisfied by a build that (correctly or not) also wrote
    # to HERE
    shipped = (HERE / "PUZZLE_LINK_original.txt").read_bytes()

    with tempfile.TemporaryDirectory() as tmp:
        out_dir = pathlib.Path(tmp)
        build(out_dir)
        got = (out_dir / "PUZZLE_LINK_original.txt").read_bytes()
        assert got == shipped, (
            "PUZZLE_LINK_original.txt does not reproduce byte-identically"
        )

    # --out must not have touched the shipped file itself
    assert (HERE / "PUZZLE_LINK_original.txt").read_bytes() == shipped, (
        "PUZZLE_LINK_original.txt was touched by --out"
    )

    print("ok")
