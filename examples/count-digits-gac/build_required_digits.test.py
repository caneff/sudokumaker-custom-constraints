import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE))

from build_required_digits import BOARD_DIR, build
from untouched import leaves_untouched

NAMES = ["PUZZLE_LINK.txt", "PUZZLE_LINK_original.txt"]

if __name__ == "__main__":
    with (
        leaves_untouched([BOARD_DIR / name for name in NAMES]) as shipped,
        tempfile.TemporaryDirectory() as tmp,
    ):
        out_dir = pathlib.Path(tmp)
        build(out_dir)
        for name in NAMES:
            got = (out_dir / name).read_bytes()
            assert got == shipped[BOARD_DIR / name], (
                f"{name} does not reproduce byte-identically"
            )

    print("ok")
