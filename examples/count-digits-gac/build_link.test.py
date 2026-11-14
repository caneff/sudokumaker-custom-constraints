# build_link.py --refresh, run in a copy of the examples tree: on the
# unchanged tree it rewrites required-digits' two links byte for byte, and
# after a real change to a frame backend it embeds the new code even though
# outside-sudoku's own link -- the board it starts from -- was not refreshed
# first. It refuses a flag beside --refresh rather than ignore it.
#
#   uv run examples/count-digits-gac/build_link.test.py

import pathlib
import shutil
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
EXAMPLES = HERE.parent
NAMES = ["PUZZLE_LINK.txt", "PUZZLE_LINK_original.txt"]
PROBE = "SPEC_952_PROBE"

sys.path.insert(0, str(EXAMPLES / "_shared"))
from sm_document import find_constraint
from sudoku_kit.link_codec import decode_puzzle


def copy_of_examples(tmp):
    """The examples tree, copied: the refresh writes into its own folder."""
    root = pathlib.Path(tmp) / "examples"
    shutil.copytree(EXAMPLES, root, ignore=shutil.ignore_patterns("__pycache__"))
    return root


def refresh(root, *flags):
    return subprocess.run(
        [
            sys.executable,
            str(root / "count-digits-gac/build_link.py"),
            "--refresh",
            *flags,
        ],
        capture_output=True,
        text=True,
        timeout=300,
    )


def rebuilds_byte_for_byte():
    with tempfile.TemporaryDirectory() as tmp:
        root = copy_of_examples(tmp)
        board = root / "count-digits-gac/required-digits"
        for name in NAMES:
            (board / name).write_text("stale\n")
        run = refresh(root)
        assert run.returncode == 0, run.stderr
        for name in NAMES:
            got = (board / name).read_bytes()
            assert got == (HERE / "required-digits" / name).read_bytes(), (
                f"--refresh does not rebuild required-digits/{name} byte for byte"
            )


def picks_up_a_frame_backend_change_on_its_own():
    with tempfile.TemporaryDirectory() as tmp:
        root = copy_of_examples(tmp)
        corners = root / "_shared/frame-corners.js"
        corners.write_text(corners.read_text() + f"\nconst {PROBE} = 1\n")
        run = refresh(root)
        assert run.returncode == 0, run.stderr
        for name in NAMES:
            doc = decode_puzzle(
                (root / "count-digits-gac/required-digits" / name).read_text().strip()
            )
            code = find_constraint(doc, "Frame Corners")["definition"]["backend"][
                "code"
            ]
            assert PROBE in code, (
                f"required-digits/{name} kept the old frame-corners.js"
            )


def refuses_a_flag_beside_refresh():
    with tempfile.TemporaryDirectory() as tmp:
        root = copy_of_examples(tmp)
        out = pathlib.Path(tmp) / "out.txt"
        run = refresh(root, "--out", str(out))
        assert run.returncode == 2, (run.returncode, run.stderr)
        assert "drop --out" in run.stderr, run.stderr
        assert not out.exists()


if __name__ == "__main__":
    rebuilds_byte_for_byte()
    picks_up_a_frame_backend_change_on_its_own()
    refuses_a_flag_beside_refresh()
    print("ok")
