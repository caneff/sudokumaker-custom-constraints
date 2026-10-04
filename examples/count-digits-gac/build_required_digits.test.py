import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE))

from build_required_digits import BOARD_DIR, build

NAMES = ["PUZZLE_LINK_required_digits.txt", "PUZZLE_LINK_required_digits_original.txt"]

if __name__ == "__main__":
    # Content alone can't witness "untouched": a rebuild that also wrote
    # BOARD_DIR would reproduce identical bytes, so only the mtime shows it.
    shipped = {name: (BOARD_DIR / name).read_bytes() for name in NAMES}
    shipped_mtime = {name: (BOARD_DIR / name).stat().st_mtime_ns for name in NAMES}

    with tempfile.TemporaryDirectory() as tmp:
        out_dir = pathlib.Path(tmp)
        build(out_dir)
        for name in NAMES:
            got = (out_dir / name).read_bytes()
            assert got == shipped[name], f"{name} does not reproduce byte-identically"

    for name in NAMES:
        assert (BOARD_DIR / name).stat().st_mtime_ns == shipped_mtime[name], (
            f"{name} was touched by --out"
        )

    print("ok")
