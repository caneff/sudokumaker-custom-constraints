# build_original.py --out: rebuilding sizes 4, 6, 9 and 10 into a temp
# directory must reproduce the committed link pair byte-identically, and must
# leave the shipped links themselves untouched.

import json
import pathlib
import shutil
import sys
import tempfile
from dataclasses import replace

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / "_shared"))

from build_original import build
from build_size import SPEC
from untouched import leaves_untouched

SIZES = {
    4: ("PUZZLE_LINK_4x4.txt", "PUZZLE_LINK_4x4_original.txt"),
    6: ("PUZZLE_LINK_6x6.txt", "PUZZLE_LINK_6x6_original.txt"),
    9: ("PUZZLE_LINK.txt", "PUZZLE_LINK_original.txt"),
    10: ("PUZZLE_LINK_10x10.txt", "PUZZLE_LINK_10x10_original.txt"),
}


def refuses_planted_board():
    """A copy of the example whose 9x9 gen JSON has a given's digit moved
    must not rebuild: `Lane.rebuild`'s guard holds the grid to the committed
    link's."""
    with tempfile.TemporaryDirectory() as tmp:
        copy = pathlib.Path(tmp) / "skyscraper"
        shutil.copytree(HERE, copy)
        # The components #include the shared frame reader by relative path.
        (copy.parent / "_shared").symlink_to(HERE.parent / "_shared")
        gen = copy / "gen.json"
        g = json.loads(gen.read_text())
        r, c = map(int, next(iter(g["givens"])).split(","))
        g["grid"][r][c] = g["grid"][r][c] % 9 + 1
        gen.write_text(json.dumps(g))
        out = pathlib.Path(tmp) / "out"
        out.mkdir()
        try:
            build(9, out, spec=replace(SPEC, dir=copy))
        except AssertionError as e:
            assert "grid, givens, or shown clues changed" in str(e), e
        else:
            raise AssertionError("a planted board whose grid moved was rebuilt")
        assert not list(out.iterdir()), "a refused rebuild wrote a link"


if __name__ == "__main__":
    refuses_planted_board()
    links = [HERE / name for pair in SIZES.values() for name in pair]
    with leaves_untouched(links) as shipped, tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)
        for n, (improved_name, original_name) in SIZES.items():
            out_dir = tmp / str(n)
            out_dir.mkdir()
            build(n, out_dir)
            for name in (improved_name, original_name):
                got = (out_dir / name).read_bytes()
                assert got == shipped[HERE / name], (
                    f"n={n}: {name} does not reproduce byte-identically"
                )

    print("ok")
