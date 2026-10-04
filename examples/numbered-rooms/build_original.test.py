import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE))

from build_original import build

if __name__ == "__main__":
    # read the shipped link before the rebuild runs, so a build that also
    # wrote to HERE cannot satisfy the untouched check below
    shipped = (HERE / "PUZZLE_LINK_original.txt").read_bytes()

    with tempfile.TemporaryDirectory() as tmp:
        out_dir = pathlib.Path(tmp)
        build(out_dir)
        got = (out_dir / "PUZZLE_LINK_original.txt").read_bytes()
        assert got == shipped, (
            "PUZZLE_LINK_original.txt does not reproduce byte-identically"
        )

    assert (HERE / "PUZZLE_LINK_original.txt").read_bytes() == shipped, (
        "PUZZLE_LINK_original.txt was touched by --out"
    )

    print("ok")
