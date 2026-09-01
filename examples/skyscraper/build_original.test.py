# build_original.py --out: rebuilding sizes 4, 6, 9 and 10 into a temp
# directory must reproduce the committed link pair byte-identically, and must
# leave the shipped links themselves untouched.
#
#   uv run --with lzstring examples/skyscraper/build_original.test.py

import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE))

from build_original import build

SIZES = {
    4: ("PUZZLE_LINK_4x4.txt", "PUZZLE_LINK_4x4_original.txt"),
    6: ("PUZZLE_LINK_6x6.txt", "PUZZLE_LINK_6x6_original.txt"),
    9: ("PUZZLE_LINK.txt", "PUZZLE_LINK_original.txt"),
    10: ("PUZZLE_LINK_10x10.txt", "PUZZLE_LINK_10x10_original.txt"),
}

if __name__ == "__main__":
    # read the shipped links before any rebuild runs, so the untouched check
    # below can't be satisfied by a build that (correctly or not) also wrote
    # to HERE
    shipped = {
        name: (HERE / name).read_bytes() for pair in SIZES.values() for name in pair
    }

    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)
        for n, (improved_name, original_name) in SIZES.items():
            out_dir = tmp / str(n)
            out_dir.mkdir()
            build(n, out_dir)
            for name in (improved_name, original_name):
                got = (out_dir / name).read_bytes()
                assert got == shipped[name], (
                    f"n={n}: {name} does not reproduce byte-identically"
                )

    # --out must not have touched the shipped files themselves
    for name, before in shipped.items():
        assert (HERE / name).read_bytes() == before, f"{name} was touched by --out"

    print("ok")
